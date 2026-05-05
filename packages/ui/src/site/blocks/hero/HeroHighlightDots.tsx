'use client';

/**
 * Dot-grid highlight hero. Subtle dot-pattern background with a highlight
 * sweep behind the copy. Minimal, text-first, very readable — good for
 * consultants, law firms, accountants, anywhere the message should
 * dominate and motion should stay subtle.
 */

import type { WebsiteConfig } from '@boost/core';
import { HeroHighlight } from '../../../aceternity/ui/hero-highlight';
import { HeroCopy } from './HeroCopy';

interface HeroHighlightDotsProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroHighlightDots({ config, embedded }: HeroHighlightDotsProps) {
  return (
    <section
      id="home"
      className="relative isolate"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      <HeroHighlight
        containerClassName="flex min-h-[640px] items-center"
        className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-4 py-14 md:py-24 lg:py-32"
      >
        <HeroCopy
          config={config}
          dark
          align="center"
          motionDisabled={embedded}
        />
      </HeroHighlight>
    </section>
  );
}
