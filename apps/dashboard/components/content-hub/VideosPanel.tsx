'use client';

/**
 * Videos Panel — for a single client. Lets the agency pick a template,
 * enter copy, queue N renders, and manage the rendered library
 * (preview / delete). Rendered videos save to the client's media library
 * so the agency can reuse them in posts or download.
 */

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import type { Client, ClientImage } from '@boost/core';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Spinner,
  toast,
  confirmDialog,
} from '@boost/ui';
import {
  Video,
  Play,
  Trash2,
  Plus,
  Film,
  Sparkles,
  Loader2,
  Download,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  durationFrames: number;
  usesImage: boolean;
  bestFor: readonly string[];
}

interface RenderProgress {
  total: number;
  completed: number;
  failed: number;
}

interface Props {
  clientId: string;
  client: Client;
}

export function VideosPanel({ clientId, client }: Props) {
  const { data: templates = [] } = useSWR<TemplateMeta[]>('videos:templates', async () => {
    try {
      return await api.listVideoTemplates();
    } catch {
      return [];
    }
  });

  const { data: videos = [], mutate } = useSWR<ClientImage[]>(
    `videos:${clientId}`,
    async () => {
      try {
        const all = await api.listImages(clientId);
        return all.filter((m) => ((m as any).mimeType ?? '').startsWith('video/'));
      } catch {
        return [];
      }
    },
    { refreshInterval: 15000 },
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string>('liquid-blob');
  const [count, setCount] = useState(1);
  const [form, setForm] = useState({
    headline: 'Now open late',
    subheadline: 'Every Friday & Saturday',
    cta: 'Visit us',
    domain: '',
    imageUrl: '',
  });
  const [perItemHeadlines, setPerItemHeadlines] = useState<string[]>(['']);
  const [useVariants, setUseVariants] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);

  const selected = templates.find((t) => t.id === templateId);

  const adjustVariantCount = (n: number) => {
    const clamped = Math.max(1, Math.min(6, n));
    setCount(clamped);
    setPerItemHeadlines((prev) => {
      if (prev.length === clamped) return prev;
      if (prev.length > clamped) return prev.slice(0, clamped);
      return [...prev, ...Array.from({ length: clamped - prev.length }, () => '')];
    });
  };

  const batchRender = async () => {
    if (!templateId) return;
    setRendering(true);
    setProgress({ total: count, completed: 0, failed: 0 });
    try {
      const headlines = useVariants
        ? perItemHeadlines.map((h) => h.trim() || form.headline)
        : undefined;
      const res = await api.batchRenderVideos({
        templateId,
        clientId,
        businessName: client.businessName,
        headline: form.headline,
        subheadline: form.subheadline || undefined,
        cta: form.cta || undefined,
        domain: form.domain || undefined,
        imageUrl: form.imageUrl || undefined,
        count,
        headlines,
        brand: {
          primary: client.brandColors?.primary ?? '#1D9CA1',
          accent: client.brandColors?.accent ?? '#48D886',
        },
      });
      setProgress({
        total: res.total,
        completed: res.succeeded,
        failed: res.total - res.succeeded,
      });
      if (res.succeeded > 0) {
        toast.success(
          `${res.succeeded} of ${res.total} rendered`,
          'Videos saved to the media library.',
        );
      }
      if (res.succeeded < res.total) {
        toast.error(
          `${res.total - res.succeeded} failed`,
          res.items.find((i) => !i.ok)?.error ?? 'Unknown error',
        );
      }
      mutate();
      setCreateOpen(false);
    } catch (e) {
      toast.error('Render failed', (e as Error).message);
    } finally {
      setRendering(false);
      // Clear the progress banner after a beat so users see the final numbers.
      setTimeout(() => setProgress(null), 3000);
    }
  };

  const del = async (id: string) => {
    if (
      !(await confirmDialog({
        title: 'Delete this video?',
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return;
    mutate((prev) => prev?.filter((v) => v.id !== id), false);
    try {
      await api.deleteImage(id);
      toast.success('Deleted');
    } catch (e) {
      toast.error('Delete failed', (e as Error).message);
      mutate();
    }
  };

  const timeEstimate = useMemo(() => {
    const secondsPer = 20; // rough server render time per video
    return count * secondsPer;
  }, [count]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Video library</h3>
          <p className="text-xs text-slate-500">
            {videos.length} rendered for {client.businessName}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          Create video
        </Button>
      </div>

      {/* Render progress banner */}
      {progress ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Loader2 className={rendering ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                {rendering
                  ? `Rendering ${progress.completed + 1} of ${progress.total}…`
                  : `${progress.completed} rendered · ${progress.failed} failed`}
              </div>
              <span className="text-xs text-slate-500">
                ~{Math.max(0, (progress.total - progress.completed) * 20)}s left
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-cta transition-all"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Create form */}
      {createOpen ? (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-[#1D9CA1]" />
              Render videos for {client.businessName}
            </div>

            {/* Template picker — compact */}
            <div>
              <label className="text-xs font-medium text-slate-600">Template</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`overflow-hidden rounded-xl border text-left transition-all ${
                      templateId === t.id
                        ? 'border-[#48D886] ring-2 ring-[#48D886]/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className="relative aspect-[9/16] overflow-hidden"
                      style={{ background: previewBg(t.id, client.brandColors) }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Film className="h-6 w-6 text-white/80" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <div className="text-[10px] font-bold text-white">{t.name}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {selected ? (
                <p className="mt-1.5 text-[10px] text-slate-500">{selected.description}</p>
              ) : null}
            </div>

            {/* Copy inputs */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Headline *</label>
                <Input
                  className="mt-1"
                  value={form.headline}
                  onChange={(e) => setForm((s) => ({ ...s, headline: e.target.value }))}
                  maxLength={80}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Subheadline</label>
                <Input
                  className="mt-1"
                  value={form.subheadline}
                  onChange={(e) => setForm((s) => ({ ...s, subheadline: e.target.value }))}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">CTA</label>
                <Input
                  className="mt-1"
                  value={form.cta}
                  onChange={(e) => setForm((s) => ({ ...s, cta: e.target.value }))}
                  maxLength={30}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Domain (optional)</label>
                <Input
                  className="mt-1"
                  value={form.domain}
                  onChange={(e) => setForm((s) => ({ ...s, domain: e.target.value }))}
                  placeholder="verdecafe.com"
                />
              </div>
            </div>

            {selected?.usesImage ? (
              <div>
                <label className="text-xs font-medium text-slate-600">Image URL</label>
                <Input
                  className="mt-1"
                  value={form.imageUrl}
                  onChange={(e) => setForm((s) => ({ ...s, imageUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            ) : null}

            {/* Count + variant toggle */}
            <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
              <div>
                <label className="text-xs font-medium text-slate-600">How many?</label>
                <div className="mt-1 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5">
                  {[1, 2, 3, 4, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => adjustVariantCount(n)}
                      className={`h-8 w-8 rounded-lg text-xs font-semibold transition ${
                        count === n ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {count > 1 ? (
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={useVariants}
                    onChange={(e) => setUseVariants(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  Different headline per video
                </label>
              ) : null}

              <div className="ml-auto text-[10px] text-slate-500">
                Est. ~{Math.ceil(timeEstimate / 60) || '<1'} min render time
              </div>
            </div>

            {/* Per-item headlines */}
            {useVariants && count > 1 ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">
                  Headlines (leave blank to reuse the main one)
                </label>
                {perItemHeadlines.map((h, i) => (
                  <Input
                    key={i}
                    value={h}
                    onChange={(e) => {
                      const next = [...perItemHeadlines];
                      next[i] = e.target.value;
                      setPerItemHeadlines(next);
                    }}
                    placeholder={`Variant ${i + 1} headline`}
                    className="text-xs"
                  />
                ))}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)} disabled={rendering}>
                Cancel
              </Button>
              <Button size="sm" onClick={batchRender} disabled={rendering}>
                {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                {rendering ? 'Rendering…' : `Render ${count}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Video grid */}
      {videos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Video className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No videos yet</p>
          <p className="text-xs text-slate-500">
            Hit &ldquo;Create video&rdquo; to render your first one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {videos.map((v) => (
            <div
              key={v.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900"
            >
              <div className="relative aspect-[9/16]">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={v.fileUrl}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  playsInline
                  controls
                  preload="metadata"
                />
                {v.aiDescription ? (
                  <div className="pointer-events-none absolute left-2 top-2 max-w-[85%] truncate rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                    {v.aiDescription}
                  </div>
                ) : null}
              </div>

              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <a
                  href={v.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-slate-700 shadow-sm backdrop-blur hover:bg-white"
                  aria-label="Open"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href={v.fileUrl}
                  download
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-slate-700 shadow-sm backdrop-blur hover:bg-white"
                  aria-label="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => del(v.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-rose-600 shadow-sm backdrop-blur hover:bg-white"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-white p-2">
                <Badge tone="brand">
                  <Play className="h-2.5 w-2.5" />
                  Video
                </Badge>
                {v.tags?.some((t) => t && t !== 'video') ? (
                  <span className="truncate text-[10px] text-slate-500">
                    {v.tags.filter((t) => t && t !== 'video').join(' · ')}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function previewBg(
  id: string,
  brand: { primary: string; accent: string } | undefined,
) {
  // Fallback brand colours when the client row has none — matches the
  // service template's defaults so the preview tile looks on-brand rather
  // than black.
  const b = brand ?? { primary: '#1D9CA1', accent: '#48D886' };
  switch (id) {
    case 'liquid-blob':
      return `radial-gradient(circle at 30% 30%, ${b.primary}, ${b.accent} 50%, #0B1220)`;
    case 'product-showcase':
      return `conic-gradient(from 0deg, ${b.primary}, ${b.accent}, #FFEC3D, ${b.primary})`;
    case 'aurora':
      return `conic-gradient(from 180deg at 50% 50%, ${b.primary} 0deg, transparent 90deg, ${b.accent} 180deg, transparent 270deg, #FFEC3D 360deg)`;
    case 'glitch-art':
      return 'linear-gradient(135deg, #FF00AA 0%, #0B1220 50%, #00FFFF 100%)';
    case 'holo-foil':
      return `conic-gradient(from 45deg at 50% 50%, ${b.primary}, ${b.accent}, #FFEC3D, #ff00ff, ${b.primary})`;
    default:
      return `linear-gradient(135deg, ${b.primary}, ${b.accent})`;
  }
}
