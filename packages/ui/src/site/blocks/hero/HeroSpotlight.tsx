'use client';

/**
 * Centered copy, mouse-following spotlight glow behind it, subtle grid
 * texture, and a big brand-tinted glow ring underneath. Premium, confident,
 * minimal — best for professional / medical / premium templates.
 *
 * No hero image — this variant is intentionally copy-first. If a hero image
 * is provided via `heroImage`, we embed it as a soft backdrop in the top
 * portion of the section, but the spotlight is always the main event.
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { Spotlight } from '../../effects';
import { HeroCopy } from './HeroCopy';

interface HeroSpotlightProps {
  config: WebsiteConfig;
  heroImage?: string;
  embedded?: boolean;
}

export function HeroSpotlight({ config, heroImage, embedded }: HeroSpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const dark = config.brand.heroStyle === 'dark';

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const copyY = useTransform(scrollYProgress, [0, 1], ['0px', '-40px']);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1, 0]);
  const motionDisabled = reduced || embedded;

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
      {/* Grid backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-[1]"
        style={{
          backgroundImage: dark
            ? 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)'
            : 'linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse 80% 70% at 50% 40%, black 45%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 70% at 50% 40%, black 45%, transparent 100%)',
        }}
      />

      {/* Soft backdrop image (optional) */}
      {heroImage ? (
        <div
          aria-hidden
          className="absolute inset-0 -z-[2]"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: dark ? 0.2 : 0.1,
            filter: 'blur(6px)',
          }}
        />
      ) : null}

      {/* Mouse spotlight */}
      <Spotlight
        color={config.brand.primaryColor}
        size={520}
        intensity={dark ? 0.32 : 0.22}
      />

      {/* Static glow ring centered behind the copy */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-[1] h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${config.brand.accentColor}33, transparent 60%)`,
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
