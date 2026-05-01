'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Logo } from '@boost/ui';
import { Menu, X } from 'lucide-react';

const links = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '/examples', label: 'Examples' },
  { href: '/blog', label: 'Blog' },
  { href: '#pricing', label: 'Pricing' },
];

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3001';

/**
 * Sticky navbar that flips between "dark hero" mode (transparent, white
 * text) and "scrolled" mode (glass pill, dark text). We watch scrollY so
 * the logo is always readable on whatever is behind it.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkBase = 'text-sm font-medium transition-colors';
  const linkColor = scrolled
    ? 'text-slate-600 hover:text-slate-900'
    : 'text-slate-700 hover:text-slate-900';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all ${
        scrolled ? 'py-2' : 'py-4'
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-4 transition-all duration-300 ${
          scrolled
            ? 'rounded-2xl border border-slate-200/70 bg-white/85 py-2 shadow-lg backdrop-blur-xl md:px-4'
            : ''
        }`}
      >
        <Link href="/" aria-label="BoostMyBranding home">
          <Logo size="lg" variant="default" />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`${linkBase} ${linkColor}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href={PORTAL_URL}>
            <Button
              variant="ghost"
              size="sm"
              className={scrolled ? '' : 'text-slate-700 hover:bg-white/60'}
            >
              Client login
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Start free trial</Button>
          </Link>
        </div>
        <button
          className={`md:hidden rounded-xl p-2 ${
            scrolled
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-700 hover:bg-white/60'
          }`}
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex gap-2">
              <Link href={PORTAL_URL} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  Client login
                </Button>
              </Link>
              <Link href="/signup" className="flex-1" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full">
                  Start free trial
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
