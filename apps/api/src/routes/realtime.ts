import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { addSubscriber, broadcast, setLock, listPresence } from '../services/realtime.js';
import { requireAuth, requireRole } from '../services/auth.js';

export const realtimeRouter = Router();

/** Server-Sent Events stream — open connection, receive JSON events. */
realtimeRouter.get('/stream', requireAuth, (req, res) => {
  const user = (req as any).user as { id: string; name?: string; role?: string };

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: 'presence:snapshot', payload: listPresence() })}\n\n`);

  addSubscriber({
    id: crypto.randomUUID(),
    userId: user.id,
    name: user.name,
    role: user.role,
    res,
  });
});

const lockSchema = z.object({
  postId: z.string().max(100).nullable(),
});

/** Agency-only — clients can't lock posts. */
realtimeRouter.post(
  '/lock',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  (req, res) => {
    const { postId } = lockSchema.parse(req.body);
    const user = (req as any).user as { id: string; name?: string; role?: string };
    setLock(user.id, user.name ?? 'Teammate', user.role ?? 'agency_member', postId);
    res.json({ data: { ok: true } });
  },
);

realtimeRouter.get(
  '/presence',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  (_req, res) => {
    res.json({ data: listPresence() });
  },
);
