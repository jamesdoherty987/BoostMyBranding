/**
 * Automation control plane. Agency-only except for `publish-due` which can
 * be hit by a cron secret for belt-and-braces scheduling from Render Cron.
 */

import { Router } from 'express';
import { z } from 'zod';
import { SITE_TEMPLATES } from '@boost/core';
import { runMonthlyGeneration } from '../services/automation.js';
import {
  generateWebsite,
  editWebsiteWithAI,
  updateWebsiteField,
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
  description: z.string().max(4000).optional(),
  services: z.array(z.string().max(100)).max(20).optional(),
  hasBooking: z.boolean().optional(),
  hasHours: z.boolean().optional(),
  // Pulled from @boost/core so adding a template is a single-file change.
  template: z.enum(SITE_TEMPLATES).optional(),
  /** Free-text suggestions from the agency to steer the AI output. */
  suggestions: z.string().max(2000).optional(),
});

automationRouter.post(
  '/generate-website',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const args = generateWebsiteSchema.parse(req.body);
      const result = await generateWebsite(args);
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

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
