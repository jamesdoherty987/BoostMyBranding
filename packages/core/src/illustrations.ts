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
  /** Category for the grouped picker. */
  category:
    | 'general'
    | 'food'
    | 'beauty'
    | 'fitness'
    | 'medical'
    | 'home'
    | 'trades'
    | 'auto'
    | 'tech'
    | 'retail'
    | 'education'
    | 'creative'
    | 'nature'
    | 'abstract';
}

export const ILLUSTRATION_STYLES: IllustrationStyleMeta[] = [
  // General
  { id: 'rocket', label: 'Rocket', description: 'Launch vibes. Growth, ambition, tech.', preview: '🚀', recommendedMotion: 'launch', category: 'general' },
  { id: 'briefcase', label: 'Briefcase', description: 'Professional, consulting, finance.', preview: '💼', recommendedMotion: 'parallax', category: 'general' },
  { id: 'gavel', label: 'Gavel', description: 'Legal, courts, notaries.', preview: '⚖️', recommendedMotion: 'parallax', category: 'general' },

  // Food & drink
  { id: 'coffee-cup', label: 'Coffee cup', description: 'Cafes, bakeries, brunch spots.', preview: '☕', recommendedMotion: 'float', category: 'food' },
  { id: 'espresso', label: 'Espresso cup', description: 'Italian cafes, espresso bars.', preview: '☕', recommendedMotion: 'float', category: 'food' },
  { id: 'croissant', label: 'Croissant', description: 'Bakeries, breakfast spots.', preview: '🥐', recommendedMotion: 'wobble', category: 'food' },
  { id: 'pizza-slice', label: 'Pizza slice', description: 'Pizzerias, casual restaurants.', preview: '🍕', recommendedMotion: 'sway', category: 'food' },
  { id: 'wine-glass', label: 'Wine glass', description: 'Wine bars, fine dining.', preview: '🍷', recommendedMotion: 'sway', category: 'food' },
  { id: 'cocktail', label: 'Cocktail', description: 'Bars, lounges, nightlife.', preview: '🍸', recommendedMotion: 'sway', category: 'food' },
  { id: 'ice-cream', label: 'Ice cream', description: 'Ice cream shops, gelaterias.', preview: '🍦', recommendedMotion: 'bounce', category: 'food' },
  { id: 'cupcake', label: 'Cupcake', description: 'Bakeries, patisseries, cake shops.', preview: '🧁', recommendedMotion: 'float', category: 'food' },
  { id: 'chef-hat', label: 'Chef hat', description: 'Restaurants, catering, cooking schools.', preview: '👨‍🍳', recommendedMotion: 'float', category: 'food' },

  // Beauty & wellness
  { id: 'scissors', label: 'Scissors', description: 'Salons, barbers, hair, beauty.', preview: '✂️', recommendedMotion: 'orbit', category: 'beauty' },
  { id: 'hair-dryer', label: 'Hair dryer', description: 'Hair salons, stylists.', preview: '💨', recommendedMotion: 'tilt-3d', category: 'beauty' },
  { id: 'lipstick', label: 'Lipstick', description: 'Makeup artists, cosmetics.', preview: '💄', recommendedMotion: 'pulse', category: 'beauty' },
  { id: 'nail-polish', label: 'Nail polish', description: 'Nail salons, manicurists.', preview: '💅', recommendedMotion: 'sway', category: 'beauty' },
  { id: 'candle', label: 'Candle', description: 'Spas, wellness studios, holistic.', preview: '🕯️', recommendedMotion: 'float', category: 'beauty' },
  { id: 'flower', label: 'Flower', description: 'Florists, spas, wellness.', preview: '🌸', recommendedMotion: 'spin', category: 'beauty' },

  // Fitness
  { id: 'dumbbell', label: 'Dumbbell', description: 'Gyms, personal training, fitness.', preview: '🏋️', recommendedMotion: 'parallax', category: 'fitness' },
  { id: 'kettlebell', label: 'Kettlebell', description: 'Functional fitness, CrossFit.', preview: '⚫', recommendedMotion: 'sway', category: 'fitness' },
  { id: 'running-shoe', label: 'Running shoe', description: 'Running coaches, athletic brands.', preview: '👟', recommendedMotion: 'drift', category: 'fitness' },
  { id: 'yoga-pose', label: 'Yoga pose', description: 'Yoga studios, meditation, pilates.', preview: '🧘', recommendedMotion: 'float', category: 'fitness' },

  // Medical & dental
  { id: 'tooth', label: 'Tooth', description: 'Dental, orthodontics.', preview: '🦷', recommendedMotion: 'float', category: 'medical' },
  { id: 'stethoscope', label: 'Stethoscope', description: 'GPs, clinics, health services.', preview: '🩺', recommendedMotion: 'sway', category: 'medical' },
  { id: 'pill', label: 'Pill', description: 'Pharmacies, prescription services.', preview: '💊', recommendedMotion: 'pulse', category: 'medical' },
  { id: 'heart-pulse', label: 'Heart pulse', description: 'Cardiology, fitness, health tech.', preview: '💓', recommendedMotion: 'pulse', category: 'medical' },
  { id: 'dna', label: 'DNA helix', description: 'Labs, genetics, biotech, wellness.', preview: '🧬', recommendedMotion: 'spin', category: 'medical' },

  // Home
  { id: 'house', label: 'House', description: 'Real estate, cleaning, home services.', preview: '🏠', recommendedMotion: 'parallax', category: 'home' },
  { id: 'key', label: 'Key', description: 'Real estate, locksmiths, property management.', preview: '🔑', recommendedMotion: 'sway', category: 'home' },
  { id: 'couch', label: 'Couch', description: 'Interior design, furniture shops.', preview: '🛋️', recommendedMotion: 'parallax', category: 'home' },
  { id: 'lamp', label: 'Lamp', description: 'Lighting, interior design, homewares.', preview: '💡', recommendedMotion: 'pulse', category: 'home' },

  // Trades
  { id: 'wrench', label: 'Wrench', description: 'Trades, plumbing, mechanics, repairs.', preview: '🔧', recommendedMotion: 'drift', category: 'trades' },
  { id: 'hammer', label: 'Hammer', description: 'Builders, carpenters, construction.', preview: '🔨', recommendedMotion: 'shake', category: 'trades' },
  { id: 'toolbox', label: 'Toolbox', description: 'Handymen, general repair.', preview: '🧰', recommendedMotion: 'parallax', category: 'trades' },
  { id: 'paint-brush', label: 'Paint brush', description: 'Painters, decorators.', preview: '🖌️', recommendedMotion: 'drift', category: 'trades' },
  { id: 'gear', label: 'Gear / cog', description: 'Engineering, fabrication, mechanisms.', preview: '⚙️', recommendedMotion: 'spin', category: 'trades' },
  { id: 'drill', label: 'Drill', description: 'Carpenters, DIY, construction.', preview: '🪛', recommendedMotion: 'shake', category: 'trades' },

  // Automotive
  { id: 'car', label: 'Car', description: 'Automotive, body shops, garages.', preview: '🚗', recommendedMotion: 'drift', category: 'auto' },
  { id: 'motorcycle', label: 'Motorcycle', description: 'Bike shops, motorcycle services.', preview: '🏍️', recommendedMotion: 'drift', category: 'auto' },
  { id: 'delivery-van', label: 'Delivery van', description: 'Couriers, logistics, movers.', preview: '🚐', recommendedMotion: 'drift', category: 'auto' },

  // Tech
  { id: 'laptop', label: 'Laptop', description: 'SaaS, consulting, tech agencies.', preview: '💻', recommendedMotion: 'tilt-3d', category: 'tech' },
  { id: 'atom', label: 'Atom', description: 'Tech, science, R&D.', preview: '⚛️', recommendedMotion: 'spin', category: 'tech' },
  { id: 'cpu', label: 'CPU chip', description: 'Hardware, electronics, tech.', preview: '🖥️', recommendedMotion: 'pulse', category: 'tech' },

  // Retail
  { id: 'shopping-bag', label: 'Shopping bag', description: 'Retail, boutiques, gift shops.', preview: '🛍️', recommendedMotion: 'float', category: 'retail' },
  { id: 'gift-box', label: 'Gift box', description: 'Gift shops, special occasions.', preview: '🎁', recommendedMotion: 'wobble', category: 'retail' },
  { id: 'diamond', label: 'Diamond', description: 'Jewellery, luxury goods.', preview: '💎', recommendedMotion: 'tilt-3d', category: 'retail' },

  // Education
  { id: 'pencil', label: 'Pencil', description: 'Education, tutoring, design studios.', preview: '✏️', recommendedMotion: 'tilt-3d', category: 'education' },
  { id: 'book', label: 'Book', description: 'Bookshops, libraries, tutors, writers.', preview: '📖', recommendedMotion: 'flip-y', category: 'education' },
  { id: 'graduation-cap', label: 'Graduation cap', description: 'Schools, universities, tutoring.', preview: '🎓', recommendedMotion: 'float', category: 'education' },
  { id: 'apple', label: 'Apple', description: 'Schools, teachers, nutrition.', preview: '🍎', recommendedMotion: 'bounce', category: 'education' },

  // Creative
  { id: 'camera', label: 'Camera', description: 'Photography, video, creative studios.', preview: '📷', recommendedMotion: 'tilt-3d', category: 'creative' },
  { id: 'palette', label: 'Palette', description: 'Artists, designers, illustrators.', preview: '🎨', recommendedMotion: 'sway', category: 'creative' },
  { id: 'film-reel', label: 'Film reel', description: 'Videographers, production.', preview: '🎞️', recommendedMotion: 'spin', category: 'creative' },
  { id: 'music-note', label: 'Music note', description: 'Musicians, producers, studios.', preview: '🎵', recommendedMotion: 'wobble', category: 'creative' },
  { id: 'paw', label: 'Paw', description: 'Pet care, grooming, veterinary.', preview: '🐾', recommendedMotion: 'wobble', category: 'creative' },

  // Nature & outdoors
  { id: 'leaf', label: 'Leaf', description: 'Wellness, organic, landscaping, eco.', preview: '🌿', recommendedMotion: 'float', category: 'nature' },
  { id: 'tree', label: 'Tree', description: 'Landscapers, arborists, eco brands.', preview: '🌳', recommendedMotion: 'sway', category: 'nature' },
  { id: 'mountain', label: 'Mountain', description: 'Outdoor, adventure, travel.', preview: '🏔️', recommendedMotion: 'parallax', category: 'nature' },
  { id: 'sun', label: 'Sun', description: 'Solar, holidays, outdoor lifestyle.', preview: '☀️', recommendedMotion: 'spin', category: 'nature' },
  { id: 'wave', label: 'Wave', description: 'Surf, swim, coastal, wellness.', preview: '🌊', recommendedMotion: 'sway', category: 'nature' },

  // Abstract / geometric
  { id: 'orb', label: 'Orb', description: 'Abstract brand mark. Any industry.', preview: '⚪', recommendedMotion: 'spin', category: 'abstract' },
  { id: 'cube-iso', label: 'Iso cube', description: '3D isometric cube. Tech, agencies.', preview: '🧊', recommendedMotion: 'tilt-3d', category: 'abstract' },
  { id: 'prism', label: 'Prism', description: 'Triangular prism with light split.', preview: '🔺', recommendedMotion: 'spin', category: 'abstract' },
  { id: 'spiral', label: 'Spiral', description: 'Wellness, motion, progress brands.', preview: '🌀', recommendedMotion: 'spin', category: 'abstract' },
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
  events: 'leaf',
  homeservices: 'house',
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

/**
 * Stable ordering of illustration categories for the grouped picker.
 * Keeps the UI consistent between renders and across browser reloads.
 */
export const ILLUSTRATION_CATEGORIES: Array<{
  id: IllustrationStyleMeta['category'];
  label: string;
}> = [
  { id: 'general', label: 'General' },
  { id: 'food', label: 'Food & drink' },
  { id: 'beauty', label: 'Beauty & wellness' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'medical', label: 'Medical' },
  { id: 'home', label: 'Home & property' },
  { id: 'trades', label: 'Trades' },
  { id: 'auto', label: 'Automotive' },
  { id: 'tech', label: 'Tech' },
  { id: 'retail', label: 'Retail' },
  { id: 'education', label: 'Education' },
  { id: 'creative', label: 'Creative' },
  { id: 'nature', label: 'Nature' },
  { id: 'abstract', label: 'Abstract' },
];
