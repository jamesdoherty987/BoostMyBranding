'use client';

import type { WebsiteConfig } from '@boost/core';
import { CheckCircle2, ImagePlus } from 'lucide-react';
import { SectionWrapper } from '../../section-wrapper';
import { Parallax } from '../../parallax';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';
import { InlineImage } from '../InlineImage';
import { SectionHeader } from './SectionHeader';
import { remapPathForPage } from '../path-remap';

interface SiteAboutProps {
  config: WebsiteConfig;
  images: string[];
  businessName: string;
}

/**
 * About section — image + copy + bullet proof-points. Every text field is
 * inline-editable when the preview is in edit mode. The image selection
 * is managed from the dashboard's Images tab (SiteEditor), not inline.
 */
export function SiteAbout({ config, images, businessName }: SiteAboutProps) {
  const { embedded, editMode, onImageClick, currentPageSlug, pageIndex } =
    useSiteContext();
  const about = config.about;
  if (!about) return null;

  const image =
    about.imageIndex != null
      ? images[about.imageIndex]
      : images[Math.min(1, Math.max(0, images.length - 1))];

  // Resolve the secondary corner tile — falls back to a fresh gallery
  // pick so an un-curated config still shows two distinct photos rather
  // than one photo + one gradient swatch. Public mode hides the corner
  // tile entirely when there's nothing to show (the decorative gradient
  // swatch is only rendered when we truly have nothing).
  const secondaryImage =
    about.secondaryImageUrl ??
    (typeof about.secondaryImageIndex === 'number'
      ? images[about.secondaryImageIndex]
      : undefined) ??
    // Default to "the next distinct image after the main one" so we get
    // a second real photo on sites that haven't curated the field.
    images.find((src, idx) => src !== image && idx !== about.imageIndex);

  const imageContainer = (
    <div className="relative">
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl"
        style={{ boxShadow: '0 40px 80px -20px rgba(var(--bmb-site-primary-rgb), 0.3)' }}
      >
        <InlineImage
          src={image}
          alt={`${businessName}, ${about.heading}`}
          path="about"
          fieldName="imageIndex"
          className="h-full w-full"
          placeholder={
            <div
              className="h-full w-full"
              role="img"
              aria-label={`${businessName} brand illustration`}
              style={{ background: brandGradient(config.brand, 160) }}
            />
          }
        />
      </div>
      {/*
        Secondary accent tile, bottom-right corner.
        Public render: show the photo when resolved, fall back to the
        brand-gradient swatch (the original decorative behaviour) when
        nothing is set.
        Edit mode: wrap in a bespoke click target rather than InlineImage
        — the outline + camera badge treatment clips badly on a rotated
        rounded container, and we want the tile's aesthetic (rotate-6,
        shadow, rounded corners) to be the click target itself.
      */}
      {editMode ? (
        <button
          type="button"
          onClick={() =>
            onImageClick?.({
              path: remapPathForPage('about', currentPageSlug, pageIndex),
              fieldName: 'secondaryImageIndex',
            })
          }
          aria-label="Change accent photo"
          className="group absolute -bottom-6 -right-6 h-32 w-32 overflow-hidden rounded-3xl rotate-6 shadow-xl transition-transform hover:rotate-3 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9CA1]"
        >
          {secondaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={secondaryImage}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center"
              style={{ background: brandGradient(config.brand, 60) }}
            >
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/90">
                + photo
              </span>
            </span>
          )}
          {/* Always-visible camera badge so the affordance reads without
              relying on hover. Sits top-left of the tile to avoid
              conflicting with the main photo's corner below. */}
          <span
            aria-hidden
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/10 transition-transform group-hover:scale-110"
            style={{ color: 'var(--bmb-site-primary)' }}
          >
            <ImagePlus className="h-3 w-3" />
          </span>
        </button>
      ) : secondaryImage ? (
        <div
          aria-hidden
          className="absolute -bottom-6 -right-6 h-32 w-32 overflow-hidden rounded-3xl rotate-6 shadow-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={secondaryImage}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="absolute -bottom-6 -right-6 h-32 w-32 rounded-3xl rotate-6"
          style={{ background: brandGradient(config.brand, 60) }}
        />
      )}
    </div>
  );

  // Body paragraphs: when not editing we split on blank lines to preserve
  // visual paragraphs. In edit mode we expose the whole body as a single
  // multi-line editable so the user's newlines round-trip cleanly without
  // getting swallowed by the paragraph renderer.
  const body = about.body ?? '';
  const paragraphs = body.split('\n\n');

  return (
    <SectionWrapper immediate={embedded} id="about" className="bg-white py-14 md:py-20 lg:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 lg:grid-cols-2 lg:gap-16">
        {embedded ? imageContainer : <Parallax offset={40}>{imageContainer}</Parallax>}

        <div>
          <SectionHeader
            eyebrowPath="about.eyebrow"
            headingPath="about.heading"
            eyebrow={about.eyebrow ?? 'About us'}
            heading={about.heading}
            embedded={embedded}
            align="left"
            maxWidthClass="max-w-none"
            placeholders={{
              eyebrow: 'Section eyebrow…',
              heading: 'About heading…',
            }}
          />
          <div className="mt-5 space-y-4 text-base text-slate-600 md:text-lg">
            {editMode ? (
              <InlineEditable
                path="about.body"
                value={body}
                as="p"
                multiline
                maxLength={4000}
                placeholder="Two or three short paragraphs separated by blank lines…"
              />
            ) : (
              paragraphs.map((para, i) => <p key={i}>{para}</p>)
            )}
          </div>
          {about.bullets && about.bullets.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {about.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-700">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0"
                    style={{ color: 'var(--bmb-site-primary)' }}
                  />
                  <InlineEditable
                    path={`about.bullets.${i}`}
                    value={b}
                    as="span"
                    placeholder="Proof point…"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </SectionWrapper>
  );
}
