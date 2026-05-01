/**
 * Stripe service. Creates Checkout Sessions for each subscription tier,
 * creates a customer, and handles webhook events to mark invoices paid.
 *
 * Without a STRIPE_SECRET_KEY the helpers return pretend Checkout URLs so the
 * landing page flow still works end-to-end.
 */

import Stripe from 'stripe';
import { env, features } from '../env.js';

let _stripe: Stripe | null = null;
export function stripe() {
  if (!_stripe && features.stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2024-11-20.acacia' as any });
  }
  return _stripe;
}

export type Tier = 'social_only' | 'website_only' | 'full_package';

export function priceIdFor(tier: Tier): string | undefined {
  switch (tier) {
    case 'social_only':
      return env.STRIPE_PRICE_SOCIAL;
    case 'website_only':
      return env.STRIPE_PRICE_WEBSITE;
    case 'full_package':
      return env.STRIPE_PRICE_FULL;
  }
}

interface CheckoutArgs {
  tier: Tier;
  customerEmail: string;
  clientId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export async function createCheckoutSession(args: CheckoutArgs) {
  if (!features.stripe || !stripe()) {
    return {
      url: `${env.APP_URL}/pricing/success?mock=1&tier=${args.tier}`,
      id: 'cs_mock',
    };
  }

  const price = priceIdFor(args.tier);
  if (!price) {
    throw new Error(`No Stripe price configured for tier ${args.tier}`);
  }

  const session = await stripe()!.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    customer_email: args.customerEmail,
    metadata: { tier: args.tier, clientId: args.clientId ?? '' },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    success_url: args.successUrl ?? `${env.APP_URL}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: args.cancelUrl ?? `${env.APP_URL}/pricing`,
  });

  return { url: session.url ?? '', id: session.id };
}

/** Verify and parse an incoming Stripe webhook payload. */
export function verifyWebhook(rawBody: Buffer, signature: string) {
  if (!features.stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook is not configured');
  }
  return stripe()!.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  if (!features.stripe || !stripe()) {
    return { url: returnUrl };
  }
  const s = await stripe()!.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: s.url };
}
