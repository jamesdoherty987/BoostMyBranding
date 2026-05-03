'use client';

/**
 * Classic split layout with layered parallax: copy left, image tile right.
 * On scroll, each layer moves at a different speed — image goes deepest,
 * accent orbs drift slower, tagline card floats gently. On mouse hover
 * over the image, it tilts in 3D to follow the cursor (disabled on touch).
 *
 * This is the "safe bet" variant — works for almost any template that has
 * good photography. Falls back gracefully to the AI-generated hero image,
 * then to a brand-tinted SVG if neither exists.
 *
 * All motion layers respect `prefers-reduced-motion` and the `embedded`
 * flag (dashboard preview uses scroll-independent positioning so the
 * viewport-based scroll listener doesn't misalign inside an iframe).
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
import type { WebsiteConfig } from '@boost/core';
import { hexToRgbTuple } from '@boost/core';
import { AuroraBg } from '../../../aurora-bg';
import { HeroCopy } from './HeroCopy';

interface HeroParallaxLayersProps {
  config: WebsiteConfig;
  heroImage?: string;
  businessName: string;
  embedded?: boolean;
}

export function HeroParallaxLayers({
  config,
  heroImage,
  businessName,
  embedded,
}: HeroParallaxLayersProps) {
  const ref = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const dark = config.brand.heroStyle === 'dark';

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Layered scroll transforms. Each layer moves at a different rate so
  // depth emerges naturally as the user reads down the page.
  const copyY = useTransform(scrollYProgress, [0, 1], ['0px', '-60px']);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0]);
  const imageY = useTransform(scrollYProgress, [0, 1], ['0px', '-160px']);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const imageRotate = useTransform(scrollYProgress, [0, 1], ['0deg', '-3deg']);
  const orbOneY = useTransform(scrollYProgress, [0, 1], ['0px', '60px']);
  const orbTwoY = useTransform(scrollYProgress, [0, 1], ['0px', '-90px']);
  const tagY = useTransform(scrollYProgress, [0, 1], ['0px', '-40px']);

  // Mouse-driven 3D tilt on the image tile. Motion values are wrapped in
  // springs so the tilt settles smoothly instead of tracking 1:1 with the
  // pointer — the latter reads as jumpy and cheap. Touch devices don't
  // fire pointer-move on idle, so this is a pure desktop enhancement.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], ['6deg', '-6deg']), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], ['-6deg', '6deg']), {
    stiffness: 150,
    damping: 20,
  });

  const motionDisabled = reduced || embedded;
  const primaryRgb = hexToRgbTuple(config.brand.primaryColor);
  const accentRgb = hexToRgbTuple(config.brand.accentColor);

  const onImageMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (motionDisabled || e.pointerType !== 'mouse') return;
    const el = imageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onImageLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <section
      ref={ref}
      id="home"
      className={`relative isolate overflow-hidden ${dark ? 'text-white' : 'text-slate-900'}`}
      style={{
        background: dark
          ? 'linear-gradient(180deg, var(--bmb-site-dark) 0%, #0b1220 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #eef2f7 100%)',
        minHeight: embedded ? '640px' : undefined,
      }}
    >
      <AuroraBg />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 md:py-28 lg:grid-cols-2 lg:gap-14 lg:py-32">
        <HeroCopy
          config={config}
          dark={dark}
          align="left"
          motionDisabled={motionDisabled}
          style={motionDisabled ? undefined : { y: copyY, opacity: copyOpacity }}
        />

        {/* Visual tile. Hidden below `md` so the mobile hero stays focused on
            copy; on tablet+ it rejoins the grid to add depth. The wrapping
            div establishes the 3D perspective; the inner motion.div carries
            the scroll transforms; the nested motion.div carries mouse tilt. */}
        <div
          className="relative z-10 mx-auto hidden w-full max-w-lg md:block"
          style={{ perspective: 1200 }}
        >
          <motion.div
            style={motionDisabled ? undefined : { y: imageY, scale: imageScale, rotate: imageRotate }}
            className="relative"
          >
            <motion.div
              ref={imageRef}
              onPointerMove={onImageMove}
              onPointerLeave={onImageLeave}
              style={motionDisabled ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
              className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl"
            >
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ boxShadow: `0 40px 80px -20px rgba(${primaryRgb}, 0.35)` }}
              />
              {heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroImage}
                  alt={`${businessName}, ${config.brand.tagline}`}
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              ) : (
                <BrandHeroTile brand={config.brand} businessName={businessName} />
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.4) 100%)',
                }}
              />
              {/* Tagline card — floats independently on scroll for extra depth */}
              <motion.div
                className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur"
                style={motionDisabled ? undefined : { y: tagY }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {config.brand.tagline}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                  {config.meta?.description ?? businessName}
                </p>
              </motion.div>
            </motion.div>

            {/* Floating accent orbs — each drifts at its own rate so depth
                reads as layered rather than flat. */}
            <motion.div
              aria-hidden
              style={motionDisabled ? undefined : { y: orbOneY }}
              className="absolute -left-6 -top-6 h-28 w-28 rounded-full blur-2xl"
            >
              <div
                className="h-full w-full rounded-full"
                style={{ background: `rgba(${accentRgb}, 0.7)` }}
              />
            </motion.div>
            <motion.div
              aria-hidden
              style={motionDisabled ? undefined : { y: orbTwoY }}
              className="absolute -bottom-10 -right-8 h-40 w-40 rounded-full blur-3xl"
            >
              <div
                className="h-full w-full rounded-full"
                style={{ background: `rgba(${primaryRgb}, 0.55)` }}
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * Brand-tinted tile fallback when no image (client or AI-generated) is
 * available. Intentionally simpler than the old `BrandHeroSvg` — a gradient
 * wash + the brand initial. The idea is to look CLEAN rather than try to
 * fake a custom illustration. Better to look honest than to look cheap.
 */
function BrandHeroTile({
  brand,
  businessName,
}: {
  brand: WebsiteConfig['brand'];
  businessName: string;
}) {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${brand.primaryColor} 0%, ${brand.accentColor} 50%, ${
          brand.popColor ?? brand.accentColor
        } 100%)`,
      }}
    >
      <span
        className="text-[9rem] font-black leading-none text-white/90"
        style={{ textShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
      >
        {businessName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
