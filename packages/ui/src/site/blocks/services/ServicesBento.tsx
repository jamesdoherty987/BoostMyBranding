'use client';

/**
 * Bento-style services grid using Aceternity's BentoGrid primitive.
 * Featured services span two columns; everything else takes one.
 *
 * Good for:
 *   - Agencies showcasing several specialties
 *   - Cafes listing menu categories
 *   - Service businesses with 4-6 offerings
 *
 * Inline editing: titles and descriptions stay editable through the same
 * InlineEditable paths (`services.N.title` / `services.N.description`)
 * so nothing about dashboard UX changes between variants.
 */

import type { WebsiteConfig } from '@boost/core';
import { BentoGrid, BentoGridItem } from '../../../aceternity/ui/bento-grid';
import { resolveIcon } from '../../icon-map';
import { InlineEditable } from '../../InlineEditable';

interface ServicesBentoProps {
  config: WebsiteConfig;
}

export function ServicesBento({ config }: ServicesBentoProps) {
  const services = config.services ?? [];
  if (services.length === 0) return null;

  return (
    <BentoGrid className="mx-auto max-w-6xl">
      {services.map((s, i) => {
        const Icon = resolveIcon(s.icon);
        const featured = s.featured ?? (i === 0 && services.length > 3);
        return (
          <BentoGridItem
            key={`${s.title}-${i}`}
            className={featured ? 'md:col-span-2' : ''}
            // Decorative header panel — soft gradient in brand colors.
            header={
              <div
                className="flex h-full min-h-[6rem] w-full rounded-xl"
                style={{
                  background:
                    'linear-gradient(135deg, var(--bmb-site-primary) 0%, var(--bmb-site-accent) 100%)',
                  opacity: 0.15,
                }}
              />
            }
            icon={<Icon className="h-4 w-4" style={{ color: 'var(--bmb-site-primary)' }} />}
            title={
              <InlineEditable
                path={`services.${i}.title`}
                value={s.title}
                as="span"
                placeholder="Service title"
              />
            }
            description={
              <InlineEditable
                path={`services.${i}.description`}
                value={s.description}
                as="span"
                multiline
                placeholder="One or two sentences…"
              />
            }
          />
        );
      })}
    </BentoGrid>
  );
}
