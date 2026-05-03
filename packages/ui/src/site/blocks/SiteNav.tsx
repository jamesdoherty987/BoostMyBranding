'use client';

import { useEffect, useState } from 'react';
import type { WebsiteConfig, PageConfig } from '@boost/core';
import { listPages } from '@boost/core';
import { useSiteContext } from '../context';

interface SiteNavProps {
  config: WebsiteConfig;
  businessName: string;
  /** When true, disables sticky positioning since embedded previews scroll
   *  inside a container rather than the viewport. */
  embedded?: boolean;
  /**
   * Slug of the page that's currently rendering. Used to mark the active
   * link when the site is multipage. Single-page sites pass nothing.
   */
  currentPageSlug?: string;
}

/**
 * Sticky glass nav that adapts to single-page or multipage sites.
 *
 *   Single page  → anchor links to `#services`, `#about` etc (same section).
 *   Multipage    → real page links (/sites/slug, /sites/slug/about, …).
 *                   The currently-active page is visually marked.
 *
 * Shrinks and pills up when scrolled so it never competes with hero copy
 * on first paint. In embedded/preview mode we drop to relative positioning
 * so the nav stays at the top of the captured region instead of floating
 * over the dashboard chrome.
 */
export function SiteNav({
  config,
  businessName,
  embedded,
  currentPageSlug,
}: SiteNavProps) {
  const { editMode } = useSiteContext();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (embedded) return; // Don't hook into window scroll inside a preview iframe.
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [embedded]);

  const pages = listPages(config);
  const isMultipage = pages.length > 1;
  const navItems = isMultipage
    ? buildMultipageItems(pages)
    : buildAnchorItems(config);

  const ctaLabel = config.hero?.ctaPrimary?.label ?? 'Get in touch';
  // CTAs in multipage mode should always go to the Contact page (or an
  // anchor on the current page if contact isn't a separate page).
  const ctaHref = isMultipage
    ? pages.some((p) => p.slug === 'contact')
      ? buildPageHref('contact', currentPageSlug)
      : '#contact'
    : (config.hero?.ctaPrimary?.href ?? '#contact');

  // Link behavior: in edit mode inside the dashboard preview, we don't want
  // nav clicks to navigate away from the current editing session.
  const preventNav = editMode
    ? (e: React.MouseEvent) => e.preventDefault()
    : undefined;

  const homeHref = isMultipage ? buildPageHref('home', currentPageSlug) : '#top';

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
        <a
          href={homeHref}
          onClick={preventNav}
          className="flex items-center gap-2"
          aria-label={`${businessName} home`}
        >
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
          {navItems.map((item) => {
            const isActive =
              isMultipage &&
              item.pageSlug &&
              (item.pageSlug === currentPageSlug ||
                (item.pageSlug === 'home' && (currentPageSlug === 'home' || !currentPageSlug)));
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={preventNav}
                aria-current={isActive ? 'page' : undefined}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                style={
                  isActive
                    ? { color: 'var(--bmb-site-primary)' }
                    : undefined
                }
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <a
          href={ctaHref}
          onClick={preventNav}
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

/**
 * Build nav items for a multipage site. One item per page except
 * `contact` which the CTA already covers — it would feel redundant.
 */
function buildMultipageItems(pages: PageConfig[]) {
  return pages
    .filter((p) => p.slug !== 'contact')
    .map((p) => ({
      label: p.title,
      href: buildPageHref(p.slug),
      pageSlug: p.slug,
    }));
}

/**
 * Anchor-only nav for single-page sites. Uses the configured `navigation`
 * array if present, otherwise falls back to a sensible default.
 */
function buildAnchorItems(config: WebsiteConfig) {
  const labels = config.navigation ?? ['Home', 'Services', 'About', 'Contact'];
  return labels.map((label) => ({
    label,
    href: label.toLowerCase() === 'home' ? '#top' : `#${label.toLowerCase()}`,
    pageSlug: undefined,
  }));
}

/**
 * Build a URL for a page within the current site. Relative paths so the
 * nav works on both the default `/sites/[slug]` host and on attached
 * custom domains — the browser resolves `./about` the same either way.
 *
 * When we already have a `currentPageSlug`, navigating between sub-pages
 * has to hop back to the root first — a straight `./contact` from
 * `/sites/foo/about` would incorrectly resolve to `/sites/foo/about/contact`.
 */
function buildPageHref(targetSlug: string, currentPageSlug?: string): string {
  const isOnSubPage = currentPageSlug && currentPageSlug !== 'home';
  if (targetSlug === 'home') {
    return isOnSubPage ? '..' : '#top';
  }
  return isOnSubPage ? `../${targetSlug}` : `./${targetSlug}`;
}
