'use client';

/**
 * Scroll-driven hero illustration — the client-site equivalent of the
 * rocket on the marketing site. Renders ONE dominant object positioned
 * to the side of (or behind) the hero copy, with motion driven by the
 * chosen preset.
 *
 * Motion presets:
 *   launch   — big upward translate on scroll + subtle scale pulse
 *   float    — gentle vertical bob (non-scroll)
 *   drift    — diagonal drift on scroll
 *   orbit    — continuous small circular drift
 *   tilt-3d  — mouse-follow 3D tilt (desktop only)
 *   parallax — moderate scroll-Y + slight scale-down
 *   none     — static
 *
 * Respects prefers-reduced-motion (flattens to static). The `embedded`
 * flag is kept for signature compatibility but no longer disables
 * scroll motion — the dashboard's desktop preview is a direct React
 * tree, so scroll-linked transforms work correctly there.
 *
 * Sources, in precedence order:
 *   1. `customUrl` — any SVG/PNG URL from the editor upload
 *   2. `style` — one of the prebuilt palette-tinted SVGs
 *
 * When neither is set we render nothing — the hero variant falls back
 * to its existing visual treatment untouched.
 */

import { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import type {
  HeroIllustration,
  HeroIllustrationMotion,
  HeroIllustrationStyle,
} from '@boost/core';
import { defaultMotionForStyle } from '@boost/core';
import { IllustrationSvg, type BrandPalette } from './svg-icons';
import { useSiteContext } from '../context';

interface HeroIllustrationLayerProps {
  illustration: HeroIllustration;
  brand: BrandPalette;
  /** Unique id prefix so multiple hero instances don't share SVG ids. */
  idPrefix?: string;
  /** Disables scroll-driven motion (used inside dashboard preview). */
  embedded?: boolean;
  /** The hero section ref so scroll transforms are locked to the hero. */
  heroRef: React.RefObject<HTMLElement | null>;
}

export function HeroIllustrationLayer({
  illustration,
  brand,
  idPrefix = 'hi',
  embedded,
  heroRef,
}: HeroIllustrationLayerProps) {
  const reduced = useReducedMotion();
  // Scroll-driven motion works fine in the dashboard's direct desktop
  // preview (same DOM tree as the editor), so we only disable it when
  // the user explicitly prefers reduced motion. Mobile / tablet preview
  // runs inside an iframe and uses its own internal scroll, so it's
  // unaffected either way.
  const motionDisabled = Boolean(reduced);
  // Embedded is still used to gate enter-once animations (initial fade
  // on mount) to avoid flashes inside the preview — kept for those.
  void embedded;

  const { editMode } = useSiteContext();

  // When the agency has toggled the illustration off without deleting
  // its config, honour that — but still render in edit mode so they
  // can toggle it back on without losing their work.
  if (illustration.hidden && !editMode) return null;

  const source = resolveSource(illustration);
  if (!source) return null;

  const side = illustration.side ?? 'right';
  const scale = clamp(illustration.scale ?? 1, 0.5, 1.5);
  const preset = illustration.motion ?? defaultMotionForStyle(illustration.style);
  const speed = clamp(illustration.motionSpeed ?? 1, 0.25, 4);
  const intensity = clamp(illustration.motionIntensity ?? 1, 0.1, 3);

  return (
    <IllustrationContainer
      side={side}
      scale={scale}
      editMode={editMode}
      preset={preset}
      speed={speed}
      intensity={intensity}
      motionDisabled={motionDisabled}
      heroRef={heroRef}
      idPrefix={idPrefix}
      brand={brand}
      source={source}
      illustration={illustration}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Container with motion preset wiring                                 */
/* ------------------------------------------------------------------ */

function IllustrationContainer({
  side,
  scale,
  editMode,
  preset,
  speed,
  intensity,
  motionDisabled,
  heroRef,
  idPrefix,
  brand,
  source,
  illustration,
}: {
  side: 'left' | 'right';
  scale: number;
  editMode: boolean | undefined;
  preset: HeroIllustrationMotion;
  speed: number;
  intensity: number;
  motionDisabled: boolean;
  heroRef: React.RefObject<HTMLElement | null>;
  idPrefix: string;
  brand: BrandPalette;
  source:
    | { kind: 'custom'; url: string }
    | { kind: 'svg'; svg: string }
    | { kind: 'style'; style: HeroIllustrationStyle };
  illustration: HeroIllustration;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Scroll-linked transforms from the hero section's own scroll range,
  // NOT the page. Lets the animation run regardless of where the hero
  // sits on the page.
  //
  // `layoutEffect: false` avoids the "ref not yet hydrated" warning —
  // the hero ref is set on the wrapping <div> higher up the tree, so
  // Framer's layout-effect-time measurement runs before the ref is
  // attached on first render. Deferring to a useEffect pass is fine
  // here because the motion only needs to kick in once the user
  // actually starts scrolling.
  const { scrollYProgress } = useScroll({
    target: heroRef as React.RefObject<HTMLElement>,
    offset: ['start start', 'end start'],
    layoutEffect: false,
  });

  // `speed` compresses the scroll range for scroll-linked presets so
  // the motion finishes earlier. speed=1 → motion spans full 0..1
  // scroll progress. speed=2 → motion completes at progress=0.5.
  const scrollEnd = Math.min(1, Math.max(0.15, 1 / speed));
  const scrollMid = scrollEnd * 0.5;
  // Sign used by diagonal presets — fly outward from the anchored side.
  const sideSign = side === 'right' ? 1 : -1;

  // Launch preset — rocket-style: big translate up, gentle scale pulse.
  const launchY = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0%', `${-220 * intensity}%`],
  );
  const launchScale = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    [1, 1 + 0.06 * intensity, 0.7],
  );
  const launchOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.8, scrollEnd],
    [1, 1, 0],
  );

  // Parallax preset — moderate translate + slight zoom.
  const parallaxY = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0px', `${-140 * intensity}px`],
  );
  const parallaxScale = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    [1, Math.max(0.5, 1 - 0.08 * intensity)],
  );

  // Drift preset — diagonal on scroll.
  const driftX = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0%', side === 'right' ? `${-14 * intensity}%` : `${14 * intensity}%`],
  );
  const driftY = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0%', `${-40 * intensity}%`],
  );

  // Fly-left preset — horizontal exit to the left + slight rise + spin.
  const flyLeftX = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${-60 * intensity}%`, `${-240 * intensity}%`],
  );
  const flyLeftY = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0%', `${-30 * intensity}%`],
  );
  const flyLeftRotate = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0deg', `${-30 * intensity}deg`],
  );
  const flyLeftOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.85, scrollEnd],
    [1, 1, 0],
  );

  // Fly-right preset — mirror of fly-left.
  const flyRightX = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${60 * intensity}%`, `${240 * intensity}%`],
  );
  const flyRightY = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0%', `${-30 * intensity}%`],
  );
  const flyRightRotate = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0deg', `${30 * intensity}deg`],
  );
  const flyRightOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.85, scrollEnd],
    [1, 1, 0],
  );

  // Fly-down preset — falls off the bottom.
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

  // Diagonal fly — exits up-and-outward toward the anchored side.
  const diagUpX = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${sideSign * 40 * intensity}%`, `${sideSign * 200 * intensity}%`],
  );
  const diagUpY = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${-60 * intensity}%`, `${-260 * intensity}%`],
  );
  const diagUpRotate = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0deg', `${sideSign * 20 * intensity}deg`],
  );
  const diagUpOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.85, scrollEnd],
    [1, 1, 0],
  );
  const diagDnX = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${sideSign * 40 * intensity}%`, `${sideSign * 200 * intensity}%`],
  );
  const diagDnY = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    ['0%', `${60 * intensity}%`, `${260 * intensity}%`],
  );
  const diagDnRotate = useTransform(
    scrollYProgress,
    [0, scrollEnd],
    ['0deg', `${-sideSign * 20 * intensity}deg`],
  );
  const diagDnOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.85, scrollEnd],
    [1, 1, 0],
  );

  // Zoom-in preset — scales up as the user scrolls past.
  const zoomScale = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    [0.7, 1 + 0.05 * intensity, 1 + 0.15 * intensity],
  );
  const zoomOpacity = useTransform(
    scrollYProgress,
    [0, scrollMid * 0.4, scrollEnd],
    [0, 1, 1],
  );

  // Fade-in preset — pure opacity on scroll.
  const fadeOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.3, scrollEnd * 0.7, scrollEnd],
    [0, 1, 1, 0],
  );

  // Slide-in preset — translates from off-canvas on scroll.
  const slideX = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    [side === 'right' ? `${120 * intensity}%` : `${-120 * intensity}%`, '0%', '0%'],
  );
  const slideOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.3, scrollEnd],
    [0, 1, 1],
  );

  // Reveal preset — mask-like slide up with fade.
  const revealY = useTransform(
    scrollYProgress,
    [0, scrollMid, scrollEnd],
    [`${40 * intensity}%`, '0%', `${-20 * intensity}%`],
  );
  const revealOpacity = useTransform(
    scrollYProgress,
    [0, scrollEnd * 0.25, scrollEnd * 0.75, scrollEnd],
    [0, 1, 1, 0.6],
  );

  // Tilt-3d preset — mouse-follow rotation (desktop only). Springs
  // smooth the raw pointer values so the tilt settles gently instead
  // of tracking 1:1 with the cursor. These are wired up to the outer
  // motion.div's `rotateX` / `rotateY` so Framer composes them with
  // the scroll-driven transforms cleanly.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], ['8deg', '-8deg']), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], ['-8deg', '8deg']), {
    stiffness: 150,
    damping: 20,
  });

  const onMouseMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (motionDisabled || preset !== 'tilt-3d' || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onMouseLeave = () => {
    mx.set(0);
    my.set(0);
  };

  // Pick the motion style for the currently selected preset.
  // Tilt-3d is a pointer-driven preset so we pass the motion values
  // directly as `rotateX`/`rotateY` — Framer Motion composes these
  // into the element's transform. Setting a raw `transform` string
  // would bypass Framer's composition and fight the scroll presets.
  const animateStyle: Record<string, unknown> = motionDisabled
    ? {}
    : (() => {
        switch (preset) {
          case 'launch':
            return { y: launchY, scale: launchScale, opacity: launchOpacity };
          case 'parallax':
            return { y: parallaxY, scale: parallaxScale };
          case 'drift':
            return { x: driftX, y: driftY };
          case 'fly-left':
            return {
              x: flyLeftX,
              y: flyLeftY,
              rotate: flyLeftRotate,
              opacity: flyLeftOpacity,
            };
          case 'fly-right':
            return {
              x: flyRightX,
              y: flyRightY,
              rotate: flyRightRotate,
              opacity: flyRightOpacity,
            };
          case 'fly-down':
            return { y: flyDownY, scale: flyDownScale, opacity: flyDownOpacity };
          case 'fly-diag-up':
            return {
              x: diagUpX,
              y: diagUpY,
              rotate: diagUpRotate,
              opacity: diagUpOpacity,
            };
          case 'fly-diag-down':
            return {
              x: diagDnX,
              y: diagDnY,
              rotate: diagDnRotate,
              opacity: diagDnOpacity,
            };
          case 'tilt-3d':
            return { rotateX, rotateY };
          case 'zoom-in':
            return { scale: zoomScale, opacity: zoomOpacity };
          case 'fade-in':
            return { opacity: fadeOpacity };
          case 'slide-in':
            return { x: slideX, opacity: slideOpacity };
          case 'reveal':
            return { y: revealY, opacity: revealOpacity };
          default:
            return {};
        }
      })();

  // Keyframe-based presets — driven by Framer's `animate` prop. `speed`
  // inversely scales duration (2× speed = half the duration); `intensity`
  // scales the keyframe values (distance travelled, angle swept).
  const kf = (baseDuration: number): number => Math.max(0.4, baseDuration / speed);
  const animateProps: Record<string, unknown> = motionDisabled
    ? {}
    : (() => {
        switch (preset) {
          case 'float':
            return {
              animate: { y: ['0%', `${-4 * intensity}%`, '0%'] },
              transition: { duration: kf(4), repeat: Infinity, ease: 'easeInOut' },
            };
          case 'orbit':
            return {
              animate: {
                x: ['0%', `${3 * intensity}%`, '0%', `${-3 * intensity}%`, '0%'],
                y: ['0%', `${-3 * intensity}%`, '0%', `${3 * intensity}%`, '0%'],
              },
              transition: { duration: kf(9), repeat: Infinity, ease: 'linear' },
            };
          case 'pulse':
            return {
              animate: { scale: [1, 1 + 0.05 * intensity, 1] },
              transition: { duration: kf(2.4), repeat: Infinity, ease: 'easeInOut' },
            };
          case 'spin':
            return {
              animate: { rotate: 360 },
              transition: { duration: kf(20), repeat: Infinity, ease: 'linear' },
            };
          case 'spin-slow':
            return {
              animate: { rotate: 360 },
              transition: { duration: kf(60), repeat: Infinity, ease: 'linear' },
            };
          case 'spin-fast':
            return {
              animate: { rotate: 360 },
              transition: { duration: kf(4), repeat: Infinity, ease: 'linear' },
            };
          case 'orbit-wide':
            return {
              animate: {
                x: ['0%', `${8 * intensity}%`, '0%', `${-8 * intensity}%`, '0%'],
                y: ['0%', `${-8 * intensity}%`, '0%', `${8 * intensity}%`, '0%'],
              },
              transition: { duration: kf(12), repeat: Infinity, ease: 'linear' },
            };
          case 'heartbeat':
            return {
              animate: { scale: [1, 1 + 0.08 * intensity, 1, 1 + 0.04 * intensity, 1] },
              transition: { duration: kf(1.3), repeat: Infinity, ease: 'easeInOut' },
            };
          case 'rubber-band':
            return {
              animate: {
                scaleX: [1, 1 + 0.25 * intensity, 1 - 0.15 * intensity, 1 + 0.15 * intensity, 1 - 0.05 * intensity, 1],
                scaleY: [1, 1 - 0.25 * intensity, 1 + 0.15 * intensity, 1 - 0.15 * intensity, 1 + 0.05 * intensity, 1],
              },
              transition: { duration: kf(1.4), repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' },
            };
          case 'jiggle':
            return {
              animate: {
                x: ['0%', `${-2 * intensity}%`, `${2 * intensity}%`, `${-1 * intensity}%`, `${1 * intensity}%`, '0%'],
                rotate: ['0deg', `${-3 * intensity}deg`, `${3 * intensity}deg`, `${-2 * intensity}deg`, `${2 * intensity}deg`, '0deg'],
              },
              transition: { duration: kf(0.9), repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' },
            };
          case 'swing':
            return {
              animate: {
                rotate: [
                  `${-6 * intensity}deg`,
                  `${6 * intensity}deg`,
                  `${-4 * intensity}deg`,
                  `${4 * intensity}deg`,
                  '0deg',
                ],
              },
              transition: {
                duration: kf(2.4),
                repeat: Infinity,
                ease: 'easeInOut',
                // Swing pivots from the top so it reads as a hanging pendulum.
              },
            };
          case 'sway':
            return {
              animate: { rotate: [`-${3 * intensity}deg`, `${3 * intensity}deg`, `-${3 * intensity}deg`] },
              transition: { duration: kf(3.2), repeat: Infinity, ease: 'easeInOut' },
            };
          case 'wobble':
            return {
              animate: {
                rotate: [`-${4 * intensity}deg`, `${4 * intensity}deg`, `-${2 * intensity}deg`, `${2 * intensity}deg`, '0deg'],
                scale: [1, 1 + 0.03 * intensity, 1, 1 + 0.02 * intensity, 1],
              },
              transition: { duration: kf(2.4), repeat: Infinity, ease: 'easeInOut' },
            };
          case 'bounce':
            return {
              animate: { y: ['0%', `${-10 * intensity}%`, '0%', `${-4 * intensity}%`, '0%'] },
              transition: { duration: kf(1.6), repeat: Infinity, ease: 'easeOut' },
            };
          case 'shake':
            return {
              animate: {
                x: [
                  '0%',
                  `${-2 * intensity}%`,
                  `${2 * intensity}%`,
                  `${-1.5 * intensity}%`,
                  `${1.5 * intensity}%`,
                  '0%',
                ],
              },
              transition: { duration: kf(0.8), repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' },
            };
          case 'flip-y':
            return {
              initial: { rotateY: -180, opacity: 0 },
              animate: { rotateY: 0, opacity: 1 },
              transition: { duration: kf(1.2), ease: 'easeOut' },
            };
          default:
            return {};
        }
      })();

  // Positioning. The illustration renders from md+ (768px) so the
  // dashboard desktop/tablet preview — which is narrower than the
  // full-screen site — still shows it. On phones the hero is copy+CTA
  // only for focus and loading cost.
  const sideClass =
    side === 'right'
      ? 'md:right-[2%] lg:right-[4%] xl:right-[6%]'
      : 'md:left-[2%] lg:left-[4%] xl:left-[6%]';

  // Size. 420px default; scale multiplier tweaks proportionally. Max
  // 560px so it never fully dominates the section. Uses `vw` upper
  // bound so it shrinks on smaller desktops instead of bleeding into
  // the copy column.
  const baseSize = 420 * scale;

  return (
    <div
      aria-hidden={!editMode}
      className={`pointer-events-none absolute inset-y-0 hidden md:flex md:items-center ${sideClass}`}
      style={{ zIndex: 5, perspective: preset === 'tilt-3d' ? 1200 : undefined }}
    >
      <motion.div
        ref={ref}
        onPointerMove={onMouseMove}
        onPointerLeave={onMouseLeave}
        className="relative transform-gpu"
        style={{
          width: `min(${baseSize}px, 34vw)`,
          maxWidth: '560px',
          willChange: motionDisabled ? undefined : 'transform, opacity',
          // Re-enable pointer events on the inner element when tilt-3d
          // is active so the cursor can actually drive the tilt — the
          // outer wrapper is pointer-events-none to let clicks through
          // to the hero CTAs, but tilt needs to receive mousemove.
          pointerEvents: preset === 'tilt-3d' && !motionDisabled ? 'auto' : 'none',
          transformStyle: preset === 'tilt-3d' ? 'preserve-3d' : undefined,
          // Pendulum swing pivots from the top so it reads as a hanging
          // object. Every other preset keeps the default center origin.
          transformOrigin: preset === 'swing' ? 'top center' : undefined,
          filter:
            // Two layered shadows: a coloured one in the primary brand
            // so the silhouette reads on dark backgrounds, plus a neutral
            // drop for soft contact on light backgrounds.
            `drop-shadow(0 14px 28px rgba(${hexToRgb(brand.primary)}, 0.25)) drop-shadow(0 4px 8px rgba(15,23,42,0.18))`,
          ...animateStyle,
        }}
        {...animateProps}
      >
        {source.kind === 'custom' ? (
          // Custom uploaded image. Keep the motion wrappers the same so
          // the preset still drives it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source.url}
            alt={illustration.prompt ?? ''}
            className="block h-auto w-full select-none"
            draggable={false}
          />
        ) : source.kind === 'svg' ? (
          // Inline AI-generated SVG. Sanitised server-side before being
          // persisted; still dangerouslySetInnerHTML-only because
          // raw markup is the point.
          <div
            className="block h-auto w-full select-none [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            // eslint-disable-next-line react/no-danger -- SVG is sanitised upstream.
            dangerouslySetInnerHTML={{ __html: source.svg }}
          />
        ) : (
          <IllustrationSvg
            style={source.style}
            brand={brand}
            idPrefix={idPrefix}
            className="block h-auto w-full"
          />
        )}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function resolveSource(
  illustration: HeroIllustration,
):
  | { kind: 'custom'; url: string }
  | { kind: 'svg'; svg: string }
  | { kind: 'style'; style: HeroIllustrationStyle }
  | null {
  // Inline custom SVG wins when present — it's already styled and can
  // carry its own animate tags for richer motion than CSS transforms.
  if (illustration.customSvg && illustration.customSvg.trim()) {
    return { kind: 'svg', svg: illustration.customSvg };
  }
  if (illustration.customUrl) {
    return { kind: 'custom', url: illustration.customUrl };
  }
  if (illustration.style) {
    return { kind: 'style', style: illustration.style };
  }
  return null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Hex → "r, g, b" for use inside rgba() template strings. Defensive
 * against short (#48D) and long (#48D886) hex, with or without the hash.
 * Falls back to slate-900 on malformed input.
 */
function hexToRgb(hex: string): string {
  if (!hex) return '15, 23, 42';
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 || !/^[0-9a-f]{6}$/i.test(h)) return '15, 23, 42';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
