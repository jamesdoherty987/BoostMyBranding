'use client';

/**
 * Text-reveal CTA. The CTA card shows one phrase; drag/hover over it
 * and a second phrase is revealed underneath. Playful and memorable —
 * great for small teams that want something with personality.
 *
 * Uses the CTA heading as the visible text and the CTA body as the
 * revealed text. Falls back gracefully when body is empty.
 */

import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../../section-wrapper';
import { useSiteContext } from '../../context';
import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from '../../../aceternity/ui/text-reveal-card';
import { InlineEditable } from '../../InlineEditable';

interface CtaTextRevealProps {
  config: WebsiteConfig;
}

export function CtaTextReveal({ config }: CtaTextRevealProps) {
  const { embedded, editMode } = useSiteContext();
  const cta = config.cta;
  if (!cta || !cta.heading) return null;

  return (
    <SectionWrapper
      immediate={embedded}
      className="bg-slate-950 py-16 md:py-24"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-center px-4">
        <TextRevealCard
          text={cta.heading}
          revealText={cta.body ?? cta.buttonLabel}
        >
          <TextRevealCardTitle>
            <InlineEditable
              path="cta.heading"
              value={cta.heading}
              as="span"
              placeholder="CTA heading…"
            />
          </TextRevealCardTitle>
          <TextRevealCardDescription>
            Hover over the card to reveal &mdash;{' '}
            <a
              href={cta.buttonHref}
              onClick={editMode ? (e) => e.preventDefault() : undefined}
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--bmb-site-primary)' }}
            >
              <InlineEditable
                path="cta.buttonLabel"
                value={cta.buttonLabel}
                as="span"
                placeholder="CTA button label…"
              />
            </a>
          </TextRevealCardDescription>
        </TextRevealCard>
      </div>
    </SectionWrapper>
  );
}
