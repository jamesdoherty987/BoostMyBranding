'use client';

import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@boost/ui';

/**
 * Soft-blur overlay placed on top of premium UI when the current client
 * isn't subscribed. Keeps the interface discoverable (they can see exactly
 * what they'd get) while pointing them to the subscription page.
 */
export function LockedOverlay({
  title = 'Subscribe to unlock',
  description = 'Pick a plan to turn on content generation and publishing.',
  cta = 'See plans',
  href = '/subscription',
  className,
}: {
  title?: string;
  description?: string;
  cta?: string;
  href?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-[3px]',
        className,
      )}
    >
      <div className="mx-4 max-w-xs rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xl">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-cta text-white shadow-brand">
          <Lock className="h-5 w-5" />
        </div>
        <div className="mt-3 text-sm font-semibold text-slate-900">{title}</div>
        <p className="mt-1 text-xs text-slate-600">{description}</p>
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1 rounded-xl bg-gradient-cta px-3 py-2 text-xs font-semibold text-white shadow-brand"
        >
          {cta}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Wrap a locked feature tile with a clickable overlay. When locked, the
 * children render as a dimmed non-interactive preview; the whole area
 * routes to the subscribe screen.
 */
export function Lockable({
  locked,
  children,
  overlayTitle,
  overlayDescription,
}: {
  locked: boolean;
  children: ReactNode;
  overlayTitle?: string;
  overlayDescription?: string;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-60" aria-hidden>
        {children}
      </div>
      <LockedOverlay title={overlayTitle} description={overlayDescription} />
    </div>
  );
}
