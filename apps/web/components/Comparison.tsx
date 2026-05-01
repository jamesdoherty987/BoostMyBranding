'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { SectionWrapper, Logo } from '@boost/ui';

/**
 * A head-to-head comparison. Shows the pain of doing it yourself vs. what
 * the platform handles. Intentionally short, honest, and direct.
 */

const ROWS = [
  {
    label: 'Content creation',
    diy: 'You write every caption, source every photo',
    bmb: 'AI drafts everything in your brand voice',
  },
  {
    label: 'Scheduling',
    diy: 'Manual, platform by platform',
    bmb: 'One click, publishes to all platforms',
  },
  {
    label: 'Platform know-how',
    diy: 'You master each algorithm yourself',
    bmb: 'We reformat every post per platform',
  },
  {
    label: 'Team needed',
    diy: 'In-house marketer or an agency retainer',
    bmb: 'Zero. It just runs.',
  },
  {
    label: 'Cost predictability',
    diy: 'Variable — ads, tools, time, freelancers',
    bmb: 'One flat monthly price',
  },
  {
    label: 'Time commitment',
    diy: '10–15 hours / week',
    bmb: '10 minutes / month to approve',
  },
];

export function Comparison() {
  return (
    <SectionWrapper className="bg-slate-50 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Doing it yourself <span className="text-slate-400">is a full-time job.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            We do it for you. Here&apos;s what that actually means.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_1fr_1fr] text-xs font-semibold uppercase tracking-widest md:text-sm">
            <div className="hidden bg-slate-100 p-4 text-slate-500 md:block" />
            <div className="bg-slate-100 p-4 text-slate-500">
              Going it alone
            </div>
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
      </div>
    </SectionWrapper>
  );
}
