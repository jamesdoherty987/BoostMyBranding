'use client';

/**
 * Aurora-lit hero. Uses Aceternity's AuroraBackground (animated gradient
 * sheets that sweep slowly behind the copy) with the shared HeroCopy
 * overlay. Works with or without a photo — the aurora is the visual.
 *
 * Best for: modern services, wellness, creative, tech. Looks premium
 * without requiring any imagery from the client — great when someone
 * hasn't uploaded photos yet.
 */

import type { WebsiteConfig } from '@boost/core';
import { AuroraBackground } from '../../../aceternity/ui/aurora-background';
import { HeroCopy } from './HeroCopy';

interface HeroAuroraProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroAurora({ config, embedded }: HeroAuroraProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <AuroraBackground className="absolute inset-0 h-full w-full">
        <div className="relative z-10 mx-auto flex min-h-[640px] w-full max-w-5xl flex-col items-center justify-center px-4 py-24 md:py-32">
          <HeroCopy
            config={config}
            dark
            align="center"
            motionDisabled={embedded}
          />
        </div>
      </AuroraBackground>
    </section>
  );
}
