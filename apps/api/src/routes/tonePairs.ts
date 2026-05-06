/**
 * Tone-of-voice pair routes.
 *
 *   GET    /api/v1/clients/:clientId/tone-pairs
 *   POST   /api/v1/clients/:clientId/tone-pairs
 *   PATCH  /api/v1/clients/:clientId/tone-pairs/:pairId
 *   DELETE /api/v1/clients/:clientId/tone-pairs/:pairId
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  listTonePairs,
  createTonePair,
  updateTonePair,
  deleteTonePair,
} from '../services/tonePairs.js';
import { requireAuth, requireRole } from '../services/auth.js';

export const tonePairsRouter = Router({ mergeParams: true });

function scopeCheck(req: any, res: any, next: any) {
  const user = req.user as { role: string; clientId?: string };
  const clientId = String(req.params.clientId);
  if (user.role === 'client' && user.clientId !== clientId) {
    return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
  }
  next();
}

tonePairsRouter.get('/', requireAuth, scopeCheck, async (req, res, next) => {
  try {
    const clientId = String(req.params.clientId);
    const pairs = await listTonePairs(clientId);
    res.json({ data: pairs });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  category: z.string().max(100).optional(),
  goodExample: z.string().min(1).max(2000),
  badExample: z.string().max(2000).optional(),
  explanation: z.string().max(2000).optional(),
});

tonePairsRouter.post(
  '/',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const body = createSchema.parse(req.body);
      const pair = await createTonePair({ clientId, ...body });
      if (!pair) {
        return res.status(400).json({ error: { message: 'Could not create pair', code: 'CREATE_FAILED' } });
      }
      res.status(201).json({ data: pair });
    } catch (e) {
      next(e);
    }
  },
);

const updateSchema = z.object({
  category: z.string().max(100).nullable().optional(),
  goodExample: z.string().min(1).max(2000).optional(),
  badExample: z.string().max(2000).nullable().optional(),
  explanation: z.string().max(2000).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

tonePairsRouter.patch(
  '/:pairId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const pairId = String(req.params.pairId);
      const body = updateSchema.parse(req.body);
      const pair = await updateTonePair(clientId, pairId, body);
      if (!pair) {
        return res.status(404).json({ error: { message: 'Pair not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: pair });
    } catch (e) {
      next(e);
    }
  },
);

tonePairsRouter.delete(
  '/:pairId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const pairId = String(req.params.pairId);
      const ok = await deleteTonePair(clientId, pairId);
      if (!ok) {
        return res.status(404).json({ error: { message: 'Pair not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  },
);
