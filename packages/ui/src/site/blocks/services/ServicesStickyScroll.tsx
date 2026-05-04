'use client';

/**
 * Services with sticky-scroll reveal. Uses Aceternity's StickyScroll
 * primitive: left column shows a list of titles + descriptions that
 * scrolls naturally, while the right column is sticky and swaps its
 * visual when the active title enters view.
 *
 * Good for:
 *   - Service businesses with a few detailed offerings
 *   - Anywhere you want a more narrative/scroll-through feel than a grid
 *
 * Each service becomes an entry in the primitive's `content` array; the
 * right-side panel uses a generated gradient based on the service index
 * so it always looks intentional even when the client has no matching
 * imagery. In future, a service could include an image URL and we'd
 * switch to that — shape is already prepared for it.
 */

import type { WebsiteConfig } from '@boost/core';
import { StickyScroll } from '../../../aceternity/ui/sticky-scroll-reveal';

interface ServicesStickyScrollProps {
  config: WebsiteConfig;
}

// Rotating gradients for the sticky panel so multi-service blocks don't
// all look identical. Uses CSS vars so the colors follow the client's
// brand palette automatically.
const GRADIENTS = [
  'linear-gradient(135deg, var(--bmb-site-primary), var(--bmb-site-accent))',
  'linear-gradient(135deg, var(--bmb-site-accent), var(--bmb-site-pop))',
  'linear-gradient(135deg, var(--bmb-site-primary), var(--bmb-site-pop))',
  'linear-gradient(135deg, var(--bmb-site-dark), var(--bmb-site-primary))',
];

export function ServicesStickyScroll({ config }: ServicesStickyScrollProps) {
  const services = config.services ?? [];
  if (services.length === 0) return null;

  const content = services.map((s, i) => ({
    title: s.title,
    description: s.description,
    content: (
      <div
        className="flex h-full w-full items-center justify-center rounded-xl text-center text-[15px] font-semibold text-white"
        style={{ background: GRADIENTS[i % GRADIENTS.length] }}
      >
        {s.title}
      </div>
    ),
  }));

  return <StickyScroll content={content} />;
}
