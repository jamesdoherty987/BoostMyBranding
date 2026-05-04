'use client';

/**
 * Sparkles hero. Drifting particle field over a dark background with
 * centered copy. Feels celebratory and premium — good for launches,
 * events, gala venues, anywhere "night sky" energy fits.
 */

import type { WebsiteConfig } from '@boost/core';
import { SparklesCore } from '../../../aceternity/ui/sparkles';
import { HeroCopy } from './HeroCopy';

interface HeroSparklesProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroSparkles({ config, embedded }: HeroSparklesProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-slate-950"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <div className="absolute inset-0">
        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1.2}
          particleDensity={embedded ? 40 : 90}
          className="h-full w-full"
          particleColor={config.brand.primaryColor ?? '#ffffff'}
        />
      </div>
      {/* Radial mask so copy has breathing room against the sparkles */}
      <div
        className="absolute inset-0 bg-slate-950"
        style={{
          maskImage:
            'radial-gradient(ellipse at center, transparent 25%, black 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, transparent 25%, black 75%)',
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-[640px] w-full max-w-5xl flex-col items-center justify-center px-4 py-24 md:py-32">
        <HeroCopy
          config={config}
          dark
          align="center"
          motionDisabled={embedded}
        />
      </div>
    </section>
  );
}
