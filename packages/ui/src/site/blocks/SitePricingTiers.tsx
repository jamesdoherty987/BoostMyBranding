'use client';

import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';

interface SitePricingTiersProps {
  config: WebsiteConfig;
}

/**
 * Pricing tiers / package cards. 2–4 cards side by side. One can be
 * highlighted with a brand accent and slight scale bump to act as the
 * recommended option.
 *
 * Different from the `priceList` block: priceList is a flat per-service
 * list (cut €25, beard €15), pricingTiers is grouped packages (Bronze
 * €39/mo, Silver €79/mo, Gold €129/mo).
 */
export function SitePricingTiers({ config }: SitePricingTiersProps) {
  const { embedded, editMode } = useSiteContext();
  const pt = config.pricingTiers;
  if (!pt || !pt.tiers || pt.tiers.length === 0) return null;

  const currency = pt.currency ?? '€';
  // Constrain to max 4 so the grid never gets awkward on desktop.
  const tiers = pt.tiers.slice(0, 4);

  return (
    <SectionWrapper
      immediate={embedded}
      id="pricing"
      className="bg-white py-14 md:py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="pricingTiers.eyebrow"
            value={pt.eyebrow ?? 'Pricing'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="pricingTiers.heading"
              value={pt.heading ?? 'Plans to fit your pace.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        <div
          className={`mt-12 grid grid-cols-1 gap-5 ${
            tiers.length === 2
              ? 'md:grid-cols-2'
              : tiers.length === 3
                ? 'md:grid-cols-3'
                : 'md:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {tiers.map((tier, i) => (
            <motion.article
              key={`${tier.name}-${i}`}
              initial={embedded ? false : { opacity: 0, y: 16 }}
              whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
              animate={embedded ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className={`relative rounded-3xl border p-6 transition-all md:p-8 ${
                tier.highlighted
                  ? 'border-transparent text-white shadow-2xl md:-my-2 md:scale-[1.02]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
              style={
                tier.highlighted
                  ? { background: brandGradient(config.brand, 140) }
                  : undefined
              }
            >
              {tier.highlighted ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-900 shadow">
                  Most popular
                </span>
              ) : null}

              <h3
                className={`text-lg font-semibold ${
                  tier.highlighted ? 'text-white' : 'text-slate-900'
                }`}
              >
                <InlineEditable
                  path={`pricingTiers.tiers.${i}.name`}
                  value={tier.name}
                  as="span"
                  placeholder="Tier name…"
                />
              </h3>

              {tier.description ? (
                <p
                  className={`mt-1 text-sm ${
                    tier.highlighted ? 'text-white/80' : 'text-slate-600'
                  }`}
                >
                  <InlineEditable
                    path={`pricingTiers.tiers.${i}.description`}
                    value={tier.description}
                    as="span"
                    placeholder="Short tagline…"
                  />
                </p>
              ) : null}

              {tier.price ? (
                <div className="mt-4 flex items-baseline gap-1">
                  <span
                    className={`text-3xl font-bold tabular-nums md:text-4xl ${
                      tier.highlighted ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {currency}
                    <InlineEditable
                      path={`pricingTiers.tiers.${i}.price`}
                      value={tier.price}
                      as="span"
                      placeholder="0"
                      maxLength={20}
                    />
                  </span>
                  {tier.period ? (
                    <span
                      className={`text-sm ${
                        tier.highlighted ? 'text-white/70' : 'text-slate-500'
                      }`}
                    >
                      <InlineEditable
                        path={`pricingTiers.tiers.${i}.period`}
                        value={tier.period}
                        as="span"
                        placeholder="/month"
                        maxLength={30}
                      />
                    </span>
                  ) : null}
                </div>
              ) : null}

              <ul className="mt-5 space-y-2.5">
                {(tier.features ?? []).map((feature, fi) => (
                  <li
                    key={fi}
                    className={`flex items-start gap-2 text-sm ${
                      tier.highlighted ? 'text-white/90' : 'text-slate-700'
                    }`}
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{
                        color: tier.highlighted ? '#fff' : 'var(--bmb-site-primary)',
                      }}
                    />
                    <InlineEditable
                      path={`pricingTiers.tiers.${i}.features.${fi}`}
                      value={feature}
                      as="span"
                      placeholder="Feature…"
                    />
                  </li>
                ))}
              </ul>

              {tier.ctaLabel ? (
                <a
                  href={tier.ctaHref || '#contact'}
                  onClick={editMode ? (e) => e.preventDefault() : undefined}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                    tier.highlighted
                      ? 'bg-white hover:bg-white/90'
                      : 'text-white hover:opacity-90'
                  }`}
                  style={
                    tier.highlighted
                      ? { color: 'var(--bmb-site-primary)' }
                      : { background: 'var(--bmb-site-primary)' }
                  }
                >
                  <InlineEditable
                    path={`pricingTiers.tiers.${i}.ctaLabel`}
                    value={tier.ctaLabel}
                    as="span"
                    placeholder="Choose plan"
                  />
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </motion.article>
          ))}
        </div>

        {pt.footnote ? (
          <p className="mt-8 text-center text-xs italic text-slate-500">
            <InlineEditable
              path="pricingTiers.footnote"
              value={pt.footnote}
              as="span"
              placeholder="Optional note…"
            />
          </p>
        ) : null}
      </div>
    </SectionWrapper>
  );
}
