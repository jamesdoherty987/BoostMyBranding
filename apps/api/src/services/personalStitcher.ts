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
 *
 * Frozen last-frame + VO continues: usually **audio longer than real video**
 * after concat (bad container `Duration`). `mixAudio` caps `apad` to the
 * sum of encoded segment lengths (+slack) and logs when clamping. Debug:
 * `PERSONAL_DEBUG_MIX_AUDIO=1` or `PERSONAL_DEBUG_STITCH_TIMELINE=1`.
 * `PERSONAL_DEBUG_STITCH_FFMPEG=1` — FFmpeg `-loglevel verbose`, argv, full filter string, stderr tail on failure.
 * `PERSONAL_DEBUG_STITCH_NORMALIZE=1` — pre-invoke JSON for **every** normalize shot (argv + filters) without verbose FFmpeg.
 * `PERSONAL_LOG_DRAWTEXT_NORMALIZE=1` — per-shot drawtext filter snippets + overlay inline text preview / legacy `ov-*.txt` dumps (high volume).
 * `PERSONAL_LOG_FFMPEG_VERSION=1` — one-line `ffmpeg -version` head at stitch start (also when `PERSONAL_DEBUG_STITCH_FFMPEG=1`).
 * Failed normalize always logs `[stitcher:normalize-failed]` with argv, filters, and full FFmpeg stderr when available.
 * Drawtext: short keyword/caption overlays use **inline** `text='…'` (sanitized + escaped), not `textfile=`. Some Windows libavfilter
 * builds treat substrings like `text_w` inside `x=(main_w-text_w)/2` as the `text` option when `textfile=` is present ("Both text and text file provided").
 * Never use `text_align=` with `textfile=` — `text_align` can be parsed as `text` + garbage on other builds.
 */

import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { logVisualPacing, visualPacingDebugEnabled, logStitchTimeline, stitchTimelineDebugEnabled } from './personalDebugVisualPacing.js';
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
  /** Windows: some FFmpeg/libx264 builds fail linking RGB stills when `-profile:v high` is set. */
  omitProfile?: boolean;
}): string[] {
  const tier = opts?.encodeTier;
  return [
    '-c:v',
    'libx264',
    ...(opts?.tune ? (['-tune', opts.tune] as const) : []),
    '-pix_fmt',
    'yuv420p',
    ...(opts?.omitProfile ? [] : stitchH264ProfileArgs()),
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

/**
 * Very verbose FFmpeg stitch diagnostics (argv, cwd, full filter string, stderr on failure).
 * Enable with `PERSONAL_DEBUG_STITCH_FFMPEG=1` on the API process. Avoid in production (log volume + secrets in paths).
 */
function stitchFfmpegDebugTrace(): boolean {
  const v = process.env.PERSONAL_DEBUG_STITCH_FFMPEG?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** Per-shot normalize pre-invoke JSON (high volume). Production: only when this env is set. */
function stitchNormalizeDumpEveryShot(): boolean {
  const v = process.env.PERSONAL_DEBUG_STITCH_NORMALIZE?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function stitchLogFfmpegVersionEnabled(): boolean {
  const v = process.env.PERSONAL_LOG_FFMPEG_VERSION?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** First lines of `ffmpeg -version` — correlates drawtext / filter quirks to a specific build. */
function logFfmpegBuildVersionHead(ffmpegBin: string): void {
  const want = stitchFfmpegDebugTrace() || stitchLogFfmpegVersionEnabled();
  if (!want) return;
  try {
    const out = execFileSync(ffmpegBin, ['-hide_banner', '-version'], {
      encoding: 'utf8',
      maxBuffer: 96 * 1024,
    });
    const lines = out.split(/\r?\n/).filter(Boolean);
    const head = lines.slice(0, 3).join(' | ');
    console.info(`[stitcher:ffmpeg-version] ${head}`);
  } catch (e) {
    console.warn(
      `[stitcher:ffmpeg-version] exec failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
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

/**
 * FFmpeg exited non-zero. Carries full stderr so normalize can log copy-paste diagnostics
 * without requiring `PERSONAL_DEBUG_STITCH_FFMPEG=1`.
 */
class FfmpegInvokeError extends Error {
  readonly exitCode: number | null;
  readonly ffmpegStderr: string;
  readonly ffmpegLabel: string;
  readonly ffmpegArgv: string[];
  readonly ffmpegCwd: string | undefined;

  constructor(init: {
    exitCode: number | null;
    stderr: string;
    label: string;
    argv: string[];
    cwd?: string;
    summary: string;
  }) {
    super(`[ffmpeg ${init.label}] exit ${init.exitCode ?? 'unknown'}: ${init.summary}`);
    this.name = 'FfmpegInvokeError';
    this.exitCode = init.exitCode;
    this.ffmpegStderr = init.stderr;
    this.ffmpegLabel = init.label;
    this.ffmpegArgv = init.argv;
    this.ffmpegCwd = init.cwd;
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
  opts?: { snappySlate?: boolean },
): StitchKeywordCard[] | undefined {
  if (!cards?.length) return undefined;
  const snappy = opts?.snappySlate === true;
  const d = Math.max(0.45, durationSeconds);
  const out: StitchKeywordCard[] = [];
  const maxCards = snappy ? 2 : 4;
  const maxLen = snappy ? 28 : 56;
  const minSpan = snappy ? 0.34 : 0.22;
  const defaultSpan = snappy ? Math.min(0.72, d * 0.2) : Math.min(1.35, d * 0.34);
  const maxSpan = snappy ? 0.88 : Math.min(2.2, d * 0.92);
  for (const c of cards.slice(0, maxCards)) {
    const text = c.text.trim();
    if (!text || text.length > maxLen) continue;
    let start = typeof c.tStart === 'number' && Number.isFinite(c.tStart) ? c.tStart : d * (snappy ? 0.18 : 0.22);
    let end = typeof c.tEnd === 'number' && Number.isFinite(c.tEnd) ? c.tEnd : start + defaultSpan;
    start = Math.max(0, Math.min(d - minSpan - 0.02, start));
    end = Math.max(start + minSpan, Math.min(d - 0.02, end));
    if (end - start > maxSpan) end = start + maxSpan;
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
  /**
   * Delay voiceover start by this many seconds (silence at head of VO track).
   * Used for long-form cold open: first shot holds while music plays, then narration begins.
   */
  voiceoverLeadInSeconds?: number;
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
   * Hard cap on each shot's seconds when stretching/shrinking to
   * {@link targetDurationSeconds}. Defaults to 18. Set from account
   * `averageClipSeconds` (e.g. 2 → ~2.24s cap) so VO sync does not inflate every clip.
   */
  perShotSecondsMax?: number;
  /**
   * Called as FFmpeg work advances (encode segments, concat, audio).
   * Used to drive dashboard progress while status is `rendering`.
   */
  onRenderProgress?: (p: StitchRenderProgress) => void | Promise<void>;
  /**
   * Lower-third keyword pops + sparse captions. `off` skips FFmpeg drawtext.
   * `slate` / `slate_bold` = white panel + dark text (names & numbers title-card family).
   */
  keywordOverlayStyle?: 'off' | 'subtle' | 'bold' | 'slate' | 'slate_bold';
  /**
   * When false, still images are static (no Ken Burns). Default true.
   */
  kenBurnsOnStills?: boolean;
  /**
   * Optional opening slate: white full frame + centered dark text lines
   * (e.g. title, channel, topic, shot stats). Prepended before body shots; the
   * pipeline should extend {@link StitchAudioInput.voiceoverLeadInSeconds} by this
   * duration so narration starts when the first body shot begins.
   */
  namesNumbersTitleCard?: {
    lines: string[];
    durationSeconds?: number;
  };
}

/** Caps each shot when scaling to VO length; derives from dashboard "Avg seconds per clip" (~12% headroom). */
export function perShotSecondsMaxFromAverageClip(
  averageClipSeconds: number | undefined,
  opts?: { longform?: boolean },
): number | undefined {
  if (averageClipSeconds == null || !Number.isFinite(averageClipSeconds)) return undefined;
  if (averageClipSeconds < 1) return undefined;
  const absMax = opts?.longform ? 14 : 12;
  return Math.min(absMax, Math.max(1, averageClipSeconds * 1.06));
}

export interface StitchResult {
  videoUrl: string;
  durationSeconds: number;
  shotCount: number;
  /** 'ffmpeg' | 'mock' — the mock path returns a single-asset URL when ffmpeg isn't available. */
  renderer: 'ffmpeg' | 'mock';
}

/** Lines for the white “names & numbers” opening slate (director stitch). */
export function buildNamesNumbersTitleCardLines(args: {
  videoTitle: string;
  channelName: string;
  platform: string;
  topic: string;
  shotCount: number;
  durationApproxSeconds: number;
}): string[] {
  const lines: string[] = [];
  const title = (args.videoTitle ?? '').trim();
  if (title) lines.push(title);
  const ch = (args.channelName ?? '').trim();
  if (ch) lines.push(ch);
  const plat = (args.platform ?? '').trim().replace(/_/g, ' ');
  if (plat) lines.push(plat.slice(0, 52));
  const top = (args.topic ?? '').trim().slice(0, 140);
  if (top) lines.push(top);
  const sc = Math.max(0, Math.round(args.shotCount));
  const d = Math.max(0, Math.round(args.durationApproxSeconds));
  lines.push(`${sc} scene${sc === 1 ? '' : 's'} · ~${d}s`);
  return lines.slice(0, 8);
}

export function defaultNamesNumbersTitleCardDurationSeconds(lineCount: number): number {
  const n = Math.max(1, Math.min(10, lineCount));
  return Math.min(5, Math.max(1.35, 0.82 + 0.38 * n));
}

async function encodeNamesNumbersTitleCardMp4(p: {
  ffmpegBin: string;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  seconds: number;
  lines: string[];
  workDir: string;
  encodeTier?: StitchEncodePreset;
  textFilesOut: string[];
}): Promise<void> {
  const font = overlayFontPath();
  if (!font) {
    throw new StitcherError('validate', 'No system font found for names/numbers title card (set PERSONAL_OVERLAY_FONT)');
  }
  const fs = Math.max(26, Math.min(54, Math.floor(p.width / 19)));
  const vfParts: string[] = [];
  let y = Math.round(p.height * 0.17);
  for (let li = 0; li < p.lines.length; li++) {
    const line = p.lines[li]!;
    const lineSan = sanitizeOverlayFileText(line, 240);
    const textIn = escapeDrawtextInlineText(lineSan);
    const fontEsc = ffmpegFilterPath(font);
    vfParts.push(
      `drawtext=fontfile=${fontEsc}:text='${textIn}':fontsize=${fs}:fontcolor=#141414:x=(w-tw)/2:y=${y}:box=0`,
    );
    y += Math.round(fs * 1.42);
    if (y > p.height * 0.9) break;
  }
  if (!vfParts.length) {
    throw new StitcherError('validate', 'Names/numbers title card: no drawable lines');
  }
  const d = Math.max(0.55, p.seconds).toFixed(3);
  const vf = vfParts.join(',');
  const args = [
    '-f',
    'lavfi',
    '-i',
    `color=c=white:s=${p.width}x${p.height}:r=${p.fps}:d=${d}`,
    '-vf',
    vf,
    '-t',
    d,
    ...stitchH264VArgs({ tune: 'stillimage', encodeTier: p.encodeTier }),
    '-movflags',
    '+faststart',
    '-y',
    p.outputPath,
  ];
  await runFfmpeg(p.ffmpegBin, args, 'names-numbers-title-card');
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
    const mockBody = args.shots.reduce((a, s) => a + s.durationSeconds, 0);
    let mockDur = mockBody;
    const nnMock = args.namesNumbersTitleCard;
    if (nnMock?.lines?.length) {
      const lines = nnMock.lines.map((l) => String(l ?? '').trim()).filter(Boolean);
      if (lines.length) {
        mockDur +=
          typeof nnMock.durationSeconds === 'number' &&
          Number.isFinite(nnMock.durationSeconds) &&
          nnMock.durationSeconds > 0.25
            ? nnMock.durationSeconds
            : defaultNamesNumbersTitleCardDurationSeconds(lines.length);
      }
    }
    return {
      videoUrl: args.shots[0]?.url ?? '',
      durationSeconds: mockDur,
      shotCount: args.shots.length,
      renderer: 'mock',
    };
  }

  const workDir = path.join(tmpdir(), `stitch-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });
  logFfmpegBuildVersionHead(ffmpegBin);
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
      args.perShotSecondsMax,
    );
    const plannedSum = workingShots.reduce((a, s) => a + s.durationSeconds, 0);
    logVisualPacing('stitcher', 'stitchShots pacing', {
      postId: args.postId,
      n: args.shots.length,
      targetDurationSeconds: args.targetDurationSeconds ?? null,
      perShotSecondsMax: args.perShotSecondsMax ?? null,
      rawDurations: args.shots.map((s) => Math.round(s.durationSeconds * 1000) / 1000),
      rawSum: Math.round(args.shots.reduce((a, s) => a + s.durationSeconds, 0) * 1000) / 1000,
      workingDurations: workingShots.map((s) => Math.round(s.durationSeconds * 1000) / 1000),
      workingSum: Math.round(plannedSum * 1000) / 1000,
      scaledVsRaw: args.shots.map((s, i) =>
        Math.round((workingShots[i]!.durationSeconds - s.durationSeconds) * 1000) / 1000,
      ),
    });
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
    const nShots = localShots.length;

    await Promise.resolve(
      args.onRenderProgress?.({
        percent: 6,
        label: 'Preparing media',
        logLines: [],
      }),
    );
    if (stitchFfmpegDebugTrace()) {
      console.info(
        `[stitcher:debug-ffmpeg] stitchShots normalize batch postId=${args.postId} nShots=${nShots} canvas=${width}x${height} aspect=${args.aspectRatio ?? '9:16'} colourGrade=${args.colourGrade ?? 'natural'} overlay=${args.keywordOverlayStyle ?? 'off'} kenBurnsOnStills=${args.kenBurnsOnStills !== false}`,
      );
      console.info(`[stitcher:debug-ffmpeg] workDir=${ffmpegCliFilesystemPath(workDir)} ffmpeg=${ffmpegBin}`);
    }
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
      if (visualPacingDebugEnabled()) {
        const probed = await probeDurationSeconds(ffmpegBin, segPath);
        logVisualPacing('stitcher-probe', `encoded seg ${i + 1}/${nShots}`, {
          plannedSeconds: Math.round(s.durationSeconds * 1000) / 1000,
          probedSeconds: Math.round(probed * 1000) / 1000,
          drift: Math.round((probed - s.durationSeconds) * 1000) / 1000,
          kind: s.kind,
        });
      }

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

    const bodyPlannedSum = workingShots.reduce((a, s) => a + s.durationSeconds, 0);
    const bodySegmentDurations = workingShots.map((s) => s.durationSeconds);

    let titleCardSeconds = 0;
    const nnCard = args.namesNumbersTitleCard;
    if (nnCard?.lines?.length) {
      const rawLines = nnCard.lines.map((l) => String(l ?? '').trim()).filter(Boolean);
      if (rawLines.length > 0) {
        titleCardSeconds =
          typeof nnCard.durationSeconds === 'number' &&
          Number.isFinite(nnCard.durationSeconds) &&
          nnCard.durationSeconds > 0.25
            ? nnCard.durationSeconds
            : defaultNamesNumbersTitleCardDurationSeconds(rawLines.length);
        const titleSeg = path.join(workDir, 'titlecard-open.mp4');
        cleanups.push(titleSeg);
        const textFilesOut: string[] = [];
        await encodeNamesNumbersTitleCardMp4({
          ffmpegBin,
          outputPath: titleSeg,
          width,
          height,
          fps,
          seconds: titleCardSeconds,
          lines: rawLines,
          workDir,
          encodeTier,
          textFilesOut,
        });
        for (const tf of textFilesOut) cleanups.push(tf);
        segmentPaths.unshift(titleSeg);
      }
    }

    const plannedOutputSeconds = titleCardSeconds + bodyPlannedSum;
    const plannedSegmentSeconds =
      titleCardSeconds > 0 ? [titleCardSeconds, ...bodySegmentDurations] : bodySegmentDurations;

    // 3. Concat segments. (xfade / dissolves are disabled — see skipXfade below.)
    const concatPath = path.join(workDir, 'concat.mp4');
    cleanups.push(concatPath);
    // xfade filter graphs are fragile (offset math vs probed durations) and have
    // collapsed timelines to a single frozen frame in production. Always use the
    // concat demuxer (hard cuts) for reliability — storyboard dissolve hints are ignored here.
    const skipXfade = true;
    const transitions: ShotTransition[] =
      segmentPaths.length <= 1
        ? []
        : titleCardSeconds > 0
          ? (['hard_cut', ...workingShots.slice(0, -1).map((s) => s.transitionOut)] as ShotTransition[])
          : workingShots.slice(0, -1).map((s) => s.transitionOut);
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
        plannedSegmentSeconds,
        encodePreset: encodeTier,
      });
      const probedConcat = await probeDurationSeconds(ffmpegBin, concatPath).catch(() => NaN);
      logStitchTimeline('stitcher', 'concat done', {
        plannedOutputSeconds,
        probedConcatSeconds: Number.isFinite(probedConcat) ? Math.round(probedConcat * 1000) / 1000 : null,
        probeVsPlan:
          Number.isFinite(probedConcat) && plannedOutputSeconds > 0
            ? Math.round((probedConcat - plannedOutputSeconds) * 1000) / 1000
            : null,
        segments: segmentPaths.length,
      });
      if (
        Number.isFinite(probedConcat) &&
        plannedOutputSeconds > 0.2 &&
        probedConcat > plannedOutputSeconds + 0.45
      ) {
        console.warn(
          `[stitcher] concat probe ${probedConcat.toFixed(2)}s > planned ${plannedOutputSeconds.toFixed(2)}s — mix-audio will cap apad to planned (+slack) so audio cannot outrun real frames.`,
        );
      }
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
          musicSoloVolume: args.audio.musicSoloVolume ?? 0.14,
          canonicalVideoDurationSeconds: plannedOutputSeconds,
          voiceoverLeadInMs:
            typeof args.audio.voiceoverLeadInSeconds === 'number' &&
            Number.isFinite(args.audio.voiceoverLeadInSeconds) &&
            args.audio.voiceoverLeadInSeconds > 0
              ? args.audio.voiceoverLeadInSeconds * 1000
              : undefined,
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

    const plannedWorkingSum = titleCardSeconds + workingShots.reduce((a, s) => a + s.durationSeconds, 0);
    if (stitchTimelineDebugEnabled()) {
      try {
        const finalProbe = await probeDurationSeconds(ffmpegBin, finalPath);
        logStitchTimeline('stitcher', 'final file before upload', {
          postId: args.postId,
          plannedWorkingSum: Math.round(plannedWorkingSum * 1000) / 1000,
          probedFileSeconds: Math.round(finalProbe * 1000) / 1000,
          delta: Math.round((finalProbe - plannedWorkingSum) * 1000) / 1000,
        });
        if (Number.isFinite(finalProbe) && Math.abs(finalProbe - plannedWorkingSum) > 0.95) {
          console.warn(
            `[stitcher] final MP4 probed ${finalProbe.toFixed(2)}s vs planned working sum ${plannedWorkingSum.toFixed(2)}s (Δ ${(finalProbe - plannedWorkingSum).toFixed(2)}s).`,
          );
        }
      } catch {
        /* ignore */
      }
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

    const totalDuration = plannedWorkingSum;
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
 * Per-shot ceiling defaults to 18s unless {@link StitchArgs.perShotSecondsMax} is set.
 *
 * Rounds every shot to the nearest 0.1s and fixes rounding drift by spreading
 * the remainder across the longest shots (with headroom under the per-shot cap).
 *
 * @param perShotMax  Upper bound per shot in seconds (default 18).
 */
function scaleShotsToTarget<T extends { durationSeconds: number }>(
  shots: T[],
  target: number | undefined,
  perShotMax = 18,
): T[] {
  if (!target || shots.length === 0) return shots;
  const current = shots.reduce((a, s) => a + s.durationSeconds, 0);
  if (current <= 0) return shots;
  if (Math.abs(current - target) / target < 0.02) {
    logVisualPacing('stitcher-scale', 'skip (within 2% of target)', {
      current,
      target,
      perShotMax,
      durations: shots.map((s) => s.durationSeconds),
    });
    return shots;
  }

  logVisualPacing('stitcher-scale', 'apply uniform scale', {
    current,
    target,
    ratio: Math.round((target / current) * 10000) / 10000,
    perShotMax,
    before: shots.map((s) => s.durationSeconds),
  });

  const cap =
    Number.isFinite(perShotMax) && perShotMax > 0 ? Math.min(60, Math.max(1, perShotMax)) : 18;

  const ratio = target / current;
  const scaled = shots.map((s) => ({
    ...s,
    durationSeconds: Math.max(
      1,
      Math.min(cap, Math.round(s.durationSeconds * ratio * 10) / 10),
    ),
  }));
  // Correct rounding drift by nudging the longest shot.
  const scaledSum = scaled.reduce((a, s) => a + s.durationSeconds, 0);
  let delta = target - scaledSum;
  if (Math.abs(delta) > 0.05) {
    const capLocal = cap;
    const floorLocal = 1;
    const order = scaled.map((_, i) => i).sort((a, b) => scaled[b]!.durationSeconds - scaled[a]!.durationSeconds);
    let guard = 0;
    while (Math.abs(delta) > 0.05 && guard++ < scaled.length * 6) {
      let progressed = false;
      for (const idx of order) {
        if (Math.abs(delta) < 0.04) break;
        if (delta > 0) {
          const room = capLocal - scaled[idx]!.durationSeconds;
          if (room < 0.02) continue;
          const add = Math.min(room, delta * 0.45);
          scaled[idx] = {
            ...scaled[idx]!,
            durationSeconds: Math.min(
              capLocal,
              Math.round((scaled[idx]!.durationSeconds + add) * 10) / 10,
            ),
          };
        } else {
          const room = scaled[idx]!.durationSeconds - floorLocal;
          if (room < 0.02) continue;
          const sub = Math.min(room, Math.abs(delta) * 0.45);
          scaled[idx] = {
            ...scaled[idx]!,
            durationSeconds: Math.max(
              floorLocal,
              Math.round((scaled[idx]!.durationSeconds - sub) * 10) / 10,
            ),
          };
        }
        const newSum = scaled.reduce((a, s) => a + s.durationSeconds, 0);
        delta = target - newSum;
        progressed = true;
      }
      if (!progressed) break;
    }
  }
  logVisualPacing('stitcher-scale', 'after scale + drift nudge', {
    sum: scaled.reduce((a, s) => a + s.durationSeconds, 0),
    target,
    after: scaled.map((s) => s.durationSeconds),
  });
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

function stitchLogDrawtextNormalizeEnabled(): boolean {
  const v = process.env.PERSONAL_LOG_DRAWTEXT_NORMALIZE?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Log every `ov-{segment}-*.txt` next to drawtext (legacy) — bytes, UTF-8 BOM, short preview, hex head.
 * Helps diagnose encoding and empty files when overlays still use sidecar files.
 */
function logNormalizeOverlayTextfilesDebug(args: { tag: string; segmentIndex: number; workDir: string }): void {
  const { tag, segmentIndex, workDir } = args;
  const verbose =
    stitchLogDrawtextNormalizeEnabled() || stitchFfmpegDebugTrace() || stitchNormalizeDumpEveryShot();
  let names: string[] = [];
  try {
    names = readdirSync(workDir).filter(
      (n) => n.startsWith(`ov-${segmentIndex}-`) && n.endsWith('.txt'),
    );
  } catch (e) {
    console.warn(
      `[stitcher:overlay-files] ${JSON.stringify({ tag, segmentIndex, workDir, err: e instanceof Error ? e.message : String(e) })}`,
    );
    return;
  }
  if (names.length === 0) {
    if (verbose) {
      console.info(
        `[stitcher:overlay-files] ${JSON.stringify({
          tag,
          segmentIndex,
          workDir,
          note: 'no ov-*.txt (keyword/caption overlays use inline drawtext text=…)',
        })}`,
      );
    }
    return;
  }
  for (const n of names.sort()) {
    try {
      const fp = path.join(workDir, n);
      const buf = readFileSync(fp);
      const utf8 = buf.toString('utf8');
      const preview = utf8.replace(/\r?\n/g, '\\n').slice(0, 200);
      const hex = buf.subarray(0, Math.min(64, buf.length)).toString('hex');
      const bomUtf8 = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
      console.info(
        `[stitcher:overlay-files] ${JSON.stringify({
          tag,
          segmentIndex,
          file: n,
          bytes: buf.length,
          utf8Len: utf8.length,
          bomUtf8,
          preview,
          hex64: hex,
        })}`,
      );
    } catch (e) {
      console.warn(
        `[stitcher:overlay-files] ${JSON.stringify({
          tag,
          segmentIndex,
          file: n,
          err: e instanceof Error ? e.message : String(e),
        })}`,
      );
    }
  }
}

/** Strip control chars / odd whitespace so drawtext overlays stay reliable. */
function sanitizeOverlayFileText(raw: string, maxLen: number): string {
  const t = raw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  return Array.from(t)
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return c === 9 || (c >= 32 && c !== 127);
    })
    .join('');
}

/**
 * Escape user text for drawtext `text='…'` (no `textfile=`).
 *
 * FFmpeg filter escaping (see https://ffmpeg.org/ffmpeg-filters.html §4.2 "Notes on filtergraph escaping"):
 * we pass the filtergraph as a **single argv element** (no shell), so shell-level escaping does not apply.
 * For `text='…'`, commas and colons inside the quotes are accepted (see flite `text='…'` examples in the same manual).
 *
 * We still:
 * - Double `\` so pathological backslashes survive first-level parsing.
 * - Map ASCII `'` → U+2019 so the quoted `text='…'` wrapper stays unambiguous without `\'`.
 * - Prefix each `%` with `\` so `%{…}` drawtext expansion (https://ffmpeg.org/ffmpeg-filters.html#drawtext-1) never runs on user copy.
 */
function escapeDrawtextInlineText(raw: string): string {
  let s = raw.replace(/\\/g, '\\\\');
  s = s.replace(/'/g, '\u2019');
  s = s.replace(/%/g, '\\%');
  return s;
}

/** Paths inside FFmpeg filter strings (escape `:` for Windows drive letters). */
function ffmpegFilterPath(p: string): string {
  return path.resolve(p).replace(/\\/g, '/').replace(/:/g, '\\:');
}

/**
 * Paths passed as FFmpeg CLI args (`-i`, `-y`, concat lists, etc.). On Windows, some
 * FFmpeg/libx264 builds reject backslash-only temp paths with EINVAL when opening outputs.
 */
function ffmpegCliFilesystemPath(p: string): string {
  const abs = path.resolve(p);
  if (process.platform === 'win32') return abs.replace(/\\/g, '/');
  return abs;
}

/**
 * Windows static stills use `-filter_complex`. Comma-chaining **two or more** `drawtext`
 * filters in one `[0:v]…[out]` graph can trip some Windows FFmpeg / libavfilter builds
 * (filter init / label issues). When there are 2+ drawtext entries, use explicit `[dtN]`
 * labels between them. (Unrelated to `textfile` + `text_align` / `tw` option-parse bugs.)
 */
function windowsStaticFilterComplexExpr(filters: string[]): string {
  const firstDt = filters.findIndex((f) => f.startsWith('drawtext='));
  if (firstDt < 0) {
    return `[0:v]${filters.join(',')}[normv]`;
  }
  const tail = filters.slice(firstDt);
  const draws = tail.filter((f) => f.startsWith('drawtext='));
  if (tail.some((f) => !f.startsWith('drawtext='))) {
    return `[0:v]${filters.join(',')}[normv]`;
  }
  const head = filters.slice(0, firstDt).join(',');
  if (draws.length <= 1) {
    const mid = [head, draws[0]].filter(Boolean).join(',');
    return `[0:v]${mid}[normv]`;
  }
  const d0 = draws[0]!;
  const headPrefix = head ? `${head},` : '';
  let expr = `[0:v]${headPrefix}${d0}[dt0]`;
  for (let i = 1; i < draws.length; i++) {
    const outLabel = i === draws.length - 1 ? 'normv' : `dt${i}`;
    expr += `;[dt${i - 1}]${draws[i]}[${outLabel}]`;
  }
  return expr;
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
  overlayStyle?: 'off' | 'subtle' | 'bold' | 'slate' | 'slate_bold';
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
  const useKenBurnsOnImage = a.kind === 'image' && a.kenBurnsOnStills !== false;
  const workDirAbs = path.resolve(a.workDir);
  /** Windows: run FFmpeg with `cwd=workDir` and relative IO/textfile paths — avoids drawtext/filter parse bugs with `C:` in paths. */
  const useWinWorkdirSpawn =
    process.platform === 'win32' &&
    path.dirname(path.resolve(a.input)) === workDirAbs &&
    path.dirname(path.resolve(a.output)) === workDirAbs;

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
    const useKenBurns = a.kenBurnsOnStills !== false;
    if (useKenBurns) {
      const zoomStep = 0.0008;
      const safeFocalX = Math.max(0.15, Math.min(0.85, a.focalX));
      const safeFocalY = Math.max(0.15, Math.min(0.85, a.focalY));
      const xExpr = `'iw*${safeFocalX}-(iw/zoom/2)'`;
      const yExpr = `'ih*${safeFocalY}-(ih/zoom/2)'`;
      const w2 = a.width * 2;
      const h2 = a.height * 2;
      // Centre-crop to the working canvas (same fill behaviour as video clips) so
      // portrait stills fill 9:16 instead of letterboxing with black bars.
      const te = Math.max(0.05, a.durationSeconds).toFixed(3);
      filters.push(
        'select=eq(n\\,0),setpts=PTS-STARTPTS',
        `scale=${w2}:${h2}:force_original_aspect_ratio=increase:flags=lanczos,` +
          `crop=${w2}:${h2},` +
          `zoompan=z='min(zoom+${zoomStep},1.12)':x=${xExpr}:y=${yExpr}:` +
          `d=${imageOutFrames}:s=${a.width}x${a.height}:fps=${a.fps},` +
          `tpad=stop_mode=clone:stop_duration=6,trim=end=${te},setpts=PTS-STARTPTS`,
      );
    } else {
      // Static slide (Ken Burns off): `-loop 1`, `-framerate` before `-i`, and `-frames:v` below.
      // Do not use `select=eq(n\,0)` here — one decoded frame + fps produced ~1/fps s clips.
      // Do not use `fps=` in -vf with looped PNG on some Windows FFmpeg builds (filter init EINVAL).
      // Use bilinear instead of lanczos here — lanczos + yuv format + duration quirks has also tripped bad builds.
      filters.push(
        `scale=${a.width}:${a.height}:force_original_aspect_ratio=increase:flags=bilinear`,
        `crop=${a.width}:${a.height}`,
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
      `trim=end=${Math.max(0.05, a.durationSeconds).toFixed(3)}`,
      `setpts=PTS-STARTPTS`,
    );
  }

  const grade = gradeFilter(a.colourGrade);
  // Still images decode as RGB; convert before colour filters (e.g. colortemperature) and libx264.
  // Some Windows FFmpeg builds fail "Error initializing filters" when RGB is fed straight into x264.
  if (a.kind === 'image') {
    filters.push('format=yuv420p');
  }

  // Speed ramp (video only). On stills, `setpts` after zoompan breaks the
  // fixed frame budget (`-frames:v`) vs storyboard duration — skip here.
  if (a.kind === 'video') {
    if (a.speedRamp === 'slow_mo') filters.push('setpts=1.4*PTS');
    if (a.speedRamp === 'speed_up') filters.push('setpts=0.65*PTS');
  }

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
      const isSlate = a.overlayStyle === 'slate' || a.overlayStyle === 'slate_bold';
      // Short overlays: inline `text='…'` + `x=(w-tw)/2`. Do **not** combine `textfile=` with
      // `x=(main_w-text_w)/2` — some libavfilter builds tokenize `text_w` as the `text` option
      // alongside `textfile` ("Both text and text file provided").
      const bold = a.overlayStyle === 'bold' || a.overlayStyle === 'slate_bold';
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
        const line = sanitizeOverlayFileText(kw.text, isSlate ? 28 : 56);
        if (!line) continue;
        const textIn = escapeDrawtextInlineText(line);
        idx += 1;
        if (stitchLogDrawtextNormalizeEnabled()) {
          console.info(
            `[stitcher:drawtext-inline] ${JSON.stringify({
              segmentIndex: a.segmentIndex,
              overlayIndex: idx - 1,
              kind: isSlate ? 'slate' : 'keyword',
              rawLen: line.length,
              escapedLen: textIn.length,
              rawPreview: line.length > 120 ? `${line.slice(0, 120)}…` : line,
              xExpr: '(w-tw)/2',
            })}`,
          );
        }
        const y = Math.round(a.height * yFrac);
        const t0 = kw.startSeconds.toFixed(3);
        const t1 = kw.endSeconds.toFixed(3);
        if (isSlate) {
          const fsS = Math.max(16, Math.round(a.height * (bold ? 0.038 : 0.033)));
          const ySlate = Math.round(a.height * (bold ? 0.76 : 0.775));
          const boxW = bold ? 10 : 8;
          filters.push(
            `drawtext=fontfile=${fontEsc}:text='${textIn}':fontsize=${fsS}:fontcolor=#1a1a1a:borderw=1:bordercolor=#e5e7eb@0.92:shadowcolor=black@0.1:shadowx=1:shadowy=1:box=1:boxcolor=white@${bold ? '0.93' : '0.88'}:boxborderw=${boxW}:x=(w-tw)/2:y=${ySlate}:enable='between(t\\,${t0}\\,${t1})'`,
          );
        } else {
          filters.push(
            `drawtext=fontfile=${fontEsc}:text='${textIn}':fontsize=${fs}:fontcolor=white:borderw=${border}:bordercolor=black@0.88${shadow}:box=1:boxcolor=black@${boxAlpha}:boxborderw=${boxBorder}:x=(w-tw)/2:y=${y}:enable='between(t\\,${t0}\\,${t1})'`,
          );
        }
      }
      if (a.persistentCaption?.trim()) {
        const cap = sanitizeOverlayFileText(a.persistentCaption.trim(), 80);
        if (cap) {
          const capIn = escapeDrawtextInlineText(cap);
          if (stitchLogDrawtextNormalizeEnabled()) {
            console.info(
              `[stitcher:drawtext-inline] ${JSON.stringify({
                segmentIndex: a.segmentIndex,
                kind: 'persistentCaption',
                rawLen: cap.length,
                escapedLen: capIn.length,
                rawPreview: cap.length > 120 ? `${cap.slice(0, 120)}…` : cap,
                xExpr: '(w-tw)/2',
              })}`,
            );
          }
          const fs2 = Math.max(17, Math.round(a.height * (bold ? 0.036 : 0.032)));
          const te = Math.max(0.05, a.durationSeconds - 0.04).toFixed(3);
          filters.push(
            `drawtext=fontfile=${fontEsc}:text='${capIn}':fontsize=${fs2}:fontcolor=white@0.94:borderw=2:bordercolor=black@0.88:shadowcolor=black@0.5:shadowx=2:shadowy=2:box=1:boxcolor=black@0.34:boxborderw=10:x=(w-tw)/2:y=h*0.86:enable='between(t\\,0\\,${te})'`,
          );
        }
      }
    }
  }

  const staticStillFrames =
    a.kind === 'image' && !useKenBurnsOnImage
      ? Math.max(1, Math.round(a.durationSeconds * a.fps))
      : 0;

  const inputPath = ffmpegCliFilesystemPath(a.input);
  const outputPath = ffmpegCliFilesystemPath(a.output);
  const inputArg = useWinWorkdirSpawn ? path.basename(a.input) : inputPath;
  const outputArg = useWinWorkdirSpawn ? path.basename(a.output) : outputPath;

  const vfJoined = filters.join(',');
  /** Windows static stills: `-filter_complex` + explicit map avoids some libavfilter + libx264 link bugs with `-vf`. */
  const winStaticFilterComplex =
    process.platform === 'win32' && a.kind === 'image' && !useKenBurnsOnImage;
  const winFilterComplexGraph = winStaticFilterComplex ? windowsStaticFilterComplexExpr(filters) : null;

  const args: string[] = [];
  // Still + no Ken Burns: loop image; duration is enforced with `-frames:v` (not `-t`) below.
  if (a.kind === 'image' && !useKenBurnsOnImage) {
    args.push('-loop', '1');
    // Input frame rate for the looped single image (pairs with omitted `fps=` in -vf).
    args.push('-framerate', String(a.fps));
  }
  args.push('-i', inputArg);
  if (a.kind === 'video') args.push('-t', String(a.durationSeconds));
  if (winStaticFilterComplex) {
    args.push('-filter_complex', winFilterComplexGraph!);
    args.push('-map', '[normv]');
  } else {
    args.push('-vf', vfJoined);
  }
  const vEnc = stitchH264VArgs({
    tune: useKenBurnsOnImage ? 'stillimage' : undefined,
    encodeTier: a.encodeTier,
    omitProfile: process.platform === 'win32',
  });
  args.push(...vEnc);
  args.push('-an'); // strip audio — we mix separately
  if (a.kind === 'video' || useKenBurnsOnImage) {
    args.push('-r', String(a.fps));
  }
  if (useKenBurnsOnImage && imageOutFrames > 0) {
    args.push('-frames:v', String(imageOutFrames));
  } else if (staticStillFrames > 0) {
    // Prefer exact frame count over `-t` with `-loop 1` (avoids duration/graph quirks on Windows).
    args.push('-frames:v', String(staticStillFrames));
  }
  // Intermediate segments: skip `+faststart` (second pass / moov rewrite); some Windows FFmpeg builds
  // error when combining faststart + short temp segment paths.
  args.push('-y', outputArg);

  const ffmpegDebug = stitchFfmpegDebugTrace();
  const normalizeDumpAll = stitchNormalizeDumpEveryShot();
  const shouldDumpNormalizePre = ffmpegDebug || normalizeDumpAll;
  let inputStat: Record<string, unknown> = {};
  try {
    const st = statSync(a.input);
    inputStat = { exists: true, size: st.size, mtimeMs: st.mtimeMs };
  } catch (e) {
    inputStat = { exists: false, err: e instanceof Error ? e.message : String(e) };
  }
  let workDirStat: Record<string, unknown> = {};
  try {
    const st = statSync(workDirAbs);
    workDirStat = { exists: true, isDirectory: st.isDirectory(), mode: st.mode };
  } catch (e) {
    workDirStat = { exists: false, err: e instanceof Error ? e.message : String(e) };
  }
  const fontProbe = overlayFontPath();
  const drawtextCount = filters.filter((f) => f.startsWith('drawtext=')).length;
  const filterComplexFull = winFilterComplexGraph ?? undefined;
  const normalizePrePayload = {
    tag: 'normalize-pre-invoke',
    segmentIndex: a.segmentIndex,
    platform: process.platform,
    node: process.version,
    cwdPlanned: useWinWorkdirSpawn ? workDirAbs : null,
    useWinWorkdirSpawn,
    inputResolved: a.input,
    outputResolved: a.output,
    inputArg,
    outputArg,
    inputStat,
    workDirStat,
    pathLens: {
      inputResolved: a.input.length,
      outputResolved: a.output.length,
      workDirAbs: workDirAbs.length,
      vfJoined: vfJoined.length,
      ffmpegBin: a.ffmpegBin.length,
    },
    targetWxH: { w: a.width, h: a.height },
    fps: a.fps,
    colourGrade: a.colourGrade,
    encodeTier: a.encodeTier,
    useGrain: a.useGrain,
    letterbox: a.letterbox,
    kenBurnsOnImage: useKenBurnsOnImage,
    staticStillFrames,
    imageOutFrames,
    overlayStyle: a.overlayStyle,
    keywordCards: a.keywordCards?.map((c) => {
      const kt = typeof c.text === 'string' ? c.text : String(c.text ?? '');
      return {
        startSeconds: c.startSeconds,
        endSeconds: c.endSeconds,
        textLen: kt.length,
        textPreview: `${kt.slice(0, 64)}${kt.length > 64 ? '…' : ''}`,
      };
    }),
    persistentCaptionLen: a.persistentCaption?.trim().length ?? 0,
    fontPathForDrawtext: fontProbe ? path.basename(fontProbe) : null,
    gradeFilterString: grade ?? '(none)',
    filterPass: winStaticFilterComplex ? 'filter_complex' : 'vf',
    filterComplexFull,
    drawtextCount,
    winFilterComplexLabeledChain: winStaticFilterComplex && drawtextCount > 1,
    filtersChain: filters,
    vfFilterCount: filters.length,
    vfJoinedLength: vfJoined.length,
    vfJoinedFull: vfJoined,
    argv: [a.ffmpegBin, ...args],
    h264EncodeArgs: vEnc,
    winStaticFilterComplex,
    omitH264HighProfile: process.platform === 'win32',
  };

  if (shouldDumpNormalizePre) {
    console.info(
      `[stitcher:debug-ffmpeg] normalize pre-invoke seg=${a.segmentIndex} kind=${a.kind} dur=${a.durationSeconds}s\n` +
        JSON.stringify(normalizePrePayload, null, 2),
    );
  } else if (process.env.NODE_ENV !== 'production' && a.segmentIndex === 0) {
    console.info(
      '[stitcher:normalize-dev-seg0]',
      JSON.stringify(
        {
          ...normalizePrePayload,
          vfJoinedFull: `${vfJoined.slice(0, 900)}${vfJoined.length > 900 ? `…(+${vfJoined.length - 900} chars)` : ''}`,
          hint: 'Every shot: set PERSONAL_DEBUG_STITCH_NORMALIZE=1. FFmpeg stderr lines: PERSONAL_DEBUG_STITCH_FFMPEG=1.',
        },
        null,
        0,
      ),
    );
  }

  // Compact per-shot line: dev for seg≥1 (seg0 is covered by normalize-dev-seg0); skip when verbose pre-invoke is on.
  const wantCompactNormalizeLine =
    (process.env.NODE_ENV !== 'production' || normalizeDumpAll) && !shouldDumpNormalizePre;
  if (wantCompactNormalizeLine && a.segmentIndex > 0) {
    console.info(
      `[stitcher:normalize-start] seg=${a.segmentIndex} kind=${a.kind} dur=${a.durationSeconds}s pass=${normalizePrePayload.filterPass} winWd=${useWinWorkdirSpawn ? 1 : 0} winFc=${winStaticFilterComplex ? 1 : 0} vfLen=${vfJoined.length} frames=${staticStillFrames || imageOutFrames || 'n/a'} in=${path.basename(a.input)}`,
    );
  }

  logVisualPacing('ffmpeg-normalize', `seg${a.segmentIndex}`, {
    kind: a.kind,
    durationSeconds: a.durationSeconds,
    fps: a.fps,
    imageOutFrames: a.kind === 'image' ? imageOutFrames : undefined,
    kenBurns: useKenBurnsOnImage,
    framesVCap: useKenBurnsOnImage && imageOutFrames > 0 ? imageOutFrames : undefined,
    staticImageSeconds: a.kind === 'image' && !useKenBurnsOnImage ? Math.max(0.05, a.durationSeconds) : undefined,
    staticStillFrames: staticStillFrames > 0 ? staticStillFrames : undefined,
    winWorkdirSpawn: useWinWorkdirSpawn ? true : undefined,
    winStaticFilterComplex: winStaticFilterComplex ? true : undefined,
    drawtextCount: drawtextCount > 0 ? drawtextCount : undefined,
    winFilterComplexLabeled: winStaticFilterComplex && drawtextCount > 1 ? true : undefined,
    videoDecodeCapSeconds: a.kind === 'video' ? a.durationSeconds : undefined,
    videoTrimEnd: a.kind === 'video' ? Math.max(0.05, a.durationSeconds).toFixed(3) : undefined,
  });

  const drawtextVerbose =
    stitchLogDrawtextNormalizeEnabled() ||
    stitchFfmpegDebugTrace() ||
    normalizeDumpAll ||
    shouldDumpNormalizePre;
  if (drawtextCount > 0) {
    const snippets = filters
      .filter((f) => f.startsWith('drawtext='))
      .map((f) => (f.length > 420 ? `${f.slice(0, 420)}…(+${f.length - 420})` : f));
    if (process.env.NODE_ENV !== 'production' || drawtextVerbose) {
      console.info(
        `[stitcher:drawtext-pre] ${JSON.stringify({
          segmentIndex: a.segmentIndex,
          kind: a.kind,
          durationSeconds: a.durationSeconds,
          useWinWorkdirSpawn,
          filterPass: winStaticFilterComplex ? 'filter_complex' : 'vf',
          drawtextCount,
          fontBasename: fontProbe ? path.basename(fontProbe) : null,
          snippets,
        })}`,
      );
    }
    if (drawtextVerbose) {
      logNormalizeOverlayTextfilesDebug({
        tag: 'pre-ffmpeg',
        segmentIndex: a.segmentIndex,
        workDir: workDirAbs,
      });
    }
  }

  try {
    await runFfmpeg(a.ffmpegBin, args, `normalize:${path.basename(a.output)}`, {
      onStatsLine: a.onFfmpegStatsLine,
      cwd: useWinWorkdirSpawn ? workDirAbs : undefined,
      debugContext: shouldDumpNormalizePre
        ? {
            phase: 'normalize',
            segmentIndex: a.segmentIndex,
            kind: a.kind,
            vfJoinedFull: vfJoined,
            filterComplexFull,
            drawtextCount,
            winFilterComplexLabeledChain: drawtextCount > 1 && winStaticFilterComplex,
            filterPass: normalizePrePayload.filterPass,
            h264EncodeArgs: vEnc,
          }
        : undefined,
    });
  } catch (err) {
    const ff = err instanceof FfmpegInvokeError ? err : null;
    const tail = vfJoined.length > 12_000 ? `${vfJoined.slice(0, 12_000)}…[truncated ${vfJoined.length - 12_000} chars]` : vfJoined;
    let workdirFiles: { ok: boolean; count?: number; sample?: string[]; err?: string } = { ok: false };
    try {
      const names = readdirSync(workDirAbs);
      workdirFiles = { ok: true, count: names.length, sample: names.slice(0, 100) };
    } catch (e) {
      workdirFiles = { ok: false, err: e instanceof Error ? e.message : String(e) };
    }
    let outDirStat: Record<string, unknown> = {};
    try {
      const outDir = path.dirname(path.resolve(a.output));
      const st = statSync(outDir);
      outDirStat = { path: outDir, exists: true, isDirectory: st.isDirectory() };
    } catch (e) {
      outDirStat = { err: e instanceof Error ? e.message : String(e) };
    }
    const stderrCap = 52_000;
    const stderrFull = ff?.ffmpegStderr ?? '';
    const stderrForJson =
      stderrFull.length > stderrCap ? `${stderrFull.slice(0, 24_000)}\n…[truncated middle]…\n${stderrFull.slice(-24_000)}` : stderrFull;

    if (drawtextCount > 0) {
      logNormalizeOverlayTextfilesDebug({
        tag: 'on-failure',
        segmentIndex: a.segmentIndex,
        workDir: workDirAbs,
      });
      const drawSnips = filters
        .filter((f) => f.startsWith('drawtext='))
        .map((f) => (f.length > 520 ? `${f.slice(0, 520)}…(+${f.length - 520})` : f));
      console.warn(
        `[stitcher:drawtext-on-failure] ${JSON.stringify({
          segmentIndex: a.segmentIndex,
          drawSnips,
          useWinWorkdirSpawn,
          filterPass: winStaticFilterComplex ? 'filter_complex' : 'vf',
        })}`,
      );
      const hintBoth =
        stderrFull.includes('Both text and text file') ||
        stderrFull.includes('text and text file provided');
      if (hintBoth) {
        console.warn(
          '[stitcher:drawtext-hint] Keyword/caption overlays use inline `text=…` (not `textfile`) with `x=(w-tw)/2`. If you still see text+textfile errors, search for `textfile=` in drawtext filters or avoid `text_w` / `text_align` next to `textfile`. Set PERSONAL_LOG_DRAWTEXT_NORMALIZE=1 for `[stitcher:drawtext-inline]` lines.',
        );
      }
    }
    try {
      console.warn(
        '[stitcher:normalize-failed]',
        JSON.stringify(
          {
            segmentIndex: a.segmentIndex,
            kind: a.kind,
            durationSeconds: a.durationSeconds,
            winWorkdirSpawn: useWinWorkdirSpawn,
            winStaticFilterComplex,
            omitH264HighProfile: process.platform === 'win32',
            colourGrade: a.colourGrade,
            overlayStyle: a.overlayStyle,
            message: err instanceof Error ? err.message : String(err),
            ffmpegExitCode: ff?.exitCode ?? null,
            ffmpegLabel: ff?.ffmpegLabel,
            ffmpegArgv: ff?.ffmpegArgv ?? [a.ffmpegBin, ...args],
            ffmpegCwd: ff?.ffmpegCwd ?? (useWinWorkdirSpawn ? workDirAbs : undefined),
            cwd: useWinWorkdirSpawn ? workDirAbs : undefined,
            inputArg,
            outputArg,
            inputResolved: a.input,
            outputResolved: a.output,
            filterPass: winStaticFilterComplex ? 'filter_complex' : 'vf',
            filterComplexFull,
            drawtextCount,
            winFilterComplexLabeledChain: winStaticFilterComplex && drawtextCount > 1,
            vfJoinedLength: vfJoined.length,
            vfJoined: tail,
            filtersChain: filters,
            argv: [a.ffmpegBin, ...args],
            stderrChars: stderrFull.length,
            stderrFull: stderrForJson,
            workdirFiles,
            outDirStat,
            normalizePrePayloadSnapshot: {
              pathLens: normalizePrePayload.pathLens,
              staticStillFrames: normalizePrePayload.staticStillFrames,
              imageOutFrames: normalizePrePayload.imageOutFrames,
            },
            hint: 'PERSONAL_DEBUG_STITCH_NORMALIZE=1 logs every shot pre-invoke. PERSONAL_DEBUG_STITCH_FFMPEG=1 adds FFmpeg verbose stderr during the run. PERSONAL_LOG_DRAWTEXT_NORMALIZE=1 logs `[stitcher:drawtext-inline]` + legacy ov-*.txt dumps. PERSONAL_LOG_FFMPEG_VERSION=1 logs ffmpeg -version once per stitch.',
          },
          null,
          0,
        ),
      );
    } catch {
      console.warn('[stitcher:normalize-failed] (could not JSON-serialize failure context)', err);
    }
    if (ff && ff.ffmpegStderr.trim()) {
      console.warn(
        `[stitcher:normalize-failed-stderr-raw] seg=${a.segmentIndex} chars=${ff.ffmpegStderr.length}\n${ff.ffmpegStderr.slice(-14_000)}`,
      );
    }
    throw err;
  }
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
  /**
   * Per-segment target duration (seconds), same order as `segmentPaths`.
   * Used to correct xfade timing when `ffmpeg -i` probes a bogus short
   * container Duration (common on some Windows/libx264 outputs) — offsets
   * were derived from probe only and could go negative, collapsing the
   * whole timeline to a flash.
   */
  plannedSegmentSeconds?: number[];
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
  // Prefer probed file length, but merge with planned shot durations: some
  // encoded segments report Duration≈0 in `ffmpeg -i` while the bitstream
  // is full length; using only that breaks offset math below.
  const probeBatch0 = performance.now();
  const probed = await Promise.all(
    a.segmentPaths.map((p) => probeDurationSeconds(a.ffmpegBin, p)),
  );
  const plannedRaw = a.plannedSegmentSeconds;
  const planned =
    plannedRaw && plannedRaw.length === a.segmentPaths.length
      ? plannedRaw
      : undefined;
  if (
    plannedRaw &&
    plannedRaw.length > 0 &&
    plannedRaw.length !== a.segmentPaths.length
  ) {
    console.warn(
      `[stitcher] xfade: plannedSegmentSeconds length ${plannedRaw.length} !== ${a.segmentPaths.length} segments — using probe-only merge`,
    );
  }
  const durations = probed.map((probe, i) => {
    const p = planned?.[i];
    if (typeof p === 'number' && Number.isFinite(p) && p > 0.1) {
      if (!Number.isFinite(probe) || probe < p * 0.45) return p;
    }
    return probe;
  });
  tlog(
    `xfade: probed ${a.segmentPaths.length} segment durations wall=${(performance.now() - probeBatch0).toFixed(0)}ms`,
  );

  // Fade length must stay strictly below every segment we leave; the old
  // `max(0.15, …)` floor could exceed a short (or mis-probed) segment so
  // `runningOffset` went negative and FFmpeg produced a near-empty video.
  const minDur = Math.min(...durations);
  if (!Number.isFinite(minDur) || minDur <= 0) {
    throw new Error(`xfade: invalid segment durations after probe/plan merge (min=${String(minDur)})`);
  }
  const xfadeDur = Math.min(0.5, minDur - 0.001, Math.max(0.02, minDur * 0.35));

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
  /** Prepend silence to VO (ms) so narration starts after a cold open. */
  voiceoverLeadInMs?: number;
  /**
   * Sum of per-shot `durationSeconds` we encoded into segments (before concat).
   * When `ffmpeg -i` over-reports concat MP4 `Duration` (common), `apad=whole_len=…`
   * would otherwise stretch audio past real video frames → frozen last image while VO continues.
   */
  canonicalVideoDurationSeconds?: number;
}

async function mixAudio(a: MixArgs): Promise<void> {
  // Input layout: [0]=video, then VO (if any), then music (if any).
  //
  // 1. Music loops (-stream_loop) so short beds can cover long videos.
  //
  // 2. Output length must follow the **video** timeline. We used to pass
  //    `-shortest`, which truncates the whole mux to the shortest stream.
  //    A truncated or corrupt voiceover (milliseconds long) while the
  //    video is minutes long therefore produced a near-zero-length MP4.
  //    After building the mixed audio at `[apre]`, we **atrim** to the
  //    authoritative end (canonical + slack when known), then resample to
  //    48 kHz and `apad=whole_len=…` so the track matches the encoded
  //    segment sum even when `amix=duration=longest` would keep full VO.
  //
  // 3. Concat demuxer MP4s often report **inflated** `Duration` in `ffmpeg -i`
  //    while the bitstream ends earlier. Padding audio to that probe freezes
  //    the last video frame while VO continues. When `canonicalVideoDurationSeconds`
  //    is set (sum of encoded segment lengths), we **never** pad past canonical+slack.
  //
  // 4. If video duration cannot be probed, fall back to `-shortest`.
  const baseName = path.basename(a.videoInput);
  logStitchTimeline('mix-audio', 'start', {
    videoInput: baseName,
    hasVo: Boolean(a.voiceoverPath),
    hasMusic: Boolean(a.musicPath),
    canonicalVideoDurationSeconds: a.canonicalVideoDurationSeconds ?? null,
    leadMs: a.voiceoverLeadInMs ?? 0,
  });

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

  let probedVideoSec = 0;
  try {
    probedVideoSec = await probeDurationSeconds(a.ffmpegBin, a.videoInput);
  } catch (e) {
    console.warn(
      '[stitcher] mix-audio: could not probe video duration; using -shortest (risky if VO is very short):',
      (e as Error).message,
    );
  }

  const canonical =
    typeof a.canonicalVideoDurationSeconds === 'number' &&
    Number.isFinite(a.canonicalVideoDurationSeconds) &&
    a.canonicalVideoDurationSeconds > 0.15
      ? a.canonicalVideoDurationSeconds
      : undefined;

  let voProbeSec: number | null = null;
  let muProbeSec: number | null = null;
  if (a.voiceoverPath) {
    try {
      voProbeSec = await probeDurationSeconds(a.ffmpegBin, a.voiceoverPath);
    } catch {
      voProbeSec = null;
    }
  }
  if (a.musicPath) {
    try {
      muProbeSec = await probeDurationSeconds(a.ffmpegBin, a.musicPath);
    } catch {
      muProbeSec = null;
    }
  }

  logStitchTimeline('mix-audio', 'probes (raw)', {
    probedVideoSec: Number.isFinite(probedVideoSec) ? Math.round(probedVideoSec * 1000) / 1000 : null,
    voProbeSec: voProbeSec != null ? Math.round(voProbeSec * 1000) / 1000 : null,
    muProbeSec: muProbeSec != null ? Math.round(muProbeSec * 1000) / 1000 : null,
    canonical,
  });

  let videoDurSec = probedVideoSec;
  if ((!Number.isFinite(videoDurSec) || videoDurSec <= 0.05) && canonical != null) {
    logStitchTimeline('mix-audio', 'video probe unusable — using canonical', {
      probedVideoSec,
      canonical,
    });
    videoDurSec = canonical;
  }

  /** Hard ceiling: apad must not exceed encoded timeline + mux slack (~7 frames @ 30fps). */
  const APAD_SLACK_SEC = 0.25;
  if (canonical != null && Number.isFinite(videoDurSec) && videoDurSec > 0.05) {
    const ceiling = canonical + APAD_SLACK_SEC;
    if (videoDurSec > ceiling) {
      console.warn(
        `[stitcher] mix-audio: clamping apad basis ${videoDurSec.toFixed(3)}s → ${ceiling.toFixed(3)}s ` +
          `(canonical encoded video=${canonical.toFixed(3)}s + ${APAD_SLACK_SEC}s). Prevents frozen last frame when concat metadata over-reports duration.`,
      );
      logStitchTimeline('mix-audio', 'apad basis clamped', {
        before: Math.round(videoDurSec * 1000) / 1000,
        after: Math.round(ceiling * 1000) / 1000,
        canonical,
      });
      videoDurSec = ceiling;
    }
  }

  /**
   * Authoritative end for **audio** (atrim + apad): when we know encoded video length
   * (`canonical`), prefer it over concat probe — probe can be slightly high/low; VO is
   * often much longer and must be hard-trimmed or the mux extends to VO (frozen frame).
   */
  let audioMasterSec = videoDurSec;
  if (canonical != null && canonical > 0.15) {
    const fromCanonical = canonical + Math.min(APAD_SLACK_SEC, 0.15);
    audioMasterSec = fromCanonical;
    logStitchTimeline('mix-audio', 'audio master duration (canonical-first)', {
      probedVideoSec: Number.isFinite(probedVideoSec) ? Math.round(probedVideoSec * 1000) / 1000 : null,
      canonical,
      audioMasterSec: Math.round(audioMasterSec * 1000) / 1000,
      voProbeSec: voProbeSec != null ? Math.round(voProbeSec * 1000) / 1000 : null,
    });
  }

  const outRate = 48_000;
  const wholeSamples =
    Number.isFinite(audioMasterSec) && audioMasterSec > 0.05
      ? Math.min(outRate * 60 * 120, Math.ceil(audioMasterSec * outRate) + 2048)
      : 0;

  logStitchTimeline('mix-audio', 'apad plan', {
    videoDurSecForPad: Number.isFinite(videoDurSec) ? Math.round(videoDurSec * 1000) / 1000 : null,
    audioMasterSec: Number.isFinite(audioMasterSec) ? Math.round(audioMasterSec * 1000) / 1000 : null,
    wholeSamples,
    wholeLenSeconds: wholeSamples > 0 ? Math.round((wholeSamples / outRate) * 1000) / 1000 : null,
    useShortestFallback: wholeSamples <= 0,
  });

  const voIdx = inputs.indexOf('vo');
  const muIdx = inputs.indexOf('music');
  // Inputs are 1-indexed in filter labels because [0] is the video.
  const voLabelRaw = voIdx !== -1 ? `[${voIdx + 1}:a]` : undefined;
  const muLabel = muIdx !== -1 ? `[${muIdx + 1}:a]` : undefined;
  const leadMs =
    typeof a.voiceoverLeadInMs === 'number' && Number.isFinite(a.voiceoverLeadInMs) && a.voiceoverLeadInMs > 0
      ? Math.min(12_000, Math.max(1, Math.round(a.voiceoverLeadInMs)))
      : 0;

  const filterParts: string[] = [];
  if (voLabelRaw && muLabel) {
    filterParts.push(`${muLabel}volume=${a.musicDuckLowVolume}[mu]`);
    if (leadMs > 0) {
      filterParts.push(`${voLabelRaw}adelay=${leadMs}:all=1[vodelay]`);
      filterParts.push(
        `[vodelay][mu]amix=inputs=2:duration=longest:dropout_transition=0:normalize=1[a0]`,
      );
    } else {
      filterParts.push(
        `${voLabelRaw}[mu]amix=inputs=2:duration=longest:dropout_transition=0:normalize=1[a0]`,
      );
    }
    filterParts.push(`[a0]alimiter=limit=0.98[apre]`);
  } else if (voLabelRaw) {
    if (leadMs > 0) {
      filterParts.push(`${voLabelRaw}adelay=${leadMs}:all=1[vodelay]`);
      filterParts.push(`[vodelay]volume=1,alimiter=limit=0.99[apre]`);
    } else {
      filterParts.push(`${voLabelRaw}volume=1,alimiter=limit=0.99[apre]`);
    }
  } else if (muLabel) {
    filterParts.push(
      `${muLabel}volume=${a.musicSoloVolume},afade=t=in:st=0:d=0.03,alimiter=limit=0.99[apre]`,
    );
  }

  if (wholeSamples > 0) {
    const endTrim = Math.max(0.08, Number(audioMasterSec)).toFixed(4);
    logStitchTimeline('mix-audio', 'atrim+apad chain', {
      endTrimSec: endTrim,
      wholeSamples,
      audioMasterSec: Math.round(audioMasterSec * 1000) / 1000,
      canonical: canonical ?? null,
    });
    filterParts.push(
      `[apre]atrim=end=${endTrim},asetpts=PTS-STARTPTS,aresample=${outRate},apad=whole_len=${wholeSamples}[aout]`,
    );
    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', '0:v:0', '-map', '[aout]');
  } else {
    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', '0:v:0', '-map', '[apre]');
    args.push('-shortest');
  }
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', String(outRate));
  args.push('-movflags', '+faststart');
  args.push('-y', a.output);

  await runFfmpeg(a.ffmpegBin, args, 'mix-audio');

  let outProbe = NaN;
  try {
    outProbe = await probeDurationSeconds(a.ffmpegBin, a.output);
  } catch {
    /* ignore */
  }
  logStitchTimeline('mix-audio', 'output probe', {
    output: path.basename(a.output),
    probedSeconds: Number.isFinite(outProbe) ? Math.round(outProbe * 1000) / 1000 : null,
    expectedAudioMasterSec:
      Number.isFinite(audioMasterSec) && audioMasterSec > 0.05 ? Math.round(audioMasterSec * 1000) / 1000 : null,
    probedVideoSecForLog: Number.isFinite(videoDurSec) && videoDurSec > 0.05 ? Math.round(videoDurSec * 1000) / 1000 : null,
    canonical,
  });
  if (
    Number.isFinite(outProbe) &&
    Number.isFinite(audioMasterSec) &&
    audioMasterSec > 0.05 &&
    Math.abs(outProbe - audioMasterSec) > 0.85
  ) {
    console.warn(
      `[stitcher] mix-audio: final mux duration ${outProbe.toFixed(2)}s vs audio master ${audioMasterSec.toFixed(2)}s (diff ${(outProbe - audioMasterSec).toFixed(2)}s). Set PERSONAL_DEBUG_MIX_AUDIO=1 for full trace.`,
    );
  }
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
      // Avoid embedded single quotes in the filter string — fragile on some Windows FFmpeg parses.
      return 'curves=preset=medium_contrast,eq=saturation=0.95';
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
  /** When set, FFmpeg resolves relative `-i` / `-y` / `textfile=` paths against this directory (Windows stitch fix). */
  cwd?: string;
  /** Passed through on failure when normalize verbose flags are on (see `normalizeToSegment`). */
  debugContext?: Record<string, unknown>;
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
  const wantDebugTrace = stitchFfmpegDebugTrace();
  const logLevel = wantDebugTrace ? 'verbose' : wantStatsPipe ? 'info' : 'error';

  return new Promise<void>((resolve, reject) => {
    if (wantDebugTrace) {
      const fullArgv = [bin, '-hide_banner', `-loglevel=${logLevel}`, ...args];
      console.info(
        `[stitcher:debug-ffmpeg] spawn label=${label} cwd=${opts?.cwd ?? '(process default)'}\n` +
          `  argv_json=${JSON.stringify(fullArgv)}\n` +
          (opts?.debugContext
            ? `  context_json=${JSON.stringify(opts.debugContext, null, 0).slice(0, 12000)}\n`
            : ''),
      );
    }

    const p = spawn(bin, ['-hide_banner', '-loglevel', logLevel, ...args], {
      ...(opts?.cwd ? { cwd: opts.cwd } : {}),
      windowsHide: true,
    });
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
            if (wantDebugTrace) {
              console.error(
                `[stitcher:debug-ffmpeg] TIMEOUT label=${label} cwd=${opts?.cwd ?? ''}\nstderr_tail=\n${stderr.slice(-12_000)}`,
              );
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
      if (wantDebugTrace) {
        for (const raw of chunk.split('\n')) {
          const t = raw.trim();
          if (!t) continue;
          if (
            /\b(filter|error|invalid|failed|unknown|deprecated|libx264|drawtext|scale|crop|format)\b/i.test(t)
          ) {
            console.info(`[stitcher:debug-ffmpeg] stderr[${label}] ${t.slice(0, 2000)}`);
          }
        }
      }
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
      if (wantDebugTrace) {
        console.error(
          `[stitcher:debug-ffmpeg] spawn_process_error label=${label} cwd=${opts?.cwd ?? ''} err=${(e as Error).message}\n` +
            `  argv_json=${JSON.stringify([bin, '-hide_banner', `-loglevel=${logLevel}`, ...args])}`,
        );
      }
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
        if (wantDebugTrace) {
          console.info(
            `[stitcher:debug-ffmpeg] ok label=${label} ms=${(performance.now() - wall0).toFixed(0)} stderr_bytes=${stderr.length}`,
          );
        }
        return resolve();
      }
      if (wantDebugTrace) {
        const tail = stderr.length > 24_000 ? stderr.slice(-24_000) : stderr;
        console.error(
          `[stitcher:debug-ffmpeg] FAIL label=${label} exit=${code ?? 'unknown'} ms=${(performance.now() - wall0).toFixed(0)}\n` +
            `  argv_json=${JSON.stringify([bin, '-hide_banner', `-loglevel=${logLevel}`, ...args])}\n` +
            `  cwd=${opts?.cwd ?? '(process default)'}\n` +
            (opts?.debugContext
              ? `  context_json=${JSON.stringify(opts.debugContext, null, 2).slice(0, 16000)}\n`
              : '') +
            `  stderr_full_or_tail=\n${tail}`,
        );
        try {
          if (opts?.cwd && existsSync(opts.cwd)) {
            const names = readdirSync(opts.cwd);
            console.error(
              `[stitcher:debug-ffmpeg] workdir_list cwd=${opts.cwd} count=${names.length} sample=${JSON.stringify(names.slice(0, 40))}`,
            );
          }
        } catch {
          /* ignore */
        }
      }
      reject(
        new FfmpegInvokeError({
          exitCode: typeof code === 'number' ? code : null,
          stderr,
          label,
          argv: [bin, '-hide_banner', '-loglevel', logLevel, ...args],
          cwd: opts?.cwd,
          summary: summarizeFfmpegStderr(stderr),
        }),
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
  stitchFfmpegDebugTrace,
};
