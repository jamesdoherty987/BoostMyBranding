'use client';

import { Phone, MessageCircle } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { useSiteContext } from '../context';

interface SiteMobileCtaProps {
  config: WebsiteConfig;
}

/**
 * Sticky bottom bar on mobile. Shows a primary CTA + optional Call and
 * WhatsApp buttons. Only renders on screens < md. This is the single
 * most important conversion element for local businesses — a barber's
 * customer on their phone should be able to call or book with one tap
 * without scrolling to the contact section.
 *
 * Auto-hides in the dashboard preview (embedded mode) so it doesn't
 * overlap the editor chrome.
 */
export function SiteMobileCta({ config }: SiteMobileCtaProps) {
  const { embedded, editMode } = useSiteContext();
  // Don't render in the dashboard preview — it would float over the editor.
  if (embedded) return null;

  const c = config.contact;
  const m = config.mobileCta;
  const phone = c?.phone?.replace(/[^+\d]/g, '') ?? '';
  const whatsapp = config.contact?.whatsapp?.replace(/[^+\d]/g, '') ?? '';

  const primaryLabel = m?.primaryLabel ?? config.hero?.ctaPrimary?.label ?? 'Book now';
  const primaryHref = m?.primaryHref ?? config.hero?.ctaPrimary?.href ?? '#contact';
  const showCall = (m?.showCall ?? true) && !!phone;
  const showWhatsApp = (m?.showWhatsApp ?? true) && !!whatsapp;

  // If there's nothing useful to show, skip the bar entirely.
  if (!primaryLabel && !showCall && !showWhatsApp) return null;

  return (
    <>
      {/* Spacer so the sticky bar doesn't hide the last slice of page content.
          Dynamic height so devices with a home indicator (safe-area-inset)
          get the right clearance. */}
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: 'calc(64px + env(safe-area-inset-bottom, 8px))' }}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 px-4 pb-[env(safe-area-inset-bottom,8px)] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-lg md:hidden"
        role="navigation"
        aria-label="Quick actions"
      >
        <div className="mx-auto flex max-w-lg items-center gap-2">
          {/* Primary CTA — takes up remaining space */}
          <a
            href={primaryHref}
            onClick={editMode ? (e) => e.preventDefault() : undefined}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
            style={{ background: 'var(--bmb-site-primary)' }}
          >
            {primaryLabel}
          </a>

          {/* Call button */}
          {showCall ? (
            <a
              href={`tel:${phone}`}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-transform active:scale-95"
              aria-label="Call now"
            >
              <Phone className="h-5 w-5" />
            </a>
          ) : null}

          {/* WhatsApp button */}
          {showWhatsApp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm transition-transform active:scale-95"
              aria-label="WhatsApp"
            >
              <MessageCircle className="h-5 w-5" />
            </a>
          ) : null}
        </div>
      </div>
    </>
  );
}
