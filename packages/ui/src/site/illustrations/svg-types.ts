/**
 * Shared types for the illustration library. Extracted so extra-svgs.tsx
 * can import from a stable path without pulling in the whole dispatcher
 * tree.
 */

export interface BrandPalette {
  primary: string;
  accent: string;
  pop?: string;
  /** Deep neutral for contrast shading. Defaults to near-black. */
  dark?: string;
}

export interface IllustrationProps {
  brand: BrandPalette;
  /** Unique id prefix so two illustrations on the same page don't clash
   *  on gradient/filter ids. Required in practice. */
  idPrefix: string;
  className?: string;
}
