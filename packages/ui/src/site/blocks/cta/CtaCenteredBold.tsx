'use client';

/**
 * Big centered CTA with deep gradient background. Max visual impact —
 * designed to be placed near the footer as the final conversion pitch.
 * Works well for trades (Murphy's Plumbing style "Call us now"), gyms
 * ("Start your free trial"), and event venues.
 */

import { ArrowRight } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../../section-wrapper';
import { useSiteContext } from '../../context';
import { InlineEditable } from '../../InlineEditable';

interface CtaCenteredBoldProps {
  config: WebsiteConfig;
}

export function CtaCenteredBold({ config }: CtaCenteredBoldProps) {
  const { embedded, editMode } = useSiteContext();
  const cta = config.cta;
  if (!cta || !cta.heading) return null;

  return (
    <SectionWrapper immediate={embedded} className="bg-white py-0">
      <div
        className="relative overflow-hidden px-4 py-24 text-center md:py-36"
        style={{
          background: `linear-gradient(135deg, var(--bmb-site-dark) 0%, var(--bmb-site-primary) 100%)`,
        }}
      >
        {/* Soft orb for extra depth */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[60vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />

        <div className="relative z-10 mx-auto max-w-2xl text-white">
          <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            <InlineEditable
              path="cta.heading"
              value={cta.heading}
              as="span"
              placeholder="CTA heading…"
            />
          </h2>
          {cta.body ? (
            <p className="mt-4 text-base text-white/80 md:text-lg">
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
            <a
              href={cta.buttonHref}
              onClick={editMode ? (e) => e.preventDefault() : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold shadow-xl transition-transform hover:scale-[1.03]"
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
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-8 py-4 text-base font-semibold text-white backdrop-blur hover:bg-white/10"
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
    </SectionWrapper>
  );
}
