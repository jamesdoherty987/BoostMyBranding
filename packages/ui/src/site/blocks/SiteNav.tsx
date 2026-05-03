'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import type { WebsiteConfig, PageConfig } from '@boost/core';
import { listPages } from '@boost/core';
import { useSiteContext } from '../context';

interface SiteNavProps {
  config: WebsiteConfig;
  businessName: string;
  embedded?: boolean;
  currentPageSlug?: string;
}

/**
 * Sticky glass nav with a mobile hamburger drawer. Adapts to single-page
 * (anchor links) or multipage (real page links) sites.
 *
 * On mobile (<md) the nav links are hidden behind a hamburger icon that
 * opens a full-width slide-down drawer. This is critical for small
 * business sites where 70%+ of traffic is mobile.
 */
export function SiteNav({
  config,
  businessName,
  embedded,
  currentPageSlug,
}: SiteNavProps) {
  const { editMode } = useSiteContext();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (embedded) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [embedded]);

  // Close mobile menu on resize past breakpoint.
  useEffect(() => {
    if (!mobileOpen) return;
    const close = () => setMobileOpen(false);
    const mq = window.matchMedia('(min-width: 768px)');
    mq.addEventListener('change', close);
    return () => mq.removeEventListener('change', close);
  }, [mobileOpen]);

  // Close mobile menu when the URL changes — matters for multipage sites
  // where clicking a link triggers real navigation instead of just scroll.
  // We poll because Next.js's router events aren't available here (the
  // renderer runs inside apps/web but also gets embedded in the dashboard
  // preview, which isn't a Next.js navigation context).
  useEffect(() => {
    if (!mobileOpen) return;
    let lastPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const interval = setInterval(() => {
      if (typeof window === 'undefined') return;
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        setMobileOpen(false);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [mobileOpen]);

  const pages = listPages(config);
  const isMultipage = pages.length > 1;
  const navItems = isMultipage
    ? buildMultipageItems(pages)
    : buildAnchorItems(config);

  const ctaLabel = config.hero?.ctaPrimary?.label ?? 'Get in touch';
  const ctaHref = isMultipage
    ? pages.some((p) => p.slug === 'contact')
      ? buildPageHref('contact', currentPageSlug)
      : '#contact'
    : (config.hero?.ctaPrimary?.href ?? '#contact');

  const preventNav = editMode
    ? (e: React.MouseEvent) => e.preventDefault()
    : undefined;

  const handleMobileLink = (e: React.MouseEvent) => {
    if (editMode) {
      e.preventDefault();
      return;
    }
    setMobileOpen(false);
  };

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
        {/* Logo */}
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

        {/* Desktop nav */}
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
                style={isActive ? { color: 'var(--bmb-site-primary)' } : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Desktop CTA */}
          <a
            href={ctaHref}
            onClick={preventNav}
            className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.02] md:inline-flex"
            style={{
              background: 'var(--bmb-site-primary)',
              color: 'var(--bmb-site-on-primary)',
            }}
          >
            {ctaLabel}
          </a>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden md:hidden"
          >
            <nav
              className="mx-4 mt-2 flex flex-col gap-1 rounded-2xl border border-slate-200/70 bg-white/95 p-3 shadow-lg backdrop-blur-xl"
              aria-label="Mobile"
            >
              {navItems.map((item) => {
                const isActive =
                  isMultipage &&
                  item.pageSlug &&
                  (item.pageSlug === currentPageSlug ||
                    (item.pageSlug === 'home' &&
                      (currentPageSlug === 'home' || !currentPageSlug)));
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={handleMobileLink}
                    className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    style={isActive ? { color: 'var(--bmb-site-primary)' } : undefined}
                  >
                    {item.label}
                  </a>
                );
              })}
              <a
                href={ctaHref}
                onClick={handleMobileLink}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm"
                style={{ background: 'var(--bmb-site-primary)' }}
              >
                {ctaLabel}
              </a>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function buildMultipageItems(pages: PageConfig[]) {
  return pages
    .filter((p) => p.slug !== 'contact')
    .map((p) => ({
      label: p.title,
      href: buildPageHref(p.slug),
      pageSlug: p.slug,
    }));
}

function buildAnchorItems(config: WebsiteConfig) {
  const labels = config.navigation ?? ['Home', 'Services', 'About', 'Contact'];
  return labels.map((label) => ({
    label,
    href: label.toLowerCase() === 'home' ? '#top' : `#${label.toLowerCase()}`,
    pageSlug: undefined,
  }));
}

function buildPageHref(targetSlug: string, currentPageSlug?: string): string {
  const isOnSubPage = currentPageSlug && currentPageSlug !== 'home';
  if (targetSlug === 'home') {
    return isOnSubPage ? '..' : '#top';
  }
  return isOnSubPage ? `../${targetSlug}` : `./${targetSlug}`;
}
