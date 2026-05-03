'use client';

/**
 * Decorative cutout layer for any hero variant. Renders each entry in
 * `config.hero.cutouts` as a positioned image with an animation style.
 * Designed to complement — not replace — the hero's main variant, so
 * it sits in its own absolute layer.
 *
 * All animations are GPU-friendly (transform + opacity only) and respect
 * prefers-reduced-motion. In embedded / preview mode we render the
 * cutouts but skip the motion so the editor preview stays still.
 *
 * Each cutout can sit on layer 0 (behind copy) or layer 1 (above copy).
 * The renderer mounts two layers and filters cutouts into each.
 */

import { motion, useReducedMotion } from 'framer-motion';
import type { HeroCutout } from '@boost/core';

interface HeroCutoutsProps {
  cutouts?: HeroCutout[];
  /** When true (embedded preview), render static — no animation. */
  embedded?: boolean;
  /** Which layer to render: 0 = behind copy, 1 = above. */
  layer: 0 | 1;
}

export function HeroCutouts({ cutouts, embedded, layer }: HeroCutoutsProps) {
  const reduced = useReducedMotion();
  if (!cutouts || cutouts.length === 0) return null;

  const items = cutouts.filter((c) => (c.layer ?? 0) === layer);
  if (items.length === 0) return null;

  const motionDisabled = Boolean(reduced) || Boolean(embedded);
  // Layer 1 (above copy) needs pointer-events-none so it doesn't block
  // clicks on the CTA buttons.
  const zClass = layer === 1 ? 'z-20' : 'z-0';

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${zClass}`}
    >
      {items.map((cutout, i) => (
        <Cutout
          key={`${cutout.url}-${i}`}
          cutout={cutout}
          index={i}
          motionDisabled={motionDisabled}
        />
      ))}
    </div>
  );
}

function Cutout({
  cutout,
  index,
  motionDisabled,
}: {
  cutout: HeroCutout;
  index: number;
  motionDisabled: boolean;
}) {
  const x = clampPct(cutout.x, 50);
  const y = clampPct(cutout.y, 50);
  const size = clampRange(cutout.size ?? 30, 5, 80);
  const rotate = cutout.rotate ?? 0;
  const animation = cutout.animation ?? 'float';
  const speed = cutout.speed ?? 1;
  const shadow = cutout.shadow ?? 1;

  // Stagger the animation start per cutout so they don't all bob in sync.
  const stagger = index * 0.4;

  const motionProps = motionDisabled
    ? {}
    : getMotionProps(animation, speed, stagger);

  const shadowFilter =
    shadow === 0
      ? 'none'
      : shadow === 1
        ? 'drop-shadow(0 10px 18px rgba(15,23,42,0.18))'
        : 'drop-shadow(0 24px 40px rgba(15,23,42,0.28))';

  return (
    <motion.div
      className="absolute"
      style={{
        // Center the cutout on its (x, y) anchor point, then nudge by
        // 50% of its own size so the anchor reads as the center of the
        // image.
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}%`,
        // Aspect-ratio is driven by the image itself; we let it flow.
        transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
        willChange: motionDisabled ? undefined : 'transform',
      }}
      {...motionProps}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cutout.url}
        alt={cutout.alt ?? ''}
        className="block h-auto w-full"
        style={{ filter: shadowFilter }}
        loading="lazy"
        draggable={false}
      />
    </motion.div>
  );
}

/**
 * Map an animation name + speed + stagger to Framer Motion animate/transition
 * props. Keeping this in one function makes adding new animations easy.
 */
function getMotionProps(
  animation: NonNullable<HeroCutout['animation']>,
  speed: number,
  stagger: number,
): Record<string, unknown> {
  // Larger speed = shorter duration; cap to sensible bounds.
  const dur = Math.max(1.5, 6 / Math.max(0.1, speed));

  switch (animation) {
    case 'float':
      return {
        animate: { y: ['0%', '-6%', '0%'] },
        transition: {
          duration: dur,
          delay: stagger,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };
    case 'tilt':
      return {
        animate: { rotate: [-4, 4, -4] },
        transition: {
          duration: dur,
          delay: stagger,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };
    case 'orbit':
      return {
        animate: { x: ['0%', '4%', '0%', '-4%', '0%'], y: ['0%', '-4%', '0%', '4%', '0%'] },
        transition: {
          duration: dur * 1.4,
          delay: stagger,
          repeat: Infinity,
          ease: 'linear',
        },
      };
    case 'pulse':
      return {
        animate: { scale: [1, 1.05, 1] },
        transition: {
          duration: Math.max(1, dur * 0.6),
          delay: stagger,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };
    case 'drift':
      return {
        animate: { x: ['-2%', '2%', '-2%'], y: ['-3%', '3%', '-3%'] },
        transition: {
          duration: dur * 1.2,
          delay: stagger,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };
    case 'none':
    default:
      return {};
  }
}

function clampPct(value: number | undefined, fallback: number): number {
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.max(-20, Math.min(120, value));
}

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
