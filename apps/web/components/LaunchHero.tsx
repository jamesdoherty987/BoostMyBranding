'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion';
import { Button, Badge, Particles, ShimmerButton } from '@boost/ui';
import { ArrowRight, Sparkles, Zap, CheckCircle2 } from 'lucide-react';

/**
 * Cinematic launch hero. Rocket lifts off on scroll, sky transitions from
 * day to space, particles swirl through the whole sequence. Respects
 * prefers-reduced-motion and gracefully collapses on mobile.
 */
export function LaunchHero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const rocketY = useTransform(scrollYProgress, [0, 0.55, 1], ['0%', '-180%', '-520%']);
  const rocketScale = useTransform(scrollYProgress, [0, 0.25, 1], [1, 1.08, 0.35]);
  const rocketRotate = useTransform(scrollYProgress, [0, 1], [0, -4]);
  const rocketX = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);

  const flameScale = useTransform(scrollYProgress, [0, 0.12, 0.55], [0.4, 1.8, 2.5]);
  const flameOpacity = useTransform(scrollYProgress, [0, 0.05, 0.6, 1], [0, 1, 1, 0]);
  const smokeOpacity = useTransform(scrollYProgress, [0, 0.08, 0.5, 1], [0, 0.9, 0.5, 0]);
  const smokeScale = useTransform(scrollYProgress, [0, 0.5], [0.6, 3]);

  const skyOpacityDay = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const skyOpacityNight = useTransform(scrollYProgress, [0.3, 0.9], [0, 1]);
  const starsOpacity = useTransform(scrollYProgress, [0.4, 0.8], [0, 1]);

  const padY = useTransform(scrollYProgress, [0, 0.5], ['0%', '60%']);
  const padOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const copyOpacity = useTransform(scrollYProgress, [0, 0.15, 0.9], [1, 1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 0.5], ['0px', '-40px']);

  const yS = useSpring(rocketY, { stiffness: 70, damping: 18 });

  return (
    <section
      ref={ref}
      className="relative"
      style={{ height: reduced ? '100vh' : '220vh' }}
      aria-label="BoostMyBranding hero"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Day sky */}
        <motion.div
          className="absolute inset-0"
          style={{
            opacity: reduced ? 1 : skyOpacityDay,
            background:
              'radial-gradient(120% 80% at 50% 120%, rgba(72,216,134,0.55), transparent 60%), radial-gradient(110% 70% at 50% 0%, rgba(29,156,161,0.35), transparent 60%), linear-gradient(180deg, #eaf8ff 0%, #fdfff0 70%, #ffffff 100%)',
          }}
        />
        {/* Night */}
        <motion.div
          className="absolute inset-0 bg-gradient-night"
          style={{ opacity: reduced ? 0 : skyOpacityNight }}
        />
        {/* Stars */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 stars-layer animate-twinkle"
          style={{ opacity: reduced ? 0 : starsOpacity }}
        />

        {/* Subtle particle field over everything */}
        {!reduced ? <Particles quantity={50} color="#1D9CA1" /> : null}

        {/* Pad */}
        <motion.div
          className="absolute inset-x-0 bottom-0 h-[26vh]"
          style={{ y: reduced ? 0 : padY, opacity: reduced ? 1 : padOpacity }}
          aria-hidden
        >
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-slate-900/10 via-transparent to-transparent" />
          <svg viewBox="0 0 1200 260" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-full w-full">
            <defs>
              <linearGradient id="pad-g" x1="0" y1="0" x2="0" y2="260" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#0b1220" stopOpacity="0" />
                <stop offset="1" stopColor="#0b1220" stopOpacity="0.25" />
              </linearGradient>
            </defs>
            <path d="M0 220 C 320 180 520 180 600 170 C 680 180 880 180 1200 220 L 1200 260 L 0 260 Z" fill="url(#pad-g)" />
            <rect x="540" y="200" width="120" height="40" rx="4" fill="#0b1220" opacity="0.4" />
            <rect x="520" y="210" width="160" height="10" rx="2" fill="#0b1220" opacity="0.55" />
          </svg>
        </motion.div>

        {/* Smoke */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 bottom-[16vh] -translate-x-1/2"
          style={{ opacity: reduced ? 0 : smokeOpacity, scale: reduced ? 1 : smokeScale }}
        >
          <div className="h-[200px] w-[320px] rounded-full bg-white/70 blur-2xl" />
        </motion.div>

        {/* Rocket */}
        <motion.div
          className="absolute left-1/2 bottom-[24vh] -translate-x-1/2"
          style={{
            y: reduced ? 0 : yS,
            x: reduced ? 0 : rocketX,
            rotate: reduced ? 0 : rocketRotate,
            scale: reduced ? 1 : rocketScale,
          }}
        >
          <div className="relative">
            <Image
              src="/logo/boost-rocket.png"
              alt="BoostMyBranding rocket"
              width={260}
              height={260}
              priority
              className="drop-shadow-[0_18px_40px_rgba(29,156,161,0.45)]"
            />
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-[86%] -translate-x-1/2 origin-top"
              style={{
                scale: reduced ? 1 : flameScale,
                opacity: reduced ? 0 : flameOpacity,
              }}
            >
              <div className="animate-flame">
                <div className="h-32 w-16 rounded-full bg-gradient-to-b from-[#FFEC3D] via-[#FF9E3D] to-transparent blur-[2px]" />
                <div className="mx-auto -mt-24 h-24 w-10 rounded-full bg-gradient-to-b from-white via-[#FFEC3D] to-transparent" />
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Copy */}
        <motion.div
          className="absolute inset-x-0 top-[14vh] md:top-[10vh] flex flex-col items-center px-4 text-center"
          style={{ opacity: reduced ? 1 : copyOpacity, y: reduced ? 0 : copyY }}
        >
          <Badge tone="brand" className="mb-5 gap-1.5 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            AI social media on autopilot
          </Badge>
          <h1 className="mx-auto max-w-5xl text-5xl font-bold tracking-tight md:text-7xl lg:text-[88px] lg:leading-[0.95]">
            Launch your brand.{' '}
            <span className="relative inline-block">
              <span className="text-gradient-brand">Watch it fly.</span>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.2, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="absolute -bottom-2 left-0 right-0 h-1.5 origin-left rounded-full bg-gradient-cta"
              />
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-700 md:text-xl">
            We generate, schedule, and publish a full month of on-brand content in a day — across every platform. You approve with a swipe.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup">
              <ShimmerButton className="group">
                <Zap className="h-4 w-4" />
                Start free trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </ShimmerButton>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline">
                See how it works
              </Button>
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#48D886]" /> No credit card
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#48D886]" /> Setup in a week
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#48D886]" /> Cancel any time
            </li>
          </ul>
        </motion.div>

        <motion.div
          aria-hidden
          className="absolute inset-x-0 bottom-6 flex justify-center text-xs font-medium tracking-widest text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          style={{ opacity: reduced ? 1 : copyOpacity }}
        >
          <div className="inline-flex items-center gap-2">
            <span>SCROLL TO LAUNCH</span>
            <svg width="14" height="14" viewBox="0 0 14 14" className="animate-pulse-glow rounded-full">
              <path d="M7 2v8m0 0l-3-3m3 3l3-3" stroke="#1D9CA1" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
