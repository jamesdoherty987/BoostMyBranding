'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';
import { ReviewsMarquee, ReviewsCarousel, ReviewsStack, ReviewsDraggable } from './reviews';

interface SiteReviewsProps {
  config: WebsiteConfig;
  /** Optional client image gallery — the carousel variant uses these as avatars. */
  images?: string[];
}

/**
 * Testimonials section. Dispatches to one of several layouts based on
 * `reviewsSection.variant`. All layouts share the same eyebrow/heading
 * chrome above them so the section always looks consistent in context.
 *
 * Variants without custom renderers fall back to the default grid —
 * safer than rendering nothing when a variant string is unknown (could
 * happen after the schema widens or a stale AI response).
 */
export function SiteReviews({ config, images }: SiteReviewsProps) {
  const { embedded } = useSiteContext();
  const reviews = config.reviews;
  if (!reviews || reviews.length === 0) return null;

  const variant = config.reviewsSection?.variant ?? 'grid';

  return (
    <SectionWrapper immediate={embedded} id="reviews" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="reviewsSection.eyebrow"
            value={config.reviewsSection?.eyebrow ?? 'Reviews'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="reviewsSection.heading"
              value={config.reviewsSection?.heading ?? 'What customers say.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        <div className="mt-10">
          {variant === 'marquee' ? (
            <ReviewsMarquee config={config} />
          ) : variant === 'carousel' || variant === 'animated-testimonials' ? (
            <ReviewsCarousel config={config} images={images} />
          ) : variant === 'stack' ? (
            <ReviewsStack config={config} />
          ) : variant === 'draggable' ? (
            <ReviewsDraggable config={config} />
          ) : (
            <ReviewsGrid config={config} embedded={embedded} reviews={reviews} />
          )}
        </div>
      </div>
    </SectionWrapper>
  );
}

/**
 * The original card-grid layout — factored out so the dispatcher above
 * can switch between it and the new Aceternity variants cleanly.
 */
function ReviewsGrid({
  config,
  embedded,
  reviews,
}: {
  config: WebsiteConfig;
  embedded: boolean | undefined;
  reviews: NonNullable<WebsiteConfig['reviews']>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
      {reviews.slice(0, 6).map((r, i) => (
        <motion.figure
          key={i}
          initial={embedded ? false : { opacity: 0, y: 16 }}
          whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
          animate={embedded ? { opacity: 1, y: 0 } : undefined}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ delay: i * 0.05, duration: 0.5 }}
          className={`relative rounded-3xl border p-6 ${
            r.featured
              ? 'border-[color:var(--bmb-site-primary)] bg-white ring-1 ring-[color:var(--bmb-site-primary)]/30 md:col-span-2'
              : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-0.5" style={{ color: 'var(--bmb-site-pop)' }}>
            {Array.from({ length: Math.max(1, Math.min(5, Math.round(r.rating ?? 5))) }).map(
              (_, j) => (
                <Star key={j} className="h-4 w-4 fill-current" />
              ),
            )}
          </div>
          <blockquote className="mt-4 text-base text-slate-800">
            <span aria-hidden>&ldquo;</span>
            <InlineEditable
              path={`reviews.${i}.text`}
              value={r.text}
              as="span"
              multiline
              placeholder="Review text…"
            />
            <span aria-hidden>&rdquo;</span>
          </blockquote>
          <figcaption className="mt-4 text-sm font-semibold text-slate-500">
            <span aria-hidden>&mdash; </span>
            <InlineEditable
              path={`reviews.${i}.author`}
              value={r.author}
              as="span"
              placeholder="Author name…"
            />
          </figcaption>
        </motion.figure>
      ))}
    </div>
  );
}
