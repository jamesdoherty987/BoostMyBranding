/**
 * Hero background hook-up.
 *
 * Examples:
 *   image: BARBER_IMAGES[0].src
 *   image: '/barber/hero.jpg'   // file in apps/web/public/barber/
 *
 * For an animation, pass `animation` into <Hero /> from BarberSite —
 * see BarberSite.tsx. Leave image null for a plain white hero.
 */
export const HERO_BACKGROUND = {
  /** Full-bleed background image URL, or null for none. */
  image: null as string | null,
  /** Black wash over image/animation so copy stays readable (0–1). */
  overlay: 0.45,
};
