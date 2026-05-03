'use client';

import { MapPin } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';

interface SiteServiceAreasProps {
  config: WebsiteConfig;
}

/**
 * Service areas chip grid. Used by mobile/call-out businesses (plumbers,
 * electricians, cleaners, mobile groomers). Lists the towns or regions
 * the business covers, with an optional note about call-out fee or
 * travel radius. Helps with local SEO — each town name can be picked
 * up by search engines as a service-location signal.
 */
export function SiteServiceAreas({ config }: SiteServiceAreasProps) {
  const { embedded } = useSiteContext();
  const sa = config.serviceAreas;
  if (!sa || !sa.areas || sa.areas.length === 0) return null;

  return (
    <SectionWrapper immediate={embedded} id="areas" className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <div className="text-center">
          <InlineEditable
            path="serviceAreas.eyebrow"
            value={sa.eyebrow ?? 'Where we work'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            <InlineEditable
              path="serviceAreas.heading"
              value={sa.heading ?? 'Serving these areas.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {sa.areas.map((area, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              <MapPin className="h-3 w-3 opacity-70" aria-hidden />
              <InlineEditable
                path={`serviceAreas.areas.${i}`}
                value={area}
                as="span"
                placeholder="Town or region…"
                maxLength={60}
              />
            </span>
          ))}
        </div>

        {sa.footnote ? (
          <p className="mt-6 text-center text-xs italic text-slate-500">
            <InlineEditable
              path="serviceAreas.footnote"
              value={sa.footnote}
              as="span"
              placeholder="Optional note (e.g. 'Free quote, no call-out fee within 20km.')"
            />
          </p>
        ) : null}
      </div>
    </SectionWrapper>
  );
}
