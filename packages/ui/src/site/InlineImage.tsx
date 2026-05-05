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

  // Edit mode: wrap in a clickable button. Always shows a "Change photo"
  // chip so the click target is obvious — no hover required. This is
  // critical on touch devices where hover-to-reveal doesn't work, and
  // also helps first-time users who don't realize the image is clickable.
  const openPicker = () => {
    const writePath = remapPathForPage(path, currentPageSlug, pageIndex);
    onImageClick?.({ path: writePath, fieldName });
  };

  return (
    <button
      type="button"
      onClick={openPicker}
      className={`group relative block overflow-hidden outline outline-2 outline-dashed outline-[#1D9CA1]/60 outline-offset-2 transition-all hover:outline-solid hover:outline-[#1D9CA1] ${
        className ?? ''
      }`}
      aria-label="Change image"
      data-inline-image-path={path}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500">
          <ImageIcon className="h-8 w-8" />
          <span className="text-xs font-medium">Click to add image</span>
        </div>
      )}
      {/* Always-visible "Change photo" chip when an image exists. Darkens
          on hover so it looks obviously interactive. */}
      {src ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-slate-900 shadow-md backdrop-blur transition-all group-hover:bg-[#1D9CA1] group-hover:text-white"
        >
          <ImageIcon className="h-2.5 w-2.5" />
          Change photo
        </span>
      ) : null}
    </button>
  );
}
