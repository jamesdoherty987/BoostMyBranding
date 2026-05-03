'use client';

import type { WebsiteConfig } from '@boost/core';
import { AnimatedCounter } from '../../animated-counter';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';

interface SiteStatsProps {
  config: WebsiteConfig;
}

/**
 * Proof strip — up to 4 big numbers in a brand-gradient card. When the
 * preview is in edit mode:
 *   - the optional section eyebrow/heading above the strip are editable
 *     (or appear when the user types into them for the first time)
 *   - each stat value shows a number input instead of the animated counter
 *     so it can be edited directly in place
 *   - each stat label, prefix, and suffix are inline-editable
 */
export function SiteStats({ config }: SiteStatsProps) {
  const { embedded, editMode, onFieldChange } = useSiteContext();
  const stats = config.stats;
  if (!stats || stats.length === 0) return null;

  const section = config.statsSection;
  const showHeading = Boolean(section?.eyebrow || section?.heading) || editMode;

  return (
    <SectionWrapper immediate={embedded} className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        {showHeading ? (
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <InlineEditable
              path="statsSection.eyebrow"
              value={section?.eyebrow ?? ''}
              as="p"
              className="text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ color: 'var(--bmb-site-primary)' }}
              placeholder="Optional eyebrow…"
            />
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              <InlineEditable
                path="statsSection.heading"
                value={section?.heading ?? ''}
                as="span"
                placeholder="Optional section heading…"
              />
            </h2>
          </div>
        ) : null}

        <div
          className="rounded-3xl px-6 py-10 text-white shadow-xl md:px-12 md:py-14"
          style={{ background: brandGradient(config.brand, 120) }}
        >
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-4xl font-bold md:text-5xl">
                  {editMode ? (
                    <StatValueEditor
                      index={i}
                      value={s.value}
                      prefix={s.prefix}
                      suffix={s.suffix}
                      onFieldChange={onFieldChange}
                    />
                  ) : (
                    <AnimatedCounter
                      value={s.value}
                      prefix={s.prefix}
                      suffix={s.suffix}
                    />
                  )}
                </div>
                <div className="mt-2 text-sm text-white/80">
                  <InlineEditable
                    path={`stats.${i}.label`}
                    value={s.label}
                    as="span"
                    placeholder="Label…"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

/**
 * Edit-mode stat value. Renders the value as a text input so agencies can
 * type a new number directly on the preview. Prefix and suffix sit on
 * either side as their own inline-editable spans. We commit the numeric
 * value on blur (or Enter) with basic validation — a non-numeric entry
 * falls back to the previous value rather than writing `NaN`.
 */
function StatValueEditor({
  index,
  value,
  prefix,
  suffix,
  onFieldChange,
}: {
  index: number;
  value: number;
  prefix?: string;
  suffix?: string;
  onFieldChange?: (path: string, value: unknown) => void;
}) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      {/* Prefix (e.g. "$", "€") */}
      <InlineEditable
        path={`stats.${index}.prefix`}
        value={prefix ?? ''}
        as="span"
        placeholder=""
        maxLength={4}
      />

      {/* Numeric value editor */}
      <input
        type="number"
        step="any"
        defaultValue={value}
        aria-label={`Stat ${index + 1} value`}
        className="inline-block w-24 rounded-md bg-white/10 px-2 py-1 text-inherit outline-none outline-2 outline-offset-2 outline-transparent transition-all [appearance:textfield] focus:bg-white/20 focus:outline-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onBlur={(e) => {
          const raw = e.currentTarget.value.trim();
          if (raw === '') return;
          const n = Number(raw);
          if (!Number.isFinite(n)) {
            e.currentTarget.value = String(value);
            return;
          }
          if (n === value) return;
          onFieldChange?.(`stats.${index}.value`, n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            (e.target as HTMLInputElement).value = String(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />

      {/* Suffix (e.g. "+", "%", " yrs", "★") */}
      <InlineEditable
        path={`stats.${index}.suffix`}
        value={suffix ?? ''}
        as="span"
        placeholder=""
        maxLength={6}
      />
    </span>
  );
}
