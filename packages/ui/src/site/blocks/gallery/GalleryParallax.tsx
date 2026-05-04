'use client';

/**
 * Parallax scroll gallery. Uses Aceternity's ParallaxScroll — three
 * columns of images that scroll at different speeds as the viewport
 * moves. Good for photo-heavy businesses (wedding photographers,
 * restaurants, real estate) where you want motion to emphasise volume.
 */

import type { WebsiteConfig } from '@boost/core';
import { ParallaxScroll } from '../../../aceternity/ui/parallax-scroll';

interface GalleryParallaxProps {
  config: WebsiteConfig;
  images: string[];
}

export function GalleryParallax({ config, images }: GalleryParallaxProps) {
  const indices = config.gallery?.imageIndices?.length
    ? config.gallery.imageIndices
    : images.map((_, i) => i);

  const urls = indices
    .map((i) => images[i])
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  if (urls.length === 0) return null;
  return <ParallaxScroll images={urls} />;
}
