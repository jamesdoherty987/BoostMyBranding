/**
 * Webhooks must read raw bodies. Mount under `/api/v1/webhooks` BEFORE
 * express.json() is applied to these paths.
 */

import { Router, raw } from 'express';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clients, invoices } from '@boost/database';
import { verifyWebhook } from '../services/stripe.js';
import { features } from '../env.js';

export const webhooksRouter = Router();

/**
 * Map a Stripe subscription status onto our narrower enum. We collapse
 * `incomplete`, `incomplete_expired`, `unpaid`, `paused` into either
 * `past_due` (recoverable) or `canceled` (terminal).
 */
function mapStripeStatus(stripeStatus: string): 'none' | 'active' | 'past_due' | 'canceled' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'paused':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'none';
  }
}

/**
 * Best-effort resolver: prefer the clientId in metadata, fall back to the
 * customer email, then the Stripe customer id already stored. Returns null
 * if we can't tie this Stripe event to any of our clients.
 */
async function findClientId(s: {
  metadata?: { clientId?: string | null };
  customer?: string | null;
  customer_email?: string | null;
}): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();

  if (s.metadata?.clientId) return s.metadata.clientId;

  if (s.customer_email) {
    const [row] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, s.customer_email.toLowerCase()))
      .limit(1);
    if (row) return row.id;
  }

  if (s.customer) {
    const [row] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.stripeCustomerId, s.customer))
      .limit(1);
    if (row) return row.id;
  }

  return null;
}

webhooksRouter.post('/stripe', raw({ type: 'application/json' }), async (req, res) => {
  if (!features.stripe) {
    return res.json({ received: true, skipped: true });
  }
  const sig = req.header('stripe-signature') ?? '';
  let event;
  try {
    event = verifyWebhook(req.body as Buffer, sig);
  } catch (e) {
    console.error('Stripe signature verification failed', e);
    return res.status(400).send('Invalid signature');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as any;
        const clientId = await findClientId(s);
        if (isDbConfigured() && clientId) {
          const db = getDb();
          await db
            .update(clients)
            .set({
              stripeCustomerId: s.customer,
              stripeSubscriptionId: s.subscription,
              subscriptionStatus: 'active',
              subscriptionStartedAt: new Date(),
              isActive: true,
              onboardedAt: new Date(),
            })
            .where(eq(clients.id, clientId));
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const clientId = await findClientId({
          metadata: sub.metadata,
          customer: sub.customer,
        });
        if (isDbConfigured() && clientId) {
          const db = getDb();
          await db
            .update(clients)
            .set({
              stripeSubscriptionId: sub.id,
              stripeCustomerId: sub.customer,
              subscriptionStatus: mapStripeStatus(sub.status),
              subscriptionStartedAt:
                sub.start_date != null ? new Date(sub.start_date * 1000) : new Date(),
            })
            .where(eq(clients.id, clientId));
        }
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as any;
        if (isDbConfigured()) {
          const db = getDb();
          const clientId = await findClientId({
            metadata: inv.metadata,
            customer: inv.customer,
            customer_email: inv.customer_email,
          });
          if (clientId) {
            await db
              .insert(invoices)
              .values({
                clientId,
                amountCents: inv.amount_paid,
                currency: inv.currency?.toUpperCase() ?? 'EUR',
                status: 'paid',
                stripeInvoiceId: inv.id,
                hostedUrl: inv.hosted_invoice_url,
                pdfUrl: inv.invoice_pdf,
                paidAt: new Date(),
              })
              .onConflictDoNothing();
          }
        }
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as any;
        const clientId = await findClientId({
          metadata: inv.metadata,
          customer: inv.customer,
          customer_email: inv.customer_email,
        });
        if (isDbConfigured() && clientId) {
          const db = getDb();
          await db
            .update(clients)
            .set({ subscriptionStatus: 'past_due' })
            .where(eq(clients.id, clientId));
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        if (isDbConfigured()) {
          const db = getDb();
          await db
            .update(clients)
            .set({ subscriptionStatus: 'canceled' })
            .where(eq(clients.stripeSubscriptionId, sub.id));
        }
        break;
      }
    }
  } catch (e) {
    console.error('Webhook handler failed', e);
    return res.status(500).send('Handler error');
  }

  res.json({ received: true });
});

webhooksRouter.post('/contentstudio', raw({ type: 'application/json' }), (_req, res) => {
  // TODO: handle post.published / post.failed events to update analytics
  res.json({ received: true });
});
