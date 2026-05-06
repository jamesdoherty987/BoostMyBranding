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
  /** When true the director plans multi-act narratives (process / transformation / reveal). */
  allowMultiAct?: boolean;
  /** Max number of AI-video shots per storyboard — keeps cost in check. */
  maxAiVideoShots?: number;
}

export async function planStoryboard(args: DirectArgs): Promise<Storyboard> {
  const prompt = buildDirectorPrompt(args);
  const raw = await withRetry(
    () => generateJSON<Storyboard>(prompt, { model: 'sonnet', maxTokens: 4096 }),
    { label: `director:${args.theme.id}:${args.topic.slice(0, 40)}`, attempts: 2 },
  );

  // Normalise + sanity defaults.
  const out: Storyboard = {
    title: raw.title ?? args.topic,
    hook: raw.hook ?? '',
    outro: raw.outro ?? '',
    caption: raw.caption ?? '',
    hashtags: raw.hashtags ?? args.theme.defaultHashtags ?? [],
    acts: normaliseActs(raw.acts, args.theme),
    editPlan: {
      pacing: raw.editPlan?.pacing ?? defaultPacing(args.theme),
      colourGrade: raw.editPlan?.colourGrade ?? 'Natural, slight warmth',
      musicCue: raw.editPlan?.musicCue,
      defaultTransition: raw.editPlan?.defaultTransition ?? 'hard_cut',
      useGrain: raw.editPlan?.useGrain ?? false,
      letterbox: raw.editPlan?.letterbox ?? false,
    },
    estimatedDurationSeconds: 0,
    blocked: raw.blocked,
    blockReason: raw.blockReason,
  };

  // Cap AI-video shots to budget — demote extras to ai_image or scraped.
  const maxAiVideo = args.maxAiVideoShots ?? 3;
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

  // Enforce transition for the final shot.
  if (allShots.length > 0) allShots[allShots.length - 1]!.transitionOut = 'none';

  out.estimatedDurationSeconds = allShots.reduce(
    (acc, s) => acc + Math.max(1, Math.min(8, s.durationSeconds)),
    0,
  );

  return out;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function defaultPacing(theme: PersonalTheme): 'slow' | 'medium' | 'fast' {
  if (theme.template === 'quote-card' || theme.template === 'story-narration') return 'slow';
  if (theme.template === 'brainrot' || theme.template === 'listicle') return 'fast';
  return 'medium';
}

function normaliseActs(
  acts: DirectorAct[] | undefined,
  theme: PersonalTheme,
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
      shots: (b.shots ?? []).map((s, si) => normaliseShot(s, `${ai}_${bi}_${si}`, theme)),
    })),
  }));
}

function normaliseShot(
  s: Partial<DirectorShot>,
  id: string,
  theme: PersonalTheme,
): DirectorShot {
  const duration = clamp(s.durationSeconds ?? 3, 1.5, 7);
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
    transitionOut: (s.transitionOut ?? 'hard_cut') as ShotTransition,
    referenceIndices: s.referenceIndices ?? [],
    kind: (s.kind ?? preferredShotKind(theme)) as ShotKind,
    imageQuery: s.imageQuery?.trim(),
    focalX: clampOpt(s.focalX, 0, 1),
    focalY: clampOpt(s.focalY, 0, 1),
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
  const styleBibleBlock = sb
    ? [
        '',
        'ACCOUNT STYLE BIBLE (match exactly):',
        sb.vibe ? `- Vibe: ${sb.vibe}` : '',
        sb.dos && sb.dos.length > 0 ? `- Always do: ${sb.dos.join(' · ')}` : '',
        sb.donts && sb.donts.length > 0 ? `- Never do: ${sb.donts.join(' · ')}` : '',
        sb.motifs && sb.motifs.length > 0 ? `- Recurring motifs: ${sb.motifs.join(' · ')}` : '',
        sb.bannedPhrases && sb.bannedPhrases.length > 0
          ? `- BANNED phrases (never write): ${sb.bannedPhrases.join(' · ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const charBlock = args.characterGuide
    ? `\n\nON-CAMERA CHARACTER (this person appears in every AI-generated shot — describe them identically every time so the model keeps them consistent):\n- Name: ${args.characterGuide.name}\n${args.characterGuide.promptFragment ? `- Canonical look: ${args.characterGuide.promptFragment}\n` : ''}${args.characterGuide.voiceTone ? `- Voice tone: ${args.characterGuide.voiceTone}\n` : ''}${args.characterGuide.voicePace ? `- Pace: ${args.characterGuide.voicePace}\n` : ''}${args.characterGuide.catchphrases && args.characterGuide.catchphrases.length > 0 ? `- Catchphrases (sparingly): ${args.characterGuide.catchphrases.join(' · ')}` : ''}`
    : '';

  const refBlock = args.referenceMediaDigest
    ? `\n\nUSER REFERENCE LIBRARY (these images are available to pass into the video model as visual anchors — cite by index where relevant):\n${args.referenceMediaDigest}`
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

  return `You are a short-form video DIRECTOR, not a script writer. Plan a storyboard for a ${args.targetDurationSeconds}s ${args.theme.name} video on topic: "${args.topic}".

THEME: ${args.theme.name} — ${args.theme.tagline}
DEFAULT VISUAL STYLE: ${args.theme.visualStyle}
DEFAULT VOICE: ${args.theme.voiceGuide}
PREFERRED PLATFORMS: ${args.theme.preferredPlatforms.join(', ')}${styleBibleBlock}${charBlock}${refBlock}${newsBlock}${blacklist}${args.customDirection ? `\n\nACCOUNT-LEVEL DIRECTION: ${args.customDirection}` : ''}

DIRECTING RULES (non-negotiable):
- Plan 5-10 SHOTS total. Most shots are 2-4 seconds. Shots carry the viewer — one long clip is a dead video.${multiActHint}
- Give every shot a CONCRETE subject action (verb + object), a camera move, a framing, a lighting description, and a palette. Abstract = slop.
- Use intentional CUTS. Default transition is 'hard_cut'. Save 'whip_pan' / 'match_cut' / 'flash_cut' for moments that earn them.
- Reuse the SAME character / setting descriptors across shots so AI models keep consistency. Don't say "a woman" once and "she" the next shot — re-describe every time.
- Mark each shot as ONE of: ai_video (expensive — use sparingly for money-shots and motion-critical moments), ai_image (cheap, animated at render with Ken Burns), scraped_video, scraped_image, user_media, b_roll.
- Cap ai_video to at most ${args.maxAiVideoShots ?? 3} per storyboard. Use ai_image or scraped_image for the rest.
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
  "title": "<5-9 words>",
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
              "focalY": 0.55
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
}): string {
  const { shot, themeVisualStyle, styleBibleVibe, characterFragment, globalColourGrade } = args;

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

  // 4. STYLE — theme + account vibe + colour grade.
  const style = [
    themeVisualStyle,
    styleBibleVibe,
    globalColourGrade ? `Colour grade: ${globalColourGrade}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  // 5. NEGATIVE — implied by missing banned terms; handled per-model.

  return [identity, image, motion, style]
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
