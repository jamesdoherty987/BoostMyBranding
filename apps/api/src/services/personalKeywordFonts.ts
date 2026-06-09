/**
 * Keyword / slate FFmpeg drawtext fonts — **bundled TTFs only** (no OS fallbacks).
 * Files live under `apps/api/assets/keyword-fonts/` (OFL, from Google Fonts source).
 */

import { existsSync, readFileSync } from 'node:fs';
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

let cachedApiPackageRoot: string | null = null;

/**
 * Directory that contains `assets/keyword-fonts/` (the `apps/api` package root).
 *
 * `../..` from this file is wrong for production: compiled output lives under
 * `dist/services/`, so two levels up is `apps/api/dist`, not `apps/api`.
 * Walking upward until we find this package’s `package.json` (`name: api`)
 * plus `assets/keyword-fonts` avoids both the bad `dist/` parent and any
 * unrelated `assets/` directory higher in the tree.
 */
function apiPackageRoot(): string {
  if (cachedApiPackageRoot) return cachedApiPackageRoot;
  const here = path.dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 14; i++) {
    const fontsDir = path.join(dir, 'assets', 'keyword-fonts');
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(fontsDir) && existsSync(path.join(fontsDir, FONT_FILES.inter)) && existsSync(pkgPath)) {
      try {
        const j = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (j.name === 'api') {
          cachedApiPackageRoot = dir;
          return dir;
        }
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cachedApiPackageRoot = path.resolve(here, '../..');
  return cachedApiPackageRoot;
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
