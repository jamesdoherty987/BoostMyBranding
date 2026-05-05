'use client';

/**
 * Preview frame with two modes:
 *
 *   Desktop: renders the children directly into the dashboard (no iframe).
 *   This keeps inline editing, the image picker, and every other
 *   interactive edit-mode feature working because the React tree is one
 *   continuous tree.
 *
 *   Mobile / Tablet: renders the LIVE site URL inside an iframe with a
 *   fixed width matching the real device. Because the iframe is a real
 *   browser viewport, Tailwind `md:` / `lg:` breakpoints trigger exactly
 *   the way they do on a phone. Trade-off: you can't inline-edit in
 *   mobile mode because the iframe is a separate page. A banner tells
 *   users to switch to desktop for editing.
 *
 * Why this approach beats the portal-in-iframe attempt:
 *   - No CSS copying, no stylesheet drift on HMR
 *   - No React event delegation across iframe boundaries
 *   - Viewport behaves exactly like a real phone
 *   - Same infra the published site uses — what you see really is what
 *     a real phone will show
 *
 * Desktop/edit-mode is unaffected by any of this. You only give up
 * inline-edit when simulating a phone, which is a sensible split.
 */

import { useEffect, useState, type ReactNode } from 'react';

export type DevicePreset = 'desktop' | 'tablet' | 'mobile';

interface PreviewFrameProps {
  device: DevicePreset;
  children: ReactNode;
  /**
   * URL to navigate the iframe to when device is mobile/tablet. Usually
   * the site's own public URL (e.g. `/sites/murphys-plumbing`). When
   * omitted, the iframe modes are disabled and we fall back to desktop.
   */
  liveUrl?: string;
  /** Current page slug — appended to liveUrl as a path segment for multipage sites. */
  pageSlug?: string;
}

// Device widths chosen to match the most-common real phones / tablets.
// 390px = iPhone 14/15 Pro logical viewport.
// 768px = iPad Mini / portrait iPad.
const DEVICE_WIDTH: Record<DevicePreset, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
};

export function PreviewFrame({
  device,
  children,
  liveUrl,
  pageSlug,
}: PreviewFrameProps) {
  if (device === 'desktop') {
    return (
      <div className="max-h-[85vh] overflow-y-auto bg-white">{children}</div>
    );
  }

  // Mobile/tablet — iframe the real site. Fall back to desktop if we
  // don't have a live URL (usually because the client isn't published
  // yet or is still using the preview-only path).
  if (!liveUrl) {
    return (
      <div className="flex justify-center bg-slate-100 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-900">
          <p className="font-semibold">Publish to see mobile preview</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Generate and save the site first, then switch to mobile to see
            it at a real phone viewport. Desktop preview always works.
          </p>
        </div>
      </div>
    );
  }

  return <IframePreview device={device} liveUrl={liveUrl} pageSlug={pageSlug} />;
}

function IframePreview({
  device,
  liveUrl,
  pageSlug,
}: {
  device: Exclude<DevicePreset, 'desktop'>;
  liveUrl: string;
  pageSlug?: string;
}) {
  const width = DEVICE_WIDTH[device]!;
  // Height budget — leave room for the dashboard chrome above + below.
  const [height, setHeight] = useState<number>(700);

  useEffect(() => {
    const update = () => setHeight(Math.min(Math.round(window.innerHeight * 0.8), 900));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Compose the URL. For multipage sites, append the page slug (except home).
  const fullUrl =
    pageSlug && pageSlug !== 'home'
      ? `${liveUrl.replace(/\/$/, '')}/${pageSlug}`
      : liveUrl;

  return (
    <div className="flex flex-col items-center gap-3 bg-slate-100 p-4 md:p-6">
      {/* Mode hint */}
      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-[10px] font-medium text-white backdrop-blur">
        Viewing live site · switch to Desktop to edit
      </div>

      <div
        className={
          device === 'tablet'
            ? 'overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg'
            : 'overflow-hidden rounded-[2rem] border-[10px] border-slate-900 bg-white shadow-2xl'
        }
      >
        <iframe
          title={`${device} preview`}
          src={fullUrl}
          style={{
            display: 'block',
            width: `${width}px`,
            height: `${height}px`,
            border: 0,
            background: 'white',
          }}
          // Allow scripts, images, same-origin (site is on our domain).
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>

      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-medium text-slate-600 hover:text-[#1D9CA1]"
      >
        Open full page in a new tab ↗
      </a>
    </div>
  );
}
