/**
 * Post CRUD + approval routes.
 *
 * State machine:
 *   draft → pending_internal → pending_approval → approved|scheduled → publishing → published
 *                                              ↘ rejected
 *
 * Agency roles bump posts from pending_internal → pending_approval in batches.
 * When that happens we notify the client there's stuff to review.
 * Clients approve/reject from the portal → scheduled. Publish cron runs the rest.
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { getDb, isDbConfigured, posts, clients } from '@boost/database';
import { mockPosts } from '@boost/core';
import { requireAuth } from '../services/auth.js';
import { broadcast } from '../services/realtime.js';
import { notifyClientPostsAwaiting } from '../services/notifications.js';
import type { Request, Response, NextFunction } from 'express';

export const postsRouter = Router();

const POST_STATUSES = [
  'draft',
  'pending_internal',
  'pending_approval',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'rejected',
] as const;
const listQuerySchema = z.object({
  clientId: z.string().min(1).max(100).optional(),
  status: z.enum(POST_STATUSES).optional(),
});

postsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { role: string; clientId?: string };
    const parsed = listQuerySchema.safeParse({
      clientId: req.query.clientId,
      status: req.query.status,
    });
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid query', code: 'VALIDATION' } });
    }
    let clientId = parsed.data.clientId;
    const status = parsed.data.status;

    if (user.role === 'client') {
      clientId = user.clientId;
      if (!clientId) return res.json({ data: [] });
    }

    if (!isDbConfigured()) {
      let results = mockPosts;
      if (clientId) results = results.filter((p) => p.clientId === clientId);
      if (status) results = results.filter((p) => p.status === status);
      return res.json({ data: results });
    }
    const db = getDb();
    const conds = [];
    if (clientId) conds.push(eq(posts.clientId, clientId));
    if (status) conds.push(eq(posts.status, status));
    const rows =
      conds.length > 0
        ? await db.select().from(posts).where(and(...conds))
        : await db.select().from(posts);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

async function loadPostForUser(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  const user = (req as any).user as { role: string; clientId?: string };

  if (!isDbConfigured()) {
    const post = mockPosts.find((p) => p.id === id);
    if (!post) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    if (user.role === 'client' && post.clientId !== user.clientId) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }
    (req as any).post = post;
    return next();
  }

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  if (user.role === 'client' && post.clientId !== user.clientId) {
    return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
  }
  (req as any).post = post;
  next();
}

const updateSchema = z.object({
  caption: z.string().min(1).max(5000).optional(),
  hashtags: z.array(z.string().max(100)).max(50).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z
    .enum(['draft', 'pending_internal', 'pending_approval', 'approved', 'scheduled', 'rejected'])
    .optional(),
});

postsRouter.patch('/:id', requireAuth, loadPostForUser, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const patch = updateSchema.parse(req.body);
    if (!isDbConfigured()) {
      broadcast({ type: 'post:updated', payload: { id, patch } });
      return res.json({ data: { id, ...patch } });
    }
    const db = getDb();
    const [row] = await db
      .update(posts)
      .set({
        ...(patch.caption !== undefined ? { caption: patch.caption } : {}),
        ...(patch.hashtags ? { hashtags: patch.hashtags } : {}),
        ...(patch.scheduledAt ? { scheduledAt: new Date(patch.scheduledAt) } : {}),
        ...(patch.status ? { status: patch.status as any } : {}),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id))
      .returning();
    broadcast({ type: 'post:updated', payload: row });
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

/**
 * Approval is context-sensitive:
 *   - Client user on `pending_approval` → `scheduled` (triggers publish cron)
 *   - Agency user on `pending_internal` → `pending_approval` (kicks to client)
 *   - Agency user on `pending_approval` → `scheduled` (override / manual push)
 */
postsRouter.patch('/:id/approve', requireAuth, loadPostForUser, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const user = (req as any).user as { role: string };
    const current = (req as any).post as { status: string };

    const nextStatus: 'pending_approval' | 'scheduled' =
      user.role === 'agency_admin' || user.role === 'agency_member'
        ? current.status === 'pending_internal'
          ? 'pending_approval'
          : 'scheduled'
        : 'scheduled';

    if (!isDbConfigured()) {
      broadcast({ type: 'post:updated', payload: { id, status: nextStatus } });
      return res.json({ data: { id, status: nextStatus } });
    }
    const db = getDb();
    const [row] = await db
      .update(posts)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    broadcast({ type: 'post:updated', payload: row });
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

const rejectSchema = z.object({ feedback: z.string().min(1).max(2000) });

postsRouter.patch('/:id/reject', requireAuth, loadPostForUser, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { feedback } = rejectSchema.parse(req.body);
    if (!isDbConfigured()) {
      broadcast({ type: 'post:updated', payload: { id, status: 'rejected', feedback } });
      return res.json({ data: { id, status: 'rejected', feedback } });
    }
    const db = getDb();
    const [row] = await db
      .update(posts)
      .set({ status: 'rejected', clientFeedback: feedback, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    broadcast({ type: 'post:updated', payload: row });
    res.json({ data: row });
  } catch (e) {
    next(e);
  }
});

const batchSchema = z.object({ postIds: z.array(z.string().min(1)).min(1).max(100) });

/**
 * Batch approve — if the caller is agency and all posts are `pending_internal`,
 * we promote them to `pending_approval` and email the client that their
 * calendar is ready. If the caller is the client, we go straight to `scheduled`.
 */
postsRouter.post('/batch-approve', requireAuth, async (req, res, next) => {
  try {
    const { postIds } = batchSchema.parse(req.body);
    const user = (req as any).user as { role: string; clientId?: string };

    if (!isDbConfigured()) {
      const status = user.role === 'client' ? 'scheduled' : 'pending_approval';
      broadcast({ type: 'post:batch-updated', payload: { ids: postIds, status } });
      return res.json({ data: { approved: postIds.length } });
    }
    const db = getDb();
    const existing = await db.select().from(posts).where(inArray(posts.id, postIds));
    const scoped =
      user.role === 'client' ? existing.filter((p) => p.clientId === user.clientId) : existing;
    if (scoped.length === 0) {
      return res.status(403).json({ error: { message: 'No matching posts', code: 'FORBIDDEN' } });
    }

    const nextStatus =
      user.role === 'client'
        ? 'scheduled'
        : scoped.every((p) => p.status === 'pending_internal')
          ? 'pending_approval'
          : 'scheduled';

    const rows = await db
      .update(posts)
      .set({ status: nextStatus as any, updatedAt: new Date() })
      .where(inArray(posts.id, scoped.map((p) => p.id)))
      .returning({ id: posts.id, clientId: posts.clientId });

    broadcast({
      type: 'post:batch-updated',
      payload: { ids: rows.map((r) => r.id), status: nextStatus },
    });

    // If agency kicked posts to the client, email the client(s) involved.
    if (nextStatus === 'pending_approval') {
      const affected = new Set(rows.map((r) => r.clientId));
      for (const cid of affected) {
        const [c] = await db.select().from(clients).where(eq(clients.id, cid));
        if (!c) continue;
        const pending = rows.filter((r) => r.clientId === cid).length;
        notifyClientPostsAwaiting({
          clientEmail: c.email,
          clientName: c.contactName,
          pendingCount: pending,
        }).catch((e) =>
          console.warn('[notify] client awaiting email failed:', (e as Error).message),
        );
      }
    }

    res.json({ data: { approved: rows.length, status: nextStatus } });
  } catch (e) {
    next(e);
  }
});
