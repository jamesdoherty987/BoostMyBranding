'use client';

/**
 * Copy over a slow-shifting animated gradient mesh. No image required.
 * Large, bold, and high-energy while still feeling considered thanks to
 * the noise overlay. Best for retail, creative, or any client without
 * great photography.
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { GradientMesh } from '../../effects';
import { HeroCopy } from './HeroCopy';

interface HeroGradientMeshProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroGradientMesh({ config, embedded }: HeroGradientMeshProps) {
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
        background: dark ? 'var(--bmb-site-dark)' : '#ffffff',
        minHeight: embedded ? '640px' : undefined,
      }}
    >
      <GradientMesh
        primary={config.brand.primaryColor}
        accent={config.brand.accentColor}
        pop={config.brand.popColor}
        dark={dark}
      />

      {/* Contrast-boost overlay so copy reads cleanly over the gradient. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: dark
            ? 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,0,0,0.5), transparent 70%)'
            : 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.55), transparent 70%)',
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
