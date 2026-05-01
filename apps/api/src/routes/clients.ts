/**
 * Client routes. Agency roles (admin, member) can list/create any client.
 * Client-role users can only read their own client record.
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clients } from '@boost/database';
import { mockClients, getClient } from '@boost/core';
import { requireAuth, requireRole } from '../services/auth.js';

export const clientsRouter = Router();

clientsRouter.get(
  '/',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (_req, res, next) => {
    try {
      if (!isDbConfigured()) return res.json({ data: mockClients });
      const db = getDb();
      const rows = await db.select().from(clients);
      res.json({ data: rows });
    } catch (e) {
      next(e);
    }
  },
);

clientsRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { clientId?: string };
    if (!user.clientId) {
      if (!isDbConfigured()) return res.json({ data: mockClients[0] });
      return res.status(404).json({ error: { message: 'No client profile', code: 'NOT_FOUND' } });
    }
    if (!isDbConfigured()) {
      return res.json({ data: getClient(user.clientId) ?? mockClients[0] });
    }
    const db = getDb();
    const [row] = await db.select().from(clients).where(eq(clients.id, user.clientId));
    if (!row) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

const updateMeSchema = z.object({
  industry: z.string().max(100).optional(),
  websiteUrl: z.string().url().max(500).optional().or(z.literal('')),
  socialAccounts: z.record(z.string(), z.string().max(200)).optional(),
});

clientsRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { role: string; clientId?: string };
    if (user.role !== 'client' || !user.clientId) {
      return res.status(403).json({ error: { message: 'Client role required', code: 'FORBIDDEN' } });
    }
    const patch = updateMeSchema.parse(req.body);
    if (!isDbConfigured()) {
      return res.json({ data: { id: user.clientId, ...patch } });
    }
    const db = getDb();
    const [row] = await db
      .update(clients)
      .set({
        ...(patch.industry !== undefined ? { industry: patch.industry } : {}),
        ...(patch.websiteUrl !== undefined ? { websiteUrl: patch.websiteUrl || null } : {}),
        ...(patch.socialAccounts !== undefined ? { socialAccounts: patch.socialAccounts } : {}),
        updatedAt: new Date(),
      })
      .where(eq(clients.id, user.clientId))
      .returning();
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

clientsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const user = (req as any).user as { role: string; clientId?: string };
    if (user.role === 'client' && user.clientId !== id) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }
    if (!isDbConfigured()) {
      const c = getClient(id);
      if (!c) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      return res.json({ data: c });
    }
    const db = getDb();
    const [row] = await db.select().from(clients).where(eq(clients.id, id));
    if (!row) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  email: z.string().email().max(200),
  industry: z.string().max(100).optional(),
  websiteUrl: z.string().url().max(500).optional(),
  subscriptionTier: z.enum(['social_only', 'website_only', 'full_package']).default('social_only'),
});

clientsRouter.post(
  '/',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      if (!isDbConfigured()) return res.status(201).json({ data: { id: 'c_new', ...body } });
      const db = getDb();
      const [row] = await db.insert(clients).values(body).returning();
      res.status(201).json({ data: row });
    } catch (e) {
      next(e);
    }
  },
);

clientsRouter.post(
  '/:id/onboard',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  (req, res) => {
    res.json({
      data: {
        clientId: String(req.params.id),
        status: 'queued',
        steps: ['scrape_website', 'generate_brand_voice', 'create_workspace'],
      },
    });
  },
);
