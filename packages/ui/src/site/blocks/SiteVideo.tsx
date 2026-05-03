'use client';

import { useMemo } from 'react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';

interface SiteVideoProps {
  config: WebsiteConfig;
}

type VideoKind =
  | { kind: 'youtube'; id: string }
  | { kind: 'vimeo'; id: string }
  | { kind: 'mp4'; src: string }
  | { kind: 'unknown' };

/**
 * Video block. Accepts YouTube, Vimeo, or direct MP4 URLs and renders a
 * responsive 16:9 frame. YouTube/Vimeo use privacy-respecting embeds
 * (nocookie / dnt) so no tracking fires unless the user presses play.
 *
 * MP4s render with native `<video controls>` and an optional poster.
 * Autoplay is supported but muted-only (browser policy).
 */
export function SiteVideo({ config }: SiteVideoProps) {
  const { embedded } = useSiteContext();
  const v = config.video;
  const source: VideoKind = useMemo(() => parseVideoUrl(v?.url), [v?.url]);
  if (!v?.url || source.kind === 'unknown') return null;

  return (
    <SectionWrapper immediate={embedded} className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        {v.eyebrow || v.heading ? (
          <div className="mx-auto mb-8 max-w-2xl text-center">
            {v.eyebrow ? (
              <InlineEditable
                path="video.eyebrow"
                value={v.eyebrow}
                as="p"
                className="text-xs font-semibold uppercase tracking-[0.25em]"
                style={{ color: 'var(--bmb-site-primary)' }}
                placeholder="Section eyebrow…"
              />
            ) : null}
            {v.heading ? (
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
                <InlineEditable
                  path="video.heading"
                  value={v.heading}
                  as="span"
                  placeholder="Section heading…"
                />
              </h2>
            ) : null}
            {v.body ? (
              <p className="mt-4 text-base text-slate-600 md:text-lg">
                <InlineEditable
                  path="video.body"
                  value={v.body}
                  as="span"
                  multiline
                  placeholder="Supporting copy…"
                />
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl bg-slate-900 shadow-2xl">
          <div className="relative aspect-video">
            {source.kind === 'youtube' ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${source.id}?rel=0${
                  v.autoplay ? '&autoplay=1&mute=1&playsinline=1' : ''
                }`}
                title={v.heading ?? 'Video'}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : source.kind === 'vimeo' ? (
              <iframe
                src={`https://player.vimeo.com/video/${source.id}?dnt=1${
                  v.autoplay ? '&autoplay=1&muted=1' : ''
                }`}
                title={v.heading ?? 'Video'}
                loading="lazy"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <video
                src={source.src}
                poster={v.posterUrl}
                controls
                autoPlay={v.autoplay}
                muted={v.autoplay}
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

/** Detect the source type from a URL so we can pick the right embed. */
function parseVideoUrl(url?: string): VideoKind {
  if (!url) return { kind: 'unknown' };
  const u = url.trim();

  // YouTube: https://youtu.be/ID, https://www.youtube.com/watch?v=ID,
  // https://www.youtube.com/embed/ID, https://www.youtube.com/shorts/ID
  const ytShort = u.match(/^https?:\/\/youtu\.be\/([\w-]{6,})/i);
  if (ytShort) return { kind: 'youtube', id: ytShort[1]! };
  const ytWatch = u.match(/[?&]v=([\w-]{6,})/);
  if (/youtube\.com/i.test(u) && ytWatch) {
    return { kind: 'youtube', id: ytWatch[1]! };
  }
  const ytEmbed = u.match(
    /^https?:\/\/(?:www\.)?youtube\.com\/(?:embed|shorts)\/([\w-]{6,})/i,
  );
  if (ytEmbed) return { kind: 'youtube', id: ytEmbed[1]! };

  // Vimeo: https://vimeo.com/ID, https://player.vimeo.com/video/ID
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return { kind: 'vimeo', id: vimeo[1]! };

  // Direct MP4 / WebM file
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u)) {
    return { kind: 'mp4', src: u };
  }

  return { kind: 'unknown' };
}
