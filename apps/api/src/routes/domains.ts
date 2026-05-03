/**
 * Custom domain management routes. Agency-only.
 *
 *   POST   /api/v1/domains/:clientId     Attach a new domain to a client.
 *   GET    /api/v1/domains/:clientId     Read current domain + verification state.
 *   POST   /api/v1/domains/:clientId/verify  Re-check Vercel verification.
 *   DELETE /api/v1/domains/:clientId     Detach the domain.
 *
 * Attach flow:
 *   1. Validate the domain.
 *   2. Save it on the client row (`custom_domain_status = 'pending'`).
 *   3. Call Vercel to add it to the project.
 *   4. Return the DNS records the customer needs to set.
 *
 * The web-app middleware (apps/web/middleware.ts) reads `customDomain`
 * from the client row to rewrite requests, so step 2 is what makes the
 * site start resolving once DNS is live — steps 3–4 are for TLS and for
 * surfacing the records the customer needs.
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clients } from '@boost/database';
import { requireAuth, requireRole } from '../services/auth.js';
import {
  addDomain,
  removeDomain,
  checkDomain,
  normalizeDomain,
  isValidDomain,
} from '../services/vercel.js';

export const domainsRouter = Router();

const setSchema = z.object({
  domain: z.string().min(3).max(253),
});

/** Attach (or replace) a custom domain on a client. */
domainsRouter.post(
  '/:clientId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const { domain: raw } = setSchema.parse(req.body);
      const domain = normalizeDomain(raw);
      if (!isValidDomain(domain)) {
        return res
          .status(400)
          .json({ error: { message: 'Invalid domain', code: 'BAD_DOMAIN' } });
      }

      if (!isDbConfigured()) {
        const status = await addDomain(domain);
        return res.json({
          data: {
            clientId,
            customDomain: domain,
            status: 'provisioning',
            verification: status,
          },
        });
      }

      const db = getDb();
      // Reject if the domain is already claimed by someone else. The unique
      // index enforces this at the DB level too, but a friendly error message
      // is better than a 500.
      const [conflict] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.customDomain, domain))
        .limit(1);
      if (conflict && conflict.id !== clientId) {
        return res.status(409).json({
          error: {
            message: 'That domain is already attached to another client',
            code: 'DOMAIN_IN_USE',
          },
        });
      }

      // Save the domain FIRST so the middleware can serve the site the
      // moment DNS lands, even if the Vercel call below fails/retries.
      await db
        .update(clients)
        .set({
          customDomain: domain,
          customDomainStatus: 'provisioning',
          customDomainError: null,
          customDomainVerifiedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, clientId));

      let status;
      try {
        status = await addDomain(domain);
      } catch (e) {
        // Persist the error so the dashboard can explain what's wrong.
        await db
          .update(clients)
          .set({
            customDomainStatus: 'failed',
            customDomainError: (e as Error).message,
          })
          .where(eq(clients.id, clientId));
        throw e;
      }

      // If Vercel already verified it (rare on first attach, common on retry),
      // mark it verified immediately.
      if (status.verified) {
        await db
          .update(clients)
          .set({
            customDomainStatus: 'verified',
            customDomainVerifiedAt: new Date(),
            customDomainError: null,
          })
          .where(eq(clients.id, clientId));
      }

      res.json({
        data: {
          clientId,
          customDomain: domain,
          status: status.verified ? 'verified' : 'provisioning',
          verification: status,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

/** Read current domain + verification state. */
domainsRouter.get(
  '/:clientId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      if (!isDbConfigured()) {
        return res.json({ data: null });
      }
      const db = getDb();
      const [row] = await db
        .select({
          customDomain: clients.customDomain,
          customDomainStatus: clients.customDomainStatus,
          customDomainError: clients.customDomainError,
          customDomainVerifiedAt: clients.customDomainVerifiedAt,
        })
        .from(clients)
        .where(eq(clients.id, clientId));
      if (!row?.customDomain) {
        return res.json({ data: null });
      }
      const verification = await checkDomain(row.customDomain);
      res.json({
        data: {
          clientId,
          customDomain: row.customDomain,
          status: row.customDomainStatus,
          error: row.customDomainError,
          verifiedAt: row.customDomainVerifiedAt,
          verification,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

/** Force a Vercel verification check + update status on the row. */
domainsRouter.post(
  '/:clientId/verify',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      if (!isDbConfigured()) {
        return res.json({ data: { status: 'verified' } });
      }
      const db = getDb();
      const [row] = await db
        .select({ customDomain: clients.customDomain })
        .from(clients)
        .where(eq(clients.id, clientId));
      if (!row?.customDomain) {
        return res
          .status(404)
          .json({ error: { message: 'No domain attached', code: 'NOT_FOUND' } });
      }
      const status = await checkDomain(row.customDomain);
      await db
        .update(clients)
        .set({
          customDomainStatus: status.verified ? 'verified' : 'provisioning',
          customDomainVerifiedAt: status.verified ? new Date() : null,
          customDomainError: status.error ?? null,
        })
        .where(eq(clients.id, clientId));

      res.json({
        data: {
          status: status.verified ? 'verified' : 'provisioning',
          verification: status,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

/** Detach the domain from the client + remove from Vercel. */
domainsRouter.delete(
  '/:clientId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      if (!isDbConfigured()) {
        return res.json({ data: { removed: true } });
      }
      const db = getDb();
      const [row] = await db
        .select({ customDomain: clients.customDomain })
        .from(clients)
        .where(eq(clients.id, clientId));
      if (row?.customDomain) {
        try {
          await removeDomain(row.customDomain);
        } catch (e) {
          console.warn(
            `[domains] vercel removeDomain failed for ${row.customDomain}:`,
            (e as Error).message,
          );
          // Proceed — we still want to clear the row.
        }
      }
      await db
        .update(clients)
        .set({
          customDomain: null,
          customDomainStatus: null,
          customDomainVerifiedAt: null,
          customDomainError: null,
        })
        .where(eq(clients.id, clientId));
      res.json({ data: { removed: true } });
    } catch (e) {
      next(e);
    }
  },
);
