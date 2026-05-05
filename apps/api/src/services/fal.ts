/**
 * fal.ai wrapper for image generation and editing.
 *
 * Model priority (generation):
 *   1. flux-pro/v1.1-ultra  — best quality, requires paid plan
 *   2. flux/dev             — good quality, free tier
 *   3. flux/schnell         — fast, lower quality, free tier
 *
 * If the primary model returns 403 (Forbidden — plan limit), we
 * automatically fall back to the next model. This way the feature
 * works on free fal.ai accounts, just at lower quality.
 *
 * Falls back to deterministic Picsum URLs when FAL_KEY is not set.
 */

import { fal } from '@fal-ai/client';
import { env, features } from '../env.js';

if (features.fal) fal.config({ credentials: env.FAL_KEY });

export async function enhanceImage(imageUrl: string, editPrompt: string): Promise<string> {
  if (!features.fal) return `${imageUrl}?enhanced=1`;

  const result = await fal.subscribe('fal-ai/flux-pro/kontext/max', {
    input: { prompt: editPrompt, image_url: imageUrl },
    logs: false,
  });
  const out = (result.data as any)?.images?.[0]?.url;
  if (!out) throw new Error('fal.ai did not return an enhanced image URL');
  return out as string;
}

/**
 * Generation models in priority order. We try the best first and fall
 * back on 403/payment errors. Each entry has the fal endpoint ID and
 * the input shape it expects (they differ slightly between models).
 */
const GEN_MODELS = [
  {
    id: 'fal-ai/flux-pro/v1.1-ultra',
    input: (prompt: string, ar: string) => ({ prompt, aspect_ratio: ar }),
  },
  {
    id: 'fal-ai/flux/dev',
    input: (prompt: string, ar: string) => ({
      prompt,
      image_size: arToSize(ar),
      num_inference_steps: 28,
    }),
  },
  {
    id: 'fal-ai/flux/schnell',
    input: (prompt: string, ar: string) => ({
      prompt,
      image_size: arToSize(ar),
      num_inference_steps: 4,
    }),
  },
] as const;

export async function generateImage(prompt: string, aspectRatio = '1:1'): Promise<string> {
  if (!features.fal) {
    const seed = encodeURIComponent(prompt.slice(0, 24).replace(/\s+/g, '-'));
    const [w, h] = aspectSize(aspectRatio);
    return `https://picsum.photos/seed/${seed}/${w}/${h}`;
  }

  let lastError: Error | null = null;
  for (const model of GEN_MODELS) {
    try {
      const result = await fal.subscribe(model.id, {
        input: model.input(prompt, aspectRatio),
        logs: false,
      });
      const out = (result.data as any)?.images?.[0]?.url;
      if (out) return out as string;
    } catch (e) {
      lastError = e as Error;
      const msg = (e as Error).message ?? '';
      // 403 / Forbidden / payment required → try next model
      if (/forbidden|403|payment|quota|limit/i.test(msg)) {
        console.warn(
          `[fal] ${model.id} returned ${msg.slice(0, 80)}, falling back…`,
        );
        continue;
      }
      // Any other error → don't retry, surface it
      throw e;
    }
  }
  throw lastError ?? new Error('All fal.ai models failed');
}

/** Map aspect ratio string to a {width, height} object for flux/dev + schnell. */
function arToSize(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case '9:16':
      return { width: 720, height: 1280 };
    case '16:9':
      return { width: 1280, height: 720 };
    case '4:5':
      return { width: 1024, height: 1280 };
    default:
      return { width: 1024, height: 1024 };
  }
}

function aspectSize(ratio: string): [number, number] {
  const s = arToSize(ratio);
  return [s.width, s.height];
}

/**
 * Image-to-video: turn a still photo into a 4–6s animated clip. Used by
 * MediaStory when the agency wants motion clips without filming anything.
 *
 * Tries Kling 1.6 first (best motion quality) and falls back to Stable
 * Video Diffusion when Kling rate-limits or a plan doesn't allow it. If
 * FAL_KEY is missing we return the source image URL unchanged so the
 * caller can degrade gracefully — MediaStory already renders photos with
 * a Ken Burns zoom, so a "failed" motion clip still looks intentional.
 */
export async function animateImage(
  imageUrl: string,
  prompt: string,
  opts: { duration?: 4 | 5 | 6; aspectRatio?: '9:16' | '16:9' | '1:1' } = {},
): Promise<{ videoUrl: string; durationSeconds: number; fromMock: boolean }> {
  const duration = opts.duration ?? 5;
  const aspectRatio = opts.aspectRatio ?? '9:16';

  if (!features.fal) {
    return { videoUrl: imageUrl, durationSeconds: duration, fromMock: true };
  }

  const MODELS = [
    {
      id: 'fal-ai/kling-video/v1.6/standard/image-to-video',
      input: () => ({
        prompt,
        image_url: imageUrl,
        duration: String(duration),
        aspect_ratio: aspectRatio,
      }),
    },
    {
      id: 'fal-ai/stable-video',
      input: () => ({
        image_url: imageUrl,
        motion_bucket_id: 127,
        cond_aug: 0.02,
      }),
    },
  ] as const;

  let lastError: Error | null = null;
  for (const model of MODELS) {
    try {
      const result = await fal.subscribe(model.id, {
        input: model.input(),
        logs: false,
      });
      const out =
        (result.data as any)?.video?.url ??
        (result.data as any)?.videos?.[0]?.url ??
        (result.data as any)?.url;
      if (out) return { videoUrl: out as string, durationSeconds: duration, fromMock: false };
    } catch (e) {
      lastError = e as Error;
      const msg = (e as Error).message ?? '';
      if (/forbidden|403|payment|quota|limit|rate/i.test(msg)) {
        console.warn(`[fal] ${model.id} i2v fell back: ${msg.slice(0, 80)}`);
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new Error('All fal.ai image-to-video models failed');
}
