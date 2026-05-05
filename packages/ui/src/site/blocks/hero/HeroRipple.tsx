'use client';

/**
 * Ripple-effect hero. Grid-based ripples animate outward from click
 * points — but the passive state still has a soft grid background,
 * which looks great stationary. Good for tech-adjacent trades, creative
 * services, anywhere a subtle techy feel fits.
 */

import type { WebsiteConfig } from '@boost/core';
import { BackgroundRippleEffect } from '../../../aceternity/ui/background-ripple-effect';
import { HeroCopy } from './HeroCopy';

interface HeroRippleProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroRipple({ config, embedded }: HeroRippleProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-white"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <div className="absolute inset-0">
        <BackgroundRippleEffect />
      </div>
      <div className="relative z-10 mx-auto flex min-h-[520px] max-w-5xl md:min-h-[640px] flex-col items-center justify-center px-4 py-14 md:py-24 lg:py-32">
        <HeroCopy config={config} align="center" motionDisabled={embedded} />
      </div>
    </section>
  );
}
