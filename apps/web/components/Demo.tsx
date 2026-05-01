'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { SectionWrapper, Badge } from '@boost/ui';
import { Upload, Sparkles, Check, Calendar } from 'lucide-react';

/**
 * Scroll-driven demo of the monthly cadence. On desktop we use a sticky
 * storyboard (content × 4 viewports); on mobile we collapse into a simpler
 * vertical list so the page isn't needlessly tall.
 */
const STEPS = [
  {
    key: 'upload',
    icon: Upload,
    headline: 'Monday — you drop 15 photos.',
    body: "From your phone, your camera roll, or straight from a shoot. Tag them, or don't. We'll figure it out.",
    image: 'https://picsum.photos/seed/demo-upload/900/900',
  },
  {
    key: 'ai',
    icon: Sparkles,
    headline: 'Tuesday — AI drafts a month.',
    body: '30 captions, hashtags, platform tweaks, and image enhancements. Built from your brand voice.',
    image: 'https://picsum.photos/seed/demo-ai/900/900',
  },
  {
    key: 'approve',
    icon: Check,
    headline: 'Wednesday — you swipe to approve.',
    body: 'Green check or red x. Undo anytime. The whole month takes about 7 minutes.',
    image: 'https://picsum.photos/seed/demo-approve/900/900',
  },
  {
    key: 'publish',
    icon: Calendar,
    headline: 'The rest of the month runs itself.',
    body: 'We auto-publish across every platform on schedule. You get a weekly summary email.',
    image: 'https://picsum.photos/seed/demo-publish/900/900',
  },
];

export function Demo() {
  return (
    <SectionWrapper id="how-it-works" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            A week in the life of a <span className="text-gradient-brand">BoostMyBranding</span> client.
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Under 10 minutes of your time. A full month of content live.
          </p>
        </div>
      </div>

      {/* Mobile: vertical stacked cards */}
      <div className="mx-auto mt-10 max-w-2xl space-y-5 px-4 lg:hidden">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: i * 0.08 }}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="relative aspect-[5/3]">
              <Image src={s.image} alt="" fill className="object-cover" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent" />
              <Badge tone="brand" className="absolute left-3 top-3">
                Step {i + 1}
              </Badge>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-cta text-white">
                  <s.icon className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{s.headline}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600">{s.body}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Desktop: scroll-pinned storyboard */}
      <DesktopStoryboard />
    </SectionWrapper>
  );
}

function DesktopStoryboard() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);

  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      const idx = Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)));
      setActive(idx);
    });
    return unsub;
  }, [scrollYProgress]);

  const progress = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div
      ref={ref}
      className="relative mt-16 hidden lg:block"
      style={{ height: `${STEPS.length * 100}vh` }}
    >
      <div className="sticky top-16 mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200" />
            <motion.div
              style={{ height: progress }}
              className="absolute left-3 top-2 w-0.5 origin-top bg-gradient-to-b from-[#48D886] to-[#1D9CA1]"
            />
            <ul className="space-y-10 pl-10">
              {STEPS.map((s, i) => {
                const isActive = i === active;
                return (
                  <li key={s.key} className="relative">
                    <div
                      className={`absolute -left-[36px] top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                        isActive ? 'border-transparent bg-gradient-cta shadow-brand' : 'border-slate-200 bg-white'
                      }`}
                    >
                      {isActive ? <s.icon className="h-3 w-3 text-white" /> : null}
                    </div>
                    <motion.div
                      animate={{ opacity: isActive ? 1 : 0.4, scale: isActive ? 1 : 0.98 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Badge tone={isActive ? 'brand' : 'default'} className="mb-2">
                        Step {i + 1}
                      </Badge>
                      <h3 className="text-2xl font-bold text-slate-900 md:text-3xl">{s.headline}</h3>
                      <p className="mt-2 text-slate-600">{s.body}</p>
                    </motion.div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="relative">
            <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[40px] border border-slate-200 bg-white shadow-2xl">
              <AnimatePresence mode="wait">
                {STEPS.map((s, i) =>
                  i === active ? (
                    <motion.div
                      key={s.key}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.55 }}
                      className="absolute inset-0"
                    >
                      <Image src={s.image} alt={s.headline} fill className="object-cover" unoptimized />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
                      <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-white/90 p-4 backdrop-blur">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-cta text-white">
                            <s.icon className="h-4 w-4" />
                          </div>
                          <div className="text-sm font-semibold text-slate-900">{s.headline}</div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null,
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
