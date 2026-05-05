'use client';

import type { WebsiteConfig, PriceListItem } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';

interface SitePriceListProps {
  config: WebsiteConfig;
}

/**
 * Flat price list. Used by barbers, salons, tradesmen — anywhere with
 * per-service pricing. Supports optional groupings (e.g. "Cuts" /
 * "Colour"). Each row: name + duration + price, with dotted leader
 * connecting them so it reads like a classic price card.
 */
export function SitePriceList({ config }: SitePriceListProps) {
  const { embedded } = useSiteContext();
  const pl = config.priceList;
  if (!pl) return null;
  const hasGroups = pl.groups && pl.groups.length > 0;
  const hasFlatItems = pl.items && pl.items.length > 0;
  if (!hasGroups && !hasFlatItems) return null;
  const currency = pl.currency ?? '€';

  return (
    <SectionWrapper immediate={embedded} id="prices" className="bg-slate-50 py-14 md:py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <InlineEditable
            path="priceList.eyebrow"
            value={pl.eyebrow ?? 'Pricing'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="priceList.heading"
              value={pl.heading ?? 'Simple, honest pricing.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        <div className="mt-10 space-y-8">
          {hasGroups
            ? pl.groups!.map((g, gi) => (
                <div key={gi}>
                  <h3 className="text-lg font-semibold text-slate-900">
                    <InlineEditable
                      path={`priceList.groups.${gi}.title`}
                      value={g.title}
                      as="span"
                      placeholder="Group title…"
                    />
                  </h3>
                  <PriceRows
                    items={g.items ?? []}
                    pathBase={`priceList.groups.${gi}.items`}
                    currency={currency}
                  />
                </div>
              ))
            : (
                <PriceRows
                  items={pl.items ?? []}
                  pathBase="priceList.items"
                  currency={currency}
                />
              )}
        </div>

        {pl.footnote ? (
          <p className="mt-8 text-center text-xs italic text-slate-500">
            <InlineEditable
              path="priceList.footnote"
              value={pl.footnote}
              as="span"
              placeholder="Optional note (e.g. 'Prices from. Final quote on booking.')"
            />
          </p>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function PriceRows({
  items,
  pathBase,
  currency,
}: {
  items: PriceListItem[];
  pathBase: string;
  currency: string;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className={`rounded-2xl border bg-white p-4 transition-colors ${
            item.featured
              ? 'border-[color:var(--bmb-site-primary)] bg-[color:var(--bmb-site-primary)]/5'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-baseline gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-slate-900">
                <InlineEditable
                  path={`${pathBase}.${i}.name`}
                  value={item.name}
                  as="span"
                  placeholder="Service name…"
                />
              </div>
              {item.duration || item.note ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  {item.duration ? (
                    <InlineEditable
                      path={`${pathBase}.${i}.duration`}
                      value={item.duration}
                      as="span"
                      placeholder="30 min"
                      maxLength={30}
                    />
                  ) : null}
                  {item.duration && item.note ? <span aria-hidden>·</span> : null}
                  {item.note ? (
                    <span className="italic">
                      <InlineEditable
                        path={`${pathBase}.${i}.note`}
                        value={item.note}
                        as="span"
                        placeholder="Note…"
                      />
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {item.price ? (
              <span className="shrink-0 text-base font-bold tabular-nums text-slate-900">
                {currency}
                <InlineEditable
                  path={`${pathBase}.${i}.price`}
                  value={item.price}
                  as="span"
                  placeholder="0"
                  maxLength={20}
                />
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
