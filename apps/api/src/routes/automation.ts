/**
 * Automation control plane. Agency-only except for `publish-due` which can
 * be hit by a cron secret for belt-and-braces scheduling from Render Cron.
 */

import { Router } from 'express';
import { z } from 'zod';
import { runMonthlyGeneration } from '../services/automation.js';
import { generateWebsite } from '../services/websites.js';
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
  template: z
    .enum(['service', 'food', 'beauty', 'fitness', 'professional'])
    .optional(),
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
