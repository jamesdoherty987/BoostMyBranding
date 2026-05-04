'use client';

/**
 * Focus-cards gallery. Uses Aceternity's FocusCards — the hovered card
 * stays bright while the others dim, so visitors can "spotlight" one
 * image at a time. Works best with 3-9 photos.
 */

import type { WebsiteConfig } from '@boost/core';
import { FocusCards } from '../../../aceternity/ui/focus-cards';

interface GalleryFocusCardsProps {
  config: WebsiteConfig;
  images: string[];
}

export function GalleryFocusCards({ config, images }: GalleryFocusCardsProps) {
  // Reuse the same index-resolution as the default grid so the Images
  // editor's selection carries over to this variant.
  const indices = config.gallery?.imageIndices?.length
    ? config.gallery.imageIndices
    : images.map((_, i) => i).slice(0, 9);

  const titles = config.gallery?.titles ?? [];

  const cards = indices
    .map((idx, i) => {
      const src = images[idx];
      if (!src) return null;
      return { title: titles[i] ?? '', src };
    })
    .filter((c): c is { title: string; src: string } => c != null);

  if (cards.length === 0) return null;
  return <FocusCards cards={cards} />;
}
