'use client';

import { motion } from 'framer-motion';
import { SectionWrapper, Badge } from '@boost/ui';
import { Upload, PenLine, Send, CalendarCheck, type LucideIcon } from 'lucide-react';

/**
 * How it works — written like a boutique agency process, not a tool setup.
 * Four steps: you hand over the raw material, our team builds the calendar,
 * chat covers any changes, we publish and report back.
 */
interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  who: 'You' | 'Us';
  accent: string;
}

const STEPS: Step[] = [
  {
    icon: Upload,
    title: 'Send us a handful of photos.',
    body: "From your phone, your camera roll, or straight from a shoot. 10–15 a fortnight is plenty for our team to work with.",
    who: 'You',
    accent: '#48D886',
  },
  {
    icon: PenLine,
    title: 'Our team writes the month.',
    body: "Writers draft captions in your voice, editors choose the best shots, strategists decide what goes where. Nothing ships without a second pair of eyes.",
    who: 'Us',
    accent: '#1D9CA1',
  },
  {
    icon: Send,
    title: 'Chat anything you want changed.',
    body: "Preview what's coming up in the portal. Want a different photo on the Friday post? Different CTA? Message us, we redo it. No retainer ticket system.",
    who: 'You',
    accent: '#48D886',
  },
  {
    icon: CalendarCheck,
    title: 'We publish. You see what shipped.',
    body: "Posts go live across every platform on schedule. Every Friday you get a short note summarising what went out and how it performed.",
    who: 'Us',
    accent: '#FFEC3D',
  },
];

export function Demo() {
  return (
    <SectionWrapper id="how-it-works" className="py-14 md:py-28">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <Badge tone="brand" className="mb-3 md:mb-4">
            How we work
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            You send the raw material.{' '}
            <span className="text-gradient-brand">We make it look great.</span>
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:mt-4 md:text-lg">
            No calls to schedule, no briefs to write. Just drop photos and get back to work.
          </p>
        </div>

        <ol className="mt-8 grid grid-cols-2 gap-3 md:mt-12 md:grid-cols-1 md:gap-4">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-start md:gap-4 md:p-6"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md md:h-11 md:w-11"
                style={{ background: `linear-gradient(135deg, ${s.accent}, #1D9CA1)` }}
              >
                <s.icon className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 md:text-xs">
                    Step {i + 1}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider md:px-2 md:text-[10px] ${
                      s.who === 'You'
                        ? 'bg-[#48D886]/15 text-emerald-700'
                        : 'bg-[#1D9CA1]/15 text-teal-700'
                    }`}
                  >
                    {s.who}
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-bold text-slate-900 md:text-xl">{s.title}</h3>
                <p className="mt-1 hidden text-sm text-slate-600 md:block md:text-base">{s.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </SectionWrapper>
  );
}
