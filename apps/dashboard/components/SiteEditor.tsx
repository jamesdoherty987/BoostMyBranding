'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Reorder } from 'framer-motion';
import type {
  WebsiteConfig,
  SiteBlockKey,
  HeroVariant,
  PageConfig,
} from '@boost/core';
import { DEFAULT_LAYOUT, HERO_VARIANTS, slugify } from '@boost/core';
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
} from 'lucide-react';
import { api } from '@/lib/api';

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
    'sections' | 'content' | 'pages' | 'items' | 'images' | 'hero' | 'brand' | 'ai' | 'domain'
  >('content');

  const hasPages = (config.pages?.length ?? 0) > 0;
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
              activePageSlug={activePageSlug}
              onActivePageSlugChange={onActivePageSlugChange}
            />
          )}
          {tab === 'sections' && (
            <SectionManager
              config={config}
              onChange={onChange}
              activePageSlug={activePageSlug}
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
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  activePageSlug: string;
}) {
  // In a multipage site, `Sections` edits the active page's layout. In a
  // single-page site, it edits the root `layout`. We keep both code paths
  // but give the user a clear banner telling them which page they're
  // editing so they understand why reordering "Services" only changes one
  // page at a time.
  const pages = config.pages ?? [];
  const activePage = pages.find((p) => p.slug === activePageSlug);
  const isMultipage = pages.length > 1;

  const layout: SiteBlockKey[] = isMultipage
    ? activePage?.layout ?? pages[0]?.layout ?? DEFAULT_LAYOUT[config.template ?? 'service']
    : config.layout ?? DEFAULT_LAYOUT[config.template ?? 'service'];
  const available = ALL_BLOCKS.filter((b) => !layout.includes(b));

  const setLayout = (newLayout: SiteBlockKey[]) => {
    if (isMultipage && activePage) {
      onChange({
        ...config,
        pages: pages.map((p) =>
          p.slug === activePage.slug ? { ...p, layout: newLayout } : p,
        ),
      });
    } else {
      onChange({ ...config, layout: newLayout });
    }
  };

  const removeBlock = (block: SiteBlockKey) => {
    if (block === 'nav' || block === 'footer') {
      toast.info('Navigation and footer are required');
      return;
    }
    setLayout(layout.filter((b) => b !== block));
  };

  const addBlock = (block: SiteBlockKey) => {
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
    if (isMultipage && activePage) {
      onChange({
        ...config,
        ...seeded,
        pages: pages.map((p) =>
          p.slug === activePage.slug ? { ...p, layout: newLayout } : p,
        ),
      });
    } else {
      onChange({ ...config, ...seeded, layout: newLayout });
    }

    toast.success(
      `${BLOCK_LABELS[block]} added`,
      seededMessage(block, seeded) ?? 'Reorder from the list above.',
    );
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT[config.template ?? 'service']);
    toast.success('Layout reset to template default');
  };

  return (
    <div className="space-y-4">
      {isMultipage && activePage ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          Editing sections on <strong className="text-slate-900">{activePage.title}</strong>.
          Use the page tabs above the preview to switch.
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Drag to reorder. Click × to remove.</p>
        <button
          onClick={resetLayout}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <Reorder.Group
        axis="y"
        values={layout}
        onReorder={(newOrder) => setLayout(newOrder as SiteBlockKey[])}
        className="space-y-1.5"
      >
        {layout.map((block) => (
          <Reorder.Item
            key={block}
            value={block}
            className="flex cursor-grab items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 active:cursor-grabbing active:shadow-md"
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="flex-1 text-sm font-medium text-slate-900">
              {BLOCK_LABELS[block]}
            </span>
            {block !== 'nav' && block !== 'footer' && (
              <button
                onClick={() => removeBlock(block)}
                className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {available.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Add section</p>
          <div className="flex flex-wrap gap-1.5">
            {available.map((block) => (
              <button
                key={block}
                onClick={() => addBlock(block)}
                className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
              >
                <Plus className="h-3 w-3" />
                {BLOCK_LABELS[block]}
              </button>
            ))}
          </div>
        </div>
      )}
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
  activePageSlug,
  onActivePageSlugChange,
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
  activePageSlug: string;
  onActivePageSlugChange: (slug: string) => void;
}) {
  const pages = config.pages ?? [];
  const activePage = pages.find((p) => p.slug === activePageSlug);
  const MAX_PAGES = 4;

  // Single-page site? Offer to upgrade it to multipage by synthesising a
  // "home" PageConfig from the current root layout. After the upgrade,
  // subsequent "Add a page" clicks append new pages.
  const convertToMultipage = () => {
    const homeLayout =
      config.layout && config.layout.length > 0
        ? config.layout
        : ['nav', 'hero', 'services', 'about', 'contact', 'footer'];
    const base: PageConfig = {
      slug: 'home',
      title: 'Home',
      layout: homeLayout as PageConfig['layout'],
    };
    onChange({ ...config, pages: [base] });
    onActivePageSlugChange('home');
    toast.success(
      'Multipage enabled',
      'Add more pages below. Each one gets its own URL + sections.',
    );
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

  const addPage = () => {
    if (pages.length >= MAX_PAGES) {
      toast.info(`Maximum ${MAX_PAGES} pages`, 'Remove one to add another.');
      return;
    }
    // Pick a slug that isn't in use. Users can rename after.
    const base = 'new-page';
    let slug = base;
    let i = 2;
    while (pages.some((p) => p.slug === slug)) slug = `${base}-${i++}`;
    const newPage: PageConfig = {
      slug,
      title: 'New page',
      layout: ['nav', 'hero', 'services', 'contact', 'footer'],
      hero: {
        headline: 'Something we want to say.',
        subheadline: 'Edit this sub-page to fit the business.',
      },
    };
    onChange({ ...config, pages: [...pages, newPage] });
    onActivePageSlugChange(slug);
    toast.success('Page added', 'Give it a title and edit its content.');
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
            <Plus className="h-3 w-3" />
            Enable multipage
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
              <button
                type="button"
                onClick={() => onActivePageSlugChange(p.slug)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
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
                {!isHome ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePage(p.slug);
                    }}
                    className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Delete ${p.title}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </button>
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
          <Plus className="h-3.5 w-3.5" />
          Add a page
        </Button>
      ) : null}
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
  }, [message, loading, config, onChange, clientId]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Tell the AI what to change. It can modify copy, colors, sections, hero style — anything.
      </p>

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
 * services, reviews, FAQ entries, stats, about bullets. Agencies use this
 * to add a missing service, reorder reviews, or drop a duplicated FAQ
 * that Claude produced. Each list auto-saves via onChange, so changes
 * flow through the existing debounced persist path.
 *
 * Text inside each row is edited inline in the preview — this tab is just
 * for structural changes (add/remove/reorder/pick icon).
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

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Add or remove items from each section. Click any row to edit its text in the preview.
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
          <ItemRow
            key={i}
            primary={s.title || `Service ${i + 1}`}
            secondary={s.description}
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
            <div className="mt-1 flex items-center gap-1">
              <span className="text-[10px] text-slate-400">Icon:</span>
              <select
                value={s.icon ?? 'Sparkles'}
                onChange={(e) => {
                  const next = [...services];
                  next[i] = { ...next[i]!, icon: e.target.value };
                  onChange({ ...config, services: next });
                }}
                className="h-6 rounded border border-slate-200 bg-white px-1 text-[10px]"
              >
                {AVAILABLE_ICONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </ItemRow>
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
          <ItemRow
            key={i}
            primary={`"${(r.text ?? '').slice(0, 60)}${(r.text ?? '').length > 60 ? '…' : ''}"`}
            secondary={`— ${r.author} · ${'★'.repeat(Math.max(1, Math.min(5, Math.round(r.rating ?? 5))))}`}
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
            <div className="mt-1 flex items-center gap-1">
              <span className="text-[10px] text-slate-400">Rating:</span>
              <select
                value={r.rating ?? 5}
                onChange={(e) => {
                  const next = [...reviews];
                  next[i] = { ...next[i]!, rating: Number(e.target.value) };
                  onChange({ ...config, reviews: next });
                }}
                className="h-6 rounded border border-slate-200 bg-white px-1 text-[10px]"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} ★
                  </option>
                ))}
              </select>
            </div>
          </ItemRow>
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
          <ItemRow
            key={i}
            primary={f.question || `Question ${i + 1}`}
            secondary={(f.answer ?? '').slice(0, 80) + ((f.answer ?? '').length > 80 ? '…' : '')}
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
          />
        ))}
      </ArrayBlock>

      {/* Stats */}
      <ArrayBlock
        icon={<Star className="h-3.5 w-3.5" />}
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
          <ItemRow
            key={i}
            primary={`${s.prefix ?? ''}${s.value}${s.suffix ?? ''}`}
            secondary={s.label}
            onRemove={() => {
              onChange({ ...config, stats: stats.filter((_, j) => j !== i) });
            }}
          />
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
            <ItemRow
              key={i}
              primary={b || `Bullet ${i + 1}`}
              secondary=""
              onRemove={() => {
                onChange({
                  ...config,
                  about: {
                    ...config.about!,
                    bullets: bullets.filter((_, j) => j !== i),
                  },
                });
              }}
            />
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
          {(config.menu.categories ?? []).map((cat, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-2.5">
              <div className="flex items-center justify-between">
                <p className="truncate text-xs font-medium text-slate-900">
                  {cat.title || `Section ${i + 1}`}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !(await confirmDialog({
                        title: `Delete "${cat.title}"?`,
                        description: `Removes ${cat.items?.length ?? 0} items from the menu.`,
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
                  className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove category"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                <span>{cat.items?.length ?? 0} items</span>
                <button
                  type="button"
                  onClick={() => {
                    const cats = [...(config.menu!.categories ?? [])];
                    cats[i] = {
                      ...cats[i]!,
                      items: [...(cats[i]?.items ?? []), { name: 'Item', price: '0' }],
                    };
                    onChange({ ...config, menu: { ...config.menu!, categories: cats } });
                  }}
                  className="inline-flex items-center gap-0.5 font-medium text-[#1D9CA1] hover:underline"
                >
                  <Plus className="h-2.5 w-2.5" />
                  Add item
                </button>
              </div>
              {/* Per-item remove */}
              {(cat.items ?? []).map((item, ii) => (
                <div key={ii} className="mt-1 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-[11px]">
                  <span className="truncate text-slate-700">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cats = [...(config.menu!.categories ?? [])];
                      cats[i] = {
                        ...cats[i]!,
                        items: (cats[i]?.items ?? []).filter((_, k) => k !== ii),
                      };
                      onChange({ ...config, menu: { ...config.menu!, categories: cats } });
                    }}
                    className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove item"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ))}
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
          {(config.priceList.items ?? []).map((item, i) => (
            <ItemRow
              key={`pl-${i}`}
              primary={item.name}
              secondary={`${item.price ?? '—'} · ${item.duration ?? ''}`}
              onRemove={() =>
                onChange({
                  ...config,
                  priceList: {
                    ...config.priceList!,
                    items: (config.priceList!.items ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
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
          {(config.team.members ?? []).map((m, i) => (
            <div key={`tm-${i}`} className="space-y-1.5">
              <ItemRow
                primary={m.name ?? '(unnamed)'}
                secondary={m.role ?? ''}
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
                <VariantPicker
                  label="This member's card"
                  value={m.variant}
                  options={TEAM_VARIANT_OPTIONS}
                  blockDefault={config.team!.variant ?? 'portrait'}
                  onChange={(v) => {
                    const next = [...(config.team!.members ?? [])];
                    next[i] = { ...next[i]!, variant: v ?? undefined };
                    onChange({
                      ...config,
                      team: { ...config.team!, members: next },
                    });
                  }}
                  allowDefault
                />
              </ItemRow>
            </div>
          ))}
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
          {(config.schedule.entries ?? []).map((e, i) => (
            <ItemRow
              key={`sch-${i}`}
              primary={`${e.day} ${e.time} — ${e.title}`}
              secondary={e.detail ?? ''}
              onRemove={() =>
                onChange({
                  ...config,
                  schedule: {
                    ...config.schedule!,
                    entries: (config.schedule!.entries ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
        </ArrayBlock>
      ) : null}

      {/* Service areas */}
      {config.serviceAreas ? (
        <ArrayBlock
          icon={<Globe className="h-3.5 w-3.5" />}
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
          {(config.serviceAreas.areas ?? []).map((area, i) => (
            <ItemRow
              key={`sa-${i}`}
              primary={area || `Area ${i + 1}`}
              onRemove={() =>
                onChange({
                  ...config,
                  serviceAreas: {
                    ...config.serviceAreas!,
                    areas: (config.serviceAreas!.areas ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
        </ArrayBlock>
      ) : null}

      {/* Trust badges */}
      {config.trustBadges ? (
        <ArrayBlock
          icon={<Check className="h-3.5 w-3.5" />}
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
          {(config.trustBadges.badges ?? []).map((b, i) => (
            <ItemRow
              key={`tb-${i}`}
              primary={b.label}
              secondary={b.detail ?? ''}
              onRemove={() =>
                onChange({
                  ...config,
                  trustBadges: {
                    ...config.trustBadges!,
                    badges: (config.trustBadges!.badges ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
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
          emptyHint="No before/after pairs yet. Pick image indexes from the Images tab."
        >
          {(config.beforeAfter.pairs ?? []).map((p, i) => (
            <ItemRow
              key={`ba-${i}`}
              primary={p.caption || `Pair ${i + 1}`}
              secondary={`Before: ${p.beforeIndex ?? '—'} · After: ${p.afterIndex ?? '—'}`}
              onRemove={() =>
                onChange({
                  ...config,
                  beforeAfter: {
                    ...config.beforeAfter!,
                    pairs: (config.beforeAfter!.pairs ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
        </ArrayBlock>
      ) : null}

      {/* Custom sections — always available, creates the 'custom' layout entry on first add */}
      <CustomSectionsEditor config={config} onChange={onChange} />

      {/* Products */}
      {config.products ? (
        <ArrayBlock
          icon={<ImageIcon className="h-3.5 w-3.5" />}
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
          {(config.products.items ?? []).map((p, i) => (
            <ItemRow
              key={`prod-${i}`}
              primary={p.name}
              secondary={`${p.price ?? ''}${p.category ? ` · ${p.category}` : ''}`}
              onRemove={() =>
                onChange({
                  ...config,
                  products: {
                    ...config.products!,
                    items: (config.products!.items ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
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
          {(config.portfolio.projects ?? []).map((p, i) => (
            <ItemRow
              key={`port-${i}`}
              primary={p.title}
              secondary={`${(p.imageIndices?.length ?? 0) + (p.imageUrls?.length ?? 0)} images · ${(p.tags ?? []).join(', ')}`}
              onRemove={() =>
                onChange({
                  ...config,
                  portfolio: {
                    ...config.portfolio!,
                    projects: (config.portfolio!.projects ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
        </ArrayBlock>
      ) : null}

      {/* Process steps */}
      {config.process ? (
        <ArrayBlock
          icon={<List className="h-3.5 w-3.5" />}
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
          {(config.process.steps ?? []).map((s, i) => (
            <ItemRow
              key={`proc-${i}`}
              primary={`${i + 1}. ${s.title}`}
              secondary={s.description ?? ''}
              onRemove={() =>
                onChange({
                  ...config,
                  process: {
                    ...config.process!,
                    steps: (config.process!.steps ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
        </ArrayBlock>
      ) : null}

      {/* Pricing tiers */}
      {config.pricingTiers ? (
        <ArrayBlock
          icon={<Star className="h-3.5 w-3.5" />}
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
          {(config.pricingTiers.tiers ?? []).map((t, i) => (
            <ItemRow
              key={`tier-${i}`}
              primary={t.name}
              secondary={`${t.price ?? ''}${t.period ?? ''} · ${(t.features ?? []).length} features`}
              onRemove={() =>
                onChange({
                  ...config,
                  pricingTiers: {
                    ...config.pricingTiers!,
                    tiers: (config.pricingTiers!.tiers ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
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
          {(config.logoStrip.logos ?? []).map((l, i) => (
            <ItemRow
              key={`logo-${i}`}
              primary={l.name}
              secondary={l.imageUrl || (typeof l.imageIndex === 'number' ? `image [${l.imageIndex}]` : 'no image')}
              onRemove={() =>
                onChange({
                  ...config,
                  logoStrip: {
                    ...config.logoStrip!,
                    logos: (config.logoStrip!.logos ?? []).filter((_, j) => j !== i),
                  },
                })
              }
            />
          ))}
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

/** A single row inside an ArrayBlock. Shows primary + secondary text and a delete button. */
function ItemRow({
  primary,
  secondary,
  onRemove,
  children,
}: {
  primary: string;
  secondary?: string;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-slate-900">{primary}</div>
        {secondary ? (
          <div className="truncate text-[10px] text-slate-500">{secondary}</div>
        ) : null}
        {children}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
        aria-label="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
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
 * the text fields edit inline in the preview.
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
    onChange({
      ...config,
      customSections: [...sections, newSection],
    });
    // Also add 'custom' to the layout if not already there, so the section
    // actually renders. If custom is already in the layout, it already
    // renders all entries in customSections.
    if (!(config.layout ?? []).includes('custom')) {
      onChange({
        ...config,
        customSections: [...sections, newSection],
        layout: [
          ...(config.layout ?? []).filter((k) => k !== 'footer'),
          'custom',
          'footer',
        ],
      });
    }
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
      {sections.map((s, i) => (
        <ItemRow
          key={i}
          primary={s.heading || CUSTOM_VARIANTS.find((v) => v.value === s.variant)?.label || 'Section'}
          secondary={`${s.variant} · ${(s.items?.length ?? 0)} ${s.items?.length === 1 ? 'item' : 'items'}`}
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
        />
      ))}
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
] as const satisfies Array<{
  value: NonNullable<NonNullable<WebsiteConfig['team']>['variant']>;
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
