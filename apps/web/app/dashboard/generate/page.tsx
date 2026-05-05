'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR, { mutate as swrMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { mockClients, postImageUrl, type Post } from '@boost/core';
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

/**
 * Per-platform character targets. Used to warn users when an edit drifts
 * outside what actually performs well on that platform. Not a hard cap —
 * people sometimes want to break the rules deliberately.
 */
const PLATFORM_LIMITS: Record<string, { min: number; max: number }> = {
  instagram: { min: 150, max: 300 },
  facebook: { min: 100, max: 250 },
  linkedin: { min: 400, max: 800 },
  tiktok: { min: 50, max: 150 },
  x: { min: 50, max: 270 },
};

interface Step {
  key: string;
  label: string;
  status: 'idle' | 'doing' | 'done' | 'failed';
  durationMs?: number;
}

const BASE_STEPS: Step[] = [
  { key: 'scrape_site', label: 'Reading the website', status: 'idle' },
  { key: 'fetch_images', label: 'Collecting photos', status: 'idle' },
  { key: 'analyze_images', label: 'Scoring uploaded photos', status: 'idle' },
  { key: 'enhance_images', label: 'Enhancing images with Flux', status: 'idle' },
  { key: 'generate_calendar', label: 'Drafting captions', status: 'idle' },
  { key: 'persist_posts', label: 'Packaging for review', status: 'idle' },
];

/**
 * UUID v4 (and v7) format check. Lets us catch mock-IDs (e.g. "c_murphy")
 * before the API call so the error message is meaningful instead of a
 * generic 500.
 */
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

  // Start blank, sync to first real client once the list arrives. Prevents
  // mock ids leaking into real API calls if someone smashes Generate while
  // the list is still loading.
  const [clientId, setClientId] = useState<string>('');
  useEffect(() => {
    if (!clients.length) return;
    if (!clientId || !clients.find((c) => c.id === clientId)) {
      setClientId(clients[0]!.id);
    }
  }, [clients, clientId]);

  const [count, setCount] = useState(30);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [platforms, setPlatforms] = useState<Set<string>>(
    new Set(['instagram', 'facebook', 'linkedin']),
  );
  const [notes, setNotes] = useState('Lean into seasonal angles and showcase the team.');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>(BASE_STEPS);
  const [result, setResult] = useState<{
    batchId: string;
    postsGenerated: number;
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
      toast.error(
        'Pick a client',
        clients.length === 0
          ? 'Loading your clients — try again in a moment.'
          : 'Choose who this is for from the dropdown.',
      );
      return;
    }
    if (platforms.size === 0) {
      toast.error('Pick at least one platform', 'We need to know where these are going.');
      return;
    }
    setRunning(true);
    setResult(null);
    setSteps(BASE_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'doing' : 'idle' })));

    let currentIdx = 0;
    const advanceTimer = setInterval(() => {
      currentIdx = Math.min(BASE_STEPS.length - 1, currentIdx + 1);
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === currentIdx
            ? { ...s, status: 'doing' }
            : idx < currentIdx
              ? { ...s, status: 'done' }
              : s,
        ),
      );
    }, 700);

    try {
      const res = await api.generate({
        clientId,
        month,
        postsCount: count,
        platforms: Array.from(platforms),
        direction: notes,
      });
      clearInterval(advanceTimer);
      setSteps((prev) =>
        prev.map((s) => {
          const match = res.steps.find((r) => r.key === s.key);
          return match
            ? { ...s, status: match.ok ? 'done' : 'failed', durationMs: match.durationMs }
            : { ...s, status: 'done' };
        }),
      );
      setResult({
        batchId: res.batchId,
        postsGenerated: res.postsGenerated,
        costCents: res.costCents,
      });
      toast.success('Batch ready', `${res.postsGenerated} posts drafted`);
    } catch (e) {
      clearInterval(advanceTimer);
      toast.error('Generation failed', (e as Error).message);
      setSteps((prev) => prev.map((s) => (s.status === 'doing' ? { ...s, status: 'failed' } : s)));
    } finally {
      setRunning(false);
    }
  };

  /**
   * Dynamic cost estimate. Base is ~$0.18/post for Claude + ~$0.04 per
   * generated image. We assume ~35% of posts need gap-fill images
   * (consistent with past batches). Figure is still approximate but it's
   * grounded in actual API pricing instead of a hardcoded €0.30.
   */
  const estCostCents = useMemo(() => {
    const perPostClaudeCents = 18;
    const perGenImageCents = 4;
    const expectedGenImages = Math.round(count * 0.35);
    return perPostClaudeCents * count + perGenImageCents * expectedGenImages;
  }, [count]);

  /** Time estimate scales with count. ~5s/post for Claude, small overhead. */
  const estMinutes = useMemo(() => Math.max(2, Math.round((count * 5 + 30) / 60)), [count]);

  return (
    <>
      <PageHeader
        title="Generate content"
        subtitle="Kick off an AI run for one client: brand voice, captions, images, and schedule."
      />

      <div className="px-4 py-4 md:px-10 md:py-6">
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[1fr_440px]">
          <Card>
            <CardContent className="p-5 md:p-6">
              <label className="block text-sm font-medium text-slate-700">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={clientsLoading || clients.length === 0}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm no-zoom disabled:cursor-not-allowed disabled:opacity-60"
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

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Posts</label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="mt-1.5 no-zoom"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Month</label>
                  <Input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="mt-1.5 no-zoom"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-700">Platforms</label>
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

              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-700">
                  Direction{' '}
                  <span className="font-normal text-slate-400">
                    (seasonal angles, campaigns, things to mention)
                  </span>
                </label>
                <Textarea
                  className="mt-1.5 no-zoom"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  Est. cost:{' '}
                  <span className="font-semibold text-slate-700">
                    ~${(estCostCents / 100).toFixed(2)}
                  </span>
                  {' · '}Est. time {estMinutes} min
                </div>
                <Button
                  onClick={run}
                  loading={running}
                  size="lg"
                  disabled={running || clientsLoading || !clientId}
                >
                  {running ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                  {running
                    ? 'Running…'
                    : clientsLoading
                      ? 'Loading clients…'
                      : 'Generate'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Wand2 className="h-4 w-4 text-[#1D9CA1]" />
                  Pipeline
                </div>
                <ol className="mt-4 space-y-3">
                  {steps.map((s, i) => (
                    <li key={s.key} className="flex items-center gap-3 text-sm">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                          s.status === 'done'
                            ? 'bg-gradient-cta text-white'
                            : s.status === 'doing'
                              ? 'bg-[#FFEC3D] text-slate-900'
                              : s.status === 'failed'
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.status === 'done' ? (
                          <Check className="h-3 w-3" />
                        ) : s.status === 'doing' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : s.status === 'failed' ? (
                          '!'
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={s.status === 'idle' ? 'text-slate-500' : 'text-slate-900'}>
                        {s.label}
                      </span>
                      {s.durationMs ? (
                        <span className="ml-auto text-[10px] text-slate-400">
                          {(s.durationMs / 1000).toFixed(1)}s
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Badge tone="brand">AI safe</Badge>
              <p className="text-xs text-slate-600">
                Every post still needs human approval before publishing.
              </p>
            </div>
          </aside>
        </div>

        {/*
         * Post preview grid. Appears once a batch completes. Pulls the just-
         * generated posts from the batch so users see what the pipeline
         * actually produced before they send it to the review queue. Each
         * post is individually editable and regen-able — no round-trip to
         * the review page needed for small fixes.
         */}
        <AnimatePresence>
          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6"
            >
              <GeneratedPostsPreview batchId={result.batchId} postsGenerated={result.postsGenerated} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Post preview                                                        */
/* ------------------------------------------------------------------ */

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
              Tweak captions or regenerate any card before sending to the review queue.
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
                Open queue
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
                  // refresh this batch's posts after an edit or regen.
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

/* ------------------------------------------------------------------ */
/* Single post card                                                    */
/* ------------------------------------------------------------------ */

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

  // Keep draft in sync when the post is updated from elsewhere (e.g.
  // realtime broadcast after another regen).
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
      await api.updatePost(post.id, {
        caption: draft.caption,
        hashtags,
      });
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
      toast.success('New draft ready', res.rationale);
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

  const scheduledAt = post.scheduledAt ? new Date(post.scheduledAt as any) : null;
  const dateLabel = scheduledAt
    ? scheduledAt.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';

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

        {/* Platform chip */}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium capitalize text-white backdrop-blur">
          <Icon className="h-3 w-3" />
          {post.platform}
        </div>

        {/* Schedule chip */}
        {dateLabel ? (
          <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 backdrop-blur">
            {dateLabel}
          </div>
        ) : null}

        {/* Image regen overlay */}
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
            <div className="mt-3 flex items-center justify-between gap-2">
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
                  title="Regenerate caption"
                >
                  {regenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  Regenerate
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Regenerate instruction dialog */}
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
                placeholder="e.g. make it funnier · mention the new Cork opening · shorter hook · less salesy"
                value={regenInstruction}
                onChange={(e) => setRegenInstruction(e.target.value)}
                className="mt-2 no-zoom text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Leave blank for a fresh take in the same brand voice.
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
