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
   *
   * When `fieldName` is `'direct'` the path itself IS the target — used
   * for arrays of primitives like `gallery.imageIndices.3`.
   */
  path: string;
  /**
   * Which field name the config uses at this location. `imageIndex`
   * for most blocks; `photoIndex` for team members; `logoIndex` for
   * the nav/brand logo; `secondaryImageIndex` for the about section's
   * accent tile. Use `'direct'` to write straight to `path` (for
   * array-of-numbers fields like gallery.imageIndices.N).
   */
  fieldName?:
    | 'imageIndex'
    | 'imageUrl'
    | 'photoIndex'
    | 'photoUrl'
    | 'logoIndex'
    | 'logoUrl'
    | 'secondaryImageIndex'
    | 'secondaryImageUrl'
    | 'direct';
  /** When no src resolves, show a colored placeholder instead of a broken image. */
  placeholder?: React.ReactNode;
  /** When true, render nothing if there's no image (useful for optional hero images). */
  skipWhenEmpty?: boolean;
  /**
   * Visual treatment of the edit-mode click target. Default 'full' adds
   * a dashed outline + "Change photo" chip — perfect for large image
   * containers like heros, about tiles, and product cards. 'compact'
   * skips the chip and uses a subtler outline — use for small surfaces
   * (nav logos, favicons, tiny accent tiles) where a full-size chip
   * would overwhelm the image.
   */
  editStyle?: 'full' | 'compact';
}

export function InlineImage({
  src,
  alt = '',
  className,
  path,
  fieldName = 'imageIndex',
  placeholder,
  skipWhenEmpty = false,
  editStyle = 'full',
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

  // Edit mode: wrap in a clickable button. Compact treatment skips the
  // "Change photo" chip — better for small surfaces like the nav logo.
  const openPicker = () => {
    const writePath = remapPathForPage(path, currentPageSlug, pageIndex);
    onImageClick?.({ path: writePath, fieldName });
  };

  const outlineClass =
    editStyle === 'compact'
      ? 'outline outline-1 outline-dashed outline-[#1D9CA1]/50 outline-offset-1 hover:outline-solid hover:outline-[#1D9CA1]'
      : 'outline outline-2 outline-dashed outline-[#1D9CA1]/60 outline-offset-2 hover:outline-solid hover:outline-[#1D9CA1]';

  return (
    <button
      type="button"
      onClick={openPicker}
      className={`group relative block overflow-hidden ${outlineClass} transition-all ${
        className ?? ''
      }`}
      aria-label="Change image"
      data-inline-image-path={path}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : placeholder ? (
        // Use the caller's custom placeholder in edit mode too — the nav
        // logo and about accent tile both supply a branded placeholder
        // that's more informative than the generic "click to add image"
        // chip. Falls back to the generic below when no placeholder is
        // provided.
        <div className="h-full w-full">{placeholder}</div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500">
          <ImageIcon className={editStyle === 'compact' ? 'h-4 w-4' : 'h-8 w-8'} />
          {editStyle === 'full' ? (
            <span className="text-xs font-medium">Click to add image</span>
          ) : null}
        </div>
      )}
      {/* Always-visible "Change photo" chip when an image exists — only
          in the full treatment. Compact mode relies on the dashed
          outline alone so the chip doesn't overflow the logo. */}
      {src && editStyle === 'full' ? (
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
