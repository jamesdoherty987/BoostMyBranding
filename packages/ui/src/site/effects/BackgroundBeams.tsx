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
 *
 * Hydration notes:
 *   - All numeric SVG attributes are rounded to a fixed precision with
 *     toFixed(3). Without this, the server might serialize a float like
 *     `33.545633653413915` and the client would serialize the same float
 *     as `33.5456336534139` (or vice-versa) because React's string
 *     conversion of numeric attributes isn't bit-identical across Node
 *     and browser V8 builds. Rounding sidesteps the class of bugs where
 *     React reports a hydration mismatch on every beam's `x2`/`y2`.
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

/** Trim a float to 3 decimal places and stringify. Server and client produce
 *  identical output this way, which is what React needs for a clean hydrate. */
function fx(n: number): string {
  return n.toFixed(3);
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

  const originPoint: readonly [number, number] =
    origin === 'top-left'
      ? [0, 0]
      : origin === 'top-right'
        ? [100, 0]
        : [50, 50];

  // Pre-compute each beam with string-formatted coords so SSR and CSR
  // hydrate cleanly. We also stagger delay and vary stroke width here
  // using a fast LCG so the pattern looks lively without being random.
  const beams = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const jitter = ((i * 9301 + 49297) % 233280) / 233280;
      const angle = 30 + jitter * 20; // 30–50 degrees
      const offset = (i / count) * 100; // spread across the canvas
      const length = 60 + jitter * 40; // % of canvas
      const color =
        i % 3 === 0 ? primary : i % 3 === 1 ? accent : pop ?? accent;
      const strokeWidth = 0.5 + jitter * 1.5;
      const delay = (i % 7) * 0.4;

      const x1 = originPoint[0] + (offset - 50) * 0.6;
      const y1 = originPoint[1] + (offset - 50) * 0.2;
      const x2 = x1 + Math.cos((angle * Math.PI) / 180) * length;
      const y2 = y1 + Math.sin((angle * Math.PI) / 180) * length;

      return {
        id: `b-${i}`,
        color,
        delay,
        x1: fx(x1),
        y1: fx(y1),
        x2: fx(x2),
        y2: fx(y2),
        strokeWidth: fx(strokeWidth),
      };
    });
  }, [count, primary, accent, pop, originPoint]);

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

        {beams.map((b) => (
          <motion.line
            key={b.id}
            x1={b.x1}
            y1={b.y1}
            x2={b.x2}
            y2={b.y2}
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
        ))}
      </svg>
    </div>
  );
}
