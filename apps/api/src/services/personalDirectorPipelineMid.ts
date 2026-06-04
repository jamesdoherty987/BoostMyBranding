/**
 * Director pipeline continuation: shot resolution → voice → music → stitch.
 * Extracted so {@link generateForAccountDirector} and boot-time resume can share it.
 */

import { eq } from 'drizzle-orm';
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
  animationStyleHintFor,
  type Storyboard,
} from './personalDirector.js';
import { searchAssets, pickGameplayLoop } from './personalScraper.js';
import { synthesizeVoice, estimateDurationSeconds, joinNarrationParts } from './personalVoice.js';
import { pickMusic } from './personalMusic.js';
import { schedulePost } from './contentStudio.js';
import { broadcast } from './realtime.js';
import { features } from '../env.js';
import {
  contentStudioAccountIdsOverride,
  shouldSchedulePersonalToContentStudio,
} from './personalContentPosting.js';
import { withRetry } from './retry.js';
import { getCharacterAnchorImages, getCharacterUnsafe } from './personalCharacters.js';
import { internalListForPipeline } from './personalAccountMedia.js';
import { personalPostIsFailed } from './personalAccounts.js';
import { buildVisualBrandHintsForShots } from './personalContentHints.js';
import {
  generateAiImage,
  generateAiVideo,
  pickDefaultModel,
} from './personalAiModels.js';
import {
  stitchShots,
  normalizeKeywordCardsForShot,
  type StitchShotInput,
} from './personalStitcher.js';
import { uploadFile } from './r2.js';
import { extractVideoFrameJpeg } from '../lib/extractVideoFrame.js';
import { resolveFfmpegBin } from '../lib/ffmpegBin.js';
import type { GenerateForAccountArgs, GenerateForAccountResult } from './personalPipeline.js';

const CK_PRE = '__pipelineCheckpoint' as const;
const CK_SRC = '__sourcingCheckpoint' as const;

const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv|m4v|avi)(\?|#|$)/i;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|avif|bmp|heic)(\?|#|$)/i;

function isVideoUrlByExtension(url: string): boolean {
  return VIDEO_EXT_RE.test(url);
}

function isImageUrlByExtension(url: string): boolean {
  return IMAGE_EXT_RE.test(url);
}

function classifyInspirationMedia(
  mimeType: string | null | undefined,
  url: string,
): 'image' | 'video' | 'unknown' {
  const m = (mimeType ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (isImageUrlByExtension(url)) return 'image';
  if (isVideoUrlByExtension(url)) return 'video';
  return 'unknown';
}

/**
 * Inspiration / style_reference rows → image URLs usable by img2img + img2vid
 * (one representative frame per video clip, uploaded to object storage).
 */
async function buildResolvedStyleReferenceImageUrls(
  accountId: string,
  inspirationRows: AccountMediaRow[],
): Promise<string[]> {
  const rows = inspirationRows.slice(0, 8);
  const ffmpegBin = await resolveFfmpegBin();
  const out: string[] = [];
  let videoExtractions = 0;
  const maxVideoFrames = 4;
  let loggedMissingFfmpeg = false;

  for (const m of rows) {
    const url = m.fileUrl?.trim();
    if (!url) continue;

    const kind = classifyInspirationMedia(m.mimeType, url);

    if (kind === 'image') {
      out.push(url);
      continue;
    }

    if (kind === 'video') {
      if (!ffmpegBin) {
        if (!loggedMissingFfmpeg) {
          console.warn('[director] ffmpeg unavailable — inspiration videos skipped for pixel refs');
          loggedMissingFfmpeg = true;
        }
        continue;
      }
      if (videoExtractions >= maxVideoFrames) continue;
      try {
        const jpeg = await extractVideoFrameJpeg({
          ffmpegBin,
          videoInput: url,
          atSeconds: 1,
        });
        const { url: uploaded } = await uploadFile(
          `personal/${accountId}/inspiration-frames`,
          jpeg,
          `${m.id}-insp-ref.jpg`,
          'image/jpeg',
        );
        out.push(uploaded);
        videoExtractions++;
      } catch (e) {
        console.warn('[director] inspiration video frame extract failed', m.id, (e as Error).message);
      }
      continue;
    }

    // Unknown mime/extension — assume a still URL the image stack can fetch.
    out.push(url);
  }

  return [...new Set(out)].slice(0, 8);
}

export function stripDirectorResumeKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const o = { ...raw };
  delete o[CK_PRE];
  delete o[CK_SRC];
  return o;
}

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

async function tryExtractYoutubeThumbnail(params: {
  accountId: string;
  postId: string;
  videoUrl: string;
}): Promise<string | null> {
  try {
    const ffmpegBin = await resolveFfmpegBin();
    if (!ffmpegBin) return null;
    const jpeg = await extractVideoFrameJpeg({
      ffmpegBin,
      videoInput: params.videoUrl,
      atSeconds: 3,
    });
    const { url } = await uploadFile(
      `personal/${params.accountId}/thumbnails`,
      jpeg,
      `${params.postId}-yt-thumb.jpg`,
      'image/jpeg',
    );
    return url;
  } catch (e) {
    console.warn('[director] YouTube thumbnail extract failed:', (e as Error).message);
    return null;
  }
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
    storyboard,
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

  const characterAnchors = character ? await getCharacterAnchorImages(character.id, 3) : [];

  const resolvedStyleRefImageUrls = await buildResolvedStyleReferenceImageUrls(account.id, inspirationItems);
  const inspirationPixelContract =
    resolvedStyleRefImageUrls.length > 0
      ? 'Match palette, lighting, lens/codec character, grain, and motion energy of the account reference stills (including frames extracted from reference videos).'
      : '';
  const inspirationStyleHintForShots = [inspirationStyleHint, inspirationPixelContract]
    .filter((s) => s && s.length > 0)
    .join(' ')
    .slice(0, 520);

  const defaultImageModel =
    genConfig.imageModelId ??
    pickImageModelForLongform(
      longformEnabled ? longformAnimationStyle : undefined,
      genConfig.qualityTier ?? 'balanced',
    );
  const defaultVideoModel =
    genConfig.videoModelId ?? pickDefaultModel('video', genConfig.qualityTier ?? 'balanced')?.id;

  const flat = flattenStoryboard(storyboard);
  const stitchMusicDuck =
    typeof genConfig.musicDuckUnderVoice === 'number' && Number.isFinite(genConfig.musicDuckUnderVoice)
      ? Math.min(0.55, Math.max(0.05, genConfig.musicDuckUnderVoice))
      : undefined;
  const stitchMusicSolo =
    typeof genConfig.musicSoloVolume === 'number' && Number.isFinite(genConfig.musicSoloVolume)
      ? Math.min(0.85, Math.max(0.1, genConfig.musicSoloVolume))
      : undefined;
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

  const sourcingByShotId: Record<string, { url: string; kind: 'image' | 'video'; costCents: number }> = {
    ...(resumedShotById ?? {}),
  };

  let totalCostCents = initialCostCents;
  for (const v of Object.values(sourcingByShotId)) {
    totalCostCents += v.costCents;
  }

  let flushChain = Promise.resolve();
  const flushSourcingCheckpointThrottled = () => {
    flushChain = flushChain.then(async () => {
      const scriptBase = stripDirectorResumeKeys(storyboard as unknown as Record<string, unknown>);
      await db
        .update(personalPosts)
        .set({
          script: {
            ...scriptBase,
            outputAspectRatio: aspectRatio,
            [CK_SRC]: { v: 1, byShotId: sourcingByShotId },
          } as any,
          updatedAt: new Date(),
        })
        .where(eq(personalPosts.id, postId));
    });
    return flushChain;
  };

  const generateShotAsset = async (
    fs: (typeof flat)[number],
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
      return {
        fs,
        asset: { url: cached.url, kind: cached.kind },
        costCents: 0,
        fromCache: true,
      };
    }

    const prompt = shotToPrompt({
      shot: fs.shot,
      themeVisualStyle: theme.visualStyle,
      styleBibleVibe: styleBible.vibe ?? undefined,
      characterFragment: character?.promptFragment ?? undefined,
      globalColourGrade: storyboard.editPlan.colourGrade,
      inspirationStyleHint: inspirationStyleHintForShots || undefined,
      animationStyleHint,
      shotBrandHints,
    });
    const negativePrompt = [
      ...(styleBible.donts ?? []),
      ...(character?.negativePrompt ? [character.negativePrompt] : []),
    ]
      .filter(Boolean)
      .join(', ');

    const refs = longformEnabled
      ? [...characterAnchors.slice(0, 3), ...resolvedStyleRefImageUrls.slice(0, 3)].slice(0, 6)
      : [...characterAnchors.slice(0, 2), ...resolvedStyleRefImageUrls.slice(0, 4)];

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
      if (effectiveKind === 'ai_video' && defaultVideoModel && features.fal) {
        const video = await withRetry(
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
        );
        asset = { url: video.url, kind: 'video' };
        shotCost = video.costCents;
      } else if (
        effectiveKind === 'scraped_video' ||
        effectiveKind === 'scraped_image' ||
        effectiveKind === 'b_roll'
      ) {
        const { items } = await searchAssets({
          query: fs.shot.imageQuery ?? fs.shot.description ?? topic,
          sources: theme.mediaSources.filter(
            (s): s is 'pexels' | 'unsplash' | 'pixabay' | 'wikipedia' | 'news' =>
              s !== 'ai' && s !== 'gameplay',
          ),
          count: 3,
          preferVideo:
            genConfig.mediaPreference === 'video_only' ||
            ((effectiveKind === 'scraped_video' || effectiveKind === 'b_roll') &&
              genConfig.mediaPreference !== 'stills_only'),
        });
        if (items.length > 0) {
          const pick = items[0]!;
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
        const image = await withRetry(
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
        );
        asset = { url: image.url, kind: 'image' };
        shotCost = image.costCents;
      }
    } catch (e) {
      error = (e as Error).message;
      console.warn(`[director] shot ${fs.shot.id} failed:`, error);
    }

    return { fs, asset, costCents: shotCost, error, fromCache: false };
  };

  const concurrency = 2;
  const shotResultsOrdered: Array<Awaited<ReturnType<typeof generateShotAsset>>> = new Array(flat.length);
  let completed = 0;
  let nextIdx = 0;
  let sinceFlush = 0;
  const workers: Promise<void>[] = [];
  const worker = async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= flat.length) return;
      const result = await generateShotAsset(flat[idx]!);
      shotResultsOrdered[idx] = result;
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
        await flushSourcingCheckpointThrottled();
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
  let voiceoverUrl: string | null = null;
  let estimatedDuration = resolved.reduce((acc, r) => acc + r.fs.shot.durationSeconds, 0);
  if (useVoiceover) {
    broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'voicing' } });
    const narration = joinNarrationParts([
      storyboard.hook,
      ...resolved.map((r) => r.fs.shot.voiceover),
      storyboard.outro,
    ]);
    if (narration.length > 0) {
      const voice = await synthesizeVoice({
        text: narration,
        voiceId:
          genConfig.ttsVoiceId ?? character?.voiceId ?? account.voiceId ?? 'default',
        voiceAccent: genConfig.voiceAccent,
        voiceGender: genConfig.voiceGender,
        language: account.language,
        accountId: account.id,
        speed: Math.min(1.2, Math.max(0.7, genConfig.ttsSpeed ?? 1)),
        providerPreference: genConfig.ttsProvider,
      });
      voiceoverUrl = voice.audioUrl;
      estimatedDuration = Math.max(estimatedDuration, voice.durationSeconds);
      totalCostCents += voice.costCents;
    }
  } else {
    const onScreenText = [
      storyboard.hook,
      ...resolved.map((r) => r.fs.shot.onScreen).filter(Boolean),
      storyboard.outro,
    ].join(' ');
    if (onScreenText.length > 0) {
      estimatedDuration = Math.max(estimatedDuration, estimateDurationSeconds(onScreenText));
    }
  }

  let musicUrl: string | null = null;
  let musicAttribution: string | null = null;
  const wantMusicBed =
    genConfig.useMusic === false ? false : (genConfig.useMusic ?? theme.useMusic);
  if (wantMusicBed && account.customAudioUrl) {
    musicUrl = account.customAudioUrl;
    musicAttribution = account.customAudioAttribution ?? null;
  } else if (wantMusicBed) {
    const minMusicSeconds = longformEnabled
      ? Math.min(480, Math.max(60, Math.ceil(estimatedDuration)))
      : Math.ceil(estimatedDuration);
    const music = await pickMusic({
      mood: theme.musicMood,
      seed: postId,
      minDurationSeconds: minMusicSeconds,
      accountId: account.id,
    }).catch(() => null);
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

  const keywordOverlayStyle: 'off' | 'subtle' | 'bold' =
    genConfig.keywordPopStyle === 'bold' || genConfig.keywordPopStyle === 'subtle'
      ? genConfig.keywordPopStyle
      : 'off';
  const isYoutube = isYoutubeAccount(account.platform);
  const extractYoutubeThumbnail = Boolean(longformEnabled && isYoutube);

  const stitchInputs: StitchShotInput[] = resolved.map((r) => ({
    url: r.asset.url,
    kind: r.asset.kind,
    durationSeconds: r.fs.shot.durationSeconds,
    transitionOut: r.fs.shot.transitionOut,
    speedRamp: r.fs.shot.speedRamp,
    focalX: r.fs.shot.focalX,
    focalY: r.fs.shot.focalY,
    keywordCards:
      keywordOverlayStyle !== 'off'
        ? normalizeKeywordCardsForShot(r.fs.shot.keywordCards, r.fs.shot.durationSeconds)
        : undefined,
    persistentCaption:
      genConfig.allowSparseImageText === true && r.fs.shot.imageCaption
        ? String(r.fs.shot.imageCaption).trim().slice(0, 80) || undefined
        : undefined,
  }));

  const shotSum = stitchInputs.reduce((a, s) => a + s.durationSeconds, 0);
  let stitchTarget: number | undefined;
  if (longformEnabled) {
    stitchTarget = Math.max(longformTargetSeconds ?? 0, estimatedDuration, shotSum);
  } else if (useVoiceover && estimatedDuration > shotSum + 1) {
    stitchTarget = estimatedDuration;
  }

  const look = stitchFinalLook(genConfig, storyboard);

  const preStitchCk = {
    v: 1 as const,
    phase: 'pre_stitch' as const,
    stitchInputs,
    stitchTarget,
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
  };

  const scriptForRow = {
    ...stripDirectorResumeKeys(storyboard as unknown as Record<string, unknown>),
    outputAspectRatio: aspectRatio,
    [CK_PRE]: preStitchCk,
  };

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
      mediaAssets: resolved.map((r) => ({
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
        durationSeconds: r.fs.shot.durationSeconds,
      })),
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

  const stitched = await stitchShots({
    accountId: account.id,
    postId,
    shots: stitchInputs,
    audio: {
      voiceoverUrl: voiceoverUrl ?? undefined,
      musicUrl: musicUrl ?? undefined,
      musicDuckLowVolume: stitchMusicDuck,
      musicSoloVolume: stitchMusicSolo,
    },
    aspectRatio: aspectRatio,
    colourGrade: look.colourGrade,
    useGrain: look.useGrain,
    letterbox: look.letterbox,
    encodePreset: genConfig.stitchEncodePreset ?? 'balanced',
    targetDurationSeconds: stitchTarget,
    keywordOverlayStyle,
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
  });
  totalCostCents += 3;

  let thumbnailUrl: string | null = null;
  if (extractYoutubeThumbnail) {
    thumbnailUrl = await tryExtractYoutubeThumbnail({
      accountId: account.id,
      postId,
      videoUrl: stitched.videoUrl,
    });
  }

  let contentStudioPostId: string | null = null;
  let scheduledAt: Date | null = null;
  const shouldSchedule = shouldSchedulePersonalToContentStudio(args, account);
  if (shouldSchedule) {
    const when = args.scheduledAt
      ? new Date(args.scheduledAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    try {
      const res = await schedulePost({
        platform: account.platform,
        caption: composeCaption(storyboard),
        videoUrl: stitched.videoUrl,
        scheduledAt: when,
        workspaceId: account.contentStudioWorkspaceId ?? undefined,
        contentStudioAccountIds: contentStudioAccountIdsOverride(account),
        ...(longformEnabled && isYoutube
          ? {
              youtubeTitle:
                storyboard.title?.trim().slice(0, 100) || topic.trim().slice(0, 100) || undefined,
              youtubeLongForm: true,
              ...(thumbnailUrl ? { youtubeThumbnailUrl: thumbnailUrl } : {}),
            }
          : {}),
      });
      contentStudioPostId = res.id;
      scheduledAt = when;
    } catch (e) {
      console.warn('[director] schedule failed:', (e as Error).message);
    }
  }

  const scriptFinal = {
    ...stripDirectorResumeKeys(storyboard as unknown as Record<string, unknown>),
    outputAspectRatio: aspectRatio,
  };

  await db
    .update(personalPosts)
    .set({
      videoUrl: stitched.videoUrl,
      thumbnailUrl: thumbnailUrl ?? null,
      durationSeconds: Math.round(stitched.durationSeconds),
      caption: composeCaption(storyboard),
      hashtags: storyboard.hashtags ?? theme.defaultHashtags,
      contentStudioPostId,
      scheduledAt,
      status: scheduledAt ? 'scheduled' : 'ready',
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
  /** Keyword / caption overlay style for {@link stitchShots}. */
  keywordOverlayStyle?: 'off' | 'subtle' | 'bold';
  /** When true, resume path extracts a YouTube JPEG thumb after stitch. */
  extractYoutubeThumbnail?: boolean;
  /** FFmpeg encode tier used for this run (resume uses checkpoint value when set). */
  stitchEncodePreset?: 'fast' | 'balanced' | 'high';
  /** Ken Burns on stills — persisted for resume stitch. */
  kenBurnsOnStills?: boolean;
};

/**
 * Resume only the FFmpeg stitch + schedule + final persist after a process
 * restart (checkpoint was written before stitch began).
 */
export async function finishDirectorFromPreStitchCheckpoint(
  post: typeof personalPosts.$inferSelect,
  account: typeof personalAccounts.$inferSelect,
  theme: PersonalTheme,
  genArgs: GenerateForAccountArgs,
  pre: PreStitchCheckpoint,
): Promise<GenerateForAccountResult> {
  const db = getDb();
  const postId = post.id;
  const storyboard = stripDirectorResumeKeys(post.script as Record<string, unknown>) as unknown as Storyboard;

  let totalCostCents = pre.totalCostCentsBeforeStitch + 3;

  broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'stitching' } });

  const genCfg = (account.generatorConfig as PersonalGeneratorConfig) ?? {};
  const colourGrade =
    pre.stitchColourGrade ??
    genCfg.colourGrade ??
    mapGrade(storyboard.editPlan.colourGrade);

  const stitched = await stitchShots({
    accountId: account.id,
    postId,
    shots: pre.stitchInputs,
    audio: {
      voiceoverUrl: pre.voiceoverUrl ?? undefined,
      musicUrl: pre.musicUrl ?? undefined,
      musicDuckLowVolume: pre.musicDuckLowVolume,
      musicSoloVolume: pre.musicSoloVolume,
    },
    aspectRatio: pre.aspectRatio,
    colourGrade,
    useGrain: pre.useGrain,
    letterbox: pre.letterbox,
    encodePreset: pre.stitchEncodePreset ?? genCfg.stitchEncodePreset ?? 'balanced',
    targetDurationSeconds: pre.stitchTarget,
    keywordOverlayStyle: pre.keywordOverlayStyle ?? 'off',
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
  let thumbnailUrl: string | null = null;
  if (pre.extractYoutubeThumbnail) {
    thumbnailUrl = await tryExtractYoutubeThumbnail({
      accountId: account.id,
      postId,
      videoUrl: stitched.videoUrl,
    });
  }

  let contentStudioPostId: string | null = null;
  let scheduledAt: Date | null = null;
  const shouldSchedule = shouldSchedulePersonalToContentStudio(genArgs, account);
  if (shouldSchedule) {
    const when = genArgs.scheduledAt
      ? new Date(genArgs.scheduledAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    try {
      const res = await schedulePost({
        platform: account.platform,
        caption: composeCaption(storyboard),
        videoUrl: stitched.videoUrl,
        scheduledAt: when,
        workspaceId: account.contentStudioWorkspaceId ?? undefined,
        contentStudioAccountIds: contentStudioAccountIdsOverride(account),
        ...(pre.extractYoutubeThumbnail === true && isYoutubeAccount(account.platform)
          ? {
              youtubeTitle:
                storyboard.title?.trim().slice(0, 100) ||
                post.topic.trim().slice(0, 100) ||
                undefined,
              youtubeLongForm: true,
              ...(thumbnailUrl ? { youtubeThumbnailUrl: thumbnailUrl } : {}),
            }
          : {}),
      });
      contentStudioPostId = res.id;
      scheduledAt = when;
    } catch (e) {
      console.warn('[director] schedule failed (resume):', (e as Error).message);
    }
  }

  const ar = (post.script as Record<string, unknown>)?.outputAspectRatio;
  const aspectRatio: '9:16' | '1:1' | '16:9' | '4:5' =
    ar === '16:9' || ar === '1:1' || ar === '4:5' || ar === '9:16' ? ar : pre.aspectRatio;

  const scriptFinal = {
    ...stripDirectorResumeKeys(storyboard as unknown as Record<string, unknown>),
    outputAspectRatio: aspectRatio,
  };

  await db
    .update(personalPosts)
    .set({
      videoUrl: stitched.videoUrl,
      thumbnailUrl: thumbnailUrl ?? null,
      durationSeconds: Math.round(stitched.durationSeconds),
      caption: composeCaption(storyboard),
      hashtags: storyboard.hashtags ?? theme.defaultHashtags,
      contentStudioPostId,
      scheduledAt,
      status: scheduledAt ? 'scheduled' : 'ready',
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
