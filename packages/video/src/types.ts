/**
 * Shared types for the video template system. Every template accepts a
 * `VideoProps` object so the same template can produce vastly different
 * videos by swapping brand colors, copy, and imagery.
 */

export interface BrandPalette {
  /** Main brand color. */
  primary: string;
  /** Secondary brand color, used in gradients. */
  accent: string;
  /** Pop / highlight color (usually yellow/gold). */
  pop: string;
  /** Dark neutral for backgrounds and footers. */
  dark: string;
  /** Near-white paper tone. */
  paper: string;
}

/** Per-template configuration knobs. All optional — templates fall back to sensible defaults. */
export interface VideoOptions {
  /** Override headline font size in px. */
  headlineSize?: number;
  /** Use 'serif' or 'display' for headline. Template-specific default. */
  headlineFont?: 'serif' | 'display';
  /** Override the scene duration (frames at 30fps). */
  duration?: number;
  /** Tint strength for backgrounds, 0-1. */
  intensity?: number;
  /** Which accent element to highlight (template-specific). */
  accentStyle?: 'underline' | 'dot' | 'bar' | 'ring' | 'none';
  /** Mood/energy level. Affects animation speed and motion. */
  mood?: 'calm' | 'balanced' | 'energetic';
  /** Show/hide the brand mark in outro. */
  showBrandMark?: boolean;
  /** Show/hide the CTA button. */
  showCta?: boolean;
}

export interface VideoProps {
  /** Business name — displayed in the outro. */
  businessName: string;
  /** Short headline, 2-5 words. */
  headline: string;
  /** Optional subheadline, one sentence. */
  subheadline?: string;
  /** Call-to-action text for the outro button. */
  cta?: string;
  /** Optional domain displayed next to the CTA. */
  domain?: string;
  /** Brand color palette. */
  brand: BrandPalette;
  /** Optional hero image URL (product shot with background removed). */
  imageUrl?: string;
  /** Optional background video URL (used as a subtle backdrop). */
  backgroundVideoUrl?: string;
  /** Fine-tuning knobs. Most templates honor these; see each template's docs. */
  options?: VideoOptions;
}

export const DEFAULT_BRAND: BrandPalette = {
  primary: '#1D9CA1',
  accent: '#48D886',
  pop: '#FFEC3D',
  dark: '#0B1220',
  paper: '#FAF6EF',
};

/** Typography tokens — kept consistent across all templates for brand coherence. */
export const FONTS = {
  display: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif",
  serif: "'Times New Roman','Times',Georgia,serif",
  mono: "'SF Mono','JetBrains Mono',Menlo,Consolas,monospace",
} as const;

/** Standard video dimensions and framerate. */
export const VIDEO_CONFIG = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

/** Map `mood` to an animation speed multiplier. */
export function moodSpeed(mood: VideoOptions['mood']): number {
  switch (mood) {
    case 'calm':
      return 0.7;
    case 'energetic':
      return 1.4;
    case 'balanced':
    default:
      return 1;
  }
}
