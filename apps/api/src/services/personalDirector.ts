/**
 * Director — multi-shot storyboard planner for personal content.
 *
 * This is the single biggest lever we have to stop generating
 * AI slop. Instead of a flat "image per beat" plan, we ask Claude
 * (in director mode) to produce a real shot list: acts, beats, and
 * individual cinematographic SHOTS with camera move, framing, subject
 * action, lighting, palette, and transition to the next shot.
 *
 * Each shot is small enough to hand to a single AI-video model call
 * (2-4 seconds) and specific enough that Sora / Veo / Kling / Higgsfield
 * returns something intentional rather than generic.
 *
 * Structure (informed by the common "multi-shot" workflow that Sora,
 * Kling 3.0, and Veo 3.1 all now support):
 *
 *   Storyboard
 *   ├── acts[]                  — narrative phases ("before", "after",
 *   │                              "setup", "reveal", "payoff")
 *   │   └── beats[]             — visual moments within an act
 *   │       └── shots[]         — individual 2-4s camera takes
 *   │
 *   └── editPlan                — global edit rhythm, colour grade,
 *                                 music cue points, transition style
 *
 * Use cases this unlocks:
 *   - Before/after transformations (phase split: before → progress → after)
 *   - Recipe / process videos (phase = step, shot = action)
 *   - AI-influencer vlog scenes (establishing → close-up → detail)
 *   - Fashion looks (hero wide → detail → motion reveal)
 *   - Science / education (concept → demo → punchline)
 */

import { randomUUID } from 'node:crypto';
import { generateJSON } from './claude.js';
import { isDefaultRetryable, withRetry } from './retry.js';
import type { PersonalTheme } from './personalThemes.js';
import type { PersonalAccountStyleBible } from '@boost/database';
import {
  buildStyleExamplesPrompt,
  buildTitleFirstWorkflowPrompt,
  directorShotCountRange,
} from './personalContentHints.js';
import { resolveLockedChannelVideoTitle } from './personalChannelTitle.js';

/** Embedded in persisted storyboard JSON; stripped before Claude replans. */
export const PERSONAL_SCRIPT_CK_PRE = '__pipelineCheckpoint' as const;
export const PERSONAL_SCRIPT_CK_SRC = '__sourcingCheckpoint' as const;
/** Pipeline meta: whether this post should be pushed to ContentStudio after render. */
export const PERSONAL_SCRIPT_SCHEDULE_INTENT = '__scheduleIntent' as const;

export function stripDirectorResumeKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const o = { ...raw };
  delete o[PERSONAL_SCRIPT_CK_PRE];
  delete o[PERSONAL_SCRIPT_CK_SRC];
  delete o[PERSONAL_SCRIPT_SCHEDULE_INTENT];
  return o;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Data shapes                                                          */
/* ═══════════════════════════════════════════════════════════════════ */

/** Camera dialect — matches the Higgsfield / Sora vocabulary. */
export type ShotCameraMove =
  | 'static'
  | 'slow_push_in'
  | 'slow_pull_out'
  | 'dolly_in'
  | 'dolly_out'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'orbit'
  | 'handheld'
  | 'whip_pan'
  | 'crash_zoom'
  | 'crane_up'
  | 'crane_down'
  | 'fpv_sweep'
  | 'tracking'
  | 'bullet_time';

/** Shot framing / distance. */
export type ShotFraming =
  | 'extreme_wide'
  | 'wide'
  | 'medium_wide'
  | 'medium'
  | 'medium_close'
  | 'close_up'
  | 'extreme_close_up'
  | 'over_the_shoulder'
  | 'top_down'
  | 'low_angle'
  | 'high_angle';

/** Transition into the next shot. */
export type ShotTransition =
  | 'hard_cut'      // clean editorial cut (default)
  | 'match_cut'     // same shape / motion continues
  | 'whip_pan'      // fast blurred pan
  | 'dip_to_black'  // quick blackout
  | 'cross_dissolve'// gentle overlap
  | 'flash_cut'     // white frame punch
  | 'jump_cut'      // intentional jump
  | 'none';         // no transition (used for final shot)

/** Speed ramp applied inside the shot. */
export type ShotSpeedRamp = 'none' | 'slow_mo' | 'speed_up' | 'freeze_end';

/** How this shot should be realized. */
export type ShotKind =
  | 'ai_video'      // generated with Sora / Veo / Kling / Higgsfield
  | 'ai_image'      // still with Ken Burns applied at render
  | 'scraped_video' // Pexels / stock
  | 'scraped_image' // Pexels / Unsplash / Wikipedia / News
  | 'user_media'    // the user uploaded this asset
  | 'b_roll';       // generic B-roll (from user library if tagged, else scraped)

export interface DirectorShot {
  id: string;
  /** Narrative role within the beat ("hook frame", "money shot", "punchline"). */
  role: string;
  /** What the camera sees. 1-2 sentences, concrete. */
  description: string;
  /** Burned-in on-screen copy (short, 3-8 words). Empty string for none. */
  onScreen: string;
  /** Voiceover line spoken over this shot. Empty for silent beats. */
  voiceover: string;
  /** Chapter label / eyebrow (e.g. "STEP 1", "BEFORE", "DAY 3"). */
  eyebrow?: string;
  /** Duration in seconds (2-5s typically). */
  durationSeconds: number;
  /** Cinematography. */
  camera: ShotCameraMove;
  framing: ShotFraming;
  lighting: string;         // "soft window light", "golden hour", "neon night"
  palette: string;          // "warm earth tones", "cold blues", "pastel cream"
  subjectAction: string;    // concrete verb — "pours espresso", "opens window"
  /** Extra cinematic touches: DOF, grain, lens. */
  lensHint?: string;        // "shallow depth of field, 35mm"
  speedRamp?: ShotSpeedRamp;
  /** How we reach the NEXT shot. */
  transitionOut: ShotTransition;
  /** Which references to pass to the AI model (indices into beat.references). */
  referenceIndices: number[];
  /** How this shot should be realized. */
  kind: ShotKind;
  /** Search query for scraped kinds. */
  imageQuery?: string;
  /** Optional focal point 0..1 for Ken Burns on still shots. */
  focalX?: number;
  focalY?: number;
  /**
   * Optional lower-third style keyword pops (1–3 words each). Rendered in
   * the FFmpeg stitch when `keywordPopStyle` is not `off`.
   */
  keywordCards?: Array<{ text: string; tStart?: number; tEnd?: number }>;
  /**
   * Rare: a very short line composited on the frame for ai_image shots when
   * `allowSparseImageText` is enabled in generator config.
   */
  imageCaption?: string;
}

/** A storyboard beat — a cluster of shots that sit together narratively. */
export interface DirectorBeat {
  id: string;
  title: string;              // "Intro — misty morning"
  phase: string;              // "before" | "during" | "after" | "hook" | "reveal" | "payoff"
  shots: DirectorShot[];
  /** Shared visual references for every shot in this beat. */
  references?: Array<{
    role: 'character' | 'style' | 'product' | 'location' | 'brand';
    imageUrl: string;
    description?: string;
  }>;
}

/** A narrative act — larger structural unit, typically 1-3 per video. */
export interface DirectorAct {
  id: string;
  name: string;               // "Before", "Transformation", "Reveal"
  intent: string;              // director's note on why this act exists
  beats: DirectorBeat[];
}

/** Global edit plan that sits on top of all shots. */
export interface EditPlan {
  pacing: 'slow' | 'medium' | 'fast';
  /** One-line colour grade direction. */
  colourGrade: string;
  /** Music rhythm instruction for the stitcher (kick points, builds, drop). */
  musicCue?: string;
  /** Default transition when the shot doesn't specify. */
  defaultTransition: ShotTransition;
  /** Whether to apply a film-grain overlay at render. */
  useGrain: boolean;
  /** Whether to apply subtle letterbox bars. */
  letterbox: boolean;
}

export interface Storyboard {
  title: string;
  hook: string;
  outro: string;
  caption: string;
  hashtags: string[];
  acts: DirectorAct[];
  editPlan: EditPlan;
  /** Rough total runtime (seconds) — sum of shot durations. */
  estimatedDurationSeconds: number;
  /** Set when Claude refused the brief. */
  blocked?: boolean;
  blockReason?: string;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Storyboard generation                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export interface DirectArgs {
  theme: PersonalTheme;
  topic: string;
  targetDurationSeconds: number;
  styleBible?: PersonalAccountStyleBible;
  customDirection?: string;
  blacklist?: string[];
  newsContext?: string;
  language?: string;
  /** Character guide (name + prompt fragment + voice). */
  characterGuide?: {
    name: string;
    promptFragment?: string;
    voiceTone?: string;
    voicePace?: string;
    catchphrases?: string[];
  };
  /** Digest of user-uploaded reference media (role, description, tags). */
  referenceMediaDigest?: string;
  /**
   * A distilled style block from the account's saved inspiration /
   * style_reference media. Not the raw urls — a human-readable
   * summary ("Moody low-light food photography. Shot on 50mm…") the
   * director treats as the authoritative visual language. The
   * generator also appends this to every AI image/video shot prompt
   * downstream so the look stays consistent.
   */
  inspirationStyleBlock?: string;
  /**
   * Optional viral format block. When set, the director must hit every
   * beat in the supplied format (the block is rendered upstream from
   * `formatToPromptBlock`). Locks pacing, hook window, beat structure,
   * and caption style.
   */
  viralFormatBlock?: string;
  /**
   * Optional hook formula directive — when present, the director's
   * first beat must open with a line matching this formula's template.
   */
  hookFormulaDirective?: string;
  /** When true the director plans multi-act narratives (process / transformation / reveal). */
  allowMultiAct?: boolean;
  /** Max number of AI-video shots per storyboard — keeps cost in check. */
  maxAiVideoShots?: number;
  /**
   * Post-process: when `stills_only`, all video shot kinds are demoted to
   * stills after Claude returns (belt-and-suspenders with the prompt).
   */
  mediaPreference?: 'mixed' | 'stills_only' | 'motion_preferred' | 'video_only';
  /** Appended after style bible / direction — content rules, examples, pacing, media bias. */
  promptAppendix?: string;
  /** Default / center per-shot duration when the model omits `durationSeconds`. */
  averageShotSeconds?: number;
  /** Shorter vs longer average shots + more cuts when `rapid`. */
  cutPace?: 'relaxed' | 'normal' | 'rapid';
  /** Keyword pop cards in the stitch; `off` strips them at normalise time. */
  keywordPopStyle?: 'off' | 'subtle' | 'bold';
  /** When false, `imageCaption` is stripped at normalise time. */
  allowSparseImageText?: boolean;
  /**
   * When **false**, storyboard JSON must use empty `onScreen` on every shot — no planner-written
   * short on-screen lines; use `keywordCards` / `imageCaption` / title-card settings only.
   * Default **true** (director may still emit `onScreen`).
   */
  directorShotOnScreenCopy?: boolean;
  /**
   * When true: opening white title slate **plus** timed `keywordCards` for spoken
   * names / numbers throughout (stitch uses white-card / dark-type overlays).
   */
  namesNumbersTitleCard?: boolean;
  /**
   * Long-form mode. When set, the director plans a CHAPTER-structured
   * storyboard suitable for minutes of content instead of seconds:
   *
   *   - 5-8 chapters (acts) instead of 1-3
   *   - 3-5 shots per chapter (so 20-40 shots total)
   *   - Each shot 3-8 seconds, not 2-4
   *   - Chapter title cards between acts
   *
   * The underlying shot / stitch machinery is unchanged — the director
   * simply emits more acts and more shots with an explicit chapter
   * title on each act.
   */
  longform?: {
    enabled: boolean;
    targetDurationSeconds: number;
    /** Visual style preset — layered into every shot prompt. */
    animationStyle?:
      | 'storybook'
      | 'cartoon'
      | 'stick_figure'
      | 'claymation'
      | 'pixel_art'
      | 'watercolour'
      | 'custom';
  };
  /** Claude model for storyboard JSON. */
  scriptModel?: 'sonnet' | 'opus';
  /** Recent `script.title` values on this channel — avoid duplicate headlines. */
  recentVideoTitles?: string[];
  /**
   * When set, the director must paste this exact string into JSON `title`.
   * Pipelines normally set this via {@link channelVideoTitleLikeIsolatedTest} before calling
   * {@link planStoryboard} so the headline matches `pnpm test:isolated-channel-title`.
   */
  lockedVideoTitle?: string;
}

/** When Claude omits caption, still produce a usable YouTube/feed description. */
function buildFallbackCaption(
  hook: string | undefined,
  outro: string | undefined,
  title: string,
  topic: string,
): string {
  const headline = (title || topic || '').trim();
  const hookLine = (hook ?? '').trim();
  const cta = (outro ?? '').trim();
  const lead =
    hookLine ||
    (headline
      ? `${headline.replace(/\?+$/, '')} — here’s the short version.`
      : 'Worth the watch.');
  const parts = [
    lead.slice(0, 220),
    headline && hookLine && !hookLine.toLowerCase().includes(headline.toLowerCase().slice(0, 24))
      ? `Packed into one watch: ${headline.replace(/\?+$/, '')}.`
      : '',
    cta ? cta.slice(0, 120) : 'Like + subscribe if you want more like this.',
  ].filter(Boolean);
  return normalizeYoutubeCaption(parts.join('\n\n'), { longform: false });
}

/**
 * Keep YouTube/feed descriptions short, front-loaded, and scannable.
 * Search + the “more” fold reward a tight first line — not essay paste.
 */
export function normalizeYoutubeCaption(
  raw: string,
  opts?: { longform?: boolean },
): string {
  let t = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return '';
  t = t
    .replace(/^(in this video co(?:mes|vers?|ntains?)|in this video we(?:'ll| will)|today we(?:'ll| will)|welcome back[^.\n]*[.!]?)\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const max = opts?.longform ? 900 : 420;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const atPara = cut.lastIndexOf('\n\n');
  const atSent = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  const at =
    atPara >= Math.floor(max * 0.45)
      ? atPara
      : atSent >= Math.floor(max * 0.45)
        ? atSent + 1
        : max;
  return cut.slice(0, at).trim();
}

export async function planStoryboard(args: DirectArgs): Promise<Storyboard> {
  const exampleTitles = (args.styleBible?.exampleVideoTitles ?? []).map((t) => t.trim()).filter(Boolean);

  const lockedVideoTitle = await resolveLockedChannelVideoTitle({
    topic: args.topic,
    language: args.language,
    styleBible: args.styleBible,
    recentVideoTitles: args.recentVideoTitles,
    longform: args.longform?.enabled === true,
    /** When the pipeline ran {@link channelVideoTitleLikeIsolatedTest} first, reuse it (no second LLM). */
    lockedVideoTitle: args.lockedVideoTitle,
  });

  if (process.env.PERSONAL_DEBUG_TITLES === '1') {
    console.info('[director:planStoryboard]', {
      exampleTitleCount: exampleTitles.length,
      topic: args.topic.slice(0, 100),
      lockedTitle: lockedVideoTitle?.slice(0, 120),
    });
  }
  // Long-form storyboards emit a lot more JSON — 5-8 chapters × 3-5
  // shots with full cinematography fields per shot easily crosses
  // a 4k budget. Non-longform director themes can still be JSON-heavy
  // (many acts/shots), so use 8k there; long-form uses a much larger cap.
  const maxTokens = args.longform?.enabled ? 32_000 : 8_192;

  const prompt = buildDirectorPrompt({
    ...args,
    lockedVideoTitle,
  });
  const raw = await withRetry(
    () =>
      generateJSON<Storyboard>(prompt, {
        model: args.scriptModel ?? 'sonnet',
        maxTokens,
      }),
    {
      label: `director:${args.theme.id}:${args.topic.slice(0, 40)}`,
      attempts: 3,
      retryOn: isDefaultRetryable,
    },
  );

  // Normalise + sanity defaults.
  const normOpts: {
    longform?: boolean;
    averageShotSeconds?: number;
    cutPace?: DirectArgs['cutPace'];
    keywordPopStyle?: DirectArgs['keywordPopStyle'];
    allowSparseImageText?: boolean;
    namesNumbersTitleCard?: boolean;
    directorShotOnScreenCopy?: boolean;
  } = {
    averageShotSeconds: args.averageShotSeconds,
    cutPace: args.cutPace,
    keywordPopStyle: args.keywordPopStyle,
    allowSparseImageText: args.allowSparseImageText,
    namesNumbersTitleCard: args.namesNumbersTitleCard === true,
    directorShotOnScreenCopy: args.directorShotOnScreenCopy !== false,
  };
  if (args.longform?.enabled) normOpts.longform = true;

  let storyboardTitle: string;
  if (exampleTitles.length > 0) {
    const t = lockedVideoTitle?.trim();
    if (!t) {
      throw new Error(
        '[director] Example titles are configured but the title generator returned an empty string.',
      );
    }
    storyboardTitle = t;
  } else {
    storyboardTitle = (lockedVideoTitle?.trim() || (raw.title ?? '').trim() || args.topic).trim();
  }

  const out: Storyboard = {
    title: storyboardTitle,
    hook: raw.hook ?? '',
    outro: raw.outro ?? '',
    caption: normalizeYoutubeCaption(
      (raw.caption ?? '').trim() ||
        buildFallbackCaption(raw.hook, raw.outro, storyboardTitle, args.topic),
      { longform: args.longform?.enabled === true },
    ),
    hashtags: raw.hashtags ?? args.theme.defaultHashtags ?? [],
    acts: normaliseActs(raw.acts, args.theme, normOpts),
    editPlan: {
      pacing: raw.editPlan?.pacing ?? defaultPacing(args.theme),
      colourGrade: raw.editPlan?.colourGrade ?? 'Natural, slight warmth',
      musicCue: raw.editPlan?.musicCue,
      defaultTransition:
        raw.editPlan?.defaultTransition ??
        (args.longform?.enabled ? 'cross_dissolve' : 'hard_cut'),
      useGrain: raw.editPlan?.useGrain ?? false,
      letterbox: raw.editPlan?.letterbox ?? false,
    },
    estimatedDurationSeconds: 0,
    blocked: raw.blocked,
    blockReason: raw.blockReason,
  };

  // Cap AI-video shots to budget — demote extras to ai_image or scraped.
  // In long-form mode the default is more generous (5 instead of 3)
  // because longer videos can absorb more money-shots without the cost
  // dominating the post.
  const maxAiVideo =
    args.maxAiVideoShots ?? (args.longform?.enabled ? 5 : 3);
  let aiVideoCount = 0;
  const allShots = out.acts.flatMap((a) => a.beats.flatMap((b) => b.shots));
  for (const s of allShots) {
    if (s.kind === 'ai_video') {
      if (aiVideoCount >= maxAiVideo) {
        // Downgrade to still — still tells the story, half the cost.
        s.kind = 'ai_image';
      } else {
        aiVideoCount++;
      }
    }
  }

  // Account wants zero motion clips — demote any video kinds Claude used anyway.
  if (args.mediaPreference === 'stills_only') {
    for (const s of allShots) {
      if (s.kind === 'ai_video') s.kind = 'ai_image';
      else if (s.kind === 'scraped_video') s.kind = 'scraped_image';
      else if (s.kind === 'b_roll') {
        s.kind = 'scraped_image';
        if (!s.imageQuery?.trim()) {
          s.imageQuery = (s.description || s.subjectAction || args.topic).slice(0, 120);
        }
      }
    }
  }

  // Motion-only accounts: prefer video clip kinds over stills.
  if (args.mediaPreference === 'video_only') {
    for (const s of allShots) {
      if (s.kind === 'ai_image' || s.kind === 'scraped_image') {
        s.kind = 'scraped_video';
        if (!s.imageQuery?.trim()) {
          s.imageQuery = (s.description || s.subjectAction || args.topic).slice(0, 120);
        }
      }
    }
  }

  // Enforce transition for the final shot.
  if (allShots.length > 0) allShots[allShots.length - 1]!.transitionOut = 'none';

  // Per-shot duration clamp — cutPace tightens or relaxes windows.
  const pace = args.cutPace ?? 'normal';
  const perShotMax =
    args.longform?.enabled
      ? pace === 'rapid'
        ? 8
        : 14
      : pace === 'rapid'
        ? 4
        : pace === 'relaxed'
          ? 9
          : 8;
  for (const s of allShots) {
    s.durationSeconds = Math.max(1, Math.min(perShotMax, s.durationSeconds));
  }
  out.estimatedDurationSeconds = allShots.reduce(
    (acc, s) => acc + s.durationSeconds,
    0,
  );

  // Long-form: if the storyboard came back noticeably shorter than the
  // user's target (< 85%), stretch every shot proportionally so we land
  // near the target. Without this an "8 minute" video frequently ends
  // at 4 minutes because Claude under-plans shot counts. Cap stretch at
  // 2.2× per shot to avoid one glacial stare.
  if (args.longform?.enabled) {
    const target = args.longform.targetDurationSeconds;
    if (
      target &&
      out.estimatedDurationSeconds > 0 &&
      out.estimatedDurationSeconds < target * 0.85
    ) {
      const ratio = Math.min(2.2, target / out.estimatedDurationSeconds);
      for (const s of allShots) {
        s.durationSeconds = Math.min(
          perShotMax,
          Math.round(s.durationSeconds * ratio * 10) / 10,
        );
      }
      out.estimatedDurationSeconds = allShots.reduce(
        (acc, s) => acc + s.durationSeconds,
        0,
      );
    }
    // Greedy top-up: proportional stretch can still undershoot when many
    // shots already sit at perShotMax. Add 0.1s to the shortest shot
    // repeatedly until within ~8% of target or no headroom.
    if (
      target &&
      out.estimatedDurationSeconds > 0 &&
      out.estimatedDurationSeconds < target * 0.92
    ) {
      let guard = 0;
      while (out.estimatedDurationSeconds < target * 0.92 && guard++ < 8000) {
        let progressed = false;
        const sorted = [...allShots].sort((a, b) => a.durationSeconds - b.durationSeconds);
        for (const s of sorted) {
          if (s.durationSeconds >= perShotMax - 0.051) continue;
          s.durationSeconds = Math.round((Math.min(perShotMax, s.durationSeconds + 0.1)) * 10) / 10;
          progressed = true;
          break;
        }
        if (!progressed) break;
        out.estimatedDurationSeconds = allShots.reduce((acc, s) => acc + s.durationSeconds, 0);
      }
    }
  }

  if (args.allowSparseImageText === true && (args.keywordPopStyle ?? 'off') === 'off') {
    stripKeywordCardsForAiImageStoryboard(allShots);
    thinSparseImageCaptionsOnShots(allShots, 0.2);
    resyncImageCaptionsAfterVoiceEdits(allShots);
  }

  // Force consecutive stills/clips away from near-duplicate image briefs before generation.
  diversifyConsecutiveVisualShots(allShots);

  return out;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function defaultPacing(theme: PersonalTheme): 'slow' | 'medium' | 'fast' {
  if (theme.template === 'quote-card' || theme.template === 'story-narration') return 'slow';
  if (theme.template === 'brainrot' || theme.template === 'listicle') return 'fast';
  return 'medium';
}

function parseKeywordCards(raw: unknown): DirectorShot['keywordCards'] {
  if (!Array.isArray(raw) || raw.length < 1) return undefined;
  const out: NonNullable<DirectorShot['keywordCards']> = [];
  const seen = new Set<string>();
  for (const x of raw.slice(0, 4)) {
    if (!x || typeof x !== 'object') continue;
    const text = String((x as { text?: unknown }).text ?? '').trim();
    if (!text || text.length > 48) continue;
    const dedupeKey = text.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const tStart = (x as { tStart?: unknown }).tStart;
    const tEnd = (x as { tEnd?: unknown }).tEnd;
    out.push({
      text,
      tStart: typeof tStart === 'number' && Number.isFinite(tStart) ? tStart : undefined,
      tEnd: typeof tEnd === 'number' && Number.isFinite(tEnd) ? tEnd : undefined,
    });
  }
  return out.length ? out : undefined;
}

/**
 * Drop keyword cards whose text is not grounded in this shot's `voiceover`.
 * The model often adds proper nouns from context that are not spoken on this beat.
 */
export function filterKeywordCardsByVoiceover(
  cards: Array<{ text: string; tStart?: number; tEnd?: number }> | undefined,
  voiceover: string,
): Array<{ text: string; tStart?: number; tEnd?: number }> | undefined {
  if (!cards?.length) return undefined;
  const vo = voiceover.trim();
  if (!vo) return undefined;
  const kept = cards.filter((c) => keywordCardGroundedInVoiceover(c.text.trim(), vo));
  return kept.length ? kept : undefined;
}

function alnumCollapsed(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Two-letter English words that must not match via bare substring inside other words. */
const TWO_LETTER_NOISE = new Set([
  'it',
  'is',
  'at',
  'in',
  'on',
  'an',
  'am',
  'as',
  'or',
  'if',
  'we',
  'he',
  'be',
  'to',
  'of',
  'do',
  'go',
  'no',
  'so',
  'up',
  'me',
  'my',
  'by',
  'ok',
]);

function keywordTokenInVoiceover(token: string, vo: string): boolean {
  const t = token.toLowerCase();
  if (!t) return true;
  if (/^[0-9.,$€£%+]+$/i.test(t)) {
    const norm = t.replace(/,/g, '');
    return vo.toLowerCase().replace(/,/g, '').includes(norm);
  }
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(vo);
}

/** Same tokens must appear as whole words in VO, in the same order (not scattered). */
function tokensAppearInOrderInVoiceover(voRaw: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  let idx = 0;
  const voLo = voRaw.toLowerCase();
  for (const tok of tokens) {
    const t = tok.toLowerCase();
    if (!t || t.length < 2) continue;
    if (/^[0-9.,$€£%+]+$/i.test(t)) {
      const normT = t.replace(/,/g, '');
      const rest = voLo.slice(idx).replace(/,/g, '');
      const j = rest.indexOf(normT);
      if (j < 0) return false;
      idx += j + normT.length;
      continue;
    }
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const slice = voLo.slice(idx);
    const m = slice.match(new RegExp(`(?:^|[^a-z0-9])${esc}(?:[^a-z0-9]|$)`, 'i'));
    if (!m || m.index === undefined) return false;
    idx += m.index + m[0].length;
  }
  return true;
}

function normalizeDirectorCaptionSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Generic / hedge / vague tokens — on-image labels should not be *only* these. */
const IMAGE_CAPTION_FILLER = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'so',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'by',
  'from',
  'as',
  'is',
  'are',
  'was',
  'were',
  'been',
  'be',
  'being',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'there',
  'here',
  'i',
  'you',
  'we',
  'they',
  'he',
  'she',
  'him',
  'her',
  'them',
  'me',
  'my',
  'your',
  'our',
  'their',
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'how',
  'when',
  'where',
  'why',
  'can',
  'could',
  'would',
  'should',
  'may',
  'might',
  'must',
  'will',
  'just',
  'really',
  'actually',
  'basically',
  'literally',
  'maybe',
  'perhaps',
  'probably',
  'some',
  'any',
  'no',
  'not',
  'nor',
  'only',
  'even',
  'ever',
  'very',
  'too',
  'also',
  'then',
  'than',
  'into',
  'out',
  'up',
  'down',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'such',
  'one',
  'two',
  'three',
  'first',
  'last',
  'next',
  'got',
  'get',
  'gets',
  'getting',
  'go',
  'goes',
  'going',
  'went',
  'come',
  'came',
  'comes',
  'see',
  'saw',
  'seen',
  'know',
  'knew',
  'known',
  'think',
  'thought',
  'say',
  'said',
  'says',
  'tell',
  'told',
  'make',
  'made',
  'makes',
  'like',
  'want',
  'wants',
  'need',
  'needs',
  'way',
  'ways',
  'thing',
  'things',
  'stuff',
  'people',
  'person',
  'someone',
  'somebody',
  'something',
  'anything',
  'nothing',
  'everyone',
  'everybody',
  'anybody',
  'anyone',
  'nobody',
  'somewhere',
  'anywhere',
  'everywhere',
  'life',
  'lives',
  'time',
  'times',
  'day',
  'days',
  'year',
  'years',
  'world',
  'story',
  'video',
  'part',
  'lot',
  'bit',
  'kind',
  'sort',
  'type',
  'big',
  'small',
  'old',
  'new',
  'long',
  'short',
  'high',
  'low',
  'good',
  'bad',
  'great',
  'right',
  'left',
  'well',
  'still',
  'again',
  'once',
  'twice',
  'never',
  'always',
  'sometimes',
  'often',
  'already',
  'yet',
  'though',
  'although',
  'because',
  'while',
  'until',
  'unless',
  'about',
  'around',
  'over',
  'under',
  'between',
  'through',
  'during',
  'before',
  'after',
  'since',
  'now',
  'today',
  'tomorrow',
  'yesterday',
]);

/** Common scene / mood nouns that look Title Case but should not burn into stills alone. */
const IMAGE_CAPTION_SCENE_NOISE = new Set([
  'forest',
  'trail',
  'mountain',
  'kitchen',
  'sunset',
  'sunrise',
  'city',
  'street',
  'ocean',
  'beach',
  'river',
  'desert',
  'garden',
  'office',
  'room',
  'house',
  'building',
  'bridge',
  'road',
  'sky',
  'cloud',
  'clouds',
  'night',
  'morning',
  'evening',
  'portrait',
  'landscape',
  'closeup',
  'close-up',
  'scientist',
  'worker',
  'crowd',
  'market',
  'factory',
  'lab',
  'laboratory',
  'museum',
  'castle',
  'church',
  'temple',
  'village',
  'harbor',
  'harbour',
  'valley',
  'field',
  'farm',
  'ship',
  'plane',
  'train',
  'car',
  'map',
  'document',
  'photo',
  'image',
  'scene',
  'view',
  'vista',
  'moment',
  'journey',
  'adventure',
  'mystery',
  'history',
  'future',
  'past',
  'power',
  'change',
  'truth',
  'secret',
  'danger',
  'hope',
  'fear',
  'love',
  'war',
  'peace',
]);

function truncateImageCaptionWords(caption: string, maxWords: number): string {
  const w = caption.trim().split(/\s+/).filter(Boolean);
  if (w.length <= maxWords) return caption.trim();
  return w.slice(0, maxWords).join(' ');
}

/**
 * Keep on-image text only when it is **worth burning in**: stats, money, dates,
 * acronyms, or proper nouns — not scene labels, mood words, or hedges.
 * Prefer omitting a label over weak type on the still.
 */
export function imageCaptionIsHighSignal(caption: string, _voiceover: string): boolean {
  const raw = caption.trim();
  if (raw.length < 2) return false;
  if (/\d/.test(raw)) return true;
  if (/[%$€£]/.test(raw)) return true;
  /** Acronyms (US, GDP, NASA). */
  if (/\b[A-Z]{2,}\b/.test(raw)) return true;
  /** Two title-case words — likely person or place. */
  if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(raw)) return true;
  /** Single proper noun (Kyoto, Curie) — Title Case, not a common scene word. */
  const singleProper = raw.match(/^([A-Z][a-z]{2,}|[A-Z]{2,})$/);
  if (singleProper) {
    const w = singleProper[1]!.toLowerCase();
    if (!IMAGE_CAPTION_FILLER.has(w) && !IMAGE_CAPTION_SCENE_NOISE.has(w)) return true;
  }

  return false;
}

export function filterImageCaptionToHighSignal(
  caption: string | undefined,
  voiceover: string,
  maxWords = 4,
): string | undefined {
  if (!caption?.trim()) return undefined;
  let t = normalizeDirectorCaptionSpaces(caption);
  t = truncateImageCaptionWords(t, maxWords);
  if (t.length < 2) return undefined;
  if (!imageCaptionIsHighSignal(t, voiceover)) return undefined;
  return t.slice(0, 48);
}

/** Deterministic variety cue so each AI frame gets a different compositional brief. */
const COMPOSITION_VARIETY_HINTS: readonly string[] = [
  'Favour asymmetrical framing — avoid dead-centre stock symmetry.',
  'Emphasise depth: foreground element, clear mid-ground, receding background.',
  'Environmental scale first; the subject may read small with strong context.',
  'Texture- or detail-forward (hands, props, surfaces) — not a generic portrait.',
  'Rim light, silhouette edge, or partial masking — skip textbook three-quarter view.',
  'Low horizon or layered verticals — avoid flat eyeline webcam energy.',
  'One chromatic accent on a restrained palette — avoid flat mushy grading.',
  'Slight oblique camera energy — readable, not chaotic; no mirrored hero poses.',
  'Single-object hero read — one prop or figure carries the story beat.',
  'Environmental storytelling: signage, tools, weather, or era cues in frame edges.',
  'High angle looking down into a table or map — organised spatial read.',
  'Wide silhouette against a bright background — graphic, legible shape.',
  'Macro or tight detail on texture (fabric, metal, paper) with shallow depth.',
  'Diagonal leading lines (road, river, shelf) pulling the eye through the frame.',
];

function cheapStringHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function compositionUniquenessHintForShot(shotId: string, timelineIndex: number): string {
  const h = cheapStringHash(`${shotId}\0${timelineIndex}`);
  return COMPOSITION_VARIETY_HINTS[h % COMPOSITION_VARIETY_HINTS.length]!;
}

const PROMPT_SIMILARITY_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'in',
  'on',
  'to',
  'with',
  'for',
  'from',
  'at',
  'by',
  'is',
  'as',
  'into',
  'over',
  'under',
  'this',
  'that',
  'its',
  'their',
  'his',
  'her',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'shot',
  'frame',
  'scene',
  'image',
  'still',
  'video',
  'showing',
  'shows',
  'shown',
  'about',
  'across',
  'through',
  'while',
  'where',
  'when',
  'then',
  'than',
  'very',
  'just',
  'also',
  'only',
  'same',
  'like',
  'near',
  'using',
  'used',
  'make',
  'made',
  'look',
  'looks',
]);

/** Significant tokens for comparing consecutive image briefs / prompts. */
export function significantPromptTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (raw.length < 3) continue;
    if (PROMPT_SIMILARITY_STOPWORDS.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

export function promptTokenJaccard(a: string, b: string): number {
  const A = significantPromptTokens(a);
  const B = significantPromptTokens(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function shotVisualBrief(s: DirectorShot): string {
  return [s.description, s.subjectAction, s.imageQuery, s.lighting, s.palette, s.framing, s.camera]
    .filter((x) => typeof x === 'string' && x.trim())
    .join(' ');
}

const ALT_CAMERAS: ShotCameraMove[] = [
  'slow_push_in',
  'pan_left',
  'tilt_up',
  'orbit',
  'handheld',
  'dolly_out',
  'crane_up',
  'tracking',
  'static',
  'slow_pull_out',
];

const ALT_FRAMINGS: ShotFraming[] = [
  'extreme_wide',
  'wide',
  'medium_wide',
  'medium',
  'medium_close',
  'close_up',
  'extreme_close_up',
  'over_the_shoulder',
];

function pickDifferentCamera(prev: ShotCameraMove, seed: number): ShotCameraMove {
  const opts = ALT_CAMERAS.filter((c) => c !== prev);
  return opts[seed % opts.length] ?? 'slow_push_in';
}

function pickDifferentFraming(prev: ShotFraming, seed: number): ShotFraming {
  const opts = ALT_FRAMINGS.filter((f) => f !== prev);
  return opts[seed % opts.length] ?? 'wide';
}

/**
 * After the director returns a storyboard, force consecutive AI/stock stills to
 * differ in description/camera/framing when they are near-duplicates — so image
 * generation prompts are not paraphrases of the previous cut.
 *
 * Important: do **not** append meta instructions ("Distinct from prior…") into
 * `description` — that string is fed to the image model as the scene brief and
 * would get painted / misread as subject matter. Diversity meta lives in
 * `shotToPrompt` via previous-shot forbid clauses + composition hints.
 */
export function diversifyConsecutiveVisualShots(shots: DirectorShot[]): void {
  for (let i = 1; i < shots.length; i++) {
    const prev = shots[i - 1]!;
    const cur = shots[i]!;
    const visual = (k: ShotKind) =>
      k === 'ai_image' || k === 'ai_video' || k === 'scraped_image' || k === 'scraped_video';
    if (!visual(prev.kind) || !visual(cur.kind)) continue;

    const sim = promptTokenJaccard(shotVisualBrief(prev), shotVisualBrief(cur));
    const sameTriple =
      prev.camera === cur.camera &&
      prev.framing === cur.framing &&
      (prev.lighting ?? '').toLowerCase().replace(/\s+/g, ' ').slice(0, 48) ===
        (cur.lighting ?? '').toLowerCase().replace(/\s+/g, ' ').slice(0, 48);

    if (sim < 0.36 && !sameTriple) continue;

    const seed = cheapStringHash(`${cur.id}\0${i}`) >>> 0;
    if (cur.camera === prev.camera || sameTriple) {
      cur.camera = pickDifferentCamera(prev.camera, seed);
    }
    if (cur.framing === prev.framing || sameTriple) {
      cur.framing = pickDifferentFraming(prev.framing, seed + 3);
    }

    if (sim < 0.36) continue;

    const seedExtra = seed;
    // Concrete visual nouns only — keep scraper queries short and non-meta.
    if (cur.imageQuery?.trim() && prev.imageQuery?.trim()) {
      const qSim = promptTokenJaccard(cur.imageQuery, prev.imageQuery);
      if (qSim >= 0.45) {
        const qExtra =
          seedExtra % 3 === 0 ? 'wide establishing' : seedExtra % 3 === 1 ? 'detail closeup' : 'side angle';
        cur.imageQuery = `${cur.imageQuery.trim()} ${qExtra}`.slice(0, 140);
      }
    }
    if (cur.subjectAction?.trim() && promptTokenJaccard(cur.subjectAction, prev.subjectAction ?? '') >= 0.5) {
      const actionExtra =
        seedExtra % 3 === 0
          ? 'from a different angle'
          : seedExtra % 3 === 1
            ? 'in a new location within the scene'
            : 'at a different scale';
      if (!cur.subjectAction.includes(actionExtra)) {
        cur.subjectAction = `${cur.subjectAction.trim()}, ${actionExtra}`.slice(0, 220);
      }
    }
    // Nudge lighting wording when briefs are near-clones so the prompt differs.
    if ((cur.lighting ?? '').trim() && (prev.lighting ?? '').trim()) {
      const lightSim = promptTokenJaccard(cur.lighting ?? '', prev.lighting ?? '');
      if (lightSim >= 0.55) {
        const lightExtra =
          seedExtra % 2 === 0 ? 'cooler rim accent' : 'warmer key from the opposite side';
        if (!(cur.lighting ?? '').includes(lightExtra)) {
          cur.lighting = `${(cur.lighting ?? '').trim()}, ${lightExtra}`.slice(0, 180);
        }
      }
    }
  }
}

/**
 * Reduce on-image junk: keep only wording that appears verbatim in the spoken line,
 * preferring the longest caption slice that exists in VO (preserves VO spelling for that span).
 */
export function clampImageCaptionToVoiceover(
  voiceover: string,
  caption: string,
  maxLen = 48,
): string | undefined {
  const vo = normalizeDirectorCaptionSpaces(voiceover);
  const cap = normalizeDirectorCaptionSpaces(caption).slice(0, maxLen);
  if (!vo || !cap) return undefined;
  const voL = vo.toLowerCase();

  /** Single-char / two-char letter matches are too easy to hit inside unrelated words. */
  function substringAllowedInVo(sub: string): boolean {
    const t = sub.trim();
    if (t.length < 2) return /\d/.test(t);
    if (/\d/.test(t)) return true;
    if (t.includes(' ')) return true;
    if (t.length === 2 && TWO_LETTER_NOISE.has(t.toLowerCase())) return false;
    return keywordTokenInVoiceover(t.toLowerCase(), vo);
  }

  let best: string | undefined;
  let bestLen = 0;
  /** Among equal-length matches, prefer text that appears earlier in the VO (reads with the opening of the line, not only the tail). */
  let bestIdx = Number.POSITIVE_INFINITY;
  const maxL = Math.min(maxLen, cap.length);
  for (let len = maxL; len >= 1; len--) {
    for (let start = 0; start + len <= cap.length; start++) {
      const sub = cap.slice(start, start + len);
      const subL = sub.toLowerCase();
      if (subL.length < 1) continue;
      const idx = voL.indexOf(subL);
      if (idx < 0) continue;
      if (!substringAllowedInVo(sub)) continue;
      if (len > bestLen || (len === bestLen && idx < bestIdx)) {
        bestLen = len;
        bestIdx = idx;
        best = vo.slice(idx, idx + sub.length);
      }
    }
  }
  return best ? normalizeDirectorCaptionSpaces(best).slice(0, maxLen) : undefined;
}

/** After high-signal filter + dedupe: keep only the strongest ~⅕ of in-image labels so most frames stay clean. */
function sparseImageCaptionsToBudget(shots: DirectorShot[], maxFraction = 0.2): void {
  const withCap = shots
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.kind === 'ai_image' && x.s.imageCaption?.trim());
  const nAi = shots.filter((s) => s.kind === 'ai_image').length;
  if (nAi === 0 || withCap.length === 0) return;
  const maxKeep = Math.max(1, Math.floor(nAi * maxFraction + 1e-9));
  if (withCap.length <= maxKeep) return;

  const score = (cap: string) => {
    const t = cap.trim();
    let sc = Math.min(55, t.length);
    if (/\d/.test(t)) sc += 42;
    if (/[%$€£]/.test(t)) sc += 28;
    if (/\b[A-Z]{2,}\b/.test(t)) sc += 18;
    if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(t)) sc += 12;
    return sc;
  };

  const sorted = [...withCap].sort(
    (a, b) => score(b.s.imageCaption!) - score(a.s.imageCaption!),
  );
  const drop = new Set(sorted.slice(maxKeep));
  for (const { s } of drop) {
    s.imageCaption = undefined;
  }
}

/** Drop duplicate on-image labels so the same phrase never burns into back-to-back stills. */
function dedupeImageCaptionsInShotOrder(shots: readonly DirectorShot[]): void {
  const seen = new Set<string>();
  for (const s of shots) {
    if (s.kind !== 'ai_image' || !s.imageCaption?.trim()) continue;
    const key = s.imageCaption.trim().toLowerCase().replace(/\s+/g, ' ');
    if (key.length < 2) continue;
    if (seen.has(key)) {
      s.imageCaption = undefined;
    } else {
      seen.add(key);
    }
  }
}

/**
 * Re-clamp every `ai_image` caption to that shot's current `voiceover`, then dedupe.
 * Call after repartition / merge / split so inherited `imageCaption` cannot stick on the wrong line.
 */
export function resyncImageCaptionsAfterVoiceEdits(shots: DirectorShot[]): void {
  for (const s of shots) {
    if (s.kind !== 'ai_image' || !s.imageCaption?.trim()) continue;
    const vo = (s.voiceover ?? '').trim();
    s.imageCaption = filterImageCaptionToHighSignal(
      clampImageCaptionToVoiceover(vo, s.imageCaption),
      vo,
    );
  }
  dedupeImageCaptionsInShotOrder(shots);
  sparseImageCaptionsToBudget(shots);
}

function keywordCardGroundedInVoiceover(cardText: string, voiceover: string): boolean {
  const voRaw = voiceover.trim();
  const cardRaw = cardText.trim();
  if (!voRaw || !cardRaw) return false;
  const voLo = voRaw.toLowerCase();
  const cardLo = cardRaw.toLowerCase().replace(/\u2019/g, "'");
  const voSp = voLo.replace(/\s+/g, ' ');
  const cardSp = cardLo.replace(/\s+/g, ' ');
  if (cardSp.length < 2) return false;
  /** Multi-word: contiguous phrase in VO. Single token: whole-word match only (not inside unrelated words). */
  if (cardSp.includes(' ')) {
    if (voSp.includes(cardSp)) return true;
  } else if (keywordTokenInVoiceover(cardSp, voRaw)) {
    return true;
  }
  /** Ignore light punctuation between letters so "U.S." / "covid-19" match spoken forms. */
  const voFold = voLo.replace(/[^a-z0-9]+/g, ' ');
  const cardFold = cardLo.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (cardFold.length >= 2) {
    if (cardFold.includes(' ')) {
      if (voFold.replace(/\s+/g, ' ').includes(cardFold)) return true;
    } else if (keywordTokenInVoiceover(cardFold, voRaw)) {
      return true;
    }
  }

  const cA = alnumCollapsed(cardRaw);
  const vA = alnumCollapsed(voRaw);
  /** Long collapsed runs only — short runs false-positive inside other words ("room" in "broom"). */
  if (cA.length >= 8 && vA.includes(cA)) return true;
  if (
    cA.length === 2 &&
    /^[a-z]{2}$/i.test(cA) &&
    keywordTokenInVoiceover(cA, voRaw) &&
    (!TWO_LETTER_NOISE.has(cA) || /^[A-Z]{2}$/.test(cardRaw.trim()))
  ) {
    return true;
  }

  const digitsC = cardRaw.replace(/[^\d]/g, '');
  const digitsV = voRaw.replace(/[^\d]/g, '');
  if (digitsC.length >= 2 && digitsV.includes(digitsC)) return true;
  if (digitsC.length === 1 && /\d/.test(voRaw)) {
    const d = digitsC;
    if (new RegExp(`(^|[^\\d])${d}([^\\d]|$)`).test(voRaw)) return true;
  }

  /** Tokens: drop apostrophes so "O'Brien" → obrien / obrien split → one token obrien */
  const cardForTokens = cardLo.replace(/'/g, '');
  const tokens = cardForTokens.split(/[^a-z0-9%$€£]+/).filter((w) => w.length >= 2);
  if (tokens.length === 0) {
    if (cA.length >= 2 && cA.length <= 7 && vA.includes(cA) && !TWO_LETTER_NOISE.has(cA)) {
      return keywordTokenInVoiceover(cA, voRaw);
    }
    return false;
  }
  return tokensAppearInOrderInVoiceover(voRaw, tokens);
}

/** Same rules as keyword cards — on-image fact labels must match spoken VO. */
export function overlayFactLabelGroundedInVoiceover(label: string, voiceover: string): boolean {
  return keywordCardGroundedInVoiceover(label.trim(), voiceover.trim());
}

/**
 * Fact text is painted into **AI still pixels** only — no FFmpeg keyword / slate lower-thirds.
 * True when `allowSparseImageText` is on and `keywordPopStyle` is `off` (dashboard “AI in image” mode).
 */
export function aiOnImageFactLabelsOnly(gen: {
  allowSparseImageText?: boolean;
  keywordPopStyle?: 'off' | 'subtle' | 'bold';
}): boolean {
  return gen.allowSparseImageText === true && (gen.keywordPopStyle ?? 'off') === 'off';
}

function stripKeywordCardsForAiImageStoryboard(shots: DirectorShot[]): void {
  for (const s of shots) {
    s.keywordCards = undefined;
  }
}

/** Cap how many `ai_image` shots keep `imageCaption` (model over-labels by default). */
function thinSparseImageCaptionsOnShots(shots: DirectorShot[], maxFraction: number): void {
  const ai = shots.filter((s) => s.kind === 'ai_image');
  const nAi = ai.length;
  if (nAi < 2) return;
  const maxCap = Math.max(1, Math.floor(nAi * maxFraction));
  const withCap = shots.filter((s) => s.kind === 'ai_image' && s.imageCaption?.trim());
  if (withCap.length <= maxCap) return;

  function score(s: DirectorShot): number {
    const vo = (s.voiceover ?? '').trim();
    let n = 0;
    if (/\d{3,}/.test(vo)) n += 6;
    if (/[%$€£]/.test(vo)) n += 5;
    if (/\d/.test(vo)) n += 2;
    if (/[A-Z][a-z]+ [A-Z]/.test(vo)) n += 3;
    const cap = (s.imageCaption ?? '').trim();
    if (cap.length >= 2 && vo.includes(cap)) n += 4;
    if (cap && imageCaptionIsHighSignal(cap, vo)) n += 8;
    return n;
  }

  const sorted = [...withCap].sort((a, b) => score(b) - score(a));
  const keep = new Set(sorted.slice(0, maxCap));
  for (const s of withCap) {
    if (!keep.has(s)) s.imageCaption = undefined;
  }
}

function normaliseActs(
  acts: DirectorAct[] | undefined,
  theme: PersonalTheme,
  opts?: {
    longform?: boolean;
    averageShotSeconds?: number;
    cutPace?: DirectArgs['cutPace'];
    keywordPopStyle?: DirectArgs['keywordPopStyle'];
    allowSparseImageText?: boolean;
    namesNumbersTitleCard?: boolean;
    directorShotOnScreenCopy?: boolean;
  },
): DirectorAct[] {
  if (!acts || acts.length === 0) return [];
  return acts.map((a, ai) => ({
    id: a.id ?? `act_${ai}`,
    name: a.name ?? `Act ${ai + 1}`,
    intent: a.intent ?? '',
    beats: (a.beats ?? []).map((b, bi) => ({
      id: b.id ?? `beat_${ai}_${bi}`,
      title: b.title ?? '',
      phase: b.phase ?? 'middle',
      references: b.references ?? [],
      shots: (b.shots ?? []).map((s, si) =>
        normaliseShot(s, `${ai}_${bi}_${si}`, theme, opts),
      ),
    })),
  }));
}

function normaliseShot(
  s: Partial<DirectorShot>,
  id: string,
  theme: PersonalTheme,
  opts?: {
    longform?: boolean;
    averageShotSeconds?: number;
    cutPace?: DirectArgs['cutPace'];
    keywordPopStyle?: DirectArgs['keywordPopStyle'];
    allowSparseImageText?: boolean;
    namesNumbersTitleCard?: boolean;
    directorShotOnScreenCopy?: boolean;
  },
): DirectorShot {
  const pace = opts?.cutPace ?? 'normal';
  let minDur = opts?.longform ? 3 : 1.5;
  let maxDur = opts?.longform ? 14 : 7;
  if (pace === 'rapid') {
    minDur = opts?.longform ? 2 : 1.2;
    maxDur = opts?.longform ? 8 : 4;
  } else if (pace === 'relaxed') {
    minDur = opts?.longform ? 4 : 2;
    maxDur = opts?.longform ? 14 : 9;
  }

  const baseDefault = opts?.longform ? 5 : 3;
  const avg = opts?.averageShotSeconds;
  const defaultMid =
    avg != null && Number.isFinite(avg)
      ? opts?.longform
        ? Math.min(12, Math.max(minDur, Math.min(10, Math.max(2, avg))))
        : Math.min(maxDur, Math.max(minDur, Math.min(8, Math.max(1.5, avg))))
      : pace === 'rapid'
        ? opts?.longform
          ? 4.5
          : 2.5
        : pace === 'relaxed'
          ? opts?.longform
            ? 7
            : 4.5
          : baseDefault;
  const rawDur = (s as { durationSeconds?: unknown }).durationSeconds;
  const parsedDur =
    typeof rawDur === 'string'
      ? Number(rawDur)
      : typeof rawDur === 'number'
        ? rawDur
        : undefined;
  let duration = clamp(
    parsedDur !== undefined && Number.isFinite(parsedDur) ? parsedDur : defaultMid,
    minDur,
    maxDur,
  );
  // Honour operator "avg seconds per clip": model JSON often ignores pacing.
  if (avg != null && Number.isFinite(avg) && avg > 0) {
    const capLo = Math.max(minDur, avg * 0.75);
    const capHi = Math.min(maxDur, avg * 1.35);
    duration = clamp(duration, capLo, capHi);
  }

  let keywordCards = parseKeywordCards((s as { keywordCards?: unknown }).keywordCards);
  const slateNamesNumbers = opts?.namesNumbersTitleCard === true;
  if (opts?.keywordPopStyle === 'off' && !slateNamesNumbers) keywordCards = undefined;
  else if (keywordCards) {
    keywordCards = keywordCards
      .map((k) => ({
        text: k.text.slice(0, 48),
        tStart: k.tStart,
        tEnd: k.tEnd,
      }))
      .filter((k) => k.text.length > 0);
    keywordCards = filterKeywordCardsByVoiceover(keywordCards, (s.voiceover ?? '').trim());
    if (!keywordCards?.length) keywordCards = undefined;
  }

  let imageCaption: string | undefined =
    typeof (s as { imageCaption?: unknown }).imageCaption === 'string'
      ? (s as { imageCaption: string }).imageCaption.trim()
      : undefined;
  if (!opts?.allowSparseImageText) {
    imageCaption = undefined;
  } else if (imageCaption) {
    if (imageCaption.length > 48) imageCaption = imageCaption.slice(0, 48);
    const vo = (s.voiceover ?? '').trim();
    imageCaption = filterImageCaptionToHighSignal(
      clampImageCaptionToVoiceover(vo, imageCaption),
      vo,
    );
    if (!imageCaption) imageCaption = undefined;
  }

  return {
    id: s.id ?? `shot_${id}`,
    role: s.role ?? '',
    description: (s.description ?? '').trim(),
    onScreen:
      opts?.directorShotOnScreenCopy === false ? '' : (s.onScreen ?? '').trim(),
    voiceover: (s.voiceover ?? '').trim(),
    eyebrow: s.eyebrow?.trim() || undefined,
    durationSeconds: duration,
    camera: (s.camera ?? 'static') as ShotCameraMove,
    framing: (s.framing ?? 'medium') as ShotFraming,
    lighting: s.lighting ?? 'natural light',
    palette: s.palette ?? 'neutral',
    subjectAction: s.subjectAction ?? '',
    lensHint: s.lensHint,
    speedRamp: (s.speedRamp ?? 'none') as ShotSpeedRamp,
    transitionOut: (s.transitionOut ?? (opts?.longform ? 'cross_dissolve' : 'hard_cut')) as ShotTransition,
    referenceIndices: s.referenceIndices ?? [],
    kind: (s.kind ?? preferredShotKind(theme)) as ShotKind,
    imageQuery: s.imageQuery?.trim(),
    focalX: clampOpt(s.focalX, 0, 1),
    focalY: clampOpt(s.focalY, 0, 1),
    keywordCards,
    imageCaption,
  };
}

function preferredShotKind(theme: PersonalTheme): ShotKind {
  // Slideshow / card themes default to image shots; video themes to ai_image
  // (cheap) with selected shots explicitly marked ai_video by the director.
  if (theme.template === 'slideshow' || theme.template === 'scripture-card') return 'scraped_image';
  if (theme.template === 'brainrot') return 'b_roll';
  if (theme.requiresGroundedImages) return 'scraped_image';
  return 'ai_image';
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function clampOpt(n: number | undefined, lo: number, hi: number): number | undefined {
  return n === undefined ? undefined : clamp(n, lo, hi);
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Prompt                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

function buildDirectorPrompt(args: DirectArgs): string {
  const sb = args.styleBible;
  const styleExamples = buildStyleExamplesPrompt(sb);
  const coreStyleBible = sb
    ? [
        '',
        'ACCOUNT STYLE BIBLE (match exactly — video title, hook VO, shot voiceovers, and caption must reflect this voice):',
        sb.vibe ? `- Vibe: ${sb.vibe}` : '',
        sb.dos && sb.dos.length > 0 ? `- Always do: ${sb.dos.join(' · ')}` : '',
        sb.donts && sb.donts.length > 0 ? `- Never do: ${sb.donts.join(' · ')}` : '',
        sb.palette && sb.palette.length > 0
          ? `- Brand palette (every shot should lean on these colours): ${sb.palette.join(', ')}`
          : '',
        sb.typography?.trim()
          ? `- Typography / on-screen text feel: ${sb.typography.trim()}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  const styleBibleBlock = [coreStyleBible.trim(), styleExamples.trim()].filter(Boolean).join('\n\n');

  const charBlock = args.characterGuide
    ? `\n\nON-CAMERA CHARACTER (this person appears in every AI-generated shot — describe them identically every time so the model keeps them consistent):\n- Name: ${args.characterGuide.name}\n${args.characterGuide.promptFragment ? `- Canonical look: ${args.characterGuide.promptFragment}\n` : ''}${args.characterGuide.voiceTone ? `- Voice tone: ${args.characterGuide.voiceTone}\n` : ''}${args.characterGuide.voicePace ? `- Pace: ${args.characterGuide.voicePace}\n` : ''}${args.characterGuide.catchphrases && args.characterGuide.catchphrases.length > 0 ? `- Catchphrases (sparingly): ${args.characterGuide.catchphrases.join(' · ')}` : ''}`
    : '';

  const refBlock = args.referenceMediaDigest
    ? `\n\nUSER REFERENCE LIBRARY (these images are available to pass into the video model as visual anchors — cite by index where relevant):\n${args.referenceMediaDigest}\n\nOnly cite a reference when it fits **this episode's topic** ("${args.topic.replace(/\s+/g, ' ').replace(/"/g, '\\"').slice(0, 200)}"); do not let random library thumbnails (food, travel, unrelated products) steer the script or shot subjects.`
    : '';

  const inspirationBlock = args.inspirationStyleBlock
    ? `\n\nINSPIRATION / STYLE REFERENCES (still images and/or short clips the account uploaded with roles "inspiration" or "style_reference"):\n${args.inspirationStyleBlock}\n\n**CRITICAL — LOOK ONLY, NOT A SECOND TOPIC:** These files define **palette, contrast, grain, lens character, typography personality, motion rhythm, and editorial cut feel**. They do **not** define what this episode is *about*. The episode subject is **only** "${args.topic}" (and the JSON title / hook you write for that topic). **Do not** import recurring subjects from the references (e.g. food, restaurants, hunting, unrelated travel) into \`description\`, \`voiceover\`, \`subjectAction\`, or \`imageQuery\` unless the **narration for this video** explicitly discusses those subjects. If a reference shows food but the topic is music, you still write a music story — borrow the **visual treatment**, not the food props.`
    : '';

  const viralFormatPromptBlock = args.viralFormatBlock
    ? `\n\n${args.viralFormatBlock}`
    : '';

  const hookFormulaBlock = args.hookFormulaDirective
    ? `\n\n${args.hookFormulaDirective}\n${
        args.directorShotOnScreenCopy === false
          ? "The first shot's **voiceover** must follow this hook formula (keep JSON `onScreen` as \"\" on every shot — satisfy any on-screen wording in voiceover only)."
          : "The first shot's voiceover + onScreen must follow this hook formula."
      }`
    : '';

  const newsBlock = args.newsContext
    ? `\n\nGROUNDED CONTEXT (headlines / wiki — cite only facts present here **that clearly relate to the episode topic** "${args.topic}"):\n${args.newsContext}\n\nIf any headline or paragraph reads **off-topic** compared to "${args.topic}", **ignore it completely** — do not let unrelated domains (food, travel, other hobbies) appear in hook, voiceovers, descriptions, or imageQuery.`
    : '';

  const blacklist =
    args.blacklist && args.blacklist.length > 0
      ? `\n\nNEVER mention or imply: ${args.blacklist.join(', ')}.`
      : '';

  const multiActHint = args.allowMultiAct
    ? '\n- For topics like process/transformation/before-after, split the storyboard into 2-3 ACTS (e.g. Before → Progress → After, or Setup → Reveal → Payoff). Each act has 1-2 beats, and each beat has 1-3 shots.'
    : '\n- Use a single act for this topic.';

  /* ── Long-form mode ─────────────────────────────────────── */
  // In long-form mode we swap the "5-10 shots" rule for a chapter-
  // structured storyboard. Each act == one chapter, and we expect
  // 4-10 chapters × 4-7 shots. A dedicated visual-style preset gets
  // injected so every AI shot shares the same animated look.
  const longform = args.longform?.enabled === true;
  const longformTarget = args.longform?.targetDurationSeconds ?? args.targetDurationSeconds;
  const longformChapterCount = longformTarget
    ? clamp(Math.round(longformTarget / 45), 4, 10)
    : 6;
  // Shots per chapter scales with total duration so an 8-minute video
  // gets ~60 shots (10 × 6), not 40. Math: target / (chapters * avgShotSec).
  const avgShotSec = 7;
  const shotsPerChapterTarget = Math.max(
    3,
    Math.min(8, Math.round(longformTarget / (longformChapterCount * avgShotSec))),
  );
  const totalShotTarget = longformChapterCount * shotsPerChapterTarget;
  const animStyle = args.longform?.animationStyle ?? 'custom';
  const animStyleBlock = longform
    ? buildAnimationStyleBlock(animStyle)
    : '';
  const longformRules = longform
    ? [
        '',
        `LONG-FORM RULES (video target: ${longformTarget}s ≈ ${Math.floor(longformTarget / 60)} min ${longformTarget % 60 ? `${longformTarget % 60}s` : ''}):`,
        `- Plan ${longformChapterCount} CHAPTERS (each chapter = one act). Each chapter has 1 beat with ${shotsPerChapterTarget - 1}-${shotsPerChapterTarget + 1} shots. Target ≈ ${totalShotTarget} total shots.`,
        `- TARGET RUNTIME: each shot 5-10 seconds. Establishing / reveal shots may go up to 12s. The sum of all shot durationSeconds MUST be close to ${longformTarget} seconds (±15%).`,
        '- Give every act a short human "chapter name" (4-8 words) and set `eyebrow` on the first shot of each chapter to that name — the stitcher burns it in as a chapter title card.',
        '- Narration is continuous across shots — treat the video as a real narrated documentary, not a burst of hooks. Voiceover averages 18-25 spoken words per shot so the narrator pace stays natural (around 140-150 words per minute).',
        '- Maintain CHARACTER + SETTING continuity across every chapter. Re-describe the character (appearance, clothing, setting) in every single shot description. The AI model has no memory between shots.',
        '- Only 1-2 shots per chapter should be `ai_video` (motion-critical moments, e.g. running, dancing, fire crackling). The rest should be `ai_image` — they animate at render with Ken Burns and still read as your chosen animation style.',
        '- Transition default in long-form is `cross_dissolve` for gentle chapter-internal cuts and `dip_to_black` between chapters. Save `hard_cut` for dramatic reveals.',
      ].join('\n')
    : '';

  const pace = args.cutPace ?? 'normal';
  const shotCountRule = longform
    ? pace === 'rapid'
      ? `- Plan approximately ${Math.round(totalShotTarget * 1.12)} SHOTS total across ${longformChapterCount} chapters — RAPID PACING: favour 3-7s shots, frequent cuts, still land near the ${longformTarget}s runtime target (±15%).`
      : `- Plan approximately ${totalShotTarget} SHOTS total across ${longformChapterCount} chapters. Keep every shot 5-10 seconds. The sum of shot durations must be close to the ${longformTarget}s target.`
    : (() => {
        const { min, max } = directorShotCountRange({
          targetDurationSeconds: args.targetDurationSeconds,
          averageShotSeconds: args.averageShotSeconds,
          cutPace: pace,
        });
        const acHint =
          args.averageShotSeconds != null && Number.isFinite(args.averageShotSeconds)
            ? args.averageShotSeconds.toFixed(2)
            : '3';
        const tightPace =
          args.averageShotSeconds != null &&
          Number.isFinite(args.averageShotSeconds) &&
          args.averageShotSeconds <= 3;
        return [
          `- Plan **${min}–${max}** SHOTS total for ~${args.targetDurationSeconds}s target runtime (on-screen average ≈${acHint}s — **vary** each shot's \`durationSeconds\`; never the same value on every shot).`,
          ...(tightPace
            ? [
                `- **Low average clip (${acHint}s):** treat **${max}** shots as the planning target (not the minimum ${min}) unless the format truly needs fewer — otherwise each image stays on screen far longer than the pacing setting after narration is synthesized.`,
              ]
            : []),
          '- Write **different-length** \`voiceover\` lines per shot so final audio can drive cut timing (dense line = shorter beat, explanatory line = longer beat).',
          `- If you output fewer than ${min} shots, the edit cannot match the full narration — split acts into more beats/shots instead of stretching a handful of clips.${multiActHint}`,
        ].join('\n');
      })();

  const aiImageFactsOnly =
    args.allowSparseImageText === true && (args.keywordPopStyle ?? 'off') === 'off';

  const namesNumbersSlateBlock =
    !aiImageFactsOnly && args.namesNumbersTitleCard === true
      ? `\n\nNAMES & NUMBERS SLATE POPUPS (**enabled** — small **lower-third** cards only: light panel + dark type in post via FFmpeg, **not** burned into AI pixels; never full-screen, never paragraphs):\n` +
        `- Add \`keywordCards\` only when a **high-signal** proper noun, date, year, place, headline figure, currency, %, or age appears in this shot's \`voiceover\` and seeing it briefly helps comprehension.\n` +
        `- **Hard rule:** each \`keywordCards[].text\` MUST be **spoken in this shot's \`voiceover\`** — copy the exact words or digit string from that line (same spelling). The render pipeline **discards** cards that do not match the VO; never add names, stats, or dates the narrator does not say on this beat.\n` +
        `- **People, places, numbers:** mirror how that line is spoken — same **digits** if you read numbers aloud (\`2024\` not \`twenty twenty-four\` unless the VO literally says the words), same **place/person** wording (light punctuation differences are OK). Do not use a synonym the VO never says on this shot (e.g. card \`America\` when the line only says \`United States\`).\n` +
        `- **Each card:** **1–3 words** (Title Case for names) OR one compact stat (\`"76%"\`, \`"$4.2T"\`). Never a phrase longer than three words; never duplicate the full hook/title.\n` +
        `- **Max 2 cards per shot.** Do not repeat the same token on the **next** shot unless the VO reframes it materially.\n` +
        `- **Global dedupe:** do not flash the **same** \`keywordCards.text\` again on a later shot unless **at least ~5 shots** have passed **and** the fact is genuinely new context — otherwise repeats read like a rendering bug.\n` +
        `- **Timing:** \`tStart\` / \`tEnd\` = seconds from **this shot's** start (0 = first frame). Prefer the **middle half** of the shot (when the fact is spoken); avoid hugging the first/last 12% of the shot body. Each flash **~0.35–0.9s** — snappy. Windows must **not overlap**. If unsure, omit timings and the stitcher auto-centres flashes.\n` +
        `- **Look:** concise sans-serif feel consistent with the edit's \`editPlan.colourGrade\` mood (neutral documentary — not neon, not meme fonts).\n` +
        `- **Skip** low-value tokens, filler, opinion with no figure, and anything already obvious from the picture.\n` +
        `- **Density:** ${args.keywordPopStyle === 'bold' ? 'Bold — fewer pops, only the sharpest anchors.' : 'Subtle — default to one card or none unless the VO is dense with facts.'}`
      : '';

  const keywordBlock = aiImageFactsOnly
    ? ''
    : args.namesNumbersTitleCard === true
      ? namesNumbersSlateBlock
      : args.keywordPopStyle && args.keywordPopStyle !== 'off'
        ? `\n\nKEYWORD POP-UPS (premium lower-thirds — NOT full captions):\n- On roughly **25–40%** of shots, add optional \`keywordCards\`: max **2** entries; each \`text\` is 1–3 words OR a compact stat (e.g. "Kyoto" or "$4.2T"). Never sentences.\n` +
        `- **Hard rule:** \`keywordCards[].text\` MUST be **spoken in that shot's \`voiceover\`** (same words/digits). The server **drops** cards that are not grounded in the VO — never flash context the narrator does not say on this beat.\n` +
        `- **People, places, numbers:** mirror that line's VO (digits if you read digits aloud; same city/person wording). Light punctuation differences are OK; synonyms the VO never says on this shot are not.\n` +
        `- \`tStart\` / \`tEnd\`: seconds **from this shot's start only** (never cumulative time from the start of the whole video). Prefer the **middle half** of the shot when the fact is spoken; avoid the first/last ~12% of the shot unless the fact truly lands there. Each flash **~0.35–0.85s**, non-overlapping. If unsure, omit timings — the stitcher auto-places.\n- **Global dedupe:** never repeat the **same** \`text\` on a later shot unless **≥ ~5 shots** later and the label is clearly a new context — duplicate labels feel broken.\n- Do not repeat words already in \`onScreen\` or duplicate tokens already in the same shot's \`voiceover\` line.\n- Visual tier: ${args.keywordPopStyle === 'bold' ? 'BOLD — high contrast, occasional single-word punch.' : 'SUBTLE — refined documentary / broadcast look.'}`
        : '';

  const sparseTextBlock =
    args.allowSparseImageText && aiImageFactsOnly
      ? `\n\nON-IMAGE FACT LABELS ONLY (\`imageCaption\` — **this account**; the **image model** paints text into pixels — **no FFmpeg keyword pops**, no slate cards — **omit \`keywordCards\` entirely** for every shot):\n` +
          `- **Default = no text:** Most stills must have **zero** painted type. Only add \`imageCaption\` when the VO states a **memorable fact viewers must retain** (date, year, person name, place name, money, %, acronym). If unsure, **omit**.\n` +
          `- **Narration only — never picture labels:** \`imageCaption\` must be a **verbatim substring** of that shot's \`voiceover\` (the spoken script line). It is **not** a title for the frame, not a mood line, not "what we see" (\`Forest trail\`, \`Busy kitchen\`, \`Sunset city\`, \`Scientist at work\`) unless those **exact** words are spoken in \`voiceover\`. If you cannot copy 1–4 words straight from \`voiceover\`, **omit** \`imageCaption\`.\n` +
          `- **Short & snappy:** **1–3 words** whenever possible (max 4). Pick the **most memorable** noun/verb/number chunk from that line — not a whole clause unless unavoidable.\n` +
          `- **Unique per shot:** never reuse the **exact same** \`imageCaption\` string on another shot; each labelled still needs its **own** phrase from **that** line only. If two beats would share the same label, **omit** on one of them.\n` +
          `- **One clear purpose per still:** every \`ai_image\` must show a **different** story beat and composition from the shot before and after — no filler wallpaper, no near-duplicate angles.\n` +
          `- **Server quality bar:** labels that are only vague filler or scene nouns (no names, numbers, money, acronyms, or sharp proper nouns) are **removed** — **omit** \`imageCaption\` rather than forcing weak type.\n` +
          `- **Digits and symbols:** When the VO states a stat, copy the **exact** digit string and symbols from that line (\`76%\` vs \`76 percent\`, \`$4.2T\` vs words) — never a different number or format than the narrator uses on this beat.\n` +
          `- **Script source only:** Do **not** invent labels from \`description\`, props, or "what would look good on screen". \`description\` only decides **where** type sits (sign, ticket, phone); **wording** is always from \`voiceover\`.\n` +
          `- **Sparse:** use \`imageCaption\` on **at most ~15–20%** of \`ai_image\` shots — **most** \`ai_image\` shots must have **no** \`imageCaption\` field (or empty). Never label every still.\n` +
          `- **Density check:** if you are unsure, **omit** — **≥ ~80%** of \`ai_image\` frames in the whole storyboard should have **no** \`imageCaption\` at all.\n` +
          `- **Max 4 words** when set. Never title, hook, channel name, or style-bible examples.\n` +
          `- **Inspiration:** when reference stills show typography, **match that lettering style** (serif vs sans, weight, case, colour); do not default to generic "bold tech sans" unless the refs look like that.\n` +
          `- Omit when the same words are already visible in the scene or the shot is not \`ai_image\`.`
      : args.allowSparseImageText
        ? `\n\nON-IMAGE INFORMATION LABELS (\`imageCaption\` — **enabled** for this account; the **image model** paints text into the pixels — **no** FFmpeg lower-thirds or keyword pops for these facts):\n- **Default = no text:** omit \`imageCaption\` on **most** shots. Only burn type when **this shot's** voiceover states a memorable **proper noun or number** viewers must retain — **dates, years, people's names, places, money, %, ages**.\n` +
            `- **Narration only:** \`imageCaption\` must be words **spoken in that shot's \`voiceover\`** — not a visual caption of the photo (\`Mountain vista\`, \`Coffee close-up\`) unless the narrator literally says those words on this line.\n` +
            `- When set: max **4 words**, prefer **1–3**. Examples of valid labels: "June 6, 1944", "Marie Curie", "Lagos", "$4.2T", "76%".\n` +
            `- **Short & snappy:** prefer **1–3 words**; never paste a long clause. **Never** reuse the exact same \`imageCaption\` on two shots.\n` +
            `- **Server quality bar:** if the line has no strong name/number/keyword worth burning in, **omit** \`imageCaption\` — the server strips filler-only phrases.\n` +
            `- **Digits:** copy stats **exactly** as spoken on that line (same digits and symbols); do not round, reformat, or substitute a synonym for a place or name.\n` +
            `- **Hard rule:** \`imageCaption\` MUST repeat **words or digits actually spoken in that shot's \`voiceover\`** (same line). The server **strips** labels that are not in the VO.\n` +
            `- **Never** put the video JSON \`title\`, hook line, channel name, or **any** style-bible example headline/script line into \`imageCaption\` — those are not spoken facts and become random on-screen junk.\n` +
            `- **Composition:** Prefer a shot \`description\` where the label has a believable in-world anchor (signage, device screen, ticket, map tag, magazine line, museum placard) — avoid "text floating on empty sky".\n` +
            `- **Inspiration:** When the account's media library includes reference stills that show on-image typography, plan labels so generated stills can **echo that lettering style** (weight, colour, case) while staying on-topic.\n` +
            `- Prefer \`ai_image\` for shots that need a fact label when the story allows (labels are not applied to scraped stock or user clips).\n` +
            `- Use sparingly when VO is fact-dense (roughly ≤20% of \`ai_image\` shots). Omit when the frame already shows the same text, or the shot is not \`ai_image\`.`
        : '';

  const sparseDirectingRule = args.allowSparseImageText
    ? aiImageFactsOnly
      ? '- **imageCaption / keywordCards:** AI-in-image labels only — **no \`keywordCards\`**; \`imageCaption\` = **verbatim high-signal snippet of that shot\'s \`voiceover\` only** (~≤20% of ai_image), never a visual description of the frame; **default omit**.\n'
      : `- **imageCaption:** narration words only — never a "scene title" or picture caption unless those words are spoken in **that shot's** VO; **omit by default** unless a date/name/stat must stick.\n`
    : '- **On-image text:** do **not** plan painted words/numbers on stills unless an \`imageCaption\` is explicitly warranted; prefer clean photography with no typography.\n';

  const imageCaptionJsonLine = args.allowSparseImageText
    ? aiImageFactsOnly
      ? '              "imageCaption": "<ai_image only, usually omit: 1–3 high-signal words — name / place / number / stat from THIS shot voiceover only; omit if nothing worth burning in; omit keywordCards>"'
      : '              "imageCaption": "<ai_image only: ≤4 words, ONLY a date/year/name/place/stat explicitly spoken in THIS shot\'s voiceover — never title/hook/example lines; usually omit>"'
    : '              "imageCaption": "<omit on nearly all shots — only rare ≤4-word fact if absolutely needed>"';

  const namesNumbersDirectingRule = aiImageFactsOnly
    ? '- **Fact text on screen:** this account uses **AI in-image labels only** — **omit \`keywordCards\`** on every shot; do not plan FFmpeg lower-thirds.\n'
    : args.namesNumbersTitleCard === true
      ? '- **Names & numbers slate popups:** obey NAMES & NUMBERS SLATE POPUPS — short lower-third flashes only; never open with a title slate.\n'
      : '';

  const avgClipOperatorRule =
    args.averageShotSeconds != null &&
    Number.isFinite(args.averageShotSeconds) &&
    args.averageShotSeconds > 0
      ? `- **Avg seconds per clip (~${args.averageShotSeconds.toFixed(2)}s):** centre most \`durationSeconds\` around ~${(args.averageShotSeconds * 0.88).toFixed(1)}–${(args.averageShotSeconds * 1.18).toFixed(1)}s unless that line of VO clearly needs more air; do not systematically overshoot without narrative reason — the stitcher enforces this band when stretching to voice.\n`
      : '';

  const visualPurposeRule =
    '- **Every shot earns the cut:** each \`description\` (and scraper \`imageQuery\` when used) must advance a **new** idea aligned with that shot\'s \`voiceover\` — no run of near-duplicate frames for the same beat. If the story does not need another angle, merge beats instead of padding with redundant \`ai_image\` / \`ai_video\`.\n' +
    '- **No filler stills:** every \`ai_image\` must change **at least one** of: primary subject, setting/location, time-of-day or mood, or **information** shown (prop, document, map era) vs the prior still — not a near-identical re-render with a tiny crop tweak.\n' +
    '- **Script-locked visuals:** a viewer should infer what this line of \`voiceover\` is about from \`description\` alone — no generic stock mood that could apply to any line. If the VO names a place, object, era, or action, the frame must show that (or a clear metaphor the beat explains), not unrelated beauty shots.\n' +
    '- **Single episode subject:** the entire storyboard is for **one** topic: "' +
    args.topic.replace(/\s+/g, ' ').replace(/"/g, '\\"').slice(0, 200) +
    '". Title, hook, every voiceover line, and every \`imageQuery\` must stay in that lane — never merge beats or B-roll from a different video idea.\n' +
    '- **Consecutive shots must differ:** back-to-back shots may not share the same "hero object + same framing + same room corner" — change at least **two** of: primary subject in frame, scale (e.g. wide → detail), camera move, setting zone, or time/mood beat. Avoid "same scene, tiny tweak" slideshows.\n' +
    '- **Image-prompt uniqueness (hard):** consecutive \`ai_image\` / \`ai_video\` \`description\` (+ \`subjectAction\` / \`imageQuery\`) must **not** be near-paraphrases of each other. If two adjacent briefs could feed the same image model prompt, rewrite the later one with a new hero subject, location detail, or scale. Do not reuse the same noun stack with only adjective swaps.\n' +
    '- **Cinematography grid:** for consecutive \`ai_image\` / \`ai_video\` shots, **never** reuse the same \`camera\` + \`framing\` + \`lighting\` triple as the previous shot — change at least one field clearly (prefer two). Alternate wide vs close, static vs moving camera, and warm vs cool light when the story allows so the edit does not look like one repeated still.\n' +
    '- **On-image text:** default is **no painted type**. If you use \`imageCaption\`, it must be **unique** to that shot (never the same string twice) and a high-signal fact from **that** line (date/name/stat) — not filler text that could belong to any frame.\n';

  const narrationQualityRule =
    '- **Narration quality:** Hook and every \`voiceover\` line must **earn** the listen — concrete **nouns, verbs, and facts** (who, where, what changed, how much). Ban vague hype ("insane", "you won\'t believe", "crazy", "wild") unless the style bible demands that register. Avoid filler stacks ("this thing", "that stuff", "something about"). **Vary** how adjacent lines **start**; do not chain many lines that all open with "So…", "And…", or "But…". Prefer active voice; cut throat-clearing ("ok so basically", "here\'s the thing") unless the account voice is explicitly casual that way.\n' +
    '- **Outro + caption:** \`outro\` = one decisive CTA line (no ramble). \`caption\` is the **YouTube description** under the video — **short**, scannable, and built to help get clicks/views (see caption rules below). No hashtag stuffing in the prose; keep \`hashtags\` short and on-topic in the separate array.\n';

  const youtubeCaptionRules = longform
    ? `\n\nTOP-LEVEL JSON "caption" (YouTube description — required for long-form):\n` +
      `- Keep it **tight**: **2 short paragraphs** (~280–700 characters of prose). Prefer shorter over longer.\n` +
      `- **Line 1 (above the fold):** curiosity + value in plain language — what the viewer gets / the surprising angle. Front-load keywords that match the title/topic (YouTube search + the truncated preview).\n` +
      `- **Line 2:** 2–4 concrete takeaways or beats (specific nouns/numbers) — not a full transcript summary.\n` +
      `- End with one soft CTA (subscribe / comment a take / watch next) in the account voice.\n` +
      `- Write for **clicks and retention framing**, not an essay: no "In this video we will…", no filler, no emoji spam (≤2 total if any).\n` +
      `- **Do not** put hashtags in the caption prose — use the \`hashtags\` array only.\n`
    : `\n\nTOP-LEVEL JSON "caption" (YouTube / Shorts description):\n` +
      `- **1–2 short sentences** (~120–320 characters). First sentence must stand alone as a hook that makes someone click or keep watching.\n` +
      `- Front-load the topic keywords; add one concrete detail or payoff teaser; optional soft CTA.\n` +
      `- No essay, no "In this video…", ≤2 emoji, no hashtags in the prose (use \`hashtags\` array).\n`;

  const locked = args.lockedVideoTitle?.trim();
  const exampleTitleCount = (args.styleBible?.exampleVideoTitles ?? []).filter(Boolean).length;
  const titleFirst =
    locked && locked.length > 0
      ? ''
      : buildTitleFirstWorkflowPrompt(args.styleBible, args.recentVideoTitles);
  const lockedTitleBlock =
    locked && locked.length > 0
      ? `\n\nLOCKED TITLE — JSON "title" must be this exact string (do not edit):\n<<< ${locked} >>>\nThis string was generated to match the account’s **example video titles** (format + register). Hook and shots must match this title and the topic; DEFAULT VOICE below is for narration — do not reinterpret the title.\n`
      : '';
  const titleJsonLine =
    locked && locked.length > 0
      ? `  "title": ${JSON.stringify(locked)},`
      : `  "title": "${
          exampleTitleCount > 0
            ? '<one line — STRICT: same format and content register as STYLE example titles for THIS topic; must differ from ALREADY-PUBLISHED; theme voice is NOT a different title format>'
            : '<5-9 words>'
        }",`;
  const targetForPrompt = longform ? longformTarget : args.targetDurationSeconds;

  const onScreenPolicyBlock =
    args.directorShotOnScreenCopy === false
      ? '\n\n**SHOT `onScreen` — DISABLED BY ACCOUNT:** use an empty string ("") on **every** shot. Do not put facts, hooks, titles, or branding text in `onScreen`. Visible wording for names / places / numbers must come only from `keywordCards` (lower-thirds, when enabled) and/or `imageCaption` (on-image labels, when enabled) — never duplicate those into `onScreen`.'
      : '';

  return `You are a ${longform ? 'long-form video' : 'short-form video'} DIRECTOR, not a script writer. Plan a storyboard for a ${targetForPrompt}s ${args.theme.name} video on topic: "${args.topic}".
${titleFirst}${lockedTitleBlock}
THEME: ${args.theme.name} — ${args.theme.tagline}
DEFAULT VISUAL STYLE: ${args.theme.visualStyle}
DEFAULT VOICE: ${args.theme.voiceGuide}
PREFERRED PLATFORMS: ${args.theme.preferredPlatforms.join(', ')}${styleBibleBlock}${charBlock}${refBlock}${inspirationBlock}${viralFormatPromptBlock}${hookFormulaBlock}${newsBlock}${blacklist}${animStyleBlock}${longformRules}${args.customDirection ? `\n\nACCOUNT-LEVEL DIRECTION: ${args.customDirection}` : ''}${args.promptAppendix ? `\n\n${args.promptAppendix}` : ''}${keywordBlock}${sparseTextBlock}${onScreenPolicyBlock}

DIRECTING RULES (non-negotiable):
${shotCountRule}
${narrationQualityRule}${avgClipOperatorRule}${visualPurposeRule}${namesNumbersDirectingRule}${sparseDirectingRule}- **\`role\` on every shot:** one short label (e.g. "Hook proof", "Counter-evidence", "Payoff reveal") — not generic "shot 3"; image prompts use it so each still has a **clear editorial purpose**.
- Give every shot a CONCRETE subject action (verb + object), a camera move, a framing, a lighting description, and a palette. Abstract = slop.
- Use intentional CUTS. Default transition is 'hard_cut'. Save 'whip_pan' / 'match_cut' / 'flash_cut' for moments that earn them.
- Reuse the SAME character / setting descriptors across shots so AI models keep consistency. Don't say "a woman" once and "she" the next shot — re-describe every time.
- When reference stills/clips or character sheets are passed into models, treat them as **continuity anchors only** — never plan shots that simply remake a reference frame (same pose, crop, and layout). Each shot must be a new editorial frame in the same visual world.
- **Inspiration media are not a second script:** style/inspiration uploads control **look** (colour, light, grain, lens). They do **not** override the episode topic — do not steer the story toward whatever objects happen to appear in those reference files unless the VO is literally about them.
- Mark each shot as ONE of: ai_video (expensive — use sparingly for money-shots and motion-critical moments), ai_image (cheap, animated at render with Ken Burns), scraped_video, scraped_image, user_media, b_roll.
- Cap ai_video to at most ${args.maxAiVideoShots ?? (longform ? 5 : 3)} per storyboard. Use ai_image or scraped_image for the rest.
- If user references (character refs) are relevant to a shot, add their index to \`referenceIndices\`. The video model will use them to anchor identity.
- No LLM slop phrases: "let's dive in", "in the realm of", "unleash", "game-changer", "cutting-edge", "paradigm shift", "mind-blowing". If you use any, the video is rejected.
- Every beat teaches ONE unambiguous thing. No filler.
- **Hook vs first shot VO:** The top-level \`hook\` is spoken once as the cold open. The first shot's \`voiceover\` must **continue** the story — never repeat the hook, echo its opening sentence, or paraphrase the same opening line; write only what comes next (the pipeline strips exact duplicates, but near-duplicates still sound broken in audio).

SHOTS GRAMMAR (camera):
static, slow_push_in, slow_pull_out, dolly_in, dolly_out, pan_left, pan_right, tilt_up, tilt_down, orbit, handheld, whip_pan, crash_zoom, crane_up, crane_down, fpv_sweep, tracking, bullet_time.

SHOTS GRAMMAR (framing):
extreme_wide, wide, medium_wide, medium, medium_close, close_up, extreme_close_up, over_the_shoulder, top_down, low_angle, high_angle.

SHOTS GRAMMAR (transition out):
hard_cut (default), match_cut, whip_pan, dip_to_black, cross_dissolve, flash_cut, jump_cut, none.
${longform && !locked ? `\n\nTOP-LEVEL JSON "title" (no saved example titles — operator must still get a **feed-shaped** headline):\n- One short line (~55–75 characters): curiosity question ("How…?", "What…?") or one blunt claim — same energy as short educational YouTube.\n- **Do not** use two-part "Label: subtitle" / episode / podcast season packaging (e.g. "Winter Cache: How…") — that reads like TV seasons, not this product's title style.\n` : ''}
${youtubeCaptionRules}
OUTPUT contract — return ONLY JSON:
{
${titleJsonLine}
  "hook": "<opening line ≤3s: one sharp claim or curiosity; concrete nouns; no stacked clichés>",
  "outro": "<closing CTA, one sentence>",
  "caption": "${longform ? '<YouTube description: 2 short paragraphs, ~280–700 chars, hook first + takeaways + soft CTA>' : '<YouTube/Shorts description: 1–2 sentences, ~120–320 chars, keyword-front hook>'}",
  "hashtags": ["tag", ...],
  "editPlan": {
    "pacing": "slow|medium|fast",
    "colourGrade": "<one line>",
    "musicCue": "<optional build / drop hint>",
    "defaultTransition": "hard_cut|match_cut|whip_pan|cross_dissolve",
    "useGrain": true|false,
    "letterbox": true|false
  },
  "acts": [
    {
      "id": "act_0",
      "name": "Before",
      "intent": "<why this act exists>",
      "beats": [
        {
          "id": "beat_0_0",
          "title": "<short>",
          "phase": "hook|before|during|after|reveal|payoff|outro",
          "references": [
            { "role": "character", "imageUrl": "<pass-through from refs above if relevant>", "description": "..." }
          ],
          "shots": [
            {
              "id": "shot_0_0_0",
              "role": "<narrative role>",
              "description": "<1–2 sentences: one decisive visual moment that **only** illustrates THIS shot's voiceover — specific place/prop/era/people; not generic mood wallpaper>",
              "onScreen": "<3-8 words OR empty>",
              "voiceover": "<one spoken line: one clear idea; specific nouns/verbs; no filler — OR empty>",
              "eyebrow": "<optional chapter label>",
              "durationSeconds": 3,
              "camera": "slow_push_in",
              "framing": "medium_close",
              "lighting": "<specific>",
              "palette": "<specific>",
              "subjectAction": "<verb + object>",
              "lensHint": "<optional: shallow depth of field, 35mm>",
              "speedRamp": "none|slow_mo|speed_up|freeze_end",
              "transitionOut": "hard_cut",
              "referenceIndices": [0],
              "kind": "ai_video|ai_image|scraped_video|scraped_image|user_media|b_roll",
              "imageQuery": "<only when kind is scraped_*>",
              "focalX": 0.5,
              "focalY": 0.55,
              "keywordCards": [{"text": "Paris", "tStart": 0.4, "tEnd": 1.2}],
              ${imageCaptionJsonLine}
            }
          ]
        }
      ]
    }
  ]
}

If the topic is unsafe (medical advice, legal counsel, weapons, CSAM, explicit violence) respond with: { "blocked": true, "blockReason": "..." }`;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Prompt builder for individual shots                                  */
/* ═══════════════════════════════════════════════════════════════════ */

/** YouTube-style cover recipes — hashed from variationKey so each regen is unique. */
const THUMBNAIL_COVER_RECIPES: readonly {
  framing: ShotFraming;
  lighting: string;
  lensHint: string;
  composition: string;
}[] = [
  {
    framing: 'medium_close',
    lighting: 'hard key from camera-left, deep shadow falloff, subject pops at phone size',
    lensHint: '85mm portrait shallow depth — subject razor-sharp, background soft bokeh',
    composition: 'Hero fills left two-thirds; clean negative space on the right for type',
  },
  {
    framing: 'close_up',
    lighting: 'bright rim + soft fill; high-contrast face or object edge against dark ground',
    lensHint: '50mm close — intimate detail, zero clutter behind the subject',
    composition: 'Tight single-subject punch; eyes or focal prop dead-readable at thumbnail scale',
  },
  {
    framing: 'low_angle',
    lighting: 'uplight + sky or bright ceiling backlight; heroic silhouette energy',
    lensHint: '35mm low angle — monumental subject, clear sky/negative space above',
    composition: 'Subject rises into frame; bold graphic shape, not a flat eyeline selfie',
  },
  {
    framing: 'medium',
    lighting: 'clean three-quarter key, saturated accent colour in mid-ground only',
    lensHint: '40mm — environment readable but subject still dominates',
    composition: 'Rule-of-thirds hero; one prop telling the topic story, no busy collage',
  },
  {
    framing: 'high_angle',
    lighting: 'overhead soft box look — even, bright, product/scene clarity',
    lensHint: 'top-down 28mm — organised tabletop or scene layout',
    composition: 'Bird’s-eye story beat; shapes and colour blocks read as icons at small size',
  },
  {
    framing: 'wide',
    lighting: 'golden-hour sidelight or strong single practical; cinematic contrast',
    lensHint: '24mm wide — one clear silhouette against a simple background',
    composition: 'Graphic wide: subject as a bold shape; empty sky/wall for short title type',
  },
  {
    framing: 'extreme_close_up',
    lighting: 'specular highlights on texture; macro clarity',
    lensHint: 'macro / 100mm — tactile detail (hands, tool, fabric, screen glow)',
    composition: 'One texture or gesture carries the hook — no competing elements',
  },
  {
    framing: 'medium_close',
    lighting: 'neon or coloured practicals vs cool ambient — pop colour vs neutrals',
    lensHint: 'anamorphic hint, slight flare, subject locked sharp',
    composition: 'Asymmetrical; coloured light streaks leave a clean type zone',
  },
];

export function thumbnailCoverRecipeForVariation(variationKey: string): (typeof THUMBNAIL_COVER_RECIPES)[number] {
  const h = cheapStringHash((variationKey || 'cover').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'cover');
  return THUMBNAIL_COVER_RECIPES[h % THUMBNAIL_COVER_RECIPES.length]!;
}

/**
 * Synthetic still used only for cover/thumbnail generation — same schema as
 * in-video {@link DirectorShot} so {@link shotToPrompt} matches shot sourcing.
 */
export function personalThumbnailCoverShot(args: {
  topic: string;
  /** Short line only — rendered as large simple type when set (1–3 words). */
  coverText?: string | undefined;
  /** Regenerates hash into a distinct composition recipe. */
  variationKey?: string | undefined;
}): DirectorShot {
  const topicTrim = args.topic.replace(/\s+/g, ' ').trim().slice(0, 180) || 'the video subject';
  const recipe = thumbnailCoverRecipeForVariation(args.variationKey ?? randomUUID());
  const cover = args.coverText?.replace(/\s+/g, ' ').trim().slice(0, 20).replace(/"/g, "'");
  return {
    id: `thumb_${randomUUID()}`,
    role: 'thumbnail_cover',
    description:
      `Premium click-worthy cover still — ONE clear hero subject about «${topicTrim}», same world as the edit, never generic stock. ` +
      `${recipe.composition}. Ultra-sharp primary focus; background simplified so the image reads in under a second at phone size.`,
    onScreen: '',
    voiceover: '',
    durationSeconds: 3,
    camera: 'static',
    framing: recipe.framing,
    lighting: recipe.lighting,
    palette: 'bold, high-contrast, cohesive with reference stills — subject separates cleanly from background',
    subjectAction: `Iconic single moment that sells the topic: ${topicTrim}`,
    lensHint: recipe.lensHint,
    speedRamp: 'none',
    transitionOut: 'hard_cut',
    referenceIndices: [],
    kind: 'ai_image',
    imageCaption: cover && cover.length >= 2 ? cover : undefined,
  };
}

/**
 * Builds a cinematographer-grade text prompt for a single shot from the
 * structured fields on DirectorShot. This is the string we send to
 * Sora / Veo / Kling / Higgsfield for that shot.
 *
 * Strategy: separate IMAGE / IDENTITY / MOTION into distinct clauses
 * exactly the way Higgsfield + Segmind recommend for the cleanest output.
 */
export function shotToPrompt(args: {
  shot: DirectorShot;
  themeVisualStyle: string;
  styleBibleVibe?: string;
  characterFragment?: string;
  globalColourGrade?: string;
  /**
   * Distilled inspiration style hint ("editorial food photography, moody
   * low-light…"). When set, prepended to every AI shot prompt as a hard
   * brand-language lock so the generator mirrors the account references.
   */
  inspirationStyleHint?: string;
  /**
   * Long-form animation style preset ("flat 2D cartoon, bold outlines…").
   * Prepended with inspiration as the opening style lock for every AI shot.
   */
  animationStyleHint?: string;
  /** Title/copy/motif hints from the style bible for image+video models. */
  shotBrandHints?: string;
  /**
   * When true, prompt is tuned for a video cover / thumbnail still (same brand
   * language as in-video shots; optional large title via `shot.imageCaption`).
   */
  thumbnailCoverMode?: boolean;
  /** Random id fragment so each regenerate gets a distinct composition brief. */
  thumbnailVariationKey?: string;
  /**
   * When {@link DirectorShot.imageCaption} is set (on-image fact labels mode),
   * appended to the image prompt so typography matches style bible / inspiration.
   */
  factLabelImagePromptExtra?: string;
  /**
   * 1-based index in storyboard order — image/video prompts use this to discourage
   * near-duplicate consecutive frames.
   */
  timelineShotIndex?: number;
  /** Total AI / timeline shots in this storyboard (omit or 0 to skip timeline cue). */
  timelineShotTotal?: number;
  /**
   * Act / beat labels from the flattened storyboard. Used when this shot has no
   * `voiceover` line so image models still anchor to the story arc (not random stock).
   */
  storyStructureHint?: string;
  /** Planner topic for this post — prevents style refs from hijacking subject matter. */
  seriesTopic?: string;
  /** Storyboard `title` — must align with topic and narration. */
  episodeTitle?: string;
  /**
   * Storyboard `durationSeconds` for this shot (after VO repartition) — hints composition
   * pacing so the image matches how long the line will read on screen.
   */
  plannerHoldSeconds?: number;
  /**
   * Short recap of the previous timeline shot (description + prior on-image label).
   * Forces a clearly different composition and label from the prior cut.
   */
  previousShotOneLiner?: string;
  /**
   * Compact planner brief for the previous shot (description / action / query / camera).
   * Used to forbid near-paraphrase image prompts.
   */
  previousImagePromptBrief?: string;
  /**
   * Deterministic compositional bias so consecutive AI stills are not near-clones.
   */
  compositionUniquenessHint?: string;
}): string {
  const {
    shot,
    themeVisualStyle,
    styleBibleVibe,
    characterFragment,
    globalColourGrade,
    inspirationStyleHint,
    animationStyleHint,
    shotBrandHints,
    thumbnailCoverMode,
    thumbnailVariationKey,
    factLabelImagePromptExtra,
    timelineShotIndex,
    timelineShotTotal,
    storyStructureHint,
    seriesTopic,
    episodeTitle,
    plannerHoldSeconds,
    previousShotOneLiner,
    previousImagePromptBrief,
    compositionUniquenessHint,
  } = args;

  // 1. IDENTITY — character / subject description (identity anchor).
  const identity = characterFragment
    ? `Subject: ${characterFragment}.`
    : shot.subjectAction
      ? `Subject action: ${shot.subjectAction}.`
      : '';

  const narrativeRoleClause =
    shot.role?.trim() &&
    !thumbnailCoverMode &&
    (shot.kind === 'ai_image' || shot.kind === 'ai_video' || shot.kind === 'scraped_image' || shot.kind === 'scraped_video')
      ? `NARRATIVE ROLE: "${shot.role.replace(/"/g, "'").trim().slice(0, 120)}" — this cut must **earn** its place (not filler that could swap with another line).`
      : '';

  const image =
    shot.kind === 'ai_image'
      ? thumbnailCoverMode
        ? `COVER STILL: ${shot.description} Framing: ${framingToEnglish(shot.framing)}. Lighting: ${shot.lighting}. Palette: ${shot.palette}.${shot.lensHint ? ` Lens: ${shot.lensHint}.` : ''} Single decisive hero moment — crystal clear at thumbnail size, not a busy mid-roll frame.`
        : `Still frame: ${shot.description} Framing: ${framingToEnglish(shot.framing)}. Lighting: ${shot.lighting}. Palette: ${shot.palette}.${shot.lensHint ? ` Lens: ${shot.lensHint}.` : ''} One decisive readable moment tied to the script — avoid generic catalogue / stock-poster compositions unless the line is literally about that.`
      : `Shot: ${shot.description}. Framing: ${framingToEnglish(shot.framing)}. Lighting: ${shot.lighting}. Palette: ${shot.palette}.${shot.lensHint ? ` Lens: ${shot.lensHint}.` : ''}`;

  const imageQualityClause =
    shot.kind === 'ai_image'
      ? thumbnailCoverMode
        ? 'THUMBNAIL QUALITY BAR: photoreal or brand-true illustration at poster resolution — razor-sharp hero subject, clean edges, coherent single light direction, physically plausible anatomy, rich detail without noise. **No** watermarks, stock UI, random logos, duplicated faces, mangled hands, extra limbs, busy collage, or muddy low-contrast mush. Background must stay simple so the subject reads instantly at phone size.'
        : 'STILL QUALITY BAR: crisp focus on the hero subject, coherent single light direction, physically plausible anatomy for people, clean edges — **no** watermarks, stock-site UI, random logos, duplicated faces in crowds, mangled hands or extra limbs, or meaningless clutter unrelated to the narration.' +
          (shot.imageCaption?.trim()
            ? ''
            : ' Absolutely **no** readable text, letters, numbers, or typography anywhere in the frame.')
      : '';

  // 3. MOTION — camera + subject motion.
  const motion = `Camera: ${cameraToEnglish(shot.camera)}. ${shot.subjectAction ? `Subject action: ${shot.subjectAction}.` : ''}${shot.speedRamp && shot.speedRamp !== 'none' ? ` Speed ramp: ${shot.speedRamp.replace('_', ' ')}.` : ''}`;

  // 4. STYLE — theme + account vibe + colour grade + brand hints.
  // Inspiration + animation medium are spoken once up-front (styleLock) so
  // image/video models weight them before scene description.
  let styleStr = [
    themeVisualStyle,
    styleBibleVibe,
    globalColourGrade ? `Colour grade: ${globalColourGrade}.` : '',
    shotBrandHints ? `Brand voice (visuals must match): ${shotBrandHints}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (thumbnailCoverMode) {
    // Cover typography + uniqueness must lead the prompt — fal clamps
    // recraft@1000 / ideogram@2000 from the *start*, and a late COVER TEXT
    // clause was getting chopped off.
    let coverTextClause = '';
    if (shot.kind === 'ai_image' && shot.imageCaption?.trim()) {
      const cap = shot.imageCaption.trim().slice(0, 20).replace(/"/g, "'");
      if (inspirationStyleHint?.trim()) {
        coverTextClause =
          `COVER TEXT (mandatory, short): paint ONLY the exact phrase "${cap}" — **1 to 3 words max**, huge bold hero type (~15–25% of frame). Match lettering from account inspiration refs when they show type. Extreme contrast; centre or lower third; never collide with the subject. Forbidden: any other words, subtitles, hashtags, URLs, or fine print.`;
      } else {
        coverTextClause =
          `COVER TEXT (mandatory, short): paint ONLY "${cap}" — **1 to 3 words**, massive bold geometric sans, thick strokes, extreme contrast; centre or lower third; letters fully inside frame. Forbidden: any other text, subtitles, watermarks, logos, or fine print.`;
      }
    } else {
      coverTextClause =
        'THUMBNAIL / COVER ROLE: single premium poster frame — match project stills. Zero words, numbers, watermarks, or logos on the image.';
    }

    const v =
      (thumbnailVariationKey ?? '').replace(/[^a-z0-9-]/gi, '').slice(0, 12) || 'cover';
    const recipe = thumbnailCoverRecipeForVariation(thumbnailVariationKey ?? v);
    const uniqueClause =
      `UNIQUE COVER ${v}: ${recipe.composition}. Lighting: ${recipe.lighting}. ` +
      `Visually distinct from other regenerates (angle/crop/colour) while on-brand. One hero idea, zero clutter, legible at phone size.`;

    // Keep brand locks but cap length so short-limit models still see the cover brief.
    const styleLockThumb = [
      animationStyleHint
        ? `BRAND MEDIUM: ${animationStyleHint}`
        : '',
      inspirationStyleHint
        ? `BRAND VISUAL LANGUAGE: ${inspirationStyleHint}`
        : '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
      .slice(0, 420);
    const themeThumb = [
      themeVisualStyle?.trim().slice(0, 180),
      styleBibleVibe?.trim().slice(0, 120),
      globalColourGrade ? `Colour grade: ${globalColourGrade}.` : '',
      shotBrandHints ? `Brand: ${shotBrandHints.slice(0, 160)}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return [
      coverTextClause,
      uniqueClause,
      imageQualityClause,
      identity,
      image,
      motion,
      styleLockThumb,
      themeThumb,
    ]
      .filter((s) => s && s.trim().length > 0)
      .join(' ');
  }

  if (shot.kind === 'ai_image' && shot.imageCaption?.trim()) {
    const extra = factLabelImagePromptExtra?.trim();
    const typoLock = inspirationStyleHint?.trim()
      ? `Lettering must **echo inspiration references** (serif vs sans, weight, case, colour) when those stills show type — avoid a default "tech sans" look unless the refs use it.`
      : `Use one restrained editorial type style consistent with the scene — avoid novelty decorative fonts unless the set is literally signage or a poster.`;
    styleStr += ` One in-scene typographic label only (signage, print, device UI, ticket, or subtle editorial burn-in). **Exact characters are SCRIPT-LOCKED in the opening block** — do not substitute scene-descriptive or "title of the photo" wording. ${typoLock} ${extra ? `${extra} ` : ''}Legible at HD; visually secondary to the subject.`;
  } else if (shot.kind === 'ai_image' || shot.kind === 'ai_video') {
    styleStr +=
      ' NO ON-IMAGE TEXT — Do not paint letters, words, numbers, captions, titles, subtitles, watermarks, logos, or readable signage into the frame. Pure photography / illustration with no typography (far-background blur that is illegible is OK).';
  }

  const imageCaptionScriptLock =
    !thumbnailCoverMode && shot.kind === 'ai_image' && shot.imageCaption?.trim()
      ? (() => {
          const vo = (shot.voiceover ?? '').trim().replace(/"/g, "'").slice(0, 420);
          const cap = shot.imageCaption.trim().replace(/"/g, "'").slice(0, 80);
          if (!vo) {
            return `SCRIPT-LOCKED ON-IMAGE TEXT: Paint this exact string as intrinsic pixels: "${cap}". Do not replace with words that describe the picture.`;
          }
          return (
            `SCRIPT-LOCKED ON-IMAGE TEXT — Paint this exact string as intrinsic pixels (sign, screen, print, etc.): "${cap}". ` +
            `It MUST be a contiguous substring of the narration below; do **not** swap in visual captions (e.g. skyline, ruins, lab, coffee) unless those exact words appear in the narration. ` +
            `Prefer a **short** 1–3 word phrase taken from the **opening or middle** of the line so the label lands with how the beat **starts**, not only its tail — unless the only number or proper noun is at the end. ` +
            `NARRATION: "${vo}". ` +
            `FORBIDDEN: any different wording, paraphrase, or "what you see" label not spoken above.`
          );
        })()
      : '';

  const voTrim = (shot.voiceover ?? '').trim();
  /** Explicit spoken-line grounding for image/video models (VO was only implicit in `description` before). */
  const narrationClause = (() => {
    if (thumbnailCoverMode) return '';
    if (shot.kind !== 'ai_image' && shot.kind !== 'ai_video') return '';
    if (!voTrim) return '';
    if (shot.imageCaption?.trim()) return '';
    const vo = voTrim.replace(/"/g, "'").slice(0, 520);
    return [
      `NARRATION LOCK — The frame must visually support what the viewer hears on this beat: concrete props, setting, people, or a single clear metaphor explained by the script — not unrelated stock mood.`,
      `Spoken line for this shot: "${vo}".`,
      `Do not invent on-screen captions or titles from this narration — depict the scene only.`,
    ].join(' ');
  })();

  const structureClause =
    !thumbnailCoverMode &&
    (shot.kind === 'ai_image' ||
      shot.kind === 'ai_video' ||
      shot.kind === 'scraped_image' ||
      shot.kind === 'scraped_video') &&
    !voTrim &&
    storyStructureHint?.trim()
      ? `STORY PLACEMENT: ${storyStructureHint.trim().slice(0, 340)} The image must fit this segment of the arc (not a generic unrelated scene).`
      : '';

  const topicT = (seriesTopic ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const titleT = (episodeTitle ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const topicKinds: ShotKind[] = ['ai_image', 'ai_video', 'scraped_image', 'scraped_video'];
  const topicAnchorClause =
    !thumbnailCoverMode &&
    topicT.length > 0 &&
    topicKinds.includes(shot.kind)
      ? `EPISODE SUBJECT LOCK — This render is for **one** video only: topic «${topicT.replace(/"/g, "'")}»${titleT ? `; title «${titleT.replace(/"/g, "'")}»` : ''}. ` +
        `Do not depict recurring subjects from unrelated niches (food service, hunting, random travel vignettes, etc.) unless this shot's narration explicitly discusses them. Inspiration/style reference pixels inform **colour, light, grain, and lens only** — not a second storyline.`
      : '';

  const consecutiveDistinctClause =
    !thumbnailCoverMode &&
    previousShotOneLiner?.trim() &&
    (shot.kind === 'ai_image' || shot.kind === 'ai_video')
      ? `CONSECUTIVE-CUT DISTINCTNESS — Previous shot: ${previousShotOneLiner.trim().replace(/"/g, "'").slice(0, 320)}. Invent a **new** hero idea, environment, and camera geometry — not the same room corner, same poster layout, or same single-prop hero as that frame. If this shot uses on-image text, it must be **different wording** from the prior shot's label (never duplicate the same line across consecutive stills).`
      : '';

  const previousPromptForbidClause = (() => {
    if (thumbnailCoverMode) return '';
    if (shot.kind !== 'ai_image' && shot.kind !== 'ai_video') return '';
    const prev = previousImagePromptBrief?.trim();
    if (!prev) return '';
    const curBrief = [shot.description, shot.subjectAction, shot.imageQuery, shot.framing, shot.camera]
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .join(' | ');
    const similar = promptTokenJaccard(prev, curBrief) >= 0.32;
    return (
      `FORBIDDEN NEAR-PARAPHRASE OF PRIOR IMAGE PROMPT — Do not reuse or lightly reword this previous brief: «${prev.replace(/"/g, "'").slice(0, 280)}». ` +
      `Your frame must change the **primary subject OR setting OR camera scale** enough that a viewer would never mistake it for a re-render of that prior still.` +
      (similar
        ? ` This shot's planner brief still overlaps the prior one — **override** with a clearly different composition now.`
        : '')
    );
  })();

  const compositionVarietyClause =
    !thumbnailCoverMode &&
    compositionUniquenessHint?.trim() &&
    (shot.kind === 'ai_image' || shot.kind === 'ai_video')
      ? `SHOT VISUAL DIVERSITY (mandatory): ${compositionUniquenessHint.trim()}`
      : '';

  const hold =
    plannerHoldSeconds != null && Number.isFinite(plannerHoldSeconds)
      ? Math.min(14, Math.max(0.8, plannerHoldSeconds))
      : null;
  const timingClause =
    !thumbnailCoverMode &&
    hold != null &&
    (shot.kind === 'ai_image' || shot.kind === 'ai_video')
      ? `READABILITY vs HOLD — This still is planned for **~${hold.toFixed(1)}s** on screen with the spoken line below; put the **main idea** in a single readable glance (no tiny background-only gags). The frame must match **this** line only, not earlier or later lines.${
          shot.imageCaption?.trim()
            ? ` The typographic label is the **hero hook** for this beat — size and contrast so it reads in the **first third** of the hold with the opening of the narration, not as tiny fine print that only matches words at the very end of the line.`
            : ''
        }`
      : '';

  const styleLock = [
    animationStyleHint
      ? `BRAND MEDIUM (keep every frame in this look, not generic illustration): ${animationStyleHint}`
      : '',
    inspirationStyleHint
      ? `BRAND VISUAL LANGUAGE (match account inspiration / style references, same palette and lighting — not stock look): ${inspirationStyleHint}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  // 5. NEGATIVE — implied by missing banned terms; handled per-model.

  let out = [
    topicAnchorClause,
    consecutiveDistinctClause,
    previousPromptForbidClause,
    compositionVarietyClause,
    styleLock,
    imageCaptionScriptLock,
    narrationClause,
    timingClause,
    structureClause,
    identity,
    narrativeRoleClause,
    image,
    imageQualityClause,
    motion,
    styleStr,
  ]
    .filter((s) => s && s.trim().length > 0)
    .join(' ');

  if (
    (shot.kind === 'ai_image' || shot.kind === 'ai_video') &&
    timelineShotIndex != null &&
    timelineShotTotal != null &&
    timelineShotTotal > 1
  ) {
    out += ` Edit timeline: frame ${timelineShotIndex} of ${timelineShotTotal} — **must** add new visual information versus earlier frames (not wallpaper or a near-copy). Depict a distinct story beat for this line; composition follows this shot's description and voiceover${shot.imageCaption?.trim() ? ' (on-image text wording is script-locked above, not the scene brief)' : ''}.`;
  }

  return out;
}

/** Convert camera token to readable English for the video model. */
function cameraToEnglish(c: ShotCameraMove): string {
  const map: Record<ShotCameraMove, string> = {
    static: 'locked-off static shot',
    slow_push_in: 'slow steady push in',
    slow_pull_out: 'slow steady pull out',
    dolly_in: 'dolly in',
    dolly_out: 'dolly out',
    pan_left: 'pan left',
    pan_right: 'pan right',
    tilt_up: 'tilt up',
    tilt_down: 'tilt down',
    orbit: 'orbit around subject',
    handheld: 'handheld with subtle shake',
    whip_pan: 'whip pan',
    crash_zoom: 'crash zoom in',
    crane_up: 'crane rising upward',
    crane_down: 'crane descending',
    fpv_sweep: 'FPV drone sweep',
    tracking: 'tracking alongside subject',
    bullet_time: 'bullet-time spin',
  };
  return map[c] ?? c;
}

function framingToEnglish(f: ShotFraming): string {
  const map: Record<ShotFraming, string> = {
    extreme_wide: 'extreme wide shot',
    wide: 'wide shot',
    medium_wide: 'medium wide',
    medium: 'medium shot',
    medium_close: 'medium close-up',
    close_up: 'close-up',
    extreme_close_up: 'extreme close-up',
    over_the_shoulder: 'over-the-shoulder',
    top_down: 'top-down overhead',
    low_angle: 'low angle',
    high_angle: 'high angle',
  };
  return map[f] ?? f;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Flatten storyboard → render plan                                     */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Utility used by the pipeline to iterate every shot in storyboard order
 * without walking three levels of nesting. Preserves act / beat context
 * so the renderer can pick up eyebrow labels and phase metadata.
 */
export interface FlattenedShot {
  actId: string;
  actName: string;
  actIntent: string;
  beatId: string;
  beatTitle: string;
  beatPhase: string;
  beatReferences: DirectorBeat['references'];
  shot: DirectorShot;
}

export function flattenStoryboard(sb: Storyboard): FlattenedShot[] {
  const out: FlattenedShot[] = [];
  for (const act of sb.acts) {
    for (const beat of act.beats) {
      for (const shot of beat.shots) {
        out.push({
          actId: act.id,
          actName: act.name,
          actIntent: act.intent,
          beatId: beat.id,
          beatTitle: beat.title,
          beatPhase: beat.phase,
          beatReferences: beat.references,
          shot,
        });
      }
    }
  }
  return out;
}

/** Prefer splitting narration near the middle on sentence / clause boundaries. */
function findVoiceoverSplitIndex(vo: string): number {
  const t = vo.trim();
  if (t.length < 16) return -1;
  const mid = Math.floor(t.length / 2);
  const candidates: Array<{ sep: string; advance: number }> = [
    { sep: '. ', advance: 2 },
    { sep: '? ', advance: 2 },
    { sep: '! ', advance: 2 },
    { sep: '\n', advance: 1 },
    { sep: '; ', advance: 2 },
  ];
  for (const { sep, advance } of candidates) {
    let idx = t.indexOf(sep, Math.max(0, mid - 55));
    if (idx >= 8 && idx < t.length - advance - 4) return idx + advance;
    idx = t.lastIndexOf(sep, mid + 60);
    if (idx >= 8 && idx < t.length - advance - 4) return idx + advance;
  }
  const sp = t.lastIndexOf(' ', mid + 40);
  if (sp >= 10 && sp < t.length - 10) return sp + 1;
  return mid > 10 && mid < t.length - 10 ? mid : -1;
}

/**
 * After real TTS length is known, align the **number of shots** with operator
 * "avg seconds per clip" and mux-safe pacing — **without** changing how each
 * shot is rendered (same `generateAiImage` / scraper path per shot).
 *
 * Merges or splits **voiceover text** only (and duplicates shot metadata),
 * then re-embeds all shots in the first beat of the first act so downstream
 * code sees one ordered list. Multi-act layout is flattened when counts
 * change (rare; most runs keep the planned shot count).
 */
export function rebalanceStoryboardToTargetShots(sb: Storyboard, targetShots: number): Storyboard {
  const flat = flattenStoryboard(sb);
  if (flat.length === 0) {
    return sb;
  }
  if (targetShots === flat.length || targetShots < 1) {
    return sb;
  }

  let shots: DirectorShot[] = flat.map((f) => ({
    ...f.shot,
    voiceover: (f.shot.voiceover ?? '').trim(),
  }));

  const mergePair = (a: DirectorShot, b: DirectorShot): DirectorShot => {
    const mergedVo = [a.voiceover, b.voiceover].filter(Boolean).join(' ').trim();
    const captionCand = [a.imageCaption, b.imageCaption].find((x) => x?.trim())?.trim();
    const mergedCaptionRaw =
      captionCand && mergedVo
        ? clampImageCaptionToVoiceover(mergedVo, captionCand)
        : undefined;
    const mergedCaption = filterImageCaptionToHighSignal(mergedCaptionRaw, mergedVo);
    return {
      ...a,
      id: randomUUID(),
      voiceover: mergedVo,
      description: `${a.description ?? ''} ${b.description ?? ''}`.replace(/\s+/g, ' ').trim().slice(0, 1400),
      onScreen:
        (a.onScreen?.trim() || '').length >= (b.onScreen?.trim() || '').length
          ? (a.onScreen ?? '').trim()
          : (b.onScreen ?? '').trim(),
      imageQuery:
        [a.imageQuery, b.imageQuery]
          .map((x) => (x ?? '').trim())
          .filter(Boolean)
          .join('; ')
          .slice(0, 480) ||
        (a.imageQuery ?? b.imageQuery),
      durationSeconds: Math.min(24, (a.durationSeconds ?? 3) + (b.durationSeconds ?? 3)),
      kind: a.kind,
      referenceIndices:
        (a.referenceIndices?.length ?? 0) >= (b.referenceIndices?.length ?? 0)
          ? a.referenceIndices
          : b.referenceIndices,
      imageCaption: mergedCaption,
    };
  };

  while (shots.length > targetShots) {
    let bestI = 0;
    let bestScore = Infinity;
    for (let i = 0; i < shots.length - 1; i++) {
      const len = shots[i]!.voiceover.length + shots[i + 1]!.voiceover.length;
      if (len < bestScore) {
        bestScore = len;
        bestI = i;
      }
    }
    shots.splice(bestI, 2, mergePair(shots[bestI]!, shots[bestI + 1]!));
  }

  let guard = 0;
  while (shots.length < targetShots && guard++ < 220) {
    let bestI = 0;
    let bestLen = -1;
    for (let i = 0; i < shots.length; i++) {
      const L = shots[i]!.voiceover.length;
      if (L > bestLen) {
        bestLen = L;
        bestI = i;
      }
    }
    if (bestLen < 20) break;
    const s = shots[bestI]!;
    const idx = findVoiceoverSplitIndex(s.voiceover);
    if (idx <= 0 || idx >= s.voiceover.length - 4) break;
    const vo1 = s.voiceover.slice(0, idx).trim();
    const vo2 = s.voiceover.slice(idx).trim();
    if (vo1.length < 6 || vo2.length < 6) break;
    const r = vo1.length / (vo1.length + vo2.length);
    const dur = s.durationSeconds ?? 4;
    const shot1: DirectorShot = {
      ...s,
      id: randomUUID(),
      voiceover: vo1,
      durationSeconds: Math.max(1.2, dur * r),
      transitionOut: 'hard_cut',
      imageCaption: filterImageCaptionToHighSignal(
        clampImageCaptionToVoiceover(vo1, s.imageCaption ?? '') ?? undefined,
        vo1,
      ),
    };
    const shot2: DirectorShot = {
      ...s,
      id: randomUUID(),
      voiceover: vo2,
      durationSeconds: Math.max(1.2, dur * (1 - r)),
      imageCaption: filterImageCaptionToHighSignal(
        clampImageCaptionToVoiceover(vo2, s.imageCaption ?? '') ?? undefined,
        vo2,
      ),
    };
    shots.splice(bestI, 1, shot1, shot2);
  }

  const firstAct = sb.acts[0];
  const firstBeat = firstAct?.beats[0];
  if (!firstAct || !firstBeat) {
    if (targetShots !== flat.length) {
      console.warn(
        '[director] rebalanceStoryboardToTargetShots: storyboard has no first act/beat; skipping repartition.',
      );
    }
    return sb;
  }

  resyncImageCaptionsAfterVoiceEdits(shots);

  return {
    ...sb,
    acts: [
      {
        ...firstAct,
        beats: [
          {
            ...firstBeat,
            shots,
          },
        ],
      },
    ],
    estimatedDurationSeconds: shots.reduce((acc, sh) => acc + (sh.durationSeconds ?? 3), 0),
  };
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Animation style presets (long-form)                                  */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Builds the long-form ANIMATION STYLE block — a multi-line preset the
 * director reads once and every shot obeys. Separated from the theme's
 * `visualStyle` because the user picks the animation medium (cartoon,
 * stick figure, storybook, etc.) independently of the topic.
 *
 * Style key → full descriptive block. `custom` returns empty so the
 * theme's `visualStyle` + inspiration refs drive the look instead.
 */
export function buildAnimationStyleBlock(
  style:
    | 'storybook'
    | 'cartoon'
    | 'stick_figure'
    | 'claymation'
    | 'pixel_art'
    | 'watercolour'
    | 'custom',
): string {
  const hint = animationStyleHintFor(style);
  if (!hint) return '';
  return (
    '\n\nANIMATION STYLE (every shot must match this look exactly — do not drift between chapters):\n' +
    hint
  );
}

/**
 * One-line version used inside individual shot prompts. The director
 * pipeline passes this to `shotToPrompt` so every AI image / video
 * carries the preset in its prompt, keeping the look consistent across
 * dozens of generations.
 */
export function animationStyleHintFor(
  style:
    | 'storybook'
    | 'cartoon'
    | 'stick_figure'
    | 'claymation'
    | 'pixel_art'
    | 'watercolour'
    | 'custom',
): string {
  switch (style) {
    case 'storybook':
      return 'Painterly storybook illustration. Soft textured backgrounds, hand-painted feel, rich warm palette. Think Studio Ghibli meets classic Grimm fairy-tale books. Clear silhouettes, gentle lighting, no photoreal detail.';
    case 'cartoon':
      return 'Flat-shaded 2D cartoon with bold black outlines, soft gradient fills, clean vector shapes. Bright but not neon palette (teal, coral, cream, deep navy). Kurzgesagt / explainer-video look — labelled diagrams welcome, tiny visual jokes in corners.';
    case 'stick_figure':
      return 'Minimalist stick-figure line art on a warm off-white paper or whiteboard background. Black ink strokes, intentionally imperfect (wobble welcome). One accent colour only — yellow highlighter or red marker. Arrows, labels, speech bubbles. Think RSA Animate or hand-drawn napkin sketches.';
    case 'claymation':
      return 'Stop-motion claymation look. Visible fingerprint textures, slight imperfections, warm studio lighting. Characters as chunky clay figures with simple features. Think Aardman / Wallace & Gromit.';
    case 'pixel_art':
      return 'Retro 16-bit pixel art scene. Chunky pixels, limited palette (~32 colours), clear pixel silhouettes, dithering for shading. Think classic SNES RPG cutscene.';
    case 'watercolour':
      return 'Soft watercolour painting — visible brushwork, bleeding pigment edges, warm pastel palette, cream paper background. Think children’s picture book illustration.';
    case 'custom':
    default:
      return '';
  }
}
