'use client';

/**
 * Before / after compare slider. Perfect for trades (renovators,
 * landscapers, cleaners, painters) where the "transformation" is the
 * selling point. Uses Aceternity's Compare primitive — drag the
 * handle left/right to wipe between two images.
 *
 * Expects the gallery to have at least 2 image indices. Uses the first
 * two as "before" and "after". If fewer than 2 images are available,
 * the block returns null so nothing broken renders.
 */

import type { WebsiteConfig } from '@boost/core';
import { Compare } from '../../../aceternity/ui/compare';

interface GalleryCompareProps {
  config: WebsiteConfig;
  images: string[];
}

export function GalleryCompare({ config, images }: GalleryCompareProps) {
  const indices = config.gallery?.imageIndices?.length
    ? config.gallery.imageIndices
    : images.map((_, i) => i).slice(0, 2);

  const first = images[indices[0] ?? 0];
  const second = images[indices[1] ?? 1];
  if (!first || !second) return null;

  return (
    <div className="mx-auto flex max-w-4xl items-center justify-center px-4">
      <Compare
        firstImage={first}
        secondImage={second}
        className="h-[300px] w-full md:h-[500px]"
        slideMode="hover"
      />
    </div>
  );
}
