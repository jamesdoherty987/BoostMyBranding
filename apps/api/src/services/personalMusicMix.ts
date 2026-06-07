import type { PersonalGeneratorConfig } from '@boost/database';

/** Default on the 1–10 “background music” scale (subtle bed). */
export const DEFAULT_MUSIC_BACKGROUND_LEVEL = 2;

/**
 * Map UI level 1–10 → FFmpeg / Remotion gains. Level 1 is very quiet; 10 is still capped below “dominant”.
 */
export function musicGainsFromBackgroundLevel(level: number): number {
  const L = Math.min(10, Math.max(1, Math.round(level)));
  const t = (L - 1) / 9;
  return t;
}

/** Music under voice in FFmpeg stitch (0.02–0.22 when using 1–10 slider — quieter overall). */
export function resolveMusicDuckUnderVoice(cfg: PersonalGeneratorConfig): number {
  if (typeof cfg.musicBackgroundLevel === 'number' && Number.isFinite(cfg.musicBackgroundLevel)) {
    const t = musicGainsFromBackgroundLevel(cfg.musicBackgroundLevel);
    return Math.round((0.018 + t * 0.09) * 1000) / 1000;
  }
  if (typeof cfg.musicDuckUnderVoice === 'number' && Number.isFinite(cfg.musicDuckUnderVoice)) {
    return Math.min(0.55, Math.max(0.05, cfg.musicDuckUnderVoice));
  }
  const t = musicGainsFromBackgroundLevel(DEFAULT_MUSIC_BACKGROUND_LEVEL);
  return Math.round((0.018 + t * 0.09) * 1000) / 1000;
}

/** Music-only bed in FFmpeg stitch (quieter 1–10 curve). */
export function resolveMusicSoloVolume(cfg: PersonalGeneratorConfig): number {
  if (typeof cfg.musicBackgroundLevel === 'number' && Number.isFinite(cfg.musicBackgroundLevel)) {
    const t = musicGainsFromBackgroundLevel(cfg.musicBackgroundLevel);
    return Math.round((0.028 + t * 0.12) * 1000) / 1000;
  }
  if (typeof cfg.musicSoloVolume === 'number' && Number.isFinite(cfg.musicSoloVolume)) {
    return Math.min(0.85, Math.max(0.1, cfg.musicSoloVolume));
  }
  const t = musicGainsFromBackgroundLevel(DEFAULT_MUSIC_BACKGROUND_LEVEL);
  return Math.round((0.028 + t * 0.12) * 1000) / 1000;
}

/** Remotion viral-short template bed (after template clamp). */
export function resolveMusicBedViral(cfg: PersonalGeneratorConfig): number {
  if (typeof cfg.musicBackgroundLevel === 'number' && Number.isFinite(cfg.musicBackgroundLevel)) {
    const t = musicGainsFromBackgroundLevel(cfg.musicBackgroundLevel);
    const raw = 0.022 + t * 0.055;
    return Math.min(0.32, Math.max(0.018, Math.round(raw * 1000) / 1000));
  }
  if (typeof cfg.musicBedVolume === 'number' && Number.isFinite(cfg.musicBedVolume)) {
    return Math.min(0.45, Math.max(0.05, cfg.musicBedVolume));
  }
  const t = musicGainsFromBackgroundLevel(DEFAULT_MUSIC_BACKGROUND_LEVEL);
  return Math.min(0.32, Math.max(0.018, Math.round((0.022 + t * 0.055) * 1000) / 1000));
}

/** Remotion slideshow template bed. */
export function resolveMusicBedSlideshow(cfg: PersonalGeneratorConfig): number {
  if (typeof cfg.musicBackgroundLevel === 'number' && Number.isFinite(cfg.musicBackgroundLevel)) {
    const t = musicGainsFromBackgroundLevel(cfg.musicBackgroundLevel);
    const raw = 0.04 + t * 0.065;
    return Math.min(0.36, Math.max(0.03, Math.round(raw * 1000) / 1000));
  }
  if (typeof cfg.musicBedVolume === 'number' && Number.isFinite(cfg.musicBedVolume)) {
    return Math.min(0.5, Math.max(0.08, cfg.musicBedVolume));
  }
  const t = musicGainsFromBackgroundLevel(DEFAULT_MUSIC_BACKGROUND_LEVEL);
  return Math.min(0.36, Math.max(0.03, Math.round((0.04 + t * 0.065) * 1000) / 1000));
}
