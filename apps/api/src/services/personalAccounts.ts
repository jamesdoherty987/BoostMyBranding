/**
 * Personal accounts CRUD — the user's own social accounts (separate
 * from agency-managed `clients`). All operations are scoped to the
 * authenticated user id.
 */

import { and, desc, eq } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  personalAccounts,
  personalPosts,
  type PersonalPostMediaAsset,
  type PersonalAccountStyleBible,
  type PersonalGeneratorConfig,
} from '@boost/database';
import type { Platform } from '@boost/core';
import { getTheme, type PersonalTheme } from './personalThemes.js';

/* ─── Types ──────────────────────────────────────────────────────── */

export interface PersonalAccountPayload {
  id: string;
  userId: string;
  accountName: string;
  platform: Platform;
  handle: string | null;
  contentStudioWorkspaceId: string | null;
  themeId: string;
  themeName: string;
  themeEmoji: string;
  customDirection: string | null;
  topicSeeds: string[];
  topicBlacklist: string[];
  language: string;
  voiceId: string | null;
  locale: string | null;
  postsPerDay: number;
  postingHourUtc: number;
  postingMinuteUtc: number;
  postSpacingMinutes: number;
  autoApprove: boolean;
  autoSchedule: boolean;
  accentColor: string | null;
  logoUrl: string | null;
  watermarkHandle: string | null;
  status: 'active' | 'paused' | 'archived';
  lastGeneratedAt: string | null;
  nextRunAt: string | null;
  totalPosts: number;
  styleBible: PersonalAccountStyleBible | null;
  generatorConfig: PersonalGeneratorConfig | null;
  characterId: string | null;
  formatKind: 'video' | 'slideshow' | 'static_image';
  customAudioUrl: string | null;
  customAudioAttribution: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ─── Create ─────────────────────────────────────────────────────── */

export interface CreateAccountArgs {
  userId: string;
  accountName: string;
  platform: Platform;
  themeId: string;
  handle?: string;
  contentStudioWorkspaceId?: string;
  customDirection?: string;
  topicSeeds?: string[];
  topicBlacklist?: string[];
  language?: string;
  voiceId?: string;
  locale?: string;
  postsPerDay?: number;
  postingHourUtc?: number;
  postingMinuteUtc?: number;
  postSpacingMinutes?: number;
  autoApprove?: boolean;
  autoSchedule?: boolean;
  accentColor?: string;
  logoUrl?: string;
  watermarkHandle?: string;
  characterId?: string | null;
  styleBible?: PersonalAccountStyleBible;
  generatorConfig?: PersonalGeneratorConfig;
  formatKind?: 'video' | 'slideshow' | 'static_image';
  customAudioUrl?: string | null;
  customAudioAttribution?: string | null;
}

export async function createAccount(args: CreateAccountArgs) {
  assertDb();
  const theme = getTheme(args.themeId);
  if (!theme) throw new Error(`Unknown theme: ${args.themeId}`);

  const db = getDb();
  const [row] = await db
    .insert(personalAccounts)
    .values({
      userId: args.userId,
      accountName: args.accountName,
      platform: args.platform,
      themeId: args.themeId,
      handle: args.handle,
      contentStudioWorkspaceId: args.contentStudioWorkspaceId,
      customDirection: args.customDirection,
      topicSeeds: args.topicSeeds ?? [],
      topicBlacklist: args.topicBlacklist ?? [],
      language: args.language ?? 'en',
      voiceId: args.voiceId,
      locale: args.locale,
      postsPerDay: args.postsPerDay ?? 1,
      postingHourUtc: args.postingHourUtc ?? 8,
      postingMinuteUtc: args.postingMinuteUtc ?? 0,
      postSpacingMinutes: args.postSpacingMinutes ?? 240,
      autoApprove: args.autoApprove ?? true,
      autoSchedule: args.autoSchedule ?? true,
      accentColor: args.accentColor ?? theme.accentColor,
      logoUrl: args.logoUrl,
      watermarkHandle: args.watermarkHandle,
      characterId: args.characterId ?? null,
      styleBible: args.styleBible,
      generatorConfig: args.generatorConfig,
      formatKind: args.formatKind ?? theme.defaultFormat ?? 'video',
      customAudioUrl: args.customAudioUrl ?? null,
      customAudioAttribution: args.customAudioAttribution ?? null,
      nextRunAt: computeNextRunAt({
        now: new Date(),
        postingHourUtc: args.postingHourUtc ?? 8,
        postingMinuteUtc: args.postingMinuteUtc ?? 0,
      }),
    })
    .returning();
  if (!row) throw new Error('Failed to create account');
  return toPayload(row, theme);
}

/* ─── Read ───────────────────────────────────────────────────────── */

export async function listAccounts(userId: string) {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(personalAccounts)
    .where(eq(personalAccounts.userId, userId))
    .orderBy(desc(personalAccounts.createdAt));
  return rows
    .map((r) => {
      const theme = getTheme(r.themeId);
      return theme ? toPayload(r, theme) : null;
    })
    .filter((p): p is PersonalAccountPayload => Boolean(p));
}

export async function getAccount(userId: string, accountId: string) {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(personalAccounts)
    .where(
      and(eq(personalAccounts.userId, userId), eq(personalAccounts.id, accountId)),
    );
  if (!row) return null;
  const theme = getTheme(row.themeId);
  return theme ? toPayload(row, theme) : null;
}

/**
 * Internal lookup that doesn't require userId — used by the scheduler
 * which iterates every active account across all users.
 */
export async function getAccountUnsafe(accountId: string) {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(personalAccounts)
    .where(eq(personalAccounts.id, accountId));
  return row ?? null;
}

/* ─── Update ─────────────────────────────────────────────────────── */

export type UpdateAccountPatch = Partial<
  Omit<CreateAccountArgs, 'userId'> & {
    status: 'active' | 'paused' | 'archived';
  }
>;

export async function updateAccount(
  userId: string,
  accountId: string,
  patch: UpdateAccountPatch,
) {
  assertDb();
  const db = getDb();
  const existing = await getAccount(userId, accountId);
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) updates[k] = v;
  }

  // Recompute nextRunAt whenever scheduling fields change.
  if (
    patch.postingHourUtc !== undefined ||
    patch.postingMinuteUtc !== undefined ||
    patch.status === 'active'
  ) {
    updates.nextRunAt = computeNextRunAt({
      now: new Date(),
      postingHourUtc: patch.postingHourUtc ?? existing.postingHourUtc,
      postingMinuteUtc: patch.postingMinuteUtc ?? existing.postingMinuteUtc,
    });
  }

  const [row] = await db
    .update(personalAccounts)
    .set(updates as any)
    .where(
      and(eq(personalAccounts.userId, userId), eq(personalAccounts.id, accountId)),
    )
    .returning();
  if (!row) return null;
  const theme = getTheme(row.themeId);
  return theme ? toPayload(row, theme) : null;
}

/* ─── Delete ─────────────────────────────────────────────────────── */

export async function deleteAccount(userId: string, accountId: string) {
  assertDb();
  const db = getDb();
  const result = await db
    .delete(personalAccounts)
    .where(
      and(eq(personalAccounts.userId, userId), eq(personalAccounts.id, accountId)),
    )
    .returning();
  return result.length > 0;
}

/* ─── Recent topics (for topic rotation) ─────────────────────────── */

export async function recentTopics(accountId: string, limit = 20): Promise<string[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ topic: personalPosts.topic })
    .from(personalPosts)
    .where(eq(personalPosts.accountId, accountId))
    .orderBy(desc(personalPosts.createdAt))
    .limit(limit);
  return rows.map((r) => r.topic);
}

/* ─── Post listing ───────────────────────────────────────────────── */

export interface PersonalPostPayload {
  id: string;
  accountId: string;
  templateId: string;
  topic: string;
  title: string;
  hook: string;
  videoUrl: string | null;
  voiceoverUrl: string | null;
  musicUrl: string | null;
  caption: string | null;
  hashtags: string[];
  durationSeconds: number | null;
  qualityScore: number | null;
  status: string;
  errorMessage: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishUrl: string | null;
  mediaAssets: PersonalPostMediaAsset[];
  costCents: number;
  createdAt: string;
}

export async function listPosts(accountId: string): Promise<PersonalPostPayload[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(personalPosts)
    .where(eq(personalPosts.accountId, accountId))
    .orderBy(desc(personalPosts.createdAt))
    .limit(60);
  return rows.map((r) => {
    const script = (r.script as any) ?? {};
    return {
      id: r.id,
      accountId: r.accountId,
      templateId: r.templateId,
      topic: r.topic,
      title: script.title ?? '',
      hook: script.hook ?? '',
      videoUrl: r.videoUrl,
      voiceoverUrl: r.voiceoverUrl,
      musicUrl: r.musicUrl,
      caption: r.caption,
      hashtags: r.hashtags ?? [],
      durationSeconds: r.durationSeconds,
      qualityScore: r.qualityScore,
      status: r.status,
      errorMessage: r.errorMessage,
      scheduledAt: r.scheduledAt?.toISOString() ?? null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      publishUrl: r.publishUrl,
      mediaAssets: (r.mediaAssets as PersonalPostMediaAsset[]) ?? [],
      costCents: r.costCents ?? 0,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function assertDb() {
  if (!isDbConfigured()) throw new Error('DATABASE_URL is required for personal accounts');
}

/**
 * Computes the next UTC run time based on posting hour/minute. Always
 * returns a time in the future, rolling forward to the next day if the
 * window has already passed today.
 */
export function computeNextRunAt(args: {
  now: Date;
  postingHourUtc: number;
  postingMinuteUtc: number;
}): Date {
  const next = new Date(args.now);
  next.setUTCHours(args.postingHourUtc, args.postingMinuteUtc, 0, 0);
  if (next.getTime() <= args.now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function toPayload(
  row: typeof personalAccounts.$inferSelect,
  theme: PersonalTheme,
): PersonalAccountPayload {
  return {
    id: row.id,
    userId: row.userId,
    accountName: row.accountName,
    platform: row.platform as Platform,
    handle: row.handle,
    contentStudioWorkspaceId: row.contentStudioWorkspaceId,
    themeId: row.themeId,
    themeName: theme.name,
    themeEmoji: theme.emoji,
    customDirection: row.customDirection,
    topicSeeds: row.topicSeeds ?? [],
    topicBlacklist: row.topicBlacklist ?? [],
    language: row.language,
    voiceId: row.voiceId,
    locale: row.locale,
    postsPerDay: row.postsPerDay,
    postingHourUtc: row.postingHourUtc,
    postingMinuteUtc: row.postingMinuteUtc,
    postSpacingMinutes: row.postSpacingMinutes,
    autoApprove: row.autoApprove,
    autoSchedule: row.autoSchedule,
    accentColor: row.accentColor,
    logoUrl: row.logoUrl,
    watermarkHandle: row.watermarkHandle,
    status: row.status,
    lastGeneratedAt: row.lastGeneratedAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    totalPosts: row.totalPosts,
    styleBible: (row.styleBible as PersonalAccountStyleBible) ?? null,
    generatorConfig: (row.generatorConfig as PersonalGeneratorConfig) ?? null,
    characterId: row.characterId ?? null,
    formatKind: (row.formatKind ?? 'video') as 'video' | 'slideshow' | 'static_image',
    customAudioUrl: row.customAudioUrl ?? null,
    customAudioAttribution: row.customAudioAttribution ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
