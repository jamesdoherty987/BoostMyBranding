'use client';

/**
 * Wavy-background hero. Flowing simplex-noise waves in brand colors
 * behind centered copy. Smooth and modern, works without a photo.
 *
 * Best for: creative services, wellness, salons. The waves move slowly
 * so they feel premium rather than distracting.
 */

import type { WebsiteConfig } from '@boost/core';
import { WavyBackground } from '../../../aceternity/ui/wavy-background';
import { HeroCopy } from './HeroCopy';

interface HeroWavyProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroWavy({ config, embedded }: HeroWavyProps) {
  const dark = config.brand.heroStyle === 'dark';
  // Blend the brand palette into the wave color list so the visual
  // stays on-brand regardless of what palette the client picked.
  const colors = [
    config.brand.primaryColor,
    config.brand.accentColor,
    config.brand.popColor,
    config.brand.primaryColor,
  ].filter((c): c is string => Boolean(c));

  return (
    <section
      id="home"
      className="relative isolate"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <WavyBackground
        colors={colors}
        backgroundFill={dark ? '#0f172a' : '#ffffff'}
        waveOpacity={0.5}
        blur={10}
        speed="slow"
        className="mx-auto flex min-h-[640px] w-full max-w-5xl flex-col items-center justify-center px-4 py-14 md:py-24 lg:py-32"
      >
        <HeroCopy
          config={config}
          dark={dark}
          align="center"
          motionDisabled={embedded}
        />
      </WavyBackground>
    </section>
  );
}
