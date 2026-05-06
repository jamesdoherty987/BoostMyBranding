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
 * Respects prefers-reduced-motion (flattens to static) and the
 * `embedded` context (disables scroll listeners inside the dashboard
 * preview iframe).
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
  const motionDisabled = Boolean(reduced) || Boolean(embedded);

  const { editMode } = useSiteContext();

  const source = resolveSource(illustration);
  if (!source) return null;

  const side = illustration.side ?? 'right';
  const scale = clamp(illustration.scale ?? 1, 0.5, 1.5);
  const preset = illustration.motion ?? defaultMotionForStyle(illustration.style);

  return (
    <IllustrationContainer
      side={side}
      scale={scale}
      editMode={editMode}
      preset={preset}
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
  motionDisabled: boolean;
  heroRef: React.RefObject<HTMLElement | null>;
  idPrefix: string;
  brand: BrandPalette;
  source: { kind: 'custom'; url: string } | { kind: 'style'; style: HeroIllustrationStyle };
  illustration: HeroIllustration;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Scroll-linked transforms from the hero section's own scroll range,
  // NOT the page. Lets the animation run regardless of where the hero
  // sits on the page.
  const { scrollYProgress } = useScroll({
    target: heroRef as React.RefObject<HTMLElement>,
    offset: ['start start', 'end start'],
  });

  // Launch preset — rocket-style: big translate up, gentle scale pulse.
  const launchY = useTransform(scrollYProgress, [0, 1], ['0%', '-220%']);
  const launchScale = useTransform(scrollYProgress, [0, 0.3, 1], [1, 1.06, 0.7]);
  const launchOpacity = useTransform(scrollYProgress, [0, 0.75, 1], [1, 1, 0]);

  // Parallax preset — moderate translate + slight zoom.
  const parallaxY = useTransform(scrollYProgress, [0, 1], ['0px', '-140px']);
  const parallaxScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);

  // Drift preset — diagonal on scroll.
  const driftX = useTransform(
    scrollYProgress,
    [0, 1],
    [side === 'right' ? '0%' : '0%', side === 'right' ? '-14%' : '14%'],
  );
  const driftY = useTransform(scrollYProgress, [0, 1], ['0%', '-40%']);

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
          case 'tilt-3d':
            return { rotateX, rotateY };
          default:
            return {};
        }
      })();

  // float / orbit use keyframe animate rather than scroll — driven by
  // Framer's `animate` prop on the inner motion.div.
  const animateProps: Record<string, unknown> = motionDisabled
    ? {}
    : (() => {
        switch (preset) {
          case 'float':
            return {
              animate: { y: ['0%', '-4%', '0%'] },
              transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            };
          case 'orbit':
            return {
              animate: {
                x: ['0%', '3%', '0%', '-3%', '0%'],
                y: ['0%', '-3%', '0%', '3%', '0%'],
              },
              transition: { duration: 9, repeat: Infinity, ease: 'linear' },
            };
          default:
            return {};
        }
      })();

  // Positioning. The illustration only renders at lg+ (1024px) where
  // every hero variant's layout has real two-column room for it. On
  // tablets (768–1023px) most variants stack single-column and an
  // absolute illustration would land on top of the copy. On phones the
  // hero is copy+CTA only for focus and loading cost.
  const sideClass =
    side === 'right'
      ? 'lg:right-[4%] xl:right-[6%]'
      : 'lg:left-[4%] xl:left-[6%]';

  // Size. 420px default; scale multiplier tweaks proportionally. Max
  // 560px so it never fully dominates the section. Uses `vw` upper
  // bound so it shrinks on smaller desktops instead of bleeding into
  // the copy column.
  const baseSize = 420 * scale;

  return (
    <div
      aria-hidden={!editMode}
      className={`pointer-events-none absolute inset-y-0 hidden lg:flex lg:items-center ${sideClass}`}
      style={{ zIndex: 5, perspective: preset === 'tilt-3d' ? 1200 : undefined }}
    >
      <motion.div
        ref={ref}
        onPointerMove={onMouseMove}
        onPointerLeave={onMouseLeave}
        className="relative"
        style={{
          width: `min(${baseSize}px, 34vw)`,
          maxWidth: '560px',
          willChange: motionDisabled ? undefined : 'transform',
          // Re-enable pointer events on the inner element when tilt-3d
          // is active so the cursor can actually drive the tilt — the
          // outer wrapper is pointer-events-none to let clicks through
          // to the hero CTAs, but tilt needs to receive mousemove.
          pointerEvents: preset === 'tilt-3d' && !motionDisabled ? 'auto' : 'none',
          transformStyle: preset === 'tilt-3d' ? 'preserve-3d' : undefined,
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
  | { kind: 'style'; style: HeroIllustrationStyle }
  | null {
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
