import type { WebsiteConfig } from '@boost/core';
import { BRAND_FALLBACK, hexToRgbTuple, normalizeHex, luminance } from '@boost/core';

/**
 * Derive a consistent CSS-variable palette from a config's brand block.
 * Injected at the root of the rendered site so every block can consume
 * `var(--bmb-site-primary)`, `var(--bmb-site-accent)` etc. without threading
 * props. Variables are namespaced with `--bmb-site-` to avoid collisions with
 * host pages that embed the renderer.
 */
export function themeVars(brand: WebsiteConfig['brand']): Record<string, string> {
  const primary = normalizeHex(brand.primaryColor) ?? BRAND_FALLBACK.primary;
  const accent = normalizeHex(brand.accentColor) ?? BRAND_FALLBACK.accent;
  const pop = normalizeHex(brand.popColor) ?? BRAND_FALLBACK.pop;
  const dark = normalizeHex(brand.darkColor) ?? BRAND_FALLBACK.dark;

  return {
    '--bmb-site-primary': primary,
    '--bmb-site-accent': accent,
    '--bmb-site-pop': pop,
    '--bmb-site-dark': dark,
    '--bmb-site-primary-rgb': hexToRgbTuple(primary),
    '--bmb-site-accent-rgb': hexToRgbTuple(accent),
    '--bmb-site-pop-rgb': hexToRgbTuple(pop),
    /**
     * Pre-computed foreground for primary-colored panels. White on dark primaries,
     * near-black on light primaries. Lets blocks consume it without recomputing.
     */
    '--bmb-site-on-primary': luminance(primary) > 0.55 ? '#0b1220' : '#ffffff',
  } as Record<string, string>;
}

/**
 * Build the hero gradient as a single string so the renderer can inline it.
 * Uses three color stops so the result never looks flat.
 */
export function brandGradient(brand: WebsiteConfig['brand'], angle = 135) {
  const p = normalizeHex(brand.primaryColor) ?? BRAND_FALLBACK.primary;
  const a = normalizeHex(brand.accentColor) ?? BRAND_FALLBACK.accent;
  const pop = normalizeHex(brand.popColor) ?? BRAND_FALLBACK.pop;
  return `linear-gradient(${angle}deg, ${p} 0%, ${a} 55%, ${pop} 100%)`;
}
