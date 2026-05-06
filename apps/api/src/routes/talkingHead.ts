/**
 * Talking-head / AI UGC video routes.
 *
 *   GET  /api/v1/talking-head/options  — list available avatars + voices + models
 *   POST /api/v1/talking-head/script   — generate a speakable script with brand context
 *   POST /api/v1/talking-head/render   — render the avatar video from a script
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../services/auth.js';
import {
  AVATAR_CATALOG,
  VOICE_CATALOG,
  generateAvatarScript,
  generateAvatarVideo,
} from '../services/talkingHead.js';
import { MODEL_CATALOG, estimateCostCents, getModel } from '../services/modelCatalog.js';
import { isDbConfigured, getDb, clientImages } from '@boost/database';
import { withRetry } from '../services/retry.js';

export const talkingHeadRouter = Router();

/**
 * Options — returns everything a picker UI needs: avatar roster, voice
 * roster, and the subset of models in the catalog that are talking-head
 * models.
 */
talkingHeadRouter.get(
  '/options',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  (_req, res) => {
    const models = MODEL_CATALOG.filter(
      (m) => m.id.startsWith('veed-') && m.mediaType === 'video',
    ).map((m) => ({
      id: m.id,
      displayName: m.displayName,
      pricePerSecondCents: m.pricePerUnitCents,
      maxDurationSeconds: m.maxDurationSeconds,
      supportedAspectRatios: m.supportedAspectRatios,
      available: m.available,
      notes: m.notes,
    }));
    res.json({
      data: {
        avatars: AVATAR_CATALOG,
        voices: VOICE_CATALOG,
        models,
      },
    });
  },
);

const scriptSchema = z.object({
  clientId: z.string().uuid(),
  brief: z.string().min(10).max(2000),
  platform: z.enum(['tiktok', 'instagram_reels', 'youtube_shorts', 'generic']).default('tiktok'),
  durationSeconds: z.number().int().min(5).max(90).default(30),
  productId: z.string().uuid().optional(),
  inspirationProfileIds: z.array(z.string().uuid()).max(10).optional(),
});

talkingHeadRouter.post(
  '/script',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = scriptSchema.parse(req.body);
      const result = await generateAvatarScript(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

const renderSchema = z.object({
  clientId: z.string().uuid(),
  modelId: z.string().max(100),
  avatarId: z.string().max(100),
  /** Optional — only used by providers that decouple voice from avatar. */
  voiceId: z.string().max(100).optional(),
  script: z.string().min(10).max(4000),
  /** Optional — veed/avatars ignores this (baked into avatar id). */
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16'),
  backgroundUrl: z.string().url().max(2000).optional(),
  /** Whether to persist the result into clientImages so it shows up in
   *  the Media Studio. Defaults to true. */
  persist: z.boolean().default(true),
});

talkingHeadRouter.post(
  '/render',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = renderSchema.parse(req.body);
      const model = getModel(args.modelId);
      if (!model) {
        return res
          .status(400)
          .json({ error: { message: `Unknown model: ${args.modelId}`, code: 'UNKNOWN_MODEL' } });
      }
      if (model.mediaType !== 'video' || !model.id.startsWith('veed-')) {
        return res.status(400).json({
          error: { message: `${model.displayName} is not a talking-head model`, code: 'MODEL_TYPE_MISMATCH' },
        });
      }

      const result = await withRetry(
        () =>
          generateAvatarVideo({
            modelId: args.modelId,
            avatarId: args.avatarId,
            voiceId: args.voiceId,
            script: args.script,
            aspectRatio: args.aspectRatio,
            backgroundUrl: args.backgroundUrl,
          }),
        { label: `talking_head_render:${args.clientId}`, attempts: 2 },
      );

      const costCents = estimateCostCents({
        videoModelId: args.modelId,
        videoDurationSeconds: result.durationSeconds,
        videoCount: 1,
      });

      let assetId: string | null = null;
      if (args.persist && isDbConfigured()) {
        try {
          const db = getDb();
          const [row] = await db
            .insert(clientImages)
            .values({
              clientId: args.clientId,
              fileUrl: result.videoUrl,
              fileName: `talking-head-${Date.now()}.mp4`,
              mimeType: 'video/mp4',
              source: 'ai',
              status: 'approved',
              tags: ['ai', 'talking-head', 'ugc', args.modelId],
              aiDescription: `AI UGC avatar (${args.avatarId}) reading a ${result.durationSeconds}s script.`,
              aiSuggestions: {
                talkingHeadProvenance: {
                  modelId: args.modelId,
                  avatarId: args.avatarId,
                  voiceId: args.voiceId ?? null,
                  script: args.script,
                  aspectRatio: args.aspectRatio,
                  costCents,
                  fromMock: result.fromMock,
                  durationSeconds: result.durationSeconds,
                  generatedAt: new Date().toISOString(),
                },
              } as any,
            })
            .returning({ id: clientImages.id });
          assetId = row?.id ?? null;
        } catch (e) {
          console.warn('[talking-head] persist failed:', (e as Error).message);
        }
      }

      res.json({
        data: {
          assetId,
          videoUrl: result.videoUrl,
          durationSeconds: result.durationSeconds,
          modelId: args.modelId,
          modelDisplayName: model.displayName,
          avatarId: args.avatarId,
          voiceId: args.voiceId ?? null,
          costCents,
          fromMock: result.fromMock,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);
