'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionWrapper } from '@boost/ui';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'How long until my first posts go live?',
    a: 'Onboarding takes about a week — we build your brand voice, set up connections, and generate the first calendar. After approval, posts start shipping right away.',
  },
  {
    q: 'What if I don\'t have photos?',
    a: 'No problem. We generate on-brand images using AI (Flux 2 Pro) and match them to your voice. Most clients use a 70/30 mix of real + generated.',
  },
  {
    q: 'Do I still control what goes live?',
    a: 'Always. Every post waits for your approval in the portal. You can approve the whole month in minutes, or review post by post.',
  },
  {
    q: 'Which platforms do you support?',
    a: 'Instagram, Facebook, LinkedIn, TikTok, X (Twitter), Pinterest, and Bluesky. Stories and Reels included.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes — monthly after the first 3 months. We ask for a short runway so we can build a solid brand-voice doc and deliver real results.',
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
