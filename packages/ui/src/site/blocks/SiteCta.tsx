'use client';

import { ArrowRight } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';

interface SiteCtaProps {
  config: WebsiteConfig;
}

/**
 * Mid-page call-to-action strip. A focused "ready to book" / "get a
 * quote today" banner in brand gradient, placed between sections to
 * catch visitors before they scroll past. Optional second button for
 * "Call" or "WhatsApp" — typically one tap away from conversion.
 */
export function SiteCta({ config }: SiteCtaProps) {
  const { embedded, editMode } = useSiteContext();
  const cta = config.cta;
  if (!cta || !cta.heading) return null;

  return (
    <SectionWrapper immediate={embedded} className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div
          className="overflow-hidden rounded-[2rem] px-8 py-10 text-white shadow-xl md:px-14 md:py-12"
          style={{ background: brandGradient(config.brand, 120) }}
        >
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
                <InlineEditable
                  path="cta.heading"
                  value={cta.heading}
                  as="span"
                  placeholder="CTA heading…"
                />
              </h2>
              {cta.body ? (
                <p className="mt-2 text-base text-white/85 md:text-lg">
                  <InlineEditable
                    path="cta.body"
                    value={cta.body}
                    as="span"
                    multiline
                    placeholder="Supporting copy…"
                  />
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={cta.buttonHref}
                onClick={editMode ? (e) => e.preventDefault() : undefined}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.03]"
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
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/50 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
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
