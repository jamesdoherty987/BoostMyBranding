'use client';

/**
 * Animated testimonials carousel. Uses Aceternity's AnimatedTestimonials
 * primitive — one review at a time, with an avatar, auto-play, and
 * fade transitions between quotes. Works best with 2-5 reviews that
 * each have a client image (falls back to a neutral placeholder avatar
 * when the author has no photo).
 */

import type { WebsiteConfig } from '@boost/core';
import { AnimatedTestimonials } from '../../../aceternity/ui/animated-testimonials';

interface ReviewsCarouselProps {
  config: WebsiteConfig;
  /** Gallery of client images — used as review avatars when none is given. */
  images?: string[];
}

// A 1x1 transparent pixel. Used when a review has no avatar so the
// primitive has a valid src string and doesn't crash. The surrounding
// UI treats it as a neutral placeholder.
const BLANK_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e2e8f0"/><circle cx="50" cy="40" r="16" fill="#94a3b8"/><ellipse cx="50" cy="78" rx="24" ry="14" fill="#94a3b8"/></svg>`,
  );

export function ReviewsCarousel({ config, images = [] }: ReviewsCarouselProps) {
  const reviews = config.reviews ?? [];
  if (reviews.length === 0) return null;

  // Map our internal Review shape to the primitive's input. Pull avatars
  // from the client's gallery in order; when there aren't enough photos
  // we fall back to the neutral placeholder so the primitive never
  // receives an undefined src.
  const testimonials = reviews.map((r, i) => ({
    quote: r.text,
    name: r.author,
    designation: `${Math.round(r.rating ?? 5)} ★`,
    src: images[i % Math.max(1, images.length)] ?? BLANK_AVATAR,
  }));

  return <AnimatedTestimonials testimonials={testimonials} autoplay />;
}
