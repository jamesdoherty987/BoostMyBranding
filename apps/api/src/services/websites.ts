/**
 * Website generator. Given a client id (or freeform business info), we:
 *   1. Scrape the client's existing site (if they have one) for voice + facts.
 *   2. Pull their recent images and pass short descriptions for hero-image hints.
 *   3. Ask Claude for a structured website config JSON (see prompts.ts).
 *   4. Persist the result on the client row so the front-end can render it.
 *
 * Every step is retryable. If the scrape fails the pipeline still runs — we
 * just produce a simpler config from description + images alone. The shape
 * of the config matches `WebsiteConfig` exported from @boost/core so the
 * shared renderer (packages/ui/src/site) can assemble it deterministically.
 */

import { eq, desc } from 'drizzle-orm';
import { getDb, isDbConfigured, clients, clientImages } from '@boost/database';
import type { WebsiteConfig, SiteTemplate } from '@boost/core';
import { DEFAULT_LAYOUT } from '@boost/core';
import { generateJSON } from './claude.js';
import { scrapeWebsite } from './scraper.js';
import { websiteConfigPrompt } from './prompts.js';
import { withRetry } from './retry.js';
import { broadcast } from './realtime.js';

export type { WebsiteConfig } from '@boost/core';

export interface GenerateWebsiteArgs {
  clientId: string;
  description?: string;
  services?: string[];
  hasBooking?: boolean;
  hasHours?: boolean;
  /** Optional explicit template pick — otherwise inferred from industry. */
  template?: SiteTemplate;
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

  const template = args.template ?? inferTemplate(client.industry);

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
    template,
  });

  const raw = await withRetry(
    () => generateJSON<Partial<WebsiteConfig>>(prompt, { model: 'sonnet', maxTokens: 4096 }),
    { label: `website_config:${client.id}`, attempts: 3 },
  );

  const config = normalizeConfig(raw, template);

  // 4. Persist for the front-end to render.
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
      imageIndex: raw.hero?.imageIndex ?? 0,
      effects: raw.hero?.effects ?? { aurora: true, particles: true, grid: true },
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

/** Heuristic industry → template picker. */
function inferTemplate(industry: string | null | undefined): SiteTemplate {
  const i = (industry ?? '').toLowerCase();
  if (/food|cafe|restaurant|coffee|bakery|drink|bar/.test(i)) return 'food';
  if (/beauty|salon|spa|wellness|nail|hair|aesthetic/.test(i)) return 'beauty';
  if (/fitness|gym|coach|health|yoga|training|sport/.test(i)) return 'fitness';
  if (/law|accounting|consult|agency|finance|insurance/.test(i)) return 'professional';
  return 'service';
}

const TEMPLATE_DEFAULTS: Record<SiteTemplate, { primary: string; accent: string }> = {
  service: { primary: '#1D9CA1', accent: '#48D886' },
  food: { primary: '#c2410c', accent: '#f59e0b' },
  beauty: { primary: '#db2777', accent: '#f9a8d4' },
  fitness: { primary: '#0EA5E9', accent: '#22C55E' },
  professional: { primary: '#0f172a', accent: '#1D9CA1' },
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
      imageIndex: 0,
      effects: { aurora: true, particles: true, grid: true },
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
