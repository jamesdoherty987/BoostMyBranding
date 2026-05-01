'use client';

import { motion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';

interface SiteGalleryProps {
  config: WebsiteConfig;
  images: string[];
  businessName: string;
}

/**
 * Masonry-feel gallery. Skips rendering entirely when there are no images and
 * no configured `imageIndices`, so we don't show a wall of gradient tiles on
 * a just-spun-up site. When images DO exist, any indices past the end of the
 * array are silently dropped.
 */
export function SiteGallery({ config, images, businessName }: SiteGalleryProps) {
  const { embedded } = useSiteContext();
  const indices = config.gallery?.imageIndices?.length
    ? config.gallery.imageIndices
    : images.length > 0
      ? images.map((_, i) => i).slice(0, 6)
      : [];

  const resolved = indices
    .map((i) => images[i])
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  // Don't bother mounting the section at all if we have zero images. A real
  // site with no photos shouldn't pretend to have a gallery.
  if (resolved.length === 0) return null;

  return (
    <SectionWrapper immediate={embedded} id="gallery" className="bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
          >
            Gallery
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {config.gallery?.heading ?? 'A look around.'}
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {resolved.map((src, i) => {
            const isTall = i % 5 === 0;
            return (
              <motion.div
                key={`${src}-${i}`}
                initial={embedded ? false : { opacity: 0, y: 14 }}
                whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
                animate={embedded ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: (i % 6) * 0.04, duration: 0.5 }}
                className={`relative overflow-hidden rounded-2xl bg-slate-100 ${
                  isTall ? 'row-span-2 aspect-[3/5]' : 'aspect-square'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${businessName} — gallery image ${i + 1}`}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.04]"
                  loading="lazy"
                  onError={(e) => {
                    // Replace broken images with a brand-gradient fallback so
                    // one 404 doesn't leave a blown-out white tile.
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.style.background = brandGradient(config.brand, (i * 45) % 360);
                    }
                  }}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}
