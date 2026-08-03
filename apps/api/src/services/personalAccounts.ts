/**
 * Personal accounts CRUD — the user's own social accounts (separate
 * from agency-managed `clients`). All operations are scoped to the
 * authenticated user id.
 */

import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, like, lt, ne, not, or, sql } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  personalAccounts,
  personalPosts,
  type PersonalPostMediaAsset,
  type PersonalPostRenderActivityEntry,
  type PersonalAccountStyleBible,
  type PersonalGeneratorConfig,
} from '@boost/database';
import type { Platform } from '@boost/core';
import { getTheme, type PersonalTheme } from './personalThemes.js';
import { findThemeForUser } from './personalCustomThemes.js';
import {
  createPersonalPostThumbnail,
  shortThumbnailOverlayLine,
  buildPersonalThumbnailShotAlign,
} from './personalAiThumbnail.js';
import { stripDirectorResumeKeys, type Storyboard } from './personalDirector.js';
import type { PersonalGenerationInfo } from './personalGenerationMeta.js';
import { maybeEmailPersonalPostFailed } from './personalVideoDeliveryEmail.js';

/**
 * Topic string for rows created as soon as the user clicks Generate, while the
 * per-account in-memory queue waits for the prior run. Excluded from {@link recentTopics}.
 */
export const PERSONAL_QUEUE_TOPIC_PLACEHOLDER =
  '⏳ In queue — generation starts after the current video finishes.';

/** Cutoff for "stale in-flight personal post from a prior process" (see {@link failInterruptedRenderingPersonalPostsOnBoot}). Evaluated when this module loads — must stay before `app.listen` because `routes/personal` imports this file first. */
const PERSONAL_PROCESS_BOOT_AT = new Date();

/** Same instant as the boot cutoff — for director resume selection in other modules. */
export function getPersonalProcessBootAt(): Date {
  return PERSONAL_PROCESS_BOOT_AT;
}

/* ─── Types ──────────────────────────────────────────────────────── */

export interface PersonalAccountPayload {
  id: string;
  userId: string;
  accountName: string;
  platform: Platform;
  handle: string | null;
  contentStudioWorkspaceId: string | null;
  /** Pinned ContentStudio connected account id for this channel (optional). */
  contentStudioAccountId: string | null;
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
  /** Email download link when a render finishes (requires Resend on API). */
  emailVideoOnReady: boolean;
  /** Recipient for {@link emailVideoOnReady}. */
  videoDeliveryEmail: string | null;
  /** When true, scheduler runs `generateForAccount` when `nextRunAt` is due. */
  autoGenerateOnSchedule: boolean;
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
  contentStudioWorkspaceId?: string | null;
  contentStudioAccountId?: string | null;
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
  emailVideoOnReady?: boolean;
  videoDeliveryEmail?: string | null;
  autoGenerateOnSchedule?: boolean;
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

/**
 * Defaults applied when a new Personal channel is created (and not overridden
 * in the create payload). Existing channels keep whatever is already stored.
 */
export const DEFAULT_PERSONAL_GENERATOR_CONFIG: PersonalGeneratorConfig = {
  kenBurnsOnStills: false,
  averageClipSeconds: 4,
  ttsProvider: 'openai',
  /** AI paints fact labels into stills — not FFmpeg keyword pops. */
  allowSparseImageText: true,
  keywordPopStyle: 'off',
  namesNumbersTitleCard: false,
};

function withNewAccountGeneratorDefaults(
  config: PersonalGeneratorConfig | null | undefined,
): PersonalGeneratorConfig {
  return { ...DEFAULT_PERSONAL_GENERATOR_CONFIG, ...(config ?? {}) };
}

export async function createAccount(args: CreateAccountArgs) {
  assertDb();
  const theme =
    getTheme(args.themeId) ?? (await findThemeForUser(args.userId, args.themeId));
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
      contentStudioAccountId: args.contentStudioAccountId ?? null,
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
      autoSchedule: args.autoSchedule ?? false,
      emailVideoOnReady: args.emailVideoOnReady ?? false,
      videoDeliveryEmail: args.videoDeliveryEmail?.trim() || null,
      autoGenerateOnSchedule: args.autoGenerateOnSchedule ?? false,
      accentColor: args.accentColor ?? theme.accentColor,
      logoUrl: args.logoUrl,
      watermarkHandle: args.watermarkHandle,
      characterId: args.characterId ?? null,
      styleBible: stripRemovedStyleBibleKeys(args.styleBible ?? null),
      generatorConfig: withNewAccountGeneratorDefaults(args.generatorConfig),
      formatKind: args.formatKind ?? theme.defaultFormat ?? 'video',
      customAudioUrl: args.customAudioUrl ?? null,
      customAudioAttribution: args.customAudioAttribution ?? null,
      nextRunAt:
        args.autoGenerateOnSchedule === true
          ? computeNextRunAt({
              now: new Date(),
              postingHourUtc: args.postingHourUtc ?? 8,
              postingMinuteUtc: args.postingMinuteUtc ?? 0,
              postsPerDay: args.postsPerDay ?? 1,
              postSpacingMinutes: args.postSpacingMinutes ?? 60,
            })
          : null,
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
  const out: PersonalAccountPayload[] = [];
  for (const r of rows) {
    const theme = getTheme(r.themeId) ?? (await findThemeForUser(userId, r.themeId));
    if (theme) out.push(toPayload(r, theme));
  }
  return out;
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
  const theme = getTheme(row.themeId) ?? (await findThemeForUser(userId, row.themeId));
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

/**
 * Merge dashboard `generatorConfig` patches into existing JSONB without wiping
 * nested `keywordOverlayByAspect` keys (shallow `{...ex, ...patch}` replaced the
 * whole per-aspect map when only one ratio was PATCHed).
 */
function mergeGeneratorConfigJson(
  existing: PersonalGeneratorConfig | null | undefined,
  patch: Partial<PersonalGeneratorConfig>,
): PersonalGeneratorConfig {
  const ex = { ...(existing ?? {}) } as Record<string, unknown>;
  const p = patch as Record<string, unknown>;
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    if (
      k === 'keywordOverlayByAspect' &&
      typeof v === 'object' &&
      v !== null &&
      !Array.isArray(v)
    ) {
      const prev = (ex[k] as Record<string, unknown> | undefined) ?? {};
      const mergedAsp: Record<string, unknown> = { ...prev };
      for (const [asp, spec] of Object.entries(v as Record<string, unknown>)) {
        if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
          mergedAsp[asp] = {
            ...((prev[asp] as Record<string, unknown> | undefined) ?? {}),
            ...(spec as Record<string, unknown>),
          };
        } else if (spec === null) {
          delete mergedAsp[asp];
        }
      }
      ex[k] = mergedAsp;
    } else {
      ex[k] = v;
    }
  }
  return ex as PersonalGeneratorConfig;
}

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
    if (v === undefined) continue;
    // Merged below so JSONB is never replaced by a partial blob.
    if (k === 'styleBible' || k === 'generatorConfig') continue;
    updates[k] = v;
  }

  if (patch.styleBible !== undefined) {
    updates.styleBible = stripRemovedStyleBibleKeys({
      ...(existing.styleBible ?? {}),
      ...patch.styleBible,
    } as PersonalAccountStyleBible);
  }
  if (patch.generatorConfig !== undefined) {
    updates.generatorConfig = mergeGeneratorConfigJson(
      existing.generatorConfig as PersonalGeneratorConfig | null | undefined,
      patch.generatorConfig as Partial<PersonalGeneratorConfig>,
    );
  }

  // Keep `next_run_at` aligned with scheduled autopilot + account status.
  const nextAutogen =
    patch.autoGenerateOnSchedule !== undefined
      ? patch.autoGenerateOnSchedule
      : existing.autoGenerateOnSchedule;
  const effectiveStatus = patch.status ?? existing.status;

  if (!nextAutogen || effectiveStatus === 'paused' || effectiveStatus === 'archived') {
    updates.nextRunAt = null;
  } else if (
    patch.autoGenerateOnSchedule === true ||
    patch.postingHourUtc !== undefined ||
    patch.postingMinuteUtc !== undefined ||
    patch.postSpacingMinutes !== undefined ||
    patch.postsPerDay !== undefined ||
    (patch.status === 'active' && existing.status !== 'active')
  ) {
    updates.nextRunAt = computeNextRunAt({
      now: new Date(),
      postingHourUtc: patch.postingHourUtc ?? existing.postingHourUtc,
      postingMinuteUtc: patch.postingMinuteUtc ?? existing.postingMinuteUtc,
      postsPerDay: patch.postsPerDay ?? existing.postsPerDay,
      postSpacingMinutes: patch.postSpacingMinutes ?? existing.postSpacingMinutes,
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
  const theme = getTheme(row.themeId) ?? (await findThemeForUser(userId, row.themeId));
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
    .where(
      and(
        eq(personalPosts.accountId, accountId),
        ne(personalPosts.topic, PERSONAL_QUEUE_TOPIC_PLACEHOLDER),
      ),
    )
    .orderBy(desc(personalPosts.createdAt))
    .limit(limit);
  return rows.map((r) => r.topic);
}

/** Titles from posts that actually shipped (or are queued for publish) — excludes in-flight rows so a second Generate is not compared against a storyboard still being rendered. */
export async function recentVideoTitles(accountId: string, limit = 40): Promise<string[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const cap = Math.min(80, Math.max(1, Math.round(limit)));
  const rows = await db
    .select({ script: personalPosts.script })
    .from(personalPosts)
    .where(
      and(
        eq(personalPosts.accountId, accountId),
        inArray(personalPosts.status, ['ready', 'scheduled', 'published']),
      ),
    )
    .orderBy(desc(personalPosts.createdAt))
    .limit(cap);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const t = (r.script as { title?: string } | null | undefined)?.title?.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** How many generation-log lines {@link listPosts} returns (rolling tail of the server buffer). */
const PERSONAL_POST_ACTIVITY_LOG_TAIL = 200;

function pickGenerationSummary(script: unknown): PersonalGenerationInfo | null {
  if (!script || typeof script !== 'object') return null;
  const raw = (script as Record<string, unknown>).generationInfo;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.pipeline !== 'director' && o.pipeline !== 'legacy') return null;
  if (typeof o.completedAt !== 'string') return null;
  return raw as PersonalGenerationInfo;
}

/* ─── Post listing ───────────────────────────────────────────────── */

export interface PersonalPostPayload {
  id: string;
  accountId: string;
  templateId: string;
  topic: string;
  title: string;
  hook: string;
  /** Output frame aspect (from script.outputAspectRatio or generator default). */
  aspectRatio: '9:16' | '1:1' | '16:9' | '4:5';
  videoUrl: string | null;
  thumbnailUrl: string | null;
  voiceoverUrl: string | null;
  musicUrl: string | null;
  caption: string | null;
  hashtags: string[];
  durationSeconds: number | null;
  /**
   * Storyboard-estimated runtime (director JSON) when the DB column is still null.
   * Optional — used for in-progress UI hints only; final `durationSeconds` wins once set.
   */
  plannedDurationSeconds?: number | null;
  qualityScore: number | null;
  status: string;
  errorMessage: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishUrl: string | null;
  mediaAssets: PersonalPostMediaAsset[];
  costCents: number;
  /** Models / TTS / music snapshot when the post finished (`script.generationInfo`). */
  generationSummary: PersonalGenerationInfo | null;
  createdAt: string;
  /** 0–100 while final video encode runs; null otherwise. */
  renderProgress: number | null;
  /** Human-readable encode phase while `rendering`. */
  renderProgressLabel: string | null;
  /** Recent encode log lines (server) while / after encoding. */
  renderActivityLog: PersonalPostRenderActivityEntry[];
}

export async function listPosts(accountId: string, limit = 250): Promise<PersonalPostPayload[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const cap = Math.min(500, Math.max(1, Math.round(limit)));
  const rows = await db
    .select()
    .from(personalPosts)
    .where(eq(personalPosts.accountId, accountId))
    .orderBy(desc(personalPosts.createdAt))
    .limit(cap);
  return rows.map((r) => {
    const script = (r.script as any) ?? {};
    const ar = script.outputAspectRatio as string | undefined;
    const aspectRatio: '9:16' | '1:1' | '16:9' | '4:5' =
      ar === '16:9' || ar === '1:1' || ar === '4:5' || ar === '9:16' ? ar : '9:16';
    const plannedRaw = script.estimatedDurationSeconds;
    const plannedDurationSeconds =
      typeof plannedRaw === 'number' && Number.isFinite(plannedRaw) && plannedRaw > 1
        ? Math.round(plannedRaw)
        : null;
    return {
      id: r.id,
      accountId: r.accountId,
      templateId: r.templateId,
      topic: r.topic,
      title: script.title ?? '',
      hook: script.hook ?? '',
      aspectRatio,
      videoUrl: r.videoUrl,
      thumbnailUrl: r.thumbnailUrl ?? null,
      voiceoverUrl: r.voiceoverUrl,
      musicUrl: r.musicUrl,
      caption: r.caption,
      hashtags: r.hashtags ?? [],
      durationSeconds: r.durationSeconds,
      plannedDurationSeconds:
        r.durationSeconds == null && plannedDurationSeconds != null ? plannedDurationSeconds : null,
      qualityScore: r.qualityScore,
      status: r.status,
      errorMessage: r.errorMessage,
      scheduledAt: r.scheduledAt?.toISOString() ?? null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      publishUrl: r.publishUrl,
      mediaAssets: (r.mediaAssets as PersonalPostMediaAsset[]) ?? [],
      costCents: r.costCents ?? 0,
      createdAt: r.createdAt.toISOString(),
      renderProgress: r.renderProgress ?? null,
      renderProgressLabel: r.renderProgressLabel ?? null,
      renderActivityLog: Array.isArray(r.renderActivityLog)
        ? (r.renderActivityLog as PersonalPostRenderActivityEntry[]).slice(
            -PERSONAL_POST_ACTIVITY_LOG_TAIL,
          )
        : [],
      generationSummary: pickGenerationSummary(script),
    };
  });
}

/**
 * Permanently removes all posts in `failed` status for this account.
 * Verifies the account belongs to `userId`. Returns null if the account is not found.
 */
export async function deleteFailedPosts(
  userId: string,
  accountId: string,
): Promise<number | null> {
  const account = await getAccount(userId, accountId);
  if (!account) return null;
  const db = getDb();
  const removed = await db
    .delete(personalPosts)
    .where(and(eq(personalPosts.accountId, accountId), eq(personalPosts.status, 'failed')))
    .returning({ id: personalPosts.id });
  return removed.length;
}

/**
 * Permanently deletes one post for this account.
 * Verifies the account belongs to `userId`. Returns `null` if the account is not found, `false` if the post row did not exist.
 */
export async function deletePersonalPost(
  userId: string,
  accountId: string,
  postId: string,
): Promise<boolean | null> {
  const account = await getAccount(userId, accountId);
  if (!account) return null;
  const db = getDb();
  const removed = await db
    .delete(personalPosts)
    .where(and(eq(personalPosts.accountId, accountId), eq(personalPosts.id, postId)))
    .returning({ id: personalPosts.id });
  return removed.length > 0;
}

function personalPostMp4Filename(script: unknown, topic: string): string {
  const title =
    script && typeof script === 'object' && typeof (script as Record<string, unknown>).title === 'string'
      ? String((script as Record<string, unknown>).title).trim()
      : '';
  const raw = (title || String(topic ?? '').trim() || 'video')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 72);
  const base = raw || 'video';
  return base.toLowerCase().endsWith('.mp4') ? base : `${base}.mp4`;
}

/**
 * Resolves the storage URL for a finished personal post video when the caller
 * owns the account. Used by the download proxy route (avoids browser CORS on R2).
 */
export async function resolvePersonalPostVideoDownload(
  userId: string,
  accountId: string,
  postId: string,
): Promise<
  { ok: true; videoUrl: string; filename: string } | { ok: false; error: 'not_found' | 'no_video' }
> {
  const account = await getAccount(userId, accountId);
  if (!account) return { ok: false, error: 'not_found' };
  if (!isDbConfigured()) return { ok: false, error: 'not_found' };
  const db = getDb();
  const [row] = await db
    .select({
      videoUrl: personalPosts.videoUrl,
      topic: personalPosts.topic,
      script: personalPosts.script,
    })
    .from(personalPosts)
    .where(and(eq(personalPosts.id, postId), eq(personalPosts.accountId, accountId)))
    .limit(1);
  if (!row) return { ok: false, error: 'not_found' };
  const url = (row.videoUrl ?? '').trim();
  if (!url) return { ok: false, error: 'no_video' };
  return { ok: true, videoUrl: url, filename: personalPostMp4Filename(row.script, row.topic) };
}

function personalPostThumbnailFilename(script: unknown, topic: string): string {
  const title =
    script && typeof script === 'object' && typeof (script as Record<string, unknown>).title === 'string'
      ? String((script as Record<string, unknown>).title).trim()
      : '';
  const raw = (title || String(topic ?? '').trim() || 'thumbnail')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 72);
  const base = raw || 'thumbnail';
  const lower = base.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return base;
  return `${base}.jpg`;
}

/**
 * Resolves the storage URL for a personal post thumbnail (poster) when the caller
 * owns the account. Used by the download proxy route (avoids browser CORS on R2).
 */
export async function resolvePersonalPostThumbnailDownload(
  userId: string,
  accountId: string,
  postId: string,
): Promise<
  { ok: true; imageUrl: string; filename: string } | { ok: false; error: 'not_found' | 'no_thumbnail' }
> {
  const account = await getAccount(userId, accountId);
  if (!account) return { ok: false, error: 'not_found' };
  if (!isDbConfigured()) return { ok: false, error: 'not_found' };
  const db = getDb();
  const [row] = await db
    .select({
      thumbnailUrl: personalPosts.thumbnailUrl,
      topic: personalPosts.topic,
      script: personalPosts.script,
    })
    .from(personalPosts)
    .where(and(eq(personalPosts.id, postId), eq(personalPosts.accountId, accountId)))
    .limit(1);
  if (!row) return { ok: false, error: 'not_found' };
  const url = (row.thumbnailUrl ?? '').trim();
  if (!url) return { ok: false, error: 'no_thumbnail' };
  return { ok: true, imageUrl: url, filename: personalPostThumbnailFilename(row.script, row.topic) };
}

/**
 * Inserts a `queued` personal post row immediately so the dashboard shows the
 * job while {@link enqueuePersonalGenerateForAccount} waits behind another run.
 */
export async function createReservedQueuedPersonalPost(args: {
  userId: string;
  accountId: string;
  /** Persist so boot resume / cron still schedule after "Generate & schedule". */
  scheduleToContentStudio?: boolean;
  scheduledAt?: string;
  autoSchedule?: boolean;
}): Promise<{ id: string }> {
  assertDb();
  const account = await getAccount(args.userId, args.accountId);
  if (!account) throw new Error('Personal account not found');
  if (account.status === 'archived') {
    throw new Error('Cannot queue generation for an archived channel.');
  }
  const theme =
    getTheme(account.themeId) ?? (await findThemeForUser(args.userId, account.themeId));
  if (!theme) throw new Error(`Theme not found: ${account.themeId}`);
  const genConfig: PersonalGeneratorConfig =
    (account.generatorConfig as PersonalGeneratorConfig) ?? {};
  const useDirector = genConfig.useDirector ?? true;
  const templateId = useDirector ? `director:${theme.template}` : theme.template;
  const { buildPersonalScheduleIntent, withPersonalScheduleIntent } = await import(
    './personalContentPosting.js'
  );
  const intent = buildPersonalScheduleIntent(
    {
      scheduleToContentStudio: args.scheduleToContentStudio,
      scheduledAt: args.scheduledAt,
      autoSchedule: args.autoSchedule,
    },
    account,
  );
  const db = getDb();
  const [row] = await db
    .insert(personalPosts)
    .values({
      accountId: account.id,
      templateId,
      postKind:
        (account.formatKind as 'video' | 'slideshow' | 'static_image') ??
        theme.defaultFormat ??
        'video',
      topic: PERSONAL_QUEUE_TOPIC_PLACEHOLDER,
      script: withPersonalScheduleIntent({ __personalQueueSlot: true }, intent) as any,
      status: 'queued',
    })
    .returning({ id: personalPosts.id });
  if (!row) throw new Error('Failed to create queued personal post');
  return { id: row.id };
}

/** If the row is still `queued`, mark it failed (e.g. pipeline threw before claiming the slot). */
export async function markPersonalPostQueuedFailedIfStillQueued(
  postId: string,
  errorMessage: string,
): Promise<void> {
  assertDb();
  const db = getDb();
  await db
    .update(personalPosts)
    .set({
      status: 'failed',
      errorMessage: errorMessage.slice(0, 500),
      renderProgress: null,
      renderProgressLabel: null,
      renderActivityLog: [],
      updatedAt: new Date(),
    })
    .where(and(eq(personalPosts.id, postId), eq(personalPosts.status, 'queued')));
}

const GEN_STOPPED_MSG = 'Stopped by user.';

/**
 * Marks an in-flight personal post as failed so the director pipeline stops
 * between shots (cooperative cancel). No-op if the post is not generating.
 */
export async function cancelPersonalPostGeneration(
  userId: string,
  accountId: string,
  postId: string,
): Promise<{ ok: boolean; error?: 'not_found' | 'not_in_progress' }> {
  const account = await getAccount(userId, accountId);
  if (!account) return { ok: false, error: 'not_found' };
  assertDb();
  const db = getDb();
  const inFlight = new Set(['queued', 'scripting', 'sourcing_media', 'rendering']);
  const [row] = await db
    .select({ status: personalPosts.status })
    .from(personalPosts)
    .where(and(eq(personalPosts.id, postId), eq(personalPosts.accountId, accountId)));
  if (!row) return { ok: false, error: 'not_found' };
  if (!inFlight.has(String(row.status))) return { ok: false, error: 'not_in_progress' };
  await db
    .update(personalPosts)
    .set({
      status: 'failed',
      errorMessage: GEN_STOPPED_MSG.slice(0, 500),
      renderProgress: null,
      renderProgressLabel: null,
      renderActivityLog: [],
      updatedAt: new Date(),
    })
    .where(eq(personalPosts.id, postId));
  return { ok: true };
}

/**
 * Re-builds the poster: same director image path as in-video stills (inspiration
 * refs + shotToPrompt + account image model), with a new variation each call;
 * falls back to a video frame when AI is unavailable or the theme is grounded-only.
 */
export async function regeneratePersonalPostThumbnail(
  userId: string,
  accountId: string,
  postId: string,
): Promise<
  | { ok: true; thumbnailUrl: string }
  | { ok: false; error: 'not_found' | 'no_video' | 'thumbnail_failed' }
> {
  const account = await getAccount(userId, accountId);
  if (!account) return { ok: false, error: 'not_found' };
  if (!isDbConfigured()) return { ok: false, error: 'not_found' };
  const db = getDb();
  const [post] = await db
    .select({
      id: personalPosts.id,
      videoUrl: personalPosts.videoUrl,
      durationSeconds: personalPosts.durationSeconds,
      topic: personalPosts.topic,
      script: personalPosts.script,
    })
    .from(personalPosts)
    .where(and(eq(personalPosts.id, postId), eq(personalPosts.accountId, accountId)));
  if (!post) return { ok: false, error: 'not_found' };
  const videoUrl = (post.videoUrl ?? '').trim();
  if (!videoUrl) return { ok: false, error: 'no_video' };

  const script = (post.script as { title?: string; outputAspectRatio?: string }) ?? {};
  const title = String(script.title ?? '').trim();
  const ar = script.outputAspectRatio;
  const aspectRatio: '9:16' | '1:1' | '16:9' | '4:5' =
    ar === '16:9' || ar === '1:1' || ar === '4:5' || ar === '9:16' ? ar : '9:16';
  const genCfg = (account.generatorConfig as PersonalGeneratorConfig) ?? {};

  const theme = getTheme(account.themeId) ?? (await findThemeForUser(userId, account.themeId));
  if (!theme) return { ok: false, error: 'not_found' };

  const storyboard = stripDirectorResumeKeys(post.script as Record<string, unknown>) as unknown as Storyboard;

  const shotAlign = await buildPersonalThumbnailShotAlign({
    accountId,
    characterId: account.characterId ?? null,
    styleBible: account.styleBible,
    theme,
    storyboard,
    genCfg,
  });

  const topicSafe = (post.topic ?? '').trim();
  const thumb = await createPersonalPostThumbnail({
    accountId,
    postId,
    videoUrl,
    videoDurationSeconds: post.durationSeconds ?? undefined,
    aspectRatio,
    overlayLine: shortThumbnailOverlayLine(title, topicSafe),
    topic: topicSafe || 'Video',
    variationKey: randomUUID(),
    shotAlign,
  });
  if (!thumb.url) return { ok: false, error: 'thumbnail_failed' };

  await db
    .update(personalPosts)
    .set({
      thumbnailUrl: thumb.url,
      costCents: sql`coalesce(${personalPosts.costCents}, 0) + ${thumb.costCents}`,
      updatedAt: new Date(),
    })
    .where(eq(personalPosts.id, postId));
  return { ok: true, thumbnailUrl: thumb.url };
}

/**
 * True when generation for this post should stop: row is `failed` (Stop / cancel),
 * or the row no longer exists (user deleted the post). The latter is required so
 * {@link withAbortWhenPersonalPostFailed} can unwind and the per-account in-memory
 * queue does not stay blocked behind a deleted job.
 *
 * On transient DB errors, returns false so generation is not aborted.
 */
export async function personalPostIsFailed(postId: string): Promise<boolean> {
  try {
    assertDb();
    const db = getDb();
    const [r] = await db
      .select({ status: personalPosts.status })
      .from(personalPosts)
      .where(eq(personalPosts.id, postId));
    if (!r) return true;
    return r.status === 'failed';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const transient =
      /ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|Connection terminated|read ECONNRESET/i.test(msg) ||
      (typeof e === 'object' &&
        e !== null &&
        'cause' in e &&
        typeof (e as { cause?: { code?: string } }).cause === 'object' &&
        (e as { cause?: { code?: string } }).cause?.code === 'ECONNRESET');
    if (transient) {
      console.warn('[personal] personalPostIsFailed: transient DB error (ignored):', msg.slice(0, 200));
    } else {
      console.warn('[personal] personalPostIsFailed:', msg.slice(0, 300));
    }
    return false;
  }
}

/**
 * Thrown from {@link withAbortWhenPersonalPostFailed} when the post row was
 * marked `failed`, removed (deleted), or otherwise triggers {@link personalPostIsFailed}
 * while a long async call was in flight.
 */
export const PERSONAL_POST_CANCELLED_MESSAGE = 'PERSONAL_POST_CANCELLED';

export function isPersonalPostCancelledError(e: unknown): boolean {
  return e instanceof Error && e.message === PERSONAL_POST_CANCELLED_MESSAGE;
}

/**
 * Posts currently being generated in **this** process. Stale-sweep cron must not
 * mark these failed — a multi-hour director `scripting` / long fal wait can look
 * idle in `updated_at` until the next heartbeat, and killing the row mid-flight
 * surfaces “Generation had no progress…” even though work is still running.
 */
const inFlightPersonalPostIds = new Set<string>();

export function trackPersonalPostInFlight<T>(
  postId: string,
  work: () => Promise<T>,
): Promise<T> {
  const id = postId.trim();
  if (!id) return work();
  inFlightPersonalPostIds.add(id);
  return work().finally(() => {
    inFlightPersonalPostIds.delete(id);
  });
}

export function isPersonalPostInFlightLocally(postId: string): boolean {
  return inFlightPersonalPostIds.has(postId);
}

/**
 * Races `work` against a short poll of {@link personalPostIsFailed} so Stop,
 * cancel, or **deleting the post** can break out of long LLM/scraper/TTS waits and
 * let the per-account generate queue advance to the next job.
 */
/** ~60s at 1500ms poll — bumps `updated_at` so failStale* cron does not kill long healthy runs. */
const PERSONAL_HEARTBEAT_TICKS = 40;

/**
 * Bumps `updated_at` while a post is still in-flight. Generation logs intentionally
 * skip `updated_at`; this heartbeat keeps multi-hour director runs from looking “stale”.
 */
async function touchPersonalPostHeartbeat(postId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(personalPosts)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(personalPosts.id, postId),
        inArray(personalPosts.status, ['queued', 'scripting', 'sourcing_media', 'rendering']),
      ),
    );
}

export async function withAbortWhenPersonalPostFailed<T>(postId: string, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticks = 0;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setInterval(() => {
          ticks += 1;
          if (ticks % PERSONAL_HEARTBEAT_TICKS === 0) {
            void touchPersonalPostHeartbeat(postId).catch(() => {});
          }
          void personalPostIsFailed(postId)
            .then((failed) => {
              if (failed) {
                reject(new Error(PERSONAL_POST_CANCELLED_MESSAGE));
              }
            })
            .catch((err) => {
              console.warn(
                '[personal] withAbortWhenPersonalPostFailed poll error (ignored):',
                err instanceof Error ? err.message : String(err),
              );
            });
        }, 1500);
      }),
    ]);
  } finally {
    if (timer) clearInterval(timer);
  }
}

const MAX_GENERATION_ACTIVITY_LOG = 220;

/**
 * Appends one line to `render_activity_log` for dashboard debugging (sourcing,
 * stitch, etc.). Does **not** update `updated_at` (see {@link withAbortWhenPersonalPostFailed}
 * heartbeat for stale-job protection during long steps).
 */
export async function appendPersonalGenerationLog(postId: string, message: string): Promise<void> {
  if (!isDbConfigured()) return;
  const line = message.trim().slice(0, 500);
  if (!line) return;
  const db = getDb();
  const [row] = await db
    .select({ log: personalPosts.renderActivityLog })
    .from(personalPosts)
    .where(eq(personalPosts.id, postId));
  const prev = Array.isArray(row?.log) ? (row!.log as PersonalPostRenderActivityEntry[]) : [];
  const entry: PersonalPostRenderActivityEntry = {
    at: new Date().toISOString(),
    m: line,
  };
  const next = [...prev, entry].slice(-MAX_GENERATION_ACTIVITY_LOG);
  await db
    .update(personalPosts)
    .set({ renderActivityLog: next })
    .where(eq(personalPosts.id, postId));
}

/**
 * How long an in-flight personal post may sit without finishing before cron
 * marks it failed. Override with `PERSONAL_STALE_PIPELINE_MS` (milliseconds, min 60000).
 * Default: 3h in production, 45m in non-production (laptop sleep / hung jobs recover sooner).
 */
export function stalePersonalPipelineMs(): number {
  const raw = process.env.PERSONAL_STALE_PIPELINE_MS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (n >= 60_000) return n;
  }
  return process.env.NODE_ENV === 'production'
    ? 3 * 60 * 60 * 1000
    : 45 * 60 * 1000;
}

/** Shown when boot sweep fails a post that was `rendering` from a prior process. */
const BOOT_RENDERING_RESET_MSG =
  'The API restarted during video encoding (Ctrl+C, deploy, or the process exiting). That encode session ended. Press Generate again.';

/** Shown when boot sweep fails queued / scripting / non-resumable sourcing from a prior process. */
const BOOT_EARLY_PHASE_RESET_MSG =
  'The API process restarted while this post was queued, writing the script, or sourcing media (deploy, memory limit, health check, host sleep, or a second API instance on the same database). That work does not survive the restart. Press Generate again. If this happens often, set NODE_ENV=production on the API host and enable director resume (see deployment docs).';

/**
 * Director `sourcing_media` with a storyboard survives the first boot query, but when
 * {@link personalDirectorResumeOnBootEnabled} is false we deliberately fail those rows so
 * they do not sit "in progress" forever—must match user expectation vs a hung job.
 */
const BOOT_DIRECTOR_SOURCING_NO_RESUME_MSG =
  'Director post was in media sourcing when the API restarted and auto-resume was disabled (PERSONAL_RESUME_DIRECTOR_ON_BOOT=false, e.g. multi-replica). Press Generate again. The Generation log on this card was kept so you can still read prior steps (e.g. provider errors).';

const BOOT_ERR_DISPLAY_MAX = 1200;

/**
 * When true, the first API boot after a crash/stop marks in-flight personal
 * posts whose `updatedAt` predates this process as failed: `rendering` (encode
 * was killed) and `queued` / `scripting` / `sourcing_media` (LLM or network
 * work cannot resume from the DB alone after the process exits), **except**
 * director-mode rows that can resume (pre-stitch checkpoint or storyboard in DB).
 *
 * - Default: **on** only when `NODE_ENV` is `development` or `test`.
 * - Staging/production: **off** unless you set `PERSONAL_RESET_RENDERING_ON_BOOT=true`
 *   (single-node only — multi-instance can mark another replica’s in-flight job as dead).
 */
function personalRenderingBootResetEnabled(): boolean {
  const raw = process.env.PERSONAL_RESET_RENDERING_ON_BOOT?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  // Only auto-fail “orphan” in-flight rows on explicit local dev/test. When NODE_ENV
  // is unset (some PaaS builders) or mis-set, `!== 'production'` used to wipe runs
  // after every harmless API restart — users saw “restarted while queued” on mobile.
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

/**
 * After API restart, resume director-mode posts that were mid-flight (DB
 * checkpoints). {@link resumeInterruptedDirectorPersonalPostsOnBoot} in
 * `personalDirectorPipeline.ts` enqueues those jobs.
 *
 * - Default **on** for local `development`/`test` and Railway/Render (single API).
 * - Set `PERSONAL_RESUME_DIRECTOR_ON_BOOT=false` when running **multiple** API
 *   replicas against one database so two instances don’t resume the same post.
 */
export function personalDirectorResumeOnBootEnabled(): boolean {
  const raw = process.env.PERSONAL_RESUME_DIRECTOR_ON_BOOT?.trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true;
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
  // Local single-API + common PaaS. Multi-replica deploys should set
  // PERSONAL_RESUME_DIRECTOR_ON_BOOT=false so two instances don’t race the same row.
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return true;
  }
  const onRailwayOrRender =
    Boolean(String(process.env.RAILWAY_PUBLIC_DOMAIN ?? '').trim()) ||
    Boolean(String(process.env.RAILWAY_ENVIRONMENT ?? '').trim()) ||
    Boolean(String(process.env.RENDER ?? '').trim());
  return onRailwayOrRender;
}

/**
 * Marks in-flight personal posts that **cannot** belong to this process
 * (their `updatedAt` is before this module first loaded) as failed.
 *
 * Call once when the scheduler starts so Ctrl+C / deploy does not leave the
 * UI stuck on "encoding" or "scripting" until the stale sweep. Rows updated
 * after boot are left alone so a generate that starts milliseconds after
 * listen is not clobbered.
 *
 * Director-mode exceptions (still old `updatedAt`, but resumable from DB):
 * - `rendering` with `__pipelineCheckpoint.phase === 'pre_stitch'` — FFmpeg
 *   can restart from the saved stitch payload.
 * - `sourcing_media` with a storyboard (`editPlan` in `script`) — **only**
 *   when {@link personalDirectorResumeOnBootEnabled} is true will sourcing
 *   continue after boot; otherwise a follow-up update marks that row failed
 *   so the UI does not stay stuck.
 */
export async function failInterruptedRenderingPersonalPostsOnBoot(): Promise<number> {
  if (!personalRenderingBootResetEnabled()) return 0;
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const updatedRendering = await db
    .update(personalPosts)
    .set({
      status: 'failed',
      errorMessage: BOOT_RENDERING_RESET_MSG.slice(0, BOOT_ERR_DISPLAY_MAX),
      renderProgress: null,
      renderProgressLabel: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(personalPosts.status, 'rendering'),
        lt(personalPosts.updatedAt, PERSONAL_PROCESS_BOOT_AT),
        or(
          not(like(personalPosts.templateId, 'director:%')),
          sql`coalesce((${personalPosts.script})::jsonb #>> '{__pipelineCheckpoint,phase}', '') <> 'pre_stitch'`,
        ),
      ),
    )
    .returning({ id: personalPosts.id });
  const updatedEarly = await db
    .update(personalPosts)
    .set({
      status: 'failed',
      errorMessage: BOOT_EARLY_PHASE_RESET_MSG.slice(0, BOOT_ERR_DISPLAY_MAX),
      renderProgress: null,
      renderProgressLabel: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(personalPosts.status, ['queued', 'scripting', 'sourcing_media']),
        lt(personalPosts.updatedAt, PERSONAL_PROCESS_BOOT_AT),
        or(
          not(eq(personalPosts.status, 'sourcing_media')),
          not(like(personalPosts.templateId, 'director:%')),
          sql`not ((${personalPosts.script})::jsonb ? 'editPlan')`,
        ),
      ),
    )
    .returning({ id: personalPosts.id });
  const nRender = updatedRendering.length;
  const nEarly = updatedEarly.length;
  let nDirectorResumeOff = 0;
  if (!personalDirectorResumeOnBootEnabled()) {
    const extraRendering = await db
      .update(personalPosts)
      .set({
        status: 'failed',
        errorMessage: BOOT_RENDERING_RESET_MSG.slice(0, BOOT_ERR_DISPLAY_MAX),
        renderProgress: null,
        renderProgressLabel: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalPosts.status, 'rendering'),
          lt(personalPosts.updatedAt, PERSONAL_PROCESS_BOOT_AT),
          like(personalPosts.templateId, 'director:%'),
          sql`coalesce((${personalPosts.script})::jsonb #>> '{__pipelineCheckpoint,phase}', '') = 'pre_stitch'`,
        ),
      )
      .returning({ id: personalPosts.id });
    nDirectorResumeOff += extraRendering.length;
    const extraSourcing = await db
      .update(personalPosts)
      .set({
        status: 'failed',
        errorMessage: BOOT_DIRECTOR_SOURCING_NO_RESUME_MSG.slice(0, BOOT_ERR_DISPLAY_MAX),
        renderProgress: null,
        renderProgressLabel: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalPosts.status, 'sourcing_media'),
          lt(personalPosts.updatedAt, PERSONAL_PROCESS_BOOT_AT),
          like(personalPosts.templateId, 'director:%'),
          sql`(${personalPosts.script})::jsonb ? 'editPlan'`,
        ),
      )
      .returning({ id: personalPosts.id });
    nDirectorResumeOff += extraSourcing.length;
    if (nDirectorResumeOff > 0) {
      console.warn(
        `[personal] failInterruptedRenderingPersonalPostsOnBoot: marked ${nDirectorResumeOff} director checkpoint row(s) as failed (PERSONAL_RESUME_DIRECTOR_ON_BOOT is off)`,
      );
    }
  }
  if (nRender > 0) {
    console.warn(
      `[personal] failInterruptedRenderingPersonalPostsOnBoot: marked ${nRender} rendering row(s) as failed`,
    );
  }
  if (nEarly > 0) {
    console.warn(
      `[personal] failInterruptedRenderingPersonalPostsOnBoot: marked ${nEarly} queued/scripting/sourcing row(s) as failed`,
    );
  }
  return nRender + nEarly + nDirectorResumeOff;
}

/**
 * Marks personal posts that have sat in `rendering` for many hours as failed.
 * Skips director posts that still have a `pre_stitch` checkpoint (same idea
 * as {@link failInterruptedRenderingPersonalPostsOnBoot}) so a long encode or
 * a host that was down does not erase a resumable row.
 */
export async function failStaleRenderingPersonalPosts(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const cutoff = new Date(Date.now() - stalePersonalPipelineMs());
  const staleEncodeMsg =
    'Video encoding had no progress for many hours (stalled encode, sleep, or overload). Try generating again.';
  const rows = await db
    .select({
      id: personalPosts.id,
      accountId: personalPosts.accountId,
      topic: personalPosts.topic,
    })
    .from(personalPosts)
    .where(
      and(
        eq(personalPosts.status, 'rendering'),
        lt(personalPosts.updatedAt, cutoff),
        or(
          not(like(personalPosts.templateId, 'director:%')),
          sql`coalesce((${personalPosts.script})::jsonb #>> '{__pipelineCheckpoint,phase}', '') <> 'pre_stitch'`,
        ),
      ),
    )
    .limit(80);
  let n = 0;
  for (const r of rows) {
    if (isPersonalPostInFlightLocally(r.id)) {
      console.warn(
        `[personal] failStaleRenderingPersonalPosts: skipping in-flight post ${r.id.slice(0, 8)}… (still encoding in this process)`,
      );
      continue;
    }
    await db
      .update(personalPosts)
      .set({
        status: 'failed',
        errorMessage: staleEncodeMsg,
        renderProgress: null,
        renderProgressLabel: null,
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, r.id));
    void maybeEmailPersonalPostFailed({
      accountId: r.accountId,
      postId: r.id,
      topic: r.topic,
      error: staleEncodeMsg,
      includeSaveLink: false,
    }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
    n++;
  }
  if (n > 0) {
    console.warn(`[personal] failStaleRenderingPersonalPosts: marked ${n} stale row(s) as failed`);
  }
  if (!personalDirectorResumeOnBootEnabled()) {
    const rowsPreStitch = await db
      .select({
        id: personalPosts.id,
        accountId: personalPosts.accountId,
        topic: personalPosts.topic,
      })
      .from(personalPosts)
      .where(
        and(
          eq(personalPosts.status, 'rendering'),
          lt(personalPosts.updatedAt, cutoff),
          like(personalPosts.templateId, 'director:%'),
          sql`coalesce((${personalPosts.script})::jsonb #>> '{__pipelineCheckpoint,phase}', '') = 'pre_stitch'`,
        ),
      )
      .limit(80);
    for (const r of rowsPreStitch) {
      if (isPersonalPostInFlightLocally(r.id)) continue;
      await db
        .update(personalPosts)
        .set({
          status: 'failed',
          errorMessage: staleEncodeMsg,
          renderProgress: null,
          renderProgressLabel: null,
          updatedAt: new Date(),
        })
        .where(eq(personalPosts.id, r.id));
      void maybeEmailPersonalPostFailed({
        accountId: r.accountId,
        postId: r.id,
        topic: r.topic,
        error: staleEncodeMsg,
        includeSaveLink: false,
      }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
      n++;
    }
    if (rowsPreStitch.length > 0) {
      console.warn(
        `[personal] failStaleRenderingPersonalPosts: marked ${rowsPreStitch.length} stale director pre_stitch row(s) as failed (resume on boot is off)`,
      );
    }
  }
  return n;
}

/**
 * Marks personal posts stuck in `queued`, `scripting`, or `sourcing_media` for
 * many hours as failed. Skips director `sourcing_media` rows that still have a
 * storyboard (`editPlan`) so they can be resumed like on cold boot.
 */
export async function failStaleEarlyPhasePersonalPosts(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const cutoff = new Date(Date.now() - stalePersonalPipelineMs());
  const staleEarlyMsg =
    'Generation had no progress for many hours (stalled AI, sleep, or overload). Try generating again.';
  const rows = await db
    .select({
      id: personalPosts.id,
      accountId: personalPosts.accountId,
      topic: personalPosts.topic,
    })
    .from(personalPosts)
    .where(
      and(
        inArray(personalPosts.status, ['queued', 'scripting', 'sourcing_media']),
        lt(personalPosts.updatedAt, cutoff),
        or(
          not(eq(personalPosts.status, 'sourcing_media')),
          not(like(personalPosts.templateId, 'director:%')),
          sql`not ((${personalPosts.script})::jsonb ? 'editPlan')`,
        ),
      ),
    )
    .limit(80);
  let n = 0;
  for (const r of rows) {
    if (isPersonalPostInFlightLocally(r.id)) {
      console.warn(
        `[personal] failStaleEarlyPhasePersonalPosts: skipping in-flight post ${r.id.slice(0, 8)}… (still generating in this process)`,
      );
      continue;
    }
    await db
      .update(personalPosts)
      .set({
        status: 'failed',
        errorMessage: staleEarlyMsg,
        renderProgress: null,
        renderProgressLabel: null,
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, r.id));
    void maybeEmailPersonalPostFailed({
      accountId: r.accountId,
      postId: r.id,
      topic: r.topic,
      error: staleEarlyMsg,
      includeSaveLink: false,
    }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
    n++;
  }
  if (n > 0) {
    console.warn(`[personal] failStaleEarlyPhasePersonalPosts: marked ${n} stale row(s) as failed`);
  }
  if (!personalDirectorResumeOnBootEnabled()) {
    const rowsDirectorSourcing = await db
      .select({
        id: personalPosts.id,
        accountId: personalPosts.accountId,
        topic: personalPosts.topic,
      })
      .from(personalPosts)
      .where(
        and(
          eq(personalPosts.status, 'sourcing_media'),
          lt(personalPosts.updatedAt, cutoff),
          like(personalPosts.templateId, 'director:%'),
          sql`(${personalPosts.script})::jsonb ? 'editPlan'`,
        ),
      )
      .limit(80);
    const sourcingMsg = BOOT_DIRECTOR_SOURCING_NO_RESUME_MSG.slice(0, BOOT_ERR_DISPLAY_MAX);
    for (const r of rowsDirectorSourcing) {
      if (isPersonalPostInFlightLocally(r.id)) continue;
      await db
        .update(personalPosts)
        .set({
          status: 'failed',
          errorMessage: sourcingMsg,
          renderProgress: null,
          renderProgressLabel: null,
          updatedAt: new Date(),
        })
        .where(eq(personalPosts.id, r.id));
      void maybeEmailPersonalPostFailed({
        accountId: r.accountId,
        postId: r.id,
        topic: r.topic,
        error: sourcingMsg,
        includeSaveLink: false,
      }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
      n++;
    }
    if (rowsDirectorSourcing.length > 0) {
      console.warn(
        `[personal] failStaleEarlyPhasePersonalPosts: marked ${rowsDirectorSourcing.length} stale director sourcing row(s) as failed (resume on boot is off)`,
      );
    }
  }
  return n;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function assertDb() {
  if (!isDbConfigured()) throw new Error('DATABASE_URL is required for personal accounts');
}

/**
 * Next UTC run on the posts-per-day grid (first slot at posting hour/minute,
 * then +spacing for each remaining daily post). Always returns a time strictly
 * after `now`.
 */
export function computeNextRunAt(args: {
  now: Date;
  postingHourUtc: number;
  postingMinuteUtc: number;
  postsPerDay?: number;
  postSpacingMinutes?: number;
}): Date {
  const postsPerDay = Math.max(1, Math.min(48, Math.floor(args.postsPerDay ?? 1)));
  const spacingMs = Math.max(1, Math.floor(args.postSpacingMinutes ?? 60)) * 60 * 1000;
  const anchor = new Date(args.now);
  anchor.setUTCHours(args.postingHourUtc, args.postingMinuteUtc, 0, 0);

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const dayFirst = new Date(anchor);
    dayFirst.setUTCDate(anchor.getUTCDate() + dayOffset);
    for (let i = 0; i < postsPerDay; i++) {
      const slot = new Date(dayFirst.getTime() + i * spacingMs);
      if (slot.getTime() > args.now.getTime()) {
        return slot;
      }
    }
  }

  const fallback = new Date(anchor);
  fallback.setUTCDate(fallback.getUTCDate() + 1);
  return fallback;
}

const REMOVED_STYLE_BIBLE_KEYS = ['motifs', 'copySamples', 'exampleScriptSnippets', 'bannedPhrases'] as const;

/** Drops removed style-bible fields so JSONB and API payloads stay clean. */
function stripRemovedStyleBibleKeys(
  raw: PersonalAccountStyleBible | null,
): PersonalAccountStyleBible | null {
  if (raw == null) return null;
  const o = { ...(raw as Record<string, unknown>) };
  for (const k of REMOVED_STYLE_BIBLE_KEYS) delete o[k];
  return o as PersonalAccountStyleBible;
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
    contentStudioAccountId: row.contentStudioAccountId ?? null,
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
    emailVideoOnReady: row.emailVideoOnReady,
    videoDeliveryEmail: row.videoDeliveryEmail ?? null,
    autoGenerateOnSchedule: row.autoGenerateOnSchedule,
    accentColor: row.accentColor,
    logoUrl: row.logoUrl,
    watermarkHandle: row.watermarkHandle,
    status: row.status,
    lastGeneratedAt: row.lastGeneratedAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    totalPosts: row.totalPosts,
    styleBible: stripRemovedStyleBibleKeys((row.styleBible as PersonalAccountStyleBible) ?? null),
    generatorConfig: (row.generatorConfig as PersonalGeneratorConfig) ?? null,
    characterId: row.characterId ?? null,
    formatKind: (row.formatKind ?? 'video') as 'video' | 'slideshow' | 'static_image',
    customAudioUrl: row.customAudioUrl ?? null,
    customAudioAttribution: row.customAudioAttribution ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
