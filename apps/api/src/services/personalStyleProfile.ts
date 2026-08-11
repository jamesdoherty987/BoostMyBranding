/**
 * Once-per-account visual "style profile" distilled from inspiration /
 * style_reference library stills.
 *
 * Flow:
 *   inspiration images → Gemini Flash-Lite (vision→text) → cached profile
 *   → injected into every Personal AI still prompt (e.g. FLUX.2 Klein)
 *
 * Rebuilds only when the inspiration set changes (URL / role / description hash).
 */

import { createHash } from 'node:crypto';
import {
  getDb,
  isDbConfigured,
  personalAccounts,
  personalAccountMedia,
  type PersonalAccountStyleBible,
  type PersonalAiStyleProfile,
} from '@boost/database';
import { and, desc, eq } from 'drizzle-orm';
import { features } from '../env.js';
import { analyzeInspiration } from './inspirationAnalysis.js';
import { resolvePersonalInspirationImageUrls } from './personalInspirationRefs.js';

const STYLE_ROLES = new Set(['inspiration', 'style_reference']);

/** Deduplicate concurrent ensure() calls for the same account. */
const ensureInflight = new Map<
  string,
  Promise<{
    profile: PersonalAiStyleProfile | null;
    hint?: string;
    block?: string;
    rebuilt: boolean;
  }>
>();

function geminiStyleModelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_STYLE_PROFILE_MODEL?.trim();
  const primary = fromEnv || 'gemini-3.5-flash-lite';
  const fallbacks = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

type InspirationRow = {
  id: string;
  fileUrl: string;
  role: string;
  description: string | null;
  aiDescription: string | null;
  isArchived: boolean;
  mimeType: string | null;
};

/** Stable hash of the inspiration set that feeds the profile. */
export function hashInspirationSources(rows: InspirationRow[]): string {
  const lines = rows
    .filter((r) => STYLE_ROLES.has(r.role) && !r.isArchived)
    .map((r) =>
      [
        r.id,
        r.role,
        (r.fileUrl ?? '').trim(),
        (r.description ?? '').trim(),
        (r.aiDescription ?? '').trim(),
      ].join('|'),
    )
    .sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 32);
}

function legacyHintFromRows(rows: InspirationRow[]): string | undefined {
  const text = rows
    .filter((r) => STYLE_ROLES.has(r.role) && !r.isArchived)
    .slice(0, 4)
    .map((r) => r.description ?? r.aiDescription ?? '')
    .filter((s) => s.length > 0)
    .join('; ')
    .slice(0, 520);
  return text || undefined;
}

function legacyBlockFromRows(rows: InspirationRow[]): string | undefined {
  const filtered = rows.filter((r) => STYLE_ROLES.has(r.role) && !r.isArchived).slice(0, 8);
  if (filtered.length === 0) return undefined;
  return filtered
    .map((r, i) => {
      const desc = r.description ?? r.aiDescription ?? 'reference still or clip';
      return `[${i + 1}] ${desc}`;
    })
    .join('\n');
}

async function fetchImageAsInlinePart(
  url: string,
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 64 || buf.length > 8_000_000) return null;
      const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
      return {
        inlineData: {
          mimeType: mime.startsWith('image/') ? mime : 'image/jpeg',
          data: buf.toString('base64'),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

function parseStyleJson(raw: string): Record<string, string> | null {
  const cleaned = raw.replace(/^```(?:json)?\s*|```$/gi, '').trim();
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned) as Record<string, string>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, string>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Gemini Flash-Lite vision → structured style profile text.
 * Cheap text/vision call — not image generation.
 */
async function distillWithGemini(imageUrls: string[]): Promise<{
  text: string;
  block: string;
  modelId: string;
} | null> {
  if (!hasGemini() || imageUrls.length === 0) return null;

  const parts: Array<Record<string, unknown>> = [
    {
      text: [
        'You are a creative director. Analyse these reference images and distill a reusable VISUAL STYLE PROFILE for an AI image generator.',
        'Describe LOOK only (palette, lighting, contrast, grain/texture, lens character, composition habits, typography personality if any text appears).',
        'Do NOT describe specific subjects, people, products, or story topics that appear — those must not leak into later episodes.',
        'Return ONLY valid JSON:',
        '{',
        '  "style": "one-line style summary",',
        '  "mood": "emotional register",',
        '  "palette": "colours / contrast as short phrase",',
        '  "lighting": "lighting recipe",',
        '  "lensAndTexture": "lens, grain, codec, finish",',
        '  "composition": "framing habits",',
        '  "typography": "lettering personality if any, else none",',
        '  "promptLock": "80-160 word paragraph an image model can paste as a style lock — concrete visual language, no subject nouns from the refs"',
        '}',
      ].join('\n'),
    },
  ];

  for (const url of imageUrls.slice(0, 6)) {
    const part = await fetchImageAsInlinePart(url);
    if (part) parts.push(part);
  }
  if (parts.length < 2) return null;

  for (const modelId of geminiStyleModelCandidates()) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': process.env.GEMINI_API_KEY!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(
          `[style-profile] Gemini ${modelId} failed (${res.status}): ${errText.slice(0, 200)}`,
        );
        continue;
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const raw =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
      const parsed = parseStyleJson(raw);
      if (!parsed) {
        console.warn(`[style-profile] Gemini ${modelId} returned non-JSON`);
        continue;
      }

      const promptLock = String(parsed.promptLock ?? '').trim();
      const style = String(parsed.style ?? '').trim();
      if (!promptLock && !style) continue;

      const text = (promptLock || style).slice(0, 700);
      const block = [
        style && `Style: ${style}`,
        parsed.mood && `Mood: ${parsed.mood}`,
        parsed.palette && `Palette: ${parsed.palette}`,
        parsed.lighting && `Lighting: ${parsed.lighting}`,
        parsed.lensAndTexture && `Lens/texture: ${parsed.lensAndTexture}`,
        parsed.composition && `Composition: ${parsed.composition}`,
        parsed.typography && parsed.typography !== 'none' && `Typography: ${parsed.typography}`,
        promptLock && `Prompt lock: ${promptLock}`,
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 1600);

      return { text, block, modelId };
    } catch (e) {
      console.warn(
        `[style-profile] Gemini ${modelId} error:`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return null;
}

async function distillWithClaude(imageUrls: string[]): Promise<{
  text: string;
  block: string;
  modelId: string;
} | null> {
  if (!features.claude || imageUrls.length === 0) return null;
  try {
    const analysis = await analyzeInspiration(
      imageUrls.slice(0, 6).map((url, i) => ({
        id: `insp-${i}`,
        url,
        mimeType: 'image/jpeg',
        label: `inspiration ${i + 1}`,
      })),
      'Distill LOOK only (palette, lighting, grain, lens, composition). Do not carry over specific subjects into the style lock.',
    );
    // Ignore deterministic mocks in production-shaped paths — they poison the cache.
    if (analysis.fromMock) return null;

    const text = [
      analysis.style,
      analysis.mood,
      analysis.composition,
      analysis.colorPalette?.length ? `palette: ${analysis.colorPalette.join(', ')}` : '',
      analysis.suggestedPrompt?.slice(0, 280),
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 700);
    if (!text) return null;
    const block = [
      `Style: ${analysis.style}`,
      `Mood: ${analysis.mood}`,
      `Composition: ${analysis.composition}`,
      analysis.colorPalette?.length ? `Palette: ${analysis.colorPalette.join(', ')}` : '',
      `Prompt lock: ${analysis.suggestedPrompt}`,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1600);
    return { text, block, modelId: 'claude-vision' };
  } catch (e) {
    console.warn('[style-profile] Claude distill failed:', (e as Error).message);
    return null;
  }
}

async function persistProfile(
  accountId: string,
  profile: PersonalAiStyleProfile | null,
): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  const [row] = await db
    .select({ styleBible: personalAccounts.styleBible })
    .from(personalAccounts)
    .where(eq(personalAccounts.id, accountId))
    .limit(1);
  if (!row) return;
  const bible: PersonalAccountStyleBible = {
    ...((row.styleBible as PersonalAccountStyleBible) ?? {}),
  };
  if (profile) bible.aiStyleProfile = profile;
  else delete bible.aiStyleProfile;
  await db
    .update(personalAccounts)
    .set({ styleBible: bible, updatedAt: new Date() })
    .where(eq(personalAccounts.id, accountId));
}

/** Clear cached profile so the next ensure rebuilds (inspiration set changed). */
export async function invalidatePersonalStyleProfile(accountId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  const [row] = await db
    .select({ styleBible: personalAccounts.styleBible })
    .from(personalAccounts)
    .where(eq(personalAccounts.id, accountId))
    .limit(1);
  if (!row?.styleBible) return;
  const bible = { ...(row.styleBible as PersonalAccountStyleBible) };
  if (!bible.aiStyleProfile) return;
  delete bible.aiStyleProfile;
  await db
    .update(personalAccounts)
    .set({ styleBible: bible, updatedAt: new Date() })
    .where(eq(personalAccounts.id, accountId));
}

async function ensurePersonalStyleProfileInner(accountId: string): Promise<{
  profile: PersonalAiStyleProfile | null;
  hint?: string;
  block?: string;
  rebuilt: boolean;
}> {
  if (!isDbConfigured()) {
    return { profile: null, rebuilt: false };
  }

  const db = getDb();
  const [account] = await db
    .select({ styleBible: personalAccounts.styleBible })
    .from(personalAccounts)
    .where(eq(personalAccounts.id, accountId))
    .limit(1);
  if (!account) return { profile: null, rebuilt: false };

  const media = await db
    .select()
    .from(personalAccountMedia)
    .where(
      and(
        eq(personalAccountMedia.accountId, accountId),
        eq(personalAccountMedia.isArchived, false),
      ),
    )
    .orderBy(desc(personalAccountMedia.isPinned), desc(personalAccountMedia.updatedAt))
    .limit(24);
  const inspirationRows = media.filter((m) => STYLE_ROLES.has(m.role)) as InspirationRow[];

  if (inspirationRows.length === 0) {
    // Drop stale cache when all inspiration is gone.
    if ((account.styleBible as PersonalAccountStyleBible | null)?.aiStyleProfile) {
      await persistProfile(accountId, null);
    }
    return { profile: null, rebuilt: false };
  }

  const sourceHash = hashInspirationSources(inspirationRows);
  const bible = (account.styleBible as PersonalAccountStyleBible) ?? {};
  const cached = bible.aiStyleProfile;
  if (
    cached?.sourceHash === sourceHash &&
    typeof cached.text === 'string' &&
    cached.text.trim().length > 0
  ) {
    return {
      profile: cached,
      hint: cached.text.slice(0, 520),
      block: (cached.block ?? cached.text).slice(0, 1600),
      rebuilt: false,
    };
  }

  const imageUrls = await resolvePersonalInspirationImageUrls(
    accountId,
    media.filter((m) => STYLE_ROLES.has(m.role)),
  );
  let distilled =
    (await distillWithGemini(imageUrls)) ?? (await distillWithClaude(imageUrls));

  if (!distilled) {
    const hint = legacyHintFromRows(inspirationRows);
    const block = legacyBlockFromRows(inspirationRows);
    if (!hint && !block) return { profile: null, rebuilt: false };
    distilled = {
      text: (hint ?? block ?? '').slice(0, 700),
      block: (block ?? hint ?? '').slice(0, 1600),
      modelId: 'legacy-concat',
    };
  }

  const profile: PersonalAiStyleProfile = {
    text: distilled.text,
    block: distilled.block,
    sourceHash,
    generatedAt: new Date().toISOString(),
    modelId: distilled.modelId,
  };
  await persistProfile(accountId, profile);
  console.info(
    `[style-profile] account=${accountId.slice(0, 8)}… rebuilt via ${profile.modelId} (${imageUrls.length} stills)`,
  );

  return {
    profile,
    hint: profile.text.slice(0, 520),
    block: (profile.block ?? profile.text).slice(0, 1600),
    rebuilt: true,
  };
}

/**
 * Ensure the account has a fresh style profile for its inspiration set.
 * Cheap: one vision pass when hash misses; otherwise returns cache.
 */
export async function ensurePersonalStyleProfile(accountId: string): Promise<{
  profile: PersonalAiStyleProfile | null;
  hint?: string;
  block?: string;
  rebuilt: boolean;
}> {
  const existing = ensureInflight.get(accountId);
  if (existing) return existing;
  const pending = ensurePersonalStyleProfileInner(accountId).finally(() => {
    ensureInflight.delete(accountId);
  });
  ensureInflight.set(accountId, pending);
  return pending;
}
