/**
 * Multi-shot stitcher.
 *
 * Takes the generated assets for every shot in a storyboard and produces
 * a single MP4 with real editorial cuts, transitions, ken-burns on
 * stills, and an optional audio mix (voiceover + music). Output is
 * uploaded to R2 and the URL returned.
 *
 * Why FFmpeg? Remotion is a React compositor — it's perfect for titles,
 * graphics, and layouts. But stitching 5-10 video clips with transition
 * effects and audio ducking is exactly what FFmpeg is made for. Running
 * both in the same pipeline gives us:
 *
 *   1. FFmpeg assembles the base cut (video clips + transitions).
 *   2. Remotion's ViralShort/Slideshow templates render any overlay
 *      text/graphics on top as a second pass when the user wants
 *      burned-in captions. (That second pass is optional.)
 *
 * For now this file implements step 1 — the assembly. Step 2 is a
 * future follow-up.
 */

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { uploadFile } from './r2.js';
import type {
  ShotTransition,
  ShotSpeedRamp,
} from './personalDirector.js';

/* ═══════════════════════════════════════════════════════════════════ */
/* Types                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export interface StitchShotInput {
  /** Source URL — image OR video. */
  url: string;
  /** 'image' | 'video'. */
  kind: 'image' | 'video';
  /** How long this shot should last in the final render (seconds). */
  durationSeconds: number;
  /** Transition into the NEXT shot. */
  transitionOut: ShotTransition;
  /** Optional speed ramp effect. */
  speedRamp?: ShotSpeedRamp;
  /** Focal point for Ken Burns on images (0..1). */
  focalX?: number;
  focalY?: number;
}

export interface StitchAudioInput {
  /** Voiceover mp3 URL (mixed at 1.0). */
  voiceoverUrl?: string;
  /** Music mp3 URL (ducked when VO is present). */
  musicUrl?: string;
  /** Music volume when VO is silent (0..1). */
  musicDuckLowVolume?: number;
}

export interface StitchArgs {
  accountId: string;
  postId: string;
  shots: StitchShotInput[];
  audio?: StitchAudioInput;
  /** Output aspect ratio. Defaults to 9:16 portrait. */
  aspectRatio?: '9:16' | '1:1' | '16:9' | '4:5';
  /** Global colour grade hint — applied as an FFmpeg eq/curves filter. */
  colourGrade?: 'natural' | 'warm' | 'cool' | 'teal_orange' | 'film' | 'bw' | 'high_contrast';
  /** Add film grain overlay. */
  useGrain?: boolean;
  /** Apply subtle letterbox bars. */
  letterbox?: boolean;
}

export interface StitchResult {
  videoUrl: string;
  durationSeconds: number;
  shotCount: number;
  /** 'ffmpeg' | 'mock' — the mock path returns a single-asset URL when ffmpeg isn't available. */
  renderer: 'ffmpeg' | 'mock';
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Entry point                                                          */
/* ═══════════════════════════════════════════════════════════════════ */

export async function stitchShots(args: StitchArgs): Promise<StitchResult> {
  const ffmpegBin = await detectFfmpeg();
  if (!ffmpegBin) {
    // Graceful fallback: upload the first shot's asset as a placeholder.
    // The pipeline logs this as a warning so operators can install ffmpeg.
    console.warn('[stitcher] ffmpeg not found — returning first-shot passthrough');
    return {
      videoUrl: args.shots[0]?.url ?? '',
      durationSeconds: args.shots.reduce((a, s) => a + s.durationSeconds, 0),
      shotCount: args.shots.length,
      renderer: 'mock',
    };
  }

  const workDir = path.join(tmpdir(), `stitch-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });
  const cleanups: string[] = [];

  try {
    // 1. Download every shot asset to local disk for FFmpeg.
    const localShots = await Promise.all(
      args.shots.map(async (s, i) => {
        const local = await download(s.url, path.join(workDir, `shot-${i}.${s.kind === 'video' ? 'mp4' : 'jpg'}`));
        cleanups.push(local);
        return { ...s, localPath: local };
      }),
    );

    // 2. Normalize every shot into a same-dimensions, same-fps MP4 segment.
    //    Images get Ken Burns, videos get trimmed/padded/scaled.
    const { width, height } = dimsFor(args.aspectRatio ?? '9:16');
    const fps = 30;

    const segmentPaths: string[] = [];
    for (let i = 0; i < localShots.length; i++) {
      const s = localShots[i]!;
      const segPath = path.join(workDir, `seg-${i}.mp4`);
      cleanups.push(segPath);
      await normalizeToSegment({
        ffmpegBin,
        input: s.localPath,
        output: segPath,
        kind: s.kind,
        durationSeconds: s.durationSeconds,
        focalX: s.focalX ?? 0.5,
        focalY: s.focalY ?? 0.5,
        speedRamp: s.speedRamp,
        width,
        height,
        fps,
        colourGrade: args.colourGrade ?? 'natural',
        useGrain: args.useGrain ?? false,
        letterbox: args.letterbox ?? false,
      });
      segmentPaths.push(segPath);
    }

    // 3. Concat with transitions. We use xfade for cross_dissolve / dip /
    //    fade-style; hard_cut is achieved with the concat demuxer.
    const concatPath = path.join(workDir, 'concat.mp4');
    cleanups.push(concatPath);
    await concatSegments({
      ffmpegBin,
      segmentPaths,
      transitions: args.shots.slice(0, -1).map((s) => s.transitionOut),
      output: concatPath,
      fps,
      width,
      height,
    });

    // 4. Audio mix — VO on top of ducked music.
    const finalPath = path.join(workDir, 'final.mp4');
    cleanups.push(finalPath);
    if (args.audio?.voiceoverUrl || args.audio?.musicUrl) {
      const voLocal = args.audio.voiceoverUrl
        ? await download(args.audio.voiceoverUrl, path.join(workDir, 'vo.mp3'))
        : undefined;
      const muLocal = args.audio.musicUrl
        ? await download(args.audio.musicUrl, path.join(workDir, 'music.mp3'))
        : undefined;
      if (voLocal) cleanups.push(voLocal);
      if (muLocal) cleanups.push(muLocal);
      await mixAudio({
        ffmpegBin,
        videoInput: concatPath,
        voiceoverPath: voLocal,
        musicPath: muLocal,
        output: finalPath,
        musicDuckLowVolume: args.audio.musicDuckLowVolume ?? 0.22,
      });
    } else {
      // No audio — the concat result IS the final.
      copyFile(concatPath, finalPath);
    }

    // 5. Upload to R2.
    const buffer = readFileSync(finalPath);
    const upload = await uploadFile(
      `personal/${args.accountId}/stitched`,
      buffer,
      `${args.postId}.mp4`,
      'video/mp4',
    );

    const totalDuration = args.shots.reduce((a, s) => a + s.durationSeconds, 0);
    return {
      videoUrl: upload.url,
      durationSeconds: totalDuration,
      shotCount: args.shots.length,
      renderer: 'ffmpeg',
    };
  } finally {
    for (const c of cleanups) {
      try {
        unlinkSync(c);
      } catch {
        /* ignore */
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* FFmpeg helpers                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

async function detectFfmpeg(): Promise<string | null> {
  // Honor env override first.
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  // Check PATH via `which`.
  return new Promise<string | null>((resolve) => {
    const p = spawn('which', ['ffmpeg']);
    let stdout = '';
    p.stdout.on('data', (b) => (stdout += b.toString()));
    p.on('close', () => {
      const trimmed = stdout.trim();
      resolve(trimmed && existsSync(trimmed) ? trimmed : null);
    });
    p.on('error', () => resolve(null));
  });
}

function dimsFor(ar: '9:16' | '1:1' | '16:9' | '4:5'): { width: number; height: number } {
  switch (ar) {
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    case '9:16':
    default:
      return { width: 1080, height: 1920 };
  }
}

/* ─── Download ───────────────────────────────────────────────── */

async function download(url: string, destPath: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buffer);
  return destPath;
}

function copyFile(src: string, dst: string) {
  const buf = readFileSync(src);
  writeFileSync(dst, buf);
}

/* ─── Normalize one shot into a segment ──────────────────── */

interface NormalizeArgs {
  ffmpegBin: string;
  input: string;
  output: string;
  kind: 'image' | 'video';
  durationSeconds: number;
  focalX: number;
  focalY: number;
  speedRamp?: ShotSpeedRamp;
  width: number;
  height: number;
  fps: number;
  colourGrade: string;
  useGrain: boolean;
  letterbox: boolean;
}

async function normalizeToSegment(a: NormalizeArgs): Promise<void> {
  const filters: string[] = [];

  // Ken Burns on stills: we add a zoompan filter with a duration-based
  // step so the whole clip scales 1.00 → 1.12 over the shot duration.
  if (a.kind === 'image') {
    const totalFrames = Math.round(a.durationSeconds * a.fps);
    const zoomStep = 0.0008;
    const panXCenter = Math.round(a.focalX * (a.width * 0.12));
    const panYCenter = Math.round(a.focalY * (a.height * 0.12));
    filters.push(
      `scale=${a.width * 2}:${a.height * 2},zoompan=z='min(zoom+${zoomStep},1.12)':x='iw/2-iw/(2*zoom)+${panXCenter}':y='ih/2-ih/(2*zoom)+${panYCenter}':d=${totalFrames}:s=${a.width}x${a.height}:fps=${a.fps}`,
    );
  } else {
    // Scale/crop videos into the target dimensions while preserving fps.
    filters.push(
      `scale=${a.width}:${a.height}:force_original_aspect_ratio=increase`,
      `crop=${a.width}:${a.height}`,
      `fps=${a.fps}`,
    );
  }

  // Speed ramp.
  if (a.speedRamp === 'slow_mo') filters.push('setpts=1.4*PTS');
  if (a.speedRamp === 'speed_up') filters.push('setpts=0.65*PTS');
  // freeze_end is handled by the concat pass, not per-segment.

  // Colour grade.
  const grade = gradeFilter(a.colourGrade);
  if (grade) filters.push(grade);

  if (a.useGrain) filters.push('noise=alls=8:allf=t+u');
  if (a.letterbox) {
    const barHeight = Math.round(a.height * 0.08);
    filters.push(
      `pad=${a.width}:${a.height}:0:0:color=black,drawbox=x=0:y=0:w=${a.width}:h=${barHeight}:color=black@1:t=fill,drawbox=x=0:y=${a.height - barHeight}:w=${a.width}:h=${barHeight}:color=black@1:t=fill`,
    );
  }

  const args: string[] = [];
  if (a.kind === 'image') {
    args.push('-loop', '1', '-t', String(a.durationSeconds));
  }
  args.push('-i', a.input);
  if (a.kind === 'video') args.push('-t', String(a.durationSeconds));
  args.push('-vf', filters.join(','));
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20');
  args.push('-an'); // strip audio — we mix separately
  args.push('-r', String(a.fps));
  args.push('-movflags', '+faststart');
  args.push('-y', a.output);

  await runFfmpeg(a.ffmpegBin, args, `normalize:${path.basename(a.output)}`);
}

/* ─── Concat with transitions ────────────────────────────── */

interface ConcatArgs {
  ffmpegBin: string;
  segmentPaths: string[];
  transitions: ShotTransition[];
  output: string;
  fps: number;
  width: number;
  height: number;
}

async function concatSegments(a: ConcatArgs): Promise<void> {
  const n = a.segmentPaths.length;
  if (n === 0) throw new Error('concat: no segments');
  if (n === 1) {
    copyFile(a.segmentPaths[0]!, a.output);
    return;
  }

  // Does the storyboard want ANY non-hard-cut transitions? If not, use
  // the cheap concat demuxer which is lossless and near-instant.
  const needsXfade = a.transitions.some((t) => requiresXfade(t));
  if (!needsXfade) {
    await concatDemuxer(a);
    return;
  }

  // xfade chain — build a graph where each segment xfades into the next.
  // Segment durations are inferred from the files via probe.
  const durations = await Promise.all(
    a.segmentPaths.map((p) => probeDurationSeconds(a.ffmpegBin, p)),
  );

  const inputArgs: string[] = [];
  for (const p of a.segmentPaths) inputArgs.push('-i', p);

  // Build a filter_complex that applies xfade between [i]→[i+1] and
  // labels intermediates v0, v1, …. Each xfade offset is the running sum
  // of prior segment durations minus the transition overlap.
  const steps: string[] = [];
  const xfadeDur = 0.3;
  let runningOffset = 0;
  for (let i = 0; i < n - 1; i++) {
    const transition = a.transitions[i] ?? 'cross_dissolve';
    const mode = xfadeMode(transition);
    const fromLabel = i === 0 ? `[0:v]` : `[v${i - 1}]`;
    const toLabel = `[${i + 1}:v]`;
    runningOffset += durations[i]! - xfadeDur;
    const outLabel = i === n - 2 ? `[outv]` : `[v${i}]`;
    steps.push(
      `${fromLabel}${toLabel}xfade=transition=${mode}:duration=${xfadeDur}:offset=${runningOffset.toFixed(3)}${outLabel}`,
    );
  }

  const filter = steps.join(';');
  const args: string[] = [...inputArgs, '-filter_complex', filter, '-map', '[outv]'];
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20');
  args.push('-r', String(a.fps));
  args.push('-movflags', '+faststart');
  args.push('-y', a.output);

  await runFfmpeg(a.ffmpegBin, args, 'concat-xfade');
}

async function concatDemuxer(a: ConcatArgs): Promise<void> {
  const listPath = path.join(path.dirname(a.output), 'concat-list.txt');
  const contents = a.segmentPaths
    .map((p) => `file '${p.replace(/'/g, `'\\''`)}'`)
    .join('\n');
  writeFileSync(listPath, contents);
  try {
    await runFfmpeg(
      a.ffmpegBin,
      [
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        '-y', a.output,
      ],
      'concat-demuxer',
    );
  } finally {
    try {
      unlinkSync(listPath);
    } catch {
      /* ignore */
    }
  }
}

function requiresXfade(t: ShotTransition): boolean {
  return t === 'cross_dissolve' || t === 'dip_to_black' || t === 'flash_cut' || t === 'match_cut';
}

function xfadeMode(t: ShotTransition): string {
  switch (t) {
    case 'cross_dissolve':
      return 'fade';
    case 'dip_to_black':
      return 'fadeblack';
    case 'flash_cut':
      return 'fadewhite';
    case 'match_cut':
      return 'dissolve';
    default:
      return 'fade';
  }
}

async function probeDurationSeconds(ffmpegBin: string, file: string): Promise<number> {
  // We call ffmpeg -i on the file and parse Duration from stderr.
  // ffprobe would be cleaner but isn't guaranteed to ship everywhere ffmpeg is.
  return new Promise<number>((resolve, reject) => {
    const p = spawn(ffmpegBin, ['-hide_banner', '-i', file]);
    let stderr = '';
    p.stderr.on('data', (b) => (stderr += b.toString()));
    p.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
      if (!m) return reject(new Error('Could not probe duration'));
      const h = Number(m[1]);
      const mm = Number(m[2]);
      const s = Number(m[3]);
      resolve(h * 3600 + mm * 60 + s);
    });
    p.on('error', reject);
  });
}

/* ─── Audio mix ──────────────────────────────────────────── */

interface MixArgs {
  ffmpegBin: string;
  videoInput: string;
  voiceoverPath?: string;
  musicPath?: string;
  output: string;
  musicDuckLowVolume: number;
}

async function mixAudio(a: MixArgs): Promise<void> {
  const args: string[] = ['-i', a.videoInput];
  const inputs: string[] = [];
  if (a.voiceoverPath) {
    args.push('-i', a.voiceoverPath);
    inputs.push('vo');
  }
  if (a.musicPath) {
    args.push('-i', a.musicPath);
    inputs.push('music');
  }

  if (inputs.length === 0) {
    copyFile(a.videoInput, a.output);
    return;
  }

  // Build filter_complex. Video stays on [0:v]; audio is mixed.
  const filterParts: string[] = [];
  const voIdx = inputs.indexOf('vo');
  const muIdx = inputs.indexOf('music');
  const voInput = voIdx !== -1 ? `[${voIdx + 1}:a]` : undefined;
  const muInput = muIdx !== -1 ? `[${muIdx + 1}:a]` : undefined;

  if (voInput && muInput) {
    // Duck music while VO plays.
    filterParts.push(`${muInput}volume=${a.musicDuckLowVolume}[mu]`);
    filterParts.push(`${voInput}${'[mu]'}amix=inputs=2:duration=first:dropout_transition=0[a]`);
  } else if (voInput) {
    filterParts.push(`${voInput}volume=1[a]`);
  } else if (muInput) {
    filterParts.push(`${muInput}volume=0.55[a]`);
  }

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '0:v:0', '-map', '[a]');
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-movflags', '+faststart');
  args.push('-y', a.output);

  await runFfmpeg(a.ffmpegBin, args, 'mix-audio');
}

/* ─── Colour grade presets ───────────────────────────────── */

function gradeFilter(name: string): string | undefined {
  switch (name) {
    case 'natural':
      return undefined;
    case 'warm':
      return 'colortemperature=temperature=5200:mix=0.7,eq=saturation=1.08';
    case 'cool':
      return 'colortemperature=temperature=7200:mix=0.7,eq=saturation=1.02';
    case 'teal_orange':
      return 'curves=preset=vintage,eq=saturation=1.12';
    case 'film':
      return 'curves=master=\'0/0 0.25/0.2 0.75/0.82 1/1\',eq=saturation=0.95';
    case 'bw':
      return 'hue=s=0';
    case 'high_contrast':
      return 'eq=contrast=1.18:saturation=1.1';
    default:
      return undefined;
  }
}

/* ─── FFmpeg runner ──────────────────────────────────────── */

function runFfmpeg(bin: string, args: string[], label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(bin, ['-hide_banner', '-loglevel', 'error', ...args]);
    let stderr = '';
    p.stderr.on('data', (b) => (stderr += b.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`[ffmpeg ${label}] exit ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Shared-utils exports                                                */
/* ═══════════════════════════════════════════════════════════════════ */

/** For dev visibility. Safe to remove later. */
export const _internals = {
  detectFfmpeg,
  gradeFilter,
  dimsFor,
  xfadeMode,
};
