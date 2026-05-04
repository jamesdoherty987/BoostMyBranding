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
  | 'footer'
  /**
   * Industry-specific blocks. Enabled per business by adding them to
   * `layout` or a page's `layout`. All are optional — they render as
   * `null` when their data isn't present, so including the key is safe.
   */
  | 'menu'           // Food/drink menu with categories, items, prices
  | 'priceList'      // Per-service prices for barbers/salons/trades
  | 'team'           // Staff/practitioner profiles with credentials
  | 'schedule'       // Weekly class/appointment grid (gyms, clinics)
  | 'serviceAreas'   // Towns/regions covered (tradesmen, mobile services)
  | 'beforeAfter'    // Before/after image pairs (trades, beauty)
  | 'trustBadges'    // Insurance, licensing, certifications
  | 'cta'            // Dedicated mid-page call-to-action strip
  /**
   * More small-business-specific blocks.
   */
  | 'products'       // Retail/e-com-lite product catalog (name, image, price, buy link)
  | 'portfolio'      // Full case studies / examples with story + photos
  | 'process'        // How it works: numbered step-by-step
  | 'pricingTiers'   // Bronze/Silver/Gold package cards
  | 'announcement'   // Top-of-site strip for promos, holiday hours
  | 'logoStrip'      // "As featured in" / partner / certification logos
  | 'video'          // Embedded hero or inline video (YouTube/Vimeo/MP4)
  | 'newsletter'     // Email capture for newsletter / waitlist
  /**
   * AI-generated custom sections. When Claude (or the agency) needs a
   * section that doesn't fit any prebuilt block — e.g. "show these 3
   * roastery photos with captions" — it populates `customSections` and
   * the `custom` block renders each entry in order.
   *
   * This is the escape hatch: instead of forcing every request into an
   * existing block, the AI can express arbitrary layouts using 4 proven
   * primitives (image strip, image+text split, feature row, pull quote).
   */
  | 'custom';

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
  | 'gradient-mesh'
  | 'aurora'
  | 'wavy'
  | 'sparkles'
  | 'hero-highlight'
  | 'dither'
  | 'multicolor'
  | 'full-bg-image'
  | 'two-column-image'
  | 'meteors'
  | 'vortex'
  | 'lamp';

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
    // Industry-specific block overrides
    menu?: WebsiteConfig['menu'];
    priceList?: WebsiteConfig['priceList'];
    team?: WebsiteConfig['team'];
    schedule?: WebsiteConfig['schedule'];
    serviceAreas?: WebsiteConfig['serviceAreas'];
    beforeAfter?: WebsiteConfig['beforeAfter'];
    trustBadges?: WebsiteConfig['trustBadges'];
    cta?: WebsiteConfig['cta'];
    // Extra small-business blocks
    products?: WebsiteConfig['products'];
    portfolio?: WebsiteConfig['portfolio'];
    process?: WebsiteConfig['process'];
    pricingTiers?: WebsiteConfig['pricingTiers'];
    logoStrip?: WebsiteConfig['logoStrip'];
    video?: WebsiteConfig['video'];
    newsletter?: WebsiteConfig['newsletter'];
    // Announcement is global only — it's a top-of-site bar, not per-page.
    customSections?: WebsiteConfig['customSections'];
  };
}

/**
 * A row in a price list. Used by barbers, salons, trades.
 *   name     — "Men's cut", "Boiler service"
 *   price    — "25", "from 120" (kept as a string so clients can write
 *              "from 85" or "25–35" without fighting the number type)
 *   duration — "45 min" etc. Optional.
 *   note     — Short extra line, e.g. "incl. consultation".
 */
export interface PriceListItem {
  name: string;
  price?: string;
  duration?: string;
  note?: string;
  /** When true, row gets a brand accent border and moves to the top. */
  featured?: boolean;
}

/**
 * A decorative cutout layered over the hero. Typically a transparent PNG
 * (e.g. a coffee cup for a cafe, scissors for a salon), positioned by
 * percentage so it stays anchored responsively. `animation` chooses the
 * motion style — all variants use CSS/Framer so they're GPU-cheap.
 *
 *   float  — gentle up/down bob, staggered per cutout
 *   tilt   — slow back-and-forth rotation, nice for props
 *   orbit  — small circular drift, feels alive
 *   pulse  — subtle scale in/out, good for badges / stars
 *   drift  — slow diagonal movement across its origin point
 *   none   — static; use when the image already has its own animation baked in
 */
export interface HeroCutout {
  /** Image URL. Best results with a transparent PNG. */
  url: string;
  /** Short alt text for accessibility. Defaults to empty (decorative). */
  alt?: string;
  /** X position as 0–100 percent of the hero width. 50 = centered. */
  x?: number;
  /** Y position as 0–100 percent of the hero height. 50 = centered. */
  y?: number;
  /** Size as a percent of the hero width. Sensible range: 15–45. Default 30. */
  size?: number;
  /** Rotation in degrees. Applied before animation. */
  rotate?: number;
  /**
   * Layer — renders behind (0) or above (1) the hero copy. Default 0.
   * Set to 1 for a cutout you want in the foreground (e.g. a coffee cup
   * that should feel like it's "in front of" the headline).
   */
  layer?: 0 | 1;
  /** Animation style. Default 'float'. */
  animation?: 'float' | 'tilt' | 'orbit' | 'pulse' | 'drift' | 'none';
  /** Animation speed multiplier. 1 = default, 2 = twice as fast. Default 1. */
  speed?: number;
  /** Optional drop shadow intensity. 0 = none, 1 = soft, 2 = dramatic. Default 1. */
  shadow?: 0 | 1 | 2;
}

/**
 * A freeform custom section that doesn't fit any prebuilt block. Each
 * section picks one of four layout primitives via its `variant` field,
 * so the renderer stays deterministic while the agency/AI gets broad
 * creative control.
 *
 * Shared fields across all variants:
 *   eyebrow  — optional small uppercase kicker above the heading
 *   heading  — optional section heading
 *   body     — optional supporting paragraph
 *   items    — variant-specific array (see below)
 *   caption  — the pull-quote variant's attribution line
 *   background — optional 'white' | 'slate' | 'brand' tone for variety
 *
 * Variants and what `items` mean for each:
 *   image-strip      — items: [{ imageIndex?, imageUrl?, caption? }] — 2–5
 *   image-text-split — items: [{ imageIndex?, imageUrl? }] — exactly 1
 *   feature-row      — items: [{ icon?, title, description }] — 2–4
 *   pull-quote       — items unused (quote lives in `body`, author in `caption`)
 */
export interface CustomSection {
  variant: 'image-strip' | 'image-text-split' | 'feature-row' | 'pull-quote';
  eyebrow?: string;
  heading?: string;
  body?: string;
  items?: Array<{
    /** Index into the client images array. */
    imageIndex?: number;
    /** Direct URL (used when imageIndex is unset). */
    imageUrl?: string;
    /** Per-item short caption. */
    caption?: string;
    /** For feature-row: icon name from the shared icon map. */
    icon?: string;
    /** For feature-row: title and description. */
    title?: string;
    description?: string;
  }>;
  /** For pull-quote: the attribution line (e.g. "— Sarah, owner"). */
  caption?: string;
  /** Section background tone. Default white. */
  background?: 'white' | 'slate' | 'brand';
  /** For image-text-split: which side the image sits on. Default left. */
  imageSide?: 'left' | 'right';
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
     * Optional typographic effect for the headline. Layered on top of
     * the chosen hero `variant` — any variant can opt in. When set:
     *   - typewriter : headline types out character-by-character
     *   - flip-words : last word cycles through several alternatives
     *     (use `flipWords` to supply the alternatives)
     *   - generate   : headline words fade in one-by-one on scroll
     *
     * Leave undefined for the default static headline (with the last-two-
     * words gradient we use everywhere today).
     */
    headlineEffect?: 'typewriter' | 'flip-words' | 'generate';
    /**
     * Alternative words for the `flip-words` effect. Only used when
     * `headlineEffect === 'flip-words'`. The headline keeps its normal
     * text for the first part and the last word cycles through this list.
     * Example: headline "We build great X", flipWords ["kitchens",
     * "bathrooms", "extensions"] → cycles X through the list.
     */
    flipWords?: string[];
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
    /**
     * Decorative cutouts layered over the hero. Each cutout is a
     * transparent PNG (or any image — though transparent PNGs look best)
     * positioned and animated independently. Great for cafes wanting a
     * coffee cup floating in from the right, salons wanting a pair of
     * scissors drifting across, or a plumber's wrench slowly rotating.
     *
     * Works on every hero variant — the cutouts render in a layer above
     * the variant's background but below the copy, so they complement
     * rather than replace the variant.
     */
    cutouts?: Array<HeroCutout>;
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
    /**
     * Layout variant. Defaults to `cards` (the current card grid).
     * Other options are Aceternity-powered layouts with different feels:
     *   - bento        : asymmetric grid where featured services span big tiles
     *   - sticky-scroll: scrolling text column + sticky image panel on the side
     *   - hover-effect : dark cards with card-spotlight (mouse glow)
     *   - 3d-cards     : cards tilt on mouse move (Aceternity 3d-card)
     *   - wobble       : cards wobble on mouse move (Aceternity wobble-card)
     *   - glare        : premium shiny cards (Aceternity glare-card)
     *   - expandable   : compact cards that open a modal on click (Aceternity animated-modal)
     */
    variant?:
      | 'cards'
      | 'bento'
      | 'sticky-scroll'
      | 'hover-effect'
      | '3d-cards'
      | 'wobble'
      | 'glare'
      | 'expandable';
  };

  services?: Array<{
    title: string;
    description: string;
    /** Lucide icon name (e.g. "Wrench"). Renderer maps unknowns to `Sparkles`. */
    icon: string;
    /**
     * Mark as featured — spans two columns on wide grids and gets a
     * brand-accent ring. Use for the headline service ("Our signature
     * kitchen refit", "Emergency call-out").
     */
    featured?: boolean;
  }>;

  gallery?: {
    eyebrow?: string;
    heading?: string;
    /** Indices into the provided `images` array. */
    imageIndices?: number[];
    /**
     * Layout variant. Defaults to `grid`.
     *   - grid          : current masonry-style grid (default)
     *   - focus-cards   : Aceternity focus cards — hover to spotlight one
     *   - parallax      : Aceternity parallax scroll (3 columns diff speeds)
     *   - apple-carousel: Apple-style horizontal carousel with tap-to-expand
     *   - 3d-marquee    : 3D tilted marquee — images scroll with depth
     *   - layout-grid   : Aceternity click-to-expand layout grid
     *   - compare       : Aceternity before/after slider (great for trades)
     *   - direction-aware: Cursor-direction hover reveals (portfolio-style)
     */
    variant?:
      | 'grid'
      | 'focus-cards'
      | 'parallax'
      | 'apple-carousel'
      | '3d-marquee'
      | 'layout-grid'
      | 'compare'
      | 'direction-aware';
    /**
     * Optional per-image titles for variants that support them
     * (apple-carousel uses them as card labels). Parallel array to
     * `imageIndices` — index 0 labels the first image, etc.
     */
    titles?: string[];
  };

  /**
   * Optional text overrides for the reviews section's eyebrow/heading.
   * Defaults: "Reviews" / "What customers say.".
   */
  reviewsSection?: {
    eyebrow?: string;
    heading?: string;
    /**
     * Layout variant. Defaults to `grid`.
     *   - grid                  : card grid (honours `featured`)
     *   - marquee               : auto-scrolling Aceternity InfiniteMovingCards
     *   - carousel              : single featured quote with prev/next
     *   - masonry               : Pinterest-style variable-height grid
     *   - draggable             : stacked cards visitors drag through
     *   - animated-testimonials : Aceternity-style carousel with photo
     */
    variant?:
      | 'grid'
      | 'marquee'
      | 'carousel'
      | 'masonry'
      | 'draggable'
      | 'animated-testimonials';
  };

  reviews?: Array<{
    text: string;
    author: string;
    rating: number;
    /** Feature this review — spans two columns + brand-accent ring. */
    featured?: boolean;
  }>;

  /**
   * Optional text overrides for the FAQ section's eyebrow/heading.
   * Defaults: "FAQ" / "Questions, answered.".
   */
  faqSection?: {
    eyebrow?: string;
    heading?: string;
    /**
     * Layout variant. Defaults to `accordion`.
     *   - accordion      : classic click-to-expand list
     *   - grid           : 2-col grid with all answers visible
     *   - with-background: accordion with an animated dark background
     */
    variant?: 'accordion' | 'grid' | 'with-background';
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
    /**
     * Layout variant. Defaults to `ticker`.
     *   - ticker    : big animated counters in a gradient card (current)
     *   - gradient  : each stat in its own gradient card
     *   - changelog : compact horizontal row with dot separators
     */
    variant?: 'ticker' | 'gradient' | 'changelog';
  };

  contact?: {
    eyebrow?: string;
    heading: string;
    body: string;
    address?: string;
    phone?: string;
    email?: string;
    hours?: string;
    /** WhatsApp number (international format, e.g. "+353851234567"). */
    whatsapp?: string;
    showBookingForm?: boolean;
    showHours?: boolean;
    /**
     * Layout variant. Defaults to `form-side` (the current form + info
     * side-by-side). Other options prioritise different content.
     *   - form-side     : form on one side, address/map on the other (default)
     *   - grid-sections : multiple cards (sales / support / press)
     *   - shader        : dark dramatic section with animated shader backdrop
     */
    variant?: 'form-side' | 'grid-sections' | 'shader';
  };

  /**
   * Social media links. Rendered in the footer and optionally in the
   * contact section. Claude populates these when the business description
   * or existing site mentions social accounts.
   */
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
   * Sticky mobile CTA bar. Shown fixed at the bottom of the viewport on
   * small screens so visitors can call or book with one tap. Claude picks
   * the right action based on the business type — a restaurant gets
   * "View menu" + "Call", a tradesman gets "Get a quote" + "Call".
   *
   * When omitted, the renderer auto-generates a sensible default from
   * the hero CTA + phone number.
   */
  mobileCta?: {
    /** Primary action label, e.g. "Book now", "Get a quote". */
    primaryLabel?: string;
    /** Primary action href — same rules as hero CTA. */
    primaryHref?: string;
    /** Whether to show a "Call" button next to the primary. Defaults true when phone is set. */
    showCall?: boolean;
    /** Whether to show a WhatsApp button. Defaults true when whatsapp is set. */
    showWhatsApp?: boolean;
  };

  /**
   * Footer text overrides. When omitted, the footer falls back to the
   * brand tagline and a default nav list.
   */
  footer?: {
    /** Line shown under the business name. Defaults to brand.tagline. */
    tagline?: string;
  };

  navigation?: string[];

  /* ────────────────────────────────────────────────────────────── *
   *  Industry-specific blocks                                      *
   *                                                                *
   *  Each of these is opt-in — a business only gets what makes     *
   *  sense for it. Claude picks the right blocks per business      *
   *  during generation and adds them to `layout`.                  *
   * ────────────────────────────────────────────────────────────── */

  /**
   * Food / drink menu. Used by cafes, restaurants, bars. Rendered as
   * categorized sections with item name, description, and price. Supports
   * featured items (highlighted) and dietary tags.
   */
  menu?: {
    eyebrow?: string;
    heading?: string;
    /** Optional currency symbol prefixed to every price. Default "€". */
    currency?: string;
    categories: Array<{
      title: string;
      /** Short blurb under the category heading. Optional. */
      description?: string;
      items: Array<{
        name: string;
        description?: string;
        /** Stored as a string so the config can hold "4.50" or "from 12". */
        price?: string;
        /** Dietary tags like "V", "VG", "GF". Up to 4. */
        tags?: string[];
        /** When true, item gets a brand accent to stand out. */
        featured?: boolean;
      }>;
    }>;
  };

  /**
   * Per-service price list. Used by barbers, salons, trades — anyone
   * who bills by service. Simpler than menu: flat list of rows with
   * service name + price + optional duration.
   */
  priceList?: {
    eyebrow?: string;
    heading?: string;
    currency?: string;
    /**
     * Optional groupings (e.g. "Cuts", "Colour"). When omitted, all
     * items render in a single list.
     */
    groups?: Array<{
      title: string;
      items: PriceListItem[];
    }>;
    /** Flat list when no groups are used. Ignored if `groups` is set. */
    items?: PriceListItem[];
    /** Optional note (e.g. "Prices from. Final quote on booking."). */
    footnote?: string;
  };

  /**
   * Team / practitioners. Used by clinics, salons, gyms, agencies.
   * Each member has a photo (by index into the images array or URL),
   * name, role, short bio, and optional credentials / specialties.
   */
  team?: {
    eyebrow?: string;
    heading?: string;
    /**
     * Default card layout for this block's members. Individual members
     * can override via `member.variant`. Extendable — when you paste
     * Aceternity Pro cards later, register them here.
     *
     *   portrait  — 3/4 photo + name + role + specialties (current default)
     *   minimal   — small avatar + name + role only (dense grid)
     *   quote     — photo + name + role + short quote/bio card
     *   banner    — wide landscape card with overlay text (fewer per row)
     *   light-bg  — Aceternity light-background cards with hover lift
     *   small-avatars — Aceternity overlapping avatars with tooltips
     *   card-hover — Aceternity dark cards with hover-glow
     */
    variant?: 'portrait' | 'minimal' | 'quote' | 'banner' | 'light-bg' | 'small-avatars' | 'card-hover';
    members: Array<{
      name: string;
      role: string;
      bio?: string;
      /** Credentials like "BDS, MFDS RCSI". Rendered subtly under the name. */
      credentials?: string;
      /** Specialties / skills, e.g. ["Beard trims", "Skin fades"]. Up to 5. */
      specialties?: string[];
      /** Index into the client's approved images, OR a direct URL. */
      photoIndex?: number;
      photoUrl?: string;
      /**
       * Per-member card override. When set, this member renders with the
       * given variant regardless of the block-level `team.variant`.
       * Lets agencies feature one person with a bigger card while the
       * rest stay in a uniform grid.
       *
       * Only the card-level variants make sense here (not full-section
       * replacements like `small-avatars`).
       */
      variant?: 'portrait' | 'minimal' | 'quote' | 'banner';
      /**
       * Mark this member's card as featured — spans two columns on
       * wide grids and gets a brand-accent ring so it stands out from
       * the rest. Useful for the founder / head stylist / lead dentist.
       */
      featured?: boolean;
    }>;
  };

  /**
   * Weekly schedule grid. Used by gyms (class schedule), clinics
   * (appointment hours), salons (staff availability). Each row is a
   * time slot; each column is a day of the week.
   */
  schedule?: {
    eyebrow?: string;
    heading?: string;
    /**
     * Which days to show. Two-letter codes: Mo, Tu, We, Th, Fr, Sa, Su.
     * Defaults to the full week if omitted.
     */
    days?: string[];
    entries: Array<{
      day: string; // "Mo" / "Tu" / ...
      time: string; // "9:00" / "18:30"
      title: string; // "HIIT" / "Dr. Smith available" / "Kids' class"
      /** Optional detail, e.g. "45 min · Coach Maria". */
      detail?: string;
      /** Featured slot — rendered with brand accent. */
      featured?: boolean;
    }>;
    footnote?: string;
  };

  /**
   * Service areas. Used by mobile / call-out businesses: plumbers,
   * electricians, mobile groomers, cleaning services. A chip grid of
   * towns/regions covered, plus optional note about call-out fee.
   */
  serviceAreas?: {
    eyebrow?: string;
    heading?: string;
    /** List of town/region names. Up to ~20. */
    areas: string[];
    footnote?: string;
  };

  /**
   * Before/after image pairs. Used by trades (plumbing jobs, roofing,
   * decorating), beauty (hair colour, nails, aesthetics). Each pair has
   * two images and optional caption.
   */
  beforeAfter?: {
    eyebrow?: string;
    heading?: string;
    pairs: Array<{
      /** Indices into the images array, OR direct URLs. */
      beforeIndex?: number;
      beforeUrl?: string;
      afterIndex?: number;
      afterUrl?: string;
      caption?: string;
    }>;
  };

  /**
   * Trust badges: insurance, licensing, certifications, awards.
   * Used by trades (RGI, Safe Electric), medical (GMC, Dental Council),
   * legal (Law Society). Each badge is a short text chip; add a URL
   * to make the chip a link to the licensing authority.
   */
  trustBadges?: {
    eyebrow?: string;
    heading?: string;
    badges: Array<{
      /** Short label, e.g. "RGI Registered", "Fully insured to €5M". */
      label: string;
      /** Optional longer description shown on hover / below. */
      detail?: string;
      /** Optional link to the authority's register. */
      href?: string;
      /** Optional icon name from the services icon list. */
      icon?: string;
    }>;
  };

  /**
   * Mid-page call-to-action strip. A focused "book now" / "call today"
   * banner with brand gradient, placed between sections to catch the
   * user before they scroll past the contact form.
   */
  cta?: {
    heading: string;
    body?: string;
    buttonLabel: string;
    buttonHref: string;
    /** Optional second button. Usually "Call" or "WhatsApp". */
    secondaryLabel?: string;
    secondaryHref?: string;
    /**
     * Layout variant. Defaults to `simple` (the original strip). Other
     * options add more visual impact for higher-stakes asks:
     *   - simple         : current gradient strip with buttons
     *   - with-images    : CTA text with floating avatars from gallery
     *   - masonry-images : bold headline beside a masonry photo wall
     *   - centered-bold  : huge centered text on deep gradient
     *   - moving-border  : centered text with animated glowing-border button
     */
    variant?:
      | 'simple'
      | 'with-images'
      | 'masonry-images'
      | 'centered-bold'
      | 'moving-border';
  };

  /**
   * Product catalog. Used by retail (gift shops, boutiques), bakeries
   * selling whole cakes, florists selling bouquets — small retail
   * businesses that want to showcase products without a full checkout.
   * Each product has an image, name, description, price, and an
   * action link (to a product page, "Order via DM", Shopify, etc).
   */
  products?: {
    eyebrow?: string;
    heading?: string;
    /** Currency symbol prefixed to every price. Default "€". */
    currency?: string;
    /**
     * Optional category filter tabs above the grid. When empty, all
     * products render in one grid.
     */
    categories?: string[];
    items: Array<{
      name: string;
      description?: string;
      price?: string;
      /** The category this product belongs to. Matches one of `categories`. */
      category?: string;
      /** Image: index into images array OR direct URL. */
      imageIndex?: number;
      imageUrl?: string;
      /** Buy / order link. If omitted, product is display-only. */
      href?: string;
      /** Label on the action button. Default "Order". */
      ctaLabel?: string;
      /** Show a small "Featured" / "New" / "Sale" badge. */
      badge?: string;
      /** Mark featured products — they span two columns on desktop. */
      featured?: boolean;
    }>;
    /** Optional footnote (e.g. "Contact us to order. Free delivery in Dublin."). */
    footnote?: string;
  };

  /**
   * Portfolio / case studies / work examples. Each entry is a project
   * with multiple images, a story, and optional client/results metadata.
   * Richer than gallery (which is just a photo grid) — portfolio items
   * have a name, description, and context.
   *
   * Used by tradesmen (full-kitchen refits), creatives (design projects,
   * photography shoots), landscapers, event planners.
   */
  portfolio?: {
    eyebrow?: string;
    heading?: string;
    projects: Array<{
      title: string;
      /** Short one-liner shown in the card grid. */
      summary?: string;
      /** Optional longer description shown when a project is expanded. */
      description?: string;
      /** Image indices (preferred) or direct URLs. First image is the cover. */
      imageIndices?: number[];
      imageUrls?: string[];
      /** Optional metadata chips — e.g. client name, year, location. */
      tags?: string[];
      /** Feature this project — spans two columns, lifted + accent ring. */
      featured?: boolean;
    }>;
  };

  /**
   * "How it works" numbered steps. Explains the process for service
   * businesses where the customer wants to know what to expect. Common
   * for tradesmen ("1. Call us, 2. Free visit, 3. Quote, 4. We fix"),
   * consultants, agencies.
   */
  process?: {
    eyebrow?: string;
    heading?: string;
    steps: Array<{
      title: string;
      description?: string;
      /** Optional icon name from the shared icon map. */
      icon?: string;
    }>;
    footnote?: string;
    /**
     * Layout variant. Defaults to `numbered` (the existing stacked
     * layout with big numbered circles).
     *   - numbered : 3-col grid with numbered circles (default)
     *   - timeline : vertical scrollable timeline (Aceternity)
     */
    variant?: 'numbered' | 'timeline';
  };

  /**
   * Pricing tiers / packages. Card-based layout with 2–4 tiers and an
   * optional highlighted "recommended" tier. Different from `priceList`
   * — priceList is a flat list of individual services (€25 cut, €15
   * beard), pricingTiers is grouped packages ("Bronze / Silver / Gold").
   *
   * Used by gyms (membership levels), beauty (package deals), agencies
   * (retainer tiers), SaaS-lite.
   */
  pricingTiers?: {
    eyebrow?: string;
    heading?: string;
    currency?: string;
    tiers: Array<{
      name: string;
      /** Big price displayed on the card. Keep short ("49", "from 199"). */
      price?: string;
      /** Billing period, e.g. "/month", "/session". */
      period?: string;
      description?: string;
      /** Bullet list of what's included. */
      features: string[];
      /** CTA button. */
      ctaLabel?: string;
      ctaHref?: string;
      /** When true, card gets a brand accent + scale bump. */
      highlighted?: boolean;
    }>;
    footnote?: string;
  };

  /**
   * Top-of-site announcement bar. Sticky strip above the nav used for
   * seasonal promos, holiday hours, new service launches. Dismissible
   * so returning visitors can hide it.
   */
  announcement?: {
    /** Short message text. Keep to one line. */
    message: string;
    /** Optional CTA link at the end of the message. */
    linkLabel?: string;
    linkHref?: string;
    /** Visual tone: brand (default), success (green), warning (amber). */
    tone?: 'brand' | 'success' | 'warning';
    /** Hides the dismiss button. Use for genuinely critical info. */
    nonDismissible?: boolean;
  };

  /**
   * Horizontal strip of logos — "as featured in" press, partners,
   * awards, certification bodies. Grayscale by default, colour on hover.
   */
  logoStrip?: {
    eyebrow?: string;
    heading?: string;
    logos: Array<{
      /** Alt text / label for the logo. */
      name: string;
      imageUrl?: string;
      imageIndex?: number;
      /** Optional link out. */
      href?: string;
    }>;
    /**
     * Layout variant. Defaults to `grid` (the current static strip).
     *   - grid    : static centered row with hover effect (default)
     *   - marquee : continuous horizontal scroll of logos (Aceternity)
     */
    variant?: 'grid' | 'marquee';
  };

  /**
   * Video block. Renders a responsive 16:9 frame with either a YouTube /
   * Vimeo embed or a self-hosted MP4. Good for intro videos, product
   * demos, customer testimonials on camera.
   */
  video?: {
    eyebrow?: string;
    heading?: string;
    body?: string;
    /** Video source URL. Accepts YouTube, Vimeo, or direct MP4. */
    url: string;
    /** Optional custom poster/thumbnail (only used for MP4 URLs). */
    posterUrl?: string;
    /** Autoplay muted on scroll-into-view. Off by default to respect bandwidth. */
    autoplay?: boolean;
  };

  /**
   * Newsletter / waitlist signup. Simple email capture with a friendly
   * heading and consent line. Posts to the same `/leads` endpoint as
   * the contact form but tagged as `newsletter_signup` so the dashboard
   * inbox can filter.
   */
  newsletter?: {
    eyebrow?: string;
    heading?: string;
    body?: string;
    /** Input placeholder. Default "Your email". */
    placeholder?: string;
    /** Submit button label. Default "Subscribe". */
    buttonLabel?: string;
    /** Tiny consent line under the input. */
    consent?: string;
  };

  /**
   * Freeform custom sections. When the `custom` block is in the layout,
   * each entry in this array renders in order. Each section has a
   * `variant` that picks a layout primitive — this keeps the rendering
   * deterministic while letting the AI (or agency) assemble custom
   * combinations of images + copy.
   *
   * Layout primitives:
   *   image-strip      — 2–5 images in a row with optional captions
   *   image-text-split — large image on one side, heading+body on the other
   *   feature-row      — 2–4 small feature cards with icon + text
   *   pull-quote       — big centered quote with author
   *
   * Each entry gets its own edit paths (`customSections.0.heading`,
   * `customSections.0.items.2.caption`) so `InlineEditable` can address
   * individual fields.
   */
  customSections?: CustomSection[];

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
 * Industry-specific blocks (menu, priceList, team, schedule, serviceAreas,
 * beforeAfter, trustBadges, cta) are only added when their data is
 * actually present — including them here is safe because the renderer
 * skips empty blocks.
 */
export const DEFAULT_LAYOUT: Record<SiteTemplate, SiteBlockKey[]> = {
  service: ['nav', 'hero', 'stats', 'services', 'serviceAreas', 'beforeAfter', 'about', 'trustBadges', 'reviews', 'faq', 'cta', 'contact', 'footer'],
  food: ['nav', 'hero', 'menu', 'gallery', 'about', 'reviews', 'contact', 'footer'],
  beauty: ['nav', 'hero', 'priceList', 'gallery', 'team', 'reviews', 'about', 'contact', 'faq', 'footer'],
  fitness: ['nav', 'hero', 'stats', 'services', 'schedule', 'team', 'reviews', 'cta', 'faq', 'contact', 'footer'],
  professional: ['nav', 'hero', 'about', 'services', 'team', 'stats', 'reviews', 'faq', 'contact', 'footer'],
  retail: ['nav', 'hero', 'services', 'gallery', 'stats', 'reviews', 'faq', 'contact', 'footer'],
  medical: ['nav', 'hero', 'about', 'services', 'team', 'schedule', 'trustBadges', 'reviews', 'faq', 'contact', 'footer'],
  creative: ['nav', 'hero', 'gallery', 'about', 'services', 'team', 'reviews', 'contact', 'footer'],
  realestate: ['nav', 'hero', 'stats', 'services', 'gallery', 'team', 'reviews', 'faq', 'contact', 'footer'],
  education: ['nav', 'hero', 'about', 'stats', 'services', 'team', 'schedule', 'reviews', 'faq', 'contact', 'footer'],
  automotive: ['nav', 'hero', 'services', 'priceList', 'stats', 'gallery', 'serviceAreas', 'reviews', 'trustBadges', 'faq', 'contact', 'footer'],
  hospitality: ['nav', 'hero', 'gallery', 'about', 'services', 'menu', 'reviews', 'contact', 'footer'],
  legal: ['nav', 'hero', 'about', 'services', 'team', 'trustBadges', 'reviews', 'faq', 'contact', 'footer'],
  nonprofit: ['nav', 'hero', 'about', 'stats', 'services', 'team', 'reviews', 'cta', 'contact', 'footer'],
  tech: ['nav', 'hero', 'stats', 'services', 'team', 'about', 'reviews', 'faq', 'contact', 'footer'],
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
  'aurora',
  'wavy',
  'sparkles',
  'hero-highlight',
  'dither',
  'multicolor',
  'full-bg-image',
  'two-column-image',
  'meteors',
  'vortex',
  'lamp',
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
