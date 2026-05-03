'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { Home, Upload, CalendarDays, MessageSquare, User } from 'lucide-react';
import { cn } from '@boost/ui';
import { api } from '@/lib/api';
import type { SubscriptionTier } from '@boost/core';

/**
 * Declare which tabs are relevant to which tier. The bottom nav filters
 * itself by the client's current tier — the social-only clients should
 * never see a "Website" tab even as a locked preview, because it has
 * nothing to do with their product.
 *
 * Tabs with `tiers: 'all'` render regardless of subscription state (nav
 * essentials: Home, Chat, Settings).
 */
type TabDef = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tiers: 'all' | SubscriptionTier[];
};

const TABS: TabDef[] = [
  { href: '/dashboard', label: 'Home', icon: Home, tiers: 'all' },
  {
    href: '/upload',
    label: 'Upload',
    icon: Upload,
    // Social + full packages need photo uploads for content generation.
    // Website-only clients don't upload through here.
    tiers: ['social_only', 'full_package'],
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: CalendarDays,
    // Only social publishing uses the calendar.
    tiers: ['social_only', 'full_package'],
  },
  { href: '/chat', label: 'Chat', icon: MessageSquare, tiers: 'all' },
  { href: '/settings', label: 'You', icon: User, tiers: 'all' },
];

export function BottomNav() {
  const pathname = usePathname();

  // Grab the signed-in client's tier so we can filter the tab set. This
  // fetch is shared across every page that mounts BottomNav (SWR cache key
  // `portal:client`) so it only hits the API once per session.
  const { data: client } = useSWR('portal:client', async () => {
    try {
      return await api.getMyClient();
    } catch {
      return null;
    }
  });

  const tier = client?.subscriptionTier ?? 'social_only';
  const visible = TABS.filter(
    (t) => t.tiers === 'all' || t.tiers.includes(tier as SubscriptionTier),
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur safe-pb"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {visible.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                active ? 'text-[#1D9CA1]' : 'text-slate-500',
              )}
            >
              <t.icon
                className={cn(
                  'h-5 w-5 transition-transform',
                  active && 'text-[#1D9CA1] scale-110',
                )}
              />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
