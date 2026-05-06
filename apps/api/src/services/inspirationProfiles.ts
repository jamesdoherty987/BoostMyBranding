/**
 * Inspiration profile service.
 *
 * A client can maintain a library of named "brands I admire" profiles
 * — each sourced from a reference URL — that the AI factors into every
 * generation. This is the core of the Holo-style "point at a brand
 * you love, get on-brand content in its visual language" workflow.
 *
 * IMPORTANT — trademark safety:
 *   We analyse *style*, not trademarks. Generations must never
 *   reproduce a reference brand's logo, name, or protected imagery
 *   verbatim. Prompts emit explicit "no trademarks, no brand names,
 *   no identifiable storefronts" guards whenever an inspiration
 *   profile is included.
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  inspirationProfiles,
  inspirationProfileMedia,
  clients,
} from '@boost/database';
import { scrapeWebsite, fetchOgImage } from './scraper.js';
import { generateJSON } from './claude.js';
import { features } from '../env.js';

/* ═══════════════════════════════════════════════════════════════════ */
/* Types                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export interface VisualAnalysis {
  style: string;
  mood: string;
  composition: string;
  typographyNotes: string;
  visualMotifs: string[];
}

export interface CopyVoice {
  toneDescriptors: string[];
  sentenceShape: string;
  vocabulary: string[];
  thingsToDo: string[];
  thingsToAvoid: string[];
}

export interface InspirationProfilePayload {
  id: string;
  clientId: string;
  name: string;
  referenceUrl: string | null;
  logoUrl: string | null;
  description: string | null;
  isEnabled: boolean;
  visualAnalysis: VisualAnalysis | null;
  copyVoice: CopyVoice | null;
  colorPalette: string[] | null;
  copySamples: string[] | null;
  status: 'idle' | 'scraping' | 'ready' | 'failed';
  scrapeError: string | null;
  lastScrapedAt: Date | null;
  media: Array<{
    id: string;
    fileUrl: string;
    fileName: string | null;
    mimeType: string | null;
    source: string;
    aiDescription: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* CRUD                                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

export async function listProfiles(clientId: string): Promise<InspirationProfilePayload[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(inspirationProfiles)
    .where(eq(inspirationProfiles.clientId, clientId))
    .orderBy(desc(inspirationProfiles.updatedAt));

  if (rows.length === 0) return [];

  const mediaRows = await db
    .select()
    .from(inspirationProfileMedia)
    .where(
      inArray(
        inspirationProfileMedia.profileId,
        rows.map((r) => r.id),
      ),
    );

  return rows.map((r) => toPayload(r, mediaRows.filter((m) => m.profileId === r.id)));
}

export async function getProfile(
  clientId: string,
  profileId: string,
): Promise<InspirationProfilePayload | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(inspirationProfiles)
    .where(and(eq(inspirationProfiles.id, profileId), eq(inspirationProfiles.clientId, clientId)));
  if (!row) return null;
  const mediaRows = await db
    .select()
    .from(inspirationProfileMedia)
    .where(eq(inspirationProfileMedia.profileId, profileId));
  return toPayload(row, mediaRows);
}

export interface CreateProfileArgs {
  clientId: string;
  name: string;
  referenceUrl?: string;
  description?: string;
}

export async function createProfile(args: CreateProfileArgs): Promise<InspirationProfilePayload> {
  if (!isDbConfigured()) {
    throw new Error('Database not configured');
  }
  const db = getDb();
  // Verify the client exists so we don't orphan rows.
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, args.clientId));
  if (!client) throw new Error('Client not found');

  const [row] = await db
    .insert(inspirationProfiles)
    .values({
      clientId: args.clientId,
      name: args.name.trim().slice(0, 200),
      referenceUrl: args.referenceUrl?.trim() || null,
      description: args.description?.trim() || null,
      status: args.referenceUrl ? 'idle' : 'ready',
    })
    .returning();

  return toPayload(row!, []);
}

export interface UpdateProfileArgs {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  referenceUrl?: string | null;
}

export async function updateProfile(
  clientId: string,
  profileId: string,
  patch: UpdateProfileArgs,
): Promise<InspirationProfilePayload | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .update(inspirationProfiles)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 200) } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() || null }
        : {}),
      ...(patch.isEnabled !== undefined ? { isEnabled: patch.isEnabled } : {}),
      ...(patch.referenceUrl !== undefined
        ? { referenceUrl: patch.referenceUrl?.trim() || null }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inspirationProfiles.id, profileId),
        eq(inspirationProfiles.clientId, clientId),
      ),
    )
    .returning();
  if (!row) return null;
  const mediaRows = await db
    .select()
    .from(inspirationProfileMedia)
    .where(eq(inspirationProfileMedia.profileId, profileId));
  return toPayload(row, mediaRows);
}

export async function deleteProfile(clientId: string, profileId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const deleted = await db
    .delete(inspirationProfiles)
    .where(
      and(
        eq(inspirationProfiles.id, profileId),
        eq(inspirationProfiles.clientId, clientId),
      ),
    )
    .returning({ id: inspirationProfiles.id });
  return deleted.length > 0;
}

export async function addMediaToProfile(args: {
  clientId: string;
  profileId: string;
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
  source: 'upload' | 'scrape';
  aiDescription?: string;
}): Promise<{ id: string } | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  // Scope check.
  const [profile] = await db
    .select({ id: inspirationProfiles.id })
    .from(inspirationProfiles)
    .where(
      and(
        eq(inspirationProfiles.id, args.profileId),
        eq(inspirationProfiles.clientId, args.clientId),
      ),
    );
  if (!profile) return null;
  const [row] = await db
    .insert(inspirationProfileMedia)
    .values({
      profileId: args.profileId,
      fileUrl: args.fileUrl,
      fileName: args.fileName ?? null,
      mimeType: args.mimeType ?? null,
      source: args.source,
      aiDescription: args.aiDescription ?? null,
    })
    .returning({ id: inspirationProfileMedia.id });
  return row ? { id: row.id } : null;
}

export async function removeMediaFromProfile(args: {
  clientId: string;
  profileId: string;
  mediaId: string;
}): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  // Scope check via join.
  const [profile] = await db
    .select({ id: inspirationProfiles.id })
    .from(inspirationProfiles)
    .where(
      and(
        eq(inspirationProfiles.id, args.profileId),
        eq(inspirationProfiles.clientId, args.clientId),
      ),
    );
  if (!profile) return false;
  const deleted = await db
    .delete(inspirationProfileMedia)
    .where(
      and(
        eq(inspirationProfileMedia.id, args.mediaId),
        eq(inspirationProfileMedia.profileId, args.profileId),
      ),
    )
    .returning({ id: inspirationProfileMedia.id });
  return deleted.length > 0;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Scraping + analysis                                                  */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Scrape a reference URL and populate the profile's visual/copy
 * analysis + colour palette + copy samples. Synchronous — callers
 * should show a "scraping…" state in the UI while this runs.
 *
 * Safe to re-run: marks the row as `scraping` first, then flips to
 * `ready` or `failed` at the end.
 */
export async function scrapeAndAnalyse(args: {
  clientId: string;
  profileId: string;
}): Promise<InspirationProfilePayload | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();

  const [profile] = await db
    .select()
    .from(inspirationProfiles)
    .where(
      and(
        eq(inspirationProfiles.id, args.profileId),
        eq(inspirationProfiles.clientId, args.clientId),
      ),
    );
  if (!profile) return null;

  const refUrl = profile.referenceUrl?.trim();
  if (!refUrl) {
    await db
      .update(inspirationProfiles)
      .set({
        status: 'failed',
        scrapeError: 'No reference URL set on this profile.',
        updatedAt: new Date(),
      })
      .where(eq(inspirationProfiles.id, profile.id));
    return getProfile(args.clientId, args.profileId);
  }

  // Flip to scraping so the UI can show a spinner.
  await db
    .update(inspirationProfiles)
    .set({ status: 'scraping', scrapeError: null, updatedAt: new Date() })
    .where(eq(inspirationProfiles.id, profile.id));

  try {
    const markdown = await scrapeWebsite(refUrl);
    if (!markdown || markdown.length < 40) {
      throw new Error(
        'Could not fetch enough content from the reference URL. Site may block scrapers.',
      );
    }

    // Try to grab a single og:image so the profile card has a hero
    // thumbnail. Best-effort only — a failure here shouldn't abort
    // the whole analysis.
    const logoUrl = await fetchOgImage(refUrl).catch(() => null);

    const analysis = await analyseScrapedContent({
      url: refUrl,
      content: markdown,
    });

    await db
      .update(inspirationProfiles)
      .set({
        visualAnalysis: analysis.visualAnalysis,
        copyVoice: analysis.copyVoice,
        colorPalette: analysis.colorPalette,
        copySamples: analysis.copySamples,
        logoUrl: logoUrl ?? profile.logoUrl,
        status: 'ready',
        scrapeError: null,
        lastScrapedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inspirationProfiles.id, profile.id));

    // Auto-attach the og:image as a reference media item so the image
    // generator has at least one real visual to work with. We only do
    // this on first successful scrape to avoid duplicating on re-scrape.
    const existingScraped = await db
      .select({ id: inspirationProfileMedia.id })
      .from(inspirationProfileMedia)
      .where(
        and(
          eq(inspirationProfileMedia.profileId, profile.id),
          eq(inspirationProfileMedia.source, 'scrape'),
        ),
      );
    if (logoUrl && existingScraped.length === 0) {
      await db.insert(inspirationProfileMedia).values({
        profileId: profile.id,
        fileUrl: logoUrl,
        mimeType: 'image/jpeg',
        source: 'scrape',
        aiDescription: `Open Graph image from ${refUrl}`,
      });
    }

    return getProfile(args.clientId, args.profileId);
  } catch (e) {
    const msg = (e as Error).message ?? 'Scrape failed';
    await db
      .update(inspirationProfiles)
      .set({
        status: 'failed',
        scrapeError: msg.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(inspirationProfiles.id, profile.id));
    return getProfile(args.clientId, args.profileId);
  }
}

interface ScrapeAnalysisResult {
  visualAnalysis: VisualAnalysis;
  copyVoice: CopyVoice;
  colorPalette: string[];
  copySamples: string[];
}

/**
 * Send the scraped markdown to Claude and extract the structured
 * brand profile. Deterministic mock when Claude is not configured.
 */
async function analyseScrapedContent(args: {
  url: string;
  content: string;
}): Promise<ScrapeAnalysisResult> {
  if (!features.claude) {
    return mockAnalysis(args.url);
  }

  const directive = [
    `You are a senior brand strategist analysing a reference brand so another`,
    `company can create content in a similar style (without copying trademarks).`,
    '',
    `Reference URL: ${args.url}`,
    '',
    `Scraped content (may include HTML noise — ignore boilerplate):`,
    '```',
    args.content.slice(0, 12000),
    '```',
    '',
    `Return ONLY valid JSON matching this schema:`,
    `{`,
    `  "visualAnalysis": {`,
    `    "style": "one-line style summary",`,
    `    "mood": "one-line emotional register",`,
    `    "composition": "how their visuals are typically composed",`,
    `    "typographyNotes": "font feel, sizes, hierarchy",`,
    `    "visualMotifs": ["specific recurring visual elements, 3-6 items"]`,
    `  },`,
    `  "copyVoice": {`,
    `    "toneDescriptors": ["3-6 tone adjectives like warm, authoritative, playful"],`,
    `    "sentenceShape": "typical sentence length and rhythm",`,
    `    "vocabulary": ["characteristic words they use, 5-10 items"],`,
    `    "thingsToDo": ["2-4 instructions for writing in this voice"],`,
    `    "thingsToAvoid": ["2-4 things to avoid that break this voice"]`,
    `  },`,
    `  "colorPalette": ["3-6 hex colors or descriptive color names"],`,
    `  "copySamples": ["3-6 short verbatim copy snippets lifted from the content"]`,
    `}`,
    '',
    `Do NOT invent facts. Only describe what the content actually shows.`,
    `Do NOT include the brand's name, trademarks, or logos in visualMotifs.`,
  ].join('\n');

  try {
    const parsed = await generateJSON<ScrapeAnalysisResult>(directive, {
      model: 'sonnet',
      maxTokens: 2000,
      temperature: 0.4,
    });
    // Defensive: normalise missing fields.
    return {
      visualAnalysis: {
        style: parsed.visualAnalysis?.style ?? 'editorial, modern',
        mood: parsed.visualAnalysis?.mood ?? 'neutral',
        composition: parsed.visualAnalysis?.composition ?? 'balanced',
        typographyNotes: parsed.visualAnalysis?.typographyNotes ?? '',
        visualMotifs: Array.isArray(parsed.visualAnalysis?.visualMotifs)
          ? parsed.visualAnalysis.visualMotifs.slice(0, 8)
          : [],
      },
      copyVoice: {
        toneDescriptors: Array.isArray(parsed.copyVoice?.toneDescriptors)
          ? parsed.copyVoice.toneDescriptors.slice(0, 8)
          : [],
        sentenceShape: parsed.copyVoice?.sentenceShape ?? '',
        vocabulary: Array.isArray(parsed.copyVoice?.vocabulary)
          ? parsed.copyVoice.vocabulary.slice(0, 15)
          : [],
        thingsToDo: Array.isArray(parsed.copyVoice?.thingsToDo)
          ? parsed.copyVoice.thingsToDo.slice(0, 6)
          : [],
        thingsToAvoid: Array.isArray(parsed.copyVoice?.thingsToAvoid)
          ? parsed.copyVoice.thingsToAvoid.slice(0, 6)
          : [],
      },
      colorPalette: Array.isArray(parsed.colorPalette) ? parsed.colorPalette.slice(0, 8) : [],
      copySamples: Array.isArray(parsed.copySamples) ? parsed.copySamples.slice(0, 8) : [],
    };
  } catch (e) {
    console.warn('[inspiration-profiles] Claude failed, using mock:', (e as Error).message);
    return mockAnalysis(args.url);
  }
}

function mockAnalysis(url: string): ScrapeAnalysisResult {
  return {
    visualAnalysis: {
      style: 'editorial, confident, product-focused',
      mood: 'aspirational, warm',
      composition: 'large imagery, plenty of white space, bold captions',
      typographyNotes: 'serif display faces for headers, sans for body',
      visualMotifs: ['close-up product shots', 'soft natural light', 'human hands in frame'],
    },
    copyVoice: {
      toneDescriptors: ['warm', 'confident', 'direct'],
      sentenceShape: 'short sentences, frequent sentence fragments for emphasis',
      vocabulary: ['crafted', 'authentic', 'considered', 'everyday'],
      thingsToDo: ['lead with a benefit', 'use sensory verbs', 'end with an invitation'],
      thingsToAvoid: ['corporate jargon', 'superlatives like best-ever'],
    },
    colorPalette: ['#1F2937', '#F5EFE7', '#C45F1A'],
    copySamples: [
      `Mock sample — connect ANTHROPIC_API_KEY to get real analysis of ${url}.`,
      'We make it for the way you actually live.',
      'Small changes, made with care.',
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Mapping                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

function toPayload(
  row: typeof inspirationProfiles.$inferSelect,
  mediaRows: Array<typeof inspirationProfileMedia.$inferSelect>,
): InspirationProfilePayload {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    referenceUrl: row.referenceUrl,
    logoUrl: row.logoUrl,
    description: row.description,
    isEnabled: row.isEnabled,
    visualAnalysis: (row.visualAnalysis as VisualAnalysis | null) ?? null,
    copyVoice: (row.copyVoice as CopyVoice | null) ?? null,
    colorPalette: (row.colorPalette as string[] | null) ?? null,
    copySamples: (row.copySamples as string[] | null) ?? null,
    status: row.status as InspirationProfilePayload['status'],
    scrapeError: row.scrapeError,
    lastScrapedAt: row.lastScrapedAt,
    media: mediaRows.map((m) => ({
      id: m.id,
      fileUrl: m.fileUrl,
      fileName: m.fileName,
      mimeType: m.mimeType,
      source: m.source,
      aiDescription: m.aiDescription,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Prompt integration                                                   */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Format selected inspiration profiles into a Claude-friendly block
 * suitable for injection into caption/image/video prompts. The block
 * always ends with an explicit trademark-safety guard.
 */
export function profilesToPromptBlock(
  profiles: InspirationProfilePayload[],
): string {
  const enabled = profiles.filter((p) => p.isEnabled);
  if (enabled.length === 0) return '';

  const lines: string[] = [];
  lines.push('Inspiration profiles this brand admires (use their STYLE, not their identity):');
  for (const p of enabled) {
    lines.push(`\n— ${p.name}${p.referenceUrl ? ` (${p.referenceUrl})` : ''}`);
    if (p.description) lines.push(`  note: ${p.description}`);
    if (p.visualAnalysis) {
      const v = p.visualAnalysis;
      lines.push(`  visual style: ${v.style}; mood: ${v.mood}; composition: ${v.composition}`);
      if (v.visualMotifs.length) lines.push(`  visual motifs: ${v.visualMotifs.join(', ')}`);
      if (v.typographyNotes) lines.push(`  typography: ${v.typographyNotes}`);
    }
    if (p.copyVoice) {
      const c = p.copyVoice;
      if (c.toneDescriptors.length) lines.push(`  tone: ${c.toneDescriptors.join(', ')}`);
      if (c.sentenceShape) lines.push(`  sentence shape: ${c.sentenceShape}`);
      if (c.vocabulary.length) lines.push(`  characteristic words: ${c.vocabulary.join(', ')}`);
      if (c.thingsToDo.length) lines.push(`  do: ${c.thingsToDo.join(' · ')}`);
      if (c.thingsToAvoid.length) lines.push(`  avoid: ${c.thingsToAvoid.join(' · ')}`);
    }
    if (p.colorPalette && p.colorPalette.length) {
      lines.push(`  palette (reference only — defer to client palette): ${p.colorPalette.join(' · ')}`);
    }
    if (p.copySamples && p.copySamples.length) {
      lines.push(`  copy samples from ${p.name}:`);
      for (const s of p.copySamples.slice(0, 3)) {
        lines.push(`    "${s.replace(/"/g, "'").slice(0, 180)}"`);
      }
    }
  }

  lines.push('');
  lines.push(
    'TRADEMARK SAFETY — MUST FOLLOW:',
  );
  lines.push(
    '• Never reproduce the reference brands\' names, logos, trademarks, or identifiable storefronts.',
  );
  lines.push(
    '• Never claim partnership, endorsement, or similarity to the reference brand.',
  );
  lines.push(
    '• Extract STYLE only — apply it to the client\'s own products and identity.',
  );
  return lines.join('\n');
}

/**
 * One-line image-generation style hint derived from enabled profiles.
 * Safe to append to a Flux/Kontext prompt without overwhelming the
 * base brand palette.
 */
export function profilesToImageStyleHint(
  profiles: InspirationProfilePayload[],
): string {
  const enabled = profiles.filter((p) => p.isEnabled && p.visualAnalysis);
  if (enabled.length === 0) return '';
  const parts: string[] = [];
  for (const p of enabled.slice(0, 3)) {
    const v = p.visualAnalysis!;
    const bits = [v.style, v.mood, v.composition].filter(Boolean).map((s) => s.toLowerCase());
    if (bits.length) parts.push(bits.join(', '));
  }
  if (parts.length === 0) return '';
  return `inspired by visual style of: ${parts.join('; ')}. No reference-brand logos, names, or trademarks.`;
}
