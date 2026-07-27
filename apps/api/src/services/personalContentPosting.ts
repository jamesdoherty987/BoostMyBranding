/**
 * When personal videos are pushed to ContentStudio after render.
 */

import type { personalAccounts } from '@boost/database';
import { env, features } from '../env.js';
import { schedulePost, type SchedulePostArgs } from './contentStudio.js';
import { PERSONAL_SCRIPT_SCHEDULE_INTENT } from './personalDirector.js';
import { isDefaultRetryable, withRetry } from './retry.js';

export type PersonalAccountRow = typeof personalAccounts.$inferSelect;

/** Minimal fields needed to decide / persist ContentStudio scheduling. */
export type PersonalScheduleAccountFields = {
  autoSchedule: boolean;
  contentStudioWorkspaceId: string | null;
  contentStudioAccountId?: string | null;
  platform?: string | null;
};

export { PERSONAL_SCRIPT_SCHEDULE_INTENT };

export type PersonalScheduleIntent = {
  /** Explicit "Generate & schedule" or autopilot that should push to CS. */
  scheduleToContentStudio?: boolean;
  /** Optional ISO time; otherwise pipeline uses ~now+1h. */
  scheduledAt?: string;
};

export function hasResolvableContentStudioWorkspace(
  account: PersonalScheduleAccountFields,
): boolean {
  const ws = (account.contentStudioWorkspaceId ?? env.CONTENTSTUDIO_WORKSPACE_ID ?? '').trim();
  return Boolean(ws);
}

/**
 * True when we should call ContentStudio after a successful render.
 * - `scheduleToContentStudio` on the generate request: one-off "Generate & schedule post"
 *   (still requires API key + a resolvable workspace).
 * - Otherwise: `account.autoSchedule` (Posting tab: "Send finished videos to Content Studio").
 */
export function shouldSchedulePersonalToContentStudio(
  args: {
    autoSchedule?: boolean;
    scheduleToContentStudio?: boolean;
    scheduledAt?: string;
  },
  account: PersonalScheduleAccountFields,
): boolean {
  if (!features.contentStudio || !hasResolvableContentStudioWorkspace(account)) {
    return false;
  }
  if (args.scheduleToContentStudio === true) {
    return true;
  }
  return Boolean(args.autoSchedule ?? account.autoSchedule);
}

/** Build intent to embed in script when this run should (or may) schedule. */
export function buildPersonalScheduleIntent(
  args: {
    autoSchedule?: boolean;
    scheduleToContentStudio?: boolean;
    scheduledAt?: string;
  },
  account: PersonalScheduleAccountFields,
): PersonalScheduleIntent | null {
  if (!shouldSchedulePersonalToContentStudio(args, account)) return null;
  const intent: PersonalScheduleIntent = { scheduleToContentStudio: true };
  const at = args.scheduledAt?.trim();
  if (at) intent.scheduledAt = at;
  return intent;
}

export function readPersonalScheduleIntent(script: unknown): PersonalScheduleIntent | null {
  if (!script || typeof script !== 'object') return null;
  const raw = (script as Record<string, unknown>)[PERSONAL_SCRIPT_SCHEDULE_INTENT];
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const intent: PersonalScheduleIntent = {};
  if (o.scheduleToContentStudio === true) intent.scheduleToContentStudio = true;
  if (typeof o.scheduledAt === 'string' && o.scheduledAt.trim()) {
    intent.scheduledAt = o.scheduledAt.trim();
  }
  if (!intent.scheduleToContentStudio && !intent.scheduledAt) return null;
  return intent;
}

/** Merge persisted intent into generate args (boot resume / cron retry). */
export function mergePersonalScheduleIntentIntoArgs<T extends object>(
  args: T,
  script: unknown,
): T & {
  scheduleToContentStudio?: boolean;
  scheduledAt?: string;
  autoSchedule?: boolean;
} {
  const intent = readPersonalScheduleIntent(script);
  if (!intent) return { ...args };
  return {
    ...args,
    scheduleToContentStudio:
      (args as { scheduleToContentStudio?: boolean }).scheduleToContentStudio === true ||
      intent.scheduleToContentStudio === true
        ? true
        : (args as { scheduleToContentStudio?: boolean }).scheduleToContentStudio,
    scheduledAt:
      (args as { scheduledAt?: string }).scheduledAt ?? intent.scheduledAt,
  };
}

/** Attach schedule intent onto a script blob (checkpoints / final row). */
export function withPersonalScheduleIntent(
  script: Record<string, unknown>,
  intent: PersonalScheduleIntent | null | undefined,
): Record<string, unknown> {
  if (!intent?.scheduleToContentStudio && !intent?.scheduledAt) {
    const { [PERSONAL_SCRIPT_SCHEDULE_INTENT]: _drop, ...rest } = script;
    void _drop;
    return rest;
  }
  return { ...script, [PERSONAL_SCRIPT_SCHEDULE_INTENT]: intent };
}

/** When set, schedulePost uses this ContentStudio account id instead of auto-pick. */
export function contentStudioAccountIdsOverride(
  account: PersonalScheduleAccountFields,
): string[] | undefined {
  const id = account.contentStudioAccountId?.trim();
  return id ? [id] : undefined;
}

/**
 * Schedule via ContentStudio with retries so transient API / network failures
 * do not leave a finished video unposted.
 */
export async function schedulePersonalPostWithRetry(
  args: SchedulePostArgs,
  opts?: { label?: string },
): Promise<{ id: string }> {
  return withRetry(() => schedulePost(args), {
    label: opts?.label ?? 'personal:schedulePost',
    attempts: 5,
    baseDelayMs: 800,
    maxDelayMs: 20_000,
    retryOn: (err) => {
      if (isDefaultRetryable(err)) return true;
      const msg = err instanceof Error ? err.message : String(err);
      if (/ContentStudio API (429|5\d{2})\b/i.test(msg)) return true;
      if (/timeout|ECONNRESET|fetch failed|network|socket/i.test(msg)) return true;
      return false;
    },
  });
}

function isYoutubePlatform(platform: string | null | undefined): boolean {
  return String(platform ?? '')
    .trim()
    .toLowerCase()
    .includes('youtube');
}

/** Best-effort YouTube fields from a finished personal post row (for cron retry). */
function youtubeScheduleExtrasFromPost(post: {
  topic: string;
  thumbnailUrl?: string | null;
  script: unknown;
  platform?: string | null;
}): Pick<SchedulePostArgs, 'youtubeTitle' | 'youtubeLongForm' | 'youtubeThumbnailUrl'> | Record<string, never> {
  if (!isYoutubePlatform(post.platform)) return {};
  const script =
    post.script && typeof post.script === 'object'
      ? (post.script as Record<string, unknown>)
      : {};
  const gen =
    script.generationInfo && typeof script.generationInfo === 'object'
      ? (script.generationInfo as Record<string, unknown>)
      : {};
  const longform = gen.longformEnabled === true;
  if (!longform) return {};
  const titleRaw =
    (typeof script.title === 'string' && script.title.trim()) ||
    post.topic.trim() ||
    '';
  const thumb = (post.thumbnailUrl ?? '').trim();
  return {
    youtubeLongForm: true,
    ...(titleRaw ? { youtubeTitle: titleRaw.slice(0, 100) } : {}),
    ...(thumb ? { youtubeThumbnailUrl: thumb } : {}),
  };
}

/**
 * Pick up `ready` personal posts that still need ContentStudio scheduling
 * (soft schedule failures, process restart mid-pipeline, or the old
 * autoApprove/pinned gate that silently skipped). Runs from the scheduler.
 */
export async function scheduleReadyPersonalPosts(limit = 12): Promise<{
  processed: number;
  results: Array<{ postId: string; ok: boolean; skipped?: boolean; error?: string }>;
}> {
  const { and, eq, isNotNull, isNull, gt, desc } = await import('drizzle-orm');
  const { getDb, isDbConfigured, personalPosts, personalAccounts } = await import(
    '@boost/database'
  );
  if (!isDbConfigured() || !features.contentStudio) {
    return { processed: 0, results: [] };
  }

  const db = getDb();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      post: personalPosts,
      account: personalAccounts,
    })
    .from(personalPosts)
    .innerJoin(personalAccounts, eq(personalAccounts.id, personalPosts.accountId))
    .where(
      and(
        eq(personalPosts.status, 'ready'),
        isNotNull(personalPosts.videoUrl),
        isNull(personalPosts.contentStudioPostId),
        gt(personalPosts.updatedAt, since),
      ),
    )
    .orderBy(desc(personalPosts.updatedAt))
    .limit(Math.max(1, Math.min(limit, 30)));

  const results: Array<{ postId: string; ok: boolean; skipped?: boolean; error?: string }> = [];

  for (const { post, account } of rows) {
    const videoUrl = (post.videoUrl ?? '').trim();
    if (!videoUrl) {
      results.push({ postId: post.id, ok: true, skipped: true });
      continue;
    }

    const merged = mergePersonalScheduleIntentIntoArgs(
      {} as { scheduleToContentStudio?: boolean; scheduledAt?: string; autoSchedule?: boolean },
      post.script,
    );
    const softFail =
      typeof post.errorMessage === 'string' && /ContentStudio/i.test(post.errorMessage);
    const want =
      shouldSchedulePersonalToContentStudio(merged, account) || softFail;
    if (!want || !hasResolvableContentStudioWorkspace(account)) {
      results.push({ postId: post.id, ok: true, skipped: true });
      continue;
    }

    // Back off after a failed attempt so we don't hammer ContentStudio every minute.
    if (post.errorMessage) {
      const ageMs = Date.now() - new Date(post.updatedAt).getTime();
      if (ageMs < 5 * 60 * 1000) {
        results.push({ postId: post.id, ok: true, skipped: true });
        continue;
      }
    }

    // CAS claim so overlapping cron ticks / API replicas cannot double-post to CS.
    const prevUpdatedAt = post.updatedAt;
    const [claimed] = await db
      .update(personalPosts)
      .set({
        errorMessage: 'ContentStudio schedule in progress…',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalPosts.id, post.id),
          eq(personalPosts.status, 'ready'),
          isNull(personalPosts.contentStudioPostId),
          eq(personalPosts.updatedAt, prevUpdatedAt),
        ),
      )
      .returning({ id: personalPosts.id });
    if (!claimed) {
      results.push({ postId: post.id, ok: true, skipped: true });
      continue;
    }

    const when =
      merged.scheduledAt && !Number.isNaN(Date.parse(merged.scheduledAt))
        ? new Date(merged.scheduledAt)
        : new Date(Date.now() + 60 * 60 * 1000);

    try {
      const res = await schedulePersonalPostWithRetry(
        {
          platform: account.platform,
          caption: post.caption ?? post.topic,
          videoUrl,
          scheduledAt: when,
          workspaceId: account.contentStudioWorkspaceId ?? undefined,
          contentStudioAccountIds: contentStudioAccountIdsOverride(account),
          ...youtubeScheduleExtrasFromPost({
            topic: post.topic,
            thumbnailUrl: post.thumbnailUrl,
            script: post.script,
            platform: account.platform,
          }),
        },
        { label: `personal:scheduleReady:${post.id}` },
      );

      const scriptObj =
        post.script && typeof post.script === 'object'
          ? { ...(post.script as Record<string, unknown>) }
          : {};
      const [saved] = await db
        .update(personalPosts)
        .set({
          contentStudioPostId: res.id,
          scheduledAt: when,
          status: 'scheduled',
          errorMessage: null,
          script: withPersonalScheduleIntent(scriptObj, null) as any,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(personalPosts.id, post.id),
            eq(personalPosts.status, 'ready'),
            isNull(personalPosts.contentStudioPostId),
          ),
        )
        .returning({ id: personalPosts.id });
      if (!saved) {
        // Another writer won the final row — CS may already have a duplicate; log for ops.
        console.warn(
          `[personal] scheduleReady: CS accepted ${res.id} but post ${post.id} was no longer claimable`,
        );
      }
      results.push({ postId: post.id, ok: true });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`[personal] scheduleReady failed for ${post.id}:`, error);
      await db
        .update(personalPosts)
        .set({
          errorMessage: error.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(personalPosts.id, post.id));
      results.push({ postId: post.id, ok: false, error });
    }
  }

  return { processed: results.length, results };
}
