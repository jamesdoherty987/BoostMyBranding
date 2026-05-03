/**
 * Client routes. Agency roles (admin, member) can list/create any client.
 * Client-role users can only read their own client record.
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { getDb, isDbConfigured, clients, clientImages } from '@boost/database';
import { mockClients, getClient, slugify, type WebsiteConfig } from '@boost/core';
import { requireAuth, requireRole } from '../services/auth.js';
import { publicLimiter } from '../middleware/rateLimit.js';

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

/**
 * Public endpoint: fetch a client's generated website config + image URLs by
 * slug. No auth — these are intended to be served as public marketing sites
 * at /sites/[slug]. Rate-limited to deter enumeration / scraping.
 *
 * Placed BEFORE the authed `/:id` route so the longer path matches first.
 */
clientsRouter.get('/public/by-slug/:slug/site', publicLimiter, async (req, res, next) => {
  try {
    const rawSlug = String(req.params.slug).toLowerCase();
    // Normalize through slugify so `MuRpHyS--Plumbing` → `murphys-plumbing`
    // can't bypass the index. Reject anything that doesn't round-trip (it
    // means the caller sent junk).
    const slug = slugify(rawSlug);
    if (!slug || slug !== rawSlug) {
      return res.status(404).json({ error: { message: 'Site not found', code: 'NOT_FOUND' } });
    }

    if (!isDbConfigured()) {
      const match = mockClients.find((c) => slugify(c.businessName) === slug);
      if (!match) {
        return res
          .status(404)
          .json({ error: { message: 'Site not found', code: 'NOT_FOUND' } });
      }
      return res.json({
        data: {
          businessName: match.businessName,
          slug,
          clientId: match.id,
          config: null as WebsiteConfig | null,
          images: [] as string[],
          status: 'pending' as const,
        },
      });
    }

    const db = getDb();
    // Indexed lookup — no more full table scan.
    const [match] = await db
      .select()
      .from(clients)
      .where(eq(clients.slug, slug))
      .limit(1);
    if (!match || !match.isActive) {
      return res.status(404).json({ error: { message: 'Site not found', code: 'NOT_FOUND' } });
    }
    const imgs = await db
      .select()
      .from(clientImages)
      .where(eq(clientImages.clientId, match.id))
      .orderBy(desc(clientImages.qualityScore))
      .limit(12);
    return res.json({
      data: {
        businessName: match.businessName,
        slug: match.slug,
        clientId: match.id,
        config: (match.websiteConfig ?? null) as WebsiteConfig | null,
        images: imgs
          .map((i) => i.enhancedUrl ?? i.fileUrl)
          .filter((u): u is string => typeof u === 'string' && u.length > 0),
        status: match.websiteConfig ? ('ready' as const) : ('pending' as const),
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Public endpoint: resolve a host (e.g. `murphysplumbing.com`) to the client
 * that owns it, returning just the slug. The apps/web middleware uses this
 * to rewrite custom-domain requests to the internal `/sites/[slug]` path
 * without needing a direct DB connection from the edge.
 *
 * Deliberately minimal response — no site data, no images — so this can
 * be called on every request without paying a cold-start cost.
 */
clientsRouter.get('/public/by-host/:host', publicLimiter, async (req, res, next) => {
  try {
    const host = String(req.params.host).toLowerCase().replace(/^www\./, '');
    if (!host || host.length > 253) {
      return res
        .status(404)
        .json({ error: { message: 'Unknown host', code: 'NOT_FOUND' } });
    }

    if (!isDbConfigured()) {
      // Mock: pretend the first client owns the requested host.
      const first = mockClients[0]!;
      return res.json({
        data: {
          slug: slugify(first.businessName),
          clientId: first.id,
        },
      });
    }

    const db = getDb();
    const [match] = await db
      .select({
        id: clients.id,
        slug: clients.slug,
        status: clients.customDomainStatus,
        isActive: clients.isActive,
      })
      .from(clients)
      .where(eq(clients.customDomain, host))
      .limit(1);

    if (!match || !match.isActive) {
      return res
        .status(404)
        .json({ error: { message: 'Unknown host', code: 'NOT_FOUND' } });
    }

    res.json({
      data: {
        slug: match.slug,
        clientId: match.id,
        verified: match.status === 'verified',
      },
    });
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
      const slug = await reserveSlug(body.businessName);
      const [row] = await db
        .insert(clients)
        .values({ ...body, slug })
        .returning();
      res.status(201).json({ data: row });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Generate a unique slug for a client. Starts from the base slug and suffixes
 * `-2`, `-3`, … until the `clients_slug_idx` unique index is free.
 * This runs with a small retry budget so a concurrent insert can't wedge it.
 */
async function reserveSlug(businessName: string): Promise<string> {
  const base = slugify(businessName) || 'site';
  const db = getDb();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  // Extremely unlikely; fall back to base + timestamp to avoid infinite loops.
  return `${base}-${Date.now().toString(36).slice(-6)}`;
}

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

/* ------------------------------------------------------------------ */
/* Agency-side edit + delete                                          */
/* ------------------------------------------------------------------ */

const updateClientSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  contactName: z.string().min(1).max(200).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(30).optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  websiteUrl: z.string().url().max(500).optional().or(z.literal('')),
  brandVoice: z.string().max(4000).optional(),
  logoUrl: z.string().url().max(500).optional().or(z.literal('')),
  subscriptionTier: z.enum(['social_only', 'website_only', 'full_package']).optional(),
  isActive: z.boolean().optional(),
});

/** Agency-side update of any client field. */
clientsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const patch = updateClientSchema.parse(req.body);
      if (!isDbConfigured()) {
        return res.json({ data: { id, ...patch } });
      }
      const db = getDb();
      const set: Record<string, any> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) {
          // Map camelCase to snake_case column names
          const col = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          set[col] = v === '' ? null : v;
        }
      }
      const [row] = await db
        .update(clients)
        .set(set)
        .where(eq(clients.id, id))
        .returning();
      if (!row) {
        return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: row });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Delete a client and all associated data (images, posts, messages, etc.).
 * Cascading deletes are handled by the FK constraints in the schema.
 * Agency admin only — this is destructive and irreversible.
 */
clientsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('agency_admin'),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      if (!isDbConfigured()) {
        return res.json({ data: { id, deleted: true } });
      }
      const db = getDb();
      const [row] = await db
        .delete(clients)
        .where(eq(clients.id, id))
        .returning({ id: clients.id });
      if (!row) {
        return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: { id: row.id, deleted: true } });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Clear a client's website config. The public site reverts to the
 * "coming soon" holding page. Non-destructive — the client record
 * stays, only the config is wiped.
 */
clientsRouter.delete(
  '/:id/website',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      if (!isDbConfigured()) {
        return res.json({ data: { id, cleared: true } });
      }
      const db = getDb();
      await db
        .update(clients)
        .set({ websiteConfig: null, websiteGeneratedAt: null })
        .where(eq(clients.id, id));
      res.json({ data: { id, cleared: true } });
    } catch (e) {
      next(e);
    }
  },
);
