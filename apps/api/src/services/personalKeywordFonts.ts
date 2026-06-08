/**
 * Keyword / slate FFmpeg drawtext fonts — **bundled TTFs only** (no OS fallbacks).
 * Files live under `apps/api/assets/keyword-fonts/` (OFL, from Google Fonts source).
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KeywordOverlayFontId } from '@boost/api-client';
import { normalizeKeywordOverlayFontPreset } from '@boost/api-client';

const FONT_FILES: Record<KeywordOverlayFontId, string> = {
  inter: 'Inter-VF.ttf',
  lora: 'Lora-VF.ttf',
  source_serif: 'SourceSerif4-VF.ttf',
  jetbrains_mono: 'JetBrainsMono-VF.ttf',
  oswald: 'Oswald-VF.ttf',
  dm_sans: 'DMSans-VF.ttf',
};

/** `src/services` or `dist/services` → `apps/api` package root. */
function apiPackageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

/**
 * Absolute path to the bundled .ttf for this preset. Throws if the file is missing
 * (deploy must include `assets/keyword-fonts`).
 */
export function resolveKeywordOverlayBundledFontPath(
  preset: KeywordOverlayFontId | string | undefined | null,
): string {
  const id = normalizeKeywordOverlayFontPreset(preset as string | undefined);
  const file = FONT_FILES[id];
  const abs = path.join(apiPackageRoot(), 'assets', 'keyword-fonts', file);
  if (!existsSync(abs)) {
    throw new Error(
      `Bundled keyword font missing: ${abs} (preset ${id}). Add OFL fonts under apps/api/assets/keyword-fonts/ — see README there.`,
    );
  }
  return abs;
}
