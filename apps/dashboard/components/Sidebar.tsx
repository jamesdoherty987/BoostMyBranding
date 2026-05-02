'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo, cn, useRealtime, Kbd, openCommandPalette } from '@boost/ui';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  MessageSquare,
  Sparkles,
  BarChart3,
  Globe,
  Video,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/review', label: 'Review queue', icon: CheckSquare, showCount: 'pending' as const },
  { href: '/calendar', label: 'Scheduler', icon: Calendar },
  { href: '/generate', label: 'Generate', icon: Sparkles },
  { href: '/websites', label: 'Websites', icon: Globe },
  { href: '/videos', label: 'Videos', icon: Video },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { presence } = useRealtime(API_URL);

  const { data: me } = useSWR('sidebar:me', async () => {
    try {
      return await api.me();
    } catch {
      return { id: 'demo', email: 'demo@boostmybranding.com', role: 'agency_admin', name: 'Demo' };
    }
  });

  const { data: pendingCount } = useSWR(
    'sidebar:pending',
    async () => {
      try {
        const rows = await api.listPosts({ status: 'pending_approval' });
        return rows.length;
      } catch {
        return undefined;
      }
    },
    { refreshInterval: 30000 },
  );

  const others = presence.filter((p) => p.userId !== me?.id);

  const Item = ({ item, onClick }: { item: (typeof nav)[number]; onClick?: () => void }) => {
    const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
    const showBadge = item.showCount === 'pending' && (pendingCount ?? 0) > 0;
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
          active
            ? 'bg-gradient-cta text-white shadow-brand'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )}
      >
        <item.icon className="h-4 w-4" />
        <span className="flex-1">{item.label}</span>
        {showBadge ? (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              active ? 'bg-white/20 text-white' : 'bg-[#FFEC3D] text-slate-900',
            )}
          >
            {pendingCount}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden safe-pt">
        <Logo size="sm" />
        <div className="flex items-center gap-2">
          {others.length > 0 ? (
            <div className="flex -space-x-1">
              {others.slice(0, 3).map((p) => (
                <span
                  key={p.userId}
                  title={p.name}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-cta text-[10px] font-semibold text-white ring-2 ring-white"
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
          ) : null}
          <button
            onClick={() => setOpen(!open)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 p-5">
          <Logo />
        </div>
        <button
          onClick={() => openCommandPalette()}
          className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 hover:bg-white"
          aria-label="Open command palette"
        >
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>
        <nav className="mt-3 flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((n) => (
            <Item key={n.href} item={n} />
          ))}
        </nav>
        {others.length > 0 ? (
          <div className="border-t border-slate-200 px-3 py-2">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Online with you
            </div>
            <div className="space-y-1">
              {others.map((p) => (
                <div key={p.userId} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-600">
                  <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-cta text-[10px] font-semibold text-white">
                    {p.name.slice(0, 1).toUpperCase()}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  </span>
                  <span className="truncate">{p.name}</span>
                  {p.lockedPostId ? <span className="ml-auto text-[10px] text-amber-600">reviewing</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="border-t border-slate-200 p-3">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-cta text-xs font-semibold text-white">
              {me?.name?.slice(0, 1).toUpperCase() ?? '·'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-900">
                {me?.name ?? 'Signed out'}
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {me?.role?.replace('_', ' ') ?? ''}
              </div>
            </div>
            <button
              className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
              aria-label="Log out"
              onClick={() => api.logout().then(() => (window.location.href = '/'))}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 26 }}
              className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white md:hidden"
            >
              <div className="border-b border-slate-200 p-5 safe-pt">
                <Logo />
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {nav.map((n) => (
                  <Item key={n.href} item={n} onClick={() => setOpen(false)} />
                ))}
              </nav>
              <div className="border-t border-slate-200 p-3">
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Mobile spacer */}
      <div className="h-14 md:hidden" />
    </>
  );
}
