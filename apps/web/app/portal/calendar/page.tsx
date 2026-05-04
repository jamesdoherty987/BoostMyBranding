'use client';

import { useState } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Badge, Skeleton, EmptyState, Dialog } from '@boost/ui';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
  mockClients,
  mockPosts,
  postImageUrl,
  postScheduledAt,
  type Post,
} from '@boost/core';
import { Shell } from '@/components/portal/Shell';
import { api } from '@/lib/portal/api';
import { handlePortalAuthError, ALLOW_MOCK_FALLBACK } from '@/lib/portal/auth';
import { useTierGate } from '@/lib/portal/tier-gate';

/**
 * Read-only monthly calendar. Clients see what's scheduled and what's
 * already live; if they want to change anything they chat us.
 */
export default function CalendarPage() {
  // Calendar shows social posts — only relevant to social tiers.
  useTierGate(['social_only', 'full_package']);

  const { data, isLoading } = useSWR('portal:calendar', async () => {
    try {
      const me = await api.getMyClient();
      const posts = await api.listPosts({ clientId: me.id });
      return posts as Post[];
    } catch (err) {
      handlePortalAuthError(err);
      if (!ALLOW_MOCK_FALLBACK) throw err;
      return mockPosts.filter((p) => p.clientId === mockClients[0]!.id) as Post[];
    }
  });

  const [selected, setSelected] = useState<Post | null>(null);

  if (isLoading || !data) {
    return (
      <Shell title="Calendar">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </Shell>
    );
  }

  const posts = data;
  // Group posts by date (YYYY-MM-DD)
  const byDay = new Map<string, Post[]>();
  for (const p of posts) {
    const d = postScheduledAt(p).toISOString().slice(0, 10);
    const list = byDay.get(d) ?? [];
    list.push(p);
    byDay.set(d, list);
  }

  // Current month grid
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0 = Sun
  const daysInMonth = lastDay.getDate();
  const cells: Array<{ date: Date | null; posts: Post[] }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ date: null, posts: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = date.toISOString().slice(0, 10);
    cells.push({ date, posts: byDay.get(key) ?? [] });
  }
  const monthName = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <Shell title="Calendar" subtitle={monthName}>
      {posts.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="h-5 w-5" />}
          title="Nothing scheduled yet"
          description="Upload photos and we'll start drafting your first calendar."
        />
      ) : null}

      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 bg-slate-50 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const isToday =
              c.date && c.date.toDateString() === new Date().toDateString();
            return (
              <button
                key={i}
                onClick={() => c.posts[0] && setSelected(c.posts[0])}
                disabled={!c.date || c.posts.length === 0}
                className={`relative flex min-h-[56px] flex-col items-center justify-start gap-1 border-b border-r border-slate-100 p-1.5 text-left disabled:cursor-default ${
                  c.posts.length > 0 ? 'hover:bg-slate-50' : ''
                }`}
              >
                {c.date ? (
                  <span
                    className={`text-[11px] font-semibold ${
                      isToday
                        ? 'flex h-5 w-5 items-center justify-center rounded-full bg-gradient-cta text-white'
                        : 'text-slate-700'
                    }`}
                  >
                    {c.date.getDate()}
                  </span>
                ) : null}
                {c.posts.length > 0 ? (
                  <div className="flex flex-wrap gap-0.5">
                    {c.posts.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          p.status === 'published' ? 'bg-[#48D886]' : 'bg-[#1D9CA1]'
                        }`}
                      />
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vertical feed of upcoming + live */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">This month</h2>
        <ul className="mt-3 space-y-3">
          {posts
            .slice()
            .sort(
              (a, b) =>
                postScheduledAt(a).getTime() - postScheduledAt(b).getTime(),
            )
            .slice(0, 10)
            .map((p) => {
              const isPublished = p.status === 'published';
              return (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelected(p)}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-shadow hover:shadow-md"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={postImageUrl(p)}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={isPublished ? 'success' : 'default'}>
                        {isPublished ? 'Live' : 'Scheduled'}
                      </Badge>
                      <span className="text-xs capitalize text-slate-500">{p.platform}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm text-slate-800">{p.caption}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {postScheduledAt(p).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </motion.li>
              );
            })}
        </ul>
      </section>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        className="max-w-md"
      >
        {selected ? (
          <div className="-mx-6 -my-5">
            <div className="relative aspect-square">
              <Image
                src={postImageUrl(selected)}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={selected.status === 'published' ? 'success' : 'default'}>
                  {selected.status === 'published' ? 'Live' : 'Scheduled'}
                </Badge>
                <span className="text-xs capitalize text-slate-500">{selected.platform}</span>
                <span className="text-xs text-slate-400">
                  {postScheduledAt(selected).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-800">{selected.caption}</p>
              <p className="mt-3 text-xs text-slate-500">
                Want something changed?{' '}
                <a href="/portal/chat" className="font-semibold text-[#1D9CA1] underline">
                  Chat us
                </a>
                .
              </p>
            </div>
          </div>
        ) : null}
      </Dialog>
    </Shell>
  );
}
