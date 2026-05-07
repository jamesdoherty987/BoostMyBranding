/**
 * Structured prompt builder for image and video generation.
 *
 * Flux and Kling both reward prompts that follow a specific grammar:
 *
 *   Image (Flux):
 *     subject → action/state → style/medium → composition → lighting
 *     → palette → camera/technical → negatives
 *
 *   Video (Kling, Seedance, Hailuo):
 *     subject → action → camera movement → motion style
 *     → pacing → mood/atmosphere → negatives
 *
 * We compose them from:
 *   1. A base brief (analysis.suggestedPrompt or direct brief)
 *   2. Brand style (palette, industry feel)
 *   3. Inspiration profile style hints
 *   4. A set of user-selectable "creative controls" — style, lighting,
 *      composition, mood, camera movement, etc.
 *   5. A negative-prompt block built from user "avoid" terms plus safety
 *      defaults (no text, no logos, no fabricated faces).
 *
 * The grammar is opinionated on purpose. Downstream models don't accept
 * JSON-ish prompts well; they want one clean paragraph. This module
 * stitches the sections into prose in the order the model expects.
 */

export type ImageStylePreset =
  | 'editorial_photography'
  | 'cinematic_photography'
  | 'documentary_photography'
  | 'lifestyle_photography'
  | 'flat_lay'
  | 'product_studio'
  | 'architectural'
  | 'minimalist'
  | 'magazine_editorial'
  | 'vintage_film'
  | 'moody_dark'
  | 'bright_airy'
  | 'illustration_flat'
  | 'illustration_3d';

export type LightingPreset =
  | 'golden_hour'
  | 'soft_daylight'
  | 'overcast_even'
  | 'studio_softbox'
  | 'dramatic_rembrandt'
  | 'low_key_moody'
  | 'high_key_bright'
  | 'neon_night'
  | 'window_side_light'
  | 'backlit_silhouette';

export type CompositionPreset =
  | 'rule_of_thirds'
  | 'centered'
  | 'overhead_flat'
  | 'close_up'
  | 'wide_environmental'
  | 'shallow_depth'
  | 'symmetrical'
  | 'negative_space'
  | 'leading_lines';

export type MoodPreset =
  | 'warm_intimate'
  | 'calm_premium'
  | 'energetic_playful'
  | 'confident_bold'
  | 'quiet_elegant'
  | 'nostalgic'
  | 'futuristic_clean';

export type CameraMovement =
  | 'static'
  | 'slow_push_in'
  | 'slow_pull_out'
  | 'gentle_pan_left'
  | 'gentle_pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'subtle_orbit'
  | 'handheld_follow'
  | 'crane_up'
  | 'rack_focus';

export type MotionStyle =
  | 'cinematic_natural'
  | 'smooth_slow_mo'
  | 'kinetic_snappy'
  | 'documentary_handheld'
  | 'dreamy_float'
  | 'macro_detail';

export interface ImageCreativeControls {
  style?: ImageStylePreset;
  lighting?: LightingPreset;
  composition?: CompositionPreset;
  mood?: MoodPreset;
  /** Free-text camera/lens hints, e.g. "35mm, f/1.8, shallow depth of field". */
  cameraTechnical?: string;
  /** Things to avoid — turned into a negative list. */
  avoid?: string[];
  /** Free-form extra direction appended to the end. */
  extra?: string;
}

export interface VideoCreativeControls {
  cameraMovement?: CameraMovement;
  motionStyle?: MotionStyle;
  mood?: MoodPreset;
  avoid?: string[];
  extra?: string;
}

/* ─────────────────────────────────────────────────────────────── */
/* Preset → prose mappings                                          */
/* ─────────────────────────────────────────────────────────────── */

const IMAGE_STYLE: Record<ImageStylePreset, string> = {
  editorial_photography: 'editorial photography, magazine-quality, natural and unforced',
  cinematic_photography: 'cinematic photography, film-grain texture, widescreen framing, dramatic tonal range',
  documentary_photography: 'documentary photography, candid moment, real and unretouched feel',
  lifestyle_photography: 'lifestyle photography, human-scale scene, relaxed and aspirational',
  flat_lay: 'top-down flat-lay photography, objects arranged intentionally on a surface',
  product_studio: 'studio product photography, clean seamless backdrop, even lighting, crisp edges',
  architectural: 'architectural photography, strong geometry, considered vertical and horizontal lines',
  minimalist: 'minimalist composition, restrained palette, negative space, single subject emphasis',
  magazine_editorial: 'high-end magazine editorial, print-quality detail, confident composition',
  vintage_film: '35mm film photography, subtle grain, period-correct palette, analogue feel',
  moody_dark: 'moody low-key photography, deep shadows, selective highlights, rich blacks',
  bright_airy: 'bright and airy photography, soft pastel highlights, clean whites, open composition',
  illustration_flat: 'flat vector illustration, clean geometric shapes, subtle gradients, isolated composition',
  illustration_3d: 'stylized 3D render, soft shadows, matte surfaces, minimalist palette',
};

const LIGHTING: Record<LightingPreset, string> = {
  golden_hour: 'warm golden-hour light, long soft shadows, low-angle sun',
  soft_daylight: 'soft diffused daylight, even exposure, gentle shadows',
  overcast_even: 'overcast daylight, shadowless and even, balanced exposure',
  studio_softbox: 'studio softbox lighting, controlled and even, no hot spots',
  dramatic_rembrandt: 'dramatic Rembrandt lighting, strong key light, deep falloff',
  low_key_moody: 'low-key moody lighting, most of the frame in shadow, selective highlights',
  high_key_bright: 'high-key lighting, bright and upbeat, airy atmosphere',
  neon_night: 'neon night lighting, coloured point sources, cinematic reflections',
  window_side_light: 'soft side light from a single window, gentle gradient across the subject',
  backlit_silhouette: 'backlit with a glowing rim, subject partially silhouetted',
};

const COMPOSITION: Record<CompositionPreset, string> = {
  rule_of_thirds: 'composed on the rule of thirds, subject offset from center',
  centered: 'symmetrical centered composition',
  overhead_flat: 'overhead top-down framing, objects laid flat',
  close_up: 'tight close-up framing, detail-forward',
  wide_environmental: 'wide environmental shot, subject in context of the space',
  shallow_depth: 'shallow depth of field, soft falloff behind the subject',
  symmetrical: 'symmetrical balanced composition, clean axis',
  negative_space: 'generous negative space around the subject',
  leading_lines: 'strong leading lines guiding the eye to the subject',
};

const MOOD: Record<MoodPreset, string> = {
  warm_intimate: 'warm, intimate, unhurried mood',
  calm_premium: 'calm, premium, considered mood',
  energetic_playful: 'energetic and playful mood, light and motion-friendly',
  confident_bold: 'confident, bold mood with strong contrast',
  quiet_elegant: 'quiet, elegant, restrained mood',
  nostalgic: 'nostalgic, slightly melancholy mood',
  futuristic_clean: 'futuristic, clean, optimistic mood',
};

const CAMERA_MOVEMENT: Record<CameraMovement, string> = {
  static: 'locked-off static camera, subtle subject motion only',
  slow_push_in: 'slow steady push-in toward the subject',
  slow_pull_out: 'slow steady pull-out revealing the wider scene',
  gentle_pan_left: 'gentle pan to the left',
  gentle_pan_right: 'gentle pan to the right',
  tilt_up: 'slow tilt upward',
  tilt_down: 'slow tilt downward',
  subtle_orbit: 'subtle orbital drift around the subject',
  handheld_follow: 'handheld follow movement, organic but not shaky',
  crane_up: 'smooth crane movement rising up and forward',
  rack_focus: 'rack-focus from foreground to subject',
};

const MOTION_STYLE: Record<MotionStyle, string> = {
  cinematic_natural: 'cinematic natural motion, realistic physics, 24fps feel',
  smooth_slow_mo: 'smooth slow-motion, deliberate and elegant',
  kinetic_snappy: 'kinetic snappy motion, punchy timing',
  documentary_handheld: 'documentary handheld feel, observed rather than staged',
  dreamy_float: 'dreamy floating motion, weightless and slow',
  macro_detail: 'macro detail motion, focus on tiny movement inside the frame',
};

/* ─────────────────────────────────────────────────────────────── */
/* Compositor                                                       */
/* ─────────────────────────────────────────────────────────────── */

export interface BuildImagePromptArgs {
  /** Core brief — either analysis.suggestedPrompt or the user's direct brief. */
  baseBrief: string;
  /** One-line brand style block from brandContext. */
  brandStyle?: string;
  /** One-line inspiration-profile style hint. */
  profileStyleHint?: string;
  controls?: ImageCreativeControls;
}

/**
 * Build an image prompt in Flux-friendly order. Returns a single prose
 * paragraph followed by a short "Avoid:" clause listing negatives. Flux
 * doesn't support a separate negative-prompt field, so we bake the
 * avoidance into the prose.
 */
export function buildImagePrompt(args: BuildImagePromptArgs): string {
  const parts: string[] = [];

  // 1. Base brief (subject + action).
  const base = args.baseBrief.trim();
  if (base.length > 0) parts.push(base);

  // 2. Style preset.
  const c = args.controls ?? {};
  if (c.style) parts.push(IMAGE_STYLE[c.style]);

  // 3. Composition.
  if (c.composition) parts.push(COMPOSITION[c.composition]);

  // 4. Lighting.
  if (c.lighting) parts.push(LIGHTING[c.lighting]);

  // 5. Mood.
  if (c.mood) parts.push(MOOD[c.mood]);

  // 6. Camera / technical.
  if (c.cameraTechnical && c.cameraTechnical.trim().length > 0) {
    parts.push(c.cameraTechnical.trim());
  }

  // 7. Brand + inspiration palette hints.
  if (args.brandStyle && args.brandStyle.trim().length > 0) {
    parts.push(args.brandStyle.trim());
  }
  if (args.profileStyleHint && args.profileStyleHint.trim().length > 0) {
    parts.push(args.profileStyleHint.trim());
  }

  // 8. User extra direction.
  if (c.extra && c.extra.trim().length > 0) parts.push(c.extra.trim());

  // 9. Negatives, combined with safety defaults.
  const negatives = combineNegatives(c.avoid, [
    'no fabricated text',
    'no invented logos',
    'no watermark',
    'no AI-generated face of a real person',
  ]);
  const prose = joinProse(parts);
  return `${prose} ${negatives}`.trim();
}

export interface BuildVideoPromptArgs {
  baseBrief: string;
  brandStyle?: string;
  profileStyleHint?: string;
  controls?: VideoCreativeControls;
}

/**
 * Build a video prompt in Kling-friendly order. Video models prefer
 * explicit camera movement + motion style language.
 */
export function buildVideoPrompt(args: BuildVideoPromptArgs): string {
  const parts: string[] = [];
  const base = args.baseBrief.trim();
  if (base.length > 0) parts.push(base);

  const c = args.controls ?? {};
  if (c.cameraMovement) parts.push(CAMERA_MOVEMENT[c.cameraMovement]);
  if (c.motionStyle) parts.push(MOTION_STYLE[c.motionStyle]);
  if (c.mood) parts.push(MOOD[c.mood]);

  if (args.brandStyle && args.brandStyle.trim().length > 0) {
    parts.push(args.brandStyle.trim());
  }
  if (args.profileStyleHint && args.profileStyleHint.trim().length > 0) {
    parts.push(args.profileStyleHint.trim());
  }

  if (c.extra && c.extra.trim().length > 0) parts.push(c.extra.trim());

  const negatives = combineNegatives(c.avoid, [
    'no text overlays',
    'no fabricated signage',
    'no warped faces or hands',
    'no sudden cuts',
  ]);
  const prose = joinProse(parts);
  return `${prose} ${negatives}`.trim();
}

/* ─────────────────────────────────────────────────────────────── */
/* Helpers                                                          */
/* ─────────────────────────────────────────────────────────────── */

function combineNegatives(userAvoid: string[] | undefined, safetyDefaults: string[]): string {
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const list of [safetyDefaults, userAvoid ?? []]) {
    for (const raw of list) {
      const s = String(raw || '').trim().replace(/\s+/g, ' ');
      if (s.length === 0) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Ensure every entry begins with "no " so the model reads them as negatives.
      cleaned.push(s.toLowerCase().startsWith('no ') ? s : `no ${s}`);
    }
  }
  if (cleaned.length === 0) return '';
  return `Avoid: ${cleaned.join(', ')}.`;
}

function joinProse(parts: string[]): string {
  // Collapse any blank entries, trim each, join with ". ". Strip runs of
  // spaces and repeated full stops, then ensure terminal punctuation.
  const clean = parts
    .map((p) => p.trim().replace(/\s+/g, ' ').replace(/[.\s]+$/g, ''))
    .filter((p) => p.length > 0);
  if (clean.length === 0) return '';
  return clean.join('. ') + '.';
}
