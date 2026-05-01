'use client';

import { useEffect, useState } from 'react';
import type { WebsiteConfig } from '@boost/core';

interface SiteNavProps {
  config: WebsiteConfig;
  businessName: string;
  /** When true, disables sticky positioning since embedded previews scroll
   *  inside a container rather than the viewport. */
  embedded?: boolean;
}

/**
 * Sticky glass nav. Shrinks and pills up when scrolled so it never competes
 * with the hero copy on first paint. In embedded/preview mode we drop to
 * relative positioning so the nav stays at the top of the captured region
 * instead of floating over the dashboard chrome.
 */
export function SiteNav({ config, businessName, embedded }: SiteNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const items = config.navigation ?? ['Home', 'Services', 'About', 'Contact'];

  useEffect(() => {
    if (embedded) return; // Don't hook into window scroll inside a preview iframe.
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [embedded]);

  const ctaLabel = config.hero?.ctaPrimary?.label ?? 'Get in touch';
  const ctaHref = config.hero?.ctaPrimary?.href ?? '#contact';

  return (
    <header
      className={`${embedded ? 'relative' : 'sticky top-0'} z-40 w-full transition-all ${
        scrolled ? 'py-2' : 'py-4'
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-4 transition-all duration-300 ${
          scrolled
            ? 'rounded-2xl border border-slate-200/70 bg-white/85 py-2 shadow-md backdrop-blur-xl'
            : ''
        }`}
      >
        <a href="#top" className="flex items-center gap-2" aria-label={`${businessName} home`}>
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
            style={{
              background: 'var(--bmb-site-primary)',
              color: 'var(--bmb-site-on-primary)',
            }}
            aria-hidden
          >
            {businessName.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-slate-900">{businessName}</span>
        </a>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {items.map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              {label}
            </a>
          ))}
        </nav>
        <a
          href={ctaHref}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.02]"
          style={{
            background: 'var(--bmb-site-primary)',
            color: 'var(--bmb-site-on-primary)',
          }}
        >
          {ctaLabel}
        </a>
      </div>
    </header>
  );
}
