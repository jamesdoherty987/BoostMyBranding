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
  INFLUENCER_PERSONAS,
  generateAvatarScript,
  generateAvatarVideo,
  generateProductReviewScript,
  generateHookVariants,
  getPersona,
} from '../services/talkingHead.js';
import { VIRAL_FORMATS, getViralFormat } from '../services/viralFormats.js';
import { HOOK_FORMULAS, getHookFormula } from '../services/viralHooks.js';
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
    // Talking-head / UGC models: explicit allowlist by id-prefix and
    // known premium entries so new avatar providers get surfaced
    // without accidentally pulling in general video models like Kling.
    const UGC_MODEL_IDS = new Set(['runway-act-one', 'omnihuman', 'higgsfield-sora-2']);
    const models = MODEL_CATALOG.filter(
      (m) =>
        m.mediaType === 'video' &&
        (m.id.startsWith('veed-') || UGC_MODEL_IDS.has(m.id)),
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
        personas: INFLUENCER_PERSONAS,
        viralFormats: VIRAL_FORMATS,
        hookFormulas: HOOK_FORMULAS,
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
  /** Influencer persona id from INFLUENCER_PERSONAS. Optional. */
  personaId: z.string().max(100).optional(),
  /** Viral format id from VIRAL_FORMATS. Optional — auto-selects when omitted. */
  formatId: z.string().max(100).optional(),
  /** Hook formula id from HOOK_FORMULAS. Optional — persona/format picks otherwise. */
  hookFormulaId: z.string().max(100).optional(),
});

talkingHeadRouter.post(
  '/script',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = scriptSchema.parse(req.body);
      if (args.personaId && !getPersona(args.personaId)) {
        return res.status(400).json({
          error: { message: `Unknown persona: ${args.personaId}`, code: 'UNKNOWN_PERSONA' },
        });
      }
      if (args.formatId && !getViralFormat(args.formatId)) {
        return res.status(400).json({
          error: { message: `Unknown viral format: ${args.formatId}`, code: 'UNKNOWN_FORMAT' },
        });
      }
      if (args.hookFormulaId && !getHookFormula(args.hookFormulaId)) {
        return res.status(400).json({
          error: { message: `Unknown hook formula: ${args.hookFormulaId}`, code: 'UNKNOWN_HOOK' },
        });
      }
      const result = await generateAvatarScript(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Generate N hook variants for the same brief. Each variant uses a
 * distinct canonical hook formula — the standard A/B setup for UGC.
 */
const hookVariantsSchema = z.object({
  clientId: z.string().uuid(),
  brief: z.string().min(10).max(2000),
  platform: z.enum(['tiktok', 'instagram_reels', 'youtube_shorts', 'generic']).default('tiktok'),
  productId: z.string().uuid().optional(),
  count: z.number().int().min(2).max(8).default(5),
  personaId: z.string().max(100).optional(),
  niche: z
    .enum([
      'ecommerce_ad',
      'saas_ad',
      'personal_brand',
      'faceless_education',
      'faceless_story',
      'lifestyle',
      'fitness',
      'beauty',
      'food',
      'tech',
      'finance',
      'general',
    ])
    .optional(),
  inspirationProfileIds: z.array(z.string().uuid()).max(10).optional(),
});

talkingHeadRouter.post(
  '/hook-variants',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = hookVariantsSchema.parse(req.body);
      if (args.personaId && !getPersona(args.personaId)) {
        return res.status(400).json({
          error: { message: `Unknown persona: ${args.personaId}`, code: 'UNKNOWN_PERSONA' },
        });
      }
      const result = await generateHookVariants(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Product-review script. Returns a short persona-voiced review of a
 * specific product. The caller uses the returned `script` with
 * `/talking-head/render` to produce the final MP4 — we keep the two
 * steps separate so the reviewer can tweak the script in-between.
 */
const productReviewSchema = z.object({
  clientId: z.string().uuid(),
  productId: z.string().uuid(),
  personaId: z.string().max(100),
  platform: z.enum(['tiktok', 'instagram_reels', 'youtube_shorts', 'generic']).default('tiktok'),
  durationSeconds: z.number().int().min(5).max(90).default(30),
  angle: z
    .enum([
      'unboxing',
      'first_impressions',
      'thirty_day_update',
      'dupe_vs_original',
      'compare',
      'how_to_use',
    ])
    .optional(),
  direction: z.string().max(1000).optional(),
  inspirationProfileIds: z.array(z.string().uuid()).max(10).optional(),
});

talkingHeadRouter.post(
  '/product-review-script',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = productReviewSchema.parse(req.body);
      if (!getPersona(args.personaId)) {
        return res.status(400).json({
          error: { message: `Unknown persona: ${args.personaId}`, code: 'UNKNOWN_PERSONA' },
        });
      }
      const result = await generateProductReviewScript(args);
      res.json({
        data: {
          script: result.script,
          estimatedDurationSeconds: result.estimatedDurationSeconds,
          fromMock: result.fromMock,
          persona: {
            id: result.persona.id,
            displayName: result.persona.displayName,
            niche: result.persona.niche,
            recommendedAvatarId: result.persona.recommendedAvatarId,
          },
        },
      });
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
      // Accept all talking-head / UGC models: veed presets plus the
      // premium roster (Runway Act-One, Omnihuman, Higgsfield Sora 2).
      const PREMIUM_UGC = new Set(['runway-act-one', 'omnihuman', 'higgsfield-sora-2']);
      const isTalkingHeadModel =
        model.mediaType === 'video' &&
        (model.id.startsWith('veed-') || PREMIUM_UGC.has(model.id));
      if (!isTalkingHeadModel) {
        return res.status(400).json({
          error: { message: `${model.displayName} is not a talking-head model`, code: 'MODEL_TYPE_MISMATCH' },
        });
      }
      if (!model.available) {
        return res.status(400).json({
          error: {
            message: `${model.displayName} requires additional credentials. Contact your admin to enable it.`,
            code: 'MODEL_UNAVAILABLE',
          },
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
