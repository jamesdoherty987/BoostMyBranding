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
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { uploadFile } from './r2.js';

export interface SynthesizeArgs {
  text: string;
  /** Provider voice id. Provider-agnostic by passing 'default'. */
  voiceId?: string;
  /** ISO 639-1 hint for non-English providers that need it. */
  language?: string;
  /** Speed, 0.8–1.2. */
  speed?: number;
  /** Storage scope — goes into R2 path as `personal/{accountId}/voiceovers`. */
  accountId: string;
}

export interface SynthesizeResult {
  audioUrl: string;
  durationSeconds: number;
  provider: 'elevenlabs' | 'openai' | 'mock';
  costCents: number;
}

export async function synthesizeVoice(args: SynthesizeArgs): Promise<SynthesizeResult> {
  const text = args.text.trim();
  if (text.length < 1) throw new Error('Voiceover text is empty');

  // 1. ElevenLabs ---------------------------------------------------------
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      return await synthesizeElevenLabs(args, text);
    } catch (e) {
      console.warn('[voice] ElevenLabs failed, falling back:', (e as Error).message);
    }
  }

  // 2. OpenAI TTS ---------------------------------------------------------
  if (process.env.OPENAI_API_KEY) {
    try {
      return await synthesizeOpenAI(args, text);
    } catch (e) {
      console.warn('[voice] OpenAI TTS failed, falling back:', (e as Error).message);
    }
  }

  // 3. Mock ---------------------------------------------------------------
  return mockVoice(args, text);
}

/* ─── ElevenLabs ────────────────────────────────────────────────── */

const ELEVENLABS_CHUNK_CHARS = 3500;

async function synthesizeElevenLabs(
  args: SynthesizeArgs,
  text: string,
): Promise<SynthesizeResult> {
  // The voiceId param should be an ElevenLabs voice id. 'default'
  // falls back to Rachel (a widely licensed public voice).
  const voiceId =
    args.voiceId && args.voiceId !== 'default'
      ? args.voiceId
      : '21m00Tcm4TlvDq8ikWAM'; // Rachel

  // Chunk on sentence boundaries when we're over the per-request cap.
  const chunks = text.length > ELEVENLABS_CHUNK_CHARS
    ? chunkBySentence(text, ELEVENLABS_CHUNK_CHARS)
    : [text];

  const buffers: Buffer[] = [];
  // Use `previous_text` so adjacent chunks keep prosody coherent — this
  // is the official ElevenLabs recommendation for stitched long-form.
  let previousText: string | undefined;
  for (const chunk of chunks) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
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
          },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
    }
    buffers.push(Buffer.from(await res.arrayBuffer()));
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
  return {
    audioUrl: url,
    durationSeconds:
      measured ?? estimateDurationSeconds(text, args.speed ?? 1),
    provider: 'elevenlabs',
    costCents,
  };
}

/* ─── OpenAI TTS ────────────────────────────────────────────────── */

const OPENAI_TTS_CHUNK_CHARS = 3800;

async function synthesizeOpenAI(
  args: SynthesizeArgs,
  text: string,
): Promise<SynthesizeResult> {
  // 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'.
  // 'default' → nova (warm female narrator — good default for VO).
  const voice =
    args.voiceId && args.voiceId !== 'default' ? args.voiceId : 'nova';

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
 * Measures the actual duration of an MP3 buffer using ffmpeg. Falls
 * through when ffmpeg isn't on PATH. Accurate to the frame — beats
 * the WPM estimate for any non-trivial narration.
 */
async function probeAudioDuration(buffer: Buffer): Promise<number | null> {
  const ffmpegBin = await detectFfmpegForProbe();
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

async function detectFfmpegForProbe(): Promise<string | null> {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  return new Promise<string | null>((resolve) => {
    const p = spawn('which', ['ffmpeg']);
    let out = '';
    p.stdout.on('data', (b) => (out += b.toString()));
    p.on('close', () => {
      const trimmed = out.trim();
      resolve(trimmed && existsSync(trimmed) ? trimmed : null);
    });
    p.on('error', () => resolve(null));
  });
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
  const ffmpegBin = await detectFfmpegForProbe();
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
    inputs.map((p) => `file '${p.replace(/'/g, `'\\''`)}'`).join('\n'),
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
