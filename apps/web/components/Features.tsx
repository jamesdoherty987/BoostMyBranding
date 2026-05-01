'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { BentoCell, BentoGrid, SectionWrapper } from '@boost/ui';
import {
  BrainCircuit,
  Camera,
  CalendarClock,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

/**
 * Bento grid of the six pillars of the product. Mix of sizes for visual
 * rhythm; each cell has a unique decorative background.
 */
export function Features() {
  return (
    <SectionWrapper id="features" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Everything you need. <br />
            <span className="text-gradient-brand">Nothing you don&apos;t.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            We replaced the 9-tool marketing stack with one team and one calendar.
          </p>
        </div>

        <div className="mt-14">
          <BentoGrid>
            {/* Brand voice — wide hero card */}
            <BentoCell
              span="lg:col-span-2"
              icon={<BrainCircuit className="h-5 w-5" />}
              title="Brand-voice AI that sounds like you"
              description="We scrape your site, study your tone, and lock in a voice doc the AI uses every month."
              background={<VoiceBg />}
            />

            {/* Real photos */}
            <BentoCell
              icon={<Camera className="h-5 w-5" />}
              title="Real photos, enhanced"
              description="Upload from your phone. We auto-score, enhance, and match photos to posts."
              background={<PhotosBg />}
            />

            {/* Calendar */}
            <BentoCell
              icon={<CalendarClock className="h-5 w-5" />}
              title="30 posts in a day"
              description="Every month, a full content calendar ships to your dashboard — approve with a swipe."
              background={<CalendarBg />}
            />

            {/* Chat — small */}
            <BentoCell
              icon={<MessageSquare className="h-5 w-5" />}
              title="Chat, not email"
              description="One thread with us. Voice notes, screenshots, feedback — all in one place."
              background={<ChatBg />}
            />

            {/* Websites */}
            <BentoCell
              span="lg:col-span-1"
              icon={<Sparkles className="h-5 w-5" />}
              title="Your website, too"
              description="Fast, modern site from a config you review in minutes."
              background={<WebsiteBg />}
            />

            {/* Reports — tall */}
            <BentoCell
              icon={<TrendingUp className="h-5 w-5" />}
              title="Monthly reports"
              description="Clear engagement, reach, and growth. No jargon. No fluff."
              background={<ReportsBg />}
            />
          </BentoGrid>
        </div>
      </div>
    </SectionWrapper>
  );
}

// ---- per-cell decorative backgrounds ----

function VoiceBg() {
  const lines = [
    'tone: warm, confident',
    'vocabulary.use: ["crafted","local","daily"]',
    'emoji: minimal',
    'cta: "Come visit us."',
  ];
  return (
    <div className="absolute right-6 top-6 w-56">
      {lines.map((l, i) => (
        <motion.div
          key={l}
          initial={{ opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          className="mb-1.5 rounded-lg bg-slate-900/5 px-2.5 py-1 font-mono text-[10px] text-slate-600"
        >
          {l}
        </motion.div>
      ))}
    </div>
  );
}

function PhotosBg() {
  return (
    <div className="absolute -right-6 top-6 flex gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border border-white shadow-lg"
          style={{ transform: `rotate(${i * 2 - 2}deg)` }}
        >
          <Image
            src={`https://picsum.photos/seed/feat-p-${i}/200/200`}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        </motion.div>
      ))}
    </div>
  );
}

function CalendarBg() {
  return (
    <div className="absolute right-6 top-6 grid grid-cols-5 gap-1">
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded ${
            [1, 3, 5, 7, 9, 11, 13].includes(i)
              ? 'bg-gradient-cta'
              : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

function ChatBg() {
  return (
    <div className="absolute right-4 top-6 w-44 space-y-1.5">
      <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-gradient-cta px-2.5 py-1 text-[10px] font-medium text-white">
        Got it!
      </div>
      <div className="w-fit rounded-2xl rounded-bl-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700">
        Can we push Friday&apos;s post?
      </div>
      <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-gradient-cta px-2.5 py-1 text-[10px] font-medium text-white">
        Done.
      </div>
    </div>
  );
}

function WebsiteBg() {
  return (
    <div className="absolute right-4 top-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
      <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
      </div>
      <div className="h-16 w-36 bg-gradient-to-br from-[#48D886]/30 to-[#1D9CA1]/30" />
    </div>
  );
}

function ReportsBg() {
  const bars = [30, 55, 42, 70, 60, 85];
  return (
    <div className="absolute right-6 top-6 flex items-end gap-1">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          whileInView={{ height: h }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-3 rounded-t bg-gradient-to-t from-[#1D9CA1] to-[#48D886]"
        />
      ))}
    </div>
  );
}
