/**
 * Billing routes — create Stripe Checkout sessions + customer portal links.
 * No authentication is required for checkout (the marketing site has to work
 * for non-users) but input is strictly validated and rate-limited.
 */

import { Router } from 'express';
import { z } from 'zod';
import { createCheckoutSession, createPortalSession } from '../services/stripe.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { env } from '../env.js';
import { requireAuth } from '../services/auth.js';

export const billingRouter = Router();

const checkoutSchema = z.object({
  tier: z.enum(['social_only', 'website_only', 'full_package']),
  email: z.string().email().max(200),
  businessName: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  industry: z.string().max(100).optional(),
  websiteUrl: z.string().url().max(500).optional(),
});

billingRouter.post('/checkout', authLimiter, async (req, res, next) => {
  try {
    const body = checkoutSchema.parse(req.body);
    const session = await createCheckoutSession({
      tier: body.tier,
      customerEmail: body.email,
      successUrl: `${env.APP_URL}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${env.APP_URL}/pricing`,
    });
    res.json({ data: session });
  } catch (e) {
    next(e);
  }
});

billingRouter.post('/portal', requireAuth, async (req, res, next) => {
  try {
    const customerId = String(req.body?.customerId ?? '').slice(0, 200);
    if (!customerId)
      return res.status(400).json({ error: { message: 'customerId required', code: 'VALIDATION' } });
    const session = await createPortalSession(customerId, `${env.PORTAL_URL}/invoices`);
    res.json({ data: session });
  } catch (e) {
    next(e);
  }
});
