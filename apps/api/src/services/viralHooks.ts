/**
 * Viral hook library + A/B variant generator.
 *
 * A hook is the first 2–3 seconds of a short-form video. Research
 * aggregated from 2026 UGC ad playbooks (alici, ezUGC, magichour,
 * OpusClip's 13.5M-clip analysis) shows that 3-second retention is the
 * single biggest predictor of distribution on TikTok / Reels / Shorts,
 * and that most hooks in the wild fall into ~12 reusable patterns.
 *
 * We expose those patterns as `HOOK_FORMULAS` — each one is a short
 * prompt directive the script writer can obey when it writes the
 * opening line. The goal isn't one perfect hook; it's a clean A/B: one
 * brief → 5 distinct hook angles, ship all five, measure, pick winners.
 */

export type HookIntent =
  | 'pattern_interrupt'
  | 'pain_agitation'
  | 'bold_claim'
  | 'curiosity_gap'
  | 'listicle'
  | 'question'
  | 'social_proof'
  | 'negation'
  | 'comparison'
  | 'story_tease'
  | 'problem_named'
  | 'result_first';

export interface HookFormula {
  id: string;
  intent: HookIntent;
  displayName: string;
  /** Plain-English template the script writer reads. {placeholders} filled from the brief. */
  template: string;
  /** Why this hook retains — shown to operators picking a pattern. */
  why: string;
  /** Best niche fit. */
  niches: Array<
    | 'ecommerce_ad'
    | 'saas_ad'
    | 'personal_brand'
    | 'faceless_education'
    | 'faceless_story'
    | 'lifestyle'
    | 'fitness'
    | 'beauty'
    | 'food'
    | 'tech'
    | 'finance'
    | 'general'
  >;
}

export const HOOK_FORMULAS: HookFormula[] = [
  {
    id: 'pain-named',
    intent: 'pain_agitation',
    displayName: 'Name the pain',
    template:
      "If you've ever {specific pain}, this is for you. I used to {pain consequence} too — then I tried {product}.",
    why:
      'Direct address + specific pain = instant self-identification. Works best for ecommerce where the pain is visible.',
    niches: ['ecommerce_ad', 'beauty', 'fitness', 'lifestyle', 'general'],
  },
  {
    id: 'bold-claim',
    intent: 'bold_claim',
    displayName: 'Bold claim',
    template: 'This {product} is the first {category} that actually {benefit}.',
    why: 'A confident claim triggers either agreement or disbelief — both keep viewers watching to verify.',
    niches: ['ecommerce_ad', 'saas_ad', 'tech', 'general'],
  },
  {
    id: 'curiosity-gap',
    intent: 'curiosity_gap',
    displayName: 'Open a curiosity gap',
    template:
      "Most people use {product category} wrong. Here's what I learned after {time period}.",
    why:
      'Information gap theory — the viewer must watch to close the loop the hook opened.',
    niches: ['personal_brand', 'faceless_education', 'tech', 'finance', 'general'],
  },
  {
    id: 'listicle-preview',
    intent: 'listicle',
    displayName: 'Listicle preview',
    template:
      '{N} {category} you are using wrong. #{N} is the one that cost me the most.',
    why:
      'Countdown structure + teased #1 creates a long retention loop. Viewers stay to see the final item.',
    niches: ['faceless_education', 'tech', 'finance', 'lifestyle', 'general'],
  },
  {
    id: 'pattern-interrupt-visual',
    intent: 'pattern_interrupt',
    displayName: 'Visual pattern interrupt',
    template:
      '[OPEN ON: {unexpected visual — a drop, a flash, a reveal}] Then: "Wait — watch what this does."',
    why:
      'Non-verbal surprise earns the first 2 seconds without requiring the viewer to process language.',
    niches: ['ecommerce_ad', 'lifestyle', 'beauty', 'food', 'general'],
  },
  {
    id: 'question-direct',
    intent: 'question',
    displayName: 'Direct question',
    template: 'Why does nobody talk about {unexpected truth} in {category}?',
    why:
      'Rhetorical questions that feel contrarian create engagement. Works best for thoughtful niches.',
    niches: ['personal_brand', 'finance', 'tech', 'general'],
  },
  {
    id: 'negation-reveal',
    intent: 'negation',
    displayName: 'Negation reveal',
    template:
      "Don't buy {category} until you see this. I tested {N} and only one actually {benefit}.",
    why:
      'Negation + social proof primes the viewer to trust the forthcoming recommendation.',
    niches: ['ecommerce_ad', 'tech', 'beauty', 'general'],
  },
  {
    id: 'comparison-test',
    intent: 'comparison',
    displayName: 'Comparison test',
    template: 'I tried the ${lowPrice} version and the ${highPrice} version. The winner shocked me.',
    why:
      'Price anchor + test setup is a proven retention structure. Viewer stays to see which wins.',
    niches: ['ecommerce_ad', 'beauty', 'tech', 'fitness', 'general'],
  },
  {
    id: 'social-proof-count',
    intent: 'social_proof',
    displayName: 'Social proof by number',
    template: '{largeNumber} people are using {product} wrong. Here is the right way.',
    why:
      'Big number creates perceived importance; "wrong way" flips the social proof into a pattern interrupt.',
    niches: ['ecommerce_ad', 'faceless_education', 'general'],
  },
  {
    id: 'story-tease',
    intent: 'story_tease',
    displayName: 'Story tease',
    template: "I was about to {negative outcome} — and then {turning point}. Here's what happened.",
    why:
      'Mini-story tension. The viewer must watch to see the resolution.',
    niches: ['personal_brand', 'faceless_story', 'lifestyle', 'general'],
  },
  {
    id: 'result-first',
    intent: 'result_first',
    displayName: 'Result first',
    template:
      'This is what {outcome} looks like after {time period}. Here is exactly how I got there.',
    why:
      "Show the result in frame 1. The viewer decides in 2 seconds whether they want it, then watches for the how.",
    niches: ['fitness', 'beauty', 'lifestyle', 'personal_brand', 'finance', 'general'],
  },
  {
    id: 'problem-named-raw',
    intent: 'problem_named',
    displayName: 'Problem named (raw)',
    template:
      "If your {thing} {does X undesirable thing}, you're not alone. This is the reason — and the fix.",
    why:
      'Low-key tone of inclusion earns trust on cold traffic. Works even when the product is obvious.',
    niches: ['ecommerce_ad', 'beauty', 'fitness', 'general'],
  },
];

export function getHookFormula(id: string): HookFormula | undefined {
  return HOOK_FORMULAS.find((h) => h.id === id);
}

/**
 * Pick N hook formulas for a niche, deterministically spread across
 * intents so the A/B test actually measures different patterns rather
 * than five variants of the same hook style.
 */
export function pickHookFormulas(args: {
  niche?: HookFormula['niches'][number];
  count?: number;
}): HookFormula[] {
  const count = Math.max(1, Math.min(HOOK_FORMULAS.length, args.count ?? 5));
  const pool = args.niche
    ? HOOK_FORMULAS.filter((h) => h.niches.includes(args.niche!))
    : HOOK_FORMULAS;

  // Spread across distinct intents first, then fill with remaining
  // candidates in catalog order.
  const byIntent = new Map<HookIntent, HookFormula>();
  for (const h of pool) {
    if (!byIntent.has(h.intent)) byIntent.set(h.intent, h);
  }
  const spread = Array.from(byIntent.values()).slice(0, count);
  if (spread.length >= count) return spread;
  const remainder = pool.filter((h) => !spread.includes(h)).slice(0, count - spread.length);
  return [...spread, ...remainder];
}

/** Short prompt block describing ONE hook formula for the writer. */
export function hookFormulaToDirective(formula: HookFormula): string {
  return `HOOK FORMULA: "${formula.displayName}" (${formula.intent}) — ${formula.template}\nWhy it works: ${formula.why}`;
}
