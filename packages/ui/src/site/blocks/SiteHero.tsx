'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { hexToRgbTuple } from '@boost/core';
import { AuroraBg } from '../../aurora-bg';
import { Particles } from '../../particles';
import { brandGradient } from '../theme';

interface SiteHeroProps {
  config: WebsiteConfig;
  images: string[];
  businessName: string;
  /** When true, disables scroll-linked transforms that assume the viewport. */
  embedded?: boolean;
}

/**
 * Full-bleed hero with optional aurora blobs, particles, grid texture, and a
 * parallax image tile. Matches the landing-page hero quality bar: scroll-linked
 * motion, reduced-motion fallbacks, and brand-driven color without hard-coded
 * tokens. All motion is opt-out via `prefers-reduced-motion` and the entire
 * image layer uses `hidden md:block` so it doesn't squash the mobile hero.
 */
export function SiteHero({ config, images, businessName, embedded }: SiteHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Defer mount of Particles until after hydration. Prevents a hydration
  // mismatch caused by `useReducedMotion` returning different values on the
  // server vs client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const copyY = useTransform(scrollYProgress, [0, 1], ['0px', '-60px']);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0]);
  const imageY = useTransform(scrollYProgress, [0, 1], ['0px', '-120px']);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

  const fx = config.hero?.effects ?? { aurora: true, particles: true, grid: true };
  const dark = config.brand.heroStyle === 'dark';
  const heroHeadline = config.hero?.headline ?? 'Welcome.';
  const heroSubhead = config.hero?.subheadline ?? '';
  const heroImage =
    config.hero?.imageIndex != null ? images[config.hero.imageIndex] : undefined;

  const primaryRgb = hexToRgbTuple(config.brand.primaryColor);
  const accentRgb = hexToRgbTuple(config.brand.accentColor);

  const ctaPrimary = config.hero?.ctaPrimary ?? { label: 'Get in touch', href: '#contact' };
  const motionDisabled = reduced || embedded;

  return (
    <section
      ref={ref}
      id="home"
      className={`relative isolate overflow-hidden ${dark ? 'text-white' : 'text-slate-900'}`}
      style={{
        background: dark
          ? 'linear-gradient(180deg, var(--bmb-site-dark) 0%, #0b1220 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #eef2f7 100%)',
      }}
    >
      {fx.aurora ? <AuroraBg /> : null}

      {fx.grid ? (
        <div
          aria-hidden
          className="absolute inset-0 -z-[1]"
          style={{
            backgroundImage: dark
              ? 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)'
              : 'linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 45%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 70% at 50% 40%, black 45%, transparent 100%)',
          }}
        />
      ) : null}

      {fx.particles && mounted && !reduced ? (
        <Particles
          quantity={60}
          color={[
            config.brand.primaryColor,
            config.brand.accentColor,
            config.brand.popColor ?? '#FFEC3D',
          ]}
          speed={0.9}
          maxSize={2.4}
          className="absolute inset-0 -z-[1]"
        />
      ) : null}

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 md:py-28 lg:grid-cols-2 lg:gap-14 lg:py-32">
        <motion.div
          className="relative z-10"
          style={motionDisabled ? undefined : { y: copyY, opacity: copyOpacity }}
        >
          {config.hero?.eyebrow ? (
            <p
              className="mb-4 text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ color: dark ? '#fff' : 'var(--bmb-site-primary)' }}
            >
              {config.hero.eyebrow}
            </p>
          ) : null}

          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            {splitHeadline(heroHeadline).map((chunk, i) =>
              chunk.accent ? (
                <span
                  key={i}
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: brandGradient(config.brand, 90) }}
                >
                  {chunk.text}
                </span>
              ) : (
                <span key={i}>{chunk.text}</span>
              ),
            )}
          </h1>

          {heroSubhead ? (
            <p
              className={`mt-5 max-w-xl text-base md:mt-6 md:text-lg ${
                dark ? 'text-white/80' : 'text-slate-600'
              }`}
            >
              {heroSubhead}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <a
              href={ctaPrimary.href}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
              style={{ background: brandGradient(config.brand, 120) }}
            >
              {ctaPrimary.label}
            </a>
            {config.hero?.ctaSecondary ? (
              <a
                href={config.hero.ctaSecondary.href}
                className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors ${
                  dark
                    ? 'border-white/30 bg-white/5 text-white hover:bg-white/10'
                    : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                }`}
              >
                {config.hero.ctaSecondary.label}
              </a>
            ) : null}
          </div>
        </motion.div>

        {/* Visual tile on the right. Hidden below `md` so the mobile hero stays
            focused on copy; on tablet it rejoins the grid to add depth. */}
        <motion.div
          className="relative z-10 mx-auto hidden w-full max-w-lg md:block"
          style={motionDisabled ? undefined : { y: imageY, scale: imageScale }}
        >
          <div
            className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl"
            style={{ boxShadow: `0 40px 80px -20px rgba(${primaryRgb}, 0.35)` }}
          >
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage}
                alt={`${businessName}, ${config.brand.tagline}`}
                className="h-full w-full object-cover"
                loading="eager"
              />
            ) : (
              <div
                className="h-full w-full"
                role="img"
                aria-label={`${businessName} brand illustration`}
                style={{ background: brandGradient(config.brand, 160) }}
              />
            )}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.4) 100%)',
              }}
            />
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {config.brand.tagline}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                {config.meta?.description ?? businessName}
              </p>
            </div>
          </div>

          {/* Floating accent orbs for depth */}
          <div
            aria-hidden
            className="absolute -left-6 -top-6 h-24 w-24 rounded-full blur-2xl"
            style={{ background: `rgba(${accentRgb}, 0.7)` }}
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -right-8 h-36 w-36 rounded-full blur-3xl"
            style={{ background: `rgba(${primaryRgb}, 0.55)` }}
          />
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Split a headline on the last 2-word phrase so we can gradient-highlight it.
 * Produces either one plain chunk (short headlines) or a plain + accent pair.
 * Trailing punctuation is kept OUT of the accent chunk so the gradient text
 * doesn't capture commas or periods.
 */
function splitHeadline(headline: string): Array<{ text: string; accent?: boolean }> {
  const cleaned = headline.trim();
  if (!cleaned) return [{ text: '' }];
  const words = cleaned.split(/\s+/);
  if (words.length <= 3) return [{ text: cleaned }];

  // Pull trailing punctuation off the last word so it renders in the plain span.
  const last = words[words.length - 1] ?? '';
  const match = last.match(/^([^\p{P}\s]+)([\p{P}]*)$/u);
  let accentWords: string;
  let tail = '';
  if (match) {
    accentWords = `${words[words.length - 2]} ${match[1]}`;
    tail = match[2] ?? '';
  } else {
    accentWords = words.slice(-2).join(' ');
  }
  const leadWords = words.slice(0, -2).join(' ');
  return [
    { text: leadWords + ' ' },
    { text: accentWords, accent: true },
    ...(tail ? [{ text: tail }] : []),
  ];
}
