'use client';

/**
 * Centered copy over an animated beam-field background. Beams sweep in
 * brand colors with staggered timing so motion always feels alive but
 * never frenetic. Best for fitness / creative / education — anywhere
 * energy and momentum are the point.
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { BackgroundBeams } from '../../effects';
import { HeroCopy } from './HeroCopy';

interface HeroBeamsProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroBeams({ config, embedded }: HeroBeamsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const dark = config.brand.heroStyle === 'dark';

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const copyY = useTransform(scrollYProgress, [0, 1], ['0px', '-60px']);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0]);
  const motionDisabled = reduced || embedded;

  return (
    <section
      ref={ref}
      id="home"
      className={`relative isolate overflow-hidden ${dark ? 'text-white' : 'text-slate-900'}`}
      style={{
        background: dark
          ? `linear-gradient(135deg, var(--bmb-site-dark) 0%, ${shade(config.brand.primaryColor, -0.5)} 100%)`
          : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        minHeight: embedded ? '640px' : undefined,
      }}
    >
      <BackgroundBeams
        primary={config.brand.primaryColor}
        accent={config.brand.accentColor}
        pop={config.brand.popColor}
        count={22}
        origin="top-left"
      />

      {/* Glow anchor so the copy pops against the beams */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[55%] -z-[1] h-[60vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background: dark
            ? 'radial-gradient(circle, rgba(0,0,0,0.4), transparent 65%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.8), transparent 65%)',
        }}
      />

      <div className="mx-auto flex min-h-[640px] max-w-5xl flex-col items-center justify-center px-4 py-24 md:py-32 lg:py-40">
        <HeroCopy
          config={config}
          dark={dark}
          align="center"
          motionDisabled={motionDisabled}
          style={motionDisabled ? undefined : { y: copyY, opacity: copyOpacity }}
        />
      </div>
    </section>
  );
}

/** Rough hex shade for background composition. Negative amount darkens. */
function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount * 255));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount * 255));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount * 255));
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g)
    .toString(16)
    .padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}
