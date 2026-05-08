'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionWrapper } from '@boost/ui';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'How long until my first posts go live?',
    a: "About a week. The first few days we spend learning your business — your site, your tone, the way you talk to customers — and building your brand brief. Posts start going up in week two.",
  },
  {
    q: 'Why only 10 posts a month?',
    a: "Because 10 posts people stop for beats 30 posts they scroll past. Every post gets a proper hook, a clean photo, and a caption written for you. That's what moves bookings, not a volume contest.",
  },
  {
    q: "What if I don't have good photos?",
    a: "Most clients don't when they start. We can work with what you have — even quick phone shots — and we shoot fresh photos on our visits or create on-brand imagery in-house to fill the gaps.",
  },
  {
    q: 'Do I have to approve every post?',
    a: "Not unless you want to. We write, schedule, and publish. You can check the calendar in the portal any time, drop a note, or leave it to us entirely. Most clients leave it to us after month one.",
  },
  {
    q: 'Which platforms do you cover?',
    a: "Instagram and TikTok for now. They're where our clients see the strongest pull, and doing two platforms properly beats doing five half-heartedly. Reels, Stories, and grid posts, each written for the platform.",
  },
  {
    q: 'Can you add LinkedIn, Facebook, or others later?',
    a: "Yes, if it makes sense for your business. We'd rather recommend staying on two platforms when three wouldn't help, than upsell you onto a channel you don't need.",
  },
  {
    q: 'Who writes the posts?',
    a: "Our in-house writers and editors. Every client gets a dedicated account manager who knows your business and owns your output. A second editor reviews everything before it goes live.",
  },
  {
    q: 'Can I cancel?',
    a: "Yes, monthly after the first three months. The first three are a commitment so we can properly build your brand voice and measure what's actually working. After that it rolls month-to-month with no notice period.",
  },
  {
    q: "What if I don't see results?",
    a: "We agree measurable goals in the first week — saves, shares, profile visits, bookings, whichever matters to you — and the Friday report tracks them against your baseline. If month three doesn't show movement, we'll tell you before you ask, and fix the plan.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SectionWrapper id="faq" className="py-14 md:py-32">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">Frequently asked</h2>
          <p className="mt-2 text-sm text-slate-600 md:mt-4 md:text-base">Short, honest answers.</p>
        </div>
        <div className="mt-8 space-y-2 md:mt-12 md:space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={f.q}
                layout
                className="overflow-hidden rounded-xl border border-slate-200 bg-white md:rounded-2xl"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left md:gap-4 md:p-5"
                >
                  <span className="text-sm font-medium text-slate-900 md:text-base">{f.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform md:h-5 md:w-5 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="px-4 pb-4 text-xs text-slate-600 md:px-5 md:pb-5 md:text-sm">{f.a}</div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}
