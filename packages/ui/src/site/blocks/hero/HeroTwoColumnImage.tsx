'use client';

/**
 * Two-column hero: copy + CTAs on the left, hero photo on the right.
 * The cleanest "local business" hero layout — every plumber, cafe,
 * dentist, and salon site uses a variant of this. Works well with
 * standard portrait/landscape photos.
 *
 * Falls back to a soft brand gradient tile when no photo is available.
 * In edit mode, clicking the image slot opens the media picker so the
 * user can upload/swap the photo from the dashboard.
 */

import type { WebsiteConfig } from '@boost/core';
import { HeroCopy } from './HeroCopy';
import { InlineImage } from '../../InlineImage';
import { useSiteContext } from '../../context';

interface HeroTwoColumnImageProps {
  config: WebsiteConfig;
  heroImage?: string;
  embedded?: boolean;
}

export function HeroTwoColumnImage({ config, heroImage, embedded }: HeroTwoColumnImageProps) {
  const { editMode } = useSiteContext();
  const placeholder = (
    <div
      className="h-full w-full"
      style={{
        background:
          'linear-gradient(135deg, var(--bmb-site-primary) 0%, var(--bmb-site-accent) 100%)',
      }}
    />
  );

  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-white"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <div className="mx-auto grid min-h-[520px] max-w-6xl grid-cols-1 items-center gap-8 px-4 py-14 md:min-h-[640px] md:grid-cols-2 md:gap-12 md:py-20 lg:py-28">
        <div>
          <HeroCopy config={config} align="left" motionDisabled={embedded} />
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-xl md:aspect-[3/4]">
          {editMode ? (
            // Edit mode: InlineImage is always rendered, even when no
            // hero image is set, so there's a clickable target for upload.
            <InlineImage
              src={heroImage}
              alt="Hero"
              className="h-full w-full object-cover"
              path="hero"
              fieldName="imageIndex"
              placeholder={placeholder}
            />
          ) : heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt="Hero"
              className="h-full w-full object-cover"
            />
          ) : (
            placeholder
          )}
        </div>
      </div>
    </section>
  );
}
