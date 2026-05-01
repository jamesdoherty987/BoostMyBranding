'use client';

import { motion } from 'framer-motion';
import { Check, X, Star } from 'lucide-react';
import { SectionWrapper, Logo } from '@boost/ui';

/**
 * Comparison table + testimonial strip, framed as "running it yourself"
 * vs. "letting a social team run it for you" — the agency positioning.
 *
 * Mobile: two stacked columns per row (DIY left, BMB right) with the
 * label inline. Desktop: classic three-column table.
 */

const ROWS = [
  {
    label: 'Writing & captions',
    diy: 'Scrambling for angles every week',
    bmb: 'Writers in your voice, every post',
  },
  {
    label: 'Photos & editing',
    diy: 'Phone shots, feed looks amateur',
    bmb: 'Edited for every platform',
  },
  {
    label: 'Planning',
    diy: 'Post when you can, inconsistent',
    bmb: 'Monthly calendar, a week ahead',
  },
  {
    label: 'Team',
    diy: 'Hire at €45k+ or do it yourself',
    bmb: 'Dedicated account manager',
  },
  {
    label: 'Your time',
    diy: '10–15 hours a week',
    bmb: 'Zero — we handle it all',
  },
];

const QUOTES = [
  {
    text: "Our Instagram went from three posts a month to three posts a week, and every one of them actually sounds like us.",
    name: 'Sean Murphy',
    role: "Murphy's Plumbing",
  },
  {
    text: "Finally, social media I don't have to think about. Our account manager just gets it.",
    name: 'Nora Kelly',
    role: 'Atlas Fitness',
  },
  {
    text: "Website + social for one price, way cheaper than hiring a marketer. Bookings doubled in two months.",
    name: 'Luca Romano',
    role: 'Verde Cafe',
  },
];

export function Comparison() {
  return (
    <SectionWrapper className="bg-slate-50 py-14 md:py-28">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Social media,{' '}
            <span className="text-slate-400">done properly.</span>
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:mt-4 md:text-base">
            The same standard an in-house team would deliver, without the cost of hiring one.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:mt-12 md:rounded-3xl">
          {/* Header row */}
          <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr]">
            <div className="hidden bg-slate-100 p-4 md:block" />
            <div className="bg-slate-100 p-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500 md:p-4 md:text-left md:text-sm">
              On your own
            </div>
            <div className="flex items-center justify-center gap-1.5 bg-slate-900 p-3 text-[10px] font-semibold uppercase tracking-widest text-white md:justify-start md:gap-2 md:p-4 md:text-sm">
              <Logo wordmark={false} size="sm" />
              <span className="hidden sm:inline">BoostMyBranding</span>
              <span className="sm:hidden">BMB</span>
            </div>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-slate-100">
            {ROWS.map((row, i) => (
              <motion.li
                key={row.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr]"
              >
                {/* Label — desktop only as its own column */}
                <div className="hidden border-r border-slate-100 p-4 text-sm font-semibold text-slate-900 md:flex md:items-center">
                  {row.label}
                </div>

                {/* DIY column */}
                <div className="flex flex-col gap-1 border-r border-slate-100 p-3 md:p-4">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 md:hidden">
                    {row.label}
                  </span>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 md:h-5 md:w-5">
                      <X className="h-2.5 w-2.5 text-slate-500 md:h-3 md:w-3" />
                    </span>
                    <p className="text-xs text-slate-600 md:text-sm">{row.diy}</p>
                  </div>
                </div>

                {/* BMB column */}
                <div className="flex flex-col gap-1 bg-[#48D886]/5 p-3 md:p-4">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-[#1D9CA1] md:hidden">
                    {row.label}
                  </span>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-cta md:h-5 md:w-5">
                      <Check className="h-2.5 w-2.5 text-white md:h-3 md:w-3" />
                    </span>
                    <p className="text-xs font-medium text-slate-900 md:text-sm">{row.bmb}</p>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Testimonials */}
        <div className="mt-8 grid grid-cols-1 gap-3 md:mt-12 md:grid-cols-3 md:gap-4">
          {QUOTES.map((q, i) => (
            <motion.blockquote
              key={q.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-xl border border-slate-200 bg-white p-4 md:rounded-2xl md:p-5"
            >
              <div className="flex gap-0.5 text-[#FFEC3D]">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star key={idx} className="h-3 w-3 fill-current md:h-3.5 md:w-3.5" />
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-800 md:mt-3 md:text-sm">&ldquo;{q.text}&rdquo;</p>
              <footer className="mt-2 text-[11px] md:mt-3 md:text-xs">
                <span className="font-semibold text-slate-900">{q.name}</span>
                <span className="text-slate-500"> · {q.role}</span>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
