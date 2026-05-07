/**
 * AI hero image generator. Produces a single high-quality, business-specific
 * illustration or photo to use behind the hero when no client image is
 * suitable. Claude writes the visual prompt; fal.ai renders it.
 *
 * Pipeline:
 *   1. Ask Claude for a tight, specific image prompt based on the business.
 *   2. Render via fal.ai (flux-pro/v1.1-ultra) at a tall aspect ratio so it
 *      fits the hero tile cleanly.
 *   3. Persist the resulting URL to the client's website config so the
 *      public renderer uses it automatically on next view.
 *
 * Cost/rate: one fal.ai call per generation. Intended to run once at site
 * generation time, and manually when the agency wants to reroll.
 */

import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clients } from '@boost/database';
import type { WebsiteConfig } from '@boost/core';
import { generateText } from './claude.js';
import { generateImage } from './fal.js';
import { withRetry } from './retry.js';
import { features } from '../env.js';

export interface GenerateHeroImageArgs {
  clientId: string;
  /** Business name — used in the Claude prompt for specificity. */
  businessName: string;
  /** Industry keyword, e.g. "coffee shop", "plumbing". */
  industry: string;
  /** Free-form description of the business (brand voice, audience, vibe). */
  description?: string;
  /**
   * Override prompt. If provided, we skip the Claude step and pass this
   * straight to fal.ai. Lets the agency hand-tune the image when they
   * want a specific result.
   */
  overridePrompt?: string;
  /**
   * Which hero variant this image will appear in. Affects what the image
   * should look like (e.g. parallax-layers wants a tall photo, spotlight
   * wants something soft enough to blur behind copy).
   */
  heroVariant?: string;
}

export interface GenerateHeroImageResult {
  imageUrl: string;
  prompt: string;
  fromMock: boolean;
}

/**
 * Generate + persist a hero image for the client. Returns the URL and the
 * prompt used (so the dashboard can show it and let the agency tweak).
 */
export async function generateHeroImage(
  args: GenerateHeroImageArgs,
): Promise<GenerateHeroImageResult> {
  const prompt = args.overridePrompt ?? (await generateHeroPrompt(args));

  // fal.ai call. Tall aspect (4:5) suits parallax-layers tile; spotlight/
  // beams variants blur it anyway so the ratio still reads well.
  const imageUrl = await withRetry(() => generateImage(prompt, '4:5'), {
    label: `hero_image:${args.clientId}`,
    attempts: 2,
  });

  // Persist onto the client's website config so the public renderer picks
  // it up on next view. We do a shallow merge rather than overwriting the
  // whole config — callers may only want to refresh the image.
  if (isDbConfigured()) {
    const db = getDb();
    const [row] = await db
      .select({ websiteConfig: clients.websiteConfig })
      .from(clients)
      .where(eq(clients.id, args.clientId));
    const current = (row?.websiteConfig ?? {}) as Partial<WebsiteConfig>;
    const next: Partial<WebsiteConfig> = {
      ...current,
      hero: {
        ...(current.hero ?? { headline: '', subheadline: '', imageIndex: null, ctaPrimary: { label: '', href: '' } }),
        aiImageUrl: imageUrl,
        aiImagePrompt: prompt,
      } as WebsiteConfig['hero'],
    };
    await db
      .update(clients)
      .set({ websiteConfig: next as any })
      .where(eq(clients.id, args.clientId));
  }

  return {
    imageUrl,
    prompt,
    fromMock: !features.fal,
  };
}

/**
 * Ask Claude to write an image-generation prompt tuned to the business.
 * Short, concrete, and rich in visual specifics — not marketing copy.
 */
async function generateHeroPrompt(args: GenerateHeroImageArgs): Promise<string> {
  if (!features.claude) {
    // Deterministic fallback so dev mode still produces *something* useful
    // when no Claude key is configured.
    return `A professional, minimal photograph representing a ${args.industry} business. Warm natural light, shallow depth of field, muted palette. No text. No logo. High quality, editorial.`;
  }

  const instruction = `You are a visual art director. Write ONE image-generation prompt for a marketing website hero image.

BUSINESS: ${args.businessName}
INDUSTRY: ${args.industry}
${args.description ? `DESCRIPTION: ${args.description}\n` : ''}${args.heroVariant ? `WILL APPEAR IN VARIANT: ${args.heroVariant}\n` : ''}

CONSTRAINTS:
- Describe a SPECIFIC scene, not a generic stock-photo concept.
- Include: subject, lighting, composition, mood, palette hints.
- No text, no logos, no people's faces (to avoid uncanny-valley portraits).
- Favor photography or premium editorial illustration — NOT clip-art.
- Aspect ratio will be 4:5 (tall portrait).
- Max 60 words. No preamble. Output the prompt only.

EXAMPLE for a coffee shop: "A flat-lay of freshly roasted coffee beans spilling from a linen bag onto a dark walnut counter, single beam of warm morning light from the left, shallow depth of field, muted earth tones with a hint of amber glow, minimal editorial style, high resolution."

Now write the prompt for ${args.businessName}.`;

  const prompt = await generateText(instruction, {
    model: 'sonnet',
    maxTokens: 200,
    temperature: 0.8,
  });

  // Defensive trim — occasionally models prepend "Prompt:" or wrap in quotes.
  return prompt
    .replace(/^(prompt|image prompt)\s*:\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}


/* ═══════════════════════════════════════════════════════════════════ */
/* Hero illustration generator — the SVG-like "prop" next to the hero  */
/* ═══════════════════════════════════════════════════════════════════ */

export interface GenerateHeroIllustrationArgs {
  clientId: string;
  businessName: string;
  industry: string;
  /** Free-text brief from the agency. Drives the look. */
  brief: string;
  /**
   * Brand palette so the generated illustration picks up the site's
   * colours rather than a random mid-grey. Passed verbatim into the
   * image prompt as "brand colours: #..." hints.
   */
  primaryColor?: string;
  accentColor?: string;
}

export interface GenerateHeroIllustrationResult {
  imageUrl: string;
  prompt: string;
  fromMock: boolean;
}

/**
 * AI-generated hero illustration. Where `generateHeroImage` above
 * produces a full-bleed photograph for the hero background, this
 * produces a small SIDE-OF-HERO illustrated object (the parallax SVG
 * slot) — the equivalent of the rocket on the marketing site, but
 * drawn bespoke for the business rather than picked from the 15
 * built-in styles.
 *
 * Output is a transparent-background PNG suitable for the
 * `hero.illustration.customUrl` field. The renderer's existing motion
 * presets (launch, float, drift, tilt-3d, etc.) apply to the custom
 * URL exactly as they do to the built-in styles.
 *
 * Runs through fal.ai's text-to-image models. Persists the result on
 * the client's website config so the public renderer picks it up on
 * next view.
 */
export async function generateHeroIllustration(
  args: GenerateHeroIllustrationArgs,
): Promise<GenerateHeroIllustrationResult> {
  const prompt = await buildIllustrationPrompt(args);

  // Square aspect — the renderer puts this in a fixed-width slot next
  // to the hero copy, and a square PNG scales cleanly to any size.
  // We request the illustration on transparent background via the
  // prompt; fal's default is still opaque, but Flux respects
  // "isolated on white/transparent" instructions well enough for most
  // cases. Downstream CSS can mix-blend-mode it in worst case.
  const imageUrl = await withRetry(() => generateImage(prompt, '1:1'), {
    label: `hero_illustration:${args.clientId}`,
    attempts: 2,
  });

  if (isDbConfigured()) {
    const db = getDb();
    const [row] = await db
      .select({ websiteConfig: clients.websiteConfig })
      .from(clients)
      .where(eq(clients.id, args.clientId));
    const current = (row?.websiteConfig ?? {}) as Partial<WebsiteConfig>;
    const existingHero = current.hero ?? {
      headline: '',
      subheadline: '',
      imageIndex: null,
      ctaPrimary: { label: '', href: '' },
    };
    const existingIllustration = existingHero.illustration ?? {};
    const next: Partial<WebsiteConfig> = {
      ...current,
      hero: {
        ...existingHero,
        illustration: {
          // Preserve motion / side / scale if already set.
          ...existingIllustration,
          customUrl: imageUrl,
          // Store the brief so later regenerations start from the same
          // creative direction.
          prompt: args.brief,
        },
      } as WebsiteConfig['hero'],
    };
    await db
      .update(clients)
      .set({ websiteConfig: next as any })
      .where(eq(clients.id, args.clientId));
  }

  return {
    imageUrl,
    prompt,
    fromMock: !features.fal,
  };
}

/**
 * Turn a short agency brief into a full image-generation prompt. We
 * deliberately steer away from photo realism — the illustration slot
 * is meant to be a stylised mark, not a second hero photo.
 */
async function buildIllustrationPrompt(
  args: GenerateHeroIllustrationArgs,
): Promise<string> {
  const colourHint =
    args.primaryColor || args.accentColor
      ? `Use the brand palette: primary ${args.primaryColor ?? ''} accent ${args.accentColor ?? ''}. Render the subject in these colours as gradients and flat shapes — not background wash.`
      : '';

  if (!features.claude) {
    // Deterministic fallback when Claude isn't wired — build a decent
    // prompt directly from the brief.
    return [
      `Stylised vector illustration of ${args.brief} for a ${args.industry} business.`,
      'Flat design with subtle gradients, clean geometric shapes, isolated on a transparent background. No text, no watermark, no photo-realism.',
      colourHint,
      'Single dominant object centred in frame, minimal composition, sharp edges, soft shadows.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  const instruction = `You are an art director writing ONE image-generation prompt for a brand illustration that will sit next to the hero copy on a small business website.

BUSINESS: ${args.businessName}
INDUSTRY: ${args.industry}
AGENCY BRIEF: ${args.brief}
${args.primaryColor ? `PRIMARY COLOR: ${args.primaryColor}\n` : ''}${args.accentColor ? `ACCENT COLOR: ${args.accentColor}\n` : ''}
CONSTRAINTS:
- Stylised vector illustration — NOT a photograph, NOT photo-realistic.
- Flat design with subtle gradients, clean geometric shapes.
- Single dominant object centred in frame.
- Transparent background (isolated on white/transparent so the renderer can composite it cleanly).
- Brand palette ONLY for the subject colours. No background wash.
- No text, no logos, no watermarks.
- Visual style cues: modern, confident, editorial illustration, mirrors Apple / Stripe / Linear marketing-site aesthetic.

Return ONLY the prompt string — no preamble, no JSON, no quotes.`;

  try {
    const result = await generateText(instruction, {
      model: 'sonnet',
      maxTokens: 400,
    });
    return result.trim().slice(0, 2000);
  } catch {
    // Fall back to the deterministic prompt on Claude errors so the
    // request still produces an image.
    return [
      `Stylised vector illustration of ${args.brief} for a ${args.industry} business.`,
      'Flat design with subtle gradients, clean geometric shapes, isolated on a transparent background. No text, no watermark, no photo-realism.',
      colourHint,
      'Single dominant object centred in frame, minimal composition.',
    ]
      .filter(Boolean)
      .join(' ');
  }
}
