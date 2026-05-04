'use client';

/**
 * Dither-background hero. CSS-only retro bitmap pattern that works on
 * every browser without a WebGL/shader dependency. Deep-dark canvas
 * with a stippled overlay — feels modern-retro, good for tech-adjacent
 * trades, photography, design studios.
 */

import type { WebsiteConfig } from '@boost/core';
import { HeroCopy } from './HeroCopy';

interface HeroDitherProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroDither({ config, embedded }: HeroDitherProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-slate-950"
      style={{ minHeight: embedded ? '640px' : undefined }}
    >
      {/* Dither overlay — two interleaved radial grids at low opacity */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.12) 1px, transparent 1px), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '10px 10px, 10px 10px',
          backgroundPosition: '0 0, 5px 5px',
        }}
      />
      {/* Brand color wash so the dither doesn't look flat */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(var(--bmb-site-primary-rgb), 0.3) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-[640px] max-w-5xl flex-col items-center justify-center px-4 py-24 md:py-32">
        <HeroCopy config={config} dark align="center" motionDisabled={embedded} />
      </div>
    </section>
  );
}
