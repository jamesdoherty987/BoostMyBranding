'use client';

import { motion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { resolveIcon } from '../icon-map';
import { InlineEditable } from '../InlineEditable';

interface SiteServicesProps {
  config: WebsiteConfig;
}

/**
 * Bento-feel services grid. First card spans two columns on large screens for
 * visual rhythm. Every card gets a brand-tinted icon chip and staggers its
 * reveal so the section doesn't pop in as one block.
 */
export function SiteServices({ config }: SiteServicesProps) {
  const { embedded } = useSiteContext();
  const services = config.services;
  if (!services || services.length === 0) return null;

  return (
    <SectionWrapper immediate={embedded} id="services" className="bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="servicesSection.eyebrow"
            value={config.servicesSection?.eyebrow ?? 'What we do'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="servicesSection.heading"
              value={config.servicesSection?.heading ?? 'Every job, done properly.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
          <p className="mt-4 text-base text-slate-600 md:text-lg">
            <InlineEditable
              path="servicesSection.tagline"
              value={config.servicesSection?.tagline ?? config.brand.tagline}
              as="span"
              multiline
              placeholder="Short tagline for this section…"
            />
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {services.map((s, i) => {
            const Icon = resolveIcon(s.icon);
            const featured = i === 0 && services.length > 3;
            return (
              <motion.div
                key={`${s.title}-${i}`}
                initial={embedded ? false : { opacity: 0, y: 16 }}
                whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
                animate={embedded ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className={`group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${
                  featured ? 'lg:col-span-2 lg:row-span-1' : ''
                }`}
              >
                {/* Accent top bar */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: `linear-gradient(90deg, var(--bmb-site-primary), var(--bmb-site-accent))` }}
                />
                <div
                  aria-hidden
                  className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-80"
                  style={{ background: `rgba(var(--bmb-site-accent-rgb), 0.35)` }}
                />
                <div
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow"
                  style={{ background: 'var(--bmb-site-primary)' }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  <InlineEditable
                    path={`services.${i}.title`}
                    value={s.title}
                    as="span"
                    placeholder="Service title"
                  />
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  <InlineEditable
                    path={`services.${i}.description`}
                    value={s.description}
                    as="span"
                    multiline
                    placeholder="One or two sentences…"
                  />
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}
