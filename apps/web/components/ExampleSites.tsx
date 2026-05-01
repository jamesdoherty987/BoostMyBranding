'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, Button, SectionWrapper } from '@boost/ui';
import { Coffee, Wrench, Star, Phone, Mail, Calendar, MapPin, ArrowRight } from 'lucide-react';

type SiteKey = 'cafe' | 'plumber';

/**
 * Two example client sites rendered as interactive browser-frame previews.
 * The user can toggle between them without leaving the landing page, which
 * is a lot more convincing than a static screenshot.
 */
export function ExampleSites() {
  const [active, setActive] = useState<SiteKey>('cafe');

  return (
    <SectionWrapper className="relative overflow-hidden py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="brand" className="mb-4">
            Websites, built for you
          </Badge>
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Two real sites. <span className="text-gradient-brand">Built by us.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Every Full Package client gets a fast, modern, mobile-first website. Swap between two samples below.
          </p>
        </div>

        <div className="mx-auto mt-10 flex max-w-md gap-2 rounded-full bg-slate-100 p-1">
          <button
            onClick={() => setActive('cafe')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              active === 'cafe' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Coffee className="h-4 w-4" />
            Verde Cafe
          </button>
          <button
            onClick={() => setActive('plumber')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              active === 'plumber' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Wrench className="h-4 w-4" />
            Murphy&apos;s Plumbing
          </button>
        </div>

        <div className="mt-10">
          <AnimatePresence mode="wait">
            {active === 'cafe' ? (
              <motion.div
                key="cafe"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45 }}
              >
                <VerdeCafeSite />
              </motion.div>
            ) : (
              <motion.div
                key="plumber"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45 }}
              >
                <MurphysPlumbingSite />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </SectionWrapper>
  );
}

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-xs text-slate-500">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

function VerdeCafeSite() {
  return (
    <BrowserChrome url="verdecafe.ie">
      <div className="relative">
        <div className="relative h-[320px] w-full overflow-hidden md:h-[460px]">
          <Image
            src="https://picsum.photos/seed/verde-hero/1600/900"
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220]/80 via-[#0b1220]/30 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center text-center text-white">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#FFEC3D]/90">
                Small-batch · Single origin
              </p>
              <h3 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
                Coffee, slowly.
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm text-white/80 md:text-base">
                Verde Cafe roasts one bean at a time in the heart of Dublin 8.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90">
                  <Calendar className="h-3.5 w-3.5" />
                  Book a tasting
                </Button>
                <Button size="sm" variant="outline" className="border-white/60 bg-white/10 text-white hover:bg-white/20">
                  Our menu
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 p-6 md:gap-6 md:p-10">
          {[
            { title: 'Espresso bar', body: 'Ethiopian, Colombian, Kenyan — rotating weekly.' },
            { title: 'Filter flight', body: 'Three brews, side by side. Our staff pick.' },
            { title: 'Beans to go', body: '250g bags ground to your gear. Subscribe monthly.' },
          ].map((s) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 p-4">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#22C55E]/10 text-[#22C55E]">
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
              {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
            </div>
            <p className="mt-3 text-base text-slate-800 md:text-lg">
              &ldquo;Best oat flat white in Dublin. Knowing what I know now, I&apos;d walk past three other places to get here.&rdquo;
            </p>
            <div className="mt-2 text-xs text-slate-500">— Ciara D., five visits this month</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5 text-sm">
            <div className="font-semibold text-slate-900">Visit us</div>
            <div className="mt-1 flex items-start gap-2 text-slate-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              14 Meath Street, Dublin 8
            </div>
            <div className="mt-1 flex items-start gap-2 text-slate-600">
              <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              +353 1 555 0142
            </div>
            <div className="mt-1 flex items-start gap-2 text-slate-600">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              hello@verdecafe.ie
            </div>
            <div className="mt-3 text-xs text-slate-500">Mon–Fri 7am–6pm · Sat–Sun 8am–5pm</div>
          </div>
        </div>
      </div>
    </BrowserChrome>
  );
}

function MurphysPlumbingSite() {
  return (
    <BrowserChrome url="murphysplumbing.ie">
      <div className="relative bg-[#0b1220] text-white">
        <div className="relative h-[320px] w-full overflow-hidden md:h-[460px]">
          <Image
            src="https://picsum.photos/seed/murphy-hero/1600/900"
            alt=""
            fill
            className="object-cover opacity-60"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#0b1220] via-[#0b1220]/70 to-transparent" />
          <div className="absolute inset-0 flex items-center px-6 md:px-12">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
                Available right now
              </div>
              <h3 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
                Pipe burst at 2am?
                <br />
                <span className="text-[#0EA5E9]">We&apos;re on it.</span>
              </h3>
              <p className="mt-4 text-white/80">
                24/7 emergency plumbing across Dublin and North Kildare. 30-minute average response.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button size="md" className="bg-[#F59E0B] text-slate-900 hover:brightness-110">
                  <Phone className="h-4 w-4" />
                  Call 01 555 7210
                </Button>
                <Button size="md" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10">
                  Book online
                  <ArrowRight className="h-4 w-4" />
                </Button>
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
              <div className="text-2xl font-bold text-[#0EA5E9] md:text-3xl">{s.v}</div>
              <div className="mt-1 text-xs text-white/60">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 p-6 md:p-10">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#F59E0B]">
            Services
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { t: 'Emergency repairs', d: '24/7 callouts across Dublin and Kildare.' },
              { t: 'Boiler service', d: 'Annual servicing from €120. Certified engineers.' },
              { t: 'Bathroom renovation', d: 'From design through to plumbing and fit-out.' },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0EA5E9]/20 text-[#0EA5E9]">
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
