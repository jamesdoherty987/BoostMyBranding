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
    /** Legacy per-effect toggles. Kept for backwards compatibility. */
    effects?: {
      aurora?: boolean;
      particles?: boolean;
      grid?: boolean;
    };
  };

  about?: {
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

  services?: Array<{
    title: string;
    description: string;
    /** Lucide icon name (e.g. "Wrench"). Renderer maps unknowns to `Sparkles`. */
    icon: string;
  }>;

  gallery?: {
    heading?: string;
    /** Indices into the provided `images` array. */
    imageIndices?: number[];
  };

  reviews?: Array<{
    text: string;
    author: string;
    rating: number;
  }>;

  faq?: Array<{
    question: string;
    answer: string;
  }>;

  contact?: {
    heading: string;
    body: string;
    address?: string;
    phone?: string;
    email?: string;
    hours?: string;
    showBookingForm?: boolean;
    showHours?: boolean;
  };

  navigation?: string[];
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
