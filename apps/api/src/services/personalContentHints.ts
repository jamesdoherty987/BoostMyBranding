/**
 * Shared prompt fragments from generator config + style bible.
 * Keeps script and director prompts aligned on content rules.
 */

import type { PersonalAccountStyleBible, PersonalGeneratorConfig } from '@boost/database';

/** Extra narrative / factual constraints for Claude (script + director). */
export function buildPersonalContentRulesPrompt(
  gen: PersonalGeneratorConfig,
  styleBible?: PersonalAccountStyleBible,
): string {
  const parts: string[] = [];
  if (gen.trueStoriesOnly) {
    parts.push(
      'TRUE-STORIES MODE: Only use verifiable real-world events, documented history, or well-sourced cases. Do not invent anecdotes, composite characters, or unsourced "studies". If a detail cannot be grounded, omit it.',
    );
  }
  if (gen.extraContentRules?.trim()) {
    parts.push(gen.extraContentRules.trim());
  }
  return parts.length > 0 ? `\n\nOPERATOR CONTENT RULES:\n${parts.join('\n\n')}` : '';
}

const MAX_REFERENCE_SCRIPT_CHARS = 9000;

export function dedupeTitleLines(titles: string[] | undefined): string[] {
  if (!titles?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of titles) {
    const t = raw.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function titleWordCount(title: string): number {
  return title.trim().split(/\s+/).filter(Boolean).length;
}

function medianSorted(sorted: number[]): number {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Light guardrails when example titles exist: empty, topic echo, or exact reuse
 * of a saved example. Punctuation and length are left to the model + prompts.
 */
export function validateDirectorTitleAgainstExamples(
  title: string | undefined,
  topic: string,
  examples: string[],
): string | null {
  const ex = examples.map((e) => e.trim()).filter(Boolean);
  if (!ex.length) return null;

  const t = (title ?? '').trim();
  if (!t) return 'The JSON `title` was empty.';

  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[""`''’]/g, '');
  if (norm(t) === norm(topic)) {
    return 'The `title` is the same as the raw topic seed — write a feed-ready headline inspired by your examples instead.';
  }

  for (const exLine of ex) {
    if (norm(t) === norm(exLine)) {
      return 'The `title` must not copy a saved example verbatim — invent a new line for this topic.';
    }
  }

  return null;
}

function normHeadline(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[""`''’]/g, '');
}

/** Rough "same headline" check vs a past title (long words only). */
function headlineTooSimilarToPast(candidate: string, past: string): boolean {
  const c = normHeadline(candidate);
  const p = normHeadline(past);
  if (!c || !p) return false;
  if (c === p) return true;
  if (c.length >= 14 && p.length >= 14 && (c.includes(p) || p.includes(c))) return true;
  const words = (s: string) =>
    new Set(
      s
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
  const A = words(c);
  const B = words(p);
  if (A.size === 0 || B.size === 0) return false;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size) >= 0.45;
}

/**
 * Headline checks for the title generator: base guards + avoid near-duplicates
 * of already-published channel titles.
 */
export function validateChannelHeadline(
  title: string | undefined,
  topic: string,
  examples: string[],
  recentVideoTitles?: string[],
): string | null {
  const ex = examples.map((e) => e.trim()).filter(Boolean);
  if (!ex.length) return null;

  const base = validateDirectorTitleAgainstExamples(title, topic, ex);
  if (base) return base;

  const t = (title ?? '').trim();

  const recent = dedupeTitleLines(recentVideoTitles);
  for (const past of recent) {
    if (headlineTooSimilarToPast(t, past)) {
      return `Too similar to an already-published title on this channel — rewrite with a different angle and different keywords (published: "${past.slice(0, 90)}${past.length > 90 ? '…' : ''}").`;
    }
  }

  return null;
}

/** Observational digest from example titles — inspiration, not a checklist. */
export function formatExampleTitlePatternDigest(examples: string[]): string {
  const ex = examples.map((e) => e.trim()).filter(Boolean);
  if (!ex.length) return '';

  const counts = ex.map(titleWordCount).sort((a, b) => a - b);
  const median = medianSorted(counts);
  const minW = counts[0]!;
  const maxW = counts[counts.length - 1]!;
  const q = ex.filter((e) => /\?\s*$/.test(e)).length;
  const qPct = Math.round((100 * q) / ex.length);

  const starters = new Map<string, number>();
  for (const line of ex) {
    const w = line.split(/\s+/).filter(Boolean);
    if (w.length >= 2) {
      const key = `${w[0]} ${w[1]}`.replace(/[?,:;]$/, '');
      starters.set(key, (starters.get(key) ?? 0) + 1);
    } else if (w.length === 1) {
      const k = w[0]!.replace(/[?,:;]$/, '');
      starters.set(k, (starters.get(k) ?? 0) + 1);
    }
  }
  const top = [...starters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lines: string[] = [
    '',
    'What your saved examples tend to do (use your judgment — match the *feel*, invent new words):',
    `- Rough length: about ${minW}–${maxW} words in the samples (median ~${median.toFixed(1)}).`,
    `- Questions vs statements: about ${qPct}% of the samples end with "?".`,
  ];
  if (top.length) {
    lines.push(`- Common opening rhythms in the samples: ${top.map(([k, v]) => `"${k}" (${v}×)`).join(', ')}.`);
  }
  return lines.join('\n');
}

/**
 * When the style bible lists example video titles, force the model to treat
 * title pattern as step zero (before hook/beats) and avoid reusing past titles.
 */
export function buildTitleFirstWorkflowPrompt(
  styleBible: PersonalAccountStyleBible | undefined,
  recentVideoTitles: string[] | undefined,
): string {
  const examples = styleBible?.exampleVideoTitles?.filter(Boolean) ?? [];
  if (examples.length === 0) return '';

  const recent = dedupeTitleLines(recentVideoTitles).slice(0, 40);
  const guidance = styleBible?.videoTitleGuidance?.trim();
  const lines: string[] = [
    '',
    '══════════════════════════════════════════════════════════════════',
    'STEP 0 — JSON `title` (when example titles exist below)',
    '══════════════════════════════════════════════════════════════════',
    '',
    'The operator saved **example video titles** in STYLE REFERENCES. Treat them as the headline voice for this channel: length, punctuation, curiosity, specificity — learn the pattern, do not copy lines.',
    '',
    'Before hook or beats:',
    '1. Read every example title and notice what they share (not the facts — those are samples only).',
    '2. Invent **one** new `title` for **TOPIC FOR THIS VIDEO** that could sit beside the examples in a feed — same spirit, fresh wording for this topic only.',
    '3. Aim for the same strength and specificity as the examples; avoid bland SEO filler.',
  ];
  if (guidance) {
    lines.push('', 'OPERATOR — WHAT THEY WANT IN A TITLE (follow unless it conflicts with examples):', guidance);
  }
  if (recent.length > 0) {
    lines.push(
      '4. Compare your candidate `title` against **ALREADY-PUBLISHED TITLES ON THIS CHANNEL** (list below).',
      '   - Do **not** reuse any line, do **not** trivially edit one (no synonym swap only, no reorder-only change).',
      '   - If it is too close to any published title, pick a different angle until it is clearly distinct.',
    );
  } else {
    lines.push(
      '4. No prior titles on file — still match the example pattern tightly (do not drift into generic titles).',
    );
  }
  lines.push(
    '5. Only after you have that `title` in mind, write hook + beats so they **deliver what the title promises**.',
    '',
    'Avoid a generic `title` that ignores the example list — the examples are the north star for headline style.',
  );
  lines.push(formatExampleTitlePatternDigest(examples));
  if (recent.length > 0) {
    lines.push('', 'ALREADY-PUBLISHED TITLES (duplicate-avoidance — do not reuse or near-copy):');
    for (const t of recent) lines.push(`  • ${t}`);
  }
  lines.push('', 'EXAMPLE TITLES TO MATCH IN PATTERN (not wording — for THIS topic only):');
  for (const t of examples.slice(0, 20)) lines.push(`  • "${t}"`);
  lines.push('══════════════════════════════════════════════════════════════════', '');
  return lines.join('\n');
}

/** Example titles + script lines + optional full scripts for style (never verbatim copy). */
export function buildStyleExamplesPrompt(styleBible?: PersonalAccountStyleBible): string {
  if (!styleBible) return '';
  const titles = styleBible.exampleVideoTitles?.filter(Boolean) ?? [];
  const snippets = styleBible.exampleScriptSnippets?.filter(Boolean) ?? [];
  const fullScripts = styleBible.referenceFullScripts?.filter(Boolean) ?? [];
  const titleGuide = styleBible.videoTitleGuidance?.trim();
  if (!titles.length && !snippets.length && !fullScripts.length && !titleGuide) return '';
  const lines: string[] = [
    '',
    'STYLE REFERENCES (required: shape your video title, hook, beats, and caption to match this energy — do not ignore):',
    '',
    titles.length
      ? 'When example video titles appear below, the JSON `title` field is **as binding as** the anti-slop rules: it must visibly belong in the same series as those examples.'
      : titleGuide
        ? 'The operator added **title preferences** below — use them for the JSON `title` when you have no example titles on file.'
        : 'Use the references below to match voice and structure.',
    '',
    'ANTI-COPY RULES (non-negotiable):',
    '- Do NOT reuse sentences, distinctive phrases, jokes, or statistics from the references.',
    '- Do NOT paraphrase so closely that a listener would recognize the source script.',
    '- Treat references as silent teachers only: invent fresh hook, beats, and caption for THIS topic.',
  ];
  if (titles.length) {
    lines.push('', 'Example titles from this account (study them before you write):');
    for (const t of titles.slice(0, 20)) lines.push(`  • "${t}"`);
    lines.push(
      '',
      'TITLE PATTERN (when examples exist):',
      '- Your JSON `title` for THIS topic should feel like the **next video in the same playlist** as the examples above.',
      '- Mirror how they use length, punctuation (including `:` or `?` if that is how the samples read), caps, and specificity — by imitation, not by rules from the system.',
      '- Prefer punchy, specific lines over generic SEO if that is what the samples show.',
    );
  }
  if (titleGuide) {
    lines.push(
      '',
      titles.length
        ? 'OPERATOR — TITLE PREFERENCES (apply alongside the examples):'
        : 'OPERATOR — TITLE PREFERENCES (no example titles on file — use for the JSON `title`):',
      titleGuide,
    );
  }
  if (snippets.length) {
    lines.push('', 'Example short lines / hook cadence (do not reuse wording):');
    for (const s of snippets.slice(0, 20)) lines.push(`  • ${s}`);
  }
  if (fullScripts.length) {
    lines.push(
      '',
      'REFERENCE FULL SCRIPTS (read these — your output should **feel like the same writer** for a new topic):',
      '- Copy **structure**: how many beats/sections, how long lines run, question vs statement ratio, where emphasis lands.',
      '- Copy **rhythm and density**: short punchy vs longer explanatory; how often proper nouns and numbers appear.',
      '- Copy **tone** (sarcastic, earnest, documentary, etc.) — but **words, jokes, stats, and facts must be wholly original** for the assigned topic (see anti-copy rules).',
    );
    for (let i = 0; i < Math.min(fullScripts.length, 5); i++) {
      const raw = fullScripts[i]!;
      const body =
        raw.length > MAX_REFERENCE_SCRIPT_CHARS
          ? `${raw.slice(0, MAX_REFERENCE_SCRIPT_CHARS)}\n[…truncated for context limit…]`
          : raw;
      lines.push('', `--- REFERENCE_SCRIPT_${i + 1} (do not copy) ---`, body, `--- END REFERENCE_SCRIPT_${i + 1} ---`);
    }
  }
  lines.push(
    '',
    'FOLLOW-THROUGH (mandatory): The JSON `title`, `hook`, every shot `voiceover` / `onScreen`, and `caption` must read like the **same creator** as the style bible + references.',
    '- **Title:** If example titles exist, the new `title` must mirror their **visible pattern** (not paraphrase an old title — invent a new one for THIS topic that would sit beside them in a feed). If only operator title preferences exist, follow those for `title`.',
    '- **Script / storyboard:** If reference full scripts exist, match **how** they build curiosity, land facts, and pace lines — without reusing phrases. If only snippets exist, match hook line energy the same way.',
    '- Do not output generic hooks or titles when the references show punchy, specific, or numbered patterns.',
  );
  return lines.join('\n');
}

/**
 * Short clause for per-shot image/video prompts so Flux/Kling/etc. see brand
 * motifs + copy rhythm (not only the storyboard planner).
 */
export function buildVisualBrandHintsForShots(styleBible?: PersonalAccountStyleBible): string | undefined {
  if (!styleBible) return undefined;
  const parts: string[] = [];
  const titles = styleBible.exampleVideoTitles?.filter(Boolean).slice(0, 6) ?? [];
  if (titles.length) {
    parts.push(`Title energy (do not paint these words on the image): ${titles.map((t) => `"${t}"`).join(', ')}`);
  }
  const samples = styleBible.copySamples?.filter(Boolean).slice(0, 4) ?? [];
  if (samples.length) {
    parts.push(
      `Copy rhythm for this brand: ${samples.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 100)).join(' · ')}`,
    );
  }
  const hookSnippets = styleBible.exampleScriptSnippets?.filter(Boolean).slice(0, 4) ?? [];
  if (hookSnippets.length) {
    parts.push(
      `Hook line cadence (do not render as on-image text): ${hookSnippets.map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 90)).join(' · ')}`,
    );
  }
  const motifs = styleBible.motifs?.filter(Boolean).slice(0, 6) ?? [];
  if (motifs.length) parts.push(`Visual motifs: ${motifs.join('; ')}`);
  if (styleBible.typography?.trim()) parts.push(`On-image text feel: ${styleBible.typography.trim()}`);
  const dos = styleBible.dos?.filter(Boolean).slice(0, 6) ?? [];
  if (dos.length) parts.push(`Always: ${dos.join('; ')}`);
  if (!parts.length) return undefined;
  return parts.join(' ');
}

/** Director / legacy script: bias toward stills vs motion in sourcing. */
export function buildMediaPreferencePrompt(
  pref?: PersonalGeneratorConfig['mediaPreference'],
): string {
  if (!pref || pref === 'mixed') return '';
  if (pref === 'stills_only') {
    return [
      '',
      'VISUAL SOURCING (account): IMAGES / STILLS ONLY.',
      'Every shot kind must be one of: ai_image, scraped_image, or user_media.',
      'Do NOT use ai_video, scraped_video, or b_roll (those imply motion video clips).',
      'Implied motion comes from camera language + Ken Burns on stills only.',
    ].join('\n');
  }
  if (pref === 'video_only') {
    return [
      '',
      'VISUAL SOURCING (account): VIDEO CLIPS ONLY (no still-first shots).',
      'Every shot kind must be one of: ai_video, scraped_video, b_roll, or user_media when it is already video.',
      'Do NOT use ai_image or scraped_image — motion must be real video pixels.',
      'If budget is tight, prefer scraped_video / b_roll over ai_video except for hero moments.',
    ].join('\n');
  }
  return [
    '',
    'VISUAL SOURCING (account): MOTION PREFERRED.',
    'Lean on ai_video, scraped_video, or b_roll when the beat benefits from real movement.',
    'Still use ai_image where motion would not help — do not force video on every shot.',
  ].join('\n');
}

/** Hint average on-screen seconds per shot / beat. */
export function buildAverageShotPrompt(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const s = Math.min(10, Math.max(2, seconds));
  return `\n\nSHOT PACING (account): Aim for about ${s} seconds per shot on average (±1s). Adjust how many shots you place per beat so total runtime still matches the target duration.`;
}

/** Legacy script path — short line for generateScript prompt. */
export function buildLegacyMediaPreferenceLine(
  pref?: PersonalGeneratorConfig['mediaPreference'],
): string {
  if (!pref || pref === 'mixed') return '';
  if (pref === 'stills_only') {
    return '\n\nVISUALS: This account wants STILL IMAGES only in the final edit — imageQuery should describe static frames; we will not use stock video or AI video clips for beats.';
  }
  if (pref === 'video_only') {
    return '\n\nVISUALS: This account wants VIDEO clips only — we will not ship Ken-Burns stills as primary beats; imageQuery should describe motion B-roll.';
  }
  return '\n\nVISUALS: This account prefers MOTION where possible — write imageQuery with dynamic subjects (action, crowds, weather) so we can favor video B-roll when sourcing.';
}
