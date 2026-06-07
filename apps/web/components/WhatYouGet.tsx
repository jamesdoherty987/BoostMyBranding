'use client';

import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { SectionWrapper, Badge } from '@boost/ui';
import {
  Users,
  MessageCircle,
  CalendarDays,
  Mail,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/**
 * "What it's like to be a client" bento grid.
 *
 * Replaces the old "10 posts / 2 platforms / 0 effort" stats block. That
 * framing made the offer read as thin (10 is small, 2 is small). This
 * section reframes around the *experience* of working with us: real
 * humans, a dedicated manager, planning ahead, weekly reports. Each card
 * is a cursor-follow spotlight that glows under the mouse, plus a live
 * mini-illustration that makes the section feel alive.
 *
 * Mobile: 2-col compact cards with title + tag. Desktop: 6-col bento
 * with varied spans + full illustrations.
 */

interface Cell {
  icon: LucideIcon;
  kicker: string;
  title: string;
  tag: string;
  body: string;
  span: 'sm' | 'md' | 'lg' | 'xl';
  art: 'team' | 'chat' | 'calendar' | 'report' | 'voice';
  accent: string;
}

const CELLS: Cell[] = [
  {
    icon: Users,
    kicker: 'Your team',
    title: 'A boutique crew, in your corner.',
    tag: 'Real humans, not a tool',
    body:
      'Writers, photo editors, a planner, and an account manager. All working on your brand as a small, focused team.',
    span: 'lg',
    art: 'team',
    accent: '#48D886',
  },
  {
    icon: MessageCircle,
    kicker: 'Always on',
    title: 'Message your manager any time.',
    tag: 'Reply within the hour',
    body: 'One person who knows your business. Quick questions, new ideas, last-minute changes, sorted in a thread.',
    span: 'md',
    art: 'chat',
    accent: '#1D9CA1',
  },
  {
    icon: CalendarDays,
    kicker: 'Planned ahead',
    title: 'A calendar, a week in advance.',
    tag: 'Nothing rushed, nothing last-minute',
    body:
      "You'll see what's going out before it goes out. Re-order, swap, or say go, all inside the portal.",
    span: 'md',
    art: 'calendar',
    accent: '#FFEC3D',
  },
  {
    icon: Sparkles,
    kicker: 'Your voice',
    title: 'Posts that sound like you.',
    tag: 'Brand voice, dialled in',
    body:
      'A living brand brief the team writes from. Nothing generic, no "Happy Monday" filler, no copy-paste captions.',
    span: 'md',
    art: 'voice',
    accent: '#48D886',
  },
  {
    icon: Mail,
    kicker: 'Friday report',
    title: 'What shipped, what worked.',
    tag: 'Summary in your inbox',
    body:
      "Every Friday: which posts landed, what people engaged with, and what we're leaning into next week.",
    span: 'md',
    art: 'report',
    accent: '#1D9CA1',
  },
];

export function WhatYouGet() {
  return (
    <SectionWrapper className="relative overflow-hidden py-14 md:py-28">
      {/* Soft brand backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 15% 10%, rgba(72,216,134,0.10), transparent 60%), radial-gradient(50% 40% at 90% 80%, rgba(29,156,161,0.10), transparent 60%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="brand" className="mb-3 md:mb-4">
            What it feels like
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Less like hiring an agency.
            <br className="hidden md:block" />{' '}
            <span className="text-gradient-brand">More like having a team.</span>
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:mt-4 md:text-lg">
            A boutique crew running your socials. You get a manager who knows your brand,
            posts that ship on time, and a report every Friday.
          </p>
        </div>

        {/*
          6-col grid on desktop: lg spans 3, md spans 3.
          Mobile: 2-col grid with lg spanning 2.
        */}
        <div className="mt-8 grid grid-cols-2 gap-3 md:mt-14 md:grid-cols-6 md:gap-4">
          {CELLS.map((c, i) => (
            <BentoCard key={c.title} cell={c} index={i} />
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

function BentoCard({ cell, index }: { cell: Cell; index: number }) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Cursor-follow spotlight. Sets two CSS custom properties (--mx, --my)
   * which the radial gradient reads. No JS animation loop, the gradient
   * just moves where the cursor moves. Composited on GPU.
   */
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }, []);

  const span = {
    sm: 'col-span-1 md:col-span-2',
    md: 'col-span-1 md:col-span-3',
    lg: 'col-span-2 md:col-span-3',
    xl: 'col-span-2 md:col-span-6',
  }[cell.span];

  const Icon = cell.icon;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: index * 0.07 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-xl md:rounded-3xl ${span}`}
      style={{ ['--mx' as string]: '50%', ['--my' as string]: '50%' }}
    >
      {/* Cursor-follow spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(320px circle at var(--mx) var(--my), ${cell.accent}22, transparent 60%)`,
        }}
      />

      {/* Accent border top */}
      <div
        aria-hidden
        className="h-1 w-full md:h-1.5"
        style={{
          background: `linear-gradient(90deg, ${cell.accent}, #1D9CA1)`,
        }}
      />

      <div className="relative flex flex-1 flex-col p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg md:h-11 md:w-11 md:rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${cell.accent}, #1D9CA1)` }}
          >
            <Icon className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 md:text-[10px]">
            {cell.kicker}
          </span>
        </div>

        {/* Illustration, desktop only */}
        <div className="relative mt-4 hidden flex-1 items-center justify-center md:flex">
          <Art kind={cell.art} accent={cell.accent} />
        </div>

        <div className="mt-3 md:mt-5">
          <h3 className="text-sm font-bold text-slate-900 md:text-lg lg:text-xl">
            {cell.title}
          </h3>
          {/* Mobile shows the short tag, desktop shows full body */}
          <p className="mt-1 text-[11px] text-slate-500 md:hidden">{cell.tag}</p>
          <p className="mt-2 hidden text-sm text-slate-600 md:block">{cell.body}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ----------------------------- Illustrations ----------------------------- */

function Art({ kind, accent }: { kind: Cell['art']; accent: string }) {
  switch (kind) {
    case 'team':
      return <TeamArt accent={accent} />;
    case 'chat':
      return <ChatArt />;
    case 'calendar':
      return <CalendarArt />;
    case 'voice':
      return <VoiceArt />;
    case 'report':
      return <ReportArt />;
  }
}

/**
 * Team orbit. Three rings of role chips orbiting around a central "you"
 * dot. Implemented with plain CSS animation so it runs smoothly without a
 * JS animation loop.
 */
function TeamArt({ accent }: { accent: string }) {
  const roles = [
    { label: 'Writer', bg: '#48D886', angle: 0 },
    { label: 'Editor', bg: '#1D9CA1', angle: 72 },
    { label: 'Photo', bg: '#FFEC3D', color: '#1D9CA1', angle: 144 },
    { label: 'Planner', bg: '#48D886', angle: 216 },
    { label: 'Manager', bg: '#1D9CA1', angle: 288 },
  ];

  return (
    <div className="relative h-[180px] w-full">
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Rings */}
        <div
          className="absolute h-32 w-32 rounded-full border border-slate-200"
          style={{ borderStyle: 'dashed' }}
        />
        <div
          className="absolute h-48 w-48 rounded-full border border-slate-200"
          style={{ borderStyle: 'dashed' }}
        />

        {/* Center "your brand" pulse */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${accent}, #1D9CA1)` }}
        >
          Your
          <br />
          brand
        </motion.div>

        {/* Orbit dots (CSS animation on a single spinning group) */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0"
        >
          {roles.map((r) => {
            const rad = (r.angle * Math.PI) / 180;
            // 96px radius for outer ring
            const x = Math.cos(rad) * 96;
            const y = Math.sin(rad) * 96;
            return (
              <motion.div
                key={r.label}
                animate={{ rotate: -360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="absolute left-1/2 top-1/2 rounded-full px-2 py-0.5 text-[9px] font-semibold text-white shadow-md"
                style={{
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                  background: r.bg,
                  color: r.color ?? '#fff',
                }}
              >
                {r.label}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

function ChatArt() {
  const msgs = [
    { side: 'left', text: 'New menu item going live Friday.', color: 'slate' },
    { side: 'right', text: 'Got it, new photos + Reel on the way.', color: 'brand' },
    { side: 'left', text: '💚', color: 'slate' },
  ] as const;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {msgs.map((m, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: m.side === 'left' ? -8 : 8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.2 }}
          className={`flex ${m.side === 'right' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs font-medium shadow-sm ${
              m.color === 'brand'
                ? 'rounded-br-sm text-white'
                : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
            }`}
            style={
              m.color === 'brand'
                ? { background: 'linear-gradient(135deg, #1D9CA1 0%, #48D886 100%)' }
                : undefined
            }
          >
            {m.text}
          </div>
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.8 }}
        className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400"
      >
        <span className="flex h-1.5 w-1.5 rounded-full bg-[#48D886]" />
        <span>Typing…</span>
      </motion.div>
    </div>
  );
}

function CalendarArt() {
  const days = Array.from({ length: 14 });
  const scheduled = [1, 3, 6, 9, 11];

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        <span>Next 14 days</span>
        <span className="rounded-full bg-[#48D886]/15 px-2 py-0.5 text-[#1D9CA1]">
          Planned
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.4, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 + i * 0.03 }}
            className="relative aspect-square rounded-md border border-slate-200 bg-white"
          >
            {scheduled.includes(i) ? (
              <span
                className="absolute inset-1 rounded-sm"
                style={{
                  background: `linear-gradient(135deg, ${
                    ['#48D886', '#1D9CA1', '#FFEC3D'][scheduled.indexOf(i) % 3]
                  }, rgba(255,255,255,0.4))`,
                }}
              />
            ) : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function VoiceArt() {
  const tokens = [
    { text: 'warm', color: '#48D886' },
    { text: 'local', color: '#FFEC3D' },
    { text: 'playful', color: '#1D9CA1' },
    { text: 'honest', color: '#48D886' },
  ];

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#48D886]" />
        Brand brief
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((t, i) => (
          <motion.span
            key={t.text}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm"
            style={{
              background: `${t.color}24`,
              color: darken(t.color),
              borderColor: `${t.color}60`,
            }}
          >
            {t.text}
          </motion.span>
        ))}
      </div>
      <div className="mt-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
          caption draft
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
          “Morning ☕ first pour is on us if you're in before 9.”
        </p>
      </div>
    </div>
  );
}

function ReportArt() {
  const rows = [
    { label: 'Reel · Oat cortado', val: '4.2k', tint: '#48D886' },
    { label: 'Grid · New pastry', val: '1.8k', tint: '#1D9CA1' },
    { label: 'Story · Saturday', val: '980', tint: '#FFEC3D' },
  ];

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
        <Mail className="h-3 w-3" />
        Weekly summary · Fri 5pm
      </div>
      <div className="p-3">
        {rows.map((r, i) => (
          <motion.div
            key={r.label}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-b-0"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: r.tint }}
              />
              <span className="text-[10px] text-slate-600">{r.label}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-900">{r.val}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function darken(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = 0.5;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}
