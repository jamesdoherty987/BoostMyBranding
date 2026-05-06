/**
 * Shared preset helpers for video templates.
 *
 * Every template should apply presets the same way so behaviour stays
 * predictable for the dashboard picker:
 *
 *   1. Look up `options.presetId` in the template's roster.
 *   2. Merge the preset's palette OVER the caller's brand palette
 *      (so sunset-preset on a teal brand = sunset colours, not teal).
 *   3. Merge the caller's options OVER the preset's options
 *      (so an explicit `mood: 'energetic'` from the caller still wins).
 *
 * Each template exports its roster as `<TEMPLATE>_PRESETS` plus a
 * `resolvePalette(brand, options)` wrapper built on top of this
 * module's `applyPreset` function. Keep the pattern identical so a new
 * template author only needs to write the roster.
 */

import type { BrandPalette, TemplatePreset, VideoOptions } from './types';

/**
 * Merge a preset into the caller-supplied brand + options. Returns the
 * resolved palette and options that the Scene component should render
 * from. Handles the "no preset / unknown preset / default preset" cases
 * by returning the caller input unchanged.
 */
export function applyPreset(
  brand: BrandPalette,
  options: VideoOptions | undefined,
  presets: readonly TemplatePreset[],
): { palette: BrandPalette; options: VideoOptions } {
  const id = options?.presetId;
  if (!id || id === 'default') {
    return { palette: brand, options: options ?? {} };
  }
  const preset = presets.find((p) => p.id === id);
  if (!preset) {
    return { palette: brand, options: options ?? {} };
  }
  return {
    palette: { ...brand, ...(preset.palette ?? {}) },
    options: { ...(preset.options ?? {}), ...(options ?? {}) },
  };
}
