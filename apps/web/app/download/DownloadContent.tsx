'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@boost/ui';
import {
  Download,
  Share,
  PlusSquare,
  MoreVertical,
  Smartphone,
  Monitor,
  Check,
  ArrowRight,
  Zap,
  Bell,
  Wifi,
  Rocket,
} from 'lucide-react';
import Link from 'next/link';

type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3000/portal';

export function DownloadContent() {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <section className="relative pt-32 pb-20 md:pt-40">
      {/* Background */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(50% 40% at 30% 0%, rgba(72,216,134,0.15), transparent 60%), radial-gradient(50% 40% at 70% 0%, rgba(29,156,161,0.15), transparent 60%), linear-gradient(180deg, #ffffff, #f8fafc)',
        }}
      />

      <div className="mx-auto max-w-3xl px-4">
        {/* Hero */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#1D9CA1] to-[#48D886] shadow-lg"
          >
            <Download className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Get the app
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-slate-600">
            Install the BoostMyBranding portal on your phone for instant access to your
            dashboard, chat, and calendar.
          </p>
          <div className="mt-6">
            <Link href={PORTAL_URL}>
              <Button size="lg">
                Open the portal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: Zap, title: 'Instant access', body: 'Opens from your home screen' },
            { icon: Monitor, title: 'Full screen', body: 'No browser bar, feels native' },
            { icon: Bell, title: 'Notifications', body: 'Know when we message you' },
            { icon: Wifi, title: 'Works offline', body: 'View recent posts anytime' },
          ].map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-center"
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D9CA1]/10 text-[#1D9CA1]">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">{b.title}</h3>
              <p className="mt-1 text-xs text-slate-600">{b.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Platform instructions */}
        <div className="mt-16 space-y-6">
          <h2 className="text-center text-xl font-bold text-slate-900 md:text-2xl">
            How to install
          </h2>

          {/* Show detected platform first, then others collapsed */}
          {platform === 'ios' && <IOSSteps highlight />}
          {platform === 'android' && <AndroidSteps highlight />}
          {platform === 'desktop' && <DesktopSteps highlight />}

          {/* Other platforms */}
          <details className="rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
              {platform === 'ios'
                ? 'Android & Desktop instructions'
                : platform === 'android'
                  ? 'iPhone & Desktop instructions'
                  : 'iPhone & Android instructions'}
            </summary>
            <div className="space-y-4 px-5 pb-5">
              {platform !== 'ios' && <IOSSteps />}
              {platform !== 'android' && <AndroidSteps />}
              {platform !== 'desktop' && <DesktopSteps />}
            </div>
          </details>
        </div>

        {/* Final CTA */}
        <div className="mt-16 rounded-2xl bg-slate-900 p-6 text-center text-white md:p-10">
          <Rocket className="mx-auto h-8 w-8 text-[#48D886]" />
          <h2 className="mt-4 text-xl font-bold md:text-2xl">Ready?</h2>
          <p className="mt-2 text-sm text-white/70">
            Open the portal in your browser, then follow the steps above to install.
          </p>
          <Link href={PORTAL_URL} className="mt-5 inline-block">
            <Button size="lg" className="bg-[#48D886] text-slate-900 hover:bg-[#3cc878]">
              Go to portal
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Platform instruction cards                                         */
/* ------------------------------------------------------------------ */

function IOSSteps({ highlight }: { highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 ${
        highlight ? 'border-[#1D9CA1] ring-2 ring-[#1D9CA1]/10' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-900">iPhone / iPad</h3>
        {highlight && (
          <span className="rounded-full bg-[#1D9CA1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1D9CA1]">
            Your device
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">Use Safari — Chrome on iOS doesn&apos;t support PWA install.</p>
      <ol className="mt-4 space-y-3">
        {[
          { icon: Share, text: 'Tap the Share button at the bottom of Safari' },
          { icon: PlusSquare, text: 'Scroll down and tap "Add to Home Screen"' },
          { icon: Check, text: 'Tap "Add" to confirm' },
        ].map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1D9CA1]/10 text-[#1D9CA1]">
              <s.icon className="h-3.5 w-3.5" />
            </div>
            <span className="pt-0.5 text-sm text-slate-700">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AndroidSteps({ highlight }: { highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 ${
        highlight ? 'border-[#48D886] ring-2 ring-[#48D886]/10' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-900">Android</h3>
        {highlight && (
          <span className="rounded-full bg-[#48D886]/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Your device
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">Works in Chrome, Edge, and Samsung Internet.</p>
      <ol className="mt-4 space-y-3">
        {[
          { icon: MoreVertical, text: 'Tap the three-dot menu (⋮) in the top right' },
          { icon: PlusSquare, text: 'Tap "Add to Home screen" or "Install app"' },
          { icon: Check, text: 'Tap "Add" to confirm' },
        ].map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#48D886]/10 text-[#48D886]">
              <s.icon className="h-3.5 w-3.5" />
            </div>
            <span className="pt-0.5 text-sm text-slate-700">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DesktopSteps({ highlight }: { highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 ${
        highlight ? 'border-[#FFEC3D] ring-2 ring-[#FFEC3D]/20' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-900">Desktop</h3>
        {highlight && (
          <span className="rounded-full bg-[#FFEC3D]/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Your device
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">Chrome, Edge, or Brave.</p>
      <ol className="mt-4 space-y-3">
        {[
          { icon: Monitor, text: 'Look for the install icon (⊕) in the address bar' },
          { icon: Download, text: 'Or use the browser menu → "Install BoostMyBranding"' },
          { icon: Check, text: 'Click "Install" to add it to your dock/taskbar' },
        ].map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FFEC3D]/15 text-amber-600">
              <s.icon className="h-3.5 w-3.5" />
            </div>
            <span className="pt-0.5 text-sm text-slate-700">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
