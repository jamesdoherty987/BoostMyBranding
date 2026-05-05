/**
 * Video generation service. Wraps the Remotion render call with R2 upload
 * so the API just returns a public URL.
 *
 * Runs in-process. Rendering a 12-15s 1080x1920 video takes 10-30 seconds
 * of CPU time. For production you might want to move this to a queue
 * (BullMQ) but for now we render synchronously.
 */

import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { eq, desc } from 'drizzle-orm';
import { renderVideo, listTemplates, getTemplate, DEFAULT_BRAND } from '@boost/video';
import type { VideoProps, BrandPalette, MediaClip } from '@boost/video';
import { getDb, isDbConfigured, clients, clientImages } from '@boost/database';
import { uploadFile } from './r2.js';
import { features } from '../env.js';
import { generateJSON } from './claude.js';
import { animateImage, generateImage } from './fal.js';
import { videoScriptPrompt } from './prompts.js';
import { withRetry } from './retry.js';
import { broadcast } from './realtime.js';

export interface GenerateVideoArgs {
  templateId: string;
  businessName: string;
  headline: string;
  subheadline?: string;
  cta?: string;
  domain?: string;
  brand?: Partial<BrandPalette>;
  imageUrl?: string;
  /** Client id — used to scope the R2 upload path. */
  clientId: string;
  /**
   * Ordered media clips from the client's library. When provided (and the
   * chosen template supports it, like `media-story`), the renderer skips
   * the generic abstract layouts and builds a personalized sequence
   * using these clips verbatim.
   */
  mediaClips?: MediaClip[];
}

export interface GenerateVideoResult {
  videoUrl: string;
  templateId: string;
  templateName: string;
  durationSeconds: number;
  fromMock?: boolean;
}

export async function generateVideo(args: GenerateVideoArgs): Promise<GenerateVideoResult> {
  const template = getTemplate(args.templateId);
  if (!template) {
    throw new Error(`Unknown template: ${args.templateId}. Available: ${listTemplates().map((t) => t.id).join(', ')}`);
  }

  const props: VideoProps = {
    businessName: args.businessName,
    headline: args.headline,
    subheadline: args.subheadline,
    cta: args.cta,
    domain: args.domain,
    brand: { ...DEFAULT_BRAND, ...args.brand },
    imageUrl: args.imageUrl,
    mediaClips: args.mediaClips,
  };

  // Render to a temp file
  const tmpPath = path.join(tmpdir(), `${randomUUID()}.mp4`);

  try {
    await renderVideo({
      templateId: args.templateId,
      props,
      outputPath: tmpPath,
    });

    // Upload to R2 (or local disk in dev) via the existing uploadFile helper
    const buffer = await readFile(tmpPath);
    const { url } = await uploadFile(
      args.clientId,
      buffer,
      `${args.templateId}-${Date.now()}.mp4`,
      'video/mp4',
    );

    return {
      videoUrl: url,
      templateId: args.templateId,
      templateName: template.meta.name,
      durationSeconds: template.meta.durationFrames / 30,
      fromMock: !features.r2,
    };
  } finally {
    // Clean up temp file
    await unlink(tmpPath).catch(() => {});
  }
}

export function listVideoTemplates() {
  return listTemplates();
}

/**
 * Personalized video generation. The headline feature.
 *
 * Flow:
 *   1. Fetch the client's approved media (images + videos) and their
 *      AI-generated subject descriptions.
 *   2. Ask Claude to plan a 3–6 clip script tailored to the intent
 *      ("brand_story" | "promo" | "team_intro" | ...), picking real
 *      media by index where it fits and suggesting Flux prompts for
 *      any gap-fill stills.
 *   3. For each clip marked `wantsMotion=true`, run Flux image-to-video
 *      to animate the still. Failures are non-fatal — the clip just
 *      falls back to a Ken Burns zoom.
 *   4. Render the MediaStory template with the composed clips.
 *   5. Upload the MP4 to R2 and persist it to the client's media library
 *      with `source='ai'` so the Media Studio can filter it later.
 *
 * The whole pipeline degrades gracefully: no media -> Claude still writes
 * a script using synthesis prompts; no Fal -> photos stay still; no
 * database -> we render anyway and return the URL only.
 */

export interface PersonalizedVideoArgs {
  clientId: string;
  intent?:
    | 'brand_story'
    | 'promo'
    | 'team_intro'
    | 'menu_reveal'
    | 'before_after'
    | 'location_tour';
  clipCount?: number; // 3-6, default 5
  headline?: string;
  cta?: string;
  /**
   * Additional free-form direction from the agency — "lean on the new
   * opening in Cork", "mention winter hours", etc. Added to the Claude
   * script prompt verbatim.
   */
  direction?: string;
  /** Optional curated subset of media ids to use. Defaults to top-N by quality score. */
  selectedMediaIds?: string[];
  /**
   * When true, any clip Claude marks `wantsMotion=true` gets an actual
   * image-to-video pass via Fal. Off by default because each motion clip
   * adds ~30s of compute and counts against the fal.ai quota.
   */
  enableMotion?: boolean;
}

export interface PersonalizedVideoResult {
  videoUrl: string;
  templateId: 'media-story';
  durationSeconds: number;
  clips: Array<{
    order: number;
    caption?: string;
    eyebrow?: string;
    sourceKind: 'upload' | 'synthesis' | 'motion';
    sourceUrl: string;
    durationSeconds: number;
  }>;
  fromMock: boolean;
}

export async function generatePersonalizedVideo(
  args: PersonalizedVideoArgs,
): Promise<PersonalizedVideoResult> {
  const clipCount = Math.max(3, Math.min(6, args.clipCount ?? 5));

  if (!isDbConfigured()) {
    // Mock path so the UI can be demoed without any infra. Returns a
    // deterministic picsum-backed placeholder video URL.
    return {
      videoUrl: `https://picsum.photos/seed/personalized-${args.clientId}/1080/1920`,
      templateId: 'media-story',
      durationSeconds: 18,
      clips: Array.from({ length: clipCount }, (_, i) => ({
        order: i,
        caption: `Mock clip ${i + 1}`,
        eyebrow: i === 0 ? 'Hook' : undefined,
        sourceKind: 'upload' as const,
        sourceUrl: `https://picsum.photos/seed/p-${args.clientId}-${i}/1080/1920`,
        durationSeconds: 2.8,
      })),
      fromMock: true,
    };
  }

  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, args.clientId));
  if (!client) throw new Error('Client not found');

  // ---- 1. Pull the relevant media pool ----
  const allMedia = await db
    .select()
    .from(clientImages)
    .where(eq(clientImages.clientId, args.clientId))
    .orderBy(desc(clientImages.qualityScore), desc(clientImages.uploadedAt))
    .limit(24);

  // If the caller curated a specific subset, use just that — otherwise
  // rank by quality and take the top 12 (more than enough for 3–6 clips,
  // but keeps the prompt token count reasonable).
  const pool =
    args.selectedMediaIds && args.selectedMediaIds.length > 0
      ? allMedia.filter((m) => args.selectedMediaIds!.includes(m.id))
      : allMedia.slice(0, 12);

  const mediaDescriptions =
    pool.length > 0
      ? pool
          .map(
            (m, i) =>
              `[${i}] ${m.mimeType?.startsWith('video/') ? 'video' : 'image'}: ${
                m.aiDescription ?? m.fileName ?? 'unlabelled media'
              }${m.qualityScore ? ` (quality ${m.qualityScore}/10)` : ''}`,
          )
          .join('\n')
      : '';

  // ---- 2. Claude scripts the reel ----
  const scriptPrompt = videoScriptPrompt({
    businessName: client.businessName,
    industry: client.industry ?? 'Local Business',
    brandVoice: client.brandVoice ?? 'Warm, specific, grounded. No marketing speak.',
    mediaDescriptions,
    videoIntent: args.intent ?? 'brand_story',
    clipCount,
    headline: args.headline,
    cta: args.cta,
    platform: 'instagram_reel',
  });

  interface ScriptResponse {
    hookHeadline: string;
    outroHeadline: string;
    suggestedCta?: string;
    clips: Array<{
      order: number;
      mediaIndex: number | null;
      synthesisPrompt?: string;
      wantsMotion?: boolean;
      motionPrompt?: string;
      eyebrow?: string | null;
      caption?: string;
      durationSeconds?: number;
      focalX?: number;
      focalY?: number;
      rationale?: string;
    }>;
  }

  const script = await withRetry(
    () => generateJSON<ScriptResponse>(scriptPrompt, { model: 'sonnet', maxTokens: 2048 }),
    { label: `video_script:${args.clientId}`, attempts: 2 },
  );

  broadcast({
    type: 'video:scripted',
    payload: { clientId: args.clientId, clipCount: script.clips?.length ?? 0 },
  });

  // ---- 3. Resolve each clip to a concrete URL ----
  const clipResolutions: Array<{
    order: number;
    url: string;
    kind: 'image' | 'video';
    sourceKind: 'upload' | 'synthesis' | 'motion';
    eyebrow?: string;
    caption?: string;
    durationSeconds: number;
    focalX: number;
    focalY: number;
  }> = [];

  const ordered = (script.clips ?? []).slice(0, clipCount).sort((a, b) => a.order - b.order);
  for (const clip of ordered) {
    const eyebrow = clip.eyebrow && clip.eyebrow.trim().length > 0 ? clip.eyebrow : undefined;
    const caption = clip.caption?.trim();
    const durationSeconds = clamp(clip.durationSeconds ?? 2.8, 2, 5);
    const focalX = clamp(clip.focalX ?? 0.5, 0, 1);
    const focalY = clamp(clip.focalY ?? 0.5, 0, 1);

    let url: string | undefined;
    let kind: 'image' | 'video' = 'image';
    let sourceKind: 'upload' | 'synthesis' | 'motion' = 'upload';

    if (clip.mediaIndex !== null && clip.mediaIndex !== undefined && pool[clip.mediaIndex]) {
      const picked = pool[clip.mediaIndex]!;
      url = picked.enhancedUrl ?? picked.fileUrl;
      kind = (picked.mimeType ?? '').startsWith('video/') ? 'video' : 'image';
      sourceKind = 'upload';
    } else if (clip.synthesisPrompt) {
      // Gap-fill via Flux image generation. We target 9:16 to match the reel.
      try {
        url = await withRetry(() => generateImage(clip.synthesisPrompt!, '9:16'), {
          label: `video_still_gen:${args.clientId}:${clip.order}`,
          attempts: 2,
        });
        kind = 'image';
        sourceKind = 'synthesis';
      } catch (e) {
        console.warn(
          `[video] synthesis failed for clip ${clip.order}:`,
          (e as Error).message,
        );
      }
    }

    if (!url) continue; // skip unrenderable clips rather than crashing the whole reel

    // Optional motion pass — only for stills the director asked to animate.
    if (
      args.enableMotion &&
      clip.wantsMotion &&
      kind === 'image' &&
      clip.motionPrompt &&
      features.fal
    ) {
      try {
        const animated = await withRetry(
          () => animateImage(url!, clip.motionPrompt!, { duration: 5, aspectRatio: '9:16' }),
          { label: `video_motion:${args.clientId}:${clip.order}`, attempts: 1 },
        );
        if (!animated.fromMock) {
          url = animated.videoUrl;
          kind = 'video';
          sourceKind = 'motion';
        }
      } catch (e) {
        // Motion failures are non-fatal — the still Ken Burns zoom still looks fine.
        console.warn(
          `[video] motion failed for clip ${clip.order}, using still:`,
          (e as Error).message,
        );
      }
    }

    clipResolutions.push({
      order: clip.order,
      url,
      kind,
      sourceKind,
      eyebrow,
      caption,
      durationSeconds,
      focalX,
      focalY,
    });
  }

  if (clipResolutions.length === 0) {
    throw new Error(
      'Could not assemble any clips — upload some photos for this client or enable synthesis.',
    );
  }

  // ---- 4. Render with Remotion ----
  const brand: BrandPalette = {
    ...DEFAULT_BRAND,
    ...(client.brandColors
      ? {
          primary: (client.brandColors as any).primary ?? DEFAULT_BRAND.primary,
          accent: (client.brandColors as any).accent ?? DEFAULT_BRAND.accent,
        }
      : {}),
  };

  const mediaClips: MediaClip[] = clipResolutions.map((c) => ({
    url: c.url,
    kind: c.kind,
    durationSeconds: c.durationSeconds,
    caption: c.caption,
    eyebrow: c.eyebrow,
    focalX: c.focalX,
    focalY: c.focalY,
  }));

  const rendered = await generateVideo({
    templateId: 'media-story',
    clientId: args.clientId,
    businessName: client.businessName,
    headline: script.outroHeadline || args.headline || 'Come say hello',
    subheadline: script.hookHeadline,
    cta: script.suggestedCta ?? args.cta,
    domain: client.websiteUrl ?? undefined,
    brand,
    mediaClips,
  });

  // ---- 5. Persist into the client's media library ----
  try {
    await db.insert(clientImages).values({
      clientId: args.clientId,
      fileUrl: rendered.videoUrl,
      fileName: `personalized-${Date.now()}.mp4`,
      mimeType: 'video/mp4',
      tags: ['video', 'personalized', args.intent ?? 'brand_story'],
      aiDescription: script.outroHeadline || args.headline,
      source: 'ai',
      status: 'approved',
    });
  } catch (e) {
    console.warn('[video] persist personalized video failed:', (e as Error).message);
  }

  broadcast({
    type: 'video:rendered',
    payload: { clientId: args.clientId, videoUrl: rendered.videoUrl, source: 'ai' },
  });

  return {
    videoUrl: rendered.videoUrl,
    templateId: 'media-story',
    durationSeconds: rendered.durationSeconds,
    clips: clipResolutions.map((c) => ({
      order: c.order,
      caption: c.caption,
      eyebrow: c.eyebrow,
      sourceKind: c.sourceKind,
      sourceUrl: c.url,
      durationSeconds: c.durationSeconds,
    })),
    fromMock: false,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
