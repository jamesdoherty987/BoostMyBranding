'use client';

/**
 * Unified Generate Content page.
 *
 * One entry point, one client picker, one switcher for the type of output:
 *
 *   - captions    : monthly caption batch (the original flow)
 *   - ai_video    : personalized AI video using client media (MediaStory)
 *   - ai_image    : single one-off AI image with a brief (Flux)
 *   - template    : brand-template video (Liquid Blob, Aurora, etc.)
 *   - upload      : jump straight to the Upload tab of the Media Studio
 *
 * Truthful-mode is default everywhere: the backend refuses to invent
 * people, dates, or events. Results show what was generated AND what
 * was skipped, with reasons.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate as swrMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { mockClients, postImageUrl, type ClientImage, type Post } from '@boost/core';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Spinner,
  toast,
} from '@boost/ui';
import {
  Sparkles,
  Check,
  Loader2,
  Wand2,
  Image as ImageIcon,
  ArrowRight,
  RefreshCcw,
  Edit3,
  Save,
  X,
  Instagram,
  Facebook,
  Linkedin,
  Music2,
  Twitter,
  AlertCircle,
  MessageSquare,
  Type as TypeIcon,
  Video,
  Film,
  Upload,
  CheckCircle2,
  PlayCircle,
  ExternalLink,
  Shield,
  Copy as CopyIcon,
  Trash2,
  Zap,
  Minimize2,
  Heart,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { api } from '@/lib/dashboard/api';

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'x'] as const;

const PLATFORM_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music2,
  x: Twitter,
};

const PLATFORM_LIMITS: Record<string, { min: number; max: number }> = {
  instagram: { min: 150, max: 300 },
  facebook: { min: 100, max: 250 },
  linkedin: { min: 400, max: 800 },
  tiktok: { min: 50, max: 150 },
  x: { min: 50, max: 270 },
};

type Mode = 'captions' | 'ai_video' | 'ai_image' | 'template' | 'upload';

const MODES: Array<{ key: Mode; label: string; icon: typeof Sparkles; description: string }> = [
  {
    key: 'captions',
    label: 'Monthly captions',
    icon: TypeIcon,
    description: 'A batch of captions for the month, honest and on-brand.',
  },
  {
    key: 'ai_video',
    label: 'AI video',
    icon: Wand2,
    description: 'Personalised reel from the client\'s own photos and clips.',
  },
  {
    key: 'ai_image',
    label: 'AI image',
    icon: ImageIcon,
    description: 'One-off generated still, briefed by you.',
  },
  {
    key: 'template',
    label: 'Template video',
    icon: Film,
    description: 'Brand-template reel (Liquid Blob, Aurora, etc).',
  },
  {
    key: 'upload',
    label: 'Upload media',
    icon: Upload,
    description: 'Bring in photos or videos from your laptop.',
  },
];

const isValidUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export default function GeneratePage() {
  const { data: clients = [], isLoading: clientsLoading } = useSWR(
    'generate:clients',
    async () => {
      try {
        return await api.listClients();
      } catch {
        return mockClients;
      }
    },
  );

  const [mode, setMode] = useState<Mode>('captions');
  const [clientId, setClientId] = useState<string>('');
  useEffect(() => {
    if (!clients.length) return;
    if (!clientId || !clients.find((c) => c.id === clientId)) {
      setClientId(clients[0]!.id);
    }
  }, [clients, clientId]);

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <>
      <PageHeader
        title="Generate content"
        subtitle="Pick a client, pick a mode, generate. Everything stays truthful — we refuse to invent facts."
      />

      <div className="px-4 py-4 md:px-10 md:py-6 space-y-5">
        {/* Client + mode switcher */}
        <Card>
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Client
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={clientsLoading || clients.length === 0}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm md:max-w-md no-zoom disabled:opacity-60"
                >
                  {clientsLoading ? (
                    <option>Loading clients…</option>
                  ) : clients.length === 0 ? (
                    <option>No clients yet — add one from the Clients tab</option>
                  ) : (
                    <>
                      {!clientId ? (
                        <option value="" disabled>
                          Select a client…
                        </option>
                      ) : null}
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.businessName} · {c.industry ?? ''}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <Shield className="h-3.5 w-3.5" />
                Truthful mode — won&apos;t invent people, dates, events, or claims.
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                      active
                        ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 ring-1 ring-[#1D9CA1]/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-[#1D9CA1]' : 'text-slate-500'}`} />
                    <p className={`mt-2 text-xs font-semibold ${active ? 'text-slate-900' : 'text-slate-800'}`}>
                      {m.label}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500 line-clamp-2">
                      {m.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {mode === 'captions' ? (
              <CaptionsMode
                clientId={clientId}
                clients={clients}
                clientsLoading={clientsLoading}
              />
            ) : mode === 'ai_video' ? (
              <AIVideoMode clientId={clientId} businessName={selectedClient?.businessName} />
            ) : mode === 'ai_image' ? (
              <AIImageMode clientId={clientId} />
            ) : mode === 'template' ? (
              <TemplateMode clientId={clientId} businessName={selectedClient?.businessName} />
            ) : (
              <UploadMode clientId={clientId} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

/* ================================================================== */
/* Captions mode (monthly batch)                                       */
/* ================================================================== */

function CaptionsMode({
  clientId,
  clients,
  clientsLoading,
}: {
  clientId: string;
  clients: Awaited<ReturnType<typeof api.listClients>>;
  clientsLoading: boolean;
}) {
  const [count, setCount] = useState(30);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [platforms, setPlatforms] = useState<Set<string>>(
    new Set(['instagram', 'facebook', 'linkedin']),
  );
  const [notes, setNotes] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    batchId: string;
    postsGenerated: number;
    postsRequested: number;
    postsSkipped: number;
    skipReasons: string[];
    costCents: number;
  } | null>(null);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const run = async () => {
    if (!clientId || !isValidUuid(clientId)) {
      toast.error('Pick a real client', 'Can\'t generate for mock data.');
      return;
    }
    if (platforms.size === 0) {
      toast.error('Pick at least one platform');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await api.generate({
        clientId,
        month,
        postsCount: count,
        platforms: Array.from(platforms),
        direction: notes.trim() || undefined,
      });
      setResult({
        batchId: res.batchId,
        postsGenerated: res.postsGenerated,
        postsRequested: res.postsRequested ?? count,
        postsSkipped: res.postsSkipped ?? 0,
        skipReasons: res.skipReasons ?? [],
        costCents: res.costCents,
      });
      if (res.postsSkipped && res.postsSkipped > 0) {
        toast.info(
          `${res.postsGenerated} posts drafted · ${res.postsSkipped} skipped`,
          'We only wrote posts we could ground in real inputs.',
        );
      } else {
        toast.success(`${res.postsGenerated} posts drafted`);
      }
    } catch (e) {
      toast.error('Generation failed', (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const estCostCents = useMemo(() => 18 * count, [count]);
  const estMinutes = useMemo(() => Math.max(2, Math.round((count * 5 + 30) / 60)), [count]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardContent className="p-5 md:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Monthly captions batch</h2>
            <p className="mt-1 text-xs text-slate-500">
              We read your website, pull your uploaded photos, and draft posts tied to real images
              and facts only. Any slot we can&apos;t write honestly is skipped with a reason.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Posts (max)</label>
              <Input
                type="number"
                min={1}
                max={60}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Month</label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Platforms</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const Icon = PLATFORM_ICON[p]!;
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      platforms.has(p)
                        ? 'border-transparent bg-gradient-cta text-white shadow-brand'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">
              Direction{' '}
              <span className="font-normal text-slate-400">
                — real campaigns, real events, real dates only
              </span>
            </label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional. E.g. 'We just added weekend hours — mention it.' Leave blank to let the model stay generic where it has to."
              className="mt-1 text-sm"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] text-slate-500">
              Est. cost ~${(estCostCents / 100).toFixed(2)} · est. time {estMinutes} min
            </div>
            <Button onClick={run} disabled={running || clientsLoading || !clientId} size="lg">
              {running ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              {running ? 'Running…' : 'Generate captions'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        {result ? (
          <Card>
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-[#48D886]" />
                {result.postsGenerated} / {result.postsRequested} posts drafted
              </div>
              {result.postsSkipped > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">
                    {result.postsSkipped} skipped — not enough real data
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {result.skipReasons.slice(0, 5).map((r, i) => (
                      <li key={i} className="text-[11px] text-amber-800">
                        • {r}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-amber-700">
                    Upload more media or fill in the client&apos;s facts (address, team, services)
                    to unlock more posts.
                  </p>
                </div>
              ) : null}
              <p className="mt-3 text-[11px] text-slate-500">
                Est. cost ~${(result.costCents / 100).toFixed(2)}
              </p>
              <a href="/dashboard/review" className="mt-3 block">
                <Button size="sm" className="w-full">
                  Open review queue
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </a>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Badge tone="brand">Safe</Badge>
          <p className="text-xs text-slate-600">
            No fabricated names, dates, or stories. Every post is grounded in an uploaded image or
            a fact you&apos;ve given us.
          </p>
        </div>
      </aside>

      {result ? (
        <div className="lg:col-span-2">
          <GeneratedPostsPreview
            batchId={result.batchId}
            postsGenerated={result.postsGenerated}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* AI video mode (personalized reel)                                   */
/* ================================================================== */

const INTENTS: Array<{
  key: 'brand_story' | 'promo' | 'team_intro' | 'menu_reveal' | 'before_after' | 'location_tour';
  label: string;
  hint: string;
}> = [
  { key: 'brand_story', label: 'Brand story', hint: 'Who we are, what we do.' },
  { key: 'promo', label: 'Promotion', hint: 'A specific offer, launch, or event.' },
  { key: 'team_intro', label: 'Team intro', hint: 'Needs named staff.' },
  { key: 'menu_reveal', label: 'Menu reveal', hint: 'Show what you sell.' },
  { key: 'before_after', label: 'Before / after', hint: 'Transformation-style.' },
  { key: 'location_tour', label: 'Location tour', hint: 'Walk around the space.' },
];

const MUSIC_MOODS = [
  'calm piano',
  'upbeat acoustic',
  'corporate upbeat',
  'ambient electronic',
  'cinematic orchestral',
  'hip-hop chill',
  'retro synthwave',
  'none (silent)',
];

function AIVideoMode({ clientId, businessName }: { clientId: string; businessName?: string }) {
  const { data: media = [] } = useSWR(
    clientId && isValidUuid(clientId) ? ['video:media', clientId] : null,
    () => api.listImages(clientId).catch(() => [] as ClientImage[]),
  );

  // Core
  const [intent, setIntent] =
    useState<(typeof INTENTS)[number]['key']>('brand_story');
  const [clipCount, setClipCount] = useState(5);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '16:9'>('9:16');
  const [pacing, setPacing] = useState<'slow' | 'balanced' | 'fast'>('balanced');
  const [captionStyle, setCaptionStyle] = useState<
    'minimal' | 'bold' | 'magazine' | 'handwritten' | 'subtitle'
  >('minimal');
  const [openingFrame, setOpeningFrame] = useState<
    'hook_headline' | 'wide_shot' | 'close_up' | 'logo_reveal'
  >('hook_headline');
  const [closingFrame, setClosingFrame] = useState<
    'cta_card' | 'logo_only' | 'contact_info' | 'fade_to_black'
  >('cta_card');
  const [musicMood, setMusicMood] = useState<string>('none (silent)');
  const [minimumClips, setMinimumClips] = useState(3);

  // Copy
  const [headline, setHeadline] = useState('');
  const [cta, setCta] = useState('');
  const [direction, setDirection] = useState('');

  // Media
  const [useAllMedia, setUseAllMedia] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allowSynthesis, setAllowSynthesis] = useState(false);
  const [enableMotion, setEnableMotion] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof api.generatePersonalizedVideo>
  > | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectable = media.filter((m) => (m.status ?? 'approved') !== 'rejected');
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mediaCount = useAllMedia ? selectable.length : selectedIds.size;
  const hasEnoughMedia = mediaCount >= minimumClips || allowSynthesis;

  const run = async () => {
    if (!clientId || !isValidUuid(clientId)) {
      toast.error('Pick a real client');
      return;
    }
    if (!hasEnoughMedia) {
      toast.error(
        'Not enough media',
        `Upload at least ${minimumClips} items for this client, or enable AI fills.`,
      );
      return;
    }
    setRunning(true);
    setResult(null);
    setErrorMsg(null);
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
        aspectRatio,
        pacing,
        musicMood: musicMood === 'none (silent)' ? undefined : musicMood,
        captionStyle,
        openingFrame,
        closingFrame,
        allowSynthesis,
        minimumClips,
      });
      setResult(res);
      if (res.skippedClips.length > 0) {
        toast.info(
          `${res.clips.length} clips rendered · ${res.skippedClips.length} skipped`,
          'Skipped clips had no matching media.',
        );
      } else {
        toast.success('Video ready');
      }
    } catch (e) {
      const msg = (e as Error).message;
      setErrorMsg(msg);
      toast.error('Could not render', msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardContent className="p-5 md:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Personalised AI video</h2>
            <p className="mt-1 text-xs text-slate-500">
              Uses {businessName ?? 'this client'}&apos;s own photos and clips. Captions are
              grounded in what the AI actually sees in each clip.
            </p>
          </div>

          {/* Intent */}
          <div>
            <label className="text-xs font-medium text-slate-600">Video intent</label>
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

          {/* Clips + aspect ratio + pacing */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Target clips</label>
              <Input
                type="number"
                min={3}
                max={6}
                value={clipCount}
                onChange={(e) =>
                  setClipCount(Math.max(3, Math.min(6, Number(e.target.value))))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Aspect ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as any)}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm no-zoom"
              >
                <option value="9:16">9:16 (Reels / TikTok)</option>
                <option value="1:1">1:1 (Feed)</option>
                <option value="16:9">16:9 (YouTube)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Pacing</label>
              <select
                value={pacing}
                onChange={(e) => setPacing(e.target.value as any)}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm no-zoom"
              >
                <option value="slow">Slow · premium</option>
                <option value="balanced">Balanced</option>
                <option value="fast">Fast · high-energy</option>
              </select>
            </div>
          </div>

          {/* Copy */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">
                Outro headline <span className="text-slate-400">(optional)</span>
              </label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Auto-written if blank"
                maxLength={120}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                CTA <span className="text-slate-400">(must be a real contact method)</span>
              </label>
              <Input
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="e.g. Call [phone], Book online"
                maxLength={40}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">
              Direction <span className="text-slate-400">(optional · real facts only)</span>
            </label>
            <Textarea
              rows={2}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="E.g. 'Focus on the exterior and the work van.' Don't ask for facts that aren't true — they'll be skipped."
              maxLength={500}
              className="mt-1 text-sm"
            />
          </div>

          {/* Advanced options */}
          <div>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-medium text-[#1D9CA1] hover:underline"
            >
              {showAdvanced ? 'Hide advanced options ↑' : 'Show advanced options ↓'}
            </button>
            {showAdvanced ? (
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Opening frame</label>
                  <select
                    value={openingFrame}
                    onChange={(e) => setOpeningFrame(e.target.value as any)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs no-zoom"
                  >
                    <option value="hook_headline">Hook headline</option>
                    <option value="wide_shot">Wide establishing shot</option>
                    <option value="close_up">Tight close-up</option>
                    <option value="logo_reveal">Logo reveal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Closing frame</label>
                  <select
                    value={closingFrame}
                    onChange={(e) => setClosingFrame(e.target.value as any)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs no-zoom"
                  >
                    <option value="cta_card">CTA card</option>
                    <option value="logo_only">Logo only</option>
                    <option value="contact_info">Contact info</option>
                    <option value="fade_to_black">Fade to black</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Caption style</label>
                  <select
                    value={captionStyle}
                    onChange={(e) => setCaptionStyle(e.target.value as any)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs no-zoom"
                  >
                    <option value="minimal">Minimal</option>
                    <option value="bold">Bold uppercase</option>
                    <option value="magazine">Magazine serif</option>
                    <option value="handwritten">Handwritten</option>
                    <option value="subtitle">Subtitle</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Music mood</label>
                  <select
                    value={musicMood}
                    onChange={(e) => setMusicMood(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs no-zoom"
                  >
                    {MUSIC_MOODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-slate-600">
                    Minimum usable clips (refuses to render below this)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    value={minimumClips}
                    onChange={(e) =>
                      setMinimumClips(Math.max(1, Math.min(6, Number(e.target.value))))
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Media picker */}
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">Media source</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {useAllMedia
                    ? `Use all ${selectable.length} items.`
                    : `Use the ${selectedIds.size} selected items.`}
                </p>
              </div>
              <div className="flex gap-1 rounded-full border border-slate-200 bg-white p-1 text-[11px]">
                <button
                  onClick={() => setUseAllMedia(true)}
                  className={`rounded-full px-3 py-1 font-medium ${
                    useAllMedia ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setUseAllMedia(false)}
                  className={`rounded-full px-3 py-1 font-medium ${
                    !useAllMedia ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Curated
                </button>
              </div>
            </div>

            {!useAllMedia ? (
              selectable.length === 0 ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No media uploaded yet. Switch to the{' '}
                  <Link href="/dashboard/media" className="underline">
                    Media library
                  </Link>{' '}
                  to add some.
                </div>
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
                          /* eslint-disable-next-line jsx-a11y/media-has-caption */
                          <video
                            src={m.fileUrl}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={m.fileUrl} alt="" className="h-full w-full object-cover" />
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

          {/* Allow synthesis */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={allowSynthesis}
              onChange={(e) => setAllowSynthesis(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#48D886]"
            />
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Fill missing clips with AI-generated images
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Off by default. If the client&apos;s media pool is too small, we prefer to render
                a shorter, more honest video than pad with stock-looking AI fills. Turn on only
                when you&apos;re confident the brand aesthetic can handle it.
              </p>
            </div>
          </label>

          {/* Motion toggle */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={enableMotion}
              onChange={(e) => setEnableMotion(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#48D886]"
            />
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Animate selected still photos into motion clips
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Adds ~30 seconds per animated clip via Fal. Good for launches and reveals.
              </p>
            </div>
          </label>

          {!hasEnoughMedia ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>
                Need at least {minimumClips} items to render this video. Currently {mediaCount}{' '}
                available{allowSynthesis ? '' : '. Enable AI fills or upload more media.'}
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] text-slate-500">
              Render time ~45–90s. Longer when animating.
            </span>
            <Button onClick={run} disabled={running} size="lg">
              {running ? <Spinner /> : <Wand2 className="h-4 w-4" />}
              {running ? 'Rendering…' : 'Render video'}
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
            {errorMsg ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <p className="font-semibold">Could not render:</p>
                <p className="mt-1">{errorMsg}</p>
                <p className="mt-2 text-[11px] text-rose-700">
                  Upload more media or fill in the client&apos;s facts to give the AI more to
                  work with.
                </p>
              </div>
            ) : result ? (
              <div className="mt-4 space-y-3">
                <div
                  className="relative overflow-hidden rounded-xl bg-slate-900"
                  style={{
                    aspectRatio:
                      aspectRatio === '9:16' ? '9/16' : aspectRatio === '1:1' ? '1/1' : '16/9',
                  }}
                >
                  {result.fromMock ? (
                    <div className="flex h-full items-center justify-center p-6 text-center">
                      <div>
                        <PlayCircle className="mx-auto h-8 w-8 text-white/60" />
                        <p className="mt-2 text-xs text-white/60">
                          Mock mode — add DB + keys for real output.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* eslint-disable-next-line jsx-a11y/media-has-caption */
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
                    Rendered script
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
                            <span className="mr-1 uppercase text-slate-400">{c.eyebrow}</span>
                          ) : null}
                          <span>{c.caption ?? '(no caption)'}</span>
                          <span className="ml-1 text-slate-400">
                            · {c.durationSeconds.toFixed(1)}s
                            {c.sourceKind === 'synthesis'
                              ? ' · AI fill'
                              : c.sourceKind === 'motion'
                                ? ' · animated'
                                : ''}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {result.skippedClips.length > 0 ? (
                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <p className="text-[10px] font-semibold uppercase text-amber-700">
                        Skipped
                      </p>
                      {result.skippedClips.map((s) => (
                        <p key={s.order} className="text-[10px] text-amber-800">
                          · clip {s.order + 1}: {s.reason}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div
                className="mt-4 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50"
                style={{
                  aspectRatio:
                    aspectRatio === '9:16' ? '9/16' : aspectRatio === '1:1' ? '1/1' : '16/9',
                }}
              >
                <Film className="h-10 w-10 text-slate-300" />
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

/* ================================================================== */
/* AI image mode                                                       */
/* ================================================================== */

function AIImageMode({ clientId }: { clientId: string }) {
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('1:1');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ imageUrl: string; prompt: string } | null>(null);

  const run = async () => {
    if (!clientId || !isValidUuid(clientId)) {
      toast.error('Pick a real client');
      return;
    }
    if (prompt.trim().length < 10) {
      toast.error('Give it a real brief', 'Describe subject, setting, lighting, mood.');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      // Reuse the hero-image endpoint with the prompt override — it already
      // generates a one-off Flux image and persists to the client's media.
      const res = await api.generateHeroImage({
        clientId,
        overridePrompt: prompt.trim(),
      });
      setResult({ imageUrl: res.imageUrl, prompt: res.prompt });
      toast.success('Image ready');
    } catch (e) {
      toast.error('Generation failed', (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardContent className="p-5 md:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">AI image (single)</h2>
            <p className="mt-1 text-xs text-slate-500">
              One-off Flux generation with your brief. Useful for filler shots, launch art, or
              abstract backgrounds.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">
              Brief <span className="text-slate-400">(be specific)</span>
            </label>
            <Textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Flat-lay of espresso beans on weathered wood, warm morning window light, shallow DoF, editorial style"
              className="mt-1 text-sm"
              maxLength={1000}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Aspect ratio</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(['1:1', '4:5', '9:16', '16:9'] as const).map((ar) => (
                <button
                  key={ar}
                  onClick={() => setAspect(ar)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    aspect === ar
                      ? 'border-transparent bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button onClick={run} disabled={running} size="lg">
              {running ? <Spinner /> : <ImageIcon className="h-4 w-4" />}
              {running ? 'Generating…' : 'Generate image'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <aside>
        <Card>
          <CardContent className="p-5 md:p-6">
            <p className="text-sm font-semibold text-slate-900">Preview</p>
            {result ? (
              <div className="mt-3 space-y-3">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-900">
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={result.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Saved to the client&apos;s library.</p>
              </div>
            ) : (
              <div className="mt-3 flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-slate-200">
                <ImageIcon className="h-10 w-10 text-slate-300" />
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

/* ================================================================== */
/* Template video mode                                                 */
/* ================================================================== */

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  durationFrames: number;
  usesImage: boolean;
  bestFor: readonly string[];
}

function TemplateMode({ clientId, businessName }: { clientId: string; businessName?: string }) {
  const { data: templates = [] } = useSWR('gen:templates', async () => {
    try {
      return (await api.listVideoTemplates()) as TemplateMeta[];
    } catch {
      return [] as TemplateMeta[];
    }
  });
  const { data: media = [] } = useSWR(
    clientId && isValidUuid(clientId) ? ['gen:template-media', clientId] : null,
    () => api.listImages(clientId).catch(() => [] as ClientImage[]),
  );

  const shown = templates.filter((t) => t.id !== 'media-story');

  const [templateId, setTemplateId] = useState('liquid-blob');
  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [cta, setCta] = useState('');
  const [domain, setDomain] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.renderVideo>> | null>(null);

  const selected = shown.find((t) => t.id === templateId);
  const photos = media.filter((m) => !(m.mimeType ?? '').startsWith('video/'));

  const run = async () => {
    if (!clientId || !isValidUuid(clientId)) {
      toast.error('Pick a real client');
      return;
    }
    if (headline.trim().length < 2) {
      toast.error('Headline required');
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
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 md:p-6">
          <p className="text-sm font-semibold text-slate-900">Pick a template</p>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
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
                      {(t.durationFrames / 30).toFixed(0)}s ·{' '}
                      {t.usesImage ? 'with image' : 'text'}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-2 text-[11px] text-slate-500 line-clamp-2">
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardContent className="p-5 md:p-6 space-y-4">
            <p className="text-sm font-semibold text-slate-900">
              Details · <span className="text-[#1D9CA1]">{selected?.name ?? 'None'}</span>
            </p>
            <div>
              <label className="text-xs font-medium text-slate-600">Headline</label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={80}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Subheadline</label>
              <Input
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                maxLength={100}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">CTA</label>
                <Input
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  maxLength={30}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Domain</label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  maxLength={60}
                  className="mt-1"
                />
              </div>
            </div>

            {selected?.usesImage ? (
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Image {photos.length > 0 ? `(or pick from ${photos.length} uploaded)` : ''}
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
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={m.fileUrl} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button onClick={run} disabled={rendering} size="lg">
                {rendering ? <Spinner /> : <Film className="h-4 w-4" />}
                {rendering ? 'Rendering…' : 'Render video'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <aside>
          <Card>
            <CardContent className="p-5 md:p-6">
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              {result ? (
                <div className="mt-3 space-y-2">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-slate-900">
                    {result.fromMock ? (
                      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-white/60">
                        Mock mode — add R2 keys for real renders.
                      </div>
                    ) : (
                      /* eslint-disable-next-line jsx-a11y/media-has-caption */
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
                </div>
              ) : (
                <div className="mt-3 flex aspect-[9/16] items-center justify-center rounded-xl border-2 border-dashed border-slate-200">
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

/* ================================================================== */
/* Upload pointer                                                       */
/* ================================================================== */

function UploadMode({ clientId }: { clientId: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Upload className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-sm font-semibold text-slate-900">Upload client media</h3>
        <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
          Drag photos or videos into the Media library. The more real media we have, the more
          honest posts and videos we can generate.
        </p>
        <Link
          href={
            clientId && isValidUuid(clientId)
              ? `/dashboard/media?tab=upload&clientId=${clientId}`
              : '/dashboard/media?tab=upload'
          }
          className="mt-4 inline-flex"
        >
          <Button>
            Open Media library
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* Shared: per-post preview grid (captions mode)                       */
/* ================================================================== */

function GeneratedPostsPreview({
  batchId,
  postsGenerated,
}: {
  batchId: string;
  postsGenerated: number;
}) {
  const { data: posts = [], isLoading } = useSWR(
    batchId ? ['posts:batch', batchId] : null,
    async () => {
      try {
        return await api.listPosts({ batchId });
      } catch {
        return [] as Post[];
      }
    },
    { refreshInterval: 0 },
  );

  const [filter, setFilter] = useState<'all' | string>('all');
  const platformsInBatch = useMemo(() => {
    const s = new Set<string>();
    posts.forEach((p) => s.add(p.platform));
    return Array.from(s);
  }, [posts]);

  const filtered = useMemo(
    () => (filter === 'all' ? posts : posts.filter((p) => p.platform === filter)),
    [posts, filter],
  );

  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ImageIcon className="h-4 w-4 text-[#48D886]" />
              {postsGenerated} post{postsGenerated === 1 ? '' : 's'} drafted
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Tweak captions or regenerate any card before sending to review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                filter === 'all'
                  ? 'border-transparent bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              All ({posts.length})
            </button>
            {platformsInBatch.map((p) => {
              const Icon = PLATFORM_ICON[p] ?? Instagram;
              const n = posts.filter((po) => po.platform === p).length;
              return (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all ${
                    filter === p
                      ? 'border-transparent bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {p} ({n})
                </button>
              );
            })}
            <a href="/dashboard/review">
              <Button size="sm">
                Review queue
                <ArrowRight className="h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 flex items-center justify-center py-12 text-sm text-slate-500">
            <Spinner /> <span className="ml-2">Loading previews…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4" />
            Posts were generated but we couldn&apos;t load the previews.{' '}
            <a href="/dashboard/review" className="underline">
              Open the review queue
            </a>
            .
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((post) => (
              <PostPreviewCard
                key={post.id}
                post={post}
                onChange={() => {
                  swrMutate(['posts:batch', batchId]);
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PostPreviewCard({ post, onChange }: { post: Post; onChange: () => void }) {
  const Icon = PLATFORM_ICON[post.platform] ?? Instagram;
  const imageUrl = postImageUrl(post);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    caption: post.caption,
    hashtags: (post.hashtags ?? []).join(' '),
  });
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  const [showRegenDialog, setShowRegenDialog] = useState(false);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setDraft({ caption: post.caption, hashtags: (post.hashtags ?? []).join(' ') });
  }, [post.caption, post.hashtags]);

  const limits = PLATFORM_LIMITS[post.platform];
  const charCount = draft.caption.length;
  const charStatus = limits
    ? charCount < limits.min
      ? 'short'
      : charCount > limits.max
        ? 'long'
        : 'ok'
    : 'ok';

  const save = async () => {
    setSaving(true);
    try {
      const hashtags = draft.hashtags
        .split(/\s+/)
        .map((h) => h.trim())
        .filter((h) => h.length > 0)
        .map((h) => (h.startsWith('#') ? h : `#${h}`));
      await api.updatePost(post.id, { caption: draft.caption, hashtags });
      toast.success('Saved');
      setEditing(false);
      onChange();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    setShowRegenDialog(false);
    try {
      const res = await api.regeneratePost({
        postId: post.id,
        instruction: regenInstruction.trim() || undefined,
      });
      const stripped = (res as any).fabricatedClaimsStrippedFromOriginal as
        | string[]
        | undefined;
      if (stripped && stripped.length > 0) {
        toast.info(
          'Fabricated claims removed',
          stripped.slice(0, 3).join(' · '),
        );
      } else {
        toast.success('New draft ready', res.rationale);
      }
      setRegenInstruction('');
      onChange();
    } catch (e) {
      toast.error('Regenerate failed', (e as Error).message);
    } finally {
      setRegenerating(false);
    }
  };

  const regenerateImage = async () => {
    setRegeneratingImage(true);
    try {
      await api.regeneratePostImage({ postId: post.id });
      toast.success('New image ready');
      onChange();
    } catch (e) {
      toast.error('Image regen failed', (e as Error).message);
    } finally {
      setRegeneratingImage(false);
    }
  };

  /**
   * Quick re-tone presets. Same endpoint as Regenerate, with the
   * instruction pre-filled — so a user click equals "regenerate in this
   * specific direction" without a dialog.
   */
  const runPresetRegen = async (instruction: string) => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      await api.regeneratePost({ postId: post.id, instruction });
      toast.success('Re-toned');
      onChange();
    } catch (e) {
      toast.error('Could not re-tone', (e as Error).message);
    } finally {
      setRegenerating(false);
    }
  };

  const duplicate = async () => {
    setDuplicating(true);
    try {
      await api.duplicatePost(post.id);
      toast.success('Duplicated', 'New draft added one day later.');
      onChange();
    } catch (e) {
      toast.error('Duplicate failed', (e as Error).message);
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deletePost(post.id);
      // Hide this card immediately; the parent list will refresh on next fetch.
      setHidden(true);
      toast.success('Post deleted');
      onChange();
    } catch (e) {
      toast.error('Delete failed', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const scheduledAt = post.scheduledAt ? new Date(post.scheduledAt as any) : null;
  const dateLabel = scheduledAt
    ? scheduledAt.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';

  if (hidden) return null;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium capitalize text-white backdrop-blur">
          <Icon className="h-3 w-3" />
          {post.platform}
        </div>

        {dateLabel ? (
          <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 backdrop-blur">
            {dateLabel}
          </div>
        ) : null}

        <button
          onClick={regenerateImage}
          disabled={regeneratingImage}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 disabled:opacity-60"
          title="Regenerate image"
        >
          {regeneratingImage ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCcw className="h-3 w-3" />
          )}
          New image
        </button>
      </div>

      <div className="p-4">
        {editing ? (
          <>
            <Textarea
              rows={5}
              value={draft.caption}
              onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
              className="no-zoom text-sm"
            />
            <div
              className={`mt-1 text-[11px] ${
                charStatus === 'ok'
                  ? 'text-slate-400'
                  : charStatus === 'short'
                    ? 'text-amber-600'
                    : 'text-rose-600'
              }`}
            >
              {charCount} chars
              {limits ? ` · target ${limits.min}–${limits.max}` : ''}
            </div>
            <Input
              className="mt-2 no-zoom text-xs"
              placeholder="#hashtags space separated"
              value={draft.hashtags}
              onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft({
                    caption: post.caption,
                    hashtags: (post.hashtags ?? []).join(' '),
                  });
                  setEditing(false);
                }}
                disabled={saving}
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
              <Button size="sm" onClick={save} loading={saving}>
                <Save className="h-3 w-3" />
                Save
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {post.caption}
            </p>
            {post.hashtags && post.hashtags.length > 0 ? (
              <p className="mt-2 text-[11px] text-slate-500">{post.hashtags.join(' ')}</p>
            ) : null}

            {/* Quick re-tone row — instant regens with preset instructions.
                Only visible when not editing. */}
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10px] uppercase tracking-wide text-slate-400">
                Re-tone
              </span>
              <QuickAction
                label="Shorter"
                icon={Minimize2}
                disabled={regenerating}
                onClick={() => runPresetRegen('Make it shorter and punchier — keep all real facts.')}
              />
              <QuickAction
                label="Warmer"
                icon={Heart}
                disabled={regenerating}
                onClick={() => runPresetRegen('Warmer and more conversational, still grounded in facts.')}
              />
              <QuickAction
                label="More direct"
                icon={Zap}
                disabled={regenerating}
                onClick={() => runPresetRegen('More direct — cut fluff, open with a fact.')}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <span className="text-[11px] text-slate-400">
                {charCount} chars
                {limits && charStatus !== 'ok'
                  ? charStatus === 'short'
                    ? ` · under target`
                    : ` · over target`
                  : ''}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300"
                  title="Edit caption"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={() => setShowRegenDialog(true)}
                  disabled={regenerating}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  title="Regenerate with custom instruction"
                >
                  {regenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  Regenerate
                </button>
                <button
                  onClick={duplicate}
                  disabled={duplicating}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  title="Duplicate — post again next day"
                >
                  {duplicating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CopyIcon className="h-3 w-3" />
                  )}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-60"
                  title="Delete this post"
                >
                  {deleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showRegenDialog ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col justify-end bg-slate-900/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: 20 }}
              className="rounded-xl bg-white p-4 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MessageSquare className="h-4 w-4 text-[#1D9CA1]" />
                What should be different?
              </div>
              <Textarea
                rows={3}
                autoFocus
                placeholder="e.g. shorter hook · less salesy · remove the opening question"
                value={regenInstruction}
                onChange={(e) => setRegenInstruction(e.target.value)}
                className="mt-2 no-zoom text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Real facts only. We won&apos;t invent names, dates, or events even if asked.
              </p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowRegenDialog(false);
                    setRegenInstruction('');
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={regenerate}>
                  <Wand2 className="h-3 w-3" />
                  Regenerate
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}


/**
 * Small pill button used for the Re-tone quick actions on each post
 * card. Kept tiny so three of them fit on one row above the main
 * action bar.
 */
function QuickAction({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof Minimize2;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-[#1D9CA1] hover:text-[#1D9CA1] disabled:opacity-50"
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </button>
  );
}
