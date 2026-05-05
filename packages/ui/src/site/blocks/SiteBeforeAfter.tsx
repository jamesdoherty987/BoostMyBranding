'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';
import { InlineImage } from '../InlineImage';

interface SiteBeforeAfterProps {
  config: WebsiteConfig;
  images: string[];
}

/**
 * Before / after image pairs. Used by trades (plumbing jobs, roofing,
 * painting, landscaping) and beauty (hair colour, nails, aesthetics).
 *
 * Each pair gets an interactive slider — drag/tap the handle to reveal
 * more or less of the "after" image over the "before". Falls back to
 * a two-image grid on edit mode or if a pair is missing one of the two
 * images (for graceful degradation in preview / draft states).
 */
export function SiteBeforeAfter({ config, images }: SiteBeforeAfterProps) {
  const { embedded, editMode } = useSiteContext();
  const ba = config.beforeAfter;
  if (!ba || !ba.pairs || ba.pairs.length === 0) return null;

  return (
    <SectionWrapper immediate={embedded} id="before-after" className="bg-slate-50 py-14 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="beforeAfter.eyebrow"
            value={ba.eyebrow ?? 'Our work'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="beforeAfter.heading"
              value={ba.heading ?? 'Before and after.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {ba.pairs.map((pair, i) => {
            const before =
              pair.beforeUrl ??
              (typeof pair.beforeIndex === 'number' ? images[pair.beforeIndex] : undefined);
            const after =
              pair.afterUrl ??
              (typeof pair.afterIndex === 'number' ? images[pair.afterIndex] : undefined);
            return (
              <motion.figure
                key={i}
                initial={embedded ? false : { opacity: 0, y: 16 }}
                whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
                animate={embedded ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
              >
                {editMode ? (
                  // Edit mode: show the two photos side-by-side with
                  // InlineImage so the agency can swap either. The slider
                  // UI would interfere with click targets.
                  <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-3xl shadow-lg">
                    <div className="relative aspect-square bg-slate-100">
                      <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                        Before
                      </span>
                      <InlineImage
                        src={before}
                        alt="Before"
                        className="h-full w-full"
                        path={`beforeAfter.pairs.${i}.beforeIndex`}
                        fieldName="direct"
                        placeholder={
                          <div
                            className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-white/80"
                            style={{ background: brandGradient(config.brand, 120) }}
                          >
                            Before
                          </div>
                        }
                      />
                    </div>
                    <div className="relative aspect-square bg-slate-100">
                      <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                        After
                      </span>
                      <InlineImage
                        src={after}
                        alt="After"
                        className="h-full w-full"
                        path={`beforeAfter.pairs.${i}.afterIndex`}
                        fieldName="direct"
                        placeholder={
                          <div
                            className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-white/80"
                            style={{ background: brandGradient(config.brand, 120) }}
                          >
                            After
                          </div>
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <BeforeAfterSlider
                    before={before}
                    after={after}
                    brandColor={`linear-gradient(135deg, ${config.brand.primaryColor}, ${config.brand.accentColor})`}
                    fallbackGradient={brandGradient(config.brand, 120)}
                  />
                )}
                {pair.caption ? (
                  <figcaption className="mt-3 text-center text-xs text-slate-500">
                    <InlineEditable
                      path={`beforeAfter.pairs.${i}.caption`}
                      value={pair.caption}
                      as="span"
                      placeholder="Short caption…"
                    />
                  </figcaption>
                ) : null}
              </motion.figure>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}

/**
 * Interactive before/after slider. Shows the "before" image behind, the
 * "after" image clipped to the user-controlled width, and a draggable
 * vertical divider with a handle. Controlled via pointer move / touch.
 *
 * When either image is missing we render a brand gradient tile with a
 * placeholder label, so the section still looks intentional during
 * drafting.
 */
function BeforeAfterSlider({
  before,
  after,
  fallbackGradient,
}: {
  before: string | undefined;
  after: string | undefined;
  brandColor: string;
  fallbackGradient: string;
}) {
  const [pct, setPct] = useState(50);
  const onMove = (clientX: number, rect: DOMRect) => {
    const rel = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.max(0, Math.min(100, rel)));
  };
  return (
    <div
      className="relative aspect-[4/3] touch-none overflow-hidden rounded-3xl shadow-lg select-none"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        onMove(e.clientX, e.currentTarget.getBoundingClientRect());
      }}
      onPointerMove={(e) => {
        // Drag only when the pointer is pressed. On mouse `buttons` is 1,
        // on touch we rely on setPointerCapture set on pointerdown — the
        // element only receives pointermove events during the active drag
        // because the capture is released on pointerup.
        if (e.pointerType === 'mouse' && e.buttons !== 1) return;
        onMove(e.clientX, e.currentTarget.getBoundingClientRect());
      }}
      onPointerUp={(e) => {
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          // Some browsers throw if the pointer isn't captured. Ignore.
        }
      }}
    >
      {/* Before (full width) */}
      {before ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={before} alt="Before" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-wider text-white/80"
          style={{ background: fallbackGradient }}
        >
          Before
        </div>
      )}

      {/* After (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
      >
        {after ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={after} alt="After" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-white/80"
            style={{ background: fallbackGradient }}
          >
            After
          </div>
        )}
      </div>

      {/* Corner tags */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
        After
      </span>

      {/* Divider + handle */}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
        style={{ left: `${pct}%` }}
      >
        <div
          className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg"
          aria-hidden
        >
          ‹›
        </div>
      </div>
    </div>
  );
}
