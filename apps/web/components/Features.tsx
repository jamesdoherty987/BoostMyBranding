'use client';

import { motion } from 'framer-motion';
import { SectionWrapper } from '@boost/ui';
import {
  MessageCircle,
  Camera,
  CalendarClock,
  Sparkles,
  Globe,
  type LucideIcon,
} from 'lucide-react';

/**
 * Features grid. Copy is written like a boutique agency talking about
 * craft and quality, not like an AI tool talking about automation.
 *
 * Mobile: 2-col grid, compact cards with icon + title + a small animated
 * accent element that gives each card personality (emoji, color pulse, etc).
 * Desktop: full illustrations + body text.
 */
interface Feature {
  icon: LucideIcon;
  title: string;
  /** Short label shown on mobile under the title */
  tag: string;
  body: string;
  accent: 'teal' | 'green' | 'yellow' | 'mix';
  art: 'voice' | 'photos' | 'calendar' | 'chat' | 'website';
  span?: 'md' | 'lg';
}

const FEATURES: Feature[] = [
  {
    icon: Sparkles,
    title: 'Posts that sound like you.',
    tag: 'Your voice, not ours',
    body:
      "We study your site, your tone, and the way you actually talk to customers. Every caption lands in your voice, no generic 'Happy Monday!' filler.",
    accent: 'teal',
    art: 'voice',
    span: 'lg',
  },
  {
    icon: Camera,
    title: 'Photos that stop the scroll.',
    tag: 'Magazine-quality feed',
    body:
      "Send us phone shots. We pick the strong ones, clean them up, and size them for every platform. Feeds that look like a magazine, not a group chat.",
    accent: 'yellow',
    art: 'photos',
  },
  {
    icon: CalendarClock,
    title: '30 posts, planned every month.',
    tag: 'Never miss a day',
    body:
      "A full calendar goes out monthly, spaced across the right days and platforms. You see it all before it ships.",
    accent: 'green',
    art: 'calendar',
  },
  {
    icon: MessageCircle,
    title: 'A team one tap away.',
    tag: 'Reply within the hour',
    body:
      "Voice notes, screenshots, 'can we swap that photo?' Message us in the app and it lands with your account manager. Usually a reply within the hour.",
    accent: 'mix',
    art: 'chat',
  },
  {
    icon: Globe,
    title: 'A website that moves with you.',
    tag: 'Live same-day updates',
    body:
      "Fast, mobile-first, built around your brand. New menu, new hours, new service - tell us and it's live that day.",
    accent: 'teal',
    art: 'website',
  },
];

const ACCENT_COLORS = {
  teal: '#1D9CA1',
  green: '#48D886',
  yellow: '#FFEC3D',
  mix: '#1D9CA1',
} as const;

export function Features() {
  return (
    <SectionWrapper id="features" className="py-14 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Social that actually{' '}
            <span className="text-gradient-brand">sells.</span>
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:mt-4 md:text-lg">
            Every post is planned around your brand, your customers, and what actually moves the
            needle: bookings, foot traffic, enquiries.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:mt-14 md:grid-cols-3 md:gap-4">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  const color = ACCENT_COLORS[feature.accent];

  const accentBg = {
    teal: 'linear-gradient(135deg, #1D9CA1 0%, #48D886 100%)',
    green: 'linear-gradient(135deg, #48D886 0%, #1D9CA1 100%)',
    yellow: 'linear-gradient(135deg, #FFEC3D 0%, #48D886 100%)',
    mix: 'linear-gradient(135deg, #1D9CA1 0%, #48D886 50%, #FFEC3D 100%)',
  }[feature.accent];

  const accentBgSoft = {
    teal: 'radial-gradient(70% 60% at 30% 0%, rgba(29,156,161,0.18), transparent 70%)',
    green: 'radial-gradient(70% 60% at 30% 0%, rgba(72,216,134,0.20), transparent 70%)',
    yellow: 'radial-gradient(70% 60% at 30% 0%, rgba(255,236,61,0.28), transparent 70%)',
    mix: 'radial-gradient(70% 60% at 30% 0%, rgba(29,156,161,0.18), transparent 60%), radial-gradient(60% 50% at 80% 100%, rgba(255,236,61,0.22), transparent 70%)',
  }[feature.accent];

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-xl md:rounded-3xl ${
        feature.span === 'lg' ? 'col-span-2 md:col-span-2' : ''
      }`}
    >
      {/*
        Animated accent bar — top edge of the card. Pulses gently to give
        each card a living feel, especially on mobile where the illustrations
        are hidden.
      */}
      <motion.div
        aria-hidden
        className="h-1 w-full md:h-1.5"
        style={{ background: accentBg }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.4 }}
      />

      <div className="flex flex-1 flex-col p-4 md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: accentBgSoft }}
        />

        <div className="relative flex items-center gap-2.5">
          <div
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg md:h-11 md:w-11 md:rounded-2xl"
            style={{ background: accentBg }}
          >
            <Icon className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          {/* Animated dot — mobile personality touch */}
          <motion.span
            aria-hidden
            className="h-2 w-2 rounded-full md:hidden"
            style={{ backgroundColor: color }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
          />
        </div>

        {/* Illustration — desktop only */}
        <div className="relative mt-5 hidden min-h-[120px] items-start md:flex">
          <FeatureIllustration kind={feature.art} />
        </div>

        <div className="relative mt-3 md:mt-auto md:pt-6">
          <h3 className="text-sm font-bold text-slate-900 md:text-xl">{feature.title}</h3>
          {/* Mobile: short tag instead of full body */}
          <p className="mt-1 text-[11px] text-slate-500 md:hidden">{feature.tag}</p>
          {/* Desktop: full body */}
          <p className="mt-2 hidden text-sm text-slate-600 md:block">{feature.body}</p>
        </div>
      </div>
    </motion.article>
  );
}

/* ------------------------ Illustrations ------------------------ */

function FeatureIllustration({ kind }: { kind: Feature['art'] }) {
  switch (kind) {
    case 'voice':
      return <VoiceArt />;
    case 'photos':
      return <PhotosArt />;
    case 'calendar':
      return <CalendarArt />;
    case 'chat':
      return <ChatArt />;
    case 'website':
      return <WebsiteArt />;
  }
}

function VoiceArt() {
  const tokens = [
    { text: 'warm', color: '#48D886' },
    { text: 'honest', color: '#1D9CA1' },
    { text: 'local', color: '#FFEC3D' },
    { text: 'playful', color: '#48D886' },
    { text: 'expert', color: '#1D9CA1' },
  ];
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-slate-500 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[#48D886] animate-pulse" />
        Your brand brief
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((t, i) => (
          <motion.span
            key={t.text}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm"
            style={{
              background: `${t.color}24`,
              color: darken(t.color),
              border: `1px solid ${t.color}60`,
            }}
          >
            {t.text}
          </motion.span>
        ))}
      </div>
      <div className="mt-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs leading-relaxed text-slate-700">
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            caption
          </span>
          <br />
          &ldquo;Morning ☕ first pour is on us if you&apos;re in before 9. See you soon.&rdquo;
        </p>
      </div>
    </div>
  );
}

function PhotosArt() {
  const tiles = [
    { grad: 'linear-gradient(135deg, #1D9CA1, #48D886)', rotate: -6 },
    { grad: 'linear-gradient(135deg, #48D886, #FFEC3D)', rotate: 2 },
    { grad: 'linear-gradient(135deg, #FFEC3D, #1D9CA1)', rotate: 8 },
  ];
  return (
    <div className="relative flex h-28 w-full items-center justify-center">
      {tiles.map((t, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12, rotate: 0 }}
          whileInView={{ opacity: 1, y: 0, rotate: t.rotate }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.1 }}
          whileHover={{ rotate: t.rotate + (i === 1 ? -4 : 4), scale: 1.05 }}
          className="absolute h-24 w-20 rounded-xl border border-white shadow-md"
          style={{
            background: t.grad,
            left: `calc(50% - 40px + ${(i - 1) * 36}px)`,
            zIndex: 10 - i,
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 rounded-xl"
            style={{
              background:
                'radial-gradient(60% 40% at 70% 30%, rgba(255,255,255,0.45), transparent 70%)',
            }}
          />
        </motion.div>
      ))}
      <motion.div
        animate={{ y: [0, -6, 0], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-0 left-1/2 -translate-x-1/2 text-[#FFEC3D]"
      >
        <Sparkles className="h-4 w-4" />
      </motion.div>
    </div>
  );
}

function CalendarArt() {
  const filled = [1, 2, 4, 5, 8, 9, 11, 14, 16, 17, 19, 22, 25, 26, 28];
  const brandRotation = ['#1D9CA1', '#48D886', '#FFEC3D'];
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        <span>Apr</span>
        <span className="rounded-full bg-[#48D886]/15 px-2 py-0.5 text-[#1D9CA1]">
          30 posts live
        </span>
      </div>
      <div className="grid grid-cols-10 gap-[3px]">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.4, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.02 }}
            className="aspect-square rounded-[3px]"
            style={{
              background: filled.includes(i) ? brandRotation[i % 3] : '#e2e8f0',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ChatArt() {
  const bubbles = [
    { side: 'left', text: 'Can we push Friday?', color: 'slate' },
    { side: 'right', text: "On it, moved to Sat 10am.", color: 'brand' },
    { side: 'left', text: '🙌', color: 'slate' },
  ] as const;
  return (
    <div className="flex w-full flex-col gap-1.5">
      {bubbles.map((b, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: b.side === 'left' ? -10 : 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.25 }}
          className={`flex ${b.side === 'right' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs font-medium shadow-sm ${
              b.color === 'brand'
                ? 'rounded-br-sm text-white'
                : 'rounded-bl-sm bg-white text-slate-800 border border-slate-200'
            }`}
            style={
              b.color === 'brand'
                ? { background: 'linear-gradient(135deg, #1D9CA1 0%, #48D886 100%)' }
                : undefined
            }
          >
            {b.text}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function WebsiteArt() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.2 }}
      className="mx-auto w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md"
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#48D886]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#1D9CA1]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#FFEC3D]" />
        <div className="ml-2 flex-1 rounded-sm bg-white px-2 py-0.5 text-[9px] text-slate-400">
          yourbusiness.com
        </div>
      </div>
      <div
        className="relative h-20 w-full"
        style={{
          background:
            'radial-gradient(60% 50% at 30% 30%, #48D886 0%, transparent 70%), radial-gradient(55% 50% at 80% 70%, #1D9CA1 0%, transparent 70%), linear-gradient(180deg, #ffffff, #f8fafc)',
        }}
      >
        <motion.div
          animate={{ x: [0, -4, 0], y: [0, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-x-3 top-3"
        >
          <div className="h-2 w-1/2 rounded-full bg-slate-900/80" />
          <div className="mt-1 h-1.5 w-1/3 rounded-full bg-slate-300" />
        </motion.div>
        <div className="absolute bottom-2 right-3 rounded-md bg-[#1D9CA1] px-2 py-1 text-[9px] font-semibold text-white">
          Book now
        </div>
      </div>
    </motion.div>
  );
}

function darken(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const factor = 0.5;
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}
