'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';

interface SitePortfolioProps {
  config: WebsiteConfig;
  images: string[];
}

/**
 * Portfolio / case studies grid. Each project is a card with a cover
 * image, title, and summary. Clicking a project opens a full-screen
 * lightbox with all images + long description + tag chips. Escape /
 * backdrop click closes.
 *
 * Richer than the gallery block — gallery is thumbnails with lightbox,
 * portfolio is narrative-style projects with context.
 */
export function SitePortfolio({ config, images }: SitePortfolioProps) {
  const { embedded, editMode } = useSiteContext();
  const p = config.portfolio;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [slide, setSlide] = useState(0);

  if (!p || !p.projects || p.projects.length === 0) return null;

  const openProject = (i: number) => {
    if (editMode) return;
    setOpenIndex(i);
    setSlide(0);
  };

  const openProjectImages =
    openIndex != null
      ? resolveProjectImages(p.projects[openIndex]!, images)
      : [];

  // Keyboard navigation for the lightbox: Esc closes, ←/→ navigate images.
  useEffect(() => {
    if (openIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpenIndex(null);
        return;
      }
      if (openProjectImages.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSlide((s) => (s - 1 + openProjectImages.length) % openProjectImages.length);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSlide((s) => (s + 1) % openProjectImages.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIndex, openProjectImages.length]);

  return (
    <SectionWrapper
      immediate={embedded}
      id="portfolio"
      className="bg-white py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="portfolio.eyebrow"
            value={p.eyebrow ?? 'Examples'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="portfolio.heading"
              value={p.heading ?? 'Recent work.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {p.projects.map((proj, i) => {
            const projectImages = resolveProjectImages(proj, images);
            const cover = projectImages[0];
            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => openProject(i)}
                initial={embedded ? false : { opacity: 0, y: 16 }}
                whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
                animate={embedded ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className={`group overflow-hidden rounded-3xl border bg-white text-left transition-all hover:-translate-y-1 hover:shadow-xl ${
                  proj.featured
                    ? 'border-[color:var(--bmb-site-primary)] ring-1 ring-[color:var(--bmb-site-primary)]/30 md:col-span-2 lg:col-span-2'
                    : 'border-slate-200'
                }`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt={proj.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ background: brandGradient(config.brand, 140) }}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-base font-semibold text-slate-900">
                    <InlineEditable
                      path={`portfolio.projects.${i}.title`}
                      value={proj.title}
                      as="span"
                      placeholder="Project title…"
                    />
                  </h3>
                  {proj.summary ? (
                    <p className="mt-1 text-sm text-slate-600">
                      <InlineEditable
                        path={`portfolio.projects.${i}.summary`}
                        value={proj.summary}
                        as="span"
                        multiline
                        placeholder="Short summary…"
                      />
                    </p>
                  ) : null}
                  {proj.tags && proj.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {proj.tags.map((tag, ti) => (
                        <span
                          key={ti}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Lightbox — full-screen project detail */}
      <AnimatePresence>
        {openIndex != null && p.projects[openIndex] ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setOpenIndex(null)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-h-[90vh] w-[92vw] max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow backdrop-blur"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              {openProjectImages.length > 0 ? (
                <div className="relative aspect-[16/9] bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={openProjectImages[slide]!}
                    alt={p.projects[openIndex]!.title}
                    className="h-full w-full object-cover"
                  />
                  {openProjectImages.length > 1 ? (
                    <>
                      <LightboxArrow
                        direction="left"
                        onClick={() =>
                          setSlide(
                            (slide - 1 + openProjectImages.length) % openProjectImages.length,
                          )
                        }
                      />
                      <LightboxArrow
                        direction="right"
                        onClick={() => setSlide((slide + 1) % openProjectImages.length)}
                      />
                      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                        {openProjectImages.map((_, si) => (
                          <button
                            key={si}
                            type="button"
                            onClick={() => setSlide(si)}
                            aria-label={`Image ${si + 1}`}
                            className={`h-1.5 rounded-full transition-all ${
                              si === slide
                                ? 'w-6 bg-white'
                                : 'w-1.5 bg-white/50 hover:bg-white/80'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="p-6 md:p-10">
                <h3 className="text-2xl font-bold text-slate-900 md:text-3xl">
                  {p.projects[openIndex]!.title}
                </h3>
                {p.projects[openIndex]!.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.projects[openIndex]!.tags!.map((tag, ti) => (
                      <span
                        key={ti}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {p.projects[openIndex]!.description ? (
                  <div className="mt-5 space-y-4 text-base text-slate-600">
                    {p
                      .projects[openIndex]!.description!.split('\n\n')
                      .map((para, pi) => (
                        <p key={pi}>{para}</p>
                      ))}
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SectionWrapper>
  );
}

function LightboxArrow({
  direction,
  onClick,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow backdrop-blur transition-colors hover:bg-white ${
        direction === 'left' ? 'left-3' : 'right-3'
      }`}
      aria-label={direction === 'left' ? 'Previous image' : 'Next image'}
    >
      {direction === 'left' ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

function resolveProjectImages(
  project: NonNullable<WebsiteConfig['portfolio']>['projects'][number],
  images: string[],
): string[] {
  const resolved: string[] = [];
  if (project.imageIndices) {
    for (const idx of project.imageIndices) {
      const src = images[idx];
      if (src) resolved.push(src);
    }
  }
  if (project.imageUrls) {
    resolved.push(...project.imageUrls);
  }
  return resolved;
}
