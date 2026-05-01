'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Upload, CalendarDays, MessageSquare, User } from 'lucide-react';
import { cn } from '@boost/ui';

const tabs = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/settings', label: 'You', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur safe-pb"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {tabs.map((t) => {
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
