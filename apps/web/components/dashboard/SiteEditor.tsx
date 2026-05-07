'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import type {
  WebsiteConfig,
  SiteBlockKey,
  HeroVariant,
  PageConfig,
  VariantOption,
  HeroIllustrationStyle,
  HeroIllustrationMotion,
  HeroIllustration,
  SectionBackgroundKind,
  SectionBackground,
} from '@boost/core';
import {
  DEFAULT_LAYOUT,
  HERO_VARIANTS,
  slugify,
  getVariantsFor,
  hasVariants,
  findVariant,
  checkVariantRequirements,
  ALL_VARIANT_TAGS,
  type VariantTag,
  ILLUSTRATION_STYLES,
  ILLUSTRATION_CATEGORIES,
  DEFAULT_ILLUSTRATION_BY_TEMPLATE,
  defaultMotionForStyle,
  AI_MODELS,
  defaultModelFor,
  type AiModelKey,
} from '@boost/core';
import {
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Spinner,
  toast,
  confirmDialog,
} from '@boost/ui';
import {
  GripVertical,
  Plus,
  Trash2,
  Palette,
  Send,
  Sparkles,
  RotateCcw,
  Image as ImageIcon,
  Wand2,
  Layers,
  Globe,
  Loader2,
  Check,
  Copy,
  AlertCircle,
  ExternalLink,
  Edit3,
  FileText,
  X,
  List,
  Upload,
  HelpCircle,
  Star,
  MessageSquare,
  Link2,
  Coffee,
  Users,
  Calendar,
  Code2,
  Download,
  BarChart3,
  Phone,
  Megaphone,
  MapPin,
  ShoppingBag,
  Briefcase,
  Workflow,
  Tags,
  PlaySquare,
  Mail,
  ShieldCheck,
  Building2,
  MousePointerClick,
  Eye,
  Menu as MenuIcon,
  Rows3,
  Settings2,
  AlertTriangle,
  Info,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  Search,
} from 'lucide-react';
import { api } from '@/lib/dashboard/api';
import { sanitizeConfig } from '@boost/ui/site';

const BLOCK_LABELS: Record<SiteBlockKey, string> = {
  nav: 'Navigation',
  hero: 'Hero',
  stats: 'Stats',
  services: 'Services',
  about: 'About',
  gallery: 'Gallery',
  reviews: 'Reviews',
  faq: 'FAQ',
  contact: 'Contact',
  footer: 'Footer',
  menu: 'Menu',
  priceList: 'Price list',
  team: 'Team',
  schedule: 'Schedule',
  serviceAreas: 'Service areas',
  beforeAfter: 'Before & after',
  trustBadges: 'Trust badges',
  cta: 'CTA banner',
  custom: 'Custom sections',
  products: 'Products',
  portfolio: 'Portfolio',
  process: 'How it works',
  pricingTiers: 'Pricing tiers',
  announcement: 'Announcement bar',
  logoStrip: 'Logo strip',
  video: 'Video',
  newsletter: 'Newsletter',
};

const ALL_BLOCKS: SiteBlockKey[] = [
  'nav', 'hero', 'announcement', 'stats', 'services', 'about', 'gallery',
  'reviews', 'faq', 'contact', 'footer', 'menu', 'priceList', 'team',
  'schedule', 'serviceAreas', 'beforeAfter', 'trustBadges', 'cta', 'custom',
  'products', 'portfolio', 'process', 'pricingTiers', 'logoStrip', 'video',
  'newsletter',
];

/* ------------------------------------------------------------------ */
/* Section metadata — icon, tone, what-it-does copy, content summary   */
/* ------------------------------------------------------------------ */

/**
 * Visual identity for each section type. Keeps the editor UI consistent:
 * the same icon/colour combo is used in the section list, the "Add
 * section" chips, and the variant picker — so the agency can skim a
 * long layout and instantly see "oh the blue pill is contact, the amber
 * one is reviews."
 *
 * `tone` maps to Tailwind-friendly classes (text/bg) so we can colour
 * the icon chip without inline styles or stretching the theme palette.
 * `purpose` is the one-line "why this exists" copy shown under the
 * section name — critical for agencies who don't live in the config
 * schema the way the generator does.
 */
interface BlockMeta {
  icon: React.ComponentType<{ className?: string }>;
  /** Short Tailwind tone key — drives the icon chip colour. */
  tone:
    | 'orange'
    | 'teal'
    | 'amber'
    | 'violet'
    | 'blue'
    | 'emerald'
    | 'rose'
    | 'slate'
    | 'fuchsia'
    | 'sky'
    | 'lime';
  /** Plain-English "what this section does" — shown under the block name. */
  purpose: string;
  /** Which #id to scroll to in the preview when the user clicks the Locate button. */
  anchorId?: string;
  /** Whether users can remove this block from the layout. */
  required?: boolean;
}

/**
 * Single source of truth for per-block visuals and copy. Add new blocks
 * here when they're introduced — the section editor reads everything
 * from this table so adding a block is one diff instead of five.
 */
const BLOCK_META: Record<SiteBlockKey, BlockMeta> = {
  nav: {
    icon: MenuIcon,
    tone: 'slate',
    purpose: 'Top navigation bar with links and the logo.',
    required: true,
  },
  hero: {
    icon: Sparkles,
    tone: 'orange',
    purpose: 'First thing visitors see: headline, subheading, call-to-action.',
    anchorId: 'hero',
  },
  announcement: {
    icon: Megaphone,
    tone: 'amber',
    purpose: 'Thin bar above the nav for time-sensitive news (holiday hours, sale).',
  },
  stats: {
    icon: BarChart3,
    tone: 'emerald',
    purpose: 'Big numbers that build trust (5+ years, 100+ happy customers).',
    anchorId: 'stats',
  },
  services: {
    icon: Sparkles,
    tone: 'teal',
    purpose: 'What the business sells, as tiles or cards.',
    anchorId: 'services',
  },
  about: {
    icon: Info,
    tone: 'slate',
    purpose: 'Who they are, what makes them different, often with a photo.',
    anchorId: 'about',
  },
  gallery: {
    icon: ImageIcon,
    tone: 'violet',
    purpose: 'Photo grid — portfolios, work examples, food, interiors.',
    anchorId: 'gallery',
  },
  reviews: {
    icon: Star,
    tone: 'amber',
    purpose: 'Customer testimonials. The strongest conversion driver.',
    anchorId: 'reviews',
  },
  faq: {
    icon: HelpCircle,
    tone: 'sky',
    purpose: 'Quick answers to questions that might stop a booking.',
    anchorId: 'faq',
  },
  contact: {
    icon: Phone,
    tone: 'blue',
    purpose: 'How to reach them — form, phone, email, map, hours.',
    anchorId: 'contact',
  },
  footer: {
    icon: Rows3,
    tone: 'slate',
    purpose: 'Bottom of every page — copyright, socials, secondary links.',
    anchorId: 'footer',
    required: true,
  },
  menu: {
    icon: Coffee,
    tone: 'rose',
    purpose: 'Food / drink menu with categories and prices.',
    anchorId: 'menu',
  },
  priceList: {
    icon: Tags,
    tone: 'teal',
    purpose: 'Per-service price list (cut €25, beard trim €15).',
    anchorId: 'prices',
  },
  team: {
    icon: Users,
    tone: 'violet',
    purpose: 'Staff profiles — names, roles, photos, specialties.',
    anchorId: 'team',
  },
  schedule: {
    icon: Calendar,
    tone: 'sky',
    purpose: 'Class / opening-hours grid for this week.',
    anchorId: 'schedule',
  },
  serviceAreas: {
    icon: MapPin,
    tone: 'emerald',
    purpose: 'Towns and regions this business covers. Great for local SEO.',
    anchorId: 'areas',
  },
  beforeAfter: {
    icon: ImageIcon,
    tone: 'fuchsia',
    purpose: 'Before/after image pairs — trades, cleaning, beauty.',
    anchorId: 'before-after',
  },
  trustBadges: {
    icon: ShieldCheck,
    tone: 'emerald',
    purpose: 'Licences, insurance, accreditations — "we\u2019re the real deal".',
    anchorId: 'trust',
  },
  cta: {
    icon: MousePointerClick,
    tone: 'teal',
    purpose: 'A focused "book now" strip — usually mid-page or before the footer.',
    anchorId: 'cta',
  },
  custom: {
    icon: Settings2,
    tone: 'slate',
    purpose: 'Freeform sections — image strip, quote, split layout, icon row.',
    anchorId: 'custom',
  },
  products: {
    icon: ShoppingBag,
    tone: 'rose',
    purpose: 'Retail grid with photos, prices, and buy / order links.',
    anchorId: 'products',
  },
  portfolio: {
    icon: Briefcase,
    tone: 'violet',
    purpose: 'Case studies — project photos, tags, write-up per job.',
    anchorId: 'portfolio',
  },
  process: {
    icon: Workflow,
    tone: 'sky',
    purpose: '"How it works" steps — sets expectations and reduces friction.',
    anchorId: 'process',
  },
  pricingTiers: {
    icon: Tags,
    tone: 'lime',
    purpose: 'Bronze / Silver / Gold package cards for service businesses.',
    anchorId: 'pricing',
  },
  logoStrip: {
    icon: Building2,
    tone: 'slate',
    purpose: 'As-seen-in / partner logos — subtle social proof.',
    anchorId: 'logo-strip',
  },
  video: {
    icon: PlaySquare,
    tone: 'rose',
    purpose: 'Embedded YouTube, Vimeo, or MP4 with a clean 16:9 frame.',
    anchorId: 'video',
  },
  newsletter: {
    icon: Mail,
    tone: 'blue',
    purpose: 'Email capture — waitlist, newsletter, launch notifications.',
    anchorId: 'newsletter',
  },
};

const TONE_CLASSES: Record<BlockMeta['tone'], { bg: string; text: string; ring: string; soft: string; bar: string }> = {
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-200', soft: 'bg-orange-50', bar: 'bg-orange-400' },
  teal: { bg: 'bg-[#1D9CA1]/10', text: 'text-[#1D9CA1]', ring: 'ring-[#1D9CA1]/30', soft: 'bg-[#1D9CA1]/5', bar: 'bg-[#1D9CA1]' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-200', soft: 'bg-amber-50', bar: 'bg-amber-400' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200', soft: 'bg-violet-50', bar: 'bg-violet-400' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-200', soft: 'bg-blue-50', bar: 'bg-blue-400' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200', soft: 'bg-emerald-50', bar: 'bg-emerald-400' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-200', soft: 'bg-rose-50', bar: 'bg-rose-400' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200', soft: 'bg-slate-50', bar: 'bg-slate-400' },
  fuchsia: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', ring: 'ring-fuchsia-200', soft: 'bg-fuchsia-50', bar: 'bg-fuchsia-400' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-700', ring: 'ring-sky-200', soft: 'bg-sky-50', bar: 'bg-sky-400' },
  lime: { bg: 'bg-lime-100', text: 'text-lime-700', ring: 'ring-lime-200', soft: 'bg-lime-50', bar: 'bg-lime-400' },
};

/**
 * Ordered groups of blocks for the Add-Section gallery. Organised by
 * local-business job-to-be-done so agencies building for a barber or a
 * mechanic can find the "right" section faster than scanning an
 * alphabetical list of 26 options.
 */
interface SectionGroup {
  id: string;
  label: string;
  tagline: string;
  blocks: SiteBlockKey[];
}

const SECTION_GROUPS: SectionGroup[] = [
  {
    id: 'essentials',
    label: 'Essentials',
    tagline: 'Every small-business site needs these.',
    blocks: ['hero', 'services', 'about', 'contact'],
  },
  {
    id: 'proof',
    label: 'Social proof',
    tagline: 'Why people should trust them.',
    blocks: ['reviews', 'stats', 'trustBadges', 'logoStrip', 'beforeAfter'],
  },
  {
    id: 'local',
    label: 'Local info',
    tagline: 'Signals that tell Google (and customers) "we\u2019re in your area".',
    blocks: ['serviceAreas', 'schedule', 'team'],
  },
  {
    id: 'commerce',
    label: 'Commerce & pricing',
    tagline: 'Show what things cost, what\u2019s on the menu, what you sell.',
    blocks: ['menu', 'priceList', 'pricingTiers', 'products'],
  },
  {
    id: 'story',
    label: 'Storytelling',
    tagline: 'Show off the work and answer questions.',
    blocks: ['gallery', 'portfolio', 'video', 'process', 'faq'],
  },
  {
    id: 'conversion',
    label: 'Conversion',
    tagline: 'Nudges that drive bookings and leads.',
    blocks: ['cta', 'newsletter', 'announcement'],
  },
  {
    id: 'custom',
    label: 'Custom',
    tagline: 'Freeform sections when nothing else fits.',
    blocks: ['custom'],
  },
];

/**
 * A short, human-readable summary of how much content this block has —
 * e.g. "4 services", "needs content", "3 members, 2 with photos".
 *
 * Returned `tone`:
 *   'ok'     — the block has enough content to render nicely
 *   'warn'   — the block is in the layout but will render empty / skimpy
 *   'info'   — purely informational (counts without a judgement)
 */
function blockContentSummary(
  config: WebsiteConfig,
  block: SiteBlockKey,
  images: string[],
): { text: string; tone: 'ok' | 'warn' | 'info' } {
  const empty = { text: 'Needs content', tone: 'warn' as const };
  switch (block) {
    case 'nav':
      return { text: `${(config.pages?.length ?? 1)} page${(config.pages?.length ?? 1) === 1 ? '' : 's'}`, tone: 'info' };
    case 'hero': {
      const hasHeadline = !!config.hero?.headline?.trim();
      const hasImg =
        config.hero?.imageIndex != null || !!config.hero?.aiImageUrl;
      if (!hasHeadline) return empty;
      return {
        text: hasImg ? 'Headline + image ready' : 'Headline set · no image',
        tone: hasImg ? 'ok' : 'info',
      };
    }
    case 'announcement':
      return config.announcement?.message
        ? { text: config.announcement.message.slice(0, 40), tone: 'ok' }
        : empty;
    case 'stats':
      return (config.stats?.length ?? 0) > 0
        ? { text: `${config.stats!.length} metric${config.stats!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'services': {
      const n = config.services?.length ?? 0;
      if (n === 0) return empty;
      return { text: `${n} service${n === 1 ? '' : 's'}`, tone: 'ok' };
    }
    case 'about':
      return config.about?.body?.trim()
        ? { text: 'Copy set', tone: 'ok' }
        : empty;
    case 'gallery':
      return images.length > 0
        ? { text: `${images.length} photo${images.length === 1 ? '' : 's'} available`, tone: 'ok' }
        : { text: 'No photos uploaded yet', tone: 'warn' };
    case 'reviews': {
      const n = config.reviews?.length ?? 0;
      if (n === 0) return empty;
      return { text: `${n} review${n === 1 ? '' : 's'}`, tone: 'ok' };
    }
    case 'faq': {
      const n = config.faq?.length ?? 0;
      if (n === 0) return empty;
      return { text: `${n} question${n === 1 ? '' : 's'}`, tone: 'ok' };
    }
    case 'contact': {
      const has =
        config.contact?.phone || config.contact?.email || config.contact?.address;
      return has
        ? { text: 'Contact details set', tone: 'ok' }
        : { text: 'Add phone / email / address', tone: 'warn' };
    }
    case 'footer':
      return { text: 'Auto-filled from brand', tone: 'info' };
    case 'menu': {
      const cats = config.menu?.categories?.length ?? 0;
      const items =
        config.menu?.categories?.reduce(
          (n, c) => n + (c.items?.length ?? 0),
          0,
        ) ?? 0;
      if (cats === 0) return empty;
      return { text: `${cats} section${cats === 1 ? '' : 's'} · ${items} item${items === 1 ? '' : 's'}`, tone: 'ok' };
    }
    case 'priceList': {
      const n =
        (config.priceList?.items?.length ?? 0) +
        (config.priceList?.groups?.reduce(
          (x, g) => x + (g.items?.length ?? 0),
          0,
        ) ?? 0);
      return n > 0 ? { text: `${n} priced item${n === 1 ? '' : 's'}`, tone: 'ok' } : empty;
    }
    case 'team': {
      const n = config.team?.members?.length ?? 0;
      if (n === 0) return empty;
      const withPhoto = (config.team?.members ?? []).filter(
        (m) => m.photoUrl || m.photoIndex != null,
      ).length;
      return {
        text: `${n} member${n === 1 ? '' : 's'} · ${withPhoto} with photo`,
        tone: 'ok',
      };
    }
    case 'schedule':
      return (config.schedule?.entries?.length ?? 0) > 0
        ? { text: `${config.schedule!.entries!.length} entries`, tone: 'ok' }
        : empty;
    case 'serviceAreas':
      return (config.serviceAreas?.areas?.length ?? 0) > 0
        ? { text: `${config.serviceAreas!.areas!.length} area${config.serviceAreas!.areas!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'beforeAfter':
      return (config.beforeAfter?.pairs?.length ?? 0) > 0
        ? { text: `${config.beforeAfter!.pairs!.length} pair${config.beforeAfter!.pairs!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'trustBadges':
      return (config.trustBadges?.badges?.length ?? 0) > 0
        ? { text: `${config.trustBadges!.badges!.length} badge${config.trustBadges!.badges!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'cta':
      return config.cta?.heading
        ? { text: config.cta.heading.slice(0, 45), tone: 'ok' }
        : empty;
    case 'custom':
      return (config.customSections?.length ?? 0) > 0
        ? { text: `${config.customSections!.length} custom section${config.customSections!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'products':
      return (config.products?.items?.length ?? 0) > 0
        ? { text: `${config.products!.items!.length} product${config.products!.items!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'portfolio':
      return (config.portfolio?.projects?.length ?? 0) > 0
        ? { text: `${config.portfolio!.projects!.length} project${config.portfolio!.projects!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'process':
      return (config.process?.steps?.length ?? 0) > 0
        ? { text: `${config.process!.steps!.length} step${config.process!.steps!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'pricingTiers':
      return (config.pricingTiers?.tiers?.length ?? 0) > 0
        ? { text: `${config.pricingTiers!.tiers!.length} tier${config.pricingTiers!.tiers!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'logoStrip':
      return (config.logoStrip?.logos?.length ?? 0) > 0
        ? { text: `${config.logoStrip!.logos!.length} logo${config.logoStrip!.logos!.length === 1 ? '' : 's'}`, tone: 'ok' }
        : empty;
    case 'video':
      return config.video?.url
        ? { text: 'Video URL set', tone: 'ok' }
        : empty;
    case 'newsletter':
      return config.newsletter?.heading
        ? { text: 'Copy set', tone: 'ok' }
        : empty;
    default:
      return { text: '', tone: 'info' };
  }
}

/**
 * Scrolls the dashboard preview pane to the given block id. The preview
 * lives in a scrollable container (PreviewFrame's max-h-[85vh] wrapper);
 * to find "the scroll parent" we walk up from the located element until
 * we hit one with `overflow-y` set. Falls back to the element's own
 * scrollIntoView if no custom scroller is found.
 *
 * Flashes a brief ring on the section so the user can see where the
 * section they clicked lives in the preview — particularly useful for
 * long sites where the target lands off-screen after scrolling.
 */
function scrollPreviewToSection(block: SiteBlockKey) {
  const anchor = BLOCK_META[block]?.anchorId;
  if (!anchor) return;
  // Pick the in-dashboard preview instance only. The published site in
  // mobile/tablet iframe mode has the same ids but is cross-origin, so
  // we limit to the desktop-mode preview where the markup is rendered
  // directly in the host DOM.
  const root = document.querySelector<HTMLElement>('[data-preview-root="1"]');
  if (!root) {
    // Agencies sometimes click Eye while in tablet/mobile preview where
    // the site lives inside an iframe we can't scroll from here. Tell
    // them to switch rather than silently failing.
    toast.info(
      'Switch to desktop to locate',
      'Section-jump only works in desktop preview. Mobile / tablet modes show the live site in an iframe.',
    );
    return;
  }
  const target = root.querySelector<HTMLElement>(`#${CSS.escape(anchor)}`);
  if (!target) {
    toast.info(
      `${BLOCK_LABELS[block]} is not rendering yet`,
      'Add some content to this section — it only appears on the page once it has items.',
    );
    return;
  }

  // Find the nearest ancestor with vertical scrolling. `overflow-y: auto`
  // on the PreviewFrame wrapper is what actually scrolls; the target's
  // `scrollIntoView` uses the closest scroll parent by default.
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Flash highlight so the user sees where they landed.
  target.style.outline = '3px solid rgba(29,156,161,0.6)';
  target.style.outlineOffset = '4px';
  target.style.transition = 'outline-color 600ms ease';
  window.setTimeout(() => {
    target.style.outline = '';
    target.style.outlineOffset = '';
    target.style.transition = '';
  }, 1400);
}

/**
 * When the user adds a data-driven block from the Sections tab, seed it
 * with placeholder content so the block actually renders (instead of
 * silently returning `null` because the data arrays are empty).
 *
 * Returns a partial WebsiteConfig to be merged into the existing one.
 * Skips fields that already have data so adding a section back after it
 * was removed preserves the user's earlier content.
 */
function seedBlockData(
  config: WebsiteConfig,
  block: SiteBlockKey,
): Partial<WebsiteConfig> {
  switch (block) {
    case 'team':
      if (config.team && config.team.members && config.team.members.length > 0) return {};
      return {
        team: {
          eyebrow: config.team?.eyebrow ?? 'The team',
          heading: config.team?.heading ?? 'Meet the people.',
          members: [
            { name: 'Member name', role: 'Role', specialties: [] },
            { name: 'Member name', role: 'Role', specialties: [] },
            { name: 'Member name', role: 'Role', specialties: [] },
          ],
        },
      };
    case 'menu':
      if (config.menu && (config.menu.categories?.length ?? 0) > 0) return {};
      return {
        menu: {
          eyebrow: 'The menu',
          heading: 'Small menu, done well.',
          currency: '€',
          categories: [
            {
              title: 'Section name',
              items: [
                { name: 'Item', price: '0', description: 'Short description' },
              ],
            },
          ],
        },
      };
    case 'priceList':
      if (config.priceList && ((config.priceList.items?.length ?? 0) + (config.priceList.groups?.length ?? 0)) > 0) return {};
      return {
        priceList: {
          eyebrow: 'Pricing',
          heading: 'Simple, honest pricing.',
          currency: '€',
          items: [
            { name: 'Service', price: '25', duration: '30 min' },
            { name: 'Service', price: '45', duration: '45 min' },
          ],
        },
      };
    case 'schedule':
      if (config.schedule && (config.schedule.entries?.length ?? 0) > 0) return {};
      return {
        schedule: {
          eyebrow: 'Schedule',
          heading: 'This week.',
          entries: [
            { day: 'Mo', time: '09:00', title: 'Open' },
            { day: 'Tu', time: '09:00', title: 'Open' },
            { day: 'We', time: '09:00', title: 'Open' },
            { day: 'Th', time: '09:00', title: 'Open' },
            { day: 'Fr', time: '09:00', title: 'Open' },
          ],
        },
      };
    case 'serviceAreas':
      if (config.serviceAreas && (config.serviceAreas.areas?.length ?? 0) > 0) return {};
      return {
        serviceAreas: {
          eyebrow: 'Where we work',
          heading: 'Serving these areas.',
          areas: ['Area 1', 'Area 2', 'Area 3'],
        },
      };
    case 'beforeAfter':
      if (config.beforeAfter && (config.beforeAfter.pairs?.length ?? 0) > 0) return {};
      return {
        beforeAfter: {
          eyebrow: 'Our work',
          heading: 'Before and after.',
          pairs: [{}, {}],
        },
      };
    case 'trustBadges':
      if (config.trustBadges && (config.trustBadges.badges?.length ?? 0) > 0) return {};
      return {
        trustBadges: {
          eyebrow: 'Credentials',
          heading: 'Qualified and insured.',
          badges: [
            { label: 'Fully insured', icon: 'Shield' },
            { label: 'Accredited', icon: 'Award' },
          ],
        },
      };
    case 'cta':
      if (config.cta?.heading) return {};
      return {
        cta: {
          heading: 'Ready to get started?',
          body: 'Tap below and we\u2019ll be in touch within a day.',
          buttonLabel: 'Get in touch',
          buttonHref: '#contact',
        },
      };
    case 'products':
      if (config.products && (config.products.items?.length ?? 0) > 0) return {};
      return {
        products: {
          eyebrow: 'Shop',
          heading: 'The shop.',
          currency: '€',
          items: [
            { name: 'Product name', price: '0', description: 'Short description' },
            { name: 'Product name', price: '0', description: 'Short description' },
            { name: 'Product name', price: '0', description: 'Short description' },
          ],
        },
      };
    case 'portfolio':
      if (config.portfolio && (config.portfolio.projects?.length ?? 0) > 0) return {};
      return {
        portfolio: {
          eyebrow: 'Examples',
          heading: 'Recent work.',
          projects: [
            { title: 'Project name', summary: 'One-line teaser', imageIndices: [] },
            { title: 'Project name', summary: 'One-line teaser', imageIndices: [] },
          ],
        },
      };
    case 'process':
      if (config.process && (config.process.steps?.length ?? 0) > 0) return {};
      return {
        process: {
          eyebrow: 'How it works',
          heading: 'Simple, every time.',
          steps: [
            { title: 'Step one', description: 'What happens first.' },
            { title: 'Step two', description: 'What happens next.' },
            { title: 'Step three', description: 'How it wraps up.' },
          ],
        },
      };
    case 'pricingTiers':
      if (config.pricingTiers && (config.pricingTiers.tiers?.length ?? 0) > 0) return {};
      return {
        pricingTiers: {
          eyebrow: 'Pricing',
          heading: 'Plans that fit.',
          currency: '€',
          tiers: [
            { name: 'Starter', price: '29', period: '/month', features: ['Feature', 'Feature', 'Feature'], ctaLabel: 'Choose', ctaHref: '#contact' },
            { name: 'Pro', price: '79', period: '/month', features: ['Everything in Starter', 'Feature', 'Feature'], ctaLabel: 'Choose', ctaHref: '#contact', highlighted: true },
            { name: 'Premium', price: '149', period: '/month', features: ['Everything in Pro', 'Feature', 'Feature'], ctaLabel: 'Choose', ctaHref: '#contact' },
          ],
        },
      };
    case 'announcement':
      if (config.announcement?.message) return {};
      return {
        announcement: {
          message: 'Announcement text — click to edit.',
          tone: 'brand',
        },
      };
    case 'logoStrip':
      if (config.logoStrip && (config.logoStrip.logos?.length ?? 0) > 0) return {};
      return {
        logoStrip: {
          eyebrow: 'Featured in',
          logos: [
            { name: 'Publication' },
            { name: 'Publication' },
            { name: 'Publication' },
          ],
        },
      };
    case 'video':
      if (config.video?.url) return {};
      return {
        video: {
          eyebrow: 'Watch',
          heading: 'See it in action.',
          url: '',
        },
      };
    case 'newsletter':
      if (config.newsletter?.heading) return {};
      return {
        newsletter: {
          heading: 'Stay in the loop.',
          body: 'Occasional updates. No spam.',
          placeholder: 'Your email',
          buttonLabel: 'Subscribe',
        },
      };
    case 'stats':
      if (config.stats && config.stats.length > 0) return {};
      return {
        stats: [
          { value: 100, suffix: '+', label: 'Happy customers' },
          { value: 5, suffix: '', label: 'Years serving' },
          { value: 4.9, suffix: '\u2605', label: 'Rating' },
        ],
      };
    case 'services':
      if (config.services && config.services.length > 0) return {};
      return {
        services: [
          { title: 'Service', description: 'What this service does.', icon: 'Sparkles' },
          { title: 'Service', description: 'What this service does.', icon: 'Star' },
          { title: 'Service', description: 'What this service does.', icon: 'Wrench' },
        ],
      };
    case 'about':
      if (config.about?.heading) return {};
      return {
        about: {
          eyebrow: 'About us',
          heading: 'Who we are.',
          body: 'Write a short about paragraph here.\n\nAdd a second paragraph for a bit more depth.',
          bullets: ['Proof point', 'Proof point', 'Proof point'],
        },
      };
    case 'faq':
      if (config.faq && config.faq.length > 0) return {};
      return {
        faq: [
          { question: 'First question?', answer: 'Short, honest answer.' },
          { question: 'Second question?', answer: 'Short, honest answer.' },
          { question: 'Third question?', answer: 'Short, honest answer.' },
        ],
      };
    case 'reviews':
      if (config.reviews && config.reviews.length > 0) return {};
      return {
        reviews: [
          { text: 'What a great experience.', author: 'Customer name', rating: 5 },
          { text: 'Highly recommend.', author: 'Customer name', rating: 5 },
          { text: 'Excellent work.', author: 'Customer name', rating: 5 },
        ],
      };
    case 'custom':
      if (config.customSections && config.customSections.length > 0) return {};
      return {
        customSections: [
          {
            variant: 'image-strip',
            heading: 'New section',
            body: 'Short description of this section.',
            items: [{}, {}, {}],
          },
        ],
      };
    default:
      return {};
  }
}

/** Short toast hint when seeding placeholders. */
function seededMessage(
  block: SiteBlockKey,
  seeded: Partial<WebsiteConfig>,
): string | null {
  if (Object.keys(seeded).length === 0) return null;
  if (block === 'video') return 'Add a video URL in the Items tab.';
  if (block === 'beforeAfter') return 'Add image indexes in the Items tab.';
  return 'Placeholder content added — edit it inline in the preview.';
}

const HERO_VARIANT_META: Record<HeroVariant, { label: string; description: string }> = {
  spotlight: {
    label: 'Spotlight',
    description: 'Centered copy, mouse-following glow. Premium & minimal.',
  },
  beams: {
    label: 'Beams',
    description: 'Animated light beams in brand colors. Energetic.',
  },
  'floating-icons': {
    label: 'Floating icons',
    description: 'Parallax industry icons or emojis behind copy. Playful.',
  },
  'parallax-layers': {
    label: 'Parallax layers',
    description: 'Split layout with image parallax. Classic, photo-first.',
  },
  'gradient-mesh': {
    label: 'Gradient mesh',
    description: 'Slow-shifting animated gradient. No image required.',
  },
  aurora: {
    label: 'Aurora',
    description: 'Aceternity aurora lights sweep behind the headline.',
  },
  wavy: {
    label: 'Wavy',
    description: 'Flowing simplex-noise waves in brand colors. Smooth.',
  },
  sparkles: {
    label: 'Sparkles',
    description: 'Drifting particle field on deep black. Gala / event feel.',
  },
  'hero-highlight': {
    label: 'Highlight',
    description: 'Dot-grid background with a highlighted phrase. Minimal.',
  },
  dither: {
    label: 'Dither',
    description: 'Retro stippled pattern on dark. Tech-adjacent, modern.',
  },
  multicolor: {
    label: 'Multicolor',
    description: 'Soft color orbs in brand palette. Bold, playful.',
  },
  'full-bg-image': {
    label: 'Full-bleed photo',
    description: 'Large client photo with overlay text. Immersive.',
  },
  'two-column-image': {
    label: 'Two-column',
    description: 'Copy + CTAs left, photo right. Classic local biz.',
  },
  meteors: {
    label: 'Meteors',
    description: 'Falling meteor trails on dark. Event / launch feel.',
  },
  vortex: {
    label: 'Vortex',
    description: 'Swirling particles behind centered copy. Premium.',
  },
  lamp: {
    label: 'Lamp',
    description: 'Dramatic overhead spotlight. Luxury, cinematic.',
  },
  'shooting-stars': {
    label: 'Shooting stars',
    description: 'Streaks of light across a dark sky. Dreamy, premium.',
  },
  boxes: {
    label: 'Boxes',
    description: 'Animated grid of color-shifting boxes. Bold, tech-forward.',
  },
  ripple: {
    label: 'Ripple',
    description: 'Radial ripple effect behind centered copy. Calm, modern.',
  },
};

interface SiteEditorProps {
  config: WebsiteConfig;
  onChange: (config: WebsiteConfig) => void;
  clientId: string;
  images: string[];
  /**
   * Full DB rows for each image (when available). Used by the Images
   * tab to show AI labels + allow the agency to edit them. When omitted
   * (e.g. in tests / older callers), label editing is hidden.
   */
  imageRows?: Array<{
    id: string;
    fileUrl: string;
    aiDescription?: string | null;
    qualityScore?: number | null;
    status?: string | null;
    tags?: string[] | null;
  }>;
  /**
   * Called when the agency edits an image's label. The host persists
   * to the database and refetches.
   */
  onImageLabelChange?: (id: string, aiDescription: string) => Promise<void> | void;
  /**
   * Whether the live preview is in edit mode. Hoisting state here lets
   * the editor toggle it from the Content tab.
   */
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
  /**
   * Slug of the page the preview is currently showing. The Sections tab
   * scopes edits to this page in multipage sites so drag-reorder and
   * add-section affect only the active page's layout.
   */
  activePageSlug: string;
  onActivePageSlugChange: (slug: string) => void;
}

/**
 * Visual website editor. Tabs:
 *   Content    — inline edit toggle + content hints.
 *   Pages      — (multipage only) add/remove/rename pages.
 *   Sections   — per-page drag-reorder, add/remove.
 *   Hero       — pick variant, regenerate AI image.
 *   Brand      — colors, tagline, tone.
 *   AI Edit    — natural-language config edits.
 *   Domain     — custom domain setup with DNS instructions.
 */
export function SiteEditor({
  config,
  onChange,
  clientId,
  images,
  imageRows,
  onImageLabelChange,
  editMode,
  onEditModeChange,
  activePageSlug,
  onActivePageSlugChange,
}: SiteEditorProps) {
  const [tab, setTab] = useState<
    'sections' | 'content' | 'pages' | 'items' | 'images' | 'hero' | 'brand' | 'ai' | 'domain' | 'code'
  >('content');

  const tabs = [
    { id: 'content' as const, label: 'Content', icon: Edit3 },
    { id: 'items' as const, label: 'Items', icon: List },
    { id: 'images' as const, label: 'Images', icon: ImageIcon },
    // Pages tab is always available — single-page sites can convert to
    // multipage from the tab by adding a new page.
    { id: 'pages' as const, label: 'Pages', icon: FileText },
    { id: 'sections' as const, label: 'Sections', icon: Layers },
    { id: 'hero' as const, label: 'Hero', icon: Sparkles },
    { id: 'brand' as const, label: 'Brand', icon: Palette },
    { id: 'ai' as const, label: 'AI Edit', icon: Wand2 },
    { id: 'domain' as const, label: 'Domain', icon: Globe },
    { id: 'code' as const, label: 'Code', icon: Code2 },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        {/* Tab bar */}
        <div className="flex flex-wrap border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex min-w-[60px] flex-1 items-center justify-center gap-1.5 px-2 py-3 text-[11px] font-semibold transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-[#1D9CA1] text-[#1D9CA1]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'content' && (
            <ContentEditor
              editMode={editMode}
              onEditModeChange={onEditModeChange}
              images={images}
            />
          )}
          {tab === 'items' && (
            <ItemsEditor config={config} onChange={onChange} />
          )}
          {tab === 'images' && (
            <ImagesEditor
              config={config}
              onChange={onChange}
              clientId={clientId}
              images={images}
              imageRows={imageRows}
              onImageLabelChange={onImageLabelChange}
            />
          )}
          {tab === 'pages' && (
            <PagesManager
              config={config}
              onChange={onChange}
              clientId={clientId}
              activePageSlug={activePageSlug}
              onActivePageSlugChange={onActivePageSlugChange}
            />
          )}
          {tab === 'sections' && (
            <SectionManager
              config={config}
              onChange={onChange}
              activePageSlug={activePageSlug}
              images={images}
            />
          )}
          {tab === 'hero' && (
            <HeroEditor
              config={config}
              onChange={onChange}
              clientId={clientId}
              images={images}
            />
          )}
          {tab === 'brand' && <BrandEditor config={config} onChange={onChange} />}
          {tab === 'ai' && (
            <AIChatEditor config={config} onChange={onChange} clientId={clientId} />
          )}
          {tab === 'domain' && <DomainEditor clientId={clientId} />}
          {tab === 'code' && <CodeEditor config={config} onChange={onChange} />}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Content tab — toggle inline editing, show field counts.            */
/* ------------------------------------------------------------------ */

function ContentEditor({
  editMode,
  onEditModeChange,
  images,
}: {
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
  images: string[];
}) {
  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-4 transition-colors ${
          editMode
            ? 'border-[#1D9CA1] bg-[#1D9CA1]/5'
            : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              editMode ? 'bg-[#1D9CA1] text-white' : 'bg-white text-slate-400'
            }`}
          >
            <Edit3 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Inline editing {editMode ? 'on' : 'off'}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {editMode
                ? 'Click any headline, description, or service card in the preview to edit it. Changes save on blur.'
                : 'Turn this on to click-edit copy directly in the preview. Section order and colors stay in their own tabs.'}
            </p>
            <button
              onClick={() => onEditModeChange(!editMode)}
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                editMode
                  ? 'bg-[#1D9CA1] text-white hover:bg-[#158087]'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {editMode ? 'Turn off inline editing' : 'Turn on inline editing'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">Library</p>
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              {images.length} client {images.length === 1 ? 'image' : 'images'}
            </p>
            <p className="text-[11px] text-slate-500">
              Used by gallery + about + hero (when suitable).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section Manager — drag to reorder, add/remove                      */
/* ------------------------------------------------------------------ */

function SectionManager({
  config,
  onChange,
  activePageSlug,
  images,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  activePageSlug: string;
  images: string[];
}) {
  // In a multipage site, `Sections` edits the active page's layout. In a
  // single-page site, it edits the root `layout`. We keep both code paths
  // but give the user a clear banner telling them which page they're
  // editing so they understand why reordering "Services" only changes one
  // page at a time.
  const pages = config.pages ?? [];
  const activePage = pages.find((p) => p.slug === activePageSlug);
  // "Multipage" from the renderer's POV means `pages.length > 0` — even
  // a single entry there wins over `config.layout` via `resolvePage`. We
  // mirror that here so edits go to the same field the renderer reads.
  const hasPages = pages.length > 0;
  const isMultipage = pages.length > 1;

  const layout: SiteBlockKey[] = hasPages
    ? activePage?.layout ?? pages[0]?.layout ?? DEFAULT_LAYOUT[config.template ?? 'service']
    : config.layout ?? DEFAULT_LAYOUT[config.template ?? 'service'];
  const available = ALL_BLOCKS.filter((b) => !layout.includes(b));

  const setLayout = (newLayout: SiteBlockKey[]) => {
    // Enforce structural invariants before committing to state:
    //   - `nav` lives at index 0 (the first thing on the page)
    //   - `footer` lives at the last index (the last thing on the page)
    //
    // Without these guards the Reorder drag would let a user put
    // "Navigation" halfway down the page, which the site renderer would
    // happily obey but every visitor would call weird.
    let normalised = newLayout.slice();
    if (normalised.includes('nav')) {
      normalised = ['nav', ...normalised.filter((b) => b !== 'nav')];
    }
    if (normalised.includes('footer')) {
      normalised = [...normalised.filter((b) => b !== 'footer'), 'footer'];
    }

    // Write to the same field `resolvePage` reads. If there's any page
    // in config.pages (even just the implicit "home"), the renderer
    // sources layout from that page — so we update there too.
    if (hasPages) {
      const activeSlug = activePage?.slug ?? pages[0]?.slug ?? 'home';
      onChange({
        ...config,
        pages: pages.map((p) =>
          p.slug === activeSlug ? { ...p, layout: normalised } : p,
        ),
      });
    } else {
      onChange({ ...config, layout: normalised });
    }
  };

  const removeBlock = async (block: SiteBlockKey) => {
    if (block === 'nav' || block === 'footer') {
      toast.info('Navigation and footer are required');
      return;
    }
    const confirmed = await confirmDialog({
      title: `Remove ${BLOCK_LABELS[block]}?`,
      description:
        'The section disappears from the site. Content (text, items, photos) stays saved — you can add the section back later.',
      confirmLabel: 'Remove section',
      danger: true,
    });
    if (!confirmed) return;
    setLayout(layout.filter((b) => b !== block));
  };

  const addBlock = (block: SiteBlockKey, variant?: string) => {
    const footerIdx = layout.indexOf('footer');
    const newLayout = [...layout];
    if (footerIdx >= 0) {
      newLayout.splice(footerIdx, 0, block);
    } else {
      newLayout.push(block);
    }

    // Seed placeholder data for data-driven blocks so they actually show up
    // when added. Without this, adding e.g. "team" to the layout just puts
    // the key in the array — the SiteTeam block returns `null` because
    // `config.team.members` is empty, and the user thinks the add did nothing.
    //
    // We only seed when the block's data is currently missing, so adding
    // a block to a page that already has data (e.g. via a previous AI
    // edit) doesn't stomp the real content.
    const seeded = seedBlockData(config, block);

    // If the user picked a specific variant from the picker, stamp it into
    // the block's config. Falls back to the block's current variant (or the
    // block default) when no variant was supplied.
    const variantPatch: Partial<WebsiteConfig> = {};
    if (variant) {
      if (block === 'hero') {
        variantPatch.hero = { ...(seeded.hero ?? config.hero ?? {}), variant: variant as HeroVariant };
      } else {
        const key = block as keyof WebsiteConfig;
        const existingOrSeeded =
          (seeded as Partial<WebsiteConfig>)[key] ??
          (config[key] as Record<string, unknown> | undefined) ??
          {};
        // We cast broadly here because `variant` is a generic field across
        // many block types — the specific type narrowing happens in each
        // block's renderer.
        (variantPatch as Record<string, unknown>)[key] = {
          ...(existingOrSeeded as Record<string, unknown>),
          variant,
        };
      }
    }

    if (hasPages) {
      const activeSlug = activePage?.slug ?? pages[0]?.slug ?? 'home';
      onChange({
        ...config,
        ...seeded,
        ...variantPatch,
        pages: pages.map((p) =>
          p.slug === activeSlug ? { ...p, layout: newLayout } : p,
        ),
      });
    } else {
      onChange({ ...config, ...seeded, ...variantPatch, layout: newLayout });
    }

    const variantLabel = variant
      ? findVariant(block, variant)?.label
      : undefined;
    toast.success(
      variantLabel
        ? `${BLOCK_LABELS[block]} · ${variantLabel} added`
        : `${BLOCK_LABELS[block]} added`,
      seededMessage(block, seeded) ?? 'Reorder from the list above.',
    );

    // Give the preview a moment to render the new block, then jump to it
    // so the user sees what was added without hunting for it.
    window.setTimeout(() => scrollPreviewToSection(block), 350);
  };

  /** Move a block one slot up/down in the layout. Keyboard/tap alternative
   * to drag-reorder for agencies on touch devices or for small nudges. */
  const moveBlock = (block: SiteBlockKey, direction: -1 | 1) => {
    const idx = layout.indexOf(block);
    if (idx < 0) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= layout.length) return;
    const neighbour = layout[nextIdx]!;
    // nav must stay first, footer must stay last. If swap would violate
    // either we bail silently — the button is disabled in the UI anyway.
    if (block === 'nav' || neighbour === 'nav') return;
    if (block === 'footer' || neighbour === 'footer') return;
    const next = [...layout];
    next[idx] = neighbour;
    next[nextIdx] = block;
    setLayout(next);
  };

  const resetLayout = async () => {
    if (
      !(await confirmDialog({
        title: 'Reset sections?',
        description:
          'This puts sections back in the template\u2019s default order and drops any you\u2019ve added. Your content (copy, items, photos) stays saved.',
        confirmLabel: 'Reset layout',
        danger: true,
      }))
    ) {
      return;
    }
    setLayout(DEFAULT_LAYOUT[config.template ?? 'service']);
    toast.success('Layout reset to template default');
  };

  // Variant picker overlay state. When `pickerBlock` is set, the visual
  // variant gallery opens so the user can see thumbnails before committing.
  const [pickerBlock, setPickerBlock] = useState<SiteBlockKey | null>(null);

  // Counts for the summary row at the top of the editor — gives agencies
  // an at-a-glance read of how built-out the current page is.
  const totalSections = layout.length;
  const emptySections = layout.filter(
    (b) => blockContentSummary(config, b, images).tone === 'warn',
  ).length;

  return (
    <div className="space-y-4">
      {/* Header summary + explanation. Agencies can skim this and know the
          tab scopes edits to the active page + how much content is missing
          before clicking in to fix it. */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1D9CA1]/10 text-[#1D9CA1]">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900">
              {totalSections} section{totalSections === 1 ? '' : 's'}
              {isMultipage && activePage ? (
                <>
                  {' '}on <span className="text-[#1D9CA1]">{activePage.title}</span>
                </>
              ) : null}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              {emptySections > 0 ? (
                <>
                  <AlertTriangle className="mr-0.5 inline h-3 w-3 text-amber-500" />
                  {emptySections} section{emptySections === 1 ? '' : 's'} need content.
                  Head to the <strong>Items</strong> tab to add text, or the{' '}
                  <strong>Content</strong> tab for inline editing.
                </>
              ) : (
                <>
                  Drag any card to reorder. Click the eye to jump the
                  preview to that section. Click the paintbrush to swap its style.
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={resetLayout}
            title="Reset to template default"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-slate-300 hover:text-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isMultipage && activePage ? (
        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Editing the <strong>{activePage.title}</strong> page only. Use the
            page tabs above the preview to switch to another page.
          </span>
        </div>
      ) : null}

      {/* Section cards — one per block in layout order. Drag the grip to
          reorder; click an action icon for a targeted edit. */}
      <Reorder.Group
        axis="y"
        values={layout}
        onReorder={(newOrder) => setLayout(newOrder as SiteBlockKey[])}
        className="space-y-2"
      >
        {layout.map((block, i) => (
          <SectionCard
            key={block}
            block={block}
            index={i}
            total={layout.length}
            config={config}
            images={images}
            onOpenPicker={() => setPickerBlock(block)}
            onRemove={() => removeBlock(block)}
            onMoveUp={() => moveBlock(block, -1)}
            onMoveDown={() => moveBlock(block, 1)}
          />
        ))}
      </Reorder.Group>

      {/* Add section — grouped by job-to-be-done so local-business
          agencies find what they need fast. */}
      {available.length > 0 ? (
        <AddSectionGallery
          available={available}
          onPick={(block) => {
            // Variant-capable blocks open the picker so the user can
            // preview before committing. Blocks without variants add
            // immediately with their default layout.
            if (hasVariants(block)) {
              setPickerBlock(block);
            } else {
              addBlock(block);
            }
          }}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-500">
          Every available section is already on this page.
        </div>
      )}

      {/* Per-section decorative backgrounds — grid, dots, particles,
          mesh, etc. Applied to any block except nav / hero / footer
          (hero has its own variant system for backgrounds; nav/footer
          don't need decorative effects). */}
      <SectionBackgroundsEditor
        config={config}
        onChange={onChange}
        layout={layout}
      />

      {/* Variant picker overlay — visible when the user clicks Add on a
          variant-capable block or the paintbrush on an existing block.
          Shows a gallery of thumbnails + descriptions. Picking one adds
          the block if it wasn't already in the layout, or swaps the
          variant in place if it was. */}
      {pickerBlock ? (
        <VariantPickerSheet
          block={pickerBlock}
          config={config}
          currentVariantId={(() => {
            if (pickerBlock === 'hero') return config.hero?.variant;
            const entry = config[pickerBlock as keyof WebsiteConfig] as
              | { variant?: string }
              | undefined;
            return entry?.variant;
          })()}
          alreadyInLayout={layout.includes(pickerBlock)}
          onClose={() => setPickerBlock(null)}
          onPick={(variantId) => {
            if (layout.includes(pickerBlock)) {
              // Block already present — just swap variant. Keep all other
              // data (members, reviews, etc.) untouched.
              const patch: Partial<WebsiteConfig> = {};
              if (pickerBlock === 'hero') {
                patch.hero = { ...(config.hero ?? {}), variant: variantId as HeroVariant };
              } else {
                const key = pickerBlock as keyof WebsiteConfig;
                const current = (config[key] as Record<string, unknown> | undefined) ?? {};
                (patch as Record<string, unknown>)[key] = { ...current, variant: variantId };
              }
              onChange({ ...config, ...patch });
              toast.success(
                `${BLOCK_LABELS[pickerBlock]} style changed`,
                findVariant(pickerBlock, variantId)?.label,
              );
              // Scroll to the section that just changed so the user sees
              // the new style in context.
              window.setTimeout(() => scrollPreviewToSection(pickerBlock), 150);
            } else {
              // Not yet in layout — add it with the chosen variant.
              addBlock(pickerBlock, variantId);
            }
            setPickerBlock(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SectionCard — one row per block in the Sections tab                 */
/* ------------------------------------------------------------------ */

/**
 * Visual row for a single block in the layout. Shows:
 *   - colour-coded icon so the block type reads at a glance
 *   - block name + sequence number (1/7, 2/7, ...)
 *   - one-line "what this section does" copy so non-technical agencies
 *     don't have to guess what "pricing tiers" means
 *   - current variant badge (when applicable) so style changes are
 *     visible without opening the picker
 *   - inline content summary ("4 services", "needs content")
 *   - compact row of action icons on the right: locate (scroll the
 *     preview to this section), change style, move up/down, remove
 *
 * `nav` and `footer` can't be removed — the buttons simply disable.
 * `index === 0` disables the move-up arrow; `index === total-1` disables
 * move-down. The layout is pinned so nav stays first and footer stays
 * last even when the user drag-reorders around them.
 */
function SectionCard({
  block,
  index,
  total,
  config,
  images,
  onOpenPicker,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  block: SiteBlockKey;
  index: number;
  total: number;
  config: WebsiteConfig;
  images: string[];
  onOpenPicker: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const meta = BLOCK_META[block];
  const Icon = meta.icon;
  const toneClasses = TONE_CLASSES[meta.tone];

  // Explicit drag controls — only the grip handle starts a drag. This
  // stops clicks on the action buttons (Eye, Palette, Trash, etc.) from
  // accidentally initiating a reorder, which is a subtle but frustrating
  // issue when `Reorder.Item` uses the whole row as the drag surface.
  const dragControls = useDragControls();

  const currentVariantId = (() => {
    if (block === 'hero') return config.hero?.variant;
    const entry = config[block as keyof WebsiteConfig] as
      | { variant?: string }
      | undefined;
    return entry?.variant;
  })();
  const currentVariant = findVariant(block, currentVariantId);
  const canSwapVariant = hasVariants(block);
  const isRequired = !!meta.required;
  const summary = blockContentSummary(config, block, images);
  const canLocate = !!meta.anchorId;

  // Move arrows are disabled when they'd push nav below a non-nav block
  // or pull footer above one, since those two are layout-pinned.
  const canMoveUp = !isRequired && index > 1; // index 0 is nav
  const canMoveDown = !isRequired && index < total - 2; // last index is footer

  return (
    <Reorder.Item
      value={block}
      dragListener={false}
      dragControls={dragControls}
      className={`group relative flex items-stretch gap-0 overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-sm ${
        summary.tone === 'warn' ? 'border-amber-200' : 'border-slate-200'
      }`}
    >
      {/* Tone bar — a coloured edge matching the block's tone. Gives the
          section a visual "where does it sit?" cue. Strength is bumped
          vs the icon chip so the edge reads at a quick scan. */}
      <div className={`w-1 shrink-0 ${toneClasses.bar}`} aria-hidden />

      <div className="flex flex-1 items-start gap-2.5 p-2.5">
        {/* Grip — the dedicated drag handle. Only this surface initiates
            drag; the rest of the row is clickable. Hidden on required
            blocks (nav, footer) since they're pinned — trying to drag
            them is a silent no-op which feels broken. */}
        {!isRequired ? (
          <button
            type="button"
            aria-label="Drag to reorder"
            onPointerDown={(e) => {
              // Ignore non-primary buttons to leave right-click free for
              // the browser's context menu.
              if (e.button !== 0 && e.pointerType === 'mouse') return;
              dragControls.start(e);
            }}
            className="flex shrink-0 cursor-grab touch-none items-start pt-1 text-slate-300 active:cursor-grabbing group-hover:text-slate-500"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : (
          // Spacer keeps the icon chip aligned with draggable rows.
          <div className="w-3.5 shrink-0" aria-hidden />
        )}

        {/* Icon chip */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses.bg} ${toneClasses.text}`}
        >
          <Icon className="h-4 w-4" />
        </div>

        {/* Identity + summary */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold tabular-nums text-slate-400">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {BLOCK_LABELS[block]}
            </span>
            {isRequired ? (
              <span
                className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500"
                title="This section is always on"
              >
                Required
              </span>
            ) : null}
            {currentVariant ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${toneClasses.text} ${toneClasses.soft}`}
                title={currentVariant.description}
              >
                {currentVariant.label}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-slate-500">
            {meta.purpose}
          </p>
          <p
            className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium ${
              summary.tone === 'warn'
                ? 'text-amber-700'
                : summary.tone === 'ok'
                  ? 'text-emerald-700'
                  : 'text-slate-500'
            }`}
          >
            {summary.tone === 'warn' ? (
              <AlertTriangle className="h-2.5 w-2.5" />
            ) : summary.tone === 'ok' ? (
              <Check className="h-2.5 w-2.5" />
            ) : (
              <Info className="h-2.5 w-2.5" />
            )}
            {summary.text}
          </p>
        </div>

        {/* Action cluster — icon-only to keep the row compact, with
            descriptive titles for screen readers and hover tooltips. */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-0.5">
            {canLocate ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollPreviewToSection(block);
                }}
                title="Find this section in the preview"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-[#1D9CA1]"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {canSwapVariant ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPicker();
                }}
                title="Change the style of this section"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-[#1D9CA1]"
              >
                <Palette className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {!isRequired ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                title="Remove this section"
                className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              disabled={!canMoveUp}
              title="Move up"
              className="rounded-md p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-300"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              disabled={!canMoveDown}
              title="Move down"
              className="rounded-md p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-300"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}

/* ------------------------------------------------------------------ */
/* SectionBackgroundsEditor — decorative backgrounds per block         */
/* ------------------------------------------------------------------ */

/**
 * Metadata for each supported background kind — drives the picker
 * chip's label / description / preview swatch. Keep this ordered so
 * the common effects (grid, dots) come first.
 */
const SECTION_BG_OPTIONS: Array<{
  kind: SectionBackgroundKind;
  label: string;
  hint: string;
}> = [
  { kind: 'none', label: 'None', hint: 'No decorative background' },
  { kind: 'grid', label: 'Grid', hint: 'Technical grid pattern, brand-tinted' },
  { kind: 'dots', label: 'Dots', hint: 'Soft dot grid, magazine-style' },
  { kind: 'noise', label: 'Noise', hint: 'Subtle film-grain texture' },
  { kind: 'gradient', label: 'Gradient', hint: 'Soft radial gradient wash' },
  { kind: 'mesh', label: 'Mesh', hint: 'Blurred conic gradient mesh' },
  { kind: 'particles', label: 'Particles', hint: 'Fine dust drifting slowly' },
  { kind: 'sparkles', label: 'Sparkles', hint: 'Larger twinkling particles' },
  { kind: 'meteors', label: 'Meteors', hint: 'Falling meteor streaks' },
  { kind: 'beams', label: 'Beams', hint: 'Slow rotating conic beam' },
  { kind: 'ripple', label: 'Ripple', hint: 'Concentric pulse rings' },
  { kind: 'shooting-stars', label: 'Shooting stars', hint: 'Streaks across the background' },
];

/**
 * Editor for `config.sectionBackgrounds`. Shows each block currently
 * in the active page's layout (except nav / hero / footer — those have
 * their own background systems or don't need one) with a compact
 * picker for the background kind + opacity + tint colour.
 *
 * Agencies use this to add a grid behind the services section, a
 * particle field behind the reviews, etc. Zero-config: leaving every
 * block on "None" keeps the site plain.
 */
function SectionBackgroundsEditor({
  config,
  onChange,
  layout,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  layout: SiteBlockKey[];
}) {
  // Filter layout down to blocks that support a decorative background.
  // Nav / hero / footer have their own systems; announcement is a
  // horizontal strip that doesn't benefit from a background layer.
  const eligibleBlocks = layout.filter(
    (k) => k !== 'nav' && k !== 'hero' && k !== 'footer' && k !== 'announcement',
  );

  if (eligibleBlocks.length === 0) {
    return null;
  }

  const backgrounds = config.sectionBackgrounds ?? {};
  const configuredCount = Object.values(backgrounds).filter(
    (b) => b && b.kind !== 'none',
  ).length;

  const updateBackground = (
    block: SiteBlockKey,
    next: SectionBackground | null,
  ) => {
    const copy = { ...(config.sectionBackgrounds ?? {}) };
    if (next == null || next.kind === 'none') {
      delete copy[block];
    } else {
      copy[block] = next;
    }
    onChange({
      ...config,
      sectionBackgrounds: Object.keys(copy).length > 0 ? copy : undefined,
    });
  };

  return (
    <details className="rounded-2xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700">
        <Palette className="h-3.5 w-3.5 text-slate-400" />
        Section backgrounds
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          {configuredCount}
        </span>
        <span className="ml-auto text-[10px] font-normal text-slate-400">
          grid, dots, particles…
        </span>
      </summary>
      <div className="space-y-2 border-t border-slate-100 p-3">
        <p className="text-[11px] text-slate-500">
          Add a decorative background behind any section — a grid behind the
          services, particles behind the reviews, meteors behind the CTA.
          Hero already has its own background system (change via the Hero tab).
        </p>
        {eligibleBlocks.map((block) => {
          const bg = backgrounds[block];
          return (
            <SectionBackgroundRow
              key={block}
              block={block}
              background={bg}
              onChange={(next) => updateBackground(block, next)}
            />
          );
        })}
      </div>
    </details>
  );
}

/**
 * One row inside the SectionBackgroundsEditor — shows the block name,
 * a dropdown of available background kinds, and (when a background is
 * selected) opacity slider + tint colour input.
 */
function SectionBackgroundRow({
  block,
  background,
  onChange,
}: {
  block: SiteBlockKey;
  background: SectionBackground | undefined;
  onChange: (next: SectionBackground | null) => void;
}) {
  const kind: SectionBackgroundKind = background?.kind ?? 'none';
  const label = BLOCK_LABELS[block] ?? block;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-900">
          {label}
        </span>
        <select
          value={kind}
          onChange={(e) => {
            const nextKind = e.target.value as SectionBackgroundKind;
            if (nextKind === 'none') {
              onChange(null);
            } else {
              onChange({ ...(background ?? {}), kind: nextKind });
            }
          }}
          className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px]"
        >
          {SECTION_BG_OPTIONS.map((o) => (
            <option key={o.kind} value={o.kind}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {kind !== 'none' && background ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Opacity · {((background.opacity ?? 0.4) * 100).toFixed(0)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={background.opacity ?? 0.4}
              onChange={(e) =>
                onChange({ ...background, opacity: Number(e.target.value) })
              }
              className="mt-0.5 w-full"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Tint
            </span>
            <div className="mt-0.5 flex items-center gap-1.5">
              <input
                type="color"
                value={normaliseHex(background.tint) ?? '#1D9CA1'}
                onChange={(e) =>
                  onChange({ ...background, tint: e.target.value })
                }
                className="h-7 w-7 cursor-pointer rounded border border-slate-200"
              />
              <button
                type="button"
                onClick={() => onChange({ ...background, tint: undefined })}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] text-slate-500 hover:bg-slate-100"
                title="Use brand primary colour"
              >
                Brand
              </button>
            </div>
          </label>
        </div>
      ) : null}
    </div>
  );
}

/** Coerce a tint string to a CSS hex we can feed an <input type="color">. */
function normaliseHex(tint: string | undefined): string | undefined {
  if (!tint) return undefined;
  const trimmed = tint.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  // `var(--...)` or any other non-hex value — return undefined so the
  // color input falls back to its default.
  return undefined;
}

/* ------------------------------------------------------------------ */
/* AddSectionGallery — grouped picker below the active layout          */
/* ------------------------------------------------------------------ */

/**
 * Categorised gallery of sections the agency can add. Groups are
 * curated for the target user (small-business agency) so the most
 * common "I need X" options are always one click away. Unused groups
 * collapse automatically — if everything in "Commerce" is already on
 * the page, the whole group disappears.
 */
function AddSectionGallery({
  available,
  onPick,
}: {
  available: SiteBlockKey[];
  onPick: (block: SiteBlockKey) => void;
}) {
  const availableSet = new Set(available);
  // Blocks that didn't fit any named group end up in "Other" at the
  // bottom so we never silently hide an addable option from the user.
  const claimedIds = new Set<string>();
  const groups = SECTION_GROUPS.map((g) => ({
    ...g,
    blocks: g.blocks.filter((b) => {
      if (!availableSet.has(b)) return false;
      claimedIds.add(b);
      return true;
    }),
  })).filter((g) => g.blocks.length > 0);

  const leftovers = available.filter((b) => !claimedIds.has(b));
  if (leftovers.length > 0) {
    groups.push({
      id: 'other',
      label: 'Other',
      tagline: 'Uncategorised sections.',
      blocks: leftovers,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <Plus className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-xs font-semibold text-slate-700">Add a section</p>
        <span className="text-[10px] text-slate-400">
          {available.length} available
        </span>
      </div>
      <div className="space-y-2.5">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <p className="mb-1.5 text-[10px] text-slate-400">{group.tagline}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {group.blocks.map((block) => {
                const meta = BLOCK_META[block];
                const Icon = meta.icon;
                const toneClasses = TONE_CLASSES[meta.tone];
                return (
                  <button
                    key={block}
                    type="button"
                    onClick={() => onPick(block)}
                    className="group flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-2 text-left transition-all hover:-translate-y-0.5 hover:border-[#1D9CA1]/60 hover:shadow-sm"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneClasses.bg} ${toneClasses.text}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-[11px] font-semibold text-slate-900 group-hover:text-[#1D9CA1]">
                          {BLOCK_LABELS[block]}
                        </span>
                        {hasVariants(block) ? (
                          <span className="rounded bg-slate-100 px-1 py-[1px] text-[8px] font-semibold text-slate-500">
                            {getVariantsFor(block).length}
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-[10px] leading-snug text-slate-500">
                        {meta.purpose}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="pt-1 text-[10px] text-slate-400">
        <Lightbulb className="mr-0.5 inline h-3 w-3" />
        Tip: sections with a number badge have style variants. Click the
        paintbrush on any added section to swap its style anytime.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero Editor — variant picker + AI image regeneration               */
/* ------------------------------------------------------------------ */

function HeroEditor({
  config,
  onChange,
  clientId,
  images,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  clientId: string;
  images: string[];
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [overridePrompt, setOverridePrompt] = useState(config.hero?.aiImagePrompt ?? '');

  const variant = config.hero?.variant ?? 'parallax-layers';

  const setVariant = (v: HeroVariant) => {
    onChange({
      ...config,
      hero: { ...config.hero, variant: v },
    });
  };

  const setHeroImage = (imageIndex: number | null) => {
    onChange({
      ...config,
      hero: { ...config.hero, imageIndex },
    });
  };

  const regen = async () => {
    if (!clientId) return;
    setRegenerating(true);
    try {
      const result = await api.generateHeroImage({
        clientId,
        overridePrompt: overridePrompt.trim() || undefined,
      });
      onChange({
        ...config,
        hero: {
          ...config.hero,
          aiImageUrl: result.imageUrl,
          aiImagePrompt: result.prompt,
          // Switching on AI image implies unsetting client image selection.
          imageIndex: null,
        },
      });
      setOverridePrompt(result.prompt);
      toast.success(
        'Hero image regenerated',
        result.fromMock ? 'Using mock image (fal.ai not configured).' : undefined,
      );
    } catch (e) {
      toast.error('Regeneration failed', (e as Error).message);
    } finally {
      setRegenerating(false);
    }
  };

  const floatingIcons = config.hero?.floatingIcons ?? [];
  const activeImage =
    config.hero?.imageIndex != null
      ? images[config.hero.imageIndex]
      : config.hero?.aiImageUrl ?? null;
  const isUsingClientImage = config.hero?.imageIndex != null;
  const variantUsesImage =
    variant === 'spotlight' || variant === 'parallax-layers';

  return (
    <div className="space-y-5">
      {/* Copy editor — eyebrow / headline / subheadline. Keeping these in
          the panel as well as inline-editable in the preview means the
          agency can write headlines without having to hunt the visible
          preview. Useful when the hero variant covers / obscures the
          copy (full-bg image, dark themes) so you can't easily click
          exactly where the text is. */}
      <div>
        <p className="text-xs font-medium text-slate-600">Hero copy</p>
        <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <LabelledField label="Eyebrow (optional)" hint="short kicker">
            <Input
              value={config.hero?.eyebrow ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  hero: { ...config.hero, eyebrow: e.target.value || undefined },
                })
              }
              placeholder="e.g. Family-run since 1998"
              maxLength={80}
            />
          </LabelledField>
          <LabelledField label="Headline" hint="last 2 words auto-highlight">
            <Input
              value={config.hero?.headline ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  hero: { ...config.hero, headline: e.target.value },
                })
              }
              placeholder="The thing people care about most."
              maxLength={200}
            />
          </LabelledField>
          <LabelledField label="Subheadline">
            <Textarea
              value={config.hero?.subheadline ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  hero: { ...config.hero, subheadline: e.target.value },
                })
              }
              placeholder="One or two sentences that back up the headline."
              rows={2}
              maxLength={400}
            />
          </LabelledField>
        </div>
      </div>

      {/* Variant picker */}
      <div>
        <p className="text-xs font-medium text-slate-600">Hero style</p>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          {HERO_VARIANTS.map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                variant === v
                  ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 ring-1 ring-[#1D9CA1]/30'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <HeroVariantPreview variant={v} config={config} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900">
                  {HERO_VARIANT_META[v].label}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  {HERO_VARIANT_META[v].description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Floating icons editor (only when variant is floating-icons) */}
      {variant === 'floating-icons' && (
        <div>
          <p className="text-xs font-medium text-slate-600">
            Floating icons
            <span className="ml-2 font-normal text-slate-400">
              Lucide names or emojis, space-separated
            </span>
          </p>
          <Input
            className="mt-1 text-xs"
            value={floatingIcons.join(' ')}
            onChange={(e) =>
              onChange({
                ...config,
                hero: {
                  ...config.hero,
                  floatingIcons: e.target.value
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 10),
                },
              })
            }
            placeholder="Coffee ☕ Utensils Leaf 🍴 Flame Star"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            6–10 works best. Mix icon names and emojis for personality. Leave blank to auto-pick from the template.
          </p>
        </div>
      )}

      {/* Hero image source (only shown for variants that use an image) */}
      {variantUsesImage && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">Hero image source</p>

          {/* Tabbed selector: AI vs client photo */}
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setHeroImage(null)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                !isUsingClientImage
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              AI-generated
            </button>
            <button
              onClick={() => images[0] && setHeroImage(0)}
              disabled={images.length === 0}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                isUsingClientImage
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 disabled:opacity-40'
              }`}
            >
              Client photo ({images.length})
            </button>
          </div>

          {/* Active image preview + grid selector when using client photos */}
          {isUsingClientImage ? (
            <div>
              <p className="text-[10px] text-slate-500">
                Pick which approved photo to use. Best hero images are wide, high-quality,
                and representative of the business.
              </p>
              <div className="mt-2 grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                {images.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    onClick={() => setHeroImage(i)}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                      config.hero?.imageIndex === i
                        ? 'border-[#1D9CA1] ring-1 ring-[#1D9CA1]/30'
                        : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {config.hero?.imageIndex === i ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#1D9CA1]/30">
                        <Check className="h-4 w-4 text-white drop-shadow" />
                      </div>
                    ) : null}
                  </button>
                ))}
                {images.length === 0 && (
                  <div className="col-span-4 py-6 text-center text-[11px] text-slate-400">
                    No client photos uploaded yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start gap-3">
                {activeImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeImage}
                    alt="AI hero"
                    className="h-20 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900">
                    AI hero image
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {activeImage
                      ? 'Regenerate for a new take, or write a custom prompt below.'
                      : 'Nothing generated yet. Click below to create one.'}
                  </p>
                </div>
              </div>

              <Textarea
                className="mt-3 text-[11px] no-zoom"
                rows={3}
                value={overridePrompt}
                onChange={(e) => setOverridePrompt(e.target.value)}
                placeholder="Leave blank to let Claude write a prompt, or describe exactly what you want (e.g. 'A flat-lay of coffee beans on dark walnut, single warm beam of morning light, shallow depth of field, muted earth tones')."
              />
              <Button
                size="sm"
                onClick={regen}
                disabled={regenerating}
                className="mt-2 w-full"
              >
                {regenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3" />
                    {activeImage ? 'Regenerate image' : 'Generate image'}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* CTA button links — labels are inline-editable in the preview; the
          hrefs live here because a contenteditable span isn't the right
          control for a URL. */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-600">Call-to-action links</p>
        <CtaLinkField
          label="Primary CTA"
          labelText={config.hero?.ctaPrimary?.label ?? 'Get in touch'}
          href={config.hero?.ctaPrimary?.href ?? '#contact'}
          onChange={(patch) =>
            onChange({
              ...config,
              hero: {
                ...config.hero,
                ctaPrimary: {
                  ...(config.hero?.ctaPrimary ?? { label: 'Get in touch', href: '#contact' }),
                  ...patch,
                },
              },
            })
          }
        />
        <CtaLinkField
          label="Secondary CTA (optional)"
          labelText={config.hero?.ctaSecondary?.label ?? ''}
          href={config.hero?.ctaSecondary?.href ?? ''}
          onChange={(patch) => {
            const next = { ...(config.hero?.ctaSecondary ?? { label: '', href: '' }), ...patch };
            onChange({
              ...config,
              hero: {
                ...config.hero,
                // If both label and href are cleared, remove the secondary CTA.
                ctaSecondary: !next.label && !next.href ? undefined : next,
              },
            });
          }}
          onRemove={
            config.hero?.ctaSecondary
              ? () =>
                  onChange({
                    ...config,
                    hero: { ...config.hero, ctaSecondary: undefined },
                  })
              : undefined
          }
        />
      </div>

      <CutoutsEditor config={config} onChange={onChange} clientId={clientId} />

      <IllustrationEditor config={config} onChange={onChange} clientId={clientId} />
    </div>
  );
}

/**
 * Editor for a single CTA button: label + href. The label is also editable
 * via inline edit in the preview — duplicating it here is intentional so
 * agencies can see both pieces side-by-side when wiring up a new link.
 */
function CtaLinkField({
  label,
  labelText,
  href,
  onChange,
  onRemove,
}: {
  label: string;
  labelText: string;
  href: string;
  onChange: (patch: { label?: string; href?: string }) => void;
  onRemove?: () => void;
}) {
  const looksValid = !href || /^(#|https?:\/\/|tel:|mailto:|\/)/.test(href);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-600">{label}</p>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
            title="Remove this CTA"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      <div className="mt-1.5 space-y-1.5">
        <Input
          className="h-8 text-xs"
          value={labelText}
          onChange={(e) => onChange({ label: e.target.value.slice(0, 50) })}
          placeholder="Button label"
          maxLength={50}
        />
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3 w-3 shrink-0 text-slate-400" />
          <Input
            className={`h-8 font-mono text-[11px] ${
              !looksValid ? 'border-rose-300 text-rose-600' : ''
            }`}
            value={href}
            onChange={(e) => onChange({ href: e.target.value.slice(0, 500) })}
            placeholder="#contact or https://..."
            maxLength={500}
          />
        </div>
        <p className="text-[10px] text-slate-400">
          {href.startsWith('#')
            ? 'Scrolls to that section on the page'
            : href.startsWith('tel:')
              ? 'Opens the phone dialer'
              : href.startsWith('mailto:')
                ? 'Opens email client'
                : href.startsWith('http')
                  ? 'Opens an external site'
                  : href.startsWith('/')
                    ? 'Goes to another page on the site'
                    : href
                      ? 'Unusual link — double-check this works'
                      : 'Use # for in-page sections, tel: for phone, mailto: for email.'}
        </p>
      </div>
    </div>
  );
}

/** Tiny inline SVG preview for each hero variant tile. */
function HeroVariantPreview({
  variant,
  config,
}: {
  variant: HeroVariant;
  config: WebsiteConfig;
}) {
  const p = config.brand.primaryColor;
  const a = config.brand.accentColor;
  const pop = config.brand.popColor ?? '#FFEC3D';
  return (
    <svg
      viewBox="0 0 48 32"
      className="h-10 w-14 shrink-0 rounded-md border border-slate-200 bg-white"
    >
      {variant === 'spotlight' && (
        <>
          <defs>
            <radialGradient id={`sp-${variant}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={p} stopOpacity="0.6" />
              <stop offset="100%" stopColor={p} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="48" height="32" fill="#f8fafc" />
          <circle cx="24" cy="16" r="16" fill={`url(#sp-${variant})`} />
          <rect x="14" y="14" width="20" height="2.5" fill="#0f172a" rx="1" />
          <rect x="18" y="18" width="12" height="1.5" fill="#94a3b8" rx="0.75" />
        </>
      )}
      {variant === 'beams' && (
        <>
          <rect width="48" height="32" fill="#f8fafc" />
          <line x1="0" y1="0" x2="30" y2="20" stroke={p} strokeWidth="0.5" opacity="0.6" />
          <line x1="0" y1="8" x2="34" y2="30" stroke={a} strokeWidth="0.5" opacity="0.6" />
          <line x1="5" y1="0" x2="42" y2="22" stroke={pop} strokeWidth="0.5" opacity="0.6" />
          <rect x="14" y="14" width="20" height="2.5" fill="#0f172a" rx="1" />
          <rect x="18" y="18" width="12" height="1.5" fill="#94a3b8" rx="0.75" />
        </>
      )}
      {variant === 'floating-icons' && (
        <>
          <rect width="48" height="32" fill="#f8fafc" />
          <circle cx="8" cy="8" r="2" fill={p} opacity="0.3" />
          <circle cx="38" cy="10" r="1.5" fill={a} opacity="0.3" />
          <circle cx="12" cy="24" r="1.8" fill={pop} opacity="0.3" />
          <circle cx="40" cy="26" r="2" fill={p} opacity="0.3" />
          <rect x="6" y="14" width="16" height="2.5" fill="#0f172a" rx="1" />
          <rect x="6" y="18" width="10" height="1.5" fill="#94a3b8" rx="0.75" />
        </>
      )}
      {variant === 'parallax-layers' && (
        <>
          <rect width="48" height="32" fill="#f8fafc" />
          <rect x="4" y="8" width="16" height="2.5" fill="#0f172a" rx="1" />
          <rect x="4" y="12" width="10" height="1.5" fill="#94a3b8" rx="0.75" />
          <rect
            x="26"
            y="4"
            width="18"
            height="24"
            rx="3"
            fill={`url(#pl-${variant})`}
          />
          <defs>
            <linearGradient id={`pl-${variant}`}>
              <stop offset="0%" stopColor={p} />
              <stop offset="100%" stopColor={a} />
            </linearGradient>
          </defs>
        </>
      )}
      {variant === 'gradient-mesh' && (
        <>
          <defs>
            <radialGradient id={`gm1-${variant}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor={p} stopOpacity="0.7" />
              <stop offset="100%" stopColor={p} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`gm2-${variant}`} cx="70%" cy="70%">
              <stop offset="0%" stopColor={a} stopOpacity="0.7" />
              <stop offset="100%" stopColor={a} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="48" height="32" fill="#ffffff" />
          <rect width="48" height="32" fill={`url(#gm1-${variant})`} />
          <rect width="48" height="32" fill={`url(#gm2-${variant})`} />
          <rect x="14" y="14" width="20" height="2.5" fill="#0f172a" rx="1" />
          <rect x="18" y="18" width="12" height="1.5" fill="#475569" rx="0.75" />
        </>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Pages Manager — add/remove/rename pages for multipage sites         */
/* ------------------------------------------------------------------ */

/**
 * Per-page editor for multipage sites. Lets the agency:
 *   - Reorder pages (drag) — the homepage always stays first.
 *   - Rename a page's title (appears in the nav).
 *   - Edit the per-page hero headline / subheadline (what the sub-page
 *     says at the top).
 *   - Add a new blank page with a sensible default layout.
 *   - Remove a page (home cannot be removed).
 *
 * Single-page sites don't render this tab — the SiteEditor hides it
 * when `config.pages` is empty or has only one entry.
 */
function PagesManager({
  config,
  onChange,
  clientId,
  activePageSlug,
  onActivePageSlugChange,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  clientId: string;
  activePageSlug: string;
  onActivePageSlugChange: (slug: string) => void;
}) {
  const pages = config.pages ?? [];
  const activePage = pages.find((p) => p.slug === activePageSlug);
  const MAX_PAGES = 4;

  // AI page-generation modal state. When the user clicks "Enable
  // multipage" or "Add a page", we open a brief dialog asking what
  // the page is for — the server then runs it through Claude and
  // returns a fully populated PageConfig (hero + layout + block data).
  //
  // This replaces the old behaviour of appending a blank "New page"
  // stub with a copy-pasted home layout, which always produced a page
  // that looked identical to the homepage until the user edited every
  // field by hand.
  const [newPageModal, setNewPageModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Single-page site? Offer to upgrade it to multipage by running the
  // AI page generator with a brief — the server will synthesise a
  // Home entry from the current root layout AND generate the requested
  // sub-page in a single atomic call.
  const convertToMultipage = () => {
    setNewPageModal(true);
  };

  const updatePage = (slug: string, patch: Partial<PageConfig>) => {
    onChange({
      ...config,
      pages: pages.map((p) => (p.slug === slug ? { ...p, ...patch } : p)),
    });
  };

  const updatePageHero = (slug: string, patch: Partial<WebsiteConfig['hero']>) => {
    onChange({
      ...config,
      pages: pages.map((p) =>
        p.slug === slug ? { ...p, hero: { ...(p.hero ?? {}), ...patch } } : p,
      ),
    });
  };

  /**
   * Open the AI page-generation modal. Unlike the old `addPage` which
   * appended an empty stub and hoped the agency would fill it in field
   * by field, this routes through Claude with the full current config
   * as context so the new page has matching voice, colour palette, and
   * appropriate blocks for whatever the agency describes.
   */
  const addPage = () => {
    if (pages.length >= MAX_PAGES) {
      toast.info(`Maximum ${MAX_PAGES} pages`, 'Remove one to add another.');
      return;
    }
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    setNewPageModal(true);
  };

  /**
   * Handler invoked when the NewPageModal submits. Calls the server's
   * `/generate-website-page` endpoint, which runs Claude over the full
   * site config + the brief, returns a complete PageConfig, and also
   * persists the updated config on the server side. We still call
   * `onChange` with the returned config so the local editor state
   * matches immediately — the debounced save pipeline will reconcile.
   */
  const handleGeneratePage = async (brief: string, titleHint: string | undefined) => {
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    setGenerating(true);
    try {
      const result = await api.generateWebsitePage({
        clientId,
        currentConfig: config as unknown as Record<string, unknown>,
        brief,
        titleHint: titleHint?.trim() || undefined,
      });
      onChange(sanitizeConfig(result.config));
      onActivePageSlugChange(result.page.slug);
      setNewPageModal(false);
      toast.success('Page generated', result.summary);
    } catch (e) {
      toast.error('Page generation failed', (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const removePage = async (slug: string) => {
    if (slug === 'home') {
      toast.info('Home page is required');
      return;
    }
    if (
      !(await confirmDialog({
        title: `Delete "${pages.find((p) => p.slug === slug)?.title ?? slug}"?`,
        description: 'The nav link and all content on this page will be removed.',
        confirmLabel: 'Delete page',
        danger: true,
      }))
    )
      return;
    const next = pages.filter((p) => p.slug !== slug);
    onChange({ ...config, pages: next });
    if (slug === activePageSlug) onActivePageSlugChange('home');
    toast.success('Page removed');
  };

  const renamePage = (slug: string, title: string) => {
    updatePage(slug, { title: title.slice(0, 100) });
  };

  /**
   * When the user edits a page slug we regenerate it through slugify to
   * keep URLs clean. The home page's slug is locked — you can't rename
   * `home` because its URL maps to `/sites/[slug]` not `/sites/[slug]/home`.
   */
  const reslugPage = (oldSlug: string, draft: string) => {
    if (oldSlug === 'home') return;
    const cleaned = slugify(draft);
    if (!cleaned) {
      toast.error('Slug cannot be empty');
      return;
    }
    if (pages.some((p) => p.slug === cleaned && p.slug !== oldSlug)) {
      toast.error('Another page already uses that URL', 'Pick a different one.');
      return;
    }
    onChange({
      ...config,
      pages: pages.map((p) =>
        p.slug === oldSlug ? { ...p, slug: cleaned } : p,
      ),
    });
    if (activePageSlug === oldSlug) onActivePageSlugChange(cleaned);
  };

  return (
    <div className="space-y-4">
      {pages.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <FileText className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-900">
            Single-page site
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Everything lives on one scrolling page. Upgrade to multipage when the
            business needs dedicated pages for Menu, Prices, Team, Shop, etc.
          </p>
          <button
            type="button"
            onClick={convertToMultipage}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1D9CA1] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#158087]"
          >
            <Sparkles className="h-3 w-3" />
            Add a page with AI
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          This is a multipage site. Each page gets its own URL in the nav.
          Max {MAX_PAGES} pages. Delete unused ones to add more.
        </div>
      )}

      <div className="space-y-2">
        {pages.map((p) => {
          const isActive = p.slug === activePageSlug;
          const isHome = p.slug === 'home';
          return (
            <div
              key={p.slug}
              className={`rounded-xl border transition-all ${
                isActive
                  ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 ring-1 ring-[#1D9CA1]/30'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {/* Row layout with siblings instead of nested buttons to
                  avoid the React hydration error. The main button
                  stretches across; the delete lives as its own button
                  in the same row with its own z-order. */}
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onActivePageSlugChange(p.slug)}
                  className="flex flex-1 items-center gap-2 px-3 py-2.5 text-left min-w-0"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {p.title}
                    </div>
                    <div className="truncate text-[10px] text-slate-500">
                      /{isHome ? '' : p.slug}
                    </div>
                  </div>
                </button>
                {!isHome ? (
                  <button
                    type="button"
                    onClick={() => removePage(p.slug)}
                    className="flex items-center justify-center px-3 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Delete ${p.title}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {isActive ? (
                <div className="space-y-2 border-t border-slate-200 p-3">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Nav title
                    </span>
                    <Input
                      className="mt-0.5 h-9 text-xs"
                      value={p.title}
                      onChange={(e) => renamePage(p.slug, e.target.value)}
                      maxLength={100}
                    />
                  </label>
                  {!isHome ? (
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        URL slug
                      </span>
                      <Input
                        className="mt-0.5 h-9 font-mono text-xs"
                        defaultValue={p.slug}
                        onBlur={(e) => reslugPage(p.slug, e.target.value)}
                        placeholder="about"
                      />
                    </label>
                  ) : null}
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Page hero eyebrow
                    </span>
                    <Input
                      className="mt-0.5 h-9 text-xs"
                      value={p.hero?.eyebrow ?? ''}
                      onChange={(e) =>
                        updatePageHero(p.slug, { eyebrow: e.target.value || undefined })
                      }
                      placeholder={isHome ? 'Optional' : 'Our menu'}
                      maxLength={80}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Page hero headline
                    </span>
                    <Input
                      className="mt-0.5 h-9 text-xs"
                      value={p.hero?.headline ?? ''}
                      onChange={(e) => updatePageHero(p.slug, { headline: e.target.value })}
                      placeholder={isHome ? 'Leave blank to use homepage hero' : 'Our menu.'}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Page subheadline
                    </span>
                    <Textarea
                      className="mt-0.5 text-xs no-zoom"
                      rows={2}
                      value={p.hero?.subheadline ?? ''}
                      onChange={(e) =>
                        updatePageHero(p.slug, { subheadline: e.target.value })
                      }
                      placeholder={
                        isHome ? 'Leave blank to use homepage subhead' : 'Fresh daily. Local suppliers.'
                      }
                    />
                  </label>
                  <details className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      SEO (optional)
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      <label className="block">
                        <span className="text-[10px] text-slate-500">
                          SEO title override
                        </span>
                        <Input
                          className="mt-0.5 h-8 text-xs"
                          value={p.meta?.title ?? ''}
                          onChange={(e) =>
                            updatePage(p.slug, {
                              meta: {
                                ...(p.meta ?? {}),
                                title: e.target.value || undefined,
                              },
                            })
                          }
                          placeholder="Inherits from site title"
                          maxLength={80}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-slate-500">
                          SEO description override
                        </span>
                        <Textarea
                          className="mt-0.5 text-xs no-zoom"
                          rows={2}
                          value={p.meta?.description ?? ''}
                          onChange={(e) =>
                            updatePage(p.slug, {
                              meta: {
                                ...(p.meta ?? {}),
                                description: e.target.value || undefined,
                              },
                            })
                          }
                          placeholder="Inherits from site description"
                          maxLength={200}
                        />
                      </label>
                    </div>
                  </details>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {pages.length < MAX_PAGES ? (
        <Button
          variant="outline"
          size="sm"
          onClick={addPage}
          className="w-full"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Add a page with AI
        </Button>
      ) : null}

      {newPageModal ? (
        <NewPageModal
          existingPages={pages}
          generating={generating}
          isFirstSubPage={pages.length === 0}
          onClose={() => (generating ? undefined : setNewPageModal(false))}
          onGenerate={handleGeneratePage}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* New Page Modal — AI-driven sub-page generation                      */
/* ------------------------------------------------------------------ */

/**
 * Modal that asks the agency what the new page is for, then calls the
 * server's page-generator so Claude produces a fully populated page
 * (hero, layout, per-page block data) that matches the site's brand.
 *
 * The "quick start" chips prime the brief textarea with a template for
 * common page types (Menu, About, Team, Pricing, etc.) so the agency
 * doesn't stare at a blank field. They can edit the prefill before
 * submitting.
 *
 * Progress state is owned by the parent — we show a spinner + disabled
 * buttons while `generating` is true. Esc closes when idle; backdrop
 * click closes when idle.
 */
function NewPageModal({
  existingPages,
  generating,
  isFirstSubPage,
  onClose,
  onGenerate,
}: {
  existingPages: PageConfig[];
  generating: boolean;
  isFirstSubPage: boolean;
  onClose: () => void;
  onGenerate: (brief: string, titleHint: string | undefined) => Promise<void>;
}) {
  const [titleHint, setTitleHint] = useState('');
  const [brief, setBrief] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const existingSlugs = new Set(existingPages.map((p) => p.slug));

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 60);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !generating) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, generating]);

  const submit = async () => {
    const cleaned = brief.trim();
    if (cleaned.length < 10) {
      toast.info(
        'Add a bit more detail',
        'Tell the AI what the page should show — a sentence is plenty.',
      );
      return;
    }
    await onGenerate(cleaned, titleHint);
  };

  // Quick-start templates. Each one prefills a title + a starter brief
  // that the agency can edit before submitting. The briefs are specific
  // enough for Claude to produce a real page, not generic enough to
  // feel cookie-cutter.
  const quickStarts: Array<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    brief: string;
  }> = [
    {
      title: 'About',
      icon: Users,
      brief:
        'An About page that tells the story of how the business started, who runs it, and what we care about. Should feel warm and personal. Include the team (if we have one) and a few numbers that prove we know our stuff.',
    },
    {
      title: 'Menu',
      icon: Coffee,
      brief:
        "A Menu page showing everything we serve, organised by category (drinks, brunch, mains, etc.). Include prices and flag any signature items. If we do specials or seasonal stuff, mention that too.",
    },
    {
      title: 'Team',
      icon: Users,
      brief:
        'A Team page with the full roster — photos, names, roles, specialties, and a short bio for each person. Should celebrate the people behind the business.',
    },
    {
      title: 'Pricing',
      icon: Tags,
      brief:
        'A Pricing page laying out our packages / tiers clearly so visitors can compare and pick. Include what each tier gets you, highlight the most popular one, and answer the usual "how do I choose" questions in an FAQ.',
    },
    {
      title: 'Shop',
      icon: ShoppingBag,
      brief:
        'A Shop page showing what we sell — product cards with photos, names, prices, and a way to buy or enquire. Group by category if we have distinct ranges.',
    },
    {
      title: 'Portfolio',
      icon: Briefcase,
      brief:
        'A Portfolio page showing our best recent work as case studies with photos and a short story for each one. Show the range — different styles, scales, problems solved.',
    },
    {
      title: 'Services',
      icon: Workflow,
      brief:
        'A Services page with the full breakdown of everything we offer (wider than the home page teaser). Include a how-it-works section so visitors know what to expect when they book.',
    },
    {
      title: 'Service areas',
      icon: MapPin,
      brief:
        'A Service Areas page listing every town / region we cover, plus the rate / callout policy outside our zone. Include a few reviews from customers in different areas.',
    },
    {
      title: 'FAQ',
      icon: HelpCircle,
      brief:
        'A full FAQ page covering the usual pre-booking questions (pricing, lead time, what to expect, cancellation policy, accessibility, etc.). 8–12 honest answers.',
    },
    {
      title: 'Schedule',
      icon: Calendar,
      brief:
        'A Schedule / Classes page showing the weekly timetable. Include instructor names and class durations. If we do taster weeks or free trials, mention that.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => (generating ? undefined : onClose())}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-page-modal-title"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-[#1D9CA1]/5 to-transparent px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1D9CA1]/10">
              <Sparkles className="h-5 w-5 text-[#1D9CA1]" />
            </div>
            <div className="min-w-0">
              <h3
                id="new-page-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                {isFirstSubPage ? 'Enable multipage' : 'Add a new page'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-600">
                {isFirstSubPage
                  ? 'Describe what the new page should show. We\'ll also keep your current homepage.'
                  : 'Tell the AI what the page is for and we\'ll generate the full thing — hero, layout, copy.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-140px)] space-y-4 overflow-y-auto px-5 py-4">
          {/* Quick-start templates */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Quick start
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickStarts
                .filter((q) => !existingSlugs.has(slugify(q.title)))
                .map((q) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={q.title}
                      type="button"
                      disabled={generating}
                      onClick={() => {
                        setTitleHint(q.title);
                        setBrief(q.brief);
                        setTimeout(() => {
                          textareaRef.current?.focus();
                          textareaRef.current?.setSelectionRange(
                            q.brief.length,
                            q.brief.length,
                          );
                        }, 20);
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-[#1D9CA1] hover:bg-[#1D9CA1]/5 hover:text-[#1D9CA1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon className="h-3 w-3" />
                      {q.title}
                    </button>
                  );
                })}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">
              Click one to prefill the brief below — you can tweak before generating.
            </p>
          </div>

          {/* Title hint */}
          <div>
            <label
              htmlFor="new-page-title"
              className="block text-xs font-semibold text-slate-700"
            >
              Page title <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <Input
              id="new-page-title"
              className="mt-1"
              value={titleHint}
              onChange={(e) => setTitleHint(e.target.value.slice(0, 60))}
              placeholder="e.g. Menu, About, Our work"
              disabled={generating}
              maxLength={60}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              This is what shows in the navigation. The AI can override if a different
              title fits better.
            </p>
          </div>

          {/* Brief */}
          <div>
            <label
              htmlFor="new-page-brief"
              className="block text-xs font-semibold text-slate-700"
            >
              What should this page show?{' '}
              <span className="font-normal text-rose-500">*</span>
            </label>
            <Textarea
              id="new-page-brief"
              ref={textareaRef}
              className="mt-1 min-h-[160px] text-sm"
              value={brief}
              onChange={(e) => setBrief(e.target.value.slice(0, 3000))}
              placeholder="Describe what the page is for. E.g. 'A Menu page organised by category (coffee, brunch, mains) with prices and flagged signature items.'"
              disabled={generating}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !generating) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[10px] text-slate-500">
                Press <kbd className="rounded bg-slate-100 px-1 font-mono">Cmd/Ctrl + Enter</kbd>{' '}
                to generate.
              </p>
              <p className="text-[10px] text-slate-400 tabular-nums">{brief.length}/3000</p>
            </div>
          </div>

          {/* Helpful hint on what the AI will do */}
          <div className="rounded-xl border border-[#1D9CA1]/20 bg-[#1D9CA1]/5 p-3 text-[11px] text-slate-700">
            <p className="font-semibold text-[#1D9CA1]">
              <Sparkles className="mr-1 inline h-3 w-3 -translate-y-px" />
              What happens next
            </p>
            <p className="mt-1 text-slate-600">
              The AI reads your full site config, picks an appropriate layout (menu,
              team, pricing, etc.), writes page-specific copy in your brand voice,
              and references your image library by index. The page gets its own
              URL and nav link. You can edit everything after.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={generating}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={generating || brief.trim().length < 10}
            className="bg-[#1D9CA1] text-white hover:bg-[#158087]"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating page…
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                Generate page
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Brand Editor — colors, tone, hero style                            */
/* ------------------------------------------------------------------ */

function BrandEditor({
  config,
  onChange,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
}) {
  const brand = config.brand;

  const updateBrand = (patch: Partial<WebsiteConfig['brand']>) => {
    onChange({ ...config, brand: { ...brand, ...patch } });
  };

  /**
   * Helper that merges a partial patch into `config.contact` and preserves
   * every other field. Lets the form below write short, readable
   * `updateContact({ phone: ... })` calls instead of repeating the whole
   * 10-field object on every keystroke.
   */
  const updateContact = (patch: Partial<WebsiteConfig['contact']>) => {
    const prev = config.contact ?? {
      heading: 'Get in touch',
      body: '',
      showBookingForm: true,
      showHours: false,
    };
    onChange({
      ...config,
      contact: { ...prev, ...patch },
    });
  };

  /**
   * Partial patch into `config.announcement`. When the current
   * announcement is undefined, `patch` seeds the first version with
   * sensible defaults so callers don't have to think about it.
   */
  const updateAnnouncement = (
    patch: Partial<NonNullable<WebsiteConfig['announcement']>>,
  ) => {
    const prev = config.announcement ?? { message: '', tone: 'brand' as const };
    onChange({
      ...config,
      announcement: { ...prev, ...patch },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-600">Colors</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <ColorField
            label="Primary"
            value={brand.primaryColor}
            onChange={(v) => updateBrand({ primaryColor: v })}
          />
          <ColorField
            label="Accent"
            value={brand.accentColor}
            onChange={(v) => updateBrand({ accentColor: v })}
          />
          <ColorField
            label="Pop / highlight"
            value={brand.popColor ?? '#FFEC3D'}
            onChange={(v) => updateBrand({ popColor: v })}
          />
          <ColorField
            label="Dark / footer"
            value={brand.darkColor ?? '#0B1220'}
            onChange={(v) => updateBrand({ darkColor: v })}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">Tagline</p>
        <Input
          className="mt-1"
          value={brand.tagline}
          onChange={(e) => updateBrand({ tagline: e.target.value })}
          placeholder="Good work, done well."
        />
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">Tone</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(['warm', 'professional', 'playful', 'premium'] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateBrand({ tone: t })}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all ${
                brand.tone === t
                  ? 'border-[#1D9CA1] bg-[#1D9CA1]/10 text-[#1D9CA1]'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">Logo URL</p>
        <Input
          className="mt-1"
          value={brand.logoUrl ?? ''}
          onChange={(e) => updateBrand({ logoUrl: e.target.value || undefined })}
          placeholder="https://.../logo.svg"
        />
        <p className="mt-1 text-[10px] text-slate-400">
          Paste a direct image URL (SVG preferred). Leave blank to show the
          business initial in a colored circle as the nav logo. Tip: you can
          also upload a logo via the Images tab, then reference its index in
          Code view via <code>brand.logoIndex</code>.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">Hero style</p>
        <div className="mt-1.5 flex gap-2">
          {(['light', 'dark'] as const).map((s) => (
            <button
              key={s}
              onClick={() => updateBrand({ heroStyle: s })}
              className={`flex-1 rounded-xl border py-2 text-xs font-semibold capitalize transition-all ${
                brand.heroStyle === s
                  ? s === 'dark'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-[#1D9CA1] bg-[#1D9CA1]/10 text-[#1D9CA1]'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* SEO meta — what shows in the browser tab + Google search result. */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-medium text-slate-600">
          SEO &amp; sharing
          <span className="ml-2 font-normal text-slate-400">
            what search engines see
          </span>
        </p>
        <div className="mt-2 space-y-2">
          <LabelledField label="Page title" hint="≤60 chars">
            <Input
              value={config.meta?.title ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  meta: {
                    title: e.target.value,
                    description: config.meta?.description ?? '',
                    keywords: config.meta?.keywords ?? [],
                  },
                })
              }
              placeholder="Murphy's Plumbing — Dublin 2"
              maxLength={80}
            />
          </LabelledField>
          <LabelledField label="Meta description" hint="≤160 chars">
            <Textarea
              value={config.meta?.description ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  meta: {
                    title: config.meta?.title ?? '',
                    description: e.target.value,
                    keywords: config.meta?.keywords ?? [],
                  },
                })
              }
              placeholder="What your business does, in one sentence. This shows up under the page title in Google."
              rows={2}
              maxLength={200}
            />
          </LabelledField>
          <TagListField
            label="Keywords"
            tags={config.meta?.keywords ?? []}
            max={10}
            placeholder="Add and press Enter"
            onChange={(keywords) =>
              onChange({
                ...config,
                meta: {
                  title: config.meta?.title ?? '',
                  description: config.meta?.description ?? '',
                  keywords,
                },
              })
            }
          />
        </div>
      </div>

      {/* Navigation items */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-medium text-slate-600">Navigation links</p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          {(config.pages?.length ?? 0) > 1
            ? 'Multipage sites use page titles for the nav (edit them in the Pages tab).'
            : 'Shown in the top nav bar. Each label becomes an anchor link to the matching section.'}
        </p>
        <div className="mt-2">
          <TagListField
            label="Nav items"
            tags={config.navigation ?? []}
            max={8}
            placeholder="Home, Services, About…"
            onChange={(navigation) => onChange({ ...config, navigation })}
          />
        </div>
      </div>

      {/* Social links */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-medium text-slate-600">Social links</p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          Rendered in the footer and (when set) on the contact block.
        </p>
        <div className="mt-2 space-y-2">
          {(
            [
              { key: 'facebook', label: 'Facebook' },
              { key: 'instagram', label: 'Instagram' },
              { key: 'tiktok', label: 'TikTok' },
              { key: 'linkedin', label: 'LinkedIn' },
              { key: 'x', label: 'X / Twitter' },
              { key: 'youtube', label: 'YouTube' },
              { key: 'google', label: 'Google Business Profile' },
            ] as const
          ).map(({ key, label }) => (
            <LabelledField key={key} label={label}>
              <Input
                type="url"
                value={(config.socials as Record<string, string | undefined> | undefined)?.[key] ?? ''}
                onChange={(e) => {
                  const next = { ...(config.socials ?? {}) } as Record<string, string | undefined>;
                  const v = e.target.value.trim();
                  if (v) next[key] = v;
                  else delete next[key];
                  onChange({
                    ...config,
                    socials: Object.keys(next).length > 0 ? (next as WebsiteConfig['socials']) : undefined,
                  });
                }}
                placeholder="https://…"
                maxLength={500}
              />
            </LabelledField>
          ))}
        </div>
      </div>

      {/* Contact info */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-medium text-slate-600">Contact info</p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          Used in the contact section, footer, and mobile CTA bar.
        </p>
        <div className="mt-2 space-y-2">
          <LabelledField label="Heading">
            <Input
              value={config.contact?.heading ?? ''}
              onChange={(e) => updateContact({ heading: e.target.value })}
              placeholder="Get in touch"
              maxLength={100}
            />
          </LabelledField>
          <LabelledField label="Body">
            <Textarea
              value={config.contact?.body ?? ''}
              onChange={(e) => updateContact({ body: e.target.value })}
              placeholder="Drop us a line, we usually respond within a few hours."
              rows={2}
              maxLength={400}
            />
          </LabelledField>
          <FieldGrid>
            <LabelledField label="Phone">
              <Input
                type="tel"
                value={config.contact?.phone ?? ''}
                onChange={(e) =>
                  updateContact({ phone: e.target.value || undefined })
                }
                placeholder="+353 1 555 0100"
                maxLength={50}
              />
            </LabelledField>
            <LabelledField label="WhatsApp">
              <Input
                type="tel"
                value={config.contact?.whatsapp ?? ''}
                onChange={(e) =>
                  updateContact({ whatsapp: e.target.value || undefined })
                }
                placeholder="+353851234567"
                maxLength={50}
              />
            </LabelledField>
          </FieldGrid>
          <LabelledField label="Email">
            <Input
              type="email"
              value={config.contact?.email ?? ''}
              onChange={(e) =>
                updateContact({ email: e.target.value || undefined })
              }
              placeholder="hello@business.com"
              maxLength={200}
            />
          </LabelledField>
          <LabelledField label="Address">
            <Input
              value={config.contact?.address ?? ''}
              onChange={(e) =>
                updateContact({ address: e.target.value || undefined })
              }
              placeholder="12 Market Street, Dublin 2"
              maxLength={300}
            />
          </LabelledField>
          <LabelledField label="Opening hours" hint="one line per day">
            <Textarea
              value={config.contact?.hours ?? ''}
              onChange={(e) =>
                updateContact({ hours: e.target.value || undefined })
              }
              placeholder={'Mon–Fri 9am–6pm\nSat 10am–3pm'}
              rows={3}
              maxLength={500}
            />
          </LabelledField>
          <FieldGrid>
            <label className="flex items-center gap-2 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={config.contact?.showBookingForm ?? true}
                onChange={(e) =>
                  updateContact({ showBookingForm: e.target.checked })
                }
                className="rounded border-slate-300 text-[#1D9CA1] focus:ring-[#1D9CA1]"
              />
              Show booking form
            </label>
            <label className="flex items-center gap-2 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={config.contact?.showHours ?? false}
                onChange={(e) =>
                  updateContact({ showHours: e.target.checked })
                }
                className="rounded border-slate-300 text-[#1D9CA1] focus:ring-[#1D9CA1]"
              />
              Show hours
            </label>
          </FieldGrid>
        </div>
      </div>

      {/* Announcement bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-600">
            Announcement bar
            {config.announcement ? (
              <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                On
              </span>
            ) : (
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                Off
              </span>
            )}
          </p>
          {config.announcement ? (
            <button
              type="button"
              onClick={() => onChange({ ...config, announcement: undefined })}
              className="text-[10px] font-medium text-slate-500 hover:text-rose-600"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...config,
                  announcement: {
                    message: 'Limited-time offer — book before Friday.',
                    tone: 'brand',
                  },
                })
              }
              className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
            >
              Add banner
            </button>
          )}
        </div>
        {config.announcement ? (
          <div className="mt-2 space-y-2">
            <LabelledField label="Message">
              <Input
                value={config.announcement.message ?? ''}
                onChange={(e) => updateAnnouncement({ message: e.target.value })}
                placeholder="Short, one-line message"
                maxLength={200}
              />
            </LabelledField>
            <FieldGrid>
              <LabelledField label="CTA label (optional)">
                <Input
                  value={config.announcement.linkLabel ?? ''}
                  onChange={(e) =>
                    updateAnnouncement({
                      linkLabel: e.target.value || undefined,
                    })
                  }
                  placeholder="Book now"
                  maxLength={30}
                />
              </LabelledField>
              <LabelledField label="CTA link">
                <Input
                  value={config.announcement.linkHref ?? ''}
                  onChange={(e) =>
                    updateAnnouncement({
                      linkHref: e.target.value || undefined,
                    })
                  }
                  placeholder="#contact"
                  maxLength={300}
                />
              </LabelledField>
            </FieldGrid>
            <LabelledField label="Tone">
              <div className="flex gap-1.5">
                {(['brand', 'success', 'warning'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updateAnnouncement({ tone: t })}
                    className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium capitalize ${
                      (config.announcement!.tone ?? 'brand') === t
                        ? 'border-[#1D9CA1] bg-[#1D9CA1]/10 text-[#1D9CA1]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </LabelledField>
            <label className="flex items-center gap-2 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={config.announcement.nonDismissible ?? false}
                onChange={(e) =>
                  updateAnnouncement({ nonDismissible: e.target.checked })
                }
                className="rounded border-slate-300 text-[#1D9CA1] focus:ring-[#1D9CA1]"
              />
              Hide the dismiss button (use for critical notices only)
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded-lg border border-slate-200"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 flex-1 font-mono text-xs"
          maxLength={7}
        />
      </div>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* AI Chat Editor — natural language config modifications             */
/* ------------------------------------------------------------------ */

/**
 * Compact model picker for the AI chat surfaces. Shows the current
 * model as a pill with a dropdown of alternatives — same component
 * reused by the Chat tab and the Illustration editor's Ask-AI box.
 *
 * Closes on outside click, shows cost + speed metadata inside each
 * menu item so agencies pick the right model for the job without
 * needing to know the Anthropic API tier names.
 */
function ModelPicker({
  value,
  onChange,
  align = 'right',
}: {
  value: AiModelKey;
  onChange: (next: AiModelKey) => void;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = AI_MODELS.find((m) => m.key === value) ?? AI_MODELS[0]!;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
        title={`Model: ${active.label} — ${active.blurb}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1D9CA1]" />
        {active.label}
        <ChevronDown
          className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute top-full z-20 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {AI_MODELS.map((m) => (
            <button
              key={m.key}
              type="button"
              role="menuitemradio"
              aria-checked={value === m.key}
              onClick={() => {
                onChange(m.key);
                setOpen(false);
              }}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                value === m.key ? 'bg-[#1D9CA1]/5' : 'hover:bg-slate-50'
              }`}
            >
              <div className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300 bg-white">
                {value === m.key ? (
                  <span className="block h-full w-full rounded-full border-2 border-white bg-[#1D9CA1]" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900">
                    {m.label}
                  </span>
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-500">
                    {m.cost}
                  </span>
                  <span className="text-[9px] font-medium text-slate-500">
                    {m.speed}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">
                  {m.blurb}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AIChatEditor({
  config,
  onChange,
  clientId,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  clientId: string;
}) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  // Model picker — defaults to Sonnet for edits. Persisted in
  // localStorage so the choice sticks across reloads.
  const [model, setModel] = useState<AiModelKey>(() => {
    if (typeof window === 'undefined') return defaultModelFor('edit');
    const stored = window.localStorage.getItem('bmb:ai-editor-model');
    if (stored === 'opus' || stored === 'sonnet' || stored === 'haiku') {
      return stored;
    }
    return defaultModelFor('edit');
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('bmb:ai-editor-model', model);
  }, [model]);

  const send = useCallback(async () => {
    if (!message.trim() || loading) return;
    const userMsg = message.trim();
    setMessage('');
    setHistory((h) => [...h, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const result = await api.editWebsiteWithAI({
        clientId,
        currentConfig: config,
        instruction: userMsg,
        model,
      });
      onChange(result.config);
      setHistory((h) => [
        ...h,
        { role: 'ai', text: result.summary ?? 'Done — config updated.' },
      ]);
      toast.success('Site updated');
    } catch (e) {
      setHistory((h) => [
        ...h,
        { role: 'ai', text: `Error: ${(e as Error).message}` },
      ]);
      toast.error('AI edit failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [message, loading, config, onChange, clientId, model]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Tell the AI what to change. It can modify copy, colors, sections, hero style — anything.
        </p>
        <ModelPicker value={model} onChange={setModel} />
      </div>

      {/* Chat history */}
      {history.length > 0 && (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
          {history.map((msg, i) => (
            <div
              key={i}
              className={`text-xs ${
                msg.role === 'user'
                  ? 'text-right text-slate-700'
                  : 'text-left text-[#1D9CA1]'
              }`}
            >
              <span
                className={`inline-block rounded-xl px-3 py-1.5 ${
                  msg.role === 'user'
                    ? 'bg-slate-200 text-slate-800'
                    : 'bg-[#1D9CA1]/10 text-[#1D9CA1]'
                }`}
              >
                {msg.text}
              </span>
            </div>
          ))}
          {loading && (
            <div className="text-left">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D9CA1]/10 px-3 py-1.5 text-xs text-[#1D9CA1]">
                <Spinner size={12} /> Thinking...
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder='e.g. "Switch hero to beams variant" or "Make it more premium and dark"'
          rows={2}
          className="flex-1 text-xs no-zoom"
        />
        <Button
          onClick={send}
          disabled={!message.trim() || loading}
          className="shrink-0 self-end"
        >
          {loading ? <Spinner size={14} /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          'Make it dark premium',
          'Switch to beams hero',
          'Rewrite headline, punchier',
          'Change primary color to navy',
          'Add more testimonials',
          'Use gradient-mesh hero',
        ].map((s) => (
          <button
            key={s}
            onClick={() => setMessage(s)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] text-slate-600 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Domain Editor — custom domain setup                                */
/* ------------------------------------------------------------------ */

function DomainEditor({ clientId }: { clientId: string }) {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<Awaited<ReturnType<typeof api.getDomain>> | null>(
    null,
  );

  // Load current domain on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await api.getDomain(clientId);
        if (cancelled) return;
        setCurrent(c);
        if (c?.customDomain) setDomain(c.customDomain);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const attach = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    try {
      const result = await api.attachDomain(clientId, domain.trim());
      toast.success('Domain attached', 'Follow the DNS instructions below.');
      setCurrent({
        clientId: result.clientId,
        customDomain: result.customDomain,
        status: result.status,
        error: null,
        verifiedAt: null,
        verification: result.verification,
      });
    } catch (e) {
      toast.error('Attach failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    try {
      const result = await api.verifyDomain(clientId);
      if (result.status === 'verified') {
        toast.success('Domain verified', 'Your site is live on the custom domain.');
      } else {
        toast.info('Still provisioning', 'DNS changes can take a few minutes.');
      }
      const c = await api.getDomain(clientId);
      setCurrent(c);
    } catch (e) {
      toast.error('Verify failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const detach = async () => {
    if (
      !(await confirmDialog({
        title: 'Remove this custom domain?',
        description:
          'The site will go back to the default /sites/ URL. The client can reattach it later.',
        confirmLabel: 'Remove domain',
        danger: true,
      }))
    )
      return;
    setLoading(true);
    try {
      await api.detachDomain(clientId);
      toast.success('Domain removed');
      setCurrent(null);
      setDomain('');
    } catch (e) {
      toast.error('Remove failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const statusTone =
    current?.status === 'verified'
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : current?.status === 'failed'
        ? 'text-rose-600 bg-rose-50 border-rose-200'
        : 'text-amber-600 bg-amber-50 border-amber-200';

  return (
    <div className="space-y-4">
      {/* Step-by-step guide — shown before a domain is attached. Once the
          domain is in place we replace this with the status card + DNS
          records, so the steps don't clutter the verified view. */}
      {!current?.customDomain ? (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-900">
              Connecting a custom domain — how it works
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Already bought a domain at GoDaddy, Namecheap, Cloudflare, or similar? Four steps:
            </p>
          </div>

          <ol className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <DomainStep
              n={1}
              title="Type the domain below"
              detail={
                <>
                  Enter it without <code className="text-[10px]">www.</code> or{' '}
                  <code className="text-[10px]">https://</code> —
                  e.g. <code className="text-[10px]">murphysplumbing.com</code>.
                  Click <strong>Attach domain</strong>.
                </>
              }
            />
            <DomainStep
              n={2}
              title="We'll show the DNS record to set"
              detail={
                <>
                  After attach, this panel updates with the exact record to copy. Every registrar
                  calls it something like <strong>DNS Management</strong> or <strong>DNS Zone</strong>.
                </>
              }
            />
            <DomainStep
              n={3}
              title="Set the record at the registrar"
              detail={
                <>
                  Log in to GoDaddy / Namecheap / Cloudflare, find DNS, add the record we show.
                  Takes 2 minutes. If the client owns the domain, paste them the record
                  from the panel — they can do it too.
                </>
              }
            />
            <DomainStep
              n={4}
              title="Wait 1–10 minutes, then verify"
              detail={
                <>
                  DNS takes a few minutes to propagate. Come back and click{' '}
                  <strong>Check verification</strong>. Once green, the site is live on the custom
                  domain with HTTPS set up automatically.
                </>
              }
            />
          </ol>

          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <strong>Registrar shortcuts:</strong>{' '}
            <a
              href="https://dcc.godaddy.com/control/portfolio"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-amber-900"
            >
              GoDaddy
            </a>
            {' · '}
            <a
              href="https://www.namecheap.com/myaccount/login/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-amber-900"
            >
              Namecheap
            </a>
            {' · '}
            <a
              href="https://dash.cloudflare.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-amber-900"
            >
              Cloudflare
            </a>
          </div>

          <div className="space-y-2">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="murphysplumbing.com"
              className="text-sm"
              maxLength={253}
            />
            <Button
              onClick={attach}
              disabled={!domain.trim() || loading}
              className="w-full"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
              Attach domain
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`flex items-center justify-between rounded-xl border px-3 py-2 ${statusTone}`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              {current.status === 'verified' ? (
                <Check className="h-3.5 w-3.5" />
              ) : current.status === 'failed' ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <span className="capitalize">{current.status ?? 'unknown'}</span>
              <span className="font-mono">{current.customDomain}</span>
            </div>
            <a
              href={`https://${current.customDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-current opacity-70 hover:opacity-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {current.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <p className="font-semibold">Error</p>
              <p className="mt-1">{current.error}</p>
            </div>
          ) : null}

          {current.verification?.requiredRecords?.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-900">
                Ask the client to add this DNS record:
              </p>
              <div className="mt-2 space-y-2">
                {current.verification.requiredRecords.map((r, i) => (
                  <DnsRecordRow key={i} record={r} />
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Registrar dashboards (GoDaddy, Namecheap, Cloudflare etc.) all have a &quot;DNS&quot;
                or &quot;DNS management&quot; section. Add the record, wait 1–10 minutes, then click
                &quot;Check verification&quot; below.
              </p>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={verify} disabled={loading}>
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Check verification
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={detach}
              disabled={loading}
              className="text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DnsRecordRow({
  record,
}: {
  record: { type: string; name: string; value: string };
}) {
  const [copied, setCopied] = useState<'name' | 'value' | null>(null);
  const copy = (v: string, which: 'name' | 'value') => {
    navigator.clipboard.writeText(v);
    setCopied(which);
    setTimeout(() => setCopied(null), 1200);
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-[11px]">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {record.type}
        </span>
        <span className="font-semibold uppercase tracking-wider text-slate-500">
          Add this record
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[60px_1fr_auto] items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">Name</span>
        <code className="truncate rounded bg-slate-50 px-2 py-1 font-mono text-slate-800" title={record.name}>
          {record.name}
        </code>
        <button
          onClick={() => copy(record.name, 'name')}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Copy name"
        >
          {copied === 'name' ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <div className="mt-1 grid grid-cols-[60px_1fr_auto] items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">Value</span>
        <code
          className="truncate rounded bg-slate-50 px-2 py-1 font-mono text-slate-800"
          title={record.value}
        >
          {record.value}
        </code>
        <button
          onClick={() => copy(record.value, 'value')}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Copy value"
        >
          {copied === 'value' ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Items Editor — add/remove services, reviews, FAQ, stats, bullets    */
/* ------------------------------------------------------------------ */

const AVAILABLE_ICONS = [
  'Sparkles', 'Wrench', 'Hammer', 'Coffee', 'Utensils', 'Leaf', 'Scissors',
  'HeartPulse', 'Dumbbell', 'Phone', 'Calendar', 'Globe', 'Camera',
  'MessageCircle', 'Star', 'CheckCircle2', 'Zap', 'Truck', 'Home', 'Shield',
  'Brush', 'Sun', 'Flame', 'Award', 'Users',
];

/**
 * Collection editor for everything that's an array in the config:
 * services, reviews, FAQ entries, stats, about bullets, menu
 * categories / items, price list, team members, schedule entries,
 * service areas, trust badges, before/after, custom sections, products,
 * portfolio, process, pricing tiers, logo strip.
 *
 * Each row is independently expandable. Collapsed view shows a summary;
 * expanded view reveals full inline field editing (no need to click
 * into the preview unless you prefer to). Supports reorder up/down,
 * feature toggle where the data model allows, and delete.
 */
function ItemsEditor({
  config,
  onChange,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
}) {
  const services = config.services ?? [];
  const reviews = config.reviews ?? [];
  const faq = config.faq ?? [];
  const stats = config.stats ?? [];
  const bullets = config.about?.bullets ?? [];

  /** Helper to patch a single service at an index. */
  const patchService = (
    i: number,
    patch: Partial<NonNullable<WebsiteConfig['services']>[number]>,
  ) => {
    const next = [...services];
    next[i] = { ...next[i]!, ...patch };
    onChange({ ...config, services: next });
  };

  /** Swap two services by index — powers the up/down reorder buttons. */
  const moveService = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= services.length) return;
    const next = [...services];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange({ ...config, services: next });
  };

  const patchReview = (
    i: number,
    patch: Partial<NonNullable<WebsiteConfig['reviews']>[number]>,
  ) => {
    const next = [...reviews];
    next[i] = { ...next[i]!, ...patch };
    onChange({ ...config, reviews: next });
  };
  const moveReview = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= reviews.length) return;
    const next = [...reviews];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange({ ...config, reviews: next });
  };

  const patchFaq = (i: number, patch: Partial<NonNullable<WebsiteConfig['faq']>[number]>) => {
    const next = [...faq];
    next[i] = { ...next[i]!, ...patch };
    onChange({ ...config, faq: next });
  };
  const moveFaq = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= faq.length) return;
    const next = [...faq];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange({ ...config, faq: next });
  };

  const patchStat = (
    i: number,
    patch: Partial<NonNullable<WebsiteConfig['stats']>[number]>,
  ) => {
    const next = [...stats];
    next[i] = { ...next[i]!, ...patch };
    onChange({ ...config, stats: next });
  };
  const moveStat = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stats.length) return;
    const next = [...stats];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange({ ...config, stats: next });
  };

  const patchBullet = (i: number, text: string) => {
    const next = [...bullets];
    next[i] = text;
    onChange({
      ...config,
      about: { ...config.about!, bullets: next },
    });
  };
  const moveBullet = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= bullets.length) return;
    const next = [...bullets];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange({ ...config, about: { ...config.about!, bullets: next } });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Click a row to expand and edit its fields directly. You can also click any
        text in the preview to edit it in place.
      </p>

      {/* Services */}
      <ArrayBlock
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Services"
        count={services.length}
        onAdd={() =>
          onChange({
            ...config,
            services: [
              ...services,
              { title: 'New service', description: 'What this service does.', icon: 'Sparkles' },
            ],
          })
        }
        addLabel="Add service"
        emptyHint="No services yet. Add one to show up in the grid."
      >
        {services.map((s, i) => (
          <ExpandableItemRow
            key={`svc-${i}`}
            summary={s.title || `Service ${i + 1}`}
            summarySecondary={s.description}
            featured={s.featured ?? false}
            onToggleFeatured={() => patchService(i, { featured: !s.featured })}
            onMoveUp={i > 0 ? () => moveService(i, -1) : undefined}
            onMoveDown={i < services.length - 1 ? () => moveService(i, 1) : undefined}
            onRemove={async () => {
              if (
                !(await confirmDialog({
                  title: `Delete "${s.title || `Service ${i + 1}`}"?`,
                  description: 'This removes it from the site.',
                  confirmLabel: 'Delete',
                  danger: true,
                }))
              )
                return;
              onChange({
                ...config,
                services: services.filter((_, j) => j !== i),
              });
            }}
          >
            <LabelledField label="Title">
              <Input
                value={s.title ?? ''}
                onChange={(e) => patchService(i, { title: e.target.value })}
                placeholder="Service title"
                maxLength={80}
              />
            </LabelledField>
            <LabelledField label="Description">
              <Textarea
                value={s.description ?? ''}
                onChange={(e) => patchService(i, { description: e.target.value })}
                placeholder="One or two sentences"
                rows={2}
                maxLength={300}
              />
            </LabelledField>
            <LabelledField label="Icon">
              <select
                value={s.icon ?? 'Sparkles'}
                onChange={(e) => patchService(i, { icon: e.target.value })}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
              >
                {AVAILABLE_ICONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </LabelledField>
          </ExpandableItemRow>
        ))}
      </ArrayBlock>

      {/* Reviews */}
      <ArrayBlock
        icon={<MessageSquare className="h-3.5 w-3.5" />}
        label="Reviews"
        count={reviews.length}
        onAdd={() =>
          onChange({
            ...config,
            reviews: [
              ...reviews,
              { text: 'What a great experience.', author: 'New customer', rating: 5 },
            ],
          })
        }
        addLabel="Add review"
        emptyHint="No reviews yet. Add a testimonial or two."
      >
        {reviews.map((r, i) => (
          <ExpandableItemRow
            key={`rev-${i}`}
            summary={`"${(r.text ?? '').slice(0, 60)}${(r.text ?? '').length > 60 ? '…' : ''}"`}
            summarySecondary={`— ${r.author ?? 'Anonymous'} · ${'★'.repeat(Math.max(1, Math.min(5, Math.round(r.rating ?? 5))))}`}
            featured={r.featured ?? false}
            onToggleFeatured={() => patchReview(i, { featured: !r.featured })}
            onMoveUp={i > 0 ? () => moveReview(i, -1) : undefined}
            onMoveDown={i < reviews.length - 1 ? () => moveReview(i, 1) : undefined}
            onRemove={async () => {
              if (
                !(await confirmDialog({
                  title: `Delete this review?`,
                  description: `From ${r.author || 'unknown'}.`,
                  confirmLabel: 'Delete',
                  danger: true,
                }))
              )
                return;
              onChange({ ...config, reviews: reviews.filter((_, j) => j !== i) });
            }}
          >
            <LabelledField label="Review text">
              <Textarea
                value={r.text ?? ''}
                onChange={(e) => patchReview(i, { text: e.target.value })}
                placeholder="What the customer said"
                rows={3}
                maxLength={500}
              />
            </LabelledField>
            <FieldGrid>
              <LabelledField label="Author">
                <Input
                  value={r.author ?? ''}
                  onChange={(e) => patchReview(i, { author: e.target.value })}
                  placeholder="Aoife K."
                  maxLength={60}
                />
              </LabelledField>
              <LabelledField label="Rating">
                <select
                  value={r.rating ?? 5}
                  onChange={(e) => patchReview(i, { rating: Number(e.target.value) })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
              </LabelledField>
            </FieldGrid>
          </ExpandableItemRow>
        ))}
      </ArrayBlock>

      {/* FAQ */}
      <ArrayBlock
        icon={<HelpCircle className="h-3.5 w-3.5" />}
        label="FAQ"
        count={faq.length}
        onAdd={() =>
          onChange({
            ...config,
            faq: [
              ...faq,
              { question: 'New question?', answer: 'Short, direct answer.' },
            ],
          })
        }
        addLabel="Add question"
        emptyHint="No FAQs yet."
      >
        {faq.map((f, i) => (
          <ExpandableItemRow
            key={`faq-${i}`}
            summary={f.question || `Question ${i + 1}`}
            summarySecondary={
              (f.answer ?? '').slice(0, 80) + ((f.answer ?? '').length > 80 ? '…' : '')
            }
            onMoveUp={i > 0 ? () => moveFaq(i, -1) : undefined}
            onMoveDown={i < faq.length - 1 ? () => moveFaq(i, 1) : undefined}
            onRemove={async () => {
              if (
                !(await confirmDialog({
                  title: `Delete this FAQ?`,
                  description: f.question,
                  confirmLabel: 'Delete',
                  danger: true,
                }))
              )
                return;
              onChange({ ...config, faq: faq.filter((_, j) => j !== i) });
            }}
          >
            <LabelledField label="Question">
              <Input
                value={f.question ?? ''}
                onChange={(e) => patchFaq(i, { question: e.target.value })}
                placeholder="What customers ask"
                maxLength={200}
              />
            </LabelledField>
            <LabelledField label="Answer">
              <Textarea
                value={f.answer ?? ''}
                onChange={(e) => patchFaq(i, { answer: e.target.value })}
                placeholder="Short, honest answer"
                rows={3}
                maxLength={800}
              />
            </LabelledField>
          </ExpandableItemRow>
        ))}
      </ArrayBlock>

      {/* Stats */}
      <ArrayBlock
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        label="Stats"
        count={stats.length}
        onAdd={() => {
          if (stats.length >= 4) {
            toast.info('Max 4 stats', 'Remove one first.');
            return;
          }
          onChange({
            ...config,
            stats: [
              ...stats,
              { value: 0, suffix: '+', label: 'Metric' },
            ],
          });
        }}
        addLabel="Add stat"
        emptyHint="No stats yet. Add a metric like '500+ happy customers'."
      >
        {stats.map((s, i) => (
          <ExpandableItemRow
            key={`stat-${i}`}
            summary={`${s.prefix ?? ''}${s.value}${s.suffix ?? ''}`}
            summarySecondary={s.label}
            onMoveUp={i > 0 ? () => moveStat(i, -1) : undefined}
            onMoveDown={i < stats.length - 1 ? () => moveStat(i, 1) : undefined}
            onRemove={() => {
              onChange({ ...config, stats: stats.filter((_, j) => j !== i) });
            }}
          >
            <FieldGrid>
              <LabelledField label="Prefix" hint="€ / $ / £">
                <Input
                  value={s.prefix ?? ''}
                  onChange={(e) => patchStat(i, { prefix: e.target.value })}
                  placeholder=""
                  maxLength={4}
                />
              </LabelledField>
              <LabelledField label="Value" hint="number">
                <Input
                  type="number"
                  step="any"
                  value={Number.isFinite(s.value) ? s.value : 0}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    patchStat(i, {
                      value: Number.isFinite(n) ? n : 0,
                    });
                  }}
                  placeholder="0"
                />
              </LabelledField>
            </FieldGrid>
            <FieldGrid>
              <LabelledField label="Suffix" hint="+ / % / yrs">
                <Input
                  value={s.suffix ?? ''}
                  onChange={(e) => patchStat(i, { suffix: e.target.value })}
                  placeholder="+"
                  maxLength={8}
                />
              </LabelledField>
              <LabelledField label="Label">
                <Input
                  value={s.label ?? ''}
                  onChange={(e) => patchStat(i, { label: e.target.value })}
                  placeholder="Happy customers"
                  maxLength={60}
                />
              </LabelledField>
            </FieldGrid>
          </ExpandableItemRow>
        ))}
      </ArrayBlock>

      {/* About bullets */}
      {config.about ? (
        <ArrayBlock
          icon={<Check className="h-3.5 w-3.5" />}
          label="About bullets"
          count={bullets.length}
          onAdd={() =>
            onChange({
              ...config,
              about: {
                ...config.about!,
                bullets: [...bullets, 'New proof point'],
              },
            })
          }
          addLabel="Add bullet"
          emptyHint="No bullets in About yet. Add some quick proof points."
        >
          {bullets.map((b, i) => (
            <ExpandableItemRow
              key={`bullet-${i}`}
              summary={b || `Bullet ${i + 1}`}
              onMoveUp={i > 0 ? () => moveBullet(i, -1) : undefined}
              onMoveDown={i < bullets.length - 1 ? () => moveBullet(i, 1) : undefined}
              onRemove={() => {
                onChange({
                  ...config,
                  about: {
                    ...config.about!,
                    bullets: bullets.filter((_, j) => j !== i),
                  },
                });
              }}
            >
              <LabelledField label="Bullet text">
                <Input
                  value={b ?? ''}
                  onChange={(e) => patchBullet(i, e.target.value)}
                  placeholder="A short proof point"
                  maxLength={120}
                />
              </LabelledField>
            </ExpandableItemRow>
          ))}
        </ArrayBlock>
      ) : null}

      {/* ── Industry blocks below ─────────────────────────────────── */}

      {/* Menu (categorised items for cafes/restaurants) */}
      {config.menu ? (
        <ArrayBlock
          icon={<Coffee className="h-3.5 w-3.5" />}
          label="Menu categories"
          count={config.menu.categories?.length ?? 0}
          onAdd={() => {
            const cats = config.menu!.categories ?? [];
            onChange({
              ...config,
              menu: {
                ...config.menu!,
                categories: [
                  ...cats,
                  { title: 'New section', items: [{ name: 'Item', price: '0' }] },
                ],
              },
            });
          }}
          addLabel="Add category"
          emptyHint="No menu categories yet."
        >
          <LabelledField label="Currency" hint="€ / $ / £">
            <Input
              value={config.menu.currency ?? '€'}
              onChange={(e) =>
                onChange({
                  ...config,
                  menu: { ...config.menu!, currency: e.target.value.slice(0, 4) },
                })
              }
              maxLength={4}
              className="max-w-[80px]"
            />
          </LabelledField>
          {(config.menu.categories ?? []).map((cat, i) => {
            const updateCategory = (
              patch: Partial<NonNullable<NonNullable<WebsiteConfig['menu']>['categories']>[number]>,
            ) => {
              const cats = [...(config.menu!.categories ?? [])];
              cats[i] = { ...cats[i]!, ...patch };
              onChange({ ...config, menu: { ...config.menu!, categories: cats } });
            };
            const moveCategory = (dir: -1 | 1) => {
              const cats = [...(config.menu!.categories ?? [])];
              const j = i + dir;
              if (j < 0 || j >= cats.length) return;
              [cats[i], cats[j]] = [cats[j]!, cats[i]!];
              onChange({ ...config, menu: { ...config.menu!, categories: cats } });
            };
            return (
              <ExpandableItemRow
                key={`menu-cat-${i}`}
                summary={cat.title || `Section ${i + 1}`}
                summarySecondary={`${cat.items?.length ?? 0} item${
                  cat.items?.length === 1 ? '' : 's'
                }`}
                onMoveUp={
                  i > 0 ? () => moveCategory(-1) : undefined
                }
                onMoveDown={
                  i < (config.menu!.categories?.length ?? 0) - 1
                    ? () => moveCategory(1)
                    : undefined
                }
                onRemove={async () => {
                  if (
                    !(await confirmDialog({
                      title: `Delete "${cat.title}"?`,
                      description: `Removes ${cat.items?.length ?? 0} items.`,
                      confirmLabel: 'Delete',
                      danger: true,
                    }))
                  )
                    return;
                  onChange({
                    ...config,
                    menu: {
                      ...config.menu!,
                      categories: (config.menu!.categories ?? []).filter((_, j) => j !== i),
                    },
                  });
                }}
              >
                <LabelledField label="Category title">
                  <Input
                    value={cat.title ?? ''}
                    onChange={(e) => updateCategory({ title: e.target.value })}
                    placeholder="e.g. Coffee, Mains, Drinks"
                    maxLength={60}
                  />
                </LabelledField>
                <LabelledField label="Short description (optional)">
                  <Input
                    value={cat.description ?? ''}
                    onChange={(e) => updateCategory({ description: e.target.value })}
                    placeholder="Blurb shown under the category title"
                    maxLength={200}
                  />
                </LabelledField>

                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Items · {cat.items?.length ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        updateCategory({
                          items: [
                            ...(cat.items ?? []),
                            { name: 'New item', price: '0' },
                          ],
                        });
                      }}
                      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#1D9CA1] hover:underline"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Add item
                    </button>
                  </div>
                  <div className="space-y-1">
                    {(cat.items ?? []).map((item, ii) => {
                      const updateItem = (
                        patch: Partial<
                          NonNullable<
                            NonNullable<
                              NonNullable<WebsiteConfig['menu']>['categories']
                            >[number]['items']
                          >[number]
                        >,
                      ) => {
                        const items = [...(cat.items ?? [])];
                        items[ii] = { ...items[ii]!, ...patch };
                        updateCategory({ items });
                      };
                      return (
                        <ExpandableItemRow
                          key={`menu-item-${i}-${ii}`}
                          summary={item.name || `Item ${ii + 1}`}
                          summarySecondary={`${config.menu!.currency ?? '€'}${item.price ?? ''}${
                            item.tags?.length ? ` · ${item.tags.join(', ')}` : ''
                          }`}
                          featured={item.featured ?? false}
                          onToggleFeatured={() =>
                            updateItem({ featured: !item.featured })
                          }
                          onRemove={() => {
                            updateCategory({
                              items: (cat.items ?? []).filter((_, k) => k !== ii),
                            });
                          }}
                        >
                          <LabelledField label="Name">
                            <Input
                              value={item.name ?? ''}
                              onChange={(e) => updateItem({ name: e.target.value })}
                              placeholder="Flat white"
                              maxLength={80}
                            />
                          </LabelledField>
                          <LabelledField label="Description (optional)">
                            <Textarea
                              value={item.description ?? ''}
                              onChange={(e) => updateItem({ description: e.target.value })}
                              placeholder="Short description"
                              rows={2}
                              maxLength={200}
                            />
                          </LabelledField>
                          <LabelledField label="Price" hint="e.g. 4.50 or 'from 12'">
                            <Input
                              value={item.price ?? ''}
                              onChange={(e) => updateItem({ price: e.target.value })}
                              placeholder="4.50"
                              maxLength={20}
                            />
                          </LabelledField>
                          <TagListField
                            label="Dietary tags"
                            tags={item.tags ?? []}
                            max={4}
                            placeholder="V, VG, GF, DF"
                            onChange={(tags) => updateItem({ tags })}
                          />
                        </ExpandableItemRow>
                      );
                    })}
                  </div>
                </div>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Price list */}
      {config.priceList ? (
        <ArrayBlock
          icon={<List className="h-3.5 w-3.5" />}
          label="Price list"
          count={
            (config.priceList.groups?.reduce((n, g) => n + (g.items?.length ?? 0), 0) ?? 0) +
            (config.priceList.items?.length ?? 0)
          }
          onAdd={() => {
            // Add to flat `items` array. Groups are managed through AI/direct editing.
            onChange({
              ...config,
              priceList: {
                ...config.priceList!,
                items: [
                  ...(config.priceList!.items ?? []),
                  { name: 'New service', price: '0', duration: '30 min' },
                ],
              },
            });
          }}
          addLabel="Add service"
          emptyHint="No priced services yet."
        >
          <LabelledField label="Currency" hint="€ / $ / £">
            <Input
              value={config.priceList.currency ?? '€'}
              onChange={(e) =>
                onChange({
                  ...config,
                  priceList: { ...config.priceList!, currency: e.target.value.slice(0, 4) },
                })
              }
              maxLength={4}
              className="max-w-[80px]"
            />
          </LabelledField>
          {/* Grouped price list — Claude often generates these with
              category headings (Cuts, Colour, Beard). Each group has
              its own title + items, edited the same way as the flat
              list below. Shown only when at least one group exists. */}
          {(config.priceList.groups?.length ?? 0) === 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-1.5">
              <span className="text-[10px] text-slate-500">
                Flat list. Want categories like Cuts / Colour / Beard?
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange({
                    ...config,
                    priceList: {
                      ...config.priceList!,
                      groups: [{ title: 'New group', items: [] }],
                    },
                  });
                }}
                className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
              >
                <Plus className="h-2.5 w-2.5" />
                Add group
              </button>
            </div>
          ) : null}
          {(config.priceList.groups?.length ?? 0) > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Groups · {config.priceList.groups?.length ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...config,
                      priceList: {
                        ...config.priceList!,
                        groups: [
                          ...(config.priceList!.groups ?? []),
                          { title: 'New group', items: [] },
                        ],
                      },
                    });
                  }}
                  className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#1D9CA1] hover:underline"
                >
                  <Plus className="h-2.5 w-2.5" />
                  Add group
                </button>
              </div>
              <div className="space-y-1.5">
                {(config.priceList.groups ?? []).map((group, gi) => {
                  const updateGroup = (
                    patch: Partial<
                      NonNullable<
                        NonNullable<WebsiteConfig['priceList']>['groups']
                      >[number]
                    >,
                  ) => {
                    const groups = [...(config.priceList!.groups ?? [])];
                    groups[gi] = { ...groups[gi]!, ...patch };
                    onChange({
                      ...config,
                      priceList: { ...config.priceList!, groups },
                    });
                  };
                  const moveGroup = (dir: -1 | 1) => {
                    const groups = [...(config.priceList!.groups ?? [])];
                    const j = gi + dir;
                    if (j < 0 || j >= groups.length) return;
                    [groups[gi], groups[j]] = [groups[j]!, groups[gi]!];
                    onChange({
                      ...config,
                      priceList: { ...config.priceList!, groups },
                    });
                  };
                  return (
                    <ExpandableItemRow
                      key={`pl-group-${gi}`}
                      summary={group.title || `Group ${gi + 1}`}
                      summarySecondary={`${group.items?.length ?? 0} item${
                        group.items?.length === 1 ? '' : 's'
                      }`}
                      onMoveUp={gi > 0 ? () => moveGroup(-1) : undefined}
                      onMoveDown={
                        gi < (config.priceList!.groups?.length ?? 0) - 1
                          ? () => moveGroup(1)
                          : undefined
                      }
                      onRemove={async () => {
                        if (
                          !(await confirmDialog({
                            title: `Delete "${group.title}"?`,
                            description: `Removes ${group.items?.length ?? 0} items.`,
                            confirmLabel: 'Delete',
                            danger: true,
                          }))
                        )
                          return;
                        onChange({
                          ...config,
                          priceList: {
                            ...config.priceList!,
                            groups: (config.priceList!.groups ?? []).filter(
                              (_, j) => j !== gi,
                            ),
                          },
                        });
                      }}
                    >
                      <LabelledField label="Group title">
                        <Input
                          value={group.title ?? ''}
                          onChange={(e) => updateGroup({ title: e.target.value })}
                          placeholder="e.g. Cuts, Colour, Beard"
                          maxLength={60}
                        />
                      </LabelledField>
                      <div className="rounded-lg border border-slate-200 bg-white p-2">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                            Items · {group.items?.length ?? 0}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateGroup({
                                items: [
                                  ...(group.items ?? []),
                                  { name: 'New service', price: '0' },
                                ],
                              })
                            }
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#1D9CA1] hover:underline"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            Add item
                          </button>
                        </div>
                        <div className="space-y-1">
                          {(group.items ?? []).map((it, ii) => {
                            const updateItem = (
                              patch: Partial<typeof it>,
                            ) => {
                              const items = [...(group.items ?? [])];
                              items[ii] = { ...items[ii]!, ...patch };
                              updateGroup({ items });
                            };
                            return (
                              <ExpandableItemRow
                                key={`pl-group-${gi}-item-${ii}`}
                                summary={it.name || `Item ${ii + 1}`}
                                summarySecondary={`${
                                  config.priceList!.currency ?? '€'
                                }${it.price ?? '—'} · ${it.duration ?? ''}`}
                                featured={it.featured ?? false}
                                onToggleFeatured={() =>
                                  updateItem({ featured: !it.featured })
                                }
                                onRemove={() =>
                                  updateGroup({
                                    items: (group.items ?? []).filter(
                                      (_, k) => k !== ii,
                                    ),
                                  })
                                }
                              >
                                <LabelledField label="Service name">
                                  <Input
                                    value={it.name ?? ''}
                                    onChange={(e) =>
                                      updateItem({ name: e.target.value })
                                    }
                                    maxLength={80}
                                  />
                                </LabelledField>
                                <FieldGrid>
                                  <LabelledField label="Price">
                                    <Input
                                      value={it.price ?? ''}
                                      onChange={(e) =>
                                        updateItem({ price: e.target.value })
                                      }
                                      placeholder="25"
                                      maxLength={20}
                                    />
                                  </LabelledField>
                                  <LabelledField label="Duration">
                                    <Input
                                      value={it.duration ?? ''}
                                      onChange={(e) =>
                                        updateItem({ duration: e.target.value })
                                      }
                                      placeholder="45 min"
                                      maxLength={30}
                                    />
                                  </LabelledField>
                                </FieldGrid>
                                <LabelledField label="Note (optional)">
                                  <Input
                                    value={it.note ?? ''}
                                    onChange={(e) =>
                                      updateItem({ note: e.target.value })
                                    }
                                    placeholder="incl. consultation"
                                    maxLength={100}
                                  />
                                </LabelledField>
                              </ExpandableItemRow>
                            );
                          })}
                        </div>
                      </div>
                    </ExpandableItemRow>
                  );
                })}
              </div>
            </div>
          ) : null}
          {(config.priceList.items ?? []).map((item, i) => {
            const updateItem = (patch: Partial<typeof item>) => {
              const items = [...(config.priceList!.items ?? [])];
              items[i] = { ...items[i]!, ...patch };
              onChange({
                ...config,
                priceList: { ...config.priceList!, items },
              });
            };
            const moveItem = (dir: -1 | 1) => {
              const items = [...(config.priceList!.items ?? [])];
              const j = i + dir;
              if (j < 0 || j >= items.length) return;
              [items[i], items[j]] = [items[j]!, items[i]!];
              onChange({
                ...config,
                priceList: { ...config.priceList!, items },
              });
            };
            return (
              <ExpandableItemRow
                key={`pl-${i}`}
                summary={item.name || `Service ${i + 1}`}
                summarySecondary={`${config.priceList!.currency ?? '€'}${item.price ?? '—'} · ${
                  item.duration ?? ''
                }`}
                featured={item.featured ?? false}
                onToggleFeatured={() => updateItem({ featured: !item.featured })}
                onMoveUp={i > 0 ? () => moveItem(-1) : undefined}
                onMoveDown={
                  i < (config.priceList!.items?.length ?? 0) - 1
                    ? () => moveItem(1)
                    : undefined
                }
                onRemove={() =>
                  onChange({
                    ...config,
                    priceList: {
                      ...config.priceList!,
                      items: (config.priceList!.items ?? []).filter((_, j) => j !== i),
                    },
                  })
                }
              >
                <LabelledField label="Service name">
                  <Input
                    value={item.name ?? ''}
                    onChange={(e) => updateItem({ name: e.target.value })}
                    placeholder="Men's cut"
                    maxLength={80}
                  />
                </LabelledField>
                <FieldGrid>
                  <LabelledField label="Price" hint="25 / from 85">
                    <Input
                      value={item.price ?? ''}
                      onChange={(e) => updateItem({ price: e.target.value })}
                      placeholder="25"
                      maxLength={20}
                    />
                  </LabelledField>
                  <LabelledField label="Duration">
                    <Input
                      value={item.duration ?? ''}
                      onChange={(e) => updateItem({ duration: e.target.value })}
                      placeholder="45 min"
                      maxLength={30}
                    />
                  </LabelledField>
                </FieldGrid>
                <LabelledField label="Note (optional)">
                  <Input
                    value={item.note ?? ''}
                    onChange={(e) => updateItem({ note: e.target.value })}
                    placeholder="incl. consultation"
                    maxLength={100}
                  />
                </LabelledField>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Team */}
      {config.team ? (
        <ArrayBlock
          icon={<Users className="h-3.5 w-3.5" />}
          label="Team members"
          count={config.team.members?.length ?? 0}
          onAdd={() =>
            onChange({
              ...config,
              team: {
                ...config.team!,
                members: [
                  ...(config.team!.members ?? []),
                  { name: 'New member', role: 'Role' },
                ],
              },
            })
          }
          addLabel="Add member"
          emptyHint="No team members yet."
        >
          {/* Block-level variant picker */}
          <VariantPicker
            label="Card layout (all members)"
            value={config.team.variant ?? 'portrait'}
            options={TEAM_VARIANT_OPTIONS}
            onChange={(v) =>
              onChange({
                ...config,
                team: { ...config.team!, variant: v },
              })
            }
          />
          {(config.team.members ?? []).map((m, i) => {
            const updateMember = (
              patch: Partial<
                NonNullable<NonNullable<WebsiteConfig['team']>['members']>[number]
              >,
            ) => {
              const next = [...(config.team!.members ?? [])];
              next[i] = { ...next[i]!, ...patch };
              onChange({
                ...config,
                team: { ...config.team!, members: next },
              });
            };
            const moveMember = (dir: -1 | 1) => {
              const next = [...(config.team!.members ?? [])];
              const j = i + dir;
              if (j < 0 || j >= next.length) return;
              [next[i], next[j]] = [next[j]!, next[i]!];
              onChange({
                ...config,
                team: { ...config.team!, members: next },
              });
            };
            return (
              <ExpandableItemRow
                key={`tm-${i}`}
                summary={m.name || '(unnamed)'}
                summarySecondary={m.role ?? ''}
                featured={m.featured ?? false}
                onToggleFeatured={() => updateMember({ featured: !m.featured })}
                onMoveUp={i > 0 ? () => moveMember(-1) : undefined}
                onMoveDown={
                  i < (config.team!.members?.length ?? 0) - 1
                    ? () => moveMember(1)
                    : undefined
                }
                onRemove={async () => {
                  if (
                    !(await confirmDialog({
                      title: `Remove ${m.name || 'this member'}?`,
                      confirmLabel: 'Remove',
                      danger: true,
                    }))
                  )
                    return;
                  onChange({
                    ...config,
                    team: {
                      ...config.team!,
                      members: (config.team!.members ?? []).filter((_, j) => j !== i),
                    },
                  });
                }}
              >
                <FieldGrid>
                  <LabelledField label="Name">
                    <Input
                      value={m.name ?? ''}
                      onChange={(e) => updateMember({ name: e.target.value })}
                      placeholder="Sarah O'Brien"
                      maxLength={80}
                    />
                  </LabelledField>
                  <LabelledField label="Role">
                    <Input
                      value={m.role ?? ''}
                      onChange={(e) => updateMember({ role: e.target.value })}
                      placeholder="Senior stylist"
                      maxLength={80}
                    />
                  </LabelledField>
                </FieldGrid>
                <LabelledField label="Bio (optional)">
                  <Textarea
                    value={m.bio ?? ''}
                    onChange={(e) => updateMember({ bio: e.target.value })}
                    placeholder="A short bio — 1 or 2 sentences"
                    rows={2}
                    maxLength={400}
                  />
                </LabelledField>
                <LabelledField label="Credentials (optional)" hint="e.g. BDS, RGN">
                  <Input
                    value={m.credentials ?? ''}
                    onChange={(e) => updateMember({ credentials: e.target.value })}
                    placeholder="BDS, MFDS RCSI"
                    maxLength={100}
                  />
                </LabelledField>
                <TagListField
                  label="Specialties"
                  tags={m.specialties ?? []}
                  max={5}
                  placeholder="Beard trims, skin fades"
                  onChange={(tags) => updateMember({ specialties: tags })}
                />
                <VariantPicker
                  label="This member's card"
                  value={m.variant}
                  options={TEAM_MEMBER_VARIANT_OPTIONS}
                  // Coerce the block-level default to the narrower member
                  // type. If the block uses a full-section variant (e.g.
                  // `small-avatars` or `card-hover`) the per-card picker
                  // has no matching option, so we fall back to `portrait`.
                  blockDefault={
                    config.team!.variant === 'light-bg' ||
                    config.team!.variant === 'small-avatars' ||
                    config.team!.variant === 'card-hover' ||
                    !config.team!.variant
                      ? 'portrait'
                      : config.team!.variant
                  }
                  onChange={(v) => updateMember({ variant: v ?? undefined })}
                  allowDefault
                />
                <p className="text-[10px] text-slate-400">
                  Tip: photos are managed from the preview — click the member&apos;s avatar
                  in the preview or the Images tab.
                </p>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Schedule entries */}
      {config.schedule ? (
        <ArrayBlock
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Schedule entries"
          count={config.schedule.entries?.length ?? 0}
          onAdd={() =>
            onChange({
              ...config,
              schedule: {
                ...config.schedule!,
                entries: [
                  ...(config.schedule!.entries ?? []),
                  { day: 'Mo', time: '09:00', title: 'New entry' },
                ],
              },
            })
          }
          addLabel="Add entry"
          emptyHint="No schedule entries yet."
        >
          {(config.schedule.entries ?? []).map((e, i) => {
            const updateEntry = (
              patch: Partial<
                NonNullable<WebsiteConfig['schedule']>['entries'][number]
              >,
            ) => {
              const entries = [...(config.schedule!.entries ?? [])];
              entries[i] = { ...entries[i]!, ...patch };
              onChange({
                ...config,
                schedule: { ...config.schedule!, entries },
              });
            };
            const moveEntry = (dir: -1 | 1) => {
              const entries = [...(config.schedule!.entries ?? [])];
              const j = i + dir;
              if (j < 0 || j >= entries.length) return;
              [entries[i], entries[j]] = [entries[j]!, entries[i]!];
              onChange({
                ...config,
                schedule: { ...config.schedule!, entries },
              });
            };
            return (
              <ExpandableItemRow
                key={`sch-${i}`}
                summary={`${e.day} ${e.time} — ${e.title}`}
                summarySecondary={e.detail ?? ''}
                featured={e.featured ?? false}
                onToggleFeatured={() => updateEntry({ featured: !e.featured })}
                onMoveUp={i > 0 ? () => moveEntry(-1) : undefined}
                onMoveDown={
                  i < (config.schedule!.entries?.length ?? 0) - 1
                    ? () => moveEntry(1)
                    : undefined
                }
                onRemove={() =>
                  onChange({
                    ...config,
                    schedule: {
                      ...config.schedule!,
                      entries: (config.schedule!.entries ?? []).filter(
                        (_, j) => j !== i,
                      ),
                    },
                  })
                }
              >
                <FieldGrid>
                  <LabelledField label="Day">
                    <select
                      value={e.day ?? 'Mo'}
                      onChange={(ev) => updateEntry({ day: ev.target.value })}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    >
                      {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </LabelledField>
                  <LabelledField label="Time" hint="24hr, HH:MM">
                    <Input
                      type="time"
                      value={e.time ?? '09:00'}
                      onChange={(ev) => updateEntry({ time: ev.target.value })}
                    />
                  </LabelledField>
                </FieldGrid>
                <LabelledField label="Title">
                  <Input
                    value={e.title ?? ''}
                    onChange={(ev) => updateEntry({ title: ev.target.value })}
                    placeholder="HIIT"
                    maxLength={80}
                  />
                </LabelledField>
                <LabelledField label="Detail (optional)" hint="duration · instructor">
                  <Input
                    value={e.detail ?? ''}
                    onChange={(ev) => updateEntry({ detail: ev.target.value })}
                    placeholder="45 min · Coach Maria"
                    maxLength={120}
                  />
                </LabelledField>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Service areas */}
      {config.serviceAreas ? (
        <ArrayBlock
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Service areas"
          count={config.serviceAreas.areas?.length ?? 0}
          onAdd={() =>
            onChange({
              ...config,
              serviceAreas: {
                ...config.serviceAreas!,
                areas: [...(config.serviceAreas!.areas ?? []), 'New area'],
              },
            })
          }
          addLabel="Add area"
          emptyHint="No service areas yet."
        >
          {(config.serviceAreas.areas ?? []).map((area, i) => {
            const updateArea = (next: string) => {
              const areas = [...(config.serviceAreas!.areas ?? [])];
              areas[i] = next;
              onChange({
                ...config,
                serviceAreas: { ...config.serviceAreas!, areas },
              });
            };
            const moveArea = (dir: -1 | 1) => {
              const areas = [...(config.serviceAreas!.areas ?? [])];
              const j = i + dir;
              if (j < 0 || j >= areas.length) return;
              [areas[i], areas[j]] = [areas[j]!, areas[i]!];
              onChange({
                ...config,
                serviceAreas: { ...config.serviceAreas!, areas },
              });
            };
            return (
              <ExpandableItemRow
                key={`sa-${i}`}
                summary={area || `Area ${i + 1}`}
                onMoveUp={i > 0 ? () => moveArea(-1) : undefined}
                onMoveDown={
                  i < (config.serviceAreas!.areas?.length ?? 0) - 1
                    ? () => moveArea(1)
                    : undefined
                }
                onRemove={() =>
                  onChange({
                    ...config,
                    serviceAreas: {
                      ...config.serviceAreas!,
                      areas: (config.serviceAreas!.areas ?? []).filter(
                        (_, j) => j !== i,
                      ),
                    },
                  })
                }
              >
                <LabelledField label="Area name">
                  <Input
                    value={area ?? ''}
                    onChange={(e) => updateArea(e.target.value)}
                    placeholder="Dublin 2"
                    maxLength={80}
                  />
                </LabelledField>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Trust badges */}
      {config.trustBadges ? (
        <ArrayBlock
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          label="Trust badges"
          count={config.trustBadges.badges?.length ?? 0}
          onAdd={() =>
            onChange({
              ...config,
              trustBadges: {
                ...config.trustBadges!,
                badges: [
                  ...(config.trustBadges!.badges ?? []),
                  { label: 'New badge' },
                ],
              },
            })
          }
          addLabel="Add badge"
          emptyHint="No trust badges yet."
        >
          {(config.trustBadges.badges ?? []).map((b, i) => {
            const updateBadge = (
              patch: Partial<
                NonNullable<
                  NonNullable<WebsiteConfig['trustBadges']>['badges']
                >[number]
              >,
            ) => {
              const badges = [...(config.trustBadges!.badges ?? [])];
              badges[i] = { ...badges[i]!, ...patch };
              onChange({
                ...config,
                trustBadges: { ...config.trustBadges!, badges },
              });
            };
            return (
              <ExpandableItemRow
                key={`tb-${i}`}
                summary={b.label || `Badge ${i + 1}`}
                summarySecondary={b.detail ?? ''}
                onRemove={() =>
                  onChange({
                    ...config,
                    trustBadges: {
                      ...config.trustBadges!,
                      badges: (config.trustBadges!.badges ?? []).filter(
                        (_, j) => j !== i,
                      ),
                    },
                  })
                }
              >
                <LabelledField label="Label">
                  <Input
                    value={b.label ?? ''}
                    onChange={(e) => updateBadge({ label: e.target.value })}
                    placeholder="RGI Registered"
                    maxLength={80}
                  />
                </LabelledField>
                <LabelledField label="Detail (optional)">
                  <Input
                    value={b.detail ?? ''}
                    onChange={(e) => updateBadge({ detail: e.target.value })}
                    placeholder="Reg. No. 12345"
                    maxLength={200}
                  />
                </LabelledField>
                <LabelledField label="Link (optional)" hint="URL to verify">
                  <Input
                    type="url"
                    value={b.href ?? ''}
                    onChange={(e) => updateBadge({ href: e.target.value })}
                    placeholder="https://rgii.ie/member/12345"
                    maxLength={500}
                  />
                </LabelledField>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Before/after pairs */}
      {config.beforeAfter ? (
        <ArrayBlock
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          label="Before / after pairs"
          count={config.beforeAfter.pairs?.length ?? 0}
          onAdd={() =>
            onChange({
              ...config,
              beforeAfter: {
                ...config.beforeAfter!,
                pairs: [...(config.beforeAfter!.pairs ?? []), {}],
              },
            })
          }
          addLabel="Add pair"
          emptyHint="No before/after pairs yet. Add one, then pick images in the Images tab."
        >
          {(config.beforeAfter.pairs ?? []).map((p, i) => {
            const updatePair = (
              patch: Partial<
                NonNullable<WebsiteConfig['beforeAfter']>['pairs'][number]
              >,
            ) => {
              const pairs = [...(config.beforeAfter!.pairs ?? [])];
              pairs[i] = { ...pairs[i]!, ...patch };
              onChange({
                ...config,
                beforeAfter: { ...config.beforeAfter!, pairs },
              });
            };
            return (
              <ExpandableItemRow
                key={`ba-${i}`}
                summary={p.caption || `Pair ${i + 1}`}
                summarySecondary={`Before: ${p.beforeIndex ?? '—'} · After: ${p.afterIndex ?? '—'}`}
                onRemove={() =>
                  onChange({
                    ...config,
                    beforeAfter: {
                      ...config.beforeAfter!,
                      pairs: (config.beforeAfter!.pairs ?? []).filter(
                        (_, j) => j !== i,
                      ),
                    },
                  })
                }
              >
                <LabelledField label="Caption (optional)">
                  <Input
                    value={p.caption ?? ''}
                    onChange={(e) => updatePair({ caption: e.target.value })}
                    placeholder="Bathroom refit — 3 days"
                    maxLength={150}
                  />
                </LabelledField>
                <FieldGrid>
                  <LabelledField label="Before image index" hint="from Images tab">
                    <Input
                      type="number"
                      min={0}
                      value={p.beforeIndex ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updatePair({
                          beforeIndex: raw === '' ? undefined : Number(raw),
                        });
                      }}
                      placeholder="0"
                    />
                  </LabelledField>
                  <LabelledField label="After image index" hint="from Images tab">
                    <Input
                      type="number"
                      min={0}
                      value={p.afterIndex ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updatePair({
                          afterIndex: raw === '' ? undefined : Number(raw),
                        });
                      }}
                      placeholder="1"
                    />
                  </LabelledField>
                </FieldGrid>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Custom sections — always available, creates the 'custom' layout entry on first add */}
      <CustomSectionsEditor config={config} onChange={onChange} />

      {/* Products */}
      {config.products ? (
        <ArrayBlock
          icon={<ShoppingBag className="h-3.5 w-3.5" />}
          label="Products"
          count={config.products.items?.length ?? 0}
          onAdd={() =>
            onChange({
              ...config,
              products: {
                ...config.products!,
                items: [
                  ...(config.products!.items ?? []),
                  { name: 'New product', price: '0' },
                ],
              },
            })
          }
          addLabel="Add product"
          emptyHint="No products yet."
        >
          <FieldGrid>
            <LabelledField label="Currency" hint="€ / $ / £">
              <Input
                value={config.products.currency ?? '€'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    products: {
                      ...config.products!,
                      currency: e.target.value.slice(0, 4),
                    },
                  })
                }
                maxLength={4}
                className="max-w-[80px]"
              />
            </LabelledField>
            <div />
          </FieldGrid>
          <TagListField
            label="Category tabs (optional)"
            tags={config.products.categories ?? []}
            max={8}
            placeholder="Cakes, Bread, Pastries"
            onChange={(categories) =>
              onChange({
                ...config,
                products: { ...config.products!, categories },
              })
            }
          />
          {(config.products.items ?? []).map((p, i) => {
            const updateProduct = (
              patch: Partial<
                NonNullable<NonNullable<WebsiteConfig['products']>['items']>[number]
              >,
            ) => {
              const items = [...(config.products!.items ?? [])];
              items[i] = { ...items[i]!, ...patch };
              onChange({
                ...config,
                products: { ...config.products!, items },
              });
            };
            const moveProduct = (dir: -1 | 1) => {
              const items = [...(config.products!.items ?? [])];
              const j = i + dir;
              if (j < 0 || j >= items.length) return;
              [items[i], items[j]] = [items[j]!, items[i]!];
              onChange({
                ...config,
                products: { ...config.products!, items },
              });
            };
            return (
              <ExpandableItemRow
                key={`prod-${i}`}
                summary={p.name || `Product ${i + 1}`}
                summarySecondary={`${config.products!.currency ?? '€'}${p.price ?? ''}${
                  p.category ? ` · ${p.category}` : ''
                }`}
                featured={p.featured ?? false}
                onToggleFeatured={() => updateProduct({ featured: !p.featured })}
                onMoveUp={i > 0 ? () => moveProduct(-1) : undefined}
                onMoveDown={
                  i < (config.products!.items?.length ?? 0) - 1
                    ? () => moveProduct(1)
                    : undefined
                }
                onRemove={() =>
                  onChange({
                    ...config,
                    products: {
                      ...config.products!,
                      items: (config.products!.items ?? []).filter((_, j) => j !== i),
                    },
                  })
                }
              >
                <LabelledField label="Name">
                  <Input
                    value={p.name ?? ''}
                    onChange={(e) => updateProduct({ name: e.target.value })}
                    placeholder="Victoria sponge"
                    maxLength={80}
                  />
                </LabelledField>
                <LabelledField label="Description (optional)">
                  <Textarea
                    value={p.description ?? ''}
                    onChange={(e) => updateProduct({ description: e.target.value })}
                    placeholder="What the product is"
                    rows={2}
                    maxLength={300}
                  />
                </LabelledField>
                <FieldGrid>
                  <LabelledField label="Price">
                    <Input
                      value={p.price ?? ''}
                      onChange={(e) => updateProduct({ price: e.target.value })}
                      placeholder="18.50"
                      maxLength={20}
                    />
                  </LabelledField>
                  <LabelledField label="Category (optional)">
                    {(config.products!.categories ?? []).length > 0 ? (
                      <select
                        value={p.category ?? ''}
                        onChange={(e) =>
                          updateProduct({
                            category: e.target.value || undefined,
                          })
                        }
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                      >
                        <option value="">—</option>
                        {(config.products!.categories ?? []).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={p.category ?? ''}
                        onChange={(e) => updateProduct({ category: e.target.value })}
                        placeholder="Cakes"
                        maxLength={60}
                      />
                    )}
                  </LabelledField>
                </FieldGrid>
                <FieldGrid>
                  <LabelledField label="Badge (optional)" hint="New / Sale">
                    <Input
                      value={p.badge ?? ''}
                      onChange={(e) => updateProduct({ badge: e.target.value })}
                      placeholder="New"
                      maxLength={20}
                    />
                  </LabelledField>
                  <LabelledField label="CTA label">
                    <Input
                      value={p.ctaLabel ?? ''}
                      onChange={(e) => updateProduct({ ctaLabel: e.target.value })}
                      placeholder="Order"
                      maxLength={30}
                    />
                  </LabelledField>
                </FieldGrid>
                <LabelledField label="Link (optional)" hint="URL to buy/enquire">
                  <Input
                    type="url"
                    value={p.href ?? ''}
                    onChange={(e) => updateProduct({ href: e.target.value })}
                    placeholder="https://..."
                    maxLength={500}
                  />
                </LabelledField>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Portfolio projects */}
      {config.portfolio ? (
        <ArrayBlock
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Portfolio projects"
          count={config.portfolio.projects?.length ?? 0}
          onAdd={() =>
            onChange({
              ...config,
              portfolio: {
                ...config.portfolio!,
                projects: [
                  ...(config.portfolio!.projects ?? []),
                  { title: 'New project', summary: 'Short teaser', imageIndices: [] },
                ],
              },
            })
          }
          addLabel="Add project"
          emptyHint="No projects yet."
        >
          {(config.portfolio.projects ?? []).map((p, i) => {
            const updateProject = (
              patch: Partial<
                NonNullable<
                  NonNullable<WebsiteConfig['portfolio']>['projects']
                >[number]
              >,
            ) => {
              const projects = [...(config.portfolio!.projects ?? [])];
              projects[i] = { ...projects[i]!, ...patch };
              onChange({
                ...config,
                portfolio: { ...config.portfolio!, projects },
              });
            };
            const moveProject = (dir: -1 | 1) => {
              const projects = [...(config.portfolio!.projects ?? [])];
              const j = i + dir;
              if (j < 0 || j >= projects.length) return;
              [projects[i], projects[j]] = [projects[j]!, projects[i]!];
              onChange({
                ...config,
                portfolio: { ...config.portfolio!, projects },
              });
            };
            // Edit imageIndices as a comma-separated list to keep the UI
            // simple. The Images tab is still the canonical picker for
            // individual images; this field is for quick reordering or
            // bulk edits.
            const imageIndicesRaw = (p.imageIndices ?? []).join(', ');
            return (
              <ExpandableItemRow
                key={`port-${i}`}
                summary={p.title || `Project ${i + 1}`}
                summarySecondary={`${
                  (p.imageIndices?.length ?? 0) + (p.imageUrls?.length ?? 0)
                } images · ${(p.tags ?? []).join(', ')}`}
                featured={p.featured ?? false}
                onToggleFeatured={() => updateProject({ featured: !p.featured })}
                onMoveUp={i > 0 ? () => moveProject(-1) : undefined}
                onMoveDown={
                  i < (config.portfolio!.projects?.length ?? 0) - 1
                    ? () => moveProject(1)
                    : undefined
                }
                onRemove={() =>
                  onChange({
                    ...config,
                    portfolio: {
                      ...config.portfolio!,
                      projects: (config.portfolio!.projects ?? []).filter(
                        (_, j) => j !== i,
                      ),
                    },
                  })
                }
              >
                <LabelledField label="Title">
                  <Input
                    value={p.title ?? ''}
                    onChange={(e) => updateProject({ title: e.target.value })}
                    placeholder="Dublin kitchen refit"
                    maxLength={100}
                  />
                </LabelledField>
                <LabelledField label="Summary (card teaser)">
                  <Input
                    value={p.summary ?? ''}
                    onChange={(e) => updateProject({ summary: e.target.value })}
                    placeholder="One-line teaser shown on the card"
                    maxLength={150}
                  />
                </LabelledField>
                <LabelledField label="Description (shown when expanded)">
                  <Textarea
                    value={p.description ?? ''}
                    onChange={(e) => updateProject({ description: e.target.value })}
                    placeholder="The full story — client goals, what we did, the result"
                    rows={3}
                    maxLength={1000}
                  />
                </LabelledField>
                <LabelledField
                  label="Image indices"
                  hint="comma-separated, from Images tab"
                >
                  <Input
                    value={imageIndicesRaw}
                    onChange={(e) => {
                      const next = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map(Number)
                        .filter((n) => Number.isFinite(n) && n >= 0);
                      updateProject({ imageIndices: next });
                    }}
                    placeholder="0, 1, 2"
                  />
                </LabelledField>
                <TagListField
                  label="Tags"
                  tags={p.tags ?? []}
                  max={6}
                  placeholder="2024, Dublin, residential"
                  onChange={(tags) => updateProject({ tags })}
                />
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Process steps */}
      {config.process ? (
        <ArrayBlock
          icon={<Workflow className="h-3.5 w-3.5" />}
          label="Process steps"
          count={config.process.steps?.length ?? 0}
          onAdd={() =>
            onChange({
              ...config,
              process: {
                ...config.process!,
                steps: [
                  ...(config.process!.steps ?? []),
                  { title: 'New step', description: '' },
                ],
              },
            })
          }
          addLabel="Add step"
          emptyHint="No steps yet."
        >
          {(config.process.steps ?? []).map((s, i) => {
            const updateStep = (
              patch: Partial<
                NonNullable<WebsiteConfig['process']>['steps'][number]
              >,
            ) => {
              const steps = [...(config.process!.steps ?? [])];
              steps[i] = { ...steps[i]!, ...patch };
              onChange({
                ...config,
                process: { ...config.process!, steps },
              });
            };
            const moveStep = (dir: -1 | 1) => {
              const steps = [...(config.process!.steps ?? [])];
              const j = i + dir;
              if (j < 0 || j >= steps.length) return;
              [steps[i], steps[j]] = [steps[j]!, steps[i]!];
              onChange({
                ...config,
                process: { ...config.process!, steps },
              });
            };
            return (
              <ExpandableItemRow
                key={`proc-${i}`}
                summary={`${i + 1}. ${s.title || 'Step'}`}
                summarySecondary={s.description ?? ''}
                onMoveUp={i > 0 ? () => moveStep(-1) : undefined}
                onMoveDown={
                  i < (config.process!.steps?.length ?? 0) - 1
                    ? () => moveStep(1)
                    : undefined
                }
                onRemove={() =>
                  onChange({
                    ...config,
                    process: {
                      ...config.process!,
                      steps: (config.process!.steps ?? []).filter(
                        (_, j) => j !== i,
                      ),
                    },
                  })
                }
              >
                <LabelledField label="Step title">
                  <Input
                    value={s.title ?? ''}
                    onChange={(e) => updateStep({ title: e.target.value })}
                    placeholder="Call us"
                    maxLength={80}
                  />
                </LabelledField>
                <LabelledField label="Description">
                  <Textarea
                    value={s.description ?? ''}
                    onChange={(e) => updateStep({ description: e.target.value })}
                    placeholder="What happens in this step"
                    rows={2}
                    maxLength={300}
                  />
                </LabelledField>
                <LabelledField label="Icon (optional)">
                  <select
                    value={s.icon ?? ''}
                    onChange={(e) => updateStep({ icon: e.target.value || undefined })}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="">(none)</option>
                    {AVAILABLE_ICONS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </LabelledField>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Pricing tiers */}
      {config.pricingTiers ? (
        <ArrayBlock
          icon={<Tags className="h-3.5 w-3.5" />}
          label="Pricing tiers"
          count={config.pricingTiers.tiers?.length ?? 0}
          onAdd={() => {
            if ((config.pricingTiers!.tiers?.length ?? 0) >= 4) {
              toast.info('Max 4 tiers', 'Remove one first.');
              return;
            }
            onChange({
              ...config,
              pricingTiers: {
                ...config.pricingTiers!,
                tiers: [
                  ...(config.pricingTiers!.tiers ?? []),
                  {
                    name: 'New tier',
                    price: '0',
                    period: '/month',
                    features: ['Feature'],
                    ctaLabel: 'Choose',
                    ctaHref: '#contact',
                  },
                ],
              },
            });
          }}
          addLabel="Add tier"
          emptyHint="No tiers yet."
        >
          <LabelledField label="Currency" hint="€ / $ / £">
            <Input
              value={config.pricingTiers.currency ?? '€'}
              onChange={(e) =>
                onChange({
                  ...config,
                  pricingTiers: {
                    ...config.pricingTiers!,
                    currency: e.target.value.slice(0, 4),
                  },
                })
              }
              maxLength={4}
              className="max-w-[80px]"
            />
          </LabelledField>
          {(config.pricingTiers.tiers ?? []).map((t, i) => {
            const updateTier = (
              patch: Partial<
                NonNullable<WebsiteConfig['pricingTiers']>['tiers'][number]
              >,
            ) => {
              const tiers = [...(config.pricingTiers!.tiers ?? [])];
              tiers[i] = { ...tiers[i]!, ...patch };
              onChange({
                ...config,
                pricingTiers: { ...config.pricingTiers!, tiers },
              });
            };
            const moveTier = (dir: -1 | 1) => {
              const tiers = [...(config.pricingTiers!.tiers ?? [])];
              const j = i + dir;
              if (j < 0 || j >= tiers.length) return;
              [tiers[i], tiers[j]] = [tiers[j]!, tiers[i]!];
              onChange({
                ...config,
                pricingTiers: { ...config.pricingTiers!, tiers },
              });
            };
            return (
              <ExpandableItemRow
                key={`tier-${i}`}
                summary={t.name || `Tier ${i + 1}`}
                summarySecondary={`${config.pricingTiers!.currency ?? '€'}${t.price ?? ''}${
                  t.period ?? ''
                } · ${(t.features ?? []).length} features`}
                featured={t.highlighted ?? false}
                onToggleFeatured={() => updateTier({ highlighted: !t.highlighted })}
                onMoveUp={i > 0 ? () => moveTier(-1) : undefined}
                onMoveDown={
                  i < (config.pricingTiers!.tiers?.length ?? 0) - 1
                    ? () => moveTier(1)
                    : undefined
                }
                onRemove={() =>
                  onChange({
                    ...config,
                    pricingTiers: {
                      ...config.pricingTiers!,
                      tiers: (config.pricingTiers!.tiers ?? []).filter(
                        (_, j) => j !== i,
                      ),
                    },
                  })
                }
              >
                <LabelledField label="Tier name">
                  <Input
                    value={t.name ?? ''}
                    onChange={(e) => updateTier({ name: e.target.value })}
                    placeholder="Silver"
                    maxLength={60}
                  />
                </LabelledField>
                <FieldGrid>
                  <LabelledField label="Price" hint="number or 'from X'">
                    <Input
                      value={t.price ?? ''}
                      onChange={(e) => updateTier({ price: e.target.value })}
                      placeholder="49"
                      maxLength={20}
                    />
                  </LabelledField>
                  <LabelledField label="Period">
                    <Input
                      value={t.period ?? ''}
                      onChange={(e) => updateTier({ period: e.target.value })}
                      placeholder="/month"
                      maxLength={30}
                    />
                  </LabelledField>
                </FieldGrid>
                <LabelledField label="Short description">
                  <Input
                    value={t.description ?? ''}
                    onChange={(e) => updateTier({ description: e.target.value })}
                    placeholder="What this tier is for"
                    maxLength={200}
                  />
                </LabelledField>
                <TagListField
                  label="Features"
                  tags={t.features ?? []}
                  max={12}
                  placeholder="Add a feature and press Enter"
                  onChange={(features) => updateTier({ features })}
                />
                <FieldGrid>
                  <LabelledField label="CTA label">
                    <Input
                      value={t.ctaLabel ?? ''}
                      onChange={(e) => updateTier({ ctaLabel: e.target.value })}
                      placeholder="Choose Silver"
                      maxLength={40}
                    />
                  </LabelledField>
                  <LabelledField label="CTA link">
                    <Input
                      value={t.ctaHref ?? ''}
                      onChange={(e) => updateTier({ ctaHref: e.target.value })}
                      placeholder="#contact"
                      maxLength={300}
                    />
                  </LabelledField>
                </FieldGrid>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}

      {/* Logo strip */}
      {config.logoStrip ? (
        <ArrayBlock
          icon={<Globe className="h-3.5 w-3.5" />}
          label="Logos"
          count={config.logoStrip.logos?.length ?? 0}
          onAdd={() =>
            onChange({
              ...config,
              logoStrip: {
                ...config.logoStrip!,
                logos: [...(config.logoStrip!.logos ?? []), { name: 'New logo' }],
              },
            })
          }
          addLabel="Add logo"
          emptyHint="No logos yet."
        >
          {(config.logoStrip.logos ?? []).map((l, i) => {
            const updateLogo = (
              patch: Partial<
                NonNullable<WebsiteConfig['logoStrip']>['logos'][number]
              >,
            ) => {
              const logos = [...(config.logoStrip!.logos ?? [])];
              logos[i] = { ...logos[i]!, ...patch };
              onChange({
                ...config,
                logoStrip: { ...config.logoStrip!, logos },
              });
            };
            const moveLogo = (dir: -1 | 1) => {
              const logos = [...(config.logoStrip!.logos ?? [])];
              const j = i + dir;
              if (j < 0 || j >= logos.length) return;
              [logos[i], logos[j]] = [logos[j]!, logos[i]!];
              onChange({
                ...config,
                logoStrip: { ...config.logoStrip!, logos },
              });
            };
            return (
              <ExpandableItemRow
                key={`logo-${i}`}
                summary={l.name || `Logo ${i + 1}`}
                summarySecondary={
                  l.imageUrl ||
                  (typeof l.imageIndex === 'number' ? `image [${l.imageIndex}]` : 'no image')
                }
                onMoveUp={i > 0 ? () => moveLogo(-1) : undefined}
                onMoveDown={
                  i < (config.logoStrip!.logos?.length ?? 0) - 1
                    ? () => moveLogo(1)
                    : undefined
                }
                onRemove={() =>
                  onChange({
                    ...config,
                    logoStrip: {
                      ...config.logoStrip!,
                      logos: (config.logoStrip!.logos ?? []).filter(
                        (_, j) => j !== i,
                      ),
                    },
                  })
                }
              >
                <LabelledField label="Logo name">
                  <Input
                    value={l.name ?? ''}
                    onChange={(e) => updateLogo({ name: e.target.value })}
                    placeholder="Irish Times"
                    maxLength={80}
                  />
                </LabelledField>
                <FieldGrid>
                  <LabelledField
                    label="Image index"
                    hint="from Images tab"
                  >
                    <Input
                      type="number"
                      min={0}
                      value={l.imageIndex ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateLogo({
                          imageIndex: raw === '' ? undefined : Number(raw),
                        });
                      }}
                      placeholder="0"
                    />
                  </LabelledField>
                  <LabelledField label="Or image URL">
                    <Input
                      type="url"
                      value={l.imageUrl ?? ''}
                      onChange={(e) => updateLogo({ imageUrl: e.target.value })}
                      placeholder="https://..."
                      maxLength={500}
                    />
                  </LabelledField>
                </FieldGrid>
                <LabelledField label="Link (optional)">
                  <Input
                    type="url"
                    value={l.href ?? ''}
                    onChange={(e) => updateLogo({ href: e.target.value })}
                    placeholder="https://..."
                    maxLength={500}
                  />
                </LabelledField>
              </ExpandableItemRow>
            );
          })}
        </ArrayBlock>
      ) : null}
    </div>
  );
}

/** Collapsible-feel labelled group with an Add button. */
function ArrayBlock({
  icon,
  label,
  count,
  children,
  onAdd,
  addLabel,
  emptyHint,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  children: React.ReactNode;
  onAdd: () => void;
  addLabel: string;
  emptyHint: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <span className="text-slate-400">{icon}</span>
          {label}
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {count}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
        >
          <Plus className="h-2.5 w-2.5" />
          {addLabel}
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        {count === 0 ? (
          <p className="py-2 text-center text-[11px] text-slate-400">{emptyHint}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/**
 * Expandable row that shows the summary in collapsed mode and a form with
 * the item's fields when opened. Replaces the plain `ItemRow` for
 * sections where the agency needs to edit per-item values (stat number,
 * review text, price, schedule time, etc.) without leaving the editor
 * panel.
 *
 * Collapsed view is a single-line pill (primary + secondary) with an
 * expand chevron + delete button. Expanded view reveals the passed
 * `fields` children in a clean stacked form.
 *
 * Each row is independently controlled — the parent doesn't need to
 * track which rows are open. Toggling defaults to closed; the caller
 * can pass `defaultOpen` to open a row on mount (useful when a fresh
 * item was just added).
 */
function ExpandableItemRow({
  summary,
  summarySecondary,
  featured,
  onToggleFeatured,
  onRemove,
  children,
  defaultOpen,
  dragHandle,
  onMoveUp,
  onMoveDown,
}: {
  summary: string;
  summarySecondary?: string;
  /** When defined, a star toggle appears. Undefined = no toggle. */
  featured?: boolean;
  onToggleFeatured?: () => void;
  onRemove: () => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
  dragHandle?: React.ReactNode;
  /** Optional row reorder callbacks — when both are supplied we render up/down buttons. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div
      className={`rounded-xl border bg-white transition-all ${
        open ? 'border-[#1D9CA1]/40 shadow-sm' : 'border-slate-200'
      }`}
    >
      {/* Summary header */}
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 px-2.5 py-2 text-left min-w-0"
          aria-expanded={open}
        >
          {dragHandle}
          <ChevronDown
            className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${
              open ? 'rotate-0' : '-rotate-90'
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-slate-900">
              {summary || <span className="text-slate-400">Untitled</span>}
            </div>
            {summarySecondary ? (
              <div className="truncate text-[10px] text-slate-500">
                {summarySecondary}
              </div>
            ) : null}
          </div>
          {featured ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
              Featured
            </span>
          ) : null}
        </button>
        <div className="flex items-center gap-0.5 pr-1.5">
          {onMoveUp ? (
            <button
              type="button"
              onClick={onMoveUp}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Move up"
              title="Move up"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
          ) : null}
          {onMoveDown ? (
            <button
              type="button"
              onClick={onMoveDown}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Move down"
              title="Move down"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          ) : null}
          {onToggleFeatured ? (
            <button
              type="button"
              onClick={onToggleFeatured}
              className={`rounded p-1 transition-colors ${
                featured
                  ? 'text-amber-500 hover:bg-amber-50'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
              aria-label={featured ? 'Unfeature' : 'Feature'}
              title={featured ? 'Unfeature this item' : 'Feature this item'}
            >
              <Star
                className="h-3 w-3"
                fill={featured ? 'currentColor' : 'none'}
              />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
            aria-label="Remove"
            title="Remove"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Expanded fields */}
      {open ? (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-3 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Labelled inline text field. Thin wrapper around `Input` that stacks a
 * small caption above the input — used inside expandable rows where
 * every field needs a label so "123" doesn't look like a random number.
 */
function LabelledField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        {hint ? <span className="text-[9px] text-slate-400">{hint}</span> : null}
      </div>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

/** Two-column row used inside expandable field forms. */
function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

/**
 * Editable tag list — renders the tag strings as chips with an inline
 * input for adding a new tag on Enter. Used for specialties, FAQ tags,
 * menu item tags, portfolio tags.
 */
function TagListField({
  label,
  tags,
  max = 10,
  onChange,
  placeholder = 'Add tag and press Enter',
}: {
  label: string;
  tags: string[];
  max?: number;
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const clean = draft.trim().slice(0, 60);
    if (!clean) return;
    if (tags.includes(clean)) {
      setDraft('');
      return;
    }
    if (tags.length >= max) {
      toast.info(`Max ${max} tags`);
      return;
    }
    onChange([...tags, clean]);
    setDraft('');
  };
  return (
    <LabelledField label={label} hint={`${tags.length}/${max}`}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        {tags.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label={`Remove ${t}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Backspace' && !draft && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && commit()}
          placeholder={tags.length === 0 ? placeholder : 'Add…'}
          className="min-w-[80px] flex-1 border-none bg-transparent text-[11px] outline-none placeholder:text-slate-400"
        />
      </div>
    </LabelledField>
  );
}

/* ------------------------------------------------------------------ */
/* Images Editor — pick hero / about / gallery images, upload new ones */
/* ------------------------------------------------------------------ */

/**
 * Image management for a website. Agencies use this tab to swap which
 * client photo appears in the About section, pick the set of images
 * that make up the Gallery, and upload fresh images directly from their
 * laptop (which land in the same media library the rest of the app uses).
 *
 * Uploads reuse `api.uploadImages` so the new files get quality-scored
 * and show up in the gallery picker on the next render. The hero image
 * is handled in its own tab (`Hero`) because it also interacts with AI
 * regeneration, but we link across to it from here for discoverability.
 */
function ImagesEditor({
  config,
  onChange,
  clientId,
  images,
  imageRows,
  onImageLabelChange,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  clientId: string;
  images: string[];
  imageRows?: Array<{
    id: string;
    fileUrl: string;
    aiDescription?: string | null;
    qualityScore?: number | null;
    status?: string | null;
    tags?: string[] | null;
  }>;
  onImageLabelChange?: (id: string, aiDescription: string) => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    const valid: File[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error('Skipped non-image', file.name);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Skipped oversize file', `${file.name} is over 10MB.`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;
    setUploading(true);
    try {
      await api.uploadImages(clientId, valid, ['website']);
      toast.success(
        valid.length === 1 ? 'Image uploaded' : `${valid.length} images uploaded`,
        'They should appear here shortly.',
      );
      // Parent SWR will revalidate on next window focus; hint the user if not.
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setAboutImage = (idx: number | null) => {
    onChange({
      ...config,
      about: config.about
        ? { ...config.about, imageIndex: idx }
        : {
            heading: 'About us',
            body: '',
            imageIndex: idx,
          },
    });
  };

  const toggleGalleryImage = (idx: number) => {
    const current = new Set(config.gallery?.imageIndices ?? []);
    if (current.has(idx)) current.delete(idx);
    else current.add(idx);
    onChange({
      ...config,
      gallery: {
        ...(config.gallery ?? {}),
        imageIndices: Array.from(current).sort((a, b) => a - b),
      },
    });
  };

  const galleryIndices = new Set(
    config.gallery?.imageIndices ?? images.map((_, i) => i).slice(0, 6),
  );
  const aboutIndex = config.about?.imageIndex ?? null;

  return (
    <div className="space-y-5">
      {/* Upload */}
      <div
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-[#1D9CA1]"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('border-[#1D9CA1]', 'bg-[#1D9CA1]/5');
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove('border-[#1D9CA1]', 'bg-[#1D9CA1]/5');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('border-[#1D9CA1]', 'bg-[#1D9CA1]/5');
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-2 text-xs font-medium text-slate-700">
          Drop images here, or
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !clientId}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#1D9CA1] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Uploading…
            </>
          ) : (
            <>browse from your computer</>
          )}
        </button>
        <p className="mt-1 text-[10px] text-slate-400">
          PNG, JPG, WebP, or SVG. Up to 10MB each.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Library overview — with editable AI labels */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">
            Library
            <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {images.length}
            </span>
          </p>
        </div>
        {images.length === 0 ? (
          <p className="mt-2 py-4 text-center text-[11px] text-slate-400">
            No client photos yet. Upload some above.
          </p>
        ) : imageRows && imageRows.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {imageRows.slice(0, 20).map((row) => (
              <LibraryImageRow
                key={row.id}
                row={row}
                onLabelChange={onImageLabelChange}
              />
            ))}
            {imageRows.length > 20 ? (
              <p className="py-2 text-center text-[10px] text-slate-400">
                Showing first 20 of {imageRows.length}. Upload / review more from the Content Hub.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* About image picker */}
      {images.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-slate-700">
            About section image
          </p>
          <p className="text-[10px] text-slate-500">
            Click a photo to feature it in the About section.
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-xl border border-slate-200 bg-white p-2">
            <button
              onClick={() => setAboutImage(null)}
              className={`flex aspect-square items-center justify-center rounded-lg border-2 text-[10px] font-medium transition-all ${
                aboutIndex == null
                  ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 text-[#1D9CA1]'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
              title="Use brand gradient fallback"
            >
              <span className="text-center leading-tight">Auto<br />(gradient)</span>
            </button>
            {images.map((src, i) => (
              <button
                key={`about-${src}-${i}`}
                onClick={() => setAboutImage(i)}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                  aboutIndex === i
                    ? 'border-[#1D9CA1] ring-1 ring-[#1D9CA1]/30'
                    : 'border-transparent hover:border-slate-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                {aboutIndex === i ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#1D9CA1]/30">
                    <Check className="h-4 w-4 text-white drop-shadow" />
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Gallery picker */}
      {images.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-slate-700">
            Gallery images
            <span className="ml-2 font-normal text-slate-400">
              pick which photos show in the gallery
            </span>
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-xl border border-slate-200 bg-white p-2">
            {images.map((src, i) => {
              const selected = galleryIndices.has(i);
              return (
                <button
                  key={`g-${src}-${i}`}
                  onClick={() => toggleGalleryImage(i)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                    selected
                      ? 'border-[#1D9CA1] ring-1 ring-[#1D9CA1]/30'
                      : 'border-transparent hover:border-slate-300'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  {selected ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1D9CA1]/30">
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            {galleryIndices.size} selected · {images.length - galleryIndices.size} hidden
          </p>
        </div>
      ) : null}

      {/* Hero link */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
        Looking for the hero image? It&apos;s in the{' '}
        <strong className="text-slate-900">Hero</strong> tab — use it there so
        you can pick between AI-generated and client-uploaded, plus regenerate
        the illustration.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cutouts Editor — decorative PNG overlays on the hero                */
/* ------------------------------------------------------------------ */

/**
 * Editor for decorative hero cutouts. A cutout is a transparent PNG
 * (e.g. a coffee cup for a cafe, a wrench for a plumber) layered over
 * the hero with its own position and animation. Agencies can upload a
 * cutout from their laptop, nudge it with sliders, or pick an animation
 * style — no canvas or image editor needed.
 *
 * Uploads reuse `api.uploadImages` with a `cutout` tag so they land in
 * the client's media library, then we use the returned URL directly.
 */
function CutoutsEditor({
  config,
  onChange,
  clientId,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  clientId: string;
}) {
  const cutouts = config.hero?.cutouts ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const addCutout = (url: string) => {
    const next = [
      ...cutouts,
      {
        url,
        // Sensible default position: right side, mid-height, medium size
        x: 80,
        y: 50,
        size: 30,
        animation: 'float' as const,
        speed: 1,
        shadow: 1 as const,
      },
    ];
    onChange({ ...config, hero: { ...config.hero, cutouts: next } });
  };

  const updateCutout = (i: number, patch: Partial<(typeof cutouts)[number]>) => {
    const next = [...cutouts];
    next[i] = { ...next[i]!, ...patch };
    onChange({ ...config, hero: { ...config.hero, cutouts: next } });
  };

  const removeCutout = (i: number) => {
    onChange({
      ...config,
      hero: { ...config.hero, cutouts: cutouts.filter((_, j) => j !== i) },
    });
  };

  const onFile = async (file: File) => {
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Pick an image file', 'PNG with transparency works best.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Too large', 'Keep cutouts under 8MB.');
      return;
    }
    setUploading(true);
    try {
      const rows = await api.uploadImages(clientId, [file], ['cutout']);
      const url = rows[0]?.fileUrl;
      if (!url) throw new Error('Upload returned no URL');
      addCutout(url);
      toast.success('Cutout added', 'Position + animation below.');
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">
          Hero cutouts
          <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {cutouts.length}
          </span>
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !clientId}
          className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1] disabled:opacity-50"
          title={!clientId ? 'Pick a client first' : 'Upload a transparent PNG'}
        >
          {uploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
          Upload PNG
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/webp,image/svg+xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>

      <p className="text-[10px] text-slate-400">
        Layered over the hero. Transparent PNGs look best — a coffee cup, scissors,
        a wrench, whatever fits the business. Each one animates on its own.
      </p>

      {cutouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
          <p className="text-[11px] text-slate-500">
            No cutouts yet. Upload a PNG above to add one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cutouts.map((cutout, i) => (
            <CutoutCard
              key={`${cutout.url}-${i}`}
              index={i}
              cutout={cutout}
              onChange={(patch) => updateCutout(i, patch)}
              onRemove={() => removeCutout(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const CUTOUT_ANIMATIONS: Array<{
  value: NonNullable<NonNullable<WebsiteConfig['hero']>['cutouts']>[number]['animation'];
  label: string;
  description: string;
}> = [
  { value: 'float', label: 'Float', description: 'Gentle up-and-down bob' },
  { value: 'tilt', label: 'Tilt', description: 'Slow rotation back and forth' },
  { value: 'orbit', label: 'Orbit', description: 'Subtle circular drift' },
  { value: 'pulse', label: 'Pulse', description: 'Breathing scale' },
  { value: 'drift', label: 'Drift', description: 'Slow diagonal movement' },
  { value: 'none', label: 'Static', description: 'No animation' },
];

function CutoutCard({
  index,
  cutout,
  onChange,
  onRemove,
}: {
  index: number;
  cutout: NonNullable<NonNullable<WebsiteConfig['hero']>['cutouts']>[number];
  onChange: (patch: Partial<typeof cutout>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cutout.url}
          alt=""
          className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px] object-contain p-1"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-900">
            Cutout {index + 1}
          </p>
          <p className="truncate text-[10px] text-slate-500">
            {cutout.animation ?? 'float'} · size {cutout.size ?? 30}%
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
          aria-label="Remove cutout"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <Slider
          label="Horizontal"
          value={cutout.x ?? 50}
          min={-10}
          max={110}
          onChange={(v) => onChange({ x: v })}
          suffix="%"
        />
        <Slider
          label="Vertical"
          value={cutout.y ?? 50}
          min={-10}
          max={110}
          onChange={(v) => onChange({ y: v })}
          suffix="%"
        />
        <Slider
          label="Size"
          value={cutout.size ?? 30}
          min={10}
          max={60}
          onChange={(v) => onChange({ size: v })}
          suffix="%"
        />
        <Slider
          label="Rotation"
          value={cutout.rotate ?? 0}
          min={-45}
          max={45}
          onChange={(v) => onChange({ rotate: v })}
          suffix="°"
        />

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[10px] font-medium text-slate-500">Layer</label>
            <select
              value={cutout.layer ?? 0}
              onChange={(e) =>
                onChange({ layer: Number(e.target.value) as 0 | 1 })
              }
              className="mt-0.5 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px]"
            >
              <option value={0}>Behind copy</option>
              <option value={1}>In front of copy</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-slate-500">Shadow</label>
            <select
              value={cutout.shadow ?? 1}
              onChange={(e) =>
                onChange({ shadow: Number(e.target.value) as 0 | 1 | 2 })
              }
              className="mt-0.5 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px]"
            >
              <option value={0}>None</option>
              <option value={1}>Soft</option>
              <option value={2}>Dramatic</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium text-slate-500">Animation</label>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {CUTOUT_ANIMATIONS.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => onChange({ animation: a.value })}
                className={`rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors ${
                  (cutout.animation ?? 'float') === a.value
                    ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 text-[#1D9CA1]'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
                title={a.description}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <Slider
          label="Animation speed"
          value={cutout.speed ?? 1}
          min={0.3}
          max={3}
          step={0.1}
          onChange={(v) => onChange({ speed: v })}
          suffix="×"
        />
      </div>
    </div>
  );
}

/** Reusable labelled slider with live numeric readout. */
function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-slate-500">{label}</span>
        <span className="text-[10px] tabular-nums text-slate-700">
          {step < 1 ? value.toFixed(1) : Math.round(value)}
          {suffix ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#1D9CA1]"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Custom Sections Editor — add/remove/pick variant                    */
/* ------------------------------------------------------------------ */

const CUSTOM_VARIANTS: Array<{
  value: NonNullable<WebsiteConfig['customSections']>[number]['variant'];
  label: string;
  description: string;
}> = [
  {
    value: 'image-strip',
    label: 'Image strip',
    description: '2–5 images in a row with captions',
  },
  {
    value: 'image-text-split',
    label: 'Image + text',
    description: 'Big image on one side, paragraph on the other',
  },
  {
    value: 'feature-row',
    label: 'Feature row',
    description: '2–4 small cards with icon + title + description',
  },
  {
    value: 'pull-quote',
    label: 'Pull quote',
    description: 'Big centered quote with attribution',
  },
];

/**
 * Structural editor for `customSections` — append to the Items tab.
 * Agencies add a new section, pick one of four layout variants, then
 * edit the heading/body + per-item content inline below.
 */
export function CustomSectionsEditor({
  config,
  onChange,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
}) {
  const sections = config.customSections ?? [];

  const addSection = (
    variant: NonNullable<WebsiteConfig['customSections']>[number]['variant'],
  ) => {
    const base = { variant, heading: 'New section', body: '' };
    const newSection =
      variant === 'image-strip'
        ? { ...base, items: [{}, {}, {}] }
        : variant === 'image-text-split'
          ? { ...base, items: [{}], body: 'Tell the story here.' }
          : variant === 'feature-row'
            ? {
                ...base,
                items: [
                  { title: 'First thing', description: 'What it does.', icon: 'Sparkles' },
                  { title: 'Second', description: 'What it does.', icon: 'Star' },
                  { title: 'Third', description: 'What it does.', icon: 'CheckCircle2' },
                ],
              }
            : {
                // pull-quote
                ...base,
                heading: undefined,
                body: 'The quote goes here.',
                caption: '— Author',
              };

    const nextSections = [...sections, newSection];
    const nextLayout = (config.layout ?? []).includes('custom')
      ? config.layout
      : [
          ...(config.layout ?? []).filter((k) => k !== 'footer'),
          'custom' as const,
          'footer' as const,
        ];
    onChange({
      ...config,
      customSections: nextSections,
      layout: nextLayout,
    });
  };

  return (
    <ArrayBlock
      icon={<Layers className="h-3.5 w-3.5" />}
      label="Custom sections"
      count={sections.length}
      onAdd={() => addSection('image-strip')}
      addLabel="Add section"
      emptyHint="No custom sections yet."
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {CUSTOM_VARIANTS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => addSection(v.value)}
            className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
            title={v.description}
          >
            + {v.label}
          </button>
        ))}
      </div>
      {sections.map((s, i) => {
        const updateSection = (patch: Partial<NonNullable<WebsiteConfig['customSections']>[number]>) => {
          const next = [...sections];
          next[i] = { ...next[i]!, ...patch };
          onChange({ ...config, customSections: next });
        };
        const moveSection = (dir: -1 | 1) => {
          const next = [...sections];
          const j = i + dir;
          if (j < 0 || j >= next.length) return;
          [next[i], next[j]] = [next[j]!, next[i]!];
          onChange({ ...config, customSections: next });
        };
        return (
          <ExpandableItemRow
            key={`cs-${i}`}
            summary={
              s.heading ||
              CUSTOM_VARIANTS.find((v) => v.value === s.variant)?.label ||
              'Section'
            }
            summarySecondary={`${s.variant} · ${s.items?.length ?? 0} ${
              s.items?.length === 1 ? 'item' : 'items'
            }`}
            onMoveUp={i > 0 ? () => moveSection(-1) : undefined}
            onMoveDown={i < sections.length - 1 ? () => moveSection(1) : undefined}
            onRemove={async () => {
              if (
                !(await confirmDialog({
                  title: 'Remove this custom section?',
                  description: s.heading ?? s.variant,
                  confirmLabel: 'Remove',
                  danger: true,
                }))
              )
                return;
              onChange({
                ...config,
                customSections: sections.filter((_, j) => j !== i),
              });
            }}
          >
            <FieldGrid>
              <LabelledField label="Variant">
                <select
                  value={s.variant}
                  onChange={(e) =>
                    updateSection({
                      variant: e.target
                        .value as NonNullable<WebsiteConfig['customSections']>[number]['variant'],
                    })
                  }
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                >
                  {CUSTOM_VARIANTS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </LabelledField>
              <LabelledField label="Background">
                <select
                  value={s.background ?? 'white'}
                  onChange={(e) =>
                    updateSection({
                      background: e.target.value as 'white' | 'slate' | 'brand',
                    })
                  }
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="white">White</option>
                  <option value="slate">Slate</option>
                  <option value="brand">Brand</option>
                </select>
              </LabelledField>
            </FieldGrid>
            <LabelledField label="Eyebrow (optional)">
              <Input
                value={s.eyebrow ?? ''}
                onChange={(e) => updateSection({ eyebrow: e.target.value })}
                placeholder="Short kicker"
                maxLength={60}
              />
            </LabelledField>
            {s.variant !== 'pull-quote' ? (
              <LabelledField label="Heading">
                <Input
                  value={s.heading ?? ''}
                  onChange={(e) => updateSection({ heading: e.target.value })}
                  placeholder="Section heading"
                  maxLength={120}
                />
              </LabelledField>
            ) : null}
            <LabelledField
              label={s.variant === 'pull-quote' ? 'Quote' : 'Body copy'}
              hint={s.variant === 'pull-quote' ? 'the quote itself' : 'shown under the heading'}
            >
              <Textarea
                value={s.body ?? ''}
                onChange={(e) => updateSection({ body: e.target.value })}
                rows={s.variant === 'pull-quote' ? 3 : 2}
                placeholder={
                  s.variant === 'pull-quote'
                    ? '"The quote goes here."'
                    : 'Body copy'
                }
                maxLength={600}
              />
            </LabelledField>
            {s.variant === 'pull-quote' ? (
              <LabelledField label="Attribution">
                <Input
                  value={s.caption ?? ''}
                  onChange={(e) => updateSection({ caption: e.target.value })}
                  placeholder="— Sarah, owner"
                  maxLength={150}
                />
              </LabelledField>
            ) : null}
            {s.variant === 'image-text-split' ? (
              <LabelledField label="Image side">
                <div className="flex gap-1.5">
                  {(['left', 'right'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => updateSection({ imageSide: side })}
                      className={`flex-1 rounded-md border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                        (s.imageSide ?? 'left') === side
                          ? 'border-[#1D9CA1] bg-[#1D9CA1] text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </LabelledField>
            ) : null}

            {/* Items editor for section variants that have them */}
            {s.variant !== 'pull-quote' ? (
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Items · {s.items?.length ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSection({
                        items: [...(s.items ?? []), {}],
                      })
                    }
                    className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#1D9CA1] hover:underline"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Add item
                  </button>
                </div>
                <div className="space-y-1">
                  {(s.items ?? []).map((item, ii) => {
                    const updateItem = (
                      patch: Partial<
                        NonNullable<
                          NonNullable<WebsiteConfig['customSections']>[number]['items']
                        >[number]
                      >,
                    ) => {
                      const items = [...(s.items ?? [])];
                      items[ii] = { ...items[ii]!, ...patch };
                      updateSection({ items });
                    };
                    return (
                      <ExpandableItemRow
                        key={`cs-${i}-item-${ii}`}
                        summary={
                          item.title ||
                          item.caption ||
                          (typeof item.imageIndex === 'number'
                            ? `Image [${item.imageIndex}]`
                            : `Item ${ii + 1}`)
                        }
                        summarySecondary={item.description ?? ''}
                        onRemove={() =>
                          updateSection({
                            items: (s.items ?? []).filter((_, k) => k !== ii),
                          })
                        }
                      >
                        {s.variant === 'feature-row' ? (
                          <>
                            <LabelledField label="Title">
                              <Input
                                value={item.title ?? ''}
                                onChange={(e) =>
                                  updateItem({ title: e.target.value })
                                }
                                maxLength={80}
                              />
                            </LabelledField>
                            <LabelledField label="Description">
                              <Textarea
                                value={item.description ?? ''}
                                onChange={(e) =>
                                  updateItem({ description: e.target.value })
                                }
                                rows={2}
                                maxLength={200}
                              />
                            </LabelledField>
                            <LabelledField label="Icon">
                              <select
                                value={item.icon ?? ''}
                                onChange={(e) =>
                                  updateItem({ icon: e.target.value || undefined })
                                }
                                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                              >
                                <option value="">(none)</option>
                                {AVAILABLE_ICONS.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            </LabelledField>
                          </>
                        ) : (
                          <>
                            <FieldGrid>
                              <LabelledField
                                label="Image index"
                                hint="from Images tab"
                              >
                                <Input
                                  type="number"
                                  min={0}
                                  value={item.imageIndex ?? ''}
                                  onChange={(e) =>
                                    updateItem({
                                      imageIndex:
                                        e.target.value === ''
                                          ? undefined
                                          : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0"
                                />
                              </LabelledField>
                              <LabelledField label="Or URL">
                                <Input
                                  type="url"
                                  value={item.imageUrl ?? ''}
                                  onChange={(e) =>
                                    updateItem({ imageUrl: e.target.value })
                                  }
                                  placeholder="https://..."
                                />
                              </LabelledField>
                            </FieldGrid>
                            <LabelledField label="Caption (optional)">
                              <Input
                                value={item.caption ?? ''}
                                onChange={(e) =>
                                  updateItem({ caption: e.target.value })
                                }
                                maxLength={150}
                              />
                            </LabelledField>
                          </>
                        )}
                      </ExpandableItemRow>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </ExpandableItemRow>
        );
      })}
    </ArrayBlock>
  );
}


/**
 * Row in the Images tab's Library. Shows the thumbnail + the AI-generated
 * description as an editable textarea. The description is used by the
 * website generator to pick which photos suit which sections — agencies
 * often want to correct what the AI guessed (e.g. "woman holding coffee"
 * vs "barista pulling espresso") before a regeneration.
 *
 * Saves on blur. Quality score (when set) is shown as a tiny readonly
 * chip so agencies can see at a glance which photos Claude rated best.
 */
function LibraryImageRow({
  row,
  onLabelChange,
}: {
  row: {
    id: string;
    fileUrl: string;
    aiDescription?: string | null;
    qualityScore?: number | null;
    status?: string | null;
  };
  onLabelChange?: (id: string, aiDescription: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState(row.aiDescription ?? '');
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    setValue(row.aiDescription ?? '');
  }, [row.aiDescription]);

  const commit = async () => {
    const trimmed = value.trim();
    if (trimmed === (row.aiDescription ?? '').trim()) return;
    if (!onLabelChange) return;
    setSavingState('saving');
    try {
      await onLabelChange(row.id, trimmed);
      setSavingState('saved');
      setTimeout(() => setSavingState('idle'), 1200);
    } catch {
      setSavingState('idle');
    }
  };

  return (
    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={row.fileUrl}
        alt=""
        className="h-14 w-14 shrink-0 rounded-lg object-cover"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {row.qualityScore != null ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
                row.qualityScore >= 8
                  ? 'bg-emerald-100 text-emerald-700'
                  : row.qualityScore >= 5
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
              }`}
              title={`Quality score ${row.qualityScore}/10`}
            >
              {row.qualityScore}/10
            </span>
          ) : null}
          {row.status ? (
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              {row.status}
            </span>
          ) : null}
          {savingState === 'saving' ? (
            <span className="text-[10px] text-slate-500">saving…</span>
          ) : savingState === 'saved' ? (
            <span className="text-[10px] text-emerald-600">saved ✓</span>
          ) : null}
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          rows={2}
          placeholder="AI couldn't describe this one — add a label so the generator knows what it is"
          className="mt-1 w-full resize-none rounded-md border border-transparent bg-slate-50 px-2 py-1 text-[11px] text-slate-700 transition-colors focus:border-[#1D9CA1] focus:bg-white focus:outline-none"
        />
      </div>
    </div>
  );
}


/**
 * Dropdown-style variant picker used by blocks that have multiple card
 * layouts (team today, more later when Aceternity components get added).
 *
 * When `allowDefault` is true, a leading "Default" option lets the user
 * clear a per-item override and fall back to the block-level variant.
 */
function VariantPicker<V extends string>({
  label,
  value,
  options,
  onChange,
  allowDefault = false,
  blockDefault,
}: {
  label: string;
  value: V | undefined;
  options: Array<{ value: V; label: string; hint?: string }>;
  onChange: (v: V | undefined) => void;
  allowDefault?: boolean;
  blockDefault?: V;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          if (allowDefault && v === '') onChange(undefined);
          else onChange(v as V);
        }}
        className="mt-0.5 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px]"
      >
        {allowDefault ? (
          <option value="">
            {blockDefault
              ? `Default (${options.find((o) => o.value === blockDefault)?.label ?? blockDefault})`
              : 'Default'}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
            {opt.hint ? ` — ${opt.hint}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

const TEAM_VARIANT_OPTIONS = [
  { value: 'portrait', label: 'Portrait', hint: 'Tall photo + full info' },
  { value: 'minimal', label: 'Minimal', hint: 'Avatar + name + role' },
  { value: 'quote', label: 'Quote', hint: 'Avatar + bio as a quote card' },
  { value: 'banner', label: 'Banner', hint: 'Wide landscape with overlay' },
  { value: 'light-bg', label: 'Light cards', hint: 'Aceternity light cards with hover lift' },
  { value: 'small-avatars', label: 'Stacked avatars', hint: 'Aceternity overlapping avatars with tooltips' },
  { value: 'card-hover', label: 'Hover-glow cards', hint: 'Aceternity dark cards with moving hover glow' },
] as const satisfies Array<{
  value: NonNullable<NonNullable<WebsiteConfig['team']>['variant']>;
  label: string;
  hint?: string;
}>;

/**
 * Member-level variants — only the card layouts, because the full-section
 * variants (`light-bg`, `small-avatars`) replace the entire grid and
 * don't make sense as per-card overrides.
 */
const TEAM_MEMBER_VARIANT_OPTIONS = [
  { value: 'portrait', label: 'Portrait', hint: 'Tall photo + full info' },
  { value: 'minimal', label: 'Minimal', hint: 'Avatar + name + role' },
  { value: 'quote', label: 'Quote', hint: 'Avatar + bio as a quote card' },
  { value: 'banner', label: 'Banner', hint: 'Wide landscape with overlay' },
] as const satisfies Array<{
  value: NonNullable<
    NonNullable<NonNullable<WebsiteConfig['team']>['members']>[number]['variant']
  >;
  label: string;
  hint?: string;
}>;


/** Numbered step row used by the DomainEditor onboarding guide. */
function DomainStep({
  n,
  title,
  detail,
}: {
  n: number;
  title: string;
  detail: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: '#1D9CA1' }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{detail}</p>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Code tab — raw JSON config editor for power users.                 */
/* ------------------------------------------------------------------ */

/**
 * Shows the full `WebsiteConfig` as editable JSON. Parse + basic shape
 * validation runs on Apply. Unlike the visual editors this doesn't know
 * about any particular field — so if you delete a required top-level key
 * we refuse the save and explain why.
 *
 * Safety:
 *   - Apply is only enabled when the text is valid JSON AND passes the
 *     minimum-shape check (must be an object with a `brand` key, since
 *     every renderer downstream assumes that).
 *   - We run `sanitizeConfig` after parse so pasted configs with sparse
 *     array holes (a common hand-edit mistake) get cleaned automatically.
 *   - "Reset" restores the last-loaded config so a bad edit can't get
 *     stuck in the editor.
 *   - "Download" + "Upload" let you version-control the config offline
 *     (handy before big hand edits).
 */
function CodeEditor({
  config,
  onChange,
}: {
  config: WebsiteConfig;
  onChange: (next: WebsiteConfig) => void;
}) {
  // Pretty-print the current config. Memoized so it only re-runs when the
  // upstream config object actually changes — not on every re-render (which
  // would trigger the sync useEffect below unnecessarily).
  const serialized = useMemo(() => JSON.stringify(config, null, 2), [config]);
  const [text, setText] = useState(serialized);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset the local buffer whenever the upstream config changes AND the
  // user isn't in the middle of editing. If they are editing (`dirty`),
  // keep their work — they can press Reset if they want to discard it.
  useEffect(() => {
    if (!dirty) {
      setText(serialized);
      setError(null);
    }
  }, [serialized, dirty]);

  const handleChange = (value: string) => {
    setText(value);
    setDirty(value !== serialized);
    // Live validate so the user sees "Ready to apply" vs "Invalid JSON"
    // before clicking Apply.
    if (value.trim() === '') {
      setError('Config cannot be empty.');
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Config must be a JSON object (not an array or primitive).');
        return;
      }
      if (!parsed.brand || typeof parsed.brand !== 'object') {
        setError('Config is missing the required "brand" object.');
        return;
      }
      setError(null);
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  const apply = () => {
    if (error) return;
    try {
      const parsed = JSON.parse(text) as WebsiteConfig;
      // Run sanitize to strip null array holes before handing it upstream.
      const clean = sanitizeConfig(parsed);
      onChange(clean);
      setDirty(false);
      setText(JSON.stringify(clean, null, 2));
      toast.success('Config applied. Saving…');
    } catch (e) {
      toast.error(`Couldn't apply: ${(e as Error).message}`);
    }
  };

  const reset = async () => {
    if (dirty) {
      const ok = await confirmDialog({
        title: 'Discard local edits?',
        description: 'Your unsaved JSON changes will be lost.',
        confirmLabel: 'Discard',
        danger: true,
      });
      if (!ok) return;
    }
    setText(serialized);
    setDirty(false);
    setError(null);
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — try selecting the text manually.");
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `website-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      handleChange(content);
      toast.success('Loaded — review then click Apply to save.');
    } catch {
      toast.error("Couldn't read that file.");
    } finally {
      // Clear the input so uploading the same file twice still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
        <p className="font-semibold">
          <Code2 className="mr-1 inline h-3 w-3 -translate-y-px" />
          Raw config editor
        </p>
        <p className="mt-1 leading-relaxed">
          This is the full JSON config that drives your site. Hand-edit any value
          then click Apply to save. Changes sync with the visual editors — nothing
          is locked. If something breaks the renderer, hit Reset to roll back.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          onClick={apply}
          disabled={!dirty || !!error}
          className="gap-1"
        >
          <Check className="h-3.5 w-3.5" />
          Apply
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={reset}
          disabled={!dirty}
          className="gap-1"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        <div className="mx-1 h-4 w-px bg-slate-200" />
        <Button size="sm" variant="outline" onClick={copyAll} className="gap-1">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={download} className="gap-1">
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onUpload}
        />
      </div>

      {/* Status line */}
      <div
        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
          error
            ? 'bg-red-50 text-red-700'
            : dirty
              ? 'bg-amber-50 text-amber-800'
              : 'bg-emerald-50 text-emerald-700'
        }`}
      >
        {error ? (
          <>
            <AlertCircle className="mr-1 inline h-3 w-3 -translate-y-px" />
            {error}
          </>
        ) : dirty ? (
          'Unsaved changes — click Apply to save.'
        ) : (
          <>
            <Check className="mr-1 inline h-3 w-3 -translate-y-px" />
            Synced with the live config.
          </>
        )}
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        className="w-full rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100 outline-none focus:border-[#1D9CA1]"
        style={{ minHeight: '500px', tabSize: 2 }}
        // Tab key inserts two spaces instead of jumping focus — critical
        // for a code-ish editor so indentation stays usable. Shift+Tab
        // removes up to two leading spaces at the caret.
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart;
          const end = el.selectionEnd;
          if (e.shiftKey) {
            // Outdent: strip up to 2 leading spaces from the line at caret.
            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
            const leading = text.slice(lineStart, start).match(/^ {1,2}/)?.[0] ?? '';
            if (!leading) return;
            const next = text.slice(0, lineStart) + text.slice(lineStart + leading.length);
            handleChange(next);
            requestAnimationFrame(() => {
              el.selectionStart = el.selectionEnd = start - leading.length;
            });
          } else {
            // Indent: insert two spaces at caret (collapsed selection) or
            // at the start for a ranged selection (doesn't multi-line indent
            // but at least doesn't nuke the selection).
            const next = `${text.slice(0, start)}  ${text.slice(end)}`;
            handleChange(next);
            requestAnimationFrame(() => {
              el.selectionStart = el.selectionEnd = start + 2;
            });
          }
        }}
      />

      <p className="text-[10px] leading-relaxed text-slate-500">
        Tip: Apply validates the JSON and runs it through the same sanitizer the
        live site uses. Broken shapes (missing <code>brand</code>, non-object
        root) are refused before they can reach the renderer.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Variant picker sheet — the preview-before-add gallery              */
/* ------------------------------------------------------------------ */

/**
 * Full-panel overlay that shows every available variant for a block as a
 * thumbnail grid. Lets the user see what they're adding before committing.
 *
 * Behaviour:
 *   - Opens when the user clicks "Add section" on a variant-capable block
 *     or the Layers icon next to an existing block
 *   - Click a card → `onPick(variantId)` fires
 *   - Click outside / Close / Esc → `onClose()` fires
 *   - Filter by tag (Modern, Minimal, Local, etc.) narrows the grid
 *   - Search bar filters by label / description
 *
 * Renders its own portal-free overlay inside the editor card — keeps the
 * preview visible behind it so you can still eyeball the current state
 * while picking.
 */
function VariantPickerSheet({
  block,
  currentVariantId,
  alreadyInLayout,
  onClose,
  onPick,
  config,
}: {
  block: SiteBlockKey;
  currentVariantId: string | undefined;
  alreadyInLayout: boolean;
  onClose: () => void;
  onPick: (variantId: string) => void;
  /**
   * Current config passed through so the picker can warn when a variant
   * needs more data than the client has (e.g. a 3-member layout picked
   * with 1 member entered).
   */
  config: WebsiteConfig;
}) {
  const variants = getVariantsFor(block);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<VariantTag | 'all'>('all');

  // Build the tag list from what's actually in use. No point showing
  // "Playful" if nothing in the current block supports it.
  const tagsInUse = useMemo(() => {
    const set = new Set<VariantTag>();
    for (const v of variants) {
      for (const t of v.tags ?? []) set.add(t);
    }
    return ALL_VARIANT_TAGS.filter((t) => set.has(t));
  }, [variants]);

  const filtered = variants.filter((v) => {
    if (activeTag !== 'all' && !(v.tags ?? []).includes(activeTag)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      v.label.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q)
    );
  });

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Pick a ${BLOCK_LABELS[block]} style`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {alreadyInLayout ? 'Change' : 'Pick'} a {BLOCK_LABELS[block]} style
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {variants.length} {variants.length === 1 ? 'option' : 'options'}.
              Click to {alreadyInLayout ? 'swap' : 'add'}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search + tag filter */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-2.5">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search styles…"
            className="h-8 max-w-[200px] flex-1 text-xs"
          />
          <div className="flex flex-wrap gap-1">
            <TagPill
              label="All"
              active={activeTag === 'all'}
              onClick={() => setActiveTag('all')}
            />
            {tagsInUse.map((t) => (
              <TagPill
                key={t}
                label={t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')}
                active={activeTag === t}
                onClick={() => setActiveTag(t)}
              />
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-500">
              No styles match that filter.
            </div>
          ) : (
            filtered.map((v) => {
              const check = checkVariantRequirements(v, config);
              return (
                <VariantCard
                  key={v.id}
                  variant={v}
                  isCurrent={v.id === currentVariantId}
                  requirementCheck={check}
                  onClick={() => onPick(v.id)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/** Small filter pill used in the picker's tag row. */
function TagPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-[#1D9CA1] text-white'
          : 'bg-white text-slate-600 border border-slate-200 hover:border-[#1D9CA1] hover:text-[#1D9CA1]'
      }`}
    >
      {label}
    </button>
  );
}

/** Individual thumbnail card in the picker grid. */
function VariantCard({
  variant,
  isCurrent,
  requirementCheck,
  onClick,
}: {
  variant: VariantOption;
  isCurrent: boolean;
  requirementCheck?: { met: boolean; missing: Array<{ current: number; minItems: number; hint: string }> };
  onClick: () => void;
}) {
  const needsData = requirementCheck && !requirementCheck.met;
  return (
    <button
      onClick={onClick}
      disabled={variant.comingSoon}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none ${
        isCurrent
          ? 'border-[#1D9CA1] ring-2 ring-[#1D9CA1]/30'
          : needsData
            ? 'border-amber-300 hover:border-amber-400'
            : 'border-slate-200 hover:border-[#1D9CA1]/60'
      }`}
      title={
        needsData
          ? `This style needs more content: ${requirementCheck!.missing
              .map((m) => m.hint)
              .join('; ')}`
          : undefined
      }
    >
      {/* Thumbnail */}
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-slate-50">
        {/* The preview is an SVG data URI — it's the registry's stylized
            thumbnail for this variant. Alt is intentionally descriptive. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={variant.preview}
          alt={`${variant.label} preview`}
          className="h-full w-full object-cover"
        />
        {variant.aceternity ? (
          <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
            Pro
          </span>
        ) : null}
        {variant.animated ? (
          <span
            className="absolute right-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700"
            title="This variant has motion"
          >
            ⚡ Animated
          </span>
        ) : null}
        {isCurrent ? (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-[#1D9CA1] px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <Check className="h-2.5 w-2.5" />
            Current
          </span>
        ) : null}
      </div>

      {/* Text */}
      <div className="flex flex-1 flex-col p-3">
        <p className="text-xs font-semibold text-slate-900">{variant.label}</p>
        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-500">
          {variant.description}
        </p>
        {needsData ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Needs more content
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {requirementCheck!.missing.map((m, i) => (
                <li key={i} className="text-[10px] leading-snug text-amber-900">
                  {m.current}/{m.minItems} · {m.hint}
                </li>
              ))}
            </ul>
          </div>
        ) : variant.requires && variant.requires.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {variant.requires.map((r) => (
              <span
                key={r.field}
                className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-800"
                title={r.field}
              >
                ✓ {r.hint}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}


/* ------------------------------------------------------------------ */
/* Illustration Editor — big scroll-driven hero object                 */
/* ------------------------------------------------------------------ */

const ILLUSTRATION_MOTIONS: Array<{
  value: HeroIllustrationMotion;
  label: string;
  description: string;
}> = [
  { value: 'parallax', label: 'Parallax', description: 'Smooth scroll-Y, slight zoom out. Safe default.' },
  { value: 'launch', label: 'Launch', description: 'Rocket-style flight up on scroll.' },
  { value: 'float', label: 'Float', description: 'Gentle bob, no scroll dependency.' },
  { value: 'drift', label: 'Drift', description: 'Diagonal drift across the hero on scroll.' },
  { value: 'orbit', label: 'Orbit', description: 'Continuous small circular motion.' },
  { value: 'tilt-3d', label: 'Tilt 3D', description: 'Follows the cursor in 3D. Desktop only.' },
  { value: 'pulse', label: 'Pulse', description: 'Gentle scale breathing.' },
  { value: 'spin', label: 'Spin', description: 'Slow continuous rotation. Best for round shapes.' },
  { value: 'sway', label: 'Sway', description: 'Metronome left-right rotation.' },
  { value: 'wobble', label: 'Wobble', description: 'Playful jiggle. Kids / playful brands.' },
  { value: 'bounce', label: 'Bounce', description: 'Rhythmic vertical bounce.' },
  { value: 'shake', label: 'Shake', description: 'Occasional horizontal shake.' },
  { value: 'zoom-in', label: 'Zoom-in', description: 'Scales up as you scroll past.' },
  { value: 'flip-y', label: 'Flip-in', description: '180° Y-axis flip on mount.' },
  { value: 'reveal', label: 'Reveal', description: 'Cinematic slide-up + fade on scroll.' },
  { value: 'fade-in', label: 'Fade-in', description: 'Minimal scroll-driven opacity.' },
  { value: 'slide-in', label: 'Slide-in', description: 'Enters from off-canvas on scroll.' },
  { value: 'none', label: 'None', description: 'Static. No motion.' },
];

/**
 * Editor for the scroll-driven hero illustration. Agencies can:
 *   - Pick a built-in style (rocket, wrench, coffee cup, etc.), brand-tinted.
 *   - Choose a motion preset (launch, parallax, float, drift, orbit, tilt-3d, none).
 *   - Tweak side (left/right) and size (0.5–1.5×).
 *   - Upload a custom SVG/PNG to override the built-in style.
 *   - Store a prompt alongside the illustration for future regeneration.
 *   - Ask the AI to tweak the illustration in natural language
 *     ("make it bigger on the left", "swap to a coffee cup", "try
 *     tilt-3d") — this uses the same `editWebsiteWithAI` pipeline as
 *     the main site editor chat so the prompt context is consistent.
 *   - Clear the illustration entirely.
 *
 * Uploads use `api.uploadImages` with an `illustration` tag so they land
 * in the client's media library alongside the rest of the assets.
 */
function IllustrationEditor({
  config,
  onChange,
  clientId,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  clientId: string;
}) {
  const illustration: HeroIllustration | undefined = config.hero?.illustration;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Conversational AI tweak state. When the agency types "make it
  // bigger on the left and swap to a coffee cup", we round-trip the
  // current config through `editWebsiteWithAI` which already has
  // illustration-specific rules baked into its prompt (see
  // apps/api/src/services/websites.ts → editWebsiteWithAI). Keeping
  // this inline with the illustration controls avoids the "scroll
  // down, find the AI chat, describe the same thing" tax.
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  // Model for the scoped illustration edit. Defaults to Sonnet for
  // scoped edits (cheap + fast); agency can override via the picker.
  const [illustrationModel, setIllustrationModel] = useState<AiModelKey>(() => {
    if (typeof window === 'undefined') return defaultModelFor('scoped');
    const stored = window.localStorage.getItem('bmb:ai-illustration-model');
    if (stored === 'opus' || stored === 'sonnet' || stored === 'haiku') {
      return stored;
    }
    return defaultModelFor('scoped');
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('bmb:ai-illustration-model', illustrationModel);
  }, [illustrationModel]);

  // Bespoke illustration generation state. Separate from aiPrompt so
  // the tweaks chat and the generate-from-scratch brief don't collide.
  // Generating runs through fal.ai and sets hero.illustration.customUrl.
  const [bespokeBrief, setBespokeBrief] = useState('');
  const [generating, setGenerating] = useState(false);

  const setField = (patch: Partial<HeroIllustration>) => {
    const next: HeroIllustration = {
      ...(illustration ?? {}),
      ...patch,
    };
    onChange({
      ...config,
      hero: { ...config.hero, illustration: next },
    });
  };

  const clear = () => {
    onChange({
      ...config,
      hero: { ...config.hero, illustration: undefined },
    });
  };

  const enable = () => {
    // Seed with a template-based default so the preview updates immediately.
    const template = config.template ?? 'service';
    const style = DEFAULT_ILLUSTRATION_BY_TEMPLATE[template] ?? 'rocket';
    onChange({
      ...config,
      hero: {
        ...config.hero,
        illustration: {
          style,
          side: 'right',
          scale: 1,
        },
      },
    });
  };

  const onFile = async (file: File) => {
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Pick an image file', 'SVG or transparent PNG works best.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Too large', 'Keep illustrations under 8MB.');
      return;
    }
    setUploading(true);
    try {
      const rows = await api.uploadImages(clientId, [file], ['illustration']);
      const url = rows[0]?.fileUrl;
      if (!url) throw new Error('Upload returned no URL');
      setField({ customUrl: url });
      toast.success('Illustration updated', 'Custom image replaces the built-in style.');
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * Conversational tweaks. Takes a natural-language instruction ("swap
   * to a coffee cup and move it to the left"), prefixes it so Claude
   * scopes the edit to the hero illustration specifically, and routes
   * through the same `editWebsiteWithAI` endpoint as the main site AI
   * chat. The endpoint's system prompt already knows every illustration
   * field (see prompts.ts → editWebsiteWithAI), so the instruction
   * translates into precise config updates.
   */
  const askAIToImprove = async (rawInstruction: string) => {
    const instruction = rawInstruction.trim();
    if (!instruction) return;
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    setAiBusy(true);
    try {
      // Scope the edit to hero.illustration so we send ~100 tokens of
      // context instead of the whole config — prevents the output
      // truncation that caused ERR_EMPTY_RESPONSE on big sites.
      const result = await api.editWebsiteScopedWithAI({
        clientId,
        currentConfig: config as unknown as Record<string, unknown>,
        instruction,
        scope: 'hero.illustration',
        model: illustrationModel,
      });
      onChange(result.config);
      setAiPrompt('');
      toast.success('Illustration updated', result.summary ?? 'Applied your changes.');
    } catch (e) {
      toast.error('AI tweak failed', (e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  /** One-shot prompts shown as quick-tap chips above the AI textarea. */
  const AI_PRESETS: Array<{ label: string; instruction: string }> = [
    { label: 'Bigger', instruction: 'Make the hero illustration a bit bigger.' },
    { label: 'Smaller', instruction: 'Make the hero illustration a bit smaller.' },
    { label: 'Move left', instruction: 'Move the hero illustration to the left side.' },
    { label: 'Move right', instruction: 'Move the hero illustration to the right side.' },
    { label: 'Try tilt-3D', instruction: 'Change the illustration motion to tilt-3d so it follows the cursor.' },
    { label: 'Less motion', instruction: 'Use a calmer motion like float or parallax instead of launch.' },
    {
      label: 'Match the industry',
      instruction:
        'Pick the built-in illustration style that best fits this business and apply it.',
    },
    { label: 'Remove it', instruction: 'Remove the hero illustration entirely.' },
  ];

  /**
   * Generate a bespoke illustration from a natural-language brief. Goes
   * through the new `/api/v1/automation/generate-hero-illustration`
   * endpoint which pipes the brief through fal.ai and writes the
   * resulting image URL into `hero.illustration.customUrl`. Unlike the
   * tweaks above (which only pick from 15 presets), this produces a
   * fresh bespoke illustration.
   */
  const generateBespoke = async (brief: string) => {
    const cleaned = brief.trim();
    if (cleaned.length < 6) {
      toast.info('Describe what you want', 'A short sentence is plenty.');
      return;
    }
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    setGenerating(true);
    try {
      const result = await api.generateHeroIllustration({
        clientId,
        brief: cleaned,
      });
      // Update the local config so the preview updates immediately.
      // The server has already persisted the change to the client row.
      setField({
        customUrl: result.imageUrl,
        prompt: cleaned,
        // Switching to a custom URL drops the built-in style from the
        // renderer's source resolution; we keep motion / side / scale.
        style: undefined,
      });
      setBespokeBrief('');
      toast.success(
        'Illustration generated',
        result.fromMock
          ? 'Using placeholder image (fal.ai not configured).'
          : 'Custom illustration applied to the hero.',
      );
    } catch (e) {
      toast.error('Generation failed', (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const BESPOKE_EXAMPLES: Array<{ label: string; brief: string }> = [
    {
      label: 'Espresso cup',
      brief:
        'An espresso cup with steam rising, stylised and isolated on transparent background.',
    },
    {
      label: 'Wrench',
      brief:
        'A clean vector wrench with subtle gradient, floating at an angle.',
    },
    {
      label: 'House',
      brief:
        'A minimal modern house with warm lighting in the windows.',
    },
    {
      label: 'Dumbbell',
      brief:
        'A sleek dumbbell with motion lines, stylised flat vector.',
    },
  ];

  // Surface a warning when the current hero variant + image will cause
  // the renderer to suppress the illustration. Mirrors the logic in
  // `SiteHero` so the hint stays in sync with the actual render.
  const heroImageSet =
    config.hero?.imageIndex != null || Boolean(config.hero?.aiImageUrl);
  const variantConflict = (() => {
    if (!illustration) return null;
    const variant = config.hero?.variant ?? 'parallax-layers';
    if (variant === 'full-bg-image') {
      return 'The hero variant is Full background image, which fills the whole hero with a photo. Switch the hero variant to see the illustration.';
    }
    if (
      (variant === 'parallax-layers' || variant === 'two-column-image') &&
      heroImageSet &&
      (illustration.side ?? 'right') === 'right'
    ) {
      return `The ${variant} variant already shows the hero photo on the right. Move the illustration to the Left side, or swap the hero variant, to avoid overlap.`;
    }
    return null;
  })();

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">
          Scroll-driven illustration
          {illustration ? (
            illustration.hidden ? (
              <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                Hidden
              </span>
            ) : (
              <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                On
              </span>
            )
          ) : (
            <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              Off
            </span>
          )}
        </p>
        {illustration ? (
          <div className="flex items-center gap-1">
            {/* Hide / show toggle — keeps all config (style, customUrl,
                prompt, motion) intact so the agency can flip the
                illustration off temporarily without losing work. */}
            <button
              type="button"
              onClick={() => setField({ hidden: !illustration.hidden })}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                illustration.hidden
                  ? 'border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
              }`}
              title={
                illustration.hidden
                  ? 'Show the illustration again'
                  : 'Hide the illustration without deleting its configuration'
              }
            >
              {illustration.hidden ? 'Show' : 'Hide'}
            </button>
            <button
              type="button"
              onClick={clear}
              className="text-[10px] font-medium text-slate-500 hover:text-rose-600"
              title="Delete the illustration entirely"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={enable}
            className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
          >
            Add illustration
          </button>
        )}
      </div>

      <p className="text-[10px] text-slate-400">
        A big scroll-animated object next to the hero copy, brand-tinted
        automatically. Think of the rocket on our marketing page, but keyed
        to the business. Hidden automatically when the hero variant already
        shows a large photo on the same side.
      </p>

      {/* Empty-state CTA. When there's no illustration yet, surface both
          the "pick a style" shortcut and an AI shortcut so the agency
          doesn't have to enable then immediately reconfigure. */}
      {!illustration ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-[#1D9CA1]" />
          <p className="mt-1.5 text-xs font-semibold text-slate-900">
            No illustration yet
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Add a brand-tinted scroll-animated object to the hero.
          </p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
            <button
              type="button"
              onClick={enable}
              className="inline-flex items-center gap-1 rounded-full bg-[#1D9CA1] px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#158087]"
            >
              <Plus className="h-3 w-3" />
              Add for this industry
            </button>
            <button
              type="button"
              onClick={() =>
                askAIToImprove(
                  'Enable the hero illustration. Pick the built-in style that best fits this business, choose a motion preset that matches the brand tone, and place it on the right side.',
                )
              }
              disabled={aiBusy || !clientId}
              className="inline-flex items-center gap-1 rounded-full border border-[#1D9CA1]/30 bg-white px-3 py-1 text-[11px] font-semibold text-[#1D9CA1] transition-colors hover:bg-[#1D9CA1]/5 disabled:opacity-50"
            >
              {aiBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Ask AI to pick
            </button>
          </div>
        </div>
      ) : null}

      {/* Conflict warning — shown when the current hero variant hides
          the illustration so the agency isn't left wondering why the
          preview is empty. */}
      {variantConflict ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <span className="font-semibold">Heads up. </span>
          {variantConflict}
        </div>
      ) : null}

      {illustration ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          {/* Style picker grid (built-in SVGs) */}
          {!illustration.customUrl && !illustration.customSvg ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Style
                  <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                    {ILLUSTRATION_STYLES.length}
                  </span>
                </p>
              </div>
              <StylePicker
                currentStyle={illustration.style}
                onPick={(style) => {
                  // Picking a built-in style clears any custom SVG so
                  // the renderer shows the selected vector.
                  setField({ style, customSvg: undefined });
                }}
              />
            </div>
          ) : illustration.customSvg ? (
            <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-white p-2">
              <div
                className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 p-1 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: illustration.customSvg }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-violet-700">
                  AI-generated SVG
                </p>
                <p className="truncate text-[10px] text-slate-500">
                  {illustration.prompt ?? 'Custom vector'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const template = config.template ?? 'service';
                  const fallbackStyle =
                    DEFAULT_ILLUSTRATION_BY_TEMPLATE[template] ?? 'rocket';
                  setField({
                    customSvg: undefined,
                    style: illustration.style ?? fallbackStyle,
                  });
                }}
                className="rounded-md px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100"
              >
                Use built-in
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={illustration.customUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-contain p-1"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-slate-800">
                  Custom image
                </p>
                <p className="truncate text-[10px] text-slate-500">
                  {illustration.customUrl}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const template = config.template ?? 'service';
                  const fallbackStyle =
                    DEFAULT_ILLUSTRATION_BY_TEMPLATE[template] ?? 'rocket';
                  setField({
                    customUrl: undefined,
                    style: illustration.style ?? fallbackStyle,
                  });
                }}
                className="rounded-md px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100"
              >
                Use built-in
              </button>
            </div>
          )}

          {/* Motion — when unset, show which preset the renderer will
              use (matches the default-motion-for-style mapping in the
              illustration layer) so the pill accurately reflects what
              the user will see. */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Motion
              {illustration.motion == null ? (
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                  auto
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ILLUSTRATION_MOTIONS.map((m) => {
                const effective =
                  illustration.motion ?? defaultMotionForStyle(illustration.style);
                const isSelected = effective === m.value;
                const isExplicit = illustration.motion === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setField({ motion: m.value })}
                    title={m.description}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      isSelected
                        ? isExplicit
                          ? 'border-[#1D9CA1] bg-[#1D9CA1] text-white'
                          : 'border-[#1D9CA1]/40 bg-[#1D9CA1]/10 text-[#1D9CA1]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side + scale */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Side
              </p>
              <div className="flex gap-1.5">
                {(['left', 'right'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setField({ side: s })}
                    className={`flex-1 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${
                      (illustration.side ?? 'right') === s
                        ? 'border-[#1D9CA1] bg-[#1D9CA1] text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Size · {(illustration.scale ?? 1).toFixed(2)}×
              </p>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={illustration.scale ?? 1}
                onChange={(e) => setField({ scale: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {/* Motion speed + intensity — only meaningful once a motion
              preset is applied. Speed multiplies keyframe duration;
              intensity scales travel distance and angle. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <span>Speed · {(illustration.motionSpeed ?? 1).toFixed(2)}×</span>
                {illustration.motionSpeed != null && illustration.motionSpeed !== 1 ? (
                  <button
                    type="button"
                    onClick={() => setField({ motionSpeed: 1 })}
                    className="text-[9px] font-normal text-slate-400 hover:text-[#1D9CA1]"
                  >
                    reset
                  </button>
                ) : null}
              </p>
              <input
                type="range"
                min={0.25}
                max={4}
                step={0.05}
                value={illustration.motionSpeed ?? 1}
                onChange={(e) => setField({ motionSpeed: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <p className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                <span>Intensity · {(illustration.motionIntensity ?? 1).toFixed(2)}×</span>
                {illustration.motionIntensity != null && illustration.motionIntensity !== 1 ? (
                  <button
                    type="button"
                    onClick={() => setField({ motionIntensity: 1 })}
                    className="text-[9px] font-normal text-slate-400 hover:text-[#1D9CA1]"
                  >
                    reset
                  </button>
                ) : null}
              </p>
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.05}
                value={illustration.motionIntensity ?? 1}
                onChange={(e) => setField({ motionIntensity: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {/* Custom upload */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <p className="text-[10px] text-slate-500">
              Upload your own SVG or transparent PNG to override the built-in style.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !clientId}
              className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1] disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Plus className="h-2.5 w-2.5" />
              )}
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </div>

          {/* Prompt — stored alongside, useful for later regeneration.
              Independent of the hero's aiImagePrompt which drives the
              photo/background image. */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Regeneration brief (optional)
            </label>
            <textarea
              value={illustration.prompt ?? ''}
              onChange={(e) => setField({ prompt: e.target.value })}
              placeholder="e.g. 'a stylised espresso cup with steam in our brand teal' — stored so you can regenerate later."
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-[#1D9CA1] focus:outline-none focus:ring-1 focus:ring-[#1D9CA1]/30"
            />
          </div>

          {/* Ask AI — conversational tweaks scoped to the illustration.
              Sits at the bottom of the panel so it doesn't crowd the
              direct-manipulation controls above, but stays inline so the
              agency doesn't have to scroll to a separate chat. */}
          <div className="rounded-xl border border-[#1D9CA1]/20 bg-[#1D9CA1]/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1D9CA1]">
                <Sparkles className="h-3 w-3" />
                Ask AI to tweak it
              </p>
              <div className="flex items-center gap-1.5">
                {aiBusy ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-[#1D9CA1]">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Thinking…
                  </span>
                ) : null}
                <ModelPicker
                  value={illustrationModel}
                  onChange={setIllustrationModel}
                />
              </div>
            </div>
            <p className="mt-1 text-[10px] text-slate-600">
              Say what to change in plain English. Changes apply live.
            </p>

            {/* Quick-tap presets */}
            <div className="mt-2 flex flex-wrap gap-1">
              {AI_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={aiBusy}
                  onClick={() => askAIToImprove(p.instruction)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1] disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-start gap-1.5">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. 'swap to a wrench and put it on the left with a gentle drift'"
                rows={2}
                disabled={aiBusy}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !aiBusy) {
                    e.preventDefault();
                    askAIToImprove(aiPrompt);
                  }
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-[#1D9CA1] focus:outline-none focus:ring-1 focus:ring-[#1D9CA1]/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => askAIToImprove(aiPrompt)}
                disabled={aiBusy || !aiPrompt.trim()}
                className="flex h-8 shrink-0 items-center gap-1 self-start rounded-lg bg-[#1D9CA1] px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#158087] disabled:opacity-50"
                title="Apply (⌘/Ctrl + Enter)"
              >
                {aiBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Apply
              </button>
            </div>
          </div>

          {/* Generate bespoke illustration — calls fal.ai with a brief,
              drops the resulting URL into hero.illustration.customUrl.
              Different from the tweaks above: this creates a NEW
              illustration from scratch rather than picking from the
              preset library. */}
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700">
                <Wand2 className="h-3 w-3" />
                Generate a bespoke illustration
              </p>
              {generating ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-violet-700">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Drawing…
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[10px] text-slate-600">
              Describe what you want and we&apos;ll draw a custom illustration
              in your brand colours. Replaces the preset style when ready.
            </p>

            {/* Quick-tap examples */}
            <div className="mt-2 flex flex-wrap gap-1">
              {BESPOKE_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  disabled={generating}
                  onClick={() => setBespokeBrief(ex.brief)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 transition-colors hover:border-violet-500 hover:text-violet-700 disabled:opacity-50"
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-start gap-1.5">
              <textarea
                value={bespokeBrief}
                onChange={(e) => setBespokeBrief(e.target.value)}
                placeholder="e.g. 'a 3D isometric barber chair with a brass foot-rest, in our brand teal'"
                rows={2}
                disabled={generating}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !generating) {
                    e.preventDefault();
                    generateBespoke(bespokeBrief);
                  }
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => generateBespoke(bespokeBrief)}
                disabled={generating || bespokeBrief.trim().length < 6}
                className="flex h-8 shrink-0 items-center gap-1 self-start rounded-lg bg-violet-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                title="Generate (⌘/Ctrl + Enter)"
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
                Generate
              </button>
            </div>

            {/* Regen / reset helpers. Shown when a custom URL is set so
                the agency can quickly roll again with the same brief or
                revert to a built-in style. */}
            {illustration.customUrl ? (
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    generateBespoke(
                      illustration.prompt || 'A stylised illustration for this business',
                    )
                  }
                  disabled={generating}
                  className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                  title="Regenerate with the same brief"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Roll again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Fall back to the template-appropriate built-in style
                    // when clearing the custom URL. Going to `undefined`
                    // for both would make the renderer show nothing.
                    const template = config.template ?? 'service';
                    const fallbackStyle =
                      DEFAULT_ILLUSTRATION_BY_TEMPLATE[template] ?? 'rocket';
                    setField({
                      customUrl: undefined,
                      style: illustration.style ?? fallbackStyle,
                    });
                  }}
                  disabled={generating}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Back to built-in
                </button>
              </div>
            ) : null}
          </div>

          {/* SVG Studio — Claude hand-writes a bespoke vector SVG from
              a natural-language brief. Crisper than the raster bespoke
              above; can carry its own inline <animate> tags for shape-
              level animation. */}
          <SvgStudioPanel
            clientId={clientId}
            illustration={illustration}
            onGenerated={(svg, brief) =>
              setField({
                customSvg: svg,
                customUrl: undefined,
                style: undefined,
                prompt: brief,
              })
            }
            onRevertToBuiltIn={() => {
              const template = config.template ?? 'service';
              const fallbackStyle =
                DEFAULT_ILLUSTRATION_BY_TEMPLATE[template] ?? 'rocket';
              setField({
                customSvg: undefined,
                style: illustration.style ?? fallbackStyle,
              });
            }}
            motion={illustration.motion ?? defaultMotionForStyle(illustration.style)}
          />
        </div>
      ) : null}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* StylePicker — grouped-by-category picker with search               */
/* ------------------------------------------------------------------ */

/**
 * Grouped style picker. Categories are tabs; the search input filters
 * across every category and collapses categories with zero matches.
 * Keeps the panel compact even with 60+ styles.
 */
function StylePicker({
  currentStyle,
  onPick,
}: {
  currentStyle: HeroIllustrationStyle | undefined;
  onPick: (style: HeroIllustrationStyle) => void;
}) {
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const filtered = ILLUSTRATION_STYLES.filter((s) => {
    if (category !== 'all' && s.category !== category) return false;
    if (!q) return true;
    return (
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-2">
      {/* Search + category filter row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative min-w-[140px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search styles…"
            className="h-7 w-full rounded-full border border-slate-200 bg-white pl-6 pr-2 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-[#1D9CA1] focus:outline-none"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setCategory('all')}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            category === 'all'
              ? 'bg-[#1D9CA1] text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({ILLUSTRATION_STYLES.length})
        </button>
        {ILLUSTRATION_CATEGORIES.map((c) => {
          const count = ILLUSTRATION_STYLES.filter((s) => s.category === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                category === c.id
                  ? 'bg-[#1D9CA1] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-slate-400">
          No styles match that search.
        </p>
      ) : (
        <div className="grid grid-cols-5 gap-1.5">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              title={`${s.label} — ${s.description}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-lg transition-all ${
                currentStyle === s.id
                  ? 'border-[#1D9CA1] bg-white shadow-sm ring-2 ring-[#1D9CA1]/25'
                  : 'border-slate-200 bg-white hover:border-slate-400'
              }`}
            >
              <span>{s.preview}</span>
              <span className="mt-0.5 truncate px-0.5 text-[8px] font-medium text-slate-600">
                {s.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SvgStudioPanel — Claude-written vector SVG from a prompt            */
/* ------------------------------------------------------------------ */

function SvgStudioPanel({
  clientId,
  illustration,
  onGenerated,
  onRevertToBuiltIn,
  motion,
}: {
  clientId: string;
  illustration: HeroIllustration;
  onGenerated: (svg: string, brief: string) => void;
  onRevertToBuiltIn: () => void;
  motion: HeroIllustrationMotion;
}) {
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [model, setModel] = useState<AiModelKey>(() => {
    if (typeof window === 'undefined') return 'opus';
    const stored = window.localStorage.getItem('bmb:ai-svg-model');
    if (stored === 'opus' || stored === 'sonnet' || stored === 'haiku') return stored;
    return 'opus';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('bmb:ai-svg-model', model);
  }, [model]);

  const presets: Array<{ label: string; brief: string }> = [
    {
      label: 'Brand mark',
      brief:
        'A bold abstract brand mark built around a flowing ribbon or overlapping circles, minimal but memorable.',
    },
    {
      label: 'Craft tool',
      brief:
        'A hand tool that represents this business, drawn in a stylised 3D isometric style with clean edges.',
    },
    {
      label: 'Spherical emblem',
      brief:
        'A glossy spherical emblem with a ring of light around it and a subtle inner highlight.',
    },
    {
      label: 'Geometric',
      brief:
        'A set of layered geometric shapes (hexagons, triangles, arcs) forming an abstract composition.',
    },
    {
      label: 'Mascot',
      brief:
        'A friendly mascot-style illustration that represents the business — round, approachable, simple.',
    },
  ];

  const run = async (text: string) => {
    const cleaned = text.trim();
    if (cleaned.length < 6) {
      toast.info('Describe what you want', 'A short sentence is plenty.');
      return;
    }
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    setBusy(true);
    try {
      const result = await api.generateSvg({
        clientId,
        brief: cleaned,
        motion,
        model,
      });
      if (!result.svg || !result.svg.includes('<svg')) {
        throw new Error('Generator returned no usable SVG');
      }
      onGenerated(result.svg, cleaned);
      setBrief('');
      toast.success(
        'Vector SVG generated',
        result.fromMock
          ? 'Using placeholder (Claude not configured).'
          : 'Hand-drawn by the AI and inlined in the hero.',
      );
    } catch (e) {
      toast.error('SVG generation failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pasteOwnSvg = async () => {
    const text = pasteText.trim();
    if (!text.includes('<svg')) {
      toast.error('Not an SVG', 'Paste the full <svg>...</svg> markup.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.sanitizeSvg(text);
      if (!result.svg) throw new Error('SVG rejected by sanitiser');
      onGenerated(result.svg, 'Pasted SVG');
      setPasteText('');
      setPasting(false);
      toast.success('SVG applied', 'Scripts and handlers stripped for safety.');
    } catch (e) {
      toast.error('SVG rejected', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-fuchsia-700">
          <Sparkles className="h-3 w-3" />
          SVG Studio — generate a vector from scratch
        </p>
        <div className="flex items-center gap-1.5">
          {busy ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-fuchsia-700">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Drawing…
            </span>
          ) : null}
          <ModelPicker value={model} onChange={setModel} />
        </div>
      </div>
      <p className="mt-1 text-[10px] text-slate-600">
        Crisp vector markup written by Claude from your brief. Scales
        to any size and keeps the brand palette. Different from the
        raster generator above.
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={busy}
            onClick={() => setBrief(p.brief)}
            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 transition-colors hover:border-fuchsia-500 hover:text-fuchsia-700 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-start gap-1.5">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. 'a coffee cup with three curls of steam forming our logo monogram inside'"
          rows={2}
          disabled={busy}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !busy) {
              e.preventDefault();
              run(brief);
            }
          }}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => run(brief)}
          disabled={busy || brief.trim().length < 6}
          className="flex h-8 shrink-0 items-center gap-1 self-start rounded-lg bg-fuchsia-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-fuchsia-700 disabled:opacity-50"
          title="Generate (⌘/Ctrl + Enter)"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Draw
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {illustration.customSvg ? (
          <>
            <button
              type="button"
              onClick={() => run(illustration.prompt || 'Redraw the illustration')}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-white px-2 py-0.5 text-[10px] font-medium text-fuchsia-700 hover:bg-fuchsia-50 disabled:opacity-50"
              title="Regenerate with the same brief"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Roll again
            </button>
            <button
              type="button"
              onClick={onRevertToBuiltIn}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Back to built-in
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => setPasting((o) => !o)}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
        >
          {pasting ? 'Cancel' : 'Paste your own SVG'}
        </button>
      </div>

      {pasting ? (
        <div className="mt-2 space-y-1.5">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 480'>…</svg>"
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-[10px] text-slate-700 placeholder:text-slate-400 focus:border-fuchsia-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={pasteOwnSvg}
            disabled={busy || pasteText.trim().length < 20}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
            Apply SVG
          </button>
        </div>
      ) : null}
    </div>
  );
}
