'use client';

import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';

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

        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-14">
          {ls.logos.map((logo, i) => {
            const src =
              logo.imageUrl ??
              (typeof logo.imageIndex === 'number' ? images[logo.imageIndex] : undefined);
            const body = src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={logo.name}
                loading="lazy"
                className="h-8 w-auto max-w-[140px] object-contain opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0 md:h-10"
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
                className="block"
              >
                {body}
              </a>
            ) : (
              <div key={i} aria-label={logo.name}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}
