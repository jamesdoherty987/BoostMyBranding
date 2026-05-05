'use client';

/**
 * Preview frame that picks between two strategies based on the chosen
 * device:
 *
 *   - desktop: renders children directly in the parent document so
 *     React's event delegation works normally. Edit-mode clicks fire,
 *     inline editing works, the image picker opens.
 *
 *   - mobile / tablet: renders children inside a same-origin iframe so
 *     Tailwind's `md:` / `lg:` breakpoints respond to the iframe's
 *     actual width (390px / 768px). This matches what real visitors see
 *     on those devices — something pure CSS width-constraint can't do
 *     because media queries respond to the outer viewport, not a wrapper.
 *
 * The iframe mode uses `createPortal` to keep the render tree unified
 * (so context, state, and callbacks all work). React 19 event
 * delegation listens at the React root container — which is the parent
 * document — so click/focus events fired inside the iframe DO NOT reach
 * our handlers. That's why the iframe mode is read-only: we pass a
 * shallow wrapper that blocks edit-mode UI, and the floating banner
 * tells the user to switch back to desktop for editing.
 *
 * This split keeps inline editing fast and reliable (desktop) while
 * giving accurate responsive previews (mobile/tablet) without the
 * messy workarounds needed to delegate React events across iframes.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type DevicePreset = 'desktop' | 'tablet' | 'mobile';

interface PreviewFrameProps {
  device: DevicePreset;
  children: ReactNode;
}

const DEVICE_WIDTH: Record<DevicePreset, number | null> = {
  desktop: null, // full width of the container
  tablet: 768,
  mobile: 390,
};

export function PreviewFrame({ device, children }: PreviewFrameProps) {
  // Desktop mode — no iframe. Renders directly so every event handler
  // works as expected (inline editing, image picker, etc).
  if (device === 'desktop') {
    return (
      <div className="max-h-[85vh] overflow-y-auto bg-white">{children}</div>
    );
  }

  // Mobile / tablet — use an iframe for an accurate responsive preview.
  return <IframePreview device={device}>{children}</IframePreview>;
}

/**
 * Internal: the iframe + portal rendering path. Edit-mode interactions
 * (clicks, input focus) don't bubble across the iframe boundary, so this
 * mode is visually accurate but non-interactive.
 */
function IframePreview({
  device,
  children,
}: {
  device: Exclude<DevicePreset, 'desktop'>;
  children: ReactNode;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [frameHeight, setFrameHeight] = useState<number>(600);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const setup = () => {
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !win) return;

      // Viewport meta so rem/vh/vw behave like a real phone.
      let meta = doc.head.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = doc.createElement('meta');
        meta.setAttribute('name', 'viewport');
        meta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, viewport-fit=cover',
        );
        doc.head.appendChild(meta);
      }

      // Mirror every stylesheet + <style> tag from the parent so the
      // iframe renders with identical CSS to the main page.
      const parentSheets = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style'),
      );
      Array.from(doc.head.querySelectorAll('[data-bmb-style-clone]')).forEach(
        (n) => n.remove(),
      );
      for (const el of parentSheets) {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.setAttribute('data-bmb-style-clone', '');
        doc.head.appendChild(clone);
      }

      doc.body.style.margin = '0';
      doc.body.style.background = '#ffffff';

      // Block pointer events so users are't tempted to click something
      // in the iframe that "doesn't respond" — with a helpful overlay
      // hint explaining to switch to desktop for editing.
      doc.body.style.pointerEvents = 'none';

      // ResizeObserver to auto-grow the iframe to match content.
      const ROCtor =
        (win as unknown as { ResizeObserver?: typeof ResizeObserver })
          .ResizeObserver ?? ResizeObserver;
      const ro = new ROCtor(() => {
        const h = doc.body.scrollHeight;
        setFrameHeight(
          Math.min(Math.max(h, 400), Math.round(window.innerHeight * 0.85)),
        );
      });
      ro.observe(doc.body);

      setMountNode(doc.body);
      return () => ro.disconnect();
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      return setup();
    }
    const onLoad = () => {
      setup();
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [device]);

  const width = DEVICE_WIDTH[device];

  return (
    <div className="relative flex justify-center bg-slate-100 p-4 md:p-6">
      <div
        className={
          device === 'tablet'
            ? 'relative w-full max-w-[768px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg'
            : 'relative w-full max-w-[390px] overflow-hidden rounded-[2rem] border-[10px] border-slate-900 bg-white shadow-2xl'
        }
      >
        <iframe
          ref={iframeRef}
          title="Responsive preview"
          srcDoc="<!doctype html><html><head></head><body></body></html>"
          style={{
            display: 'block',
            width: width ? `${width}px` : '100%',
            height: `${frameHeight}px`,
            border: 0,
            background: 'white',
          }}
        />
        {mountNode ? createPortal(children, mountNode) : null}

        {/* Read-only hint — sits over the top-left corner of the device
            so it's visible without blocking the hero content. */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
          Preview only · switch to Desktop to edit
        </div>
      </div>
    </div>
  );
}
