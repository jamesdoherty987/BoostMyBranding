'use client';

/**
 * 3D tilted image marquee. Images scroll diagonally in a perspective
 * grid — very bold, great for businesses with lots of photos that
 * want a "wall of work" statement (restaurants, event venues,
 * photographers).
 *
 * Works best with 12+ images so the grid feels full. If fewer are
 * available we duplicate the list so the animation still looks dense.
 */

import type { WebsiteConfig } from '@boost/core';
import { ThreeDMarquee } from '../../../aceternity/ui/3d-marquee';

interface Gallery3dMarqueeProps {
  config: WebsiteConfig;
  images: string[];
}

export function Gallery3dMarquee({ config, images }: Gallery3dMarqueeProps) {
  const indices = config.gallery?.imageIndices?.length
    ? config.gallery.imageIndices
    : images.map((_, i) => i);

  const urls = indices
    .map((i) => images[i])
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  if (urls.length === 0) return null;

  // Duplicate until we have at least 31 — 3dMarquee divides images into
  // 4 columns and wants plenty per column. Below the minimum it looks
  // sparse / broken.
  const padded = urls.length >= 31 ? urls : Array.from({ length: 31 }, (_, i) => urls[i % urls.length]!);

  return (
    <div className="mx-auto h-[600px] max-w-6xl overflow-hidden rounded-3xl">
      <ThreeDMarquee images={padded} />
    </div>
  );
}
