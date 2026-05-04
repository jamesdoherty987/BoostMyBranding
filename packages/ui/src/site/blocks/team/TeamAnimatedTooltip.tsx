'use client';

/**
 * Overlapping avatar row with hover tooltips. Uses Aceternity's
 * AnimatedTooltip primitive. Good when you want to show a lot of team
 * members without taking up much vertical space — the row scales nicely
 * from 3 to ~12 members.
 *
 * When a member has no photo we inject a neutral placeholder SVG (same
 * one the reviews carousel uses) so the primitive never receives a
 * broken image URL.
 */

import type { WebsiteConfig } from '@boost/core';
import { AnimatedTooltip } from '../../../aceternity/ui/animated-tooltip';

interface TeamAnimatedTooltipProps {
  config: WebsiteConfig;
}

// Neutral avatar placeholder — matches the one used in ReviewsCarousel.
const BLANK_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e2e8f0"/><circle cx="50" cy="40" r="16" fill="#94a3b8"/><ellipse cx="50" cy="78" rx="24" ry="14" fill="#94a3b8"/></svg>`,
  );

export function TeamAnimatedTooltip({ config }: TeamAnimatedTooltipProps) {
  const members = (config.team?.members ?? []).filter(
    (m): m is NonNullable<typeof m> => m != null,
  );
  if (members.length === 0) return null;

  const items = members.map((m, i) => ({
    id: i,
    name: m.name ?? 'Team member',
    designation: m.role ?? '',
    image: m.photoUrl ?? BLANK_AVATAR,
  }));

  return (
    <div className="mt-12 flex w-full flex-row items-center justify-center">
      <AnimatedTooltip items={items} />
    </div>
  );
}
