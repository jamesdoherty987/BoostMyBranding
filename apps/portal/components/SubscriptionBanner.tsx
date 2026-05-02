'use client';

import Link from 'next/link';
import { Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSubscription } from '@/lib/subscription';

/**
 * Slim status banner rendered at the top of every Shell page. Friendly nudge
 * when the client hasn't subscribed yet; alert tone for past_due / canceled.
 * Hides itself on the /subscription page itself (no point nagging there).
 */
export function SubscriptionBanner() {
  const pathname = usePathname();
  const { subscription } = useSubscription();

  if (!subscription) return null;
  if (subscription.active) return null;
  if (pathname?.startsWith('/subscription')) return null;

  const isPastDue = subscription.status === 'past_due';
  const isCanceled = subscription.status === 'canceled';
  const isWarning = isPastDue || isCanceled;

  const copy = isPastDue
    ? 'Payment issue — update your card to keep your content flowing.'
    : isCanceled
      ? 'Your subscription ended. Resubscribe to pick up where you left off.'
      : 'Have a look around. Subscribe when you\'re ready to start publishing.';

  const cta = subscription.hasCustomer ? 'Fix billing' : 'See plans';

  return (
    <Link
      href="/subscription"
      className={`mx-4 mt-3 flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-colors ${
        isWarning
          ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
          : 'border-transparent bg-gradient-to-r from-[#48D886]/10 to-[#1D9CA1]/10 text-slate-800 hover:from-[#48D886]/15 hover:to-[#1D9CA1]/15'
      }`}
    >
      {isWarning ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      ) : (
        <Sparkles className="h-4 w-4 shrink-0 text-[#1D9CA1]" />
      )}
      <span className="flex-1 truncate text-xs font-medium md:text-sm">{copy}</span>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold">
        {cta}
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
