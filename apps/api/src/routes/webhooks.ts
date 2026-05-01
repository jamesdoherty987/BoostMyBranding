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
        if (isDbConfigured() && s.metadata?.clientId) {
          const db = getDb();
          await db
            .update(clients)
            .set({
              stripeCustomerId: s.customer,
              stripeSubscriptionId: s.subscription,
              isActive: true,
              onboardedAt: new Date(),
            })
            .where(eq(clients.id, s.metadata.clientId));
        }
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as any;
        if (isDbConfigured()) {
          const db = getDb();
          await db
            .insert(invoices)
            .values({
              clientId: inv.metadata?.clientId ?? inv.customer,
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
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        if (isDbConfigured()) {
          const db = getDb();
          await db
            .update(clients)
            .set({ isActive: false })
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
