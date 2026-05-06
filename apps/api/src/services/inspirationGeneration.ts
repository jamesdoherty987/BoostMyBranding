/**
 * Inspiration-driven generation orchestrator.
 *
 * Takes an inspiration set (uploaded files or client-library media),
 * optionally runs Claude Vision to decide what to make, then generates
 * the chosen image(s) and/or video(s) using the explicitly-selected
 * models — bypassing the Remotion template compositor for AI videos.
 *
 * All outputs are persisted to `clientImages` with provenance so the
 * user can see which model, which prompt, and which inspiration set
 * produced each asset, and re-roll with tweaks.
 */

import { inArray } from 'drizzle-orm';
import { getDb, isDbConfigured, clientImages } from '@boost/database';
import { analyzeInspiration, type InspirationAnalysis, type InspirationItem } from './inspirationAnalysis.js';
import { generateImageWithReference, generateVideoFromImage, generateImage } from './fal.js';
import { getModel, estimateCostCents } from './modelCatalog.js';
import { withRetry } from './retry.js';
import { broadcast } from './realtime.js';
import { buildBrandContext, brandContextToImageStyle } from './brandContext.js';
import {
  listProfiles,
  profilesToImageStyleHint,
  profilesToPromptBlock,
  type InspirationProfilePayload,
} from './inspirationProfiles.js';

/* ═══════════════════════════════════════════════════════════════════ */
/* Types                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export interface InspirationGenerateArgs {
  clientId: string;
  /**
   * Inspiration set. Each item is either an ID pointing at a row in
   * `clientImages` (the client's library) OR a raw URL that was just
   * uploaded (temporary inspiration — not persisted as client media).
   */
  inspiration: Array<
    | { kind: 'library'; id: string }
    | { kind: 'upload'; url: string; mimeType: string; label?: string }
  >;
  /** When false, skip Claude Vision and use `directBrief` instead. */
  runAnalysis: boolean;
  /**
   * User's text direction. On the analysis path, this is fed to Claude.
   * On the skip-analysis path, this IS the generation prompt.
   */
  directBrief?: string;
  /**
   * Force a specific output type. When omitted, Claude's recommendation
   * is used (analysis path) or `image` is assumed (skip-analysis path).
   */
  outputType?: 'image' | 'video' | 'both';

  /** Model selection. Required for the type(s) the user is producing. */
  imageModelId?: string;
  videoModelId?: string;

  /** Per-media options. */
  imageAspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
  videoAspectRatio?: '9:16' | '1:1' | '16:9';
  videoDurationSeconds?: number;

  /**
   * Whether to pass the inspiration URLs to the video model as the
   * starting still (image-to-video). When true and an image reference
   * is available, we use it; when false, the user is doing a text-only
   * video generation.
   */
  useInspirationAsVideoSeed?: boolean;

  /**
   * Saved inspiration profile ids from the client's library. When
   * supplied, their visual + copy analyses are factored into the
   * generation prompt alongside any per-run inspiration items.
   */
  inspirationProfileIds?: string[];
}

export interface InspirationGenerationRecord {
  assetId: string;
  mediaType: 'image' | 'video';
  url: string;
  modelId: string;
  modelDisplayName: string;
  prompt: string;
  costCents: number;
  fromMock: boolean;
}

export interface InspirationGenerateResult {
  analysis: InspirationAnalysis | null;
  outputs: InspirationGenerationRecord[];
  totalCostCents: number;
  fromMock: boolean;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Orchestration                                                        */
/* ═══════════════════════════════════════════════════════════════════ */

export async function generateFromInspiration(
  args: InspirationGenerateArgs,
): Promise<InspirationGenerateResult> {
  if (!args.inspiration.length && (!args.directBrief || args.directBrief.trim().length < 10)) {
    throw new Error('Provide at least one inspiration item or a direct brief of 10+ characters.');
  }

  /* ── 1. Resolve inspiration items to URLs ─────────────────────── */

  const resolved = await resolveInspirationItems(args.clientId, args.inspiration);
  if (resolved.length === 0 && (!args.directBrief || args.directBrief.trim().length < 10)) {
    throw new Error('Inspiration items could not be resolved to URLs and no direct brief was provided.');
  }

  /* ── 2. Analysis (or skip) ───────────────────────────────────── */

  let analysis: InspirationAnalysis | null = null;
  if (args.runAnalysis && resolved.length > 0) {
    broadcast({ type: 'inspiration:phase', payload: { clientId: args.clientId, phase: 'analysing' } });
    analysis = await withRetry(() => analyzeInspiration(resolved, args.directBrief), {
      label: `inspiration_analyse:${args.clientId}`,
      attempts: 2,
    });
  }

  /* ── 3. Decide output type ───────────────────────────────────── */

  broadcast({ type: 'inspiration:phase', payload: { clientId: args.clientId, phase: 'planning' } });

  const outputType = decideOutputType({
    override: args.outputType,
    analysis,
    hasImageModel: Boolean(args.imageModelId),
    hasVideoModel: Boolean(args.videoModelId),
  });

  /* ── 4. Build the final prompt ───────────────────────────────── */

  const brandCtx = await buildBrandContext(args.clientId).catch(() => null);
  const brandStyle = brandCtx ? brandContextToImageStyle(brandCtx) : '';

  // Resolve selected inspiration profiles. If the caller didn't pick
  // specific ones, include the full set of enabled profiles on the
  // client (Holo-style — the profile library is the brand's permanent
  // inspiration inventory).
  const allProfiles = await listProfiles(args.clientId).catch(
    () => [] as InspirationProfilePayload[],
  );
  const selectedProfiles =
    args.inspirationProfileIds && args.inspirationProfileIds.length > 0
      ? allProfiles.filter((p) => args.inspirationProfileIds!.includes(p.id))
      : allProfiles.filter((p) => p.isEnabled);

  const profileStyleHint = profilesToImageStyleHint(selectedProfiles);

  const basePrompt = buildPrompt({
    analysis,
    directBrief: args.directBrief,
    brandStyle,
    profileStyleHint,
  });

  /* ── 5. Execute generation(s) ────────────────────────────────── */

  const outputs: InspirationGenerationRecord[] = [];
  // Primary reference: a per-run upload, if the user attached one.
  const primaryReferenceImage = resolved.find((r) => !r.mimeType.startsWith('video/'));

  // Secondary references: images attached to enabled profiles. These
  // let the image model see examples of the style the user wants,
  // not just read text descriptions. Capped by the image model's
  // maxReferenceCount downstream.
  const profileReferenceUrls: string[] = [];
  for (const profile of selectedProfiles) {
    for (const m of profile.media) {
      if (m.mimeType && !m.mimeType.startsWith('image/')) continue;
      profileReferenceUrls.push(m.fileUrl);
    }
  }

  let anyMock = false;

  if (outputType === 'image' || outputType === 'both') {
    if (!args.imageModelId) {
      throw new Error('Image model is required for the chosen output type.');
    }
    broadcast({ type: 'inspiration:phase', payload: { clientId: args.clientId, phase: 'generating_image' } });
    // Assemble reference set: per-run upload first, then profile
    // reference images. The image runner will truncate to the model's
    // maxReferenceCount.
    const combinedReferences = [
      ...(primaryReferenceImage ? [primaryReferenceImage.url] : []),
      ...profileReferenceUrls,
    ];
    const record = await runImageGeneration({
      clientId: args.clientId,
      modelId: args.imageModelId,
      prompt: basePrompt,
      aspectRatio: args.imageAspectRatio ?? '4:5',
      referenceUrls: combinedReferences,
      analysis,
      directBrief: args.directBrief,
      inspirationItemIds: inspirationIds(args.inspiration),
    });
    if (record.fromMock) anyMock = true;
    outputs.push(record);
  }

  if (outputType === 'video' || outputType === 'both') {
    if (!args.videoModelId) {
      throw new Error('Video model is required for the chosen output type.');
    }
    broadcast({ type: 'inspiration:phase', payload: { clientId: args.clientId, phase: 'generating_video' } });

    // Video models on fal.ai all take a starting image. Decide what to
    // use as that seed:
    //   1. The image we just generated (when outputType === 'both')
    //   2. The first uploaded reference image
    //   3. A freshly generated image from the prompt (when no reference)
    let seedImageUrl: string | undefined;
    if (outputType === 'both' && outputs[0]?.mediaType === 'image') {
      seedImageUrl = outputs[0].url;
    } else if (args.useInspirationAsVideoSeed !== false && primaryReferenceImage) {
      seedImageUrl = primaryReferenceImage.url;
    }

    if (!seedImageUrl) {
      // Generate a seed still from the prompt so we can do image-to-video.
      try {
        seedImageUrl = await withRetry(() => generateImage(basePrompt, args.videoAspectRatio ?? '9:16'), {
          label: `inspiration_seed:${args.clientId}`,
          attempts: 2,
        });
      } catch (e) {
        throw new Error(`Could not generate a seed image for the video: ${(e as Error).message}`);
      }
    }

    const record = await runVideoGeneration({
      clientId: args.clientId,
      modelId: args.videoModelId,
      prompt: basePrompt,
      aspectRatio: args.videoAspectRatio ?? '9:16',
      durationSeconds: args.videoDurationSeconds ?? 5,
      seedImageUrl,
      analysis,
      directBrief: args.directBrief,
      inspirationItemIds: inspirationIds(args.inspiration),
    });
    if (record.fromMock) anyMock = true;
    outputs.push(record);
  }

  /* ── 6. Return ───────────────────────────────────────────────── */

  broadcast({ type: 'inspiration:phase', payload: { clientId: args.clientId, phase: 'done' } });

  const totalCostCents = outputs.reduce((s, o) => s + o.costCents, 0);

  return { analysis, outputs, totalCostCents, fromMock: anyMock };
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Helpers                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

async function resolveInspirationItems(
  clientId: string,
  items: InspirationGenerateArgs['inspiration'],
): Promise<InspirationItem[]> {
  if (items.length === 0) return [];

  const libraryIds = items.filter((i) => i.kind === 'library').map((i) => (i as any).id as string);
  const libraryRows: Array<{ id: string; fileUrl: string; mimeType: string | null; aiDescription: string | null; clientId: string }> = [];

  if (libraryIds.length > 0 && isDbConfigured()) {
    const db = getDb();
    const rows = await db
      .select({
        id: clientImages.id,
        fileUrl: clientImages.fileUrl,
        mimeType: clientImages.mimeType,
        aiDescription: clientImages.aiDescription,
        clientId: clientImages.clientId,
      })
      .from(clientImages)
      .where(inArray(clientImages.id, libraryIds));
    // Scope: never let a user reference a media row from another client.
    for (const r of rows) {
      if (r.clientId === clientId) libraryRows.push(r);
    }
  }

  const result: InspirationItem[] = [];
  for (const item of items) {
    if (item.kind === 'library') {
      const row = libraryRows.find((r) => r.id === item.id);
      if (row) {
        result.push({
          id: row.id,
          url: row.fileUrl,
          mimeType: row.mimeType ?? 'image/jpeg',
          label: row.aiDescription ?? undefined,
        });
      }
    } else {
      result.push({
        id: `upload:${result.length}`,
        url: item.url,
        mimeType: item.mimeType,
        label: item.label,
      });
    }
  }
  return result;
}

function inspirationIds(items: InspirationGenerateArgs['inspiration']): string[] {
  return items.map((i) => (i.kind === 'library' ? i.id : `upload:${i.url.slice(0, 80)}`));
}

function decideOutputType(args: {
  override?: 'image' | 'video' | 'both';
  analysis: InspirationAnalysis | null;
  hasImageModel: boolean;
  hasVideoModel: boolean;
}): 'image' | 'video' | 'both' {
  if (args.override) return args.override;
  if (args.analysis) {
    const suggested = args.analysis.suggestedOutputTypes;
    if (suggested.includes('image') && suggested.includes('video')) return 'both';
    if (suggested.includes('video')) return 'video';
    if (suggested.includes('image')) return 'image';
  }
  if (args.hasVideoModel && !args.hasImageModel) return 'video';
  return 'image';
}

function buildPrompt(args: {
  analysis: InspirationAnalysis | null;
  directBrief?: string;
  brandStyle: string;
  profileStyleHint?: string;
}): string {
  const parts: string[] = [];
  if (args.analysis) {
    parts.push(args.analysis.suggestedPrompt);
  }
  if (args.directBrief && args.directBrief.trim().length > 0) {
    parts.push(args.directBrief.trim());
  }
  if (args.brandStyle) {
    parts.push(args.brandStyle);
  }
  if (args.profileStyleHint && args.profileStyleHint.trim().length > 0) {
    parts.push(args.profileStyleHint);
  }
  parts.push('No fabricated text, no invented logos, no face generation of real people.');
  return parts.join(' ');
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Image + Video runners (with persistence)                             */
/* ═══════════════════════════════════════════════════════════════════ */

async function runImageGeneration(args: {
  clientId: string;
  modelId: string;
  prompt: string;
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9';
  referenceUrls: string[];
  analysis: InspirationAnalysis | null;
  directBrief?: string;
  inspirationItemIds: string[];
}): Promise<InspirationGenerationRecord> {
  const model = getModel(args.modelId);
  if (!model) throw new Error(`Unknown image model: ${args.modelId}`);

  const result = await withRetry(
    () =>
      generateImageWithReference({
        modelId: args.modelId,
        prompt: args.prompt,
        aspectRatio: args.aspectRatio,
        referenceUrls: args.referenceUrls,
      }),
    { label: `inspiration_image:${args.clientId}`, attempts: 2 },
  );

  const costCents = estimateCostCents({ imageModelId: args.modelId, imageCount: 1 });

  const assetId = await persistOutput({
    clientId: args.clientId,
    mediaType: 'image',
    url: result.imageUrl,
    mimeType: inferImageMimeFromUrl(result.imageUrl),
    prompt: args.prompt,
    model,
    costCents,
    analysis: args.analysis,
    directBrief: args.directBrief,
    inspirationItemIds: args.inspirationItemIds,
    fromMock: result.fromMock,
  });

  return {
    assetId,
    mediaType: 'image',
    url: result.imageUrl,
    modelId: model.id,
    modelDisplayName: model.displayName,
    prompt: args.prompt,
    costCents,
    fromMock: result.fromMock,
  };
}

async function runVideoGeneration(args: {
  clientId: string;
  modelId: string;
  prompt: string;
  aspectRatio: '9:16' | '1:1' | '16:9';
  durationSeconds: number;
  seedImageUrl: string;
  analysis: InspirationAnalysis | null;
  directBrief?: string;
  inspirationItemIds: string[];
}): Promise<InspirationGenerationRecord> {
  const model = getModel(args.modelId);
  if (!model) throw new Error(`Unknown video model: ${args.modelId}`);

  const result = await withRetry(
    () =>
      generateVideoFromImage({
        modelId: args.modelId,
        imageUrl: args.seedImageUrl,
        prompt: args.prompt,
        durationSeconds: args.durationSeconds,
        aspectRatio: args.aspectRatio,
      }),
    { label: `inspiration_video:${args.clientId}`, attempts: 1 },
  );

  const costCents = estimateCostCents({
    videoModelId: args.modelId,
    videoDurationSeconds: result.durationSeconds,
    videoCount: 1,
  });

  const assetId = await persistOutput({
    clientId: args.clientId,
    mediaType: 'video',
    url: result.videoUrl,
    mimeType: 'video/mp4',
    prompt: args.prompt,
    model,
    costCents,
    analysis: args.analysis,
    directBrief: args.directBrief,
    inspirationItemIds: args.inspirationItemIds,
    fromMock: result.fromMock,
    extraProvenance: {
      durationSeconds: result.durationSeconds,
      seedImageUrl: args.seedImageUrl,
    },
  });

  return {
    assetId,
    mediaType: 'video',
    url: result.videoUrl,
    modelId: model.id,
    modelDisplayName: model.displayName,
    prompt: args.prompt,
    costCents,
    fromMock: result.fromMock,
  };
}

function inferImageMimeFromUrl(url: string): string {
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.webp')) return 'image/webp';
  if (url.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function persistOutput(args: {
  clientId: string;
  mediaType: 'image' | 'video';
  url: string;
  mimeType: string;
  prompt: string;
  model: { id: string; displayName: string };
  costCents: number;
  analysis: InspirationAnalysis | null;
  directBrief?: string;
  inspirationItemIds: string[];
  fromMock: boolean;
  extraProvenance?: Record<string, unknown>;
}): Promise<string> {
  if (!isDbConfigured()) {
    return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  try {
    const db = getDb();
    broadcast({ type: 'inspiration:phase', payload: { clientId: args.clientId, phase: 'persisting' } });
    const [row] = await db
      .insert(clientImages)
      .values({
        clientId: args.clientId,
        fileUrl: args.url,
        fileName: `inspiration-${Date.now()}.${args.mediaType === 'video' ? 'mp4' : 'jpg'}`,
        mimeType: args.mimeType,
        source: 'ai',
        status: 'approved',
        tags: ['ai', 'inspiration', args.mediaType, args.model.id],
        aiDescription: args.analysis?.subjectType ?? args.directBrief?.slice(0, 180) ?? args.prompt.slice(0, 180),
        aiSuggestions: {
          inspirationProvenance: {
            modelId: args.model.id,
            modelDisplayName: args.model.displayName,
            prompt: args.prompt,
            directBrief: args.directBrief ?? null,
            inspirationItemIds: args.inspirationItemIds,
            analysis: args.analysis,
            costCents: args.costCents,
            fromMock: args.fromMock,
            generatedAt: new Date().toISOString(),
            ...args.extraProvenance,
          },
        } as any,
      })
      .returning();
    return row?.id ?? `unknown_${Date.now()}`;
  } catch (e) {
    console.warn('[inspiration] persist failed:', (e as Error).message);
    return `unpersisted_${Date.now()}`;
  }
}
