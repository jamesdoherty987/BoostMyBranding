'use client';

/**
 * Click-to-swap image wrapper. In public mode it's a plain `<img>`. In
 * edit mode (dashboard preview) it overlays a "Change photo" button on
 * hover — clicking either the image or the button calls the context's
 * `onImageClick` callback, which the dashboard wires to open the media
 * library picker.
 *
 * Used inside blocks (About, Team, Portfolio etc.) so an agency can
 * swap an image without leaving the preview.
 */

import { ImageIcon } from 'lucide-react';
import { useSiteContext } from './context';
import { remapPathForPage } from './path-remap';

interface InlineImageProps {
  /**
   * Image URL to render. Pre-resolved by the caller from (imageUrl ??
   * images[imageIndex]).
   */
  src?: string;
  /** Alt text. Empty string for decorative images. */
  alt?: string;
  /** Tailwind classes applied to the `<img>` / fallback tile. */
  className?: string;
  /**
   * Path prefix of the image field in the config. For example, for
   * `about.imageIndex` pass `path="about"`. For a team member's photo,
   * pass `path="team.members.2"`. The editor appends `.imageIndex` or
   * `.imageUrl` when the user picks.
   */
  path: string;
  /**
   * Which field name the config uses at this location. `imageIndex`
   * for most blocks; `photoIndex` for team members.
   */
  fieldName?: 'imageIndex' | 'imageUrl' | 'photoIndex' | 'photoUrl';
  /** When no src resolves, show a colored placeholder instead of a broken image. */
  placeholder?: React.ReactNode;
  /** When true, render nothing if there's no image (useful for optional hero images). */
  skipWhenEmpty?: boolean;
}

export function InlineImage({
  src,
  alt = '',
  className,
  path,
  fieldName = 'imageIndex',
  placeholder,
  skipWhenEmpty = false,
}: InlineImageProps) {
  const { editMode, onImageClick, currentPageSlug, pageIndex } = useSiteContext();

  // Public render: plain `<img>` or placeholder.
  if (!editMode) {
    if (!src) {
      if (skipWhenEmpty) return null;
      return <>{placeholder ?? null}</>;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} loading="lazy" />;
  }

  // Edit mode: wrap in a clickable button. Hovering reveals a "Change" chip.
  // We remap the path to the sub-page's override namespace when applicable so
  // a click on an About sub-page's photo writes to `pages.N.blocks.about.*`
  // rather than stomping the homepage.
  const openPicker = () => {
    const writePath = remapPathForPage(path, currentPageSlug, pageIndex);
    onImageClick?.({ path: writePath, fieldName });
  };

  return (
    <button
      type="button"
      onClick={openPicker}
      className={`group relative block overflow-hidden outline-2 outline-offset-2 outline-transparent transition-all hover:outline-[#1D9CA1] ${
        className ?? ''
      }`}
      aria-label="Change image"
      data-inline-image-path={path}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}
      {/* Hover overlay — dimmed scrim + pill. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#1D9CA1]/0 transition-colors group-hover:bg-[#1D9CA1]/30"
      >
        <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100">
          Change photo
        </span>
      </span>
    </button>
  );
}
