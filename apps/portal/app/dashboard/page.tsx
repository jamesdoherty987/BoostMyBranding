'use client';

import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { timeAgo, mockClients, mockPosts, mockMessages, postImageUrl, postScheduledAt } from '@boost/core';
import {
  Badge,
  Button,
  Skeleton,
  EmptyState,
} from '@boost/ui';
import {
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  TrendingUp,
  Clock,
  MessageSquare,
  Upload as UploadIcon,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

/**
 * Client portal home. Loads the real client + posts + messages when the
 * backend is reachable; otherwise uses the mock fixtures. Skeleton on first
 * load. Empty state when the client has no posts yet (brand new signup).
 */
export default function DashboardPage() {
  const { data, isLoading } = useSWR('portal:dashboard', async () => {
    try {
      const client = await api.getMyClient();
      const [posts, messages] = await Promise.all([
        api.listPosts({ clientId: client.id }),
        api.listMessages(client.id),
      ]);
      return { client, posts, messages };
    } catch {
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

  const { client, posts, messages } = data as any;
  const pending = posts.filter((p: any) => p.status === 'pending_approval');
  const upcoming = posts
    .filter((p: any) => ['approved', 'scheduled'].includes(p.status))
    .slice(0, 3);
  const noContentYet = posts.length === 0;

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
            {client.stats?.postsThisMonth ?? posts.length}
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

      <section className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href="/upload"
          className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#48D886] hover:shadow-md"
        >
          <ImageIcon className="h-5 w-5 text-[#1D9CA1]" />
          <div className="mt-2 text-sm font-semibold text-slate-900">Upload photos</div>
          <div className="text-xs text-slate-500">Drop your latest shots</div>
        </Link>
        <Link
          href="/calendar"
          className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#48D886] hover:shadow-md"
        >
          <Clock className="h-5 w-5 text-[#1D9CA1]" />
          <div className="mt-2 text-sm font-semibold text-slate-900">Review posts</div>
          <div className="text-xs text-slate-500">{pending.length} waiting</div>
        </Link>
      </section>

      {noContentYet ? (
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

      {pending.length > 0 ? (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Waiting for you</h2>
            <Link href="/calendar" className="text-xs font-medium text-[#1D9CA1]">
              See all
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {pending.slice(0, 2).map((post: any) => (
              <Link
                key={post.id}
                href="/calendar"
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-shadow hover:shadow-md"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={postImageUrl(post)}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Badge tone="warning" className="mb-1">
                    Needs approval
                  </Badge>
                  <div className="line-clamp-2 text-sm text-slate-800">{post.caption}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
          <Link href="/calendar">
            <Button className="mt-3 w-full" variant="outline">
              <CheckCircle2 className="h-4 w-4" />
              Review all ({pending.length})
            </Button>
          </Link>
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-900">Upcoming</h2>
          <div className="mt-3 space-y-2">
            {upcoming.map((post: any) => (
              <div key={post.id} className="flex items-center gap-3 rounded-xl bg-white p-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={postImageUrl(post)}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm text-slate-800">{post.caption}</div>
                  <div className="text-xs text-slate-500 capitalize">
                    {post.platform} · {postScheduledAt(post).toLocaleDateString()}
                  </div>
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
              <MessageSquare className="h-3 w-3" />
              Open chat
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {messages.slice(-2).map((m: any) => (
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
