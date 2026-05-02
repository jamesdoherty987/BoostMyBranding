'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Badge, Button, Toaster } from '@boost/ui';
import {
  Coffee,
  Wrench,
  Globe,
  Grid2x2,
  Star,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ArrowRight,
  Heart,
  MessageCircle,
  Instagram,
  Facebook,
  Linkedin,
  ExternalLink,
  CalendarCheck,
  Clock,
  Sparkles,
} from 'lucide-react';

type Tab = 'websites' | 'social';

export default function ExamplesPage() {
  const [tab, setTab] = useState<Tab>('websites');

  return (
    <main className="overflow-x-hidden bg-white">
      <Navbar />

      <section className="relative pt-32 pb-14 md:pt-40 md:pb-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(50% 40% at 20% 0%, rgba(72,216,134,0.18), transparent 60%), radial-gradient(50% 40% at 80% 0%, rgba(29,156,161,0.18), transparent 60%), linear-gradient(180deg, #ffffff, #f8fafc)',
          }}
        />

        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="brand" className="mb-4">
              Our work
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Real sites. <span className="text-gradient-brand">Real content.</span>
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Flip between the websites we build and the kind of posts we write every month.
            </p>
          </div>

          {/* Segmented toggle */}
          <div className="mx-auto mt-10 flex max-w-md gap-2 rounded-full border border-slate-200 bg-white/70 p-1 shadow-sm backdrop-blur">
            <button
              onClick={() => setTab('websites')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                tab === 'websites'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="h-4 w-4" />
              Websites
            </button>
            <button
              onClick={() => setTab('social')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                tab === 'social'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid2x2 className="h-4 w-4" />
              Social posts
            </button>
          </div>

          <div className="mt-10 md:mt-14">
            <AnimatePresence mode="wait">
              {tab === 'websites' ? (
                <motion.div
                  key="websites"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-10"
                >
                  <BookedForYouSite />
                  <CafeSite />
                  <TradeSite />
                </motion.div>
              ) : (
                <motion.div
                  key="social"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                >
                  <SocialGrid />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CTA */}
          <div className="mx-auto mt-16 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Want this for your brand?
            </h2>
            <p className="mt-3 text-slate-600">
              Get started and you&apos;ll have your first month&apos;s content live in about a week.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/#how-it-works">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  See how it works
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <Toaster />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Browser chrome                                                     */
/* ------------------------------------------------------------------ */

function BrowserChrome({
  url,
  href,
  children,
}: {
  url: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-white px-3 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="truncate">{url}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
          </a>
        ) : (
          <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-xs text-slate-500">
            {url}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Website — BookedForYou.ie (real client, live site)                 */
/* ------------------------------------------------------------------ */

function BookedForYouSite() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <Badge tone="success" className="gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live site
          </Badge>
          <span className="text-xs text-slate-500">Built by us, shipped and online today</span>
        </div>
        <a
          href="https://bookedforyou.ie"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Visit bookedforyou.ie
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <BrowserChrome url="bookedforyou.ie" href="https://bookedforyou.ie">
        <div className="relative">
          <div className="relative h-[300px] w-full overflow-hidden md:h-[440px]">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(60% 50% at 20% 30%, rgba(72,216,134,0.55), transparent 60%), radial-gradient(60% 50% at 80% 20%, rgba(29,156,161,0.55), transparent 60%), linear-gradient(135deg, #0f2a32, #1D9CA1 55%, #48D886)',
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.35),transparent)]"
            />
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-white">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#FFEC3D]">
                  Bookings, simplified
                </p>
                <h3 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
                  Booked<span className="text-[#FFEC3D]">For</span>You
                </h3>
                <p className="mx-auto mt-3 max-w-md text-sm text-white/85 md:text-base">
                  A smarter way for Irish businesses to take bookings online — no
                  phone tag, no double-bookings.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Start taking bookings
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                    See how it works
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3 md:gap-6 md:p-10">
            {[
              {
                icon: CalendarCheck,
                title: '24/7 online booking',
                body: 'Customers book themselves in, day or night. Your calendar stays in sync.',
              },
              {
                icon: Clock,
                title: 'Automated reminders',
                body: 'SMS and email reminders cut no-shows without you lifting a finger.',
              },
              {
                icon: Sparkles,
                title: 'Built for Ireland',
                body: 'Irish payment methods, VAT-ready invoices, and local support when you need it.',
              },
            ].map((s) => (
              <div key={s.title} className="rounded-2xl border border-slate-200 p-4">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#48D886]/15 text-[#1D9CA1]">
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{s.title}</div>
                <p className="mt-1 text-xs text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 p-6 md:p-10">
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-slate-50 p-5 md:flex-row md:items-center">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-[#1D9CA1]">
                  Want to see it for real?
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  The full site is live at bookedforyou.ie
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Opens in a new tab — poke around, we won&apos;t be offended.
                </p>
              </div>
              <a
                href="https://bookedforyou.ie"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                Visit site
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </BrowserChrome>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Website 1 — Cafe (warm greens & earthy tones)                      */
/* ------------------------------------------------------------------ */

function CafeSite() {
  return (
    <BrowserChrome url="example-cafe.com">
      <div className="relative">
        <div className="relative h-[300px] w-full overflow-hidden md:h-[440px]">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 60% at 30% 40%, rgba(72,216,134,0.9), rgba(29,156,161,0.85) 60%, #0f2a32), linear-gradient(135deg, #0f2a32, #1D9CA1 60%, #48D886)',
            }}
          />
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.4),transparent)]" />
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-white">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#FFEC3D]">
                Small-batch · Single origin
              </p>
              <h3 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
                Coffee, slowly.
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm text-white/80 md:text-base">
                A neighbourhood cafe roasting one bean at a time.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                  <Calendar className="h-3.5 w-3.5" />
                  Book a tasting
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                  Our menu
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3 md:gap-6 md:p-10">
          {[
            { title: 'Espresso bar', body: 'Ethiopian, Colombian, Kenyan — rotating weekly.' },
            { title: 'Filter flight', body: 'Three brews, side by side. Our staff pick.' },
            { title: 'Beans to go', body: '250g bags ground to your gear. Subscribe monthly.' },
          ].map((s) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 p-4">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#48D886]/15 text-[#1D9CA1]">
                <Coffee className="h-4 w-4" />
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-900">{s.title}</div>
              <p className="mt-1 text-xs text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 border-t border-slate-100 p-6 md:grid-cols-3 md:p-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-1 text-[#FFEC3D]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="mt-3 text-base text-slate-800 md:text-lg">
              &ldquo;Best oat flat white in town. I&apos;d walk past three other places to get here.&rdquo;
            </p>
            <div className="mt-2 text-xs text-slate-500">— Happy customer</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5 text-sm">
            <div className="font-semibold text-slate-900">Visit us</div>
            <div className="mt-1 flex items-start gap-2 text-slate-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              14 High Street, Dublin 8
            </div>
            <div className="mt-1 flex items-start gap-2 text-slate-600">
              <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              +353 1 555 0142
            </div>
            <div className="mt-1 flex items-start gap-2 text-slate-600">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              hello@example-cafe.com
            </div>
          </div>
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ------------------------------------------------------------------ */
/* Website 2 — Trade services (dark, bold, urgent)                    */
/* ------------------------------------------------------------------ */

function TradeSite() {
  return (
    <BrowserChrome url="example-plumbing.com">
      <div className="relative bg-[#0b1220] text-white">
        <div className="relative h-[300px] w-full overflow-hidden md:h-[440px]">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(50% 60% at 80% 40%, rgba(29,156,161,0.7), transparent 60%), radial-gradient(60% 50% at 20% 60%, rgba(72,216,134,0.35), transparent 60%), linear-gradient(135deg, #0b1220, #0f2a32 50%, #134d55)',
            }}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-tr from-[#0b1220] via-[#0b1220]/60 to-transparent" />
          <div className="absolute inset-0 flex items-center px-6 md:px-12">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-[#48D886]" />
                Available right now
              </div>
              <h3 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
                Pipe burst at 2am?
                <br />
                <span className="text-[#48D886]">We&apos;re on it.</span>
              </h3>
              <p className="mt-4 text-white/80">
                24/7 emergency plumbing. 30-minute average response.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#FFEC3D] px-4 py-2 text-sm font-semibold text-slate-900">
                  <Phone className="h-3.5 w-3.5" />
                  Call now
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
                  Book online
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-6 md:grid-cols-4 md:p-10">
          {[
            { v: '30 min', l: 'Avg response' },
            { v: '4.9★', l: 'Google rating' },
            { v: '12 yrs', l: 'In business' },
            { v: '24/7', l: 'Callouts' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-2xl font-bold text-[#48D886] md:text-3xl">{s.v}</div>
              <div className="mt-1 text-xs text-white/60">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 p-6 md:p-10">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#FFEC3D]">
            Services
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { t: 'Emergency repairs', d: '24/7 callouts, fast response.' },
              { t: 'Boiler service', d: 'Annual servicing. Certified engineers.' },
              { t: 'Bathroom renovation', d: 'Design through to plumbing and fit-out.' },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D9CA1]/30 text-[#48D886]">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="mt-3 text-sm font-semibold text-white">{s.t}</div>
                <p className="mt-1 text-xs text-white/70">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ------------------------------------------------------------------ */
/* Social posts grid                                                  */
/* ------------------------------------------------------------------ */

interface SocialPost {
  brand: string;
  handle: string;
  platform: 'instagram' | 'facebook' | 'linkedin';
  caption: string;
  likes: number;
  comments: number;
  tileGradient: string;
  accentEmoji: string;
}

const POSTS: SocialPost[] = [
  {
    brand: 'Example Cafe',
    handle: '@examplecafe',
    platform: 'instagram',
    caption:
      'New single-origin on the bar from Wednesday ☕️ Ethiopia Yirgacheffe, jasmine, stone fruit, zero chaos.',
    likes: 412,
    comments: 28,
    tileGradient: 'linear-gradient(135deg, #0f2a32, #1D9CA1 50%, #48D886)',
    accentEmoji: '☕️',
  },
  {
    brand: 'Example Plumbing',
    handle: '@exampleplumbing',
    platform: 'facebook',
    caption:
      "Pipe burst? Don't panic. Here's the 60-second checklist that saves your floors before we get there.",
    likes: 176,
    comments: 34,
    tileGradient: 'linear-gradient(135deg, #0b1220, #134d55 55%, #48D886)',
    accentEmoji: '🛠',
  },
  {
    brand: 'Example Dental',
    handle: '@exampledental',
    platform: 'instagram',
    caption:
      'Meet your new favourite dental hygienist. Book in for a fresh start this month.',
    likes: 298,
    comments: 19,
    tileGradient: 'linear-gradient(135deg, #1D9CA1, #48D886 60%, #FFEC3D)',
    accentEmoji: '🦷',
  },
  {
    brand: 'Example Bakery',
    handle: '@examplebakery',
    platform: 'instagram',
    caption:
      'Saturday morning sourdough lineup. Plain, seeded, and the walnut-cranberry one that sells out by 9am.',
    likes: 623,
    comments: 41,
    tileGradient: 'linear-gradient(135deg, #FFEC3D, #48D886 60%, #1D9CA1)',
    accentEmoji: '🥖',
  },
  {
    brand: 'Example Yoga',
    handle: 'Example Yoga Studio',
    platform: 'facebook',
    caption:
      "Back-pain-friendly yoga, Tuesdays 7pm. No experience needed, we'll meet you where you are.",
    likes: 154,
    comments: 22,
    tileGradient: 'linear-gradient(135deg, #48D886, #1D9CA1 65%, #0f2a32)',
    accentEmoji: '🧘',
  },
  {
    brand: 'Example Interiors',
    handle: 'Example Interiors',
    platform: 'linkedin',
    caption:
      'Three lessons from our first year fitting out restaurants. Spoiler: the planning beats the build every time.',
    likes: 84,
    comments: 11,
    tileGradient: 'linear-gradient(135deg, #0f2a32, #1D9CA1 70%, #48D886)',
    accentEmoji: '🏗',
  },
  {
    brand: 'Example Fitness',
    handle: '@examplefitness',
    platform: 'instagram',
    caption:
      '4-week programme for new parents who want their energy back. 20 min a day, no gym needed.',
    likes: 389,
    comments: 47,
    tileGradient: 'linear-gradient(135deg, #FFEC3D, #1D9CA1 60%, #0f2a32)',
    accentEmoji: '💪',
  },
  {
    brand: 'Example Cafe',
    handle: '@examplecafe',
    platform: 'instagram',
    caption:
      "Rainy Thursday energy. Cinnamon bun + a flat white, that's the whole plan.",
    likes: 502,
    comments: 33,
    tileGradient: 'linear-gradient(135deg, #1D9CA1, #FFEC3D 60%, #48D886)',
    accentEmoji: '🌧',
  },
  {
    brand: 'Example Roofing',
    handle: 'Example Roofing Co',
    platform: 'facebook',
    caption:
      "Storm season's back. Free roof inspections this month.",
    likes: 132,
    comments: 18,
    tileGradient: 'linear-gradient(135deg, #0b1220, #1D9CA1 65%, #48D886)',
    accentEmoji: '🏠',
  },
];

function SocialGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
      {POSTS.map((p, i) => (
        <motion.article
          key={`${p.brand}-${i}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
                style={{ background: p.tileGradient, color: 'white' }}
              >
                {p.brand.slice(0, 1)}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">{p.brand}</div>
                <div className="text-[11px] text-slate-500">{p.handle}</div>
              </div>
            </div>
            <PlatformIcon platform={p.platform} />
          </div>

          <div
            aria-hidden
            className="relative aspect-square w-full overflow-hidden"
            style={{ background: p.tileGradient }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent)]" />
            <div className="absolute inset-0 flex items-center justify-center text-6xl">
              <span>{p.accentEmoji}</span>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/80">
              <span className="rounded-full bg-black/25 px-2 py-0.5 backdrop-blur-sm">
                {p.brand}
              </span>
              <span className="rounded-full bg-black/25 px-2 py-0.5 backdrop-blur-sm capitalize">
                {p.platform}
              </span>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="flex items-center gap-4 text-slate-600">
              <span className="inline-flex items-center gap-1 text-xs">
                <Heart className="h-4 w-4" /> {p.likes}
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <MessageCircle className="h-4 w-4" /> {p.comments}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-800">
              <span className="font-semibold">{p.handle} </span>
              {p.caption}
            </p>
          </div>
        </motion.article>
      ))}
    </div>
  );
}

function PlatformIcon({ platform }: { platform: SocialPost['platform'] }) {
  const shared = 'h-4 w-4';
  if (platform === 'instagram') return <Instagram className={`${shared} text-[#E1306C]`} />;
  if (platform === 'facebook') return <Facebook className={`${shared} text-[#1877F2]`} />;
  return <Linkedin className={`${shared} text-[#0A66C2]`} />;
}
