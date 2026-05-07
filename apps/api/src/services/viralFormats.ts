/**
 * Viral short-form content format library.
 *
 * A "format" is a production-tested structure that's proven to retain
 * attention on TikTok / Reels / Shorts in 2026. Each entry declares:
 *
 *   - id                 stable key used by script writers
 *   - displayName        human-readable label
 *   - niche              which kinds of creators this format suits
 *   - targetDurationSeconds  the sweet-spot length for this format
 *   - hookWindowSeconds  how many seconds the hook occupies (2-3s is standard)
 *   - beats              structured beat template — the script writer
 *                        fills each beat with real copy from the brief
 *   - captionStyle       what burn-in captions should do for this format
 *   - pacing             cut cadence — affects music and editor choices
 *   - retentionMechanic  the single "why do viewers stay" lever
 *
 * Source: aggregated best practice from UGC/short-form playbooks
 * published 2025–2026 (Opus Clip 13.5M-clip analysis, Revid 3M-video
 * analysis, ezUGC, magichour, segwise, automateed). Paraphrased and
 * normalised into a production template so we can hand it to Claude
 * as a structured constraint rather than a wall of text.
 */

export type ViralBeatRole =
  | 'hook'
  | 'pain'
  | 'setup'
  | 'reveal'
  | 'proof'
  | 'value'
  | 'payoff'
  | 'cta'
  | 'question'
  | 'punchline'
  | 'objection'
  | 'transition';

export interface ViralBeat {
  role: ViralBeatRole;
  /** Human hint for what goes in this beat. The script writer reads this. */
  purpose: string;
  /** Target duration for this beat in seconds. Total across beats == targetDurationSeconds. */
  seconds: number;
  /** Optional lens / framing hint for the editor / director. */
  cameraHint?: string;
  /** Optional caption instruction for this beat. */
  captionHint?: string;
}

export interface ViralFormat {
  id: string;
  displayName: string;
  niche: Array<
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
  summary: string;
  targetDurationSeconds: number;
  hookWindowSeconds: number;
  beats: ViralBeat[];
  captionStyle: 'minimal' | 'bold_burn_in' | 'magazine' | 'karaoke' | 'subtitle';
  pacing: 'slow' | 'medium' | 'fast' | 'kinetic';
  retentionMechanic: string;
  /** One-line advice shown to the script writer before it writes. */
  writerDirective: string;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Catalog                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

export const VIRAL_FORMATS: ViralFormat[] = [
  /* ── UGC / PERFORMANCE AD FORMATS ─────────────────────────────── */
  {
    id: 'problem-demo-payoff',
    displayName: 'Problem → Demo → Payoff',
    niche: ['ecommerce_ad', 'lifestyle', 'beauty', 'food', 'fitness', 'general'],
    summary:
      'The highest-converting UGC ad structure for products whose value becomes obvious when shown. Problem in the first 3 seconds, hands-on demo, payoff reveal.',
    targetDurationSeconds: 15,
    hookWindowSeconds: 3,
    beats: [
      {
        role: 'hook',
        purpose:
          'Name the problem the viewer is feeling right now. Specific, visual, mid-action — not "are you tired of…".',
        seconds: 3,
        cameraHint: 'Close-up on the pain point (cluttered surface, dry skin, cold coffee, tangled cord).',
        captionHint: 'Burn-in. First line matches the spoken hook word-for-word.',
      },
      {
        role: 'setup',
        purpose: 'Introduce the product in hand. Show it briefly, name it once, do not over-sell.',
        seconds: 2,
        cameraHint: 'Hands + product, medium shot. Natural light.',
      },
      {
        role: 'proof',
        purpose: 'The demo. Show the product solving the problem in one continuous beat. No claims — only the visual.',
        seconds: 7,
        cameraHint: 'Single angle, no cuts if possible. If cuts, they are match-cuts on the hand movement.',
        captionHint: 'Label the step or the result ("30 seconds later").',
      },
      {
        role: 'payoff',
        purpose: 'The before/after moment. Let the viewer feel the win.',
        seconds: 2,
        cameraHint: 'Wider shot — reveal the whole scene fixed.',
      },
      {
        role: 'cta',
        purpose: 'One sentence. Include price anchor only if it is genuinely compelling.',
        seconds: 1,
        captionHint: 'Link in bio / tap to shop. No exclamation mark.',
      },
    ],
    captionStyle: 'bold_burn_in',
    pacing: 'fast',
    retentionMechanic:
      'The viewer watches to find out whether the demo works. Curiosity loop is opened in the hook and closed at the payoff.',
    writerDirective:
      'Do not start with a greeting. Do not explain what the product is until it is in hand. The entire video is the before/after.',
  },
  {
    id: 'hook-build-payoff',
    displayName: 'Hook → Build → Payoff',
    niche: ['personal_brand', 'faceless_education', 'tech', 'finance', 'general'],
    summary:
      'Three-act curiosity loop. Bold hook opens a gap, body adds details one by one, payoff resolves the gap.',
    targetDurationSeconds: 34,
    hookWindowSeconds: 3,
    beats: [
      {
        role: 'hook',
        purpose: 'One-sentence bold claim or question that opens a curiosity gap.',
        seconds: 3,
        captionHint: 'Giant burn-in text, two lines max.',
      },
      {
        role: 'setup',
        purpose: 'Frame the stakes in one sentence — why this matters right now.',
        seconds: 4,
      },
      {
        role: 'value',
        purpose: 'Three tightly-sequenced beats. Each one lands a specific fact, example, or step.',
        seconds: 18,
        cameraHint: 'Cut every 2–3 seconds. Each cut marks a new idea.',
        captionHint: 'Animate the key noun of each beat.',
      },
      {
        role: 'payoff',
        purpose: 'Resolve the curiosity gap from the hook. One clear takeaway.',
        seconds: 6,
      },
      {
        role: 'cta',
        purpose: 'Save, share, or follow — pick ONE.',
        seconds: 3,
      },
    ],
    captionStyle: 'bold_burn_in',
    pacing: 'fast',
    retentionMechanic:
      'The curiosity gap opened in the hook must not be resolved until the payoff. If the viewer can guess the answer at second 8 they swipe.',
    writerDirective:
      'The hook is a promise. The payoff must deliver it. Never reveal the answer in the body — only set it up.',
  },
  {
    id: 'reaction-pattern-interrupt',
    displayName: 'Pattern Interrupt Reaction',
    niche: ['ecommerce_ad', 'lifestyle', 'beauty', 'food', 'general'],
    summary:
      'Open on an unexpected visual or sound that makes the scroll pause. Then explain in one sentence and pivot to the product.',
    targetDurationSeconds: 18,
    hookWindowSeconds: 2,
    beats: [
      {
        role: 'hook',
        purpose:
          'Visual or sound surprise in frame 1. A dramatic gesture, an unusual location, a loud sound cue. No greeting.',
        seconds: 2,
        cameraHint: 'Whatever the surprise is, lead with it at full volume.',
      },
      {
        role: 'setup',
        purpose: 'Explain the surprise in one sentence.',
        seconds: 3,
      },
      {
        role: 'proof',
        purpose: 'Show the product doing the thing.',
        seconds: 10,
        cameraHint: 'Single take if possible. Hands + product.',
      },
      {
        role: 'cta',
        purpose: 'Soft CTA. "Tagged in my story."',
        seconds: 3,
      },
    ],
    captionStyle: 'bold_burn_in',
    pacing: 'kinetic',
    retentionMechanic:
      'The pattern-interrupt buys you 2 seconds. The sentence that explains it buys you 10. You must earn every beat after.',
    writerDirective:
      'The hook cannot be spoken — it must happen. A gesture, a drop, a flash of colour, a shocked face. Then the voice starts.',
  },
  {
    id: 'comparison-side-by-side',
    displayName: 'Comparison — side by side',
    niche: ['ecommerce_ad', 'beauty', 'tech', 'fitness', 'general'],
    summary:
      'Viewer watches to see which option wins. Two items in frame the whole time. Never name a competitor — use "the old one" / "the popular one".',
    targetDurationSeconds: 22,
    hookWindowSeconds: 3,
    beats: [
      {
        role: 'hook',
        purpose: 'Set up the comparison in one line. "I tried the $4 and the $40 version."',
        seconds: 3,
        cameraHint: 'Both items on screen side by side.',
      },
      {
        role: 'proof',
        purpose: 'Three rounds. Each round tests one attribute (texture, wear time, smell, finish). Name the result.',
        seconds: 14,
        cameraHint: 'Split screen. Match timing.',
        captionHint: 'Label each round ("Round 1: texture").',
      },
      {
        role: 'payoff',
        purpose: 'Verdict. Be specific about who the pick is right for.',
        seconds: 4,
      },
      {
        role: 'cta',
        purpose: 'Where to find the winner.',
        seconds: 1,
      },
    ],
    captionStyle: 'bold_burn_in',
    pacing: 'fast',
    retentionMechanic: 'The viewer stays to find out who wins. Do not reveal the winner until the payoff.',
    writerDirective:
      'Never name a real competitor brand — use category language. If you reveal the winner too early the video dies.',
  },
  {
    id: 'tutorial-steps-list',
    displayName: 'Numbered Tutorial (3 steps)',
    niche: ['lifestyle', 'beauty', 'food', 'fitness', 'tech', 'general'],
    summary:
      'Three tight how-to steps. Each step has the same structure. Repeatable, portable across niches.',
    targetDurationSeconds: 30,
    hookWindowSeconds: 3,
    beats: [
      {
        role: 'hook',
        purpose: 'Promise the outcome. "3 steps to {outcome} — takes under 60 seconds."',
        seconds: 3,
        captionHint: 'Big burn-in title with the outcome.',
      },
      {
        role: 'value',
        purpose: 'Step 1. Action, then the visible result.',
        seconds: 8,
        captionHint: '"Step 1 — {action}".',
      },
      {
        role: 'value',
        purpose: 'Step 2. Action, then the visible result.',
        seconds: 8,
        captionHint: '"Step 2 — {action}".',
      },
      {
        role: 'value',
        purpose: 'Step 3. Action, then the visible result.',
        seconds: 8,
        captionHint: '"Step 3 — {action}".',
      },
      {
        role: 'payoff',
        purpose: 'Show the final state.',
        seconds: 2,
      },
      {
        role: 'cta',
        purpose: 'Save so you remember. One line.',
        seconds: 1,
      },
    ],
    captionStyle: 'bold_burn_in',
    pacing: 'medium',
    retentionMechanic:
      'The numbered structure lets the viewer predict when each beat ends — that predictability keeps them past the 3-second drop-off.',
    writerDirective: 'Exactly three steps. Each step is one action + one visible result. No philosophy.',
  },
  {
    id: 'listicle-countdown',
    displayName: 'Listicle Countdown (5 → 1)',
    niche: ['faceless_education', 'tech', 'finance', 'lifestyle', 'general'],
    summary:
      'Top-N list counted down from 5 to 1. The #1 spot is the retention anchor. Best for faceless educational channels.',
    targetDurationSeconds: 45,
    hookWindowSeconds: 4,
    beats: [
      {
        role: 'hook',
        purpose: 'Promise #1 is surprising. "5 {items} you are using wrong — #1 is brutal."',
        seconds: 4,
        captionHint: 'Title card with "5 → 1".',
      },
      {
        role: 'value',
        purpose: '#5 — one concrete example, one sentence of why.',
        seconds: 7,
      },
      {
        role: 'value',
        purpose: '#4 — one concrete example, one sentence of why.',
        seconds: 7,
      },
      {
        role: 'value',
        purpose: '#3 — one concrete example, one sentence of why.',
        seconds: 7,
      },
      {
        role: 'value',
        purpose: '#2 — one concrete example, one sentence of why.',
        seconds: 7,
      },
      {
        role: 'payoff',
        purpose: '#1 — the best / worst / most surprising. Spend a full 10s here.',
        seconds: 10,
      },
      {
        role: 'cta',
        purpose: 'Follow for the next list.',
        seconds: 3,
      },
    ],
    captionStyle: 'bold_burn_in',
    pacing: 'medium',
    retentionMechanic:
      'Viewers stay to see #1. Never say "#1 is…" before you actually reveal it. Tease it at the start but hold.',
    writerDirective: 'Countdown, not count-up. #1 is the payoff and must be the strongest item.',
  },
  {
    id: 'storytime-reveal',
    displayName: 'Storytime with a reveal',
    niche: ['personal_brand', 'faceless_story', 'lifestyle', 'general'],
    summary:
      'First-person micro-story with a turning point. Naturally high retention because viewers stay to see what happened.',
    targetDurationSeconds: 42,
    hookWindowSeconds: 3,
    beats: [
      {
        role: 'hook',
        purpose: 'One-sentence teaser of the turning point. "I was about to refund it — then this happened."',
        seconds: 3,
      },
      {
        role: 'setup',
        purpose: 'Context — who, where, when, what was at stake. Two sentences max.',
        seconds: 7,
      },
      {
        role: 'transition',
        purpose: 'The moment something changed. Specific sensory detail.',
        seconds: 8,
      },
      {
        role: 'reveal',
        purpose: 'The reveal — what actually happened. This is the emotional peak.',
        seconds: 10,
      },
      {
        role: 'payoff',
        purpose: 'The takeaway in one sentence.',
        seconds: 10,
      },
      {
        role: 'cta',
        purpose: 'Follow for part 2 only if it is genuinely a multi-part story.',
        seconds: 4,
      },
    ],
    captionStyle: 'minimal',
    pacing: 'medium',
    retentionMechanic:
      'The teaser promises a reveal. Every beat either builds tension toward it or delivers it. Never resolve early.',
    writerDirective:
      'Use concrete sensory detail — what you saw, heard, felt. Abstract "I was so shocked" kills retention.',
  },
  {
    id: 'skit-two-character',
    displayName: 'Two-character skit',
    niche: ['ecommerce_ad', 'saas_ad', 'tech', 'general'],
    summary:
      'A conversation between two voices — viewer vs. expert, old way vs. new way. Works well for text-overlay or AI voice duets.',
    targetDurationSeconds: 25,
    hookWindowSeconds: 3,
    beats: [
      {
        role: 'hook',
        purpose: 'Character A states the problem bluntly. Character B reacts.',
        seconds: 3,
        captionHint: 'Label speakers on first line each — "You:" / "Them:".',
      },
      {
        role: 'setup',
        purpose: 'Three back-and-forth exchanges that escalate.',
        seconds: 12,
      },
      {
        role: 'reveal',
        purpose: 'Character B lands the punchline. It either roasts A or saves A.',
        seconds: 7,
      },
      {
        role: 'cta',
        purpose: 'Character B delivers a soft CTA.',
        seconds: 3,
      },
    ],
    captionStyle: 'bold_burn_in',
    pacing: 'fast',
    retentionMechanic:
      'Dialogue retains better than monologue because the viewer anticipates the next line.',
    writerDirective:
      'Keep exchanges short — 6–8 words each. The escalation must feel earned, not forced.',
  },
  {
    id: 'street-interview-style',
    displayName: 'Street-interview style (Q&A)',
    niche: ['personal_brand', 'lifestyle', 'general'],
    summary:
      'Fake or real vox-pop format. One question, 3-5 short answers, 1 twist answer at the end.',
    targetDurationSeconds: 28,
    hookWindowSeconds: 2,
    beats: [
      {
        role: 'hook',
        purpose: 'Interviewer states the question to camera. No preamble.',
        seconds: 2,
        captionHint: 'Big text of the question.',
      },
      {
        role: 'value',
        purpose: '3-4 short answers from different voices. Each answer ≤5s.',
        seconds: 18,
        cameraHint: 'Cut between answers. No interviewer between cuts.',
      },
      {
        role: 'payoff',
        purpose: 'The twist answer — funny, surprising, or emotional.',
        seconds: 6,
      },
      {
        role: 'cta',
        purpose: 'Interviewer asks the audience for theirs.',
        seconds: 2,
      },
    ],
    captionStyle: 'subtitle',
    pacing: 'fast',
    retentionMechanic:
      'Varied voices reset attention with each cut. The twist at the end gives them a reason to stay.',
    writerDirective:
      'The twist answer is the payoff. Everything before must feel real but forgettable.',
  },
  {
    id: 'reddit-style-narration',
    displayName: 'Reddit-style narration (faceless)',
    niche: ['faceless_story', 'faceless_education', 'general'],
    summary:
      'Voiceover reads a thread-like post over B-roll. YouTube Shorts favourite. Retains on narrative alone.',
    targetDurationSeconds: 58,
    hookWindowSeconds: 5,
    beats: [
      {
        role: 'hook',
        purpose: 'Read the "title" of the post — make it shocking or question-shaped.',
        seconds: 5,
        cameraHint: 'B-roll that matches the mood, not the words.',
        captionHint: 'Title in subtitle-style captions, big.',
      },
      {
        role: 'setup',
        purpose: 'Context — who is involved, what the stakes are.',
        seconds: 12,
      },
      {
        role: 'value',
        purpose: 'Rising action — one or two complications.',
        seconds: 20,
      },
      {
        role: 'reveal',
        purpose: 'The turning point.',
        seconds: 15,
      },
      {
        role: 'payoff',
        purpose: 'Resolution or AITA-style question.',
        seconds: 6,
      },
    ],
    captionStyle: 'subtitle',
    pacing: 'medium',
    retentionMechanic:
      'Narrative momentum. Viewers stay to see how it ends. B-roll is atmosphere, not information.',
    writerDirective:
      'Write in first person, as if telling a friend. No market-speak. Swearing fine if the platform allows it.',
  },
];

/* ═══════════════════════════════════════════════════════════════════ */
/* Lookup / helpers                                                     */
/* ═══════════════════════════════════════════════════════════════════ */

export function getViralFormat(id: string): ViralFormat | undefined {
  return VIRAL_FORMATS.find((f) => f.id === id);
}

/**
 * Pick a default format for a niche + intent. Used by automation when the
 * caller doesn't explicitly choose. Falls back to 'hook-build-payoff'
 * which works for almost anything.
 */
export function defaultFormatFor(args: {
  niche?: ViralFormat['niche'][number];
  productCentric?: boolean;
  hasCharacter?: boolean;
}): ViralFormat {
  if (args.productCentric) {
    return (
      VIRAL_FORMATS.find((f) => f.id === 'problem-demo-payoff')!
    );
  }
  if (args.niche === 'faceless_education' || args.niche === 'faceless_story') {
    return VIRAL_FORMATS.find((f) => f.id === 'listicle-countdown')!;
  }
  if (args.niche === 'ecommerce_ad' || args.niche === 'saas_ad') {
    return VIRAL_FORMATS.find((f) => f.id === 'problem-demo-payoff')!;
  }
  if (args.hasCharacter) {
    return VIRAL_FORMATS.find((f) => f.id === 'storytime-reveal')!;
  }
  return VIRAL_FORMATS.find((f) => f.id === 'hook-build-payoff')!;
}

/**
 * Render a format as a structured prompt block the script writer can
 * read as authoritative direction. Produces the same shape across
 * formats so the writer's extraction logic stays simple.
 */
export function formatToPromptBlock(format: ViralFormat): string {
  const beatLines = format.beats
    .map(
      (b, i) =>
        `  ${i + 1}. ${b.role.toUpperCase()} (${b.seconds}s) — ${b.purpose}${
          b.cameraHint ? ` · camera: ${b.cameraHint}` : ''
        }${b.captionHint ? ` · caption: ${b.captionHint}` : ''}`,
    )
    .join('\n');
  return [
    `VIRAL FORMAT: "${format.displayName}" (${format.id})`,
    `Summary: ${format.summary}`,
    `Target duration: ${format.targetDurationSeconds}s · hook window: ${format.hookWindowSeconds}s · pacing: ${format.pacing}.`,
    `Retention mechanic: ${format.retentionMechanic}`,
    `Writer directive: ${format.writerDirective}`,
    'Beat structure (do not deviate — each beat must be hit):',
    beatLines,
    `Caption style: ${format.captionStyle}.`,
  ].join('\n');
}
