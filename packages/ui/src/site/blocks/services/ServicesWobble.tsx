'use client';

/**
 * Wobble-card services. Each service renders inside an Aceternity
 * WobbleCard that tilts slightly on mouse movement. Playful and
 * engaging — great for cafes, salons, kids' services, creative brands.
 *
 * Inline editing: title + description stay editable through the usual
 * `services.N.*` paths since WobbleCard accepts arbitrary children.
 */

import type { WebsiteConfig } from '@boost/core';
import { WobbleCard } from '../../../aceternity/ui/wobble-card';
import { resolveIcon } from '../../icon-map';
import { InlineEditable } from '../../InlineEditable';

interface ServicesWobbleProps {
  config: WebsiteConfig;
}

export function ServicesWobble({ config }: ServicesWobbleProps) {
  const services = config.services ?? [];
  if (services.length === 0) return null;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
      {services.map((s, i) => {
        const Icon = resolveIcon(s.icon);
        const featured = s.featured ?? (i === 0 && services.length > 3);
        return (
          <WobbleCard
            key={`${s.title}-${i}`}
            containerClassName={
              featured ? 'md:col-span-2 bg-slate-900' : 'bg-slate-800'
            }
          >
            <div className="flex h-full flex-col">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ background: 'var(--bmb-site-primary)' }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                <InlineEditable
                  path={`services.${i}.title`}
                  value={s.title}
                  as="span"
                  placeholder="Service title"
                />
              </h3>
              <p className="mt-2 text-sm text-white/70">
                <InlineEditable
                  path={`services.${i}.description`}
                  value={s.description}
                  as="span"
                  multiline
                  placeholder="One or two sentences…"
                />
              </p>
            </div>
          </WobbleCard>
        );
      })}
    </div>
  );
}
