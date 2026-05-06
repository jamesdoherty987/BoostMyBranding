'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Particles } from '@boost/ui';

/**
 * Breathing-room statement section between the feature bento and the
 * how-it-works section. Word-by-word scroll-driven reveal on a dark
 * backdrop so the page has a clear visual pause between content blocks.
 *
 * Custom reveal rather than the shared TextReveal primitive, because the
 * shared one hardcodes dark text and we want light text on dark here.
 */
export function Statement() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'start 0.15'],
  });

  const words =
    'Not another dashboard. Not another tool. A small team that treats your brand like its own, and keeps it showing up sharp, every week.'.split(
      ' ',
    );

  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 md:py-36">
      {/* Brand gradient glow */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(50% 40% at 20% 20%, rgba(72,216,134,0.22), transparent 60%), radial-gradient(45% 35% at 80% 70%, rgba(29,156,161,0.22), transparent 60%), radial-gradient(55% 45% at 50% 110%, rgba(255,236,61,0.12), transparent 60%)',
        }}
      />

      {/* Particle field */}
      <Particles
        quantity={50}
        color={['#1D9CA1', '#48D886', '#FFEC3D']}
        speed={2}
        maxSize={2.5}
        className="absolute inset-0"
      />

      <div ref={ref} className="relative mx-auto max-w-4xl px-4">
        <p className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-2xl font-bold leading-snug tracking-tight md:text-4xl lg:text-5xl">
          {words.map((w, i) => {
            const start = i / words.length;
            const end = start + 1 / words.length;
            return (
              <Word key={i} range={[start, end]} progress={scrollYProgress}>
                {w}
              </Word>
            );
          })}
        </p>

        {/* Brand accent underline */}
        <div
          className="mx-auto mt-8 h-1 w-24 rounded-full md:mt-12 md:w-40"
          style={{
            background:
              'linear-gradient(90deg, #1D9CA1 0%, #48D886 50%, #FFEC3D 100%)',
          }}
        />
      </div>
    </section>
  );
}

function Word({
  children,
  progress,
  range,
}: {
  children: ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  const color = useTransform(
    progress,
    range,
    ['rgba(148, 163, 184, 0.35)', 'rgba(255, 255, 255, 1)'],
  );
  return (
    <motion.span style={{ opacity, color }} className="inline-block">
      {children}
    </motion.span>
  );
}
