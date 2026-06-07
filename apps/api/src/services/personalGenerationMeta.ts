import type { PersonalGeneratorConfig } from '@boost/database';
import { pickDefaultModel } from './personalAiModels.js';

/** Persisted on `personal_posts.script.generationInfo` for dashboard “Video details”. */
export interface PersonalGenerationInfo {
  pipeline: 'director' | 'legacy';
  completedAt: string;
  imageModelId?: string | null;
  videoModelId?: string | null;
  scriptModel?: string | null;
  stitchEncodePreset?: string | null;
  ttsProvider?: string | null;
  ttsVoiceId?: string | null;
  /** TTS playback speed when voiceover ran (if applicable). */
  ttsSpeed?: number | null;
  musicAttribution?: string | null;
  /** Where the bed came from when music was on. */
  musicSource?: 'custom_bed' | 'library' | null;
  /** Dashboard 1–10 background-music slider (optional). */
  musicBackgroundLevel?: number | null;
  /** Theme template id (e.g. fact-drop, director:…). */
  themeTemplate?: string | null;
  qualityTier?: string | null;
  longformEnabled?: boolean | null;
  /** Total charged generation cost for this post when the row was finalized. */
  costCents?: number | null;
}

export function buildDirectorGenerationInfo(args: {
  genConfig: PersonalGeneratorConfig;
  account: { voiceId?: string | null; customAudioUrl?: string | null };
  character: { voiceId?: string | null } | null;
  longformEnabled: boolean;
  longformAnimationStyle:
    | 'storybook'
    | 'cartoon'
    | 'stick_figure'
    | 'claymation'
    | 'pixel_art'
    | 'watercolour'
    | 'custom'
    | undefined;
  musicAttribution: string | null;
  /** Resolved bed source for this render. */
  musicSource: 'custom_bed' | 'library' | 'none';
  themeTemplate: string;
  totalCostCents: number;
  pickImageModelForLongform: (
    style:
      | 'storybook'
      | 'cartoon'
      | 'stick_figure'
      | 'claymation'
      | 'pixel_art'
      | 'watercolour'
      | 'custom'
      | undefined,
    tier: 'max' | 'balanced' | 'budget',
  ) => string | undefined;
}): PersonalGenerationInfo {
  const { genConfig, account, character, longformEnabled, longformAnimationStyle } = args;
  const tier = genConfig.qualityTier ?? 'balanced';
  const imageModelId =
    genConfig.imageModelId ??
    args.pickImageModelForLongform(longformEnabled ? longformAnimationStyle : undefined, tier) ??
    pickDefaultModel('image', tier)?.id ??
    null;
  const videoModelId = genConfig.videoModelId ?? pickDefaultModel('video', tier)?.id ?? null;
  const ttsVoiceId = genConfig.ttsVoiceId ?? character?.voiceId ?? account.voiceId ?? null;
  const ms =
    args.musicSource === 'none'
      ? null
      : args.musicSource === 'custom_bed'
        ? ('custom_bed' as const)
        : ('library' as const);
  return {
    pipeline: 'director',
    completedAt: new Date().toISOString(),
    imageModelId,
    videoModelId,
    scriptModel: genConfig.scriptModel ?? null,
    stitchEncodePreset: genConfig.stitchEncodePreset ?? 'balanced',
    ttsProvider: genConfig.ttsProvider ?? null,
    ttsVoiceId,
    ttsSpeed: genConfig.ttsSpeed ?? null,
    musicAttribution: args.musicAttribution,
    musicSource: ms,
    musicBackgroundLevel: genConfig.musicBackgroundLevel ?? null,
    themeTemplate: args.themeTemplate,
    qualityTier: tier,
    longformEnabled,
    costCents: args.totalCostCents,
  };
}

export function buildLegacyGenerationInfo(args: {
  genConfig: PersonalGeneratorConfig;
  account: { voiceId?: string | null; customAudioUrl?: string | null };
  character: { voiceId?: string | null } | null;
  musicAttribution: string | null;
  musicSource: 'custom_bed' | 'library' | 'none';
  themeTemplate: string;
  totalCostCents: number;
}): PersonalGenerationInfo {
  const tier = args.genConfig.qualityTier ?? 'balanced';
  const imageModelId =
    args.genConfig.imageModelId ?? pickDefaultModel('image', tier)?.id ?? null;
  const videoModelId = args.genConfig.videoModelId ?? pickDefaultModel('video', tier)?.id ?? null;
  const ms =
    args.musicSource === 'none'
      ? null
      : args.musicSource === 'custom_bed'
        ? ('custom_bed' as const)
        : ('library' as const);
  return {
    pipeline: 'legacy',
    completedAt: new Date().toISOString(),
    imageModelId,
    videoModelId,
    scriptModel: args.genConfig.scriptModel ?? null,
    stitchEncodePreset: args.genConfig.stitchEncodePreset ?? 'balanced',
    ttsProvider: args.genConfig.ttsProvider ?? null,
    ttsVoiceId: args.genConfig.ttsVoiceId ?? args.character?.voiceId ?? args.account.voiceId ?? null,
    ttsSpeed: args.genConfig.ttsSpeed ?? null,
    musicAttribution: args.musicAttribution,
    musicSource: ms,
    musicBackgroundLevel: args.genConfig.musicBackgroundLevel ?? null,
    themeTemplate: args.themeTemplate,
    qualityTier: tier,
    longformEnabled: null,
    costCents: args.totalCostCents,
  };
}
