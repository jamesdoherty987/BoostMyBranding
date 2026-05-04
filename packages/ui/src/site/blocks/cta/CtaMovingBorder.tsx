'use client';

/**
 * CTA with an animated moving-border button. A dramatic "glowing
 * border" traces the CTA button continuously — great for attention
 * without resorting to bright colors. Works well as a final
 * conversion push on service business sites.
 */

import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../../section-wrapper';
import { useSiteContext } from '../../context';
import { brandGradient } from '../../theme';
import { InlineEditable } from '../../InlineEditable';
import { Button as MovingBorderButton } from '../../../aceternity/ui/moving-border';

interface CtaMovingBorderProps {
  config: WebsiteConfig;
}

export function CtaMovingBorder({ config }: CtaMovingBorderProps) {
  const { embedded, editMode } = useSiteContext();
  const cta = config.cta;
  if (!cta || !cta.heading) return null;

  return (
    <SectionWrapper immediate={embedded} className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2
          className="text-3xl font-bold tracking-tight md:text-5xl"
          style={{
            background: brandGradient(config.brand, 90),
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          <InlineEditable
            path="cta.heading"
            value={cta.heading}
            as="span"
            placeholder="CTA heading…"
          />
        </h2>
        {cta.body ? (
          <p className="mt-4 text-base text-slate-600 md:text-lg">
            <InlineEditable
              path="cta.body"
              value={cta.body}
              as="span"
              multiline
              placeholder="Supporting copy…"
            />
          </p>
        ) : null}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <MovingBorderButton
            borderRadius="1.75rem"
            className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white"
            containerClassName="h-14 w-52"
            as="a"
            href={editMode ? undefined : cta.buttonHref}
          >
            <InlineEditable
              path="cta.buttonLabel"
              value={cta.buttonLabel}
              as="span"
              placeholder="Primary label…"
            />
          </MovingBorderButton>
          {cta.secondaryLabel && cta.secondaryHref ? (
            <a
              href={cta.secondaryHref}
              onClick={editMode ? (e) => e.preventDefault() : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
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
    </SectionWrapper>
  );
}
