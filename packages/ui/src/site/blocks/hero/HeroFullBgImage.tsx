'use client';

/**
 * Full-bleed photo hero with overlay text. A large client photo fills
 * the entire section; headline + CTA sit over a dark overlay that's
 * dense enough to keep text readable regardless of the photo's
 * brightness. Works best with high-quality wide photos.
 *
 * Falls back to a brand gradient when no photo is available.
 */

import type { WebsiteConfig } from '@boost/core';
import { HeroCopy } from './HeroCopy';

interface HeroFullBgImageProps {
  config: WebsiteConfig;
  heroImage?: string;
  embedded?: boolean;
}

export function HeroFullBgImage({ config, heroImage, embedded }: HeroFullBgImageProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      {/* Background image layer — lazy-ish via CSS, so no layout shift. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: heroImage
            ? `url(${heroImage})`
            : 'linear-gradient(135deg, var(--bmb-site-primary) 0%, var(--bmb-site-accent) 100%)',
        }}
      />
      {/* Darkening overlay so copy stays readable */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[640px] max-w-5xl flex-col items-start justify-center px-4 py-24 md:py-32">
        <HeroCopy config={config} dark align="left" motionDisabled={embedded} />
      </div>
    </section>
  );
}
