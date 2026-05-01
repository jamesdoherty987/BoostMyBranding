'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionWrapper } from '@boost/ui';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'How long until my first posts go live?',
    a: "Roughly a week. We spend the first few days with your business — your site, your tone, how you talk to customers — then we build your brand brief and ship the first month of content for you to preview.",
  },
  {
    q: "What if I don't have good photos?",
    a: "We can work from whatever you've got, even quick phone shots. If you're short on content, we can shoot new photos on our visits, or create on-brand imagery in-house to fill the gaps.",
  },
  {
    q: "Do I see what's going live?",
    a: "Yes. Everything shows up in your portal before it ships. Scroll through, send us a message if anything needs tweaking. We run the calendar so you don't have to, but nothing is ever a surprise.",
  },
  {
    q: 'Which platforms do you cover?',
    a: "Instagram, Facebook, LinkedIn, TikTok, X (Twitter), Pinterest, and Bluesky. Stories and Reels included. We tailor each post to the platform — no copy-pasting.",
  },
  {
    q: 'Who writes the posts?',
    a: "Our in-house writers and editors. Every client is assigned a dedicated account manager who gets to know your business and reviews everything before it goes live.",
  },
  {
    q: 'Can I cancel?',
    a: "Yes — monthly after the first 3 months. We ask for a short runway so we can properly build your brand voice and actually deliver results, not just activity.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SectionWrapper id="faq" className="py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">Frequently asked</h2>
          <p className="mt-4 text-slate-600">Short, honest answers.</p>
        </div>
        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={f.q}
                layout
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-medium text-slate-900">{f.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
                      <div className="px-5 pb-5 text-sm text-slate-600">{f.a}</div>
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
