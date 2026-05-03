/**
 * Website generator. Given a client id (or freeform business info), we:
 *   1. Scrape the client's existing site (if they have one) for voice + facts.
 *   2. Pull their recent images and pass short descriptions for hero-image hints.
 *   3. Ask Claude for a structured website config JSON (see prompts.ts).
 *   4. Generate a custom hero illustration via fal.ai (kicked off in parallel
 *      with the config call when no client image will be used).
 *   5. Persist the result on the client row so the front-end can render it.
 *
 * Every step is retryable. If the scrape fails the pipeline still runs — we
 * just produce a simpler config from description + images alone. The shape
 * of the config matches `WebsiteConfig` exported from @boost/core so the
 * shared renderer (packages/ui/src/site) can assemble it deterministically.
 */

import { eq, desc } from 'drizzle-orm';
import { getDb, isDbConfigured, clients, clientImages } from '@boost/database';
import type { WebsiteConfig, SiteTemplate, HeroVariant } from '@boost/core';
import { DEFAULT_LAYOUT, DEFAULT_HERO_VARIANT } from '@boost/core';
import { generateJSON } from './claude.js';
import { scrapeWebsite } from './scraper.js';
import { websiteConfigPrompt } from './prompts.js';
import { withRetry } from './retry.js';
import { broadcast } from './realtime.js';
import { generateHeroImage } from './heroImage.js';
import { features } from '../env.js';

export type { WebsiteConfig } from '@boost/core';

export interface GenerateWebsiteArgs {
  clientId: string;
  description?: string;
  services?: string[];
  hasBooking?: boolean;
  hasHours?: boolean;
  /** Optional explicit template pick — otherwise inferred from industry. */
  template?: SiteTemplate;
  /** Free-text suggestions from the agency to steer the AI output. */
  suggestions?: string;
  /**
   * When true (default), generate an AI hero image if no client image is
   * used. Set to false in tests or when the agency explicitly skips it.
   */
  generateHeroImage?: boolean;
}

export async function generateWebsite(args: GenerateWebsiteArgs) {
  if (!isDbConfigured()) {
    return {
      config: demoConfig('Demo Business', 'Local services', args.template ?? 'service'),
      fromMock: true,
      imagesUsed: 0,
      slug: 'demo-business',
      clientId: args.clientId,
    };
  }

  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, args.clientId));
  if (!client) throw new Error('Client not found');

  broadcast({ type: 'website:generating', payload: { clientId: client.id } });

  // 1. Scrape existing site (if any) — treat failure as "no reference content".
  let existingMarkdown = '';
  if (client.websiteUrl) {
    try {
      existingMarkdown = await withRetry(() => scrapeWebsite(client.websiteUrl!), {
        label: `site_scrape:${client.id}`,
        attempts: 2,
      });
    } catch (e) {
      console.warn(`[websites] scrape failed for ${client.id}:`, (e as Error).message);
    }
  }

  // 2. Gather image hints (top 8, favouring enhanced/approved with a good score).
  const images = await db
    .select()
    .from(clientImages)
    .where(eq(clientImages.clientId, client.id))
    .orderBy(desc(clientImages.qualityScore))
    .limit(8);
  const imageDescriptions =
    images.length > 0
      ? images
          .map(
            (img, idx) =>
              `[${idx}] ${img.aiDescription ?? img.fileName ?? 'photo'}${
                img.qualityScore ? ` (score ${img.qualityScore})` : ''
              }`,
          )
          .join('\n')
      : undefined;

  // Template still passed as a HINT — Claude is free to pick a better one.
  const templateHint = args.template ?? inferTemplate(client.industry);

  // 3. Generate config. Retryable because Claude occasionally returns malformed JSON.
  const prompt = websiteConfigPrompt({
    businessName: client.businessName,
    industry: client.industry ?? 'Local Business',
    description:
      args.description?.trim() ||
      client.brandVoice ||
      `A local ${client.industry ?? 'business'} called ${client.businessName}.`,
    existingMarkdown: existingMarkdown || undefined,
    services: args.services,
    hasBooking: args.hasBooking,
    hasHours: args.hasHours,
    imageDescriptions,
    template: templateHint,
    suggestions: args.suggestions,
  });

  const raw = await withRetry(
    () => generateJSON<Partial<WebsiteConfig>>(prompt, { model: 'sonnet', maxTokens: 5120 }),
    { label: `website_config:${client.id}`, attempts: 3 },
  );

  // Claude picks the template — fall back to the hint if it didn't.
  const chosenTemplate = (raw.template ?? templateHint) as SiteTemplate;
  const config = normalizeConfig(raw, chosenTemplate);

  // 4. Generate AI hero image if no client image is selected. Runs after the
  // config so we can pass the chosen variant to the image prompt.
  const shouldGenerateImage =
    (args.generateHeroImage ?? true) &&
    config.hero.imageIndex == null &&
    // Skip when Claude already supplied an AI prompt+URL (shouldn't happen
    // on a fresh generation, but defensive).
    !config.hero.aiImageUrl;

  if (shouldGenerateImage) {
    try {
      const { imageUrl, prompt: imagePrompt } = await generateHeroImage({
        clientId: client.id,
        businessName: client.businessName,
        industry: client.industry ?? 'Local Business',
        description: args.description ?? client.brandVoice ?? undefined,
        heroVariant: config.hero.variant,
      });
      config.hero.aiImageUrl = imageUrl;
      config.hero.aiImagePrompt = imagePrompt;
    } catch (e) {
      console.warn(
        `[websites] hero image generation failed for ${client.id}:`,
        (e as Error).message,
      );
      // Non-fatal — hero variants all have non-image fallbacks.
    }
  }

  // 5. Persist for the front-end to render.
  await db
    .update(clients)
    .set({
      websiteConfig: config,
      websiteGeneratedAt: new Date(),
    })
    .where(eq(clients.id, client.id));

  broadcast({
    type: 'website:ready',
    payload: { clientId: client.id, previewImageIndex: config.hero.imageIndex },
  });

  return {
    config,
    imagesUsed: images.length,
    fromMock: false,
    slug: client.slug,
    clientId: client.id,
  };
}

/**
 * AI-powered website config editor. Takes the current config and a natural
 * language instruction, asks Claude to produce an updated config, and returns
 * the result with a human-readable summary of what changed.
 */
export async function editWebsiteWithAI(args: {
  clientId: string;
  currentConfig: Record<string, any>;
  instruction: string;
}): Promise<{ config: WebsiteConfig; summary: string }> {
  const configJson = JSON.stringify(args.currentConfig, null, 2);

  const prompt = `You are a website editor AI. You have a client's current website config JSON and an instruction from the agency about what to change.

CURRENT CONFIG:
${configJson}

INSTRUCTION: ${args.instruction}

Apply the requested changes to the config. Return ONLY valid JSON with this exact shape:
{
  "config": { <the full updated WebsiteConfig> },
  "summary": "<1-2 sentence description of what you changed>"
}

RULES:
- Preserve all existing data that wasn't mentioned in the instruction.
- If asked to change colors, update the brand object.
- If asked to add/remove sections, update the layout array.
- If asked to rewrite copy, update the relevant text fields.
- If asked to change the hero style, update brand.heroStyle.
- If asked to change the hero look/variant, update hero.variant to one of: spotlight, beams, floating-icons, parallax-layers, gradient-mesh.
- If asked for different floating icons, update hero.floatingIcons (Lucide names or emoji strings).
- Keep the same JSON structure — don't add or remove top-level keys.
- The summary should be concise and specific, e.g. "Changed primary color to navy blue and made the hero dark."`;

  if (!features.claude) {
    // Mock: just return the config as-is with a mock summary
    return {
      config: normalizeConfig(args.currentConfig as Partial<WebsiteConfig>, (args.currentConfig as any).template ?? 'service'),
      summary: `Mock mode: would apply "${args.instruction}" to the config.`,
    };
  }

  const result = await withRetry(
    () => generateJSON<{ config: Partial<WebsiteConfig>; summary: string }>(prompt, {
      model: 'sonnet',
      maxTokens: 5120,
      temperature: 0.3,
    }),
    { label: `edit_website:${args.clientId}`, attempts: 2 },
  );

  const template = (result.config?.template ?? args.currentConfig.template ?? 'service') as SiteTemplate;
  const config = normalizeConfig(result.config ?? {}, template);

  // Persist if DB is available
  if (isDbConfigured()) {
    const db = getDb();
    await db
      .update(clients)
      .set({ websiteConfig: config, websiteGeneratedAt: new Date() })
      .where(eq(clients.id, args.clientId));
  }

  return { config, summary: result.summary ?? 'Config updated.' };
}

/**
 * Targeted edit of a single field. Used by the inline section editor so a
 * single headline change doesn't round-trip through Claude.
 */
export async function updateWebsiteField(args: {
  clientId: string;
  path: string[];
  value: unknown;
}): Promise<WebsiteConfig> {
  if (!isDbConfigured()) {
    throw new Error('Database not configured');
  }
  const db = getDb();
  const [row] = await db
    .select({ websiteConfig: clients.websiteConfig })
    .from(clients)
    .where(eq(clients.id, args.clientId));
  if (!row?.websiteConfig) throw new Error('No website config for this client');

  // Deep clone so we don't mutate the cached JSONB reference.
  const next = structuredClone(row.websiteConfig) as Record<string, any>;
  setPath(next, args.path, args.value);

  await db
    .update(clients)
    .set({ websiteConfig: next as any, websiteGeneratedAt: new Date() })
    .where(eq(clients.id, args.clientId));

  return next as WebsiteConfig;
}

/** Set a nested value by path, creating intermediate objects/arrays as needed. */
function setPath(target: Record<string, any>, path: string[], value: unknown) {
  if (path.length === 0) return;
  let cursor: any = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    // Numeric key → treat current level as an array.
    if (cursor[key] == null) {
      const nextKey = path[i + 1]!;
      cursor[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]!] = value;
}

/**
 * Normalize a raw model response into a complete `WebsiteConfig`. Fills in
 * sensible defaults for any missing field so the renderer never sees a
 * partial config.
 */
function normalizeConfig(raw: Partial<WebsiteConfig>, template: SiteTemplate): WebsiteConfig {
  const brand = {
    tagline: raw.brand?.tagline ?? 'Good work, done well.',
    tone: raw.brand?.tone ?? 'warm',
    primaryColor: raw.brand?.primaryColor ?? TEMPLATE_DEFAULTS[template].primary,
    accentColor: raw.brand?.accentColor ?? TEMPLATE_DEFAULTS[template].accent,
    popColor: raw.brand?.popColor ?? '#FFEC3D',
    darkColor: raw.brand?.darkColor ?? '#0B1220',
    heroStyle: raw.brand?.heroStyle ?? (template === 'fitness' ? 'dark' : 'light'),
  } satisfies WebsiteConfig['brand'];

  // Clamp hero.variant to a known value — unknown strings fall back to the
  // template's default variant so the dispatcher never hits a dead branch.
  const validVariants: HeroVariant[] = [
    'spotlight',
    'beams',
    'floating-icons',
    'parallax-layers',
    'gradient-mesh',
  ];
  const variant: HeroVariant = validVariants.includes(raw.hero?.variant as HeroVariant)
    ? (raw.hero!.variant as HeroVariant)
    : DEFAULT_HERO_VARIANT[template];

  return {
    template: raw.template ?? template,
    layout: raw.layout && raw.layout.length > 0 ? raw.layout : DEFAULT_LAYOUT[template],
    meta: {
      title: raw.meta?.title ?? 'Local business',
      description: raw.meta?.description ?? 'Welcome to our site.',
      keywords: raw.meta?.keywords ?? [],
    },
    brand,
    hero: {
      headline: raw.hero?.headline ?? 'Welcome.',
      subheadline: raw.hero?.subheadline ?? '',
      eyebrow: raw.hero?.eyebrow,
      ctaPrimary: raw.hero?.ctaPrimary ?? { label: 'Get in touch', href: '#contact' },
      ctaSecondary: raw.hero?.ctaSecondary,
      imageIndex: raw.hero?.imageIndex ?? null,
      variant,
      floatingIcons: raw.hero?.floatingIcons,
      aiImageUrl: raw.hero?.aiImageUrl ?? null,
      aiImagePrompt: raw.hero?.aiImagePrompt,
      effects: raw.hero?.effects,
    },
    about: raw.about,
    stats: raw.stats,
    services: raw.services ?? [],
    gallery: raw.gallery,
    reviews: raw.reviews ?? [],
    faq: raw.faq ?? [],
    contact: raw.contact ?? {
      heading: 'Get in touch',
      body: 'Drop us a line, we usually respond within a few hours.',
      showBookingForm: true,
      showHours: false,
    },
    navigation: raw.navigation ?? ['Home', 'Services', 'About', 'Contact'],
  };
}

/** Heuristic industry → template picker. Used as a hint only — Claude chooses. */
function inferTemplate(industry: string | null | undefined): SiteTemplate {
  const i = (industry ?? '').toLowerCase();
  if (/food|cafe|restaurant|coffee|bakery|drink|bar|catering|kitchen|dining/.test(i)) return 'food';
  if (/beauty|salon|spa|wellness|nail|hair|aesthetic|skincare|barber/.test(i)) return 'beauty';
  if (/fitness|gym|coach|yoga|pilates|crossfit|bootcamp|personal.?train/.test(i)) return 'fitness';
  if (/law|solicitor|attorney|legal|barrister|court/.test(i)) return 'legal';
  if (/accounting|consult|agency|finance|insurance|advisory|audit|bookkeep/.test(i)) return 'professional';
  if (/retail|shop|store|boutique|ecommerce|fashion|clothing|gift/.test(i)) return 'retail';
  if (/medical|dental|doctor|clinic|physio|therapy|chiro|health.?care/.test(i)) return 'medical';
  if (/design|photo|art|creative|studio|music|film|video|brand/.test(i)) return 'creative';
  if (/property|real.?estate|letting|estate.?agent|mortgage|rental/.test(i)) return 'realestate';
  if (/school|tutor|education|training|course|academy|learn|college|university/.test(i)) return 'education';
  if (/auto|mechanic|garage|car|vehicle|tire|tyre|mot|body.?shop/.test(i)) return 'automotive';
  if (/hotel|bnb|b&b|guest.?house|resort|hostel|hospitality|inn|lodge/.test(i)) return 'hospitality';
  if (/charity|nonprofit|non.?profit|foundation|ngo|community|volunteer/.test(i)) return 'nonprofit';
  if (/tech|software|saas|startup|app|platform|ai|ml|digital|dev/.test(i)) return 'tech';
  return 'service';
}

const TEMPLATE_DEFAULTS: Record<SiteTemplate, { primary: string; accent: string }> = {
  service: { primary: '#1D9CA1', accent: '#48D886' },
  food: { primary: '#c2410c', accent: '#f59e0b' },
  beauty: { primary: '#db2777', accent: '#f9a8d4' },
  fitness: { primary: '#0EA5E9', accent: '#22C55E' },
  professional: { primary: '#0f172a', accent: '#1D9CA1' },
  retail: { primary: '#7c3aed', accent: '#f59e0b' },
  medical: { primary: '#0891b2', accent: '#06b6d4' },
  creative: { primary: '#e11d48', accent: '#f97316' },
  realestate: { primary: '#1e3a5f', accent: '#48D886' },
  education: { primary: '#4f46e5', accent: '#818cf8' },
  automotive: { primary: '#1e293b', accent: '#dc2626' },
  hospitality: { primary: '#78350f', accent: '#d97706' },
  legal: { primary: '#1e3a8a', accent: '#b45309' },
  nonprofit: { primary: '#059669', accent: '#f59e0b' },
  tech: { primary: '#4338ca', accent: '#06b6d4' },
};

/**
 * Deterministic, richly-populated demo config used when the DB is offline.
 * Covers every block so preview mode shows off the full layout.
 */
function demoConfig(name: string, industry: string, template: SiteTemplate): WebsiteConfig {
  const defaults = TEMPLATE_DEFAULTS[template];
  return {
    template,
    layout: DEFAULT_LAYOUT[template],
    meta: {
      title: `${name} - ${industry}`,
      description: `${name} is a local ${industry.toLowerCase()} business serving the community with quality and care.`,
      keywords: [name.toLowerCase(), industry.toLowerCase(), 'local', 'booking'],
    },
    brand: {
      tagline: 'Good work, done well.',
      tone: 'warm',
      primaryColor: defaults.primary,
      accentColor: defaults.accent,
      popColor: '#FFEC3D',
      darkColor: '#0B1220',
      heroStyle: template === 'fitness' ? 'dark' : 'light',
    },
    hero: {
      eyebrow: 'Serving the community since 2012',
      headline: `Local ${industry.toLowerCase()}, done right.`,
      subheadline: `${name} has been serving the community for years. Book online in under a minute.`,
      ctaPrimary: { label: 'Book now', href: '#contact' },
      ctaSecondary: { label: 'See what we do', href: '#services' },
      imageIndex: null,
      variant: DEFAULT_HERO_VARIANT[template],
      floatingIcons:
        template === 'food'
          ? ['Coffee', 'Utensils', 'Leaf', 'Flame', 'Star', 'Award']
          : template === 'beauty'
            ? ['Scissors', 'Sparkles', 'HeartPulse', 'Sun', 'Star', 'Leaf']
            : undefined,
    },
    stats: [
      { value: 500, suffix: '+', label: 'Happy customers' },
      { value: 4.9, suffix: '★', label: 'Google rating' },
      { value: 12, suffix: ' yrs', label: 'In business' },
      { value: 30, suffix: ' min', label: 'Avg response' },
    ],
    about: {
      heading: `Why ${name}`,
      body: 'Small enough to know you, experienced enough to get it right the first time.\n\nWe show up when we say we will, explain things in plain English, and leave your place better than we found it.',
      bullets: [
        'Fully insured and certified',
        'Up-front quotes, no surprises',
        '14-day satisfaction guarantee',
      ],
      imageIndex: 1,
    },
    services: [
      {
        title: 'Our core service',
        description: 'What we do best, day in, day out.',
        icon: 'Wrench',
      },
      {
        title: 'Emergency support',
        description: 'Fast response when things go sideways.',
        icon: 'Phone',
      },
      {
        title: 'Ongoing care',
        description: 'Regular check-ins so problems never become problems.',
        icon: 'Calendar',
      },
      {
        title: 'Installations',
        description: 'Clean install, tidy finish, minimal disruption.',
        icon: 'Hammer',
      },
    ],
    gallery: {
      heading: 'Recent work',
      imageIndices: [0, 1, 2, 3, 4, 5],
    },
    reviews: [
      {
        text: 'Prompt, professional, and reasonably priced. Exactly what you want.',
        author: 'Aoife K.',
        rating: 5,
      },
      {
        text: "They explained everything in plain English. Wouldn't go anywhere else.",
        author: 'Seán M.',
        rating: 5,
      },
      {
        text: 'Great work and a fair price. Highly recommend.',
        author: 'Nora L.',
        rating: 5,
      },
    ],
    faq: [
      {
        question: 'Do you come to me?',
        answer: 'Yes, we cover the greater city area and surrounding towns.',
      },
      {
        question: 'How do I book?',
        answer: 'Tap "Book now" above, or call us anytime between 8am and 6pm.',
      },
      {
        question: 'What are your rates?',
        answer: 'We quote up front for every job. No hidden fees, no surprises.',
      },
      {
        question: 'Are you insured?',
        answer: 'Fully insured and certified. Paperwork available on request.',
      },
    ],
    contact: {
      heading: 'Get in touch',
      body: 'Most enquiries get a reply within a few hours.',
      address: '12 Market Street, Dublin 2',
      phone: '+353 1 555 0100',
      email: 'hello@example.com',
      hours: 'Mon–Fri 8am–6pm · Sat 9am–3pm',
      showBookingForm: true,
      showHours: true,
    },
    navigation: ['Home', 'Services', 'About', 'Reviews', 'Contact'],
  };
}
