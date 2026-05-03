/**
 * Shared `WebsiteConfig` contract for client-site generation.
 *
 * Both the backend generator (apps/api/src/services/websites.ts) and the
 * shared renderer (packages/ui/src/site) agree on this shape. The renderer
 * walks `layout` in order; any block missing from `layout` simply isn't
 * mounted, and any block listed in `layout` but whose data is absent is
 * skipped without error.
 */

/** Which visual template the site is based on. Drives defaults for colors + layout. */
export type SiteTemplate =
  | 'service'
  | 'food'
  | 'beauty'
  | 'fitness'
  | 'professional'
  | 'retail'
  | 'medical'
  | 'creative'
  | 'realestate'
  | 'education'
  | 'automotive'
  | 'hospitality'
  | 'legal'
  | 'nonprofit'
  | 'tech';

/** Which blocks are rendered, and in what order. */
export type SiteBlockKey =
  | 'nav'
  | 'hero'
  | 'stats'
  | 'services'
  | 'about'
  | 'gallery'
  | 'reviews'
  | 'faq'
  | 'contact'
  | 'footer';

/**
 * High-level hero layout. Each variant is a fundamentally different visual
 * treatment, not just a toggle on the same layout. Claude picks one per
 * business — what feels right for a cafe is not what feels right for a
 * consultancy.
 *
 *   spotlight        — Centered copy, mouse-following spotlight glow.
 *                      Premium, confident. Great for professional / medical.
 *   beams            — Animated SVG beams in brand colors behind centered
 *                      copy. Energetic. Great for fitness / creative.
 *   floating-icons   — Grid of parallax-drifting industry icons/emojis
 *                      behind the copy. Playful. Great for food / beauty.
 *   parallax-layers  — Split layout with a client image that parallaxes
 *                      deep on scroll + accent orbs. Photo-heavy use cases.
 *   gradient-mesh    — Slow-shifting animated gradient mesh, no image needed.
 *                      Minimal + bold. Great for retail / creative / when the
 *                      client has no photos yet.
 */
export type HeroVariant =
  | 'spotlight'
  | 'beams'
  | 'floating-icons'
  | 'parallax-layers'
  | 'gradient-mesh';

/**
 * A single page in a multipage site. `slug` is the URL segment (`about`,
 * `menu`, etc.) — the Home page uses slug `'home'` by convention and is
 * served at the root URL (e.g. `/sites/murphys-plumbing`). Other pages
 * live at `/sites/murphys-plumbing/[slug]`.
 *
 * Each page has its own `layout` (blocks) and its own `hero` override —
 * sub-pages usually want a smaller hero with a different headline
 * ("About us" / "Our services") rather than the homepage's full-bleed
 * marketing hero. `hero` is optional; when omitted, the page shows no
 * hero block at all (typical for a Contact or Menu page).
 */
export interface PageConfig {
  /** URL segment. Use `'home'` for the homepage. Must be URL-safe. */
  slug: string;
  /** Human-readable page title used in the nav and <title>. */
  title: string;
  /** SEO meta for this specific page. Inherits from root meta when omitted. */
  meta?: {
    title?: string;
    description?: string;
  };
  /** Block order for this page. */
  layout: SiteBlockKey[];
  /** Optional per-page hero override — smaller/different than the home hero. */
  hero?: Partial<WebsiteConfig['hero']>;
  /**
   * Page-specific block data. Overrides the root config's block data when
   * rendering this page — e.g. a Menu page might have its own `services`
   * list that differs from the homepage's featured services.
   */
  blocks?: {
    about?: WebsiteConfig['about'];
    stats?: WebsiteConfig['stats'];
    statsSection?: WebsiteConfig['statsSection'];
    servicesSection?: WebsiteConfig['servicesSection'];
    services?: WebsiteConfig['services'];
    gallery?: WebsiteConfig['gallery'];
    reviewsSection?: WebsiteConfig['reviewsSection'];
    reviews?: WebsiteConfig['reviews'];
    faqSection?: WebsiteConfig['faqSection'];
    faq?: WebsiteConfig['faq'];
    contact?: WebsiteConfig['contact'];
    footer?: WebsiteConfig['footer'];
  };
}

export interface WebsiteConfig {
  /** Which visual template to use. Defaults to `service` if omitted. */
  template?: SiteTemplate;

  /** Order of blocks to render. Defaults chosen per template. */
  layout?: SiteBlockKey[];

  meta: {
    title: string;
    description: string;
    keywords: string[];
  };

  brand: {
    tagline: string;
    tone: 'warm' | 'professional' | 'playful' | 'premium';
    /** Main brand color. Used for primary CTAs, headings, and accents. */
    primaryColor: string;
    /** Secondary brand color. Used in gradients and highlights. */
    accentColor: string;
    /** Optional tertiary pop color for the yellow/gold slot. */
    popColor?: string;
    /** Dark neutral for footers and contrast. Defaults to near-black. */
    darkColor?: string;
    /** Whether the hero is dark-on-light or light-on-dark. */
    heroStyle?: 'light' | 'dark';
  };

  hero: {
    headline: string;
    subheadline: string;
    eyebrow?: string;
    ctaPrimary: { label: string; href: string };
    ctaSecondary?: { label: string; href: string };
    /** Index into the provided `images` array. */
    imageIndex: number | null;
    /**
     * Which visual treatment the hero uses. Claude picks one per business.
     * If omitted, falls back to a sensible default for the template.
     */
    variant?: HeroVariant;
    /**
     * Lucide icon names (or emoji strings like "☕") that populate the
     * `floating-icons` variant. 6–10 suggested. Claude chooses icons that
     * represent what the business does.
     */
    floatingIcons?: string[];
    /**
     * AI-generated hero illustration URL. Populated by fal.ai when no
     * client image is suitable for the hero. Used as a fallback image by
     * any variant that supports a hero image (spotlight, parallax-layers).
     */
    aiImageUrl?: string | null;
    /**
     * Prompt that was used (or should be used) to generate `aiImageUrl`.
     * Stored so the agency can regenerate or tweak the image without a
     * full site regeneration.
     */
    aiImagePrompt?: string;
  };

  about?: {
    /** Small uppercase kicker above the heading (e.g. "About us"). */
    eyebrow?: string;
    heading: string;
    body: string;
    bullets?: string[];
    imageIndex?: number | null;
  };

  stats?: Array<{
    value: number;
    suffix?: string;
    prefix?: string;
    label: string;
  }>;

  /**
   * Optional text overrides for the services section's eyebrow/heading/tagline.
   * When omitted, the block falls back to sensible defaults ("What we do" /
   * "Every job, done properly."). Editable inline from the dashboard preview.
   */
  servicesSection?: {
    eyebrow?: string;
    heading?: string;
    tagline?: string;
  };

  services?: Array<{
    title: string;
    description: string;
    /** Lucide icon name (e.g. "Wrench"). Renderer maps unknowns to `Sparkles`. */
    icon: string;
  }>;

  gallery?: {
    eyebrow?: string;
    heading?: string;
    /** Indices into the provided `images` array. */
    imageIndices?: number[];
  };

  /**
   * Optional text overrides for the reviews section's eyebrow/heading.
   * Defaults: "Reviews" / "What customers say.".
   */
  reviewsSection?: {
    eyebrow?: string;
    heading?: string;
  };

  reviews?: Array<{
    text: string;
    author: string;
    rating: number;
  }>;

  /**
   * Optional text overrides for the FAQ section's eyebrow/heading.
   * Defaults: "FAQ" / "Questions, answered.".
   */
  faqSection?: {
    eyebrow?: string;
    heading?: string;
  };

  faq?: Array<{
    question: string;
    answer: string;
  }>;

  /**
   * Optional text overrides for the stats section's eyebrow/heading.
   * When both are omitted, the block renders as a minimal metric strip
   * (no heading), which is the current behaviour. Set either to add a
   * heading above the stats.
   */
  statsSection?: {
    eyebrow?: string;
    heading?: string;
  };

  contact?: {
    eyebrow?: string;
    heading: string;
    body: string;
    address?: string;
    phone?: string;
    email?: string;
    hours?: string;
    showBookingForm?: boolean;
    showHours?: boolean;
  };

  /**
   * Optional text overrides for the footer. When omitted, the footer
   * falls back to the brand tagline and a default nav list.
   */
  footer?: {
    /** Line shown under the business name. Defaults to brand.tagline. */
    tagline?: string;
  };

  navigation?: string[];

  /**
   * Multipage sites. When present and length > 1, the renderer treats the
   * site as multipage: the homepage lives at `/sites/[slug]` using the
   * page with `slug: 'home'` (or the first entry if none), and other
   * pages are served at `/sites/[slug]/[pageSlug]`.
   *
   * When `pages` is omitted or has a single entry, the site is
   * single-page and behaves exactly as it did before multipage support
   * was added — the top-level `layout` + block fields drive the render.
   *
   * Claude decides how many pages a business needs. Most service
   * businesses just need one. Restaurants often want Home + Menu + About.
   * Law firms often want Home + Practice Areas + About + Contact.
   */
  pages?: PageConfig[];
}

/**
 * Resolve the active page for a given slug. Returns the matching `PageConfig`
 * if `pages` is present, or a synthetic single-page config derived from the
 * top-level `layout` when the site is single-page. `pageSlug === undefined`
 * (or `'home'`) returns the homepage.
 */
export function resolvePage(
  config: WebsiteConfig,
  pageSlug?: string,
): PageConfig {
  const pages = config.pages ?? [];
  if (pages.length > 0) {
    const wanted = pageSlug && pageSlug !== 'home' ? pageSlug : 'home';
    const match = pages.find((p) => p.slug === wanted);
    if (match) return match;
    // Fallback: homepage if `wanted` not found (user typed a bad slug).
    const home = pages.find((p) => p.slug === 'home') ?? pages[0];
    if (home) return home;
  }
  // Single-page: synthesize a home page from root layout.
  const template = config.template ?? 'service';
  return {
    slug: 'home',
    title: 'Home',
    layout: config.layout && config.layout.length > 0 ? config.layout : DEFAULT_LAYOUT[template],
  };
}

/**
 * List every page in a config for nav purposes. Returns an empty array if
 * the site is single-page — nav components can check `.length > 1` to decide
 * whether to render a multipage menu.
 */
export function listPages(config: WebsiteConfig): PageConfig[] {
  return config.pages ?? [];
}

/**
 * Default layout per template. Used when the config omits `layout`.
 * Keeps the generator resilient — the renderer always has something to show.
 */
export const DEFAULT_LAYOUT: Record<SiteTemplate, SiteBlockKey[]> = {
  service: ['nav', 'hero', 'stats', 'services', 'about', 'reviews', 'faq', 'contact', 'footer'],
  food: ['nav', 'hero', 'services', 'gallery', 'about', 'reviews', 'contact', 'footer'],
  beauty: ['nav', 'hero', 'services', 'gallery', 'reviews', 'about', 'contact', 'faq', 'footer'],
  fitness: ['nav', 'hero', 'stats', 'services', 'reviews', 'faq', 'contact', 'footer'],
  professional: ['nav', 'hero', 'about', 'services', 'stats', 'reviews', 'faq', 'contact', 'footer'],
  retail: ['nav', 'hero', 'services', 'gallery', 'stats', 'reviews', 'faq', 'contact', 'footer'],
  medical: ['nav', 'hero', 'about', 'services', 'stats', 'reviews', 'faq', 'contact', 'footer'],
  creative: ['nav', 'hero', 'gallery', 'about', 'services', 'reviews', 'contact', 'footer'],
  realestate: ['nav', 'hero', 'stats', 'services', 'gallery', 'reviews', 'faq', 'contact', 'footer'],
  education: ['nav', 'hero', 'about', 'stats', 'services', 'reviews', 'faq', 'contact', 'footer'],
  automotive: ['nav', 'hero', 'services', 'stats', 'gallery', 'reviews', 'faq', 'contact', 'footer'],
  hospitality: ['nav', 'hero', 'gallery', 'about', 'services', 'reviews', 'contact', 'footer'],
  legal: ['nav', 'hero', 'about', 'services', 'reviews', 'faq', 'contact', 'footer'],
  nonprofit: ['nav', 'hero', 'about', 'stats', 'services', 'reviews', 'contact', 'footer'],
  tech: ['nav', 'hero', 'stats', 'services', 'about', 'reviews', 'faq', 'contact', 'footer'],
};

/**
 * Default hero variant per template — picked when the generator omits one.
 * Matched to the psychology of each industry.
 */
export const DEFAULT_HERO_VARIANT: Record<SiteTemplate, HeroVariant> = {
  service: 'parallax-layers',
  food: 'floating-icons',
  beauty: 'parallax-layers',
  fitness: 'beams',
  professional: 'spotlight',
  retail: 'gradient-mesh',
  medical: 'spotlight',
  creative: 'gradient-mesh',
  realestate: 'parallax-layers',
  education: 'beams',
  automotive: 'beams',
  hospitality: 'parallax-layers',
  legal: 'spotlight',
  nonprofit: 'floating-icons',
  tech: 'beams',
};

/** All hero variants the generator can pick from. */
export const HERO_VARIANTS: HeroVariant[] = [
  'spotlight',
  'beams',
  'floating-icons',
  'parallax-layers',
  'gradient-mesh',
];

/**
 * All site templates as a const tuple, used to build Zod enums at the API
 * boundary. Keeping this single source of truth prevents template lists
 * drifting between the prompt, the schema, the API validators, and the
 * dashboard picker. Adding a template is a single-file change.
 */
export const SITE_TEMPLATES = [
  'service',
  'food',
  'beauty',
  'fitness',
  'professional',
  'retail',
  'medical',
  'creative',
  'realestate',
  'education',
  'automotive',
  'hospitality',
  'legal',
  'nonprofit',
  'tech',
] as const satisfies readonly SiteTemplate[];

/** Brand palette derived from a primary color. Used when the generator misses one. */
export const BRAND_FALLBACK = {
  primary: '#1D9CA1',
  accent: '#48D886',
  pop: '#FFEC3D',
  dark: '#0B1220',
} as const;

/** Simple slug helper used both for public site URLs and for seeding demo data. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Normalize any hex-like color string into `#RRGGBB`. Accepts 3-char shorthand
 * (`#abc`), missing leading `#`, or uppercase. Returns `null` for invalid input
 * so callers can fall back to a default instead of rendering a broken color.
 */
export function normalizeHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw}`.toLowerCase();
  }
  return null;
}

/** Convert any valid hex (3 or 6 char, with or without `#`) to `r,g,b` tuple. */
export function hexToRgbTuple(hex: string | undefined | null): string {
  const normalized = normalizeHex(hex);
  if (!normalized) return '29,156,161';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

/**
 * Rough WCAG relative luminance of a hex color. Used to decide whether a
 * light or dark foreground will have sufficient contrast on a color tile.
 */
export function luminance(hex: string): number {
  const normalized = normalizeHex(hex) ?? '#1d9ca1';
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const transform = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}
