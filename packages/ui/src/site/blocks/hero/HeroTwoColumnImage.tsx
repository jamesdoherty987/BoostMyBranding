'use client';

/**
 * Two-column hero: copy + CTAs on the left, hero photo on the right.
 * The cleanest "local business" hero layout — every plumber, cafe,
 * dentist, and salon site uses a variant of this. Works well with
 * standard portrait/landscape photos.
 *
 * Falls back to a soft brand gradient tile when no photo is available.
 */

import type { WebsiteConfig } from '@boost/core';
import { HeroCopy } from './HeroCopy';

interface HeroTwoColumnImageProps {
  config: WebsiteConfig;
  heroImage?: string;
  embedded?: boolean;
}

export function HeroTwoColumnImage({ config, heroImage, embedded }: HeroTwoColumnImageProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-white"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <div className="mx-auto grid min-h-[640px] max-w-6xl grid-cols-1 items-center gap-8 px-4 py-20 md:grid-cols-2 md:gap-12 md:py-28">
        <div>
          <HeroCopy config={config} align="left" motionDisabled={embedded} />
        </div>
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-xl md:aspect-[3/4]">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt="Hero"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  'linear-gradient(135deg, var(--bmb-site-primary) 0%, var(--bmb-site-accent) 100%)',
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
