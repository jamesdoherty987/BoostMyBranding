'use client';

/**
 * Classic split layout: copy left, image tile right. Image parallaxes
 * deeper than copy on scroll so depth emerges as you read. Floating
 * accent orbs add brand-color depth behind the tile.
 *
 * This is the "safe bet" variant — works for almost any template that
 * has good photography. Falls back gracefully to the AI-generated hero
 * image, then to a brand-tinted SVG if neither exists.
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { hexToRgbTuple } from '@boost/core';
import { AuroraBg } from '../../../aurora-bg';
import { HeroCopy } from './HeroCopy';

interface HeroParallaxLayersProps {
  config: WebsiteConfig;
  heroImage?: string;
  businessName: string;
  embedded?: boolean;
}

export function HeroParallaxLayers({
  config,
  heroImage,
  businessName,
  embedded,
}: HeroParallaxLayersProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const dark = config.brand.heroStyle === 'dark';

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const copyY = useTransform(scrollYProgress, [0, 1], ['0px', '-60px']);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0]);
  const imageY = useTransform(scrollYProgress, [0, 1], ['0px', '-140px']);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const motionDisabled = reduced || embedded;
  const primaryRgb = hexToRgbTuple(config.brand.primaryColor);
  const accentRgb = hexToRgbTuple(config.brand.accentColor);

  return (
    <section
      ref={ref}
      id="home"
      className={`relative isolate overflow-hidden ${dark ? 'text-white' : 'text-slate-900'}`}
      style={{
        background: dark
          ? 'linear-gradient(180deg, var(--bmb-site-dark) 0%, #0b1220 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #eef2f7 100%)',
        minHeight: embedded ? '640px' : undefined,
      }}
    >
      <AuroraBg />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 md:py-28 lg:grid-cols-2 lg:gap-14 lg:py-32">
        <HeroCopy
          config={config}
          dark={dark}
          align="left"
          motionDisabled={motionDisabled}
          style={motionDisabled ? undefined : { y: copyY, opacity: copyOpacity }}
        />

        {/* Visual tile on the right. Hidden below `md` so the mobile hero
            stays focused on copy; on tablet it rejoins the grid to add depth. */}
        <motion.div
          className="relative z-10 mx-auto hidden w-full max-w-lg md:block"
          style={motionDisabled ? undefined : { y: imageY, scale: imageScale }}
        >
          <div
            className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl"
            style={{ boxShadow: `0 40px 80px -20px rgba(${primaryRgb}, 0.35)` }}
          >
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage}
                alt={`${businessName}, ${config.brand.tagline}`}
                className="h-full w-full object-cover"
                loading="eager"
              />
            ) : (
              <BrandHeroTile brand={config.brand} businessName={businessName} />
            )}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.4) 100%)',
              }}
            />
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {config.brand.tagline}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                {config.meta?.description ?? businessName}
              </p>
            </div>
          </div>

          {/* Floating accent orbs for depth */}
          <div
            aria-hidden
            className="absolute -left-6 -top-6 h-24 w-24 rounded-full blur-2xl"
            style={{ background: `rgba(${accentRgb}, 0.7)` }}
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -right-8 h-36 w-36 rounded-full blur-3xl"
            style={{ background: `rgba(${primaryRgb}, 0.55)` }}
          />
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Brand-tinted tile fallback when no image (client or AI-generated) is
 * available. Intentionally simpler than the old `BrandHeroSvg` — a gradient
 * wash + the brand initial. The idea is to look CLEAN rather than try to
 * fake a custom illustration. Better to look honest than to look cheap.
 */
function BrandHeroTile({
  brand,
  businessName,
}: {
  brand: WebsiteConfig['brand'];
  businessName: string;
}) {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${brand.primaryColor} 0%, ${brand.accentColor} 50%, ${
          brand.popColor ?? brand.accentColor
        } 100%)`,
      }}
    >
      <span
        className="text-[9rem] font-black leading-none text-white/90"
        style={{ textShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
      >
        {businessName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
