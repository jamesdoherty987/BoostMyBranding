'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';

interface SiteReviewsProps {
  config: WebsiteConfig;
}

export function SiteReviews({ config }: SiteReviewsProps) {
  const { embedded } = useSiteContext();
  const reviews = config.reviews;
  if (!reviews || reviews.length === 0) return null;

  return (
    <SectionWrapper immediate={embedded} id="reviews" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
          >
            Reviews
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            What customers say.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {reviews.slice(0, 6).map((r, i) => (
            <motion.figure
              key={i}
              initial={embedded ? false : { opacity: 0, y: 16 }}
              whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
              animate={embedded ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
              className="relative rounded-3xl border border-slate-200 bg-slate-50 p-6"
            >
              <div className="flex items-center gap-0.5" style={{ color: 'var(--bmb-site-pop)' }}>
                {Array.from({ length: Math.max(1, Math.min(5, Math.round(r.rating ?? 5))) }).map(
                  (_, j) => (
                    <Star key={j} className="h-4 w-4 fill-current" />
                  ),
                )}
              </div>
              <blockquote className="mt-4 text-base text-slate-800">
                &ldquo;{r.text}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-slate-500">
                — {r.author}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
