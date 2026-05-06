/**
 * Talking-head / AI UGC video service.
 *
 * Produces a person-on-camera video reading a script — the "influencer
 * shouting about your product" format that drives TikTok/Reels ads.
 *
 * Provider routing:
 *   - fal.ai `veed/avatars`    — default. Pre-built avatars + TTS voices,
 *                                single API call returns a finished mp4.
 *   - fal.ai `veed/lipsync`    — fallback. Takes an uploaded video of a
 *                                real person + audio and re-lipsyncs.
 *
 * Without FAL_KEY we return a deterministic mock video URL so the UI
 * flow works end-to-end in dev.
 */

import { fal } from '@fal-ai/client';
import { env, features } from '../env.js';
import { getModel } from './modelCatalog.js';
import { generateText } from './claude.js';
import { buildBrandContext, brandContextToFactsBlock } from './brandContext.js';
import { listProfiles, profilesToPromptBlock } from './inspirationProfiles.js';
import { listTonePairs, tonePairsToPromptBlock } from './tonePairs.js';
import { getProduct } from './products.js';

if (features.fal) fal.config({ credentials: env.FAL_KEY });

/* ═══════════════════════════════════════════════════════════════════ */
/* Types                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export interface AvatarOption {
  id: string;
  displayName: string;
  gender: 'female' | 'male' | 'neutral';
  ageRange: string;
  vibe: string;
  aspectRatio: '9:16' | '16:9';
  thumbnailUrl?: string;
}

export interface VoiceOption {
  id: string;
  displayName: string;
  gender: 'female' | 'male' | 'neutral';
  accent: string;
}

/**
 * Curated avatar roster using the EXACT preset IDs exposed by fal.ai's
 * `veed/avatars/text-to-video` endpoint. The API accepts only these
 * enum values — sending anything else returns a validation error.
 * Voice and orientation are baked into the avatar id:
 *   - `_vertical_` suffix → 9:16 portrait (TikTok / Reels).
 *   - no `_vertical_` → 16:9 landscape (YouTube / web).
 *
 * Source: https://fal.ai/models/veed/avatars/text-to-video
 */
export const AVATAR_CATALOG: AvatarOption[] = [
  // ── Vertical (9:16) — TikTok / Reels ─────────────────────────────
  { id: 'emily_vertical_primary', displayName: 'Emily', gender: 'female', ageRange: '25-35', vibe: 'friendly lifestyle creator', aspectRatio: '9:16' },
  { id: 'marcus_vertical_primary', displayName: 'Marcus', gender: 'male', ageRange: '25-35', vibe: 'casual, warm tech guy', aspectRatio: '9:16' },
  { id: 'mira_vertical_primary', displayName: 'Mira', gender: 'female', ageRange: '28-40', vibe: 'warm, wellness tone', aspectRatio: '9:16' },
  { id: 'jasmine_vertical_primary', displayName: 'Jasmine', gender: 'female', ageRange: '22-30', vibe: 'trendy fashion creator', aspectRatio: '9:16' },
  { id: 'aisha_vertical_walking', displayName: 'Aisha (walking)', gender: 'female', ageRange: '25-35', vibe: 'dynamic outdoor UGC', aspectRatio: '9:16' },
  { id: 'elena_vertical_primary', displayName: 'Elena', gender: 'female', ageRange: '30-42', vibe: 'confident professional', aspectRatio: '9:16' },
  // ── Horizontal (16:9) — YouTube / web ────────────────────────────
  { id: 'emily_primary', displayName: 'Emily — landscape', gender: 'female', ageRange: '25-35', vibe: 'friendly lifestyle creator', aspectRatio: '16:9' },
  { id: 'marcus_primary', displayName: 'Marcus — landscape', gender: 'male', ageRange: '25-35', vibe: 'casual, warm tech guy', aspectRatio: '16:9' },
  { id: 'elena_primary', displayName: 'Elena — landscape', gender: 'female', ageRange: '30-42', vibe: 'confident professional', aspectRatio: '16:9' },
];

/**
 * fal.ai veed/avatars bakes the voice directly into each avatar
 * preset, so a separate voice picker would mislead the user. We keep
 * this empty array for forward-compat with providers (HeyGen / Avatar
 * IV / ElevenLabs) that take a distinct voice id.
 */
export const VOICE_CATALOG: VoiceOption[] = [];

/* ═══════════════════════════════════════════════════════════════════ */
/* Script generation                                                    */
/* ═══════════════════════════════════════════════════════════════════ */

export interface GenerateScriptArgs {
  clientId: string;
  /** Core message the video should deliver. */
  brief: string;
  /** Target platform — drives tone and pacing. */
  platform: 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'generic';
  /** Target video length in seconds (5-90). */
  durationSeconds: number;
  /** Optional product id to anchor the script. */
  productId?: string;
  /** Optional profile ids to pull voice/style from. */
  inspirationProfileIds?: string[];
}

/**
 * Generate an on-camera script that hooks fast, delivers the message,
 * and closes with a CTA. Uses Claude with the full brand context +
 * tone pairs + inspiration profiles.
 */
export async function generateAvatarScript(
  args: GenerateScriptArgs,
): Promise<{ script: string; estimatedDurationSeconds: number; fromMock: boolean }> {
  const duration = Math.max(5, Math.min(90, Math.round(args.durationSeconds)));
  const wordsTarget = Math.round(duration * 2.5); // ~150 wpm on-camera

  // Assemble brand grounding.
  const [brandCtx, profiles, tonePairs, product] = await Promise.all([
    buildBrandContext(args.clientId).catch(() => null),
    listProfiles(args.clientId).catch(() => []),
    listTonePairs(args.clientId).catch(() => []),
    args.productId ? getProduct(args.clientId, args.productId).catch(() => null) : Promise.resolve(null),
  ]);

  const parts: string[] = [];
  parts.push(
    `You are writing a short on-camera UGC script for an AI avatar to read aloud.`,
    `The avatar talks straight to camera in a ${platformPacing(args.platform)} style.`,
    `Target: ~${wordsTarget} words to fit ${duration} seconds at natural speaking pace (~150 wpm).`,
    '',
    `STRUCTURE (mandatory):`,
    `  1. HOOK — first 1–2 seconds. Bold claim, surprising question, or pattern interrupt.`,
    `  2. BODY — one clear idea. No more than two "and then" beats.`,
    `  3. CTA — tell the viewer exactly what to do next.`,
    '',
    `WRITING RULES FOR TTS:`,
    `  • Short sentences. 10–15 words max.`,
    `  • Use contractions (you'll, we're, it's) — sounds more human.`,
    `  • Prefer concrete nouns and verbs over abstract language.`,
    `  • Use "…" (ellipsis) to mark natural pauses.`,
    `  • No stage directions, no [brackets], no emoji, no markdown, no bullet points.`,
    `  • Output PLAIN SPEAKABLE TEXT ONLY — it will be read aloud verbatim.`,
    '',
  );
  if (args.brief.trim()) {
    parts.push(`Core brief from the marketer:\n${args.brief.trim()}`);
    parts.push('');
  }
  if (brandCtx) {
    parts.push('Known brand facts — do NOT invent beyond these:');
    parts.push(brandContextToFactsBlock(brandCtx));
    parts.push('');
  }
  if (product) {
    parts.push(`Anchor product for this script: ${product.name}`);
    if (product.description) parts.push(`  Description: ${product.description.slice(0, 400)}`);
    if (product.priceCents != null) {
      parts.push(`  Price: ${product.currency ?? 'EUR'} ${(product.priceCents / 100).toFixed(2)}`);
    }
    parts.push('');
  }
  const profileBlock = profilesToPromptBlock(
    profiles.filter((p) => !args.inspirationProfileIds?.length || args.inspirationProfileIds.includes(p.id)),
  );
  if (profileBlock) {
    parts.push(profileBlock);
    parts.push('');
  }
  const pairBlock = tonePairsToPromptBlock(tonePairs);
  if (pairBlock) {
    parts.push(pairBlock);
    parts.push('');
  }
  parts.push(
    'HARD RULES:',
    '• Use only facts listed above. Never invent features, prices, testimonials, or claims.',
    '• No reference-brand names or trademarks.',
    '• No numbers, stats, or percentages that weren\'t explicitly provided.',
    '• Output ONLY the speakable script. No labels, no headings, no quotation marks around the output.',
  );

  const script = await generateText(parts.join('\n'), {
    model: 'sonnet',
    maxTokens: 1200,
    temperature: 0.7,
  });

  // Strip obvious wrapper artefacts Claude sometimes adds despite instructions.
  const cleaned = script
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^\s*script:\s*/i, '')
    .trim();

  return {
    script: cleaned,
    estimatedDurationSeconds: estimateSpeakingSeconds(cleaned),
    fromMock: !features.claude,
  };
}

function platformPacing(p: GenerateScriptArgs['platform']): string {
  switch (p) {
    case 'tiktok':
    case 'instagram_reels':
      return 'snappy, high-energy, first-person TikTok/Reels UGC';
    case 'youtube_shorts':
      return 'punchy YouTube Shorts';
    default:
      return 'conversational UGC';
  }
}

function estimateSpeakingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round((words / 150) * 60));
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Avatar video generation                                              */
/* ═══════════════════════════════════════════════════════════════════ */

export interface GenerateAvatarVideoArgs {
  modelId: string;
  avatarId: string;
  /** Script the avatar will read verbatim. Plain speakable text only. */
  script: string;
  /**
   * NOTE: fal.ai's `veed/avatars/text-to-video` bakes voice and aspect
   * ratio into the avatar id itself. We accept these fields for
   * forward-compat but do not forward them to the veed endpoint.
   */
  voiceId?: string;
  aspectRatio?: '9:16' | '1:1' | '16:9';
  backgroundUrl?: string;
}

export interface GenerateAvatarVideoResult {
  videoUrl: string;
  durationSeconds: number;
  fromMock: boolean;
}

/**
 * Render a talking-head video via fal.ai `veed/avatars/text-to-video`.
 * The endpoint takes only `avatar_id` and `text` — voice and framing
 * are determined by the avatar preset. Sending extra fields is silently
 * ignored but we omit them to keep the payload exactly to spec.
 *
 * For a 30s script the request typically takes 45–90s end-to-end;
 * `fal.subscribe` handles polling internally.
 */
export async function generateAvatarVideo(
  args: GenerateAvatarVideoArgs,
): Promise<GenerateAvatarVideoResult> {
  const model = getModel(args.modelId);
  if (!model) throw new Error(`Unknown model: ${args.modelId}`);
  if (model.mediaType !== 'video') {
    throw new Error(`${model.displayName} is not a video model`);
  }

  const cleanedScript = cleanScriptForTts(args.script);
  if (cleanedScript.length < 10) {
    throw new Error('Script is too short — write at least a sentence.');
  }
  if (cleanedScript.length > 4000) {
    throw new Error('Script is too long — keep it under 4000 characters.');
  }

  // Guard against users picking an avatar that isn't in fal's enum.
  const avatar = AVATAR_CATALOG.find((a) => a.id === args.avatarId);
  if (!avatar) {
    throw new Error(
      `Unknown avatar "${args.avatarId}". Pick one from the talking-head options endpoint.`,
    );
  }

  const estimatedSeconds = estimateSpeakingSeconds(cleanedScript);

  if (!features.fal) {
    // Dev fallback — return a deterministic Picsum still as a "video".
    const seed = encodeURIComponent(args.avatarId);
    const [w, h] = avatar.aspectRatio === '9:16' ? [720, 1280] : [1280, 720];
    return {
      videoUrl: `https://picsum.photos/seed/${seed}/${w}/${h}`,
      durationSeconds: estimatedSeconds,
      fromMock: true,
    };
  }

  // Only `avatar_id` and `text` per the fal.ai schema. Do NOT include
  // voice_id / aspect_ratio / background_url — they're not in the
  // endpoint's input schema and cause validation failures on some
  // provider versions.
  const input: Record<string, unknown> = {
    avatar_id: args.avatarId,
    text: cleanedScript,
  };

  try {
    const result = await fal.subscribe(model.endpoint, { input, logs: false });
    const data = result.data as any;
    const videoUrl =
      data?.video?.url ??
      data?.videos?.[0]?.url ??
      data?.url;
    if (!videoUrl) {
      throw new Error(`${model.displayName} did not return a video URL`);
    }
    const durationSeconds = Number(data?.duration) || estimatedSeconds;
    return {
      videoUrl: String(videoUrl),
      durationSeconds,
      fromMock: false,
    };
  } catch (e) {
    const msg = (e as Error).message ?? '';
    // If the plan doesn't include Veed avatars, fall back to mock so
    // the UI can still present a result with a clear fromMock flag.
    if (/forbidden|403|payment|quota|limit|not.*found/i.test(msg)) {
      console.warn(`[talking-head] ${model.id} fell back: ${msg.slice(0, 100)}`);
      const seed = encodeURIComponent(args.avatarId);
      const [w, h] = avatar.aspectRatio === '9:16' ? [720, 1280] : [1280, 720];
      return {
        videoUrl: `https://picsum.photos/seed/${seed}-fallback/${w}/${h}`,
        durationSeconds: estimatedSeconds,
        fromMock: true,
      };
    }
    throw e;
  }
}

/**
 * Clean a script for TTS — strip markdown, bullets, stage directions,
 * and emoji that text-to-speech systems mispronounce. Collapses
 * whitespace to avoid "pause on every newline" artifacts common in
 * AI-generated scripts.
 */
function cleanScriptForTts(script: string): string {
  return script
    // Strip markdown bold/italic markers.
    .replace(/\*\*|\*|_{1,2}/g, '')
    // Strip common stage-direction brackets like [HOOK] or (pause).
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\(pause[^)]*\)/gi, '')
    // Strip bullet points at the start of lines.
    .replace(/^\s*[-•*]\s+/gm, '')
    // Drop emoji — most TTS voices read them as "emoji picture".
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, '')
    // Collapse whitespace so "… \n \n text" doesn't produce ugly pauses.
    .replace(/\s+/g, ' ')
    .trim();
}
