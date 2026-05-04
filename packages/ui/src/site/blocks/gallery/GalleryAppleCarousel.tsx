'use client';

/**
 * Apple-style cards carousel. Horizontal swipeable cards — tap a card
 * to expand it fullscreen with more detail. Great for portfolio pieces
 * and case studies where each item has a story worth expanding.
 */

import type { ReactElement } from 'react';
import type { WebsiteConfig } from '@boost/core';
import {
  Carousel,
  Card as AppleCard,
} from '../../../aceternity/ui/apple-cards-carousel';

interface GalleryAppleCarouselProps {
  config: WebsiteConfig;
  images: string[];
}

export function GalleryAppleCarousel({ config, images }: GalleryAppleCarouselProps) {
  const indices = config.gallery?.imageIndices?.length
    ? config.gallery.imageIndices
    : images.map((_, i) => i).slice(0, 8);

  const titles = config.gallery?.titles ?? [];

  const cards = indices
    .map((idx, i) => {
      const src = images[idx];
      if (!src) return null;
      return (
        <AppleCard
          key={i}
          index={i}
          card={{
            src,
            title: titles[i] ?? '',
            category: '',
            content: (
              <div className="text-base">
                <p>Tap to explore — a look at our work.</p>
              </div>
            ),
          }}
        />
      );
    })
    .filter((c): c is ReactElement => c != null);

  if (cards.length === 0) return null;
  return <Carousel items={cards} />;
}
