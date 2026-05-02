'use client';

import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  timeAgo,
  mockClients,
  mockPosts,
  mockMessages,
  postImageUrl,
  postScheduledAt,
} from '@boost/core';
import { Badge, Button, Skeleton, EmptyState } from '@boost/ui';
import {
  ArrowRight,
  Image as ImageIcon,
  TrendingUp,
  MessageSquare,
  Upload as UploadIcon,
  Calendar,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { handlePortalAuthError, ALLOW_MOCK_FALLBACK } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription';

/**
 * Client portal home. The client sees what's published and scheduled but
 * doesn't approve anything — our dashboard handles that. Primary actions
 * here are "upload photos" and "chat with us".
 */
export default function DashboardPage() {
  const { subscription } = useSubscription();
  const { data, isLoading } = useSWR('portal:dashboard', async () => {
    try {
      const client = await api.getMyClient();
      const [posts, messages] = await Promise.all([
        api.listPosts({ clientId: client.id }),
        api.listMessages(client.id),
      ]);
      return { client, posts, messages };
    } catch (err) {
      handlePortalAuthError(err);
      if (!ALLOW_MOCK_FALLBACK) throw err;
      const client = mockClients[0]!;
      return {
        client,
        posts: mockPosts.filter((p) => p.clientId === client.id),
        messages: mockMessages.filter((m) => m.clientId === client.id),
      };
    }
  });

  if (isLoading || !data) {
    return (
      <Shell title="Loading…">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </Shell>
    );
  }

  const { client, posts, messages } = data;
  const recentlyPublished = posts
    .filter((p) => p.status === 'published')
    .slice(0, 3);
  const upcoming = posts
    .filter((p) => ['scheduled', 'approved'].includes(p.status))
    .slice(0, 3);
  const noContentYet = posts.length === 0;
  const isLocked = subscription ? !subscription.active : false;

  return (
    <Shell
      title={`Hi, ${(client.contactName ?? 'there').split(' ')[0]} 👋`}
      subtitle={client.businessName}
      action={
        <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
          {client.logoUrl ? (
            <Image src={client.logoUrl} alt="" width={40} height={40} unoptimized />
          ) : null}
        </div>
      }
    >
      {isLocked ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-cta p-5 text-white shadow-brand"
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            Ready when you are
          </div>
          <div className="mt-1 text-2xl font-bold">Subscribe to start publishing</div>
          <p className="mt-1 text-sm text-white/90">
            Have a look around. When you&apos;re set, pick a plan and we&apos;ll start building your
            first month of content.
          </p>
          <Link href="/subscription">
            <Button
              size="lg"
              variant="outline"
              className="mt-4 w-full border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              See plans
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.section>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-cta p-5 text-white shadow-brand"
        >
          <div className="text-xs font-medium uppercase tracking-widest text-white/80">
            This month
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-4xl font-bold">
              {client.stats?.postsThisMonth ?? recentlyPublished.length}
            </span>
            <span className="text-white/80">posts published</span>
          </div>
          {client.stats?.engagementRate ? (
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-white/90">
              <TrendingUp className="h-4 w-4" />
              {client.stats.engagementRate}% engagement
            </div>
          ) : null}
        </motion.section>
      )}

      <section className="mt-5 grid grid-cols-2 gap-3">
        <QuickAction
          href={isLocked ? '/subscription' : '/upload'}
          icon={<ImageIcon className="h-5 w-5 text-[#1D9CA1]" />}
          title="Upload photos"
          subtitle={isLocked ? 'Subscribe to share photos' : 'Drop your latest shots'}
          locked={isLocked}
        />
        <QuickAction
          href="/chat"
          icon={<MessageSquare className="h-5 w-5 text-[#1D9CA1]" />}
          title="Chat with us"
          subtitle="Questions or updates"
          locked={false}
        />
      </section>

      {noContentYet && !isLocked ? (
        <div className="mt-6">
          <EmptyState
            icon={<UploadIcon className="h-5 w-5" />}
            title="Let's get started"
            description="Drop in 10–15 photos and we'll start building your first month of posts."
            action={
              <Link href="/upload">
                <Button>
                  <UploadIcon className="h-4 w-4" />
                  Upload photos
                </Button>
              </Link>
            }
          />
        </div>
      ) : null}

      {isLocked ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="mt-2 text-sm font-semibold text-slate-900">
            Publishing is locked
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            You can browse the portal and chat with us anytime. Subscribe to unlock
            content generation, scheduling, and media uploads.
          </p>
          <Link href="/subscription">
            <Button size="sm" className="mt-3 w-full">
              Unlock my account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Going out soon</h2>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1D9CA1]"
            >
              <Calendar className="h-3 w-3" />
              See calendar
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {upcoming.map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={postImageUrl(post)}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Badge tone="default" className="mb-1">
                    {post.platform}
                  </Badge>
                  <div className="line-clamp-2 text-sm text-slate-800">{post.caption}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {postScheduledAt(post).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {recentlyPublished.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-900">Recently live</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {recentlyPublished.map((post) => (
              <div
                key={post.id}
                className="relative aspect-square overflow-hidden rounded-xl bg-slate-100"
              >
                <Image
                  src={postImageUrl(post)}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium capitalize text-white backdrop-blur">
                  {post.platform}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {messages.length > 0 ? (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Latest messages</h2>
            <Link
              href="/chat"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1D9CA1]"
            >
              <ArrowRight className="h-3 w-3" />
              Open chat
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {messages.slice(-2).map((m) => (
              <div key={m.id} className="rounded-xl bg-white p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">{m.senderName}</span>
                  <span className="text-slate-400">{timeAgo(m.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-700">{m.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </Shell>
  );
}

function QuickAction({
  href,
  icon,
  title,
  subtitle,
  locked,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  locked: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#48D886] hover:shadow-md"
    >
      {locked ? (
        <span
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          aria-label="Locked"
        >
          <Lock className="h-3 w-3" />
        </span>
      ) : null}
      {icon}
      <div className="mt-2 text-sm font-semibold text-slate-900">{title}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </Link>
  );
}
