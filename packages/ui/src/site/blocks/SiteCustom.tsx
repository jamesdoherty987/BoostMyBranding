'use client';

/**
 * Freeform custom sections. Renders each entry in `config.customSections`
 * using one of four layout primitives:
 *
 *   image-strip       2–5 images in a horizontal row with optional captions
 *   image-text-split  Big image on one side, heading + body on the other
 *   feature-row       Row of 2–4 icon+text feature cards
 *   pull-quote        Big centered quote with attribution
 *
 * Each field of each section is inline-editable via path-addressing,
 * e.g. `customSections.0.heading` / `customSections.1.items.2.caption`.
 * The same editable paths are used on sub-pages through the standard
 * `InlineEditable` path-remapping.
 */

import { motion } from 'framer-motion';
import type { WebsiteConfig, CustomSection } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { resolveIcon } from '../icon-map';
import { InlineEditable } from '../InlineEditable';

interface SiteCustomProps {
  config: WebsiteConfig;
  images: string[];
}

export function SiteCustom({ config, images }: SiteCustomProps) {
  const { embedded } = useSiteContext();
  const sections = config.customSections;
  if (!sections || sections.length === 0) return null;

  return (
    <>
      {sections.map((section, i) => (
        <CustomSectionRenderer
          key={i}
          section={section}
          sectionIndex={i}
          config={config}
          images={images}
          embedded={embedded}
        />
      ))}
    </>
  );
}

function CustomSectionRenderer({
  section,
  sectionIndex,
  config,
  images,
  embedded,
}: {
  section: CustomSection;
  sectionIndex: number;
  config: WebsiteConfig;
  images: string[];
  embedded: boolean;
}) {
  const bgClass =
    section.background === 'slate'
      ? 'bg-slate-50'
      : section.background === 'brand'
        ? 'text-white'
        : 'bg-white';
  const bgStyle =
    section.background === 'brand'
      ? { background: brandGradient(config.brand, 130) }
      : undefined;
  const pathBase = `customSections.${sectionIndex}`;

  const header =
    section.eyebrow || section.heading ? (
      <div className="mx-auto mb-10 max-w-2xl text-center">
        {section.eyebrow != null ? (
          <InlineEditable
            path={`${pathBase}.eyebrow`}
            value={section.eyebrow}
            as="p"
            className={`text-xs font-semibold uppercase tracking-[0.25em] ${
              section.background === 'brand' ? 'text-white/80' : ''
            }`}
            style={
              section.background === 'brand'
                ? undefined
                : { color: 'var(--bmb-site-primary)' }
            }
            placeholder="Section eyebrow…"
          />
        ) : null}
        {section.heading != null ? (
          <h2
            className={`mt-3 text-3xl font-bold tracking-tight md:text-5xl ${
              section.background === 'brand' ? 'text-white' : 'text-slate-900'
            }`}
          >
            <InlineEditable
              path={`${pathBase}.heading`}
              value={section.heading}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        ) : null}
        {section.body != null && section.variant !== 'image-text-split' ? (
          <p
            className={`mt-4 text-base md:text-lg ${
              section.background === 'brand' ? 'text-white/85' : 'text-slate-600'
            }`}
          >
            <InlineEditable
              path={`${pathBase}.body`}
              value={section.body}
              as="span"
              multiline
              placeholder="Supporting paragraph…"
            />
          </p>
        ) : null}
      </div>
    ) : null;

  return (
    <SectionWrapper
      immediate={embedded}
      className={`py-20 md:py-28 ${bgClass}`}
      style={bgStyle}
    >
      <div className="mx-auto max-w-6xl px-4">
        {header}

        {section.variant === 'image-strip' && (
          <ImageStrip
            items={section.items ?? []}
            images={images}
            pathBase={pathBase}
            embedded={embedded}
          />
        )}
        {section.variant === 'image-text-split' && (
          <ImageTextSplit
            section={section}
            images={images}
            pathBase={pathBase}
          />
        )}
        {section.variant === 'feature-row' && (
          <FeatureRow items={section.items ?? []} pathBase={pathBase} embedded={embedded} />
        )}
        {section.variant === 'pull-quote' && (
          <PullQuote section={section} pathBase={pathBase} />
        )}
      </div>
    </SectionWrapper>
  );
}

function ImageStrip({
  items,
  images,
  pathBase,
  embedded,
}: {
  items: NonNullable<CustomSection['items']>;
  images: string[];
  pathBase: string;
  embedded: boolean;
}) {
  const shown = items.slice(0, 5);
  if (shown.length === 0) return null;
  // Desktop: equal-width columns. Mobile: horizontal scroll so narrow
  // screens don't cram the images into unreadable slivers.
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5 lg:grid-cols-5">
      {shown.map((item, i) => {
        const src =
          item.imageUrl ??
          (typeof item.imageIndex === 'number' ? images[item.imageIndex] : undefined);
        return (
          <motion.figure
            key={i}
            initial={embedded ? false : { opacity: 0, y: 12 }}
            whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
            animate={embedded ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
          >
            <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={item.caption ?? ''}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                  No image
                </div>
              )}
            </div>
            {item.caption != null ? (
              <figcaption className="mt-2 text-center text-[11px] text-slate-500">
                <InlineEditable
                  path={`${pathBase}.items.${i}.caption`}
                  value={item.caption}
                  as="span"
                  placeholder="Optional caption…"
                />
              </figcaption>
            ) : null}
          </motion.figure>
        );
      })}
    </div>
  );
}

function ImageTextSplit({
  section,
  images,
  pathBase,
}: {
  section: CustomSection;
  images: string[];
  pathBase: string;
}) {
  const item = (section.items ?? [])[0];
  const src =
    item?.imageUrl ??
    (typeof item?.imageIndex === 'number' ? images[item.imageIndex] : undefined);
  const imageRight = section.imageSide !== 'right' ? false : true;

  const imageBlock = (
    <div className="overflow-hidden rounded-[2rem] shadow-xl">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="aspect-[4/5] w-full object-cover md:aspect-auto md:h-full"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-[4/5] items-center justify-center bg-slate-100 text-sm text-slate-400 md:aspect-auto md:h-full">
          No image
        </div>
      )}
    </div>
  );

  const textBlock = (
    <div>
      {section.body != null ? (
        <div
          className={`space-y-4 text-base md:text-lg ${
            section.background === 'brand' ? 'text-white/85' : 'text-slate-600'
          }`}
        >
          <InlineEditable
            path={`${pathBase}.body`}
            value={section.body}
            as="p"
            multiline
            maxLength={4000}
            placeholder="Tell the story here…"
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {imageRight ? (
        <>
          {textBlock}
          {imageBlock}
        </>
      ) : (
        <>
          {imageBlock}
          {textBlock}
        </>
      )}
    </div>
  );
}

function FeatureRow({
  items,
  pathBase,
  embedded,
}: {
  items: NonNullable<CustomSection['items']>;
  pathBase: string;
  embedded: boolean;
}) {
  const shown = items.slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
      {shown.map((item, i) => {
        const Icon = item.icon ? resolveIcon(item.icon) : null;
        return (
          <motion.div
            key={i}
            initial={embedded ? false : { opacity: 0, y: 12 }}
            whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
            animate={embedded ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
            className="rounded-3xl border border-slate-200 bg-white p-5"
          >
            {Icon ? (
              <div
                className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ background: 'var(--bmb-site-primary)' }}
              >
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
            <h3 className="text-base font-semibold text-slate-900">
              <InlineEditable
                path={`${pathBase}.items.${i}.title`}
                value={item.title ?? ''}
                as="span"
                placeholder="Feature title…"
              />
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              <InlineEditable
                path={`${pathBase}.items.${i}.description`}
                value={item.description ?? ''}
                as="span"
                multiline
                placeholder="One or two sentences…"
              />
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

function PullQuote({
  section,
  pathBase,
}: {
  section: CustomSection;
  pathBase: string;
}) {
  return (
    <figure className="mx-auto max-w-3xl text-center">
      <blockquote
        className={`text-2xl font-medium leading-snug md:text-4xl ${
          section.background === 'brand' ? 'text-white' : 'text-slate-900'
        }`}
      >
        <span aria-hidden>&ldquo;</span>
        <InlineEditable
          path={`${pathBase}.body`}
          value={section.body ?? ''}
          as="span"
          multiline
          placeholder="The quote…"
        />
        <span aria-hidden>&rdquo;</span>
      </blockquote>
      {section.caption != null ? (
        <figcaption
          className={`mt-6 text-sm font-semibold ${
            section.background === 'brand' ? 'text-white/80' : 'text-slate-500'
          }`}
        >
          <span aria-hidden>— </span>
          <InlineEditable
            path={`${pathBase}.caption`}
            value={section.caption}
            as="span"
            placeholder="Author or source…"
          />
        </figcaption>
      ) : null}
    </figure>
  );
}
