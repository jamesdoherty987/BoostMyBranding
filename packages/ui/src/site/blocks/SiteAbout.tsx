'use client';

import type { WebsiteConfig } from '@boost/core';
import { CheckCircle2 } from 'lucide-react';
import { SectionWrapper } from '../../section-wrapper';
import { Parallax } from '../../parallax';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';

interface SiteAboutProps {
  config: WebsiteConfig;
  images: string[];
  businessName: string;
}

export function SiteAbout({ config, images, businessName }: SiteAboutProps) {
  const { embedded } = useSiteContext();
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
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={`${businessName}, ${about.heading}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="h-full w-full"
            role="img"
            aria-label={`${businessName} brand illustration`}
            style={{ background: brandGradient(config.brand, 160) }}
          />
        )}
      </div>
      <div
        aria-hidden
        className="absolute -bottom-6 -right-6 h-32 w-32 rounded-3xl rotate-6"
        style={{ background: brandGradient(config.brand, 60) }}
      />
    </div>
  );

  return (
    <SectionWrapper immediate={embedded} id="about" className="bg-white py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 lg:grid-cols-2 lg:gap-16">
        {embedded ? imageContainer : <Parallax offset={40}>{imageContainer}</Parallax>}

        <div>
          <p
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
          >
            About us
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {about.heading}
          </h2>
          <div className="mt-5 space-y-4 text-base text-slate-600 md:text-lg">
            {(about.body ?? '').split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          {about.bullets && about.bullets.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {about.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-700">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0"
                    style={{ color: 'var(--bmb-site-primary)' }}
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </SectionWrapper>
  );
}
