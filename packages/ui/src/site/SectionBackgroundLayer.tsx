'use client';

/**
 * Decorative background effect applied BEHIND a section's content. The
 * renderer looks up the per-block entry in `config.sectionBackgrounds`
 * and wraps the section with this layer.
 *
 * Every effect is:
 *   - absolute-positioned to fill the section
 *   - pointer-events: none so clicks go through to the content
 *   - keyed to the brand palette via CSS variables when no explicit
 *     tint is set — a grid on the services section picks up the brand
 *     primary colour automatically
 *
 * Performance: grid / dots / noise / gradient / mesh / beams / ripple
 * / shooting-stars are pure CSS (zero JS cost). Sparkles / particles /
 * meteors reuse Aceternity primitives already in the bundle.
 */

import type { SectionBackground } from '@boost/core';
import { SparklesCore } from '../aceternity/ui/sparkles';
import { Meteors } from '../aceternity/ui/meteors';

interface SectionBackgroundLayerProps {
  background: SectionBackground | undefined;
  /** Whether the section is rendered on a dark surface — flips defaults. */
  dark?: boolean;
}

export function SectionBackgroundLayer({
  background,
  dark,
}: SectionBackgroundLayerProps) {
  if (!background || background.kind === 'none') return null;

  const opacity = clamp(
    background.opacity ?? defaultOpacityFor(background.kind),
    0,
    1,
  );
  const tint = background.tint ?? 'var(--bmb-site-primary)';

  switch (background.kind) {
    case 'grid':
      // Pure CSS grid — a repeating linear-gradient pattern faded at
      // the edges so the grid doesn't cut hard into neighbouring
      // sections. 40px cell size reads as "technical grid" without
      // feeling like a spreadsheet.
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity,
            backgroundImage: `linear-gradient(to right, ${tint} 1px, transparent 1px), linear-gradient(to bottom, ${tint} 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            maskImage:
              'radial-gradient(ellipse 80% 60% at 50% 50%, #000 55%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 60% at 50% 50%, #000 55%, transparent 100%)',
          }}
        />
      );

    case 'dots':
      // Pure CSS dot grid via a single radial-gradient tile.
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity,
            backgroundImage: `radial-gradient(${tint} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            maskImage:
              'radial-gradient(ellipse 80% 60% at 50% 50%, #000 55%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 60% at 50% 50%, #000 55%, transparent 100%)',
          }}
        />
      );

    case 'noise':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
          }}
        />
      );

    case 'gradient':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity,
            background: `radial-gradient(1200px 600px at 50% 0%, ${tint} 0%, transparent 60%), radial-gradient(800px 400px at 100% 100%, var(--bmb-site-accent) 0%, transparent 55%)`,
          }}
        />
      );

    case 'mesh':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity,
            background: `conic-gradient(from 180deg at 50% 50%, ${tint}, var(--bmb-site-accent), ${tint})`,
            filter: 'blur(80px)',
          }}
        />
      );

    case 'sparkles':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ opacity }}
        >
          <SparklesCore
            background="transparent"
            particleColor={tint}
            particleDensity={60}
            minSize={0.4}
            maxSize={1.0}
            className="h-full w-full"
          />
        </div>
      );

    case 'particles':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ opacity }}
        >
          <SparklesCore
            background="transparent"
            particleColor={tint}
            particleDensity={120}
            minSize={0.2}
            maxSize={0.6}
            className="h-full w-full"
          />
        </div>
      );

    case 'meteors':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ opacity }}
        >
          <Meteors number={20} />
        </div>
      );

    case 'beams':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ opacity }}
        >
          <div
            className="absolute -inset-[200%]"
            style={{
              background: `conic-gradient(from 0deg at 50% 50%, transparent 340deg, ${tint} 360deg, transparent 20deg)`,
              animation: 'spin 40s linear infinite',
            }}
          />
        </div>
      );

    case 'ripple':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ opacity }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full border"
              style={{
                width: `${(i + 1) * 200}px`,
                height: `${(i + 1) * 200}px`,
                borderColor: tint,
                transform: 'translate(-50%, -50%)',
                animation: `bmb-ripple 4s ${i * 0.5}s infinite ease-out`,
              }}
            />
          ))}
        </div>
      );

    case 'shooting-stars':
      return (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ opacity }}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="absolute"
              style={{
                top: `${(i * 13) % 100}%`,
                left: `-10%`,
                width: '80px',
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${tint})`,
                animation: `bmb-shoot ${3 + (i % 4)}s ${i * 0.7}s linear infinite`,
              }}
            />
          ))}
        </div>
      );

    default:
      return null;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function defaultOpacityFor(kind: SectionBackground['kind']): number {
  switch (kind) {
    case 'grid':
    case 'dots':
      return 0.35;
    case 'noise':
      return 0.15;
    case 'gradient':
      return 0.35;
    case 'mesh':
      return 0.25;
    case 'sparkles':
    case 'particles':
      return 0.6;
    case 'meteors':
      return 0.7;
    case 'beams':
      return 0.2;
    case 'ripple':
      return 0.25;
    case 'shooting-stars':
      return 0.5;
    default:
      return 0.5;
  }
}
