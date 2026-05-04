'use client';

/**
 * Lamp hero. A dramatic glowing "stage light" shines down on the
 * headline. Minimal but cinematic — great for high-end services,
 * boutique hotels, event venues, luxury retail.
 */

import type { WebsiteConfig } from '@boost/core';
import { LampContainer } from '../../../aceternity/ui/lamp';
import { HeroCopy } from './HeroCopy';

interface HeroLampProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroLamp({ config, embedded }: HeroLampProps) {
  return (
    <section
      id="home"
      className="relative isolate"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <LampContainer>
        <HeroCopy config={config} dark align="center" motionDisabled={embedded} />
      </LampContainer>
    </section>
  );
}
