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
 *
 * Performance note: each still is animated with Ken Burns (`zoompan`)
 * and encoded at full canvas resolution (30fps). Long storyboards mean
 * many sequential FFmpeg passes — the dominant cost is CPU, not I/O.
 * Tune `PERSONAL_STITCH_PRESET` / `PERSONAL_STITCH_CRF` in `.env` for
 * speed vs quality.
 */

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { localUploadDir, uploadFile } from './r2.js';
import { resolveFfmpegBin } from '../lib/ffmpegBin.js';
import type {
  ShotTransition,
  ShotSpeedRamp,
} from './personalDirector.js';

/* ═══════════════════════════════════════════════════════════════════ */
/* H.264 speed vs quality (override via .env)                           */
/* ═══════════════════════════════════════════════════════════════════ */

const H264_ALLOWED_PRESETS = new Set([
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow',
]);

type StitchEncodePreset = 'fast' | 'balanced' | 'high';

/** Env wins; otherwise tier picks speed (when unset tier → legacy veryfast + env default crf). */
function stitchH264Preset(encodeTier?: StitchEncodePreset): string {
  const raw = process.env.PERSONAL_STITCH_PRESET?.trim().toLowerCase();
  if (raw && H264_ALLOWED_PRESETS.has(raw)) return raw;
  switch (encodeTier) {
    case 'high':
      return process.env.NODE_ENV === 'production' ? 'slow' : 'medium';
    case 'fast':
      return 'ultrafast';
    case 'balanced':
      return 'faster';
    default:
      return 'veryfast';
  }
}

/** Env `PERSONAL_STITCH_CRF` wins; else tier nudges CRF around NODE_ENV default. */
function stitchH264Crf(encodeTier?: StitchEncodePreset): string {
  const raw = process.env.PERSONAL_STITCH_CRF?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      const r = Math.round(n);
      if (r >= 18 && r <= 35) return String(r);
    }
  }
  const base = process.env.NODE_ENV === 'production' ? 22 : 23;
  switch (encodeTier) {
    case 'high':
      return String(Math.max(18, base - 2));
    case 'fast':
      return String(Math.min(35, base + 1));
    case 'balanced':
    default:
      return String(base);
  }
}

/** Optional `-profile:v high` for better quality/device compatibility (disable with PERSONAL_STITCH_H264_PROFILE=0). */
function stitchH264ProfileArgs(): string[] {
  const v = process.env.PERSONAL_STITCH_H264_PROFILE?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'none') return [];
  return ['-profile:v', 'high'];
}

/**
 * libx264 args for segment encode. `tune=stillimage` improves still / Ken-Burns
 * shots at the same CRF; omit for motion video so film motion stays natural.
 */
function stitchH264VArgs(opts?: {
  tune?: 'stillimage';
  encodeTier?: StitchEncodePreset;
}): string[] {
  const tier = opts?.encodeTier;
  return [
    '-c:v',
    'libx264',
    ...(opts?.tune ? (['-tune', opts.tune] as const) : []),
    '-pix_fmt',
    'yuv420p',
    ...stitchH264ProfileArgs(),
    '-preset',
    stitchH264Preset(tier),
    '-crf',
    stitchH264Crf(tier),
  ];
}

function stitchVerboseTiming(): boolean {
  const v = process.env.PERSONAL_STITCH_TIMING?.trim().toLowerCase();
  if (v === '0' || v === 'false') return false;
  if (v === '1' || v === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

/** When true, FFmpeg runs with `-loglevel info` and we log throttled `frame=` lines. Opt-in via env. */
function stitchFfmpegStats(): boolean {
  const v = process.env.PERSONAL_STITCH_FFMPEG_STATS?.trim().toLowerCase();
  if (v === '1' || v === 'true') return true;
  return false;
}

function tlog(msg: string) {
  if (stitchVerboseTiming()) console.info(`[stitcher:timing] ${msg}`);
}

/** Progress payload while stitching — `logLines` are persisted for the dashboard. */
export type StitchRenderProgress = {
  percent: number;
  label: string;
  logLines?: string[];
};

export type StitcherPhase = 'validate' | 'download' | 'normalize' | 'concat' | 'mix' | 'upload';

/** Structured failure from {@link stitchShots} — check `phase` for where it broke. */
export class StitcherError extends Error {
  readonly phase: StitcherPhase;

  constructor(phase: StitcherPhase, message: string, options?: { cause?: unknown }) {
    super(`[stitch:${phase}] ${message}`);
    this.name = 'StitcherError';
    this.phase = phase;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

/** While `work` runs, invoke `onTick` every `intervalMs` (encode heartbeats / UI updates). */
async function withIntervalDuring<T>(
  work: Promise<T>,
  intervalMs: number,
  onTick: () => void | Promise<void>,
): Promise<T> {
  const h = setInterval(() => {
    void Promise.resolve(onTick()).catch(() => {});
  }, intervalMs);
  try {
    return await work;
  } finally {
    clearInterval(h);
  }
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Types                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export interface StitchKeywordCard {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

/** Normalise director keyword timings to valid in-shot windows. */
export function normalizeKeywordCardsForShot(
  cards: Array<{ text: string; tStart?: number; tEnd?: number }> | undefined,
  durationSeconds: number,
): StitchKeywordCard[] | undefined {
  if (!cards?.length) return undefined;
  const d = Math.max(0.45, durationSeconds);
  const out: StitchKeywordCard[] = [];
  for (const c of cards.slice(0, 4)) {
    const text = c.text.trim();
    if (!text || text.length > 56) continue;
    let start = typeof c.tStart === 'number' && Number.isFinite(c.tStart) ? c.tStart : d * 0.22;
    let end = typeof c.tEnd === 'number' && Number.isFinite(c.tEnd) ? c.tEnd : start + Math.min(1.35, d * 0.34);
    start = Math.max(0, Math.min(d - 0.28, start));
    end = Math.max(start + 0.22, Math.min(d - 0.02, end));
    out.push({ text, startSeconds: start, endSeconds: end });
  }
  return out.length ? out : undefined;
}

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
  /** Optional keyword pop timings (lower-third). */
  keywordCards?: StitchKeywordCard[];
  /** Optional single-line label for the whole shot (e.g. sparse image text). */
  persistentCaption?: string;
}

export interface StitchAudioInput {
  /** Voiceover mp3 URL (mixed at 1.0). */
  voiceoverUrl?: string;
  /** Music mp3 URL (ducked when VO is present). */
  musicUrl?: string;
  /** Music volume when VO is speaking (0.05–0.55 typical). */
  musicDuckLowVolume?: number;
  /** Music volume when there is no VO (solo bed). Default 0.55. */
  musicSoloVolume?: number;
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
  /**
   * When server env `PERSONAL_STITCH_PRESET` / `PERSONAL_STITCH_CRF` are unset,
   * libx264 speed/quality: `fast` = drafts, `balanced` = default, `high` = cleaner (more CPU).
   */
  encodePreset?: 'fast' | 'balanced' | 'high';
  /**
   * If provided, every shot's per-shot duration is uniformly scaled so
   * the total video matches this target (±100ms). Keeps the voiceover
   * and the visuals in lockstep — without this, long-form narrations
   * run past the end of the last shot and get truncated.
   */
  targetDurationSeconds?: number;
  /**
   * Called as FFmpeg work advances (encode segments, concat, audio).
   * Used to drive dashboard progress while status is `rendering`.
   */
  onRenderProgress?: (p: StitchRenderProgress) => void | Promise<void>;
  /**
   * Lower-third keyword pops + sparse captions. `off` skips FFmpeg drawtext.
   */
  keywordOverlayStyle?: 'off' | 'subtle' | 'bold';
  /**
   * When false, still images are static (no Ken Burns). Default true.
   */
  kenBurnsOnStills?: boolean;
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
  const ffmpegBin = await resolveFfmpegBin();
  if (!ffmpegBin) {
    if (!args.shots.length) {
      throw new StitcherError('validate', 'No shots to stitch');
    }
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
    if (!args.shots.length) {
      throw new StitcherError('validate', 'No shots to stitch');
    }
    for (let i = 0; i < args.shots.length; i++) {
      const s = args.shots[i]!;
      if (!s.url?.trim()) {
        throw new StitcherError('validate', `Shot ${i + 1}: missing media URL`);
      }
      if (!Number.isFinite(s.durationSeconds) || s.durationSeconds <= 0) {
        throw new StitcherError('validate', `Shot ${i + 1}: invalid duration (${String(s.durationSeconds)}s)`);
      }
    }

    // Uniformly scale shot durations to match the target if provided.
    // This keeps voiceover + visuals in lockstep. Without this, a
    // 4-minute narration over 3-minute visuals gets its last minute
    // cut by the stitcher's -shortest / amix:duration=first behaviour.
    const workingShots = scaleShotsToTarget(
      args.shots,
      args.targetDurationSeconds,
    );
    const plannedSum = workingShots.reduce((a, s) => a + s.durationSeconds, 0);
    const { width, height } = dimsFor(args.aspectRatio ?? '9:16');
    const encodeTier = args.encodePreset;

    // 1. Download every shot asset to local disk for FFmpeg.
    let localShots: Array<(typeof workingShots)[number] & { localPath: string }>;
    try {
      localShots = await Promise.all(
        workingShots.map(async (s, i) => {
          const t0 = performance.now();
          const ext = extForMediaUrl(s.url, s.kind);
          const local = await download(
            s.url,
            path.join(workDir, `shot-${i}${ext}`),
          );
          tlog(
            `download ${i + 1}/${workingShots.length} ${(performance.now() - t0).toFixed(0)}ms bytes=${statSync(local).size}`,
          );
          cleanups.push(local);
          return { ...s, localPath: local };
        }),
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      throw new StitcherError('download', m, { cause: e });
    }

    // 2. Normalize every shot into a same-dimensions, same-fps MP4 segment.
    //    Images get Ken Burns, videos get trimmed/padded/scaled.
    const fps = 30;

    const segmentPaths: string[] = [];
    const plannedOutputSeconds = workingShots.reduce(
      (a, s) => a + s.durationSeconds,
      0,
    );
    const nShots = localShots.length;

    await Promise.resolve(
      args.onRenderProgress?.({
        percent: 6,
        label: 'Preparing media',
        logLines: [],
      }),
    );
    for (let i = 0; i < localShots.length; i++) {
      const s = localShots[i]!;
      const segPath = path.join(workDir, `seg-${i}.mp4`);
      cleanups.push(segPath);
      const segT0 = performance.now();
      const pctStart = Math.min(88, Math.round(8 + (78 * i) / Math.max(1, nShots)));
      try {
        await Promise.resolve(
          args.onRenderProgress?.({
            percent: pctStart,
            label: `Rendering scene ${i + 1} of ${nShots}…`,
            logLines: [],
          }),
        );
      } catch (e) {
        console.warn('[stitcher] onRenderProgress failed:', (e as Error).message);
      }

      let lastFfmpegStatDbAt = 0;
      try {
        await withIntervalDuring(
          normalizeToSegment({
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
            workDir,
            segmentIndex: i,
            overlayStyle: args.keywordOverlayStyle ?? 'off',
            keywordCards: s.keywordCards,
            persistentCaption: s.persistentCaption,
            encodeTier,
            kenBurnsOnStills: args.kenBurnsOnStills !== false,
            onFfmpegStatsLine: (line) => {
              void line;
              const now = Date.now();
              if (now - lastFfmpegStatDbAt < 45_000) return;
              lastFfmpegStatDbAt = now;
              void Promise.resolve(
                args.onRenderProgress?.({
                  percent: pctStart,
                  label: `Rendering scene ${i + 1} of ${nShots}…`,
                  logLines: [],
                }),
              ).catch(() => {});
            },
          }),
          15_000,
          async () => {
            const sec = Math.round((performance.now() - segT0) / 1000);
            try {
              await Promise.resolve(
                args.onRenderProgress?.({
                  percent: pctStart,
                  label: `Rendering scene ${i + 1} of ${nShots} (${formatElapsed(sec)} elapsed)`,
                  logLines: [],
                }),
              );
            } catch (e) {
              console.warn('[stitcher] onRenderProgress failed:', (e as Error).message);
            }
          },
        );
      } catch (e) {
        if (e instanceof StitcherError) throw e;
        const m = e instanceof Error ? e.message : String(e);
        throw new StitcherError('normalize', `Shot ${i + 1}/${nShots} (${s.kind}, ${s.durationSeconds}s): ${m}`, {
          cause: e,
        });
      }

      segmentPaths.push(segPath);
      const pct = Math.min(88, Math.round(8 + (78 * (i + 1)) / Math.max(1, nShots)));
      try {
        await Promise.resolve(
          args.onRenderProgress?.({
            percent: pct,
            label: `Rendered scene ${i + 1} of ${nShots}`,
            logLines: [],
          }),
        );
      } catch (e) {
        console.warn('[stitcher] onRenderProgress failed:', (e as Error).message);
      }
    }

    // 3. Concat with transitions. We use xfade for cross_dissolve / dip /
    //    fade-style; hard_cut is achieved with the concat demuxer.
    const concatPath = path.join(workDir, 'concat.mp4');
    cleanups.push(concatPath);
    // A single filter_complex with many xfade links + long runtime is
    // pathologically slow (hours) and looks "stuck". Prefer the concat
    // demuxer for large timelines — hard cuts instead of dissolves.
    const skipXfade =
      segmentPaths.length > 12 || plannedOutputSeconds > 180;
    const transitions = workingShots.slice(0, -1).map((s) => s.transitionOut);
    const needsAnyXfade = transitions.some((t) => requiresXfade(t));
    try {
      await Promise.resolve(
        args.onRenderProgress?.({
          percent: 89,
          label: 'Joining clips',
          logLines: [],
        }),
      );
    } catch (e) {
      console.warn('[stitcher] onRenderProgress failed:', (e as Error).message);
    }
    try {
      await concatSegments({
        ffmpegBin,
        segmentPaths,
        transitions,
        output: concatPath,
        fps,
        width,
        height,
        skipXfade,
        plannedOutputSeconds,
        encodePreset: encodeTier,
      });
    } catch (e) {
      if (e instanceof StitcherError) throw e;
      const m = e instanceof Error ? e.message : String(e);
      throw new StitcherError('concat', m, { cause: e });
    }
    try {
      await Promise.resolve(
        args.onRenderProgress?.({
          percent: 90,
          label: 'Joining clips',
          logLines: [],
        }),
      );
    } catch (e) {
      console.warn('[stitcher] onRenderProgress failed:', (e as Error).message);
    }

    // 4. Audio mix — VO on top of ducked music.
    const finalPath = path.join(workDir, 'final.mp4');
    cleanups.push(finalPath);
    if (args.audio?.voiceoverUrl || args.audio?.musicUrl) {
      let voLocal: string | undefined;
      if (args.audio.voiceoverUrl) {
        try {
          voLocal = await download(args.audio.voiceoverUrl, path.join(workDir, 'vo.mp3'));
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          console.warn('[stitcher] voiceover download failed, continuing without VO:', m);
        }
      }
      let muLocal: string | undefined;
      if (args.audio.musicUrl) {
        try {
          muLocal = await download(args.audio.musicUrl, path.join(workDir, 'music.mp3'));
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          console.warn('[stitcher] music download failed, continuing without music:', m);
        }
      }
      if (voLocal) cleanups.push(voLocal);
      if (muLocal) cleanups.push(muLocal);
      try {
        await mixAudio({
          ffmpegBin,
          videoInput: concatPath,
          voiceoverPath: voLocal,
          musicPath: muLocal,
          output: finalPath,
          musicDuckLowVolume: args.audio.musicDuckLowVolume ?? 0.22,
          musicSoloVolume: args.audio.musicSoloVolume ?? 0.55,
        });
      } catch (e) {
        if (e instanceof StitcherError) throw e;
        const m = e instanceof Error ? e.message : String(e);
        throw new StitcherError('mix', m, { cause: e });
      }
    } else {
      try {
        // No audio — the concat result IS the final.
        copyFile(concatPath, finalPath);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        throw new StitcherError('mix', `Could not copy concat output to final: ${m}`, { cause: e });
      }
    }
    try {
      await Promise.resolve(
        args.onRenderProgress?.({
          percent: 95,
          label: 'Finishing',
          logLines: [],
        }),
      );
    } catch (e) {
      console.warn('[stitcher] onRenderProgress failed:', (e as Error).message);
    }

    // 5. Upload to R2.
    if (!existsSync(finalPath)) {
      throw new StitcherError(
        'upload',
        `Missing output after encode: ${path.basename(finalPath)} (concat/mix may have failed silently)`,
      );
    }
    let buffer: Buffer;
    try {
      buffer = readFileSync(finalPath);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      throw new StitcherError('upload', `Could not read rendered MP4: ${m}`, { cause: e });
    }
    try {
      await Promise.resolve(
        args.onRenderProgress?.({
          percent: 98,
          label: 'Uploading',
          logLines: [],
        }),
      );
    } catch (e) {
      console.warn('[stitcher] onRenderProgress failed:', (e as Error).message);
    }
    let upload;
    try {
      upload = await uploadFile(
        `personal/${args.accountId}/stitched`,
        buffer,
        `${args.postId}.mp4`,
        'video/mp4',
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      throw new StitcherError('upload', `R2 upload failed: ${m}`, { cause: e });
    }

    const totalDuration = workingShots.reduce((a, s) => a + s.durationSeconds, 0);
    return {
      videoUrl: upload.url,
      durationSeconds: totalDuration,
      shotCount: workingShots.length,
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

/**
 * Scale every shot's duration so the full video hits `target` seconds.
 * Only runs when target is set and differs from the current sum by more
 * than 2%. Per-shot floor of 1s so no shot becomes a single frame.
 * Per-shot ceiling of 18s so one shot doesn't become a 45-second stare.
 *
 * Rounds every shot to the nearest 0.1s and fixes the rounding drift
 * by adjusting the longest shot so the sum is exactly `target`.
 */
function scaleShotsToTarget<T extends { durationSeconds: number }>(
  shots: T[],
  target: number | undefined,
): T[] {
  if (!target || shots.length === 0) return shots;
  const current = shots.reduce((a, s) => a + s.durationSeconds, 0);
  if (current <= 0) return shots;
  if (Math.abs(current - target) / target < 0.02) return shots;

  const ratio = target / current;
  const scaled = shots.map((s) => ({
    ...s,
    durationSeconds: Math.max(
      1,
      Math.min(18, Math.round(s.durationSeconds * ratio * 10) / 10),
    ),
  }));
  // Correct rounding drift by nudging the longest shot.
  const scaledSum = scaled.reduce((a, s) => a + s.durationSeconds, 0);
  const delta = target - scaledSum;
  if (Math.abs(delta) > 0.05) {
    let longestIdx = 0;
    for (let i = 1; i < scaled.length; i++) {
      if (scaled[i]!.durationSeconds > scaled[longestIdx]!.durationSeconds) {
        longestIdx = i;
      }
    }
    scaled[longestIdx] = {
      ...scaled[longestIdx]!,
      durationSeconds: Math.max(
        1,
        Math.min(18, Math.round((scaled[longestIdx]!.durationSeconds + delta) * 10) / 10),
      ),
    };
  }
  return scaled;
}

/* ─── Download ───────────────────────────────────────────────── */

/** Dev/local disk uploads: avoid HTTP self-fetch (fragile under FFmpeg load + Windows localhost). */
function resolveLocalUploadsDiskPath(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const h = u.hostname.toLowerCase();
    const isLoopback = h === 'localhost' || h === '127.0.0.1' || h === '::1';
    if (!isLoopback) return null;
    const prefix = '/uploads/';
    if (!u.pathname.startsWith(prefix)) return null;
    const decoded = decodeURIComponent(u.pathname.slice(prefix.length));
    const normalized = decoded.replace(/\\/g, '/');
    const parts = normalized.split('/').filter((p) => p.length > 0);
    for (const p of parts) {
      if (p === '.' || p === '..') return null;
    }
    const base = path.resolve(localUploadDir());
    const abs = path.resolve(base, ...parts);
    if (abs !== base && !abs.startsWith(base + path.sep)) return null;
    return abs;
  } catch {
    return null;
  }
}

async function download(url: string, destPath: string, timeoutMs = 120_000): Promise<string> {
  const localPath = resolveLocalUploadsDiskPath(url);
  if (localPath) {
    if (!existsSync(localPath)) {
      throw new Error(
        `Local upload file missing (expected from dev /uploads URL): ${localPath} (from ${url.slice(0, 160)})`,
      );
    }
    const buffer = readFileSync(localPath);
    if (buffer.length === 0) {
      throw new Error(`Local upload file empty: ${localPath}`);
    }
    writeFileSync(destPath, buffer);
    return destPath;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} for ${url.slice(0, 160)}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error(`Download returned empty body (${res.status}) for ${url.slice(0, 120)}`);
    }
    writeFileSync(destPath, buffer);
    return destPath;
  } catch (e) {
    if (ac.signal.aborted) {
      throw new Error(`Download timed out after ${timeoutMs / 1000}s: ${url.slice(0, 120)}`);
    }
    const msg = e instanceof Error ? e.message : String(e);
    const cause =
      e instanceof Error && e.cause != null ? ` cause=${String((e as Error & { cause?: unknown }).cause)}` : '';
    throw new Error(`Download fetch failed: ${msg}${cause} url=${url.slice(0, 200)}`);
  } finally {
    clearTimeout(timer);
  }
}

function copyFile(src: string, dst: string) {
  const buf = readFileSync(src);
  writeFileSync(dst, buf);
}

/** File extension for a downloaded shot (helps FFmpeg sniff codecs for webp/gif/png). */
function extForMediaUrl(url: string, kind: 'image' | 'video'): string {
  try {
    const pathname = new URL(url, 'https://placeholder.local').pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (/^\.[a-z0-9]{2,5}$/.test(ext)) return ext;
  } catch {
    /* ignore */
  }
  return kind === 'video' ? '.mp4' : '.jpg';
}

/** FFmpeg concat demuxer lines: forward slashes + escaped quotes (Windows-safe). */
function concatDemuxerFileLine(filePath: string): string {
  const abs = path.resolve(filePath).replace(/\\/g, '/');
  return `file '${abs.replace(/'/g, `'\\''`)}'`;
}

function overlayFontPath(): string | null {
  const envPath = process.env.PERSONAL_OVERLAY_FONT?.trim();
  if (envPath && existsSync(envPath)) return envPath;
  if (process.platform === 'win32') {
    const winFonts = [
      'C:/Windows/Fonts/segoeuib.ttf',
      'C:/Windows/Fonts/segoeui.ttf',
      'C:/Windows/Fonts/arialbd.ttf',
      'C:/Windows/Fonts/arial.ttf',
    ];
    for (const w of winFonts) {
      if (existsSync(w)) return w;
    }
  }
  const linuxFonts = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ];
  for (const d of linuxFonts) {
    if (existsSync(d)) return d;
  }
  return null;
}

/** Strip control chars / odd whitespace so drawtext + textfile stay reliable. */
function sanitizeOverlayFileText(raw: string, maxLen: number): string {
  const t = raw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  return Array.from(t)
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return c === 9 || (c >= 32 && c !== 127);
    })
    .join('');
}

/** Paths inside FFmpeg filter strings (escape `:` for Windows drive letters). */
function ffmpegFilterPath(p: string): string {
  return path.resolve(p).replace(/\\/g, '/').replace(/:/g, '\\:');
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
  workDir: string;
  segmentIndex: number;
  overlayStyle?: 'off' | 'subtle' | 'bold';
  keywordCards?: StitchKeywordCard[];
  persistentCaption?: string;
  encodeTier?: StitchEncodePreset;
  /** Optional: throttled `frame=` lines for server logs + dashboard activity. */
  onFfmpegStatsLine?: (line: string) => void;
  /** When false, stills are scaled/cropped without zoompan. Default true. */
  kenBurnsOnStills?: boolean;
}

async function normalizeToSegment(a: NormalizeArgs): Promise<void> {
  const filters: string[] = [];
  let imageOutFrames = 0;

  // Ken Burns on stills: we add a zoompan filter with a duration-based
  // step so the whole clip scales 1.00 → 1.12 over the shot duration.
  // Focal is clamped to a safe interior (0.15–0.85) so the pan doesn't
  // walk off the source and introduce black bars.
  //
  // CRITICAL — zoompan `d` is **output frames per INPUT frame**, not total
  // clip length. `-loop 1 -t 18.5` decodes ~1 image frame per second by
  // default (~19 frames), so `d=555` became 19×555 frames (~5+ minutes).
  // Feed **one** decoded frame (no `-loop` for static jpeg/png) so `d`
  // equals the shot length in frames. `-frames:v` caps output if needed.
  if (a.kind === 'image') {
    imageOutFrames = Math.max(1, Math.round(a.durationSeconds * a.fps));
    const useKb = a.kenBurnsOnStills !== false;
    if (useKb) {
      const zoomStep = 0.0008;
      const safeFocalX = Math.max(0.15, Math.min(0.85, a.focalX));
      const safeFocalY = Math.max(0.15, Math.min(0.85, a.focalY));
      const xExpr = `'iw*${safeFocalX}-(iw/zoom/2)'`;
      const yExpr = `'ih*${safeFocalY}-(ih/zoom/2)'`;
      filters.push(
        'select=eq(n\\,0),setpts=PTS-STARTPTS',
        `scale=${a.width * 2}:${a.height * 2}:flags=lanczos,` +
          `zoompan=z='min(zoom+${zoomStep},1.12)':x=${xExpr}:y=${yExpr}:` +
          `d=${imageOutFrames}:s=${a.width}x${a.height}:fps=${a.fps}`,
      );
    } else {
      filters.push(
        'select=eq(n\\,0),setpts=PTS-STARTPTS',
        `scale=${a.width}:${a.height}:force_original_aspect_ratio=increase:flags=lanczos`,
        `crop=${a.width}:${a.height}`,
        `fps=${a.fps}`,
      );
    }
  } else {
    // Scale + crop videos into the target dimensions while preserving fps.
    // force_original_aspect_ratio=increase makes sure at least one
    // dimension overflows; `crop=w:h` defaults to centre-crop, so the
    // framing matches what a photographer would call "fill crop".
    //
    // Why the tpad + trim dance: AI video models frequently return
    // clips SHORTER than asked (kling returns 5s when asked for 10s,
    // some hailuo runs come back 4s when asked 6s). Without this the
    // stitched output ends in a black frame when it reaches the end
    // of the source. We freeze-frame-extend by 30s (far longer than
    // we'd ever need) and then hard-trim to the desired length.
    filters.push(
      `scale=${a.width}:${a.height}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${a.width}:${a.height}`,
      `fps=${a.fps}`,
      `tpad=stop_mode=clone:stop_duration=30`,
      `trim=end=${a.durationSeconds}`,
      `setpts=PTS-STARTPTS`,
    );
  }

  // Speed ramp (video only). On stills, `setpts` after zoompan breaks the
  // fixed frame budget (`-frames:v`) vs storyboard duration — skip here.
  if (a.kind === 'video') {
    if (a.speedRamp === 'slow_mo') filters.push('setpts=1.4*PTS');
    if (a.speedRamp === 'speed_up') filters.push('setpts=0.65*PTS');
  }

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

  const wantOverlays =
    a.overlayStyle &&
    a.overlayStyle !== 'off' &&
    ((a.keywordCards && a.keywordCards.length > 0) ||
      Boolean(a.persistentCaption?.trim()));
  if (wantOverlays) {
    const font = overlayFontPath();
    if (!font) {
      console.warn(
        '[stitcher] text overlays skipped — set PERSONAL_OVERLAY_FONT to a .ttf or install DejaVu/Segoe UI Bold',
      );
    } else {
      const fontEsc = ffmpegFilterPath(font);
      const bold = a.overlayStyle === 'bold';
      const fs = Math.max(
        20,
        Math.round(a.height * (bold ? 0.062 : 0.048)),
      );
      const border = bold ? 4 : 2;
      const boxAlpha = bold ? '0.5' : '0.38';
      const boxBorder = bold ? 16 : 12;
      const yFrac = bold ? 0.71 : 0.745;
      const shadow = bold
        ? ':shadowcolor=black@0.82:shadowx=3:shadowy=3'
        : ':shadowcolor=black@0.55:shadowx=2:shadowy=2';
      let idx = 0;
      for (const kw of a.keywordCards ?? []) {
        const line = sanitizeOverlayFileText(kw.text, 56);
        if (!line) continue;
        const tf = path.join(a.workDir, `ov-${a.segmentIndex}-${idx++}.txt`);
        writeFileSync(tf, line, 'utf8');
        const tfEsc = ffmpegFilterPath(tf);
        const y = Math.round(a.height * yFrac);
        const t0 = kw.startSeconds.toFixed(3);
        const t1 = kw.endSeconds.toFixed(3);
        filters.push(
          `drawtext=fontfile=${fontEsc}:textfile=${tfEsc}:reload=1:fontsize=${fs}:fontcolor=white:borderw=${border}:bordercolor=black@0.88${shadow}:box=1:boxcolor=black@${boxAlpha}:boxborderw=${boxBorder}:x=(w-text_w)/2:y=${y}:enable='between(t\\,${t0}\\,${t1})'`,
        );
      }
      if (a.persistentCaption?.trim()) {
        const cap = sanitizeOverlayFileText(a.persistentCaption.trim(), 80);
        if (cap) {
          const tf = path.join(a.workDir, `ov-${a.segmentIndex}-cap.txt`);
          writeFileSync(tf, cap, 'utf8');
          const tfEsc = ffmpegFilterPath(tf);
          const fs2 = Math.max(17, Math.round(a.height * (bold ? 0.036 : 0.032)));
          const te = Math.max(0.05, a.durationSeconds - 0.04).toFixed(3);
          filters.push(
            `drawtext=fontfile=${fontEsc}:textfile=${tfEsc}:reload=1:fontsize=${fs2}:fontcolor=white@0.94:borderw=2:bordercolor=black@0.88:shadowcolor=black@0.5:shadowx=2:shadowy=2:box=1:boxcolor=black@0.34:boxborderw=10:x=(w-text_w)/2:y=h*0.86:enable='between(t\\,0\\,${te})'`,
          );
        }
      }
    }
  }

  const args: string[] = [];
  args.push('-i', a.input);
  if (a.kind === 'video') args.push('-t', String(a.durationSeconds));
  args.push('-vf', filters.join(','));
  args.push(...stitchH264VArgs({
    tune: a.kind === 'image' ? 'stillimage' : undefined,
    encodeTier: a.encodeTier,
  }));
  args.push('-an'); // strip audio — we mix separately
  args.push('-r', String(a.fps));
  if (a.kind === 'image' && imageOutFrames > 0) {
    args.push('-frames:v', String(imageOutFrames));
  }
  args.push('-movflags', '+faststart');
  args.push('-y', a.output);

  await runFfmpeg(a.ffmpegBin, args, `normalize:${path.basename(a.output)}`, {
    onStatsLine: a.onFfmpegStatsLine,
  });
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
  /** Force concat demuxer even when storyboard asks for dissolves. */
  skipXfade?: boolean;
  /** Planned length (seconds); used when logging skipXfade. */
  plannedOutputSeconds?: number;
  encodePreset?: StitchEncodePreset;
}

async function concatSegments(a: ConcatArgs): Promise<void> {
  const n = a.segmentPaths.length;
  if (n === 0) throw new Error('concat: no segments');
  if (n === 1) {
    const t0 = performance.now();
    try {
      copyFile(a.segmentPaths[0]!, a.output);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      throw new Error(`concat single-segment copy failed: ${m}`);
    }
    tlog(`concat single-segment copy wall=${(performance.now() - t0).toFixed(0)}ms`);
    return;
  }

  // Does the storyboard want ANY non-hard-cut transitions? If not, use
  // the cheap concat demuxer which is lossless and near-instant.
  const needsXfade = a.transitions.some((t) => requiresXfade(t));
  if (!needsXfade) {
    const t0 = performance.now();
    await concatDemuxer(a);
    tlog(`concat-demuxer(lossless) wall=${(performance.now() - t0).toFixed(0)}ms segments=${n}`);
    return;
  }

  if (a.skipXfade) {
    const nSeg = a.segmentPaths.length;
    const sec = a.plannedOutputSeconds ?? 0;
    console.warn(
      `[stitcher] skipping xfade (${nSeg} clips, ~${sec.toFixed(0)}s output): using concat demuxer instead of dissolves`,
    );
    const t0 = performance.now();
    await concatDemuxer(a);
    tlog(`concat-demuxer(skip-xfade) wall=${(performance.now() - t0).toFixed(0)}ms segments=${nSeg}`);
    return;
  }

  // xfade chain — build a graph where each segment xfades into the next.
  // Segment durations are inferred from the files via probe.
  const probeBatch0 = performance.now();
  const durations = await Promise.all(
    a.segmentPaths.map((p) => probeDurationSeconds(a.ffmpegBin, p)),
  );
  tlog(
    `xfade: probed ${a.segmentPaths.length} segment durations wall=${(performance.now() - probeBatch0).toFixed(0)}ms`,
  );

  // Shrink the xfade overlap if any segment is too short for a 0.3s
  // transition. An 0.3s fade on a 1s clip would eat 30% of the shot.
  const minDur = Math.min(...durations);
  const xfadeDur = Math.max(0.15, Math.min(0.5, minDur * 0.4));

  const inputArgs: string[] = [];
  for (const p of a.segmentPaths) inputArgs.push('-i', p);

  // Build a filter_complex that applies xfade between [i]→[i+1] and
  // labels intermediates v0, v1, …. Each xfade offset is the running sum
  // of prior segment durations minus the transition overlap.
  const steps: string[] = [];
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
  args.push(...stitchH264VArgs({ encodeTier: a.encodePreset }));
  args.push('-r', String(a.fps));
  args.push('-movflags', '+faststart');
  args.push('-y', a.output);

  const xfadeEnc0 = performance.now();
  await runFfmpeg(a.ffmpegBin, args, 'concat-xfade');
  tlog(`concat-xfade encode wall=${(performance.now() - xfadeEnc0).toFixed(0)}ms`);
}

async function concatDemuxer(a: ConcatArgs): Promise<void> {
  const listPath = path.join(path.dirname(a.output), 'concat-list.txt');
  const contents = a.segmentPaths.map((p) => concatDemuxerFileLine(p)).join('\n');
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
  const probeTimeoutMs = 30_000;
  return new Promise<number>((resolve, reject) => {
    const p = spawn(ffmpegBin, ['-hide_banner', '-i', file]);
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        p.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      reject(new Error(`probe duration timeout after ${probeTimeoutMs}ms`));
    }, probeTimeoutMs);
    p.stderr.on('data', (b) => (stderr += b.toString()));
    p.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
      if (!m) return reject(new Error('Could not probe duration'));
      const h = Number(m[1]);
      const mm = Number(m[2]);
      const s = Number(m[3]);
      const sec = h * 3600 + mm * 60 + s;
      if (!Number.isFinite(sec) || sec <= 0) {
        return reject(
          new Error(`Invalid probed duration (${sec}) for ${path.basename(file)}`),
        );
      }
      resolve(sec);
    });
    p.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
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
  musicSoloVolume: number;
}

async function mixAudio(a: MixArgs): Promise<void> {
  // Input layout: [0]=video, then VO (if any), then music (if any).
  //
  // Two behaviours we need:
  //
  // 1. Music must LOOP to cover the whole video. A 3-minute pixabay track
  //    over a 6-minute video goes silent halfway through without this.
  //    FFmpeg's -stream_loop -1 on the music input handles this cheaply.
  //
  // 2. Audio must END when the video ends — not when the first of the
  //    two audio inputs ends. We map video+mixed-audio and pass -shortest
  //    so amix continues until video's audio-less stream ends.
  //
  // We also explicitly duck the music whenever VO is present. amix on
  // its own just sums the two signals and clips — it's not what we
  // want. We take the ducked music + raw VO through amix.
  const args: string[] = ['-i', a.videoInput];
  const inputs: Array<'vo' | 'music'> = [];
  if (a.voiceoverPath) {
    args.push('-i', a.voiceoverPath);
    inputs.push('vo');
  }
  if (a.musicPath) {
    // -stream_loop -1 tells ffmpeg to seamlessly loop the file so short
    // tracks cover long videos. Must appear BEFORE -i.
    args.push('-stream_loop', '-1', '-i', a.musicPath);
    inputs.push('music');
  }

  if (inputs.length === 0) {
    try {
      copyFile(a.videoInput, a.output);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      throw new Error(`mix-audio passthrough copy failed: ${m}`);
    }
    return;
  }

  const voIdx = inputs.indexOf('vo');
  const muIdx = inputs.indexOf('music');
  // Inputs are 1-indexed in filter labels because [0] is the video.
  const voLabel = voIdx !== -1 ? `[${voIdx + 1}:a]` : undefined;
  const muLabel = muIdx !== -1 ? `[${muIdx + 1}:a]` : undefined;

  const filterParts: string[] = [];
  if (voLabel && muLabel) {
    // Duck music under VO; normalize prevents sum clipping; limiter catches peaks.
    filterParts.push(`${muLabel}volume=${a.musicDuckLowVolume}[mu]`);
    filterParts.push(
      `${voLabel}[mu]amix=inputs=2:duration=longest:dropout_transition=0:normalize=1[a0]`,
    );
    filterParts.push(`[a0]alimiter=limit=0.98[a]`);
  } else if (voLabel) {
    filterParts.push(`${voLabel}volume=1,alimiter=limit=0.99[a]`);
  } else if (muLabel) {
    filterParts.push(
      `${muLabel}volume=${a.musicSoloVolume},afade=t=in:st=0:d=0.03,alimiter=limit=0.99[a]`,
    );
  }

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '0:v:0', '-map', '[a]');
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  // -shortest against the video (mapped from [0]) stops us extending
  // the file past the last frame of video. Combined with the
  // -stream_loop on music + duration=longest on amix, the audio track
  // runs the full video length and then ends cleanly.
  args.push('-shortest');
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

/** Pull the most useful tail of FFmpeg stderr for operator-facing errors. */
function summarizeFfmpegStderr(stderr: string, maxLen = 1200): string {
  const t = stderr.trim();
  if (!t) return '(no FFmpeg stderr captured)';
  const lines = t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const hits = lines.filter((l) =>
    /\berror\b|\bfailed\b|\binvalid\b|\bunknown\b|\bnot supported\b|\bdeprecated\b/i.test(l),
  );
  const body = hits.length ? hits.slice(-12).join('\n') : lines.slice(-25).join('\n');
  return body.length > maxLen ? `…${body.slice(-maxLen)}` : body;
}

/** Per-invoke ceiling so a wedged libx264 pass cannot hang the API forever. */
const FFMPEG_MAX_MS = 50 * 60 * 1000; // 50 minutes

export interface RunFfmpegOpts {
  timeoutMs?: number;
  /** Throttled `frame=…` progress lines (requires `-loglevel info` internally). */
  onStatsLine?: (line: string) => void;
}

function runFfmpeg(
  bin: string,
  args: string[],
  label: string,
  opts?: RunFfmpegOpts,
): Promise<void> {
  const wall0 = performance.now();
  const timeoutMs = opts?.timeoutMs ?? FFMPEG_MAX_MS;
  const statsToCaller = Boolean(opts?.onStatsLine);
  const statsToConsole = stitchFfmpegStats();
  const wantStatsPipe = statsToCaller || statsToConsole;
  const logLevel = wantStatsPipe ? 'info' : 'error';

  return new Promise<void>((resolve, reject) => {
    const p = spawn(bin, ['-hide_banner', '-loglevel', logLevel, ...args]);
    let stderr = '';
    let settled = false;
    let lastStatsLine = '';

    const flushStats = () => {
      if (!lastStatsLine) return;
      const line = lastStatsLine;
      try {
        if (statsToCaller) opts?.onStatsLine?.(line);
        else if (statsToConsole) {
          console.info(`[stitcher:ffmpeg] ${label} ${line.slice(0, 400)}`);
        }
      } catch {
        /* ignore */
      }
    };

    const statsTimer =
      wantStatsPipe && (statsToCaller || statsToConsole)
        ? setInterval(flushStats, 20_000)
        : null;

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            if (settled) return;
            settled = true;
            if (statsTimer) clearInterval(statsTimer);
            try {
              p.kill('SIGKILL');
            } catch {
              /* ignore */
            }
            reject(
              new Error(
                `[ffmpeg ${label}] killed: exceeded ${timeoutMs}ms — ${summarizeFfmpegStderr(stderr, 600)}`,
              ),
            );
          }, timeoutMs)
        : null;

    p.stderr.on('data', (b) => {
      const chunk = b.toString();
      stderr += chunk;
      if (!wantStatsPipe) return;
      for (const raw of chunk.split('\n')) {
        const t = raw.trim();
        if (t.includes('frame=') && (t.includes('time=') || t.includes('fps='))) {
          lastStatsLine = t;
        }
      }
    });

    p.on('error', (e) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (statsTimer) clearInterval(statsTimer);
      reject(e);
    });

    p.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (statsTimer) clearInterval(statsTimer);
      flushStats();
      if (code === 0) {
        tlog(`ffmpeg:${label} ok ${(performance.now() - wall0).toFixed(0)}ms`);
        return resolve();
      }
      reject(
        new Error(`[ffmpeg ${label}] exit ${code ?? 'unknown'}: ${summarizeFfmpegStderr(stderr)}`),
      );
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Shared-utils exports                                                */
/* ═══════════════════════════════════════════════════════════════════ */

/** For dev visibility. Safe to remove later. */
export const _internals = {
  detectFfmpeg: resolveFfmpegBin,
  gradeFilter,
  dimsFor,
  xfadeMode,
};
