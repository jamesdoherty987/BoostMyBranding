/**
 * Personal content automation — routes.
 *
 * Secret-ish surface for the authenticated user's own social accounts.
 * Everything is scoped to `req.user.id` — users can only see and act on
 * their own personal accounts and posts.
 *
 *   GET    /api/v1/personal/themes
 *   GET    /api/v1/personal/accounts
 *   POST   /api/v1/personal/accounts
 *   GET    /api/v1/personal/accounts/:id
 *   PATCH  /api/v1/personal/accounts/:id
 *   DELETE /api/v1/personal/accounts/:id
 *   POST   /api/v1/personal/accounts/:id/test-video-delivery-email
 *   POST   /api/v1/personal/accounts/:id/generate
 *   POST   /api/v1/personal/accounts/:id/posts/:postId/cancel
 *   POST   /api/v1/personal/accounts/:id/posts/:postId/regenerate-thumbnail
 *   POST   /api/v1/personal/accounts/:id/posts/:postId/email-delivery
 *   GET    /api/v1/personal/delivery/:token
 *   GET    /api/v1/personal/delivery/:token/video
 *   GET    /api/v1/personal/delivery/:token/preview
 *   GET    /api/v1/personal/delivery/:token/thumbnail
 *   GET    /api/v1/personal/accounts/:id/posts/:postId/download
 *   GET    /api/v1/personal/accounts/:id/posts/:postId/download-thumbnail
 *   GET    /api/v1/personal/accounts/:id/posts
 *   DELETE /api/v1/personal/accounts/:id/posts/failed
 *   DELETE /api/v1/personal/accounts/:id/posts/:postId
 *   GET    /api/v1/personal/features
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { requirePersonalAuth } from '../services/auth.js';
import { listThemes, themeSummary, getTheme } from '../services/personalThemes.js';
import {
  listAllThemesForUser,
  findThemeForUser,
  listCustomThemes,
  getCustomTheme,
  createCustomTheme,
  updateCustomTheme,
  deleteCustomTheme,
  cloneBuiltinForEdit,
} from '../services/personalCustomThemes.js';
import {
  createAccount,
  listAccounts,
  getAccount,
  updateAccount,
  deleteAccount,
  deleteFailedPosts,
  deletePersonalPost,
  listPosts,
  cancelPersonalPostGeneration,
  createReservedQueuedPersonalPost,
  markPersonalPostQueuedFailedIfStillQueued,
  regeneratePersonalPostThumbnail,
  resolvePersonalPostVideoDownload,
  resolvePersonalPostThumbnailDownload,
} from '../services/personalAccounts.js';
import type { PersonalAccountStyleBible } from '@boost/database';
import { getDb, personalPosts } from '@boost/database';
import { desc, eq, and, isNotNull } from 'drizzle-orm';
import { generateForAccount } from '../services/personalPipeline.js';
import { assertPersonalVideoExampleTitlesOrThrow, isExampleTitlesRequiredError } from '../services/personalTitlePolicy.js';
import { enqueuePersonalGenerateForAccount } from '../services/personalGenerateQueue.js';
import { scraperFeatures } from '../services/personalScraper.js';
import { voiceFeatures } from '../services/personalVoice.js';
import {
  listAiModels,
  getAiModel,
} from '../services/personalAiModels.js';
import {
  createCharacter,
  listCharacters,
  getCharacter,
  updateCharacter,
  deleteCharacter,
  analyzeCharacterRefs,
} from '../services/personalCharacters.js';
import {
  uploadAccountMedia,
  listAccountMedia,
  getAccountMedia,
  updateAccountMedia,
  deleteAccountMedia,
} from '../services/personalAccountMedia.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { features } from '../env.js';
import { normalizeUploadImageIfAvif } from '../lib/normalizeUploadImage.js';
import { emailPersonalVideoReady } from '../services/personalVideoDeliveryEmail.js';
import {
  personalDeliveryPublicBase,
  personalDeliverySavePageHtml,
  PERSONAL_DELIVERY_PAGE_CSP,
  resolvePersonalDeliveryAsset,
} from '../services/personalDeliveryLinks.js';

export const personalRouter = Router();

const PLATFORMS = [
  'instagram',
  'facebook',
  'linkedin',
  'tiktok',
  'x',
  'pinterest',
  'bluesky',
  'youtube',
  'google_business',
] as const;

/* ─── Public email delivery links (signed token, no session) ─────── */

function dispositionFilename(filename: string): { safe: string; utf8Name: string } {
  const safe =
    filename.replace(/[\r\n"]/g, '').replace(/[^\x20-\x7E]+/g, '_').slice(0, 180) || 'download';
  const utf8Name = encodeURIComponent(filename.replace(/[\r\n"]/g, '')).slice(0, 240);
  return { safe, utf8Name };
}

personalRouter.get('/delivery/:token', async (req, res, next) => {
  try {
    const token = decodeURIComponent(String(req.params.token ?? ''));
    const asset = await resolvePersonalDeliveryAsset(token);
    if (!asset) {
      res.status(404).type('html').send(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px"><p>This link is invalid or expired.</p></body></html>`,
      );
      return;
    }
    const base = `${personalDeliveryPublicBase()}/api/v1/personal/delivery/${encodeURIComponent(token)}`;
    const actionRaw = String(req.query.a ?? '').trim().toLowerCase();
    const action =
      actionRaw === 'copy' ||
      actionRaw === 'video' ||
      actionRaw === 'thumb' ||
      actionRaw === 'preview'
        ? actionRaw
        : null;
    res
      .status(200)
      .type('html')
      .setHeader('Cache-Control', 'private, no-store')
      .setHeader('Content-Security-Policy', PERSONAL_DELIVERY_PAGE_CSP)
      .send(
        personalDeliverySavePageHtml({
          title: asset.title,
          videoDownloadUrl: `${base}/video`,
          thumbnailDownloadUrl: asset.thumbnailUrl ? `${base}/thumbnail` : null,
          previewUrl: `${base}/preview`,
          videoFilename: asset.videoFilename,
          thumbnailFilename: asset.thumbnailFilename,
          action,
        }),
      );
  } catch (e) {
    next(e);
  }
});

async function streamDeliveryAsset(
  req: import('express').Request,
  res: import('express').Response,
  args: {
    upstreamUrl: string;
    filename: string;
    fallbackContentType: string;
    asAttachment: boolean;
  },
): Promise<void> {
  const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
  const wantRange = Boolean(rangeHeader && !args.asAttachment);

  async function openUpstream(withRange: boolean) {
    const upstreamHeaders: Record<string, string> = {};
    if (withRange && rangeHeader) upstreamHeaders.Range = rangeHeader;
    return fetch(args.upstreamUrl, {
      redirect: 'follow',
      headers: upstreamHeaders,
    });
  }

  // Forward Range so HTML5 <video> can seek / start playback (esp. iOS Safari).
  let upstream = await openUpstream(wantRange);
  if (wantRange && (upstream.status === 416 || (!upstream.ok && upstream.status !== 206))) {
    upstream = await openUpstream(false);
  }
  if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
    res.status(502).json({ error: { message: 'Could not fetch media', code: 'UPSTREAM_FAILED' } });
    return;
  }
  const ct = upstream.headers.get('content-type') || args.fallbackContentType;
  const { safe, utf8Name } = dispositionFilename(args.filename);
  res.status(upstream.status === 206 ? 206 : 200);
  res.setHeader('Content-Type', ct);
  res.setHeader(
    'Content-Disposition',
    `${args.asAttachment ? 'attachment' : 'inline'}; filename="${safe}"; filename*=UTF-8''${utf8Name}`,
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Accept-Ranges', 'bytes');
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);
  const contentRange = upstream.headers.get('content-range');
  if (contentRange) res.setHeader('Content-Range', contentRange);
  const nodeReadable = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
  try {
    await pipeline(nodeReadable, res);
  } catch (pipeErr) {
    if (!res.writableEnded) {
      try {
        res.destroy();
      } catch {
        /* ignore */
      }
    }
    console.warn('[personal.delivery] pipe:', (pipeErr as Error).message);
  }
}

personalRouter.get('/delivery/:token/video', async (req, res, next) => {
  try {
    const token = decodeURIComponent(String(req.params.token ?? ''));
    const asset = await resolvePersonalDeliveryAsset(token);
    if (!asset) {
      return res.status(404).json({ error: { message: 'Invalid or expired link', code: 'NOT_FOUND' } });
    }
    await streamDeliveryAsset(req, res, {
      upstreamUrl: asset.videoUrl,
      filename: asset.videoFilename,
      fallbackContentType: 'video/mp4',
      asAttachment: true,
    });
  } catch (e) {
    next(e);
  }
});

personalRouter.get('/delivery/:token/preview', async (req, res, next) => {
  try {
    const token = decodeURIComponent(String(req.params.token ?? ''));
    const asset = await resolvePersonalDeliveryAsset(token);
    if (!asset) {
      return res.status(404).json({ error: { message: 'Invalid or expired link', code: 'NOT_FOUND' } });
    }
    await streamDeliveryAsset(req, res, {
      upstreamUrl: asset.videoUrl,
      filename: asset.videoFilename,
      fallbackContentType: 'video/mp4',
      asAttachment: false,
    });
  } catch (e) {
    next(e);
  }
});

personalRouter.get('/delivery/:token/thumbnail', async (req, res, next) => {
  try {
    const token = decodeURIComponent(String(req.params.token ?? ''));
    const asset = await resolvePersonalDeliveryAsset(token);
    if (!asset?.thumbnailUrl) {
      return res.status(404).json({ error: { message: 'No thumbnail', code: 'NO_THUMBNAIL' } });
    }
    await streamDeliveryAsset(req, res, {
      upstreamUrl: asset.thumbnailUrl,
      filename: asset.thumbnailFilename,
      fallbackContentType: 'image/jpeg',
      asAttachment: true,
    });
  } catch (e) {
    next(e);
  }
});

/* ─── Themes ─────────────────────────────────────────────────────── */

personalRouter.get('/themes', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const merged = await listAllThemesForUser(user.id);
    res.json({ data: merged.map(themeSummary) });
  } catch (e) {
    next(e);
  }
});

/* ─── Custom themes (user-editable library) ────────────────────── */

const customThemeSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, or dashes.'),
  name: z.string().min(1).max(120),
  tagline: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  emoji: z.string().min(1).max(10).optional(),
  accentColor: z.string().max(20).optional(),
  viralityScore: z.number().int().min(1).max(10).optional(),
  cpmTier: z.enum(['low', 'medium', 'high', 'premium']).optional(),
  preferredPlatforms: z
    .array(
      z.enum([
        'instagram',
        'facebook',
        'linkedin',
        'tiktok',
        'x',
        'pinterest',
        'bluesky',
        'youtube',
        'google_business',
      ]),
    )
    .max(9)
    .optional(),
  template: z
    .enum([
      'viral-text',
      'news-reel',
      'fact-drop',
      'quote-card',
      'language-card',
      'listicle',
      'brainrot',
      'story-narration',
      'slideshow',
      'satisfying-loop',
      'scripture-card',
      'animated-explainer',
    ])
    .optional(),
  mediaSources: z
    .array(
      z.enum(['pexels', 'unsplash', 'pixabay', 'wikipedia', 'news', 'ai', 'gameplay']),
    )
    .optional(),
  useVoiceover: z.boolean().optional(),
  useMusic: z.boolean().optional(),
  hookFormulas: z.array(z.string().max(300)).max(20).optional(),
  topicSeeds: z.array(z.string().max(200)).max(50).optional(),
  voiceGuide: z.string().max(2000).optional(),
  visualStyle: z.string().max(2000).optional(),
  musicMood: z.string().max(200).optional(),
  // Up to 480s (8 min) so users can create custom long-form animated
  // explainer themes alongside the built-in ones.
  targetDurationSeconds: z.number().int().min(8).max(480).optional(),
  defaultHashtags: z.array(z.string().max(60)).max(20).optional(),
  requiresGroundedImages: z.boolean().optional(),
  defaultFormat: z.enum(['video', 'slideshow', 'static_image']).optional(),
  overridesBuiltin: z.boolean().optional(),
});

personalRouter.get('/custom-themes', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    res.json({ data: await listCustomThemes(user.id) });
  } catch (e) {
    next(e);
  }
});

personalRouter.post('/custom-themes', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const body = customThemeSchema.parse(req.body);
    const row = await createCustomTheme({ userId: user.id, ...body });
    res.status(201).json({ data: row });
  } catch (e) {
    next(e);
  }
});

const customThemePatchSchema = customThemeSchema.partial().omit({ slug: true });

personalRouter.patch('/custom-themes/:id', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const body = customThemePatchSchema.parse(req.body);
    const row = await updateCustomTheme(user.id, String(req.params.id), body);
    if (!row)
      return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

personalRouter.delete('/custom-themes/:id', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const ok = await deleteCustomTheme(user.id, String(req.params.id));
    if (!ok)
      return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

const cloneSchema = z.object({
  builtinId: z.string().min(1).max(100),
  mode: z.enum(['override', 'duplicate']).default('duplicate'),
});

personalRouter.post('/custom-themes/clone', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const body = cloneSchema.parse(req.body);
    const row = await cloneBuiltinForEdit({ userId: user.id, ...body });
    res.status(201).json({ data: row });
  } catch (e) {
    next(e);
  }
});

/* ─── Features snapshot ─────────────────────────────────────────── */

personalRouter.get('/features', requirePersonalAuth, (_req, res) => {
  res.json({
    data: {
      db: features.db,
      claude: features.claude,
      contentStudio: features.contentStudio,
      contentStudioDefaultWorkspace: features.contentStudioDefaultWorkspace,
      contentStudioAppUrl: features.contentStudioAppUrl,
      fal: features.fal,
      scrapers: {
        pexels: scraperFeatures.pexels,
        unsplash: scraperFeatures.unsplash,
        pixabay: scraperFeatures.pixabay,
        wikipedia: scraperFeatures.wikipedia,
        googleNews: scraperFeatures.googleNews,
      },
      voice: {
        elevenlabs: voiceFeatures.elevenlabs,
        openai: voiceFeatures.openai,
      },
      resend: features.resend,
      personalPublicAccess: features.personalPublicAccess,
    },
  });
});

/**
 * JSONB often stores explicit `null` for unset generator keys. Zod's
 * `z.number().optional()` rejects null — strip nulls / null array entries
 * before validating PATCH bodies so the dashboard save button works.
 */
function sanitizePersonalAccountPatchBody(body: Record<string, unknown>): void {
  if (body.videoDeliveryEmail === '') body.videoDeliveryEmail = null;
  const gen = body.generatorConfig;
  if (gen && typeof gen === 'object' && !Array.isArray(gen)) {
    body.generatorConfig = Object.fromEntries(
      Object.entries(gen as Record<string, unknown>).filter(([, v]) => v != null),
    );
  }
  const sb = body.styleBible;
  if (sb && typeof sb === 'object' && !Array.isArray(sb)) {
    const next: Record<string, unknown> = { ...(sb as Record<string, unknown>) };
    for (const key of Object.keys(next)) {
      const v = next[key];
      if (v === null || v === undefined) {
        delete next[key];
        continue;
      }
      if (Array.isArray(v)) {
        next[key] = v.filter((item) => item != null && item !== '');
      }
    }
    body.styleBible = next;
  }
}

const keywordOverlayTextAnchorZ = z.enum([
  'top_left',
  'top_center',
  'top_right',
  'middle_left',
  'center',
  'middle_right',
  'bottom_left',
  'bottom_center',
  'bottom_right',
]);

const keywordOverlayFontIdZ = z.enum([
  'inter',
  'lora',
  'source_serif',
  'jetbrains_mono',
  'oswald',
  'dm_sans',
  'clean_sans',
  'clean_serif',
]);

const keywordOverlayAspectOverrideZ = z.object({
  fontPreset: keywordOverlayFontIdZ.optional(),
  fontScale: z.number().min(0.72).max(2.25).optional(),
  textBackground: z.boolean().optional(),
  textAnchor: keywordOverlayTextAnchorZ.optional(),
});

const keywordOverlayByAspectZ = z
  .object({
    '9:16': keywordOverlayAspectOverrideZ.optional(),
    '1:1': keywordOverlayAspectOverrideZ.optional(),
    '16:9': keywordOverlayAspectOverrideZ.optional(),
    '4:5': keywordOverlayAspectOverrideZ.optional(),
  })
  .optional();

/* ─── Accounts CRUD ─────────────────────────────────────────────── */

const createAccountBodySchema = z.object({
  accountName: z.string().min(1).max(200),
  platform: z.enum(PLATFORMS),
  themeId: z.string().min(1).max(100),
  handle: z.string().max(100).optional(),
  contentStudioWorkspaceId: z.string().max(200).nullable().optional(),
  contentStudioAccountId: z.string().max(200).nullable().optional(),
  customDirection: z.string().max(2000).optional(),
  topicSeeds: z.array(z.string().max(200)).max(50).optional(),
  topicBlacklist: z.array(z.string().max(200)).max(50).optional(),
  language: z.string().length(2).optional(),
  voiceId: z.string().max(100).optional(),
  locale: z.string().max(10).optional(),
  postsPerDay: z.number().int().min(1).max(4).optional(),
  postingHourUtc: z.number().int().min(0).max(23).optional(),
  postingMinuteUtc: z.number().int().min(0).max(59).optional(),
  postSpacingMinutes: z.number().int().min(30).max(720).optional(),
  autoApprove: z.boolean().optional(),
  autoSchedule: z.boolean().optional(),
  emailVideoOnReady: z.boolean().optional(),
  videoDeliveryEmail: z.string().email().max(320).nullable().optional(),
  autoGenerateOnSchedule: z.boolean().optional(),
  accentColor: z.string().max(20).optional(),
  logoUrl: z.string().url().max(1000).optional(),
  watermarkHandle: z.string().max(100).optional(),
  characterId: z.string().uuid().nullable().optional(),
  formatKind: z.enum(['video', 'slideshow', 'static_image']).optional(),
  customAudioUrl: z.string().url().max(1000).nullable().optional(),
  customAudioAttribution: z.string().max(200).nullable().optional(),
  styleBible: z
    .object({
      vibe: z.string().max(4000).optional(),
      dos: z.array(z.string().max(200)).max(40).optional(),
      donts: z.array(z.string().max(200)).max(40).optional(),
      palette: z.array(z.string().max(20)).max(12).optional(),
      typography: z.string().max(500).optional(),
      exampleVideoTitles: z.array(z.string().max(200)).max(25).optional(),
      videoTitleGuidance: z.string().max(1500).optional(),
      referenceFullScripts: z.array(z.string().max(25000)).max(5).optional(),
    })
    .passthrough()
    .optional(),
  generatorConfig: z
    .object({
      imageModelId: z.string().max(100).optional(),
      videoModelId: z.string().max(100).optional(),
      ttsProvider: z.enum(['elevenlabs', 'openai', 'cartesia', 'none']).optional(),
      ttsVoiceId: z.string().max(100).optional(),
      voiceAccent: z.enum(['american', 'british']).optional(),
      voiceGender: z.enum(['female', 'male']).optional(),
      useVoiceover: z.boolean().optional(),
      useMusic: z.boolean().optional(),
      useSubtitles: z.boolean().optional(),
      useAiVideo: z.boolean().optional(),
      useAiImages: z.boolean().optional(),
      useScrapedMedia: z.boolean().optional(),
      useCharacter: z.boolean().optional(),
      qualityTier: z.enum(['max', 'balanced', 'budget']).optional(),
      aspectRatio: z.enum(['9:16', '1:1', '16:9', '4:5']).optional(),
      clipMinSeconds: z.number().min(1).max(20).optional(),
      clipMaxSeconds: z.number().min(1).max(30).optional(),
      averageClipSeconds: z.number().min(1).max(12).optional(),
      mediaPreference: z
        .enum(['mixed', 'stills_only', 'motion_preferred', 'video_only'])
        .optional(),
      cutPace: z.enum(['relaxed', 'normal', 'rapid']).optional(),
      keywordPopStyle: z.enum(['off', 'subtle', 'bold']).optional(),
      allowSparseImageText: z.boolean().optional(),
      directorShotOnScreenCopy: z.boolean().optional(),
      ttsSpeed: z.number().min(0.7).max(1.2).optional(),
      musicDuckUnderVoice: z.number().min(0.05).max(0.55).optional(),
      musicSoloVolume: z.number().min(0.1).max(0.85).optional(),
      musicBedVolume: z.number().min(0.05).max(0.5).optional(),
      musicBackgroundLevel: z.number().int().min(1).max(10).optional(),
      trueStoriesOnly: z.boolean().optional(),
      extraContentRules: z.string().max(4000).optional(),
      minQualityScore: z.number().min(0).max(100).optional(),
      allowWebResearch: z.boolean().optional(),
      scriptModel: z.enum(['sonnet', 'opus']).optional(),
      useDirector: z.boolean().optional(),
      viralFormatId: z.string().max(80).optional(),
      hookFormulaId: z.string().max(80).optional(),
      colourGrade: z
        .enum(['natural', 'warm', 'cool', 'teal_orange', 'film', 'bw', 'high_contrast'])
        .optional(),
      letterbox: z.boolean().optional(),
      filmGrain: z.boolean().optional(),
      /** When false, stills are static in the final stitch (no Ken Burns). */
      kenBurnsOnStills: z.boolean().optional(),
      longformEnabled: z.boolean().optional(),
      longformTargetSeconds: z.number().positive().max(480).optional(),
      longformAnimationStyle: z
        .enum([
          'storybook',
          'cartoon',
          'stick_figure',
          'claymation',
          'pixel_art',
          'watercolour',
          'custom',
        ])
        .optional(),
      longformMaxAiVideoShots: z.number().int().min(0).max(20).optional(),
      longformIntroEnabled: z.boolean().optional(),
      longformIntroSeconds: z.number().min(1.5).max(5).optional(),
      stitchEncodePreset: z.enum(['fast', 'balanced', 'high']).optional(),
      /** Opening white slate with title, channel, topic, and scene stats (director stitch). */
      namesNumbersTitleCard: z.boolean().optional(),
      keywordOverlayFontPreset: keywordOverlayFontIdZ.optional(),
      keywordOverlayFontScale: z.number().min(0.72).max(2.25).optional(),
      keywordOverlayTextBackground: z.boolean().optional(),
      keywordOverlayTextAnchor: keywordOverlayTextAnchorZ.optional(),
      keywordOverlayByAspect: keywordOverlayByAspectZ,
    })
    .passthrough()
    .optional(),
});

const createSchema = createAccountBodySchema.superRefine((data, ctx) => {
  const g = data.generatorConfig;
  if (
    g &&
    typeof g.clipMinSeconds === 'number' &&
    typeof g.clipMaxSeconds === 'number' &&
    g.clipMinSeconds > g.clipMaxSeconds
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'clipMinSeconds must be ≤ clipMaxSeconds',
      path: ['generatorConfig', 'clipMaxSeconds'],
    });
  }
  if (
    g &&
    g.longformEnabled === true &&
    typeof g.longformTargetSeconds === 'number' &&
    (g.longformTargetSeconds < 60 || g.longformTargetSeconds > 480)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'longformTargetSeconds must be between 60 and 480',
      path: ['generatorConfig', 'longformTargetSeconds'],
    });
  }
});

const patchSchema = createAccountBodySchema.partial().extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
});

/** Fix inverted clip bounds and clamp long-form target after Zod parse (PATCH only). */
function normalizeGeneratorConfigPatch(gen: Record<string, unknown> | undefined): void {
  if (!gen || typeof gen !== 'object') return;
  const min = gen.clipMinSeconds;
  const max = gen.clipMaxSeconds;
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    gen.clipMinSeconds = max;
    gen.clipMaxSeconds = min;
  }
  if (gen.longformEnabled === true && typeof gen.longformTargetSeconds === 'number') {
    const t = gen.longformTargetSeconds;
    gen.longformTargetSeconds = Math.min(480, Math.max(60, t));
  }
  if (typeof gen.longformIntroSeconds === 'number') {
    gen.longformIntroSeconds = Math.min(5, Math.max(1.5, gen.longformIntroSeconds));
  }
  if (typeof gen.keywordOverlayFontScale === 'number' && Number.isFinite(gen.keywordOverlayFontScale)) {
    gen.keywordOverlayFontScale = Math.min(2.25, Math.max(0.72, gen.keywordOverlayFontScale));
  }
  const by = gen.keywordOverlayByAspect as Record<string, unknown> | undefined;
  if (by && typeof by === 'object' && !Array.isArray(by)) {
    for (const k of ['9:16', '1:1', '16:9', '4:5'] as const) {
      const o = by[k];
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        const rec = o as Record<string, unknown>;
        if (typeof rec.fontScale === 'number' && Number.isFinite(rec.fontScale)) {
          rec.fontScale = Math.min(2.25, Math.max(0.72, rec.fontScale));
        }
      }
    }
  }
}

personalRouter.post('/accounts', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    if (req.body && typeof req.body === 'object' && (req.body as Record<string, unknown>).videoDeliveryEmail === '') {
      (req.body as Record<string, unknown>).videoDeliveryEmail = null;
    }
    const body = createSchema.parse(req.body);
    // Look up the theme across built-ins + user customs. Built-ins are
    // immediately resolvable; customs require a DB hit.
    const theme = getTheme(body.themeId) ?? (await findThemeForUser(user.id, body.themeId));
    if (!theme) {
      return res
        .status(400)
        .json({ error: { message: 'Unknown theme', code: 'BAD_THEME' } });
    }
    const row = await createAccount({ userId: user.id, ...body });
    res.status(201).json({ data: row });
  } catch (e) {
    next(e);
  }
});

personalRouter.get('/accounts', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    res.json({ data: await listAccounts(user.id) });
  } catch (e) {
    next(e);
  }
});

personalRouter.get('/accounts/:id', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const row = await getAccount(user.id, String(req.params.id));
    if (!row) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

personalRouter.patch('/accounts/:id', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const raw = req.body as Record<string, unknown>;
    sanitizePersonalAccountPatchBody(raw);
    const body = patchSchema.parse(raw);
    if (body.generatorConfig && typeof body.generatorConfig === 'object') {
      normalizeGeneratorConfigPatch(body.generatorConfig as Record<string, unknown>);
    }
    const row = await updateAccount(user.id, String(req.params.id), body);
    if (!row) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

personalRouter.delete('/accounts/:id', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const ok = await deleteAccount(user.id, String(req.params.id));
    if (!ok) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

/**
 * Send a one-off "video ready" email using the account's saved delivery settings
 * and the latest ready MP4 URL (or a placeholder link if none exist).
 */
personalRouter.post(
  '/accounts/:id/test-video-delivery-email',
  requirePersonalAuth,
  async (req, res, next) => {
    try {
      if (!features.resend) {
        return res.status(503).json({
          error: {
            message: 'RESEND_API_KEY is not configured on the API',
            code: 'RESEND_OFF',
          },
        });
      }
      const user = (req as any).user as { id: string };
      const accountId = String(req.params.id);
      const row = await getAccount(user.id, accountId);
      if (!row) {
        return res
          .status(404)
          .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      }
      if (!row.emailVideoOnReady) {
        return res.status(400).json({
          error: {
            message: 'Turn on “Email when ready” and save posting settings first',
            code: 'EMAIL_OFF',
          },
        });
      }
      const to = (row.videoDeliveryEmail ?? '').trim();
      if (!to) {
        return res.status(400).json({
          error: {
            message: 'Set a delivery email and save posting settings first',
            code: 'EMAIL_MISSING',
          },
        });
      }

      const db = getDb();
      const [latest] = await db
        .select({
          id: personalPosts.id,
          videoUrl: personalPosts.videoUrl,
          topic: personalPosts.topic,
          caption: personalPosts.caption,
        })
        .from(personalPosts)
        .where(
          and(eq(personalPosts.accountId, accountId), isNotNull(personalPosts.videoUrl)),
        )
        .orderBy(desc(personalPosts.createdAt))
        .limit(1);

      const videoUrl =
        (latest?.videoUrl ?? '').trim() ||
        'https://example.com/boostmybranding-test-video.mp4';
      const postId = latest?.id ?? `test-${Date.now()}`;

      const result = await emailPersonalVideoReady({
        accountId,
        postId,
        videoUrl,
        topic: (latest?.topic ?? '').trim() || 'Test delivery email',
        captionPreview:
          (latest?.caption ?? '').trim() ||
          'This is a test from Personal → Posting (Send test email).',
        requireAutoToggle: false,
      });
      if (!result.ok) {
        const status =
          result.code === 'EMAIL_MISSING' ||
          result.code === 'EMAIL_INVALID' ||
          result.code === 'NO_VIDEO'
            ? 400
            : result.code === 'RESEND_OFF'
              ? 503
              : 500;
        return res.status(status).json({
          error: { message: result.message, code: result.code },
        });
      }

      res.json({
        data: {
          ok: true,
          to: result.to,
          usedPostId: latest?.id ?? null,
          usedRealVideo: Boolean(latest?.videoUrl),
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

/* ─── Generate now ──────────────────────────────────────────────── */

const generateSchema = z.object({
  topic: z.string().max(500).optional(),
  autoSchedule: z.boolean().optional(),
  /** When true, schedule to ContentStudio after render if API + workspace are configured (ignores autoApprove). */
  scheduleToContentStudio: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional(),
  dryRun: z.boolean().optional(),
});

personalRouter.post('/accounts/:id/generate', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const account = await getAccount(user.id, String(req.params.id));
    if (!account) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    if (account.status === 'archived') {
      return res.status(400).json({
        error: {
          message: 'Cannot generate for an archived channel.',
          code: 'ACCOUNT_ARCHIVED',
        },
      });
    }
    try {
      assertPersonalVideoExampleTitlesOrThrow(
        account.formatKind,
        account.styleBible as PersonalAccountStyleBible | null,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isExampleTitlesRequiredError(msg)) {
        return res.status(400).json({
          error: {
            code: 'EXAMPLE_TITLES_REQUIRED',
            message: msg.replace(/^EXAMPLE_TITLES_REQUIRED:\s*/, ''),
          },
        });
      }
      throw e;
    }
    const body = generateSchema.parse(req.body ?? {});
    let reservedPostId: string | undefined;
    if (!body.dryRun) {
      const reserved = await createReservedQueuedPersonalPost({
        userId: user.id,
        accountId: account.id,
        scheduleToContentStudio: body.scheduleToContentStudio,
        scheduledAt: body.scheduledAt,
        autoSchedule: body.autoSchedule,
      });
      reservedPostId = reserved.id;
    }
    const promise = enqueuePersonalGenerateForAccount(account.id, async () => {
      try {
        return await generateForAccount({
          accountId: account.id,
          topic: body.topic,
          autoSchedule: body.autoSchedule,
          scheduleToContentStudio: body.scheduleToContentStudio,
          scheduledAt: body.scheduledAt,
          dryRun: body.dryRun,
          reservedPostId,
        });
      } catch (e) {
        if (reservedPostId) {
          await markPersonalPostQueuedFailedIfStillQueued(
            reservedPostId,
            e instanceof Error ? e.message : String(e),
          );
        }
        throw e;
      }
    });
    // Pre-wait a short bit so we can catch synchronous failures (like
    // "no theme") before returning — but don't block on the render.
    const race = await Promise.race([
      promise.then((r) => ({ ok: true as const, result: r })),
      new Promise<{ ok: false; timedOut: true }>((resolve) =>
        setTimeout(() => resolve({ ok: false, timedOut: true }), 1500),
      ),
    ]);
    if (race && 'ok' in race && race.ok) {
      res.json({
        data: {
          ...race.result,
          kicked: true,
          postId: race.result.postId || reservedPostId,
        },
      });
      return;
    }
    // Still running — swallow the rejection so we don't crash the
    // process; the row's status will reflect failure and the UI polls.
    promise.catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[personal.generate] background failure:', msg, e);
    });
    res.json({ data: { kicked: true, pending: true, postId: reservedPostId } });
  } catch (e) {
    next(e);
  }
});

personalRouter.post('/accounts/:id/posts/:postId/cancel', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const accountId = String(req.params.id);
    const postId = String(req.params.postId);
    const out = await cancelPersonalPostGeneration(user.id, accountId, postId);
    if (!out.ok) {
      if (out.error === 'not_found') {
        return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      }
      return res.status(409).json({
        error: {
          message: 'That post is not generating (already finished, failed, or never started).',
          code: 'NOT_IN_PROGRESS',
        },
      });
    }
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

/**
 * Manually email this post's video to the account's configured delivery address
 * (download + iPhone Photos save steps). Does not require "Email when ready".
 */
personalRouter.post(
  '/accounts/:id/posts/:postId/email-delivery',
  requirePersonalAuth,
  async (req, res, next) => {
    try {
      if (!features.resend) {
        return res.status(503).json({
          error: {
            message: 'RESEND_API_KEY is not configured on the API',
            code: 'RESEND_OFF',
          },
        });
      }
      const user = (req as any).user as { id: string };
      const accountId = String(req.params.id);
      const postId = String(req.params.postId);
      const account = await getAccount(user.id, accountId);
      if (!account) {
        return res
          .status(404)
          .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      }

      const db = getDb();
      const [post] = await db
        .select({
          id: personalPosts.id,
          videoUrl: personalPosts.videoUrl,
          topic: personalPosts.topic,
          caption: personalPosts.caption,
        })
        .from(personalPosts)
        .where(and(eq(personalPosts.id, postId), eq(personalPosts.accountId, accountId)))
        .limit(1);

      if (!post) {
        return res
          .status(404)
          .json({ error: { message: 'Post not found', code: 'NOT_FOUND' } });
      }

      const videoUrl = (post.videoUrl ?? '').trim();
      if (!videoUrl) {
        return res.status(400).json({
          error: {
            message: 'This post has no finished video URL yet',
            code: 'NO_VIDEO',
          },
        });
      }

      const result = await emailPersonalVideoReady({
        accountId,
        postId: post.id,
        videoUrl,
        topic: (post.topic ?? '').trim() || 'Personal post',
        captionPreview: (post.caption ?? '').trim(),
        requireAutoToggle: false,
      });

      if (!result.ok) {
        const status =
          result.code === 'EMAIL_MISSING' ||
          result.code === 'EMAIL_INVALID' ||
          result.code === 'NO_VIDEO' ||
          result.code === 'EMAIL_OFF'
            ? 400
            : result.code === 'RESEND_OFF'
              ? 503
              : result.code === 'ACCOUNT_NOT_FOUND'
                ? 404
                : 500;
        return res.status(status).json({
          error: { message: result.message, code: result.code },
        });
      }

      res.json({ data: { ok: true, to: result.to } });
    } catch (e) {
      next(e);
    }
  },
);

personalRouter.post(
  '/accounts/:id/posts/:postId/regenerate-thumbnail',
  requirePersonalAuth,
  async (req, res, next) => {
    try {
      const user = (req as any).user as { id: string };
      const accountId = String(req.params.id);
      const postId = String(req.params.postId);
      const out = await regeneratePersonalPostThumbnail(user.id, accountId, postId);
      if (!out.ok) {
        if (out.error === 'not_found') {
          return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
        }
        if (out.error === 'no_video') {
          return res.status(400).json({
            error: {
              message: 'This post has no finished video URL yet — generate or wait until ready.',
              code: 'NO_VIDEO',
            },
          });
        }
        return res.status(503).json({
          error: {
            message:
              'Could not build a thumbnail (AI image, ffmpeg, or fonts). Check API logs, set PERSONAL_OVERLAY_FONT if needed, ensure ffmpeg is installed, then try again.',
            code: 'THUMBNAIL_FAILED',
          },
        });
      }
      res.json({ data: { thumbnailUrl: out.thumbnailUrl } });
    } catch (e) {
      next(e);
    }
  },
);

personalRouter.get('/accounts/:id/posts/:postId/download', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const accountId = String(req.params.id);
    const postId = String(req.params.postId);
    const resolved = await resolvePersonalPostVideoDownload(user.id, accountId, postId);
    if (!resolved.ok) {
      if (resolved.error === 'not_found') {
        return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      }
      return res.status(400).json({
        error: {
          message: 'This post has no finished video file yet.',
          code: 'NO_VIDEO',
        },
      });
    }
    const upstream = await fetch(resolved.videoUrl, { redirect: 'follow' });
    if (!upstream.ok || !upstream.body) {
      console.warn('[personal.download] upstream', upstream.status, resolved.videoUrl.slice(0, 140));
      return res.status(502).json({
        error: { message: 'Could not fetch video from storage.', code: 'UPSTREAM_FAILED' },
      });
    }
    const ct = upstream.headers.get('content-type') || 'video/mp4';
    const safe =
      resolved.filename.replace(/[\r\n"]/g, '').replace(/[^\x20-\x7E]+/g, '_').slice(0, 180) ||
      'video.mp4';
    const utf8Name = encodeURIComponent(resolved.filename.replace(/[\r\n"]/g, '')).slice(0, 240);
    res.setHeader('Content-Type', ct);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safe}"; filename*=UTF-8''${utf8Name}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    const nodeReadable = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
    try {
      await pipeline(nodeReadable, res);
    } catch (pipeErr) {
      if (!res.writableEnded) {
        try {
          res.destroy();
        } catch {
          /* ignore */
        }
      }
      console.warn('[personal.download] pipe:', (pipeErr as Error).message);
    }
  } catch (e) {
    next(e);
  }
});

personalRouter.get('/accounts/:id/posts/:postId/download-thumbnail', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const accountId = String(req.params.id);
    const postId = String(req.params.postId);
    const resolved = await resolvePersonalPostThumbnailDownload(user.id, accountId, postId);
    if (!resolved.ok) {
      if (resolved.error === 'not_found') {
        return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      }
      return res.status(400).json({
        error: {
          message: 'This post has no thumbnail image yet.',
          code: 'NO_THUMBNAIL',
        },
      });
    }
    const upstream = await fetch(resolved.imageUrl, { redirect: 'follow' });
    if (!upstream.ok || !upstream.body) {
      console.warn('[personal.download-thumbnail] upstream', upstream.status, resolved.imageUrl.slice(0, 140));
      return res.status(502).json({
        error: { message: 'Could not fetch thumbnail from storage.', code: 'UPSTREAM_FAILED' },
      });
    }
    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    const safe =
      resolved.filename.replace(/[\r\n"]/g, '').replace(/[^\x20-\x7E]+/g, '_').slice(0, 180) ||
      'thumbnail.jpg';
    const utf8Name = encodeURIComponent(resolved.filename.replace(/[\r\n"]/g, '')).slice(0, 240);
    res.setHeader('Content-Type', ct);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safe}"; filename*=UTF-8''${utf8Name}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    const nodeReadable = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
    try {
      await pipeline(nodeReadable, res);
    } catch (pipeErr) {
      if (!res.writableEnded) {
        try {
          res.destroy();
        } catch {
          /* ignore */
        }
      }
      console.warn('[personal.download-thumbnail] pipe:', (pipeErr as Error).message);
    }
  } catch (e) {
    next(e);
  }
});

/* ─── Posts ─────────────────────────────────────────────────────── */

personalRouter.get('/accounts/:id/posts', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const account = await getAccount(user.id, String(req.params.id));
    if (!account) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    const raw = req.query.limit;
    const limitStr =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw) && typeof raw[0] === 'string'
          ? raw[0]
          : undefined;
    const parsed = limitStr ? Number.parseInt(limitStr, 10) : NaN;
    const limit = Number.isFinite(parsed) ? parsed : 250;
    const posts = await listPosts(account.id, limit);
    res.json({ data: posts });
  } catch (e) {
    next(e);
  }
});

personalRouter.delete('/accounts/:id/posts/failed', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const accountId = String(req.params.id);
    const n = await deleteFailedPosts(user.id, accountId);
    if (n === null) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: { deleted: n } });
  } catch (e) {
    next(e);
  }
});

personalRouter.delete('/accounts/:id/posts/:postId', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const accountId = String(req.params.id);
    const postId = String(req.params.postId);
    const deleted = await deletePersonalPost(user.id, accountId, postId);
    if (deleted === null) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    if (!deleted) {
      return res
        .status(404)
        .json({ error: { message: 'Post not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

/* ═══════════════════════════════════════════════════════════════════ */
/* Account media library                                                */
/* ═══════════════════════════════════════════════════════════════════ */

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MEDIA_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/m4a',
]);
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (MEDIA_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported mime: ${file.mimetype}`));
  },
});

const ROLES = [
  'style_reference',
  'avatar_reference',
  'brand_asset',
  'broll',
  'voice_sample',
  'music',
  'inspiration',
  'location',
  'product',
] as const;

personalRouter.post(
  '/accounts/:id/media',
  requirePersonalAuth,
  uploadLimiter,
  mediaUpload.array('files', 10),
  async (req, res, next) => {
    try {
      const user = (req as any).user as { id: string };
      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length === 0) {
        return res
          .status(400)
          .json({ error: { message: 'No files', code: 'NO_FILES' } });
      }
      const role = (req.body.role ?? 'inspiration') as (typeof ROLES)[number];
      if (!ROLES.includes(role)) {
        return res
          .status(400)
          .json({ error: { message: 'Unknown role', code: 'BAD_ROLE' } });
      }
      const description = String(req.body.description ?? '').slice(0, 4000) || undefined;
      const tags = (req.body.tags ? String(req.body.tags).split(',') : [])
        .map((s: string) => s.trim())
        .filter(Boolean);
      const characterId = req.body.characterId ? String(req.body.characterId) : undefined;
      const pinned = req.body.pinned === 'true';

      const uploaded: Awaited<ReturnType<typeof uploadAccountMedia>>[] = [];
      const skipped: Array<{ fileName: string; message: string; code?: string }> = [];

      for (const file of files) {
        const displayName = file.originalname || 'unnamed';
        let buffer = file.buffer;
        let fileName = file.originalname;
        let mimeType = file.mimetype;
        try {
          try {
            const n = await normalizeUploadImageIfAvif({ buffer, mimeType, fileName });
            buffer = n.buffer;
            fileName = n.fileName;
            mimeType = n.mimeType;
          } catch {
            skipped.push({
              fileName: displayName,
              message: 'Could not convert AVIF image to PNG',
              code: 'AVIF_CONVERT',
            });
            continue;
          }
          if (buffer.length > MAX_MEDIA_BYTES) {
            skipped.push({
              fileName: displayName,
              message: 'File too large after conversion',
              code: 'TOO_LARGE',
            });
            continue;
          }
          const payload = await uploadAccountMedia({
            userId: user.id,
            accountId: String(req.params.id),
            buffer,
            fileName,
            mimeType,
            role,
            description,
            tags,
            characterId,
            pinned,
          });
          uploaded.push(payload);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          skipped.push({
            fileName: displayName,
            message: msg || 'Upload failed',
            code: 'UPLOAD_FAILED',
          });
        }
      }

      res.status(201).json({ data: { uploaded, skipped } });
    } catch (e) {
      next(e);
    }
  },
);

personalRouter.get('/accounts/:id/media', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const role = req.query.role ? String(req.query.role) : undefined;
    const characterId = req.query.characterId ? String(req.query.characterId) : undefined;
    const items = await listAccountMedia(user.id, String(req.params.id), {
      role: role as any,
      characterId,
    });
    res.json({ data: items });
  } catch (e) {
    next(e);
  }
});

const mediaPatchSchema = z.object({
  description: z.string().max(4000).nullable().optional(),
  tags: z.array(z.string().max(60)).max(40).optional(),
  role: z.enum(ROLES).optional(),
  characterId: z.string().uuid().nullable().optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

personalRouter.patch('/media/:mediaId', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const body = mediaPatchSchema.parse(req.body);
    const row = await updateAccountMedia(user.id, String(req.params.mediaId), body);
    if (!row) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

personalRouter.delete('/media/:mediaId', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const ok = await deleteAccountMedia(user.id, String(req.params.mediaId));
    if (!ok) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

/* ═══════════════════════════════════════════════════════════════════ */
/* Characters (AI influencers)                                          */
/* ═══════════════════════════════════════════════════════════════════ */

const characterCreateSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(200).optional(),
  backstory: z.string().max(4000).optional(),
  voiceId: z.string().max(100).optional(),
  locale: z.string().max(10).optional(),
});

personalRouter.post('/characters', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const body = characterCreateSchema.parse(req.body);
    const row = await createCharacter({ userId: user.id, ...body });
    res.status(201).json({ data: row });
  } catch (e) {
    next(e);
  }
});

personalRouter.get('/characters', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    res.json({ data: await listCharacters(user.id) });
  } catch (e) {
    next(e);
  }
});

personalRouter.get('/characters/:id', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const row = await getCharacter(user.id, String(req.params.id));
    if (!row)
      return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

const characterPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  tagline: z.string().max(200).nullable().optional(),
  backstory: z.string().max(4000).nullable().optional(),
  promptFragment: z.string().max(2000).nullable().optional(),
  negativePrompt: z.string().max(1000).nullable().optional(),
  voiceId: z.string().max(100).nullable().optional(),
  locale: z.string().max(10).nullable().optional(),
});

personalRouter.patch('/characters/:id', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const body = characterPatchSchema.parse(req.body);
    const row = await updateCharacter(user.id, String(req.params.id), body);
    if (!row)
      return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

personalRouter.delete('/characters/:id', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const ok = await deleteCharacter(user.id, String(req.params.id));
    if (!ok) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

personalRouter.post('/characters/:id/analyze', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const existing = await getCharacter(user.id, String(req.params.id));
    if (!existing)
      return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    const row = await analyzeCharacterRefs(existing.id);
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

/* ═══════════════════════════════════════════════════════════════════ */
/* AI models catalog                                                    */
/* ═══════════════════════════════════════════════════════════════════ */

personalRouter.get('/models', requirePersonalAuth, (_req, res) => {
  res.json({ data: listAiModels() });
});

personalRouter.get('/models/:id', requirePersonalAuth, (req, res) => {
  const model = getAiModel(String(req.params.id));
  if (!model)
    return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  res.json({ data: model });
});

/* ═══════════════════════════════════════════════════════════════════ */
/* Custom audio upload per account                                      */
/* ═══════════════════════════════════════════════════════════════════ */

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'].includes(
      file.mimetype,
    );
    if (ok) cb(null, true);
    else cb(new Error('Audio must be mp3/wav/m4a'));
  },
});

personalRouter.post(
  '/accounts/:id/audio',
  requirePersonalAuth,
  uploadLimiter,
  audioUpload.single('file'),
  async (req, res, next) => {
    try {
      const user = (req as any).user as { id: string };
      const account = await getAccount(user.id, String(req.params.id));
      if (!account) {
        return res
          .status(404)
          .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      }
      const file = req.file;
      if (!file) {
        return res
          .status(400)
          .json({ error: { message: 'No file', code: 'NO_FILE' } });
      }
      // Reuse the r2 uploadFile helper via a small import.
      const { uploadFile } = await import('../services/r2.js');
      const { url } = await uploadFile(
        `personal/${account.id}/audio`,
        file.buffer,
        file.originalname,
        file.mimetype,
      );
      const attribution = String(req.body.attribution ?? '').slice(0, 200) || undefined;
      const updated = await updateAccount(user.id, account.id, {
        customAudioUrl: url,
        customAudioAttribution: attribution ?? null,
      });
      res.json({ data: { url, account: updated } });
    } catch (e) {
      next(e);
    }
  },
);

personalRouter.delete('/accounts/:id/audio', requirePersonalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string };
    const updated = await updateAccount(user.id, String(req.params.id), {
      customAudioUrl: null,
      customAudioAttribution: null,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
});

/* ═══════════════════════════════════════════════════════════════════ */
/* ContentStudio connected accounts (read-only)                         */
/* ═══════════════════════════════════════════════════════════════════ */

personalRouter.get('/contentstudio/accounts', requirePersonalAuth, async (req, res, next) => {
  try {
    const { listConnectedAccounts } = await import('../services/contentStudio.js');
    const workspaceId = req.query.workspaceId ? String(req.query.workspaceId) : undefined;
    const { accounts, listError } = await listConnectedAccounts(workspaceId);
    res.json({
      data: {
        configured: Boolean(features.contentStudio),
        accounts,
        listError: listError ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});

personalRouter.get('/contentstudio/workspaces', requirePersonalAuth, async (_req, res, next) => {
  try {
    const { listWorkspaces } = await import('../services/contentStudio.js');
    const { workspaces, listError } = await listWorkspaces();
    res.json({
      data: {
        configured: Boolean(features.contentStudio),
        workspaces,
        listError: listError ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});
