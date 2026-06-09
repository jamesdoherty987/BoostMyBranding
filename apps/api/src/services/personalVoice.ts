/**
 * Text-to-speech for personal content.
 *
 * Providers, in preference order:
 *   1. ElevenLabs  (premium quality, requires ELEVENLABS_API_KEY)
 *   2. OpenAI TTS  (high quality, requires OPENAI_API_KEY)
 *   3. Mock        (returns a silent WAV so the pipeline doesn't break)
 *
 * The output is always an MP3 buffer, which the pipeline uploads to R2
 * and references from the Remotion composition via `<Audio src>`.
 *
 * LONG-FORM NOTE: Both ElevenLabs (5000 char cap) and OpenAI TTS (4096
 * char cap) fail hard on long scripts. For long-form videos a 4-8
 * minute narration easily runs 5000-10000 characters. We split on
 * sentence boundaries, synthesize each chunk, and concatenate the MP3
 * buffers. MP3 is naturally concatenatable — frames are self-contained —
 * so a simple Buffer.concat produces a valid playable file.
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { logVisualPacing } from './personalDebugVisualPacing.js';
import { uploadFile } from './r2.js';
import { resolveFfmpegBin } from '../lib/ffmpegBin.js';

/** When `voiceId` is unset or `default`, combined with provider to pick a stock voice. */
export type VoiceAccentPreset = 'american' | 'british';
export type VoiceGenderPreset = 'female' | 'male';

/** Matches {@link PersonalGeneratorConfig.ttsProvider} — controls try order / skip TTS. */
export type TtsProviderPreference = 'elevenlabs' | 'openai' | 'cartesia' | 'none';

export interface SynthesizeArgs {
  text: string;
  /** Provider voice id. Provider-agnostic by passing 'default'. */
  voiceId?: string;
  /** Stock accent when `voiceId` is default or ambiguous (OpenAI preset names). */
  voiceAccent?: VoiceAccentPreset;
  /** Stock gender when `voiceId` is default or ambiguous. */
  voiceGender?: VoiceGenderPreset;
  /** ISO 639-1 hint for non-English providers that need it. */
  language?: string;
  /** Speed, 0.8–1.2. */
  speed?: number;
  /** Storage scope — goes into R2 path as `personal/{accountId}/voiceovers`. */
  accountId: string;
  /**
   * When set, picks which engine to try first (with fallbacks if keys missing).
   * `cartesia` is not wired yet — behaves like OpenAI-first then ElevenLabs.
   */
  providerPreference?: TtsProviderPreference;
}

/** Character-level timing from ElevenLabs `…/with-timestamps` (same string as TTS input). */
export interface VoiceCharacterAlignment {
  narrationText: string;
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

export interface SynthesizeResult {
  audioUrl: string;
  durationSeconds: number;
  provider: 'elevenlabs' | 'openai' | 'mock';
  costCents: number;
  /** Present when ElevenLabs returned per-character timings for the exact `text` synthesized. */
  voiceCharacterAlignment?: VoiceCharacterAlignment;
}

export async function synthesizeVoice(args: SynthesizeArgs): Promise<SynthesizeResult> {
  const text = args.text.trim();
  if (text.length < 1) throw new Error('Voiceover text is empty');

  const pref = args.providerPreference ?? 'elevenlabs';
  if (pref === 'none') {
    return mockVoice(args, text);
  }

  const hasEl = Boolean(process.env.ELEVENLABS_API_KEY);
  const hasOa = Boolean(process.env.OPENAI_API_KEY);

  const tryEleven = async () => {
    if (!hasEl) throw new Error('no ElevenLabs key');
    return synthesizeElevenLabs(args, text);
  };
  const tryOpenAi = async () => {
    if (!hasOa) throw new Error('no OpenAI key');
    return synthesizeOpenAI(args, text);
  };

  /** Default: ElevenLabs → OpenAI → mock (legacy behaviour). */
  const chainElevenFirst = async () => {
    if (hasEl) {
      try {
        return await tryEleven();
      } catch (e) {
        console.warn('[voice] ElevenLabs failed, falling back:', (e as Error).message);
      }
    }
    if (hasOa) {
      try {
        return await tryOpenAi();
      } catch (e) {
        console.warn('[voice] OpenAI TTS failed, falling back:', (e as Error).message);
      }
    }
    return mockVoice(args, text);
  };

  const chainOpenAiFirst = async () => {
    if (hasOa) {
      try {
        return await tryOpenAi();
      } catch (e) {
        console.warn('[voice] OpenAI TTS failed, falling back:', (e as Error).message);
      }
    }
    if (hasEl) {
      try {
        return await tryEleven();
      } catch (e) {
        console.warn('[voice] ElevenLabs failed, falling back:', (e as Error).message);
      }
    }
    return mockVoice(args, text);
  };

  if (pref === 'openai') {
    return chainOpenAiFirst();
  }
  if (pref === 'cartesia') {
    // Cartesia SDK not wired — prefer neural OpenAI, then ElevenLabs.
    return chainOpenAiFirst();
  }
  return chainElevenFirst();
}

/* ─── ElevenLabs ────────────────────────────────────────────────── */

const ELEVENLABS_CHUNK_CHARS = 3500;

/** OpenAI TTS preset names — if `voiceId` matches one, ElevenLabs uses accent/gender stock instead. */
const OPENAI_TTS_VOICE_NAMES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

function elevenLabsStockVoiceId(accent?: VoiceAccentPreset, gender?: VoiceGenderPreset): string {
  const a = accent ?? 'american';
  const g = gender ?? 'female';
  if (a === 'american' && g === 'female') return '21m00Tcm4TlvDq8ikWAM'; // Rachel
  if (a === 'american' && g === 'male') return 'pNInz6obpgDQGcFmaJgB'; // Adam
  if (a === 'british' && g === 'female') return 'XB0fDUnXU5powFXDhCwa'; // Charlotte
  return 'VR6AewLTigWG4xSOukaG'; // Arnold — UK male
}

function openAiStockVoice(accent?: VoiceAccentPreset, gender?: VoiceGenderPreset): string {
  const a = accent ?? 'american';
  const g = gender ?? 'female';
  if (a === 'american' && g === 'female') return 'nova';
  if (a === 'american' && g === 'male') return 'onyx';
  if (a === 'british' && g === 'female') return 'shimmer';
  return 'fable';
}

function resolveElevenLabsVoiceId(args: SynthesizeArgs): string {
  const raw = args.voiceId?.trim();
  if (raw && raw !== 'default' && !OPENAI_TTS_VOICE_NAMES.has(raw.toLowerCase())) {
    return raw;
  }
  return elevenLabsStockVoiceId(args.voiceAccent, args.voiceGender);
}

function resolveOpenAiVoiceName(args: SynthesizeArgs): string {
  const raw = args.voiceId?.trim().toLowerCase();
  if (raw && raw !== 'default' && OPENAI_TTS_VOICE_NAMES.has(raw)) {
    return raw;
  }
  return openAiStockVoice(args.voiceAccent, args.voiceGender);
}

function parseElevenLabsAlignmentChunk(row: Record<string, unknown>): {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
} | undefined {
  const pick = (o: unknown) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return undefined;
    const r = o as Record<string, unknown>;
    const chars = r.characters;
    const starts = r.character_start_times_seconds ?? r.characterStartTimesSeconds;
    const ends = r.character_end_times_seconds ?? r.characterEndTimesSeconds;
    if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends)) return undefined;
    if (chars.length === 0 || chars.length !== starts.length || chars.length !== ends.length)
      return undefined;
    const characterStartTimesSeconds = starts.map((x) => Number(x));
    const characterEndTimesSeconds = ends.map((x) => Number(x));
    if (
      characterStartTimesSeconds.some((x) => !Number.isFinite(x)) ||
      characterEndTimesSeconds.some((x) => !Number.isFinite(x))
    ) {
      return undefined;
    }
    return {
      characters: chars.map((c) => (typeof c === 'string' ? c : String(c))),
      characterStartTimesSeconds,
      characterEndTimesSeconds,
    };
  };
  return (
    pick(row.alignment) ??
    pick(row.normalized_alignment) ??
    pick(row.normalizedAlignment)
  );
}

async function synthesizeElevenLabs(
  args: SynthesizeArgs,
  text: string,
): Promise<SynthesizeResult> {
  const voiceId = resolveElevenLabsVoiceId(args);

  // Chunk on sentence boundaries when we're over the per-request cap.
  const chunks = text.length > ELEVENLABS_CHUNK_CHARS
    ? chunkBySentence(text, ELEVENLABS_CHUNK_CHARS)
    : [text];

  const buffers: Buffer[] = [];
  const mergedChars: string[] = [];
  const mergedStarts: number[] = [];
  const mergedEnds: number[] = [];
  let alignmentOk = true;

  // Use `previous_text` so adjacent chunks keep prosody coherent — this
  // is the official ElevenLabs recommendation for stitched long-form.
  let previousText: string | undefined;
  let timeOffset = 0;
  for (const chunk of chunks) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text: chunk,
          model_id: 'eleven_turbo_v2_5',
          previous_text: previousText,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: Math.min(1.2, Math.max(0.7, args.speed ?? 1)),
          },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
    }
    let row: Record<string, unknown>;
    try {
      row = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new Error('ElevenLabs with-timestamps: invalid JSON body');
    }
    const b64 = (row.audio_base64 ?? row.audioBase64) as string | undefined;
    if (!b64 || typeof b64 !== 'string') {
      throw new Error('ElevenLabs with-timestamps: missing audio_base64');
    }
    const buf = Buffer.from(b64, 'base64');
    buffers.push(buf);

    const al = parseElevenLabsAlignmentChunk(row);
    if (!al || al.characters.length !== chunk.length) {
      alignmentOk = false;
    } else {
      for (let i = 0; i < al.characters.length; i++) {
        mergedChars.push(al.characters[i]!);
        mergedStarts.push(al.characterStartTimesSeconds[i]! + timeOffset);
        mergedEnds.push(al.characterEndTimesSeconds[i]! + timeOffset);
      }
    }

    const chunkDur =
      (await probeAudioDuration(buf).catch(() => null)) ??
      (al && al.characterEndTimesSeconds.length
        ? Math.max(...al.characterEndTimesSeconds) - Math.min(...al.characterStartTimesSeconds)
        : null) ??
      estimateDurationSeconds(chunk, args.speed ?? 1);
    timeOffset += Math.max(0.05, chunkDur);

    // Keep the tail of this chunk as prosody context for the next one.
    previousText = chunk.length > 500 ? chunk.slice(-500) : chunk;
  }

  const buffer = await concatMp3Buffers(buffers);
  const { url } = await uploadFile(
    `personal/${args.accountId}/voiceovers`,
    buffer,
    `vo-${Date.now()}.mp3`,
    'audio/mpeg',
  );
  // ElevenLabs pricing: ~$0.30 per 1k chars on Creator, call it ~$0.15/1k chars amortized.
  const costCents = Math.round((text.length / 1000) * 15);
  // Prefer a real measured duration when ffmpeg is available; fall
  // back to the WPM estimate otherwise.
  const measured = await probeAudioDuration(buffer).catch(() => null);

  let voiceCharacterAlignment: VoiceCharacterAlignment | undefined;
  if (
    alignmentOk &&
    mergedChars.length === text.length &&
    mergedStarts.length === text.length
  ) {
    voiceCharacterAlignment = {
      narrationText: text,
      characters: mergedChars,
      characterStartTimesSeconds: mergedStarts,
      characterEndTimesSeconds: mergedEnds,
    };
  } else if (!alignmentOk || mergedChars.length !== text.length) {
    console.warn(
      '[voice] ElevenLabs character alignment skipped (chunk mismatch or API shape); keyword times use storyboard heuristics.',
    );
  }

  return {
    audioUrl: url,
    durationSeconds:
      measured ?? estimateDurationSeconds(text, args.speed ?? 1),
    provider: 'elevenlabs',
    costCents,
    ...(voiceCharacterAlignment ? { voiceCharacterAlignment } : {}),
  };
}

/* ─── OpenAI TTS ────────────────────────────────────────────────── */

const OPENAI_TTS_CHUNK_CHARS = 3800;

async function synthesizeOpenAI(
  args: SynthesizeArgs,
  text: string,
): Promise<SynthesizeResult> {
  const voice = resolveOpenAiVoiceName(args);

  // OpenAI's /v1/audio/speech endpoint caps input at 4096 chars. Chunk
  // on sentence boundaries when the narration is longer.
  const chunks = text.length > OPENAI_TTS_CHUNK_CHARS
    ? chunkBySentence(text, OPENAI_TTS_CHUNK_CHARS)
    : [text];

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        voice,
        input: chunk,
        response_format: 'mp3',
        speed: args.speed ?? 1,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI TTS ${res.status}: ${body.slice(0, 200)}`);
    }
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  const buffer = await concatMp3Buffers(buffers);
  const { url } = await uploadFile(
    `personal/${args.accountId}/voiceovers`,
    buffer,
    `vo-${Date.now()}.mp3`,
    'audio/mpeg',
  );
  // tts-1-hd: $30 / 1M chars = 3c per 1k chars.
  const costCents = Math.round((text.length / 1000) * 3);
  const measured = await probeAudioDuration(buffer).catch(() => null);
  return {
    audioUrl: url,
    durationSeconds:
      measured ?? estimateDurationSeconds(text, args.speed ?? 1),
    provider: 'openai',
    costCents,
  };
}

/* ─── Mock ─────────────────────────────────────────────────────── */

function mockVoice(args: SynthesizeArgs, text: string): SynthesizeResult {
  // Return a known-good tiny silent mp3 URL. The Remotion composition
  // still plays it (silently) so the pipeline keeps timing.
  return {
    audioUrl:
      'https://r2.boostmybranding.com/public/mock/silent-30s.mp3',
    durationSeconds: estimateDurationSeconds(text, args.speed ?? 1),
    provider: 'mock',
    costCents: 0,
  };
}

/* ─── Duration estimate ────────────────────────────────────────── */

/**
 * Rough English narration speed estimate. TTS engines (ElevenLabs,
 * OpenAI nova, tts-1-hd) tend to run 160-175 WPM, a touch faster than
 * a human documentary narrator (140-150 WPM). We use 165 WPM / 2.75
 * words per second as a neutral midpoint. This is only used for cost
 * estimation and fallback duration — when ffmpeg is available we
 * measure the real MP3 duration instead.
 */
export function estimateDurationSeconds(text: string, speed = 1): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const base = words / 2.75;
  return Math.max(2, Math.round(base / Math.max(0.5, speed)));
}

/**
 * Join hook, per-shot voiceovers, and outro for a single TTS pass.
 * Skips consecutive segments that are the same after trim (case-insensitive),
 * so the opening line is not spoken twice when the script repeats the hook
 * as the first beat's `voiceover`.
 */
export function joinNarrationParts(parts: Array<string | undefined | null>): string {
  const kept: string[] = [];
  for (const raw of parts) {
    const t = (raw ?? '').trim();
    if (!t) continue;
    const last = kept[kept.length - 1];
    if (last !== undefined && last.toLowerCase() === t.toLowerCase()) continue;
    kept.push(t);
  }
  return kept.join(' ');
}

/**
 * Same narration string as {@link joinNarrationParts}([hook, ...shotVos, outro]), plus
 * character offsets in that string for each shot index (for ElevenLabs alignment lookup).
 */
export function joinNarrationPartsWithShotCharSpans(
  hook: string | undefined | null,
  shotVoiceovers: readonly string[],
  outro: string | undefined | null,
): { narration: string; shotSpanByIndex: Map<number, { start: number; end: number }> } {
  type Seg = { text: string; shotIdx: number | null };
  const segments: Seg[] = [];
  const push = (raw: string | undefined | null, shotIdx: number | null) => {
    const t = (raw ?? '').trim();
    if (!t) return;
    const last = segments[segments.length - 1]?.text;
    if (last !== undefined && last.toLowerCase() === t.toLowerCase()) return;
    segments.push({ text: t, shotIdx });
  };
  push(hook, null);
  for (let i = 0; i < shotVoiceovers.length; i++) {
    push(shotVoiceovers[i] ?? '', i);
  }
  push(outro, null);
  let narration = '';
  const shotSpanByIndex = new Map<number, { start: number; end: number }>();
  for (const seg of segments) {
    if (narration.length > 0) narration += ' ';
    const start = narration.length;
    narration += seg.text;
    const end = narration.length;
    if (seg.shotIdx !== null) {
      shotSpanByIndex.set(seg.shotIdx, { start, end });
    }
  }
  return { narration, shotSpanByIndex };
}

/** Keyword overlay times for one shot (matches {@link personalStitcher.StitchKeywordCard} shape). */
export interface VoKeywordStitchCard {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

/**
 * Map keyword cards to in-shot overlay times using ElevenLabs character alignment
 * and the voice-partition window for this shot (MP3 seconds).
 */
export function keywordStitchCardsFromVoiceAlignment(args: {
  cards: Array<{ text: string }>;
  alignment: VoiceCharacterAlignment;
  /** Character range in `alignment.narrationText` for this shot's spoken slice. */
  windowStart: number;
  windowEnd: number;
  /** Cumulative VO seconds at start/end of this shot's partition (undelayed MP3 timeline). */
  mp3PartitionStart: number;
  mp3PartitionEnd: number;
  segmentDurationSeconds: number;
  introPadSeconds: number;
  /** When true, allow two cards on shorter bodies (matches {@link normalizeKeywordCardsForShot}). */
  snappySlate?: boolean;
  /**
   * Seconds the mux delays the VO track (long-form intro). Maps undelayed MP3 alignment
   * times to per-shot segment timeline.
   */
  voiceoverLeadInSeconds?: number;
  /** Sum of prior shots' encoded `durationSeconds` in concat order (visual timeline). */
  cumulativeStitchSecondsBeforeShot?: number;
}): VoKeywordStitchCard[] | undefined {
  const {
    cards,
    alignment,
    windowStart,
    windowEnd,
    mp3PartitionStart,
    mp3PartitionEnd,
    segmentDurationSeconds,
    introPadSeconds,
    snappySlate,
    voiceoverLeadInSeconds,
    cumulativeStitchSecondsBeforeShot,
  } = args;
  const narr = alignment.narrationText;
  const nAlign = Math.min(
    narr.length,
    alignment.characterStartTimesSeconds.length,
    alignment.characterEndTimesSeconds.length,
  );
  if (!cards.length || nAlign < 1 || windowEnd <= windowStart || mp3PartitionEnd <= mp3PartitionStart) {
    return undefined;
  }

  const d = Math.max(0.45, segmentDurationSeconds);
  const introPad = Math.max(0, Math.min(d * 0.85, introPadSeconds));
  const maxLen = 56;
  const minSp = 0.26;
  const maxSpan = 1.45;
  const winLo = Math.max(0, Math.min(windowStart, nAlign));
  const winHi = Math.max(winLo, Math.min(windowEnd, nAlign));

  const raw: VoKeywordStitchCard[] = [];
  const seen = new Set<string>();

  for (const c of cards.slice(0, 8)) {
    const text = c.text.trim();
    if (!text || text.length > maxLen) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const win = narr.slice(winLo, winHi);
    let esc: string;
    try {
      esc = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } catch {
      continue;
    }
    const re = new RegExp(esc, 'i');
    const m = win.match(re);
    if (!m || m.index === undefined) continue;
    const a = winLo + m.index;
    const bEx = a + m[0].length;
    if (a < 0 || bEx > nAlign || a >= bEx) continue;

    const t0 = alignment.characterStartTimesSeconds[a]!;
    const t1 = alignment.characterEndTimesSeconds[bEx - 1]!;
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue;

    const g0 = t0 - 0.02;
    const g1 = t1 + 0.05;
    if (g1 < mp3PartitionStart || g0 > mp3PartitionEnd) continue;

    const leadIn = Math.max(0, voiceoverLeadInSeconds ?? 0);
    const cum = Math.max(0, cumulativeStitchSecondsBeforeShot ?? 0);
    /** Undelayed MP3 time g is heard at output `g + leadIn`; this shot segment starts at `cum` on the master timeline. */
    const tLocalPhraseStart = g0 + leadIn - cum;
    const tLocalPhraseEnd = g1 + leadIn - cum;

    let start = Math.max(introPad + 0.02, tLocalPhraseStart - 0.03);
    let end = Math.min(d - 0.02, Math.max(start + minSp, tLocalPhraseEnd + 0.08));
    if (end - start < minSp) {
      end = start + minSp;
    }
    if (end - start > maxSpan) {
      const mid = (start + end) / 2;
      start = mid - maxSpan / 2;
      end = mid + maxSpan / 2;
      start = Math.max(introPad + 0.02, start);
      end = Math.min(d - 0.02, end);
    }
    raw.push({ text, startSeconds: start, endSeconds: end });
  }

  if (!raw.length) return undefined;
  raw.sort((a, b) => a.startSeconds - b.startSeconds);
  const gap = 0.14;
  for (let i = 1; i < raw.length; i++) {
    const prev = raw[i - 1]!;
    const cur = raw[i]!;
    if (cur.startSeconds < prev.endSeconds + gap) {
      const span = Math.max(minSp, cur.endSeconds - cur.startSeconds);
      cur.startSeconds = Math.min(d - minSp - 0.02, prev.endSeconds + gap);
      cur.endSeconds = Math.min(d - 0.02, cur.startSeconds + span);
      if (cur.endSeconds - cur.startSeconds < minSp) {
        cur.endSeconds = Math.min(d - 0.02, cur.startSeconds + minSp);
      }
    }
  }
  const body = Math.max(0.12, d - introPad);
  const maxCards = body < 2.1 && snappySlate !== true ? 1 : 2;
  const out = raw.slice(0, maxCards);
  return out.length ? out : undefined;
}

/** Lowercase + trim punctuation on token edges for duplicate hook / first-VO detection. */
function normalizeDupWord(w: string): string {
  return w.replace(/^[^a-z0-9'’]+|[^a-z0-9'’]+$/gi, '').toLowerCase();
}

/** Index in `s` after leading whitespace and the first `wordCount` whitespace-delimited tokens. */
function charIndexAfterLeadingWords(s: string, wordCount: number): number {
  if (wordCount <= 0) return 0;
  const t = s.trimStart();
  let base = s.length - t.length;
  let i = 0;
  let words = 0;
  while (words < wordCount && i < t.length) {
    while (i < t.length && /\s/.test(t[i]!)) i++;
    if (i >= t.length) break;
    while (i < t.length && /\S/.test(t[i]!)) i++;
    words++;
  }
  while (i < t.length && /\s/.test(t[i]!)) i++;
  return base + i;
}

/**
 * Count leading words of `firstVo` that match `hook` from the first word (case / punctuation tolerant).
 */
function leadingHookDuplicateWordCount(hook: string, firstVo: string): number {
  const hw = hook.trim().split(/\s+/).filter(Boolean);
  const vw = firstVo.trim().split(/\s+/).filter(Boolean);
  if (hw.length < 1 || vw.length < 1) return 0;
  let k = 0;
  const max = Math.min(hw.length, vw.length);
  while (k < max) {
    if (normalizeDupWord(hw[k]!) !== normalizeDupWord(vw[k]!)) break;
    k++;
  }
  return k;
}

/**
 * When the first beat's `voiceover` repeats the hook verbatim or opens with the same line,
 * {@link joinNarrationParts} cannot dedupe (e.g. hook ends with "…" and VO continues).
 * Strip that overlap so TTS and {@link shotDurationsFromVoicePartition} stay aligned.
 */
export function stripLeadingHookFromFirstVoiceover(hook: string, firstVoiceover: string): string {
  const h = hook.trim();
  let v = firstVoiceover.trim();
  if (!v) return '';
  if (!h) return v;
  if (v.toLowerCase() === h.toLowerCase()) return '';
  const hl = h.toLowerCase();
  const vl = v.toLowerCase();
  if (vl.startsWith(hl) && v.length >= h.length) {
    let rest = v.slice(h.length).trim();
    rest = rest.replace(/^[,;:\-–—\.\s]+/, '').trim();
    return rest.length ? rest : '';
  }

  const hw = h.split(/\s+/).filter(Boolean);
  const dupWords = leadingHookDuplicateWordCount(h, v);
  /** ≥3 words, or entire hook matched word-for-word at VO start — avoids stripping generic two-word stems. */
  const allowWordStrip = dupWords >= 3 || (hw.length > 0 && dupWords === hw.length);
  if (allowWordStrip && dupWords > 0) {
    const cut = charIndexAfterLeadingWords(v, dupWords);
    let rest = v.slice(cut).trim();
    rest = rest.replace(/^[,;:\-–—\.\s]+/, '').trim();
    if (rest.length > 0) return rest;
    return '';
  }
  return v;
}

/**
 * Minimum resolved shots so `voiceSeconds` can be split with no clip longer than
 * `secondsPerShotCeiling` (typically {@link personalStitcher.perShotSecondsMaxFromAverageClip}
 * or the short-form pacing cap `avgClip * 1.32`).
 */
export function minShotsForVoiceAndAvgClip(
  voiceSeconds: number,
  secondsPerShotCeiling: number,
): number {
  if (!Number.isFinite(voiceSeconds) || voiceSeconds <= 0.25) return 1;
  const cap = Math.max(0.55, Math.min(22, secondsPerShotCeiling));
  return Math.max(1, Math.ceil(voiceSeconds / (cap * 0.985)));
}

/**
 * After one full-narration TTS pass, derive per-shot **visual** durations so cuts track
 * how long each spoken segment effectively is (hook + per-shot VO + outro), instead of
 * trusting storyboard `durationSeconds`, which rarely matches real audio.
 *
 * Hook / outro weight is folded into the first / last shot when they are not duplicates
 * of that shot's `voiceover` (same rule as {@link joinNarrationParts}).
 */
export function shotDurationsFromVoicePartition(args: {
  /** Measured or estimated narration length (seconds). */
  voiceSeconds: number;
  hook: string;
  outro: string;
  shotVoiceovers: readonly string[];
  minPerShot?: number;
  maxPerShot?: number;
  /**
   * Optional storyboard `durationSeconds` per shot — blended after the VO text split so
   * pacing follows the operator's average-clip hint while still summing to `voiceSeconds`.
   */
  anchorDurations?: readonly number[];
  /** How much to pull toward `anchorDurations` after the VO split (0 = ignore anchors). Default 0.38. */
  anchorBlend?: number;
}): number[] {
  const n = args.shotVoiceovers.length;
  if (n === 0) return [];

  const minE = args.minPerShot ?? 1.15;
  const baseMax = args.maxPerShot ?? 8;

  let total = args.voiceSeconds;
  if (!Number.isFinite(total) || total <= 0) return [];

  /** Per-shot ceiling from caller (e.g. dashboard avg clip × ~1.3). Must allow sum ≥ voiceSeconds when shot count is sufficient. */
  const maxE = Math.min(22, baseMax);

  const floor = Math.max(0.35, Math.min(minE, total / n));

  const h = (args.hook ?? '').trim();
  const o = (args.outro ?? '').trim();
  const vos = args.shotVoiceovers.map((v) => (v ?? '').trim());

  const baseWeight = (text: string) => Math.max(4, text.trim().length);
  /** Extra hook/outro text must not dominate partition — long CTAs were inflating the last shot. */
  const cappedFoldWeight = (text: string, cap: number) =>
    Math.max(4, Math.min(cap, text.trim().length));

  const weights = vos.map((v) => baseWeight(v));
  if (h.length > 0) {
    const first = vos[0] ?? '';
    if (!first || first.toLowerCase() !== h.toLowerCase()) {
      weights[0] = (weights[0] ?? 0) + cappedFoldWeight(h, 96);
    }
  }
  if (o.length > 0 && n > 0) {
    const last = vos[n - 1] ?? '';
    if (!last || last.toLowerCase() !== o.toLowerCase()) {
      weights[n - 1]! += cappedFoldWeight(o, 96);
    }
  }

  const sumW = weights.reduce((a, b) => a + b, 0);
  let d = weights.map((w) => (sumW > 0 ? (w / sumW) * total : total / n));

  for (let round = 0; round < 40; round++) {
    d = d.map((x) => Math.max(floor, Math.min(maxE, x)));
    const s = d.reduce((a, b) => a + b, 0);
    const diff = total - s;
    if (Math.abs(diff) < 0.02) break;

    if (diff > 0) {
      const headroom = d.map((x) => maxE - x);
      const hrSum = headroom.reduce((a, b) => a + b, 0);
      if (hrSum < 1e-6) break;
      d = d.map((x, i) => x + (headroom[i]! / hrSum) * diff);
    } else {
      const slack = d.map((x) => x - floor);
      const slSum = slack.reduce((a, b) => a + b, 0);
      if (slSum < 1e-6) break;
      d = d.map((x, i) => x + (slack[i]! / slSum) * diff);
    }
  }

  if (args.anchorDurations && args.anchorDurations.length === n) {
    const bRaw = args.anchorBlend ?? 0.38;
    const b = Number.isFinite(bRaw) ? Math.min(0.52, Math.max(0, bRaw)) : 0.38;
    if (b > 1e-6) {
      const anchors = args.anchorDurations.map((x) => {
        const t = typeof x === 'number' && Number.isFinite(x) && x > 0.2 ? x : total / n;
        return Math.max(floor, Math.min(maxE, t));
      });
      d = d.map((di, i) => (1 - b) * di + b * anchors[i]!);
      for (let round = 0; round < 22; round++) {
        let s = d.reduce((a, x) => a + x, 0);
        if (s <= 0) break;
        d = d.map((x) => (x / s) * total);
        d = d.map((x) => Math.max(floor, Math.min(maxE, x)));
        s = d.reduce((a, x) => a + x, 0);
        const diff = total - s;
        if (Math.abs(diff) < 0.02) break;
        if (diff > 0) {
          const headroom = d.map((x) => maxE - x);
          const hrSum = headroom.reduce((a, x) => a + x, 0);
          if (hrSum < 1e-6) break;
          d = d.map((x, i) => x + (headroom[i]! / hrSum) * diff);
        } else {
          const slack = d.map((x) => x - floor);
          const slSum = slack.reduce((a, x) => a + x, 0);
          if (slSum < 1e-6) break;
          d = d.map((x, i) => x + (slack[i]! / slSum) * diff);
        }
      }
    }
  }

  d = d.map((x) => Math.round(x * 20) / 20);
  let drift = total - d.reduce((a, b) => a + b, 0);
  // Rounding + caps leave small remainder; spread across several shots instead of
  // dumping it all on the longest (often the last), which caused one still to hold.
  if (Math.abs(drift) > 0.06 && d.length > 0) {
    const order = [...d.keys()].sort((a, b) => d[b]! - d[a]!);
    let guard = 0;
    while (Math.abs(drift) > 0.04 && guard++ < 36) {
      let progressed = false;
      for (const idx of order) {
        if (Math.abs(drift) < 0.03) break;
        if (drift > 0) {
          const room = maxE - d[idx]!;
          if (room < 0.02) continue;
          const delta = Math.min(room, drift * 0.42);
          d[idx] = Math.max(floor, Math.min(maxE, Math.round((d[idx]! + delta) * 20) / 20));
        } else {
          const room = d[idx]! - floor;
          if (room < 0.02) continue;
          const take = Math.min(room, Math.abs(drift) * 0.42);
          d[idx] = Math.max(floor, Math.min(maxE, Math.round((d[idx]! - take) * 20) / 20));
        }
        drift = total - d.reduce((a, b) => a + b, 0);
        progressed = true;
      }
      if (!progressed) break;
    }
  }

  const sumFinal = d.reduce((a, b) => a + b, 0);
  if (Math.abs(sumFinal - total) > 0.35 && d.length > 0) {
    const headroom = d.map((x) => maxE - x);
    const hrSum = headroom.reduce((a, b) => a + b, 0);
    const miss = total - sumFinal;
    if (miss > 0.2 && hrSum > 1e-3) {
      d = d.map((x, i) =>
        Math.max(floor, Math.min(maxE, Math.round((x + (headroom[i]! / hrSum) * miss) * 20) / 20)),
      );
    }
  }

  const minPer = args.minPerShot ?? 1.15;
  let longestIdx = 0;
  for (let i = 1; i < d.length; i++) {
    if (d[i]! > d[longestIdx]!) longestIdx = i;
  }
  const sumD = d.reduce((a, b) => a + b, 0);
  logVisualPacing('voice-partition', 'shotDurationsFromVoicePartition', {
    voiceSeconds: total,
    n,
    minPerShot: minPer,
    maxPerShot: maxE,
    floor,
    anchorBlend: args.anchorBlend,
    charLens: vos.map((t) => t.length),
    weights,
    durations: d.map((x) => Math.round(x * 100) / 100),
    sumDurations: Math.round(sumD * 100) / 100,
    sumVsVoice: Math.round((sumD - total) * 100) / 100,
    longestIdx,
    longestSeconds: Math.round(d[longestIdx]! * 100) / 100,
    pctOnLongest: sumD > 0 ? Math.round((10000 * d[longestIdx]!) / sumD) / 100 : null,
  });

  return d;
}

/**
 * Measures the actual duration of an MP3 buffer using ffmpeg. Falls
 * through when ffmpeg isn't on PATH. Accurate to the frame — beats
 * the WPM estimate for any non-trivial narration.
 */
async function probeAudioDuration(buffer: Buffer): Promise<number | null> {
  const ffmpegBin = await resolveFfmpegBin();
  if (!ffmpegBin) return null;
  const workDir = path.join(tmpdir(), `vo-probe-${randomUUID()}`);
  try {
    mkdirSync(workDir, { recursive: true });
    const tmpFile = path.join(workDir, 'vo.mp3');
    writeFileSync(tmpFile, buffer);
    const stderr = await new Promise<string>((resolve, reject) => {
      const p = spawn(ffmpegBin, ['-hide_banner', '-i', tmpFile]);
      let out = '';
      p.stderr.on('data', (b) => (out += b.toString()));
      p.on('close', () => resolve(out));
      p.on('error', reject);
    });
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
    const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    const s = Number(m[3]);
    return h * 3600 + mm * 60 + s;
  } catch {
    return null;
  }
}

/**
 * Split long narration into chunks no longer than `maxChars`, breaking
 * on sentence boundaries (.!?) when possible to keep each chunk a
 * complete thought. Falls back to hard-splitting on whitespace if a
 * single sentence exceeds the cap.
 */
function chunkBySentence(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g) ?? [text];
  let current = '';
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > maxChars) {
      // Single sentence is already over the cap — hard-split on words.
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      let remaining = s;
      while (remaining.length > maxChars) {
        const idx = remaining.lastIndexOf(' ', maxChars);
        const cut = idx > maxChars * 0.5 ? idx : maxChars;
        chunks.push(remaining.slice(0, cut).trim());
        remaining = remaining.slice(cut).trim();
      }
      if (remaining) chunks.push(remaining);
      continue;
    }
    if (current.length + s.length + 1 > maxChars) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

export const voiceFeatures = {
  get elevenlabs() { return Boolean(process.env.ELEVENLABS_API_KEY); },
  get openai() { return Boolean(process.env.OPENAI_API_KEY); },
};

/**
 * Concatenate an ordered list of MP3 buffers into a single playable MP3.
 *
 * - When ffmpeg is available we use the `concat` demuxer with `-c copy`
 *   which re-writes one clean header and avoids mid-stream ID3 tags that
 *   trip some mobile players.
 * - Otherwise we fall back to Buffer.concat — fine for most desktop
 *   players because each MPEG frame is self-synchronising.
 */
async function concatMp3Buffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw new Error('concatMp3Buffers: empty input');
  if (buffers.length === 1) return buffers[0]!;
  const ffmpegBin = await resolveFfmpegBin();
  if (!ffmpegBin) return Buffer.concat(buffers);

  const workDir = path.join(tmpdir(), `vo-concat-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });
  const inputs = buffers.map((buf, i) => {
    const file = path.join(workDir, `vo-${i}.mp3`);
    writeFileSync(file, buf);
    return file;
  });
  const listFile = path.join(workDir, 'list.txt');
  writeFileSync(
    listFile,
    inputs
      .map((p) => `file '${path.resolve(p).replace(/\\/g, '/').replace(/'/g, `'\\''`)}'`)
      .join('\n'),
  );
  const outFile = path.join(workDir, 'out.mp3');

  try {
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ffmpegBin, [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c', 'copy',
        '-y', outFile,
      ]);
      let stderr = '';
      p.stderr.on('data', (b) => (stderr += b.toString()));
      p.on('error', reject);
      p.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg concat exit ${code}: ${stderr.slice(0, 200)}`));
      });
    });
    return readFileSync(outFile);
  } catch (e) {
    console.warn('[voice] ffmpeg concat failed, using naive Buffer.concat:', (e as Error).message);
    return Buffer.concat(buffers);
  } finally {
    for (const f of [...inputs, listFile, outFile]) {
      try {
        unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }
}
