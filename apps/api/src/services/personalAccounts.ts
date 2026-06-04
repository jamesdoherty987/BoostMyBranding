/**
 * Personal accounts CRUD — the user's own social accounts (separate
 * from agency-managed `clients`). All operations are scoped to the
 * authenticated user id.
 */

import { and, desc, eq, inArray, like, lt, not, or, sql } from 'drizzle-orm';
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
      autoSchedule: args.autoSchedule ?? true,
      autoGenerateOnSchedule: args.autoGenerateOnSchedule ?? false,
      accentColor: args.accentColor ?? theme.accentColor,
      logoUrl: args.logoUrl,
      watermarkHandle: args.watermarkHandle,
      characterId: args.characterId ?? null,
      styleBible: args.styleBible,
      generatorConfig: args.generatorConfig,
      formatKind: args.formatKind ?? theme.defaultFormat ?? 'video',
      customAudioUrl: args.customAudioUrl ?? null,
      customAudioAttribution: args.customAudioAttribution ?? null,
      nextRunAt:
        args.autoGenerateOnSchedule === true
          ? computeNextRunAt({
              now: new Date(),
              postingHourUtc: args.postingHourUtc ?? 8,
              postingMinuteUtc: args.postingMinuteUtc ?? 0,
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
    updates.styleBible = {
      ...(existing.styleBible ?? {}),
      ...patch.styleBible,
    };
  }
  if (patch.generatorConfig !== undefined) {
    updates.generatorConfig = {
      ...(existing.generatorConfig ?? {}),
      ...patch.generatorConfig,
    };
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
    .where(eq(personalPosts.accountId, accountId))
    .orderBy(desc(personalPosts.createdAt))
    .limit(limit);
  return rows.map((r) => r.topic);
}

/** Titles from recent posts' `script` JSON — used to avoid duplicate video titles. */
export async function recentVideoTitles(accountId: string, limit = 40): Promise<string[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const cap = Math.min(80, Math.max(1, Math.round(limit)));
  const rows = await db
    .select({ script: personalPosts.script })
    .from(personalPosts)
    .where(eq(personalPosts.accountId, accountId))
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
  qualityScore: number | null;
  status: string;
  errorMessage: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishUrl: string | null;
  mediaAssets: PersonalPostMediaAsset[];
  costCents: number;
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
        ? (r.renderActivityLog as PersonalPostRenderActivityEntry[])
        : [],
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

/** True when the post row is `failed` (e.g. user cancelled or pipeline error). */
export async function personalPostIsFailed(postId: string): Promise<boolean> {
  assertDb();
  const db = getDb();
  const [r] = await db
    .select({ status: personalPosts.status })
    .from(personalPosts)
    .where(eq(personalPosts.id, postId));
  return r?.status === 'failed';
}

/** Posts stuck in an in-flight pipeline phase longer than this are marked failed (crash, hung LLM, lost worker). */
const STALE_PERSONAL_PIPELINE_MS = 3 * 60 * 60 * 1000; // 3 hours

const BOOT_RENDERING_RESET_MSG =
  'Encoding was interrupted when the server restarted (for example the dev server was stopped). Generate again to retry.';

const BOOT_EARLY_PHASE_RESET_MSG =
  'Generation was interrupted while planning or sourcing media (for example the dev server was stopped, or the job hung). Generate again to retry.';

/**
 * When true, the first API boot after a crash/stop marks in-flight personal
 * posts whose `updatedAt` predates this process as failed: `rendering` (encode
 * was killed) and `queued` / `scripting` / `sourcing_media` (LLM or network
 * work cannot resume from the DB alone after the process exits), **except**
 * director-mode rows that can resume (pre-stitch checkpoint or storyboard in DB).
 *
 * - Default: **on** when `NODE_ENV` is not `production`.
 * - Production default: **off** (rolling multi-instance deploys could
 *   otherwise mark a job still running on another instance). Set
 *   `PERSONAL_RESET_RENDERING_ON_BOOT=true` on a single-node host if you want
 *   the same behaviour there.
 */
function personalRenderingBootResetEnabled(): boolean {
  const raw = process.env.PERSONAL_RESET_RENDERING_ON_BOOT?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * After API restart, resume director-mode posts that were mid-flight (DB
 * checkpoints). {@link resumeInterruptedDirectorPersonalPostsOnBoot} in
 * `personalDirectorPipeline.ts` enqueues those jobs.
 *
 * - Default **off** everywhere so pipelines only continue after an explicit
 *   Generate (or you opt in for crash recovery).
 * - Set `PERSONAL_RESUME_DIRECTOR_ON_BOOT=true` on a single-node host when you
 *   want checkpointed director jobs to resume after deploy/restart.
 */
export function personalDirectorResumeOnBootEnabled(): boolean {
  const raw = process.env.PERSONAL_RESUME_DIRECTOR_ON_BOOT?.trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true;
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
  return false;
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
 * - `sourcing_media` with a storyboard (`editPlan` in `script`) — shot work
 *   can continue after `resumeInterruptedDirectorPersonalPostsOnBoot` runs.
 */
export async function failInterruptedRenderingPersonalPostsOnBoot(): Promise<number> {
  if (!personalRenderingBootResetEnabled()) return 0;
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const updatedRendering = await db
    .update(personalPosts)
    .set({
      status: 'failed',
      errorMessage: BOOT_RENDERING_RESET_MSG.slice(0, 500),
      renderProgress: null,
      renderProgressLabel: null,
      renderActivityLog: [],
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
      errorMessage: BOOT_EARLY_PHASE_RESET_MSG.slice(0, 500),
      renderProgress: null,
      renderProgressLabel: null,
      renderActivityLog: [],
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
  return nRender + nEarly;
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
  const cutoff = new Date(Date.now() - STALE_PERSONAL_PIPELINE_MS);
  const rows = await db
    .select({ id: personalPosts.id })
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
    await db
      .update(personalPosts)
      .set({
        status: 'failed',
        errorMessage:
          'Video encoding did not finish within a few hours (server restart, stalled network, or overload). Try generating again.',
        renderProgress: null,
        renderProgressLabel: null,
        renderActivityLog: [],
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, r.id));
    n++;
  }
  if (n > 0) {
    console.warn(`[personal] failStaleRenderingPersonalPosts: marked ${n} stale row(s) as failed`);
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
  const cutoff = new Date(Date.now() - STALE_PERSONAL_PIPELINE_MS);
  const rows = await db
    .select({ id: personalPosts.id })
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
    await db
      .update(personalPosts)
      .set({
        status: 'failed',
        errorMessage:
          'Generation did not finish within a few hours (server restart, stalled AI request, or overload). Try generating again.',
        renderProgress: null,
        renderProgressLabel: null,
        renderActivityLog: [],
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, r.id));
    n++;
  }
  if (n > 0) {
    console.warn(`[personal] failStaleEarlyPhasePersonalPosts: marked ${n} stale row(s) as failed`);
  }
  return n;
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
    autoGenerateOnSchedule: row.autoGenerateOnSchedule,
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
