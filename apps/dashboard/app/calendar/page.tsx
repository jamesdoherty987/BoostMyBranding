'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { mockClients, mockPosts, type Post, postScheduledAt, postImageUrl } from '@boost/core';
import { Badge, Button } from '@boost/ui';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const STATUS_DOT: Record<string, string> = {
  pending_internal: 'bg-slate-400',
  pending_approval: 'bg-amber-400',
  approved: 'bg-sky-400',
  scheduled: 'bg-[#1D9CA1]',
  publishing: 'bg-[#48D886]',
  published: 'bg-emerald-500',
  draft: 'bg-slate-300',
  rejected: 'bg-rose-400',
  failed: 'bg-rose-600',
};

/** Local date string YYYY-MM-DD — avoids timezone drift that `.toISOString()` causes. */
function toLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarPage() {
  const [offset, setOffset] = useState(0);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { monthLabel, days } = useMemo(() => buildMonth(offset), [offset]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of mockPosts) {
      if (clientFilter !== 'all' && p.clientId !== clientFilter) continue;
      const key = toLocalDateKey(postScheduledAt(p));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [clientFilter]);

  const selectedPosts = selectedDay ? (postsByDay.get(selectedDay) ?? []) : [];
  const todayKey = toLocalDateKey(new Date());

  return (
    <>
      <PageHeader
        title="Scheduler"
        subtitle="Approved & scheduled posts across every client"
        action={
          <div className="flex flex-wrap gap-2">
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              aria-label="Filter by client"
            >
              <option value="all">All clients</option>
              {mockClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New post</span>
            </Button>
          </div>
        }
      />

      <div className="px-4 py-4 md:px-10 md:py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((o) => o - 1)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-slate-900">{monthLabel}</h2>
            <button
              onClick={() => setOffset((o) => o + 1)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="hidden gap-3 text-xs text-slate-500 md:flex">
            {(['pending_approval', 'scheduled', 'published'] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 capitalize">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                {s.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-7 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-widest text-slate-400 md:text-[11px]">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="px-1 py-2 text-center md:px-3">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = toLocalDateKey(day.date);
                const dayPosts = postsByDay.get(key) ?? [];
                const isToday = key === todayKey;
                const isSelected = key === selectedDay;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    className={`group relative flex min-h-[72px] flex-col items-start gap-1 border-b border-r border-slate-100 p-1.5 text-left transition-colors md:min-h-[96px] md:p-2 ${
                      day.inMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 text-slate-400'
                    } ${isSelected ? 'bg-[#48D886]/5 ring-2 ring-inset ring-[#48D886]' : ''}`}
                    aria-label={`${day.date.toDateString()}, ${dayPosts.length} post${dayPosts.length === 1 ? '' : 's'}`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold md:h-6 md:w-6 md:text-xs ${
                        isToday ? 'bg-gradient-cta text-white' : ''
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                    <div className="flex flex-wrap gap-0.5">
                      {dayPosts.slice(0, 4).map((p) => (
                        <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
                      ))}
                    </div>
                    {dayPosts.length > 0 ? (
                      <div className="mt-auto hidden w-full space-y-1 md:block">
                        {dayPosts.slice(0, 2).map((p) => (
                          <div
                            key={p.id}
                            className="truncate rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] capitalize text-slate-700 group-hover:bg-white"
                          >
                            {p.platform} · {(p.clientName ?? '').split(' ')[0]}
                          </div>
                        ))}
                        {dayPosts.length > 2 ? (
                          <div className="text-[10px] font-medium text-[#1D9CA1]">
                            +{dayPosts.length - 2} more
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <aside>
            {selectedDay ? (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                {selectedPosts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                    Nothing scheduled on this day.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedPosts.map((p) => (
                      <motion.div
                        key={p.id}
                        layout
                        className="flex gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3"
                      >
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                          <Image src={postImageUrl(p)} alt="" fill className="object-cover" unoptimized />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Badge tone="brand" className="capitalize">
                              {p.platform}
                            </Badge>
                            <span className="text-[10px] text-slate-500">{p.clientName}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-700">{p.caption}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Select a day to see scheduled posts.
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function buildMonth(offset: number) {
  const today = new Date();
  const anchor = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const monthLabel = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstDow = (anchor.getDay() + 6) % 7; // Monday-start
  const lastDate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();

  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), -firstDow + i + 1);
    days.push({ date: d, inMonth: false });
  }
  for (let i = 1; i <= lastDate; i++) {
    days.push({ date: new Date(anchor.getFullYear(), anchor.getMonth(), i), inMonth: true });
  }
  while (days.length % 7 !== 0 || days.length < 42) {
    const last = days.at(-1)!.date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    days.push({ date: next, inMonth: next.getMonth() === anchor.getMonth() });
    if (days.length >= 42) break;
  }

  return { monthLabel, days };
}
