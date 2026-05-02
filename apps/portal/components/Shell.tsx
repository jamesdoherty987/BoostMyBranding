import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { SubscriptionBanner } from './SubscriptionBanner';

interface ShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  /** Hide the subscription banner (e.g. on the subscribe page itself). */
  hideSubscriptionBanner?: boolean;
}

/**
 * Mobile-first shell. Sticky glass header, tab bar at the bottom that respects
 * safe-area insets, and a content area with generous horizontal padding.
 */
export function Shell({ title, subtitle, children, action, hideSubscriptionBanner }: ShellProps) {
  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur safe-pt">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900">{title}</h1>
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      </header>
      {hideSubscriptionBanner ? null : <SubscriptionBanner />}
      <div className="px-4 py-4">{children}</div>
      <BottomNav />
    </div>
  );
}
