/**
 * Tone-of-voice pair service.
 *
 * Brands teach Claude their voice two ways:
 *   1. `clients.brandVoice` — a free-text voice guide (big-picture).
 *   2. `toneOfVoicePairs`   — concrete good/bad copy pairs (few-shot).
 *
 * The pairs are the high-leverage piece. A single "good: ..., bad: ...,
 * why: ..." triple steers Claude more reliably than any paragraph of
 * voice guidance. Pairs are injected into every copy-generating prompt.
 */

import { eq, and, desc } from 'drizzle-orm';
import { getDb, isDbConfigured, toneOfVoicePairs } from '@boost/database';

export interface TonePairPayload {
  id: string;
  clientId: string;
  category: string | null;
  goodExample: string;
  badExample: string | null;
  explanation: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function listTonePairs(clientId: string): Promise<TonePairPayload[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(toneOfVoicePairs)
    .where(eq(toneOfVoicePairs.clientId, clientId))
    .orderBy(desc(toneOfVoicePairs.updatedAt));
  return rows.map(toPayload);
}

export interface CreateTonePairArgs {
  clientId: string;
  category?: string;
  goodExample: string;
  badExample?: string;
  explanation?: string;
}

export async function createTonePair(args: CreateTonePairArgs): Promise<TonePairPayload | null> {
  if (!isDbConfigured()) return null;
  if (!args.goodExample.trim()) return null;
  const db = getDb();
  const [row] = await db
    .insert(toneOfVoicePairs)
    .values({
      clientId: args.clientId,
      category: args.category?.trim() || null,
      goodExample: args.goodExample.trim().slice(0, 2000),
      badExample: args.badExample?.trim().slice(0, 2000) || null,
      explanation: args.explanation?.trim().slice(0, 2000) || null,
    })
    .returning();
  return row ? toPayload(row) : null;
}

export interface UpdateTonePairArgs {
  category?: string | null;
  goodExample?: string;
  badExample?: string | null;
  explanation?: string | null;
  isEnabled?: boolean;
}

export async function updateTonePair(
  clientId: string,
  pairId: string,
  patch: UpdateTonePairArgs,
): Promise<TonePairPayload | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .update(toneOfVoicePairs)
    .set({
      ...(patch.category !== undefined
        ? { category: patch.category?.trim().slice(0, 100) || null }
        : {}),
      ...(patch.goodExample !== undefined
        ? { goodExample: patch.goodExample.trim().slice(0, 2000) }
        : {}),
      ...(patch.badExample !== undefined
        ? { badExample: patch.badExample?.trim().slice(0, 2000) || null }
        : {}),
      ...(patch.explanation !== undefined
        ? { explanation: patch.explanation?.trim().slice(0, 2000) || null }
        : {}),
      ...(patch.isEnabled !== undefined ? { isEnabled: patch.isEnabled } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(toneOfVoicePairs.id, pairId),
        eq(toneOfVoicePairs.clientId, clientId),
      ),
    )
    .returning();
  return row ? toPayload(row) : null;
}

export async function deleteTonePair(clientId: string, pairId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const deleted = await db
    .delete(toneOfVoicePairs)
    .where(
      and(
        eq(toneOfVoicePairs.id, pairId),
        eq(toneOfVoicePairs.clientId, clientId),
      ),
    )
    .returning({ id: toneOfVoicePairs.id });
  return deleted.length > 0;
}

function toPayload(row: typeof toneOfVoicePairs.$inferSelect): TonePairPayload {
  return {
    id: row.id,
    clientId: row.clientId,
    category: row.category,
    goodExample: row.goodExample,
    badExample: row.badExample,
    explanation: row.explanation,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Format enabled tone pairs as a Claude prompt block. Optionally filter
 * by category so per-platform generation pulls only the relevant pairs
 * (e.g. `instagram_caption` pairs for IG caption generation).
 *
 * Cap is 12 pairs — more than that starts to confuse rather than help
 * and burns tokens for little gain.
 */
export function tonePairsToPromptBlock(
  pairs: TonePairPayload[],
  opts: { category?: string; max?: number } = {},
): string {
  const max = opts.max ?? 12;
  const enabled = pairs
    .filter((p) => p.isEnabled)
    .filter((p) => (opts.category ? !p.category || p.category === opts.category : true))
    .slice(0, max);

  if (enabled.length === 0) return '';

  const lines: string[] = [];
  lines.push(`Voice calibration — use these good/bad examples to steer tone:`);
  for (let i = 0; i < enabled.length; i++) {
    const p = enabled[i]!;
    lines.push('');
    lines.push(`Example ${i + 1}${p.category ? ` (${p.category})` : ''}:`);
    lines.push(`  ✅ GOOD: ${p.goodExample.slice(0, 600)}`);
    if (p.badExample) {
      lines.push(`  ❌ AVOID: ${p.badExample.slice(0, 600)}`);
    }
    if (p.explanation) {
      lines.push(`  → why: ${p.explanation.slice(0, 400)}`);
    }
  }
  return lines.join('\n');
}
