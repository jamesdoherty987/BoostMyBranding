'use client';

import { motion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';
import { GalleryFocusCards, GalleryParallax, GalleryAppleCarousel, GalleryLayoutGrid, GalleryCompare, GalleryDirectionAware, Gallery3dMarquee } from './gallery';

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

  const variant = config.gallery?.variant ?? 'grid';

  return (
    <SectionWrapper immediate={embedded} id="gallery" className="bg-slate-50 py-14 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="gallery.eyebrow"
            value={config.gallery?.eyebrow ?? 'Gallery'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="gallery.heading"
              value={config.gallery?.heading ?? 'A look around.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        <div className="mt-12">
          {variant === 'focus-cards' ? (
            <GalleryFocusCards config={config} images={images} />
          ) : variant === 'parallax' ? (
            <GalleryParallax config={config} images={images} />
          ) : variant === 'apple-carousel' ? (
            <GalleryAppleCarousel config={config} images={images} />
          ) : variant === '3d-marquee' ? (
            <Gallery3dMarquee config={config} images={images} />
          ) : variant === 'layout-grid' ? (
            <GalleryLayoutGrid config={config} images={images} />
          ) : variant === 'compare' ? (
            <GalleryCompare config={config} images={images} />
          ) : variant === 'direction-aware' ? (
            <GalleryDirectionAware config={config} images={images} />
          ) : (
            <GalleryGrid
              config={config}
              embedded={embedded}
              businessName={businessName}
              resolved={resolved}
            />
          )}
        </div>
      </div>
    </SectionWrapper>
  );
}

/**
 * Default masonry grid — original gallery layout, kept as the fallback
 * for variants without dedicated renderers.
 */
function GalleryGrid({
  config,
  embedded,
  businessName,
  resolved,
}: {
  config: WebsiteConfig;
  embedded: boolean | undefined;
  businessName: string;
  resolved: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
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
              alt={`${businessName}, gallery image ${i + 1}`}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.04]"
              loading="lazy"
              onError={(e) => {
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
  );
}
