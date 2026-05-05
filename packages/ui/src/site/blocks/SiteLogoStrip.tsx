'use client';

import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';
import { InlineImage } from '../InlineImage';

interface SiteLogoStripProps {
  config: WebsiteConfig;
  images: string[];
}

/**
 * Horizontal logo strip — "as featured in" press, partner logos,
 * certification bodies. Grayscale by default, colour on hover so it
 * reads as subtle social proof rather than a noisy visual block.
 *
 * Each logo becomes a link when `href` is set. Broken images fall back
 * to a text chip showing the name so a missing asset doesn't leave a
 * blown-out white box.
 */
export function SiteLogoStrip({ config, images }: SiteLogoStripProps) {
  const { embedded } = useSiteContext();
  const ls = config.logoStrip;
  if (!ls || !ls.logos || ls.logos.length === 0) return null;

  const variant = ls.variant ?? 'grid';

  // Shared logo renderer — used by both the grid and marquee layouts so
  // they stay visually consistent (same grayscale + hover treatment).
  const renderLogo = (logo: typeof ls.logos[number], i: number) => {
    const src =
      logo.imageUrl ??
      (typeof logo.imageIndex === 'number' ? images[logo.imageIndex] : undefined);
    const body = src ? (
      // InlineImage gives the agency a click target to swap the logo in
      // edit mode. Public render returns a plain `<img>`.
      <InlineImage
        src={src}
        alt={logo.name}
        className="h-8 w-auto max-w-[140px] object-contain opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0 md:h-10"
        path={`logoStrip.logos.${i}`}
        fieldName="imageIndex"
      />
    ) : (
      <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        {logo.name}
      </span>
    );
    return logo.href ? (
      <a
        key={i}
        href={logo.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={logo.name}
        className="block shrink-0"
      >
        {body}
      </a>
    ) : (
      <div key={i} aria-label={logo.name} className="shrink-0">
        {body}
      </div>
    );
  };

  return (
    <SectionWrapper immediate={embedded} className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        {ls.eyebrow || ls.heading ? (
          <div className="mb-8 text-center">
            {ls.eyebrow ? (
              <InlineEditable
                path="logoStrip.eyebrow"
                value={ls.eyebrow}
                as="p"
                className="text-xs font-semibold uppercase tracking-[0.25em]"
                style={{ color: 'var(--bmb-site-primary)' }}
                placeholder="Section eyebrow…"
              />
            ) : null}
            {ls.heading ? (
              <h3 className="mt-2 text-lg font-medium text-slate-600 md:text-xl">
                <InlineEditable
                  path="logoStrip.heading"
                  value={ls.heading}
                  as="span"
                  placeholder="Optional heading…"
                />
              </h3>
            ) : null}
          </div>
        ) : null}

        {variant === 'marquee' ? (
          // Continuous horizontal scroll. We duplicate the logos so the
          // looping animation has no visible seam. CSS-only (no JS per
          // frame) so it's cheap to run alongside the hero's motion.
          <div className="group relative overflow-hidden">
            {/* Fade masks at the edges so logos drift in/out smoothly */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent"
            />
            <div
              className="flex items-center gap-10 whitespace-nowrap md:gap-14"
              style={{
                // 30s loop by default; slower for longer logo lists so
                // every logo gets roughly the same time on screen.
                animation: `bmb-logo-marquee ${Math.max(20, ls.logos.length * 4)}s linear infinite`,
                animationPlayState: embedded ? 'paused' : 'running',
              }}
            >
              {ls.logos.map(renderLogo)}
              {/* Duplicated track for seamless loop */}
              {ls.logos.map((logo, i) =>
                renderLogo(logo, i + ls.logos.length),
              )}
            </div>
            <style>{`
              @keyframes bmb-logo-marquee {
                from { transform: translateX(0); }
                to   { transform: translateX(-50%); }
              }
              .group:hover [style*="bmb-logo-marquee"] { animation-play-state: paused; }
            `}</style>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-14">
            {ls.logos.map(renderLogo)}
          </div>
        )}
      </div>
    </SectionWrapper>
  );
}
