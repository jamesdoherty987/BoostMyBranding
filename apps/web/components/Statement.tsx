'use client';

import { TextReveal } from '@boost/ui';

/**
 * Big scroll-driven statement that transitions between major sections and
 * anchors the emotional message.
 */
export function Statement() {
  return (
    <section className="bg-slate-50 px-4 py-28 md:py-40">
      <div className="mx-auto max-w-5xl">
        <TextReveal>
          Most local brands have the story. Most of them just don&apos;t have the time to tell it. We tell it for you — every day, across every platform.
        </TextReveal>
      </div>
    </section>
  );
}
