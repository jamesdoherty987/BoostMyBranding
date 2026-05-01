'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, toast, Spinner, useRealtime } from '@boost/ui';
import { Undo2, PartyPopper } from 'lucide-react';
import { mockClients, getPostsForClient, type Post } from '@boost/core';
import { Shell } from '@/components/Shell';
import { SwipeCard, ActionButtons } from '@/components/SwipeCard';
import { api, API_URL } from '@/lib/api';

interface Decision {
  post: Post;
  action: 'approve' | 'reject';
}

export default function CalendarPage() {
  const { data, isLoading, mutate } = useSWR('portal:calendar', async () => {
    try {
      const me = await api.getMyClient();
      const posts = await api.listPosts({ clientId: me.id, status: 'pending_approval' });
      return posts as Post[];
    } catch {
      return getPostsForClient(mockClients[0]!.id).filter(
        (p) => p.status === 'pending_approval',
      ) as Post[];
    }
  });

  const [queue, setQueue] = useState<Post[]>([]);
  const [history, setHistory] = useState<Decision[]>([]);

  useEffect(() => {
    if (data) setQueue(data);
  }, [data]);

  // Keep in sync with agency updates.
  const onEvent = useCallback((evt: { type: string }) => {
    if (evt.type.startsWith('post:')) mutate();
  }, [mutate]);
  useRealtime(API_URL, onEvent);

  const top = queue[0];

  const handleDecision = async (action: Decision['action']) => {
    if (!top) return;
    const next = top;
    setHistory((h) => [...h, { post: next, action }]);
    setQueue((q) => q.slice(1));
    try {
      if (action === 'approve') {
        await api.approvePost(next.id);
        toast.success('Approved', next.caption.slice(0, 60));
      } else {
        await api.rejectPost(next.id, 'Please revise');
        toast.info('Sent back', 'We\'ll revise this one');
      }
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
      setQueue((q) => [next, ...q]);
      setHistory((h) => h.slice(0, -1));
    }
  };

  const handleUndo = () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setQueue((q) => [last.post, ...q]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') handleDecision('approve');
      if (e.key === 'ArrowLeft') handleDecision('reject');
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') handleUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const approved = history.filter((h) => h.action === 'approve').length;
  const rejected = history.filter((h) => h.action === 'reject').length;

  if (isLoading) {
    return (
      <Shell title="Review calendar">
        <div className="mt-10 flex justify-center">
          <Spinner size={28} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      title="Review calendar"
      subtitle={`${queue.length} waiting · swipe or tap`}
      action={
        history.length > 0 ? (
          <button
            onClick={handleUndo}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
        ) : undefined
      }
    >
      <div className="mb-3 flex gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {approved} approved
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          {rejected} rejected
        </span>
      </div>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
        <AnimatePresence>
          {queue.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-center"
            >
              <PartyPopper className="h-10 w-10 text-[#48D886]" />
              <h3 className="text-lg font-semibold text-slate-900">All caught up</h3>
              <p className="text-sm text-slate-600">
                {approved} posts approved, {rejected} sent back for revision.
              </p>
              <Button className="mt-2" onClick={() => mutate()}>
                Refresh
              </Button>
            </motion.div>
          ) : (
            queue
              .slice(0, 3)
              .reverse()
              .map((post, idx, arr) => {
                const depth = arr.length - 1 - idx;
                return (
                  <SwipeCard
                    key={post.id}
                    post={post}
                    depth={depth}
                    onApprove={() => handleDecision('approve')}
                    onReject={() => handleDecision('reject')}
                  />
                );
              })
          )}
        </AnimatePresence>
      </div>

      {queue.length > 0 && top ? (
        <div className="mt-6">
          <ActionButtons
            onApprove={() => handleDecision('approve')}
            onReject={() => handleDecision('reject')}
          />
        </div>
      ) : null}

      {queue.length === 0 && history.length > 0 ? (
        <Button variant="outline" className="mt-6 w-full" onClick={handleUndo}>
          <Undo2 className="h-4 w-4" />
          Undo last
        </Button>
      ) : null}
    </Shell>
  );
}
