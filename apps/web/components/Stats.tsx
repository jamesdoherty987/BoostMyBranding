'use client';

import { NumberTicker, SectionWrapper } from '@boost/ui';

const stats = [
  { value: 20, suffix: '+', label: 'Local brands on BoostMyBranding' },
  { value: 600, suffix: '+', label: 'Posts published every month' },
  { value: 95, suffix: '%', label: 'Approval rate on first pass' },
  { value: 4, prefix: 'x', label: 'Average engagement lift' },
];

export function Stats() {
  return (
    <SectionWrapper className="relative py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-cta p-10 text-white md:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(80% 80% at 20% 20%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(60% 60% at 80% 100%, rgba(255,236,61,0.25), transparent 60%)',
            }}
          />
          <div className="relative grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-4xl font-bold md:text-5xl">
                  <NumberTicker value={s.value} suffix={s.suffix ?? ''} prefix={s.prefix ?? ''} />
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
