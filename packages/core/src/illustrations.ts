/**
 * Registry of built-in hero illustration styles plus per-industry
 * suggestions. Shared between the backend generator (to pick a default
 * style for each industry) and the editor UI (to populate the picker).
 *
 * Each entry is a short, human-friendly description of the illustration
 * — the SVG component lives in packages/ui/src/site/illustrations/ and
 * is selected at render time by the `style` string.
 */

import type { HeroIllustrationStyle, HeroIllustrationMotion, SiteTemplate } from './website.js';

export interface IllustrationStyleMeta {
  id: HeroIllustrationStyle;
  /** Short human label, e.g. "Rocket" — used in the picker. */
  label: string;
  /** One-line description of when to use this style. */
  description: string;
  /** Emoji used as a lightweight preview in the editor (no image fetch). */
  preview: string;
  /** Preferred motion preset for this style. */
  recommendedMotion: HeroIllustrationMotion;
}

export const ILLUSTRATION_STYLES: IllustrationStyleMeta[] = [
  {
    id: 'rocket',
    label: 'Rocket',
    description: 'Launch vibes. Growth, ambition, tech.',
    preview: '🚀',
    recommendedMotion: 'launch',
  },
  {
    id: 'wrench',
    label: 'Wrench',
    description: 'Trades, plumbing, mechanics, repairs.',
    preview: '🔧',
    recommendedMotion: 'drift',
  },
  {
    id: 'coffee-cup',
    label: 'Coffee cup',
    description: 'Cafes, bakeries, brunch spots.',
    preview: '☕',
    recommendedMotion: 'float',
  },
  {
    id: 'dumbbell',
    label: 'Dumbbell',
    description: 'Gyms, personal training, fitness.',
    preview: '🏋️',
    recommendedMotion: 'parallax',
  },
  {
    id: 'scissors',
    label: 'Scissors',
    description: 'Salons, barbers, hair, beauty.',
    preview: '✂️',
    recommendedMotion: 'orbit',
  },
  {
    id: 'leaf',
    label: 'Leaf',
    description: 'Wellness, organic, landscaping, eco.',
    preview: '🌿',
    recommendedMotion: 'float',
  },
  {
    id: 'house',
    label: 'House',
    description: 'Real estate, cleaning, home services.',
    preview: '🏠',
    recommendedMotion: 'parallax',
  },
  {
    id: 'tooth',
    label: 'Tooth',
    description: 'Dental, orthodontics.',
    preview: '🦷',
    recommendedMotion: 'float',
  },
  {
    id: 'pencil',
    label: 'Pencil',
    description: 'Education, tutoring, design studios.',
    preview: '✏️',
    recommendedMotion: 'tilt-3d',
  },
  {
    id: 'gavel',
    label: 'Gavel',
    description: 'Legal, courts, notaries.',
    preview: '⚖️',
    recommendedMotion: 'parallax',
  },
  {
    id: 'camera',
    label: 'Camera',
    description: 'Photography, video, creative studios.',
    preview: '📷',
    recommendedMotion: 'tilt-3d',
  },
  {
    id: 'car',
    label: 'Car',
    description: 'Automotive, body shops, garages.',
    preview: '🚗',
    recommendedMotion: 'drift',
  },
  {
    id: 'paw',
    label: 'Paw',
    description: 'Pet care, grooming, veterinary.',
    preview: '🐾',
    recommendedMotion: 'float',
  },
  {
    id: 'briefcase',
    label: 'Briefcase',
    description: 'Professional, consulting, finance.',
    preview: '💼',
    recommendedMotion: 'parallax',
  },
  {
    id: 'shopping-bag',
    label: 'Shopping bag',
    description: 'Retail, boutiques, gift shops.',
    preview: '🛍️',
    recommendedMotion: 'float',
  },
];

/**
 * Map each site template to the best-fit illustration style. The
 * generator uses this to pick a default illustration without asking
 * Claude — the agency can always swap it later.
 */
export const DEFAULT_ILLUSTRATION_BY_TEMPLATE: Record<
  SiteTemplate,
  HeroIllustrationStyle
> = {
  service: 'wrench',
  food: 'coffee-cup',
  beauty: 'scissors',
  fitness: 'dumbbell',
  professional: 'briefcase',
  retail: 'shopping-bag',
  medical: 'tooth',
  creative: 'camera',
  realestate: 'house',
  education: 'pencil',
  automotive: 'car',
  hospitality: 'coffee-cup',
  legal: 'gavel',
  nonprofit: 'leaf',
  tech: 'rocket',
};

/**
 * Resolve the meta for a given style id. Returns undefined for unknown
 * strings — callers should fall back to a default.
 */
export function getIllustrationStyle(
  id: HeroIllustrationStyle | string | undefined,
): IllustrationStyleMeta | undefined {
  if (!id) return undefined;
  return ILLUSTRATION_STYLES.find((s) => s.id === id);
}

/**
 * Pick the default motion preset for a given style. Used by the
 * renderer when the user hasn't explicitly set `motion`, and by the
 * editor to preview which preset will play.
 */
export function defaultMotionForStyle(
  style: HeroIllustrationStyle | undefined,
): HeroIllustrationMotion {
  if (!style) return 'parallax';
  const meta = getIllustrationStyle(style);
  return meta?.recommendedMotion ?? 'parallax';
}
