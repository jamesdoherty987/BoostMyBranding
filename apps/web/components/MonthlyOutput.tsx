'use client';

import { motion } from 'framer-motion';
import { SectionWrapper, Badge } from '@boost/ui';
import {
  Instagram,
  Facebook,
  Linkedin,
  Music2,
  Twitter,
  Cloud,
  Pin,
} from 'lucide-react';

/**
 * Compact "what you get" showcase. Three glass-y cards on a brand gradient
 * backdrop — a visual answer to "so what actually ships?"
 *
 * The 30-posts card animates a wave of gradient tiles on view so the grid
 * feels alive, not static. The platforms card has platform-colored dots.
 */

const PLATFORMS = [
  { icon: Instagram, color: '#E1306C', name: 'Instagram' },
  { icon: Facebook, color: '#1877F2', name: 'Facebook' },
  { icon: Linkedin, color: '#0A66C2', name: 'LinkedIn' },
  { icon: Music2, color: '#000000', name: 'TikTok' },
  { icon: Twitter, color: '#0f172a', name: 'X' },
  { icon: Cloud, color: '#0085FF', name: 'Bluesky' },
  { icon: Pin, color: '#E60023', name: 'Pinterest' },
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
            More than a post-a-day service.
          </h2>
          <p className="mt-3 text-sm text-white/70 md:mt-4 md:text-lg">
            A proper social team looking after your brand. One flat fee, every month.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:mt-14 md:grid-cols-3 md:gap-5">
          {/* 30 posts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl md:rounded-3xl md:p-8"
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#48D886] md:text-xs">
              Ships
            </div>
            <div className="mt-1 flex items-baseline gap-1 md:mt-2">
              <span className="text-4xl font-bold text-white md:text-7xl">30</span>
              <span className="text-sm text-white/70 md:text-lg">posts</span>
            </div>
            <p className="mt-1 hidden text-sm text-white/60 md:mt-2 md:block">
              A mix of posts, reels, stories, and carousels, planned together.
            </p>

            <div className="mt-3 hidden grid-cols-6 gap-1.5 md:mt-6 md:grid">
              {Array.from({ length: 30 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.015, duration: 0.3 }}
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

          {/* 7 platforms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl md:rounded-3xl md:p-8"
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#1D9CA1] md:text-xs">
              Published to
            </div>
            <div className="mt-1 flex items-baseline gap-1 md:mt-2">
              <span className="text-4xl font-bold text-white md:text-7xl">7</span>
              <span className="text-sm text-white/70 md:text-lg">platforms</span>
            </div>
            <p className="mt-1 hidden text-sm text-white/60 md:mt-2 md:block">
              Reformatted per platform: captions, hashtags, aspect ratios.
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5 md:mt-6 md:gap-2.5">
              {PLATFORMS.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.04 }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg shadow-md md:h-10 md:w-10 md:rounded-xl"
                  style={{ backgroundColor: p.color }}
                  aria-label={p.name}
                >
                  <p.icon className="h-3 w-3 text-white md:h-4 md:w-4" />
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
            className="relative col-span-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl md:col-span-1 md:rounded-3xl md:p-8"
          >
            <div className="flex items-center gap-4 md:block">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#FFEC3D] md:text-xs">
                  Your time
                </div>
                <div className="mt-1 flex items-baseline gap-1 md:mt-2">
                  <span className="text-4xl font-bold text-white md:text-7xl">5</span>
                  <span className="text-sm text-white/70 md:text-lg">minutes</span>
                </div>
                <p className="mt-1 text-xs text-white/60 md:mt-2 md:text-sm">
                  Drop photos, message us if anything needs changing.
                </p>
              </div>

              {/* Clock with a partial arc — hidden on small mobile, shown on md+ */}
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
                    whileInView={{ strokeDashoffset: 276.5 - 276.5 * 0.08 }}
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
                  <text
                    x="50"
                    y="55"
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="bold"
                    fill="#ffffff"
                  >
                    5 min
                  </text>
                </svg>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </SectionWrapper>
  );
}
