'use client';

import { motion } from 'framer-motion';
import { SectionWrapper, Badge } from '@boost/ui';
import { Instagram, Music2 } from 'lucide-react';

/**
 * Compact "what you get" showcase. Three glass-y cards on a brand gradient
 * backdrop, a visual answer to "so what actually ships?"
 *
 * The 10-posts card animates a wave of gradient tiles on view so the grid
 * feels alive, not static. The platforms card shows Instagram and TikTok.
 */

const PLATFORMS = [
  { icon: Instagram, color: '#E1306C', name: 'Instagram' },
  { icon: Music2, color: '#000000', name: 'TikTok' },
];

export function MonthlyOutput() {
  return (
    <SectionWrapper className="relative overflow-hidden py-14 md:py-28">
      {/* Brand-gradient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 20% 30%, rgba(72,216,134,0.15), transparent 60%), radial-gradient(50% 40% at 80% 70%, rgba(29,156,161,0.15), transparent 60%), linear-gradient(180deg, #0b1220 0%, #111827 100%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge
            tone="brand"
            className="mb-3 border-white/20 bg-white/10 text-white backdrop-blur md:mb-4"
          >
            What's included every month
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            Fewer posts. A lot more craft.
          </h2>
          <p className="mt-3 text-sm text-white/70 md:mt-4 md:text-lg">
            A proper social team looking after your brand. One flat fee, every month.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:mt-14 md:grid-cols-3 md:gap-5">
          {/* 10 posts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm md:rounded-3xl md:p-8"
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#48D886] md:text-xs">
              Ships
            </div>
            <div className="mt-1 flex items-baseline gap-1 md:mt-2">
              <span className="text-4xl font-bold text-white md:text-7xl">10</span>
              <span className="text-sm text-white/70 md:text-lg">posts</span>
            </div>
            <p className="mt-1 hidden text-sm text-white/60 md:mt-2 md:block">
              A mix of Reels, Stories, and grid posts, each one worth sharing.
            </p>

            <div className="mt-3 hidden grid-cols-5 gap-1.5 md:mt-6 md:grid">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded"
                  style={{
                    background: `linear-gradient(135deg, ${
                      ['#48D886', '#1D9CA1', '#FFEC3D', '#48D886', '#1D9CA1'][i % 5]
                    }, rgba(255,255,255,0.1))`,
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* 2 platforms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm md:rounded-3xl md:p-8"
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#1D9CA1] md:text-xs">
              Published to
            </div>
            <div className="mt-1 flex items-baseline gap-1 md:mt-2">
              <span className="text-4xl font-bold text-white md:text-7xl">2</span>
              <span className="text-sm text-white/70 md:text-lg">platforms</span>
            </div>
            <p className="mt-1 hidden text-sm text-white/60 md:mt-2 md:block">
              Instagram and TikTok, tailored per platform: captions, hashtags, aspect ratios.
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5 md:mt-6 md:gap-2.5">
              {PLATFORMS.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-white shadow-md md:h-10 md:rounded-xl md:px-3 md:text-sm"
                  style={{ backgroundColor: p.color }}
                  aria-label={p.name}
                >
                  <p.icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span>{p.name}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Your time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="relative col-span-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm md:col-span-1 md:rounded-3xl md:p-8"
          >
            <div className="flex items-center gap-4 md:block">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#FFEC3D] md:text-xs">
                  Your time
                </div>
                <div className="mt-1 flex items-baseline gap-1 md:mt-2">
                  <span className="text-4xl font-bold text-white md:text-7xl">0</span>
                  <span className="text-sm text-white/70 md:text-lg">effort</span>
                </div>
                <p className="mt-1 text-xs text-white/60 md:mt-2 md:text-sm">
                  Your account manager runs the whole show. You get back to running your business.
                </p>
              </div>

              {/* Checkmark circle, desktop only */}
              <div className="hidden items-center justify-center py-2 md:mt-6 md:flex">
                <svg viewBox="0 0 100 100" className="h-24 w-24">
                  <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="44"
                    stroke="url(#clockGrad)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="276.5"
                    initial={{ strokeDashoffset: 276.5 }}
                    whileInView={{ strokeDashoffset: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
                    transform="rotate(-90 50 50)"
                  />
                  <defs>
                    <linearGradient id="clockGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#48D886" />
                      <stop offset="0.5" stopColor="#1D9CA1" />
                      <stop offset="1" stopColor="#FFEC3D" />
                    </linearGradient>
                  </defs>
                  <motion.path
                    d="M 35 52 L 45 62 L 65 40"
                    stroke="#48D886"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 1.2, ease: 'easeOut' }}
                  />
                </svg>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </SectionWrapper>
  );
}
