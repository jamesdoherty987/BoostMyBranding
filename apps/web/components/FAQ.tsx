'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionWrapper } from '@boost/ui';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'How long until my first posts go live?',
    a: "Roughly a week. We spend the first few days learning your business — your site, your tone, how you talk to customers — then we build your brand brief and start publishing.",
  },
  {
    q: "What if I don't have good photos?",
    a: "We can work from whatever you've got, even quick phone shots. If you're short on content, we can shoot new photos on our visits, or create on-brand imagery in-house to fill the gaps.",
  },
  {
    q: 'Do I have to approve every post?',
    a: "No. We handle everything — writing, scheduling, publishing. You can check in any time through your portal, but you never have to approve or review anything. That's the whole point.",
  },
  {
    q: 'Which platforms do you cover?',
    a: "Instagram, Facebook, LinkedIn, TikTok, X (Twitter), Pinterest, and Bluesky. Stories and Reels included. We tailor each post to the platform, no copy-pasting.",
  },
  {
    q: 'Who writes the posts?',
    a: "Our in-house writers and editors. Every client is assigned a dedicated account manager who gets to know your business. The team reviews everything internally before it goes live.",
  },
  {
    q: 'Can I cancel?',
    a: "Yes, monthly after the first 3 months. We ask for a short runway so we can properly build your brand voice and actually deliver results, not just activity.",
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
