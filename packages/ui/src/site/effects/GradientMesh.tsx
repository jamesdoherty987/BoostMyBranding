'use client';

/**
 * Animated conic/radial gradient mesh. Three soft blobs (primary, accent,
 * pop) drift slowly across the background with long durations so the
 * motion is subliminal — you notice the color, not the animation.
 *
 * Differs from AuroraBg by:
 *   - Blobs are larger and saturated higher
 *   - Motion paths are longer and more varied
 *   - A subtle noise overlay breaks up the flat gradients, which reads as
 *     "designer-tuned" rather than "CSS gradient"
 *
 * Best used as a full-bleed hero background when no image is available.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../cn';
import { hexToRgbTuple } from '@boost/core';

interface GradientMeshProps {
  className?: string;
  primary: string;
  accent: string;
  pop?: string;
  /** Whether the host is a dark hero (influences noise opacity). */
  dark?: boolean;
}

export function GradientMesh({
  className,
  primary,
  accent,
  pop,
  dark = false,
}: GradientMeshProps) {
  const reduced = useReducedMotion();
  const pRgb = hexToRgbTuple(primary);
  const aRgb = hexToRgbTuple(accent);
  const popRgb = hexToRgbTuple(pop ?? accent);

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {/* Primary blob */}
      <motion.div
        className="absolute h-[90vh] w-[90vh] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(${pRgb}, 0.55), transparent 60%)`,
          top: '-20%',
          left: '-15%',
        }}
        animate={
          reduced
            ? undefined
            : {
                x: [0, 80, -40, 0],
                y: [0, 60, -30, 0],
                scale: [1, 1.1, 0.95, 1],
              }
        }
        transition={
          reduced
            ? undefined
            : { duration: 26, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      {/* Accent blob */}
      <motion.div
        className="absolute h-[75vh] w-[75vh] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle at 70% 70%, rgba(${aRgb}, 0.5), transparent 60%)`,
          top: '20%',
          right: '-20%',
        }}
        animate={
          reduced
            ? undefined
            : {
                x: [0, -70, 40, 0],
                y: [0, -40, 60, 0],
                scale: [1, 0.95, 1.12, 1],
              }
        }
        transition={
          reduced
            ? undefined
            : { duration: 32, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      {/* Pop blob */}
      <motion.div
        className="absolute h-[65vh] w-[65vh] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(${popRgb}, 0.35), transparent 60%)`,
          bottom: '-25%',
          left: '30%',
        }}
        animate={
          reduced
            ? undefined
            : {
                x: [0, 60, -80, 0],
                y: [0, -50, 20, 0],
                scale: [1, 1.05, 0.9, 1],
              }
        }
        transition={
          reduced
            ? undefined
            : { duration: 28, repeat: Infinity, ease: 'easeInOut' }
        }
      />

      {/* Noise overlay — breaks up the banding, reads as designer-tuned.
          Inline SVG so we don't need a public asset. */}
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          opacity: dark ? 0.35 : 0.22,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
