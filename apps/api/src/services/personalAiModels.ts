/**
 * Unified AI media router for personal content.
 *
 * A single interface over every image + video model we support. Each
 * model has a capability record (price, max duration, reference
 * support, quality tier) so the generator can pick the best model for
 * a given job — or obey the user's explicit choice.
 *
 * Supported providers (any subset, depending on which API keys are set):
 *
 *   Images
 *     flux-pro-ultra          (fal.ai — premium photorealism, ref images)
 *     flux-dev                (fal.ai — strong free tier)
 *     nano-banana             (Google Gemini 2.5 Flash Image — multi-ref,
 *                              character consistency, editing)
 *     ideogram-v3             (fal.ai — text-in-image, aesthetic)
 *     seedream-v4             (fal.ai — high-res photoreal)
 *     recraft-v3              (fal.ai — illustration / design)
 *     dalle-3                 (OpenAI — stylised, text rendering)
 *
 *   Videos
 *     sora-2                  (OpenAI — cinematic text-to-video, sync audio)
 *     veo-3                   (Google — strong physics, native dialogue)
 *     kling-v2                (fal.ai — strong motion, img-to-vid)
 *     runway-gen4             (Runway — character consistency)
 *     minimax-hailuo          (fal.ai — budget option, fast)
 *     luma-ray-2              (fal.ai — naturalistic)
 *
 * When a chosen model isn't available (no API key), we surface a clear
 * error instead of silently swapping — the user wanted quality, not
 * surprise downgrades.
 */

import { fal } from '@fal-ai/client';
import { env, features } from '../env.js';
import { uploadFile } from './r2.js';

export type AiModelKind = 'image' | 'video';
export type AiQualityTier = 'max' | 'balanced' | 'budget';

export interface AiModel {
  id: string;
  displayName: string;
  provider: 'fal' | 'openai' | 'google' | 'runway' | 'replicate';
  kind: AiModelKind;
  qualityTier: AiQualityTier;
  /** Supports passing reference images as conditioning. */
  supportsReference: boolean;
  /** Max number of ref images accepted. 0 = text-only. */
  maxReferenceImages: number;
  /** Max duration in seconds (video only). */
  maxDurationSeconds?: number;
  /** Aspect ratios this model will actually produce well. */
  supportedAspectRatios: Array<'9:16' | '1:1' | '16:9' | '4:5'>;
  /** Pricing hint in US cents per unit (per image or per second). */
  pricePerUnitCents: number;
  /** Whether the current deployment can run it. */
  available: boolean;
  /** One-line usage note. */
  notes: string;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Feature detection                                                    */
/* ═══════════════════════════════════════════════════════════════════ */

const hasFal = () => features.fal;
const hasOpenAI = () => Boolean(process.env.OPENAI_API_KEY);
const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);
const hasRunway = () => Boolean(process.env.RUNWAY_API_KEY);
const hasReplicate = () => Boolean(process.env.REPLICATE_API_TOKEN);

/* ═══════════════════════════════════════════════════════════════════ */
/* Catalog                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

export function listAiModels(): AiModel[] {
  return [
    /* ── Images ─────────────────────────────────────────────── */
    {
      id: 'flux-pro-ultra',
      displayName: 'Flux Pro Ultra',
      provider: 'fal',
      kind: 'image',
      qualityTier: 'max',
      supportsReference: true,
      maxReferenceImages: 1,
      supportedAspectRatios: ['9:16', '1:1', '16:9', '4:5'],
      pricePerUnitCents: 6,
      available: hasFal(),
      notes: 'Best-in-class photorealism. Use for hero shots and character refs.',
    },
    {
      id: 'nano-banana',
      displayName: 'Nano Banana (Gemini 2.5 Flash Image)',
      provider: 'google',
      kind: 'image',
      qualityTier: 'max',
      supportsReference: true,
      maxReferenceImages: 6,
      supportedAspectRatios: ['9:16', '1:1', '16:9', '4:5'],
      pricePerUnitCents: 4,
      available: hasGemini(),
      notes:
        'Best for character consistency — multi-image composition, precise editing, keeps the same face across generations.',
    },
    {
      id: 'ideogram-v3',
      displayName: 'Ideogram v3',
      provider: 'fal',
      kind: 'image',
      qualityTier: 'balanced',
      supportsReference: true,
      maxReferenceImages: 1,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 3,
      available: hasFal(),
      notes: 'Excellent in-image text rendering and typographic layouts.',
    },
    {
      id: 'seedream-v4',
      displayName: 'Seedream v4',
      provider: 'fal',
      kind: 'image',
      qualityTier: 'balanced',
      supportsReference: true,
      maxReferenceImages: 4,
      supportedAspectRatios: ['9:16', '1:1', '16:9', '4:5'],
      pricePerUnitCents: 3,
      available: hasFal(),
      notes: '4K photoreal, good at editorial and lifestyle.',
    },
    {
      id: 'recraft-v3',
      displayName: 'Recraft v3',
      provider: 'fal',
      kind: 'image',
      qualityTier: 'balanced',
      supportsReference: false,
      maxReferenceImages: 0,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 3,
      available: hasFal(),
      notes: 'Illustration, design-forward layouts, clean vectors.',
    },
    {
      id: 'flux-dev',
      displayName: 'Flux Dev',
      provider: 'fal',
      kind: 'image',
      qualityTier: 'budget',
      supportsReference: false,
      maxReferenceImages: 0,
      supportedAspectRatios: ['9:16', '1:1', '16:9', '4:5'],
      pricePerUnitCents: 1,
      available: hasFal(),
      notes: 'Solid free-tier fallback.',
    },
    {
      id: 'dalle-3',
      displayName: 'DALL·E 3',
      provider: 'openai',
      kind: 'image',
      qualityTier: 'balanced',
      supportsReference: false,
      maxReferenceImages: 0,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 4,
      available: hasOpenAI(),
      notes: 'Stylised, good text rendering, distinct aesthetic.',
    },

    /* ── Videos ─────────────────────────────────────────────── */
    {
      id: 'sora-2',
      displayName: 'Sora 2',
      provider: 'openai',
      kind: 'video',
      qualityTier: 'max',
      supportsReference: true,
      maxReferenceImages: 1,
      maxDurationSeconds: 20,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 30,
      available: hasOpenAI(),
      notes: 'Cinematic, native synchronized audio, strongest prompt adherence.',
    },
    {
      id: 'veo-3',
      displayName: 'Veo 3',
      provider: 'google',
      kind: 'video',
      qualityTier: 'max',
      supportsReference: true,
      maxReferenceImages: 1,
      maxDurationSeconds: 8,
      supportedAspectRatios: ['9:16', '16:9'],
      pricePerUnitCents: 40,
      available: hasGemini(),
      notes:
        'Strong physics, native dialogue and sound effects. Best for dialogue clips.',
    },
    {
      id: 'kling-v2',
      displayName: 'Kling v2.1 Master',
      provider: 'fal',
      kind: 'video',
      qualityTier: 'balanced',
      supportsReference: true,
      maxReferenceImages: 1,
      maxDurationSeconds: 10,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 14,
      available: hasFal(),
      notes: 'Motion quality is top-tier. Great img-to-video for stylised looks.',
    },
    {
      id: 'runway-gen4',
      displayName: 'Runway Gen-4',
      provider: 'runway',
      kind: 'video',
      qualityTier: 'max',
      supportsReference: true,
      maxReferenceImages: 3,
      maxDurationSeconds: 10,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 25,
      available: hasRunway(),
      notes:
        'Best for character-driven scenes — composes a reference person into new environments.',
    },
    {
      id: 'minimax-hailuo',
      displayName: 'MiniMax Hailuo 02',
      provider: 'fal',
      kind: 'video',
      qualityTier: 'budget',
      supportsReference: true,
      maxReferenceImages: 1,
      maxDurationSeconds: 6,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 6,
      available: hasFal(),
      notes: 'Budget-tier, fast turnaround.',
    },
    {
      id: 'higgsfield-dop',
      displayName: 'Higgsfield DOP',
      provider: 'fal',
      kind: 'video',
      qualityTier: 'max',
      supportsReference: true,
      maxReferenceImages: 1,
      maxDurationSeconds: 6,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 20,
      available: hasFal(),
      notes:
        'Director-grade camera control (crash zoom, crane, FPV, orbit). Best cinematography per dollar for 9:16.',
    },
    {
      id: 'higgsfield-soul',
      displayName: 'Higgsfield Soul (image)',
      provider: 'fal',
      kind: 'image',
      qualityTier: 'max',
      supportsReference: true,
      maxReferenceImages: 3,
      supportedAspectRatios: ['9:16', '1:1', '16:9', '4:5'],
      pricePerUnitCents: 5,
      available: hasFal(),
      notes:
        'Ultra-realistic fashion / portrait stills. Great character anchor for AI-influencer workflows.',
    },
    {
      id: 'wan-2-5',
      displayName: 'Higgsfield WAN 2.5',
      provider: 'fal',
      kind: 'video',
      qualityTier: 'max',
      supportsReference: true,
      maxReferenceImages: 1,
      maxDurationSeconds: 6,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 16,
      available: hasFal(),
      notes:
        'WAN 2.5 on Higgsfield with camera controls — bullet-time, dolly push, handheld, FPV.',
    },
    {
      id: 'seedance-pro',
      displayName: 'Seedance Pro',
      provider: 'fal',
      kind: 'video',
      qualityTier: 'balanced',
      supportsReference: true,
      maxReferenceImages: 1,
      maxDurationSeconds: 10,
      supportedAspectRatios: ['9:16', '1:1', '16:9'],
      pricePerUnitCents: 12,
      available: hasFal(),
      notes:
        'ByteDance Seedance — strong motion physics and multi-scene continuity.',
    },
  ];
}

export function getAiModel(id: string): AiModel | undefined {
  return listAiModels().find((m) => m.id === id);
}

/**
 * Pick a default model for a tier when the user hasn't specified one.
 * Respects availability — if the "max" tier isn't configured, falls
 * down to balanced → budget before throwing.
 */
export function pickDefaultModel(
  kind: AiModelKind,
  tier: AiQualityTier,
): AiModel | undefined {
  const tierOrder: AiQualityTier[] =
    tier === 'max' ? ['max', 'balanced', 'budget'] :
    tier === 'balanced' ? ['balanced', 'max', 'budget'] :
    ['budget', 'balanced', 'max'];
  for (const t of tierOrder) {
    const hit = listAiModels().find(
      (m) => m.kind === kind && m.qualityTier === t && m.available,
    );
    if (hit) return hit;
  }
  return undefined;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Generation functions                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

export interface GenerateImageArgs {
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '9:16' | '1:1' | '16:9' | '4:5';
  referenceImageUrls?: string[];
  /** Storage scope for the generated asset. */
  scopePath: string;
}

export interface GenerateImageResult {
  url: string;
  modelId: string;
  costCents: number;
  fromMock: boolean;
}

export async function generateAiImage(
  args: GenerateImageArgs,
): Promise<GenerateImageResult> {
  const model = getAiModel(args.modelId);
  if (!model) throw new Error(`Unknown image model: ${args.modelId}`);
  if (!model.available) {
    throw new Error(
      `${model.displayName} is not configured. Set the relevant API key or pick a different model.`,
    );
  }

  switch (model.provider) {
    case 'fal':
      return generateFalImage(model, args);
    case 'google':
      return generateNanoBananaImage(model, args);
    case 'openai':
      return generateOpenAIImage(model, args);
    default:
      throw new Error(`Image provider ${model.provider} not wired up`);
  }
}

/* ─── fal.ai image ─────────────────────────────────────────── */

async function generateFalImage(
  model: AiModel,
  args: GenerateImageArgs,
): Promise<GenerateImageResult> {
  if (!features.fal) throw new Error('FAL_KEY not set');
  fal.config({ credentials: env.FAL_KEY });

  const endpointMap: Record<string, string> = {
    'flux-pro-ultra': 'fal-ai/flux-pro/v1.1-ultra',
    'flux-dev': 'fal-ai/flux/dev',
    'ideogram-v3': 'fal-ai/ideogram/v3',
    'seedream-v4': 'fal-ai/bytedance/seedream/v4/text-to-image',
    'recraft-v3': 'fal-ai/recraft/v3/text-to-image',
    'higgsfield-soul': 'fal-ai/higgsfield/soul',
  };
  const endpoint = endpointMap[model.id];
  if (!endpoint) throw new Error(`No fal endpoint for ${model.id}`);

  // Reference-image-capable fluxes route through the edit endpoint.
  const useRef =
    model.supportsReference &&
    args.referenceImageUrls &&
    args.referenceImageUrls.length > 0;
  const input: Record<string, unknown> = {
    prompt: args.prompt,
    aspect_ratio: args.aspectRatio ?? '9:16',
  };
  if (useRef) {
    input.image_url = args.referenceImageUrls![0];
  }
  if (args.negativePrompt) input.negative_prompt = args.negativePrompt;

  const result = await fal.subscribe(endpoint, { input, logs: false });
  const url = (result.data as any)?.images?.[0]?.url as string | undefined;
  if (!url) throw new Error(`${model.displayName} returned no image`);

  // Persist to R2 for long-term stability (fal URLs expire).
  const buffer = Buffer.from(await (await fetch(url)).arrayBuffer());
  const up = await uploadFile(
    args.scopePath,
    buffer,
    `${model.id}-${Date.now()}.jpg`,
    'image/jpeg',
  );
  return {
    url: up.url,
    modelId: model.id,
    costCents: model.pricePerUnitCents,
    fromMock: false,
  };
}

/* ─── Nano Banana (Gemini 2.5 Flash Image) ───────────────── */

async function generateNanoBananaImage(
  model: AiModel,
  args: GenerateImageArgs,
): Promise<GenerateImageResult> {
  if (!hasGemini()) throw new Error('GEMINI_API_KEY not set');

  // Gemini's image-gen endpoint accepts text + inline reference images.
  // We call the REST API directly to avoid another SDK dep.
  const parts: Array<Record<string, unknown>> = [{ text: args.prompt }];
  for (const ref of (args.referenceImageUrls ?? []).slice(
    0,
    model.maxReferenceImages,
  )) {
    try {
      const r = await fetch(ref);
      const buf = Buffer.from(await r.arrayBuffer());
      parts.push({
        inlineData: {
          mimeType: r.headers.get('content-type') ?? 'image/jpeg',
          data: buf.toString('base64'),
        },
      });
    } catch {
      // Skip a failed ref fetch — generation continues with what we have.
    }
  }

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const body = (await res.json()) as any;
  const imgData = body?.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData,
  )?.inlineData;
  if (!imgData?.data) throw new Error('Gemini returned no image');

  const buffer = Buffer.from(imgData.data, 'base64');
  const up = await uploadFile(
    args.scopePath,
    buffer,
    `nano-banana-${Date.now()}.png`,
    imgData.mimeType ?? 'image/png',
  );
  return {
    url: up.url,
    modelId: model.id,
    costCents: model.pricePerUnitCents,
    fromMock: false,
  };
}

/* ─── OpenAI image ─────────────────────────────────────────── */

async function generateOpenAIImage(
  model: AiModel,
  args: GenerateImageArgs,
): Promise<GenerateImageResult> {
  if (!hasOpenAI()) throw new Error('OPENAI_API_KEY not set');

  // DALL·E 3 via the images endpoint. Doesn't take refs.
  const sizeMap: Record<string, string> = {
    '9:16': '1024x1792',
    '16:9': '1792x1024',
    '1:1': '1024x1024',
    '4:5': '1024x1792',
  };
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: args.prompt,
      size: sizeMap[args.aspectRatio ?? '9:16'],
      quality: 'hd',
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI image ${res.status}: ${body.slice(0, 200)}`);
  }
  const body = (await res.json()) as any;
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image');
  const buffer = Buffer.from(b64, 'base64');
  const up = await uploadFile(
    args.scopePath,
    buffer,
    `dalle3-${Date.now()}.png`,
    'image/png',
  );
  return {
    url: up.url,
    modelId: model.id,
    costCents: model.pricePerUnitCents,
    fromMock: false,
  };
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Video generation                                                     */
/* ═══════════════════════════════════════════════════════════════════ */

export interface GenerateVideoArgs {
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '9:16' | '1:1' | '16:9';
  durationSeconds?: number;
  /** Reference image (first frame / style / character). */
  referenceImageUrls?: string[];
  scopePath: string;
}

export interface GenerateVideoResult {
  url: string;
  durationSeconds: number;
  modelId: string;
  costCents: number;
  fromMock: boolean;
}

export async function generateAiVideo(
  args: GenerateVideoArgs,
): Promise<GenerateVideoResult> {
  const model = getAiModel(args.modelId);
  if (!model || model.kind !== 'video') {
    throw new Error(`Unknown video model: ${args.modelId}`);
  }
  if (!model.available) {
    throw new Error(
      `${model.displayName} is not configured. Set the relevant API key.`,
    );
  }
  const duration = Math.min(
    args.durationSeconds ?? 5,
    model.maxDurationSeconds ?? 10,
  );

  switch (model.provider) {
    case 'fal':
      return generateFalVideo(model, args, duration);
    case 'openai':
      return generateSoraVideo(model, args, duration);
    case 'google':
      return generateVeoVideo(model, args, duration);
    case 'runway':
      return generateRunwayVideo(model, args, duration);
    default:
      throw new Error(`Video provider ${model.provider} not wired up`);
  }
}

/* ─── fal.ai video (Kling, Luma, Hailuo) ──────────────────── */

async function generateFalVideo(
  model: AiModel,
  args: GenerateVideoArgs,
  duration: number,
): Promise<GenerateVideoResult> {
  if (!features.fal) throw new Error('FAL_KEY not set');
  fal.config({ credentials: env.FAL_KEY });

  const endpointMap: Record<string, { endpoint: string; useImage: boolean }> = {
    'kling-v2': {
      endpoint:
        args.referenceImageUrls && args.referenceImageUrls.length > 0
          ? 'fal-ai/kling-video/v2.1/master/image-to-video'
          : 'fal-ai/kling-video/v2.1/master/text-to-video',
      useImage: Boolean(args.referenceImageUrls?.length),
    },
    'minimax-hailuo': {
      endpoint:
        args.referenceImageUrls && args.referenceImageUrls.length > 0
          ? 'fal-ai/minimax/hailuo-02/pro/image-to-video'
          : 'fal-ai/minimax/hailuo-02/pro/text-to-video',
      useImage: Boolean(args.referenceImageUrls?.length),
    },
    'luma-ray-2': {
      endpoint: 'fal-ai/luma-dream-machine/ray-2',
      useImage: Boolean(args.referenceImageUrls?.length),
    },
    'higgsfield-dop': {
      endpoint: 'fal-ai/higgsfield/dop',
      useImage: Boolean(args.referenceImageUrls?.length),
    },
    'wan-2-5': {
      endpoint:
        args.referenceImageUrls && args.referenceImageUrls.length > 0
          ? 'fal-ai/wan/v2.5/image-to-video'
          : 'fal-ai/wan/v2.5/text-to-video',
      useImage: Boolean(args.referenceImageUrls?.length),
    },
    'seedance-pro': {
      endpoint:
        args.referenceImageUrls && args.referenceImageUrls.length > 0
          ? 'fal-ai/bytedance/seedance/v1/pro/image-to-video'
          : 'fal-ai/bytedance/seedance/v1/pro/text-to-video',
      useImage: Boolean(args.referenceImageUrls?.length),
    },
  };
  const cfg = endpointMap[model.id];
  if (!cfg) throw new Error(`No fal endpoint for video model ${model.id}`);

  const input: Record<string, unknown> = {
    prompt: args.prompt,
    duration: String(duration),
    aspect_ratio: args.aspectRatio ?? '9:16',
  };
  if (args.negativePrompt) input.negative_prompt = args.negativePrompt;
  if (cfg.useImage) {
    input.image_url = args.referenceImageUrls![0];
  }

  const result = await fal.subscribe(cfg.endpoint, { input, logs: false });
  const url = (result.data as any)?.video?.url as string | undefined;
  if (!url) throw new Error(`${model.displayName} returned no video`);

  const buffer = Buffer.from(await (await fetch(url)).arrayBuffer());
  const up = await uploadFile(
    args.scopePath,
    buffer,
    `${model.id}-${Date.now()}.mp4`,
    'video/mp4',
  );
  return {
    url: up.url,
    durationSeconds: duration,
    modelId: model.id,
    costCents: model.pricePerUnitCents * duration,
    fromMock: false,
  };
}

/* ─── Sora 2 (OpenAI) ──────────────────────────────────────── */

async function generateSoraVideo(
  model: AiModel,
  args: GenerateVideoArgs,
  duration: number,
): Promise<GenerateVideoResult> {
  if (!hasOpenAI()) throw new Error('OPENAI_API_KEY not set');

  // OpenAI's Sora 2 endpoint: POST /v1/videos (async), poll /v1/videos/:id
  // until status = completed, then GET /v1/videos/:id/content.
  const sizeMap: Record<string, string> = {
    '9:16': '720x1280',
    '16:9': '1280x720',
    '1:1': '720x720',
  };
  const createRes = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sora-2',
      prompt: args.prompt,
      size: sizeMap[args.aspectRatio ?? '9:16'],
      seconds: String(duration),
      ...(args.referenceImageUrls?.[0]
        ? { input_reference: args.referenceImageUrls[0] }
        : {}),
    }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Sora create ${createRes.status}: ${body.slice(0, 200)}`);
  }
  const job = (await createRes.json()) as { id: string };

  // Poll until done. Sora takes 30-180s.
  const deadline = Date.now() + 10 * 60 * 1000;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts++;
    await new Promise((r) => setTimeout(r, Math.min(5000, 1000 + attempts * 500)));
    const pollRes = await fetch(`https://api.openai.com/v1/videos/${job.id}`, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
    });
    if (!pollRes.ok) continue;
    const poll = (await pollRes.json()) as {
      status: string;
      error?: { message?: string };
    };
    if (poll.status === 'completed') break;
    if (poll.status === 'failed') {
      throw new Error(`Sora failed: ${poll.error?.message ?? 'unknown'}`);
    }
  }

  // Fetch the MP4.
  const videoRes = await fetch(
    `https://api.openai.com/v1/videos/${job.id}/content`,
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` } },
  );
  if (!videoRes.ok) throw new Error(`Sora fetch ${videoRes.status}`);
  const buffer = Buffer.from(await videoRes.arrayBuffer());
  const up = await uploadFile(
    args.scopePath,
    buffer,
    `sora-${Date.now()}.mp4`,
    'video/mp4',
  );
  return {
    url: up.url,
    durationSeconds: duration,
    modelId: model.id,
    costCents: model.pricePerUnitCents * duration,
    fromMock: false,
  };
}

/* ─── Veo 3 (Google) ───────────────────────────────────────── */

async function generateVeoVideo(
  model: AiModel,
  args: GenerateVideoArgs,
  duration: number,
): Promise<GenerateVideoResult> {
  if (!hasGemini()) throw new Error('GEMINI_API_KEY not set');

  // Long-running operation: POST :predictLongRunning, poll operations/{id}.
  const modelPath = 'veo-3.0-generate-preview';
  const instance: Record<string, unknown> = { prompt: args.prompt };
  if (args.referenceImageUrls?.[0]) {
    try {
      const r = await fetch(args.referenceImageUrls[0]!);
      const buf = Buffer.from(await r.arrayBuffer());
      instance.image = {
        bytesBase64Encoded: buf.toString('base64'),
        mimeType: r.headers.get('content-type') ?? 'image/jpeg',
      };
    } catch {
      /* ignore */
    }
  }
  const createRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelPath}:predictLongRunning`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          aspectRatio: args.aspectRatio ?? '9:16',
          durationSeconds: duration,
        },
      }),
    },
  );
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Veo create ${createRes.status}: ${body.slice(0, 200)}`);
  }
  const { name } = (await createRes.json()) as { name: string };

  const deadline = Date.now() + 10 * 60 * 1000;
  let videoUri: string | undefined;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${name}`,
      { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! } },
    );
    if (!pollRes.ok) continue;
    const poll = (await pollRes.json()) as {
      done?: boolean;
      response?: { generatedVideos?: Array<{ video?: { uri?: string } }> };
      error?: { message?: string };
    };
    if (poll.error) throw new Error(`Veo failed: ${poll.error.message}`);
    if (poll.done) {
      videoUri = poll.response?.generatedVideos?.[0]?.video?.uri;
      break;
    }
  }
  if (!videoUri) throw new Error('Veo produced no video URI');

  const videoRes = await fetch(videoUri, {
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
  });
  if (!videoRes.ok) throw new Error(`Veo fetch ${videoRes.status}`);
  const buffer = Buffer.from(await videoRes.arrayBuffer());
  const up = await uploadFile(
    args.scopePath,
    buffer,
    `veo-${Date.now()}.mp4`,
    'video/mp4',
  );
  return {
    url: up.url,
    durationSeconds: duration,
    modelId: model.id,
    costCents: model.pricePerUnitCents * duration,
    fromMock: false,
  };
}

/* ─── Runway Gen-4 ─────────────────────────────────────────── */

async function generateRunwayVideo(
  model: AiModel,
  args: GenerateVideoArgs,
  duration: number,
): Promise<GenerateVideoResult> {
  if (!hasRunway()) throw new Error('RUNWAY_API_KEY not set');

  // Runway SDK REST — POST /v1/image_to_video (or text_to_video), poll task.
  const useImage = Boolean(args.referenceImageUrls?.[0]);
  const endpoint = useImage
    ? 'https://api.dev.runwayml.com/v1/image_to_video'
    : 'https://api.dev.runwayml.com/v1/text_to_video';
  const createRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RUNWAY_API_KEY!}`,
      'X-Runway-Version': '2024-11-06',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gen4_turbo',
      promptText: args.prompt,
      ...(useImage ? { promptImage: args.referenceImageUrls![0] } : {}),
      duration,
      ratio: args.aspectRatio === '9:16' ? '768:1280' : '1280:768',
    }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Runway create ${createRes.status}: ${body.slice(0, 200)}`);
  }
  const { id } = (await createRes.json()) as { id: string };

  const deadline = Date.now() + 10 * 60 * 1000;
  let outputUrl: string | undefined;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(
      `https://api.dev.runwayml.com/v1/tasks/${id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.RUNWAY_API_KEY!}`,
          'X-Runway-Version': '2024-11-06',
        },
      },
    );
    if (!pollRes.ok) continue;
    const poll = (await pollRes.json()) as {
      status: string;
      output?: string[];
      failure?: string;
    };
    if (poll.status === 'SUCCEEDED') {
      outputUrl = poll.output?.[0];
      break;
    }
    if (poll.status === 'FAILED') {
      throw new Error(`Runway failed: ${poll.failure ?? 'unknown'}`);
    }
  }
  if (!outputUrl) throw new Error('Runway produced no output URL');

  const videoRes = await fetch(outputUrl);
  const buffer = Buffer.from(await videoRes.arrayBuffer());
  const up = await uploadFile(
    args.scopePath,
    buffer,
    `runway-${Date.now()}.mp4`,
    'video/mp4',
  );
  return {
    url: up.url,
    durationSeconds: duration,
    modelId: model.id,
    costCents: model.pricePerUnitCents * duration,
    fromMock: false,
  };
}
