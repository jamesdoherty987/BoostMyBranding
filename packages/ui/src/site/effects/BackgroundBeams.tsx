'use client';

/**
 * Animated SVG beams that sweep diagonally across a hero background.
 * Inspired by Aceternity's background-beams, but wired to brand colors
 * (primary + accent + pop) so every client's hero looks distinct without
 * any hard-coded tokens.
 *
 * The beams are SVG lines with a gradient stroke and drawing animation.
 * We generate a small-but-dense layer (count defaults to 20) and stagger
 * their delays so the motion always feels alive but never frenetic.
 *
 * Respects `prefers-reduced-motion` — when reduced, beams render statically
 * at their final state so the hero still looks considered.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { cn } from '../../cn';

interface BackgroundBeamsProps {
  className?: string;
  /** Brand colors to tint the beams with. */
  primary: string;
  accent: string;
  pop?: string;
  /** How many beams to render. Default 20. */
  count?: number;
  /** Where to anchor the beams' origin. Default 'top-left'. */
  origin?: 'top-left' | 'top-right' | 'center';
}

export function BackgroundBeams({
  className,
  primary,
  accent,
  pop,
  count = 20,
  origin = 'top-left',
}: BackgroundBeamsProps) {
  const reduced = useReducedMotion();

  // Deterministic-ish beam paths. We seed positions from the count so each
  // render is consistent — avoids hydration mismatches that pure random
  // would cause between server and client.
  const beams = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const jitter = ((i * 9301 + 49297) % 233280) / 233280; // fast LCG, stable
      const angle = 30 + jitter * 20; // 30–50 degrees
      const offset = (i / count) * 100; // spread across the canvas
      const length = 60 + jitter * 40; // % of canvas
      const color =
        i % 3 === 0 ? primary : i % 3 === 1 ? accent : pop ?? accent;
      const strokeWidth = 0.5 + jitter * 1.5;
      const delay = (i % 7) * 0.4;
      return { angle, offset, length, color, strokeWidth, delay, id: `b-${i}` };
    });
  }, [count, primary, accent, pop]);

  const originPoint: readonly [number, number] =
    origin === 'top-left'
      ? [0, 0]
      : origin === 'top-right'
        ? [100, 0]
        : [50, 50];

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          {beams.map((b) => (
            <linearGradient
              key={`grad-${b.id}`}
              id={`grad-${b.id}`}
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor={b.color} stopOpacity="0" />
              <stop offset="50%" stopColor={b.color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={b.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {beams.map((b) => {
          const x1 = originPoint[0] + (b.offset - 50) * 0.6;
          const y1 = originPoint[1] + (b.offset - 50) * 0.2;
          const x2 = x1 + Math.cos((b.angle * Math.PI) / 180) * b.length;
          const y2 = y1 + Math.sin((b.angle * Math.PI) / 180) * b.length;

          return (
            <motion.line
              key={b.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={`url(#grad-${b.id})`}
              strokeWidth={b.strokeWidth}
              strokeLinecap="round"
              initial={reduced ? { pathLength: 1, opacity: 0.6 } : { pathLength: 0, opacity: 0 }}
              animate={
                reduced
                  ? { pathLength: 1, opacity: 0.6 }
                  : {
                      pathLength: [0, 1, 1, 0],
                      opacity: [0, 0.7, 0.7, 0],
                    }
              }
              transition={
                reduced
                  ? undefined
                  : {
                      duration: 4,
                      repeat: Infinity,
                      delay: b.delay,
                      ease: 'easeInOut',
                      times: [0, 0.4, 0.7, 1],
                    }
              }
            />
          );
        })}
      </svg>
    </div>
  );
}
