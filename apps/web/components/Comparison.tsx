'use client';

import { motion } from 'framer-motion';
import { Check, X, Star } from 'lucide-react';
import { SectionWrapper, Logo } from '@boost/ui';

/**
 * Comparison table + testimonial strip, framed as "running it yourself"
 * vs. "letting a social team run it for you" — the agency positioning.
 */

const ROWS = [
  {
    label: 'Writing & captions',
    diy: 'You write every post, scrambling for angles',
    bmb: 'Trained writers in your voice, every post',
  },
  {
    label: 'Photos & editing',
    diy: 'Phone shots straight up, feed looks amateur',
    bmb: 'Edited and colour-graded for every platform',
  },
  {
    label: 'Planning',
    diy: 'Post when you can, inconsistent cadence',
    bmb: 'Monthly calendar planned a week in advance',
  },
  {
    label: 'Team',
    diy: 'Full-time marketer at €45k+ or nobody',
    bmb: 'Dedicated account manager on the team',
  },
  {
    label: 'Your time',
    diy: '10–15 hours a week gone',
    bmb: 'Five minutes a fortnight',
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
    <SectionWrapper className="bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Social media,{' '}
            <span className="text-slate-400">done properly.</span>
          </h2>
          <p className="mt-4 text-slate-600">
            The same standard an in-house team would deliver, without the cost of hiring one.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_1fr_1fr] text-xs font-semibold uppercase tracking-widest md:text-sm">
            <div className="hidden bg-slate-100 p-4 text-slate-500 md:block" />
            <div className="bg-slate-100 p-4 text-slate-500">On your own</div>
            <div className="flex items-center gap-2 bg-slate-900 p-4 text-white">
              <Logo wordmark={false} size="sm" />
              <span>BoostMyBranding</span>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {ROWS.map((row, i) => (
              <motion.li
                key={row.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="grid grid-cols-1 items-stretch md:grid-cols-[1fr_1fr_1fr]"
              >
                <div className="hidden border-r border-slate-100 p-5 text-sm font-semibold text-slate-900 md:flex md:items-center">
                  {row.label}
                </div>
                <div className="flex items-start gap-3 border-r border-slate-100 p-5">
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 md:hidden">
                    {row.label}
                  </div>
                  <div className="flex w-full items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200">
                      <X className="h-3 w-3 text-slate-500" />
                    </span>
                    <p className="text-sm text-slate-600">{row.diy}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-[#48D886]/5 p-5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-cta">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                  <p className="text-sm font-medium text-slate-900">{row.bmb}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {QUOTES.map((q, i) => (
            <motion.blockquote
              key={q.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex gap-0.5 text-[#FFEC3D]">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-800">&ldquo;{q.text}&rdquo;</p>
              <footer className="mt-3 text-xs">
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
