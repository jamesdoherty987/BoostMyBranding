/**
 * Automation control plane. Agency-only except for `publish-due` which can
 * be hit by a cron secret for belt-and-braces scheduling from Render Cron.
 */

import { Router } from 'express';
import { z } from 'zod';
import { SITE_TEMPLATES } from '@boost/core';
import { runMonthlyGeneration, regenerateSinglePost, regeneratePostImage } from '../services/automation.js';
import {
  generateWebsite,
  editWebsiteWithAI,
  updateWebsiteField,
  saveWebsiteConfig,
} from '../services/websites.js';
import { generateHeroImage } from '../services/heroImage.js';
import { getDb, isDbConfigured, clients } from '@boost/database';
import { eq } from 'drizzle-orm';
import {
  publishDue,
  analyzePendingImages,
  generateMonthlyBatches,
} from '../services/scheduler.js';
import { requireAuth, requireRole } from '../services/auth.js';
import { env } from '../env.js';

export const automationRouter = Router();

const generateSchema = z.object({
  clientId: z.string().min(1).max(100),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM'),
  postsCount: z.number().int().min(1).max(60).default(30),
  platforms: z.array(z.string().max(50)).max(10).optional(),
  direction: z.string().max(2000).optional(),
});

automationRouter.post(
  '/generate',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = generateSchema.parse(req.body);
      const result = await runMonthlyGeneration(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

automationRouter.post(
  '/generate-all',
  requireAuth,
  requireRole('agency_admin'),
  async (_req, res, next) => {
    try {
      const result = await generateMonthlyBatches();
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

const generateWebsiteSchema = z.object({
  clientId: z.string().min(1).max(100),
  description: z.string().max(4000).nullish(),
  services: z.array(z.string().max(100)).max(20).nullish(),
  hasBooking: z.boolean().nullish(),
  hasHours: z.boolean().nullish(),
  // Pulled from @boost/core so adding a template is a single-file change.
  template: z.enum(SITE_TEMPLATES).nullish(),
  /** Free-text suggestions from the agency to steer the AI output. */
  suggestions: z.string().max(2000).nullish(),

  /* Seeded business facts. These bypass Claude's invention and are
     stamped onto the final config so the rendered site matches the
     agency's inputs exactly. All optional; nullish so cleared form
     fields (null) are accepted alongside undefined. */
  address: z.string().max(300).nullish(),
  phone: z.string().max(50).nullish(),
  email: z.string().max(200).nullish(),
  whatsapp: z.string().max(50).nullish(),
  hours: z.string().max(500).nullish(),
  socials: z
    .object({
      facebook: z.string().max(500).nullish(),
      instagram: z.string().max(500).nullish(),
      tiktok: z.string().max(500).nullish(),
      linkedin: z.string().max(500).nullish(),
      x: z.string().max(500).nullish(),
      youtube: z.string().max(500).nullish(),
      google: z.string().max(500).nullish(),
    })
    .nullish(),
  team: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        role: z.string().min(1).max(100),
        bio: z.string().max(1000).nullish(),
        credentials: z.string().max(200).nullish(),
        specialties: z.array(z.string().max(60)).max(5).nullish(),
        photoUrl: z.string().url().max(500).nullish(),
      }),
    )
    .max(20)
    .nullish(),
  serviceAreas: z.array(z.string().max(100)).max(30).nullish(),
  trustBadges: z
    .array(
      z.object({
        label: z.string().min(1).max(100),
        detail: z.string().max(300).nullish(),
        href: z.string().url().max(500).nullish(),
      }),
    )
    .max(10)
    .nullish(),
});

automationRouter.post(
  '/generate-website',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const parsed = generateWebsiteSchema.parse(req.body);
      // Coerce `null` form values to `undefined` so downstream code can keep
      // using the tighter `string | undefined` shape. Happens once here at
      // the route boundary instead of plumbing `null` everywhere. We cast
      // the result because `nullsToUndefined` can't narrow the Zod output
      // type through TS's control flow.
      const args = nullsToUndefined(parsed) as Parameters<typeof generateWebsite>[0];
      const result = await generateWebsite(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

/** Recursively replace `null` with `undefined` at every depth. Keeps array
 *  indices and object keys otherwise intact. */
function nullsToUndefined<T>(value: T): T {
  if (value === null) return undefined as unknown as T;
  if (Array.isArray(value)) {
    return value.map((v) => nullsToUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = nullsToUndefined(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

automationRouter.post(
  '/analyze-pending',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (_req, res, next) => {
    try {
      const result = await analyzePendingImages(20);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

const editWebsiteSchema = z.object({
  clientId: z.string().min(1).max(100),
  currentConfig: z.record(z.any()),
  instruction: z.string().min(1).max(2000),
});

automationRouter.post(
  '/edit-website',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = editWebsiteSchema.parse(req.body);
      const result = await editWebsiteWithAI(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Targeted single-field update. Used by the inline section editor so a
 * headline tweak doesn't round-trip through Claude. `path` is a dotted
 * key only (e.g. `hero.headline`, `services.0.title`). Numeric segments
 * index into arrays; everything else is an object key.
 */
const updateFieldSchema = z.object({
  clientId: z.string().min(1).max(100),
  path: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*(\.(?:\d+|[a-zA-Z_][a-zA-Z0-9_]*))*$/, 'Invalid path'),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.any()),
    z.record(z.any()),
  ]),
});

automationRouter.post(
  '/update-website-field',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = updateFieldSchema.parse(req.body);
      const pathSegments = args.path.split('.').filter((s) => s.length > 0);
      const config = await updateWebsiteField({
        clientId: args.clientId,
        path: pathSegments,
        value: args.value,
      });
      res.json({ data: { config } });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Atomic full-config save. Preferred over /update-website-field for
 * editor saves because it avoids races between parallel JSONB writes.
 * The editor sends the entire config in one request.
 */
const saveConfigSchema = z.object({
  clientId: z.string().min(1).max(100),
  // We accept an arbitrary object here because the WebsiteConfig shape is
  // validated downstream by the renderer's sanitizer. Stricter validation
  // would reject optional fields that legitimately differ between
  // templates.
  config: z.record(z.any()),
});

automationRouter.post(
  '/save-website-config',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = saveConfigSchema.parse(req.body);
      const config = await saveWebsiteConfig({
        clientId: args.clientId,
        config: args.config as any,
      });
      res.json({ data: { config } });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Regenerate (or first-generate) the AI hero image for a client. Accepts
 * an optional override prompt so the agency can hand-tune the visual.
 */
const heroImageSchema = z.object({
  clientId: z.string().min(1).max(100),
  overridePrompt: z.string().max(2000).optional(),
});

automationRouter.post(
  '/generate-hero-image',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = heroImageSchema.parse(req.body);
      if (!isDbConfigured()) {
        return res.json({
          data: {
            imageUrl:
              'https://picsum.photos/seed/hero-mock/1024/1280',
            prompt: args.overridePrompt ?? 'Mock hero image',
            fromMock: true,
          },
        });
      }
      const db = getDb();
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, args.clientId));
      if (!client) {
        return res.status(404).json({
          error: { message: 'Client not found', code: 'NOT_FOUND' },
        });
      }
      const config = (client.websiteConfig ?? {}) as any;
      const result = await generateHeroImage({
        clientId: args.clientId,
        businessName: client.businessName,
        industry: client.industry ?? 'Local Business',
        description: client.brandVoice ?? undefined,
        overridePrompt: args.overridePrompt,
        heroVariant: config?.hero?.variant,
      });
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

/** Public cron endpoint (guarded by CRON_SECRET) OR agency auth fallback. */
automationRouter.post('/publish-due', async (req, res, next) => {
  try {
    const secretHeader = req.header('x-cron-secret');
    if (env.CRON_SECRET && secretHeader === env.CRON_SECRET) {
      const result = await publishDue();
      return res.json({ data: result });
    }
    await new Promise<void>((resolve, reject) =>
      requireAuth(req, res, (err: unknown) => (err ? reject(err) : resolve())),
    );
    await new Promise<void>((resolve, reject) =>
      requireRole('agency_admin', 'agency_member')(req, res, (err: unknown) =>
        err ? reject(err) : resolve(),
      ),
    );
    const result = await publishDue();
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

const regeneratePostSchema = z.object({
  postId: z.string().min(1).max(100),
  instruction: z.string().max(2000).optional(),
});

automationRouter.post(
  '/regenerate-post',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = regeneratePostSchema.parse(req.body);
      const result = await regenerateSinglePost(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

const regenerateImageSchema = z.object({
  postId: z.string().min(1).max(100),
  overridePrompt: z.string().max(2000).optional(),
});

automationRouter.post(
  '/regenerate-post-image',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = regenerateImageSchema.parse(req.body);
      const result = await regeneratePostImage(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);
