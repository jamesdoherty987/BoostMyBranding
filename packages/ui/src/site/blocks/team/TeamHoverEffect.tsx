'use client';

/**
 * Team with card-hover-effect. Dark cards that get a soft glow moving
 * behind them as the mouse moves over the grid. Feels modern and
 * interactive — good for creative agencies, tech-adjacent teams.
 */

import type { WebsiteConfig } from '@boost/core';
import { HoverEffect } from '../../../aceternity/ui/card-hover-effect';

interface TeamHoverEffectProps {
  config: WebsiteConfig;
}

export function TeamHoverEffect({ config }: TeamHoverEffectProps) {
  const members = (config.team?.members ?? []).filter(
    (m): m is NonNullable<typeof m> => m != null,
  );
  if (members.length === 0) return null;

  const items = members.map((m) => ({
    title: m.name ?? 'Team member',
    description: m.role ?? '',
    // HoverEffect expects a link — we point at the contact section so
    // clicking a team card takes visitors to the booking form. Safe
    // fallback when there's no contact.
    link: '#contact',
  }));

  return <HoverEffect items={items} className="mx-auto max-w-5xl" />;
}
