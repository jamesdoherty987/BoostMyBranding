'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { type Post, postImageUrl, postScheduledAt } from '@boost/core';
import {
  Badge,
  Button,
  Textarea,
  Spinner,
  toast,
  usePostLock,
  useRealtime,
} from '@boost/ui';
import {
  Check,
  X,
  Edit3,
  Undo2,
  Sparkles,
  Instagram,
  Facebook,
  Linkedin,
  Music2,
  Twitter,
  Keyboard,
  Lock,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { api } from '@/lib/dashboard/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music2,
  x: Twitter,
  pinterest: Instagram,
  bluesky: Instagram,
};

type Action = 'approve' | 'reject' | 'edit';

interface Decision {
  post: Post;
  action: Action;
  note?: string;
}

export default function ReviewQueuePage() {
  const { data: me } = useSWR('dashboard:me', async () => {
    try {
      return await api.me();
    } catch {
      return { id: 'demo-user', email: 'demo@bmb.com', role: 'agency_admin', name: 'Demo' };
    }
  });

  const { data, isLoading, mutate } = useSWR('dashboard:review', async () => {
    try {
      const posts = (await api.listPosts({ status: 'pending_approval' })) as Post[];
      return posts;
    } catch (e) {
      console.warn('[review] load failed:', (e as Error).message);
      return [] as Post[];
    }
  });

  // Pull the real client list so filter chips can show every client
  // that has posts in the queue (not just the mocked three).
  const { data: clientList } = useSWR('dashboard:review:clients', async () => {
    try {
      return await api.listClients();
    } catch {
      return [] as Awaited<ReturnType<typeof api.listClients>>;
    }
  });

  const [filter, setFilter] = useState<string>('all');
  const [queue, setQueue] = useState<Post[]>([]);
  const [history, setHistory] = useState<Decision[]>([]);
  const [editing, setEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');

  // AI quick-actions state. Every action is mutually exclusive — a user
  // can't rewrite and swap the image at the same time — so we track a
  // single `busy` key plus whatever output the last action produced so
  // the panel can render it in place.
  const [quickBusy, setQuickBusy] = useState<null | 'warmer' | 'alts' | 'swap'>(null);
  const [altCaptions, setAltCaptions] = useState<Array<{ caption: string; hashtags: string[] }>>(
    [],
  );

  // Realtime: receive updates from teammates, react to presence locks.
  const onEvent = useCallback(
    (evt: { type: string; payload: any }) => {
      if (evt.type === 'post:updated' && evt.payload?.id) {
        setQueue((q) => q.filter((p) => p.id !== evt.payload.id));
      } else if (evt.type === 'post:batch-updated' && Array.isArray(evt.payload?.ids)) {
        const ids = new Set(evt.payload.ids);
        setQueue((q) => q.filter((p) => !ids.has(p.id)));
      }
    },
    [],
  );
  useRealtime(API_URL, onEvent);

  useEffect(() => {
    if (data) setQueue(data);
  }, [data]);

  const filtered = useMemo(() => {
    if (filter === 'all') return queue;
    return queue.filter((p) => p.clientId === filter);
  }, [queue, filter]);

  const top = filtered[0];
  const { getLocker } = usePostLock(API_URL, top?.id ?? null, me?.id);
  const locker = top ? getLocker(top.id) : undefined;

  // Reset quick-action output whenever we move to a new post so we
  // don't show alt captions belonging to the previous card.
  useEffect(() => {
    setAltCaptions([]);
    setQuickBusy(null);
  }, [top?.id]);

  // Guards against double-firing decisions — two rapid keyboard presses
  // or a realtime event arriving between the first click and the
  // optimistic removal both used to commit twice.
  const inFlight = useRef<Set<string>>(new Set());

  const decide = async (action: Action, note?: string) => {
    if (!top) return;
    if (inFlight.current.has(top.id)) return;
    if (locker && locker.userId !== me?.id) {
      toast.info(`${locker.name} is already reviewing this one`);
      return;
    }
    inFlight.current.add(top.id);
    const target = top;
    setHistory((h) => [...h, { post: target, action, note }]);
    setQueue((q) => q.filter((p) => p.id !== target.id));
    setEditing(false);
    setEditedCaption('');

    try {
      if (action === 'approve') await api.approvePost(target.id);
      else if (action === 'reject') await api.rejectPost(target.id, note ?? 'Send back for revision');
      else if (action === 'edit') await api.updatePost(target.id, { caption: note, status: 'scheduled' });
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
      setQueue((q) => [target, ...q]);
      setHistory((h) => h.slice(0, -1));
    } finally {
      inFlight.current.delete(target.id);
    }
  };

  const undo = () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setQueue((q) => [last.post, ...q]);
    // Local-only undo: the server already processed the decision.
    // Surface that to the reviewer so they're not surprised when a
    // tab reload still shows the item gone from the queue.
    toast.info(
      'Restored in this tab',
      'The server still recorded the decision — refresh to re-fetch from the server.',
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') decide('approve');
      if (e.key === 'ArrowLeft') decide('reject');
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const approved = history.filter((d) => d.action === 'approve').length;
  const rejected = history.filter((d) => d.action === 'reject').length;
  const edited = history.filter((d) => d.action === 'edit').length;

  /* ── AI quick actions ───────────────────────────────── */

  /**
   * Rewrite the caption in a warmer tone. We send an instruction to the
   * regenerate-post endpoint — it applies the same anti-hallucination
   * rules as the first draft, so the output stays truthful.
   */
  const rewriteWarmer = async () => {
    if (!top || quickBusy) return;
    setQuickBusy('warmer');
    try {
      const res = await api.regeneratePost({
        postId: top.id,
        instruction:
          'Rewrite in a warmer, more human tone. Keep every factual claim unchanged. Shorter sentences where it helps; no marketing clichés.',
      });
      // Optimistically patch the top card so the user sees the new
      // copy without waiting for a reload.
      setQueue((q) =>
        q.map((p) =>
          p.id === top.id ? { ...p, caption: res.caption, hashtags: res.hashtags } : p,
        ),
      );
      toast.success('Re-toned');
    } catch (e) {
      toast.error('Rewrite failed', (e as Error).message);
    } finally {
      setQuickBusy(null);
    }
  };

  /**
   * Generate 5 alternate captions. Runs the regenerate call in parallel
   * with different "angles" so the results are meaningfully different.
   */
  const generateAlts = async () => {
    if (!top || quickBusy) return;
    setQuickBusy('alts');
    setAltCaptions([]);
    try {
      const angles = [
        'Lead with a surprising observation that grabs attention in the first 7 words.',
        'Open with a specific sensory detail from the image.',
        'Ask a question the audience will want to answer in the comments.',
        'Frame it as a short story in two sentences.',
        'Cut every word that is not load-bearing — make it read like a text message.',
      ];
      const results = await Promise.allSettled(
        angles.map((instruction) => api.regeneratePost({ postId: top.id, instruction })),
      );
      const ok = results
        .filter(
          (
            r,
          ): r is PromiseFulfilledResult<{
            caption: string;
            hashtags: string[];
            hook: string;
            rationale: string;
          }> => r.status === 'fulfilled',
        )
        .map((r) => ({ caption: r.value.caption, hashtags: r.value.hashtags }));
      if (ok.length === 0) {
        toast.error('No alternates returned', 'The model was busy. Try again in a moment.');
      } else {
        setAltCaptions(ok);
      }
    } catch (e) {
      toast.error('Alts failed', (e as Error).message);
    } finally {
      setQuickBusy(null);
    }
  };

  /** Apply one of the alt captions to the top post and clear the list. */
  const useAltCaption = async (idx: number) => {
    if (!top) return;
    const alt = altCaptions[idx];
    if (!alt) return;
    try {
      await api.updatePost(top.id, { caption: alt.caption, hashtags: alt.hashtags });
      setQueue((q) =>
        q.map((p) =>
          p.id === top.id ? { ...p, caption: alt.caption, hashtags: alt.hashtags } : p,
        ),
      );
      setAltCaptions([]);
      toast.success('Caption updated');
    } catch (e) {
      toast.error('Could not apply caption', (e as Error).message);
    }
  };

  /**
   * Swap the generated image. Re-runs the hero image generator on the
   * post using its own caption as the brief. The backend persists the
   * new URL so the next listPosts call returns it.
   */
  const swapImage = async () => {
    if (!top || quickBusy) return;
    setQuickBusy('swap');
    try {
      const res = await api.regeneratePostImage({ postId: top.id });
      setQueue((q) =>
        q.map((p) => (p.id === top.id ? { ...p, generatedImageUrl: res.imageUrl } : p)),
      );
      toast.success('New image ready');
    } catch (e) {
      toast.error('Image swap failed', (e as Error).message);
    } finally {
      setQuickBusy(null);
    }
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Review queue" />
        <div className="flex justify-center p-20"><Spinner size={28} /></div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle={`${queue.length} waiting · swipe or tap`}
        action={
          <div className="flex flex-wrap gap-2">
            <PresenceChips currentUserId={me?.id} />
            <Button size="sm" variant="outline" onClick={undo} disabled={history.length === 0}>
              <Undo2 className="h-4 w-4" />
              Undo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => mutate()} className="hidden md:inline-flex">
              Refresh
            </Button>
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 lg:flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5" />
              <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] shadow-sm">←</kbd>
              <span>reject</span>
              <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] shadow-sm ml-2">→</kbd>
              <span>approve</span>
            </div>
          </div>
        }
      />

      <div className="px-4 py-4 md:px-10 md:py-6">
        <div className="mb-5 flex flex-col gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            <button onClick={() => setFilter('all')} className={filterChipClass(filter === 'all')}>
              All clients ({queue.length})
            </button>
            {(clientList ?? []).map((c) => {
              const count = queue.filter((p) => p.clientId === c.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={c.id}
                  onClick={() => setFilter(c.id)}
                  className={filterChipClass(filter === c.id)}
                >
                  {c.businessName} ({count})
                </button>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Badge tone="success">{approved} approved</Badge>
            <Badge tone="warning">{edited} edited</Badge>
            <Badge tone="danger">{rejected} rejected</Badge>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md lg:aspect-auto lg:h-[640px]">
            {locker ? (
              <div className="absolute left-1/2 top-2 z-30 max-w-[min(calc(100%-1rem),22rem)] -translate-x-1/2 rounded-full bg-amber-50 px-3 py-1 text-center text-xs font-medium leading-snug text-amber-800 ring-1 ring-amber-200 backdrop-blur">
                <Lock className="mr-1 inline h-3 w-3 shrink-0" />
                <span className="break-words">{locker.name} is reviewing this</span>
              </div>
            ) : null}
            <AnimatePresence>
              {filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-cta text-white">
                    <Check className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">Queue clear</h3>
                  <p className="max-w-xs text-sm text-slate-600">
                    {approved} approved, {rejected} sent back.
                  </p>
                </motion.div>
              ) : (
                filtered
                  .slice(0, 3)
                  .reverse()
                  .map((post, idx, arr) => {
                    const depth = arr.length - 1 - idx;
                    return (
                      <SwipeableReviewCard
                        key={post.id}
                        post={post}
                        depth={depth}
                        onApprove={() => decide('approve')}
                        onReject={() => decide('reject')}
                      />
                    );
                  })
              )}
            </AnimatePresence>
          </div>

          {top ? (
            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  Client
                </div>
                <div className="mt-1 break-words text-base font-semibold text-slate-900">
                  {top.clientName ?? 'Client'}
                </div>
                <div className="text-xs text-slate-500">
                  Scheduled{' '}
                  {postScheduledAt(top).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0 text-xs font-medium uppercase tracking-widest text-slate-400">
                    Caption
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing((v) => !v);
                      setEditedCaption(top.caption);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#1D9CA1] hover:text-[#48D886]"
                  >
                    <Edit3 className="h-3 w-3" />
                    {editing ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                {editing ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      rows={5}
                      value={editedCaption}
                      onChange={(e) => setEditedCaption(e.target.value)}
                    />
                    <Button size="sm" className="w-full" onClick={() => decide('edit', editedCaption)}>
                      <Check className="h-3.5 w-3.5" />
                      Save edit &amp; approve
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 break-words text-sm text-slate-700">{top.caption}</p>
                )}
                <p className="mt-2 break-words text-xs text-[#1D9CA1]">{top.hashtags?.join(' ')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
                  <Sparkles className="h-3 w-3 text-[#1D9CA1]" />
                  AI quick actions
                </div>
                <div className="mt-3 space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={rewriteWarmer}
                    disabled={quickBusy !== null}
                    loading={quickBusy === 'warmer'}
                  >
                    Rewrite in a warmer tone
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={generateAlts}
                    disabled={quickBusy !== null}
                    loading={quickBusy === 'alts'}
                  >
                    Generate 5 alt captions
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={swapImage}
                    disabled={quickBusy !== null}
                    loading={quickBusy === 'swap'}
                  >
                    Swap image
                  </Button>
                </div>

                {altCaptions.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
                    <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {altCaptions.length} alternate{altCaptions.length === 1 ? '' : 's'}
                    </p>
                    {altCaptions.map((alt, i) => (
                      <button
                        key={i}
                        onClick={() => useAltCaption(i)}
                        className="group block w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-xs text-slate-700 transition-colors hover:border-[#1D9CA1] hover:bg-[#1D9CA1]/5"
                      >
                        <p className="line-clamp-3">{alt.caption}</p>
                        <p className="mt-1 line-clamp-1 text-[10px] text-slate-400 group-hover:text-[#1D9CA1]">
                          Use this ·{' '}
                          {alt.hashtags.slice(0, 3).join(' ') || 'no hashtags'}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="sticky bottom-4 flex gap-3 safe-pb">
                <button
                  onClick={() => decide('reject')}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white text-sm font-semibold text-rose-600 shadow-sm transition-all hover:bg-rose-50 active:scale-[0.98]"
                >
                  <X className="h-5 w-5" />
                  Reject
                </button>
                <button
                  onClick={() => decide('approve')}
                  className="flex h-14 flex-[1.2] items-center justify-center gap-2 rounded-2xl bg-gradient-cta text-sm font-semibold text-white shadow-brand transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  <Check className="h-5 w-5" />
                  Approve
                </button>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </>
  );
}

function filterChipClass(active: boolean) {
  return [
    'max-w-full rounded-2xl border px-3 py-1.5 text-left text-xs font-medium break-words transition-colors sm:text-center',
    active
      ? 'border-slate-900 bg-slate-900 text-white'
      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100',
  ].join(' ');
}

/** Shows little presence chips for everyone currently in the dashboard. */
function PresenceChips({ currentUserId }: { currentUserId?: string }) {
  const { presence } = useRealtime(API_URL);
  const others = presence.filter((p) => p.userId !== currentUserId);
  if (others.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs">
      <Users className="h-3 w-3 text-slate-500" />
      <div className="flex -space-x-1">
        {others.slice(0, 3).map((p) => (
          <span
            key={p.userId}
            title={p.name}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-cta text-[10px] font-semibold text-white ring-2 ring-white"
          >
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </div>
      {others.length > 3 ? (
        <span className="ml-1 text-slate-500">+{others.length - 3}</span>
      ) : null}
    </div>
  );
}

function SwipeableReviewCard({
  post,
  depth,
  onApprove,
  onReject,
}: {
  post: Post;
  depth: number;
  onApprove: () => void;
  onReject: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-16, 16]);
  const approveOpacity = useTransform(x, [20, 140], [0, 1]);
  const rejectOpacity = useTransform(x, [-140, -20], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110) onApprove();
    else if (info.offset.x < -110) onReject();
  };

  const Icon = PLATFORM_ICONS[post.platform] ?? Instagram;
  const imageUrl = postImageUrl(post);

  return (
    <motion.article
      drag={depth === 0 ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={handleDragEnd}
      style={{ x: depth === 0 ? x : 0, rotate: depth === 0 ? rotate : 0 }}
      animate={{ scale: 1 - depth * 0.04, y: depth * 10, opacity: depth > 2 ? 0 : 1 }}
      className="absolute inset-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="relative aspect-square w-full">
        <Image src={imageUrl} alt="" fill className="object-cover" unoptimized />
        <motion.div
          style={{ opacity: approveOpacity }}
          className="absolute left-6 top-6 rotate-[-12deg] rounded-xl border-4 border-emerald-500 bg-white/90 px-4 py-1 text-2xl font-extrabold uppercase tracking-wider text-emerald-500"
        >
          Approve
        </motion.div>
        <motion.div
          style={{ opacity: rejectOpacity }}
          className="absolute right-6 top-6 rotate-[12deg] rounded-xl border-4 border-rose-500 bg-white/90 px-4 py-1 text-2xl font-extrabold uppercase tracking-wider text-rose-500"
        >
          Reject
        </motion.div>
        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          <Icon className="h-3.5 w-3.5" />
          <span className="capitalize">{post.platform}</span>
        </div>
        <div className="absolute right-4 top-4 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          {post.clientName ?? 'Client'}
        </div>
      </div>
      <div className="p-5">
        <p className="line-clamp-3 text-sm text-slate-800">{post.caption}</p>
        <p className="mt-2 line-clamp-1 text-xs text-[#1D9CA1]">{post.hashtags?.join(' ')}</p>
      </div>
    </motion.article>
  );
}
