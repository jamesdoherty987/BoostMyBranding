'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  getClient,
  getPostsForClient,
  getMessagesForClient,
  formatCurrency,
  timeAgo,
  postImageUrl,
} from '@boost/core';
import { Badge, Button, Card, CardContent } from '@boost/ui';
import { ArrowLeft, ExternalLink, Mail, Sparkles, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

type Tab = 'posts' | 'messages' | 'settings';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('posts');
  const client = getClient(id);
  if (!client) notFound();

  const posts = getPostsForClient(client.id);
  const messages = getMessagesForClient(client.id);

  const postsByStatus = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title={client.businessName}
        subtitle={`${client.industry} · ${client.email}`}
        action={
          <div className="flex gap-2">
            <Link href="/clients">
              <Button size="sm" variant="ghost">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <Button size="sm" variant="outline">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </Button>
            <Button size="sm">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Generate content</span>
              <span className="sm:hidden">Generate</span>
            </Button>
          </div>
        }
      />

      <div className="px-4 py-4 md:px-10 md:py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                    {client.logoUrl ? <Image src={client.logoUrl} alt="" fill unoptimized /> : null}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{client.businessName}</div>
                    <div className="truncate text-xs text-slate-500">{client.contactName}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge tone="success">Active</Badge>
                  <Badge tone="brand">{client.subscriptionTier.replace('_', ' ')}</Badge>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5 text-[#1D9CA1]" />
                  {client.stats.engagementRate}% avg engagement
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  Subscription
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {formatCurrency(client.monthlyPriceCents)}
                  <span className="text-sm font-normal text-slate-500"> /mo</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Onboarded {timeAgo(client.onboardedAt)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  Brand colors
                </div>
                <div className="mt-3 flex gap-2">
                  {(['primary', 'secondary', 'accent'] as const).map((key) => (
                    <div key={key} className="flex-1">
                      <div
                        className="h-12 rounded-xl border border-slate-200"
                        style={{ backgroundColor: client.brandColors[key] }}
                      />
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        {client.brandColors[key]}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section>
            <div className="mb-4 flex flex-wrap gap-2">
              {(['posts', 'messages', 'settings'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    tab === t
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {t} {t === 'posts' ? `(${posts.length})` : ''}
                  {t === 'messages' ? ` (${messages.length})` : ''}
                </button>
              ))}
            </div>

            {tab === 'posts' ? (
              <>
                <div className="mb-4 flex gap-2 text-xs">
                  {Object.entries(postsByStatus).map(([status, count]) => (
                    <Badge key={status} tone="default" className="capitalize">
                      {status.replace('_', ' ')}: {count}
                    </Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {posts.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="relative aspect-square">
                        <Image src={postImageUrl(p)} alt="" fill className="object-cover" unoptimized />
                        <div className="absolute left-2 top-2">
                          <Badge tone="default" className="capitalize">
                            {p.platform}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-3">
                        <Badge
                          tone={
                            p.status === 'published'
                              ? 'success'
                              : p.status === 'pending_approval'
                                ? 'warning'
                                : 'default'
                          }
                          className="capitalize"
                        >
                          {p.status.replace('_', ' ')}
                        </Badge>
                        <p className="mt-2 line-clamp-2 text-xs text-slate-700">{p.caption}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : null}

            {tab === 'messages' ? (
              <div className="space-y-3">
                {messages.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">{m.senderName}</span>
                        <span className="text-xs text-slate-400">{timeAgo(m.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{m.body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            {tab === 'settings' ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-slate-600">
                    Brand voice document, API connections, and billing settings live here.
                  </p>
                  <Button size="sm" variant="outline" className="mt-4">
                    <ExternalLink className="h-4 w-4" />
                    Open full settings
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
