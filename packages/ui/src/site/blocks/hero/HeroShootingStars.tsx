'use client';

/**
 * Shooting-stars hero. Occasional meteors streak across a starry sky
 * background. Similar to meteors but less intense — more "night view"
 * than "launch sequence". Good for observatories, astronomy, rooftop
 * venues, photographers, anything with a night theme.
 */

import type { WebsiteConfig } from '@boost/core';
import { ShootingStars } from '../../../aceternity/ui/shooting-stars';
import { HeroCopy } from './HeroCopy';

interface HeroShootingStarsProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroShootingStars({ config, embedded }: HeroShootingStarsProps) {
  const primary = config.brand.primaryColor ?? '#48D886';
  const accent = config.brand.accentColor ?? '#1D9CA1';

  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-slate-950"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      {/* Star field — stationary dots that give depth */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, white 0.5px, transparent 1px), radial-gradient(circle at 75% 60%, white 0.5px, transparent 1px), radial-gradient(circle at 40% 80%, white 0.5px, transparent 1px), radial-gradient(circle at 85% 25%, white 0.5px, transparent 1px), radial-gradient(circle at 15% 55%, white 0.5px, transparent 1px)`,
          backgroundSize: '200px 200px',
          opacity: 0.4,
        }}
      />
      <ShootingStars starColor={accent} trailColor={primary} />
      <div className="relative z-10 mx-auto flex min-h-[520px] max-w-5xl md:min-h-[640px] flex-col items-center justify-center px-4 py-14 md:py-24 lg:py-32">
        <HeroCopy config={config} dark align="center" motionDisabled={embedded} />
      </div>
    </section>
  );
}
