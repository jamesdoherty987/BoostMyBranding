'use client';

import { motion } from 'framer-motion';
import { Leaf } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';

interface SiteMenuProps {
  config: WebsiteConfig;
}

/**
 * Food / drink menu with categorized items. Used by cafes, restaurants,
 * bars. Renders categories as sub-sections with their items in a dotted
 * "name ... price" layout, which is the single most recognisable menu
 * pattern across restaurant sites.
 *
 * Featured items get a brand-coloured border and sit at the top of
 * their category. Dietary tags (V, VG, GF) render as small chips.
 */
export function SiteMenu({ config }: SiteMenuProps) {
  const { embedded } = useSiteContext();
  const menu = config.menu;
  if (!menu || !menu.categories || menu.categories.length === 0) return null;

  const currency = menu.currency ?? '€';

  return (
    <SectionWrapper immediate={embedded} id="menu" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="menu.eyebrow"
            value={menu.eyebrow ?? 'The menu'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="menu.heading"
              value={menu.heading ?? 'Small menu, done well.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        <div className="mt-12 space-y-12">
          {menu.categories.map((cat, ci) => (
            <div key={ci}>
              <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-2">
                <h3 className="text-xl font-bold text-slate-900 md:text-2xl">
                  <InlineEditable
                    path={`menu.categories.${ci}.title`}
                    value={cat.title}
                    as="span"
                    placeholder="Category name…"
                  />
                </h3>
                {cat.description ? (
                  <p className="text-xs italic text-slate-500">
                    <InlineEditable
                      path={`menu.categories.${ci}.description`}
                      value={cat.description}
                      as="span"
                      placeholder="Category blurb…"
                    />
                  </p>
                ) : null}
              </div>

              <ul className="mt-5 space-y-4">
                {(cat.items ?? []).map((item, ii) => {
                  const featuredStyle = item.featured
                    ? {
                        borderLeft: '3px solid var(--bmb-site-primary)',
                        paddingLeft: '0.75rem',
                      }
                    : undefined;
                  return (
                    <motion.li
                      key={ii}
                      initial={embedded ? false : { opacity: 0, y: 8 }}
                      whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
                      animate={embedded ? { opacity: 1, y: 0 } : undefined}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ delay: ii * 0.03, duration: 0.4 }}
                      style={featuredStyle}
                    >
                      <div className="flex items-baseline gap-3">
                        <h4 className="text-base font-semibold text-slate-900">
                          <InlineEditable
                            path={`menu.categories.${ci}.items.${ii}.name`}
                            value={item.name}
                            as="span"
                            placeholder="Item name…"
                          />
                        </h4>
                        {/* Dotted leader — subtle, classic menu look */}
                        <span
                          aria-hidden
                          className="min-w-[1rem] flex-1 translate-y-[-2px] border-b border-dotted border-slate-300"
                        />
                        {item.price ? (
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                            {currency}
                            <InlineEditable
                              path={`menu.categories.${ci}.items.${ii}.price`}
                              value={item.price}
                              as="span"
                              placeholder="0.00"
                              maxLength={20}
                            />
                          </span>
                        ) : null}
                      </div>
                      {(item.description || item.tags?.length) ? (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {item.description ? (
                            <p className="text-sm text-slate-500">
                              <InlineEditable
                                path={`menu.categories.${ci}.items.${ii}.description`}
                                value={item.description}
                                as="span"
                                multiline
                                placeholder="Short item description…"
                              />
                            </p>
                          ) : null}
                          {item.tags?.map((tag, ti) => (
                            <span
                              key={ti}
                              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600"
                              title={tagTitle(tag)}
                            >
                              {isVegTag(tag) ? (
                                <Leaf className="h-2.5 w-2.5" aria-hidden />
                              ) : null}
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

function isVegTag(tag: string) {
  const t = tag.toUpperCase().trim();
  return t === 'V' || t === 'VG' || t === 'VEGAN' || t === 'VEGGIE';
}

function tagTitle(tag: string) {
  const t = tag.toUpperCase().trim();
  if (t === 'V') return 'Vegetarian';
  if (t === 'VG' || t === 'VEGAN') return 'Vegan';
  if (t === 'GF') return 'Gluten-free';
  if (t === 'DF') return 'Dairy-free';
  if (t === 'N') return 'Contains nuts';
  if (t === 'S') return 'Spicy';
  return tag;
}
