'use client';

import type { WebsiteConfig } from '@boost/core';
import { AnimatedCounter } from '../../animated-counter';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';

interface SiteStatsProps {
  config: WebsiteConfig;
}

export function SiteStats({ config }: SiteStatsProps) {
  const { embedded } = useSiteContext();
  const stats = config.stats;
  if (!stats || stats.length === 0) return null;

  return (
    <SectionWrapper immediate={embedded} className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div
          className="rounded-3xl px-6 py-10 text-white shadow-xl md:px-12 md:py-14"
          style={{ background: brandGradient(config.brand, 120) }}
        >
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-4xl font-bold md:text-5xl">
                  <AnimatedCounter
                    value={s.value}
                    prefix={s.prefix}
                    suffix={s.suffix}
                  />
                </div>
                <div className="mt-2 text-sm text-white/80">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
