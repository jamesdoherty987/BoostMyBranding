'use client';

import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { resolveIcon } from '../icon-map';
import { InlineEditable } from '../InlineEditable';

interface SiteTrustBadgesProps {
  config: WebsiteConfig;
}

/**
 * Trust / credentials strip. Used by trades (RGI, Safe Electric,
 * insurance), medical/dental (GMC, Dental Council), legal (Law Society).
 * Each badge is a compact card with an icon, short label, and optional
 * longer detail. When `href` is set, the badge becomes a link — useful
 * for pointing to the official register so potential customers can
 * verify the claim themselves.
 */
export function SiteTrustBadges({ config }: SiteTrustBadgesProps) {
  const { embedded } = useSiteContext();
  const tb = config.trustBadges;
  if (!tb || !tb.badges || tb.badges.length === 0) return null;

  return (
    <SectionWrapper immediate={embedded} className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        {tb.heading || tb.eyebrow ? (
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <InlineEditable
              path="trustBadges.eyebrow"
              value={tb.eyebrow ?? 'Credentials'}
              as="p"
              className="text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ color: 'var(--bmb-site-primary)' }}
              placeholder="Section eyebrow…"
            />
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              <InlineEditable
                path="trustBadges.heading"
                value={tb.heading ?? 'Qualified and insured.'}
                as="span"
                placeholder="Section heading…"
              />
            </h2>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tb.badges.map((b, i) => {
            const Icon = b.icon ? resolveIcon(b.icon) : null;
            const body = (
              <>
                {Icon ? (
                  <div
                    className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl text-white"
                    style={{ background: 'var(--bmb-site-primary)' }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                ) : null}
                <p className="text-sm font-semibold text-slate-900">
                  <InlineEditable
                    path={`trustBadges.badges.${i}.label`}
                    value={b.label}
                    as="span"
                    placeholder="Badge label…"
                  />
                </p>
                {b.detail ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    <InlineEditable
                      path={`trustBadges.badges.${i}.detail`}
                      value={b.detail}
                      as="span"
                      placeholder="Optional detail…"
                    />
                  </p>
                ) : null}
              </>
            );
            const className =
              'rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-slate-300 hover:bg-white';
            return b.href ? (
              <a
                key={i}
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${className} block`}
              >
                {body}
              </a>
            ) : (
              <div key={i} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}
