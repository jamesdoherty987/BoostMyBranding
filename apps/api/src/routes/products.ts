/**
 * Products catalog routes.
 *
 *   GET    /api/v1/clients/:clientId/products
 *   POST   /api/v1/clients/:clientId/products
 *   GET    /api/v1/clients/:clientId/products/:productId
 *   PATCH  /api/v1/clients/:clientId/products/:productId
 *   DELETE /api/v1/clients/:clientId/products/:productId
 *   POST   /api/v1/clients/:clientId/products/:productId/media/:imageId   (link existing media)
 *   DELETE /api/v1/clients/:clientId/products/:productId/media/:imageId   (unlink)
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  linkMediaToProduct,
  unlinkMediaFromProduct,
} from '../services/products.js';
import { requireAuth, requireRole } from '../services/auth.js';

export const productsRouter = Router({ mergeParams: true });

function scopeCheck(req: any, res: any, next: any) {
  const user = req.user as { role: string; clientId?: string };
  const clientId = String(req.params.clientId);
  if (user.role === 'client' && user.clientId !== clientId) {
    return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
  }
  next();
}

const statusEnum = z.enum(['draft', 'active', 'archived']);

productsRouter.get('/', requireAuth, scopeCheck, async (req, res, next) => {
  try {
    const clientId = String(req.params.clientId);
    const statusQuery = req.query.status as string | undefined;
    const parsed = statusQuery ? statusEnum.safeParse(statusQuery) : null;
    const products = await listProducts(clientId, {
      status: parsed?.success ? parsed.data : undefined,
    });
    res.json({ data: products });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  sku: z.string().max(100).optional(),
  priceCents: z.number().int().min(0).max(100_000_000).optional(),
  currency: z.string().max(10).optional(),
  tags: z.array(z.string().max(50)).max(25).optional(),
  status: statusEnum.optional(),
  primaryImageUrl: z.string().url().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

productsRouter.post(
  '/',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const body = createSchema.parse(req.body);
      const product = await createProduct({ clientId, ...body });
      if (!product) {
        return res
          .status(400)
          .json({ error: { message: 'Could not create product', code: 'CREATE_FAILED' } });
      }
      res.status(201).json({ data: product });
    } catch (e) {
      next(e);
    }
  },
);

productsRouter.get('/:productId', requireAuth, scopeCheck, async (req, res, next) => {
  try {
    const clientId = String(req.params.clientId);
    const productId = String(req.params.productId);
    const product = await getProduct(clientId, productId);
    if (!product) {
      return res.status(404).json({ error: { message: 'Product not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: product });
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  sku: z.string().max(100).nullable().optional(),
  priceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  currency: z.string().max(10).optional(),
  tags: z.array(z.string().max(50)).max(25).optional(),
  status: statusEnum.optional(),
  primaryImageUrl: z.string().url().max(2000).nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
});

productsRouter.patch(
  '/:productId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const productId = String(req.params.productId);
      const body = updateSchema.parse(req.body);
      const product = await updateProduct(clientId, productId, body);
      if (!product) {
        return res
          .status(404)
          .json({ error: { message: 'Product not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: product });
    } catch (e) {
      next(e);
    }
  },
);

productsRouter.delete(
  '/:productId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const productId = String(req.params.productId);
      const ok = await deleteProduct(clientId, productId);
      if (!ok) {
        return res
          .status(404)
          .json({ error: { message: 'Product not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  },
);

productsRouter.post(
  '/:productId/media/:imageId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const productId = String(req.params.productId);
      const imageId = String(req.params.imageId);
      const ok = await linkMediaToProduct({ clientId, productId, imageId });
      if (!ok) {
        return res
          .status(404)
          .json({ error: { message: 'Product or image not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  },
);

productsRouter.delete(
  '/:productId/media/:imageId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const productId = String(req.params.productId);
      const imageId = String(req.params.imageId);
      const ok = await unlinkMediaFromProduct({ clientId, productId, imageId });
      if (!ok) {
        return res
          .status(404)
          .json({ error: { message: 'Product not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  },
);
