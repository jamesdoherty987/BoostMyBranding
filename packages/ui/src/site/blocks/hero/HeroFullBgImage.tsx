'use client';

/**
 * Full-bleed photo hero with overlay text. A large client photo fills
 * the entire section; headline + CTA sit over a dark overlay that's
 * dense enough to keep text readable regardless of the photo's
 * brightness. Works best with high-quality wide photos.
 *
 * Falls back to a brand gradient when no photo is available.
 *
 * Editable: in edit mode the photo layer is swapped for an
 * `InlineImage` so the agency can click to replace the hero photo.
 * Public render stays as a plain CSS `background-image` for zero-JS
 * rendering (and to avoid the image becoming a giant interactive
 * element over which clicks for CTAs would compete).
 */

import type { WebsiteConfig } from '@boost/core';
import { HeroCopy } from './HeroCopy';
import { InlineImage } from '../../InlineImage';
import { useSiteContext } from '../../context';

interface HeroFullBgImageProps {
  config: WebsiteConfig;
  heroImage?: string;
  embedded?: boolean;
}

export function HeroFullBgImage({ config, heroImage, embedded }: HeroFullBgImageProps) {
  const { editMode } = useSiteContext();

  return (
    <section
      id="home"
      className="relative isolate overflow-hidden"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      {/* Background image layer.
          Edit mode: InlineImage so it's click-to-swap, even when empty.
          Public: plain CSS backgroundImage for a clean, non-interactive layer. */}
      {editMode ? (
        <div aria-hidden className="absolute inset-0">
          <InlineImage
            src={heroImage}
            alt=""
            path="hero"
            fieldName="imageIndex"
            className="h-full w-full"
            placeholder={
              <div
                className="h-full w-full"
                style={{
                  background:
                    'linear-gradient(135deg, var(--bmb-site-primary) 0%, var(--bmb-site-accent) 100%)',
                }}
              />
            }
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: heroImage
              ? `url(${heroImage})`
              : 'linear-gradient(135deg, var(--bmb-site-primary) 0%, var(--bmb-site-accent) 100%)',
          }}
        />
      )}
      {/* Darkening overlay so copy stays readable. `pointer-events-none`
          so edit-mode clicks on empty hero space reach the InlineImage
          beneath instead of being swallowed by this layer. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[520px] max-w-5xl md:min-h-[640px] flex-col items-start justify-center px-4 py-14 md:py-24 lg:py-32">
        <HeroCopy config={config} dark align="left" motionDisabled={embedded} />
      </div>
    </section>
  );
}
