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
import type { WebsiteConfig, SiteTemplate, HeroVariant, SiteBlockKey } from '@boost/core';
import { DEFAULT_LAYOUT, DEFAULT_HERO_VARIANT, HERO_VARIANTS, slugify } from '@boost/core';
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

  /* ── Seeded business facts ──────────────────────────────────────────
   * Passed through to Claude as known-good data it must use verbatim
   * rather than invent. Every field is optional — Claude falls back to
   * inferring from the scraped site + description when we leave them
   * blank.
   * ───────────────────────────────────────────────────────────────── */

  /** Street address. Powers the Google Maps embed in the contact block. */
  address?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  /** Multi-line opening hours, e.g. "Mon–Fri 9am–6pm\nSat 10am–3pm". */
  hours?: string;
  socials?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    linkedin?: string;
    x?: string;
    youtube?: string;
    google?: string;
  };
  /**
   * Team members the site should show. When provided, Claude populates
   * `team` verbatim (rather than inventing names). Leave empty to let
   * Claude decide whether the business needs a team block at all.
   */
  team?: Array<{
    name: string;
    role: string;
    bio?: string;
    credentials?: string;
    specialties?: string[];
    photoUrl?: string;
  }>;
  /** Towns/regions this business covers. Populates the serviceAreas block. */
  serviceAreas?: string[];
  /** Certifications / insurance / licences. Populates the trustBadges block. */
  trustBadges?: Array<{
    label: string;
    detail?: string;
    href?: string;
  }>;
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
    seededFacts: buildSeededFacts(args),
  });

  const raw = await withRetry(
    () => generateJSON<Partial<WebsiteConfig>>(prompt, { model: 'sonnet', maxTokens: 5120 }),
    { label: `website_config:${client.id}`, attempts: 3 },
  );

  // Claude picks the template — fall back to the hint if it didn't.
  const chosenTemplate = (raw.template ?? templateHint) as SiteTemplate;
  const config = normalizeConfig(raw, chosenTemplate);

  // Apply seeded facts AFTER Claude's pass so they're authoritative.
  // Contact info, team, service areas, trust badges, socials — the agency
  // provided these directly so we must not let Claude's guesses overwrite them.
  applySeededFacts(config, args);

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
- If asked to make one card bigger / feature / highlight / emphasise a single item ("make the middle team member bigger", "highlight the Silver tier", "feature the first review"), set the item's "featured" field to true. Clear other items' "featured" fields to false when the user says "only the middle one". Featured items span two columns on wide grids and get a brand-accent ring. Supported on: services, reviews, team.members, portfolio.projects, pricingTiers.tiers, menu.categories[].items, products.items, priceList.items, schedule.entries.
- If asked to change one team member's card style ("make Sarah's card the banner one"), set that member's "variant" ("portrait" | "minimal" | "quote" | "banner"). Leave other members untouched so the rest stay uniform.
- If asked to change the team block's overall card style ("use minimal cards for the whole team"), set team.variant. Individual member overrides still win.
- If asked to change the hero style, update brand.heroStyle.
- If asked to change the hero look/variant, update hero.variant to one of: spotlight, beams, floating-icons, parallax-layers, gradient-mesh, aurora, wavy, sparkles, hero-highlight, dither, multicolor, full-bg-image, two-column-image, meteors, vortex, lamp, shooting-stars, boxes, ripple.
- If asked for a typewriter / typing / flipping-words / generative text effect on the headline, set hero.headlineEffect to one of: typewriter (types character-by-character), flip-words (last word cycles — also populate hero.flipWords with 2-5 alternatives), generate (words fade in one-by-one). Clear this field to go back to the static gradient headline.
- If asked to change the testimonials style, update reviewsSection.variant to one of: grid (default), marquee (auto-scroll), carousel (one at a time with avatars), masonry, draggable (physical drag-around cards), stack (cycling card-stack), animated-testimonials.
- If asked to change the services style, update servicesSection.variant to one of: cards (default), bento (featured span big tiles), sticky-scroll (scroll reveal), hover-effect (card spotlight), 3d-cards, wobble (tilting cards), glare (shiny premium cards), expandable (click-to-open modal with full details).
- If asked to change the gallery style, update gallery.variant to one of: grid (default), focus-cards (hover to spotlight one), parallax (3-column parallax scroll), apple-carousel (tap-to-expand), 3d-marquee (tilted wall of images), layout-grid (click to expand), compare (before/after slider, great for trades), direction-aware (cursor-direction hover reveals).
- If asked to change the FAQ style, update faqSection.variant to one of: accordion (default), grid (2-col always-visible), with-background.
- If asked to change the CTA style, update cta.variant to one of: simple (default strip), with-images (floating avatars), masonry-images, centered-bold, moving-border (animated glowing button), text-reveal (hover to reveal hidden text).
- If asked to change the process style, update process.variant to one of: numbered (default), timeline (vertical scroll-drawn timeline).
- If asked to change the stats style, update statsSection.variant to one of: ticker (default), gradient, changelog.
- If asked to change the contact style, update contact.variant to one of: form-side (default), grid-sections, shader.
- If asked to change the team layout style for the whole block, use team.variant: portrait, minimal, quote, banner, light-bg, small-avatars, card-hover.
- If asked for a scrolling / marquee logo strip, set logoStrip.variant to 'marquee' (default is 'grid' — static centered row).
- If asked to "set the logo" / "use this as the logo" / "upload a logo", set brand.logoIndex to the index of the matching image in the client's gallery, or brand.logoUrl if a direct URL is available. Don't put logos in hero.imageIndex — the nav renders logos small (~32px high) and wide hero photos there look broken.
- If asked to add/remove a page ("add a Menu page", "create an About page"), update the "pages" array. Each page needs {slug, title, layout, hero, blocks} at minimum. Use URL-safe slugs, Title Case titles. The first page MUST be the homepage with slug "home". When converting a single-page site to multipage, create the "home" entry from the current root layout as well. Generate appropriate content for the new page's hero + blocks — don't leave placeholders.
- If asked for different floating icons, update hero.floatingIcons (Lucide names or emoji strings).
- If asked to rename a section heading (e.g. "change Services to 'Our Menu'"), update the matching *Section.heading field: servicesSection, statsSection, reviewsSection, faqSection, gallery, about, or contact (use their .heading / .eyebrow fields — not the section title strings that appear inside the layout array).
- If asked to add or remove a page (e.g. "add a Menu page", "remove the About page"), update the "pages" array. Pages have {slug, title, layout, hero?, blocks?}. Use URL-safe slugs. The first page MUST be the homepage with slug "home". Max 4 pages total.
- If asked to edit a sub-page's content ("change the About page headline"), locate the matching page in "pages" by slug and edit its hero/blocks.
- If asked to add a decorative image / cutout / prop to the hero (e.g. "add the coffee cup in the top right", "put a wrench drifting across the hero"), append to hero.cutouts with x/y/size/animation. Don't invent URLs — if there's no suitable image in the client's media library, explain in the summary that an image is needed.
- If asked to "make a custom section" / "add a section showing these photos" / "invent a section", append to customSections with the best matching variant (image-strip, image-text-split, feature-row, pull-quote) and add "custom" to the layout array if it's not already there.
- If asked to add a products / shop / menu-like section with prices, populate "products" and add "products" to layout.
- If asked to add examples / case studies / portfolio / past projects, populate "portfolio" and add "portfolio" to layout.
- If asked to explain the process / "how it works" / steps, populate "process" with numbered steps.
- If asked for pricing packages / plans / tiers (Bronze/Silver/Gold), populate "pricingTiers".
- If asked to promote something time-sensitive (Christmas hours, sale), populate "announcement" with a short message.
- If asked to "feature press" / "show partner logos", populate "logoStrip".
- If asked for an intro video / demo / embed, populate "video" with the URL.
- If asked to add a newsletter / waitlist / email signup, populate "newsletter".
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
 * Atomic full-config save. Unlike `updateWebsiteField` (which does a
 * read-modify-write on the JSONB blob), this takes the caller's full
 * config and overwrites in a single query. Safe to call from the editor
 * without worrying about races between parallel requests — there's only
 * one request per save.
 *
 * This is the correct path for the dashboard's auto-save + manual Save
 * button, which send every top-level field together. The older
 * `updateWebsiteField` is kept for tiny, isolated edits (e.g. a single
 * headline change in the review panel).
 */
export async function saveWebsiteConfig(args: {
  clientId: string;
  config: WebsiteConfig;
}): Promise<WebsiteConfig> {
  if (!isDbConfigured()) {
    throw new Error('Database not configured');
  }
  const db = getDb();

  // Verify the client exists so we return a clean 404 rather than a
  // silent noop when the id is wrong.
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, args.clientId));
  if (!row) throw new Error('Client not found');

  await db
    .update(clients)
    .set({
      websiteConfig: args.config as any,
      websiteGeneratedAt: new Date(),
    })
    .where(eq(clients.id, args.clientId));

  return args.config;
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

/**
 * Set a nested value by path, creating intermediate objects/arrays as needed.
 *
 * Important: when a numeric segment points to an index past the current array
 * length, we fill the gap with empty objects rather than leaving sparse
 * holes. A sparse hole serialises as `null` in JSON, which later reads as
 * `member = null` in the renderer and crashes `member.photoUrl`.
 */
function setPath(target: Record<string, any>, path: string[], value: unknown) {
  if (path.length === 0) return;
  let cursor: any = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const nextKey = path[i + 1];
    const nextIsNumeric = !!nextKey && /^\d+$/.test(nextKey);

    // Create the node if missing.
    if (cursor[key] == null) {
      cursor[key] = nextIsNumeric ? [] : {};
    }

    // If the next key is numeric but the parent is a plain object, coerce
    // it into an array. This fixes configs already corrupted by the prior
    // version of this function (which would leave `services` as
    // `{"0": {...}}` after the first numeric write).
    if (
      nextIsNumeric &&
      !Array.isArray(cursor[key]) &&
      typeof cursor[key] === 'object'
    ) {
      const obj = cursor[key] as Record<string, unknown>;
      const numericKeys = Object.keys(obj).filter((k) => /^\d+$/.test(k));
      if (numericKeys.length > 0) {
        const maxIdx = Math.max(...numericKeys.map(Number));
        const arr: unknown[] = Array.from({ length: maxIdx + 1 }, () => ({}));
        for (const k of numericKeys) arr[Number(k)] = obj[k];
        cursor[key] = arr;
      } else {
        cursor[key] = [];
      }
    }

    // Ensure the child at this key isn't a sparse hole when we're about
    // to descend into it by index. Fills `members[0]` and `members[1]`
    // with `{}` when writing to `members[2]`.
    if (Array.isArray(cursor[key]) && nextIsNumeric) {
      const arr = cursor[key] as any[];
      const idx = Number(nextKey);
      while (arr.length < idx) arr.push({});
      if (arr[idx] == null) arr[idx] = {};
    }

    cursor = cursor[key];
  }

  // Final assignment — use numeric index when the parent is an array so
  // we don't stuff string keys into an Array.
  const lastKey = path[path.length - 1]!;
  if (/^\d+$/.test(lastKey) && Array.isArray(cursor)) {
    cursor[Number(lastKey)] = value;
  } else {
    cursor[lastKey] = value;
  }
}

/**
 * Normalize a raw model response into a complete `WebsiteConfig`. Fills in
 * sensible defaults for any missing field so the renderer never sees a
 * partial config. Also validates the `pages` array — Claude occasionally
 * returns a page with an invalid slug or missing layout, which we
 * sanitize here rather than crashing in the renderer.
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
  const rawVariant = raw.hero?.variant;
  const variant: HeroVariant =
    rawVariant && (HERO_VARIANTS as readonly string[]).includes(rawVariant)
      ? rawVariant
      : DEFAULT_HERO_VARIANT[template];

  const rootLayout =
    raw.layout && raw.layout.length > 0 ? raw.layout : DEFAULT_LAYOUT[template];

  return {
    template: raw.template ?? template,
    layout: rootLayout,
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
      cutouts: raw.hero?.cutouts,
    },
    about: raw.about
      ? {
          eyebrow: raw.about.eyebrow,
          heading: raw.about.heading ?? 'About us',
          body: raw.about.body ?? '',
          bullets: raw.about.bullets,
          imageIndex: raw.about.imageIndex ?? null,
        }
      : undefined,
    stats: raw.stats,
    statsSection: raw.statsSection,
    servicesSection: raw.servicesSection,
    services: raw.services ?? [],
    gallery: raw.gallery,
    reviewsSection: raw.reviewsSection,
    reviews: raw.reviews ?? [],
    faqSection: raw.faqSection,
    faq: raw.faq ?? [],
    contact: raw.contact
      ? {
          eyebrow: raw.contact.eyebrow,
          heading: raw.contact.heading ?? 'Get in touch',
          body: raw.contact.body ?? '',
          address: raw.contact.address,
          phone: raw.contact.phone,
          email: raw.contact.email,
          hours: raw.contact.hours,
          whatsapp: raw.contact.whatsapp,
          showBookingForm: raw.contact.showBookingForm,
          showHours: raw.contact.showHours,
        }
      : {
          heading: 'Get in touch',
          body: 'Drop us a line, we usually respond within a few hours.',
          showBookingForm: true,
          showHours: false,
        },
    socials: raw.socials,
    mobileCta: raw.mobileCta,
    footer: raw.footer,
    // Industry-specific blocks pass through as-is. They render null when
    // their data is absent, so it's safe to leave them undefined.
    menu: raw.menu,
    priceList: raw.priceList,
    team: raw.team,
    schedule: raw.schedule,
    serviceAreas: raw.serviceAreas,
    beforeAfter: raw.beforeAfter,
    trustBadges: raw.trustBadges,
    cta: raw.cta,
    customSections: raw.customSections,
    // Extra small-business blocks
    products: raw.products,
    portfolio: raw.portfolio,
    process: raw.process,
    pricingTiers: raw.pricingTiers,
    announcement: raw.announcement,
    logoStrip: raw.logoStrip,
    video: raw.video,
    newsletter: raw.newsletter,
    navigation: raw.navigation ?? ['Home', 'Services', 'About', 'Contact'],
    pages: normalizePages(raw.pages, rootLayout),
  };
}

/**
 * Clean up the `pages` array the model returned. Guarantees there's always
 * a `home` page with a valid layout — if Claude produced garbage, we fall
 * back to a single-page site whose home page uses the root layout.
 *
 * Validation per page:
 *   - slug must be URL-safe; coerced through slugify(). Falls back to a
 *     generated one if the slug becomes empty after cleaning.
 *   - layout must be a non-empty array of valid block keys; defaults to
 *     `['nav','hero','contact','footer']` if invalid.
 *   - title is trimmed to 100 chars.
 */
function normalizePages(
  raw: WebsiteConfig['pages'] | undefined,
  rootLayout: SiteBlockKey[],
): WebsiteConfig['pages'] | undefined {
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    // Single-page site — no `pages` array needed. The renderer falls back
    // to the root layout automatically.
    return undefined;
  }

  const validBlockKeys: SiteBlockKey[] = [
    'nav',
    'hero',
    'stats',
    'services',
    'about',
    'gallery',
    'reviews',
    'faq',
    'contact',
    'footer',
    'menu',
    'priceList',
    'team',
    'schedule',
    'serviceAreas',
    'beforeAfter',
    'trustBadges',
    'cta',
    'custom',
    'products',
    'portfolio',
    'process',
    'pricingTiers',
    'announcement',
    'logoStrip',
    'video',
    'newsletter',
  ];

  const seenSlugs = new Set<string>();
  const pages: NonNullable<WebsiteConfig['pages']> = [];

  for (const rawPage of raw.slice(0, 4)) {
    if (!rawPage || typeof rawPage !== 'object') continue;

    let slug = slugify(String(rawPage.slug ?? ''));
    if (!slug) slug = pages.length === 0 ? 'home' : `page-${pages.length + 1}`;
    if (seenSlugs.has(slug)) continue; // no duplicates
    seenSlugs.add(slug);

    const title = String(rawPage.title ?? '').trim().slice(0, 100) || toTitleCase(slug);

    const rawLayout = Array.isArray(rawPage.layout) ? rawPage.layout : [];
    const layout = rawLayout.filter((k: unknown): k is SiteBlockKey =>
      validBlockKeys.includes(k as SiteBlockKey),
    );
    // Every page must start with nav and end with footer. Enforce that
    // even if Claude forgot — otherwise the page has no nav/footer and
    // looks broken.
    if (layout[0] !== 'nav') layout.unshift('nav');
    if (layout[layout.length - 1] !== 'footer') layout.push('footer');

    pages.push({
      slug,
      title,
      meta:
        rawPage.meta && typeof rawPage.meta === 'object'
          ? {
              title: rawPage.meta.title,
              description: rawPage.meta.description,
            }
          : undefined,
      layout,
      hero: rawPage.hero ?? undefined,
      blocks: rawPage.blocks ?? undefined,
    });
  }

  // Must have at least one page, and the first must be `home`. If we lost
  // the home page during validation, synthesize one from the root layout
  // so the site still renders.
  if (pages.length === 0 || !pages.some((p) => p.slug === 'home')) {
    pages.unshift({
      slug: 'home',
      title: 'Home',
      layout: rootLayout,
    });
  }

  // Single-page case: if the only page is Home and its layout matches the
  // root layout exactly, skip `pages` altogether to keep the payload lean.
  if (pages.length === 1 && pages[0]!.slug === 'home') {
    return undefined;
  }

  return pages;
}

/** "practice-areas" → "Practice Areas". Used to derive a nav title from a slug. */
function toTitleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
 * Turn the seeded-facts subset of `GenerateWebsiteArgs` into a
 * human-readable block Claude can consume as authoritative context.
 * These aren't suggestions — they're facts the agency has typed in.
 *
 * Returns undefined when nothing was seeded so we don't pad the prompt
 * with an empty section.
 */
function buildSeededFacts(args: GenerateWebsiteArgs): string | undefined {
  const lines: string[] = [];
  if (args.address) lines.push(`Address: ${args.address}`);
  if (args.phone) lines.push(`Phone: ${args.phone}`);
  if (args.whatsapp) lines.push(`WhatsApp: ${args.whatsapp}`);
  if (args.email) lines.push(`Email: ${args.email}`);
  if (args.hours) lines.push(`Opening hours:\n${args.hours}`);

  if (args.socials) {
    const socialLines = Object.entries(args.socials)
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => `  ${k}: ${v}`);
    if (socialLines.length > 0) {
      lines.push(`Social links:\n${socialLines.join('\n')}`);
    }
  }

  if (args.team && args.team.length > 0) {
    lines.push(
      `Team members (use these EXACTLY — do not invent):\n` +
        args.team
          .map(
            (m, i) =>
              `  [${i}] ${m.name} — ${m.role}` +
              (m.credentials ? ` (${m.credentials})` : '') +
              (m.specialties?.length ? ` · specialties: ${m.specialties.join(', ')}` : '') +
              (m.bio ? `\n      bio: ${m.bio}` : ''),
          )
          .join('\n'),
    );
  }

  if (args.serviceAreas && args.serviceAreas.length > 0) {
    lines.push(`Service areas: ${args.serviceAreas.join(', ')}`);
  }

  if (args.trustBadges && args.trustBadges.length > 0) {
    lines.push(
      `Trust badges / credentials:\n` +
        args.trustBadges
          .map((b) => `  - ${b.label}${b.detail ? ` — ${b.detail}` : ''}`)
          .join('\n'),
    );
  }

  return lines.length > 0 ? lines.join('\n\n') : undefined;
}

/**
 * Stamp seeded facts onto the final config AFTER Claude has run. Claude
 * gets told about these facts in the prompt so it can write copy that's
 * consistent with them, but we can't trust it to not paraphrase or
 * invent. Overwriting at the end guarantees the facts on the rendered
 * site match exactly what the agency typed.
 *
 * Safe to call with no seeded facts — any missing field is a no-op.
 */
function applySeededFacts(config: WebsiteConfig, args: GenerateWebsiteArgs): void {
  const hasContactFacts =
    args.address || args.phone || args.email || args.hours || args.whatsapp;
  if (hasContactFacts) {
    config.contact = {
      heading: config.contact?.heading ?? 'Get in touch',
      body: config.contact?.body ?? '',
      eyebrow: config.contact?.eyebrow,
      showBookingForm: config.contact?.showBookingForm ?? true,
      showHours: config.contact?.showHours ?? Boolean(args.hours),
      ...(args.address ? { address: args.address } : {}),
      ...(args.phone ? { phone: args.phone } : {}),
      ...(args.email ? { email: args.email } : {}),
      ...(args.hours ? { hours: args.hours } : {}),
      ...(args.whatsapp ? { whatsapp: args.whatsapp } : {}),
    };
  }

  if (args.socials && Object.values(args.socials).some(Boolean)) {
    config.socials = { ...(config.socials ?? {}), ...args.socials };
  }

  if (args.team && args.team.length > 0) {
    config.team = {
      eyebrow: config.team?.eyebrow ?? 'The team',
      heading: config.team?.heading ?? 'Meet the people.',
      members: args.team.map((m) => ({
        name: m.name,
        role: m.role,
        bio: m.bio,
        credentials: m.credentials,
        specialties: m.specialties,
        photoUrl: m.photoUrl,
      })),
    };
    if (!config.layout?.includes('team')) {
      config.layout = insertBeforeFooter(config.layout ?? [], 'team');
    }
  }

  if (args.serviceAreas && args.serviceAreas.length > 0) {
    config.serviceAreas = {
      eyebrow: config.serviceAreas?.eyebrow ?? 'Where we work',
      heading: config.serviceAreas?.heading ?? 'Serving these areas.',
      areas: args.serviceAreas,
      footnote: config.serviceAreas?.footnote,
    };
    if (!config.layout?.includes('serviceAreas')) {
      config.layout = insertBeforeFooter(config.layout ?? [], 'serviceAreas');
    }
  }

  if (args.trustBadges && args.trustBadges.length > 0) {
    config.trustBadges = {
      eyebrow: config.trustBadges?.eyebrow ?? 'Credentials',
      heading: config.trustBadges?.heading ?? 'Qualified and insured.',
      badges: args.trustBadges.map((b) => ({
        label: b.label,
        detail: b.detail,
        href: b.href,
      })),
    };
    if (!config.layout?.includes('trustBadges')) {
      config.layout = insertBeforeFooter(config.layout ?? [], 'trustBadges');
    }
  }

  if (args.whatsapp && !config.mobileCta?.showWhatsApp) {
    config.mobileCta = {
      ...(config.mobileCta ?? {}),
      showWhatsApp: true,
    };
  }
}

/** Insert a block key into a layout just before the footer. */
function insertBeforeFooter(layout: SiteBlockKey[], key: SiteBlockKey): SiteBlockKey[] {
  const idx = layout.indexOf('footer');
  if (idx < 0) return [...layout, key];
  return [...layout.slice(0, idx), key, ...layout.slice(idx)];
}

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
    mobileCta: {
      primaryLabel: 'Book now',
      primaryHref: '#contact',
      showCall: true,
      showWhatsApp: false,
    },
    navigation: ['Home', 'Services', 'About', 'Reviews', 'Contact'],
  };
}
