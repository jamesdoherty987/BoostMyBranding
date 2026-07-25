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
import { and, eq, isNull, isNotNull, lt, lte } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  posts,
  cronRuns,
  clientImages,
  clients,
  contentBatches,
  personalAccounts,
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

export function startScheduler() {
  if (!isDbConfigured()) {
    console.log('⏸  Scheduler disabled (no DATABASE_URL)');
    return;
  }

  cron.schedule('* * * * *', () => { publishDue().catch((e) => console.error('[cron publishDue]', e)); }, { timezone: 'UTC' });
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
    '⏱  Scheduler started (publish=1m · analyze=2m · personalAutopilot=5m when account has scheduled generation on · personalStalePipeline=5m · monthly=day-1 09:00)',
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
// One generation can take 30-120 seconds, so we process accounts in parallel
// with a small cap so we don't stampede Remotion/Claude quotas.
// ---------------------------------------------------------------------------

export async function runDuePersonalAccounts(): Promise<{
  processed: number;
  results: Array<{ accountId: string; ok: boolean; postId?: string; error?: string }>;
}> {
  if (!isDbConfigured()) return { processed: 0, results: [] };
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
            generateForAccount({ accountId: acc.id }),
          );
          return {
            accountId: acc.id,
            ok: true,
            postId: result.postId,
          };
        } catch (e) {
          // Delay by 1 hour so a broken account doesn't re-fire every 5 minutes.
          const delayed = new Date(Date.now() + 60 * 60 * 1000);
          await db
            .update(personalAccounts)
            .set({ nextRunAt: delayed, updatedAt: new Date() })
            .where(eq(personalAccounts.id, acc.id));
          const error = (e as Error).message;
          console.error(`[cron personal] account ${acc.id} failed:`, error);
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
}

/**
 * Compute the next run time based on postsPerDay / postSpacingMinutes.
 * If we've already generated all daily posts, advance to tomorrow's
 * posting window.
 */
function rollNextRunAt(
  acc: typeof personalAccounts.$inferSelect,
  now: Date,
): Date {
  const spacing = acc.postSpacingMinutes * 60 * 1000;
  const next = new Date(now.getTime() + spacing);
  // Clamp to tomorrow's posting window if past today's final slot.
  const todayFirstSlot = new Date(now);
  todayFirstSlot.setUTCHours(acc.postingHourUtc, acc.postingMinuteUtc, 0, 0);
  const todayLastSlot = new Date(
    todayFirstSlot.getTime() + (acc.postsPerDay - 1) * spacing,
  );
  if (next.getTime() > todayLastSlot.getTime()) {
    return computeNextRunAt({
      now: new Date(todayLastSlot.getTime() + 24 * 60 * 60 * 1000),
      postingHourUtc: acc.postingHourUtc,
      postingMinuteUtc: acc.postingMinuteUtc,
    });
  }
  return next;
}
