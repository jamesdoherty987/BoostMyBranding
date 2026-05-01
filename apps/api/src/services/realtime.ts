/**
 * Lightweight realtime layer using Server-Sent Events.
 *
 * Clients subscribe to `/api/v1/realtime/stream` and receive JSON events
 * whenever anything relevant happens. Works over plain HTTP, no websockets
 * or external services required, and passes cleanly through every hosting
 * provider (Render, Vercel Pro, Fly, etc.).
 *
 * Event types:
 *  - presence:join / presence:leave   — who is active in the dashboard
 *  - presence:lock / presence:unlock  — which post/client a worker is looking at
 *  - post:updated                     — push to refresh optimistic lists
 *  - message:new                      — new chat message (portal + dashboard)
 */

import type { Response } from 'express';

type Subscriber = {
  id: string;
  userId?: string;
  name?: string;
  role?: string;
  res: Response;
};

const subs = new Map<string, Subscriber>();
const presence = new Map<string, { userId: string; name: string; role: string; lockedPostId?: string; lastSeen: number }>();

export function addSubscriber(sub: Subscriber) {
  subs.set(sub.id, sub);
  // Announce presence if the caller is authenticated.
  if (sub.userId) {
    presence.set(sub.userId, {
      userId: sub.userId,
      name: sub.name ?? 'Teammate',
      role: sub.role ?? 'agency_member',
      lastSeen: Date.now(),
    });
    broadcast({ type: 'presence:join', payload: listPresence() });
  }

  sub.res.on('close', () => {
    subs.delete(sub.id);
    if (sub.userId && !Array.from(subs.values()).some((s) => s.userId === sub.userId)) {
      presence.delete(sub.userId);
      broadcast({ type: 'presence:leave', payload: listPresence() });
    }
  });
}

export function broadcast(event: { type: string; payload: unknown }) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const sub of subs.values()) {
    try {
      sub.res.write(data);
    } catch {
      subs.delete(sub.id);
    }
  }
}

export function setLock(userId: string, name: string, role: string, postId: string | null) {
  const existing = presence.get(userId);
  presence.set(userId, {
    userId,
    name,
    role,
    lockedPostId: postId ?? undefined,
    lastSeen: Date.now(),
  });
  broadcast({
    type: postId ? 'presence:lock' : 'presence:unlock',
    payload: { userId, name, role, postId, list: listPresence() },
  });
}

export function listPresence() {
  return Array.from(presence.values());
}

/** Heartbeat to prevent proxies from closing idle connections. */
setInterval(() => {
  for (const sub of subs.values()) {
    try {
      sub.res.write(': heartbeat\n\n');
    } catch {
      subs.delete(sub.id);
    }
  }
}, 25000).unref?.();
