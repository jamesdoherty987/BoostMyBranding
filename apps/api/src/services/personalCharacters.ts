/**
 * AI-influencer character service.
 *
 * A "character" is a persistent persona whose face, body, wardrobe, and
 * voice stay consistent across every video generated for an account
 * that uses them. The operator uploads 1-10 reference images, Claude
 * Vision distills them into a structured character sheet, and every
 * downstream image/video generation injects:
 *
 *   1. A detailed prompt fragment derived from the sheet
 *   2. The strongest reference image as visual conditioning
 *   3. A negative prompt listing things to exclude
 *
 * This fixes the two main problems with AI-generated "influencers":
 *   - drift (different face every clip)
 *   - generic slop (no distinguishing detail beyond gender+age)
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  personalCharacters,
  personalAccountMedia,
  type PersonalCharacterSheet,
} from '@boost/database';
import { generateJSON, analyzeImage } from './claude.js';
import { withRetry } from './retry.js';

export interface CharacterPayload {
  id: string;
  userId: string;
  name: string;
  tagline: string | null;
  backstory: string | null;
  characterSheet: PersonalCharacterSheet | null;
  promptFragment: string | null;
  negativePrompt: string | null;
  voiceId: string | null;
  locale: string | null;
  status: 'draft' | 'analyzing' | 'ready' | 'failed';
  error: string | null;
  referenceImageCount: number;
  createdAt: string;
  updatedAt: string;
}

/* ─── CRUD ──────────────────────────────────────────────────────── */

export async function createCharacter(args: {
  userId: string;
  name: string;
  tagline?: string;
  backstory?: string;
  voiceId?: string;
  locale?: string;
}): Promise<CharacterPayload> {
  assertDb();
  const db = getDb();
  const [row] = await db
    .insert(personalCharacters)
    .values({
      userId: args.userId,
      name: args.name,
      tagline: args.tagline,
      backstory: args.backstory,
      voiceId: args.voiceId,
      locale: args.locale,
    })
    .returning();
  if (!row) throw new Error('Failed to create character');
  return toPayload(row, 0);
}

export async function listCharacters(userId: string): Promise<CharacterPayload[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(personalCharacters)
    .where(eq(personalCharacters.userId, userId))
    .orderBy(desc(personalCharacters.createdAt));

  if (rows.length === 0) return [];
  const counts = await countReferenceImages(rows.map((r) => r.id));
  return rows.map((r) => toPayload(r, counts.get(r.id) ?? 0));
}

export async function getCharacter(
  userId: string,
  characterId: string,
): Promise<CharacterPayload | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(personalCharacters)
    .where(
      and(
        eq(personalCharacters.userId, userId),
        eq(personalCharacters.id, characterId),
      ),
    );
  if (!row) return null;
  const counts = await countReferenceImages([row.id]);
  return toPayload(row, counts.get(row.id) ?? 0);
}

/** Internal lookup for the pipeline (no userId). */
export async function getCharacterUnsafe(characterId: string) {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(personalCharacters)
    .where(eq(personalCharacters.id, characterId));
  return row ?? null;
}

export async function updateCharacter(
  userId: string,
  characterId: string,
  patch: Partial<{
    name: string;
    tagline: string | null;
    backstory: string | null;
    promptFragment: string | null;
    negativePrompt: string | null;
    voiceId: string | null;
    locale: string | null;
  }>,
): Promise<CharacterPayload | null> {
  assertDb();
  const db = getDb();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) updates[k] = v;
  }
  const [row] = await db
    .update(personalCharacters)
    .set(updates as any)
    .where(
      and(
        eq(personalCharacters.userId, userId),
        eq(personalCharacters.id, characterId),
      ),
    )
    .returning();
  if (!row) return null;
  const counts = await countReferenceImages([row.id]);
  return toPayload(row, counts.get(row.id) ?? 0);
}

export async function deleteCharacter(userId: string, characterId: string) {
  assertDb();
  const db = getDb();
  const out = await db
    .delete(personalCharacters)
    .where(
      and(
        eq(personalCharacters.userId, userId),
        eq(personalCharacters.id, characterId),
      ),
    )
    .returning();
  return out.length > 0;
}

/* ─── Reference image analysis → character sheet ──────────────── */

/**
 * Looks at every `avatar_reference` media attached to the character
 * and distills a structured character sheet. Writes the sheet and a
 * prompt fragment back to the character row. Idempotent — re-running
 * just refreshes the sheet (e.g. after new refs are uploaded).
 */
export async function analyzeCharacterRefs(characterId: string): Promise<CharacterPayload> {
  assertDb();
  const db = getDb();
  const [character] = await db
    .select()
    .from(personalCharacters)
    .where(eq(personalCharacters.id, characterId));
  if (!character) throw new Error('Character not found');

  await db
    .update(personalCharacters)
    .set({ status: 'analyzing', error: null, updatedAt: new Date() })
    .where(eq(personalCharacters.id, characterId));

  try {
    const refs = await db
      .select()
      .from(personalAccountMedia)
      .where(
        and(
          eq(personalAccountMedia.characterId, characterId),
          eq(personalAccountMedia.role, 'avatar_reference'),
        ),
      )
      .limit(10);

    if (refs.length === 0) {
      throw new Error('No avatar_reference images attached to this character yet.');
    }

    // Describe each reference briefly.
    const perImage: Array<{ url: string; description: string }> = [];
    for (const ref of refs.slice(0, 8)) {
      try {
        const desc = await withRetry(
          () =>
            analyzeImage(
              ref.fileUrl,
              `Describe this person in detail for a character sheet. Cover: age range, gender presentation, ethnicity if clearly visible, hair (color, length, style), eyes, face shape, notable features (glasses, freckles, tattoos, beard), wardrobe (garments, fabrics, colors, accessories), setting, lighting and photographic style. Return JSON: { "age": "...", "gender": "...", "hair": "...", "eyes": "...", "face": "...", "distinguishing": [...], "wardrobe": "...", "setting": "...", "style": "..." }`,
            ),
          { label: `char_desc:${ref.id}`, attempts: 2 },
        );
        perImage.push({ url: ref.fileUrl, description: JSON.stringify(desc) });
      } catch (e) {
        console.warn('[characters] per-image describe failed:', (e as Error).message);
      }
    }

    if (perImage.length === 0) {
      throw new Error('Could not analyse any reference image.');
    }

    // Now ask Claude to synthesise a single coherent sheet from all the
    // per-image descriptions. We do this as a text-only call since we
    // already have structured per-image data.
    const synthPrompt = `You are writing the character sheet for an AI-generated social media persona named "${character.name}". Below are structured descriptions of ${perImage.length} reference images of this person.

Your job: produce ONE coherent, consistent character sheet that will be injected into every future image/video prompt for this person so the "same person" shows up reliably. When references disagree, pick the MOST distinctive/recurring details — you're defining the canonical look.

${character.tagline ? `Tagline (user-provided): ${character.tagline}` : ''}
${character.backstory ? `Backstory (user-provided): ${character.backstory}` : ''}

REFERENCE DESCRIPTIONS:
${perImage.map((p, i) => `Image ${i + 1}: ${p.description}`).join('\n\n')}

Return ONLY JSON:
{
  "appearance": {
    "age": "<specific range like 26-30>",
    "gender": "<presentation>",
    "ethnicity": "<only if clearly visible across refs; else omit>",
    "hair": "<color, length, texture, typical style>",
    "eyes": "<color, shape>",
    "build": "<slender/athletic/average/etc>",
    "face": "<shape + any recurring expression>",
    "distinguishing": ["...", "..."]
  },
  "wardrobe": {
    "signature": "<single-sentence summary of their default look>",
    "palette": ["...", "..."],
    "fabrics": ["...", "..."],
    "accessories": ["...", "..."]
  },
  "setting": {
    "typicalEnvironment": "<e.g. sunlit apartment, studio, forest>",
    "lighting": "<e.g. soft morning, golden hour, studio softbox>",
    "props": ["...", "..."]
  },
  "voice": {
    "tone": "<warm/dry/energetic>",
    "pace": "<measured/quick>",
    "accent": "<neutral/british/etc>",
    "vocabulary": "<formal/casual/academic>",
    "catchphrases": ["...", "..."]
  },
  "vibe": ["<3-6 vibe words like 'cozy', 'minimalist', 'cinematic'>"],
  "doNotUse": ["<never this style>", "<never this feature>"],
  "promptFragment": "<2-4 sentence paragraph suitable for pasting into an image/video prompt. Start with a subject description, then wardrobe, setting, lighting, style.>",
  "negativePrompt": "<comma-separated list of things to exclude so they don't appear in generated media>"
}`;

    const synthesised = await withRetry(
      () => generateJSON<PersonalCharacterSheet & { promptFragment: string; negativePrompt: string }>(synthPrompt, {
        model: 'sonnet',
        maxTokens: 2048,
      }),
      { label: `char_synth:${characterId}`, attempts: 2 },
    );

    const [updated] = await db
      .update(personalCharacters)
      .set({
        characterSheet: {
          appearance: synthesised.appearance,
          wardrobe: synthesised.wardrobe,
          setting: synthesised.setting,
          voice: synthesised.voice,
          vibe: synthesised.vibe,
          doNotUse: synthesised.doNotUse,
        },
        promptFragment: synthesised.promptFragment,
        negativePrompt: synthesised.negativePrompt,
        status: 'ready',
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(personalCharacters.id, characterId))
      .returning();

    const counts = await countReferenceImages([characterId]);
    return toPayload(updated!, counts.get(characterId) ?? 0);
  } catch (e) {
    await db
      .update(personalCharacters)
      .set({ status: 'failed', error: (e as Error).message.slice(0, 500), updatedAt: new Date() })
      .where(eq(personalCharacters.id, characterId));
    throw e;
  }
}

/* ─── Helpers ────────────────────────────────────────────────── */

async function countReferenceImages(
  characterIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!isDbConfigured() || characterIds.length === 0) return out;
  const db = getDb();
  const rows = await db
    .select({ id: personalAccountMedia.id, cid: personalAccountMedia.characterId })
    .from(personalAccountMedia)
    .where(
      and(
        inArray(personalAccountMedia.characterId, characterIds),
        eq(personalAccountMedia.role, 'avatar_reference'),
      ),
    );
  for (const r of rows) {
    if (!r.cid) continue;
    out.set(r.cid, (out.get(r.cid) ?? 0) + 1);
  }
  return out;
}

function toPayload(
  row: typeof personalCharacters.$inferSelect,
  refCount: number,
): CharacterPayload {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    tagline: row.tagline,
    backstory: row.backstory,
    characterSheet: (row.characterSheet as PersonalCharacterSheet) ?? null,
    promptFragment: row.promptFragment,
    negativePrompt: row.negativePrompt,
    voiceId: row.voiceId,
    locale: row.locale,
    status: row.status,
    error: row.error,
    referenceImageCount: refCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertDb() {
  if (!isDbConfigured()) throw new Error('DATABASE_URL required for characters');
}


/* ═══════════════════════════════════════════════════════════════════ */
/* Anchor image helper for the pipeline                                */
/*                                                                      */
/* Returns up to `limit` avatar_reference URLs for a character, sorted */
/* by pinned-first then most-recent. This is what the pipeline passes  */
/* into multi-ref video models (Kling, Veo, Nano Banana) so the same   */
/* face shows up across shots.                                         */
/* ═══════════════════════════════════════════════════════════════════ */

export async function getCharacterAnchorImages(
  characterId: string,
  limit = 3,
): Promise<string[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({
      fileUrl: personalAccountMedia.fileUrl,
      isPinned: personalAccountMedia.isPinned,
      updatedAt: personalAccountMedia.updatedAt,
    })
    .from(personalAccountMedia)
    .where(
      and(
        eq(personalAccountMedia.characterId, characterId),
        eq(personalAccountMedia.role, 'avatar_reference'),
        eq(personalAccountMedia.isArchived, false),
      ),
    )
    .orderBy(desc(personalAccountMedia.isPinned), desc(personalAccountMedia.updatedAt))
    .limit(limit);
  return rows.map((r) => r.fileUrl);
}
