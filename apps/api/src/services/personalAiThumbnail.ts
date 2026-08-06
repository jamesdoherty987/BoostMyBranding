/**
 * Personal post thumbnails: same stack as director AI stills — `shotToPrompt`,
 * account inspiration reference URLs, and the same image model selection — plus
 * a light FFmpeg scale/pad to a consistent JPEG size for cards / YouTube.
 */

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PersonalAccountStyleBible, PersonalGeneratorConfig } from '@boost/database';
import type { PersonalTheme } from './personalThemes.js';
import { internalListForPipeline } from './personalAccountMedia.js';
import { getCharacterAnchorImages, getCharacterUnsafe } from './personalCharacters.js';
import { resolvePersonalInspirationImageUrls } from './personalInspirationRefs.js';
import { buildVisualBrandHintsForShots } from './personalContentHints.js';
import {
  shotToPrompt,
  personalThumbnailCoverShot,
  animationStyleHintFor,
  type Storyboard,
} from './personalDirector.js';
import {
  generateAiImage,
  getAiModel,
  pickDefaultModel,
  pickImageModelForLongform,
} from './personalAiModels.js';
import { uploadFile } from './r2.js';
import { resolveFfmpegBin } from '../lib/ffmpegBin.js';
import { extractPersonalVideoPosterToR2 } from './personalVideoThumbnail.js';

function thumbDims(ar: '9:16' | '1:1' | '16:9' | '4:5'): { width: number; height: number } {
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

async function runFfmpeg(ffmpegBin: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr?.on('data', (d) => {
      err += d.toString();
    });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${err.slice(0, 500)}`));
    });
  });
}

const OVERLAY_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'in',
  'on',
  'to',
  'for',
  'with',
  'from',
  'at',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'this',
  'that',
  'how',
  'why',
  'what',
  'when',
  'where',
  'your',
  'you',
  'my',
  'our',
  'its',
  'vs',
  'vs.',
  'into',
  'about',
  'over',
  'under',
  'video',
  'episode',
  'part',
  'guide',
  'ultimate',
  'needs',
  'need',
  'make',
  'makes',
  'get',
  'gets',
  'using',
  'use',
  'used',
  'really',
  'just',
  'also',
  'right',
  'now',
  'today',
  'tried',
  'try',
  'i',
]);

/**
 * Punchy 1–3 word cover hook for on-image type — short enough to read at
 * thumbnail size. Prefer title; fall back to topic. Never dumps a full sentence.
 */
export function shortThumbnailOverlayLine(title: string, topic: string): string {
  const raw = ((title || '').trim() || (topic || '').trim() || 'Watch')
    .replace(/\s+/g, ' ')
    .replace(/["""''`]/g, '')
    .replace(/[:|;•·]+/g, ' ')
    .trim();

  const words = raw
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9$%]+|[^A-Za-z0-9$%!?.]+$/g, ''))
    .filter((w) => w.length > 0);

  if (words.length === 0) return 'Watch';

  const meaningful = words.filter((w) => !OVERLAY_STOPWORDS.has(w.toLowerCase()));
  const pool = meaningful.length > 0 ? meaningful : words;

  // Prefer a number + noun when present (e.g. "10 Tips", "$100 Steak").
  // Skip bare years — they make weak hooks ("2024 Routine").
  const numIdx = pool.findIndex(
    (w) => (/^\d/.test(w) || /^\$/.test(w)) && !/^(19|20)\d{2}$/.test(w),
  );
  let candidate: string[];
  if (numIdx >= 0) {
    const num = pool[numIdx]!;
    const noun = pool[numIdx + 1] ?? pool[numIdx - 1] ?? pool.find((w, i) => i !== numIdx);
    candidate = noun ? [num, noun] : [num];
  } else if (pool.length <= 3) {
    candidate = pool.filter((w) => !/^(19|20)\d{2}$/.test(w));
    if (candidate.length === 0) candidate = pool;
  } else {
    // Trailing nouns are usually the topic ("…Better Thumbnails", "…Morning Routine").
    candidate = pool.filter((w) => !/^(19|20)\d{2}$/.test(w)).slice(-2);
    if (candidate.length === 0) candidate = pool.slice(-2);
  }

  const maxChars = 20;
  let line = candidate.join(' ');
  while (candidate.length > 1 && line.length > maxChars) {
    candidate = candidate.slice(1);
    line = candidate.join(' ');
  }
  if (line.length > maxChars) line = line.slice(0, maxChars).trim();
  if (!line) line = raw.slice(0, Math.min(16, raw.length)).trim() || 'Watch';

  return line
    .split(/\s+/)
    .map((w) => {
      if (/^[A-Z0-9$%!.?-]+$/.test(w) && /[A-Z]/.test(w)) return w;
      if (/^\d/.test(w) || /^\$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

export type PersonalThumbnailAlign = {
  themeVisualStyle: string;
  styleBible: PersonalAccountStyleBible | null;
  characterFragment?: string | null;
  characterNegative?: string | null;
  globalColourGrade?: string | null;
  inspirationStyleHintForShots?: string | null;
  animationStyleHint?: string | null;
  shotBrandHints?: string | null;
  referenceImageUrls: string[];
  longformEnabled: boolean;
  themeRequiresGroundedImages: boolean;
  /** Same rule as director `defaultImageModel`. */
  imageModelId: string | undefined;
  qualityTier: 'max' | 'balanced' | 'budget';
};

/**
 * Loads inspiration + character anchors and builds the same reference URL list
 * and style hints as {@link directorPipelineFromResolvedStoryboard} uses per shot.
 */
export async function buildPersonalThumbnailShotAlign(args: {
  accountId: string;
  characterId: string | null;
  styleBible: PersonalAccountStyleBible | null;
  theme: PersonalTheme;
  storyboard: Storyboard;
  genCfg: PersonalGeneratorConfig;
}): Promise<PersonalThumbnailAlign> {
  const rows = await internalListForPipeline(args.accountId);
  const inspirationItems = rows.filter((m) => m.role === 'inspiration' || m.role === 'style_reference');
  const inspirationStyleHint = inspirationItems.length
    ? inspirationItems
        .slice(0, 4)
        .map((m) => m.description ?? m.aiDescription ?? '')
        .filter((s) => s && s.length > 0)
        .join('; ')
        .slice(0, 400)
    : undefined;

  const resolvedStyleRefImageUrls = await resolvePersonalInspirationImageUrls(
    args.accountId,
    inspirationItems,
  );

  const character = args.characterId ? await getCharacterUnsafe(args.characterId) : null;
  const characterAnchors = character ? await getCharacterAnchorImages(character.id, 3) : [];

  const inspirationPixelContract =
    resolvedStyleRefImageUrls.length > 0
      ? 'Match palette, lighting, lens/codec character, grain, and motion energy of the account reference stills (including frames extracted from reference videos).'
      : undefined;
  const inspirationStyleHintForShots = [inspirationStyleHint, inspirationPixelContract]
    .filter((s) => s && s.length > 0)
    .join(' ')
    .slice(0, 520);

  const longformEnabled =
    args.genCfg.longformEnabled === true || args.theme.template === 'animated-explainer';
  const longformAnimationStyle = longformEnabled ? ('custom' as const) : undefined;
  const animationStyleHint = longformEnabled
    ? animationStyleHintFor(longformAnimationStyle ?? 'custom')
    : undefined;
  const shotBrandHints = buildVisualBrandHintsForShots(args.styleBible ?? undefined);

  const refs = longformEnabled
    ? [...characterAnchors.slice(0, 3), ...resolvedStyleRefImageUrls.slice(0, 3)].slice(0, 6)
    : [...characterAnchors.slice(0, 2), ...resolvedStyleRefImageUrls.slice(0, 4)];

  const imageModelId =
    args.genCfg.imageModelId?.trim() ||
    pickImageModelForLongform(longformAnimationStyle, args.genCfg.qualityTier ?? 'balanced');

  return {
    themeVisualStyle: args.theme.visualStyle,
    styleBible: args.styleBible,
    characterFragment: character?.promptFragment ?? undefined,
    characterNegative: character?.negativePrompt ?? undefined,
    globalColourGrade: args.storyboard.editPlan?.colourGrade,
    inspirationStyleHintForShots: inspirationStyleHintForShots || undefined,
    animationStyleHint,
    shotBrandHints,
    referenceImageUrls: refs,
    longformEnabled,
    themeRequiresGroundedImages: args.theme.requiresGroundedImages === true,
    imageModelId,
    qualityTier: args.genCfg.qualityTier ?? 'balanced',
  };
}

export interface CreatePersonalPostThumbnailResult {
  url: string | null;
  /** Image generation cost when AI path ran (0 if frame fallback). */
  costCents: number;
}

/**
 * AI thumbnail aligned to director shots; falls back to a single video frame JPEG.
 */
export async function createPersonalPostThumbnail(args: {
  accountId: string;
  postId: string;
  videoUrl: string;
  videoDurationSeconds?: number;
  aspectRatio: '9:16' | '1:1' | '16:9' | '4:5';
  topic: string;
  variationKey: string;
  overlayLine: string;
  shotAlign: PersonalThumbnailAlign;
}): Promise<CreatePersonalPostThumbnailResult> {
  const ai = await generatePersonalAiThumbnailToR2(args);
  if (ai?.url) {
    return { url: ai.url, costCents: ai.costCents };
  }
  const url = await extractPersonalVideoPosterToR2({
    accountId: args.accountId,
    postId: args.postId,
    videoUrl: args.videoUrl,
    videoDurationSeconds: args.videoDurationSeconds,
  });
  return { url, costCents: 0 };
}

async function generatePersonalAiThumbnailToR2(args: {
  accountId: string;
  postId: string;
  aspectRatio: '9:16' | '1:1' | '16:9' | '4:5';
  overlayLine: string;
  topic: string;
  variationKey: string;
  shotAlign: PersonalThumbnailAlign;
}): Promise<{ url: string; costCents: number } | null> {
  if (args.shotAlign.themeRequiresGroundedImages) {
    return null;
  }

  const topicLine = args.topic.trim() || 'Video';
  const line = args.overlayLine.replace(/\s+/g, ' ').trim().slice(0, 20);
  // Short punchy hooks only — skip cover text if somehow still long.
  const useCoverText = line.length >= 2 && line.length <= 20 && line.split(/\s+/).length <= 3;

  const shot = personalThumbnailCoverShot({
    topic: topicLine,
    coverText: useCoverText ? line : undefined,
    variationKey: args.variationKey,
  });

  const sb = args.shotAlign.styleBible;
  const prompt = shotToPrompt({
    shot,
    themeVisualStyle: args.shotAlign.themeVisualStyle,
    styleBibleVibe: sb?.vibe ?? undefined,
    characterFragment: args.shotAlign.characterFragment ?? undefined,
    globalColourGrade: args.shotAlign.globalColourGrade ?? undefined,
    inspirationStyleHint: args.shotAlign.inspirationStyleHintForShots ?? undefined,
    animationStyleHint: args.shotAlign.animationStyleHint ?? undefined,
    shotBrandHints: args.shotAlign.shotBrandHints ?? undefined,
    thumbnailCoverMode: true,
    thumbnailVariationKey: args.variationKey,
  });

  const negativePrompt = [
    'blurry',
    'low resolution',
    'pixelated',
    'noisy',
    'jpeg artifacts',
    'watermark',
    'stock photo watermark',
    'logo spam',
    'busy collage',
    'multiple competing subjects',
    'cluttered background',
    'wall of text',
    'paragraphs of text',
    'subtitles',
    'tiny unreadable text',
    'hashtags',
    'url',
    'extra slogans',
    'deformed hands',
    'extra fingers',
    'duplicate faces',
    'mangled anatomy',
    ...(sb?.donts ?? []),
    ...(args.shotAlign.characterNegative ? [args.shotAlign.characterNegative] : []),
  ]
    .filter(Boolean)
    .join(', ');

  // Prefer the account image model; otherwise bias thumbnails toward max quality.
  const tier = args.shotAlign.qualityTier ?? 'balanced';
  const preferredId = args.shotAlign.imageModelId?.trim();
  const preferred = preferredId ? getAiModel(preferredId) : undefined;
  const thumbTier: 'max' | 'balanced' | 'budget' =
    preferred?.available && preferred.kind === 'image'
      ? tier
      : tier === 'budget'
        ? 'balanced'
        : 'max';
  const modelId =
    preferred?.available && preferred.kind === 'image'
      ? preferred.id
      : pickDefaultModel('image', thumbTier)?.id;
  if (!modelId) return null;

  let bgUrl: string;
  let costCents: number;
  try {
    const gen = await generateAiImage({
      modelId,
      prompt,
      negativePrompt: negativePrompt || undefined,
      aspectRatio: args.aspectRatio,
      referenceImageUrls:
        args.shotAlign.referenceImageUrls.length > 0 ? args.shotAlign.referenceImageUrls : undefined,
      scopePath: `personal/${args.accountId}/thumbnails`,
    });
    bgUrl = gen.url;
    costCents = gen.costCents;
  } catch (e) {
    console.warn('[personal] AI thumbnail image failed:', (e as Error).message);
    return null;
  }

  const ffmpegBin = await resolveFfmpegBin();
  if (!ffmpegBin) {
    console.warn('[personal] AI thumbnail compose skipped: ffmpeg missing');
    return null;
  }

  const { width, height } = thumbDims(args.aspectRatio);
  const workDir = path.join(tmpdir(), `aithumb-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });
  const bgPath = path.join(workDir, 'bg.bin');
  const outPath = path.join(workDir, 'out.jpg');
  const vfScalePad = [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
  ].join(',');

  try {
    const buf = Buffer.from(await (await fetch(bgUrl)).arrayBuffer());
    writeFileSync(bgPath, buf);
    await runFfmpeg(ffmpegBin, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      bgPath,
      '-vf',
      vfScalePad,
      '-frames:v',
      '1',
      '-q:v',
      '1',
      outPath,
    ]);

    if (!existsSync(outPath)) return null;
    const jpeg = readFileSync(outPath);
    const suffix = randomUUID().slice(0, 8);
    const { url } = await uploadFile(
      `personal/${args.accountId}/thumbnails`,
      jpeg,
      `${args.postId}-aithumb-${suffix}.jpg`,
      'image/jpeg',
    );
    return { url, costCents };
  } catch (e) {
    console.warn('[personal] AI thumbnail compose failed:', (e as Error).message);
    return null;
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
