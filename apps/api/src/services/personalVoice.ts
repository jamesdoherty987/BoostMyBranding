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
 */

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
        text,
        model_id: 'eleven_turbo_v2_5',
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
  const buffer = Buffer.from(await res.arrayBuffer());
  const { url } = await uploadFile(
    `personal/${args.accountId}/voiceovers`,
    buffer,
    `vo-${Date.now()}.mp3`,
    'audio/mpeg',
  );
  // ElevenLabs pricing: ~$0.30 per 1k chars on Creator, call it ~$0.15/1k chars amortized.
  const costCents = Math.round((text.length / 1000) * 15);
  return {
    audioUrl: url,
    durationSeconds: estimateDurationSeconds(text, args.speed ?? 1),
    provider: 'elevenlabs',
    costCents,
  };
}

/* ─── OpenAI TTS ────────────────────────────────────────────────── */

async function synthesizeOpenAI(
  args: SynthesizeArgs,
  text: string,
): Promise<SynthesizeResult> {
  // 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'.
  // 'default' → nova (warm female narrator — good default for VO).
  const voice =
    args.voiceId && args.voiceId !== 'default' ? args.voiceId : 'nova';
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      voice,
      input: text,
      response_format: 'mp3',
      speed: args.speed ?? 1,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI TTS ${res.status}: ${body.slice(0, 200)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const { url } = await uploadFile(
    `personal/${args.accountId}/voiceovers`,
    buffer,
    `vo-${Date.now()}.mp3`,
    'audio/mpeg',
  );
  // tts-1-hd: $30 / 1M chars = 3c per 1k chars.
  const costCents = Math.round((text.length / 1000) * 3);
  return {
    audioUrl: url,
    durationSeconds: estimateDurationSeconds(text, args.speed ?? 1),
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
 * Rough English narration: ~155 wpm → ~2.58 wps. Adjust for speed.
 * We use this to set the Remotion composition length pre-render
 * before the real audio arrives.
 */
export function estimateDurationSeconds(text: string, speed = 1): number {
  const words = text.trim().split(/\s+/).length;
  const base = words / 2.58;
  return Math.max(2, Math.round(base / speed));
}

export const voiceFeatures = {
  get elevenlabs() { return Boolean(process.env.ELEVENLABS_API_KEY); },
  get openai() { return Boolean(process.env.OPENAI_API_KEY); },
};
