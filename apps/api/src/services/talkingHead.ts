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
import { withFalConcurrency } from './falConcurrency.js';
import { generateText } from './claude.js';
import { buildBrandContext, brandContextToFactsBlock } from './brandContext.js';
import { listProfiles, profilesToPromptBlock } from './inspirationProfiles.js';
import { listTonePairs, tonePairsToPromptBlock } from './tonePairs.js';
import { getProduct } from './products.js';
import {
  getViralFormat,
  formatToPromptBlock,
  defaultFormatFor,
  type ViralFormat,
} from './viralFormats.js';
import {
  getHookFormula,
  hookFormulaToDirective,
  pickHookFormulas,
  type HookFormula,
} from './viralHooks.js';

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
/* Influencer persona presets                                           */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * A persona is a quick-start template for talking-head UGC. Picking
 * one seeds the script with the right vocabulary, pacing, sign-offs,
 * and hook formulas for that niche. The agency can still override any
 * of these via the `direction` field in the script request.
 *
 * Every persona carries a recommended avatar from AVATAR_CATALOG so
 * the result looks right out of the box.
 */
export interface InfluencerPersona {
  id: string;
  displayName: string;
  niche:
    | 'gym_fitness'
    | 'fashion'
    | 'makeup_skincare'
    | 'tech_reviewer'
    | 'foodie'
    | 'outdoor_travel'
    | 'parenting'
    | 'finance'
    | 'home_decor'
    | 'wellness';
  /** One-line vibe description shown on the picker card. */
  tagline: string;
  /** Default avatar id from AVATAR_CATALOG. The user can swap. */
  recommendedAvatarId: string;
  /** Prompt fragment injected into the system prompt — defines voice. */
  voiceDirection: string;
  /** 3-6 opening hook templates the model picks from. Placeholders in
   *  braces are filled by the writer: {product}, {benefit}, {claim}. */
  hookFormulas: string[];
  /** Canonical sign-off / CTA patterns. */
  signOffs: string[];
  /** Words / phrases the persona characteristically uses. */
  vocabulary: string[];
  /** Words / phrases this persona would never say. */
  avoidVocabulary: string[];
}

export const INFLUENCER_PERSONAS: InfluencerPersona[] = [
  {
    id: 'gym-bro-fitness',
    displayName: 'Gym Bro — fitness',
    niche: 'gym_fitness',
    tagline: 'Hard-hitting, no-fluff fitness reviews. Reps, form, receipts.',
    recommendedAvatarId: 'marcus_vertical_primary',
    voiceDirection:
      'Confident, high-energy, direct. Short sentences. Reference training (sets, reps, PRs) when it fits. Treat the viewer as someone who already trains — do not over-explain.',
    hookFormulas: [
      "Okay if you're trying to {benefit}, listen up.",
      "I've been using {product} for 30 days. Here's what happened.",
      "Most {product_category} are overpriced garbage. This one isn't.",
      'Three reasons {product} actually moved the needle for me.',
      "Stop buying {product_category} blind. Here's what matters.",
    ],
    signOffs: [
      'Link in bio if you want to try it.',
      'Grab it before they restock. You know what to do.',
      "Try it for a week — tell me I'm wrong.",
    ],
    vocabulary: [
      'dialled in',
      'legit',
      'no fluff',
      'actually works',
      'moved the needle',
      'worth it',
      'recovery',
      'volume',
    ],
    avoidVocabulary: ['journey', 'unleash', 'elevate', 'curate'],
  },
  {
    id: 'fashion-girl-trendy',
    displayName: 'Fashion Girl — trendy',
    niche: 'fashion',
    tagline: 'Fit-check energy. Fabric nerd under the hype.',
    recommendedAvatarId: 'jasmine_vertical_primary',
    voiceDirection:
      'Chatty, aspirational, slightly breathless. Specific about fabrics, cut, and silhouette. References colour stories and seasons. Never uses vague hype words.',
    hookFormulas: [
      'Okay but we need to talk about {product}.',
      "If you only buy one thing this {season}, make it this.",
      "Here's why {product} is the only thing I'm wearing right now.",
      "I was not prepared for how good this {product_category} is.",
      "{product} — three outfits, let's go.",
    ],
    signOffs: [
      'Tagged it in stories so you can shop it.',
      "Run, don't walk. Link is in my bio.",
      'Tell me in the comments how you would style it.',
    ],
    vocabulary: [
      'obsessed',
      'the silhouette',
      'the fabric',
      'drapes beautifully',
      'the colour story',
      'goes with everything',
      'season staple',
    ],
    avoidVocabulary: ['seamlessly', 'curate', 'journey', 'game-changer'],
  },
  {
    id: 'makeup-artist-honest',
    displayName: 'Makeup Artist — honest',
    niche: 'makeup_skincare',
    tagline: 'Pro-MUA candour. Ingredients, finish, wear-time, receipts.',
    recommendedAvatarId: 'mira_vertical_primary',
    voiceDirection:
      'Calm, expert, ingredient-aware. Names textures and finishes precisely (dewy, satin, matte, velvet). Talks about longevity and transfer. Never says "glow-up".',
    hookFormulas: [
      "I test {product_category} for a living. This one is different.",
      "Here's what {product} actually does on bare skin — no filter.",
      "If you have {skin_type}, do NOT sleep on this.",
      "Three things to know before you buy {product}.",
      'Wore it for 12 hours. Walked into rain. Results:',
    ],
    signOffs: [
      "Full breakdown on my grid — swipe up.",
      'Linked — and yes the shade range is actually broad.',
      "If this helped, save it. You'll want it later.",
    ],
    vocabulary: [
      'formula',
      'finish',
      'pigment',
      'wear time',
      'transfer',
      'skin-like',
      'buildable',
      'sets like butter',
    ],
    avoidVocabulary: ['glow-up', 'bombshell', 'snatched'],
  },
  {
    id: 'tech-reviewer-honest',
    displayName: 'Tech Reviewer — honest',
    niche: 'tech_reviewer',
    tagline: 'Spec-sheet literate. Says what actually matters.',
    recommendedAvatarId: 'marcus_vertical_primary',
    voiceDirection:
      'Analytical, calm, skeptical. Comparisons over adjectives. Names specific specs only when provided. Makes concrete recommendations ("buy / skip / wait").',
    hookFormulas: [
      "I've used {product} for a week. Here's the honest take.",
      "Three things {brand} got right with {product} — and one they didn't.",
      "If you're deciding between {product} and {competitor}, watch this.",
      "This is the first {product_category} that genuinely {benefit}.",
      "Real talk on {product}:",
    ],
    signOffs: [
      'Full review on my channel — link in bio.',
      "If you want my buy/skip verdict, it's in the pinned comment.",
      'Questions? Drop them below.',
    ],
    vocabulary: [
      'daily driver',
      'real-world',
      'bottleneck',
      'value at this price',
      'in practice',
      'deal-breaker',
      'edge case',
    ],
    avoidVocabulary: ['revolutionary', 'game-changer', 'seamless', 'innovative'],
  },
  {
    id: 'foodie-casual',
    displayName: 'Foodie — casual',
    niche: 'foodie',
    tagline: 'Ate the thing. Tells you whether to try it.',
    recommendedAvatarId: 'emily_vertical_primary',
    voiceDirection:
      'Warm, hungry, specific. Describes texture and seasoning. Uses onomatopoeia sparingly. Never claims something is "life-changing".',
    hookFormulas: [
      'Okay the {product} is insane and I need to show you.',
      'You NEED to try this {product}. Here is why.',
      "I'm going to eat {product} on camera — unedited.",
      "Three reasons {product} is my new obsession.",
      "Let's be real about {product}.",
    ],
    signOffs: [
      'Full tasting notes saved in my story highlights.',
      "Link in bio if you want to try it for yourself.",
      "Tell me your favourite {product_category} — I'll try them next.",
    ],
    vocabulary: [
      'properly',
      'actually good',
      'seasoned well',
      'crisp',
      'rich',
      'balanced',
      "you'll want seconds",
    ],
    avoidVocabulary: ['divine', 'heavenly', 'to die for', 'life-changing'],
  },
  {
    id: 'outdoor-traveller',
    displayName: 'Outdoor — traveller',
    niche: 'outdoor_travel',
    tagline: 'Gear-tested, trail-ready. No posed shots.',
    recommendedAvatarId: 'aisha_vertical_walking',
    voiceDirection:
      'Grounded, adventurous, practical. References real conditions — rain, altitude, trail type. Focuses on durability and packability.',
    hookFormulas: [
      "Tested {product} on {environment}. Here's how it held up.",
      "If you're packing for {destination}, add this to your list.",
      "{product} survived {condition}. Most don't.",
      "Three features I actually used on {product}.",
      'Quick review from the trail:',
    ],
    signOffs: [
      'Full packing list in my bio.',
      "Tagged the product in my story so you can grab it.",
      "If you've used it, tell me what you think.",
    ],
    vocabulary: [
      'held up',
      'packable',
      'durable',
      'on the trail',
      'in the rain',
      'lightweight',
      'actually waterproof',
    ],
    avoidVocabulary: ['epic', 'next-level', 'game-changer', 'journey'],
  },
  {
    id: 'wellness-calm',
    displayName: 'Wellness — calm',
    niche: 'wellness',
    tagline: 'Evidence-friendly wellness. Slow, specific, soothing.',
    recommendedAvatarId: 'mira_vertical_primary',
    voiceDirection:
      'Calm, warm, measured. Specific about ingredients and routines. References time-of-day and habit-stacking. Never uses pseudo-science.',
    hookFormulas: [
      "If your {pain_point} won't go away, try this.",
      "Three things I do every morning that changed {benefit}.",
      "The one {product} I would not skip in my routine.",
      "{product} is not a miracle. Here's what it actually does.",
      "Quick honest take on {product}:",
    ],
    signOffs: [
      'Linked it below. Would love to know if it works for you.',
      'Full routine saved to my highlights.',
      "Take it slow. Pick one thing and try it for a week.",
    ],
    vocabulary: [
      'slow routine',
      'consistent',
      'gentle',
      'protocol',
      'one small habit',
      'ritual',
      'over a week',
    ],
    avoidVocabulary: ['miracle', 'instant', 'detox', 'magic'],
  },
  {
    id: 'home-decor-elevated',
    displayName: 'Home Decor — elevated',
    niche: 'home_decor',
    tagline: 'Material-forward interiors. Aesthetic with receipts.',
    recommendedAvatarId: 'elena_vertical_primary',
    voiceDirection:
      'Quiet confidence, considered pace. References materials (oak, linen, travertine, brushed brass). Talks about light and proportion.',
    hookFormulas: [
      "This one {product_category} changed the whole room.",
      "If your {room} feels flat, try one of these.",
      'Three things that instantly make a space look more expensive.',
      "Here's why {product} is worth the splurge.",
      'Real review of {product} after six months of use:',
    ],
    signOffs: [
      'Sourced it all in my bio.',
      'Save this one — you will want it later.',
      'Linked the full room below.',
    ],
    vocabulary: [
      'the light changes',
      'the proportion',
      'the material',
      'weight in the hand',
      'worn-in',
      'ages well',
      'considered',
    ],
    avoidVocabulary: ['vibes', 'aesthetic (adj.)', 'slay'],
  },
];

/** Look up a persona by id. Returns undefined for unknown ids. */
export function getPersona(id: string): InfluencerPersona | undefined {
  return INFLUENCER_PERSONAS.find((p) => p.id === id);
}

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
  /** Optional persona id — seeds the voice and hook style for a niche. */
  personaId?: string;
  /**
   * Optional viral format id from `VIRAL_FORMATS`. Locks the beat
   * structure. When omitted we pick a default based on whether the
   * script has a product or not.
   */
  formatId?: string;
  /**
   * Optional hook formula id from `HOOK_FORMULAS`. When set, the
   * writer must open with a line that follows this formula. Primary
   * use: A/B testing — same brief, different hooks.
   */
  hookFormulaId?: string;
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

  // Pick the format up-front so the structure directive references the
  // exact beat plan. If the caller didn't pick one, auto-select based
  // on whether the script has a product anchor.
  const chosenFormat: ViralFormat =
    (args.formatId ? getViralFormat(args.formatId) : undefined) ??
    defaultFormatFor({ productCentric: Boolean(args.productId) });

  const parts: string[] = [];
  parts.push(
    `You are writing a short on-camera UGC script for an AI avatar to read aloud.`,
    `The avatar talks straight to camera in a ${platformPacing(args.platform)} style.`,
    `Target: ~${wordsTarget} words to fit ${duration} seconds at natural speaking pace (~150 wpm).`,
    '',
    `STRUCTURE: follow the VIRAL FORMAT block below exactly. Every beat must be hit in order; the total of beat seconds must equal ${duration}s — re-scale beats proportionally if the target duration differs from the format's sweet spot.`,
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

  // Persona block — locks the voice to a niche influencer style. The
  // script writer treats this as the top of the style hierarchy (a
  // persona beats brand voice, which beats platform default pacing).
  if (args.personaId) {
    const persona = getPersona(args.personaId);
    if (persona) {
      parts.push(
        `INFLUENCER PERSONA: "${persona.displayName}" (${persona.niche})`,
        `Voice direction: ${persona.voiceDirection}`,
        `Pick ONE hook template and fill placeholders from the brief/facts (never invent):`,
        ...persona.hookFormulas.map((h) => `  • ${h}`),
        `Sign off with one of:`,
        ...persona.signOffs.map((s) => `  • ${s}`),
        `Vocabulary this persona uses: ${persona.vocabulary.join(', ')}`,
        `Vocabulary this persona NEVER uses: ${persona.avoidVocabulary.join(', ')}`,
        '',
      );
    }
  }

  // Viral format block — the structural template. Always included.
  parts.push(formatToPromptBlock(chosenFormat), '');

  // Hook formula — when set, the writer must open with a line that
  // follows this pattern. Leaving this off lets the persona / format
  // pick; setting it is how A/B runs force distinct opens.
  if (args.hookFormulaId) {
    const hookFormula = getHookFormula(args.hookFormulaId);
    if (hookFormula) {
      parts.push(hookFormulaToDirective(hookFormula), '');
    }
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
/* Product-review script                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export interface GenerateProductReviewArgs {
  clientId: string;
  productId: string;
  personaId: string;
  platform?: 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'generic';
  /** Desired duration in seconds (5-90). Defaults to 30. */
  durationSeconds?: number;
  /**
   * Optional "angle" for this review: unboxing, first-impressions,
   * 30-day-update, dupe-vs-original, compare-to-X. When omitted the
   * persona picks a default angle that suits its niche.
   */
  angle?:
    | 'unboxing'
    | 'first_impressions'
    | 'thirty_day_update'
    | 'dupe_vs_original'
    | 'compare'
    | 'how_to_use';
  /** Extra direction from the marketer. Must not invent facts. */
  direction?: string;
  /** Inspiration profile ids to pull style from. */
  inspirationProfileIds?: string[];
}

/**
 * Build a product-review script in the voice of a chosen persona. This
 * is a thin wrapper over `generateAvatarScript` that composes a brief
 * specifically for product reviews — it hands the writer the product
 * slot, the chosen angle, and the persona in one call.
 */
export async function generateProductReviewScript(
  args: GenerateProductReviewArgs,
): Promise<{ script: string; estimatedDurationSeconds: number; fromMock: boolean; persona: InfluencerPersona }> {
  const persona = getPersona(args.personaId);
  if (!persona) throw new Error(`Unknown persona: ${args.personaId}`);

  const product = await getProduct(args.clientId, args.productId);
  if (!product) throw new Error('Product not found for this client');

  const angleHints: Record<NonNullable<GenerateProductReviewArgs['angle']>, string> = {
    unboxing: 'Unbox on camera. Show packaging, first touch, first reaction.',
    first_impressions: 'Honest first impressions after 5 minutes of use.',
    thirty_day_update: 'Use-for-30-days review — what held up, what did not.',
    dupe_vs_original: 'Compare this to a well-known (but unnamed) original.',
    compare: 'Quick comparison with a broad category — not a named competitor.',
    how_to_use: 'Teach the viewer how to use it in under 60 seconds.',
  };
  const angle = args.angle ?? 'first_impressions';

  const brief = [
    `Product-review video for "${product.name}".`,
    product.description ? `Product summary: ${product.description.slice(0, 600)}` : '',
    `Angle: ${angleHints[angle]}`,
    args.direction ? `Marketer direction: ${args.direction}` : '',
    `The review must stay honest — reference only facts in the product summary or brand facts. If a claim cannot be grounded, omit it.`,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await generateAvatarScript({
    clientId: args.clientId,
    brief,
    platform: args.platform ?? 'tiktok',
    durationSeconds: args.durationSeconds ?? 30,
    productId: args.productId,
    inspirationProfileIds: args.inspirationProfileIds,
    personaId: args.personaId,
  });

  return { ...result, persona };
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
    const result = await withFalConcurrency(() => fal.subscribe(model.endpoint, { input, logs: false }));
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

/* ═══════════════════════════════════════════════════════════════════ */
/* Hook A/B variants                                                    */
/* ═══════════════════════════════════════════════════════════════════ */

export interface GenerateHookVariantsArgs {
  clientId: string;
  /** Core message the hook should preview. */
  brief: string;
  /** Platform — affects pacing of hook. */
  platform?: 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'generic';
  /** Product anchor, if any — helps the writer stay specific. */
  productId?: string;
  /** How many variants to return (2–8). Defaults to 5. */
  count?: number;
  /** Persona id — optional. Colours the voice across all variants. */
  personaId?: string;
  /** Niche filter for which hook formulas to sample. */
  niche?: HookFormula['niches'][number];
  /** Inspiration profile ids to factor in. */
  inspirationProfileIds?: string[];
}

export interface HookVariant {
  hookFormulaId: string;
  hookFormulaDisplayName: string;
  intent: HookFormula['intent'];
  text: string;
}

/**
 * Generate N distinct hook lines for the same brief — each one uses a
 * different canonical hook formula so the set covers different
 * retention levers. This is the standard UGC A/B workflow: ship all
 * N, measure 3-second retention, keep the winners.
 *
 * Each variant is a single spoken line, ≤ 18 words, meant to be the
 * first sentence of the script. The writer extends them into full
 * scripts via `generateAvatarScript({ hookFormulaId: ... })`.
 */
export async function generateHookVariants(
  args: GenerateHookVariantsArgs,
): Promise<{ variants: HookVariant[]; fromMock: boolean }> {
  const count = Math.max(2, Math.min(8, args.count ?? 5));
  const formulas = pickHookFormulas({ niche: args.niche, count });

  const [brandCtx, profiles, product] = await Promise.all([
    buildBrandContext(args.clientId).catch(() => null),
    listProfiles(args.clientId).catch(() => []),
    args.productId ? getProduct(args.clientId, args.productId).catch(() => null) : Promise.resolve(null),
  ]);

  const factsBlock = brandCtx ? brandContextToFactsBlock(brandCtx) : '';
  const profileBlock = profilesToPromptBlock(
    profiles.filter(
      (p) => !args.inspirationProfileIds?.length || args.inspirationProfileIds.includes(p.id),
    ),
  );

  const personaBlock = args.personaId
    ? (() => {
        const persona = getPersona(args.personaId!);
        if (!persona) return '';
        return [
          `PERSONA VOICE: "${persona.displayName}" (${persona.niche})`,
          persona.voiceDirection,
          `Use vocabulary: ${persona.vocabulary.join(', ')}`,
          `Avoid: ${persona.avoidVocabulary.join(', ')}`,
        ].join('\n');
      })()
    : '';

  const formulaList = formulas
    .map(
      (f, i) =>
        `  ${i + 1}. id="${f.id}" · ${f.displayName} (${f.intent}) — pattern: ${f.template}`,
    )
    .join('\n');

  const directive = [
    'You are a direct-response copywriter. Write ONE hook line for each of the formulas below.',
    '',
    `Brief: ${args.brief.trim()}`,
    product
      ? `Product anchor: ${product.name}${product.description ? ' — ' + product.description.slice(0, 240) : ''}`
      : '',
    factsBlock ? `Known facts (never invent beyond these):\n${factsBlock}` : '',
    profileBlock,
    personaBlock,
    '',
    'FORMULAS (produce one hook per formula, in order):',
    formulaList,
    '',
    'RULES FOR EACH HOOK:',
    '• ≤ 18 words. Spoken aloud, first sentence of the video.',
    '• No greeting. No "hey guys". No "let me show you".',
    '• Specific nouns > abstract adjectives.',
    '• Never invent facts, numbers, testimonials, or claims.',
    '• Never name a real competitor brand.',
    '• No emoji, no brackets, no markdown.',
    '',
    'OUTPUT — return ONLY valid JSON in this exact shape:',
    '{ "variants": [ { "hookFormulaId": "<id>", "text": "<the hook>" }, ... ] }',
  ]
    .filter(Boolean)
    .join('\n');

  let variants: HookVariant[] = [];
  if (!features.claude) {
    // Deterministic mock so dev mode still produces meaningful output.
    variants = formulas.map((f) => ({
      hookFormulaId: f.id,
      hookFormulaDisplayName: f.displayName,
      intent: f.intent,
      text: `[${f.displayName} mock] ${args.brief.trim().slice(0, 80)}`,
    }));
    return { variants, fromMock: true };
  }

  try {
    const raw = await generateText(directive, {
      model: 'sonnet',
      maxTokens: 800,
      temperature: 0.75,
    });
    const cleaned = raw.replace(/^```json\s*|```$/gi, '').trim();
    const parsed = JSON.parse(cleaned) as
      | { variants?: Array<{ hookFormulaId?: string; text?: string }> }
      | null;
    variants = (parsed?.variants ?? [])
      .map((v) => {
        const id = typeof v?.hookFormulaId === 'string' ? v.hookFormulaId : '';
        const f = formulas.find((x) => x.id === id) ?? getHookFormula(id);
        if (!f) return null;
        return {
          hookFormulaId: f.id,
          hookFormulaDisplayName: f.displayName,
          intent: f.intent,
          text: String(v?.text || '')
            .slice(0, 240)
            .trim(),
        };
      })
      .filter((v): v is HookVariant => v !== null && v.text.length > 0);
    // If Claude returned JSON but every row was malformed, fall back
    // to labelled-mock so the UI never shows an empty "0 variants"
    // state.
    if (variants.length === 0) {
      console.warn('[hookVariants] Claude returned JSON but no usable variants — falling back.');
      variants = formulas.map((f) => ({
        hookFormulaId: f.id,
        hookFormulaDisplayName: f.displayName,
        intent: f.intent,
        text: `[Fallback: ${f.displayName}] ${args.brief.trim().slice(0, 80)}`,
      }));
      return { variants, fromMock: true };
    }
  } catch (e) {
    console.warn('[hookVariants] Claude failed or returned bad JSON:', (e as Error).message);
    // Fall back to labelled-mock so the caller still gets something
    // useful rather than a 500.
    variants = formulas.map((f) => ({
      hookFormulaId: f.id,
      hookFormulaDisplayName: f.displayName,
      intent: f.intent,
      text: `[Fallback: ${f.displayName}] ${args.brief.trim().slice(0, 80)}`,
    }));
    return { variants, fromMock: true };
  }

  return { variants, fromMock: false };
}
