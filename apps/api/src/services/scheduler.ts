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
import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  posts,
  cronRuns,
  clientImages,
  clients,
  contentBatches,
} from '@boost/database';
import { schedulePost } from './contentStudio.js';
import { analyzeImage } from './claude.js';
import { enhanceImage } from './fal.js';
import { imageAnalysisPrompt } from './prompts.js';
import { runMonthlyGeneration } from './automation.js';
import { notifyAgencyBatchReady } from './notifications.js';
import { withRetry } from './retry.js';

export function startScheduler() {
  if (!isDbConfigured()) {
    console.log('⏸  Scheduler disabled (no DATABASE_URL)');
    return;
  }

  cron.schedule('* * * * *', () => { publishDue().catch((e) => console.error('[cron publishDue]', e)); }, { timezone: 'UTC' });
  cron.schedule('*/2 * * * *', () => { analyzePendingImages(10).catch((e) => console.error('[cron analyze]', e)); }, { timezone: 'UTC' });
  cron.schedule('0 9 1 * *', () => { generateMonthlyBatches().catch((e) => console.error('[cron monthly]', e)); }, { timezone: 'UTC' });

  console.log('⏱  Scheduler started (publish=1m · analyze=2m · monthly=day-1 09:00)');
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
  const startOfMonth = new Date(`${month}-01T00:00:00Z`);

  const activeClients = await db.select().from(clients).where(eq(clients.isActive, true));

  // Skip any client that already has a batch for this month — idempotency.
  const existing = await db
    .select({ clientId: contentBatches.clientId })
    .from(contentBatches)
    .where(and(eq(contentBatches.month, month), gte(contentBatches.createdAt, startOfMonth)));
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
