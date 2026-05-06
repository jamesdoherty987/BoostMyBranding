'use client';

/**
 * Brand Intel tab — per-client library for
 *   1. Inspiration profiles ("brands I admire")
 *   2. Tone-of-voice pairs (good/bad copy few-shot)
 *   3. Products catalog (first-class SKUs with linked media)
 *
 * Every section is editable inline. When saved, the AI pulls from
 * these on every subsequent generation (posts, images, videos,
 * avatar scripts) — so filling this in once materially improves
 * every downstream output.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent } from '@boost/ui';
import {
  Lightbulb,
  MessageSquareQuote,
  Package,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { api } from '@/lib/dashboard/api';
import { InspirationProfilesPanel } from './InspirationProfilesPanel';
import { TonePairsPanel } from './TonePairsPanel';
import { ProductsPanel } from './ProductsPanel';

type Section = 'inspiration' | 'tone' | 'products';

const SECTIONS: Array<{
  id: Section;
  label: string;
  icon: typeof Lightbulb;
  description: string;
}> = [
  {
    id: 'inspiration',
    label: 'Inspiration profiles',
    icon: Lightbulb,
    description: 'Brands you admire. The AI reads their style and applies it to your content.',
  },
  {
    id: 'tone',
    label: 'Voice training',
    icon: MessageSquareQuote,
    description: 'Good/bad copy examples that steer every caption, headline, and script.',
  },
  {
    id: 'products',
    label: 'Product catalog',
    icon: Package,
    description: 'SKUs the AI can target with their real names, descriptions, and linked media.',
  },
];

export function BrandIntelTab({ clientId }: { clientId: string }) {
  const [section, setSection] = useState<Section>('inspiration');

  // Counts drive the readiness strip and the section-tab badges so the
  // user sees at a glance what's populated vs. empty. We key these off
  // the same SWR keys the child panels use so edits in a panel instantly
  // update the counts above without a second fetch.
  const { data: profiles } = useSWR(
    `inspiration-profiles:${clientId}`,
    () => api.listInspirationProfiles(clientId).catch(() => []),
  );
  const { data: pairs } = useSWR(
    `tone-pairs:${clientId}`,
    () => api.listTonePairs(clientId).catch(() => []),
  );
  const { data: products } = useSWR(
    `products:${clientId}`,
    () => api.listProducts(clientId).catch(() => []),
  );

  const counts = {
    inspiration: profiles?.length ?? 0,
    tone: pairs?.length ?? 0,
    products: products?.length ?? 0,
  };
  const ready =
    (counts.inspiration > 0 ? 1 : 0) +
    (counts.tone > 0 ? 1 : 0) +
    (counts.products > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-gradient-to-br from-[#1D9CA1] to-[#48D886] p-2.5 text-white shadow-brand">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900">Brand intelligence</h3>
                <span className="text-xs text-slate-500">
                  {ready}/3 sections filled
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                The more you put in here, the more on-brand every AI-generated post, image,
                and video will feel. Each section is optional — add what&apos;s useful.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ReadinessPill label="Inspiration" count={counts.inspiration} />
                <ReadinessPill label="Voice examples" count={counts.tone} />
                <ReadinessPill label="Products" count={counts.products} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        role="tablist"
        aria-label="Brand intelligence sections"
        className="flex flex-col gap-2 md:flex-row"
      >
        {SECTIONS.map((s) => {
          const active = section === s.id;
          const count = counts[s.id];
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              onClick={() => setSection(s.id)}
              className={`flex-1 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9CA1] ${
                active
                  ? 'border-[#1D9CA1] bg-white shadow-brand'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <s.icon
                  className={`h-4 w-4 ${active ? 'text-[#1D9CA1]' : 'text-slate-500'}`}
                />
                <span className="text-sm font-semibold text-slate-900">{s.label}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    count > 0
                      ? 'bg-[#48D886]/10 text-[#1D9CA1]'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{s.description}</p>
            </button>
          );
        })}
      </div>

      {section === 'inspiration' ? <InspirationProfilesPanel clientId={clientId} /> : null}
      {section === 'tone' ? <TonePairsPanel clientId={clientId} /> : null}
      {section === 'products' ? <ProductsPanel clientId={clientId} /> : null}
    </div>
  );
}

function ReadinessPill({ label, count }: { label: string; count: number }) {
  const filled = count > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
        filled
          ? 'bg-[#48D886]/10 text-[#1D9CA1] ring-1 ring-[#48D886]/30'
          : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200'
      }`}
    >
      {filled ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Circle className="h-3 w-3" />
      )}
      {label}: {count}
    </span>
  );
}
