'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';

interface SiteAnnouncementProps {
  config: WebsiteConfig;
}

/**
 * Top-of-site announcement bar. Sticky at the very top above the nav,
 * used for seasonal promos ("20% off until Christmas"), holiday hours,
 * or service changes. Dismissible by default — once dismissed, the
 * decision is stored in sessionStorage so the bar stays hidden for the
 * rest of the session.
 *
 * Keyed by a hash of the message content so changing the message
 * re-shows the bar even to returning visitors.
 */
export function SiteAnnouncement({ config }: SiteAnnouncementProps) {
  const { embedded, editMode } = useSiteContext();
  const a = config.announcement;
  const [dismissed, setDismissed] = useState(false);

  // Hash the message so the bar re-shows after the content changes.
  const storageKey = a?.message
    ? `bmb-ann-${hashMessage(a.message)}`
    : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (sessionStorage.getItem(storageKey) === '1') setDismissed(true);
    } catch {
      // sessionStorage blocked (private browsing). Fail open.
    }
  }, [storageKey]);

  if (!a?.message) return null;
  // In the dashboard preview we always render the bar so the agency can
  // see / edit it even if a previous dismiss is in session storage.
  if (dismissed && !embedded && !editMode) return null;

  const tone = a.tone ?? 'brand';
  const { background, textColor } = toneStyles(tone);

  return (
    <div
      className="relative w-full text-center text-sm font-medium"
      style={{ background, color: textColor }}
      role="region"
      aria-label="Announcement"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-10 py-2.5">
        <span>
          <InlineEditable
            path="announcement.message"
            value={a.message}
            as="span"
            placeholder="Announcement message…"
          />
        </span>
        {a.linkHref && a.linkLabel ? (
          <a
            href={a.linkHref}
            onClick={editMode ? (e) => e.preventDefault() : undefined}
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            <InlineEditable
              path="announcement.linkLabel"
              value={a.linkLabel}
              as="span"
              placeholder="Link label…"
            />
          </a>
        ) : null}
      </div>

      {!a.nonDismissible && !editMode ? (
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            if (storageKey) {
              try {
                sessionStorage.setItem(storageKey, '1');
              } catch {
                /* ignore */
              }
            }
          }}
          aria-label="Dismiss announcement"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-black/10"
          style={{ color: textColor }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function toneStyles(tone: 'brand' | 'success' | 'warning') {
  switch (tone) {
    case 'success':
      return { background: '#10b981', textColor: '#ffffff' };
    case 'warning':
      return { background: '#f59e0b', textColor: '#0b1220' };
    case 'brand':
    default:
      return { background: 'var(--bmb-site-primary)', textColor: 'var(--bmb-site-on-primary)' };
  }
}

/** Tiny non-crypto hash for sessionStorage keying. */
function hashMessage(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}
