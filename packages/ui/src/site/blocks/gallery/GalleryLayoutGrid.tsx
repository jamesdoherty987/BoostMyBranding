'use client';

/**
 * Layout-grid gallery. Click an image and it expands to fill the grid
 * with a dark backdrop. Good for photographers, restaurants,
 * portfolios — anywhere details matter enough that people want a
 * closer look.
 */

import type { ReactElement } from 'react';
import type { WebsiteConfig } from '@boost/core';
import { LayoutGrid } from '../../../aceternity/ui/layout-grid';

interface GalleryLayoutGridProps {
  config: WebsiteConfig;
  images: string[];
}

type LayoutCard = {
  id: number;
  thumbnail: string;
  className: string;
  content: ReactElement;
};

export function GalleryLayoutGrid({ config, images }: GalleryLayoutGridProps) {
  const indices = config.gallery?.imageIndices?.length
    ? config.gallery.imageIndices
    : images.map((_, i) => i).slice(0, 4);

  const titles = config.gallery?.titles ?? [];

  // LayoutGrid expects exactly 4 cards with their own className for the
  // grid-area assignment. We pad/truncate to 4 and assign classNames in
  // a fixed layout (two-wide top, three-wide middle row, etc).
  const classNames = [
    'md:col-span-2',
    'col-span-1',
    'col-span-1',
    'md:col-span-2',
  ];

  const cards: LayoutCard[] = indices
    .slice(0, 4)
    .map((idx, i) => {
      const src = images[idx];
      if (!src) return null;
      return {
        id: i,
        thumbnail: src,
        className: classNames[i] ?? 'col-span-1',
        content: (
          <div>
            <p className="text-lg font-semibold text-white">
              {titles[i] ?? ''}
            </p>
          </div>
        ),
      };
    })
    .filter((c): c is LayoutCard => c != null);

  if (cards.length === 0) return null;
  return (
    <div className="h-[600px] w-full">
      <LayoutGrid cards={cards} />
    </div>
  );
}
