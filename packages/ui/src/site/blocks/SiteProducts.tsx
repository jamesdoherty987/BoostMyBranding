'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';

interface SiteProductsProps {
  config: WebsiteConfig;
  images: string[];
}

/**
 * Small-retail product grid. Each product: image, name, short description,
 * price, optional "Order" / "Buy" link. Supports category tabs for
 * shops with a few logical groupings ("Cakes", "Bread", "Pastries").
 *
 * Featured products span two columns on desktop and get a brand-tint
 * border — good for highlighting bestsellers or seasonal items.
 */
export function SiteProducts({ config, images }: SiteProductsProps) {
  const { embedded, editMode } = useSiteContext();
  const p = config.products;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  if (!p || !p.items || p.items.length === 0) return null;

  const currency = p.currency ?? '€';
  const categories = p.categories ?? [];
  const hasCategories = categories.length > 1;

  const visible = hasCategories && activeCategory
    ? p.items.filter((i) => i.category === activeCategory)
    : p.items;

  return (
    <SectionWrapper
      immediate={embedded}
      id="products"
      className="bg-white py-14 md:py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="products.eyebrow"
            value={p.eyebrow ?? 'Shop'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="products.heading"
              value={p.heading ?? 'The shop.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        {hasCategories ? (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <CategoryChip
              active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
              label="All"
            />
            {categories.map((cat) => (
              <CategoryChip
                key={cat}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                label={cat}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item, i) => {
            const realIndex = p.items.indexOf(item);
            const src =
              item.imageUrl ??
              (typeof item.imageIndex === 'number' ? images[item.imageIndex] : undefined);
            return (
              <motion.article
                key={`${item.name}-${i}`}
                initial={embedded ? false : { opacity: 0, y: 16 }}
                whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
                animate={embedded ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.04, duration: 0.5 }}
                className={`group overflow-hidden rounded-3xl border bg-white transition-all hover:-translate-y-1 hover:shadow-xl ${
                  item.featured
                    ? 'border-[color:var(--bmb-site-primary)] sm:col-span-2'
                    : 'border-slate-200'
                }`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ background: brandGradient(config.brand, 120) }}
                      aria-hidden
                    />
                  )}
                  {item.badge ? (
                    <span
                      className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur"
                      style={{ color: 'var(--bmb-site-primary)' }}
                    >
                      <InlineEditable
                        path={`products.items.${realIndex}.badge`}
                        value={item.badge}
                        as="span"
                        placeholder="New"
                        maxLength={30}
                      />
                    </span>
                  ) : null}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-900">
                      <InlineEditable
                        path={`products.items.${realIndex}.name`}
                        value={item.name}
                        as="span"
                        placeholder="Product name…"
                      />
                    </h3>
                    {item.price ? (
                      <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                        {currency}
                        <InlineEditable
                          path={`products.items.${realIndex}.price`}
                          value={item.price}
                          as="span"
                          placeholder="0"
                          maxLength={20}
                        />
                      </span>
                    ) : null}
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-sm text-slate-600">
                      <InlineEditable
                        path={`products.items.${realIndex}.description`}
                        value={item.description}
                        as="span"
                        multiline
                        placeholder="Short description…"
                      />
                    </p>
                  ) : null}
                  {item.href || editMode ? (
                    <a
                      href={item.href || '#'}
                      onClick={editMode ? (e) => e.preventDefault() : undefined}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                      style={{ color: 'var(--bmb-site-primary)' }}
                    >
                      <InlineEditable
                        path={`products.items.${realIndex}.ctaLabel`}
                        value={item.ctaLabel ?? 'Order'}
                        as="span"
                        placeholder="Order"
                        maxLength={30}
                      />
                      <ArrowRight className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </motion.article>
            );
          })}
        </div>

        {p.footnote ? (
          <p className="mt-8 text-center text-xs italic text-slate-500">
            <InlineEditable
              path="products.footnote"
              value={p.footnote}
              as="span"
              placeholder="Optional note…"
            />
          </p>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
      style={active ? { background: 'var(--bmb-site-primary)' } : undefined}
    >
      {label}
    </button>
  );
}
