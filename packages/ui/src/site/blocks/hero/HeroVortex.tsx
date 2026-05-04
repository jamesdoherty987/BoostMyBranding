'use client';

/**
 * Vortex hero. Swirling particles in the client's primary color behind
 * centered copy. Premium and dynamic — great for creative agencies,
 * tech-adjacent trades, modern restaurants.
 */

import type { WebsiteConfig } from '@boost/core';
import { Vortex } from '../../../aceternity/ui/vortex';
import { HeroCopy } from './HeroCopy';

interface HeroVortexProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroVortex({ config, embedded }: HeroVortexProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <Vortex
        // Fewer particles when embedded (dashboard preview) to keep the
        // CPU usage modest while editing.
        particleCount={embedded ? 250 : 600}
        baseHue={200}
        backgroundColor="#020617"
        className="flex min-h-[640px] w-full flex-col items-center justify-center px-4 py-24 md:py-32"
      >
        <HeroCopy config={config} dark align="center" motionDisabled={embedded} />
      </Vortex>
    </section>
  );
}
