'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { mockClients, mockPosts, formatCurrency, timeAgo, postImageUrl, postScheduledAt } from '@boost/core';
import { Card, CardContent, Badge, Button, useRealtime, Skeleton, EmptyState } from '@boost/ui';
import {
  Users,
  CheckSquare,
  Calendar,
  TrendingUp,
  ArrowRight,
  Zap,
  Activity,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { SystemStatus } from '@/components/SystemStatus';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function OverviewPage() {
  const { data: clients, isLoading: loadingClients } = useSWR('dashboard:clients', async () => {
    try {
      return await api.listClients();
    } catch {
      return mockClients;
    }
  });

  const {
    data: posts,
    mutate,
    isLoading: loadingPosts,
  } = useSWR('dashboard:all-posts', async () => {
    try {
      return await api.listPosts({});
    } catch {
      return mockPosts;
    }
  });

  const onEvent = useCallback(
    (evt: { type: string }) => {
      if (evt.type.startsWith('post:')) mutate();
    },
    [mutate],
  );
  useRealtime(API_URL, onEvent);

  const clientList = clients ?? mockClients;
  const postList = posts ?? mockPosts;
  const loading = loadingClients || loadingPosts;

  const totalMRR = clientList.reduce(
    (sum, c) => (c.isActive !== false ? sum + (c.monthlyPriceCents ?? 0) : sum),
    0,
  );
  const pendingCount = postList.filter((p) => p.status === 'pending_approval').length;
  const scheduledCount = postList.filter((p) => p.status === 'scheduled').length;
  const publishedThisMonth = postList.filter((p) => p.status === 'published').length;

  const stats = [
    {
      label: 'Active clients',
      value: clientList.length,
      icon: Users,
      tone: 'bg-[#48D886]/10 text-[#1D9CA1]',
    },
    {
      label: 'Pending review',
      value: pendingCount,
      icon: CheckSquare,
      tone: 'bg-amber-50 text-amber-700',
    },
    { label: 'Scheduled', value: scheduledCount, icon: Calendar, tone: 'bg-sky-50 text-sky-700' },
    {
      label: 'MRR',
      value: formatCurrency(totalMRR),
      icon: TrendingUp,
      tone: 'bg-emerald-50 text-emerald-700',
    },
  ];

  const recentPosts = postList.filter((p) => p.status === 'pending_approval').slice(0, 6);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Agency snapshot · live updates on"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SystemStatus />
            <Link href="/generate">
              <Button variant="outline" size="sm">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Generate content</span>
                <span className="sm:hidden">Generate</span>
              </Button>
            </Link>
            <Link href="/review">
              <Button size="sm">
                <span className="hidden sm:inline">Open review queue</span>
                <span className="sm:hidden">Review</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 md:px-10 md:py-6">
        {loading ? (
          <StatsSkeleton />
        ) : (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <CardContent className="p-4 md:p-5">
                    <div
                      className={`inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl ${s.tone}`}
                    >
                      <s.icon className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <div className="mt-3 text-xl md:text-2xl font-bold text-slate-900">
                      {s.value}
                    </div>
                    <div className="text-xs md:text-sm text-slate-500">{s.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </section>
        )}

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <Activity className="h-3 w-3" />
          Live — {publishedThisMonth} posts published this month
        </div>

        <section className="mt-6 grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 md:p-5">
              <div>
                <h2 className="font-semibold text-slate-900">Pending approval</h2>
                <p className="text-xs text-slate-500">
                  Pre-review posts before sending them to clients.
                </p>
              </div>
              <Link href="/review">
                <Button size="sm" variant="outline">
                  Open queue
                </Button>
              </Link>
            </div>
            {loading ? (
              <PendingSkeleton />
            ) : recentPosts.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Sparkles className="h-5 w-5" />}
                  title="Queue's clear 🎉"
                  description="Generate next month's batch to keep the calendar flowing."
                  action={
                    <Link href="/generate">
                      <Button>
                        <Sparkles className="h-4 w-4" />
                        Generate content
                      </Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:p-5">
                {recentPosts.map((p) => (
                  <Link
                    key={p.id}
                    href="/review"
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-square overflow-hidden">
                      <Image
                        src={postImageUrl(p)}
                        alt=""
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        unoptimized
                      />
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-center justify-between">
                        <Badge tone="brand" className="capitalize">
                          {p.platform}
                        </Badge>
                        <span className="text-[10px] text-slate-400">
                          {timeAgo(postScheduledAt(p).toISOString())}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs text-slate-700">{p.caption}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="border-b border-slate-200 p-4 md:p-5">
              <h2 className="font-semibold text-slate-900">Clients</h2>
              <p className="text-xs text-slate-500">{clientList.length} total</p>
            </div>
            {loading ? (
              <ClientListSkeleton />
            ) : (
              <div className="divide-y divide-slate-200">
                {clientList.map((c) => (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {c.logoUrl ? (
                        <Image src={c.logoUrl} alt="" fill unoptimized />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {c.businessName}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {c.stats?.pendingApproval ?? 0} pending ·{' '}
                        {c.stats?.postsThisMonth ?? 0} live
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}

function StatsSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 md:p-5">
            <Skeleton className="h-9 w-9 rounded-xl md:h-10 md:w-10" />
            <Skeleton className="mt-3 h-7 w-20" />
            <Skeleton className="mt-2 h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function PendingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:p-5">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="p-2.5">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-1 h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientListSkeleton() {
  return (
    <div className="divide-y divide-slate-200">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-1.5 h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
