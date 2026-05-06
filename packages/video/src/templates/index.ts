import type { FC } from 'react';
import type { VideoProps, TemplatePreset } from '../types';

import { LiquidBlob, LiquidBlobMeta, LIQUID_BLOB_PRESETS } from './LiquidBlob';
import { ProductShowcase, ProductShowcaseMeta, PRODUCT_SHOWCASE_PRESETS } from './ProductShowcase';
import { Aurora, AuroraMeta, AURORA_PRESETS } from './Aurora';
import { GlitchArt, GlitchArtMeta, GLITCH_ART_PRESETS } from './GlitchArt';
import { HoloFoil, HoloFoilMeta, HOLO_FOIL_PRESETS } from './HoloFoil';
import {
  MediaStory,
  MediaStoryMeta,
  MEDIA_STORY_PRESETS,
  computeMediaStoryDuration,
} from './MediaStory';
import {
  ViralShort,
  ViralShortMeta,
  VIRAL_SHORT_PRESETS,
  computeViralShortDuration,
} from './ViralShort';
import {
  Slideshow,
  SlideshowMeta,
  SLIDESHOW_PRESETS,
  computeSlideshowDuration,
} from './Slideshow';

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  durationFrames: number;
  usesImage: boolean;
  bestFor: readonly string[];
  /**
   * Optional presets the dashboard picker can offer. Each preset is a
   * bundle of palette + options that produces a visibly different look
   * from the same template. Omit for templates that don't support
   * presets yet — they render with their defaults.
   */
  availablePresets?: readonly TemplatePreset[];
}

export interface TemplateDef {
  meta: TemplateMeta;
  Component: FC<VideoProps>;
  /**
   * Optional dynamic-duration callback. Templates that sequence a
   * user-controlled number of clips (MediaStory) override the default
   * composition length based on runtime props. Templates without this
   * field always render for `meta.durationFrames`.
   */
  computeDuration?: (props: VideoProps) => number;
}

export const TEMPLATES: Record<string, TemplateDef> = {
  'liquid-blob': {
    meta: { ...LiquidBlobMeta, availablePresets: LIQUID_BLOB_PRESETS },
    Component: LiquidBlob,
  },
  'product-showcase': {
    meta: { ...ProductShowcaseMeta, availablePresets: PRODUCT_SHOWCASE_PRESETS },
    Component: ProductShowcase,
  },
  'aurora': {
    meta: { ...AuroraMeta, availablePresets: AURORA_PRESETS },
    Component: Aurora,
  },
  'glitch-art': {
    meta: { ...GlitchArtMeta, availablePresets: GLITCH_ART_PRESETS },
    Component: GlitchArt,
  },
  'holo-foil': {
    meta: { ...HoloFoilMeta, availablePresets: HOLO_FOIL_PRESETS },
    Component: HoloFoil,
  },
  'media-story': {
    meta: { ...MediaStoryMeta, availablePresets: MEDIA_STORY_PRESETS },
    Component: MediaStory,
    computeDuration: computeMediaStoryDuration,
  },
  'viral-short': {
    meta: { ...ViralShortMeta, availablePresets: VIRAL_SHORT_PRESETS },
    Component: ViralShort,
    computeDuration: computeViralShortDuration,
  },
  'slideshow': {
    meta: { ...SlideshowMeta, availablePresets: SLIDESHOW_PRESETS },
    Component: Slideshow,
    computeDuration: computeSlideshowDuration,
  },
};

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES[id];
}

export function listTemplates(): TemplateMeta[] {
  return Object.values(TEMPLATES).map((t) => t.meta);
}

/**
 * Look up a specific preset on a template. Returns null if the template
 * has no preset roster or the id isn't found — callers should fall back
 * to the template's default rendering in that case.
 */
export function getTemplatePreset(
  templateId: string,
  presetId: string | undefined,
): TemplatePreset | null {
  if (!presetId) return null;
  const template = TEMPLATES[templateId];
  const preset = template?.meta.availablePresets?.find((p) => p.id === presetId);
  return preset ?? null;
}

export { LiquidBlob, ProductShowcase, Aurora, GlitchArt, HoloFoil, MediaStory, ViralShort, Slideshow };
