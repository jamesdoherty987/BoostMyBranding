/**
 * Variant registry — the single source of truth for every visual variant
 * available for every site block. Powers the Sections-tab picker in the
 * dashboard so agencies see what they're adding before clicking.
 *
 * Structure:
 *   registry[blockKey] → array of VariantOption
 *   Each VariantOption has:
 *     - id           slug stored in the config
 *     - label        human-readable name
 *     - description  one-line explainer
 *     - preview      inline SVG data URI or path to a stylized thumbnail
 *     - requires     list of data requirements (min team members, images, etc.)
 *     - tags         filters (modern, minimal, local, bold, etc.)
 *     - animated     true when the variant has motion
 *
 * When adding a new variant:
 *   1. Add its entry here
 *   2. Implement the renderer in packages/ui/src/site/blocks/
 *   3. The picker gets the option automatically
 */

import type { SiteBlockKey } from './website';

export interface DataRequirement {
  /** Field the user needs to populate (e.g. "team.members"). */
  field: string;
  /** Minimum count to render nicely. */
  minItems?: number;
  /** Short user-facing hint: "needs 3+ team members with photos". */
  hint: string;
}

export interface VariantOption {
  /** Slug saved in config (e.g. "portrait", "infinite-scroll"). */
  id: string;
  /** Short label shown in the picker (2-3 words). */
  label: string;
  /** One-line description shown on hover / selection. */
  description: string;
  /**
   * Stylized SVG thumbnail rendered in the picker. Kept inline so the
   * picker works offline and doesn't need image hosting.
   */
  preview: string;
  /** Data this variant needs to look good. */
  requires?: DataRequirement[];
  /** Category tags — helps users filter (modern, local, minimal, etc.). */
  tags?: Array<
    | 'modern'
    | 'minimal'
    | 'local'
    | 'bold'
    | 'playful'
    | 'classic'
    | 'animated'
    | 'dark'
    | 'light'
    | 'photo-heavy'
    | 'text-first'
  >;
  /** Whether the variant has meaningful motion (for battery-conscious users). */
  animated?: boolean;
  /** True if powered by an Aceternity primitive. */
  aceternity?: boolean;
  /** When true, the variant is registered but not yet wired up. Shown as "coming soon". */
  comingSoon?: boolean;
}

/**
 * Build a tiny inline SVG as a data URI. Used for preview thumbnails so
 * every variant has something to show without needing real screenshots.
 */
function svg(body: string): string {
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">${body}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(wrapped)}`;
}

const BRAND_GRAD = `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#48D886"/><stop offset="1" stop-color="#1D9CA1"/></linearGradient></defs>`;

/* ------------------------------------------------------------------ */
/* HERO VARIANTS                                                      */
/* ------------------------------------------------------------------ */

export const HERO_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'parallax-layers',
    label: 'Parallax layers',
    description: 'Photo-heavy hero with depth on scroll. The current default.',
    preview: svg(`${BRAND_GRAD}<rect width="300" height="200" fill="#f8fafc"/><rect x="30" y="40" width="240" height="120" rx="8" fill="url(#g)" opacity=".9"/><text x="50" y="100" fill="white" font-size="14" font-weight="bold">Big headline</text><text x="50" y="120" fill="white" font-size="9">Short subtitle</text></svg>`),
    requires: [{ field: 'hero.imageIndex', hint: 'Looks best with a client photo' }],
    tags: ['photo-heavy', 'modern'],
    animated: true,
  },
  {
    id: 'spotlight',
    label: 'Spotlight',
    description: 'Dark dramatic hero with a moving light. Premium feel.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><circle cx="100" cy="70" r="60" fill="#1e293b"/><text x="50" y="110" fill="white" font-size="14" font-weight="bold">Premium</text><text x="50" y="128" fill="#94a3b8" font-size="9">Dark &amp; bold</text>`),
    tags: ['dark', 'bold', 'modern'],
    animated: true,
  },
  {
    id: 'beams',
    label: 'Beams of light',
    description: 'Animated light beams cross the background. Techy and modern.',
    preview: svg(`<rect width="300" height="200" fill="#020617"/><line x1="0" y1="40" x2="300" y2="120" stroke="#48D886" stroke-width="2" opacity=".6"/><line x1="0" y1="80" x2="300" y2="40" stroke="#1D9CA1" stroke-width="2" opacity=".6"/><text x="90" y="110" fill="white" font-size="14" font-weight="bold">Your brand</text>`),
    tags: ['dark', 'animated', 'modern'],
    animated: true,
  },
  {
    id: 'floating-icons',
    label: 'Floating icons',
    description: 'Category icons float around your headline. Friendly and playful.',
    preview: svg(`<rect width="300" height="200" fill="#fff7ed"/><circle cx="50" cy="50" r="12" fill="#f97316"/><circle cx="250" cy="70" r="10" fill="#48D886"/><circle cx="270" cy="150" r="14" fill="#1D9CA1"/><text x="80" y="110" fill="#0f172a" font-size="14" font-weight="bold">Your brand</text>`),
    tags: ['playful', 'light', 'animated'],
    animated: true,
  },
  {
    id: 'gradient-mesh',
    label: 'Gradient mesh',
    description: 'Slow-shifting colour wash. Works without a photo.',
    preview: svg(`${BRAND_GRAD}<rect width="300" height="200" fill="url(#g)"/><text x="80" y="100" fill="white" font-size="14" font-weight="bold">Minimal</text><text x="80" y="118" fill="white" font-size="9" opacity=".8">No photo needed</text>`),
    tags: ['minimal', 'modern', 'bold'],
    animated: true,
  },
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Aceternity aurora lights sweep behind the headline.',
    preview: svg(`<defs><linearGradient id="a" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset=".5" stop-color="#60a5fa"/><stop offset="1" stop-color="#34d399"/></linearGradient></defs><rect width="300" height="200" fill="url(#a)" opacity=".7"/><rect width="300" height="200" fill="#0f172a" opacity=".4"/><text x="80" y="110" fill="white" font-size="14" font-weight="bold">Aurora lights</text>`),
    tags: ['modern', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'wavy',
    label: 'Wavy background',
    description: 'Soft animated waves flow behind a centered headline.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><path d="M0 120 Q75 80 150 120 T300 120 L300 200 L0 200 Z" fill="#1D9CA1" opacity=".5"/><path d="M0 140 Q75 100 150 140 T300 140 L300 200 L0 200 Z" fill="#48D886" opacity=".5"/><text x="90" y="80" fill="white" font-size="14" font-weight="bold">Smooth waves</text>`),
    tags: ['modern', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'hero-highlight',
    label: 'Dot-grid highlight',
    description: 'Pattern grid background with a highlight sweep across text.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><g fill="#475569" opacity=".5"><circle cx="40" cy="40" r="1.5"/><circle cx="80" cy="40" r="1.5"/><circle cx="120" cy="40" r="1.5"/><circle cx="160" cy="40" r="1.5"/><circle cx="200" cy="40" r="1.5"/><circle cx="240" cy="40" r="1.5"/><circle cx="40" cy="80" r="1.5"/><circle cx="80" cy="80" r="1.5"/><circle cx="120" cy="80" r="1.5"/><circle cx="160" cy="80" r="1.5"/><circle cx="200" cy="80" r="1.5"/><circle cx="240" cy="80" r="1.5"/><circle cx="40" cy="120" r="1.5"/><circle cx="80" cy="120" r="1.5"/><circle cx="120" cy="120" r="1.5"/><circle cx="160" cy="120" r="1.5"/><circle cx="200" cy="120" r="1.5"/><circle cx="240" cy="120" r="1.5"/></g><text x="80" y="110" fill="white" font-size="14" font-weight="bold">Highlighted text</text>`),
    tags: ['dark', 'modern'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'sparkles',
    label: 'Sparkles',
    description: 'Particle sparkles drift across a dark hero. Gala / event feel.',
    preview: svg(`<rect width="300" height="200" fill="#020617"/><circle cx="40" cy="30" r="1" fill="white"/><circle cx="80" cy="60" r="1" fill="white"/><circle cx="120" cy="20" r="1" fill="white"/><circle cx="180" cy="90" r="1" fill="white"/><circle cx="240" cy="40" r="1" fill="white"/><circle cx="60" cy="120" r="1" fill="white"/><circle cx="200" cy="150" r="1" fill="white"/><text x="80" y="110" fill="white" font-size="14" font-weight="bold">Sparkling night</text>`),
    tags: ['dark', 'animated', 'bold'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'two-column-image',
    label: 'Split with image',
    description: 'Headline + CTA on the left, hero photo on the right.',
    preview: svg(`${BRAND_GRAD}<rect width="300" height="200" fill="#f8fafc"/><text x="20" y="80" fill="#0f172a" font-size="14" font-weight="bold">Your pitch</text><text x="20" y="100" fill="#64748b" font-size="9">Two short lines</text><rect x="20" y="120" width="60" height="18" rx="4" fill="url(#g)"/><rect x="160" y="30" width="120" height="140" rx="8" fill="#cbd5e1"/>`),
    requires: [{ field: 'hero.imageIndex', hint: 'Needs a strong photo' }],
    tags: ['classic', 'photo-heavy', 'local'],
  },
  {
    id: 'centered-image',
    label: 'Centered image',
    description: 'Headline above, one bold photo below. Classic and clean.',
    preview: svg(`${BRAND_GRAD}<rect width="300" height="200" fill="#f8fafc"/><text x="80" y="50" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle" transform="translate(70,0)">Centered</text><rect x="50" y="70" width="200" height="100" rx="8" fill="url(#g)"/>`),
    tags: ['classic', 'minimal', 'photo-heavy'],
  },
  {
    id: 'full-bg-image',
    label: 'Full-bleed photo',
    description: 'Full background photo with overlay text. Bold and immersive.',
    preview: svg(`<rect width="300" height="200" fill="#475569"/><rect width="300" height="200" fill="#0f172a" opacity=".4"/><text x="70" y="100" fill="white" font-size="14" font-weight="bold">Big mood shot</text><text x="70" y="118" fill="white" font-size="9" opacity=".8">Overlay text</text>`),
    requires: [{ field: 'hero.imageIndex', hint: 'Must have a high-quality photo' }],
    tags: ['bold', 'photo-heavy', 'dark'],
  },
  {
    id: 'dither',
    label: 'Dither',
    description: 'Retro stippled pattern on dark with brand color wash.',
    preview: svg(`<rect width="300" height="200" fill="#020617"/><g fill="white" opacity=".15"><circle cx="20" cy="20" r=".8"/><circle cx="40" cy="20" r=".8"/><circle cx="60" cy="20" r=".8"/><circle cx="80" cy="20" r=".8"/><circle cx="100" cy="20" r=".8"/><circle cx="120" cy="20" r=".8"/><circle cx="140" cy="20" r=".8"/><circle cx="160" cy="20" r=".8"/><circle cx="180" cy="20" r=".8"/><circle cx="200" cy="20" r=".8"/><circle cx="220" cy="20" r=".8"/><circle cx="240" cy="20" r=".8"/><circle cx="260" cy="20" r=".8"/><circle cx="280" cy="20" r=".8"/><circle cx="30" cy="40" r=".8"/><circle cx="50" cy="40" r=".8"/><circle cx="70" cy="40" r=".8"/><circle cx="90" cy="40" r=".8"/><circle cx="110" cy="40" r=".8"/><circle cx="130" cy="40" r=".8"/><circle cx="150" cy="40" r=".8"/><circle cx="170" cy="40" r=".8"/><circle cx="190" cy="40" r=".8"/><circle cx="210" cy="40" r=".8"/><circle cx="230" cy="40" r=".8"/><circle cx="250" cy="40" r=".8"/><circle cx="270" cy="40" r=".8"/></g><text x="80" y="110" fill="white" font-size="14" font-weight="bold">Retro vibes</text>`),
    tags: ['dark', 'modern'],
  },
  {
    id: 'multicolor',
    label: 'Multicolor orbs',
    description: 'Soft color orbs in brand palette. Bold without being childish.',
    preview: svg(`<rect width="300" height="200" fill="#fafafa"/><circle cx="50" cy="50" r="50" fill="#48D886" opacity=".4"/><circle cx="230" cy="60" r="40" fill="#1D9CA1" opacity=".4"/><circle cx="150" cy="150" r="45" fill="#FFEC3D" opacity=".4"/><text x="70" y="110" fill="#0f172a" font-size="14" font-weight="bold">Playful brand</text>`),
    tags: ['playful', 'modern', 'bold'],
    animated: true,
  },
  {
    id: 'meteors',
    label: 'Meteors',
    description: 'Falling meteor trails on dark. Event / launch / night vibe.',
    preview: svg(`<rect width="300" height="200" fill="#020617"/><line x1="40" y1="10" x2="10" y2="60" stroke="#fff" stroke-width="1" opacity=".8"/><line x1="120" y1="10" x2="90" y2="60" stroke="#fff" stroke-width="1" opacity=".6"/><line x1="200" y1="30" x2="170" y2="80" stroke="#fff" stroke-width="1" opacity=".7"/><line x1="280" y1="10" x2="240" y2="70" stroke="#fff" stroke-width="1" opacity=".5"/><text x="90" y="120" fill="white" font-size="14" font-weight="bold">Launch night</text>`),
    tags: ['dark', 'bold', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'vortex',
    label: 'Vortex',
    description: 'Swirling particles behind centered copy. Premium, dynamic.',
    preview: svg(`<rect width="300" height="200" fill="#020617"/><circle cx="150" cy="100" r="60" fill="none" stroke="#1D9CA1" stroke-width="1" opacity=".3"/><circle cx="150" cy="100" r="40" fill="none" stroke="#48D886" stroke-width="1" opacity=".5"/><circle cx="150" cy="100" r="20" fill="none" stroke="#FFEC3D" stroke-width="1" opacity=".7"/><text x="90" y="105" fill="white" font-size="14" font-weight="bold">Premium</text>`),
    tags: ['dark', 'modern', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'lamp',
    label: 'Lamp',
    description: 'Dramatic overhead spotlight. Luxury, cinematic.',
    preview: svg(`<defs><linearGradient id="lamp" x1=".5" x2=".5" y1="0" y2="1"><stop offset="0" stop-color="#1D9CA1" stop-opacity=".8"/><stop offset="1" stop-color="#020617" stop-opacity="0"/></linearGradient></defs><rect width="300" height="200" fill="#020617"/><polygon points="150,0 100,120 200,120" fill="url(#lamp)"/><text x="90" y="150" fill="white" font-size="14" font-weight="bold">Luxury</text>`),
    tags: ['dark', 'bold', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'shooting-stars',
    label: 'Shooting stars',
    description: 'Starry night with meteors streaking across. Dreamy, premium.',
    preview: svg(`<rect width="300" height="200" fill="#020617"/><circle cx="30" cy="30" r=".8" fill="white"/><circle cx="80" cy="60" r=".8" fill="white"/><circle cx="150" cy="20" r=".8" fill="white"/><circle cx="220" cy="80" r=".8" fill="white"/><circle cx="270" cy="40" r=".8" fill="white"/><line x1="50" y1="20" x2="90" y2="50" stroke="#48D886" stroke-width="1.5" opacity=".8"/><line x1="180" y1="30" x2="230" y2="70" stroke="#1D9CA1" stroke-width="1.5" opacity=".7"/><text x="90" y="130" fill="white" font-size="13" font-weight="bold">Night vibes</text>`),
    tags: ['dark', 'modern', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'boxes',
    label: 'Animated boxes',
    description: '3D-tilted grid of color-shifting boxes. Tech-forward, interactive.',
    preview: svg(`<rect width="300" height="200" fill="#020617"/><g transform="skewX(-15) translate(20,20)"><rect x="0" y="0" width="30" height="30" fill="#1e293b" stroke="#334155"/><rect x="32" y="0" width="30" height="30" fill="#48D886" opacity=".3" stroke="#334155"/><rect x="64" y="0" width="30" height="30" fill="#1e293b" stroke="#334155"/><rect x="96" y="0" width="30" height="30" fill="#1D9CA1" opacity=".3" stroke="#334155"/><rect x="0" y="32" width="30" height="30" fill="#1D9CA1" opacity=".3" stroke="#334155"/><rect x="32" y="32" width="30" height="30" fill="#1e293b" stroke="#334155"/><rect x="64" y="32" width="30" height="30" fill="#48D886" opacity=".3" stroke="#334155"/><rect x="96" y="32" width="30" height="30" fill="#1e293b" stroke="#334155"/></g><text x="80" y="140" fill="white" font-size="14" font-weight="bold">Modern tech</text>`),
    tags: ['dark', 'modern', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'ripple',
    label: 'Ripple grid',
    description: 'Subtle radial ripple on a light grid background. Calm, modern.',
    preview: svg(`<rect width="300" height="200" fill="#fafafa"/><g opacity=".15" stroke="#94a3b8" fill="none"><circle cx="150" cy="100" r="30"/><circle cx="150" cy="100" r="50"/><circle cx="150" cy="100" r="70"/><circle cx="150" cy="100" r="90"/></g><g stroke="#e2e8f0" stroke-width=".5"><line x1="0" y1="40" x2="300" y2="40"/><line x1="0" y1="80" x2="300" y2="80"/><line x1="0" y1="120" x2="300" y2="120"/><line x1="0" y1="160" x2="300" y2="160"/><line x1="50" y1="0" x2="50" y2="200"/><line x1="100" y1="0" x2="100" y2="200"/><line x1="150" y1="0" x2="150" y2="200"/><line x1="200" y1="0" x2="200" y2="200"/><line x1="250" y1="0" x2="250" y2="200"/></g><text x="80" y="105" fill="#0f172a" font-size="14" font-weight="bold">Calm modern</text>`),
    tags: ['minimal', 'light', 'modern'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'parallax-images',
    label: 'Scrolling image rows',
    description: 'Three rows of photos parallax-scroll across. Great for portfolios.',
    preview: svg(`<rect width="300" height="200" fill="#020617"/><rect x="10" y="30" width="50" height="30" fill="#334155"/><rect x="70" y="30" width="50" height="30" fill="#475569"/><rect x="130" y="30" width="50" height="30" fill="#334155"/><rect x="190" y="30" width="50" height="30" fill="#475569"/><rect x="250" y="30" width="50" height="30" fill="#334155"/><rect x="30" y="80" width="50" height="30" fill="#475569"/><rect x="90" y="80" width="50" height="30" fill="#334155"/><rect x="150" y="80" width="50" height="30" fill="#475569"/><rect x="210" y="80" width="50" height="30" fill="#334155"/><rect x="50" y="130" width="50" height="30" fill="#475569"/><rect x="110" y="130" width="50" height="30" fill="#334155"/><rect x="170" y="130" width="50" height="30" fill="#475569"/><rect x="230" y="130" width="50" height="30" fill="#334155"/>`),
    requires: [{ field: 'images', minItems: 6, hint: 'Needs 6+ photos to fill the rows' }],
    tags: ['photo-heavy', 'modern', 'animated'],
    aceternity: true,
  },
];

/* ------------------------------------------------------------------ */
/* TEAM VARIANTS                                                      */
/* ------------------------------------------------------------------ */

export const TEAM_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'portrait',
    label: 'Portrait cards',
    description: 'Tall photo with name, role, bio. The most informative option.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="30" width="60" height="100" rx="6" fill="#cbd5e1"/><rect x="100" y="30" width="60" height="100" rx="6" fill="#cbd5e1"/><rect x="180" y="30" width="60" height="100" rx="6" fill="#cbd5e1"/><rect x="20" y="140" width="40" height="6" fill="#0f172a"/><rect x="100" y="140" width="40" height="6" fill="#0f172a"/><rect x="180" y="140" width="40" height="6" fill="#0f172a"/>`),
    requires: [{ field: 'team.members', minItems: 2, hint: '2+ members with photos' }],
    tags: ['classic', 'local'],
  },
  {
    id: 'minimal',
    label: 'Minimal avatars',
    description: 'Small circular avatars with name and role. Dense and efficient.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><circle cx="50" cy="70" r="24" fill="#cbd5e1"/><circle cx="110" cy="70" r="24" fill="#cbd5e1"/><circle cx="170" cy="70" r="24" fill="#cbd5e1"/><circle cx="230" cy="70" r="24" fill="#cbd5e1"/><rect x="32" y="110" width="36" height="4" fill="#0f172a"/><rect x="92" y="110" width="36" height="4" fill="#0f172a"/><rect x="152" y="110" width="36" height="4" fill="#0f172a"/><rect x="212" y="110" width="36" height="4" fill="#0f172a"/>`),
    requires: [{ field: 'team.members', minItems: 3, hint: '3+ members work best' }],
    tags: ['minimal', 'modern'],
  },
  {
    id: 'quote',
    label: 'Quote cards',
    description: 'Photo + bio styled as a pull-quote. Personal and warm.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="30" width="80" height="120" rx="10" fill="#fff" stroke="#e2e8f0"/><circle cx="40" cy="50" r="12" fill="#cbd5e1"/><rect x="30" y="80" width="60" height="3" fill="#64748b"/><rect x="30" y="88" width="60" height="3" fill="#64748b"/><rect x="120" y="30" width="80" height="120" rx="10" fill="#fff" stroke="#e2e8f0"/><circle cx="140" cy="50" r="12" fill="#cbd5e1"/><rect x="130" y="80" width="60" height="3" fill="#64748b"/><rect x="130" y="88" width="60" height="3" fill="#64748b"/><rect x="220" y="30" width="60" height="120" rx="10" fill="#fff" stroke="#e2e8f0"/>`),
    requires: [{ field: 'team.members', minItems: 2, hint: 'Looks best with a written bio' }],
    tags: ['classic', 'local'],
  },
  {
    id: 'banner',
    label: 'Banner cards',
    description: 'Wide landscape shot with overlay. Good for 1-3 featured people.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="40" width="260" height="50" rx="6" fill="#64748b"/><rect x="20" y="40" width="260" height="50" rx="6" fill="#0f172a" opacity=".4"/><rect x="35" y="60" width="80" height="5" fill="white"/><rect x="20" y="110" width="260" height="50" rx="6" fill="#64748b"/><rect x="20" y="110" width="260" height="50" rx="6" fill="#0f172a" opacity=".4"/><rect x="35" y="130" width="80" height="5" fill="white"/>`),
    requires: [{ field: 'team.members', minItems: 1, hint: 'Wide landscape photos work best' }],
    tags: ['bold', 'photo-heavy'],
  },
  {
    id: 'light-bg',
    label: 'Light background grid',
    description: 'Aceternity style — light cards with hover lift. Modern agencies.',
    preview: svg(`<rect width="300" height="200" fill="#fafafa"/><rect x="20" y="30" width="70" height="100" rx="8" fill="white" stroke="#e2e8f0"/><rect x="105" y="30" width="70" height="100" rx="8" fill="white" stroke="#e2e8f0" stroke-width="2"/><rect x="190" y="30" width="70" height="100" rx="8" fill="white" stroke="#e2e8f0"/>`),
    requires: [{ field: 'team.members', minItems: 2, hint: '2+ members' }],
    tags: ['modern', 'light', 'minimal'],
    aceternity: true,
  },
  {
    id: 'small-avatars',
    label: 'Stacked avatars',
    description: 'Aceternity-style overlapping avatars with tooltips on hover.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><circle cx="100" cy="100" r="24" fill="#cbd5e1" stroke="#0f172a" stroke-width="3"/><circle cx="130" cy="100" r="24" fill="#94a3b8" stroke="#0f172a" stroke-width="3"/><circle cx="160" cy="100" r="24" fill="#cbd5e1" stroke="#0f172a" stroke-width="3"/><circle cx="190" cy="100" r="24" fill="#94a3b8" stroke="#0f172a" stroke-width="3"/>`),
    requires: [{ field: 'team.members', minItems: 3, hint: '3+ members' }],
    tags: ['modern', 'dark', 'minimal'],
    aceternity: true,
  },
  {
    id: 'card-hover',
    label: 'Hover-glow cards',
    description: 'Aceternity dark cards with a soft glow that follows the cursor.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><rect x="20" y="40" width="80" height="120" rx="12" fill="#1e293b"/><rect x="110" y="40" width="80" height="120" rx="12" fill="#334155" stroke="#1D9CA1" stroke-width="2"/><rect x="200" y="40" width="80" height="120" rx="12" fill="#1e293b"/>`),
    requires: [{ field: 'team.members', minItems: 2, hint: '2+ members' }],
    tags: ['modern', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
];


/* ------------------------------------------------------------------ */
/* TESTIMONIALS / REVIEWS VARIANTS                                    */
/* ------------------------------------------------------------------ */

export const REVIEWS_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'grid',
    label: 'Classic grid',
    description: 'Quote cards in a 2 or 3 column grid. Clean and scannable.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="30" width="80" height="80" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="110" y="30" width="80" height="80" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="200" y="30" width="80" height="80" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="20" y="120" width="80" height="60" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="110" y="120" width="80" height="60" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="200" y="120" width="80" height="60" rx="8" fill="#fff" stroke="#e2e8f0"/>`),
    requires: [{ field: 'reviews', minItems: 3, hint: '3+ reviews' }],
    tags: ['classic', 'local', 'light'],
  },
  {
    id: 'marquee',
    label: 'Auto-scrolling marquee',
    description: 'Reviews drift across the screen continuously. Dynamic.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><rect x="10" y="60" width="90" height="80" rx="8" fill="#1e293b"/><rect x="110" y="60" width="90" height="80" rx="8" fill="#1e293b"/><rect x="210" y="60" width="90" height="80" rx="8" fill="#1e293b"/><path d="M0 100 L10 95 L10 105 Z" fill="#48D886"/>`),
    requires: [{ field: 'reviews', minItems: 4, hint: '4+ reviews' }],
    tags: ['modern', 'animated', 'dark'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'carousel',
    label: 'Manual carousel',
    description: 'Large featured quote with next/prev arrows. Premium feel.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="40" y="40" width="220" height="120" rx="12" fill="#fff" stroke="#e2e8f0" stroke-width="2"/><text x="60" y="90" fill="#0f172a" font-size="11" font-weight="bold">"</text><rect x="70" y="100" width="180" height="4" fill="#64748b"/><rect x="70" y="112" width="160" height="4" fill="#64748b"/><circle cx="20" cy="100" r="10" fill="#e2e8f0"/><circle cx="280" cy="100" r="10" fill="#e2e8f0"/>`),
    requires: [{ field: 'reviews', minItems: 2, hint: '2+ reviews' }],
    tags: ['modern', 'light'],
    aceternity: true,
  },
  {
    id: 'masonry',
    label: 'Masonry grid',
    description: 'Mixed-height quote cards in a Pinterest-style grid.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="20" width="80" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="20" y="100" width="80" height="90" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="110" y="20" width="80" height="110" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="110" y="140" width="80" height="50" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="200" y="20" width="80" height="60" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="200" y="90" width="80" height="100" rx="8" fill="#fff" stroke="#e2e8f0"/>`),
    requires: [{ field: 'reviews', minItems: 5, hint: '5+ reviews with varied length' }],
    tags: ['modern', 'light'],
    aceternity: true,
  },
  {
    id: 'draggable',
    label: 'Draggable cards',
    description: 'Physical-feeling drag-around cards visitors can throw across the section. Playful and tactile.',
    preview: svg(`<rect width="300" height="200" fill="#fef3c7"/><rect x="30" y="40" width="100" height="70" rx="12" fill="#fff" transform="rotate(-6 80 75)" stroke="#e2e8f0"/><rect x="160" y="50" width="100" height="70" rx="12" fill="#fff" transform="rotate(4 210 85)" stroke="#e2e8f0"/><rect x="80" y="110" width="100" height="70" rx="12" fill="#fff" transform="rotate(-2 130 145)" stroke="#e2e8f0"/>`),
    requires: [{ field: 'reviews', minItems: 3, hint: '3+ reviews' }],
    tags: ['playful', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'stack',
    label: 'Card stack',
    description: 'Stacked cards auto-cycle one at a time. Compact and elegant.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="70" y="60" width="160" height="100" rx="12" fill="#fff" transform="rotate(-4 150 110)" stroke="#e2e8f0"/><rect x="75" y="55" width="160" height="100" rx="12" fill="#fff" stroke="#e2e8f0"/><rect x="80" y="50" width="160" height="100" rx="12" fill="#fff" transform="rotate(4 160 100)" stroke="#e2e8f0"/>`),
    requires: [{ field: 'reviews', minItems: 3, hint: '3+ reviews' }],
    tags: ['modern', 'animated', 'minimal'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'animated-testimonials',
    label: 'Animated with photos',
    description: 'One quote at a time with photo avatar and fade transitions.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><circle cx="80" cy="100" r="40" fill="#cbd5e1"/><rect x="140" y="70" width="140" height="4" fill="#64748b"/><rect x="140" y="82" width="120" height="4" fill="#64748b"/><rect x="140" y="94" width="140" height="4" fill="#64748b"/><rect x="140" y="120" width="60" height="3" fill="#0f172a"/><rect x="140" y="130" width="80" height="2" fill="#94a3b8"/>`),
    requires: [{ field: 'reviews', minItems: 2, hint: 'Reviews with avatars' }],
    tags: ['modern', 'photo-heavy'],
    animated: true,
    aceternity: true,
  },
];

/* ------------------------------------------------------------------ */
/* SERVICES / FEATURES VARIANTS                                       */
/* ------------------------------------------------------------------ */

export const SERVICES_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'cards',
    label: 'Simple cards',
    description: 'Three or four cards with icon + title + description.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="50" width="80" height="110" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="110" y="50" width="80" height="110" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="200" y="50" width="80" height="110" rx="10" fill="#fff" stroke="#e2e8f0"/><circle cx="60" cy="75" r="10" fill="#48D886"/><circle cx="150" cy="75" r="10" fill="#48D886"/><circle cx="240" cy="75" r="10" fill="#48D886"/>`),
    requires: [{ field: 'services', minItems: 2, hint: '2+ services' }],
    tags: ['classic', 'light', 'local'],
  },
  {
    id: 'bento',
    label: 'Bento grid',
    description: 'Asymmetric grid where featured services span larger tiles.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="20" width="160" height="80" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="190" y="20" width="90" height="80" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="20" y="110" width="80" height="70" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="110" y="110" width="80" height="70" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="200" y="110" width="80" height="70" rx="10" fill="#fff" stroke="#e2e8f0"/>`),
    requires: [{ field: 'services', minItems: 3, hint: '3-5 services; featured ones span 2 cols' }],
    tags: ['modern', 'light'],
    aceternity: true,
  },
  {
    id: 'sticky-scroll',
    label: 'Sticky scroll reveal',
    description: 'Service text scrolls while a sticky image panel changes alongside.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="20" width="120" height="160" rx="4" fill="#fff"/><rect x="160" y="20" width="120" height="160" rx="10" fill="#1D9CA1"/><rect x="40" y="40" width="80" height="6" fill="#0f172a"/><rect x="40" y="54" width="60" height="4" fill="#64748b"/><rect x="40" y="80" width="80" height="6" fill="#0f172a"/><rect x="40" y="94" width="70" height="4" fill="#64748b"/><rect x="40" y="120" width="80" height="6" fill="#0f172a"/><rect x="40" y="134" width="60" height="4" fill="#64748b"/>`),
    requires: [{ field: 'services', minItems: 3, hint: '3+ services, each with an image' }],
    tags: ['modern', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'hover-effect',
    label: 'Hover effect cards',
    description: 'Cards glow or expand on hover. Engaging for mouse users.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><rect x="20" y="50" width="80" height="110" rx="10" fill="#1e293b"/><rect x="110" y="50" width="80" height="110" rx="10" fill="#1e293b" stroke="#48D886" stroke-width="2"/><rect x="200" y="50" width="80" height="110" rx="10" fill="#1e293b"/>`),
    requires: [{ field: 'services', minItems: 2, hint: '2+ services' }],
    tags: ['modern', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: '3d-cards',
    label: '3D tilt cards',
    description: 'Cards tilt on mouse move creating depth. Premium feel.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="60" y="40" width="70" height="120" rx="10" fill="#fff" stroke="#e2e8f0" transform="rotate(-6 95 100)"/><rect x="115" y="40" width="70" height="120" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="170" y="40" width="70" height="120" rx="10" fill="#fff" stroke="#e2e8f0" transform="rotate(6 205 100)"/>`),
    requires: [{ field: 'services', minItems: 2, hint: '2+ services' }],
    tags: ['modern', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'wobble',
    label: 'Wobble cards',
    description: 'Cards wobble and tilt on mouse movement. Playful, modern.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><rect x="20" y="40" width="80" height="120" rx="12" fill="#1e293b" transform="rotate(-3 60 100)"/><rect x="110" y="40" width="80" height="120" rx="12" fill="#1e293b"/><rect x="200" y="40" width="80" height="120" rx="12" fill="#1e293b" transform="rotate(3 240 100)"/>`),
    requires: [{ field: 'services', minItems: 2, hint: '2+ services' }],
    tags: ['playful', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'glare',
    label: 'Glare cards',
    description: 'Premium shiny cards with a glare that follows the mouse.',
    preview: svg(`<defs><linearGradient id="glare" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#4c1d95"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs><rect width="300" height="200" fill="#fafafa"/><rect x="20" y="40" width="80" height="120" rx="12" fill="url(#glare)"/><rect x="110" y="40" width="80" height="120" rx="12" fill="url(#glare)"/><rect x="200" y="40" width="80" height="120" rx="12" fill="url(#glare)"/><rect x="30" y="60" width="40" height="10" fill="white" opacity=".4"/>`),
    requires: [{ field: 'services', minItems: 2, hint: '2+ services' }],
    tags: ['bold', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'expandable',
    label: 'Click to expand',
    description: 'Compact cards open to a modal with full details. Great when services have long descriptions.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="30" width="80" height="80" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="110" y="30" width="80" height="80" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="200" y="30" width="80" height="80" rx="10" fill="#fff" stroke="#e2e8f0"/><rect x="50" y="120" width="200" height="60" rx="12" fill="#fff" stroke="#1D9CA1" stroke-width="2"/><rect x="70" y="135" width="50" height="5" fill="#0f172a"/><rect x="70" y="148" width="160" height="3" fill="#64748b"/><rect x="70" y="156" width="140" height="3" fill="#64748b"/></svg>`),
    requires: [{ field: 'services', minItems: 2, hint: '2+ services' }],
    tags: ['modern', 'classic', 'light'],
    animated: true,
    aceternity: true,
  },
];

/* ------------------------------------------------------------------ */
/* GALLERY VARIANTS                                                   */
/* ------------------------------------------------------------------ */

export const GALLERY_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'grid',
    label: 'Grid',
    description: 'Regular grid of photos, 3-4 per row. Simple and reliable.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="30" width="60" height="50" fill="#cbd5e1"/><rect x="90" y="30" width="60" height="50" fill="#cbd5e1"/><rect x="160" y="30" width="60" height="50" fill="#cbd5e1"/><rect x="230" y="30" width="50" height="50" fill="#cbd5e1"/><rect x="20" y="90" width="60" height="50" fill="#cbd5e1"/><rect x="90" y="90" width="60" height="50" fill="#cbd5e1"/><rect x="160" y="90" width="60" height="50" fill="#cbd5e1"/><rect x="230" y="90" width="50" height="50" fill="#cbd5e1"/>`),
    requires: [{ field: 'images', minItems: 4, hint: '4+ photos' }],
    tags: ['classic', 'local'],
  },
  {
    id: 'masonry',
    label: 'Masonry',
    description: 'Mixed-height photos flowing naturally. Pinterest-style.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="20" width="60" height="80" fill="#cbd5e1"/><rect x="20" y="110" width="60" height="60" fill="#cbd5e1"/><rect x="90" y="20" width="60" height="50" fill="#cbd5e1"/><rect x="90" y="80" width="60" height="90" fill="#cbd5e1"/><rect x="160" y="20" width="60" height="70" fill="#cbd5e1"/><rect x="160" y="100" width="60" height="70" fill="#cbd5e1"/><rect x="230" y="20" width="50" height="100" fill="#cbd5e1"/><rect x="230" y="130" width="50" height="40" fill="#cbd5e1"/>`),
    requires: [{ field: 'images', minItems: 6, hint: '6+ photos with varied aspect ratios' }],
    tags: ['modern', 'photo-heavy'],
    aceternity: true,
  },
  {
    id: 'apple-carousel',
    label: 'Apple-style carousel',
    description: 'Swipeable cards that expand on tap. Showcase portfolio projects.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="10" y="40" width="110" height="140" rx="12" fill="#0f172a"/><rect x="130" y="40" width="110" height="140" rx="12" fill="#0f172a"/><rect x="250" y="40" width="40" height="140" rx="12" fill="#0f172a"/><text x="25" y="160" fill="white" font-size="8">Project 1</text><text x="145" y="160" fill="white" font-size="8">Project 2</text>`),
    requires: [{ field: 'images', minItems: 3, hint: '3+ images with titles' }],
    tags: ['modern', 'photo-heavy', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'focus-cards',
    label: 'Focus cards',
    description: 'Hover any card and others dim — focused spotlight effect.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><rect x="20" y="40" width="80" height="120" rx="10" fill="#1e293b" opacity=".4"/><rect x="110" y="40" width="80" height="120" rx="10" fill="#1e293b"/><rect x="200" y="40" width="80" height="120" rx="10" fill="#1e293b" opacity=".4"/>`),
    requires: [{ field: 'images', minItems: 3, hint: '3+ images' }],
    tags: ['modern', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'parallax',
    label: 'Parallax scroll grid',
    description: 'Three columns that scroll at different speeds as you move.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="10" width="80" height="60" fill="#cbd5e1"/><rect x="20" y="80" width="80" height="80" fill="#94a3b8"/><rect x="110" y="40" width="80" height="70" fill="#cbd5e1"/><rect x="110" y="120" width="80" height="60" fill="#94a3b8"/><rect x="200" y="10" width="80" height="70" fill="#94a3b8"/><rect x="200" y="90" width="80" height="80" fill="#cbd5e1"/>`),
    requires: [{ field: 'images', minItems: 6, hint: '6+ photos' }],
    tags: ['modern', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: '3d-marquee',
    label: '3D marquee',
    description: 'Images tilt back in 3D and scroll past. Bold and eye-catching.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><g transform="skewX(-10)"><rect x="20" y="50" width="50" height="40" fill="#475569"/><rect x="80" y="50" width="50" height="40" fill="#334155"/><rect x="140" y="50" width="50" height="40" fill="#475569"/><rect x="200" y="50" width="50" height="40" fill="#334155"/><rect x="20" y="110" width="50" height="40" fill="#334155"/><rect x="80" y="110" width="50" height="40" fill="#475569"/><rect x="140" y="110" width="50" height="40" fill="#334155"/></g>`),
    requires: [{ field: 'images', minItems: 8, hint: '8+ photos' }],
    tags: ['bold', 'animated', 'dark'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'layout-grid',
    label: 'Click to expand',
    description: 'Photos expand fullscreen on click. Great for portfolio detail.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><rect x="20" y="20" width="140" height="80" rx="8" fill="#475569"/><rect x="170" y="20" width="65" height="80" rx="8" fill="#334155"/><rect x="245" y="20" width="35" height="80" rx="8" fill="#475569"/><rect x="20" y="110" width="65" height="70" rx="8" fill="#334155"/><rect x="95" y="110" width="65" height="70" rx="8" fill="#475569"/><rect x="170" y="110" width="110" height="70" rx="8" fill="#334155"/>`),
    requires: [{ field: 'images', minItems: 4, hint: '4 photos' }],
    tags: ['modern', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'compare',
    label: 'Before / After',
    description: 'Drag a slider to wipe between two images. Perfect for trades.',
    preview: svg(`<rect width="300" height="200" fill="#fafafa"/><rect x="40" y="20" width="220" height="160" rx="8" fill="#cbd5e1"/><rect x="40" y="20" width="110" height="160" rx="8" fill="#64748b"/><line x1="150" y1="20" x2="150" y2="180" stroke="white" stroke-width="3"/><circle cx="150" cy="100" r="12" fill="white" stroke="#0f172a" stroke-width="2"/><text x="148" y="104" font-size="12" text-anchor="middle" fill="#0f172a">‹›</text>`),
    requires: [{ field: 'images', minItems: 2, hint: '2 photos (before and after)' }],
    tags: ['local', 'animated', 'photo-heavy'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'direction-aware',
    label: 'Direction-aware hover',
    description: 'Overlays slide in from the direction of the cursor on hover.',
    preview: svg(`<rect width="300" height="200" fill="#fafafa"/><rect x="20" y="20" width="80" height="80" rx="8" fill="#cbd5e1"/><rect x="110" y="20" width="80" height="80" rx="8" fill="#94a3b8"/><rect x="110" y="20" width="80" height="80" rx="8" fill="#0f172a" opacity=".6"/><rect x="125" y="80" width="50" height="4" fill="white"/><rect x="200" y="20" width="80" height="80" rx="8" fill="#cbd5e1"/><rect x="20" y="110" width="80" height="70" rx="8" fill="#cbd5e1"/><rect x="110" y="110" width="80" height="70" rx="8" fill="#cbd5e1"/><rect x="200" y="110" width="80" height="70" rx="8" fill="#cbd5e1"/>`),
    requires: [{ field: 'images', minItems: 3, hint: '3+ photos' }],
    tags: ['modern', 'photo-heavy', 'animated'],
    animated: true,
    aceternity: true,
  },
];

/* ------------------------------------------------------------------ */
/* FAQ VARIANTS                                                       */
/* ------------------------------------------------------------------ */

export const FAQ_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'accordion',
    label: 'Accordion',
    description: 'Click to expand each question. Space-efficient, classic.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><rect x="20" y="30" width="260" height="30" rx="6" fill="#f1f5f9"/><rect x="20" y="70" width="260" height="30" rx="6" fill="#f1f5f9"/><rect x="20" y="110" width="260" height="60" rx="6" fill="#f1f5f9"/><rect x="40" y="125" width="200" height="4" fill="#0f172a"/><rect x="40" y="140" width="220" height="3" fill="#64748b"/><rect x="40" y="150" width="180" height="3" fill="#64748b"/>`),
    requires: [{ field: 'faq', minItems: 3, hint: '3+ Q&A' }],
    tags: ['classic', 'light'],
  },
  {
    id: 'grid',
    label: 'Grid',
    description: 'All answers visible in a 2-column grid. Fast to skim.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="20" width="130" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="160" y="20" width="120" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="20" y="100" width="130" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="160" y="100" width="120" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/>`),
    requires: [{ field: 'faq', minItems: 4, hint: '4+ Q&A' }],
    tags: ['modern', 'light'],
    aceternity: true,
  },
  {
    id: 'with-background',
    label: 'With animated background',
    description: 'Accordion with a soft beams/aurora backdrop. Feels premium.',
    preview: svg(`<defs><linearGradient id="f" x1="0" x2="1"><stop offset="0" stop-color="#1D9CA1" stop-opacity=".3"/><stop offset="1" stop-color="#48D886" stop-opacity=".3"/></linearGradient></defs><rect width="300" height="200" fill="#0f172a"/><rect width="300" height="200" fill="url(#f)"/><rect x="40" y="30" width="220" height="30" rx="6" fill="#1e293b"/><rect x="40" y="70" width="220" height="30" rx="6" fill="#1e293b"/><rect x="40" y="110" width="220" height="30" rx="6" fill="#1e293b"/>`),
    requires: [{ field: 'faq', minItems: 3, hint: '3+ Q&A' }],
    tags: ['modern', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
];

/* ------------------------------------------------------------------ */
/* CTA VARIANTS                                                       */
/* ------------------------------------------------------------------ */

export const CTA_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'simple',
    label: 'Simple',
    description: 'Headline + subtext + one button. The safe default.',
    preview: svg(`${BRAND_GRAD}<rect width="300" height="200" fill="url(#g)"/><text x="80" y="80" fill="white" font-size="14" font-weight="bold">Ready to start?</text><text x="80" y="100" fill="white" opacity=".8" font-size="9">Short sub-line here</text><rect x="80" y="120" width="80" height="22" rx="4" fill="white"/><text x="100" y="135" fill="#0f172a" font-size="9" font-weight="bold">Get started</text>`),
    tags: ['classic', 'light'],
  },
  {
    id: 'with-images',
    label: 'Photo strip',
    description: 'CTA with a row of client photos floating around it.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><circle cx="30" cy="60" r="15" fill="#cbd5e1"/><circle cx="60" cy="40" r="15" fill="#cbd5e1"/><circle cx="90" cy="70" r="15" fill="#cbd5e1"/><circle cx="240" cy="140" r="15" fill="#cbd5e1"/><circle cx="270" cy="120" r="15" fill="#cbd5e1"/><text x="100" y="110" fill="#0f172a" font-size="13" font-weight="bold">Join us</text><rect x="100" y="120" width="70" height="20" rx="4" fill="#48D886"/>`),
    requires: [{ field: 'images', minItems: 4, hint: '4+ photos make this shine' }],
    tags: ['modern', 'photo-heavy'],
    aceternity: true,
  },
  {
    id: 'masonry-images',
    label: 'Masonry with text',
    description: 'Large CTA text with a masonry photo wall beside it.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><text x="20" y="60" fill="#0f172a" font-size="16" font-weight="bold">Big CTA</text><rect x="20" y="75" width="80" height="22" rx="4" fill="#1D9CA1"/><rect x="140" y="20" width="60" height="60" fill="#cbd5e1"/><rect x="210" y="20" width="70" height="40" fill="#94a3b8"/><rect x="140" y="90" width="70" height="80" fill="#94a3b8"/><rect x="220" y="70" width="60" height="100" fill="#cbd5e1"/>`),
    requires: [{ field: 'images', minItems: 4, hint: '4+ photos' }],
    tags: ['modern', 'photo-heavy', 'bold'],
    aceternity: true,
  },
  {
    id: 'centered-bold',
    label: 'Centered bold',
    description: 'Large centered text with gradient background. Max impact.',
    preview: svg(`<defs><linearGradient id="cta" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#1D9CA1"/></linearGradient></defs><rect width="300" height="200" fill="url(#cta)"/><text x="80" y="90" fill="white" font-size="18" font-weight="bold" text-anchor="start">START NOW</text><text x="80" y="110" fill="white" opacity=".8" font-size="9">Join thousands of happy clients</text>`),
    tags: ['bold', 'dark', 'modern'],
  },
  {
    id: 'moving-border',
    label: 'Moving border',
    description: 'Animated glowing border traces the CTA button. Subtle, modern.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><text x="80" y="80" fill="#0f172a" font-size="16" font-weight="bold">Ready?</text><rect x="100" y="100" width="100" height="40" rx="20" fill="#fff" stroke="#48D886" stroke-width="2"/><rect x="100" y="100" width="40" height="4" rx="2" fill="#1D9CA1"/><text x="120" y="125" fill="#0f172a" font-size="10" font-weight="bold">Get started</text>`),
    tags: ['modern', 'animated', 'minimal'],
    animated: true,
    aceternity: true,
  },
  {
    id: 'text-reveal',
    label: 'Hover to reveal',
    description: 'Interactive text card — hover/drag to reveal a hidden message.',
    preview: svg(`<rect width="300" height="200" fill="#020617"/><rect x="40" y="60" width="220" height="80" rx="12" fill="#0f172a" stroke="#334155"/><text x="90" y="95" fill="#94a3b8" font-size="13" font-weight="bold">Your brand</text><line x1="150" y1="60" x2="150" y2="140" stroke="#48D886" stroke-width="2"/><text x="175" y="115" fill="#48D886" font-size="13" font-weight="bold">Our words</text>`),
    tags: ['playful', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
];

/* ------------------------------------------------------------------ */
/* FOOTER, NAV, STATS, CONTACT VARIANTS                               */
/* ------------------------------------------------------------------ */

export const FOOTER_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'four-grid',
    label: 'Four-column grid',
    description: 'Traditional footer with 4 link columns + brand.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><rect x="20" y="40" width="40" height="6" fill="#48D886"/><rect x="20" y="55" width="60" height="3" fill="#64748b"/><rect x="20" y="62" width="60" height="3" fill="#64748b"/><rect x="100" y="40" width="30" height="4" fill="#fff"/><rect x="100" y="55" width="50" height="3" fill="#64748b"/><rect x="100" y="62" width="50" height="3" fill="#64748b"/><rect x="170" y="40" width="30" height="4" fill="#fff"/><rect x="170" y="55" width="50" height="3" fill="#64748b"/><rect x="170" y="62" width="50" height="3" fill="#64748b"/><rect x="240" y="40" width="30" height="4" fill="#fff"/><rect x="240" y="55" width="40" height="3" fill="#64748b"/><rect x="240" y="62" width="40" height="3" fill="#64748b"/>`),
    tags: ['classic', 'dark'],
  },
  {
    id: 'centered-logo',
    label: 'Centered with logo',
    description: 'Big centered logo over a thin link row. Minimal.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><circle cx="150" cy="70" r="20" fill="#1D9CA1"/><rect x="90" y="110" width="40" height="3" fill="#64748b"/><rect x="140" y="110" width="40" height="3" fill="#64748b"/><rect x="190" y="110" width="40" height="3" fill="#64748b"/>`),
    tags: ['minimal', 'light'],
  },
  {
    id: 'big-text',
    label: 'Big brand text',
    description: 'Massive brand name fills the footer with a thin link row.',
    preview: svg(`<rect width="300" height="200" fill="#0f172a"/><text x="20" y="130" fill="#1e293b" font-size="60" font-weight="900">BRAND</text><text x="20" y="160" fill="#64748b" font-size="8">About · Work · Contact · Privacy</text>`),
    tags: ['bold', 'dark', 'modern'],
  },
];

export const NAV_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Logo on the left, links on the right. The default.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><rect width="300" height="40" fill="#fff" stroke="#e2e8f0"/><circle cx="30" cy="20" r="10" fill="#1D9CA1"/><rect x="180" y="17" width="30" height="3" fill="#64748b"/><rect x="215" y="17" width="25" height="3" fill="#64748b"/><rect x="245" y="12" width="40" height="14" rx="4" fill="#48D886"/>`),
    tags: ['classic', 'light'],
  },
  {
    id: 'pill',
    label: 'Floating pill',
    description: 'Rounded floating bar in the center of the screen.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="70" y="20" width="160" height="30" rx="15" fill="#fff" stroke="#e2e8f0" stroke-width="2"/><circle cx="90" cy="35" r="6" fill="#1D9CA1"/><rect x="110" y="33" width="20" height="3" fill="#64748b"/><rect x="135" y="33" width="20" height="3" fill="#64748b"/><rect x="160" y="33" width="20" height="3" fill="#64748b"/><rect x="185" y="30" width="35" height="10" rx="5" fill="#48D886"/>`),
    tags: ['modern', 'light'],
    aceternity: true,
  },
  {
    id: 'dark-shadow',
    label: 'Dark with shadow',
    description: 'Dark nav bar with a crisp drop shadow. Premium feel.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect width="300" height="40" fill="#0f172a"/><rect x="0" y="40" width="300" height="4" fill="#0f172a" opacity=".2"/><circle cx="30" cy="20" r="8" fill="#48D886"/><rect x="180" y="17" width="25" height="3" fill="#94a3b8"/><rect x="210" y="17" width="25" height="3" fill="#94a3b8"/>`),
    tags: ['dark', 'modern'],
    aceternity: true,
  },
  {
    id: 'resizable',
    label: 'Resizable on scroll',
    description: 'Shrinks to a compact pill as you scroll. Modern and clever.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><rect width="300" height="50" fill="#fff" stroke="#e2e8f0"/><rect x="80" y="70" width="140" height="28" rx="14" fill="#0f172a"/><rect x="95" y="80" width="18" height="3" fill="#94a3b8"/><rect x="118" y="80" width="18" height="3" fill="#94a3b8"/><rect x="141" y="80" width="18" height="3" fill="#94a3b8"/>`),
    tags: ['modern', 'animated'],
    animated: true,
    aceternity: true,
  },
];

export const STATS_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'ticker',
    label: 'Animated counters',
    description: 'Numbers count up from 0 as they enter the viewport.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><text x="40" y="90" fill="#1D9CA1" font-size="32" font-weight="900">12k+</text><text x="40" y="115" fill="#64748b" font-size="10">Happy clients</text><text x="130" y="90" fill="#1D9CA1" font-size="32" font-weight="900">98%</text><text x="130" y="115" fill="#64748b" font-size="10">Satisfaction</text><text x="220" y="90" fill="#1D9CA1" font-size="32" font-weight="900">5yr</text><text x="220" y="115" fill="#64748b" font-size="10">Experience</text>`),
    requires: [{ field: 'stats', minItems: 2, hint: '2+ numbers' }],
    tags: ['classic', 'animated', 'light'],
  },
  {
    id: 'gradient',
    label: 'Gradient cards',
    description: 'Big numbers inside gradient cards. Bold and colorful.',
    preview: svg(`${BRAND_GRAD}<rect width="300" height="200" fill="#fff"/><rect x="20" y="50" width="80" height="100" rx="12" fill="url(#g)"/><rect x="110" y="50" width="80" height="100" rx="12" fill="url(#g)"/><rect x="200" y="50" width="80" height="100" rx="12" fill="url(#g)"/>`),
    requires: [{ field: 'stats', minItems: 3, hint: '3 stats' }],
    tags: ['bold', 'modern'],
    aceternity: true,
  },
  {
    id: 'changelog',
    label: 'Changelog style',
    description: 'Compact horizontal stats row with separator dots.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><text x="30" y="100" fill="#0f172a" font-size="20" font-weight="bold">12k+</text><circle cx="95" cy="95" r="2" fill="#cbd5e1"/><text x="105" y="100" fill="#0f172a" font-size="20" font-weight="bold">98%</text><circle cx="165" cy="95" r="2" fill="#cbd5e1"/><text x="175" y="100" fill="#0f172a" font-size="20" font-weight="bold">5yr</text>`),
    requires: [{ field: 'stats', minItems: 2, hint: '2-4 stats' }],
    tags: ['minimal', 'modern', 'light'],
    aceternity: true,
  },
];

export const CONTACT_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'form-side',
    label: 'Form + info side-by-side',
    description: 'Contact form on one side, address / phone / map on the other.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><rect x="20" y="30" width="130" height="140" rx="10" fill="#f8fafc"/><rect x="30" y="45" width="110" height="10" rx="3" fill="#fff"/><rect x="30" y="65" width="110" height="10" rx="3" fill="#fff"/><rect x="30" y="85" width="110" height="30" rx="3" fill="#fff"/><rect x="30" y="125" width="70" height="18" rx="4" fill="#1D9CA1"/><rect x="160" y="30" width="120" height="140" rx="10" fill="#cbd5e1"/>`),
    tags: ['classic', 'local', 'light'],
  },
  {
    id: 'grid-sections',
    label: 'Grid with sections',
    description: 'Multiple contact cards — support, sales, press, etc.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><rect x="20" y="30" width="80" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="110" y="30" width="80" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="200" y="30" width="80" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="65" y="110" width="80" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="155" y="110" width="80" height="70" rx="8" fill="#fff" stroke="#e2e8f0"/>`),
    tags: ['modern', 'light'],
    aceternity: true,
  },
  {
    id: 'shader',
    label: 'With animated shader',
    description: 'Dramatic dark contact section with flowing background shader.',
    preview: svg(`<defs><linearGradient id="s" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs><rect width="300" height="200" fill="url(#s)"/><rect x="30" y="40" width="240" height="120" rx="12" fill="#fff" opacity=".05"/><rect x="45" y="60" width="210" height="10" rx="3" fill="#fff" opacity=".2"/><rect x="45" y="80" width="210" height="10" rx="3" fill="#fff" opacity=".2"/><rect x="45" y="100" width="210" height="30" rx="3" fill="#fff" opacity=".2"/><rect x="45" y="140" width="70" height="18" rx="4" fill="#48D886"/>`),
    tags: ['bold', 'dark', 'animated'],
    animated: true,
    aceternity: true,
  },
];

/* ------------------------------------------------------------------ */
/* MASTER REGISTRY + HELPERS                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* PROCESS VARIANTS                                                   */
/* ------------------------------------------------------------------ */

export const PROCESS_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'numbered',
    label: 'Numbered steps',
    description: '4-column grid with big numbered circles. The default.',
    preview: svg(`<rect width="300" height="200" fill="#f8fafc"/><circle cx="50" cy="70" r="16" fill="#48D886"/><text x="46" y="75" fill="white" font-size="12" font-weight="bold">1</text><circle cx="130" cy="70" r="16" fill="#48D886"/><text x="126" y="75" fill="white" font-size="12" font-weight="bold">2</text><circle cx="210" cy="70" r="16" fill="#48D886"/><text x="206" y="75" fill="white" font-size="12" font-weight="bold">3</text><rect x="30" y="100" width="40" height="4" fill="#0f172a"/><rect x="110" y="100" width="40" height="4" fill="#0f172a"/><rect x="190" y="100" width="40" height="4" fill="#0f172a"/>`),
    tags: ['classic', 'local'],
  },
  {
    id: 'timeline',
    label: 'Vertical timeline',
    description: 'A drawn line progresses past each step as visitors scroll.',
    preview: svg(`<rect width="300" height="200" fill="#fafafa"/><line x1="60" y1="20" x2="60" y2="180" stroke="#1D9CA1" stroke-width="2"/><circle cx="60" cy="40" r="6" fill="#1D9CA1"/><circle cx="60" cy="100" r="6" fill="#1D9CA1"/><circle cx="60" cy="160" r="6" fill="#1D9CA1"/><rect x="90" y="35" width="140" height="6" fill="#0f172a"/><rect x="90" y="45" width="100" height="4" fill="#64748b"/><rect x="90" y="95" width="140" height="6" fill="#0f172a"/><rect x="90" y="105" width="100" height="4" fill="#64748b"/><rect x="90" y="155" width="140" height="6" fill="#0f172a"/>`),
    tags: ['modern', 'animated'],
    animated: true,
    aceternity: true,
  },
];

/* ------------------------------------------------------------------ */
/* LOGO STRIP VARIANTS                                                */
/* ------------------------------------------------------------------ */

export const LOGO_STRIP_VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'grid',
    label: 'Static strip',
    description: 'Logos in a centered row, grayscale with hover color-in.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><rect x="20" y="80" width="40" height="20" rx="3" fill="#94a3b8"/><rect x="80" y="80" width="40" height="20" rx="3" fill="#94a3b8"/><rect x="140" y="80" width="40" height="20" rx="3" fill="#94a3b8"/><rect x="200" y="80" width="40" height="20" rx="3" fill="#94a3b8"/><rect x="260" y="80" width="30" height="20" rx="3" fill="#94a3b8"/>`),
    tags: ['classic', 'minimal'],
  },
  {
    id: 'marquee',
    label: 'Scrolling marquee',
    description: 'Logos scroll horizontally in a continuous loop. Pauses on hover.',
    preview: svg(`<rect width="300" height="200" fill="#fff"/><rect x="10" y="80" width="40" height="20" rx="3" fill="#94a3b8" opacity=".3"/><rect x="60" y="80" width="40" height="20" rx="3" fill="#94a3b8" opacity=".6"/><rect x="120" y="80" width="40" height="20" rx="3" fill="#94a3b8"/><rect x="180" y="80" width="40" height="20" rx="3" fill="#94a3b8" opacity=".6"/><rect x="240" y="80" width="40" height="20" rx="3" fill="#94a3b8" opacity=".3"/><path d="M20 105 L10 105" stroke="#1D9CA1"/><path d="M280 105 L290 105" stroke="#1D9CA1"/>`),
    tags: ['modern', 'animated'],
    animated: true,
  },
];

/* ------------------------------------------------------------------ */
/* MASTER REGISTRY + HELPERS                                          */
/* ------------------------------------------------------------------ */

/**
 * Central lookup: for a block key, get all available variants.
 *
 * Blocks not in this map either have no variant choice (they render a
 * single layout) or haven't been variant-registered yet — the picker
 * falls back to "add with defaults" for those.
 */
export const VARIANT_REGISTRY: Partial<Record<SiteBlockKey, VariantOption[]>> = {
  hero: HERO_VARIANT_OPTIONS,
  team: TEAM_VARIANT_OPTIONS,
  reviews: REVIEWS_VARIANT_OPTIONS,
  services: SERVICES_VARIANT_OPTIONS,
  gallery: GALLERY_VARIANT_OPTIONS,
  faq: FAQ_VARIANT_OPTIONS,
  cta: CTA_VARIANT_OPTIONS,
  footer: FOOTER_VARIANT_OPTIONS,
  nav: NAV_VARIANT_OPTIONS,
  stats: STATS_VARIANT_OPTIONS,
  contact: CONTACT_VARIANT_OPTIONS,
  process: PROCESS_VARIANT_OPTIONS,
  logoStrip: LOGO_STRIP_VARIANT_OPTIONS,
};

/**
 * Get the available variants for a block. Safe against unknown keys —
 * returns an empty array so the picker can still render the block entry
 * with a default "add" action.
 */
export function getVariantsFor(block: SiteBlockKey): VariantOption[] {
  return VARIANT_REGISTRY[block] ?? [];
}

/**
 * Check if the block has any variants registered. Used by the picker to
 * decide whether to show a variant grid or a single "add" button.
 */
export function hasVariants(block: SiteBlockKey): boolean {
  return (VARIANT_REGISTRY[block]?.length ?? 0) > 0;
}

/**
 * Look up a specific variant by id within a block. Used when rendering
 * the "selected" state in the editor or showing the label next to the
 * block in the sections list.
 */
export function findVariant(
  block: SiteBlockKey,
  id: string | undefined,
): VariantOption | undefined {
  if (!id) return undefined;
  return VARIANT_REGISTRY[block]?.find((v) => v.id === id);
}

/**
 * All tag values used across the registry, for the picker's filter bar.
 */
export const ALL_VARIANT_TAGS = [
  'modern',
  'minimal',
  'local',
  'bold',
  'playful',
  'classic',
  'animated',
  'dark',
  'light',
  'photo-heavy',
  'text-first',
] as const;
export type VariantTag = (typeof ALL_VARIANT_TAGS)[number];

/**
 * Result of checking a variant's data requirements against the current
 * website config. `met: true` means the variant will render nicely with
 * the data the client currently has; `met: false` means picking it will
 * produce a half-rendered section (e.g. 1 team member in a layout that
 * needs 3+).
 *
 * The `missing` array is shaped so the picker can show a friendly
 * "needs 2 more reviews" hint rather than a generic warning.
 */
export interface VariantRequirementCheck {
  met: boolean;
  missing: Array<{
    field: string;
    minItems: number;
    current: number;
    hint: string;
  }>;
}

/**
 * Walk a dotted path into an arbitrary config object. Used to resolve
 * requirement field paths like `team.members` or `reviews`.
 */
function getByPath(target: unknown, path: string): unknown {
  if (!target || typeof target !== 'object') return undefined;
  const segments = path.split('.');
  let cursor: any = target;
  for (const s of segments) {
    if (cursor == null) return undefined;
    cursor = cursor[s];
  }
  return cursor;
}

/**
 * Evaluate a single variant's `requires` list against the current
 * config. Returns a structured result the picker can render directly.
 *
 * Semantics:
 * - A requirement with `minItems` is checked against array length (or
 *   the count of non-null entries if the target is sparse).
 * - A requirement without `minItems` is treated as met when the target
 *   path resolves to any non-null value.
 * - The special field names `images` and `gallery.imageIndices` are
 *   aliased to the same gallery image array for convenience, because
 *   registry entries use both depending on the section.
 */
export function checkVariantRequirements(
  variant: VariantOption,
  config: unknown,
): VariantRequirementCheck {
  const missing: VariantRequirementCheck['missing'] = [];
  const reqs = variant.requires ?? [];

  for (const r of reqs) {
    // Aliases so the registry's `field: 'images'` resolves correctly
    // regardless of which section is being configured. Any section with a
    // gallery image array should work here.
    const candidatePaths =
      r.field === 'images'
        ? ['gallery.imageIndices', 'portfolio.projects', 'images']
        : [r.field];

    let currentCount = 0;
    let found = false;
    for (const p of candidatePaths) {
      const value = getByPath(config, p);
      if (value === undefined || value === null) continue;
      found = true;
      if (Array.isArray(value)) {
        currentCount = Math.max(
          currentCount,
          value.filter((v) => v !== null && v !== undefined).length,
        );
      } else if (typeof value === 'string' && value.trim().length > 0) {
        currentCount = Math.max(currentCount, 1);
      } else if (typeof value === 'number') {
        currentCount = Math.max(currentCount, 1);
      }
    }

    if (r.minItems === undefined) {
      // Presence-only requirement.
      if (!found) {
        missing.push({
          field: r.field,
          minItems: 1,
          current: 0,
          hint: r.hint,
        });
      }
      continue;
    }

    if (currentCount < r.minItems) {
      missing.push({
        field: r.field,
        minItems: r.minItems,
        current: currentCount,
        hint: r.hint,
      });
    }
  }

  return { met: missing.length === 0, missing };
}
