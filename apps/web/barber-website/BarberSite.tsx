'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Phone,
  Mail,
  Clock,
  Menu,
  X,
  ArrowRight,
  LogIn,
} from 'lucide-react';
import { BARBER_IMAGES } from './images';
import { HERO_BACKGROUND } from './hero';

const BUSINESS = {
  name: 'Ash & Blade',
  tagline: 'Neighbourhood barbers on South William Street.',
  subheadline:
    'Classic and modern cuts, clean fades, and tidy beards — done right, on time.',
  address: '18 South William Street, Dublin 2',
  phone: '+353 1 555 0188',
  email: 'hello@ashandblade.ie',
  hours: ['Mon–Fri 9am–7pm', 'Sat 9am–5pm', 'Sun closed'],
};

const telHref = `tel:${BUSINESS.phone.replace(/\s/g, '')}`;

/**
 * Clean black-and-white barbershop landing page.
 * Sharp image corners, mobile-first spacing, no overlapping layers.
 *
 * Hero background: set `HERO_BACKGROUND.image` in ./hero.ts, or pass
 * an animation into <Hero animation={...} /> below.
 */
export function BarberSite() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-black">
      <Nav />
      {/* Pass animation={<YourEffect />} when you want motion behind the hero. */}
      <Hero />
      <Gallery />
      <Visit />
      <Footer />
    </main>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b bg-white transition-shadow ${
        scrolled ? 'border-black/10 shadow-sm' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <a
          href="#home"
          className="shrink-0 text-base font-bold tracking-tight text-black sm:text-lg"
        >
          {BUSINESS.name}
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#gallery" className="text-sm text-neutral-600 hover:text-black">
            Gallery
          </a>
          <a href="#visit" className="text-sm text-neutral-600 hover:text-black">
            Visit
          </a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/portal"
            className="inline-flex h-9 items-center gap-1.5 border border-black/15 px-3 text-sm font-medium text-black transition-colors hover:bg-neutral-50"
          >
            <LogIn className="h-3.5 w-3.5" />
            Customer portal
          </Link>
          <a
            href="#book"
            className="inline-flex h-9 items-center gap-1.5 bg-black px-4 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            <Calendar className="h-3.5 w-3.5" />
            Book
          </a>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center text-black md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-black/10 bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3">
            <a
              href="#gallery"
              onClick={() => setOpen(false)}
              className="border-b border-black/5 py-3.5 text-sm font-medium text-black"
            >
              Gallery
            </a>
            <a
              href="#visit"
              onClick={() => setOpen(false)}
              className="border-b border-black/5 py-3.5 text-sm font-medium text-black"
            >
              Visit
            </a>
            <Link
              href="/portal"
              onClick={() => setOpen(false)}
              className="border-b border-black/5 py-3.5 text-sm font-medium text-black"
            >
              Customer portal
            </Link>
            <a
              href="#book"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 bg-black text-sm font-medium text-white"
            >
              <Calendar className="h-4 w-4" />
              Book a chair
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function Hero({ animation }: { animation?: ReactNode } = {}) {
  const image = HERO_BACKGROUND.image;
  const hasBg = Boolean(image || animation);
  const overlay = HERO_BACKGROUND.overlay ?? 0.45;

  return (
    <section
      id="home"
      className={`relative isolate overflow-hidden border-b border-black/10 px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-28 md:pb-20 md:pt-32 ${
        hasBg ? 'bg-black' : 'bg-white'
      }`}
    >
      {/* Background layer — image and/or animation sit here, behind copy. */}
      {hasBg ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          {animation ? <div className="absolute inset-0">{animation}</div> : null}
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: overlay }}
          />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <p
          className={`text-[11px] font-medium uppercase tracking-[0.22em] sm:text-xs ${
            hasBg ? 'text-white/70' : 'text-neutral-500'
          }`}
        >
          Dublin 2 · Walk-ins welcome
        </p>

        <h1
          className={`mt-4 text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl ${
            hasBg ? 'text-white' : 'text-black'
          }`}
        >
          {BUSINESS.name}
        </h1>

        <p
          className={`mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed sm:mt-5 sm:text-lg ${
            hasBg ? 'text-white/80' : 'text-neutral-600'
          }`}
        >
          {BUSINESS.subheadline}
        </p>

        <div
          id="book"
          className="mt-8 flex w-full flex-col gap-3 sm:mx-auto sm:mt-10 sm:w-auto sm:flex-row sm:justify-center"
        >
          <a
            href={telHref}
            className={`inline-flex h-12 items-center justify-center gap-2 px-6 text-sm font-medium transition-opacity hover:opacity-80 ${
              hasBg ? 'bg-white text-black' : 'bg-black text-white'
            }`}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            Book a chair
          </a>
          <a
            href="#visit"
            className={`inline-flex h-12 items-center justify-center gap-2 border px-6 text-sm font-medium transition-colors ${
              hasBg
                ? 'border-white bg-transparent text-white hover:bg-white/10'
                : 'border-black bg-white text-black hover:bg-neutral-50'
            }`}
          >
            Visit us
            <ArrowRight className="h-4 w-4 shrink-0" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <section id="gallery" className="bg-white px-4 py-12 sm:px-6 sm:py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500 sm:text-xs">
            The shop
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-black sm:text-3xl md:text-4xl">
            From the chair.
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-2 sm:mt-10 sm:gap-3 md:grid-cols-3 md:gap-4">
          {BARBER_IMAGES.map((img, i) => (
            <div key={img.src} className="aspect-[4/5] overflow-hidden bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.alt}
                className="h-full w-full object-cover"
                loading={i < 2 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Visit() {
  return (
    <section
      id="visit"
      className="border-t border-black/10 bg-neutral-50 px-4 py-12 sm:px-6 sm:py-16 md:py-20"
    >
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:gap-14 md:items-start">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500 sm:text-xs">
            Visit
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-black sm:text-3xl md:text-4xl">
            Come sit down.
          </h2>
          <p className="mt-3 max-w-sm text-pretty text-base leading-relaxed text-neutral-600">
            {BUSINESS.tagline}
          </p>

          <a
            href={telHref}
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 bg-black px-6 text-sm font-medium text-white transition-opacity hover:opacity-80 sm:w-auto"
          >
            <Phone className="h-4 w-4 shrink-0" />
            Call to book
          </a>
        </div>

        <div className="divide-y divide-black/10 border border-black/10 bg-white">
          <InfoRow icon={MapPin} label="Address" value={BUSINESS.address} />
          <InfoRow icon={Phone} label="Phone" value={BUSINESS.phone} href={telHref} />
          <InfoRow
            icon={Mail}
            label="Email"
            value={BUSINESS.email}
            href={`mailto:${BUSINESS.email}`}
          />
          <InfoRow icon={Clock} label="Hours" value={BUSINESS.hours} />
        </div>
      </div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  value: string | string[];
  href?: string;
}) {
  const content = (
    <div className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-black/10 text-black">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </div>
        {Array.isArray(value) ? (
          <ul className="mt-1 space-y-0.5">
            {value.map((line) => (
              <li key={line} className="text-sm font-medium leading-snug text-black sm:text-base">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-1 break-words text-sm font-medium leading-snug text-black sm:text-base">
            {value}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block transition-colors hover:bg-neutral-50">
        {content}
      </a>
    );
  }
  return content;
}

function Footer() {
  return (
    <footer className="border-t border-black/10 bg-white px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-bold text-black">{BUSINESS.name}</div>
          <div className="mt-1 text-xs leading-relaxed text-neutral-500">{BUSINESS.tagline}</div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <Link
            href="/portal"
            className="inline-flex h-10 items-center justify-center gap-1.5 border border-black/15 px-3 text-sm font-medium text-black transition-colors hover:bg-neutral-50"
          >
            <LogIn className="h-3.5 w-3.5" />
            Customer portal
          </Link>
          <a
            href="#book"
            className="inline-flex h-10 items-center justify-center gap-1.5 bg-black px-4 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Book
          </a>
        </div>
      </div>
    </footer>
  );
}
