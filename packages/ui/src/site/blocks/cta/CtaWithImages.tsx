'use client';

/**
 * CTA with floating client avatars. Headline + buttons in the center,
 * with small circular client photos positioned around them so it feels
 * alive and personal. Good when the business has a strong community /
 * social proof angle (gyms, salons, cafes).
 *
 * Falls back to a neutral avatar placeholder when a slot has no image.
 */

import { ArrowRight } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../../section-wrapper';
import { useSiteContext } from '../../context';
import { brandGradient } from '../../theme';
import { InlineEditable } from '../../InlineEditable';

interface CtaWithImagesProps {
  config: WebsiteConfig;
  images: string[];
}

// 8 absolute positions around the CTA block, balanced on both sides.
const SPOTS = [
  { top: '10%', left: '4%', size: 56 },
  { top: '34%', left: '11%', size: 44 },
  { top: '62%', left: '5%', size: 52 },
  { top: '82%', left: '14%', size: 40 },
  { top: '12%', right: '6%', size: 48 },
  { top: '36%', right: '10%', size: 58 },
  { top: '64%', right: '4%', size: 44 },
  { top: '82%', right: '16%', size: 50 },
];

export function CtaWithImages({ config, images }: CtaWithImagesProps) {
  const { embedded, editMode } = useSiteContext();
  const cta = config.cta;
  if (!cta || !cta.heading) return null;

  // Use up to 8 client photos. Missing slots render a subtle brand chip
  // so the composition still feels balanced.
  const slots = SPOTS.map((spot, i) => ({ ...spot, src: images[i] }));

  return (
    <SectionWrapper immediate={embedded} className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <div
          className="relative overflow-hidden rounded-[2rem] px-8 py-14 text-white shadow-xl md:px-14 md:py-20"
          style={{ background: brandGradient(config.brand, 135) }}
        >
          {/* Floating avatars */}
          {slots.map((s, i) => (
            <div
              key={i}
              aria-hidden
              className="absolute rounded-full bg-white/20 ring-2 ring-white/40 overflow-hidden hidden sm:block"
              style={{
                top: s.top,
                left: 'left' in s ? s.left : undefined,
                right: 'right' in s ? s.right : undefined,
                width: s.size,
                height: s.size,
              }}
            >
              {s.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.src} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
          ))}

          {/* Centered copy */}
          <div className="relative z-10 mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
              <InlineEditable
                path="cta.heading"
                value={cta.heading}
                as="span"
                placeholder="CTA heading…"
              />
            </h2>
            {cta.body ? (
              <p className="mt-3 text-base text-white/90 md:text-lg">
                <InlineEditable
                  path="cta.body"
                  value={cta.body}
                  as="span"
                  multiline
                  placeholder="Supporting copy…"
                />
              </p>
            ) : null}
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={cta.buttonHref}
                onClick={editMode ? (e) => e.preventDefault() : undefined}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.03]"
                style={{ color: 'var(--bmb-site-primary)' }}
              >
                <InlineEditable
                  path="cta.buttonLabel"
                  value={cta.buttonLabel}
                  as="span"
                  placeholder="Primary label…"
                />
                <ArrowRight className="h-4 w-4" />
              </a>
              {cta.secondaryLabel && cta.secondaryHref ? (
                <a
                  href={cta.secondaryHref}
                  onClick={editMode ? (e) => e.preventDefault() : undefined}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/60 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/10"
                >
                  <InlineEditable
                    path="cta.secondaryLabel"
                    value={cta.secondaryLabel}
                    as="span"
                    placeholder="Secondary label…"
                  />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
