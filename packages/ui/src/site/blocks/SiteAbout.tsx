'use client';

import type { WebsiteConfig } from '@boost/core';
import { CheckCircle2 } from 'lucide-react';
import { SectionWrapper } from '../../section-wrapper';
import { Parallax } from '../../parallax';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';
import { InlineImage } from '../InlineImage';

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
  const { embedded, editMode } = useSiteContext();
  const about = config.about;
  if (!about) return null;

  const image =
    about.imageIndex != null
      ? images[about.imageIndex]
      : images[Math.min(1, Math.max(0, images.length - 1))];

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
      <div
        aria-hidden
        className="absolute -bottom-6 -right-6 h-32 w-32 rounded-3xl rotate-6"
        style={{ background: brandGradient(config.brand, 60) }}
      />
    </div>
  );

  // Body paragraphs: when not editing we split on blank lines to preserve
  // visual paragraphs. In edit mode we expose the whole body as a single
  // multi-line editable so the user's newlines round-trip cleanly without
  // getting swallowed by the paragraph renderer.
  const body = about.body ?? '';
  const paragraphs = body.split('\n\n');

  return (
    <SectionWrapper immediate={embedded} id="about" className="bg-white py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 lg:grid-cols-2 lg:gap-16">
        {embedded ? imageContainer : <Parallax offset={40}>{imageContainer}</Parallax>}

        <div>
          <InlineEditable
            path="about.eyebrow"
            value={about.eyebrow ?? 'About us'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="about.heading"
              value={about.heading}
              as="span"
              placeholder="About heading…"
            />
          </h2>
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
