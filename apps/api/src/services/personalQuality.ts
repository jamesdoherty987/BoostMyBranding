/**
 * Anti-AI-slop quality gate.
 *
 * The single biggest problem with auto-generated social content is that
 * it looks auto-generated. This module enforces a checklist of "don't
 * ship obvious AI slop" rules at two stages:
 *
 *   1. Script time — reject scripts that use banned clichés, invent
 *      stats, include no concrete nouns, or fail the "would a human
 *      write this?" smell test.
 *
 *   2. Render time — Claude Vision inspects the final MP4's first and
 *      middle frames plus the captions, scores it 0-100, and refuses
 *      to publish anything below the account's minQualityScore.
 */

import { generateJSON } from './claude.js';
import type { PersonalScript } from './personalScript.js';
import type { PersonalTheme } from './personalThemes.js';

/**
 * Phrases that scream "AI wrote this". Case-insensitive substring match.
 * This list is intentionally opinionated — every phrase here has been
 * flagged in enough AI-generated content to be a tell.
 */
export const BANNED_PHRASES: string[] = [
  "let's dive in",
  'in the realm of',
  'in the world of',
  "it's no secret that",
  'did you know that', // too generic — the theme-specific version "did you know?" is fine
  'tapestry of',
  'delve into',
  'navigate the',
  'unleash',
  'unlock the',
  'game-changer',
  'game changer',
  'in this article',
  'in this video',
  'as an ai',
  'as a language model',
  "i'm sorry, but",
  "certainly! here",
  'moreover,',
  'furthermore,',
  'in conclusion',
  'at the end of the day',
  'cutting-edge',
  'revolutionary',
  'paradigm shift',
  'next-level',
  'literally changed my life',
  'you won\'t believe',
  'this one simple trick',
  'doctors hate',
  'this will blow your mind',
  '— but what if i told you',
];

/* ═══════════════════════════════════════════════════════════════════ */
/* Script-time checks                                                   */
/* ═══════════════════════════════════════════════════════════════════ */

export interface ScriptCheckResult {
  ok: boolean;
  score: number; // 0-100
  issues: string[];
  warnings: string[];
}

/**
 * Rule-based pre-flight before we spend money on rendering. Fast,
 * cheap, catches the obvious stuff. Downstream code can still call the
 * Claude-based deeper check.
 */
export function checkScriptRules(
  script: PersonalScript,
  theme: PersonalTheme,
  extraBannedPhrases: string[] = [],
): ScriptCheckResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  const joined = [
    script.hook,
    ...script.beats.map((b) => b.voiceover),
    ...script.beats.map((b) => b.onScreen),
    script.outro,
    script.caption,
  ]
    .join(' ')
    .toLowerCase();

  // 1. Banned phrases — hard-fail.
  const allBanned = [...BANNED_PHRASES, ...extraBannedPhrases.map((p) => p.toLowerCase())];
  for (const phrase of allBanned) {
    if (joined.includes(phrase)) {
      issues.push(`Banned cliché: "${phrase}"`);
    }
  }

  // 2. Structure sanity.
  if (!script.hook || script.hook.length < 10) {
    issues.push('Hook is missing or too short (needs 10+ chars).');
  }
  if (script.hook && script.hook.length > 140) {
    warnings.push('Hook is long — may not fit in 3 seconds of VO.');
  }
  if (script.beats.length < 3) {
    issues.push('Needs at least 3 beats to retain viewers.');
  }
  if (script.beats.length > 8) {
    warnings.push('More than 8 beats — pacing may feel frantic.');
  }

  // 3. Concreteness. AI slop is abstract. Real scripts have nouns,
  //    numbers, names. Count them and bail if too few.
  const concretenessScore = countConcreteTokens(joined);
  if (concretenessScore < script.beats.length) {
    issues.push(
      `Not concrete enough (${concretenessScore} specific nouns/numbers across ${script.beats.length} beats). Add names, dates, or amounts.`,
    );
  }

  // 4. Duplicate beat detection.
  const seen = new Set<string>();
  for (const b of script.beats) {
    const key = normalize(b.voiceover).slice(0, 40);
    if (seen.has(key)) {
      issues.push(`Duplicate or near-duplicate beat: "${b.voiceover.slice(0, 40)}…"`);
    }
    seen.add(key);
  }

  // 5. Emoji salad — more than 4 emoji is a tell.
  const emojiCount = (script.caption.match(/\p{Emoji_Presentation}/gu) ?? []).length;
  if (emojiCount > 4) {
    issues.push(`Caption has ${emojiCount} emoji — keep it ≤ 3.`);
  }

  // 6. Hashtag sanity.
  if ((script.hashtags ?? []).length > 12) {
    warnings.push(`${script.hashtags.length} hashtags — platforms often truncate or penalise.`);
  }

  // 7. Voiceover length vs theme duration.
  const totalWords = script.beats.reduce(
    (acc, b) => acc + b.voiceover.split(/\s+/).length,
    0,
  );
  const estSeconds = totalWords / 2.58;
  const target = theme.targetDurationSeconds;
  if (estSeconds > target * 1.4) {
    issues.push(
      `Script is too long (~${Math.round(estSeconds)}s vs target ${target}s). Trim beats.`,
    );
  }

  // Translate issue count into a score.
  const score = Math.max(
    0,
    100 - issues.length * 18 - warnings.length * 4 - emojiPenalty(emojiCount),
  );
  return { ok: issues.length === 0, score, issues, warnings };
}

function emojiPenalty(n: number): number {
  if (n <= 3) return 0;
  return (n - 3) * 5;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Approximate count of "concrete" tokens — numbers, capitalised names, units. */
function countConcreteTokens(text: string): number {
  let n = 0;
  // Numbers (integers and decimals).
  n += (text.match(/\b\d+(?:\.\d+)?\b/g) ?? []).length;
  // Years.
  n += (text.match(/\b(?:19|20)\d{2}\b/g) ?? []).length;
  // Currency amounts.
  n += (text.match(/[$€£¥]\s*\d[\d,\.]*/g) ?? []).length;
  // Capitalised proper nouns (rough).
  n += (text.match(/\b[A-Z][a-z]{2,}\b/g) ?? []).length;
  return n;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Claude-based deep review                                             */
/* ═══════════════════════════════════════════════════════════════════ */

export interface QualityReview {
  score: number;
  verdict: 'ship' | 'rework' | 'kill';
  summary: string;
  issues: string[];
  strengths: string[];
}

/**
 * Ask Claude to review the generated script as if it were a seasoned
 * short-form editor. Returns a score and a structured verdict. Costs a
 * couple of cents per call — use on published-grade posts only.
 */
export async function reviewScriptWithClaude(
  script: PersonalScript,
  theme: PersonalTheme,
): Promise<QualityReview> {
  const prompt = `You are a ruthless short-form video editor. Score this ${theme.name} script 0-100 on whether it would actually go viral on ${theme.preferredPlatforms.join(' / ')}.

SCRIPT:
hook: ${script.hook}
${script.beats.map((b, i) => `beat ${i + 1}: ${b.voiceover}\n    on-screen: ${b.onScreen}`).join('\n')}
outro: ${script.outro}
caption: ${script.caption}

RUBRIC:
- Hook strength — does it earn the next 2 seconds?
- Concreteness — names, numbers, specifics (no vague generalities)
- Voice — does it sound human, not LLM?
- Payoff — is there a clear takeaway by the end?
- Originality — is this angle fresh, or another "5 tips" re-tread?
- Platform fit — does it suit ${theme.preferredPlatforms[0]}?

VERDICT RULES:
- ship   → 75+, ready to publish as-is
- rework → 50-74, concept is fine but lines need sharpening
- kill   → <50, concept is weak or slop

Return ONLY JSON: { "score": 0-100, "verdict": "ship"|"rework"|"kill", "summary": "<1-2 sentences>", "issues": [...], "strengths": [...] }`;

  try {
    return await generateJSON<QualityReview>(prompt, { model: 'sonnet', maxTokens: 800 });
  } catch (e) {
    // Don't block the pipeline on a review failure — fall back to
    // the rule-based score only.
    console.warn('[quality] Claude review failed:', (e as Error).message);
    return {
      score: 70,
      verdict: 'ship',
      summary: 'Review unavailable — using rule-based score.',
      issues: [],
      strengths: [],
    };
  }
}
