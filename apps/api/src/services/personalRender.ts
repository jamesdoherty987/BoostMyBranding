/**
 * Personal content Remotion render wrapper.
 *
 * Chooses the right Remotion composition (viral-short or slideshow)
 * based on the account's format and theme template, passes the script +
 * media + audio tracks in, and uploads the resulting MP4 to R2.
 *
 * The pipeline calls into this single entry point; everything Remotion-
 * specific stays here.
 */

import { randomUUID } from 'node:crypto';
import { unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderVideo, DEFAULT_BRAND } from '@boost/video';
import type { VideoProps, PersonalBeat, SlideshowBeat } from '@boost/video';
import { uploadFile } from './r2.js';
import type { PersonalScript } from './personalScript.js';
import type { PersonalTheme } from './personalThemes.js';
import type { PersonalPostMediaAsset } from '@boost/database';

export type PersonalFormatKind = 'video' | 'slideshow' | 'static_image';

function compositionDims(
  ar: '9:16' | '1:1' | '16:9' | '4:5' | undefined,
): { width: number; height: number } {
  switch (ar) {
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    case '9:16':
    default:
      return { width: 1080, height: 1920 };
  }
}

export interface RenderPersonalVideoArgs {
  accountId: string;
  postId: string;
  theme: PersonalTheme;
  script: PersonalScript;
  mediaAssets: PersonalPostMediaAsset[];
  voiceoverUrl: string | null;
  musicUrl: string | null;
  accentColor: string | null;
  watermarkHandle?: string;
  logoUrl?: string;
  durationSeconds: number;
  /** Format override from the account config. Falls back to theme.defaultFormat. */
  formatKind?: PersonalFormatKind;
  /** Frame aspect for Remotion output; defaults to 9:16 portrait. */
  aspectRatio?: '9:16' | '1:1' | '16:9' | '4:5';
  /**
   * Background music gain for viral-short Remotion path (0.05–0.45).
   */
  musicBedVolume?: number;
  /** Slideshow / static path uses a slightly higher internal clamp — set separately when caller has both. */
  musicBedVolumeSlideshow?: number;
  /** When false, hide burned-in hook / beat / slide text overlays. Default true. */
  useSubtitles?: boolean;
}

export interface RenderPersonalVideoResult {
  videoUrl: string;
  durationSeconds: number;
  formatKind: PersonalFormatKind;
}

/** Maps theme.template to the ViralShort variant slot. */
function viralVariant(theme: PersonalTheme): string {
  switch (theme.template) {
    case 'fact-drop':
      return 'fact-drop';
    case 'news-reel':
      return 'news-reel';
    case 'quote-card':
      return 'quote-card';
    case 'language-card':
      return 'language-card';
    case 'listicle':
      return 'listicle';
    case 'brainrot':
      return 'brainrot';
    case 'story-narration':
      return 'story-narration';
    case 'viral-text':
    default:
      return 'viral-text';
  }
}

/** Maps theme.template to the Slideshow variant slot. */
function slideshowVariant(theme: PersonalTheme): 'slideshow' | 'satisfying-loop' | 'scripture-card' {
  if (theme.template === 'satisfying-loop') return 'satisfying-loop';
  if (theme.template === 'scripture-card') return 'scripture-card';
  return 'slideshow';
}

/**
 * Decide which Remotion composition to render.
 *   - formatKind === 'slideshow' always goes to slideshow template
 *   - formatKind === 'static_image' uses slideshow with a single slide
 *   - theme.template of slideshow/satisfying-loop/scripture-card → slideshow
 *   - everything else → viral-short
 */
function pickTemplate(theme: PersonalTheme, formatKind: PersonalFormatKind): 'viral-short' | 'slideshow' {
  if (formatKind === 'slideshow' || formatKind === 'static_image') return 'slideshow';
  if (
    theme.template === 'slideshow' ||
    theme.template === 'satisfying-loop' ||
    theme.template === 'scripture-card'
  ) {
    return 'slideshow';
  }
  return 'viral-short';
}

export async function renderPersonalVideo(
  args: RenderPersonalVideoArgs,
): Promise<RenderPersonalVideoResult> {
  const formatKind: PersonalFormatKind =
    args.formatKind ?? args.theme.defaultFormat ?? 'video';
  const templateId = pickTemplate(args.theme, formatKind);

  const brand = {
    ...DEFAULT_BRAND,
    accent: args.accentColor ?? DEFAULT_BRAND.accent,
    primary: args.accentColor ?? DEFAULT_BRAND.primary,
  };

  let props: VideoProps;

  const viralMusicVol =
    typeof args.musicBedVolume === 'number' && Number.isFinite(args.musicBedVolume)
      ? Math.min(0.45, Math.max(0.05, args.musicBedVolume))
      : 0.12;
  const slideMusicVol =
    typeof args.musicBedVolumeSlideshow === 'number' && Number.isFinite(args.musicBedVolumeSlideshow)
      ? Math.min(0.5, Math.max(0.08, args.musicBedVolumeSlideshow))
      : typeof args.musicBedVolume === 'number' && Number.isFinite(args.musicBedVolume)
        ? Math.min(0.5, Math.max(0.08, args.musicBedVolume))
        : 0.14;
  const showBurnedInText = args.useSubtitles !== false;

  if (templateId === 'slideshow') {
    // Slideshow consumes SlideshowBeat[]. Build from script beats + the
    // per-beat scraped asset. For static_image, drop to a single slide.
    const fullBeats: SlideshowBeat[] = args.script.beats.map((beat, i) => ({
      imageUrl: args.mediaAssets[i]?.url ?? args.mediaAssets[0]?.url,
      onScreen: beat.onScreen || beat.voiceover,
      eyebrow: beat.eyebrow,
      durationSeconds: beat.durationSeconds,
      attribution: args.mediaAssets[i]?.attribution,
    }));
    const slides = formatKind === 'static_image' ? fullBeats.slice(0, 1) : fullBeats;

    props = {
      businessName: args.watermarkHandle ?? '',
      headline: args.script.outro,
      subheadline: args.script.hook,
      cta: args.script.outro,
      domain: args.watermarkHandle ?? undefined,
      brand,
      imageUrl: args.mediaAssets[0]?.url,
      mediaClips: [],
      options: {
        variant: slideshowVariant(args.theme),
        slides,
        hook: args.script.hook,
        outro: formatKind === 'static_image' ? undefined : args.script.outro,
        voiceoverUrl: args.voiceoverUrl ?? undefined,
        musicUrl: args.musicUrl ?? undefined,
        musicBedVolume: slideMusicVol,
        watermarkHandle: args.watermarkHandle,
        accentColor: args.accentColor ?? undefined,
        themeColor: args.theme.accentColor,
        showProgress: args.theme.template === 'slideshow',
        showBurnedInText,
      } as unknown as VideoProps['options'],
    };
  } else {
    // Viral-short path.
    const beats: PersonalBeat[] = args.script.beats.map((beat, i) => {
      const asset = args.mediaAssets[i];
      return {
        voiceover: beat.voiceover,
        onScreen: beat.onScreen,
        eyebrow: beat.eyebrow,
        imageUrl: asset?.url,
        imageKind: asset?.kind,
        durationSeconds: beat.durationSeconds,
        attribution: asset?.attribution,
      };
    });
    const backgroundLoopUrl = args.mediaAssets.find((a) => a.source === 'gameplay')?.url;

    props = {
      businessName: args.watermarkHandle ?? '',
      headline: args.script.outro,
      subheadline: args.script.hook,
      cta: args.script.outro,
      domain: args.watermarkHandle ?? undefined,
      brand,
      imageUrl: args.mediaAssets[0]?.url,
      mediaClips: [],
      options: {
        variant: viralVariant(args.theme),
        personalBeats: beats,
        hook: args.script.hook,
        outro: args.script.outro,
        voiceoverUrl: args.voiceoverUrl ?? undefined,
        musicUrl: args.musicUrl ?? undefined,
        musicBedVolume: viralMusicVol,
        backgroundLoopUrl,
        watermarkHandle: args.watermarkHandle,
        accentColor: args.accentColor ?? undefined,
        themeColor: args.theme.accentColor,
        showBurnedInText,
      } as unknown as VideoProps['options'],
    };
  }

  const tmpPath = path.join(tmpdir(), `personal-${randomUUID()}.mp4`);
  const { width, height } = compositionDims(args.aspectRatio);
  try {
    const result = await renderVideo({
      templateId,
      props,
      outputPath: tmpPath,
      compositionWidth: width,
      compositionHeight: height,
    });
    const buffer = await readFile(tmpPath);
    const { url } = await uploadFile(
      `personal/${args.accountId}/videos`,
      buffer,
      `${args.postId}.mp4`,
      'video/mp4',
    );
    return {
      videoUrl: url,
      durationSeconds: result.durationFrames / 30,
      formatKind,
    };
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
