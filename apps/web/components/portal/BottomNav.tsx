'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import {
  Home,
  Upload,
  CalendarDays,
  MessageSquare,
  User,
  Link2,
  ExternalLink,
  BookOpen,
  PhoneCall,
  ShoppingBag,
  Star,
  Heart,
  Compass,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@boost/ui';
import { resolvePortalTabs, type ResolvedPortalTab } from '@boost/core';
import { api } from '@/lib/portal/api';

/**
 * Mapping from serialized icon name → Lucide component. Only a small
 * curated set of glyphs are available to the agency when setting up
 * custom links — this keeps the bundle trim and avoids a dynamic-import
 * tax on every nav render. Unknown names fall back to a plain link icon.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Upload,
  CalendarDays,
  MessageSquare,
  User,
  Link2,
  ExternalLink,
  BookOpen,
  PhoneCall,
  ShoppingBag,
  Star,
  Heart,
  Compass,
};

function renderIcon(name: string | undefined, className?: string) {
  const Icon = (name && ICON_MAP[name]) || Link2;
  return <Icon className={className} />;
}

/**
 * Bottom tab bar. Resolves the visible tabs by combining:
 *   1. Default tabs (filtered by the client's subscription tier).
 *   2. Per-client portal config (hide/rename/reorder + agency-added
 *      custom links).
 *
 * The config is fetched via SWR under the same cache key the rest of
 * the portal uses for the signed-in client, so this doesn't cause an
 * extra request.
 */
export function BottomNav() {
  const pathname = usePathname();

  // Grab the signed-in client's tier + portal config so we can filter +
  // customize the tab set. Shared SWR cache key `portal:client` so every
  // page that mounts BottomNav only pays for one fetch per session.
  const { data: client } = useSWR('portal:client', async () => {
    try {
      return await api.getMyClient();
    } catch {
      return null;
    }
  });

  const tabs: ResolvedPortalTab[] = resolvePortalTabs(
    client?.subscriptionTier,
    client?.portalConfig,
  );

  // Defensive cap — the editor already limits to 10 custom links, but
  // if someone bypassed validation, keep the bar usable by cutting off
  // at 6 visible items. Overflowing tabs are unreachable via the bar
  // but still live at their direct URLs.
  const visible = tabs.slice(0, 6);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur safe-pb"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {visible.map((t) => {
          // Built-in tabs use prefix matching so nested routes
          // (`/portal/settings/...`) still highlight "You". Custom
          // links only match their exact href.
          const active = t.isCustom
            ? pathname === t.href
            : pathname.startsWith(t.href);
          const external = t.isCustom && /^https?:\/\//i.test(t.href);
          const LinkEl = external ? 'a' : Link;
          const linkProps = external
            ? { href: t.href, target: '_blank', rel: 'noopener noreferrer' }
            : { href: t.href };

          return (
            <LinkEl
              key={t.key}
              {...(linkProps as any)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                active ? 'text-[#1D9CA1]' : 'text-slate-500',
              )}
            >
              {renderIcon(
                t.icon,
                cn('h-5 w-5 transition-transform', active && 'text-[#1D9CA1] scale-110'),
              )}
              <span className="max-w-full truncate">{t.label}</span>
            </LinkEl>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Icon names exposed to the agency-side editor. Exported so the
 * client-config editor in the team dashboard can render the same set
 * without duplicating the list.
 */
export const PORTAL_NAV_ICON_OPTIONS = Object.keys(ICON_MAP);
