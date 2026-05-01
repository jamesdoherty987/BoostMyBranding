'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Badge } from '@boost/ui';
import { Shell } from '@/components/Shell';
import {
  Download,
  Share,
  PlusSquare,
  MoreVertical,
  Smartphone,
  Monitor,
  Check,
} from 'lucide-react';

type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function useIsInstalled() {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    setInstalled(mq.matches);
    const handler = (e: MediaQueryListEvent) => setInstalled(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return installed;
}

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const isInstalled = useIsInstalled();
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    await (deferredPrompt as any).userChoice;
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <Shell title="Install the app">
        <div className="flex flex-col items-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#48D886]/15">
            <Check className="h-8 w-8 text-[#48D886]" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Already installed</h2>
          <p className="mt-2 max-w-xs text-sm text-slate-600">
            You&apos;re using the app right now. It&apos;ll show up on your home screen like any other app.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Install the app">
      <div className="space-y-4">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-[#1D9CA1] to-[#48D886] p-5 text-white"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Download className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Get the app</h2>
              <p className="text-sm text-white/80">
                Add BMB Portal to your home screen for quick access.
              </p>
            </div>
          </div>

          {/* Native install button — Chrome/Edge on Android & desktop */}
          {deferredPrompt && (
            <Button
              onClick={handleInstallClick}
              size="lg"
              className="mt-4 w-full bg-white text-[#1D9CA1] hover:bg-white/90"
            >
              <Download className="h-4 w-4" />
              Install now
            </Button>
          )}
        </motion.div>

        {/* Platform-specific instructions */}
        {platform === 'ios' && <IOSInstructions />}
        {platform === 'android' && <AndroidInstructions />}
        {platform === 'desktop' && <DesktopInstructions />}
        {platform === 'unknown' && <GenericInstructions />}

        {/* What you get */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">What you get</h3>
          <ul className="mt-3 space-y-2.5">
            {[
              'Opens instantly from your home screen',
              'Full-screen experience, no browser bar',
              'Push notifications when we message you',
              'Works offline for viewing recent posts',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#48D886]" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

function IOSInstructions() {
  const steps = [
    {
      icon: Share,
      title: 'Tap the Share button',
      body: 'At the bottom of Safari, tap the share icon (square with an arrow).',
    },
    {
      icon: PlusSquare,
      title: 'Tap "Add to Home Screen"',
      body: 'Scroll down in the share sheet and tap "Add to Home Screen".',
    },
    {
      icon: Check,
      title: 'Tap "Add"',
      body: 'Confirm the name and tap Add. The app icon will appear on your home screen.',
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">iPhone / iPad</h3>
        <Badge tone="brand">Safari only</Badge>
      </div>
      <ol className="mt-4 space-y-4">
        {steps.map((s, i) => (
          <motion.li
            key={s.title}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex gap-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1D9CA1]/10 text-[#1D9CA1]">
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {i + 1}. {s.title}
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{s.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function AndroidInstructions() {
  const steps = [
    {
      icon: MoreVertical,
      title: 'Tap the menu (⋮)',
      body: 'In Chrome, tap the three dots in the top-right corner.',
    },
    {
      icon: PlusSquare,
      title: 'Tap "Add to Home screen"',
      body: 'Select "Add to Home screen" or "Install app" from the menu.',
    },
    {
      icon: Check,
      title: 'Confirm',
      body: 'Tap "Add" and the app will appear on your home screen.',
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Android</h3>
        <Badge tone="brand">Chrome</Badge>
      </div>
      <ol className="mt-4 space-y-4">
        {steps.map((s, i) => (
          <motion.li
            key={s.title}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex gap-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1D9CA1]/10 text-[#1D9CA1]">
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {i + 1}. {s.title}
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{s.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function DesktopInstructions() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Desktop</h3>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        In Chrome or Edge, look for the install icon in the address bar (a monitor with a
        down arrow), or use the browser menu → &quot;Install BoostMyBranding&quot;.
      </p>
    </section>
  );
}

function GenericInstructions() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">How to install</h3>
      <p className="mt-2 text-sm text-slate-600">
        Open this page in Safari (iPhone) or Chrome (Android/Desktop), then use the
        browser&apos;s &quot;Add to Home Screen&quot; or &quot;Install&quot; option.
      </p>
    </section>
  );
}
