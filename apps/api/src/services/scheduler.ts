/**
 * Scheduled background jobs. Keeps the whole system in motion without
 * requiring any manual kicks from the agency.
 *
 * Jobs:
 *   - publishDue            Every minute. Hit ContentStudio for scheduled posts.
 *   - analyzePendingImages  Every 2 minutes. Score fresh client uploads with Claude Vision.
 *   - generateMonthlyBatches Every day at 09:00 UTC on the 1st. Kicks off the month's batch.
 *
 * Each job writes to cron_runs so operators can see what happened.
 */

import cron from 'node-cron';
import { and, desc, eq, isNull, isNotNull, lt, lte } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  posts,
  cronRuns,
  clientImages,
  clients,
  contentBatches,
  personalAccounts,
  personalPosts,
} from '@boost/database';
import { schedulePost } from './contentStudio.js';
import { analyzeImage } from './claude.js';
import { enhanceImage } from './fal.js';
import { imageAnalysisPrompt } from './prompts.js';
import { runMonthlyGeneration } from './automation.js';
import { notifyAgencyBatchReady } from './notifications.js';
import { withRetry } from './retry.js';
import { enqueuePersonalGenerateForAccount } from './personalGenerateQueue.js';
import { generateForAccount } from './personalPipeline.js';
import { resumeInterruptedDirectorPersonalPostsOnBoot } from './personalDirectorPipeline.js';
import {
  computeNextRunAt,
  failInterruptedRenderingPersonalPostsOnBoot,
  failStaleEarlyPhasePersonalPosts,
  failStaleRenderingPersonalPosts,
  personalDirectorResumeOnBootEnabled,
} from './personalAccounts.js';
import { scheduleReadyPersonalPosts } from './personalContentPosting.js';
import { maybeEmailPersonalPostFailed } from './personalVideoDeliveryEmail.js';

export function startScheduler() {
  if (!isDbConfigured()) {
    console.log('⏸  Scheduler disabled (no DATABASE_URL)');
    return;
  }

  cron.schedule('* * * * *', () => { publishDue().catch((e) => console.error('[cron publishDue]', e)); }, { timezone: 'UTC' });
  cron.schedule('* * * * *', () => {
    scheduleReadyPersonalPosts().catch((e) => console.error('[cron personalScheduleReady]', e));
  }, { timezone: 'UTC' });
  cron.schedule('*/2 * * * *', () => { analyzePendingImages(10).catch((e) => console.error('[cron analyze]', e)); }, { timezone: 'UTC' });
  cron.schedule('0 9 1 * *', () => { generateMonthlyBatches().catch((e) => console.error('[cron monthly]', e)); }, { timezone: 'UTC' });
  cron.schedule('*/5 * * * *', () => { runDuePersonalAccounts().catch((e) => console.error('[cron personal]', e)); }, { timezone: 'UTC' });
  cron.schedule('*/5 * * * *', () => {
    failStaleRenderingPersonalPosts().catch((e) =>
      console.error('[cron personalStaleRender]', e),
    );
    failStaleEarlyPhasePersonalPosts().catch((e) =>
      console.error('[cron personalStaleEarly]', e),
    );
  }, { timezone: 'UTC' });

  console.log(
    '⏱  Scheduler started (publish=1m · personalScheduleReady=1m · analyze=2m · personalAutopilot=5m when account has scheduled generation on · personalStalePipeline=5m · monthly=day-1 09:00)',
  );

  void (async () => {
    try {
      if (personalDirectorResumeOnBootEnabled()) {
        await resumeInterruptedDirectorPersonalPostsOnBoot();
      } else {
        console.log(
          '[personalDirectorResume] skipped on boot (PERSONAL_RESUME_DIRECTOR_ON_BOOT=false or not on Railway/Render). Stuck director jobs stay paused until you press Generate.',
        );
      }
    } catch (e) {
      console.error('[personalDirectorResume] startup', e);
    }
    try {
      await failInterruptedRenderingPersonalPostsOnBoot();
    } catch (e) {
      console.error('[personalRenderingBoot] startup sweep', e);
    }
  })();
  void failStaleRenderingPersonalPosts().catch((e) =>
    console.error('[personalStaleRender] startup sweep', e),
  );
  void failStaleEarlyPhasePersonalPosts().catch((e) =>
    console.error('[personalStaleEarly] startup sweep', e),
  );
}

// ---------------------------------------------------------------------------
// Publish due
// ---------------------------------------------------------------------------

export async function publishDue() {
  const db = getDb();
  const [run] = await db
    .insert(cronRuns)
    .values({ jobName: 'publish_due', status: 'running' })
    .returning();

  const now = new Date();
  const due = await db
    .select()
    .from(posts)
    .where(and(eq(posts.status, 'scheduled'), lt(posts.scheduledAt, now)))
    .limit(20);

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const post of due) {
    try {
      await db.update(posts).set({ status: 'publishing' }).where(eq(posts.id, post.id));
      const { id: csId } = await withRetry(
        () =>
          schedulePost({
            platform: post.platform,
            caption: post.caption,
            imageUrl: post.generatedImageUrl ?? undefined,
            scheduledAt: post.scheduledAt ?? now,
          }),
        { label: `publish:${post.id}`, attempts: 3 },
      );
      await db
        .update(posts)
        .set({
          status: 'published',
          contentStudioPostId: csId,
          publishedAt: new Date(),
          publishError: null,
        })
        .where(eq(posts.id, post.id));
      results.push({ id: post.id, ok: true });
    } catch (e) {
      const err = e as Error;
      await db
        .update(posts)
        .set({ status: 'failed', publishError: err.message })
        .where(eq(posts.id, post.id));
      results.push({ id: post.id, ok: false, error: err.message });
    }
  }

  if (run) {
    await db
      .update(cronRuns)
      .set({ finishedAt: new Date(), status: 'ok', details: { processed: results.length, results } })
      .where(eq(cronRuns.id, run.id));
  }

  return { processed: results.length, results };
}

// ---------------------------------------------------------------------------
// Analyze pending images — each new upload gets a quality score + crop + mood
// ---------------------------------------------------------------------------

export async function analyzePendingImages(limit = 10) {
  const db = getDb();
  const [run] = await db
    .insert(cronRuns)
    .values({ jobName: 'analyze_pending', status: 'running' })
    .returning();

  const pending = await db
    .select({
      img: clientImages,
      client: clients,
    })
    .from(clientImages)
    .leftJoin(clients, eq(clients.id, clientImages.clientId))
    .where(and(eq(clientImages.status, 'pending'), isNull(clientImages.aiDescription)))
    .limit(limit);

  const results: Array<{ id: string; ok: boolean; score?: number; error?: string }> = [];
  for (const row of pending) {
    const img = row.img;
    const client = row.client;
    try {
      const analysis = await withRetry(
        () =>
          analyzeImage(
            img.fileUrl,
            imageAnalysisPrompt({
              industry: client?.industry ?? 'Local Business',
              businessName: client?.businessName ?? 'Client',
            }),
          ),
        { label: `analyze:${img.id}`, attempts: 2 },
      );
      await db
        .update(clientImages)
        .set({
          aiDescription: analysis.subject ?? analysis.captionAngle ?? null,
          aiSuggestions: analysis,
          qualityScore: analysis.qualityScore ?? null,
          status: analysis.usable ? 'approved' : 'rejected',
        })
        .where(eq(clientImages.id, img.id));

      // Opportunistic enhance for salvageable images.
      if (analysis.usable && analysis.needsEditing && analysis.fluxKontextPrompt) {
        try {
          const enhancedUrl = await withRetry(
            () => enhanceImage(img.fileUrl, analysis.fluxKontextPrompt as string),
            { label: `enhance:${img.id}`, attempts: 2 },
          );
          await db
            .update(clientImages)
            .set({ enhancedUrl, status: 'enhanced' })
            .where(eq(clientImages.id, img.id));
        } catch (e) {
          // Not fatal — the original image is still usable.
          console.warn(`[analyze] enhance failed for ${img.id}:`, (e as Error).message);
        }
      }
      results.push({ id: img.id, ok: true, score: analysis.qualityScore ?? undefined });
    } catch (e) {
      results.push({ id: img.id, ok: false, error: (e as Error).message });
    }
  }

  if (run) {
    await db
      .update(cronRuns)
      .set({ finishedAt: new Date(), status: 'ok', details: { processed: results.length, results } })
      .where(eq(cronRuns.id, run.id));
  }

  return { processed: results.length, results };
}

// ---------------------------------------------------------------------------
// Monthly batch generation — runs on the 1st of each month for every active client
// ---------------------------------------------------------------------------

export async function generateMonthlyBatches() {
  const db = getDb();
  const [run] = await db
    .insert(cronRuns)
    .values({ jobName: 'generate_monthly', status: 'running' })
    .returning();

  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  const activeClients = await db.select().from(clients).where(eq(clients.isActive, true));

  // Idempotency: any batch that already exists for this month (regardless
  // of when it was created) counts as done. The previous check scoped
  // by `createdAt >= startOfMonth` which allowed the same month to be
  // re-run if a cron retry fired within the first few seconds of month-
  // rollover.
  const existing = await db
    .select({ clientId: contentBatches.clientId })
    .from(contentBatches)
    .where(eq(contentBatches.month, month));
  const alreadyDone = new Set(existing.map((e) => e.clientId));

  const results: Array<{ clientId: string; ok: boolean; generated?: number; error?: string }> = [];
  for (const client of activeClients) {
    if (alreadyDone.has(client.id)) {
      results.push({ clientId: client.id, ok: true, generated: 0 });
      continue;
    }
    if (client.subscriptionTier === 'website_only') continue;

    try {
      const out = await runMonthlyGeneration({
        clientId: client.id,
        month,
        postsCount: 30,
      });
      await notifyAgencyBatchReady({
        clientName: client.businessName,
        batchId: out.batchId,
        postsGenerated: out.postsGenerated,
        costCents: out.costCents,
      });
      results.push({ clientId: client.id, ok: true, generated: out.postsGenerated });
    } catch (e) {
      results.push({ clientId: client.id, ok: false, error: (e as Error).message });
    }
  }

  if (run) {
    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        status: 'ok',
        details: { month, processed: results.length, results },
      })
      .where(eq(cronRuns.id, run.id));
  }

  return { month, processed: results.length, results };
}

// ---------------------------------------------------------------------------
// Personal content — iterate due personal accounts that opted into Schedule
// autopilot (`auto_generate_on_schedule`) and kick off a post.
//
// Runs every 5 minutes. Selects **active** accounts with scheduled generation on
// and `next_run_at` in the past, generates one post each, then rolls `next_run_at`.
// Accounts with scheduled generation off only run from Generate.
//
// Director long-form can take well over 5 minutes, so overlapping cron ticks must
// not start a second pass (that stacks FFmpeg / fal jobs and looks like flaky
// schedule). Soft failures that return `{ status: 'failed' }` without throwing
// must also re-queue soon — otherwise a burned slot skips until the next spacing.
// ---------------------------------------------------------------------------

/** In-process guard: skip a tick while a previous personal autopilot pass is still running. */
let personalAutopilotInFlight = false;

const PERSONAL_AUTOPILOT_RETRY_MS = 60 * 60 * 1000;

async function delayPersonalAutopilotRetry(accountId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  const delayed = new Date(Date.now() + PERSONAL_AUTOPILOT_RETRY_MS);
  await db
    .update(personalAccounts)
    .set({ nextRunAt: delayed, updatedAt: new Date() })
    .where(eq(personalAccounts.id, accountId));
}

function personalAutopilotProducedVideo(result: {
  videoUrl: string | null;
  status: string;
}): boolean {
  if (!result.videoUrl) return false;
  if (result.status === 'failed' || result.status === 'skipped') return false;
  return true;
}

/** Prefer the persisted post errorMessage so the email matches the dashboard. */
async function resolvePersonalAutopilotFailure(args: {
  accountId: string;
  postId?: string;
  fallback: string;
}): Promise<{ postId: string; topic: string; error: string; includeSaveLink: boolean }> {
  const fallback = args.fallback.trim() || 'Scheduled generation failed';
  if (!isDbConfigured()) {
    return {
      postId: args.postId || args.accountId,
      topic: 'Scheduled video',
      error: fallback,
      includeSaveLink: false,
    };
  }

  try {
    const db = getDb();
    if (args.postId) {
      const [byId] = await db
        .select({
          id: personalPosts.id,
          topic: personalPosts.topic,
          errorMessage: personalPosts.errorMessage,
          videoUrl: personalPosts.videoUrl,
        })
        .from(personalPosts)
        .where(and(eq(personalPosts.id, args.postId), eq(personalPosts.accountId, args.accountId)))
        .limit(1);
      if (byId) {
        const fromDb = (byId.errorMessage ?? '').trim();
        return {
          postId: byId.id,
          topic: (byId.topic ?? '').trim() || 'Scheduled video',
          error: fromDb || fallback,
          includeSaveLink: Boolean((byId.videoUrl ?? '').trim()),
        };
      }
    }

    // Thrown failures often leave a just-marked failed row without returning postId.
    const recentCutoff = new Date(Date.now() - 30 * 60 * 1000);
    const recentFailed = await db
      .select({
        id: personalPosts.id,
        topic: personalPosts.topic,
        errorMessage: personalPosts.errorMessage,
        videoUrl: personalPosts.videoUrl,
        updatedAt: personalPosts.updatedAt,
      })
      .from(personalPosts)
      .where(and(eq(personalPosts.accountId, args.accountId), eq(personalPosts.status, 'failed')))
      .orderBy(desc(personalPosts.updatedAt))
      .limit(8);

    const fresh = recentFailed.find(
      (r) => r.updatedAt && r.updatedAt.getTime() >= recentCutoff.getTime(),
    );
    if (fresh) {
      const fromDb = (fresh.errorMessage ?? '').trim();
      return {
        postId: fresh.id,
        topic: (fresh.topic ?? '').trim() || 'Scheduled video',
        error: fromDb || fallback,
        includeSaveLink: Boolean((fresh.videoUrl ?? '').trim()),
      };
    }
  } catch {
    /* fall through to fallback */
  }

  return {
    postId: args.postId || args.accountId,
    topic: 'Scheduled video',
    error: fallback,
    includeSaveLink: false,
  };
}

async function emailPersonalAutopilotFailure(args: {
  accountId: string;
  postId?: string;
  fallback: string;
}): Promise<void> {
  const resolved = await resolvePersonalAutopilotFailure(args);
  await maybeEmailPersonalPostFailed({
    accountId: args.accountId,
    postId: resolved.postId,
    topic: resolved.topic,
    error: resolved.error,
    includeSaveLink: resolved.includeSaveLink,
  });
}

export async function runDuePersonalAccounts(): Promise<{
  processed: number;
  results: Array<{ accountId: string; ok: boolean; postId?: string; error?: string }>;
}> {
  if (!isDbConfigured()) return { processed: 0, results: [] };
  if (personalAutopilotInFlight) {
    console.warn(
      '[cron personal] previous pass still running — skipping this tick to avoid stacking pipelines',
    );
    return { processed: 0, results: [] };
  }
  personalAutopilotInFlight = true;

  try {
    const db = getDb();
    const [run] = await db
      .insert(cronRuns)
      .values({ jobName: 'personal_generate', status: 'running' })
      .returning();

    const now = new Date();
    const due = await db
      .select()
      .from(personalAccounts)
      .where(
        and(
          eq(personalAccounts.status, 'active'),
          eq(personalAccounts.autoGenerateOnSchedule, true),
          isNotNull(personalAccounts.nextRunAt),
          lte(personalAccounts.nextRunAt, now),
        ),
      )
      .limit(8);

    const results: Array<{
      accountId: string;
      ok: boolean;
      postId?: string;
      error?: string;
      skipped?: boolean;
    }> = [];

    // Process one account at a time so heavy director pipelines (many fal jobs)
    // do not stack on top of each other and trip fal.ai's concurrent-run cap.
    const CONCURRENCY = 1;
    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const batch = due.slice(i, i + CONCURRENCY);
      const outs = await Promise.all(
        batch.map(async (acc) => {
          // Claim the slot first so overlapping cron ticks / replicas cannot
          // enqueue duplicate generations while next_run_at is still due.
          const claimedNext = rollNextRunAt(acc, new Date());
          const [claimed] = await db
            .update(personalAccounts)
            .set({ nextRunAt: claimedNext, updatedAt: new Date() })
            .where(
              and(
                eq(personalAccounts.id, acc.id),
                eq(personalAccounts.status, 'active'),
                eq(personalAccounts.autoGenerateOnSchedule, true),
                isNotNull(personalAccounts.nextRunAt),
                lte(personalAccounts.nextRunAt, now),
              ),
            )
            .returning({ id: personalAccounts.id });
          if (!claimed) {
            return {
              accountId: acc.id,
              ok: true,
              skipped: true,
            };
          }

          try {
            const result = await enqueuePersonalGenerateForAccount(acc.id, () =>
              generateForAccount({
                accountId: acc.id,
                fromScheduleAutopilot: true,
                // Prefer account posting settings; also force CS when autoSchedule is on
                // so a due Schedule run always attempts the send path it is configured for.
                autoSchedule: acc.autoSchedule,
                scheduleToContentStudio: acc.autoSchedule === true,
              }),
            );
            if (!personalAutopilotProducedVideo(result)) {
              // Pipeline often returns { status: 'failed', skipped: true } without
              // throwing (blocked topic, insufficient shots, etc.). Claim already
              // advanced next_run_at — pull it back so we retry in ~1h instead of
              // burning the whole spacing / next-day window.
              await delayPersonalAutopilotRetry(acc.id);
              const error =
                result.reason?.trim() ||
                `generation ended with status="${result.status}" and no video`;
              console.error(`[cron personal] account ${acc.id} soft-failed:`, error);
              void emailPersonalAutopilotFailure({
                accountId: acc.id,
                postId: result.postId || undefined,
                fallback: error,
              }).catch((e) =>
                console.warn('[cron personal] failure email:', (e as Error).message),
              );
              return {
                accountId: acc.id,
                ok: false,
                postId: result.postId || undefined,
                error,
              };
            }
            return {
              accountId: acc.id,
              ok: true,
              postId: result.postId,
            };
          } catch (e) {
            // Delay by 1 hour so a broken account doesn't re-fire every 5 minutes.
            await delayPersonalAutopilotRetry(acc.id);
            const error = (e as Error).message;
            console.error(`[cron personal] account ${acc.id} failed:`, error);
            void emailPersonalAutopilotFailure({
              accountId: acc.id,
              fallback: error,
            }).catch((err) =>
              console.warn('[cron personal] failure email:', (err as Error).message),
            );
            return {
              accountId: acc.id,
              ok: false,
              error,
            };
          }
        }),
      );
      results.push(...outs);
    }

    if (run) {
      await db
        .update(cronRuns)
        .set({
          finishedAt: new Date(),
          status: 'ok',
          details: { processed: results.length, results },
        })
        .where(eq(cronRuns.id, run.id));
    }

    return { processed: results.length, results };
  } finally {
    personalAutopilotInFlight = false;
  }
}

/**
 * Next run after claiming a due slot: next grid time strictly after `now`
 * (remaining slots today, else tomorrow's first).
 */
function rollNextRunAt(
  acc: typeof personalAccounts.$inferSelect,
  now: Date,
): Date {
  return computeNextRunAt({
    now,
    postingHourUtc: acc.postingHourUtc,
    postingMinuteUtc: acc.postingMinuteUtc,
    postsPerDay: acc.postsPerDay,
    postSpacingMinutes: acc.postSpacingMinutes,
  });
}
