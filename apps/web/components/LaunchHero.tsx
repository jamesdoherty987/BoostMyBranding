'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Button, Particles, ShimmerButton } from '@boost/ui';
import { ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

/**
 * Hero with a realistic cutout rocket that sits low on the page at rest,
 * then blasts upward fast on scroll. The flame is composed of four
 * independently-animated layers (halo, mid body, inner core, sparks) each
 * on a different frequency so the fire looks genuinely chaotic and alive.
 *
 * The headline/subhead are rendered with NO initial opacity animation so
 * they're visible in the very first paint after SSR. The only motion on
 * the copy is the scroll-linked fade once the user starts scrolling.
 *
 * Layout strategy:
 * - Desktop (md+): the original sticky 120vh parallax with the rocket
 *   absolutely positioned on the right side.
 * - Mobile: copy stacks above a compact rocket inside a flex column. The
 *   sticky container still clips any overflow so tall phones look clean.
 *   Rocket size is tuned to fit alongside the copy within 100vh on
 *   common phones (iPhone SE → 13 Pro Max range).
 */
export function LaunchHero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const rocketY = useTransform(scrollYProgress, [0, 1], ['0%', '-320%']);
  const rocketScale = useTransform(scrollYProgress, [0, 0.3, 1], [1, 1.08, 0.7]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.35, 0.7], [1, 1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 1], ['0px', '-80px']);

  return (
    <section
      ref={ref}
      className="relative"
      style={{ height: reduced ? '100vh' : '120vh' }}
      aria-label="BoostMyBranding launch hero"
    >
      <div className="sticky top-0 flex h-screen w-full flex-col overflow-hidden">
        {/* Light brand backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(55% 45% at 15% 10%, rgba(72,216,134,0.22), transparent 60%), radial-gradient(55% 45% at 85% 20%, rgba(29,156,161,0.22), transparent 60%), radial-gradient(65% 40% at 50% 110%, rgba(255,236,61,0.20), transparent 60%), linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #eef2f7 100%)',
          }}
        />

        {/*
          Grid texture. Lines use an opaque slate with decent alpha so the
          grid is visible at typical monitor brightness, then a radial mask
          fades it out near the edges so it doesn't compete with the copy.
        */}
        <div
          aria-hidden
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,23,42,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.09) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage:
              'radial-gradient(ellipse 80% 70% at 50% 50%, black 45%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 70% at 50% 50%, black 45%, transparent 100%)',
          }}
        />

        {/* Particles — fewer + smaller on mobile for perf and clarity */}
        {!reduced ? (
          <>
            <Particles
              quantity={40}
              color={['#1D9CA1', '#48D886', '#FFEC3D']}
              speed={1.1}
              maxSize={2.2}
              className="absolute inset-0 z-[5] md:hidden"
            />
            <Particles
              quantity={140}
              color={['#1D9CA1', '#48D886', '#FFEC3D']}
              speed={1.1}
              maxSize={2.8}
              className="absolute inset-0 z-[5] hidden md:block"
            />
          </>
        ) : null}

        {/*
          Copy layer — no initial-to-animate fade. The headline is visible in
          the server-rendered HTML at full opacity, so there is zero flash on
          first paint. The only scroll-linked transform is applied via the
          `style` below and the `motion` hooks into it after hydration.
        */}
        <motion.div
          className="relative z-20 flex flex-col items-center px-5 pt-20 text-center sm:px-4 sm:pt-24 md:h-full md:justify-center md:pt-0"
          style={reduced ? undefined : { opacity: copyOpacity, y: copyY }}
        >
          <h1 className="mx-auto max-w-5xl text-balance text-[34px] font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl md:text-7xl lg:text-[92px] lg:leading-[0.95]">
            Launch your brand.
            <br />
            <span className="relative inline-block">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, #1D9CA1 0%, #48D886 50%, #FFEC3D 100%)',
                }}
              >
                Watch it fly.
              </span>
              {!reduced ? (
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute -bottom-1 left-0 right-0 h-[3px] origin-left rounded-full sm:-bottom-1.5 sm:h-1 md:-bottom-2 md:h-1.5"
                  style={{
                    background:
                      'linear-gradient(90deg, #1D9CA1 0%, #48D886 50%, #FFEC3D 100%)',
                  }}
                />
              ) : (
                <span
                  className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full sm:-bottom-1.5 sm:h-1 md:-bottom-2 md:h-1.5"
                  style={{
                    background:
                      'linear-gradient(90deg, #1D9CA1 0%, #48D886 50%, #FFEC3D 100%)',
                  }}
                />
              )}
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-balance text-[15px] leading-relaxed text-slate-600 sm:mt-5 sm:text-lg md:mt-6 md:text-xl">
            Done-for-you social media that actually looks professional. We plan, write, and
            publish every post so your brand keeps showing up — without you sitting in front of
            Canva on a Sunday night.
          </p>

          <div className="mt-5 flex w-full max-w-sm flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center md:mt-8">
            <Link href="/signup" className="block w-full sm:w-auto">
              <ShimmerButton className="group w-full justify-center sm:w-auto">
                <Zap className="h-4 w-4" />
                Start free trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </ShimmerButton>
            </Link>
            <Link href="#how-it-works" className="block w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                See how it works
              </Button>
            </Link>
          </div>

          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-slate-500 sm:mt-6 sm:gap-x-5 sm:text-sm">
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

        {/*
          Rocket. Mobile: compact, stacked under the copy using mt-auto so
          it always hugs the bottom of the sticky viewport (any extra glow
          beyond the sticky is clipped cleanly by overflow-hidden). Desktop:
          absolutely positioned on the right and driven by scroll.
        */}
        <motion.div
          aria-hidden
          className="pointer-events-none relative z-10 mt-auto flex w-full justify-center md:absolute md:inset-y-0 md:right-[5%] md:mt-0 md:w-auto md:items-end md:justify-end"
          style={{
            y: reduced ? 0 : rocketY,
            scale: reduced ? 1 : rocketScale,
            filter:
              'drop-shadow(0 20px 30px rgba(15,23,42,0.22)) drop-shadow(0 8px 16px rgba(29,156,161,0.22))',
          }}
        >
          <RocketWithFlame
            className="h-[180px] w-auto sm:h-[240px] md:h-[88vh]"
            reduced={!!reduced}
          />
        </motion.div>

        {/* Scroll hint — desktop only. On mobile the content scrolls normally
            so the hint would be misleading. */}
        <motion.div
          aria-hidden
          className="absolute inset-x-0 bottom-6 z-20 hidden justify-center text-xs font-medium tracking-widest text-slate-500 md:flex"
          style={reduced ? undefined : { opacity: copyOpacity }}
        >
          <div className="inline-flex items-center gap-2">
            <span>SCROLL</span>
            <svg width="14" height="14" viewBox="0 0 14 14" className="rounded-full">
              <path
                d="M7 2v8m0 0l-3-3m3 3l3-3"
                stroke="#1D9CA1"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Inline rocket SVG. The flame uses `feTurbulence` + `feDisplacementMap`
 * filters with an animated seed so the edges genuinely warp frame-to-frame
 * like real fire, plus per-layer CSS animation at different frequencies.
 */
function RocketWithFlame({
  className,
  reduced,
}: {
  className?: string;
  reduced?: boolean;
}) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 960"
      className={className}
      aria-hidden
      animate={reduced ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        <linearGradient id="hull" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="0.12" stopColor="#f8fafc" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="0.82" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="hullShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="nose" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#48D886" />
          <stop offset="0.5" stopColor="#1D9CA1" />
          <stop offset="1" stopColor="#135c61" />
        </linearGradient>
        <linearGradient id="noseGloss" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1D9CA1" />
          <stop offset="1" stopColor="#135c61" />
        </linearGradient>
        <linearGradient id="finShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id="glass" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#bae6fd" />
          <stop offset="0.35" stopColor="#48D886" />
          <stop offset="0.8" stopColor="#1D9CA1" />
          <stop offset="1" stopColor="#0b2c30" />
        </radialGradient>

        <radialGradient id="flameHalo" cx="0.5" cy="0" r="0.95">
          <stop offset="0" stopColor="#FFEC3D" stopOpacity="0.8" />
          <stop offset="0.4" stopColor="#FFEC3D" stopOpacity="0.55" />
          <stop offset="0.75" stopColor="#ffc14d" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffc14d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="flameMid" cx="0.5" cy="0" r="0.78">
          <stop offset="0" stopColor="#fff6b0" />
          <stop offset="0.35" stopColor="#FFEC3D" />
          <stop offset="0.75" stopColor="#ffc14d" />
          <stop offset="1" stopColor="#ffc14d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="flameCore" cx="0.5" cy="0.15" r="0.55">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#fff6b0" />
          <stop offset="1" stopColor="#FFEC3D" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="engine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334155" />
          <stop offset="0.5" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="fireWarp" x="-20%" y="-5%" width="140%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.09" numOctaves="2" seed="1" result="noise">
            {reduced ? null : (
              <animate attributeName="seed" from="1" to="60" dur="2.4s" repeatCount="indefinite" />
            )}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="fireWarpTight" x="-10%" y="-5%" width="120%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.14" numOctaves="2" seed="5" result="noise2">
            {reduced ? null : (
              <animate attributeName="seed" from="5" to="90" dur="1.3s" repeatCount="indefinite" />
            )}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise2" scale="6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g className={reduced ? undefined : 'animate-flame-halo'}>
        <ellipse cx="240" cy="780" rx="180" ry="100" fill="#FFEC3D" opacity="0.25" filter="url(#glow)" />
        <ellipse cx="240" cy="820" rx="120" ry="65" fill="#48D886" opacity="0.22" filter="url(#glow)" />
      </g>

      <g
        className={reduced ? undefined : 'animate-flame-halo'}
        filter={reduced ? undefined : 'url(#fireWarp)'}
      >
        <path
          d="M 178 680 C 164 760 162 840 198 905 C 216 935 228 945 240 955 C 252 945 264 935 282 905 C 318 840 316 760 302 680 Z"
          fill="url(#flameHalo)"
          filter="url(#glow)"
        />
      </g>

      <g
        className={reduced ? undefined : 'animate-flame-mid'}
        filter={reduced ? undefined : 'url(#fireWarpTight)'}
      >
        <path
          d="M 200 680 C 190 740 188 815 216 885 C 226 905 234 915 240 922 C 246 915 254 905 264 885 C 292 815 290 740 280 680 Z"
          fill="url(#flameMid)"
        />
      </g>

      <g className={reduced ? undefined : 'animate-flame-core'}>
        <path
          d="M 220 680 C 214 720 212 780 230 840 C 236 860 240 868 240 874 C 240 868 244 860 250 840 C 268 780 266 720 260 680 Z"
          fill="url(#flameCore)"
        />
      </g>

      {!reduced ? (
        <g>
          <circle cx="170" cy="870" r="3" fill="#FFEC3D" className="animate-flame-spark" />
          <circle cx="315" cy="880" r="2.5" fill="#48D886" className="animate-flame-spark" style={{ animationDelay: '0.4s' }} />
          <circle cx="200" cy="900" r="2" fill="#fff" className="animate-flame-spark" style={{ animationDelay: '0.8s' }} />
          <circle cx="290" cy="880" r="2.5" fill="#FFEC3D" className="animate-flame-spark" style={{ animationDelay: '1.2s' }} />
          <circle cx="240" cy="920" r="1.8" fill="#fff6b0" className="animate-flame-spark" style={{ animationDelay: '1.5s' }} />
        </g>
      ) : null}

      <path d="M 190 560 L 120 700 C 114 710 120 720 132 716 L 190 696 Z" fill="url(#fin)" />
      <path d="M 190 560 L 120 700 C 114 710 120 720 132 716 L 190 696 Z" fill="url(#finShade)" opacity="0.5" />
      <path d="M 190 560 L 124 704" stroke="#48D886" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      <path d="M 290 560 L 360 700 C 366 710 360 720 348 716 L 290 696 Z" fill="url(#fin)" />
      <path d="M 290 560 L 360 700 C 366 710 360 720 348 716 L 290 696 Z" fill="url(#finShade)" opacity="0.2" />

      <path d="M 232 570 L 240 720 L 248 570 Z" fill="#135c61" opacity="0.9" />

      <path
        d="M 190 260 C 190 255 194 250 200 250 L 280 250 C 286 250 290 255 290 260 L 290 700 C 290 710 284 716 276 716 L 204 716 C 196 716 190 710 190 700 Z"
        fill="url(#hull)"
      />
      <path
        d="M 190 260 C 190 255 194 250 200 250 L 280 250 C 286 250 290 255 290 260 L 290 700 C 290 710 284 716 276 716 L 204 716 C 196 716 190 710 190 700 Z"
        fill="url(#hullShade)"
      />
      <rect x="198" y="260" width="4" height="450" rx="2" fill="#fff" opacity="0.6" />

      <rect x="190" y="460" width="100" height="40" fill="url(#nose)" />
      <rect x="190" y="460" width="100" height="40" fill="url(#hullShade)" />
      <rect x="198" y="464" width="3" height="32" fill="#fff" opacity="0.45" />

      <line x1="210" y1="330" x2="270" y2="330" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
      <line x1="210" y1="620" x2="270" y2="620" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
      <line x1="210" y1="660" x2="270" y2="660" stroke="#94a3b8" strokeWidth="1" opacity="0.35" />

      <circle cx="210" cy="380" r="2" fill="#64748b" />
      <circle cx="270" cy="380" r="2" fill="#64748b" />
      <circle cx="210" cy="430" r="2" fill="#64748b" />
      <circle cx="270" cy="430" r="2" fill="#64748b" />

      <circle cx="240" cy="400" r="42" fill="#0b2c30" />
      <circle cx="240" cy="400" r="36" fill="url(#glass)" />
      <circle cx="240" cy="400" r="36" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.4" />
      <ellipse cx="226" cy="385" rx="10" ry="6" fill="#fff" opacity="0.75" />
      <ellipse cx="255" cy="418" rx="4" ry="2" fill="#fff" opacity="0.4" />

      <rect x="186" y="712" width="108" height="14" rx="4" fill="#475569" />
      <rect x="186" y="712" width="108" height="14" rx="4" fill="url(#hullShade)" />

      <path d="M 202 726 L 196 760 L 284 760 L 278 726 Z" fill="url(#engine)" />
      <ellipse cx="240" cy="760" rx="44" ry="6" fill="#0f172a" />

      <path d="M 190 260 C 190 180 210 80 240 40 C 270 80 290 180 290 260 Z" fill="url(#nose)" />
      <path d="M 205 255 C 207 180 220 90 240 55 C 235 100 225 200 222 255 Z" fill="url(#noseGloss)" />

      <text
        x="240"
        y="570"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="14"
        fontWeight="700"
        fill="#475569"
        opacity="0.6"
      >
        BMB-01
      </text>
    </motion.svg>
  );
}
