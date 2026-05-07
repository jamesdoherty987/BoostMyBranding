'use client';

/**
 * Preview frame with two modes:
 *
 *   Desktop: renders the children at a fixed 1440px intrinsic width and
 *   CSS-scales the whole thing down to fit the available preview column.
 *   This gives pixel-perfect fidelity with the real desktop site — a
 *   hero looks exactly like it will in production on a 1440px monitor.
 *   Since the DOM tree is still a regular React tree (not an iframe),
 *   inline editing, the image picker, and every interactive edit feature
 *   continue to work unchanged.
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
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

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

// Device widths chosen to match the most-common real viewports.
// 390px  = iPhone 14/15 Pro logical viewport.
// 768px  = iPad Mini / portrait iPad.
// 1440px = common desktop (MacBook Pro 14" / common cafe laptop).
const DEVICE_WIDTH: Record<DevicePreset, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
};

/**
 * Intrinsic width we render the desktop preview at. Scaled down by CSS
 * transform to fit whatever column width the dashboard gives us. 1440 is
 * the "most common desktop browser width" across all our client analytics,
 * so laying out at this width makes preview match production pixel-perfectly.
 */
const DESKTOP_INTRINSIC_WIDTH = 1440;

export function PreviewFrame({
  device,
  children,
  liveUrl,
  pageSlug,
}: PreviewFrameProps) {
  if (device === 'desktop') {
    return <ScaledDesktopPreview>{children}</ScaledDesktopPreview>;
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

/**
 * Desktop preview rendered at the canonical 1440px intrinsic width and
 * CSS-scaled to fit the dashboard column. This matches what the site
 * will look like on a real desktop browser instead of squishing the
 * layout into whatever width the editor sidebar leaves.
 *
 * Scaling uses the `zoom` property when supported (Chromium family)
 * because it lets content stay semantically 1440px while visually
 * shrinking — meaning Tailwind's breakpoints ("md:", "lg:", "xl:")
 * trigger exactly the same way they would at the real browser size.
 * Transform: scale() would force every breakpoint to use the real
 * container width, which defeats the purpose of "preview at 1440".
 *
 * We feature-detect `zoom` at runtime. Firefox / older browsers fall
 * back to `transform: scale()` with compensating height, which still
 * gets the aspect ratio right.
 */
function ScaledDesktopPreview({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [useZoom, setUseZoom] = useState(false);

  // Detect `zoom` support. Chromium/WebKit support it; Firefox does not
  // (yet). `zoom: 1` is a no-op on unsupported browsers but still sets
  // the computed style — we check with a sentinel element.
  useEffect(() => {
    // Safer feature detection than a UA sniff. Modern Firefox 126+
    // actually now supports `zoom` too, so this benefits everyone.
    try {
      const probe = document.createElement('div');
      probe.style.zoom = '2';
      document.body.appendChild(probe);
      const works = window.getComputedStyle(probe).zoom === '2';
      document.body.removeChild(probe);
      setUseZoom(works);
    } catch {
      setUseZoom(false);
    }
  }, []);

  // Recompute scale on resize. Clamped at 1 so we never zoom UP — if
  // the editor column is somehow wider than 1440px, we render 1:1.
  // Min 0.35 so the preview still fits cleanly at narrow column widths
  // (editor sidebar at 360px on a 1280px viewport leaves ~880px of
  // preview column width, which scales to 0.61 — well above the floor).
  useEffect(() => {
    const update = () => {
      const el = outerRef.current;
      if (!el) return;
      const available = el.clientWidth;
      const next = Math.min(1, Math.max(0.35, available / DESKTOP_INTRINSIC_WIDTH));
      setScale(next);
    };
    update();
    const ro = new ResizeObserver(update);
    if (outerRef.current) ro.observe(outerRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // When using zoom, the outer div's clientHeight already reflects the
  // visually-scaled content, so we don't need to pre-compute a height.
  // When using transform, we must pre-compute the scaled height so the
  // outer container reserves the correct vertical space (transforms
  // don't affect layout).
  return (
    <div
      ref={outerRef}
      data-preview-root="1"
      className="max-h-[85vh] w-full overflow-y-auto bg-white"
      style={{ overflowX: 'auto' }}
    >
      {useZoom ? (
        <div
          style={{
            width: `${DESKTOP_INTRINSIC_WIDTH}px`,
            // Non-standard `zoom` shrinks content semantically — media
            // queries evaluate against the 1440px intrinsic width so
            // breakpoints fire correctly.
            zoom: scale,
          } as React.CSSProperties}
        >
          {children}
        </div>
      ) : (
        // Transform fallback. The scaled content's visual width is
        // `1440 * scale`, so we set the wrapper's explicit width to
        // that value — otherwise the parent overflow box thinks the
        // content is 1440px wide and shows horizontal scroll even when
        // the scaled content fits.
        <div
          style={{
            width: `${DESKTOP_INTRINSIC_WIDTH * scale}px`,
            minHeight: '100%',
          }}
        >
          <div
            style={{
              width: `${DESKTOP_INTRINSIC_WIDTH}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
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
