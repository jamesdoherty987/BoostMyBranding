/**
 * Video generation routes. Agency-only — clients don't hit these directly.
 *
 *   GET  /api/v1/videos/templates     — list available templates
 *   POST /api/v1/videos/render        — render a video with given props
 *
 * Rendering is synchronous and can take 10-30 seconds per video. For
 * higher throughput, move this to a background queue.
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clientImages } from '@boost/database';
import { generateVideo, generatePersonalizedVideo, listVideoTemplates } from '../services/video.js';
import { requireAuth, requireRole } from '../services/auth.js';
import { broadcast } from '../services/realtime.js';

export const videosRouter = Router();

videosRouter.get('/templates', requireAuth, (_req, res) => {
  res.json({ data: listVideoTemplates() });
});

/** List rendered / uploaded videos for a client. Pulled from `clientImages` where mime_type starts with video/. */
videosRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { role: string; clientId?: string };
    let clientId = req.query.clientId as string | undefined;
    if (user.role === 'client') clientId = user.clientId;
    if (!clientId) return res.json({ data: [] });

    if (!isDbConfigured()) return res.json({ data: [] });

    const db = getDb();
    const rows = await db
      .select()
      .from(clientImages)
      .where(eq(clientImages.clientId, clientId));
    const videos = rows.filter((r) => (r.mimeType ?? '').startsWith('video/'));
    res.json({ data: videos });
  } catch (e) {
    next(e);
  }
});

const renderSchema = z.object({
  templateId: z.string().min(1).max(100),
  clientId: z.string().min(1).max(100),
  businessName: z.string().min(1).max(200),
  headline: z.string().min(1).max(300),
  subheadline: z.string().max(300).optional(),
  cta: z.string().max(60).optional(),
  domain: z.string().max(200).optional(),
  imageUrl: z.string().url().max(1000).optional(),
  brand: z
    .object({
      primary: z.string().max(20).optional(),
      accent: z.string().max(20).optional(),
      pop: z.string().max(20).optional(),
      dark: z.string().max(20).optional(),
      paper: z.string().max(20).optional(),
    })
    .optional(),
  /**
   * Media clips used by the `media-story` template. Each clip is one of
   * the client's uploaded photos/videos or an AI-generated still. The
   * renderer ignores this field for other templates.
   */
  mediaClips: z
    .array(
      z.object({
        url: z.string().url().max(1000),
        kind: z.enum(['image', 'video']),
        durationSeconds: z.number().min(1).max(8).optional(),
        caption: z.string().max(140).optional(),
        eyebrow: z.string().max(40).optional(),
        focalX: z.number().min(0).max(1).optional(),
        focalY: z.number().min(0).max(1).optional(),
      }),
    )
    .max(6)
    .optional(),
});

videosRouter.post(
  '/render',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = renderSchema.parse(req.body);
      const result = await generateVideo(args);

      // Persist so the video appears in the client's media library.
      await persistRenderedVideo(args.clientId, result, {
        headline: args.headline,
        templateId: args.templateId,
      });

      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Batch render — renders the same scene N times (same props, same template)
 * so the agency can queue a handful quickly. Returns an array of results.
 *
 * Rendering is CPU-heavy (10-30s each). We render sequentially to keep memory
 * sane; the dashboard shows per-item progress.
 */
const batchRenderSchema = renderSchema.extend({
  count: z.number().int().min(1).max(6).default(1),
  /** Optional list of per-item headlines. If provided, overrides `headline`. */
  headlines: z.array(z.string().min(1).max(300)).max(6).optional(),
});

videosRouter.post(
  '/batch',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = batchRenderSchema.parse(req.body);
      const headlines = args.headlines && args.headlines.length > 0
        ? args.headlines
        : Array.from({ length: args.count }, () => args.headline);

      const results: Array<{
        index: number;
        ok: boolean;
        videoUrl?: string;
        headline: string;
        error?: string;
      }> = [];

      for (let i = 0; i < headlines.length; i++) {
        const h = headlines[i]!;
        try {
          const r = await generateVideo({ ...args, headline: h });
          await persistRenderedVideo(args.clientId, r, {
            headline: h,
            templateId: args.templateId,
          });
          results.push({ index: i, ok: true, videoUrl: r.videoUrl, headline: h });
        } catch (e) {
          results.push({ index: i, ok: false, headline: h, error: (e as Error).message });
        }
      }

      res.json({
        data: {
          total: results.length,
          succeeded: results.filter((r) => r.ok).length,
          items: results,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

/** Insert a clientImages row for a rendered video so it shows up in the media library. */
async function persistRenderedVideo(
  clientId: string,
  result: { videoUrl: string; templateId: string; templateName: string },
  meta: { headline: string; templateId: string },
) {
  if (!isDbConfigured()) return;
  try {
    const db = getDb();
    const [row] = await db
      .insert(clientImages)
      .values({
        clientId,
        fileUrl: result.videoUrl,
        fileName: `${meta.templateId}-${Date.now()}.mp4`,
        mimeType: 'video/mp4',
        tags: ['video', meta.templateId],
        aiDescription: meta.headline,
        source: 'template',
        status: 'approved',
      })
      .returning();
    broadcast({ type: 'video:rendered', payload: { clientId, id: row?.id } });
  } catch (e) {
    // Persistence failure shouldn't break the response; rendered video is
    // already returned to the caller and lives at the R2 URL.
    console.warn('[videos] persistRenderedVideo failed:', (e as Error).message);
  }
}

/**
 * Personalized video route. Unlike /render, this takes just a clientId and
 * an intent — the service asks Claude to plan the script from the
 * client's existing media. The heaviest route in the API: 30-60s for
 * scripting + optional motion + Remotion render.
 */
const personalizedSchema = z.object({
  clientId: z.string().uuid(),
  intent: z
    .enum(['brand_story', 'promo', 'team_intro', 'menu_reveal', 'before_after', 'location_tour'])
    .optional(),
  clipCount: z.number().int().min(3).max(6).optional(),
  headline: z.string().max(300).optional(),
  cta: z.string().max(60).optional(),
  direction: z.string().max(1000).optional(),
  selectedMediaIds: z.array(z.string().uuid()).max(24).optional(),
  enableMotion: z.boolean().optional(),
});

videosRouter.post(
  '/personalized',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = personalizedSchema.parse(req.body);
      const result = await generatePersonalizedVideo(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);
