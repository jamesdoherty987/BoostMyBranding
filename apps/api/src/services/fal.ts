/**
 * fal.ai wrapper for Flux Kontext Max (editing) and Flux 2 Pro (generation).
 * Falls back to deterministic Picsum URLs in dev mode.
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

export async function generateImage(prompt: string, aspectRatio = '1:1'): Promise<string> {
  if (!features.fal) {
    const seed = encodeURIComponent(prompt.slice(0, 24).replace(/\s+/g, '-'));
    const [w, h] = aspectSize(aspectRatio);
    return `https://picsum.photos/seed/${seed}/${w}/${h}`;
  }
  const result = await fal.subscribe('fal-ai/flux-pro/v1.1-ultra', {
    input: { prompt, aspect_ratio: aspectRatio },
    logs: false,
  });
  const out = (result.data as any)?.images?.[0]?.url;
  if (!out) throw new Error('fal.ai did not return a generated image URL');
  return out as string;
}

function aspectSize(ratio: string): [number, number] {
  switch (ratio) {
    case '9:16':
      return [720, 1280];
    case '16:9':
      return [1280, 720];
    case '4:5':
      return [1024, 1280];
    default:
      return [1024, 1024];
  }
}
