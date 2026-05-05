/**
 * Canva Connect routes.
 *
 * Agency-only. Every endpoint double-checks `features.canva` so a misconfigured
 * deploy returns a clear error ("Canva not configured") instead of a 500.
 *
 * Routes:
 *   GET    /api/v1/canva/status?clientId=          — is this client connected?
 *   GET    /api/v1/canva/connect?clientId=         — begin OAuth (redirects)
 *   GET    /api/v1/canva/callback                  — OAuth redirect target
 *   DELETE /api/v1/canva/connection?clientId=      — disconnect
 *   GET    /api/v1/canva/designs?clientId=         — list recent designs
 *   GET    /api/v1/canva/brand-templates?clientId= — list brand templates
 *   POST   /api/v1/canva/autofill                  — fill template + return edit url
 *   POST   /api/v1/canva/import-design             — export a design and save to media library
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clientImages, clients } from '@boost/database';
import {
  autofillBrandTemplate,
  buildAuthorizeUrl,
  disconnect as disconnectCanva,
  exportDesign,
  getConnection,
  handleAuthorizationCode,
  listBrandTemplates,
  listDesigns,
  uploadAssetFromUrl,
  waitForAutofill,
} from '../services/canva.js';
import { uploadFile } from '../services/r2.js';
import { requireAuth, requireRole } from '../services/auth.js';
import { broadcast } from '../services/realtime.js';
import { env, features } from '../env.js';

export const canvaRouter = Router();

/** Guard — returns 501 when Canva OAuth env isn't configured. */
function requireCanva(_req: any, res: any, next: any) {
  if (!features.canva) {
    return res.status(501).json({
      error: {
        message:
          'Canva integration is not configured on this server. Add CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, and CANVA_REDIRECT_URI to the environment.',
        code: 'NOT_CONFIGURED',
      },
    });
  }
  next();
}

canvaRouter.get('/status', requireAuth, async (req, res, next) => {
  try {
    const clientId = String(req.query.clientId ?? '');
    if (!clientId) {
      return res.status(400).json({ error: { message: 'clientId required', code: 'VALIDATION' } });
    }
    if (!features.canva) {
      return res.json({ data: { configured: false, connected: false } });
    }
    const conn = await getConnection(clientId);
    res.json({
      data: {
        configured: true,
        connected: !!conn,
        canvaUserId: conn?.canvaUserId ?? null,
        canvaTeamId: conn?.canvaTeamId ?? null,
        scopes: conn?.scopes ?? null,
        expiresAt: conn?.expiresAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Start OAuth. We redirect the browser to Canva's authorize URL with a
 * state token that carries the clientId. This route is a GET so it can
 * be hit as an anchor href from the dashboard.
 */
canvaRouter.get(
  '/connect',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  requireCanva,
  (req, res, next) => {
    try {
      const clientId = String(req.query.clientId ?? '');
      if (!clientId) {
        return res
          .status(400)
          .json({ error: { message: 'clientId required', code: 'VALIDATION' } });
      }
      const { url } = buildAuthorizeUrl(clientId);
      res.redirect(url);
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Canva's OAuth redirect target. We exchange the code, persist tokens,
 * and bounce the user back to the dashboard Media Studio with a
 * success flag so the UI can pop a toast.
 *
 * Not protected by requireAuth because Canva's redirect doesn't carry
 * our session cookie. We only trust the `state` PKCE token — see the
 * service layer.
 */
canvaRouter.get('/callback', requireCanva, async (req, res, next) => {
  try {
    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');
    const err = String(req.query.error ?? '');
    const appUrl = env.APP_URL ?? 'http://localhost:3000';
    const dashboardBase = `${appUrl.replace(/\/$/, '')}/dashboard/media`;

    if (err) {
      return res.redirect(`${dashboardBase}?canva=error&reason=${encodeURIComponent(err)}`);
    }
    if (!code || !state) {
      return res.redirect(`${dashboardBase}?canva=error&reason=missing_params`);
    }
    const { clientId } = await handleAuthorizationCode({ code, state });
    broadcast({ type: 'canva:connected', payload: { clientId } });
    res.redirect(
      `${dashboardBase}?canva=connected&clientId=${encodeURIComponent(clientId)}`,
    );
  } catch (e) {
    const appUrl = env.APP_URL ?? 'http://localhost:3000';
    const reason = encodeURIComponent((e as Error).message.slice(0, 140));
    res.redirect(
      `${appUrl.replace(/\/$/, '')}/dashboard/media?canva=error&reason=${reason}`,
    );
  }
});

canvaRouter.delete(
  '/connection',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.query.clientId ?? '');
      if (!clientId) {
        return res
          .status(400)
          .json({ error: { message: 'clientId required', code: 'VALIDATION' } });
      }
      const ok = await disconnectCanva(clientId);
      broadcast({ type: 'canva:disconnected', payload: { clientId } });
      res.json({ data: { disconnected: ok } });
    } catch (e) {
      next(e);
    }
  },
);

canvaRouter.get(
  '/designs',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  requireCanva,
  async (req, res, next) => {
    try {
      const clientId = String(req.query.clientId ?? '');
      if (!clientId) {
        return res
          .status(400)
          .json({ error: { message: 'clientId required', code: 'VALIDATION' } });
      }
      const designs = await listDesigns(clientId);
      res.json({ data: designs });
    } catch (e) {
      next(e);
    }
  },
);

canvaRouter.get(
  '/brand-templates',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  requireCanva,
  async (req, res, next) => {
    try {
      const clientId = String(req.query.clientId ?? '');
      if (!clientId) {
        return res
          .status(400)
          .json({ error: { message: 'clientId required', code: 'VALIDATION' } });
      }
      const templates = await listBrandTemplates(clientId);
      res.json({ data: templates });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Autofill a brand template: agency passes headline/subhead/image URL +
 * brand color; we upload the image as a Canva asset, run the autofill
 * job, and return the resulting design's edit URL so the agency can
 * tweak before exporting.
 *
 * Mostly used from the Content Studio "Design in Canva" button next to
 * a generated post.
 */
const autofillSchema = z.object({
  clientId: z.string().uuid(),
  brandTemplateId: z.string().min(1).max(200),
  headline: z.string().max(300).optional(),
  subheadline: z.string().max(500).optional(),
  /** Optional additional text slots the template exposes. */
  extra: z.record(z.string().max(500)).optional(),
  /** Optional image URL to slot into the template's photo placeholder. */
  imageUrl: z.string().url().max(1000).optional(),
  /** Name for the uploaded asset — defaults to "post". */
  imageName: z.string().max(100).optional(),
});

canvaRouter.post(
  '/autofill',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  requireCanva,
  async (req, res, next) => {
    try {
      const args = autofillSchema.parse(req.body);
      const data: Parameters<typeof autofillBrandTemplate>[0]['data'] = {};

      if (args.headline) data.headline = { type: 'text', text: args.headline };
      if (args.subheadline) data.subheadline = { type: 'text', text: args.subheadline };
      if (args.extra) {
        for (const [k, v] of Object.entries(args.extra)) {
          data[k] = { type: 'text', text: v };
        }
      }
      if (args.imageUrl) {
        const { assetId } = await uploadAssetFromUrl({
          clientId: args.clientId,
          url: args.imageUrl,
          name: args.imageName ?? 'post',
        });
        data.photo = { type: 'image', asset_id: assetId };
      }

      const { jobId } = await autofillBrandTemplate({
        clientId: args.clientId,
        brandTemplateId: args.brandTemplateId,
        data,
      });

      const design = await waitForAutofill(args.clientId, jobId);
      res.json({ data: design });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Import a Canva design: export it to PNG/MP4, stream to R2, and insert
 * a clientImages row tagged `source='canva'` so it shows up in the Media
 * Studio alongside uploads and renders.
 */
const importSchema = z.object({
  clientId: z.string().uuid(),
  designId: z.string().min(1).max(200),
  format: z.enum(['png', 'jpg', 'mp4']).default('png'),
  caption: z.string().max(500).optional(),
});

canvaRouter.post(
  '/import-design',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  requireCanva,
  async (req, res, next) => {
    try {
      const args = importSchema.parse(req.body);
      if (!isDbConfigured()) {
        return res.status(503).json({
          error: { message: 'Database is not configured', code: 'NO_DB' },
        });
      }
      const db = getDb();
      const [client] = await db.select().from(clients).where(eq(clients.id, args.clientId));
      if (!client) {
        return res.status(404).json({ error: { message: 'Client not found', code: 'NOT_FOUND' } });
      }

      const exported = await exportDesign({
        clientId: args.clientId,
        designId: args.designId,
        format: args.format,
      });
      if (!exported.urls.length) throw new Error('Canva returned no export URLs');

      const created: any[] = [];
      for (let i = 0; i < exported.urls.length; i++) {
        const url = exported.urls[i]!;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Canva download failed (${resp.status})`);
        const buf = Buffer.from(await resp.arrayBuffer());
        const mime =
          args.format === 'mp4'
            ? 'video/mp4'
            : args.format === 'jpg'
              ? 'image/jpeg'
              : 'image/png';
        const name = `canva-${args.designId}-${i + 1}.${args.format}`;
        const { url: r2Url } = await uploadFile(args.clientId, buf, name, mime);

        const [row] = await db
          .insert(clientImages)
          .values({
            clientId: args.clientId,
            fileUrl: r2Url,
            fileName: name,
            fileSizeBytes: buf.length,
            mimeType: mime,
            tags: ['canva', args.format],
            aiDescription: args.caption ?? null,
            source: 'canva',
            status: 'approved',
          })
          .returning();
        if (row) created.push(row);
      }

      broadcast({ type: 'canva:imported', payload: { clientId: args.clientId, count: created.length } });
      res.status(201).json({ data: created });
    } catch (e) {
      next(e);
    }
  },
);
