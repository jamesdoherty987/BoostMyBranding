/**
 * Model catalog for inspiration-driven generation.
 *
 * Each entry declares:
 *   - id                   stable key used by the generation runner
 *   - displayName          human-readable label shown in the UI
 *   - provider             which underlying API to call (fal.ai, gemini, vertex)
 *   - endpoint             provider-specific endpoint id (fal path, etc.)
 *   - mediaType            'image' | 'video'
 *   - supportsReference    true if the model can accept a reference image
 *   - maxReferenceCount    upper bound on reference images we can pass
 *   - maxDurationSeconds   video length cap (undefined for images)
 *   - pricePerUnitCents    price in USD cents per unit
 *   - unit                 'second' for video, 'image' for image models
 *   - recommendation       'quality' | 'speed' | 'price' | null
 *   - supportedAspectRatios
 *   - available            whether the current deployment can run it
 *   - notes                free-form human hint shown in the picker
 *
 * Pricing is an approximation of public fal.ai / Gemini / Vertex pricing
 * at the time of writing. The UI displays these so the agency can trade
 * off quality vs. speed vs. cost before committing. Treat them as
 * indicative — actual billing comes from the provider.
 */

import { features } from '../env.js';

export type MediaType = 'image' | 'video';
export type Provider = 'fal' | 'gemini' | 'vertex';
export type Recommendation = 'quality' | 'speed' | 'price' | null;

export interface ModelOption {
  id: string;
  displayName: string;
  provider: Provider;
  endpoint: string;
  mediaType: MediaType;
  supportsReference: boolean;
  /** How many reference images the provider accepts in one call. 0 = text-only. */
  maxReferenceCount: number;
  /** Video cap. Undefined for image models. */
  maxDurationSeconds?: number;
  /** Price quoted per `unit`. */
  pricePerUnitCents: number;
  unit: 'second' | 'image';
  recommendation: Recommendation;
  supportedAspectRatios: Array<'9:16' | '1:1' | '16:9' | '4:5'>;
  /**
   * Whether this model is actually callable in the current deployment.
   * A Gemini model is only available if GEMINI_API_KEY is set; a Vertex
   * model needs a GCP credential. fal.ai models just need FAL_KEY.
   */
  available: boolean;
  notes?: string;
}

/**
 * Static catalog. Availability is computed at module load from feature
 * flags, so a redeploy with new creds is all it takes to enable a
 * previously greyed-out option.
 */
export const MODEL_CATALOG: ModelOption[] = [
  // ── VIDEO — 2026 FRONTIER ───────────────────────────────────────
  // These are the "headline" models most teams want. Kept on top of
  // the catalog so the picker's default selection lands here.
  {
    id: 'veo-3.1',
    displayName: 'Google Veo 3.1',
    provider: 'vertex',
    endpoint: 'veo-3.1',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 3,
    maxDurationSeconds: 8,
    pricePerUnitCents: 40,
    unit: 'second',
    recommendation: 'quality',
    supportedAspectRatios: ['9:16', '16:9'],
    // Vertex credentials not wired yet — picker shows as locked.
    available: false,
    notes: 'Up to 4K and NATIVE audio in one pass. Best for hero shots and commercial-grade ads. Requires Vertex AI credentials.',
  },
  {
    id: 'sora-2-pro',
    displayName: 'OpenAI Sora 2 Pro',
    provider: 'fal',
    endpoint: 'fal-ai/openai/sora-2/pro',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 2,
    maxDurationSeconds: 12,
    pricePerUnitCents: 50,
    unit: 'second',
    recommendation: null,
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    // fal.ai access to Sora 2 is gated per-account; leaving locked so the
    // picker doesn't promise what the workspace can't deliver.
    available: false,
    notes: 'Strongest narrative short-form in 2026. Great for multi-shot stories and reactions. Access gated on fal.ai.',
  },
  {
    id: 'kling-3-pro',
    displayName: 'Kling 3 Pro',
    provider: 'fal',
    endpoint: 'fal-ai/kling-video/v3/pro/image-to-video',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 10,
    pricePerUnitCents: 12,
    unit: 'second',
    recommendation: 'quality',
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: '2026 Kling. Strong long B-roll, realistic on-camera people. Default choice for everyday marketing on fal.ai.',
  },
  {
    id: 'seedance-2-pro',
    displayName: 'ByteDance Seedance 2.0 Pro',
    provider: 'fal',
    endpoint: 'fal-ai/bytedance/seedance/v2/pro/image-to-video',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 10,
    pricePerUnitCents: 8,
    unit: 'second',
    recommendation: 'price',
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: 'Seedance 2.0 — cheapest frontier-tier per second. Solid for UGC demos; physics not as strong as Veo/Kling.',
  },
  {
    id: 'runway-gen-4.5',
    displayName: 'Runway Gen-4.5',
    provider: 'fal',
    endpoint: 'runway/gen-4.5',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 2,
    maxDurationSeconds: 10,
    pricePerUnitCents: 20,
    unit: 'second',
    recommendation: null,
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: false,
    notes: 'Best temporal consistency — characters stay on-model across the whole shot. Requires RUNWAY_API_KEY.',
  },
  {
    id: 'hailuo-2-3',
    displayName: 'MiniMax Hailuo 2.3',
    provider: 'fal',
    endpoint: 'fal-ai/minimax/hailuo-02/pro/image-to-video',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 6,
    pricePerUnitCents: 7,
    unit: 'second',
    recommendation: 'speed',
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: 'Hailuo 2.3 — fast and fixed-priced. Natural physics, 6s clips. Ideal for rapid A/B generation.',
  },

  // ── VIDEO — previous generations ────────────────────────────────
  // Kept so existing workflows that pinned these IDs keep working. New
  // work should default to the 2026 frontier block above.
  {
    id: 'kling-2.1-pro',
    displayName: 'Kling 2.1 Pro',
    provider: 'fal',
    endpoint: 'fal-ai/kling-video/v2.1/pro/image-to-video',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 10,
    pricePerUnitCents: 9,
    unit: 'second',
    recommendation: 'quality',
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: 'Cinematic motion, excellent prompt adherence. Best overall video quality on fal.ai.',
  },
  {
    id: 'kling-2.1-standard',
    displayName: 'Kling 2.1 Standard',
    provider: 'fal',
    endpoint: 'fal-ai/kling-video/v2.1/standard/image-to-video',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 10,
    pricePerUnitCents: 5,
    unit: 'second',
    recommendation: null,
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: 'Balanced quality and cost. Good default when you want Kling motion without the Pro price.',
  },
  {
    id: 'kling-1.6-standard',
    displayName: 'Kling 1.6 Standard',
    provider: 'fal',
    endpoint: 'fal-ai/kling-video/v1.6/standard/image-to-video',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 10,
    pricePerUnitCents: 4,
    unit: 'second',
    recommendation: null,
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: 'Older Kling. Cheap fallback; motion less crisp than 2.1.',
  },
  {
    id: 'hailuo-02-standard',
    displayName: 'MiniMax Hailuo 02 Standard',
    provider: 'fal',
    endpoint: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 6,
    pricePerUnitCents: 5,
    unit: 'second',
    recommendation: 'speed',
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: 'Fast renders, excellent physics. Great for everyday marketing clips. Max 6s.',
  },
  {
    id: 'seedance-1-pro',
    displayName: 'Seedance 1.0 Pro',
    provider: 'fal',
    endpoint: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 10,
    pricePerUnitCents: 15,
    unit: 'second',
    recommendation: null,
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: 'ByteDance Seedance Pro. 1080p, natural motion. Typically 5s clips.',
  },
  {
    id: 'stable-video',
    displayName: 'Stable Video Diffusion',
    provider: 'fal',
    endpoint: 'fal-ai/stable-video',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 4,
    pricePerUnitCents: 2,
    unit: 'second',
    recommendation: 'price',
    supportedAspectRatios: ['16:9', '1:1'],
    available: features.fal,
    notes: 'Cheapest option. Short clips, simple motion. Good for subtle parallax-style shots.',
  },

  // ── IMAGE ────────────────────────────────────────────────────────
  {
    id: 'flux-pro-ultra',
    displayName: 'Flux Pro v1.1 Ultra',
    provider: 'fal',
    endpoint: 'fal-ai/flux-pro/v1.1-ultra',
    mediaType: 'image',
    supportsReference: false,
    maxReferenceCount: 0,
    pricePerUnitCents: 6,
    unit: 'image',
    recommendation: 'quality',
    supportedAspectRatios: ['1:1', '9:16', '16:9'],
    available: features.fal,
    notes: 'Best text-to-image quality. No reference — uses only the analysis/brief prompt.',
  },
  {
    id: 'flux-kontext-max',
    displayName: 'Flux Kontext Max',
    provider: 'fal',
    endpoint: 'fal-ai/flux-pro/kontext/max',
    mediaType: 'image',
    supportsReference: true,
    maxReferenceCount: 1,
    pricePerUnitCents: 8,
    unit: 'image',
    recommendation: null,
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    available: features.fal,
    notes: 'Takes one reference image and edits it toward your brief. The go-to for style-guided generation.',
  },
  {
    id: 'flux-kontext-max-multi',
    displayName: 'Flux Kontext Max (Multi-reference)',
    provider: 'fal',
    endpoint: 'fal-ai/flux-pro/kontext/max/multi',
    mediaType: 'image',
    supportsReference: true,
    maxReferenceCount: 4,
    pricePerUnitCents: 10,
    unit: 'image',
    recommendation: null,
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    available: features.fal,
    notes: 'Kontext Max with up to 4 references in one call. Best for transferring both subject and style from multiple inspirations.',
  },
  {
    id: 'flux-dev',
    displayName: 'Flux Dev',
    provider: 'fal',
    endpoint: 'fal-ai/flux/dev',
    mediaType: 'image',
    supportsReference: false,
    maxReferenceCount: 0,
    pricePerUnitCents: 2,
    unit: 'image',
    recommendation: 'speed',
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    available: features.fal,
    notes: 'Fast and free-tier friendly. Lower detail than Pro.',
  },
  {
    id: 'flux-schnell',
    displayName: 'Flux Schnell',
    provider: 'fal',
    endpoint: 'fal-ai/flux/schnell',
    mediaType: 'image',
    supportsReference: false,
    maxReferenceCount: 0,
    pricePerUnitCents: 1,
    unit: 'image',
    recommendation: 'price',
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    available: features.fal,
    notes: 'Cheapest, fastest. Draft-quality — useful for rapid inspiration iteration.',
  },
  {
    id: 'nano-banana-2-pro',
    displayName: 'Nano Banana 2 Pro (Gemini 3.1 Flash Image)',
    provider: 'gemini',
    endpoint: 'gemini-3.1-flash-image',
    mediaType: 'image',
    supportsReference: true,
    maxReferenceCount: 14,
    pricePerUnitCents: 4,
    unit: 'image',
    recommendation: null,
    supportedAspectRatios: ['1:1', '4:5', '9:16', '16:9'],
    available: false, // requires GEMINI_API_KEY — not wired in this app yet
    notes: 'Google Gemini 3.1 Flash Image. Up to 14 reference images + "thinking" mode. Requires GEMINI_API_KEY.',
  },
  // ── TALKING-HEAD / AI UGC ─────────────────────────────────────────
  {
    id: 'veed-avatar-text',
    displayName: 'Veed Avatars (Talking Head)',
    provider: 'fal',
    endpoint: 'veed/avatars/text-to-video',
    mediaType: 'video',
    supportsReference: false,
    maxReferenceCount: 0,
    maxDurationSeconds: 90,
    pricePerUnitCents: 30,
    unit: 'second',
    recommendation: null,
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: 'Pre-built avatar reads your script to camera — perfect for TikTok/Reels UGC.',
  },
  {
    id: 'veed-lipsync',
    displayName: 'Veed Lipsync (Your Own Video)',
    provider: 'fal',
    endpoint: 'veed/lipsync',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 60,
    pricePerUnitCents: 25,
    unit: 'second',
    recommendation: null,
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: features.fal,
    notes: 'Upload your own on-camera footage; the model re-lipsyncs it to new audio. Use for real-person UGC.',
  },
  // Premium high-realism UGC / influencer models. Marked unavailable in
  // the default deployment — requires dedicated credentials. The picker
  // still shows them so the user knows what's possible after unlocking.
  {
    id: 'runway-act-one',
    displayName: 'Runway Act-One',
    provider: 'fal',
    endpoint: 'runway/act-one', // placeholder — actual integration is via Runway API
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 2,
    maxDurationSeconds: 30,
    pricePerUnitCents: 50,
    unit: 'second',
    recommendation: 'quality',
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: false,
    notes: 'Runway Act-One. Drives a static character photo with a source video of your own performance — best-in-class realism for product reviews. Requires RUNWAY_API_KEY.',
  },
  {
    id: 'omnihuman',
    displayName: 'ByteDance Omnihuman',
    provider: 'fal',
    endpoint: 'bytedance/omnihuman',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 1,
    maxDurationSeconds: 30,
    pricePerUnitCents: 45,
    unit: 'second',
    recommendation: 'quality',
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: false,
    notes: 'ByteDance Omnihuman. Photoreal full-body talking character from a single image + audio. Best for premium UGC / ad creative.',
  },
  {
    id: 'higgsfield-sora-2',
    displayName: 'Higgsfield Sora 2',
    provider: 'fal',
    endpoint: 'higgsfield/sora-2',
    mediaType: 'video',
    supportsReference: true,
    maxReferenceCount: 3,
    maxDurationSeconds: 12,
    pricePerUnitCents: 60,
    unit: 'second',
    recommendation: null,
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    available: false,
    notes: 'Higgsfield Sora 2 — text-to-video with native audio and strong prompt adherence. Requires HIGGSFIELD_API_KEY.',
  },
];

/**
 * Pick the default model for a given media type and recommendation axis.
 * Falls back to the first available model of that type if the preferred
 * recommendation isn't present.
 */
export function defaultModel(
  mediaType: MediaType,
  preferredAxis: Exclude<Recommendation, null> = 'quality',
): ModelOption | undefined {
  const available = MODEL_CATALOG.filter((m) => m.mediaType === mediaType && m.available);
  return (
    available.find((m) => m.recommendation === preferredAxis) ??
    available[0]
  );
}

export function getModel(id: string): ModelOption | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

/**
 * Snap a requested duration to what the provider actually accepts. Kept
 * in sync with `clampVideoDuration` in fal.ts so the cost estimate
 * never lies.
 */
export function snapVideoDuration(requested: number, model: ModelOption): number {
  const cap = model.maxDurationSeconds ?? 10;
  const clamped = Math.max(2, Math.min(cap, Math.round(requested)));
  if (model.id.startsWith('kling-')) return clamped >= 8 ? 10 : 5;
  if (model.id === 'hailuo-02-standard') return 6; // only discrete option ≤ 6s
  if (model.id === 'hailuo-2-3') return clamped >= 5 ? 6 : 4;
  if (model.id === 'seedance-2-pro') return clamped >= 8 ? 10 : 5;
  if (model.id === 'stable-video') return Math.min(4, clamped);
  // Avatar models bill per second of output; any integer in [5, 90] works.
  if (model.id.startsWith('veed-')) return Math.max(5, Math.min(90, clamped));
  return clamped;
}

/**
 * Estimate the cost of a generation plan in USD cents. For video the
 * duration is multiplied by price/sec; for images it's a flat price/image.
 */
export function estimateCostCents(plan: {
  imageModelId?: string;
  videoModelId?: string;
  videoDurationSeconds?: number;
  imageCount?: number;
  videoCount?: number;
}): number {
  let cents = 0;
  if (plan.imageModelId) {
    const m = getModel(plan.imageModelId);
    if (m) cents += m.pricePerUnitCents * Math.max(1, plan.imageCount ?? 1);
  }
  if (plan.videoModelId) {
    const m = getModel(plan.videoModelId);
    if (m) {
      const secs = snapVideoDuration(plan.videoDurationSeconds ?? 5, m);
      cents += m.pricePerUnitCents * secs * Math.max(1, plan.videoCount ?? 1);
    }
  }
  return cents;
}

/**
 * Public-facing catalog used by the dashboard. Shape is deliberately
 * minimal — we do not expose provider endpoint ids because they're
 * implementation details.
 */
export function publicCatalog() {
  return MODEL_CATALOG.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    mediaType: m.mediaType,
    supportsReference: m.supportsReference,
    maxReferenceCount: m.maxReferenceCount,
    maxDurationSeconds: m.maxDurationSeconds,
    pricePerUnitCents: m.pricePerUnitCents,
    unit: m.unit,
    recommendation: m.recommendation,
    supportedAspectRatios: m.supportedAspectRatios,
    available: m.available,
    provider: m.provider,
    notes: m.notes,
  }));
}
