'use client';

import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';

interface SiteScheduleProps {
  config: WebsiteConfig;
}

const DEFAULT_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_LABELS: Record<string, string> = {
  Mo: 'Mon',
  Tu: 'Tue',
  We: 'Wed',
  Th: 'Thu',
  Fr: 'Fri',
  Sa: 'Sat',
  Su: 'Sun',
};

/**
 * Weekly schedule grid. Used by gyms (class timetable), clinics
 * (appointment hours), salons (staff rotations). Desktop: 7-day grid
 * with entries stacked per day column. Mobile: single scrollable column
 * grouping entries by day so customers don't have to squint at a tiny
 * grid on their phone.
 *
 * Entries are sorted by time within each day. Featured entries get a
 * brand-coloured border.
 */
export function SiteSchedule({ config }: SiteScheduleProps) {
  const { embedded } = useSiteContext();
  const s = config.schedule;
  if (!s || !s.entries || s.entries.length === 0) return null;

  const days =
    s.days && s.days.length > 0
      ? s.days.filter((d) => DEFAULT_DAYS.includes(d))
      : DEFAULT_DAYS;

  const byDay = new Map<string, typeof s.entries>();
  for (const d of days) byDay.set(d, []);
  for (const entry of s.entries) {
    if (byDay.has(entry.day)) byDay.get(entry.day)!.push(entry);
  }
  // Sort each day's entries by time (string compare works for zero-padded HH:MM,
  // and is acceptable for ad-hoc formats like "9:00" vs "18:30").
  for (const arr of byDay.values()) {
    arr.sort((a, b) => a.time.localeCompare(b.time));
  }

  return (
    <SectionWrapper immediate={embedded} id="schedule" className="bg-slate-50 py-14 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="schedule.eyebrow"
            value={s.eyebrow ?? 'Schedule'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="schedule.heading"
              value={s.heading ?? 'This week.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        {/* Desktop: 7 columns */}
        <div className="mt-10 hidden grid-cols-7 gap-3 md:grid">
          {days.map((d) => (
            <div key={d}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {DAY_LABELS[d] ?? d}
              </p>
              <div className="space-y-2">
                {(byDay.get(d) ?? []).length === 0 ? (
                  <p className="rounded-xl bg-white/60 px-2 py-3 text-center text-[10px] italic text-slate-400">
                    Closed
                  </p>
                ) : (
                  (byDay.get(d) ?? []).map((e, i) => <ScheduleCard key={i} entry={e} />)
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: day-by-day list */}
        <div className="mt-10 space-y-5 md:hidden">
          {days.map((d) => {
            const entries = byDay.get(d) ?? [];
            if (entries.length === 0) return null;
            return (
              <div key={d}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {DAY_LABELS[d] ?? d}
                </p>
                <div className="space-y-2">
                  {entries.map((e, i) => (
                    <ScheduleCard key={i} entry={e} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {s.footnote ? (
          <p className="mt-8 text-center text-xs italic text-slate-500">
            <InlineEditable
              path="schedule.footnote"
              value={s.footnote}
              as="span"
              placeholder="Optional note…"
            />
          </p>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function ScheduleCard({
  entry,
}: {
  entry: NonNullable<WebsiteConfig['schedule']>['entries'][number];
}) {
  return (
    <div
      className={`rounded-xl border bg-white px-3 py-2 ${
        entry.featured
          ? 'border-[color:var(--bmb-site-primary)] ring-1 ring-[color:var(--bmb-site-primary)]/30'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold tabular-nums text-slate-900">
          {entry.time}
        </span>
      </div>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{entry.title}</p>
      {entry.detail ? (
        <p className="text-[11px] text-slate-500">{entry.detail}</p>
      ) : null}
    </div>
  );
}
