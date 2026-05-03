'use client';

import { useCallback, useEffect, useState } from 'react';
import { Reorder } from 'framer-motion';
import type { WebsiteConfig, SiteBlockKey, HeroVariant } from '@boost/core';
import { DEFAULT_LAYOUT, HERO_VARIANTS } from '@boost/core';
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
};

const ALL_BLOCKS: SiteBlockKey[] = [
  'nav', 'hero', 'stats', 'services', 'about', 'gallery', 'reviews', 'faq', 'contact', 'footer',
];

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
   * Whether the live preview is in edit mode. Hoisting state here lets
   * the editor toggle it from the Content tab.
   */
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
}

/**
 * Visual website editor. Tabs:
 *   Sections   — drag-reorder, add/remove.
 *   Content    — inline edit toggle + content hints.
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
  editMode,
  onEditModeChange,
}: SiteEditorProps) {
  const [tab, setTab] = useState<
    'sections' | 'content' | 'hero' | 'brand' | 'ai' | 'domain'
  >('content');

  return (
    <Card>
      <CardContent className="p-0">
        {/* Tab bar */}
        <div className="flex flex-wrap border-b border-slate-200">
          {[
            { id: 'content' as const, label: 'Content', icon: Edit3 },
            { id: 'sections' as const, label: 'Sections', icon: Layers },
            { id: 'hero' as const, label: 'Hero', icon: Sparkles },
            { id: 'brand' as const, label: 'Brand', icon: Palette },
            { id: 'ai' as const, label: 'AI Edit', icon: Wand2 },
            { id: 'domain' as const, label: 'Domain', icon: Globe },
          ].map((t) => (
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
          {tab === 'sections' && (
            <SectionManager config={config} onChange={onChange} />
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
}: {
  config: WebsiteConfig;
  onChange: (c: WebsiteConfig) => void;
}) {
  const layout = config.layout ?? DEFAULT_LAYOUT[config.template ?? 'service'];
  const available = ALL_BLOCKS.filter((b) => !layout.includes(b));

  const setLayout = (newLayout: SiteBlockKey[]) => {
    onChange({ ...config, layout: newLayout });
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
    setLayout(newLayout);
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT[config.template ?? 'service']);
    toast.success('Layout reset to template default');
  };

  return (
    <div className="space-y-4">
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
      <div>
        <p className="text-xs text-slate-500">
          Attach the client&apos;s own domain (e.g. <code>murphysplumbing.com</code>). They&apos;ll set one
          DNS record with their registrar and we&apos;ll handle TLS automatically.
        </p>
      </div>

      {!current?.customDomain ? (
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
