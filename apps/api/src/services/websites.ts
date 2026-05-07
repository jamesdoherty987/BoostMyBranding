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
import type {
  WebsiteConfig,
  SiteTemplate,
  HeroVariant,
  SiteBlockKey,
  HeroIllustration,
  HeroIllustrationStyle,
  HeroIllustrationMotion,
} from '@boost/core';
import {
  DEFAULT_LAYOUT,
  DEFAULT_HERO_VARIANT,
  HERO_VARIANTS,
  DEFAULT_ILLUSTRATION_BY_TEMPLATE,
  ILLUSTRATION_STYLES,
  TEMPLATE_PERSONALITY,
  hashString,
  slugify,
} from '@boost/core';
import { generateJSON } from './claude.js';
import { scrapeWebsite } from './scraper.js';
import { websiteConfigPrompt } from './prompts.js';
import { withRetry, isDefaultRetryable } from './retry.js';
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
  /**
   * Optional override for the design-signature seed. By default we hash
   * the business name so regenerations are stable. Pass a different
   * string (e.g. Date.now().toString()) when the agency wants a fresh
   * look — "surprise me" / "try another style".
   */
  designSeed?: string;

  /**
   * Optional model override. Defaults to Opus for full-site generation
   * (best quality for a one-time, high-stakes operation). Override to
   * Sonnet / Haiku for speed / cost savings.
   */
  model?: 'opus' | 'sonnet' | 'haiku';

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

  /* ── Extras — "nice to have" facts that make copy more specific ───── */

  /** Year the business was founded. Drives "Serving since …" style copy. */
  yearFounded?: string;
  /** Awards / recognitions received. Free-form short labels. */
  awards?: string[];
  /** Press / media mentions (outlet names, optionally with URLs). */
  pressMentions?: Array<{ outlet: string; quote?: string; href?: string }>;
  /** Certifications / professional memberships separate from trust badges. */
  certifications?: string[];
  /** Languages the business speaks with customers. */
  languagesSpoken?: string[];
  /** Accepted payment methods. */
  paymentMethods?: string[];
  /** Insurance coverage summary. */
  insuranceDetails?: string;
  /** Unique selling points — short punchy differentiators. */
  uniqueSellingPoints?: string[];
  /** Who the business targets (persona description). */
  targetAudience?: string;
  /** How the business positions vs competitors (one or two sentences). */
  competitivePositioning?: string;
  /** Vibe / inspiration links — other sites or moodboards to echo. */
  inspirationLinks?: string[];
  /**
   * Per-image role tagging. Maps an image URL from the client's library
   * to one or more role tags ("hero", "gallery", "about", "portfolio",
   * "team", "product") so the generator knows where to place each one.
   * When empty, the AI distributes images freely.
   */
  mediaTags?: Record<string, string[]>;
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

  // 2. Gather image hints. We pass up to 20 so Claude can populate
  // gallery / portfolio / team / products / before-after from the full
  // library rather than only the top 8. The ones that don't make it
  // into any config field still show up as "available" in the dashboard
  // picker so the agency can swap them in by hand.
  const images = await db
    .select()
    .from(clientImages)
    .where(eq(clientImages.clientId, client.id))
    .orderBy(desc(clientImages.qualityScore))
    .limit(20);
  const imageDescriptions =
    images.length > 0
      ? images
          .map(
            (img, idx) =>
              `[${idx}] ${img.aiDescription ?? img.fileName ?? 'photo'}${
                img.qualityScore ? ` (score ${img.qualityScore})` : ''
              }${img.tags && img.tags.length > 0 ? ` · tags: ${img.tags.join(', ')}` : ''}`,
          )
          .join('\n')
      : undefined;

  // Media profile — a structured summary of what visual content is
  // available. Drives the generator's section-selection rules so we
  // don't emit e.g. a Gallery with two tiles or a Portfolio with no
  // project photos. Claude reads this alongside imageDescriptions and
  // uses it as authoritative "these are the media you actually have".
  const mediaProfile = buildMediaProfile(images);
  const mediaProfileSummary = formatMediaProfile(mediaProfile);

  // Template still passed as a HINT — Claude is free to pick a better one.
  const templateHint = args.template ?? inferTemplate(client.industry);

  // Build a template-specific design signature so every site has a
  // distinct visual flavour. Two plumbers shouldn't look identical —
  // the hash picks different hero variants for different business names
  // from the curated per-template shortlists. Pass `designSeed` to
  // force a new pick on regeneration ("surprise me").
  const designSignature = buildDesignSignature(
    templateHint,
    args.designSeed || client.businessName,
  );

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
    mediaProfile: mediaProfileSummary,
    template: templateHint,
    suggestions: args.suggestions,
    seededFacts: buildSeededFacts(args, (url) => {
      const idx = images.findIndex((img) => img.fileUrl === url);
      return idx >= 0 ? idx : undefined;
    }),
    designSignature,
  });

  const raw = await withRetry(
    () => generateJSON<Partial<WebsiteConfig>>(prompt, { model: args.model ?? 'opus', maxTokens: 16384 }),
    {
      label: `website_config:${client.id}`,
      attempts: 3,
      retryOn: (err) => err instanceof SyntaxError || isDefaultRetryable(err),
    },
  );

  // Claude picks the template — fall back to the hint if it didn't.
  const chosenTemplate = (raw.template ?? templateHint) as SiteTemplate;
  const config = normalizeConfig(raw, chosenTemplate, { seedIllustration: true });

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
  /**
   * Which Claude model to use. Defaults to `opus` for the full-config
   * editor because the instruction space is huge and Opus handles
   * nuanced edits better. Callers can override (e.g. pass `sonnet`
   * for a faster / cheaper response when the agency wants speed over
   * absolute quality).
   */
  model?: 'opus' | 'sonnet' | 'haiku';
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
- If asked to change the hero illustration / prop / scroll object / "flying thing" / "rocket-like object", update hero.illustration. Shape: { hidden?, style, motion, side, scale, motionSpeed?, motionIntensity?, customUrl?, customSvg?, prompt? }.
  - hidden: set to true when the user asks to HIDE / TURN OFF / DISABLE the illustration without deleting it. Set to false (or omit) to show it.
  - style (pick one that matches the business): rocket, wrench, coffee-cup, dumbbell, scissors, leaf, house, tooth, pencil, gavel, camera, car, paw, briefcase, shopping-bag, espresso, croissant, pizza-slice, wine-glass, cocktail, ice-cream, cupcake, chef-hat, hair-dryer, lipstick, nail-polish, candle, flower, kettlebell, running-shoe, yoga-pose, stethoscope, pill, heart-pulse, dna, key, couch, lamp, hammer, toolbox, paint-brush, gear, drill, motorcycle, delivery-van, laptop, atom, cpu, gift-box, diamond, book, graduation-cap, apple, palette, film-reel, music-note, tree, mountain, sun, wave, orb, cube-iso, prism, spiral.
  - motion (pick the feel): launch (rocket-style upward flight on scroll), float (gentle bob), drift (diagonal on scroll), orbit (continuous circling), tilt-3d (mouse-follow 3D tilt), parallax (moderate scroll-Y), pulse (gentle breathing scale), spin (slow rotation — best for round shapes like gears, dna, orb), spin-slow (ultra-slow 60s rotation), spin-fast (fast 4s rotation), sway (metronome rotation), swing (pendulum swing from the top — good for hanging objects), wobble (playful jiggle), bounce (rhythmic vertical bounce), jiggle (quick xy + rotate jitter), rubber-band (stretchy scale flex), heartbeat (double-thump scale pulse), orbit-wide (bigger circular path), shake (occasional horizontal shake), zoom-in (scroll-driven scale-up), flip-y (Y-axis flip on mount), reveal (cinematic slide-up with fade), fade-in (scroll-driven opacity), slide-in (enters from off-canvas), fly-left (exits off the left edge on scroll), fly-right (exits off the right), fly-down (falls off the bottom), fly-diag-up (flies off toward the anchored corner top), fly-diag-down (flies off toward anchored corner bottom), none (static).
  - side: left or right. Default right.
  - scale: 0.5 to 1.5 multiplier. Default 1.
  - motionSpeed: 0.25 to 4 multiplier. 1 = default; >1 faster; <1 slower. Only affects keyframe presets (float, orbit, pulse, spin, sway, wobble, bounce).
  - motionIntensity: 0.1 to 3 multiplier. 1 = default; >1 bigger travel; <1 subtler. Applies to all presets.
  - customUrl: set ONLY if the agency explicitly uploaded an image. Don't invent URLs. When set, style is ignored.
  - customSvg: inline SVG markup — set ONLY if the agency pasted/generated one via the SVG Studio. Don't invent markup; changing it here directly is fine for shape tweaks but cannot be created from thin air.
  - prompt: short brief stored alongside the illustration so later edits can reference it.
- If asked to HIDE or TURN OFF the illustration (without fully deleting), set hero.illustration.hidden to true. If asked to SHOW or TURN ON again, set it to false.
- If asked to GENERATE a brand-new bespoke illustration ("draw me a donut for the hero", "generate a new illustration of X", "make it more realistic"), set hero.illustration.prompt to a descriptive brief (so the dedicated Illustration editor picks it up) AND pick the nearest built-in style from the list above as a fallback. Also mention in the summary that the user should click "Generate" in the Illustration editor to actually render the bespoke image. Do NOT invent a customUrl — image generation is a separate endpoint.
- If asked to remove the hero illustration, set hero.illustration to null (or remove the field entirely).
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
- If asked to change a specific stat ("change customers stat to 500", "make the rating 4.9"), update the matching entry in the "stats" array — each stat has {value, prefix, suffix, label}. Don't invent new stats unless asked.
- If asked to update contact info ("change the phone to X", "we moved address", "new email"), update contact.phone / contact.address / contact.email / contact.whatsapp / contact.hours. Keep the same format as the existing value (e.g. keep international phone prefix if already used).
- If asked to change opening hours / "when are we open", update contact.hours as newline-separated lines ("Mon–Fri 9am–6pm\\nSat 10am–3pm"). If also asked to "show hours on the page", set contact.showHours to true.
- If asked to show / hide the booking form, set contact.showBookingForm to true or false.
- If asked to change nav link labels ("rename 'Home' to 'Start'", "add a 'Gallery' nav item"), update the "navigation" array of strings. On multipage sites, page titles take precedence in the nav — rename the page instead.
- If asked to add / change social links ("add our Instagram", "change Facebook URL"), update the "socials" object: {facebook, instagram, tiktok, linkedin, x, youtube, google}. Only set fields that were mentioned — don't invent URLs.
- If asked to change SEO / page title / "what Google shows" / meta description, update "meta": {title, description, keywords[]}. Title ≤60 chars, description ≤160 chars.
- If asked to change a page's SEO individually ("change the About page's meta title"), update pages[N].meta.{title, description}.
- If asked to change the sticky mobile CTA ("change the mobile button to Call", "hide WhatsApp on mobile"), update "mobileCta": {primaryLabel, primaryHref, showCall, showWhatsApp}.
- If asked to change the footer tagline, update footer.tagline (leave blank to reuse brand.tagline).
- If asked to show / hide / remove the announcement bar, toggle "announcement" on or off. To enable: set announcement = {message, tone?, linkLabel?, linkHref?, nonDismissible?}. To remove: set announcement to null.
- If asked to turn the site dark ("dark mode", "dark site", "darken the whole site", "make the site dark"), set brand.siteBackground to "dark". This flips every block's surface from white/slate to a dark panel with light text. It does NOT change the hero — hero has its own dark/light toggle (brand.heroStyle). If the user asks specifically for "dark hero" only, set brand.heroStyle = "dark" instead and leave brand.siteBackground. If the ask is ambiguous ("make it dark"), flip BOTH brand.siteBackground and brand.heroStyle to "dark". Adjust brand.primaryColor / accentColor if the current palette is too dim to read on a dark surface (bump luminance up).
- To revert to a light site, set brand.siteBackground to "light" (or omit).
- If asked to "make the design more minimal" / "more energetic" / "more premium", adjust brand.tone (warm / professional / playful / premium) AND pick a hero variant + colour palette that matches (premium → spotlight/lamp + navy/gold; playful → multicolor/boxes + brighter palette; minimal → hero-highlight/spotlight + neutral palette).
- If asked to add something 3D / immersive / interactive ("add a 3D section", "make it more immersive", "something cool and 3D"), do ALL of the following:
  1. Set servicesSection.variant to "3d-cards" (cards tilt on mouse move).
  2. Set gallery.variant to "3d-marquee" if there's a gallery.
  3. Add a sectionBackgrounds.services entry with kind "particles" or "sparkles" for depth.
  4. Add hero.illustration with motion "tilt-3d" or "scroll-fly-out" so the hero prop feels dimensional too.
  DO NOT invent a new custom section with variant 'feature-row' and call it "3D" — feature-row is a flat layout. The 3D feel comes from the tilt-on-mouse variants and the particle/sparkle backdrops.
- If asked to regenerate the AI hero PHOTO / background image / "hero photo" (different from the SVG illustration above), set hero.aiImagePrompt to a new descriptive prompt and leave hero.aiImageUrl null — the backend regenerates the actual image separately. Don't invent URLs.
- If asked to feature ALL items in a block ("feature every review"), set every item's .featured to true. If asked to unfeature everything, set every .featured to false.
- If asked to add a decorative background to a specific SECTION (not the hero — hero has its own variant system) like "add a grid background to the services section", "put dots behind the reviews", "add particles to the FAQ", "meteors behind the CTA", update "sectionBackgrounds" — a map of block key → { kind, opacity?, tint? }. Valid kinds: none, grid, dots, noise, gradient, mesh, particles, sparkles, meteors, beams, ripple, shooting-stars. The tint defaults to the brand primary — only set it when the user explicitly asks for a colour ("purple particles behind the team"). The opacity is 0–1; sensible defaults are already baked in so you usually just set the kind. Block keys to target: services, about, gallery, reviews, faq, contact, menu, priceList, team, schedule, serviceAreas, beforeAfter, trustBadges, cta, products, portfolio, process, pricingTiers, logoStrip, video, newsletter, custom.
- If asked to REMOVE a section background ("take off the grid from the services"), set sectionBackgrounds.<block>.kind to "none" OR delete the entry entirely.
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
      // Default to Opus (best quality for nuanced edits across the full
      // config). Callers can override to Sonnet / Haiku for faster /
      // cheaper edits when the instruction is small.
      model: args.model ?? 'opus',
      // Max output for claude-opus-4-7. Full WebsiteConfigs with a
      // populated menu / team / reviews can easily exceed 5k tokens and
      // get truncated, which throws `JSON.parse` downstream.
      maxTokens: 16384,
      temperature: 0.3,
    }),
    {
      label: `edit_website:${args.clientId}`,
      attempts: 3,
      // JSON.parse SyntaxErrors from truncated Claude output are
      // worth retrying — they resolve on the next attempt because
      // Claude's output is non-deterministic and often fits the
      // token budget on a second try.
      retryOn: (err) => {
        const anyErr = err as any;
        if (err instanceof SyntaxError) return true;
        const status: number | undefined = anyErr?.status ?? anyErr?.response?.status;
        const code: string | undefined = anyErr?.code ?? anyErr?.name;
        if (status) return status === 429 || (status >= 500 && status < 600);
        if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'AbortError') return true;
        if (anyErr?.message && /timeout|rate limit|overloaded/i.test(anyErr.message)) {
          return true;
        }
        return false;
      },
    },
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
 * AI-powered page generator. Given an existing site config and a natural
 * language brief ("an About page with our story", "a Menu page for the
 * espresso drinks and seasonal specials"), produce a fully populated
 * PageConfig and append it to the site's `pages` array.
 *
 * Unlike the bare "duplicate the home layout" approach, this runs the
 * brief through Claude with the full current config so the new page has:
 *   - a page-specific hero (headline, subhead, CTA)
 *   - a layout picked for what the page is ABOUT (not a copy of home)
 *   - real per-page block data (menu items, team members, prices etc.)
 *   - matching brand voice, colours, and tone
 *
 * When the site is currently single-page (no `pages` array), we also
 * synthesize a Home PageConfig from the root layout so the nav can
 * switch between Home and the new page. The renderer falls back to
 * root data for anything the page doesn't override.
 */
export async function generateWebsitePage(args: {
  clientId: string;
  currentConfig: Record<string, any>;
  /** Natural-language description of what the page is for / should show. */
  brief: string;
  /** Optional agency-provided title hint (e.g. "Menu"). Claude may override. */
  titleHint?: string;
  /** Optional model override. Defaults to `opus` — page generation is one-time + high stakes. */
  model?: 'opus' | 'sonnet' | 'haiku';
}): Promise<{
  config: WebsiteConfig;
  page: NonNullable<WebsiteConfig['pages']>[number];
  summary: string;
}> {
  if (!isDbConfigured()) {
    throw new Error('Database not configured');
  }
  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, args.clientId));
  if (!client) throw new Error('Client not found');

  const currentConfig = args.currentConfig as Partial<WebsiteConfig>;
  const existingPages = (currentConfig.pages ?? []) as NonNullable<
    WebsiteConfig['pages']
  >;
  const existingSlugs = new Set(existingPages.map((p) => p.slug));
  // Even a single-page site has a reserved 'home' slug.
  existingSlugs.add('home');

  // 4 pages max including home. When the site is currently single-page
  // (no pages array), we have 1 implicit home page, so the ceiling is 3
  // additional; otherwise pages.length already includes home.
  const currentPageCount = existingPages.length === 0 ? 1 : existingPages.length;
  if (currentPageCount >= 4) {
    throw new Error('Maximum 4 pages reached. Remove one to add another.');
  }

  // Pull fresh image rows so the generator can reference real indices.
  const images = await db
    .select()
    .from(clientImages)
    .where(eq(clientImages.clientId, client.id))
    .orderBy(desc(clientImages.qualityScore))
    .limit(30);
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

  // Mock mode — without Claude we can't generate real content, but we
  // can at least return a sensibly-named skeleton so the UI path still
  // works offline.
  if (!features.claude) {
    const slug = generateUniqueSlug(
      args.titleHint ?? args.brief ?? 'new-page',
      existingSlugs,
    );
    const title = args.titleHint
      ? args.titleHint.trim().slice(0, 80)
      : toTitleCase(slug);

    const mockPage: NonNullable<WebsiteConfig['pages']>[number] = {
      slug,
      title,
      layout: ['nav', 'hero', 'services', 'contact', 'footer'],
      hero: {
        headline: title,
        subheadline: args.brief.slice(0, 200),
      },
    };

    const { config: newConfig, createdHome } = appendPageToConfig(
      currentConfig,
      mockPage,
    );

    return {
      config: newConfig,
      page: mockPage,
      summary: createdHome
        ? `Mock mode: stubbed "${title}" — site converted to multipage (Home + "${title}").`
        : `Mock mode: stubbed a "${title}" page. Connect Claude for full AI-generated content.`,
    };
  }

  const { websitePagePrompt } = await import('./prompts.js');
  const prompt = websitePagePrompt({
    businessName: client.businessName,
    industry: client.industry ?? 'Local Business',
    currentConfigJson: JSON.stringify(stripHeavyFieldsForContext(currentConfig)),
    pageBrief: args.brief,
    titleHint: args.titleHint,
    imageDescriptions,
    existingSlugs: Array.from(existingSlugs),
  });

  const rawPage = await withRetry(
    () =>
      generateJSON<Partial<NonNullable<WebsiteConfig['pages']>[number]>>(
        prompt,
        { model: args.model ?? 'opus', maxTokens: 16384, temperature: 0.6 },
      ),
    {
      label: `generate_page:${client.id}`,
      attempts: 3,
      retryOn: (err) => err instanceof SyntaxError || isDefaultRetryable(err),
    },
  );

  const page = validateGeneratedPage(rawPage, existingSlugs);

  const { config: newConfig, createdHome } = appendPageToConfig(
    currentConfig,
    page,
  );

  // Persist.
  await db
    .update(clients)
    .set({
      websiteConfig: newConfig,
      websiteGeneratedAt: new Date(),
    })
    .where(eq(clients.id, client.id));

  const contentBlockCount = Math.max(
    0,
    page.layout.filter((k) => k !== 'nav' && k !== 'footer').length,
  );

  const summary = createdHome
    ? `Added "${page.title}" page — also converted the site to multipage (Home + "${page.title}").`
    : `Added "${page.title}" page with ${contentBlockCount} content block${
        contentBlockCount === 1 ? '' : 's'
      }.`;

  return { config: newConfig, page, summary };
}

/**
 * Append a newly-generated PageConfig to the site's pages array. When the
 * site is currently single-page (no pages array), synthesize a Home entry
 * from the root layout first so both pages exist in `pages` and routing /
 * nav / preview tabs all work.
 */
function appendPageToConfig(
  currentConfig: Partial<WebsiteConfig>,
  newPage: NonNullable<WebsiteConfig['pages']>[number],
): {
  config: WebsiteConfig;
  createdHome: boolean;
} {
  const template = (currentConfig.template ?? 'service') as SiteTemplate;
  const rootLayout =
    currentConfig.layout && currentConfig.layout.length > 0
      ? currentConfig.layout
      : DEFAULT_LAYOUT[template];

  const existingPages = (currentConfig.pages ?? []) as NonNullable<
    WebsiteConfig['pages']
  >;

  let createdHome = false;
  let nextPages: NonNullable<WebsiteConfig['pages']>;
  if (existingPages.length === 0) {
    // Convert single-page to multipage. Synthesize a Home entry from the
    // current root layout so the nav / preview tabs can switch pages.
    createdHome = true;
    nextPages = [
      {
        slug: 'home',
        title: 'Home',
        layout: rootLayout,
      },
      newPage,
    ];
  } else {
    nextPages = [...existingPages, newPage];
  }

  // Normalize the whole config so any missing fields get sensible defaults.
  // We want the returned config to be complete & safe — the editor renders
  // it immediately and expects every field present.
  const merged = { ...currentConfig, pages: nextPages } as Partial<WebsiteConfig>;
  return {
    config: normalizeConfig(merged, template),
    createdHome,
  };
}

/**
 * Validate and clean a page returned by Claude. Guarantees slug / title /
 * layout are present and safe; falls back to sensible defaults when
 * fields are missing or invalid.
 */
function validateGeneratedPage(
  raw: Partial<NonNullable<WebsiteConfig['pages']>[number]> | null | undefined,
  existingSlugs: Set<string>,
): NonNullable<WebsiteConfig['pages']>[number] {
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

  const slug = generateUniqueSlug(
    String(raw?.slug ?? raw?.title ?? 'new-page'),
    existingSlugs,
  );
  const title =
    String(raw?.title ?? '').trim().slice(0, 100) || toTitleCase(slug);

  const rawLayout = Array.isArray(raw?.layout) ? raw!.layout : [];
  let layout = rawLayout.filter((k: unknown): k is SiteBlockKey =>
    validBlockKeys.includes(k as SiteBlockKey),
  );
  if (layout.length === 0) {
    layout = ['nav', 'hero', 'services', 'contact', 'footer'];
  }
  if (layout[0] !== 'nav') layout = ['nav', ...layout];
  if (layout[layout.length - 1] !== 'footer') layout = [...layout, 'footer'];

  return {
    slug,
    title,
    meta:
      raw?.meta && typeof raw.meta === 'object'
        ? {
            title: raw.meta.title,
            description: raw.meta.description,
          }
        : undefined,
    layout,
    hero: raw?.hero ?? undefined,
    blocks: raw?.blocks ?? undefined,
  };
}

/**
 * Slugify a string and guarantee uniqueness against a set of taken slugs.
 * Appends -2, -3, etc. when the base slug is taken. Also refuses to
 * return 'home' — the home slug is reserved for the synthesised homepage
 * entry and overwriting it would wipe the site's landing page.
 */
function generateUniqueSlug(
  source: string,
  existingSlugs: Set<string>,
): string {
  let base = slugify(source);
  if (!base || base === 'home') base = 'page';
  if (!existingSlugs.has(base)) return base;
  let i = 2;
  while (existingSlugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/**
 * Slim down the current config for inclusion in the prompt context.
 * The full config blob can exceed the model's context window once it
 * has 20+ reviews, a full menu, and every block populated — we keep
 * the fields that drive voice / brand / tone and strip the ones that
 * would only bloat the prompt without adding signal.
 */
function stripHeavyFieldsForContext(
  config: Partial<WebsiteConfig>,
): Partial<WebsiteConfig> {
  const copy = JSON.parse(JSON.stringify(config)) as Partial<WebsiteConfig>;
  // Trim large arrays to their first ~6 entries so the prompt stays compact.
  if (Array.isArray(copy.reviews) && copy.reviews.length > 6) {
    copy.reviews = copy.reviews.slice(0, 6);
  }
  if (Array.isArray(copy.faq) && copy.faq.length > 6) {
    copy.faq = copy.faq.slice(0, 6);
  }
  if (Array.isArray(copy.services) && copy.services.length > 8) {
    copy.services = copy.services.slice(0, 8);
  }
  if (copy.gallery?.imageIndices && copy.gallery.imageIndices.length > 10) {
    copy.gallery = {
      ...copy.gallery,
      imageIndices: copy.gallery.imageIndices.slice(0, 10),
    };
  }
  // Pages already include their own big payloads — we don't need full
  // nested page blocks for context, just the metadata.
  if (Array.isArray(copy.pages)) {
    copy.pages = copy.pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      layout: p.layout,
      // Strip out per-page heavy blocks from context; keep hero so
      // Claude can see the existing hero tone.
      hero: p.hero,
    })) as WebsiteConfig['pages'];
  }
  return copy;
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
      websiteConfig: sanitizeForSave(args.config) as any,
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

  const sanitized = sanitizeForSave(next);

  await db
    .update(clients)
    .set({ websiteConfig: sanitized as any, websiteGeneratedAt: new Date() })
    .where(eq(clients.id, args.clientId));

  return sanitized as WebsiteConfig;
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
 * Defensively clean a config before persisting. The editor can generate
 * corrupted configs through two paths that `setPath` alone can't fix:
 *
 *   1. Deletes. When the UI removes `services[1]`, the array serializes
 *      to `[{...}, null, {...}]` rather than contracting. Downstream the
 *      renderer crashes on `service.title`.
 *
 *   2. Imported legacy JSON. Older configs sometimes have `null` entries
 *      from hand-edits, which break the same way.
 *
 * Walking every list on save is cheap (configs are small), so we do it
 * unconditionally. Plain objects are passed through but recursed — their
 * keys may themselves hold arrays that need filtering.
 *
 * The pages array is treated as authoritative about its own slug-unique
 * invariants; duplicates are de-duplicated keeping the first occurrence
 * so the routing layer never sees two pages at the same slug.
 */
function sanitizeForSave<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    const cleaned = value
      .filter((v) => v !== null && v !== undefined)
      .map((v) => sanitizeForSave(v));
    return cleaned as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Keep empty strings — they're user-intentional (clearing a field).
      // Drop undefined (which JSON would swallow anyway).
      if (v === undefined) continue;
      out[k] = sanitizeForSave(v);
    }

    // Pages must have unique slugs so the page-by-slug lookup is deterministic.
    if (Array.isArray((out as any).pages)) {
      const seen = new Set<string>();
      (out as any).pages = ((out as any).pages as Array<Record<string, unknown>>).filter(
        (p) => {
          const slug = typeof p.slug === 'string' ? p.slug : null;
          if (!slug) return false;
          if (seen.has(slug)) return false;
          seen.add(slug);
          return true;
        },
      );
    }

    return out as T;
  }
  return value;
}

/**
 * Normalize a raw model response into a complete `WebsiteConfig`. Fills in
 * sensible defaults for any missing field so the renderer never sees a
 * partial config. Also validates the `pages` array — Claude occasionally
 * returns a page with an invalid slug or missing layout, which we
 * sanitize here rather than crashing in the renderer.
 */
function normalizeConfig(
  raw: Partial<WebsiteConfig>,
  template: SiteTemplate,
  options: { seedIllustration?: boolean } = {},
): WebsiteConfig {
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
      illustration: normalizeIllustration(
        raw.hero?.illustration,
        template,
        options.seedIllustration ?? false,
      ),
    },
    about: raw.about
      ? {
          eyebrow: raw.about.eyebrow,
          heading: raw.about.heading ?? 'About us',
          body: raw.about.body ?? '',
          bullets: raw.about.bullets,
          imageIndex: raw.about.imageIndex ?? null,
          secondaryImageIndex: raw.about.secondaryImageIndex ?? null,
          secondaryImageUrl: raw.about.secondaryImageUrl ?? null,
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
 * Ensure the hero illustration the model/agency supplied is valid. Every
 * field is optional, and unknown values fall back to safe defaults. When
 * `raw` is undefined we return undefined (no illustration) — a fresh
 * generation opts in via `seedDefaultIfMissing = true` so new sites get
 * one automatically, but AI edits or field saves on existing configs
 * don't suddenly sprout an illustration out of nowhere.
 */
function normalizeIllustration(
  raw: HeroIllustration | undefined,
  template: SiteTemplate,
  seedDefaultIfMissing = false,
): HeroIllustration | undefined {
  if (!raw && !seedDefaultIfMissing) return undefined;

  const validStyleIds = new Set<HeroIllustrationStyle>(
    ILLUSTRATION_STYLES.map((s) => s.id),
  );
  const validMotion: HeroIllustrationMotion[] = [
    'launch',
    'float',
    'drift',
    'orbit',
    'tilt-3d',
    'parallax',
    'pulse',
    'spin',
    'sway',
    'wobble',
    'zoom-in',
    'flip-y',
    'bounce',
    'shake',
    'reveal',
    'fade-in',
    'slide-in',
    'none',
  ];

  const fallbackStyle: HeroIllustrationStyle =
    DEFAULT_ILLUSTRATION_BY_TEMPLATE[template] ?? 'rocket';

  const customUrl =
    typeof raw?.customUrl === 'string' && raw.customUrl.trim()
      ? raw.customUrl.trim()
      : undefined;

  // When a custom image is supplied we don't carry a built-in style —
  // precedence rules in the renderer would ignore it anyway.
  const style = customUrl
    ? undefined
    : raw?.style && validStyleIds.has(raw.style as HeroIllustrationStyle)
      ? (raw.style as HeroIllustrationStyle)
      : fallbackStyle;

  const motion =
    raw?.motion && validMotion.includes(raw.motion) ? raw.motion : undefined;

  const side = raw?.side === 'left' ? 'left' : 'right';

  const scale =
    typeof raw?.scale === 'number' && Number.isFinite(raw.scale)
      ? Math.max(0.5, Math.min(1.5, raw.scale))
      : 1;

  const prompt =
    typeof raw?.prompt === 'string' ? raw.prompt.slice(0, 500) : undefined;

  const hidden = raw?.hidden === true ? true : undefined;

  const motionSpeed =
    typeof raw?.motionSpeed === 'number' && Number.isFinite(raw.motionSpeed)
      ? Math.max(0.25, Math.min(4, raw.motionSpeed))
      : undefined;

  const motionIntensity =
    typeof raw?.motionIntensity === 'number' && Number.isFinite(raw.motionIntensity)
      ? Math.max(0.1, Math.min(3, raw.motionIntensity))
      : undefined;

  // customSvg is sanitised when it enters the system via /generate-svg
  // and /sanitize-svg. We accept whatever the DB already has — it's
  // trusted because we put it there. Length cap as a simple guard.
  const customSvg =
    typeof raw?.customSvg === 'string' && raw.customSvg.trim().length > 0
      ? raw.customSvg.slice(0, 200_000)
      : undefined;

  return {
    hidden,
    style,
    motion,
    side,
    scale,
    customUrl,
    prompt,
    motionSpeed,
    motionIntensity,
    customSvg,
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
  // Events templates — wedding planners, event venues, caterers. Check
  // BEFORE retail so a "wedding boutique" catches events first. Also
  // catches "venue" / "florist" when paired with wedding keywords.
  if (/wedding|event.?plan|venue|florist.*wedding|celebrant|dj|band.*hire|marquee/.test(i))
    return 'events';
  // Home services — landscapers, painters, roofers, builders. Check
  // BEFORE `service` / `retail` so these get their own personality.
  if (/landscap|garden|paint|roof|build(er|ing)?|plast|carpen|floor|kitchen.?fit|bathroom.?fit|tile|extension/.test(i))
    return 'homeservices';
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
  events: { primary: '#7c2d12', accent: '#f5d0a9' },
  homeservices: { primary: '#166534', accent: '#f59e0b' },
};

/**
 * Summarise the client's media library into a small structured profile
 * the generator prompt uses to gate section selection. We classify each
 * image by its AI tags (if present) + description keywords so we can
 * tell Claude: "you have 8 hero-quality photos, 3 before/after pairs,
 * 2 team headshots, no logo" — and the prompt uses those counts to
 * decide whether to emit the matching blocks.
 */
interface MediaProfile {
  total: number;
  /** qualityScore >= 7 */
  heroQuality: number;
  /** qualityScore >= 5 */
  usable: number;
  /** min(before-tagged, after-tagged) — pairable only if both exist */
  beforeAfterPairs: number;
  /** tag "team" OR description mentions staff/person/portrait */
  team: number;
  /** tag "product" OR description mentions product/item */
  product: number;
  /** tag "logo" OR description mentions logo/brand-mark */
  logo: number;
  /** tag "video" OR mime type starts with video/ */
  video: number;
  /** exterior + interior shots of the location */
  location: number;
}

function buildMediaProfile(
  rows: Array<{
    aiDescription: string | null;
    tags: string[] | null;
    qualityScore: number | null;
    mimeType: string | null;
  }>,
): MediaProfile {
  const has = (tags: string[] | null | undefined, t: string): boolean =>
    Array.isArray(tags) && tags.includes(t);

  let heroQuality = 0;
  let usable = 0;
  let before = 0;
  let after = 0;
  let team = 0;
  let product = 0;
  let logo = 0;
  let video = 0;
  let location = 0;

  for (const img of rows) {
    const q = img.qualityScore ?? 0;
    if (q >= 7) heroQuality++;
    if (q >= 5) usable++;
    const d = img.aiDescription ?? '';
    if (has(img.tags, 'before') || /before[- ]and[- ]after|before shot|original state/i.test(d)) before++;
    if (has(img.tags, 'after') || /after shot|finished (job|work)|completed/i.test(d)) after++;
    if (
      has(img.tags, 'team') ||
      /\b(team|staff|owner|founder|barber|stylist|technician|dentist|plumber|chef|therapist|trainer|headshot|portrait)\b/i.test(
        d,
      )
    ) {
      team++;
    }
    if (has(img.tags, 'product') || /\bproduct|item|bottle|package|bouquet|cake\b/i.test(d)) product++;
    if (has(img.tags, 'logo') || /\blogo|brand mark|wordmark\b/i.test(d)) logo++;
    if (has(img.tags, 'video') || (img.mimeType ?? '').startsWith('video/')) video++;
    if (
      has(img.tags, 'exterior') ||
      has(img.tags, 'interior') ||
      has(img.tags, 'location') ||
      /shopfront|exterior|interior|storefront/i.test(d)
    ) {
      location++;
    }
  }

  return {
    total: rows.length,
    heroQuality,
    usable,
    beforeAfterPairs: Math.min(before, after),
    team,
    product,
    logo,
    video,
    location,
  };
}

/**
 * Format the media profile into the human-readable block for the prompt.
 * Keeps the prompt predictable — every number is on its own line so the
 * model can cite exact counts when deciding which blocks to include.
 */
function formatMediaProfile(profile: MediaProfile): string {
  return [
    `Total images: ${profile.total}`,
    `Hero-quality photos (score >= 7): ${profile.heroQuality}`,
    `Usable photos (score >= 5): ${profile.usable}`,
    `Before/after pairs available: ${profile.beforeAfterPairs}`,
    `Team / people shots: ${profile.team}`,
    `Product shots: ${profile.product}`,
    `Logo files: ${profile.logo}`,
    `Video assets: ${profile.video}`,
    `Location (exterior/interior) shots: ${profile.location}`,
  ].join('\n');
}

/**
 * Build the "DESIGN SIGNATURE" block for the prompt from the template
 * personality map. Adds a per-business seed so two sites with the same
 * template pick DIFFERENT hero variants from the curated shortlist —
 * "Murphy's Plumbing" gets parallax-layers, "Swift Gas" gets
 * two-column-image. The rest of the signature (services style, gallery
 * style, stats style, etc.) is template-wide so every plumber's site
 * still feels like a plumber's site.
 *
 * Returns undefined when the template isn't in the map (shouldn't happen
 * given the map covers every SiteTemplate, but kept defensive).
 */
function buildDesignSignature(
  template: SiteTemplate,
  businessName: string,
): string | undefined {
  const personality = TEMPLATE_PERSONALITY[template];
  if (!personality) return undefined;

  const seed = hashString(businessName || template);

  // Seeded pick helper — same business name always maps to the same
  // variant so regenerations stay stable, but different businesses get
  // different looks.
  const pick = <T,>(options: readonly T[], salt: number): T =>
    options[(seed + salt) % options.length]!;

  const heroVariant = pick(personality.heroVariants, 0);
  const servicesVariant = pick(personality.servicesVariants, 1);
  const galleryVariant = pick(personality.galleryVariants, 2);
  const reviewsVariant = pick(personality.reviewsVariants, 3);
  const ctaVariant = pick(personality.ctaVariants, 4);

  // "Mood" rotations — additional seeded choices that push the site
  // further from generic. Three moods per template ensure two sites
  // with the same template but different names actually LOOK
  // different, not just in hero variant but in overall feel.
  const MOODS: Array<{
    name: string;
    directive: string;
  }> = [
    {
      name: 'bold',
      directive:
        'Lean into strong pop colours, dense use of motion, big typography, and a "confident local legend" tone. Use "bento" or "3d-cards" variants where available. Pick a dark heroStyle when the palette supports it.',
    },
    {
      name: 'warm-editorial',
      directive:
        'Lean into calm, editorial layouts. Generous whitespace, softer saturation, long-form copy in about, and a "trusted neighbour" tone. Favour "sticky-scroll", "focus-cards", and "animated-testimonials" variants. Use "typewriter" or "generate" headline effects.',
    },
    {
      name: 'playful-modern',
      directive:
        'Lean into motion and surprise. Use "multicolor" / "boxes" / "vortex" heroes when shortlisted, "draggable" or "masonry" reviews, "apple-carousel" or "3d-marquee" galleries. Use "flip-words" headline effects. Add a small announcement bar for seasonal energy if it makes sense.',
    },
  ];
  const mood = MOODS[seed % MOODS.length]!;

  return `DESIGN SIGNATURE — treat this as authoritative style direction. Use these variants for THIS specific business. The seeded picks below are computed from the business name, so different clients of the same template will ALWAYS get different picks. Do NOT substitute your own "safer" choices.

── VARIANT PICKS (copy these into the matching .variant fields) ──
Hero variant:                   ${heroVariant}
servicesSection.variant:        ${servicesVariant}
gallery.variant:                ${galleryVariant}
reviewsSection.variant:         ${reviewsVariant}
cta.variant:                    ${ctaVariant}
process.variant:                ${personality.processVariant}
statsSection.variant:           ${personality.statsVariant}
team.variant:                   ${personality.teamVariant}
contact.variant:                ${personality.contactVariant}
faqSection.variant:             ${personality.faqVariant}
hero.headlineEffect:            ${personality.headlineEffect}${
    personality.headlineEffect === 'flip-words'
      ? ' (populate hero.flipWords with 3-5 alternatives for the last word)'
      : ''
  }

── SIGNATURE VISUAL FEATURE ──
${personality.signature}
This is the "wow" moment of the site. Build the layout around it so it gets prime real estate — don't bury it below 6 other blocks. Skip blocks that would distract from it.

── PALETTE DIRECTION ──
${personality.paletteHints}

── BRAND TONE ──
${personality.toneWords}

── MOOD (${mood.name}) ──
${mood.directive}

── ANTI-BOILERPLATE ──
Plain is the enemy. Sites that use 3 out of 20 available visual features are indistinguishable from bootstrap templates. For THIS business:
- Use the variant picks above verbatim. Do not substitute "cards" or "grid" for "bento" or "3d-marquee" because those feel safer.
- If the brief fits, add AT LEAST ONE scroll-driven or 3D block (3d-marquee gallery, sticky-scroll services, animated-testimonials reviews, timeline process, container-scroll moment).
- Two cafes should not look the same. Two plumbers should not look the same. A cafe called "The Gas Lantern" and a cafe called "Murphy's" should feel like entirely different brands even though they're both food-template.
- Avoid the default cards-grid-marquee-accordion combo unless the design signature explicitly recommends it.`;
}

/**
 * Turn the seeded-facts subset of `GenerateWebsiteArgs` into a
 * human-readable block Claude can consume as authoritative context.
 * These aren't suggestions — they're facts the agency has typed in.
 *
 * Returns undefined when nothing was seeded so we don't pad the prompt
 * with an empty section.
 */
function buildSeededFacts(
  args: GenerateWebsiteArgs,
  resolveImageIndex?: (url: string) => number | undefined,
): string | undefined {
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

  if (args.yearFounded) lines.push(`Year founded: ${args.yearFounded}`);
  if (args.awards && args.awards.length > 0) {
    lines.push(`Awards / recognitions:\n` + args.awards.map((a) => `  - ${a}`).join('\n'));
  }
  if (args.pressMentions && args.pressMentions.length > 0) {
    lines.push(
      `Press / media mentions:\n` +
        args.pressMentions
          .map((p) => `  - ${p.outlet}${p.quote ? `: "${p.quote}"` : ''}`)
          .join('\n'),
    );
  }
  if (args.certifications && args.certifications.length > 0) {
    lines.push(`Certifications: ${args.certifications.join(', ')}`);
  }
  if (args.languagesSpoken && args.languagesSpoken.length > 0) {
    lines.push(`Languages spoken: ${args.languagesSpoken.join(', ')}`);
  }
  if (args.paymentMethods && args.paymentMethods.length > 0) {
    lines.push(`Payment methods accepted: ${args.paymentMethods.join(', ')}`);
  }
  if (args.insuranceDetails) lines.push(`Insurance: ${args.insuranceDetails}`);
  if (args.uniqueSellingPoints && args.uniqueSellingPoints.length > 0) {
    lines.push(
      `Unique selling points (emphasise these):\n` +
        args.uniqueSellingPoints.map((u) => `  - ${u}`).join('\n'),
    );
  }
  if (args.targetAudience) lines.push(`Target audience: ${args.targetAudience}`);
  if (args.competitivePositioning) {
    lines.push(`Competitive positioning: ${args.competitivePositioning}`);
  }
  if (args.inspirationLinks && args.inspirationLinks.length > 0) {
    lines.push(
      `Inspiration / vibe references (echo their tone, not their copy):\n` +
        args.inspirationLinks.map((l) => `  - ${l}`).join('\n'),
    );
  }
  if (args.mediaTags && Object.keys(args.mediaTags).length > 0) {
    // Map URL → agency-supplied role tags. When we've been handed the
    // full image list upstream we can resolve the URL back to its
    // `[idx]` slot in the AVAILABLE IMAGES block so Claude has a direct
    // reference. Otherwise (index unknown) we still emit the URL so
    // the prompt has the tagging intent, just less precisely.
    const tagLines = Object.entries(args.mediaTags)
      .filter(([, tags]) => tags.length > 0)
      .map(([url, tags]) => {
        const idx = resolveImageIndex
          ? resolveImageIndex(url)
          : undefined;
        const prefix = typeof idx === 'number' ? `[${idx}] ` : '';
        return `  - ${prefix}${url}  →  ${tags.join(', ')}`;
      });
    if (tagLines.length > 0) {
      lines.push(
        `Agency-tagged media roles (place each image in the tagged section; [idx] references AVAILABLE IMAGES above):\n` +
          tagLines.join('\n'),
      );
    }
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


/* ═══════════════════════════════════════════════════════════════════ */
/* Scoped AI edits — cheap, targeted updates to a single top-level key  */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Return value of a scoped AI edit. Only the changed slice of the config
 * comes back from Claude, and the caller gets the already-merged full
 * config alongside.
 */
export interface ScopedEditResult {
  /** The merged config after applying the patch. */
  config: WebsiteConfig;
  /** Short, human-readable summary of what changed. */
  summary: string;
}

/**
 * AI-driven patch to a single top-level config key (e.g. "hero",
 * "brand", "pages.0.hero"). Unlike `editWebsiteWithAI` — which asks
 * Claude to return the ENTIRE WebsiteConfig on every tweak and often
 * exceeds the output token budget on big sites — this builds a compact
 * prompt scoped to one slice of the config and returns just that slice.
 *
 * The endpoint still persists the full merged config so callers don't
 * have to reason about partial updates.
 *
 * Used by:
 *   - The floating "Ask AI" chat in the preview (scope="root")
 *   - The illustration editor's inline tweaks (scope="hero.illustration")
 *
 * When `scope` is undefined we fall back to the full `editWebsiteWithAI`
 * path — for very broad instructions ("redesign the whole site") the
 * scoped path isn't expressive enough.
 */
export async function editWebsiteScopedWithAI(args: {
  clientId: string;
  currentConfig: Record<string, any>;
  instruction: string;
  /** Path into the config to scope the edit. "hero", "brand", "hero.illustration", etc. Undefined = full-config fallback. */
  scope?: string;
  /** Optional model override. Defaults to `sonnet` — scoped edits are small/cheap. */
  model?: 'opus' | 'sonnet' | 'haiku';
}): Promise<ScopedEditResult> {
  // Very broad instructions ("redesign the site", "make it dark") need
  // the full config path — scoped prompts would produce incoherent
  // edits. We sniff for those keywords and delegate upstream.
  const broadKeywords = /(redesign|overhaul|completely|from scratch|rebuild)/i;
  if (!args.scope || broadKeywords.test(args.instruction)) {
    return editWebsiteWithAI(args);
  }

  // Illustration-specific routing. When the agency asks to draw / render
  // / make a MORE REALISTIC version, they want a new bespoke illustration
  // rendered via fal.ai — NOT a different preset style (there's no
  // "realistic" preset). Detect that intent and route to the image
  // generator so the AI can actually produce what the user described.
  if (args.scope === 'hero.illustration') {
    const wantsBespoke =
      /(realistic|photorealistic|photo[- ]?real|render|draw|make.*photo|more.*detail|3d render|sketch|painted|illustrated|detailed|custom image|bespoke|hand[- ]?drawn)/i.test(
        args.instruction,
      );
    if (wantsBespoke) {
      return routeToBespokeIllustration(args);
    }
  }

  const scope = args.scope;
  const scopedValue = getPath(args.currentConfig, scope);

  // When the slice doesn't exist yet, build the prompt with an empty
  // placeholder so Claude creates a new object rather than trying to
  // reference something that isn't there. This makes "enable the hero
  // illustration" work as a first-time creation from the scoped endpoint.
  const effectiveCurrent = scopedValue ?? {};
  const compactCurrent = JSON.stringify(effectiveCurrent, null, 2);
  const brandHint =
    args.currentConfig?.brand && typeof args.currentConfig.brand === 'object'
      ? `Brand palette: primary ${args.currentConfig.brand.primaryColor ?? '?'}, accent ${args.currentConfig.brand.accentColor ?? '?'}, tone ${args.currentConfig.brand.tone ?? '?'}.`
      : '';

  const prompt = `You are a website editor AI. The agency wants to tweak the "${scope}" slice of the site config.

CURRENT VALUE AT "${scope}":
${compactCurrent}

${brandHint}

INSTRUCTION: ${args.instruction}

Apply the change and return ONLY valid JSON with this exact shape:
{
  "value": <the full updated value that replaces the current "${scope}" slice — same JSON shape as the current value>,
  "summary": "<1-2 sentence description of what you changed>"
}

Rules:
- Preserve all existing fields you weren't asked to change.
- Never invent URLs or data that the agency didn't mention.
- When the instruction refers to hero.illustration fields (style, motion, side, scale, motionSpeed, motionIntensity, customUrl, customSvg, prompt), the list of valid values is:
  - style: rocket, wrench, coffee-cup, dumbbell, scissors, leaf, house, tooth, pencil, gavel, camera, car, paw, briefcase, shopping-bag, espresso, croissant, pizza-slice, wine-glass, cocktail, ice-cream, cupcake, chef-hat, hair-dryer, lipstick, nail-polish, candle, flower, kettlebell, running-shoe, yoga-pose, stethoscope, pill, heart-pulse, dna, key, couch, lamp, hammer, toolbox, paint-brush, gear, drill, motorcycle, delivery-van, laptop, atom, cpu, gift-box, diamond, book, graduation-cap, apple, palette, film-reel, music-note, tree, mountain, sun, wave, orb, cube-iso, prism, spiral
  - motion: launch, float, drift, orbit, orbit-wide, tilt-3d, parallax, pulse, heartbeat, spin, spin-slow, spin-fast, sway, swing, wobble, jiggle, rubber-band, bounce, shake, zoom-in, flip-y, reveal, fade-in, slide-in, fly-left, fly-right, fly-down, fly-diag-up, fly-diag-down, none
  - side: left, right
  - scale: number 0.5..1.5
  - motionSpeed: number 0.25..4 (1 = default, higher = faster)
  - motionIntensity: number 0.1..3 (1 = default, higher = bigger travel)
- When the instruction asks to remove the slice entirely, return {"value": null, "summary": "..."}.
- Keep the same JSON shape — don't add new top-level keys to the value.`;

  if (!features.claude) {
    return {
      config: args.currentConfig as WebsiteConfig,
      summary: `Mock mode: would apply "${args.instruction}" to "${scope}".`,
    };
  }

  const result = await withRetry(
    () =>
      generateJSON<{ value: unknown; summary: string }>(prompt, {
        // Default to Sonnet for scoped edits — fast and cheap for small
        // patches. The agency can override to Opus via the chat model
        // picker when a particular edit needs more reasoning.
        model: args.model ?? 'sonnet',
        maxTokens: 2048,
        temperature: 0.3,
      }),
    {
      label: `scoped_edit:${args.clientId}:${scope}`,
      attempts: 3,
      retryOn: (err) => err instanceof SyntaxError || isDefaultRetryable(err),
    },
  );

  // Merge the scoped value back into the full config. `null` means remove.
  const merged = structuredClone(args.currentConfig) as Record<string, any>;
  setPath(merged, scope.split('.'), result.value);

  // Normalize the result using the template from the merged config so
  // sanitize/defaults stay consistent with fresh generations.
  const template = (merged.template ?? 'service') as SiteTemplate;
  const normalized = normalizeConfig(merged as Partial<WebsiteConfig>, template);

  if (isDbConfigured()) {
    const db = getDb();
    await db
      .update(clients)
      .set({ websiteConfig: normalized as any, websiteGeneratedAt: new Date() })
      .where(eq(clients.id, args.clientId));
  }

  return {
    config: normalized,
    summary: result.summary?.slice(0, 500) ?? 'Updated.',
  };
}

/**
 * Read a dotted path out of a nested object. Returns `undefined` when
 * any segment is missing. Mirrors the writer (`setPath`) above.
 */
function getPath(target: unknown, path: string): unknown {
  const segments = path.split('.').filter(Boolean);
  let cursor: any = target;
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = cursor[seg];
  }
  return cursor;
}


/**
 * Route an illustration-scope instruction that asks for bespoke artwork
 * to the fal.ai-backed `generateHeroIllustration` endpoint. Also parses
 * any motion / side / scale hints out of the same instruction so the
 * agency can say "make the coffee cup more realistic and have it move
 * on scroll" in a single message.
 *
 * Returns in the same shape as `editWebsiteScopedWithAI` so the caller
 * doesn't know (or need to know) we routed through a different pipeline.
 */
async function routeToBespokeIllustration(args: {
  clientId: string;
  currentConfig: Record<string, any>;
  instruction: string;
}): Promise<ScopedEditResult> {
  const { generateHeroIllustration } = await import('./heroImage.js');

  // Pull a brief out of the instruction. When the user's message is
  // short (like "make it more realistic"), combine it with the current
  // style hint so Claude's image-prompt writer has something to work
  // with. When the user's message is descriptive on its own, use it
  // directly.
  const currentIllustration = (args.currentConfig.hero?.illustration ?? {}) as {
    style?: string;
    prompt?: string;
  };
  const styleHint = currentIllustration.style
    ? `a ${currentIllustration.style.replace(/-/g, ' ')}`
    : 'a stylised brand object';
  const existingPrompt = currentIllustration.prompt ?? '';
  const brief = args.instruction.length > 40
    ? args.instruction
    : `${existingPrompt ? existingPrompt + '. ' : ''}${styleHint} — ${args.instruction}`;

  const businessName = await getBusinessName(args.clientId);
  const industry = await getIndustry(args.clientId);

  // Kick off the image generation (this also persists hero.illustration
  // with the new customUrl on the client row).
  const genResult = await generateHeroIllustration({
    clientId: args.clientId,
    businessName,
    industry,
    brief,
    primaryColor: args.currentConfig.brand?.primaryColor,
    accentColor: args.currentConfig.brand?.accentColor,
  });

  // Parse motion / side / scale hints from the same instruction — the
  // user often asks for multiple things at once.
  const motionParsed = parseMotionHint(args.instruction);
  const sideParsed = parseSideHint(args.instruction);
  const scaleParsed = parseScaleHint(args.instruction);

  // Re-read the fresh config from the DB (generateHeroIllustration
  // already persisted the customUrl) so we stack our motion/side/scale
  // patch on top without stomping it.
  if (!isDbConfigured()) {
    // Mock path — just build a best-effort response.
    return {
      config: args.currentConfig as WebsiteConfig,
      summary: `Generated a new bespoke illustration: "${brief.slice(0, 80)}${brief.length > 80 ? '…' : ''}"`,
    };
  }
  const db = getDb();
  const [row] = await db
    .select({ websiteConfig: clients.websiteConfig })
    .from(clients)
    .where(eq(clients.id, args.clientId));
  const refreshed = (row?.websiteConfig ?? args.currentConfig) as Partial<WebsiteConfig>;

  const mergedIllustration = {
    ...(refreshed.hero?.illustration ?? {}),
    ...(motionParsed ? { motion: motionParsed } : {}),
    ...(sideParsed ? { side: sideParsed } : {}),
    ...(scaleParsed != null ? { scale: scaleParsed } : {}),
  };

  const next: Partial<WebsiteConfig> = {
    ...refreshed,
    hero: {
      ...(refreshed.hero ?? {
        headline: '',
        subheadline: '',
        imageIndex: null,
        ctaPrimary: { label: '', href: '' },
      }),
      illustration: mergedIllustration,
    } as WebsiteConfig['hero'],
  };

  const template = (refreshed.template ?? 'service') as SiteTemplate;
  const normalized = normalizeConfig(next, template);

  await db
    .update(clients)
    .set({ websiteConfig: normalized as any, websiteGeneratedAt: new Date() })
    .where(eq(clients.id, args.clientId));

  const parts: string[] = [];
  parts.push('Generated a bespoke illustration');
  if (motionParsed) parts.push(`motion → ${motionParsed}`);
  if (sideParsed) parts.push(`side → ${sideParsed}`);
  if (scaleParsed != null) parts.push(`size → ${scaleParsed.toFixed(2)}×`);
  parts.push(genResult.fromMock ? '(mock image — fal.ai not configured)' : '');

  return {
    config: normalized,
    summary: parts.filter(Boolean).join(' · '),
  };
}

/** Parse motion hints out of freeform text. */
function parseMotionHint(text: string): HeroIllustrationMotion | undefined {
  const t = text.toLowerCase();
  if (/tilt[- ]?3d|3d tilt|mouse follow|follow.*cursor/.test(t)) return 'tilt-3d';
  if (/launch|rocket|fly up|shoot up/.test(t)) return 'launch';
  if (/parallax|scroll[- ]?driven|moves? on scroll|scroll motion|scroll effect/.test(t))
    return 'parallax';
  if (/\bdrift|diagonal/.test(t)) return 'drift';
  if (/orbit|circul/.test(t)) return 'orbit';
  if (/\bfloat|gentle bob|bob|hover/.test(t)) return 'float';
  if (/no motion|static|stop moving|don'?t move|stay still/.test(t)) return 'none';
  return undefined;
}

/** Parse side hints ("move it left"). */
function parseSideHint(text: string): 'left' | 'right' | undefined {
  const t = text.toLowerCase();
  if (/on the right|to the right|right side|right hand/.test(t)) return 'right';
  if (/on the left|to the left|left side|left hand/.test(t)) return 'left';
  return undefined;
}

/** Parse scale hints ("bigger / smaller / twice as big"). */
function parseScaleHint(text: string): number | undefined {
  const t = text.toLowerCase();
  if (/much bigger|way bigger|massive/.test(t)) return 1.4;
  if (/bigger|larger|increase/.test(t)) return 1.2;
  if (/much smaller|tiny/.test(t)) return 0.6;
  if (/smaller|shrink/.test(t)) return 0.85;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:x|times|multiplier|scale)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 0.3 && n <= 2.0) {
      return Math.max(0.5, Math.min(1.5, n));
    }
  }
  return undefined;
}

/** Fetch the client's business name. Used by routeToBespokeIllustration. */
async function getBusinessName(clientId: string): Promise<string> {
  if (!isDbConfigured()) return 'Business';
  const db = getDb();
  const [row] = await db
    .select({ businessName: clients.businessName })
    .from(clients)
    .where(eq(clients.id, clientId));
  return row?.businessName ?? 'Business';
}

/** Fetch the client's industry. Used by routeToBespokeIllustration. */
async function getIndustry(clientId: string): Promise<string> {
  if (!isDbConfigured()) return 'Local Business';
  const db = getDb();
  const [row] = await db
    .select({ industry: clients.industry })
    .from(clients)
    .where(eq(clients.id, clientId));
  return row?.industry ?? 'Local Business';
}
