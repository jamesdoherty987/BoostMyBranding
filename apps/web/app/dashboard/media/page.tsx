'use client';

/**
 * Media Studio. One page, four tabs, per-client filtering.
 *
 *   Library   — everything uploaded + generated for the selected client.
 *   Upload    — drag-drop photos and videos from the laptop (with progress).
 *   AI video  — personalized reel generator (Claude scripts + Remotion renders).
 *   Templates — the existing template-based video renderer.
 *   Canva     — connect Canva, browse designs, import to library.
 *
 * The URL takes a `?canva=connected|error` flag so the Canva OAuth
 * callback can bounce back here and pop a toast.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { mockClients, type ClientImage } from '@boost/core';
import {
  Badge,
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
  Upload,
  Image as ImageIconLucide,
  Film,
  Sparkles,
  Loader2,
  Check,
  X,
  ArrowRight,
  ExternalLink,
  Trash2,
  Wand2,
  Video,
  PlayCircle,
  Palette,
  Link2,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { api, API_URL } from '@/lib/dashboard/api';

type TabKey = 'library' | 'upload' | 'ai_video' | 'templates' | 'canva';

const TABS: Array<{ key: TabKey; label: string; icon: typeof Upload }> = [
  { key: 'library', label: 'Library', icon: ImageIconLucide },
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'ai_video', label: 'AI video', icon: Sparkles },
  { key: 'templates', label: 'Templates', icon: Film },
  { key: 'canva', label: 'Canva', icon: Palette },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MediaStudioPage() {
  const search = useSearchParams();
  const initialTab = (search.get('tab') as TabKey | null) ?? 'library';
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : 'library',
  );
  const canvaFlag = search.get('canva');

  const { data: clients = [], isLoading: clientsLoading } = useSWR(
    'media:clients',
    async () => {
      try {
        return await api.listClients();
      } catch {
        return mockClients;
      }
    },
  );

  const clientIdFromUrl = search.get('clientId') ?? '';
  const [clientId, setClientId] = useState<string>(clientIdFromUrl);
  useEffect(() => {
    if (!clients.length) return;
    if (!clientId || !clients.find((c) => c.id === clientId)) {
      setClientId(clients[0]!.id);
    }
  }, [clients, clientId]);

  // Toast any Canva callback result once on mount.
  useEffect(() => {
    if (!canvaFlag) return;
    if (canvaFlag === 'connected') {
      toast.success('Canva connected', 'Designs and brand templates will show up in a moment.');
      setTab('canva');
    } else if (canvaFlag === 'error') {
      toast.error(
        'Canva did not connect',
        search.get('reason') ?? 'Try again or check the Canva app config.',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <>
      <PageHeader
        title="Media Studio"
        subtitle="Uploads, AI videos, templates, and Canva — all the media for one client in one place."
      />

      <div className="px-4 py-4 md:px-10 md:py-6 space-y-6">
        {/* Client picker + tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-500">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={clientsLoading || clients.length === 0}
              className="h-10 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:opacity-60"
            >
              {clientsLoading ? (
                <option>Loading clients…</option>
              ) : clients.length === 0 ? (
                <option>No clients yet</option>
              ) : (
                clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-gradient-cta text-white shadow-brand'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {clientId && !UUID_RE.test(clientId) ? (
          <Card>
            <CardContent className="p-6 text-sm text-amber-700">
              <AlertCircle className="mr-2 inline h-4 w-4" />
              This dashboard is showing mock data. Add real clients to use the Media Studio.
            </CardContent>
          </Card>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'library' ? (
              <LibraryTab clientId={clientId} />
            ) : tab === 'upload' ? (
              <UploadTab clientId={clientId} onDone={() => setTab('library')} />
            ) : tab === 'ai_video' ? (
              <AIVideoTab clientId={clientId} businessName={selectedClient?.businessName} />
            ) : tab === 'templates' ? (
              <TemplatesTab clientId={clientId} businessName={selectedClient?.businessName} />
            ) : (
              <CanvaTab clientId={clientId} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Library                                                             */
/* ------------------------------------------------------------------ */

type MediaFilter = 'all' | 'image' | 'video' | 'upload' | 'ai' | 'template' | 'canva';

const FILTER_LABELS: Record<MediaFilter, string> = {
  all: 'All',
  image: 'Photos',
  video: 'Videos',
  upload: 'Uploaded',
  ai: 'AI generated',
  template: 'Template',
  canva: 'Canva',
};

function LibraryTab({ clientId }: { clientId: string }) {
  const { data: media = [], isLoading, mutate } = useSWR(
    clientId && UUID_RE.test(clientId) ? ['media:list', clientId] : null,
    async () => {
      try {
        return await api.listImages(clientId);
      } catch {
        return [] as ClientImage[];
      }
    },
    { refreshInterval: 0 },
  );

  const [filter, setFilter] = useState<MediaFilter>('all');

  const counts = useMemo(() => {
    const c: Record<MediaFilter, number> = {
      all: media.length,
      image: 0,
      video: 0,
      upload: 0,
      ai: 0,
      template: 0,
      canva: 0,
    };
    for (const m of media) {
      const isVideo = (m.mimeType ?? '').startsWith('video/');
      if (isVideo) c.video++;
      else c.image++;
      const src = (m.source ?? 'upload') as MediaFilter;
      if (src in c) c[src]++;
    }
    return c;
  }, [media]);

  const filtered = useMemo(() => {
    if (filter === 'all') return media;
    if (filter === 'image') return media.filter((m) => !(m.mimeType ?? '').startsWith('video/'));
    if (filter === 'video') return media.filter((m) => (m.mimeType ?? '').startsWith('video/'));
    return media.filter((m) => (m.source ?? 'upload') === filter);
  }, [media, filter]);

  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {media.length} item{media.length === 1 ? '' : 's'} in the library
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Everything the AI can pull from — photos, videos you uploaded, AI-generated
              clips, rendered templates, Canva designs.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(FILTER_LABELS) as [MediaFilter, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === k
                    ? 'border-transparent bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {label} ({counts[k]})
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-500">
            <Spinner /> <span className="ml-2">Loading library…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-16 text-sm text-slate-500">
            <FolderPlus className="h-10 w-10 text-slate-300" />
            {media.length === 0 ? 'No media yet. Upload photos to get started.' : 'No items match this filter.'}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((m) => (
              <MediaCard
                key={m.id}
                item={m}
                onDelete={async () => {
                  const confirmed = await confirmDialog({
                    title: 'Delete this media item?',
                    description: 'This removes it from the library and from any future posts.',
                    confirmLabel: 'Delete',
                    danger: true,
                  });
                  if (!confirmed) return;
                  try {
                    await api.deleteImage(m.id);
                    toast.success('Deleted');
                    mutate();
                  } catch (e) {
                    toast.error('Delete failed', (e as Error).message);
                  }
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MediaCard({ item, onDelete }: { item: ClientImage; onDelete: () => void }) {
  const isVideo = (item.mimeType ?? '').startsWith('video/');
  const src = (item.source ?? 'upload') as string;
  const sourceBadge: Record<string, { label: string; tone: string }> = {
    upload: { label: 'Uploaded', tone: 'bg-slate-100 text-slate-700' },
    ai: { label: 'AI', tone: 'bg-violet-100 text-violet-700' },
    template: { label: 'Template', tone: 'bg-sky-100 text-sky-700' },
    canva: { label: 'Canva', tone: 'bg-rose-100 text-rose-700' },
    stock: { label: 'Stock', tone: 'bg-amber-100 text-amber-800' },
  };
  const badge = sourceBadge[src] ?? sourceBadge.upload!;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {isVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={item.fileUrl}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
          />
        ) : (
          <Image
            src={item.fileUrl}
            alt={item.aiDescription ?? item.fileName ?? ''}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 20vw"
            className="object-cover"
            unoptimized
          />
        )}
        {isVideo ? (
          <PlayCircle className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow-md" />
        ) : null}
        <span className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${badge.tone}`}>
          {badge.label}
        </span>
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open full size"
            className="rounded-md bg-white/90 p-1.5 text-slate-700 hover:bg-white"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={onDelete}
            title="Delete"
            className="rounded-md bg-white/90 p-1.5 text-rose-600 hover:bg-white"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="line-clamp-2 text-[11px] text-slate-600">
          {item.aiDescription ?? item.fileName ?? (isVideo ? 'Video clip' : 'Image')}
        </p>
        {item.qualityScore != null ? (
          <p className="mt-0.5 text-[10px] text-slate-400">Quality {item.qualityScore}/10</p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Upload                                                              */
/* ------------------------------------------------------------------ */

function UploadTab({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const [drag, setDrag] = useState(false);
  const [queue, setQueue] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    // Dedupe by name+size to avoid double-dropping the same file.
    setQueue((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...incoming.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  }, []);

  const removeFromQueue = (name: string, size: number) => {
    setQueue((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  };

  const doUpload = async () => {
    if (queue.length === 0 || !clientId || !UUID_RE.test(clientId)) {
      toast.error('Nothing to upload', 'Pick a client and add at least one file.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const rows = await api.uploadMediaWithProgress(clientId, queue, ['upload'], (pct) =>
        setProgress(pct),
      );
      toast.success(`${rows.length} file${rows.length === 1 ? '' : 's'} uploaded`);
      setQueue([]);
      onDone();
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 md:p-6 space-y-5">
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            // Only clear drag state when leaving the drop zone, not its children.
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDrag(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            drag
              ? 'border-[#48D886] bg-emerald-50/60'
              : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <Upload className="h-10 w-10 text-slate-400" />
          <p className="text-sm font-medium text-slate-800">
            Drag photos or videos from your laptop
          </p>
          <p className="text-xs text-slate-500">or</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={acceptedTypes}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <p className="mt-3 text-[11px] text-slate-400">
            Up to 10 files at a time · JPG / PNG / WEBP / GIF up to 15 MB · MP4 / MOV / WEBM up to 100 MB
          </p>
        </div>

        {queue.length > 0 ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <p className="text-xs font-medium text-slate-600">
                {queue.length} file{queue.length === 1 ? '' : 's'} ready
                {queue.reduce((s, f) => s + f.size, 0) > 0
                  ? ` · ${formatBytes(queue.reduce((s, f) => s + f.size, 0))}`
                  : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQueue([])}
                  disabled={uploading}
                >
                  Clear
                </Button>
                <Button size="sm" onClick={doUpload} loading={uploading}>
                  <Upload className="h-3.5 w-3.5" />
                  Upload {queue.length}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {queue.map((f) => (
                <FilePreview
                  key={`${f.name}:${f.size}`}
                  file={f}
                  onRemove={() => removeFromQueue(f.name, f.size)}
                  disabled={uploading}
                />
              ))}
            </div>

            {uploading ? (
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-gradient-cta transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Uploading… {progress}%
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FilePreview({
  file,
  onRemove,
  disabled,
}: {
  file: File;
  onRemove: () => void;
  disabled: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isVideo = file.type.startsWith('video/');

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="aspect-square overflow-hidden bg-slate-100">
        {preview ? (
          isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={preview} className="h-full w-full object-cover" muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={file.name} className="h-full w-full object-cover" />
          )
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-slate-700">{file.name}</p>
          <p className="text-[10px] text-slate-400">{formatBytes(file.size)}</p>
        </div>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="flex-shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          title="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/* AI video                                                            */
/* ------------------------------------------------------------------ */

const INTENTS: Array<{ key: 'brand_story' | 'promo' | 'team_intro' | 'menu_reveal' | 'before_after' | 'location_tour'; label: string; hint: string }> = [
  { key: 'brand_story', label: 'Brand story', hint: 'Who we are, what makes us different.' },
  { key: 'promo', label: 'Promotion', hint: 'A specific offer, launch, or event.' },
  { key: 'team_intro', label: 'Team intro', hint: 'Introduce the people behind the brand.' },
  { key: 'menu_reveal', label: 'Menu reveal', hint: 'Showcase what you serve or sell.' },
  { key: 'before_after', label: 'Before / after', hint: 'Transformation-style reel.' },
  { key: 'location_tour', label: 'Location tour', hint: 'Walk viewers around the space.' },
];

function AIVideoTab({ clientId, businessName }: { clientId: string; businessName?: string }) {
  const { data: media = [] } = useSWR(
    clientId && UUID_RE.test(clientId) ? ['media:for-ai', clientId] : null,
    () => api.listImages(clientId).catch(() => [] as ClientImage[]),
  );

  const [intent, setIntent] = useState<(typeof INTENTS)[number]['key']>('brand_story');
  const [clipCount, setClipCount] = useState(5);
  const [headline, setHeadline] = useState('');
  const [cta, setCta] = useState('');
  const [direction, setDirection] = useState('');
  const [useAllMedia, setUseAllMedia] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enableMotion, setEnableMotion] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof api.generatePersonalizedVideo>
  > | null>(null);

  const selectable = media.filter((m) => (m.status ?? 'approved') !== 'rejected');
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = async () => {
    if (!clientId || !UUID_RE.test(clientId)) {
      toast.error('Pick a real client');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await api.generatePersonalizedVideo({
        clientId,
        intent,
        clipCount,
        headline: headline.trim() || undefined,
        cta: cta.trim() || undefined,
        direction: direction.trim() || undefined,
        selectedMediaIds:
          !useAllMedia && selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
        enableMotion,
      });
      setResult(res);
      toast.success('Video ready', `${res.clips.length} clips rendered`);
    } catch (e) {
      toast.error('Render failed', (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardContent className="p-5 md:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Personalized reel</h2>
            <p className="mt-1 text-xs text-slate-500">
              Claude writes a clip-by-clip script from {businessName ?? 'this client'}&apos;s own media,
              then Remotion renders it as a 1080×1920 reel.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Intent</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2 md:grid-cols-3">
              {INTENTS.map((i) => (
                <button
                  key={i.key}
                  onClick={() => setIntent(i.key)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                    intent === i.key
                      ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 ring-1 ring-[#1D9CA1]/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-900">{i.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{i.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Clips</label>
              <Input
                type="number"
                min={3}
                max={6}
                value={clipCount}
                onChange={(e) => setClipCount(Math.max(3, Math.min(6, Number(e.target.value))))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Outro headline (optional)</label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Auto-written if blank"
                className="mt-1"
                maxLength={120}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">CTA (optional)</label>
            <Input
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="e.g. Book now, View menu"
              className="mt-1"
              maxLength={40}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Direction (optional)</label>
            <Textarea
              rows={2}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="Lean on the new Cork opening and mention winter hours."
              className="mt-1 text-sm"
              maxLength={500}
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">Media source</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {useAllMedia
                    ? `Claude picks from all ${selectable.length} usable items.`
                    : `Claude uses only the ${selectedIds.size} items you pick.`}
                </p>
              </div>
              <div className="flex gap-1 rounded-full border border-slate-200 bg-white p-1 text-[11px]">
                <button
                  onClick={() => setUseAllMedia(true)}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    useAllMedia ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setUseAllMedia(false)}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    !useAllMedia ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Curated
                </button>
              </div>
            </div>

            {!useAllMedia ? (
              selectable.length === 0 ? (
                <p className="mt-3 text-[11px] text-slate-500">
                  No media yet. Upload some on the Upload tab first.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-1.5 md:grid-cols-5">
                  {selectable.slice(0, 24).map((m) => {
                    const on = selectedIds.has(m.id);
                    const isVideo = (m.mimeType ?? '').startsWith('video/');
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleSelect(m.id)}
                        className={`group relative aspect-square overflow-hidden rounded-lg border transition-all ${
                          on
                            ? 'border-[#48D886] ring-2 ring-[#48D886]/30'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        title={m.aiDescription ?? m.fileName ?? ''}
                      >
                        {isVideo ? (
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <video
                            src={m.fileUrl}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.fileUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                        {on ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/40">
                            <CheckCircle2 className="h-6 w-6 text-white drop-shadow-md" />
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={enableMotion}
              onChange={(e) => setEnableMotion(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#48D886] focus:ring-[#48D886]"
            />
            <div>
              <p className="text-xs font-semibold text-slate-900">Animate still photos</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                When helpful, Claude can flag a few clips to convert from still to motion via Fal.
                Adds ~30s of compute per clip but looks great for launches and reveals.
              </p>
            </div>
          </label>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-[11px] text-slate-500">
              Typical render time 45–90 seconds.
            </span>
            <Button onClick={run} disabled={running} size="lg">
              {running ? <Spinner /> : <Wand2 className="h-4 w-4" />}
              {running ? 'Rendering…' : 'Render personalized reel'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card>
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Video className="h-4 w-4 text-[#1D9CA1]" />
              Preview
            </div>
            {result ? (
              <div className="mt-4 space-y-3">
                <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-slate-900">
                  {result.fromMock ? (
                    <div className="flex h-full items-center justify-center p-6 text-center">
                      <div>
                        <PlayCircle className="mx-auto h-8 w-8 text-white/60" />
                        <p className="mt-2 text-xs text-white/60">
                          Mock mode — add a database + keys to see real output.
                        </p>
                      </div>
                    </div>
                  ) : (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video
                      src={result.videoUrl}
                      controls
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
                <a
                  href={result.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open full file
                </a>
                <div className="space-y-1 rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Script
                  </p>
                  <ol className="space-y-1.5">
                    {result.clips.map((c) => (
                      <li
                        key={c.order}
                        className="flex items-start gap-2 text-[11px] text-slate-700"
                      >
                        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-semibold">
                          {c.order + 1}
                        </span>
                        <div>
                          {c.eyebrow ? (
                            <span className="mr-1 uppercase tracking-wide text-slate-400">
                              {c.eyebrow}
                            </span>
                          ) : null}
                          <span>{c.caption ?? '(no caption)'}</span>
                          <span className="ml-1 text-slate-400">
                            · {c.durationSeconds.toFixed(1)}s
                            {c.sourceKind === 'synthesis'
                              ? ' · AI still'
                              : c.sourceKind === 'motion'
                                ? ' · animated'
                                : ''}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex aspect-[9/16] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <div className="text-center">
                  <Film className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-xs text-slate-400">No reel yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Templates (existing generator, wrapped)                              */
/* ------------------------------------------------------------------ */

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  durationFrames: number;
  usesImage: boolean;
  bestFor: readonly string[];
}

function TemplatesTab({ clientId, businessName }: { clientId: string; businessName?: string }) {
  const { data: templates = [] } = useSWR('media:templates', async () => {
    try {
      return (await api.listVideoTemplates()) as TemplateMeta[];
    } catch {
      return [] as TemplateMeta[];
    }
  });
  const { data: media = [] } = useSWR(
    clientId && UUID_RE.test(clientId) ? ['media:for-template', clientId] : null,
    () => api.listImages(clientId).catch(() => [] as ClientImage[]),
  );

  // Hide media-story here — it belongs in AI video.
  const shown = templates.filter((t) => t.id !== 'media-story');

  const [templateId, setTemplateId] = useState('liquid-blob');
  const [headline, setHeadline] = useState('Coffee, slowly.');
  const [subheadline, setSubheadline] = useState('');
  const [cta, setCta] = useState('');
  const [domain, setDomain] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.renderVideo>> | null>(null);

  const selected = shown.find((t) => t.id === templateId);
  const photos = media.filter((m) => !(m.mimeType ?? '').startsWith('video/'));

  const run = async () => {
    if (!clientId || !UUID_RE.test(clientId)) {
      toast.error('Pick a real client');
      return;
    }
    setRendering(true);
    setResult(null);
    try {
      const res = await api.renderVideo({
        templateId,
        clientId,
        businessName: businessName ?? 'Your Business',
        headline,
        subheadline: subheadline || undefined,
        cta: cta || undefined,
        domain: domain || undefined,
        imageUrl: imageUrl || undefined,
      });
      setResult(res);
      toast.success('Rendered');
    } catch (e) {
      toast.error('Render failed', (e as Error).message);
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {shown.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemplateId(t.id)}
            className={`group overflow-hidden rounded-2xl border text-left transition-all ${
              templateId === t.id
                ? 'border-[#48D886] ring-2 ring-[#48D886]/20'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div
              className="relative aspect-[9/16] overflow-hidden"
              style={{ background: gradientFor(t.id) }}
            >
              <Film className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/80" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <p className="text-xs font-bold text-white">{t.name}</p>
                <p className="mt-0.5 text-[10px] text-white/80">
                  {(t.durationFrames / 30).toFixed(0)}s · {t.usesImage ? 'with image' : 'text'}
                </p>
              </div>
            </div>
            <div className="bg-white p-2 text-[11px] text-slate-500">{t.description}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardContent className="p-5 md:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Video details</h2>
            <p className="text-xs text-slate-500">
              Selected: <span className="font-semibold">{selected?.name ?? 'None'}</span>
            </p>

            <div>
              <label className="text-xs font-medium text-slate-600">Headline</label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Subheadline</label>
              <Input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">CTA</label>
                <Input value={cta} onChange={(e) => setCta(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Domain</label>
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} className="mt-1" />
              </div>
            </div>

            {selected?.usesImage ? (
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Image {photos.length > 0 ? `(or pick from the ${photos.length} below)` : ''}
                </label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1"
                />
                {photos.length > 0 ? (
                  <div className="mt-2 grid grid-cols-4 gap-1.5 md:grid-cols-6">
                    {photos.slice(0, 12).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setImageUrl(m.fileUrl)}
                        className={`relative aspect-square overflow-hidden rounded-md border ${
                          imageUrl === m.fileUrl
                            ? 'border-[#48D886] ring-2 ring-[#48D886]/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.fileUrl} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-[11px] text-slate-500">Rendering takes 10–30 seconds.</span>
              <Button onClick={run} disabled={rendering} size="lg">
                {rendering ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                {rendering ? 'Rendering…' : 'Render video'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <aside>
          <Card>
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Video className="h-4 w-4 text-[#1D9CA1]" />
                Preview
              </div>
              {result ? (
                <div className="mt-4 space-y-3">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-slate-900">
                    {result.fromMock ? (
                      <div className="flex h-full items-center justify-center p-6 text-center">
                        <p className="text-xs text-white/60">Mock mode — add R2 keys for real renders</p>
                      </div>
                    ) : (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={result.videoUrl} controls className="h-full w-full object-contain" />
                    )}
                  </div>
                  <a
                    href={result.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open full file
                  </a>
                </div>
              ) : (
                <div className="mt-4 flex aspect-[9/16] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                  <Film className="h-10 w-10 text-slate-300" />
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function gradientFor(id: string) {
  switch (id) {
    case 'liquid-blob':
      return 'radial-gradient(circle at 30% 30%, #1D9CA1, #48D886 50%, #0B1220)';
    case 'product-showcase':
      return 'conic-gradient(from 0deg, #1D9CA1, #48D886, #FFEC3D, #1D9CA1)';
    case 'aurora':
      return 'conic-gradient(from 180deg at 50% 50%, #1D9CA1 0deg, transparent 90deg, #48D886 180deg, transparent 270deg, #FFEC3D 360deg)';
    case 'glitch-art':
      return 'linear-gradient(135deg, #FF00AA 0%, #0B1220 50%, #00FFFF 100%)';
    case 'holo-foil':
      return 'conic-gradient(from 45deg at 50% 50%, #1D9CA1, #48D886, #FFEC3D, #ff00ff, #1D9CA1)';
    default:
      return 'linear-gradient(135deg, #1D9CA1, #48D886)';
  }
}

/* ------------------------------------------------------------------ */
/* Canva                                                               */
/* ------------------------------------------------------------------ */

function CanvaTab({ clientId }: { clientId: string }) {
  const {
    data: status,
    mutate: mutateStatus,
    isLoading,
  } = useSWR(clientId && UUID_RE.test(clientId) ? ['canva:status', clientId] : null, () =>
    api.canvaStatus(clientId).catch(() => null),
  );

  const connected = !!status?.connected;
  const configured = status?.configured !== false;

  const { data: designs = [], mutate: mutateDesigns } = useSWR(
    connected ? ['canva:designs', clientId] : null,
    () => api.canvaListDesigns(clientId).catch(() => []),
  );
  const { data: brandTemplates = [] } = useSWR(
    connected ? ['canva:brand-templates', clientId] : null,
    () => api.canvaListBrandTemplates(clientId).catch(() => []),
  );

  const [importing, setImporting] = useState<string | null>(null);

  if (!configured) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Palette className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">Canva isn&apos;t configured yet</h3>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
            Add <code className="rounded bg-slate-100 px-1">CANVA_CLIENT_ID</code>,{' '}
            <code className="rounded bg-slate-100 px-1">CANVA_CLIENT_SECRET</code> and{' '}
            <code className="rounded bg-slate-100 px-1">CANVA_REDIRECT_URI</code> to the API env and restart. The redirect
            URI must match what you registered in the Canva app config (typically{' '}
            <code className="rounded bg-slate-100 px-1">{API_URL}/api/v1/canva/callback</code>).
          </p>
          <a
            href="https://www.canva.com/developers/docs/connect-api/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#1D9CA1] hover:underline"
          >
            Canva Connect docs
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        <Spinner /> <span className="ml-2">Checking Canva connection…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {connected ? 'Canva connected' : 'Canva not connected for this client'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {connected
                    ? `Canva user ${status?.canvaUserId ?? '—'} · token valid until ${new Date(
                        status?.expiresAt ?? '',
                      ).toLocaleString()}`
                    : 'Connect the client\'s Canva workspace to browse designs and import them here.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connected ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      mutateStatus();
                      mutateDesigns();
                    }}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: 'Disconnect Canva?',
                        description: 'Designs already imported stay in the library.',
                        confirmLabel: 'Disconnect',
                        danger: true,
                      });
                      if (!ok) return;
                      try {
                        await api.canvaDisconnect(clientId);
                        toast.success('Disconnected');
                        mutateStatus();
                      } catch (e) {
                        toast.error('Disconnect failed', (e as Error).message);
                      }
                    }}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <a
                  href={api.canvaConnectUrl(clientId)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-cta px-4 py-2 text-xs font-medium text-white shadow-brand hover:opacity-95"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Connect Canva
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {connected ? (
        <>
          {brandTemplates.length > 0 ? (
            <Card>
              <CardContent className="p-5 md:p-6">
                <h3 className="text-sm font-semibold text-slate-900">Brand templates</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Autofill a template from a caption + hero image using the Content Studio. For now,
                  here&apos;s a quick list of what&apos;s available in this Canva workspace.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                  {brandTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="aspect-square overflow-hidden bg-slate-100">
                        {t.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.thumbnailUrl} alt={t.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Palette className="h-8 w-8 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-[11px] font-medium text-slate-700">{t.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Recent designs</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Import a design to drop a PNG (or MP4 for videos) into the media library.
                  </p>
                </div>
              </div>
              {designs.length === 0 ? (
                <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">
                  No designs visible yet. Head to canva.com and create something first.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {designs.map((d) => (
                    <div
                      key={d.id}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="aspect-square overflow-hidden bg-slate-100">
                        {d.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={d.thumbnailUrl}
                            alt={d.title ?? 'Design'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Palette className="h-8 w-8 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2">
                        <p className="line-clamp-1 text-xs font-medium text-slate-800">
                          {d.title ?? 'Untitled'}
                        </p>
                        {d.updatedAt ? (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {new Date(d.updatedAt).toLocaleDateString()}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 border-t border-slate-100 px-2 py-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            setImporting(d.id);
                            try {
                              await api.canvaImportDesign({
                                clientId,
                                designId: d.id,
                                format: 'png',
                                caption: d.title ?? undefined,
                              });
                              toast.success('Imported to library');
                            } catch (e) {
                              toast.error('Import failed', (e as Error).message);
                            } finally {
                              setImporting(null);
                            }
                          }}
                          disabled={importing === d.id}
                          loading={importing === d.id}
                        >
                          <ArrowRight className="h-3 w-3" />
                          Import
                        </Button>
                        {d.editUrl ? (
                          <a
                            href={d.editUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800"
                          >
                            Edit
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
