/**
 * Portal layout — mounted under `/portal/*`. Nested under the web root
 * layout, so it doesn't render html/body. Wraps children in the shared
 * PageTransition component and mounts a Toaster for portal-side toasts.
 *
 * Service-worker registration happens here so the portal still works as
 * a PWA when clients install it to their home screen.
 *
 * We override the page metadata here so Safari / Chrome see the PWA
 * manifest only on portal pages — the marketing site stays non-installable.
 */

import type { Metadata } from 'next';
import { Toaster, PageTransition } from '@boost/ui';
import './portal.css';

export const metadata: Metadata = {
  title: 'BoostMyBranding — Client Portal',
  description:
    "Upload photos, chat with your BoostMyBranding team, see what's going live.",
  manifest: '/manifest.json',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="portal-root min-h-screen antialiased">
      <PageTransition>{children}</PageTransition>
      <Toaster />
      <script
        dangerouslySetInnerHTML={{
          __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/portal/' }).catch((err) => console.warn('[sw] registration failed:', err))); }`,
        }}
      />
    </div>
  );
}
