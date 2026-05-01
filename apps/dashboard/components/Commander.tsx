'use client';

/**
 * ⌘K command palette. Wires routes, clients, and key actions into a single
 * keyboard-accessible launcher.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  CommandPalette,
  useCommandPaletteHotkey,
  type CommandItem,
} from '@boost/ui';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  Sparkles,
  Globe,
  MessageSquare,
  BarChart3,
  Settings,
  Building2,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';
import { mockClients } from '@boost/core';

export function Commander() {
  const [open, setOpen] = useState(false);
  useCommandPaletteHotkey(setOpen);
  const router = useRouter();

  const { data: clients = mockClients } = useSWR('commander:clients', async () => {
    try {
      return await api.listClients();
    } catch {
      return mockClients;
    }
  });

  const items: CommandItem[] = useMemo(() => {
    const goto = (path: string) => () => router.push(path);
    return [
      { id: 'nav-overview', group: 'Navigate', label: 'Overview', icon: <LayoutDashboard className="h-3.5 w-3.5" />, shortcut: ['g', 'o'], onSelect: goto('/') },
      { id: 'nav-clients', group: 'Navigate', label: 'Clients', icon: <Users className="h-3.5 w-3.5" />, shortcut: ['g', 'c'], onSelect: goto('/clients') },
      { id: 'nav-review', group: 'Navigate', label: 'Review queue', icon: <CheckSquare className="h-3.5 w-3.5" />, shortcut: ['g', 'r'], onSelect: goto('/review') },
      { id: 'nav-calendar', group: 'Navigate', label: 'Scheduler', icon: <Calendar className="h-3.5 w-3.5" />, onSelect: goto('/calendar') },
      { id: 'nav-generate', group: 'Navigate', label: 'Generate content', icon: <Sparkles className="h-3.5 w-3.5" />, shortcut: ['g', 'g'], onSelect: goto('/generate') },
      { id: 'nav-websites', group: 'Navigate', label: 'Websites', icon: <Globe className="h-3.5 w-3.5" />, onSelect: goto('/websites') },
      { id: 'nav-messages', group: 'Navigate', label: 'Messages', icon: <MessageSquare className="h-3.5 w-3.5" />, onSelect: goto('/messages') },
      { id: 'nav-analytics', group: 'Navigate', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5" />, onSelect: goto('/analytics') },
      { id: 'nav-settings', group: 'Navigate', label: 'Settings', icon: <Settings className="h-3.5 w-3.5" />, onSelect: goto('/settings') },
      {
        id: 'action-generate',
        group: 'Quick actions',
        label: 'Generate new content batch',
        hint: 'AI pipeline',
        icon: <Zap className="h-3.5 w-3.5" />,
        keywords: ['batch', 'ai', 'create'],
        onSelect: goto('/generate'),
      },
      ...clients.map<CommandItem>((c) => ({
        id: `client-${c.id}`,
        group: 'Clients',
        label: c.businessName,
        hint: c.industry ?? undefined,
        icon: <Building2 className="h-3.5 w-3.5" />,
        keywords: ['client', c.industry ?? ''],
        onSelect: goto(`/clients/${c.id}`),
      })),
    ];
  }, [router, clients]);

  return <CommandPalette open={open} onOpenChange={setOpen} items={items} placeholder="Jump to a client, page, or action…" />;
}
