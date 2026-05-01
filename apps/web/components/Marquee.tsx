'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

/**
 * Horizontal auto-scrolling post marquee, inspired by competitor landing
 * pages. Two rows drift in opposite directions to give a sense of motion
 * and volume — without needing any interaction from the visitor.
 */

interface MarqueePost {
  seed: string;
  brand: string;
  caption: string;
  platform: string;
}

const ROW_A: MarqueePost[] = [
  { seed: 'mq-a-1', brand: 'Verde Cafe', caption: 'Morning light & a flat white. Doors open in 15.', platform: 'Instagram' },
  { seed: 'mq-a-2', brand: "Murphy's Plumbing", caption: 'New van wrap, same reliable service. 24/7 callouts.', platform: 'Facebook' },
  { seed: 'mq-a-3', brand: 'Atlas Fitness', caption: '6am class nearly full. Two spots left — link in bio.', platform: 'Instagram' },
  { seed: 'mq-a-4', brand: 'Nova Beauty', caption: 'Before & after — gentle balayage on natural dark hair.', platform: 'TikTok' },
  { seed: 'mq-a-5', brand: 'Harbor Salon', caption: 'Walk-ins welcome this Wednesday.', platform: 'Instagram' },
  { seed: 'mq-a-6', brand: 'Ridge Roasters', caption: 'New Ethiopian single-origin is in. Taste notes: peach, jasmine, caramel.', platform: 'Instagram' },
  { seed: 'mq-a-7', brand: 'Verde Cafe', caption: 'Saturday special: chocolate almond croissants, while they last.', platform: 'Facebook' },
];

const ROW_B: MarqueePost[] = [
  { seed: 'mq-b-1', brand: 'Atlas Fitness', caption: '30-day challenge starts Monday. Free to members.', platform: 'LinkedIn' },
  { seed: 'mq-b-2', brand: "Murphy's Plumbing", caption: 'Emergency at 3am? Sean answered. Glad we called.', platform: 'Instagram' },
  { seed: 'mq-b-3', brand: 'Nova Beauty', caption: 'Consultation bookings open for June.', platform: 'Instagram' },
  { seed: 'mq-b-4', brand: 'Verde Cafe', caption: 'Our barista Rhys on espresso technique.', platform: 'TikTok' },
  { seed: 'mq-b-5', brand: 'Ridge Roasters', caption: 'Subscribe once. Fresh beans every Wednesday.', platform: 'Instagram' },
  { seed: 'mq-b-6', brand: 'Harbor Salon', caption: 'The anti-brass toner we keep running out of.', platform: 'Facebook' },
  { seed: 'mq-b-7', brand: 'Atlas Fitness', caption: 'Member of the month — Ciara, crushing PRs and vibes.', platform: 'Instagram' },
];

export function Marquee() {
  return (
    <section className="relative overflow-hidden py-12 md:py-16" aria-label="Recent posts">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent md:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent md:w-32" />

      <MarqueeRow posts={ROW_A} duration={70} direction={1} />
      <div className="mt-4">
        <MarqueeRow posts={ROW_B} duration={90} direction={-1} />
      </div>
    </section>
  );
}

function MarqueeRow({
  posts,
  duration,
  direction,
}: {
  posts: MarqueePost[];
  duration: number;
  direction: 1 | -1;
}) {
  // Double the array so the loop appears seamless.
  const loop = [...posts, ...posts];
  return (
    <div className="relative flex">
      <motion.div
        animate={{ x: direction === 1 ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
        className="flex shrink-0 gap-4 pr-4"
      >
        {loop.map((p, i) => (
          <MarqueeCard key={`${p.seed}-${i}`} post={p} />
        ))}
      </motion.div>
    </div>
  );
}

function MarqueeCard({ post }: { post: MarqueePost }) {
  return (
    <article className="w-64 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:w-72">
      <div className="relative aspect-square">
        <Image
          src={`https://picsum.photos/seed/${post.seed}/600/600`}
          alt=""
          fill
          className="object-cover"
          unoptimized
        />
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
          {post.platform}
        </div>
      </div>
      <div className="p-3">
        <div className="text-[10px] font-medium uppercase tracking-widest text-[#1D9CA1]">
          {post.brand}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-slate-800">{post.caption}</p>
      </div>
    </article>
  );
}
