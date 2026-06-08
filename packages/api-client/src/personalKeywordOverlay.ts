/**
 * Keyword lower-third options for personal FFmpeg stitch — shared by dashboard
 * preview and API stitch so per-aspect overrides match runtime.
 */

export type KeywordOverlayAspectKey = '9:16' | '1:1' | '16:9' | '4:5';

/** Min/max scale vs height-derived default (stitcher + dashboard slider). */
export const KEYWORD_OVERLAY_FONT_SCALE_MIN = 0.72;
export const KEYWORD_OVERLAY_FONT_SCALE_MAX = 2.25;

export const KEYWORD_OVERLAY_TEXT_ANCHORS = [
  'top_left',
  'top_center',
  'top_right',
  'middle_left',
  'center',
  'middle_right',
  'bottom_left',
  'bottom_center',
  'bottom_right',
] as const;

export type KeywordOverlayTextAnchor = (typeof KEYWORD_OVERLAY_TEXT_ANCHORS)[number];

export function isKeywordOverlayTextAnchor(s: string | undefined): s is KeywordOverlayTextAnchor {
  return s != null && (KEYWORD_OVERLAY_TEXT_ANCHORS as readonly string[]).includes(s);
}

/**
 * Bundled keyword fonts (OFL variable TTFs under `apps/api/assets/keyword-fonts/`).
 * Legacy `clean_sans` / `clean_serif` are normalized at read time.
 */
export const KEYWORD_OVERLAY_FONT_IDS = [
  'inter',
  'lora',
  'source_serif',
  'jetbrains_mono',
  'oswald',
  'dm_sans',
] as const;

export type KeywordOverlayFontId = (typeof KEYWORD_OVERLAY_FONT_IDS)[number];

export function isKeywordOverlayFontId(s: string): s is KeywordOverlayFontId {
  return (KEYWORD_OVERLAY_FONT_IDS as readonly string[]).includes(s);
}

/**
 * Normalize stored preset (including legacy dashboard values).
 * Unknown strings warn once in server logs and map to `inter` so old rows do not brick renders.
 */
export function normalizeKeywordOverlayFontPreset(raw: string | undefined | null): KeywordOverlayFontId {
  if (raw == null || raw === '') return 'inter';
  const t = String(raw).trim();
  if (t === 'clean_sans') return 'inter';
  if (t === 'clean_serif') return 'source_serif';
  if (isKeywordOverlayFontId(t)) return t;
  console.warn(`[keyword-overlay] unknown fontPreset ${JSON.stringify(raw)} — using inter`);
  return 'inter';
}

export type KeywordOverlayAspectOverride = {
  fontPreset?: KeywordOverlayFontId | 'clean_sans' | 'clean_serif';
  fontScale?: number;
  textBackground?: boolean;
  textAnchor?: KeywordOverlayTextAnchor;
};

/** Subset of {@link PersonalGeneratorConfig} used for merge (avoids circular imports). */
export type PersonalGenKeywordOverlayFields = {
  keywordOverlayFontPreset?: KeywordOverlayFontId | 'clean_sans' | 'clean_serif';
  keywordOverlayFontScale?: number;
  keywordOverlayTextBackground?: boolean;
  keywordOverlayTextAnchor?: KeywordOverlayTextAnchor;
  keywordOverlayByAspect?: Partial<Record<KeywordOverlayAspectKey, KeywordOverlayAspectOverride>>;
};

export function resolveKeywordOverlayForAspect(
  gen: PersonalGenKeywordOverlayFields | null | undefined,
  aspect: KeywordOverlayAspectKey | undefined,
): {
  fontPreset: KeywordOverlayFontId;
  fontScale: number;
  textBackground: boolean;
  textAnchor: KeywordOverlayTextAnchor;
} {
  const ar: KeywordOverlayAspectKey =
    aspect === '9:16' || aspect === '16:9' || aspect === '1:1' || aspect === '4:5' ? aspect : '9:16';
  const by = gen?.keywordOverlayByAspect?.[ar];
  const scaleRaw = by?.fontScale ?? gen?.keywordOverlayFontScale;
  const fontScale =
    typeof scaleRaw === 'number' && Number.isFinite(scaleRaw)
      ? Math.min(
          KEYWORD_OVERLAY_FONT_SCALE_MAX,
          Math.max(KEYWORD_OVERLAY_FONT_SCALE_MIN, scaleRaw),
        )
      : 1;
  const textBg = by?.textBackground ?? gen?.keywordOverlayTextBackground;
  const anchorRaw = by?.textAnchor ?? gen?.keywordOverlayTextAnchor;
  const textAnchor: KeywordOverlayTextAnchor = isKeywordOverlayTextAnchor(anchorRaw)
    ? anchorRaw
    : 'bottom_center';
  const rawPreset = by?.fontPreset ?? gen?.keywordOverlayFontPreset;
  return {
    fontPreset: normalizeKeywordOverlayFontPreset(rawPreset as string | undefined),
    fontScale,
    textBackground: textBg === true,
    textAnchor,
  };
}

/** Output height at 1080-wide canvas (matches personal stitch dims order). */
export function keywordOverlayHeightMulForAspect(aspect: KeywordOverlayAspectKey): number {
  const ref = 1920;
  const h =
    aspect === '9:16'
      ? 1920
      : aspect === '16:9'
        ? 1080
        : aspect === '1:1'
          ? 1080
          : 1350; // 4:5 @ 1080 wide
  return h / ref;
}
