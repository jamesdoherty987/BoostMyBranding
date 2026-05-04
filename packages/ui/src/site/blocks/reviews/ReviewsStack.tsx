'use client';

/**
 * Card-stack reviews. Uses Aceternity's CardStack primitive — a stack
 * of testimonial cards that animates, cycling through reviews. Playful
 * and compact.
 */

import type { WebsiteConfig } from '@boost/core';
import { CardStack } from '../../../aceternity/ui/card-stack';

interface ReviewsStackProps {
  config: WebsiteConfig;
}

export function ReviewsStack({ config }: ReviewsStackProps) {
  const reviews = config.reviews ?? [];
  if (reviews.length === 0) return null;

  const items = reviews.slice(0, 6).map((r, i) => ({
    id: i,
    name: r.author,
    designation: `${Math.round(r.rating ?? 5)} ★`,
    content: <p className="text-sm">{r.text}</p>,
  }));

  return (
    <div className="flex h-80 w-full items-center justify-center">
      <CardStack items={items} />
    </div>
  );
}
