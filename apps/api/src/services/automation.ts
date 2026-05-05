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
import { buildBrandContext, brandContextToFactsBlock, brandContextToImageStyle } from './brandContext.js';

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
  const ctx = await buildBrandContext(client.id);
  const knownFacts = ctx ? brandContextToFactsBlock(ctx) : buildKnownFactsBlock(client);
  const calendar = await stage('generate_calendar', async () => {
    const imageDescs = enhancedImages
      .map((i, idx) => `[${idx}] ${i.aiDescription ?? i.fileName ?? 'photo'}`)
      .join('\n');
    const [year, mm] = args.month.split('-');
    const prompt = contentCalendarPrompt({
      businessName: client.businessName,
      industry: client.industry ?? 'Local Business',
      brandVoice: brandVoice || 'Plain, factual, no embellishment.',
      imageDescriptions: imageDescs,
      knownFacts,
      month: monthName(Number(mm)),
      year: year!,
      postsCount: args.postsCount,
      platforms,
      direction: args.direction,
    });
    return withRetry(
      () => generateJSON<Array<CalendarPost & { skip?: boolean; skipReason?: string }>>(prompt, { model: 'sonnet', maxTokens: 4096 }),
      {
        label: 'generate_calendar',
        attempts: 3,
      },
    );
  });

  // Split into kept vs skipped. Kept posts need a REAL image index; Claude
  // was told synthesis is off so any null-imageIndex kept post is an
  // instruction violation and we demote it to skipped instead of fabricating.
  const kept: CalendarPost[] = [];
  const skipped: Array<{ reason: string }> = [];
  for (const cp of calendar) {
    if (cp.skip) {
      skipped.push({ reason: cp.skipReason ?? 'no reason given' });
      continue;
    }
    if (cp.imageIndex == null || !enhancedImages[cp.imageIndex]) {
      skipped.push({ reason: 'No real image available for this post' });
      continue;
    }
    kept.push(cp);
  }

  if (skipped.length > 0) {
    console.log(
      `[generation] ${kept.length} posts kept, ${skipped.length} skipped:`,
      skipped.map((s) => s.reason).slice(0, 5).join(' | '),
    );
  }

  // 6. Run the quality gate per post, then persist (real images only)
  let rewriteCount = 0;
  let gateRejectCount = 0;
  const costCents = await stage('persist_posts', async () => {
    const [year, mm] = args.month.split('-').map(Number) as [number, number];
    const { runQualityGate } = await import('./qualityGate.js');
    const gateBrandVoice = brandVoice || 'Plain and factual, no embellishment.';

    for (const cp of kept) {
      const chosen = enhancedImages[cp.imageIndex!]!;
      const imageUrl = chosen.enhancedUrl ?? chosen.fileUrl;
      const imageId = chosen.id;
      const imageSubject = chosen.aiDescription ?? chosen.fileName ?? undefined;

      // Quality gate: may auto-rewrite up to once or reject outright.
      const gated = await runQualityGate({
        businessName: client.businessName,
        industry: client.industry ?? 'Local Business',
        brandVoice: gateBrandVoice,
        knownFacts,
        imageSubject,
        platform: cp.platform,
        draftCaption: cp.caption,
        draftHashtags: cp.hashtags ?? [],
      });

      if (gated.verdict === 'reject') {
        gateRejectCount++;
        skipped.push({
          reason: `Gate rejected: ${gated.issues.slice(0, 2).join('; ')}`,
        });
        continue;
      }
      if (gated.rewritten) rewriteCount++;

      const [h, m] = TIME_OF_DAY[cp.timeOfDay ?? 'morning']!;
      const dayOfMonth = Math.min(28, Math.max(1, cp.dayOfMonth ?? 1));
      const scheduledAt = new Date(Date.UTC(year, mm - 1, dayOfMonth, h, m));

      await db.insert(posts).values({
        clientId: client.id,
        batchId: batch.id,
        imageId,
        generatedImageUrl: imageUrl,
        caption: gated.caption,
        platform: cp.platform as any,
        hashtags: gated.hashtags ?? [],
        scheduledAt,
        status: 'pending_internal',
      });
    }
    // Per-Claude cost heuristic. Gate adds ~$0.02 per post.
    return kept.length * 12;
  });

  if (rewriteCount > 0 || gateRejectCount > 0) {
    console.log(
      `[generation] quality gate: rewrote ${rewriteCount}, rejected ${gateRejectCount}`,
    );
  }

  // Recompute kept count since the gate may have rejected some.
  const finalKept = kept.length - gateRejectCount;

  await db
    .update(contentBatches)
    .set({
      postsGenerated: finalKept,
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
      postsGenerated: finalKept,
      postsSkipped: skipped.length,
    },
  });

  // Fire notifications (don't block the response if email is down).
  notifyAgencyBatchReady({
    clientName: client.businessName,
    batchId: batch.id,
    postsGenerated: finalKept,
    costCents,
  }).catch((e) => console.warn('[notify] batch-ready email failed:', (e as Error).message));

  return {
    batchId: batch.id,
    postsGenerated: finalKept,
    postsRequested: args.postsCount,
    postsSkipped: skipped.length,
    skipReasons: skipped.map((s) => s.reason).slice(0, 10),
    steps,
    costCents,
  };
}

/**
 * Build a "safe facts" block to hand to Claude. Only fields the agency
 * has explicitly populated on the client row make it in — we never try
 * to infer "three years in business" from signup date or anything like
 * that. If a field is empty, it stays out and Claude won't see it (so
 * it can't use it as a hallucination seed).
 */
function buildKnownFactsBlock(client: typeof clients.$inferSelect): string {
  const lines: string[] = [];
  if (client.businessName) lines.push(`Business name: ${client.businessName}`);
  if (client.industry) lines.push(`Industry: ${client.industry}`);
  if (client.websiteUrl) lines.push(`Website: ${client.websiteUrl}`);

  const config = (client.websiteConfig ?? {}) as any;
  const contact = config?.contact;
  if (contact?.address) lines.push(`Address: ${contact.address}`);
  if (contact?.phone) lines.push(`Phone: ${contact.phone}`);
  if (contact?.email) lines.push(`Email: ${contact.email}`);
  if (contact?.whatsapp) lines.push(`WhatsApp: ${contact.whatsapp}`);
  if (contact?.hours) lines.push(`Hours: ${contact.hours}`);

  const services = Array.isArray(config?.services) ? config.services : [];
  if (services.length > 0) {
    lines.push(
      `Services: ${services
        .map((s: any) => s?.title)
        .filter(Boolean)
        .join(', ')}`,
    );
  }

  const teamMembers = Array.isArray(config?.team?.members) ? config.team.members : [];
  if (teamMembers.length > 0) {
    lines.push(
      `Team: ${teamMembers
        .map((m: any) => (m?.role ? `${m?.name ?? '[unnamed]'} — ${m.role}` : m?.name))
        .filter(Boolean)
        .join('; ')}`,
    );
  }

  const serviceAreas = Array.isArray(config?.serviceAreas?.areas)
    ? config.serviceAreas.areas
    : [];
  if (serviceAreas.length > 0) lines.push(`Service areas: ${serviceAreas.join(', ')}`);

  const trustBadges = Array.isArray(config?.trustBadges?.badges)
    ? config.trustBadges.badges
    : [];
  if (trustBadges.length > 0) {
    lines.push(
      `Credentials: ${trustBadges
        .map((b: any) => b?.label)
        .filter(Boolean)
        .join(', ')}`,
    );
  }

  return lines.join('\n');
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

/**
 * Regenerate a single post's caption + hashtags. Used by the Generate
 * page's per-post "regenerate" action so users don't have to re-run the
 * whole monthly pipeline to fix one bad caption.
 *
 * Optionally accepts an `instruction` — free-form feedback from the user
 * ("make it funnier", "mention the Cork opening") — which overrides
 * normal brand voice defaults while still honoring the voice guide.
 */
export async function regenerateSinglePost(args: {
  postId: string;
  instruction?: string;
}): Promise<{
  caption: string;
  hashtags: string[];
  hook: string;
  rationale: string;
  fabricatedClaimsStrippedFromOriginal?: string[];
}> {
  if (!isDbConfigured()) {
    // Mock-mode stub — intentionally vague, does not invent specifics.
    return {
      caption:
        'Reliable service when you need it. Get in touch to book a visit.',
      hashtags: ['#localservice', '#dublin', '#supportlocal'],
      hook: 'Reliable service when',
      rationale: 'Kept it factual and generic in the absence of specific inputs.',
      fabricatedClaimsStrippedFromOriginal: [],
    };
  }

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, args.postId));
  if (!post) throw new Error('Post not found');

  const [client] = await db.select().from(clients).where(eq(clients.id, post.clientId));
  if (!client) throw new Error('Client not found');

  // Look up the image subject so the rewritten caption stays relevant.
  let imageSubject: string | undefined;
  if (post.imageId) {
    const [img] = await db
      .select({ aiDescription: clientImages.aiDescription })
      .from(clientImages)
      .where(eq(clientImages.id, post.imageId));
    imageSubject = img?.aiDescription ?? undefined;
  }

  const brandCtx = await buildBrandContext(client.id);
  const knownFacts = brandCtx ? brandContextToFactsBlock(brandCtx) : buildKnownFactsBlock(client);
  const { regeneratePostPrompt } = await import('./prompts.js');
  const prompt = regeneratePostPrompt({
    businessName: client.businessName,
    industry: client.industry ?? 'Local Business',
    brandVoice: client.brandVoice ?? 'Plain and factual, no embellishment.',
    currentCaption: post.caption,
    currentHashtags: (post.hashtags as string[]) ?? [],
    platform: post.platform,
    imageSubject,
    knownFacts,
    instruction: args.instruction,
  });

  const result = await withRetry(
    () =>
      generateJSON<{
        caption: string;
        hashtags: string[];
        hook: string;
        rationale: string;
        fabricatedClaimsStrippedFromOriginal?: string[];
      }>(prompt, { model: 'sonnet', maxTokens: 800, temperature: 0.5 }),
    { label: `regen:${args.postId}`, attempts: 2 },
  );

  // Persist the updated caption + hashtags so the next read sees the rewrite.
  await db
    .update(posts)
    .set({
      caption: result.caption,
      hashtags: result.hashtags ?? [],
      updatedAt: new Date(),
    })
    .where(eq(posts.id, post.id));

  broadcast({
    type: 'post:updated',
    payload: { id: post.id, caption: result.caption, hashtags: result.hashtags },
  });

  return result;
}

/**
 * Regenerate the image for a single post. Uses the existing caption as the
 * seed for a concrete Flux prompt — no guessing about subject. Preserves
 * the post's original image as fallback in case the user doesn't like the
 * new one (stored in a transient in-memory cache is not viable, so we
 * just persist the new URL and let the client undo by reverting).
 */
export async function regeneratePostImage(args: {
  postId: string;
  overridePrompt?: string;
}): Promise<{ imageUrl: string; prompt: string }> {
  if (!isDbConfigured()) {
    return {
      imageUrl: `https://picsum.photos/seed/regen-${args.postId}/1024/1024`,
      prompt: args.overridePrompt ?? 'Mock regenerated image',
    };
  }

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, args.postId));
  if (!post) throw new Error('Post not found');

  const [client] = await db.select().from(clients).where(eq(clients.id, post.clientId));
  if (!client) throw new Error('Client not found');

  const brandCtxImg = await buildBrandContext(client.id);
  const brandStyleBits = brandCtxImg ? brandContextToImageStyle(brandCtxImg) : '';

  // Build a specific Flux prompt from the caption if the caller didn't
  // supply one. Keeps the subject aligned with what the caption says.
  const seedPrompt =
    args.overridePrompt?.trim() ||
    (await generateText(
      `Write a single-paragraph, photographic Flux prompt for a social post by "${client.businessName}" (${
        client.industry ?? 'local business'
      }). The image should illustrate this caption:\n\n"${post.caption}"\n\nRules:\n- Describe subject, setting, lighting, palette, angle.\n- Magazine-editorial feel.\n- No faces, no text, no logos.\n- Match the brand voice: ${client.brandVoice ?? 'warm, specific, grounded'}.\n${brandStyleBits ? `- Honor this brand style: ${brandStyleBits}\n` : ''}\nReturn just the prompt, no preamble.`,
      { model: 'sonnet', maxTokens: 300, temperature: 0.6 },
    ));

  const styledPrompt = brandStyleBits ? `${seedPrompt} — ${brandStyleBits}` : seedPrompt;

  const imageUrl = await withRetry(() => generateImage(styledPrompt, '1:1'), {
    label: `regen-image:${args.postId}`,
    attempts: 2,
  });

  await db
    .update(posts)
    .set({ generatedImageUrl: imageUrl, imageId: null, updatedAt: new Date() })
    .where(eq(posts.id, args.postId));

  broadcast({
    type: 'post:updated',
    payload: { id: args.postId, generatedImageUrl: imageUrl },
  });

  return { imageUrl, prompt: seedPrompt };
}
