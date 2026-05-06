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
import { getModel, type ModelOption } from './modelCatalog.js';

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


/* ═══════════════════════════════════════════════════════════════════ */
/* Inspiration-driven generation — explicit model selection.           */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Reference-guided image generation. Accepts one or more reference image
 * URLs plus a brief, and returns a new image that follows the reference
 * style/composition.
 *
 * Routing:
 *   - Flux Kontext Max (fal)   → uses the first reference as `image_url`
 *   - Nano Banana 2 Pro (Gemini) → not yet wired (requires GEMINI_API_KEY)
 *   - Any other model without reference support → falls back to plain
 *     `generateImage` with the references ignored; caller is warned.
 *
 * Returns the generated image URL.
 */
export async function generateImageWithReference(args: {
  modelId: string;
  prompt: string;
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9';
  referenceUrls: string[];
}): Promise<{ imageUrl: string; usedReferences: number; fromMock: boolean }> {
  const model = getModel(args.modelId);
  if (!model) throw new Error(`Unknown model: ${args.modelId}`);
  if (model.mediaType !== 'image') throw new Error(`${model.displayName} is not an image model`);

  if (!features.fal && model.provider === 'fal') {
    const seed = encodeURIComponent(args.prompt.slice(0, 24).replace(/\s+/g, '-') || 'mock');
    const [w, h] = aspectSize(args.aspectRatio);
    return {
      imageUrl: `https://picsum.photos/seed/${seed}/${w}/${h}`,
      usedReferences: 0,
      fromMock: true,
    };
  }

  // Gemini / Vertex models aren't wired here yet — mock deterministically.
  if (model.provider !== 'fal') {
    const seed = encodeURIComponent(args.prompt.slice(0, 24).replace(/\s+/g, '-') || 'mock');
    const [w, h] = aspectSize(args.aspectRatio);
    return {
      imageUrl: `https://picsum.photos/seed/${seed}-${model.provider}/${w}/${h}`,
      usedReferences: 0,
      fromMock: true,
    };
  }

  const refs = args.referenceUrls.slice(0, Math.max(1, model.maxReferenceCount));

  // Flux Kontext — single reference + prompt.
  if (model.id === 'flux-kontext-max') {
    if (refs.length === 0) {
      // Kontext needs a reference; caller should have either supplied one or
      // picked a non-reference model. Fall back to generation without ref.
      const out = await generateImage(args.prompt, args.aspectRatio);
      return { imageUrl: out, usedReferences: 0, fromMock: false };
    }
    const result = await fal.subscribe(model.endpoint, {
      input: { prompt: args.prompt, image_url: refs[0]! },
      logs: false,
    });
    const out = (result.data as any)?.images?.[0]?.url;
    if (!out) throw new Error(`${model.displayName} did not return an image URL`);
    return { imageUrl: out as string, usedReferences: refs.length, fromMock: false };
  }

  // Plain Flux models (no reference) — ignore refs, forward prompt.
  const input = fluxInputFor(model, args.prompt, args.aspectRatio);
  const result = await fal.subscribe(model.endpoint, { input, logs: false });
  const out = (result.data as any)?.images?.[0]?.url;
  if (!out) throw new Error(`${model.displayName} did not return an image URL`);
  return { imageUrl: out as string, usedReferences: 0, fromMock: false };
}

function fluxInputFor(model: ModelOption, prompt: string, ar: string): Record<string, unknown> {
  if (model.id === 'flux-pro-ultra') return { prompt, aspect_ratio: ar };
  return {
    prompt,
    image_size: arToSize(ar),
    num_inference_steps: model.id === 'flux-schnell' ? 4 : 28,
  };
}

/**
 * Image-to-video with explicit model selection. Unlike the legacy
 * `animateImage`, this does not cascade through a model list — the
 * caller has explicitly picked a model and is showing its price to the
 * user. We just call it.
 *
 * Returns the video URL plus the clip duration actually rendered.
 */
export async function generateVideoFromImage(args: {
  modelId: string;
  imageUrl: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: '9:16' | '1:1' | '16:9';
}): Promise<{ videoUrl: string; durationSeconds: number; fromMock: boolean }> {
  const model = getModel(args.modelId);
  if (!model) throw new Error(`Unknown model: ${args.modelId}`);
  if (model.mediaType !== 'video') throw new Error(`${model.displayName} is not a video model`);

  const duration = clampVideoDuration(args.durationSeconds, model);

  if (!features.fal && model.provider === 'fal') {
    return { videoUrl: args.imageUrl, durationSeconds: duration, fromMock: true };
  }
  if (model.provider !== 'fal') {
    return { videoUrl: args.imageUrl, durationSeconds: duration, fromMock: true };
  }

  const input = videoInputFor(model, {
    imageUrl: args.imageUrl,
    prompt: args.prompt,
    durationSeconds: duration,
    aspectRatio: args.aspectRatio,
  });

  const result = await fal.subscribe(model.endpoint, { input, logs: false });
  const out =
    (result.data as any)?.video?.url ??
    (result.data as any)?.videos?.[0]?.url ??
    (result.data as any)?.url;
  if (!out) throw new Error(`${model.displayName} did not return a video URL`);
  return { videoUrl: out as string, durationSeconds: duration, fromMock: false };
}

function clampVideoDuration(requested: number, model: ModelOption): number {
  const cap = model.maxDurationSeconds ?? 10;
  const clamped = Math.max(2, Math.min(cap, Math.round(requested)));
  // Some providers only accept discrete durations. Snap to the closest
  // supported value so we don't send rejected requests.
  if (model.id.startsWith('kling-')) {
    // Kling family accepts 5 or 10.
    return clamped >= 8 ? 10 : 5;
  }
  if (model.id === 'hailuo-02-standard') {
    // Hailuo 02 standard is a fixed 6s.
    return 6;
  }
  if (model.id === 'stable-video') {
    // SVD returns ~4s regardless of request.
    return Math.min(4, clamped);
  }
  return clamped;
}

function videoInputFor(
  model: ModelOption,
  args: {
    imageUrl: string;
    prompt: string;
    durationSeconds: number;
    aspectRatio: '9:16' | '1:1' | '16:9';
  },
): Record<string, unknown> {
  // Kling family — all accept the same shape.
  if (model.id.startsWith('kling-')) {
    return {
      prompt: args.prompt,
      image_url: args.imageUrl,
      duration: String(args.durationSeconds),
      aspect_ratio: args.aspectRatio,
    };
  }
  // MiniMax Hailuo 02 — standard tier is fixed at 6 seconds.
  if (model.id === 'hailuo-02-standard') {
    return {
      prompt: args.prompt,
      image_url: args.imageUrl,
      prompt_optimizer: true,
    };
  }
  // Seedance Pro — minimal input. The model uses sensible defaults for
  // resolution and aspect ratio based on the seed image.
  if (model.id === 'seedance-1-pro') {
    return {
      prompt: args.prompt,
      image_url: args.imageUrl,
    };
  }
  // Stable Video Diffusion — motion bucket driven.
  if (model.id === 'stable-video') {
    return {
      image_url: args.imageUrl,
      motion_bucket_id: 127,
      cond_aug: 0.02,
    };
  }
  // Safe default — prompt + image.
  return {
    prompt: args.prompt,
    image_url: args.imageUrl,
  };
}
