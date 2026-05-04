'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import useSWR from 'swr';
import {
  getClient,
  getMessagesForClient,
  getClientStats,
  formatCurrency,
  timeAgo,
  mockClients,
  getStatusMeta,
  type Client,
  type Message,
} from '@boost/core';
import { Badge, Button, Card, CardContent, Spinner, toast } from '@boost/ui';
import {
  ArrowLeft,
  Mail,
  TrendingUp,
  Image as ImageIcon,
  Video,
  MessageSquare,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { MediaLibrary } from '@/components/dashboard/content-hub/MediaLibrary';
import { PostsPanel } from '@/components/dashboard/content-hub/PostsPanel';
import { VideosPanel } from '@/components/dashboard/content-hub/VideosPanel';
import { api } from '@/lib/dashboard/api';

type Tab = 'overview' | 'posts' | 'media' | 'videos' | 'messages';

const TABS: Array<{ id: Tab; label: string; icon: typeof LayoutGrid }> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'posts', label: 'Posts', icon: Sparkles },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
];

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('overview');

  // Live client data with mock fallback so dev still works.
  const { data: client, isLoading } = useSWR<Client | undefined>(
    `client:${id}`,
    async () => {
      try {
        return await api.getClient(id);
      } catch {
        return getClient(id) ?? mockClients.find((c) => c.id === id);
      }
    },
  );

  if (isLoading && !client) {
    return (
      <>
        <PageHeader title="Loading…" />
        <div className="flex justify-center py-20">
          <Spinner size={28} />
        </div>
      </>
    );
  }

  if (!client) notFound();

  const messages = getMessagesForClient(client.id);
  // DB clients don't have computed `stats` — use helper for zero defaults.
  const stats = getClientStats(client);

  return (
    <>
      <PageHeader
        title={client.businessName}
        subtitle={`${client.industry ?? '—'} · ${client.email}`}
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/clients">
              <Button size="sm" variant="ghost">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await api.inviteClient(client.id);
                  if (res.sent) {
                    toast.success('Invite sent', `Emailed to ${res.email}.`);
                  } else {
                    // Email service offline — copy the link to clipboard so
                    // the agency can paste it into WhatsApp / text.
                    try {
                      await navigator.clipboard.writeText(res.link);
                      toast.info(
                        'Email service offline',
                        'Invite link copied to clipboard — paste it to the client.',
                      );
                    } catch {
                      toast.info('Email service offline', `Link: ${res.link}`);
                    }
                  }
                } catch (e) {
                  toast.error('Invite failed', (e as Error).message);
                }
              }}
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Send invite</span>
            </Button>
            <Button size="sm" onClick={() => setTab('posts')}>
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Create content</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        }
      />

      <div className="px-4 py-4 md:px-10 md:py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          {/* Left rail */}
          <aside className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                    {client.logoUrl ? (
                      <Image src={client.logoUrl} alt="" fill unoptimized />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">
                      {client.businessName}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {client.contactName}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <SubscriptionBadge status={client.subscriptionStatus} />
                  <Badge tone="brand">{client.subscriptionTier.replace('_', ' ')}</Badge>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5 text-[#1D9CA1]" />
                  {stats.engagementRate}% avg engagement
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  Subscription
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {formatCurrency(client.monthlyPriceCents ?? 0)}
                  <span className="text-sm font-normal text-slate-500"> /mo</span>
                </div>
                <div className="mt-2">
                  <SubscriptionBadge status={client.subscriptionStatus} />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {getStatusMeta(client.subscriptionStatus ?? 'none').description}
                </div>
                <div className="mt-3 space-y-0.5 text-xs text-slate-500">
                  {client.subscriptionStartedAt ? (
                    <div>Subscribed {timeAgo(client.subscriptionStartedAt)}</div>
                  ) : null}
                  {client.onboardedAt ? (
                    <div>Onboarded {timeAgo(client.onboardedAt)}</div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  Brand colors
                </div>
                <div className="mt-3 flex gap-2">
                  {(['primary', 'secondary', 'accent'] as const).map((key) => {
                    const color = client.brandColors?.[key] ?? '#e2e8f0';
                    return (
                      <div key={key} className="flex-1">
                        <div
                          className="h-12 rounded-xl border border-slate-200"
                          style={{ backgroundColor: color }}
                        />
                        <div className="mt-1.5 text-[10px] text-slate-500">
                          {color}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main content */}
          <section>
            {/* Tab strip */}
            <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? 'bg-gradient-cta text-white shadow-brand'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {tab === 'overview' ? <OverviewTab client={client} setTab={setTab} messages={messages} /> : null}
            {tab === 'posts' ? (
              <PostsPanel clientId={client.id} businessName={client.businessName} />
            ) : null}
            {tab === 'media' ? <MediaLibrary clientId={client.id} /> : null}
            {tab === 'videos' ? <VideosPanel clientId={client.id} client={client} /> : null}
            {tab === 'messages' ? <MessagesTab messages={messages} /> : null}
          </section>
        </div>
      </div>
    </>
  );
}

function OverviewTab({
  client,
  setTab,
  messages,
}: {
  client: Client;
  setTab: (t: Tab) => void;
  messages: Message[];
}) {
  const stats = getClientStats(client);
  const tiles = [
    {
      label: 'Posts this month',
      value: stats.postsThisMonth,
      icon: Sparkles,
      tab: 'posts' as Tab,
      tone: 'from-[#1D9CA1] to-[#48D886]',
    },
    {
      label: 'Pending review',
      value: stats.pendingApproval,
      icon: Sparkles,
      tab: 'posts' as Tab,
      tone: 'from-amber-400 to-amber-500',
    },
    {
      label: 'Media files',
      value: stats.imagesUploaded,
      icon: ImageIcon,
      tab: 'media' as Tab,
      tone: 'from-sky-400 to-sky-600',
    },
    {
      label: 'Messages',
      value: messages.length,
      icon: MessageSquare,
      tab: 'messages' as Tab,
      tone: 'from-rose-400 to-pink-500',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={() => setTab(t.tab)}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div
              className={`absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br ${t.tone} opacity-20 transition-opacity group-hover:opacity-30`}
            />
            <t.icon className="h-4 w-4 text-slate-500" />
            <div className="mt-2 text-2xl font-bold text-slate-900">{t.value}</div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
              {t.label}
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" size="sm" onClick={() => setTab('posts')}>
              <Sparkles className="h-4 w-4" />
              Generate a batch of posts
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTab('videos')}>
              <Video className="h-4 w-4" />
              Render premium videos
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTab('media')}>
              <ImageIcon className="h-4 w-4" />
              Upload photos or videos
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTab('messages')}>
              <MessageSquare className="h-4 w-4" />
              Message this client
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MessagesTab({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <MessageSquare className="h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">No messages yet</p>
      </div>
    );
  }
  return (
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
  );
}

function SubscriptionBadge({
  status,
}: {
  status: 'none' | 'active' | 'past_due' | 'canceled' | undefined;
}) {
  const meta = getStatusMeta(status ?? 'none');
  const tone: 'success' | 'warning' | 'danger' | 'default' =
    meta.tone === 'success'
      ? 'success'
      : meta.tone === 'warn'
        ? 'warning'
        : meta.tone === 'danger'
          ? 'danger'
          : 'default';
  return <Badge tone={tone}>{meta.label}</Badge>;
}
