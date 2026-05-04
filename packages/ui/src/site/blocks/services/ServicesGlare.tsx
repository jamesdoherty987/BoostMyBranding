'use client';

/**
 * Glare-card services. Cards have a subtle shine that follows the mouse
 * — feels premium and tactile. Good for luxury services, high-end
 * salons, boutique brands.
 */

import type { WebsiteConfig } from '@boost/core';
import { GlareCard } from '../../../aceternity/ui/glare-card';
import { resolveIcon } from '../../icon-map';
import { InlineEditable } from '../../InlineEditable';

interface ServicesGlareProps {
  config: WebsiteConfig;
}

export function ServicesGlare({ config }: ServicesGlareProps) {
  const services = config.services ?? [];
  if (services.length === 0) return null;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
      {services.map((s, i) => {
        const Icon = resolveIcon(s.icon);
        return (
          <GlareCard key={`${s.title}-${i}`}>
            <div className="flex h-full flex-col justify-between p-6 text-white">
              <div>
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: 'var(--bmb-site-primary)' }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">
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
            </div>
          </GlareCard>
        );
      })}
    </div>
  );
}
