'use client';

/**
 * Multicolor background hero. Layered conic gradient rings in the
 * client's brand palette. Bold, colorful, feels alive without needing
 * a photo. Good for creative agencies, kids' brands, playful retail.
 */

import type { WebsiteConfig } from '@boost/core';
import { HeroCopy } from './HeroCopy';

interface HeroMulticolorProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroMulticolor({ config, embedded }: HeroMulticolorProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden"
      style={{
        minHeight: embedded ? '640px' : undefined,
        background:
          'linear-gradient(135deg, rgba(var(--bmb-site-primary-rgb),0.12) 0%, rgba(var(--bmb-site-accent-rgb),0.12) 50%, rgba(var(--bmb-site-pop-rgb),0.12) 100%)',
      }}
    >
      {/* Three soft color orbs so the hero feels dimensional */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'rgba(var(--bmb-site-primary-rgb),0.35)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'rgba(var(--bmb-site-accent-rgb),0.35)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'rgba(var(--bmb-site-pop-rgb),0.35)' }}
      />

      <div className="relative z-10 mx-auto flex min-h-[520px] max-w-5xl md:min-h-[640px] flex-col items-center justify-center px-4 py-14 md:py-24 lg:py-32">
        <HeroCopy config={config} align="center" motionDisabled={embedded} />
      </div>
    </section>
  );
}
