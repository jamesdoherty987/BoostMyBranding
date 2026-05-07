'use client';

/**
 * Decorative cutout layer for any hero variant. Renders each entry in
 * `config.hero.cutouts` as a positioned image with an animation style.
 * Designed to complement — not replace — the hero's main variant, so
 * it sits in its own absolute layer.
 *
 * Animations come in two families:
 *
 *  1. Keyframe-based loops — float, tilt, orbit, pulse, drift, spin,
 *     sway, bounce, wobble. Run continuously. `speed` scales duration,
 *     `intensity` scales how far things travel.
 *
 *  2. Scroll-linked — map the hero section's scroll progress (0 at
 *     start-in-view, 1 at scrolled-past-top) onto transforms. `speed`
 *     compresses the scroll range the motion consumes so the motion
 *     finishes earlier (speed=2 → motion completes at progress=0.5),
 *     and `intensity` scales the travel distance.
 *
 *     - scroll-up / scroll-down    : vertical drift on scroll
 *     - scroll-parallax            : moderate up + slight zoom out
 *     - scroll-fly-out             : straight up, accelerating off screen
 *     - scroll-fly-left / -right   : horizontal fly-off (+ slight drift up)
 *     - scroll-fly-down            : straight down, off screen
 *     - scroll-fly-diag-up / -dn   : diagonal fly-off, direction-aware
 *     - scroll-rotate              : rotate while drifting up
 *     - scroll-zoom                : dramatic zoom + subtle fade at end
 *     - scroll-fade                : fade out + gentle rise
 *
 * All animations are GPU-friendly (transform + opacity only) and respect
 * prefers-reduced-motion. In embedded / preview mode we render the
 * cutouts but skip the motion so the editor preview stays still.
 *
 * Each cutout can sit on layer 0 (behind copy) or layer 1 (above copy).
 * The renderer mounts two layers and filters cutouts into each.
 */

import { useRef } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import type { HeroCutout } from '@boost/core';

interface HeroCutoutsProps {
  cutouts?: HeroCutout[];
  /** When true (embedded preview), render static — no animation. */
  embedded?: boolean;
  /** Which layer to render: 0 = behind copy, 1 = above. */
  layer: 0 | 1;
  /**
   * Ref to the hero section itself so scroll-linked motion is tied to
   * the hero's scroll range rather than the whole page. Without this
   * the cutouts would keep animating far past the hero, which reads as
   * broken.
   */
  heroRef?: React.RefObject<HTMLElement | null>;
}

export function HeroCutouts({
  cutouts,
  embedded,
  layer,
  heroRef,
}: HeroCutoutsProps) {
  const reduced = useReducedMotion();
  const fallbackRef = useRef<HTMLDivElement>(null);

  // Scroll progress tied to the hero section. `layoutEffect: false`
  // avoids the "ref not yet hydrated" warning when `heroRef` is defined
  // higher up the tree.
  const { scrollYProgress } = useScroll({
    target: (heroRef as React.RefObject<HTMLElement>) ?? fallbackRef,
    offset: ['start start', 'end start'],
    layoutEffect: false,
  });

  if (!cutouts || cutouts.length === 0) return null;

  const items = cutouts.filter((c) => (c.layer ?? 0) === layer);
  if (items.length === 0) return null;

  const motionDisabled = Boolean(reduced) || Boolean(embedded);
  // Layer 1 (above copy) needs pointer-events-none so it doesn't block
  // clicks on the CTA buttons.
  const zClass = layer === 1 ? 'z-20' : 'z-0';

  return (
    <div
      ref={fallbackRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${zClass}`}
    >
      {items.map((cutout, i) => (
        <Cutout
          key={`${cutout.url}-${i}`}
          cutout={cutout}
          index={i}
          motionDisabled={motionDisabled}
          scrollYProgress={scrollYProgress}
        />
      ))}
    </div>
  );
}

function Cutout({
  cutout,
  index,
  motionDisabled,
  scrollYProgress,
}: {
  cutout: HeroCutout;
  index: number;
  motionDisabled: boolean;
  scrollYProgress: MotionValue<number>;
}) {
  const x = clampPct(cutout.x, 50);
  const y = clampPct(cutout.y, 50);
  const size = clampRange(cutout.size ?? 30, 5, 80);
  const rotate = cutout.rotate ?? 0;
  const animation = cutout.animation ?? 'float';
  const speed = clampRange(cutout.speed ?? 1, 0.1, 5);
  const intensity = clampRange(cutout.intensity ?? 1, 0.1, 4);
  const shadow = cutout.shadow ?? 1;
  const groundShadow = Boolean(cutout.groundShadow);

  // Stagger keyframe-based animations so they don't pulse in sync.
  const stagger = index * 0.4;

  // For scroll-linked presets `speed` compresses the scroll range the
  // motion consumes. speed=1 → motion happens across the full 0..1
  // range. speed=2 → motion finishes at 0.5. speed=0.5 → motion only
  // reaches halfway by the time the hero is scrolled past. Clamped to
  // (0, 1] so we never sample past the end.
  const scrollEnd = clampRange(1 / speed, 0.15, 1);
  const scrollMid = scrollEnd * 0.5;

  // Scroll-linked motion values. Hooks must run unconditionally, so
  // build them all up front — only the ones matching the current
  // animation are actually fed to the element.
  const upY = useTransform(scrollYProgress, [0, scrollEnd], ['0%', `${-120 * intensity}%`]);
  const downY = useTransform(scrollYProgress, [0, scrollEnd], ['0%', `${120 * intensity}%`]);
  const parallaxY = useTransform(scrollYProgress, [0, scrollEnd], ['0%', `${-60 * intensity}%`]);
  const parallaxScale = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    [1, Math.max(0.5, 1 - 0.08 * intensity)],
  );

  // Fly-out: accelerates up and off screen with a short hover then burst.
  const flyOutY = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${-80 * intensity}%`, `${-360 * intensity}%`],
  );
  const flyOutScale = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    [1, 1 + 0.1 * intensity, 0.4],
  );
  const flyOutOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.8, scrollEnd],
    [1, 1, 0],
  );

  // Fly-left: horizontal exit to the left with a subtle rise + spin.
  const flyLeftX = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${-60 * intensity}%`, `${-220 * intensity}%`],
  );
  const flyLeftY = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0%', `${-30 * intensity}%`],
  );
  const flyLeftRotate = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    [`${rotate}deg`, `${rotate - 30 * intensity}deg`],
  );
  const flyLeftOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.85, scrollEnd],
    [1, 1, 0],
  );

  // Fly-right: mirror of fly-left.
  const flyRightX = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${60 * intensity}%`, `${220 * intensity}%`],
  );
  const flyRightY = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0%', `${-30 * intensity}%`],
  );
  const flyRightRotate = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    [`${rotate}deg`, `${rotate + 30 * intensity}deg`],
  );
  const flyRightOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.85, scrollEnd],
    [1, 1, 0],
  );

  // Fly-down: falls straight off the bottom.
  const flyDownY = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${80 * intensity}%`, `${320 * intensity}%`],
  );
  const flyDownScale = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    [1, Math.max(0.4, 1 - 0.2 * intensity)],
  );
  const flyDownOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.8, scrollEnd],
    [1, 1, 0],
  );

  // Diagonal presets use the cutout's horizontal position to pick the
  // "away from centre" direction so an upper-right cutout exits
  // top-right and an upper-left one exits top-left.
  const diagSign = x >= 50 ? 1 : -1;
  const diagUpX = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${diagSign * 40 * intensity}%`, `${diagSign * 180 * intensity}%`],
  );
  const diagUpY = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${-60 * intensity}%`, `${-260 * intensity}%`],
  );
  const diagUpRotate = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    [`${rotate}deg`, `${rotate + diagSign * 20 * intensity}deg`],
  );
  const diagUpOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.85, scrollEnd],
    [1, 1, 0],
  );
  const diagDnX = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${diagSign * 40 * intensity}%`, `${diagSign * 180 * intensity}%`],
  );
  const diagDnY = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${60 * intensity}%`, `${260 * intensity}%`],
  );
  const diagDnRotate = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    [`${rotate}deg`, `${rotate - diagSign * 20 * intensity}deg`],
  );
  const diagDnOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.85, scrollEnd],
    [1, 1, 0],
  );

  const rotateY = useTransform(scrollYProgress, [0, scrollEnd], ['0%', `${-80 * intensity}%`]);
  const rotateDeg = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    [`${rotate}deg`, `${rotate + 360 * intensity}deg`],
  );
  const zoomScale = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    [1, 1 + 0.8 * intensity],
  );
  const zoomOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.8, scrollEnd],
    [1, 1, 0.2],
  );
  const fadeOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.3, scrollEnd * 0.8, scrollEnd],
    [1, 1, 0.2, 0],
  );
  const fadeY = useTransform(scrollYProgress, [0, scrollEnd], ['0%', `${-20 * intensity}%`]);

  // Pick the style for the chosen animation. Scroll presets use
  // `style` (motion values); loop presets use `animate` + `transition`.
  let motionProps: Record<string, unknown> = {};
  let scrollStyle: Record<string, unknown> | undefined;
  // When the animation drives rotation directly, skip the static rotate
  // baked into `transform` so the two don't compound.
  let effectiveRotate = rotate;

  if (!motionDisabled) {
    switch (animation) {
      case 'scroll-up':
        scrollStyle = { y: upY };
        break;
      case 'scroll-down':
        scrollStyle = { y: downY };
        break;
      case 'scroll-parallax':
        scrollStyle = { y: parallaxY, scale: parallaxScale };
        break;
      case 'scroll-fly-out':
        scrollStyle = { y: flyOutY, scale: flyOutScale, opacity: flyOutOpacity };
        break;
      case 'scroll-fly-left':
        scrollStyle = {
          x: flyLeftX,
          y: flyLeftY,
          rotate: flyLeftRotate,
          opacity: flyLeftOpacity,
        };
        effectiveRotate = 0;
        break;
      case 'scroll-fly-right':
        scrollStyle = {
          x: flyRightX,
          y: flyRightY,
          rotate: flyRightRotate,
          opacity: flyRightOpacity,
        };
        effectiveRotate = 0;
        break;
      case 'scroll-fly-down':
        scrollStyle = { y: flyDownY, scale: flyDownScale, opacity: flyDownOpacity };
        break;
      case 'scroll-fly-diag-up':
        scrollStyle = {
          x: diagUpX,
          y: diagUpY,
          rotate: diagUpRotate,
          opacity: diagUpOpacity,
        };
        effectiveRotate = 0;
        break;
      case 'scroll-fly-diag-dn':
        scrollStyle = {
          x: diagDnX,
          y: diagDnY,
          rotate: diagDnRotate,
          opacity: diagDnOpacity,
        };
        effectiveRotate = 0;
        break;
      case 'scroll-rotate':
        scrollStyle = { y: rotateY, rotate: rotateDeg };
        effectiveRotate = 0;
        break;
      case 'scroll-zoom':
        scrollStyle = { scale: zoomScale, opacity: zoomOpacity };
        break;
      case 'scroll-fade':
        scrollStyle = { opacity: fadeOpacity, y: fadeY };
        break;
      default:
        motionProps = getKeyframeMotionProps(animation, speed, intensity, stagger);
    }
  }

  const shadowFilter =
    shadow === 0
      ? undefined
      : shadow === 1
        ? 'drop-shadow(0 10px 18px rgba(15,23,42,0.22)) drop-shadow(0 3px 6px rgba(15,23,42,0.18))'
        : 'drop-shadow(0 30px 48px rgba(15,23,42,0.38)) drop-shadow(0 8px 14px rgba(15,23,42,0.25))';

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}%`,
        // Position-centering on the anchor. Rotation composes with any
        // motion-value rotation via Framer's transform system, so we
        // only bake the static rotate in when the preset isn't driving
        // rotation itself (otherwise the two would double up).
        transform: `translate(-50%, -50%) rotate(${effectiveRotate}deg)`,
        willChange: motionDisabled ? undefined : 'transform, opacity',
        ...(scrollStyle ?? {}),
      }}
      {...motionProps}
    >
      {/* Ground-contact shadow. Blurred dark ellipse inside the motion
          wrapper so it tracks the cutout. Makes a dropped-in PNG look
          sat into the scene rather than pasted on. */}
      {groundShadow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: '-6%',
            width: '70%',
            height: '12%',
            background:
              'radial-gradient(ellipse at center, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.25) 40%, rgba(15,23,42,0) 70%)',
            filter: 'blur(6px)',
            zIndex: -1,
          }}
        />
      ) : null}
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
 * Map a keyframe-based animation name + speed + stagger to Framer
 * Motion animate/transition props. Scroll-linked animations are
 * handled separately above via useTransform.
 */
function getKeyframeMotionProps(
  animation: NonNullable<HeroCutout['animation']>,
  speed: number,
  intensity: number,
  stagger: number,
): Record<string, unknown> {
  // Larger speed = shorter duration; cap to sensible bounds.
  const dur = Math.max(0.25, 6 / Math.max(0.1, speed));
  const common = {
    delay: stagger,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  };

  switch (animation) {
    case 'float':
      return {
        animate: { y: [`0%`, `${-6 * intensity}%`, `0%`] },
        transition: { duration: dur, ...common },
      };
    case 'tilt':
      return {
        animate: { rotate: [-4 * intensity, 4 * intensity, -4 * intensity] },
        transition: { duration: dur, ...common },
      };
    case 'sway':
      return {
        animate: { rotate: [`-${3 * intensity}deg`, `${3 * intensity}deg`, `-${3 * intensity}deg`] },
        transition: { duration: dur * 0.9, ...common },
      };
    case 'orbit':
      return {
        animate: {
          x: ['0%', `${4 * intensity}%`, '0%', `${-4 * intensity}%`, '0%'],
          y: ['0%', `${-4 * intensity}%`, '0%', `${4 * intensity}%`, '0%'],
        },
        transition: { duration: dur * 1.4, delay: stagger, repeat: Infinity, ease: 'linear' },
      };
    case 'pulse':
      return {
        animate: { scale: [1, 1 + 0.05 * intensity, 1] },
        transition: { duration: Math.max(0.4, dur * 0.6), ...common },
      };
    case 'drift':
      return {
        animate: {
          x: [`${-2 * intensity}%`, `${2 * intensity}%`, `${-2 * intensity}%`],
          y: [`${-3 * intensity}%`, `${3 * intensity}%`, `${-3 * intensity}%`],
        },
        transition: { duration: dur * 1.2, ...common },
      };
    case 'spin':
      return {
        animate: { rotate: 360 },
        transition: {
          duration: Math.max(1, dur * 2.5),
          delay: stagger,
          repeat: Infinity,
          ease: 'linear',
        },
      };
    case 'bounce':
      return {
        animate: { y: ['0%', `${-10 * intensity}%`, '0%', `${-4 * intensity}%`, '0%'] },
        transition: {
          duration: Math.max(0.4, dur * 0.5),
          delay: stagger,
          repeat: Infinity,
          ease: 'easeOut',
        },
      };
    case 'wobble':
      return {
        animate: {
          rotate: [`-${4 * intensity}deg`, `${4 * intensity}deg`, `-${2 * intensity}deg`, `${2 * intensity}deg`, '0deg'],
          scale: [1, 1 + 0.03 * intensity, 1, 1 + 0.02 * intensity, 1],
        },
        transition: { duration: Math.max(0.5, dur * 0.6), ...common },
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
