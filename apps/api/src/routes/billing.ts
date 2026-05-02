/**
 * Billing routes.
 *
 * Checkout and portal sessions both require auth now — payment happens
 * from inside the portal after signup, so the caller is always a logged-in
 * client-role user. We resolve their Stripe customer from their client
 * record and mint a session tied to it.
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clients } from '@boost/database';
import { mockClients, getTier, getStatusMeta, hasActiveSubscription } from '@boost/core';
import { createCheckoutSession, createPortalSession, stripe } from '../services/stripe.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { env, features } from '../env.js';
import { requireAuth } from '../services/auth.js';

export const billingRouter = Router();

const checkoutSchema = z.object({
  tier: z.enum(['social_only', 'website_only', 'full_package']),
});

/**
 * Create a Stripe Checkout session for the currently signed-in client.
 * After payment clears, the Stripe webhook writes `subscriptionStatus: 'active'`
 * back onto the client record.
 */
billingRouter.post('/checkout', authLimiter, requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as {
      role: string;
      clientId?: string;
      email: string;
    };
    if (user.role !== 'client' || !user.clientId) {
      return res
        .status(403)
        .json({ error: { message: 'Only client users can subscribe', code: 'FORBIDDEN' } });
    }
    const { tier } = checkoutSchema.parse(req.body);

    // Load the client so we have their stored customer email + id for metadata.
    let clientEmail = user.email;
    if (isDbConfigured()) {
      const db = getDb();
      const [row] = await db.select().from(clients).where(eq(clients.id, user.clientId));
      if (row) clientEmail = row.email;
    }

    const session = await createCheckoutSession({
      tier,
      customerEmail: clientEmail,
      clientId: user.clientId,
      successUrl: `${env.PORTAL_URL}/subscription?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${env.PORTAL_URL}/subscription?status=canceled`,
    });
    res.json({ data: session });
  } catch (e) {
    next(e);
  }
});

/**
 * Stripe customer portal — for updating payment methods, downloading
 * invoices, or canceling. Resolves the customer id from the signed-in
 * client's record, so callers don't need to pass it in.
 */
billingRouter.post('/portal', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { role: string; clientId?: string };
    if (user.role !== 'client' || !user.clientId) {
      return res
        .status(403)
        .json({ error: { message: 'Only client users can open billing', code: 'FORBIDDEN' } });
    }
    if (!isDbConfigured()) {
      return res.json({ data: { url: `${env.PORTAL_URL}/subscription` } });
    }
    const db = getDb();
    const [row] = await db.select().from(clients).where(eq(clients.id, user.clientId));
    if (!row?.stripeCustomerId) {
      return res
        .status(400)
        .json({ error: { message: 'No billing account yet', code: 'NO_CUSTOMER' } });
    }
    const session = await createPortalSession(
      row.stripeCustomerId,
      `${env.PORTAL_URL}/subscription`,
    );
    res.json({ data: session });
  } catch (e) {
    next(e);
  }
});

/**
 * Read the current subscription state for the signed-in client. Used by the
 * portal to know whether to gate premium features and render the paywall.
 */
billingRouter.get('/subscription', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { role: string; clientId?: string };
    if (user.role !== 'client' || !user.clientId) {
      return res
        .status(403)
        .json({ error: { message: 'Only client users have a subscription', code: 'FORBIDDEN' } });
    }

    if (!isDbConfigured()) {
      const mock = mockClients.find((c) => c.id === user.clientId) ?? mockClients[0]!;
      const tier = getTier(mock.subscriptionTier);
      return res.json({
        data: {
          tier: mock.subscriptionTier,
          tierName: tier.name,
          priceCents: tier.priceCents,
          status: mock.subscriptionStatus ?? 'none',
          statusMeta: getStatusMeta(mock.subscriptionStatus),
          startedAt: mock.subscriptionStartedAt ?? null,
          active: hasActiveSubscription(mock),
          hasCustomer: Boolean(mock.stripeCustomerId),
        },
      });
    }

    const db = getDb();
    const [row] = await db.select().from(clients).where(eq(clients.id, user.clientId));
    if (!row) {
      return res.status(404).json({ error: { message: 'Client not found', code: 'NOT_FOUND' } });
    }
    const tier = getTier(row.subscriptionTier ?? 'social_only');
    res.json({
      data: {
        tier: row.subscriptionTier ?? 'social_only',
        tierName: tier.name,
        priceCents: tier.priceCents,
        status: row.subscriptionStatus ?? 'none',
        statusMeta: getStatusMeta(row.subscriptionStatus ?? 'none'),
        startedAt: row.subscriptionStartedAt?.toISOString() ?? null,
        active: hasActiveSubscription({ subscriptionStatus: row.subscriptionStatus ?? 'none' }),
        hasCustomer: Boolean(row.stripeCustomerId),
      },
    });
  } catch (e) {
    next(e);
  }
});
