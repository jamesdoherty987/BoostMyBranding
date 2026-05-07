/**
 * Per-user custom theme library.
 *
 * Built-in themes live in code (personalThemes.ts::THEMES). Custom
 * themes live in the DB — one row per user per slug. On listing, we
 * merge built-ins with the user's custom themes. When a custom theme
 * shares a slug with a built-in AND has overridesBuiltin=true, it
 * takes precedence (lets the user edit "Finance Bite" without forking
 * the codebase).
 *
 * Custom themes are stored and served with the same shape as built-ins
 * so the rest of the pipeline (generator, director, renderer) doesn't
 * care which source the theme came from.
 */

import { and, desc, eq } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  personalCustomThemes,
} from '@boost/database';
import type { Platform } from '@boost/core';
import {
  THEMES as BUILTIN_THEMES,
  type MediaSource,
  type PersonalTemplateId,
  type PersonalTheme,
} from './personalThemes.js';

/* ─── Merged listing ───────────────────────────────────────────── */

export async function listAllThemesForUser(userId: string): Promise<PersonalTheme[]> {
  if (!isDbConfigured()) return BUILTIN_THEMES;
  const db = getDb();
  const rows = await db
    .select()
    .from(personalCustomThemes)
    .where(eq(personalCustomThemes.userId, userId))
    .orderBy(desc(personalCustomThemes.createdAt));

  const custom = rows.map(rowToTheme);
  // Override-aware merge: custom rows with overridesBuiltin=true replace
  // the built-in with the same slug. Everything else appends.
  const byId = new Map<string, PersonalTheme>();
  for (const t of BUILTIN_THEMES) byId.set(t.id, t);
  for (const c of custom) {
    if (c.id in Object.fromEntries(byId) && !isOverrideRow(rows, c.id)) {
      // A custom row that DOESN'T override can't clash with a built-in
      // id — slug uniqueness per user already guarantees it's a
      // different slug; we shouldn't hit this branch in practice, but
      // if we do, skip.
      continue;
    }
    byId.set(c.id, c);
  }
  return Array.from(byId.values());
}

function isOverrideRow(
  rows: Array<typeof personalCustomThemes.$inferSelect>,
  slug: string,
): boolean {
  return rows.some((r) => r.slug === slug && r.overridesBuiltin);
}

/** Find a theme by id for a given user — custom-first, then built-in. */
export async function findThemeForUser(
  userId: string,
  themeId: string,
): Promise<PersonalTheme | undefined> {
  if (isDbConfigured()) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(personalCustomThemes)
      .where(
        and(
          eq(personalCustomThemes.userId, userId),
          eq(personalCustomThemes.slug, themeId),
        ),
      );
    if (row) return rowToTheme(row);
  }
  return BUILTIN_THEMES.find((t) => t.id === themeId);
}

/* ─── CRUD ─────────────────────────────────────────────────────── */

export interface CustomThemePayload {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accentColor: string;
  viralityScore: number;
  cpmTier: string;
  preferredPlatforms: string[];
  template: string;
  mediaSources: string[];
  useVoiceover: boolean;
  useMusic: boolean;
  hookFormulas: string[];
  topicSeeds: string[];
  voiceGuide: string;
  visualStyle: string;
  musicMood: string;
  targetDurationSeconds: number;
  defaultHashtags: string[];
  requiresGroundedImages: boolean;
  defaultFormat: 'video' | 'slideshow' | 'static_image' | null;
  overridesBuiltin: boolean;
  derivedFrom: string | null;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomThemeArgs {
  userId: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  emoji?: string;
  accentColor?: string;
  viralityScore?: number;
  cpmTier?: string;
  preferredPlatforms?: string[];
  template?: string;
  mediaSources?: string[];
  useVoiceover?: boolean;
  useMusic?: boolean;
  hookFormulas?: string[];
  topicSeeds?: string[];
  voiceGuide?: string;
  visualStyle?: string;
  musicMood?: string;
  targetDurationSeconds?: number;
  defaultHashtags?: string[];
  requiresGroundedImages?: boolean;
  defaultFormat?: string;
  overridesBuiltin?: boolean;
  derivedFrom?: string;
}

export async function createCustomTheme(args: CreateCustomThemeArgs) {
  assertDb();
  const db = getDb();
  const [row] = await db
    .insert(personalCustomThemes)
    .values({
      userId: args.userId,
      slug: args.slug,
      name: args.name,
      tagline: args.tagline,
      description: args.description,
      emoji: args.emoji ?? '✨',
      accentColor: args.accentColor ?? '#6366F1',
      viralityScore: args.viralityScore ?? 7,
      cpmTier: args.cpmTier ?? 'medium',
      preferredPlatforms: args.preferredPlatforms ?? [],
      template: args.template ?? 'viral-text',
      mediaSources: args.mediaSources ?? [],
      useVoiceover: args.useVoiceover ?? true,
      useMusic: args.useMusic ?? true,
      hookFormulas: args.hookFormulas ?? [],
      topicSeeds: args.topicSeeds ?? [],
      voiceGuide: args.voiceGuide ?? '',
      visualStyle: args.visualStyle ?? '',
      musicMood: args.musicMood ?? '',
      targetDurationSeconds: args.targetDurationSeconds ?? 35,
      defaultHashtags: args.defaultHashtags ?? [],
      requiresGroundedImages: args.requiresGroundedImages ?? false,
      defaultFormat: args.defaultFormat ?? 'video',
      overridesBuiltin: args.overridesBuiltin ?? false,
      derivedFrom: args.derivedFrom,
    })
    .returning();
  if (!row) throw new Error('Failed to create custom theme');
  return toPayload(row);
}

export async function listCustomThemes(userId: string): Promise<CustomThemePayload[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(personalCustomThemes)
    .where(eq(personalCustomThemes.userId, userId))
    .orderBy(desc(personalCustomThemes.updatedAt));
  return rows.map(toPayload);
}

export async function getCustomTheme(
  userId: string,
  id: string,
): Promise<CustomThemePayload | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(personalCustomThemes)
    .where(
      and(
        eq(personalCustomThemes.userId, userId),
        eq(personalCustomThemes.id, id),
      ),
    );
  return row ? toPayload(row) : null;
}

export async function updateCustomTheme(
  userId: string,
  id: string,
  patch: Partial<Omit<CreateCustomThemeArgs, 'userId' | 'slug'>>,
): Promise<CustomThemePayload | null> {
  assertDb();
  const db = getDb();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) updates[k] = v;
  }
  const [row] = await db
    .update(personalCustomThemes)
    .set(updates as any)
    .where(
      and(
        eq(personalCustomThemes.userId, userId),
        eq(personalCustomThemes.id, id),
      ),
    )
    .returning();
  return row ? toPayload(row) : null;
}

export async function deleteCustomTheme(userId: string, id: string) {
  assertDb();
  const db = getDb();
  const out = await db
    .delete(personalCustomThemes)
    .where(
      and(
        eq(personalCustomThemes.userId, userId),
        eq(personalCustomThemes.id, id),
      ),
    )
    .returning();
  return out.length > 0;
}

/**
 * Clone a built-in theme into a user's custom theme library so they can
 * edit it. The clone keeps the original slug but adds an `-edit` suffix
 * unless told to override; when overriding, the clone uses the same
 * slug with `overridesBuiltin=true`.
 */
export async function cloneBuiltinForEdit(args: {
  userId: string;
  builtinId: string;
  mode: 'override' | 'duplicate';
}): Promise<CustomThemePayload> {
  const builtin = BUILTIN_THEMES.find((t) => t.id === args.builtinId);
  if (!builtin) throw new Error(`Built-in theme not found: ${args.builtinId}`);
  const slug =
    args.mode === 'override' ? builtin.id : `${builtin.id}-${Date.now().toString(36).slice(-5)}`;
  return createCustomTheme({
    userId: args.userId,
    slug,
    name: args.mode === 'duplicate' ? `${builtin.name} (copy)` : builtin.name,
    tagline: builtin.tagline,
    description: builtin.description,
    emoji: builtin.emoji,
    accentColor: builtin.accentColor,
    viralityScore: builtin.viralityScore,
    cpmTier: builtin.cpmTier,
    preferredPlatforms: builtin.preferredPlatforms as string[],
    template: builtin.template,
    mediaSources: builtin.mediaSources as string[],
    useVoiceover: builtin.useVoiceover,
    useMusic: builtin.useMusic,
    hookFormulas: builtin.hookFormulas,
    topicSeeds: builtin.topicSeeds,
    voiceGuide: builtin.voiceGuide,
    visualStyle: builtin.visualStyle,
    musicMood: builtin.musicMood,
    targetDurationSeconds: builtin.targetDurationSeconds,
    defaultHashtags: builtin.defaultHashtags,
    requiresGroundedImages: builtin.requiresGroundedImages ?? false,
    defaultFormat: builtin.defaultFormat ?? 'video',
    overridesBuiltin: args.mode === 'override',
    derivedFrom: builtin.id,
  });
}

/* ─── Helpers ──────────────────────────────────────────────── */

function assertDb() {
  if (!isDbConfigured()) throw new Error('DATABASE_URL required for custom themes');
}

function rowToTheme(row: typeof personalCustomThemes.$inferSelect): PersonalTheme {
  return {
    id: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    emoji: row.emoji,
    accentColor: row.accentColor,
    viralityScore: row.viralityScore,
    cpmTier: row.cpmTier as PersonalTheme['cpmTier'],
    preferredPlatforms: (row.preferredPlatforms ?? []) as Platform[],
    template: row.template as PersonalTemplateId,
    mediaSources: (row.mediaSources ?? []) as MediaSource[],
    useVoiceover: row.useVoiceover,
    useMusic: row.useMusic,
    hookFormulas: row.hookFormulas ?? [],
    topicSeeds: row.topicSeeds ?? [],
    voiceGuide: row.voiceGuide,
    visualStyle: row.visualStyle,
    musicMood: row.musicMood ?? '',
    targetDurationSeconds: row.targetDurationSeconds,
    defaultHashtags: row.defaultHashtags ?? [],
    requiresGroundedImages: row.requiresGroundedImages,
    defaultFormat:
      (row.defaultFormat as 'video' | 'slideshow' | 'static_image' | null) ?? undefined,
  };
}

function toPayload(row: typeof personalCustomThemes.$inferSelect): CustomThemePayload {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    emoji: row.emoji,
    accentColor: row.accentColor,
    viralityScore: row.viralityScore,
    cpmTier: row.cpmTier,
    preferredPlatforms: row.preferredPlatforms ?? [],
    template: row.template,
    mediaSources: row.mediaSources ?? [],
    useVoiceover: row.useVoiceover,
    useMusic: row.useMusic,
    hookFormulas: row.hookFormulas ?? [],
    topicSeeds: row.topicSeeds ?? [],
    voiceGuide: row.voiceGuide,
    visualStyle: row.visualStyle,
    musicMood: row.musicMood ?? '',
    targetDurationSeconds: row.targetDurationSeconds,
    defaultHashtags: row.defaultHashtags ?? [],
    requiresGroundedImages: row.requiresGroundedImages,
    defaultFormat:
      (row.defaultFormat as 'video' | 'slideshow' | 'static_image' | null) ?? null,
    overridesBuiltin: row.overridesBuiltin,
    derivedFrom: row.derivedFrom,
    isBuiltin: false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
