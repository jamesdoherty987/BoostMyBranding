/**
 * Per-account media library.
 *
 * The user's uploaded reference photos / videos / audio, each tagged
 * with a role ('style_reference' | 'avatar_reference' | …), a free-text
 * description, and tags. This library is the primary anti-slop signal:
 * the generator consults it on every run to pick references that match
 * the user's stated vibe.
 *
 * Uploads live under R2 at `personal/{accountId}/library/…`.
 */

import { and, desc, eq } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  personalAccountMedia,
  personalAccounts,
} from '@boost/database';
import { uploadFile } from './r2.js';
import { analyzeImage } from './claude.js';

export type MediaRole =
  | 'style_reference'
  | 'avatar_reference'
  | 'brand_asset'
  | 'broll'
  | 'voice_sample'
  | 'music'
  | 'inspiration'
  | 'location'
  | 'product';

export interface AccountMediaPayload {
  id: string;
  accountId: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  kind: string;
  role: MediaRole;
  description: string | null;
  tags: string[];
  aiDescription: string | null;
  isPinned: boolean;
  isArchived: boolean;
  characterId: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ─── Upload ──────────────────────────────────────────────────── */

export interface UploadMediaArgs {
  userId: string;
  accountId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  role: MediaRole;
  description?: string;
  tags?: string[];
  characterId?: string;
  pinned?: boolean;
}

export async function uploadAccountMedia(
  args: UploadMediaArgs,
): Promise<AccountMediaPayload> {
  assertDb();
  const db = getDb();

  // Scope check — user must own this account.
  const [account] = await db
    .select()
    .from(personalAccounts)
    .where(
      and(
        eq(personalAccounts.id, args.accountId),
        eq(personalAccounts.userId, args.userId),
      ),
    );
  if (!account) throw new Error('Account not found');

  const { url } = await uploadFile(
    `personal/${args.accountId}/library`,
    args.buffer,
    args.fileName,
    args.mimeType,
  );

  const kind = args.mimeType.startsWith('video/')
    ? 'video'
    : args.mimeType.startsWith('audio/')
      ? 'audio'
      : 'image';

  const [row] = await db
    .insert(personalAccountMedia)
    .values({
      accountId: args.accountId,
      fileUrl: url,
      fileName: args.fileName,
      mimeType: args.mimeType,
      kind,
      role: args.role,
      description: args.description,
      tags: args.tags ?? [],
      characterId: args.characterId,
      isPinned: args.pinned ?? false,
    })
    .returning();
  if (!row) throw new Error('Failed to persist media');

  // Kick off a Claude Vision description in the background (images only).
  // It's best-effort — we don't await it so the upload returns fast.
  if (kind === 'image') {
    void analyzeImage(
      url,
      `Describe this reference image in 1-2 sentences focusing on aesthetic, lighting, palette, composition, and subject. Return JSON: { "description": "...", "keywords": ["..."] }`,
    )
      .then(async (out: unknown) => {
        const desc = (out as { description?: string })?.description;
        if (desc) {
          await db
            .update(personalAccountMedia)
            .set({ aiDescription: desc, updatedAt: new Date() })
            .where(eq(personalAccountMedia.id, row.id));
        }
      })
      .catch((e) => console.warn('[media] ai-describe failed:', (e as Error).message));
  }

  return toPayload(row);
}

/* ─── List / get / update / delete ───────────────────────────── */

export async function listAccountMedia(
  userId: string,
  accountId: string,
  opts: { role?: MediaRole; characterId?: string } = {},
): Promise<AccountMediaPayload[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  // Scope check via join.
  const [account] = await db
    .select({ id: personalAccounts.id })
    .from(personalAccounts)
    .where(
      and(
        eq(personalAccounts.id, accountId),
        eq(personalAccounts.userId, userId),
      ),
    );
  if (!account) return [];

  const where = [eq(personalAccountMedia.accountId, accountId)];
  if (opts.role) where.push(eq(personalAccountMedia.role, opts.role));
  if (opts.characterId) where.push(eq(personalAccountMedia.characterId, opts.characterId));

  const rows = await db
    .select()
    .from(personalAccountMedia)
    .where(and(...where))
    .orderBy(desc(personalAccountMedia.isPinned), desc(personalAccountMedia.createdAt));
  return rows.map(toPayload);
}

export async function getAccountMedia(
  userId: string,
  mediaId: string,
): Promise<AccountMediaPayload | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({ m: personalAccountMedia })
    .from(personalAccountMedia)
    .innerJoin(
      personalAccounts,
      eq(personalAccounts.id, personalAccountMedia.accountId),
    )
    .where(
      and(
        eq(personalAccountMedia.id, mediaId),
        eq(personalAccounts.userId, userId),
      ),
    );
  if (rows.length === 0) return null;
  return toPayload(rows[0]!.m);
}

export async function updateAccountMedia(
  userId: string,
  mediaId: string,
  patch: Partial<{
    description: string | null;
    tags: string[];
    role: MediaRole;
    characterId: string | null;
    isPinned: boolean;
    isArchived: boolean;
  }>,
): Promise<AccountMediaPayload | null> {
  assertDb();
  const existing = await getAccountMedia(userId, mediaId);
  if (!existing) return null;
  const db = getDb();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) updates[k] = v;
  }
  const [row] = await db
    .update(personalAccountMedia)
    .set(updates as any)
    .where(eq(personalAccountMedia.id, mediaId))
    .returning();
  return row ? toPayload(row) : null;
}

export async function deleteAccountMedia(userId: string, mediaId: string) {
  assertDb();
  const existing = await getAccountMedia(userId, mediaId);
  if (!existing) return false;
  const db = getDb();
  await db
    .delete(personalAccountMedia)
    .where(eq(personalAccountMedia.id, mediaId));
  return true;
}

/** Internal: the pipeline uses this to pull reference assets for a gen run. */
export async function internalListForPipeline(
  accountId: string,
  role?: MediaRole,
): Promise<typeof personalAccountMedia.$inferSelect[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const where = [
    eq(personalAccountMedia.accountId, accountId),
    eq(personalAccountMedia.isArchived, false),
  ];
  if (role) where.push(eq(personalAccountMedia.role, role));
  return db
    .select()
    .from(personalAccountMedia)
    .where(and(...where))
    .orderBy(desc(personalAccountMedia.isPinned), desc(personalAccountMedia.updatedAt))
    .limit(24);
}

/* ─── helpers ────────────────────────────────────────────────── */

function toPayload(
  row: typeof personalAccountMedia.$inferSelect,
): AccountMediaPayload {
  return {
    id: row.id,
    accountId: row.accountId,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    mimeType: row.mimeType,
    kind: row.kind,
    role: row.role as MediaRole,
    description: row.description,
    tags: row.tags ?? [],
    aiDescription: row.aiDescription,
    isPinned: row.isPinned,
    isArchived: row.isArchived,
    characterId: row.characterId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertDb() {
  if (!isDbConfigured()) throw new Error('DATABASE_URL required for account media');
}
