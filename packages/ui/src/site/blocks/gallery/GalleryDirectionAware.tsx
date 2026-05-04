'use client';

/**
 * Direction-aware hover gallery. Each image reveals an overlay sliding
 * in from the direction of the cursor as it enters the tile. Good for
 * portfolios where each piece has a title / short caption visitors
 * should see on hover.
 */

import type { WebsiteConfig } from '@boost/core';
import { DirectionAwareHover } from '../../../aceternity/ui/direction-aware-hover';

interface GalleryDirectionAwareProps {
  config: WebsiteConfig;
  images: string[];
}

export function GalleryDirectionAware({ config, images }: GalleryDirectionAwareProps) {
  const indices = config.gallery?.imageIndices?.length
    ? config.gallery.imageIndices
    : images.map((_, i) => i).slice(0, 6);

  const titles = config.gallery?.titles ?? [];

  const tiles = indices
    .map((idx, i) => ({
      src: images[idx],
      title: titles[i] ?? '',
    }))
    .filter((t): t is { src: string; title: string } => Boolean(t.src));

  if (tiles.length === 0) return null;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t, i) => (
        <DirectionAwareHover
          key={i}
          imageUrl={t.src}
          className="h-64 w-full md:h-80"
        >
          <p className="text-sm font-semibold text-white">{t.title}</p>
        </DirectionAwareHover>
      ))}
    </div>
  );
}
