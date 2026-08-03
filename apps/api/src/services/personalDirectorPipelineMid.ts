/**
 * Director pipeline continuation: measured VO → shot repartition (avg clip) →
 * shot resolution → music → stitch. Extracted so {@link generateForAccountDirector}
 * and boot-time resume can share it.
 */

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { resolveKeywordOverlayForAspect } from '@boost/api-client';
import {
  getDb,
  personalAccounts,
  personalPosts,
  type PersonalAccountStyleBible,
  type PersonalGeneratorConfig,
} from '@boost/database';
import type { PersonalTheme } from './personalThemes.js';
import {
  shotToPrompt,
  flattenStoryboard,
  rebalanceStoryboardToTargetShots,
  animationStyleHintFor,
  stripDirectorResumeKeys,
  PERSONAL_SCRIPT_CK_PRE,
  PERSONAL_SCRIPT_CK_SRC,
  filterKeywordCardsByVoiceover,
  aiOnImageFactLabelsOnly,
  resyncImageCaptionsAfterVoiceEdits,
  compositionUniquenessHintForShot,
  type Storyboard,
} from './personalDirector.js';
import { searchAssets, pickGameplayLoop } from './personalScraper.js';
import {
  synthesizeVoice,
  estimateDurationSeconds,
  joinNarrationParts,
  joinNarrationPartsWithShotCharSpans,
  joinNarrationPartsWithVisualShotRanges,
  keywordStitchCardsFromVoiceAlignment,
  shotDurationsFromVoicePartition,
  shotDurationsFromVoiceAlignment,
  applyVisualMentionLagToDurations,
  stripLeadingHookFromFirstVoiceover,
  minShotsForVoiceAndAvgClip,
  type VoiceCharacterAlignment,
} from './personalVoice.js';
import { resolveChainedMusicBed } from './personalMusicChain.js';
import { broadcast } from './realtime.js';
import { env, features } from '../env.js';
import {
  buildPersonalScheduleIntent,
  contentStudioAccountIdsOverride,
  mergePersonalScheduleIntentIntoArgs,
  schedulePersonalPostWithRetry,
  shouldSchedulePersonalToContentStudio,
  withPersonalScheduleIntent,
} from './personalContentPosting.js';
import { withRetry, withTimeout } from './retry.js';
import { getCharacterAnchorImages, getCharacterUnsafe } from './personalCharacters.js';
import { internalListForPipeline } from './personalAccountMedia.js';
import {
  personalPostIsFailed,
  withAbortWhenPersonalPostFailed,
  PERSONAL_POST_CANCELLED_MESSAGE,
  appendPersonalGenerationLog,
} from './personalAccounts.js';
import { buildVisualBrandHintsForShots } from './personalContentHints.js';
import {
  generateAiImage,
  generateAiVideo,
  getAiModel,
  isFalFatalAccountError,
  pickDefaultModel,
  pickImageModelForLongform,
} from './personalAiModels.js';
import { buildDirectorGenerationInfo } from './personalGenerationMeta.js';
import { resolveMusicDuckUnderVoice, resolveMusicSoloVolume } from './personalMusicMix.js';
import {
  stitchShots,
  normalizeKeywordCardsForShot,
  dedupeKeywordCardsAcrossShots,
  perShotSecondsMaxFromAverageClip,
  defaultNamesNumbersTitleCardDurationSeconds,
  type StitchShotInput,
} from './personalStitcher.js';
import { logVisualPacing } from './personalDebugVisualPacing.js';
import { buildPersonalThumbnailShotAlign, createPersonalPostThumbnail, shortThumbnailOverlayLine } from './personalAiThumbnail.js';
import { resolvePersonalInspirationImageUrls } from './personalInspirationRefs.js';
import type { GenerateForAccountArgs, GenerateForAccountResult } from './personalPipeline.js';
import {
  maybeEmailPersonalPostFailed,
  maybeEmailPersonalVideoReady,
} from './personalVideoDeliveryEmail.js';

const SOURCING_DEBUG_CONSOLE = process.env.PERSONAL_DEBUG_SOURCING === '1';

function logSourcingConsole(postId: string, msg: string) {
  if (SOURCING_DEBUG_CONSOLE) {
    console.warn(`[personal:sourcing ${postId.slice(0, 8)}…]`, msg);
  }
}

const CK_PRE = PERSONAL_SCRIPT_CK_PRE;
const CK_SRC = PERSONAL_SCRIPT_CK_SRC;

function mapGrade(
  grade: string | undefined,
): 'natural' | 'warm' | 'cool' | 'teal_orange' | 'film' | 'bw' | 'high_contrast' {
  if (!grade) return 'natural';
  const g = grade.toLowerCase();
  if (/warm|golden|sun/.test(g)) return 'warm';
  if (/cool|blue|cold/.test(g)) return 'cool';
  if (/teal|orange|cinematic/.test(g)) return 'teal_orange';
  if (/film|grain|vintage/.test(g)) return 'film';
  if (/black.?(and|&).?white|mono/.test(g)) return 'bw';
  if (/contrast|punchy/.test(g)) return 'high_contrast';
  return 'natural';
}

/** Account generator config wins over storyboard for final look (operator intent). */
function stitchFinalLook(
  genConfig: PersonalGeneratorConfig,
  storyboard: Storyboard,
): {
  colourGrade: ReturnType<typeof mapGrade>;
  useGrain: boolean;
  letterbox: boolean;
} {
  const colourGrade =
    genConfig.colourGrade ?? mapGrade(storyboard.editPlan.colourGrade);
  const useGrain =
    typeof genConfig.filmGrain === 'boolean'
      ? genConfig.filmGrain
      : Boolean(storyboard.editPlan.useGrain);
  const letterbox =
    typeof genConfig.letterbox === 'boolean'
      ? genConfig.letterbox
      : Boolean(storyboard.editPlan.letterbox);
  return { colourGrade, useGrain, letterbox };
}

/** Stable index so parallel shots don't all pick the same first search hit. */
function pickSearchResultIndex(shotId: string, len: number): number {
  if (len <= 0) return 0;
  if (len <= 1) return 0;
  let h = 0;
  for (let i = 0; i < shotId.length; i++) {
    h = (h * 31 + shotId.charCodeAt(i)) >>> 0;
  }
  return h % len;
}

function composeCaption(sb: Storyboard): string {
  const tags = (sb.hashtags ?? [])
    .slice(0, 8)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .join(' ');
  return [sb.caption?.trim(), tags].filter(Boolean).join('\n\n');
}

function isYoutubeAccount(platform: string | null | undefined): boolean {
  const k = String(platform ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return k === 'youtube' || k === 'yt';
}

function videoAspectFrom(a: '9:16' | '1:1' | '16:9' | '4:5'): '9:16' | '1:1' | '16:9' {
  return a === '4:5' ? '9:16' : a;
}

export type AccountMediaRow = Awaited<ReturnType<typeof internalListForPipeline>>[number];
type CharacterRow = Awaited<ReturnType<typeof getCharacterUnsafe>>;

export interface DirectorMidPipelineCtx {
  account: typeof personalAccounts.$inferSelect;
  theme: PersonalTheme;
  genConfig: PersonalGeneratorConfig;
  styleBible: PersonalAccountStyleBible;
  character: CharacterRow;
  postId: string;
  topic: string;
  storyboard: Storyboard;
  aspectRatio: '9:16' | '1:1' | '16:9' | '4:5';
  longformEnabled: boolean;
  longformTargetSeconds: number | undefined;
  longformAnimationStyle:
    | 'storybook'
    | 'cartoon'
    | 'stick_figure'
    | 'claymation'
    | 'pixel_art'
    | 'watercolour'
    | 'custom'
    | undefined;
  accountMedia: AccountMediaRow[];
  /** DB cost field before this segment (usually 0 until final persist). */
  initialCostCents: number;
  args: GenerateForAccountArgs;
  /** Shots already resolved before this run (resume). */
  resumedShotById?: Record<string, { url: string; kind: 'image' | 'video'; costCents: number }>;
  markFailed: (postId: string, message: string) => Promise<void>;
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
}

export async function directorPipelineFromResolvedStoryboard(
  ctx: DirectorMidPipelineCtx,
): Promise<GenerateForAccountResult> {
  const {
    account,
    theme,
    genConfig,
    styleBible,
    character,
    postId,
    topic,
    aspectRatio,
    longformEnabled,
    longformTargetSeconds,
    longformAnimationStyle,
    accountMedia,
    initialCostCents,
    args,
    resumedShotById,
    markFailed,
    pickImageModelForLongform,
  } = ctx;

  let storyboard = ctx.storyboard;
  let totalCostCents = initialCostCents;
  /** Pre-sourcing TTS (fresh runs) — see early block after references. */
  let voiceoverUrl: string | null = null;
  let measuredVoiceSeconds: number | null = null;
  /** ElevenLabs-only: character timings for the exact narration MP3 used for this render. */
  let voiceCharacterAlignment: VoiceCharacterAlignment | undefined;

  const db = getDb();

  const inspirationItems = accountMedia.filter(
    (m) => m.role === 'inspiration' || m.role === 'style_reference',
  );
  const inspirationStyleHint = inspirationItems.length
    ? inspirationItems
        .slice(0, 4)
        .map((m) => m.description ?? m.aiDescription ?? '')
        .filter((s) => s && s.length > 0)
        .join('; ')
        .slice(0, 400)
    : undefined;

  broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'sourcing_media' } });
  void appendPersonalGenerationLog(postId, 'Resolving character anchors & style-reference stills…').catch(() => {});

  const characterAnchors = character
    ? await withAbortWhenPersonalPostFailed(postId, getCharacterAnchorImages(character.id, 3))
    : [];

  const resolvedStyleRefImageUrls = await withAbortWhenPersonalPostFailed(
    postId,
    resolvePersonalInspirationImageUrls(account.id, inspirationItems),
  );
  void appendPersonalGenerationLog(
    postId,
    `References ready: ${resolvedStyleRefImageUrls.length} still URL(s), ${characterAnchors.length} character anchor(s).`,
  ).catch(() => {});
  const topicLine = topic.replace(/\s+/g, ' ').trim().slice(0, 160);
  const inspirationPixelContract =
    resolvedStyleRefImageUrls.length > 0
      ? `Match palette, lighting, lens/codec character, grain, and motion energy of the account reference stills (including frames extracted from reference videos). EPISODE SUBJECT (hard lock): «${topicLine.replace(/"/g, "'")}» — refs are **look only**, not a second storyline (no food/hunting/travel detours unless the VO says so).`
      : '';
  const inspirationStyleHintForShots = [inspirationStyleHint, inspirationPixelContract]
    .filter((s) => s && s.length > 0)
    .join(' ')
    .slice(0, 560);

  /**
   * Intended flow (fresh runs only — resume keeps checkpoint shot ids):
   * 1) Storyboard / script already exists from the director planner.
   * 2) Synthesize full narration once and **measure** real audio length.
   * 3) Derive target shot count from measured VO ÷ dashboard avg clip (+ mux floor).
   * 4) **Rebalance** shot list (split/merge VO lines only) — same per-shot image/ video pipeline.
   * 5) Media sourcing runs on the rebalanced shots.
   */
  const canRepartition = !resumedShotById || Object.keys(resumedShotById).length === 0;
  const useVoiceoverEarly = genConfig.useVoiceover ?? theme.useVoiceover;
  if (useVoiceoverEarly && canRepartition) {
    const flatPreVo = flattenStoryboard(storyboard);
    const rawShotVosEarly = flatPreVo.map((x) => x.shot.voiceover ?? '');
    const shotVosForNarrationEarly =
      rawShotVosEarly.length === 0
        ? rawShotVosEarly
        : [
            stripLeadingHookFromFirstVoiceover(storyboard.hook ?? '', rawShotVosEarly[0] ?? ''),
            ...rawShotVosEarly.slice(1),
          ];
    const narrationEarly = joinNarrationParts([
      storyboard.hook,
      ...shotVosForNarrationEarly,
      storyboard.outro,
    ]);
    if (narrationEarly.trim().length > 0) {
      broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'voicing' } });
      void appendPersonalGenerationLog(
        postId,
        'Measuring narration (TTS) before media sourcing so shot count matches real audio length and avg clip setting…',
      ).catch(() => {});
      const voiceEarly = await withAbortWhenPersonalPostFailed(
        postId,
        synthesizeVoice({
          text: narrationEarly,
          voiceId:
            genConfig.ttsVoiceId ?? character?.voiceId ?? account.voiceId ?? 'default',
          voiceAccent: genConfig.voiceAccent,
          voiceGender: genConfig.voiceGender,
          language: account.language,
          accountId: account.id,
          speed: Math.min(1.2, Math.max(0.7, genConfig.ttsSpeed ?? 1)),
          providerPreference: genConfig.ttsProvider,
        }),
      );
      voiceoverUrl = voiceEarly.audioUrl;
      measuredVoiceSeconds = voiceEarly.durationSeconds;
      voiceCharacterAlignment = voiceEarly.voiceCharacterAlignment;
      totalCostCents += voiceEarly.costCents;

      /** Avoid divide-by-zero / insane shot counts if the provider returns a bogus ~0s duration. */
      const planVoSec = Math.max(0.35, voiceEarly.durationSeconds);

      const avgClipSec =
        genConfig.averageClipSeconds != null &&
        Number.isFinite(genConfig.averageClipSeconds) &&
        genConfig.averageClipSeconds >= 1
          ? Math.min(12, Math.max(1, genConfig.averageClipSeconds))
          : 4;
      const perShotMax =
        perShotSecondsMaxFromAverageClip(genConfig.averageClipSeconds, { longform: longformEnabled }) ??
        (longformEnabled ? 10 : 8);
      const perShotCeil = perShotMax + 0.12;
      const nMinMux = minShotsForVoiceAndAvgClip(planVoSec, perShotCeil);
      /** Tighter effective ceiling → more stills so cuts can stay snappy when VO is long. */
      const nMinSnappy = minShotsForVoiceAndAvgClip(planVoSec, perShotCeil * 0.88);
      const nFromAvg = Math.ceil(planVoSec / Math.max(0.9, avgClipSec * 0.9));
      const maxCap = longformEnabled ? 96 : 32;
      const nTarget = Math.min(maxCap, Math.max(3, flatPreVo.length, nFromAvg, nMinMux, nMinSnappy));
      const beforeN = flatPreVo.length;
      if (nTarget !== beforeN) {
        storyboard = rebalanceStoryboardToTargetShots(storyboard, nTarget);
        const afterN = flattenStoryboard(storyboard).length;
        void appendPersonalGenerationLog(
          postId,
          `Shot plan from measured VO (~${planVoSec.toFixed(1)}s) ÷ avg clip (~${avgClipSec.toFixed(1)}s): ${beforeN} → ${afterN} shot(s) (target ${nTarget}; same image/video pipeline per shot).`,
        ).catch(() => {});
        if (afterN !== nTarget) {
          void appendPersonalGenerationLog(
            postId,
            `Note: repartition stopped at ${afterN} shot(s) (requested ${nTarget}) — remaining segments are too short to split further without breaking sentences.`,
          ).catch(() => {});
        }
      } else {
        void appendPersonalGenerationLog(
          postId,
          `Shot count ${beforeN} already matches VO length and avg clip (~${avgClipSec.toFixed(1)}s); no repartition.`,
        ).catch(() => {});
      }

      const flatRe = flattenStoryboard(storyboard);
      const rawRe = flatRe.map((x) => x.shot.voiceover ?? '');
      const shotVosReconciled =
        rawRe.length === 0
          ? rawRe
          : [
              stripLeadingHookFromFirstVoiceover(storyboard.hook ?? '', rawRe[0] ?? ''),
              ...rawRe.slice(1),
            ];
      const narrationReconciled = joinNarrationParts([
        storyboard.hook,
        ...shotVosReconciled,
        storyboard.outro,
      ]);
      const normNarration = (s: string) => s.replace(/\s+/g, ' ').trim();
      if (
        narrationReconciled.trim().length > 0 &&
        normNarration(narrationReconciled) !== normNarration(narrationEarly)
      ) {
        void appendPersonalGenerationLog(
          postId,
          'Repartition shifted hook/VO overlap; re-synthesizing TTS once so the MP3 matches the new shot script.',
        ).catch(() => {});
        const voiceFix = await withAbortWhenPersonalPostFailed(
          postId,
          synthesizeVoice({
            text: narrationReconciled,
            voiceId:
              genConfig.ttsVoiceId ?? character?.voiceId ?? account.voiceId ?? 'default',
            voiceAccent: genConfig.voiceAccent,
            voiceGender: genConfig.voiceGender,
            language: account.language,
            accountId: account.id,
            speed: Math.min(1.2, Math.max(0.7, genConfig.ttsSpeed ?? 1)),
            providerPreference: genConfig.ttsProvider,
          }),
        );
        voiceoverUrl = voiceFix.audioUrl;
        measuredVoiceSeconds = voiceFix.durationSeconds;
        voiceCharacterAlignment = voiceFix.voiceCharacterAlignment;
        totalCostCents += voiceFix.costCents;
      }
    }
  }

  const defaultImageModel =
    genConfig.imageModelId ??
    pickImageModelForLongform(
      longformEnabled ? longformAnimationStyle : undefined,
      genConfig.qualityTier ?? 'balanced',
    );
  const defaultVideoModel =
    genConfig.videoModelId ?? pickDefaultModel('video', genConfig.qualityTier ?? 'balanced')?.id;

  const flat = flattenStoryboard(storyboard);
  if (aiOnImageFactLabelsOnly(genConfig)) {
    resyncImageCaptionsAfterVoiceEdits(flat.map((f) => f.shot));
  }
  const stitchMusicDuck = resolveMusicDuckUnderVoice(genConfig);
  const stitchMusicSolo = resolveMusicSoloVolume(genConfig);
  const shotAssets: Array<{
    fs: ReturnType<typeof flattenStoryboard>[number];
    asset: { url: string; kind: 'image' | 'video' } | null;
    costCents: number;
    error?: string;
    fromCache?: boolean;
  }> = [];

  const animationStyleHint = longformEnabled
    ? animationStyleHintFor(longformAnimationStyle ?? 'custom')
    : undefined;

  const shotBrandHints = buildVisualBrandHintsForShots(styleBible);

  const concurrency = 2;
  /** Prevent a stuck fal/Gemini HTTP call from freezing `sourcing_media` indefinitely. */
  const aiImageTimeoutMs = env.PERSONAL_AI_IMAGE_TIMEOUT_MS ?? 240_000;
  const aiVideoTimeoutMs = env.PERSONAL_AI_VIDEO_TIMEOUT_MS ?? 600_000;
  logSourcingConsole(
    postId,
    `shots=${flat.length} workers=${concurrency} videoModel=${defaultVideoModel ?? '—'} imageModel=${defaultImageModel ?? '—'} fal=${features.fal}`,
  );
  void appendPersonalGenerationLog(
    postId,
    `Media sourcing: ${flat.length} shot(s), ${concurrency} parallel workers. Video model: ${defaultVideoModel ?? '—'}, image: ${defaultImageModel ?? '—'}, FAL: ${features.fal ? 'on' : 'off'}; shot timeouts image=${Math.round(aiImageTimeoutMs / 1000)}s video=${Math.round(aiVideoTimeoutMs / 1000)}s.`,
  ).catch(() => {});

  const sourcingByShotId: Record<string, { url: string; kind: 'image' | 'video'; costCents: number }> = {
    ...(resumedShotById ?? {}),
  };

  for (const v of Object.values(sourcingByShotId)) {
    totalCostCents += v.costCents;
  }

  let flushChain = Promise.resolve();
  const flushSourcingCheckpointThrottled = () => {
    flushChain = flushChain.then(async () => {
      const tFlush = Date.now();
      const shotCount = Object.keys(sourcingByShotId).length;
      if (SOURCING_DEBUG_CONSOLE) {
        logSourcingConsole(postId, `checkpoint DB write start (${shotCount} shot(s) in map)`);
      }
      const scriptBase = stripDirectorResumeKeys(storyboard as unknown as Record<string, unknown>);
      const scheduleIntent = buildPersonalScheduleIntent(args, account);
      try {
        await db
          .update(personalPosts)
          .set({
            script: withPersonalScheduleIntent(
              {
                ...scriptBase,
                outputAspectRatio: aspectRatio,
                [CK_SRC]: { v: 1, byShotId: sourcingByShotId },
              },
              scheduleIntent,
            ) as any,
            updatedAt: new Date(),
          })
          .where(eq(personalPosts.id, postId));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[director] sourcing checkpoint DB update failed for ${postId}:`, msg);
        void appendPersonalGenerationLog(
          postId,
          `Checkpoint DB error (${shotCount} shot(s)): ${msg.slice(0, 400)}`,
        ).catch(() => {});
        throw e;
      }
      const flushMs = Date.now() - tFlush;
      void appendPersonalGenerationLog(
        postId,
        `Checkpoint: ${shotCount} shot asset(s) persisted (${flushMs}ms).`,
      ).catch(() => {});
      if (SOURCING_DEBUG_CONSOLE) {
        logSourcingConsole(postId, `checkpoint DB write done ${flushMs}ms`);
      } else if (flushMs > 12_000) {
        console.warn(
          `[personal:sourcing] slow checkpoint ${flushMs}ms post=${postId.slice(0, 8)}… shots=${shotCount}`,
        );
      }
    });
    return flushChain;
  };

  const generateShotAsset = async (
    fs: (typeof flat)[number],
    timelineIndex: number,
  ): Promise<{
    fs: (typeof flat)[number];
    asset: { url: string; kind: 'image' | 'video' } | null;
    costCents: number;
    error?: string;
    fromCache?: boolean;
  }> => {
    if (await personalPostIsFailed(postId)) {
      return { fs, asset: null, costCents: 0, error: 'stopped', fromCache: false };
    }
    const cached = sourcingByShotId[fs.shot.id];
    if (cached) {
      void appendPersonalGenerationLog(
        postId,
        `Shot ${fs.shot.id}: reused cached ${cached.kind} (resume or duplicate).`,
      ).catch(() => {});
      return {
        fs,
        asset: { url: cached.url, kind: cached.kind },
        costCents: 0,
        fromCache: true,
      };
    }

    const refs = longformEnabled
      ? [...characterAnchors.slice(0, 3), ...resolvedStyleRefImageUrls.slice(0, 3)].slice(0, 6)
      : [...characterAnchors.slice(0, 2), ...resolvedStyleRefImageUrls.slice(0, 4)];

    const factLabelImagePromptExtra =
      genConfig.allowSparseImageText === true
        ? [
            'The on-image words are narration-locked in the prompt — never replace them with scene-description titles or "what the photo shows".',
            'If the locked string contains numbers, render them crisply with correct % or currency symbols — no invented digits or alternate phrasing.',
            styleBible.typography?.trim() &&
              `Account style-bible typography for any on-image label: ${styleBible.typography.trim()}.`,
            resolvedStyleRefImageUrls.length > 0 &&
              'If the inspiration reference stills include on-image words or numbers, match that lettering personality (weight, colour, case, placement); otherwise follow the style-bible typography line above.',
          ]
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
            .join(' ')
        : undefined;

    const storyStructureHint = [
      fs.actName?.trim() && `Act «${fs.actName.replace(/\s+/g, ' ').trim().slice(0, 100)}»`,
      fs.beatTitle?.trim() &&
        `Beat «${fs.beatTitle.replace(/\s+/g, ' ').trim().slice(0, 140)}» (${fs.beatPhase})`,
    ]
      .filter(Boolean)
      .join('; ');

    const prevFs = timelineIndex > 0 ? flat[timelineIndex - 1] : undefined;
    const previousShotOneLiner = prevFs
      ? [
          prevFs.shot.description?.replace(/\s+/g, ' ').trim().slice(0, 130),
          prevFs.shot.imageCaption?.trim()
            ? `on-image: "${prevFs.shot.imageCaption.trim().replace(/"/g, "'")}"`
            : undefined,
        ]
          .filter(Boolean)
          .join(' — ')
      : undefined;

    const basePrompt = shotToPrompt({
      shot: fs.shot,
      themeVisualStyle: theme.visualStyle,
      styleBibleVibe: styleBible.vibe ?? undefined,
      characterFragment: character?.promptFragment ?? undefined,
      globalColourGrade: storyboard.editPlan.colourGrade,
      inspirationStyleHint: inspirationStyleHintForShots || undefined,
      animationStyleHint,
      shotBrandHints,
      factLabelImagePromptExtra,
      timelineShotIndex: timelineIndex + 1,
      timelineShotTotal: flat.length,
      storyStructureHint: storyStructureHint || undefined,
      seriesTopic: topic,
      episodeTitle: storyboard.title,
      plannerHoldSeconds:
        Number.isFinite(fs.shot.durationSeconds) && fs.shot.durationSeconds > 0
          ? fs.shot.durationSeconds
          : undefined,
      previousShotOneLiner: previousShotOneLiner || undefined,
      compositionUniquenessHint: compositionUniquenessHintForShot(fs.shot.id, timelineIndex),
    });
    const refNoCopy =
      (fs.shot.kind === 'ai_image' || fs.shot.kind === 'ai_video') &&
      (refs.length > 0 || Boolean(character?.promptFragment?.trim()))
        ? ' REFERENCE CONTRACT: use reference images / character sheet only for identity, wardrobe, palette, and lens character — invent a **new** composition, pose, and framing that **advances this shot\'s narration** (new prop, angle, location detail, or story beat); never recreate or near-duplicate a reference frame (no copy-paste layouts).'
        : '';
    const prompt = `${basePrompt}${refNoCopy}`;

    const negativePrompt = [
      'blurry, out of focus, jpeg artifacts, watermark, Getty/Shutterstock frame marks',
      'mangled hands, extra fingers, duplicated faces in crowds, melted anatomy',
      ...(fs.shot.kind === 'ai_image' && !fs.shot.imageCaption?.trim()
        ? [
            'text, letters, words, numbers, typography, captions, titles, subtitles',
            'watermarks, logos, readable signage, UI overlays, posters with readable type',
          ]
        : ['illegible micro-text unless script-locked above']),
      ...(styleBible.donts ?? []),
      ...(character?.negativePrompt ? [character.negativePrompt] : []),
      ...(timelineIndex > 0 && (fs.shot.kind === 'ai_image' || fs.shot.kind === 'ai_video')
        ? [
            'near-duplicate composition of the previous shot',
            'same poster layout or same hero prop as the last frame',
            'symmetrical stock-photo composition',
            'generic AI portrait framing repeated from prior cut',
          ]
        : []),
      ...(genConfig.allowSparseImageText === true &&
      timelineIndex > 0 &&
      flat[timelineIndex - 1]?.shot.imageCaption?.trim()
        ? ['reusing the same on-image phrase as the previous shot']
        : []),
      ...(fs.shot.kind === 'ai_image'
        ? [
            'same generic interior and lighting as a typical multi-shot AI batch',
            'identical posterised colour wash across the whole frame',
          ]
        : []),
      ...(genConfig.allowSparseImageText === true && fs.shot.imageCaption?.trim()
        ? [
            'wrong or paraphrased text versus the requested label',
            'scene-description captions or picture titles instead of the given narration snippet',
            'extra words on signs or screens beyond the specified label',
          ]
        : []),
    ]
      .filter(Boolean)
      .join(', ');

    const t0 = Date.now();

    let asset: { url: string; kind: 'image' | 'video' } | null = null;
    let shotCost = 0;
    let error: string | undefined;

    try {
      const effectiveKind =
        genConfig.mediaPreference === 'stills_only' && fs.shot.kind === 'ai_video'
          ? 'ai_image'
          : genConfig.mediaPreference === 'video_only' &&
              (fs.shot.kind === 'ai_image' || fs.shot.kind === 'scraped_image')
            ? 'scraped_video'
            : fs.shot.kind;
      logSourcingConsole(
        postId,
        `→ ${fs.shot.id} ${fs.shot.kind}→${effectiveKind} refs=${refs.length}`,
      );
      void appendPersonalGenerationLog(
        postId,
        `Shot ${fs.shot.id}: generating (${String(fs.shot.kind)} → ${effectiveKind}, ${refs.length} ref URL(s)).`,
      ).catch(() => {});
      if (effectiveKind === 'user_media') {
        const libIdx = (fs.shot.referenceIndices ?? []).find(
          (i) => typeof i === 'number' && Number.isFinite(i) && i >= 0 && i < accountMedia.length,
        );
        if (libIdx != null) {
          const row = accountMedia[libIdx]!;
          const rawUrl = row.fileUrl?.trim();
          if (rawUrl) {
            const mime = (row.mimeType ?? '').toLowerCase();
            const isVideo =
              mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v)(\?|#|$)/i.test(rawUrl);
            asset = { url: rawUrl, kind: isVideo ? 'video' : 'image' };
          }
        }
      }

      if (!asset && effectiveKind === 'ai_video' && defaultVideoModel) {
        const videoModel = getAiModel(defaultVideoModel);
        const needsFal = videoModel?.provider === 'fal';
        if (videoModel && (!needsFal || features.fal)) {
          const video = await withAbortWhenPersonalPostFailed(
            postId,
            withTimeout(
              aiVideoTimeoutMs,
              `director_video:${account.id}:${fs.shot.id}`,
              withRetry(
                () =>
                  generateAiVideo({
                    modelId: defaultVideoModel,
                    prompt,
                    negativePrompt: negativePrompt || undefined,
                    aspectRatio: videoAspectFrom(aspectRatio),
                    durationSeconds: (() => {
                      const cMin = genConfig.clipMinSeconds ?? (longformEnabled ? 4 : 2);
                      const cMax = genConfig.clipMaxSeconds ?? (longformEnabled ? 10 : 5);
                      const clipLo = Math.min(cMin, cMax);
                      const clipHi = Math.max(cMin, cMax);
                      return Math.min(clipHi, Math.max(clipLo, fs.shot.durationSeconds));
                    })(),
                    referenceImageUrls: refs,
                    scopePath: `personal/${account.id}/ai-video`,
                  }),
                { label: `director_video:${account.id}:${fs.shot.id}`, attempts: 1 },
              ),
            ),
          );
          asset = { url: video.url, kind: 'video' };
          shotCost = video.costCents;
        }
      } else if (
        effectiveKind === 'scraped_video' ||
        effectiveKind === 'scraped_image' ||
        effectiveKind === 'b_roll'
      ) {
        const baseQ = (fs.shot.imageQuery ?? fs.shot.description ?? topic).trim() || topic;
        const styleExtra = inspirationStyleHint?.trim();
        const searchQuery =
          styleExtra && styleExtra.length > 2
            ? `${baseQ} aesthetic mood: ${styleExtra.slice(0, 160)}`.slice(0, 420)
            : baseQ;
        const { items } = await withAbortWhenPersonalPostFailed(
          postId,
          withTimeout(
            60_000,
            `director_search:${account.id}:${fs.shot.id}`,
            searchAssets({
              query: searchQuery,
              sources: theme.mediaSources.filter(
                (s): s is 'pexels' | 'unsplash' | 'pixabay' | 'wikipedia' | 'news' =>
                  s !== 'ai' && s !== 'gameplay',
              ),
              count: 10,
              preferVideo:
                genConfig.mediaPreference === 'video_only' ||
                ((effectiveKind === 'scraped_video' || effectiveKind === 'b_roll') &&
                  genConfig.mediaPreference !== 'stills_only'),
            }),
          ),
        );
        if (items.length > 0) {
          const pick = items[pickSearchResultIndex(fs.shot.id, items.length)]!;
          asset = {
            url: pick.downloadUrl ?? pick.url,
            kind: pick.kind === 'video' ? 'video' : 'image',
          };
        } else if (fs.shot.kind === 'b_roll' && theme.mediaSources.includes('gameplay')) {
          const loop = pickGameplayLoop(fs.shot.id);
          asset = { url: loop.url, kind: 'video' };
        }
      }

      if (!asset && defaultImageModel && !theme.requiresGroundedImages) {
        if (SOURCING_DEBUG_CONSOLE) {
          logSourcingConsole(
            postId,
            `image API → ${defaultImageModel} shot=${fs.shot.id} (outer timeout ${aiImageTimeoutMs}ms)`,
          );
        }
        const image = await withAbortWhenPersonalPostFailed(
          postId,
          withTimeout(
            aiImageTimeoutMs,
            `director_image:${account.id}:${fs.shot.id}`,
            withRetry(
              () =>
                generateAiImage({
                  modelId: defaultImageModel,
                  prompt,
                  negativePrompt: negativePrompt || undefined,
                  aspectRatio: aspectRatio,
                  referenceImageUrls: refs,
                  scopePath: `personal/${account.id}/ai-image`,
                }),
              { label: `director_image:${account.id}:${fs.shot.id}`, attempts: 1 },
            ),
          ),
        );
        asset = { url: image.url, kind: 'image' };
        shotCost = image.costCents;
      }
    } catch (e) {
      if (e instanceof Error && e.message === PERSONAL_POST_CANCELLED_MESSAGE) {
        error = 'stopped';
      } else {
        error = (e as Error).message;
      }
      console.warn(`[director] shot ${fs.shot.id} failed:`, error);
    }

    const elapsed = Date.now() - t0;
    logSourcingConsole(
      postId,
      `← ${fs.shot.id} ${elapsed}ms ${asset ? asset.kind : 'none'} ${error ?? ''}`,
    );
    void appendPersonalGenerationLog(
      postId,
      `Shot ${fs.shot.id}: finished in ${elapsed}ms — ${asset ? `${asset.kind} OK` : 'no asset'}${error ? ` — ${error.slice(0, 520)}` : ''}`,
    ).catch(() => {});

    return { fs, asset, costCents: shotCost, error, fromCache: false };
  };

  const shotResultsOrdered: Array<Awaited<ReturnType<typeof generateShotAsset>>> = new Array(flat.length);
  let completed = 0;
  let nextIdx = 0;
  let sinceFlush = 0;
  const sourcingState = { stopped: false };
  const workers: Promise<void>[] = [];
  const worker = async () => {
    while (true) {
      if (sourcingState.stopped || (await personalPostIsFailed(postId))) {
        sourcingState.stopped = true;
        void appendPersonalGenerationLog(postId, 'Sourcing worker exiting (stop signal or post no longer in progress).').catch(
          () => {},
        );
        return;
      }
      const idx = nextIdx++;
      if (idx >= flat.length) return;
      const result = await generateShotAsset(flat[idx]!, idx);
      shotResultsOrdered[idx] = result;
      if (result.error === 'stopped' || (await personalPostIsFailed(postId))) {
        sourcingState.stopped = true;
        void appendPersonalGenerationLog(
          postId,
          `Sourcing stopped after shot ${result.fs.shot.id} (${result.error === 'stopped' ? 'cancelled' : 'post failed'}).`,
        ).catch(() => {});
        return;
      }
      if (result.error && isFalFatalAccountError(result.error)) {
        sourcingState.stopped = true;
        const detail = result.error.slice(0, 480);
        const msg =
          `Fal.ai rejected generation (billing or account lock): ${detail}. ` +
          `Top up at https://fal.ai/dashboard/billing . ` +
          `Still images can use Google Gemini instead: set image model to "Nano Banana" (nano-banana) when GEMINI_API_KEY is set; AI video on Fal still needs Fal credits.`;
        void appendPersonalGenerationLog(postId, msg).catch(() => {});
        if (!(await personalPostIsFailed(postId))) {
          await markFailed(postId, msg.slice(0, 900));
        }
        return;
      }
      if (!result.fromCache) totalCostCents += result.costCents;
      if (result.asset && !result.fromCache) {
        sourcingByShotId[result.fs.shot.id] = {
          url: result.asset.url,
          kind: result.asset.kind,
          costCents: result.costCents,
        };
      }
      completed++;
      sinceFlush++;
      if (sinceFlush >= 3 || completed === flat.length) {
        sinceFlush = 0;
        // Do not await DB checkpoint here — a large `script` JSON + slow Neon/Postgres
        // would block **all** workers and freeze sourcing progress. The chain still
        // serializes writes; we await the tail after workers finish.
        void flushSourcingCheckpointThrottled().catch((err) => {
          console.warn('[director] sourcing checkpoint flush (async) failed:', err);
        });
      }
      broadcast({
        type: 'personal:progress',
        payload: {
          accountId: account.id,
          postId,
          phase: 'sourcing_media',
          progress: { done: completed, total: flat.length },
        },
      });
    }
  };
  for (let w = 0; w < concurrency; w++) workers.push(worker());
  await Promise.all(workers);
  void appendPersonalGenerationLog(
    postId,
    `Shot workers finished (${flat.length} slot(s))${sourcingState.stopped ? ' — run was interrupted' : ''}; validating…`,
  ).catch(() => {});
  for (let i = 0; i < flat.length; i++) {
    if (shotResultsOrdered[i] === undefined) {
      shotResultsOrdered[i] = {
        fs: flat[i]!,
        asset: null,
        costCents: 0,
        error: sourcingState.stopped ? 'stopped' : 'skipped',
        fromCache: false,
      };
    }
  }
  await flushSourcingCheckpointThrottled();
  shotAssets.push(...shotResultsOrdered);

  if (await personalPostIsFailed(postId)) {
    return {
      postId,
      videoUrl: null,
      status: 'failed',
      durationSeconds: 0,
      costCents: totalCostCents,
      skipped: true,
      reason: 'stopped',
    };
  }

  const resolved = shotAssets.filter((s) => s.asset !== null) as Array<{
    fs: ReturnType<typeof flattenStoryboard>[number];
    asset: { url: string; kind: 'image' | 'video' };
    costCents: number;
  }>;
  const failedSamples = shotAssets
    .filter((s) => s.asset === null && (s as any).error)
    .slice(0, 3)
    .map((s) => (s as any).error as string);
  const minShotsRequired = longformEnabled ? 8 : 3;
  if (resolved.length < minShotsRequired) {
    if (await personalPostIsFailed(postId)) {
      return {
        postId,
        videoUrl: null,
        status: 'failed',
        durationSeconds: 0,
        costCents: totalCostCents,
        skipped: true,
        reason: 'stopped',
      };
    }
    const label = longformEnabled ? 'long-form video' : 'short';
    const hint = failedSamples.length ? ` First failures: ${failedSamples.join(' | ')}` : '';
    if (!(await personalPostIsFailed(postId))) {
      await markFailed(
        postId,
        `Only ${resolved.length}/${flat.length} shots resolved — need at least ${minShotsRequired} for a watchable ${label}.${hint}`,
      );
    }
    return {
      postId,
      videoUrl: null,
      status: 'failed',
      durationSeconds: 0,
      costCents: totalCostCents,
      skipped: true,
      reason: 'insufficient resolved shots',
    };
  }

  if (await personalPostIsFailed(postId)) {
    return {
      postId,
      videoUrl: null,
      status: 'failed',
      durationSeconds: 0,
      costCents: totalCostCents,
      skipped: true,
      reason: 'stopped',
    };
  }

  const useVoiceover = genConfig.useVoiceover ?? theme.useVoiceover;
  let estimatedDuration = resolved.reduce((acc, r) => acc + r.fs.shot.durationSeconds, 0);
  const rawShotVos = resolved.map((r) => r.fs.shot.voiceover ?? '');
  const shotVosForNarration =
    rawShotVos.length === 0
      ? rawShotVos
      : [
          stripLeadingHookFromFirstVoiceover(storyboard.hook ?? '', rawShotVos[0] ?? ''),
          ...rawShotVos.slice(1),
        ];
  if (useVoiceover) {
    if (!voiceoverUrl) {
      broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'voicing' } });
      const narration = joinNarrationParts([
        storyboard.hook,
        ...shotVosForNarration,
        storyboard.outro,
      ]);
      if (narration.length > 0) {
        const voice = await withAbortWhenPersonalPostFailed(
          postId,
          synthesizeVoice({
            text: narration,
            voiceId:
              genConfig.ttsVoiceId ?? character?.voiceId ?? account.voiceId ?? 'default',
            voiceAccent: genConfig.voiceAccent,
            voiceGender: genConfig.voiceGender,
            language: account.language,
            accountId: account.id,
            speed: Math.min(1.2, Math.max(0.7, genConfig.ttsSpeed ?? 1)),
            providerPreference: genConfig.ttsProvider,
          }),
        );
        voiceoverUrl = voice.audioUrl;
        measuredVoiceSeconds = voice.durationSeconds;
        voiceCharacterAlignment = voice.voiceCharacterAlignment;
        estimatedDuration = Math.max(estimatedDuration, voice.durationSeconds);
        totalCostCents += voice.costCents;
      }
    } else if (measuredVoiceSeconds != null && Number.isFinite(measuredVoiceSeconds)) {
      estimatedDuration = Math.max(estimatedDuration, measuredVoiceSeconds);
    }
  } else {
    const onScreenText = [
      storyboard.hook,
      ...(genConfig.directorShotOnScreenCopy === false
        ? []
        : resolved.map((r) => r.fs.shot.onScreen).filter(Boolean)),
      storyboard.outro,
    ].join(' ');
    if (onScreenText.length > 0) {
      estimatedDuration = Math.max(estimatedDuration, estimateDurationSeconds(onScreenText));
    }
  }

  /** Cold-open pad on shot 0 (music must cover full mux, including this). */
  const longformIntroSeconds =
    longformEnabled &&
    genConfig.longformIntroEnabled === true &&
    useVoiceover &&
    Boolean(voiceoverUrl) &&
    resolved.length > 0
      ? Math.min(5, Math.max(1.5, genConfig.longformIntroSeconds ?? 2.5))
      : 0;

  let musicUrl: string | null = null;
  let musicAttribution: string | null = null;
  const wantMusicBed =
    genConfig.useMusic === false ? false : (genConfig.useMusic ?? theme.useMusic);
  if (wantMusicBed && account.customAudioUrl) {
    musicUrl = account.customAudioUrl;
    musicAttribution = account.customAudioAttribution ?? null;
  } else if (wantMusicBed) {
    const musicTargetSeconds = Math.ceil(
      Math.max(estimatedDuration, longformEnabled ? longformTargetSeconds ?? 0 : 0) +
        (longformIntroSeconds > 0 ? longformIntroSeconds : 0),
    );
    const minMusicSeconds = longformEnabled
      ? Math.min(480, Math.max(60, musicTargetSeconds))
      : Math.max(1, musicTargetSeconds);
    const music = await withAbortWhenPersonalPostFailed(
      postId,
      resolveChainedMusicBed({
        mood: theme.musicMood,
        seed: postId,
        accountId: account.id,
        postId,
        targetSeconds: musicTargetSeconds,
        firstPickMinDurationSeconds: minMusicSeconds,
      }),
    ).catch(() => null);
    if (music) {
      musicUrl = music.url;
      musicAttribution = music.attribution;
    }
  }

  if (await personalPostIsFailed(postId)) {
    return {
      postId,
      videoUrl: null,
      status: 'failed',
      durationSeconds: 0,
      costCents: totalCostCents,
      skipped: true,
      reason: 'stopped',
    };
  }

  broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'stitching' } });

  const keywordOverlayStyle: 'off' | 'subtle' | 'bold' | 'slate' | 'slate_bold' = aiOnImageFactLabelsOnly(
    genConfig,
  )
    ? 'off'
    : genConfig.namesNumbersTitleCard === true
      ? genConfig.keywordPopStyle === 'bold'
        ? 'slate_bold'
        : 'slate'
      : genConfig.keywordPopStyle === 'bold' || genConfig.keywordPopStyle === 'subtle'
        ? genConfig.keywordPopStyle
        : 'off';
  const isYoutube = isYoutubeAccount(account.platform);
  const extractYoutubeThumbnail = Boolean(longformEnabled && isYoutube);

  const perShotSecondsMax = perShotSecondsMaxFromAverageClip(genConfig.averageClipSeconds, {
    longform: longformEnabled,
  });
  const nResolved = resolved.length;
  const voNeedPerShot =
    useVoiceover &&
    measuredVoiceSeconds != null &&
    Number.isFinite(measuredVoiceSeconds) &&
    measuredVoiceSeconds > 0.25 &&
    nResolved > 0
      ? measuredVoiceSeconds / nResolved
      : 0;

  let maxPerPartition: number;
  if (longformEnabled) {
    maxPerPartition = Math.min(
      20,
      Math.max(
        6,
        (perShotSecondsMax ?? 8) * 2.05,
        genConfig.averageClipSeconds != null &&
          Number.isFinite(genConfig.averageClipSeconds) &&
          genConfig.averageClipSeconds >= 1
          ? genConfig.averageClipSeconds * 2.75
          : 7,
        voNeedPerShot > 0 ? voNeedPerShot + 0.5 : 0,
      ),
      genConfig.averageClipSeconds != null &&
        Number.isFinite(genConfig.averageClipSeconds) &&
        genConfig.averageClipSeconds >= 1
        ? genConfig.averageClipSeconds * 3.35
        : 99,
    );
  } else if (
    genConfig.averageClipSeconds != null &&
    Number.isFinite(genConfig.averageClipSeconds) &&
    genConfig.averageClipSeconds >= 1
  ) {
    const ac = Math.min(10, Math.max(1, genConfig.averageClipSeconds));
    /**
     * Hard pacing cap from dashboard "Avg seconds per clip" — do **not** add `voice/n`
     * here; that defeated the setting (ceilings jumped to ~10–14s whenever narration
     * was long, so one beat could legally hold most of the video).
     */
    maxPerPartition = Math.min(11, ac * 1.14);
  } else {
    const fallbackCap = perShotSecondsMax ?? 7.5;
    maxPerPartition = Math.min(10, Math.max(2.8, fallbackCap * 1.1));
  }

  /**
   * If every shot were at `maxPerPartition`, total visual time must still reach ~VO length
   * or `shotDurationsFromVoicePartition` hits the per-shot ceiling and **cannot** sum to
   * measured narration (then stitch ≈37s vs VO 120s+ → frozen last frame after mux).
   */
  if (
    useVoiceover &&
    measuredVoiceSeconds != null &&
    Number.isFinite(measuredVoiceSeconds) &&
    measuredVoiceSeconds > 0.35 &&
    nResolved > 0
  ) {
    const minAvgPerShot = measuredVoiceSeconds / nResolved;
    const LF_VO_CAP = longformEnabled
      ? Math.min(90, Math.max(22, minAvgPerShot + 0.35))
      : 14;
    if (maxPerPartition + 1e-3 < minAvgPerShot) {
      const prev = maxPerPartition;
      maxPerPartition = Math.min(LF_VO_CAP, Math.max(maxPerPartition, minAvgPerShot + 0.25));
      const msg =
        `[director-mid] lifted maxPerPartition ${prev.toFixed(2)}s → ${maxPerPartition.toFixed(2)}s ` +
        `(${nResolved} shots, ~${measuredVoiceSeconds.toFixed(0)}s VO; need ≥${minAvgPerShot.toFixed(2)}s/shot average).`;
      console.warn(msg);
      logVisualPacing('director-mid', 'maxPerPartition lifted for VO coverage', {
        postId,
        prev,
        next: maxPerPartition,
        nResolved,
        measuredVoiceSeconds,
        minAvgPerShot,
        LF_VO_CAP,
        longformEnabled,
      });
    }
  }

  const minPerShotPartition =
    perShotSecondsMax != null
      ? Math.max(0.5, Math.min(1.05, perShotSecondsMax * 0.17))
      : 1.05;

  /** Any configured average clip steers partition caps + anchor blend (including rapid 1–1.4s cuts). */
  const acHint =
    genConfig.averageClipSeconds != null &&
    Number.isFinite(genConfig.averageClipSeconds) &&
    genConfig.averageClipSeconds >= 1
      ? Math.min(10, Math.max(1, genConfig.averageClipSeconds))
      : null;
  /** Pull storyboard anchors toward real VO timing without long storyboard beats overriding the dashboard average. */
  const anchorPacingCap =
    acHint != null && perShotSecondsMax != null
      ? Math.min(maxPerPartition, perShotSecondsMax * 1.02, acHint * 1.06)
      : acHint != null
        ? Math.min(maxPerPartition, acHint * 1.08)
        : maxPerPartition;

  /**
   * When we have measured narration, never blend toward storyboard `durationSeconds` —
   * those planner hints are often wildly off real TTS length and caused a few shots to
   * absorb most of the VO (one image for the majority of the runtime).
   */
  const anchorBlend =
    useVoiceover &&
    measuredVoiceSeconds != null &&
    Number.isFinite(measuredVoiceSeconds) &&
    measuredVoiceSeconds > 0.25
      ? 0
      : acHint != null && acHint <= 2.75
        ? 0
        : acHint != null && acHint <= 3.5
          ? 0.1
          : acHint != null
            ? 0.22
            : 0.32;

  if (
    !longformEnabled &&
    useVoiceover &&
    acHint != null &&
    measuredVoiceSeconds != null &&
    Number.isFinite(measuredVoiceSeconds) &&
    measuredVoiceSeconds > 0.25 &&
    nResolved > 0
  ) {
    const minNeed = minShotsForVoiceAndAvgClip(measuredVoiceSeconds, maxPerPartition);
    if (nResolved < minNeed) {
      const msg =
        `This narration is ~${Math.round(measuredVoiceSeconds)}s but only ${nResolved} shot(s) resolved. ` +
        `With "Avg seconds per clip" ≈${acHint.toFixed(1)}s you need at least **${minNeed}** shots so cuts stay on pace ` +
        `(each clip is capped near ${(acHint * 1.32).toFixed(1)}s). Regenerate with a tighter cut pace / higher target shot count, or raise avg seconds per clip.`;
      if (!(await personalPostIsFailed(postId))) {
        await markFailed(postId, msg.slice(0, 950));
      }
      return {
        postId,
        videoUrl: null,
        status: 'failed',
        durationSeconds: 0,
        costCents: totalCostCents,
        skipped: true,
        reason: 'too_few_shots_for_avg_clip',
      };
    }
  }

  const narrJoinForAlign = joinNarrationParts([
    storyboard.hook,
    ...shotVosForNarration,
    storyboard.outro,
  ]);
  const { narration: narrSpanCheck, shotSpanByIndex } = joinNarrationPartsWithShotCharSpans(
    storyboard.hook ?? '',
    shotVosForNarration,
    storyboard.outro ?? '',
  );
  const alignmentForStitch =
    voiceCharacterAlignment &&
    voiceCharacterAlignment.narrationText === narrJoinForAlign &&
    narrSpanCheck === narrJoinForAlign
      ? voiceCharacterAlignment
      : undefined;

  let visualDurations: number[] | null = null;
  /**
   * VO-window durations (no post-mention lag). Keyword overlays still key off spoken
   * spans; visuals may hold the previous still while early words of the next line play.
   */
  let voiceWindowDurationsForKeywords: number[] | null = null;
  if (
    useVoiceover &&
    measuredVoiceSeconds != null &&
    Number.isFinite(measuredVoiceSeconds) &&
    measuredVoiceSeconds > 0.25 &&
    resolved.length > 0
  ) {
    const joinedRanges = joinNarrationPartsWithVisualShotRanges({
      hook: storyboard.hook ?? '',
      shotVoiceovers: shotVosForNarration,
      outro: storyboard.outro ?? '',
    });
    if (
      joinedRanges &&
      joinedRanges.narration === narrJoinForAlign &&
      alignmentForStitch &&
      joinedRanges.visualShotRanges.length === resolved.length
    ) {
      const mentionAnchors = resolved.map((r) => {
        const cap = r.fs.shot.imageCaption?.trim();
        if (cap) return cap;
        return undefined;
      });
      const alignedVoWindows = shotDurationsFromVoiceAlignment({
        alignment: alignmentForStitch,
        shotCharRanges: joinedRanges.visualShotRanges,
        voiceSeconds: measuredVoiceSeconds,
        minPerShot: minPerShotPartition,
        maxPerShot: maxPerPartition,
        cutAfterMention: false,
      });
      const aligned = shotDurationsFromVoiceAlignment({
        alignment: alignmentForStitch,
        shotCharRanges: joinedRanges.visualShotRanges,
        voiceSeconds: measuredVoiceSeconds,
        minPerShot: minPerShotPartition,
        maxPerShot: maxPerPartition,
        cutAfterMention: true,
        mentionAnchors,
        postMentionLagSeconds: 0.15,
      });
      if (aligned && aligned.length === resolved.length) {
        visualDurations = aligned;
        voiceWindowDurationsForKeywords =
          alignedVoWindows && alignedVoWindows.length === resolved.length
            ? alignedVoWindows
            : aligned;
        logVisualPacing('director-mid', 'shot durations from ElevenLabs alignment (cut after mention)', {
          postId,
          measuredVoiceSeconds,
          durations: aligned.map((x) => Math.round(x * 100) / 100),
          sum: Math.round(aligned.reduce((a, b) => a + b, 0) * 100) / 100,
        });
      }
    }
    if (visualDurations == null) {
    let vd = shotDurationsFromVoicePartition({
      voiceSeconds: measuredVoiceSeconds,
      hook: storyboard.hook ?? '',
      outro: storyboard.outro ?? '',
      shotVoiceovers: shotVosForNarration,
      minPerShot: minPerShotPartition,
      maxPerShot: maxPerPartition,
      anchorDurations: resolved.map((r) =>
        Math.min(Math.max(0.25, r.fs.shot.durationSeconds), anchorPacingCap),
      ),
      anchorBlend,
    });
    logVisualPacing('director-mid', 'voice partition (before VO-sum fix)', {
      postId,
      measuredVoiceSeconds,
      partitionSum: Math.round(vd.reduce((a, b) => a + b, 0) * 100) / 100,
      vd: vd.map((x) => Math.round(x * 100) / 100),
    });
    if (vd.length === resolved.length) {
      const tgt = measuredVoiceSeconds;
      let sum = vd.reduce((a, b) => a + b, 0);
      /** Rare float / cap edge: force sum to measured VO so stitch target matches audio. */
      if (tgt != null && Math.abs(sum - tgt) > 0.28) {
        logVisualPacing('director-mid', 'voice partition sum drift — renormalizing', {
          postId,
          sumBefore: Math.round(sum * 100) / 100,
          tgt: Math.round(tgt * 100) / 100,
        });
        const k = tgt / sum;
        vd = vd.map((x) =>
          Math.round(
            Math.max(minPerShotPartition, Math.min(maxPerPartition, x * k)) * 20,
          ) / 20,
        );
        sum = vd.reduce((a, b) => a + b, 0);
        let drift = tgt - sum;
        const order = [...vd.keys()].sort((a, b) => vd[b]! - vd[a]!);
        for (let g = 0; g < 40 && Math.abs(drift) > 0.06; g++) {
          let hit = false;
          for (const idx of order) {
            if (Math.abs(drift) < 0.04) break;
            if (drift > 0) {
              const room = maxPerPartition - vd[idx]!;
              if (room < 0.02) continue;
              const add = Math.min(room, drift * 0.5);
              vd[idx] = Math.round((vd[idx]! + add) * 20) / 20;
            } else {
              const room = vd[idx]! - minPerShotPartition;
              if (room < 0.02) continue;
              const sub = Math.min(room, Math.abs(drift) * 0.5);
              vd[idx] = Math.round((vd[idx]! - sub) * 20) / 20;
            }
            drift = tgt - vd.reduce((a, b) => a + b, 0);
            hit = true;
          }
          if (!hit) break;
        }
        logVisualPacing('director-mid', 'voice partition after renormalize', {
          postId,
          sumAfter: Math.round(vd.reduce((a, b) => a + b, 0) * 100) / 100,
          vd: vd.map((x) => Math.round(x * 100) / 100),
        });
      }
      const sumVd = vd.reduce((a, b) => a + b, 0);
      if (tgt != null && Math.abs(sumVd - tgt) > 1.5) {
        console.warn(
          `[director-mid] post ${postId.slice(0, 8)}… partition sum ${sumVd.toFixed(1)}s vs measured VO ${tgt.toFixed(1)}s (Δ ${(sumVd - tgt).toFixed(1)}s). ` +
            `Stitch would be shorter than narration — check maxPerPartition / shot count.`,
        );
        logVisualPacing('director-mid', 'PARTITION_SUM_MISMATCH', {
          postId,
          sumVd,
          tgt,
          maxPerPartition,
          nShots: vd.length,
        });
      }
      voiceWindowDurationsForKeywords = vd.slice();
      /** Approximate post-mention cuts when character alignment is unavailable. */
      vd = applyVisualMentionLagToDurations(vd, {
        lagSeconds: 0.4,
        minPerShot: minPerShotPartition,
      });
      logVisualPacing('director-mid', 'voice partition after mention-lag nudge', {
        postId,
        vd: vd.map((x) => Math.round(x * 100) / 100),
        sum: Math.round(vd.reduce((a, b) => a + b, 0) * 100) / 100,
      });
      visualDurations = vd;
    }
    }
  }

  if (narrSpanCheck !== narrJoinForAlign) {
    console.warn('[director-mid] narration / span string mismatch; ElevenLabs keyword alignment skipped.');
  }

  /** VO is delayed in mux by this many seconds; aligns ElevenLabs times to per-shot video timeline. */
  const voiceLeadInForKeywordTiming =
    longformIntroSeconds > 0 && Number.isFinite(longformIntroSeconds) ? longformIntroSeconds : 0;

  /** Cumulative encoded segment duration before each shot (matches final concat order). */
  const cumStitchDurBefore: number[] = [];
  {
    let acc = 0;
    for (let j = 0; j < resolved.length; j++) {
      cumStitchDurBefore.push(acc);
      const bd =
        visualDurations != null && visualDurations[j] != null
          ? visualDurations[j]!
          : resolved[j]!.fs.shot.durationSeconds;
      const ip = j === 0 && longformIntroSeconds > 0 ? longformIntroSeconds : 0;
      acc += bd + ip;
    }
  }

  let stitchInputs: StitchShotInput[] = resolved.map((r, i) => {
    const baseDur =
      visualDurations != null && visualDurations[i] != null
        ? visualDurations[i]!
        : r.fs.shot.durationSeconds;
    const introPad = i === 0 && longformIntroSeconds > 0 ? longformIntroSeconds : 0;
    const dur = baseDur + introPad;
    return {
      url: r.asset.url,
      kind: r.asset.kind,
      durationSeconds: dur,
      transitionOut: r.fs.shot.transitionOut,
      speedRamp: r.fs.shot.speedRamp,
      focalX: r.fs.shot.focalX,
      focalY: r.fs.shot.focalY,
      keywordCards: (() => {
        if (keywordOverlayStyle === 'off' || aiOnImageFactLabelsOnly(genConfig)) return undefined;
        const filtered = filterKeywordCardsByVoiceover(r.fs.shot.keywordCards, r.fs.shot.voiceover ?? '');
        const normOpts = {
          snappySlate: genConfig.namesNumbersTitleCard === true,
          plannedDurationSeconds: r.fs.shot.durationSeconds,
          bodyDurationSeconds: baseDur,
          introPadSeconds: introPad,
        } as const;
        if (
          alignmentForStitch &&
          visualDurations != null &&
          visualDurations[i] != null &&
          filtered?.length
        ) {
          const span = shotSpanByIndex.get(i);
          const vdKw = voiceWindowDurationsForKeywords ?? visualDurations;
          const mp3Start = vdKw.slice(0, i).reduce((a, b) => a + b, 0);
          const mp3End = mp3Start + vdKw[i]!;
          if (span && span.end > span.start) {
            const aligned = keywordStitchCardsFromVoiceAlignment({
              cards: filtered,
              alignment: alignmentForStitch,
              windowStart: span.start,
              windowEnd: span.end,
              mp3PartitionStart: mp3Start,
              mp3PartitionEnd: mp3End,
              segmentDurationSeconds: dur,
              introPadSeconds: introPad,
              snappySlate: genConfig.namesNumbersTitleCard === true,
              voiceoverLeadInSeconds: voiceLeadInForKeywordTiming,
              cumulativeStitchSecondsBeforeShot: cumStitchDurBefore[i]!,
            });
            if (aligned?.length) return aligned;
          }
        }
        return normalizeKeywordCardsForShot(filtered, dur, normOpts);
      })(),
      /** On-image labels are painted by the image model only — do not duplicate via FFmpeg drawtext. */
      persistentCaption: undefined,
    };
  });
  stitchInputs = dedupeKeywordCardsAcrossShots(stitchInputs, { minShotsBetweenRepeats: 5 });

  const shotSum = stitchInputs.reduce((a, s) => a + s.durationSeconds, 0);
  const nStitch = stitchInputs.length;
  let stitchTarget: number | undefined;
  if (visualDurations != null) {
    stitchTarget = shotSum;
  } else if (longformEnabled) {
    stitchTarget = Math.max(longformTargetSeconds ?? 0, estimatedDuration, shotSum);
  } else if (useVoiceover && estimatedDuration > shotSum + 1) {
    stitchTarget = estimatedDuration;
  }
  /** Do not cap VO-aligned targets — partition shots can exceed avg-clip stitch cap. */
  if (
    visualDurations == null &&
    perShotSecondsMax != null &&
    nStitch > 0 &&
    stitchTarget != null &&
    Number.isFinite(stitchTarget)
  ) {
    const maxVisual = nStitch * perShotSecondsMax;
    if (stitchTarget > maxVisual + 0.25) {
      stitchTarget = maxVisual;
    }
  }

  const look = stitchFinalLook(genConfig, storyboard);

  const voiceLeadInTotal = longformIntroSeconds > 0 ? longformIntroSeconds : 0;

  const preStitchCk = {
    v: 1 as const,
    phase: 'pre_stitch' as const,
    stitchInputs,
    stitchTarget,
    voicePartitioned: visualDurations != null,
    aspectRatio,
    useGrain: look.useGrain,
    letterbox: look.letterbox,
    stitchColourGrade: look.colourGrade,
    voiceoverUrl,
    musicUrl,
    musicAttribution,
    totalCostCentsBeforeStitch: totalCostCents,
    musicDuckLowVolume: stitchMusicDuck,
    musicSoloVolume: stitchMusicSolo,
    keywordOverlayStyle,
    extractYoutubeThumbnail,
    stitchEncodePreset: genConfig.stitchEncodePreset ?? 'balanced',
    kenBurnsOnStills: genConfig.kenBurnsOnStills !== false,
    voiceoverLeadInSeconds: voiceLeadInTotal > 0 ? voiceLeadInTotal : undefined,
    namesNumbersTitleCard: undefined,
  };

  const scriptForRow = withPersonalScheduleIntent(
    {
      ...stripDirectorResumeKeys(storyboard as unknown as Record<string, unknown>),
      outputAspectRatio: aspectRatio,
      [CK_PRE]: preStitchCk,
    },
    buildPersonalScheduleIntent(args, account),
  );

  await db
    .update(personalPosts)
    .set({
      voiceoverUrl,
      musicUrl,
      musicAttribution,
      status: 'rendering',
      renderProgress: 2,
      renderProgressLabel: 'Preparing final video…',
      renderActivityLog: [],
      mediaAssets: stitchInputs.map((si, i) => {
        const r = resolved[i]!;
        return {
          url: r.asset.url,
          kind: r.asset.kind,
          source: (r.fs.shot.kind === 'ai_video' || r.fs.shot.kind === 'ai_image'
            ? 'ai'
            : r.fs.shot.kind === 'b_roll'
              ? 'gameplay'
              : r.fs.shot.kind === 'scraped_video' || r.fs.shot.kind === 'scraped_image'
                ? 'pexels'
                : 'upload') as any,
          startAtSeconds: 0,
          durationSeconds: si.durationSeconds,
        };
      }),
      script: scriptForRow as any,
      updatedAt: new Date(),
    })
    .where(eq(personalPosts.id, postId));

  if (await personalPostIsFailed(postId)) {
    return {
      postId,
      videoUrl: null,
      status: 'failed',
      durationSeconds: 0,
      costCents: totalCostCents,
      skipped: true,
      reason: 'stopped',
    };
  }

  logVisualPacing('director-mid', 'pre-stitch pacing snapshot', {
    postId,
    measuredVoiceSeconds: measuredVoiceSeconds ?? null,
    estimatedDuration,
    useVoiceover,
    longformEnabled,
    averageClipSeconds: genConfig.averageClipSeconds ?? null,
    perShotSecondsMax: perShotSecondsMax ?? null,
    maxPerPartition,
    minPerShotPartition,
    anchorBlend,
    anchorPacingCap,
    longformIntroSeconds,
    voicePartitioned: visualDurations != null,
    visualDurations: visualDurations?.map((x) => Math.round(x * 100) / 100) ?? null,
    storyboardDurations: resolved.map((r) => Math.round(r.fs.shot.durationSeconds * 100) / 100),
    stitchDurations: stitchInputs.map((s) => Math.round(s.durationSeconds * 100) / 100),
    stitchTarget: stitchTarget ?? null,
    stitchSum: Math.round(shotSum * 100) / 100,
    stitchVsVoice:
      measuredVoiceSeconds != null && Number.isFinite(measuredVoiceSeconds)
        ? Math.round((shotSum - measuredVoiceSeconds) * 100) / 100
        : null,
    voCharLens: shotVosForNarration.map((t) => t.length),
    nShots: resolved.length,
  });

  const keywordKo = resolveKeywordOverlayForAspect(genConfig, aspectRatio);

  const stitched = await withAbortWhenPersonalPostFailed(
    postId,
    stitchShots({
      accountId: account.id,
      postId,
      shots: stitchInputs,
      audio: {
        voiceoverUrl: voiceoverUrl ?? undefined,
        musicUrl: musicUrl ?? undefined,
        musicDuckLowVolume: stitchMusicDuck,
        musicSoloVolume: stitchMusicSolo,
        ...(voiceLeadInTotal > 0 ? { voiceoverLeadInSeconds: voiceLeadInTotal } : {}),
      },
      namesNumbersTitleCard: undefined,
      aspectRatio: aspectRatio,
      colourGrade: look.colourGrade,
      useGrain: look.useGrain,
      letterbox: look.letterbox,
      encodePreset: genConfig.stitchEncodePreset ?? 'balanced',
      targetDurationSeconds: stitchTarget,
      /** Keep scale cap aligned with partition ceiling (undefined was defaulting to 18s). */
      perShotSecondsMax: visualDurations != null ? maxPerPartition + 0.35 : perShotSecondsMax,
      keywordOverlayStyle,
      keywordOverlayFontPreset: keywordKo.fontPreset,
      keywordOverlayFontScale: keywordKo.fontScale,
      keywordOverlayTextBackground: keywordKo.textBackground,
      keywordOverlayTextAnchor: keywordKo.textAnchor,
      onRenderProgress: async (p) => {
        try {
          await db
            .update(personalPosts)
            .set({
              renderProgress: p.percent,
              renderProgressLabel: p.label.slice(0, 500),
              renderActivityLog: [],
              updatedAt: new Date(),
            })
            .where(eq(personalPosts.id, postId));
        } catch {
          /* non-fatal */
        }
      },
      kenBurnsOnStills: genConfig.kenBurnsOnStills !== false,
    }),
  );
  totalCostCents += 3;

  const thumbAlign = await buildPersonalThumbnailShotAlign({
    accountId: account.id,
    characterId: account.characterId ?? null,
    styleBible: (account.styleBible as PersonalAccountStyleBible) ?? null,
    theme,
    storyboard,
    genCfg: genConfig,
  });
  const thumb = await createPersonalPostThumbnail({
    accountId: account.id,
    postId,
    videoUrl: stitched.videoUrl,
    videoDurationSeconds: stitched.durationSeconds,
    aspectRatio,
    overlayLine: shortThumbnailOverlayLine(storyboard.title ?? '', topic),
    topic: topic.trim() || 'Video',
    variationKey: randomUUID(),
    shotAlign: thumbAlign,
  });
  const thumbnailUrl = thumb.url;
  totalCostCents += thumb.costCents;

  const finalDirectorCaption = composeCaption(storyboard);

  let contentStudioPostId: string | null = null;
  let scheduledAt: Date | null = null;
  let scheduleError: string | null = null;
  const shouldSchedule = shouldSchedulePersonalToContentStudio(args, account);
  if (shouldSchedule) {
    const when = args.scheduledAt
      ? new Date(args.scheduledAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    try {
      const res = await schedulePersonalPostWithRetry(
        {
          platform: account.platform,
          caption: finalDirectorCaption,
          videoUrl: stitched.videoUrl,
          scheduledAt: when,
          workspaceId: account.contentStudioWorkspaceId ?? undefined,
          contentStudioAccountIds: contentStudioAccountIdsOverride(account),
          ...(longformEnabled && isYoutube
            ? {
                youtubeTitle:
                  storyboard.title?.trim().slice(0, 100) || topic.trim().slice(0, 100) || undefined,
                youtubeDescription: finalDirectorCaption,
                youtubeLongForm: true,
                ...(thumbnailUrl ? { youtubeThumbnailUrl: thumbnailUrl } : {}),
              }
            : isYoutube
              ? {
                  youtubeTitle:
                    storyboard.title?.trim().slice(0, 100) || topic.trim().slice(0, 100) || undefined,
                  youtubeDescription: finalDirectorCaption,
                }
              : {}),
        },
        { label: `personal:schedule:${postId}` },
      );
      contentStudioPostId = res.id;
      scheduledAt = when;
    } catch (e) {
      scheduleError = e instanceof Error ? e.message : String(e);
      console.error('[director] schedule failed after retries:', scheduleError);
    }
  }

  let musicSource: 'custom_bed' | 'library' | 'none' = 'none';
  if (musicUrl) {
    musicSource =
      wantMusicBed && account.customAudioUrl && musicUrl === account.customAudioUrl
        ? 'custom_bed'
        : 'library';
  }

  const scriptFinal = withPersonalScheduleIntent(
    {
      ...stripDirectorResumeKeys(storyboard as unknown as Record<string, unknown>),
      outputAspectRatio: aspectRatio,
      generationInfo: buildDirectorGenerationInfo({
        genConfig,
        account,
        character: character ? { voiceId: character.voiceId ?? null } : null,
        longformEnabled,
        longformAnimationStyle,
        musicAttribution,
        musicSource,
        themeTemplate: theme.template,
        totalCostCents,
        pickImageModelForLongform,
      }),
    },
    // Keep intent when schedule failed so cron can retry; clear once CS accepted.
    scheduledAt ? null : buildPersonalScheduleIntent(args, account),
  );

  await db
    .update(personalPosts)
    .set({
      videoUrl: stitched.videoUrl,
      thumbnailUrl: thumbnailUrl ?? null,
      durationSeconds: Math.max(1, Math.round(stitched.durationSeconds)),
      caption: finalDirectorCaption,
      hashtags: storyboard.hashtags ?? theme.defaultHashtags,
      contentStudioPostId,
      scheduledAt,
      status: scheduledAt ? 'scheduled' : 'ready',
      errorMessage: scheduleError ? scheduleError.slice(0, 500) : null,
      costCents: totalCostCents,
      postKind: 'video',
      renderProgress: null,
      renderProgressLabel: null,
      renderActivityLog: [],
      script: scriptFinal as any,
      updatedAt: new Date(),
    })
    .where(eq(personalPosts.id, postId));

  await db
    .update(personalAccounts)
    .set({
      lastGeneratedAt: new Date(),
      totalPosts: (account.totalPosts ?? 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(personalAccounts.id, account.id));

  if (scheduleError) {
    try {
      await maybeEmailPersonalPostFailed({
        accountId: account.id,
        postId,
        topic: topic.trim() || 'Video',
        error: `ContentStudio schedule failed: ${scheduleError}`,
        includeSaveLink: true,
      });
    } catch (e) {
      console.warn('[personal] failure email:', (e as Error).message);
    }
    // Still deliver the finished video when Schedule autopilot ran (CS failed, video exists).
    if (args.fromScheduleAutopilot) {
      try {
        await maybeEmailPersonalVideoReady({
          accountId: account.id,
          postId,
          videoUrl: stitched.videoUrl,
          topic: topic.trim() || 'Video',
          captionPreview: finalDirectorCaption,
          force: true,
        });
      } catch (e) {
        console.warn('[personal] video delivery email:', (e as Error).message);
      }
    }
  } else {
    try {
      await maybeEmailPersonalVideoReady({
        accountId: account.id,
        postId,
        videoUrl: stitched.videoUrl,
        topic: topic.trim() || 'Video',
        captionPreview: finalDirectorCaption,
        force: args.fromScheduleAutopilot === true,
      });
    } catch (e) {
      console.warn('[personal] video delivery email:', (e as Error).message);
    }
  }

  broadcast({
    type: 'personal:progress',
    payload: { accountId: account.id, postId, phase: 'done:director', videoUrl: stitched.videoUrl },
  });

  return {
    postId,
    videoUrl: stitched.videoUrl,
    status: scheduledAt ? 'scheduled' : 'ready',
    durationSeconds: stitched.durationSeconds,
    costCents: totalCostCents,
  };
}

export type PreStitchCheckpoint = {
  v: 1;
  phase: 'pre_stitch';
  stitchInputs: StitchShotInput[];
  stitchTarget?: number;
  /** When true, stitch inputs were timed to measured VO — resume skips avg-clip target/per-shot caps. */
  voicePartitioned?: boolean;
  aspectRatio: '9:16' | '1:1' | '16:9' | '4:5';
  useGrain: boolean;
  letterbox: boolean;
  /** Resolved FFmpeg grade (account override or storyboard). */
  stitchColourGrade?: 'natural' | 'warm' | 'cool' | 'teal_orange' | 'film' | 'bw' | 'high_contrast';
  voiceoverUrl: string | null;
  musicUrl: string | null;
  musicAttribution: string | null;
  totalCostCentsBeforeStitch: number;
  /** FFmpeg mix — persisted so resume uses same levels as first pass. */
  musicDuckLowVolume?: number;
  musicSoloVolume?: number;
  /** Delay VO start (long-form cold open); must match first stitch segment extension. */
  voiceoverLeadInSeconds?: number;
  /** Keyword / caption overlay style for {@link stitchShots}. */
  keywordOverlayStyle?: 'off' | 'subtle' | 'bold' | 'slate' | 'slate_bold';
  /** When true, resume path extracts a YouTube JPEG thumb after stitch. */
  extractYoutubeThumbnail?: boolean;
  /** FFmpeg encode tier used for this run (resume uses checkpoint value when set). */
  stitchEncodePreset?: 'fast' | 'balanced' | 'high';
  /** Ken Burns on stills — persisted for resume stitch. */
  kenBurnsOnStills?: boolean;
  /** Opening white slate (legacy checkpoints only — stitch no longer prepends this). */
  namesNumbersTitleCard?: { lines: string[]; durationSeconds: number };
};

/**
 * Legacy checkpoints padded `voiceoverLeadInSeconds` with a removed opening slate;
 * subtract that so narration lines up with the first body frame.
 */
function voiceoverLeadInSecondsWithoutTitleCard(pre: PreStitchCheckpoint): number | undefined {
  const raw = pre.voiceoverLeadInSeconds;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return undefined;
  const card = pre.namesNumbersTitleCard;
  if (!card?.lines?.length) return raw;
  const titleDur =
    typeof card.durationSeconds === 'number' &&
    Number.isFinite(card.durationSeconds) &&
    card.durationSeconds > 0.25
      ? card.durationSeconds
      : defaultNamesNumbersTitleCardDurationSeconds(card.lines.length);
  const adj = Math.max(0, raw - titleDur);
  return adj > 0.05 ? adj : undefined;
}

/**
 * Resume only the FFmpeg stitch + schedule + final persist after a process
 * restart (checkpoint was written before stitch began).
 */
export async function finishDirectorFromPreStitchCheckpoint(
  post: typeof personalPosts.$inferSelect,
  account: typeof personalAccounts.$inferSelect,
  theme: PersonalTheme,
  genArgsIn: GenerateForAccountArgs,
  pre: PreStitchCheckpoint,
): Promise<GenerateForAccountResult> {
  const db = getDb();
  const postId = post.id;
  const genArgs = mergePersonalScheduleIntentIntoArgs(genArgsIn, post.script);
  const storyboard = stripDirectorResumeKeys(post.script as Record<string, unknown>) as unknown as Storyboard;

  let totalCostCents = pre.totalCostCentsBeforeStitch + 3;

  broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'stitching' } });

  const genCfg = (account.generatorConfig as PersonalGeneratorConfig) ?? {};
  const aiResumeOnImage = aiOnImageFactLabelsOnly(genCfg);
  const longformResume =
    genCfg.longformEnabled === true || theme.template === 'animated-explainer';
  const perShotSecondsMax = perShotSecondsMaxFromAverageClip(genCfg.averageClipSeconds, {
    longform: longformResume,
  });
  const inputSum = pre.stitchInputs.reduce((a, s) => a + s.durationSeconds, 0);
  /** Checkpoint shots were timed to measured VO — do not re-apply avg-clip ceiling. */
  const voicePartitionedResume =
    pre.voicePartitioned === true ||
    (perShotSecondsMax != null &&
      pre.stitchInputs.some((s) => s.durationSeconds > perShotSecondsMax + 0.05));
  let stitchTargetResume = pre.stitchTarget ?? inputSum;
  if (voicePartitionedResume) {
    stitchTargetResume = inputSum;
  } else if (
    perShotSecondsMax != null &&
    pre.stitchInputs.length > 0 &&
    stitchTargetResume != null &&
    Number.isFinite(stitchTargetResume)
  ) {
    const maxVis = pre.stitchInputs.length * perShotSecondsMax;
    if (stitchTargetResume > maxVis + 0.25) {
      stitchTargetResume = maxVis;
    }
  }
  const colourGrade =
    pre.stitchColourGrade ??
    genCfg.colourGrade ??
    mapGrade(storyboard.editPlan.colourGrade);

  const resumeVoLeadIn = voiceoverLeadInSecondsWithoutTitleCard(pre);

  const resumeKeywordKo = resolveKeywordOverlayForAspect(genCfg, pre.aspectRatio);

  const stitched = await stitchShots({
    accountId: account.id,
    postId,
    shots: aiResumeOnImage
      ? pre.stitchInputs.map((s) => ({ ...s, keywordCards: undefined }))
      : pre.stitchInputs,
    audio: {
      voiceoverUrl: pre.voiceoverUrl ?? undefined,
      musicUrl: pre.musicUrl ?? undefined,
      musicDuckLowVolume: pre.musicDuckLowVolume,
      musicSoloVolume: pre.musicSoloVolume,
      ...(resumeVoLeadIn != null ? { voiceoverLeadInSeconds: resumeVoLeadIn } : {}),
    },
    namesNumbersTitleCard: undefined,
    aspectRatio: pre.aspectRatio,
    colourGrade,
    useGrain: pre.useGrain,
    letterbox: pre.letterbox,
    encodePreset: pre.stitchEncodePreset ?? genCfg.stitchEncodePreset ?? 'balanced',
    targetDurationSeconds: stitchTargetResume,
    perShotSecondsMax: voicePartitionedResume ? undefined : perShotSecondsMax,
    keywordOverlayStyle: aiResumeOnImage ? 'off' : (pre.keywordOverlayStyle ?? 'off'),
    keywordOverlayFontPreset: resumeKeywordKo.fontPreset,
    keywordOverlayFontScale: resumeKeywordKo.fontScale,
    keywordOverlayTextBackground: resumeKeywordKo.textBackground,
    keywordOverlayTextAnchor: resumeKeywordKo.textAnchor,
    onRenderProgress: async (p) => {
      try {
        await db
          .update(personalPosts)
          .set({
            renderProgress: p.percent,
            renderProgressLabel: p.label.slice(0, 500),
            renderActivityLog: [],
            updatedAt: new Date(),
          })
          .where(eq(personalPosts.id, postId));
      } catch {
        /* non-fatal */
      }
    },
    kenBurnsOnStills: pre.kenBurnsOnStills ?? genCfg.kenBurnsOnStills !== false,
  });
  const thumbAlign = await buildPersonalThumbnailShotAlign({
    accountId: account.id,
    characterId: account.characterId ?? null,
    styleBible: (account.styleBible as PersonalAccountStyleBible) ?? null,
    theme,
    storyboard,
    genCfg: genCfg,
  });
  const thumb = await createPersonalPostThumbnail({
    accountId: account.id,
    postId,
    videoUrl: stitched.videoUrl,
    videoDurationSeconds: stitched.durationSeconds,
    aspectRatio: pre.aspectRatio,
    overlayLine: shortThumbnailOverlayLine(storyboard.title ?? '', post.topic ?? ''),
    topic: (post.topic ?? '').trim() || 'Video',
    variationKey: randomUUID(),
    shotAlign: thumbAlign,
  });
  const thumbnailUrl = thumb.url;
  totalCostCents += thumb.costCents;

  const resumeDirectorCaption = composeCaption(storyboard);

  let contentStudioPostId: string | null = null;
  let scheduledAt: Date | null = null;
  let scheduleError: string | null = null;
  const shouldSchedule = shouldSchedulePersonalToContentStudio(genArgs, account);
  if (shouldSchedule) {
    const when = genArgs.scheduledAt
      ? new Date(genArgs.scheduledAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    try {
      const res = await schedulePersonalPostWithRetry(
        {
          platform: account.platform,
          caption: resumeDirectorCaption,
          videoUrl: stitched.videoUrl,
          scheduledAt: when,
          workspaceId: account.contentStudioWorkspaceId ?? undefined,
          contentStudioAccountIds: contentStudioAccountIdsOverride(account),
          ...(isYoutubeAccount(account.platform)
            ? {
                youtubeTitle:
                  storyboard.title?.trim().slice(0, 100) ||
                  post.topic.trim().slice(0, 100) ||
                  undefined,
                youtubeDescription: resumeDirectorCaption,
                ...(pre.extractYoutubeThumbnail === true || longformResume
                  ? {
                      youtubeLongForm: true as const,
                      ...(thumbnailUrl ? { youtubeThumbnailUrl: thumbnailUrl } : {}),
                    }
                  : {}),
              }
            : {}),
        },
        { label: `personal:schedule:resume:${postId}` },
      );
      contentStudioPostId = res.id;
      scheduledAt = when;
    } catch (e) {
      scheduleError = e instanceof Error ? e.message : String(e);
      console.error('[director] schedule failed after retries (resume):', scheduleError);
    }
  }

  const ar = (post.script as Record<string, unknown>)?.outputAspectRatio;
  const aspectRatio: '9:16' | '1:1' | '16:9' | '4:5' =
    ar === '16:9' || ar === '1:1' || ar === '4:5' || ar === '9:16' ? ar : pre.aspectRatio;

  const wantMusicBedResume =
    genCfg.useMusic === false ? false : (genCfg.useMusic ?? theme.useMusic);
  const mUrlResume = (post.musicUrl ?? pre.musicUrl ?? '').trim();
  const customAU = (account.customAudioUrl ?? '').trim();
  let musicSourceResume: 'custom_bed' | 'library' | 'none' = 'none';
  if (mUrlResume) {
    musicSourceResume =
      wantMusicBedResume && customAU && mUrlResume === customAU ? 'custom_bed' : 'library';
  }

  const scriptFinal = withPersonalScheduleIntent(
    {
      ...stripDirectorResumeKeys(storyboard as unknown as Record<string, unknown>),
      outputAspectRatio: aspectRatio,
      generationInfo: buildDirectorGenerationInfo({
        genConfig: genCfg,
        account,
        character: null,
        longformEnabled: longformResume,
        longformAnimationStyle: genCfg.longformAnimationStyle,
        musicAttribution: post.musicAttribution,
        musicSource: musicSourceResume,
        themeTemplate: theme.template,
        totalCostCents,
        pickImageModelForLongform,
      }),
    },
    scheduledAt ? null : buildPersonalScheduleIntent(genArgs, account),
  );

  await db
    .update(personalPosts)
    .set({
      videoUrl: stitched.videoUrl,
      thumbnailUrl: thumbnailUrl ?? null,
      durationSeconds: Math.max(1, Math.round(stitched.durationSeconds)),
      caption: resumeDirectorCaption,
      hashtags: storyboard.hashtags ?? theme.defaultHashtags,
      contentStudioPostId,
      scheduledAt,
      status: scheduledAt ? 'scheduled' : 'ready',
      errorMessage: scheduleError ? scheduleError.slice(0, 500) : null,
      costCents: totalCostCents,
      postKind: 'video',
      renderProgress: null,
      renderProgressLabel: null,
      renderActivityLog: [],
      script: scriptFinal as any,
      updatedAt: new Date(),
    })
    .where(eq(personalPosts.id, postId));

  await db
    .update(personalAccounts)
    .set({
      lastGeneratedAt: new Date(),
      totalPosts: (account.totalPosts ?? 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(personalAccounts.id, account.id));

  const resumeTopic = (post.topic ?? '').trim() || 'Video';
  if (scheduleError) {
    try {
      await maybeEmailPersonalPostFailed({
        accountId: account.id,
        postId,
        topic: resumeTopic,
        error: `ContentStudio schedule failed: ${scheduleError}`,
        includeSaveLink: true,
      });
    } catch (e) {
      console.warn('[personal] failure email:', (e as Error).message);
    }
    if (genArgs.fromScheduleAutopilot) {
      try {
        await maybeEmailPersonalVideoReady({
          accountId: account.id,
          postId,
          videoUrl: stitched.videoUrl,
          topic: resumeTopic,
          captionPreview: resumeDirectorCaption,
          force: true,
        });
      } catch (e) {
        console.warn('[personal] video delivery email:', (e as Error).message);
      }
    }
  } else {
    try {
      await maybeEmailPersonalVideoReady({
        accountId: account.id,
        postId,
        videoUrl: stitched.videoUrl,
        topic: resumeTopic,
        captionPreview: resumeDirectorCaption,
        force: genArgs.fromScheduleAutopilot === true,
      });
    } catch (e) {
      console.warn('[personal] video delivery email:', (e as Error).message);
    }
  }

  broadcast({
    type: 'personal:progress',
    payload: { accountId: account.id, postId, phase: 'done:director', videoUrl: stitched.videoUrl },
  });

  return {
    postId,
    videoUrl: stitched.videoUrl,
    status: scheduledAt ? 'scheduled' : 'ready',
    durationSeconds: stitched.durationSeconds,
    costCents: totalCostCents,
  };
}

export function parsePreStitchCheckpoint(script: unknown): PreStitchCheckpoint | null {
  const raw = script as Record<string, unknown> | null;
  const ck = raw?.[CK_PRE] as PreStitchCheckpoint | undefined;
  if (!ck || ck.v !== 1 || ck.phase !== 'pre_stitch') return null;
  if (!Array.isArray(ck.stitchInputs) || ck.stitchInputs.length < 1) return null;
  return ck;
}

export function parseSourcingCheckpointByShotId(
  script: unknown,
): Record<string, { url: string; kind: 'image' | 'video'; costCents: number }> | undefined {
  const raw = script as Record<string, unknown> | null;
  const ck = raw?.[CK_SRC] as { v?: number; byShotId?: Record<string, { url: string; kind: string; costCents: number }> };
  if (!ck || ck.v !== 1 || !ck.byShotId || typeof ck.byShotId !== 'object') return undefined;
  const out: Record<string, { url: string; kind: 'image' | 'video'; costCents: number }> = {};
  for (const [id, row] of Object.entries(ck.byShotId)) {
    if (!row?.url || (row.kind !== 'image' && row.kind !== 'video')) continue;
    out[id] = { url: row.url, kind: row.kind, costCents: row.costCents ?? 0 };
  }
  return Object.keys(out).length ? out : undefined;
}

export function hasDirectorStoryboard(script: unknown): boolean {
  const s = script as Record<string, unknown> | null;
  return Boolean(s && typeof s.editPlan === 'object' && s.editPlan !== null);
}
