'use client';

/**
 * Services with CardSpotlight — dark cards with a mouse-following light
 * spotlight. Creates a premium, interactive feel. Good for modern
 * agencies, tech services, anything that wants a "focused on you" tone.
 */

import type { WebsiteConfig } from '@boost/core';
import { CardSpotlight } from '../../../aceternity/ui/card-spotlight';
import { resolveIcon } from '../../icon-map';
import { InlineEditable } from '../../InlineEditable';

interface ServicesSpotlightProps {
  config: WebsiteConfig;
}

export function ServicesSpotlight({ config }: ServicesSpotlightProps) {
  const services = config.services ?? [];
  if (services.length === 0) return null;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
      {services.map((s, i) => {
        const Icon = resolveIcon(s.icon);
        return (
          <CardSpotlight key={`${s.title}-${i}`} className="h-full min-h-[16rem]">
            <div className="relative z-20 flex h-full flex-col">
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
          </CardSpotlight>
        );
      })}
    </div>
  );
}
