/**
 * Monthly content generation pipeline. Orchestrates:
 *   1. Brand voice (scrape website + cache)
 *   2. Pull approved / enhanced images
 *   3. Vision-score any remaining unscored images
 *   4. Flux Kontext enhancement for images flagged needsEditing
 *   5. Claude Sonnet generates the calendar (N posts, mixed types)
 *   6. Flux 2 Pro fills in any gap-fill images
 *   7. Persist posts as status=pending_internal + notify agency
 *
 * Every stage is retryable and records timing into `content_batches`.
 */

import { and, eq, inArray } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  clients,
  clientImages,
  posts,
  contentBatches,
} from '@boost/database';
import { generateJSON, generateText, analyzeImage } from './claude.js';
import { enhanceImage, generateImage } from './fal.js';
import {
  brandVoicePrompt,
  imageAnalysisPrompt,
  contentCalendarPrompt,
} from './prompts.js';
import { scrapeWebsite } from './scraper.js';
import { notifyAgencyBatchReady } from './notifications.js';
import { withRetry } from './retry.js';
import { broadcast } from './realtime.js';

interface GenerateArgs {
  clientId: string;
  month: string; // YYYY-MM
  postsCount: number;
  platforms?: string[];
  direction?: string;
}

interface CalendarPost {
  dayOfMonth: number;
  platform: string;
  caption: string;
  hashtags: string[];
  imageIndex: number | null;
  imageGenerationPrompt?: string;
  contentType?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
}

const TIME_OF_DAY: Record<string, [number, number]> = {
  morning: [9, 0],
  afternoon: [13, 30],
  evening: [18, 0],
};

export async function runMonthlyGeneration(args: GenerateArgs) {
  const steps: Array<{ key: string; durationMs: number; ok: boolean; note?: string }> = [];
  const stage = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const s = Date.now();
    try {
      const out = await fn();
      steps.push({ key, durationMs: Date.now() - s, ok: true });
      return out;
    } catch (e) {
      steps.push({ key, durationMs: Date.now() - s, ok: false, note: (e as Error).message });
      throw e;
    }
  };

  if (!isDbConfigured()) return runMockPipeline(args);

  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, args.clientId));
  if (!client) throw new Error('Client not found');

  const [batch] = await db
    .insert(contentBatches)
    .values({
      clientId: args.clientId,
      month: args.month,
      status: 'generating',
      startedAt: new Date(),
    })
    .returning();
  if (!batch) throw new Error('Failed to create batch');

  broadcast({ type: 'batch:started', payload: { batchId: batch.id, clientId: client.id } });

  // 1. Brand voice
  let brandVoice = client.brandVoice ?? '';
  if (!brandVoice && client.websiteUrl) {
    brandVoice = await stage('scrape_site', async () => {
      const markdown = await scrapeWebsite(client.websiteUrl ?? '');
      const prompt = brandVoicePrompt({
        websiteMarkdown: markdown,
        businessName: client.businessName,
        industry: client.industry ?? 'Local Business',
      });
      const voice = await withRetry(() => generateText(prompt, { model: 'sonnet' }), {
        label: 'brand_voice',
        attempts: 3,
      });
      await db.update(clients).set({ brandVoice: voice }).where(eq(clients.id, client.id));
      return voice;
    });
  }

  // 2. Gather usable images
  const images = await stage('fetch_images', () =>
    db
      .select()
      .from(clientImages)
      .where(
        and(
          eq(clientImages.clientId, client.id),
          inArray(clientImages.status, ['approved', 'enhanced', 'pending']),
        ),
      )
      .limit(30),
  );

  // 3. Score any unlabeled images
  await stage('analyze_images', async () => {
    let analyzed = 0;
    for (const img of images) {
      if (img.aiDescription) continue;
      try {
        const analysis = await withRetry(
          () =>
            analyzeImage(
              img.fileUrl,
              imageAnalysisPrompt({
                industry: client.industry ?? 'Local Business',
                businessName: client.businessName,
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
        // mutate the in-memory copy so later stages see fresh data
        (img as any).aiSuggestions = analysis;
        (img as any).qualityScore = analysis.qualityScore ?? null;
        analyzed++;
      } catch (e) {
        console.warn(`[generation] analyze ${img.id} failed:`, (e as Error).message);
      }
    }
    await db
      .update(contentBatches)
      .set({ imagesAnalyzed: analyzed })
      .where(eq(contentBatches.id, batch.id));
  });

  // 4. Enhance where needed
  const enhancedImages = await stage('enhance_images', async () => {
    const usable: typeof images = [];
    for (const img of images) {
      const suggestions = (img.aiSuggestions as any) ?? {};
      if (suggestions.needsEditing && suggestions.fluxKontextPrompt) {
        try {
          const url = await withRetry(
            () => enhanceImage(img.fileUrl, suggestions.fluxKontextPrompt),
            { label: `enhance:${img.id}`, attempts: 2 },
          );
          await db
            .update(clientImages)
            .set({ enhancedUrl: url, status: 'enhanced' })
            .where(eq(clientImages.id, img.id));
          usable.push({ ...img, fileUrl: url });
          continue;
        } catch (e) {
          console.warn(`[generation] enhance ${img.id} failed:`, (e as Error).message);
        }
      }
      // Only keep images Claude didn't reject.
      if (img.status !== 'rejected') usable.push(img);
    }
    return usable;
  });

  // 5. Generate the calendar
  const platforms = args.platforms ?? ['instagram', 'facebook', 'linkedin', 'tiktok'];
  const calendar = await stage('generate_calendar', async () => {
    const imageDescs = enhancedImages
      .map((i, idx) => `[${idx}] ${i.aiDescription ?? i.fileName ?? 'photo'}`)
      .join('\n');
    const [year, mm] = args.month.split('-');
    const prompt = contentCalendarPrompt({
      businessName: client.businessName,
      industry: client.industry ?? 'Local Business',
      brandVoice: brandVoice || 'Warm, professional, direct.',
      imageDescriptions: imageDescs || '(no images — generate all with AI)',
      month: monthName(Number(mm)),
      year: year!,
      postsCount: args.postsCount,
      platforms,
      direction: args.direction,
    });
    return withRetry(() => generateJSON<CalendarPost[]>(prompt, { model: 'sonnet', maxTokens: 4096 }), {
      label: 'generate_calendar',
      attempts: 3,
    });
  });

  // 6. Gap-fill images + persist posts
  const costCents = await stage('persist_posts', async () => {
    let cost = 0;
    const [year, mm] = args.month.split('-').map(Number) as [number, number];
    for (const cp of calendar) {
      let imageUrl: string | undefined;
      let imageId: string | undefined;

      if (cp.imageIndex !== null && enhancedImages[cp.imageIndex]) {
        const chosen = enhancedImages[cp.imageIndex]!;
        imageUrl = chosen.enhancedUrl ?? chosen.fileUrl;
        imageId = chosen.id;
      } else if (cp.imageGenerationPrompt) {
        try {
          imageUrl = await withRetry(() => generateImage(cp.imageGenerationPrompt!, '1:1'), {
            label: `fluxgen`,
            attempts: 2,
          });
          cost += 5;
        } catch (e) {
          console.warn('[generation] flux gen failed, skipping image:', (e as Error).message);
        }
      }

      const [h, m] = TIME_OF_DAY[cp.timeOfDay ?? 'morning']!;
      const dayOfMonth = Math.min(28, Math.max(1, cp.dayOfMonth ?? 1)); // clamp to safe range
      const scheduledAt = new Date(Date.UTC(year, mm - 1, dayOfMonth, h, m));

      await db.insert(posts).values({
        clientId: client.id,
        batchId: batch.id,
        imageId: imageId ?? null,
        generatedImageUrl: imageUrl ?? null,
        caption: cp.caption,
        platform: cp.platform as any,
        hashtags: cp.hashtags ?? [],
        scheduledAt,
        status: 'pending_internal',
      });
    }
    return cost + calendar.length * 10;
  });

  await db
    .update(contentBatches)
    .set({
      postsGenerated: calendar.length,
      totalCostCents: costCents,
      status: 'review',
      completedAt: new Date(),
    })
    .where(eq(contentBatches.id, batch.id));

  broadcast({
    type: 'batch:ready',
    payload: {
      batchId: batch.id,
      clientId: client.id,
      postsGenerated: calendar.length,
    },
  });

  // Fire notifications (don't block the response if email is down).
  notifyAgencyBatchReady({
    clientName: client.businessName,
    batchId: batch.id,
    postsGenerated: calendar.length,
    costCents,
  }).catch((e) => console.warn('[notify] batch-ready email failed:', (e as Error).message));

  return { batchId: batch.id, postsGenerated: calendar.length, steps, costCents };
}

function runMockPipeline(args: GenerateArgs) {
  const steps = [
    'scrape_site',
    'fetch_images',
    'analyze_images',
    'enhance_images',
    'generate_calendar',
    'persist_posts',
  ].map((key) => ({ key, durationMs: 120 + Math.floor(Math.random() * 400), ok: true }));
  return Promise.resolve({
    batchId: `batch_${Date.now()}`,
    postsGenerated: args.postsCount,
    steps,
    costCents: args.postsCount * 10,
  });
}

function monthName(m: number) {
  return [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][m - 1]!;
}
