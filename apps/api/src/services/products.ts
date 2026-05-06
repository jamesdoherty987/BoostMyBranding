/**
 * Products catalog service.
 *
 * A product is a first-class object the AI can target for generation —
 * "make a Reel for product X" will pull that product's name, description,
 * price, tags, and linked media and feed them to Claude + the image/video
 * models. This keeps ads faithful to actual SKUs instead of generic
 * category-level copy.
 *
 * Linked media:
 *   Products don't own media directly — instead, `clientImages.productId`
 *   is set on rows that depict this product. That way a single media
 *   item can only belong to one product, and unlinking is just a nullable
 *   FK update instead of a join-table delete.
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb, isDbConfigured, products, clientImages, clients } from '@boost/database';

export interface ProductMedia {
  id: string;
  fileUrl: string;
  mimeType: string | null;
  status: string;
}

export interface ProductPayload {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  sku: string | null;
  priceCents: number | null;
  currency: string | null;
  primaryImageUrl: string | null;
  tags: string[];
  status: 'draft' | 'active' | 'archived';
  metadata: Record<string, unknown> | null;
  media: ProductMedia[];
  createdAt: Date;
  updatedAt: Date;
}

export async function listProducts(
  clientId: string,
  opts: { status?: 'draft' | 'active' | 'archived' } = {},
): Promise<ProductPayload[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();

  const whereClause = opts.status
    ? and(eq(products.clientId, clientId), eq(products.status, opts.status))
    : eq(products.clientId, clientId);

  const rows = await db
    .select()
    .from(products)
    .where(whereClause)
    .orderBy(desc(products.updatedAt));

  if (rows.length === 0) return [];

  const mediaRows = await db
    .select({
      id: clientImages.id,
      fileUrl: clientImages.fileUrl,
      enhancedUrl: clientImages.enhancedUrl,
      mimeType: clientImages.mimeType,
      status: clientImages.status,
      productId: clientImages.productId,
    })
    .from(clientImages)
    .where(
      inArray(
        clientImages.productId,
        rows.map((r) => r.id),
      ),
    );

  return rows.map((row) => {
    const productMedia = mediaRows
      .filter((m) => m.productId === row.id)
      .map((m) => ({
        id: m.id,
        fileUrl: m.enhancedUrl ?? m.fileUrl,
        mimeType: m.mimeType,
        status: m.status,
      }));
    return toPayload(row, productMedia);
  });
}

export async function getProduct(
  clientId: string,
  productId: string,
): Promise<ProductPayload | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.clientId, clientId)));
  if (!row) return null;

  const mediaRows = await db
    .select({
      id: clientImages.id,
      fileUrl: clientImages.fileUrl,
      enhancedUrl: clientImages.enhancedUrl,
      mimeType: clientImages.mimeType,
      status: clientImages.status,
    })
    .from(clientImages)
    .where(eq(clientImages.productId, productId));

  return toPayload(
    row,
    mediaRows.map((m) => ({
      id: m.id,
      fileUrl: m.enhancedUrl ?? m.fileUrl,
      mimeType: m.mimeType,
      status: m.status,
    })),
  );
}

export interface CreateProductArgs {
  clientId: string;
  name: string;
  description?: string;
  sku?: string;
  priceCents?: number;
  currency?: string;
  tags?: string[];
  status?: 'draft' | 'active' | 'archived';
  primaryImageUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function createProduct(args: CreateProductArgs): Promise<ProductPayload | null> {
  if (!isDbConfigured()) return null;
  if (!args.name.trim()) return null;
  const db = getDb();

  // Verify the client exists.
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, args.clientId));
  if (!client) return null;

  const [row] = await db
    .insert(products)
    .values({
      clientId: args.clientId,
      name: args.name.trim().slice(0, 200),
      description: args.description?.trim().slice(0, 4000) || null,
      sku: args.sku?.trim().slice(0, 100) || null,
      priceCents: args.priceCents ?? null,
      currency: args.currency?.trim().slice(0, 10) || 'EUR',
      primaryImageUrl: args.primaryImageUrl ?? null,
      tags: args.tags?.slice(0, 25) ?? [],
      status: args.status ?? 'draft',
      metadata: args.metadata ?? null,
    })
    .returning();
  return row ? toPayload(row, []) : null;
}

export interface UpdateProductArgs {
  name?: string;
  description?: string | null;
  sku?: string | null;
  priceCents?: number | null;
  currency?: string;
  tags?: string[];
  status?: 'draft' | 'active' | 'archived';
  primaryImageUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function updateProduct(
  clientId: string,
  productId: string,
  patch: UpdateProductArgs,
): Promise<ProductPayload | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .update(products)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 200) } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim().slice(0, 4000) || null }
        : {}),
      ...(patch.sku !== undefined
        ? { sku: patch.sku?.trim().slice(0, 100) || null }
        : {}),
      ...(patch.priceCents !== undefined ? { priceCents: patch.priceCents } : {}),
      ...(patch.currency !== undefined
        ? { currency: patch.currency.trim().slice(0, 10) || 'EUR' }
        : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags.slice(0, 25) } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.primaryImageUrl !== undefined
        ? { primaryImageUrl: patch.primaryImageUrl || null }
        : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, productId), eq(products.clientId, clientId)))
    .returning();
  if (!row) return null;
  return getProduct(clientId, productId);
}

export async function deleteProduct(clientId: string, productId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const deleted = await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.clientId, clientId)))
    .returning({ id: products.id });
  return deleted.length > 0;
}

/**
 * Link an existing media item (from clientImages) to a product. Verifies
 * both rows belong to the same client before setting the FK.
 */
export async function linkMediaToProduct(args: {
  clientId: string;
  productId: string;
  imageId: string;
}): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  // Scope checks.
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, args.productId), eq(products.clientId, args.clientId)));
  if (!product) return false;
  const [image] = await db
    .select({ id: clientImages.id })
    .from(clientImages)
    .where(
      and(eq(clientImages.id, args.imageId), eq(clientImages.clientId, args.clientId)),
    );
  if (!image) return false;

  await db
    .update(clientImages)
    .set({ productId: args.productId })
    .where(eq(clientImages.id, args.imageId));
  return true;
}

export async function unlinkMediaFromProduct(args: {
  clientId: string;
  productId: string;
  imageId: string;
}): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, args.productId), eq(products.clientId, args.clientId)));
  if (!product) return false;
  await db
    .update(clientImages)
    .set({ productId: null })
    .where(
      and(
        eq(clientImages.id, args.imageId),
        eq(clientImages.productId, args.productId),
        eq(clientImages.clientId, args.clientId),
      ),
    );
  return true;
}

function toPayload(
  row: typeof products.$inferSelect,
  media: ProductMedia[],
): ProductPayload {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    description: row.description,
    sku: row.sku,
    priceCents: row.priceCents,
    currency: row.currency,
    primaryImageUrl: row.primaryImageUrl,
    tags: (row.tags as string[] | null) ?? [],
    status: row.status as ProductPayload['status'],
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    media,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Format active products into a Claude prompt block. Used by the
 * content calendar generator and product-targeted ad flow so the
 * AI can reference real SKU names and avoid inventing products.
 */
export function productsToPromptBlock(list: ProductPayload[]): string {
  const active = list.filter((p) => p.status === 'active');
  if (active.length === 0) return '';

  const lines: string[] = [];
  lines.push(`Product catalog — always refer to products by exact name when mentioning them:`);
  for (const p of active.slice(0, 50)) {
    const bits: string[] = [];
    if (p.sku) bits.push(`SKU ${p.sku}`);
    if (p.priceCents != null) {
      const units = (p.priceCents / 100).toFixed(2);
      bits.push(`${p.currency ?? 'EUR'} ${units}`);
    }
    if (p.tags.length) bits.push(`tags: ${p.tags.join(', ')}`);
    const meta = bits.length ? ` [${bits.join(' · ')}]` : '';
    lines.push(`• ${p.name}${meta}`);
    if (p.description) {
      lines.push(`    ${p.description.slice(0, 280)}`);
    }
    if (p.media.length) {
      lines.push(`    ${p.media.length} media item(s) linked.`);
    }
  }
  lines.push('');
  lines.push(
    'When generating content, do NOT invent product names, specs, or prices. Use only what is above.',
  );
  return lines.join('\n');
}
