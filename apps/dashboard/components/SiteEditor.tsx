'use client';

import { useState, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import type { WebsiteConfig, SiteBlockKey } from '@boost/core';
import { DEFAULT_LAYOUT } from '@boost/core';
import {
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Spinner,
  toast,
} from '@boost/ui';
import {
  GripVertical,
  Plus,
  Trash2,
  Palette,
  MessageSquare,
  Send,
  Eye,
  EyeOff,
  Sparkles,
  Image as ImageIcon,
  RotateCcw,
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

interface SiteEditorProps {
  config: WebsiteConfig;
  onChange: (config: WebsiteConfig) => void;
  clientId: string;
  images: string[];
}

/**
 * Visual website editor. Lets the agency:
 * - Drag-to-reorder sections
 * - Add/remove sections
 * - Edit brand colors
 * - Chat with AI to modify the config
 * - Manage hero/gallery images
 */
export function SiteEditor({ config, onChange, clientId, images }: SiteEditorProps) {
  const [tab, setTab] = useState<'sections' | 'brand' | 'ai'>('sections');

  return (
    <Card>
      <CardContent className="p-0">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200">
          {[
            { id: 'sections' as const, label: 'Sections', icon: GripVertical },
            { id: 'brand' as const, label: 'Brand', icon: Palette },
            { id: 'ai' as const, label: 'AI Edit', icon: Sparkles },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
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
          {tab === 'sections' && (
            <SectionManager config={config} onChange={onChange} />
          )}
          {tab === 'brand' && (
            <BrandEditor config={config} onChange={onChange} />
          )}
          {tab === 'ai' && (
            <AIChatEditor config={config} onChange={onChange} clientId={clientId} />
          )}
        </div>
      </CardContent>
    </Card>
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
    // Don't allow removing nav or footer
    if (block === 'nav' || block === 'footer') {
      toast.info('Navigation and footer are required');
      return;
    }
    setLayout(layout.filter((b) => b !== block));
  };

  const addBlock = (block: SiteBlockKey) => {
    // Insert before footer
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
        Tell the AI what to change. It can modify copy, colors, sections, images — anything.
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

      {/* Input */}
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
          placeholder='e.g. "Make the hero dark with a bold headline" or "Add a gallery section after services"'
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

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {[
          'Make the hero dark',
          'Change primary color to navy',
          'Add more testimonials',
          'Rewrite the headline to be punchier',
          'Add a gallery section',
          'Make it more premium',
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
