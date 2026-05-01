import { Router } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { getDb, isDbConfigured, messages } from '@boost/database';
import { mockMessages } from '@boost/core';
import { requireAuth } from '../services/auth.js';
import { broadcast } from '../services/realtime.js';

export const messagesRouter = Router();

messagesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { role: string; clientId?: string };
    let clientId = req.query.clientId as string | undefined;
    if (user.role === 'client') clientId = user.clientId;
    if (!clientId && user.role === 'client') return res.json({ data: [] });

    if (!isDbConfigured()) {
      const results = clientId
        ? mockMessages.filter((m) => m.clientId === clientId)
        : mockMessages;
      return res.json({ data: results });
    }
    const db = getDb();
    const rows = clientId
      ? await db
          .select()
          .from(messages)
          .where(eq(messages.clientId, clientId))
          .orderBy(desc(messages.createdAt))
          .limit(100)
      : await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(100);
    res.json({ data: rows.reverse() });
  } catch (e) {
    next(e);
  }
});

const sendSchema = z.object({
  clientId: z.string().min(1).max(100),
  body: z.string().min(1).max(5000),
  attachmentUrl: z.string().url().optional(),
});

messagesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = sendSchema.parse(req.body);
    const user = (req as any).user as { id: string; name?: string; role: string; clientId?: string };
    const sender = user.role === 'client' ? 'client' : 'agency';
    if (user.role === 'client' && parsed.clientId !== user.clientId) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }

    if (!isDbConfigured()) {
      const row = {
        id: `m_${Date.now()}`,
        clientId: parsed.clientId,
        sender,
        senderName: user.name ?? 'User',
        body: parsed.body,
        createdAt: new Date().toISOString(),
      };
      broadcast({ type: 'message:new', payload: row });
      return res.status(201).json({ data: row });
    }
    const db = getDb();
    const [row] = await db
      .insert(messages)
      .values({
        clientId: parsed.clientId,
        sender,
        senderId: user.id,
        senderName: user.name ?? null,
        body: parsed.body,
        attachmentUrl: parsed.attachmentUrl ?? null,
      })
      .returning();
    broadcast({ type: 'message:new', payload: row });
    res.status(201).json({ data: row });
  } catch (e) {
    next(e);
  }
});
