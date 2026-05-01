/**
 * Lead submissions from generated client sites. These are the contact-form
 * submissions hitting `/api/v1/leads` from the SiteContact block.
 *
 * Public (no auth) because it's called directly from client marketing sites.
 * Rate-limited with `leadsLimiter` to deter form spam. Input is strictly
 * validated and capped to reasonable lengths so a single oversized payload
 * can't balloon memory.
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clients, leads } from '@boost/database';
import { mockClients } from '@boost/core';
import { leadsLimiter } from '../middleware/rateLimit.js';
import { sendAgencyNotification } from '../services/notifications.js';

export const leadsRouter = Router();

const leadSchema = z.object({
  clientId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional(),
  message: z.string().max(2000).optional(),
  source: z.string().max(60).optional(),
  referer: z.string().max(500).optional(),
});

leadsRouter.post('/', leadsLimiter, async (req, res, next) => {
  try {
    const body = leadSchema.parse(req.body);

    if (!isDbConfigured()) {
      // Accept in dev mode too so the form doesn't look broken against mocks.
      const client = mockClients.find((c) => c.id === body.clientId);
      if (!client) {
        return res.status(404).json({ error: { message: 'Client not found', code: 'NOT_FOUND' } });
      }
      return res.status(201).json({
        data: { id: 'lead_mock', clientId: body.clientId, received: true },
      });
    }

    const db = getDb();
    const [client] = await db
      .select({ id: clients.id, businessName: clients.businessName })
      .from(clients)
      .where(eq(clients.id, body.clientId))
      .limit(1);
    if (!client) {
      return res.status(404).json({ error: { message: 'Client not found', code: 'NOT_FOUND' } });
    }

    const [row] = await db
      .insert(leads)
      .values({
        clientId: client.id,
        name: body.name,
        email: body.email,
        phone: body.phone ?? null,
        message: body.message ?? null,
        source: body.source ?? 'website_contact',
        referer: body.referer ?? null,
      })
      .returning();
    if (!row) {
      return res
        .status(500)
        .json({ error: { message: 'Failed to record lead', code: 'INTERNAL' } });
    }

    // Best-effort notification. Failure doesn't reject the lead — we'd rather
    // miss the email than drop the submission.
    try {
      await sendAgencyNotification({
        subject: `New lead for ${client.businessName}`,
        body: `From: ${body.name} <${body.email}>\n\n${body.message ?? '(no message)'}`,
      });
    } catch (e) {
      console.warn('[leads] notification failed:', (e as Error).message);
    }

    res.status(201).json({ data: { id: row.id, clientId: client.id, received: true } });
  } catch (e) {
    next(e);
  }
});
