'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import { mockClients, mockPosts } from '@boost/core';
import { Card, CardContent, Badge } from '@boost/ui';
import { TrendingUp, Heart, Eye, Share2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export default function AnalyticsPage() {
  const published = mockPosts.filter((p) => p.engagement);
  const totalLikes = published.reduce((s, p) => s + (p.engagement?.likes ?? 0), 0);
  const totalReach = published.reduce((s, p) => s + (p.engagement?.reach ?? 0), 0);
  const totalShares = published.reduce((s, p) => s + (p.engagement?.shares ?? 0), 0);

  const tiles = [
    { label: 'Total likes', value: totalLikes.toLocaleString(), icon: Heart, tint: 'bg-rose-50 text-rose-600' },
    { label: 'Reach', value: totalReach.toLocaleString(), icon: Eye, tint: 'bg-sky-50 text-sky-600' },
    { label: 'Shares', value: totalShares.toLocaleString(), icon: Share2, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Engagement rate', value: '5.3%', icon: TrendingUp, tint: 'bg-amber-50 text-amber-600' },
  ];

  const clientRows = mockClients.map((c) => ({
    client: c,
    series: Array.from({ length: 14 }, (_, i) => 40 + Math.round(Math.sin(i + c.id.length) * 20) + i * 2),
  }));

  return (
    <>
      <PageHeader title="Analytics" subtitle="Engagement across every client, every platform" />

      <div className="px-4 py-4 md:px-10 md:py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {tiles.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card>
                <CardContent className="p-4 md:p-5">
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl md:h-10 md:w-10 ${t.tint}`}>
                    <t.icon className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  <div className="mt-3 text-xl font-bold text-slate-900 md:text-2xl">{t.value}</div>
                  <div className="text-xs text-slate-500 md:text-sm">{t.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="mt-6">
          <div className="border-b border-slate-200 p-4 md:p-5">
            <h2 className="font-semibold text-slate-900">Per-client performance</h2>
            <p className="text-xs text-slate-500">Last 14 days · all platforms</p>
          </div>
          <div className="divide-y divide-slate-200">
            {clientRows.map(({ client, series }) => (
              <div
                key={client.id}
                className="flex flex-wrap items-center gap-3 p-4 md:flex-nowrap md:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{client.businessName}</span>
                    <Badge tone="default">{client.industry}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {client.stats.postsThisMonth} posts · {client.stats.engagementRate}% engagement
                  </div>
                </div>
                <Sparkline series={series} />
                <div className="text-right md:w-20">
                  <div className="text-sm font-semibold text-emerald-600">
                    +{Math.round(12 + (series.at(-1) ?? 0) / 10)}%
                  </div>
                  <div className="text-[10px] text-slate-400">vs last period</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

/**
 * Sparkline — each instance uses a unique gradient id so stacking multiple
 * on one page doesn't cause them to share/collide.
 */
function Sparkline({ series }: { series: number[] }) {
  const id = useId();
  const w = 120;
  const h = 36;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const points = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / Math.max(1, max - min)) * h;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="shrink-0 text-[#1D9CA1]" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2={h} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#48D886" stopOpacity="0.3" />
          <stop offset="1" stopColor="#48D886" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polygon fill={`url(#${id})`} points={`0,${h} ${points} ${w},${h}`} />
    </svg>
  );
}
