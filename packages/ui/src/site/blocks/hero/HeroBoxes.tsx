'use client';

/**
 * Boxes grid hero. A 3D-tilted grid of boxes in the background, each
 * lighting up in a random brand color on hover. Feels interactive and
 * tactile — good for creative studios, design agencies, modern retail.
 */

import type { WebsiteConfig } from '@boost/core';
import { Boxes } from '../../../aceternity/ui/background-boxes';
import { HeroCopy } from './HeroCopy';

interface HeroBoxesProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroBoxes({ config, embedded }: HeroBoxesProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-slate-950"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      {/* Radial mask over the boxes so the copy has a clean landing zone */}
      <div
        aria-hidden
        className="absolute inset-0 z-20 pointer-events-none bg-slate-950"
        style={{
          maskImage:
            'radial-gradient(transparent, white)',
          WebkitMaskImage:
            'radial-gradient(transparent, white)',
        }}
      />
      <Boxes />
      <div className="relative z-30 mx-auto flex min-h-[640px] max-w-5xl flex-col items-center justify-center px-4 py-24 md:py-32">
        <HeroCopy config={config} dark align="center" motionDisabled={embedded} />
      </div>
    </section>
  );
}
