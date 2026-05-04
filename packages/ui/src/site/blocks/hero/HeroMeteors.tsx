'use client';

/**
 * Hero with falling meteors. Dark, dramatic, event-launch energy. Good
 * for gyms, event venues, nightlife, photographers. The meteor trails
 * draw constantly in the background while the copy sits up front.
 */

import type { WebsiteConfig } from '@boost/core';
import { Meteors } from '../../../aceternity/ui/meteors';
import { HeroCopy } from './HeroCopy';

interface HeroMeteorsProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroMeteors({ config, embedded }: HeroMeteorsProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-slate-950"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <Meteors number={24} />
      <div className="relative z-10 mx-auto flex min-h-[640px] max-w-5xl flex-col items-center justify-center px-4 py-24 md:py-32">
        <HeroCopy config={config} dark align="center" motionDisabled={embedded} />
      </div>
    </section>
  );
}
