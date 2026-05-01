'use client';

import Image from 'next/image';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Badge } from '@boost/ui';
import { postImageUrl, postScheduledAt, type Post } from '@boost/core';
import { Check, X, Instagram, Facebook, Linkedin, Music2, Twitter } from 'lucide-react';

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music2,
  x: Twitter,
  pinterest: Instagram,
  bluesky: Instagram,
};

interface SwipeCardProps {
  post: Post;
  onApprove: () => void;
  onReject: () => void;
  depth?: number;
}

const SWIPE_THRESHOLD = 110;

export function SwipeCard({ post, onApprove, onReject, depth = 0 }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const approveOpacity = useTransform(x, [20, 140], [0, 1]);
  const rejectOpacity = useTransform(x, [-140, -20], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) onApprove();
    else if (info.offset.x < -SWIPE_THRESHOLD) onReject();
  };

  const Icon = PLATFORM_ICONS[post.platform] ?? Instagram;
  const imageUrl = postImageUrl(post);
  const scheduled = postScheduledAt(post);

  return (
    <motion.article
      drag={depth === 0 ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={handleDragEnd}
      style={{ x: depth === 0 ? x : 0, rotate: depth === 0 ? rotate : 0 }}
      animate={{
        scale: 1 - depth * 0.04,
        y: depth * 10,
        opacity: depth > 2 ? 0 : 1,
      }}
      className="absolute inset-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        <Image
          src={imageUrl}
          alt=""
          fill
          className="object-cover"
          draggable={false}
          unoptimized
        />
        <motion.div
          style={{ opacity: approveOpacity }}
          className="absolute left-6 top-6 rotate-[-12deg] rounded-xl border-4 border-emerald-500 bg-white/90 px-4 py-1 text-lg font-extrabold uppercase tracking-wider text-emerald-500"
        >
          Approve
        </motion.div>
        <motion.div
          style={{ opacity: rejectOpacity }}
          className="absolute right-6 top-6 rotate-[12deg] rounded-xl border-4 border-rose-500 bg-white/90 px-4 py-1 text-lg font-extrabold uppercase tracking-wider text-rose-500"
        >
          Reject
        </motion.div>
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          <Icon className="h-3.5 w-3.5" />
          <span className="capitalize">{post.platform}</span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {scheduled.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <Badge tone="warning">Needs approval</Badge>
        </div>
        <p className="mt-2 line-clamp-3 text-sm text-slate-800">{post.caption}</p>
        <p className="mt-2 line-clamp-1 text-xs text-[#1D9CA1]">{post.hashtags?.join(' ')}</p>
      </div>
    </motion.article>
  );
}

interface ActionButtonsProps {
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

export function ActionButtons({ onApprove, onReject, disabled }: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        onClick={onReject}
        disabled={disabled}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
        aria-label="Reject"
      >
        <X className="h-6 w-6" />
      </button>
      <button
        onClick={onApprove}
        disabled={disabled}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-cta text-white shadow-brand transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
        aria-label="Approve"
      >
        <Check className="h-7 w-7" />
      </button>
    </div>
  );
}
