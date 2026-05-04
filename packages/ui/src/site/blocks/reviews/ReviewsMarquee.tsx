'use client';

/**
 * Auto-scrolling reviews marquee. Uses Aceternity's InfiniteMovingCards
 * which duplicates the children and scrolls them horizontally in a loop
 * so there's no visible "reset". Pauses on hover so visitors can read.
 *
 * Honours the client's primary color on the card borders and stars.
 * Inline editing isn't practical here because the cards live inside a
 * motion container, but the Reviews content itself is still editable
 * through the Items tab in the dashboard.
 */

import type { WebsiteConfig } from '@boost/core';
import { InfiniteMovingCards } from '../../../aceternity/ui/infinite-moving-cards';

interface ReviewsMarqueeProps {
  config: WebsiteConfig;
}

export function ReviewsMarquee({ config }: ReviewsMarqueeProps) {
  const reviews = config.reviews ?? [];
  if (reviews.length === 0) return null;

  const items = reviews.map((r) => ({
    quote: r.text,
    name: r.author,
    title: `${Math.round(r.rating ?? 5)} ★`,
  }));

  const dark = config.brand.heroStyle === 'dark';

  return (
    <div
      className="relative flex w-full flex-col items-center justify-center overflow-hidden antialiased"
      style={{
        background: dark ? 'var(--bmb-site-dark)' : 'var(--bmb-site-bg)',
      }}
    >
      <InfiniteMovingCards items={items} direction="left" speed="slow" pauseOnHover />
    </div>
  );
}
