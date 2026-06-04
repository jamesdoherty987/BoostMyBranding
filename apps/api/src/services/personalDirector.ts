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

import { generateJSON } from './claude.js';
import { withRetry } from './retry.js';
import type { PersonalTheme } from './personalThemes.js';
import type { PersonalAccountStyleBible } from '@boost/database';
import { buildStyleExamplesPrompt } from './personalContentHints.js';

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
}

export async function planStoryboard(args: DirectArgs): Promise<Storyboard> {
  const prompt = buildDirectorPrompt(args);
  // Long-form storyboards emit a lot more JSON — 5-8 chapters × 3-5
  // shots with full cinematography fields per shot easily crosses
  // the default 4k budget. Bump to 12k when longform is on.
  const maxTokens = args.longform?.enabled ? 12_000 : 4_096;
  const raw = await withRetry(
    () =>
      generateJSON<Storyboard>(prompt, {
        model: args.scriptModel ?? 'sonnet',
        maxTokens,
      }),
    { label: `director:${args.theme.id}:${args.topic.slice(0, 40)}`, attempts: 2 },
  );

  // Normalise + sanity defaults.
  const normOpts: {
    longform?: boolean;
    averageShotSeconds?: number;
    cutPace?: DirectArgs['cutPace'];
    keywordPopStyle?: DirectArgs['keywordPopStyle'];
    allowSparseImageText?: boolean;
  } = {
    averageShotSeconds: args.averageShotSeconds,
    cutPace: args.cutPace,
    keywordPopStyle: args.keywordPopStyle,
    allowSparseImageText: args.allowSparseImageText,
  };
  if (args.longform?.enabled) normOpts.longform = true;
  const out: Storyboard = {
    title: raw.title ?? args.topic,
    hook: raw.hook ?? '',
    outro: raw.outro ?? '',
    caption: raw.caption ?? '',
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
  // 1.8× per shot to avoid one glacial 25-second stare.
  if (args.longform?.enabled) {
    const target = args.longform.targetDurationSeconds;
    if (
      target &&
      out.estimatedDurationSeconds > 0 &&
      out.estimatedDurationSeconds < target * 0.85
    ) {
      const ratio = Math.min(1.8, target / out.estimatedDurationSeconds);
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
  }

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
  for (const x of raw.slice(0, 4)) {
    if (!x || typeof x !== 'object') continue;
    const text = String((x as { text?: unknown }).text ?? '').trim();
    if (!text || text.length > 48) continue;
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

function normaliseActs(
  acts: DirectorAct[] | undefined,
  theme: PersonalTheme,
  opts?: {
    longform?: boolean;
    averageShotSeconds?: number;
    cutPace?: DirectArgs['cutPace'];
    keywordPopStyle?: DirectArgs['keywordPopStyle'];
    allowSparseImageText?: boolean;
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
  const duration = clamp(s.durationSeconds ?? defaultMid, minDur, maxDur);

  let keywordCards = parseKeywordCards((s as { keywordCards?: unknown }).keywordCards);
  if (opts?.keywordPopStyle === 'off') keywordCards = undefined;
  else if (keywordCards) {
    keywordCards = keywordCards
      .map((k) => ({
        text: k.text.slice(0, 48),
        tStart: k.tStart,
        tEnd: k.tEnd,
      }))
      .filter((k) => k.text.length > 0);
    if (keywordCards.length === 0) keywordCards = undefined;
  }

  let imageCaption: string | undefined =
    typeof (s as { imageCaption?: unknown }).imageCaption === 'string'
      ? (s as { imageCaption: string }).imageCaption.trim()
      : undefined;
  if (!opts?.allowSparseImageText) imageCaption = undefined;
  else if (imageCaption && imageCaption.length > 48) imageCaption = imageCaption.slice(0, 48);

  return {
    id: s.id ?? `shot_${id}`,
    role: s.role ?? '',
    description: (s.description ?? '').trim(),
    onScreen: (s.onScreen ?? '').trim(),
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
        sb.motifs && sb.motifs.length > 0 ? `- Recurring motifs: ${sb.motifs.join(' · ')}` : '',
        sb.palette && sb.palette.length > 0
          ? `- Brand palette (every shot should lean on these colours): ${sb.palette.join(', ')}`
          : '',
        sb.typography?.trim()
          ? `- Typography / on-screen text feel: ${sb.typography.trim()}`
          : '',
        sb.bannedPhrases && sb.bannedPhrases.length > 0
          ? `- BANNED phrases (never write): ${sb.bannedPhrases.join(' · ')}`
          : '',
        sb.copySamples && sb.copySamples.length > 0
          ? `- Copy samples (mimic rhythm and word choice — never copy verbatim):\n${sb.copySamples.map((s) => `  • "${s}"`).join('\n')}`
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
    ? `\n\nUSER REFERENCE LIBRARY (these images are available to pass into the video model as visual anchors — cite by index where relevant):\n${args.referenceMediaDigest}`
    : '';

  const inspirationBlock = args.inspirationStyleBlock
    ? `\n\nINSPIRATION VISUAL LANGUAGE (the account chose these references — stills and/or short clips; representative frames from clips are passed into ai_image and ai_video as pixel anchors — every generated shot must feel coherently on-brand with them, not generic theme stock):\n${args.inspirationStyleBlock}\n\nTreat palette, contrast, grain, lens character, motion rhythm, and editorial cut feel as hard requirements wherever they appear in the references.`
    : '';

  const viralFormatPromptBlock = args.viralFormatBlock
    ? `\n\n${args.viralFormatBlock}`
    : '';

  const hookFormulaBlock = args.hookFormulaDirective
    ? `\n\n${args.hookFormulaDirective}\nThe first shot's voiceover + onScreen must follow this hook formula.`
    : '';

  const newsBlock = args.newsContext
    ? `\n\nGROUNDED CONTEXT (cite only facts present here):\n${args.newsContext}`
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
    : pace === 'rapid'
      ? `- Plan 8-18 SHOTS total. MOST shots 1.5-3.5 seconds — rapid editorial cuts; keep the viewer oriented with strong subjectAction each time.${multiActHint}`
      : pace === 'relaxed'
        ? `- Plan 4-8 SHOTS total. Most shots 3.5-6 seconds — let moments breathe; fewer, richer frames.${multiActHint}`
        : `- Plan 5-10 SHOTS total. Most shots are 2-4 seconds. Shots carry the viewer — one long clip is a dead video.${multiActHint}`;

  const keywordBlock =
    args.keywordPopStyle && args.keywordPopStyle !== 'off'
      ? `\n\nKEYWORD POP-UPS (premium lower-thirds — NOT full captions):\n- On roughly 30-45% of shots, add optional \`keywordCards\`: max 3 entries; each \`text\` is 1-3 words OR a compact stat (e.g. "Kyoto" or "$4.2T"). Never sentences.\n- Optional \`tStart\` / \`tEnd\` in seconds within that shot (must stay inside the shot duration). Omit for auto-timing.\n- Do not repeat words already in \`onScreen\` or the VO line.\n- Visual tier: ${args.keywordPopStyle === 'bold' ? 'BOLD — high contrast, occasional single-word punch.' : 'SUBTLE — refined documentary / broadcast look.'}`
      : '';

  const sparseTextBlock = args.allowSparseImageText
    ? `\n\nON-IMAGE INFORMATION LABELS (\`imageCaption\` — **enabled** for this account):\n- Whenever the **voiceover** states something viewers should remember — **calendar dates**, **years**, **people's names**, **cities / countries / landmarks**, **amounts of money**, **percentages**, **ages**, or other **proper-noun facts** — set \`imageCaption\` on that **\`ai_image\`** shot (or the very next \`ai_image\` shot if the current shot is video). **Max 4 words** (symbols and digits count). Examples: "June 6, 1944", "Marie Curie", "Lagos", "$4.2T", "76%".\n- Aim for **imageCaption on a substantial share of \`ai_image\` shots** whenever the narration is fact-heavy — not one-off decoration. If the script names many dates or names, **most** of those beats should carry a matching label.\n- Never paste a full sentence, the hook, or duplicate \`onScreen\` verbatim — only the crisp fact. **Omit** \`imageCaption\` only when the frame is already a photo of a sign/document that clearly shows the same text, or the shot is not \`ai_image\`.`
    : '';

  const sparseDirectingRule = args.allowSparseImageText
    ? `- **imageCaption:** follow ON-IMAGE INFORMATION LABELS above — dates, names, places, and stats spoken in VO must get a ≤4-word \`imageCaption\` on \`ai_image\` shots unless redundant with the frame.\n`
    : '';

  const imageCaptionJsonLine = args.allowSparseImageText
    ? '              "imageCaption": "<on ai_image: set ≤4 words when VO gives a date, year, name, place, money, %, or stat; use often when facts are spoken; omit only if frame already shows same text>"'
    : '              "imageCaption": "<optional ≤4 words on rare ai_image shots>"';

  const exampleTitleCount = (args.styleBible?.exampleVideoTitles ?? []).filter(Boolean).length;
  const titleJsonContract =
    exampleTitleCount > 0
      ? '<5-12 words — MUST mirror STYLE of ACCOUNT example titles (length, punctuation, question vs claim, numbers, specificity); must look like the next video in the same series>'
      : '<5-9 words>';

  const targetForPrompt = longform ? longformTarget : args.targetDurationSeconds;

  return `You are a ${longform ? 'long-form video' : 'short-form video'} DIRECTOR, not a script writer. Plan a storyboard for a ${targetForPrompt}s ${args.theme.name} video on topic: "${args.topic}".

THEME: ${args.theme.name} — ${args.theme.tagline}
DEFAULT VISUAL STYLE: ${args.theme.visualStyle}
DEFAULT VOICE: ${args.theme.voiceGuide}
PREFERRED PLATFORMS: ${args.theme.preferredPlatforms.join(', ')}${styleBibleBlock}${charBlock}${refBlock}${inspirationBlock}${viralFormatPromptBlock}${hookFormulaBlock}${newsBlock}${blacklist}${animStyleBlock}${longformRules}${args.customDirection ? `\n\nACCOUNT-LEVEL DIRECTION: ${args.customDirection}` : ''}${args.promptAppendix ? `\n\n${args.promptAppendix}` : ''}${keywordBlock}${sparseTextBlock}

DIRECTING RULES (non-negotiable):
${shotCountRule}
${sparseDirectingRule}- Give every shot a CONCRETE subject action (verb + object), a camera move, a framing, a lighting description, and a palette. Abstract = slop.
- Use intentional CUTS. Default transition is 'hard_cut'. Save 'whip_pan' / 'match_cut' / 'flash_cut' for moments that earn them.
- Reuse the SAME character / setting descriptors across shots so AI models keep consistency. Don't say "a woman" once and "she" the next shot — re-describe every time.
- Mark each shot as ONE of: ai_video (expensive — use sparingly for money-shots and motion-critical moments), ai_image (cheap, animated at render with Ken Burns), scraped_video, scraped_image, user_media, b_roll.
- Cap ai_video to at most ${args.maxAiVideoShots ?? (longform ? 5 : 3)} per storyboard. Use ai_image or scraped_image for the rest.
- If user references (character refs) are relevant to a shot, add their index to \`referenceIndices\`. The video model will use them to anchor identity.
- No LLM slop phrases: "let's dive in", "in the realm of", "unleash", "game-changer", "cutting-edge", "paradigm shift", "mind-blowing". If you use any, the video is rejected.
- Every beat teaches ONE unambiguous thing. No filler.

SHOTS GRAMMAR (camera):
static, slow_push_in, slow_pull_out, dolly_in, dolly_out, pan_left, pan_right, tilt_up, tilt_down, orbit, handheld, whip_pan, crash_zoom, crane_up, crane_down, fpv_sweep, tracking, bullet_time.

SHOTS GRAMMAR (framing):
extreme_wide, wide, medium_wide, medium, medium_close, close_up, extreme_close_up, over_the_shoulder, top_down, low_angle, high_angle.

SHOTS GRAMMAR (transition out):
hard_cut (default), match_cut, whip_pan, dip_to_black, cross_dissolve, flash_cut, jump_cut, none.

OUTPUT contract — return ONLY JSON:
{
  "title": "${titleJsonContract}",
  "hook": "<opening spoken line, ≤3 seconds>",
  "outro": "<closing CTA, one sentence>",
  "caption": "<post caption, 1-3 sentences, ≤3 emoji>",
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
              "description": "<what the camera sees, 1-2 sentences>",
              "onScreen": "<3-8 words OR empty>",
              "voiceover": "<spoken line OR empty>",
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
   * low-light…"). Appended to every AI shot so the generator mirrors the
   * account's chosen visual language without the caller having to stitch
   * it in manually.
   */
  inspirationStyleHint?: string;
  /**
   * Long-form animation style preset ("flat 2D cartoon, bold outlines…").
   * Appended to every AI shot in longform mode so every frame across all
   * chapters matches the same animated look.
   */
  animationStyleHint?: string;
  /** Title/copy/motif hints from the style bible for image+video models. */
  shotBrandHints?: string;
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
  } = args;

  // 1. IDENTITY — character / subject description (identity anchor).
  const identity = characterFragment
    ? `Subject: ${characterFragment}.`
    : shot.subjectAction
      ? `Subject action: ${shot.subjectAction}.`
      : '';

  // 2. IMAGE — what we see.
  const image = `Shot: ${shot.description}. Framing: ${framingToEnglish(shot.framing)}. Lighting: ${shot.lighting}. Palette: ${shot.palette}.${shot.lensHint ? ` Lens: ${shot.lensHint}.` : ''}`;

  // 3. MOTION — camera + subject motion.
  const motion = `Camera: ${cameraToEnglish(shot.camera)}. ${shot.subjectAction ? `Subject action: ${shot.subjectAction}.` : ''}${shot.speedRamp && shot.speedRamp !== 'none' ? ` Speed ramp: ${shot.speedRamp.replace('_', ' ')}.` : ''}`;

  // 4. STYLE — theme + account vibe + colour grade + inspiration + animation.
  let styleStr = [
    // Animation preset comes first so the model locks on a medium (2D
    // cartoon vs. stick-figure vs. storybook) before fine-tuning palette.
    animationStyleHint ? `Medium: ${animationStyleHint}.` : '',
    themeVisualStyle,
    styleBibleVibe,
    globalColourGrade ? `Colour grade: ${globalColourGrade}.` : '',
    inspirationStyleHint ? `Visual language: ${inspirationStyleHint}.` : '',
    shotBrandHints ? `Brand voice (visuals must match): ${shotBrandHints}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (shot.kind === 'ai_image' && shot.imageCaption?.trim()) {
    styleStr += ` Include a small tasteful typographic label reading "${shot.imageCaption.trim()}" — clean high-end sans-serif, subtle shadow, must stay secondary to the photograph.`;
  }

  // 5. NEGATIVE — implied by missing banned terms; handled per-model.

  return [identity, image, motion, styleStr]
    .filter((s) => s && s.trim().length > 0)
    .join(' ');
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
