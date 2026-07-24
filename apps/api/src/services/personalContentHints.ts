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

/** ASCII ":" or fullwidth "：" after NFKC — catches common Unicode colon tricks. */
export function textIncludesColonLike(s: string): boolean {
  return /[\u003A\uFF1A]/.test(s.normalize('NFKC'));
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
 * Light guardrails when example titles exist: empty, topic echo, exact reuse
 * of a saved example. Punctuation that **matches the examples** is enforced
 * separately in {@link validateChannelHeadline}.
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

/**
 * Headline checks for the title generator: base guards vs examples/topic,
 * colon packaging when examples warrant it, and "?" ending when examples
 * strongly use questions. Past published titles are **not** validated here —
 * the title LLM prompt lists them and instructs the model not to copy; no
 * post-generation similarity scoring.
 */
export function validateChannelHeadline(
  title: string | undefined,
  topic: string,
  examples: string[],
): string | null {
  const ex = examples.map((e) => e.trim()).filter(Boolean);
  if (!ex.length) return null;

  const base = validateDirectorTitleAgainstExamples(title, topic, ex);
  if (base) return base;

  const t = (title ?? '').trim();

  /** ASCII `:` or fullwidth `：` then whitespace — "Headline: rest" packaging. */
  const titleHasColonSubtitleDelimiter = (line: string) =>
    /(?:\u003A|\uFF1A)\s/.test(line.normalize('NFKC'));

  /** A single stray example with `: ` must not unlock colon titles for the whole channel. */
  const colonExamples = ex.filter((e) => titleHasColonSubtitleDelimiter(e)).length;
  const colonRatio = colonExamples / ex.length;
  if (!(colonRatio > 0.5) && titleHasColonSubtitleDelimiter(t)) {
    return 'Most of your example titles do not use ": " headline packaging (colon + space) — match your list; do not add documentary / episode-style "Label: hook" titles.';
  }

  const qCount = ex.filter((e) => /\?\s*$/.test(e)).length;
  if (ex.length >= 2 && qCount / ex.length >= 0.65 && !/\?\s*$/.test(t)) {
    return 'Most of your example titles end with "?" — end this title with "?" like the examples.';
  }

  return null;
}

/** Concrete constraints derived from example titles (injected under STEP 0). */
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
    'MEASURED CONSTRAINTS FROM EXAMPLE TITLES (aim to sit in the same band as these — same *feel*, new words for this topic):',
    `- Length: your samples run about ${minW}–${maxW} words (median ~${median.toFixed(1)}). Aim for a similar length unless one example clearly breaks the pattern.`,
    `- Questions vs statements: ${qPct}% of the samples end with "?". ${qPct >= 65 ? 'Prefer a "?" ending so the new line feels like the rest of the list.' : 'Match the mix in the samples rather than defaulting to a different style.'}`,
  ];
  if (top.length) {
    lines.push(
      `- Opening rhythm: the samples often open like: ${top.map(([k, v]) => `"${k}" (${v}×)`).join(', ')}. Let the new title feel like it belongs in that same opening *family* when it fits the topic — no rigid template, just the same instinct as the examples.`,
    );
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
    'STEP 0 — JSON `title` (strict — when example titles exist below)',
    '══════════════════════════════════════════════════════════════════',
    '',
    'The operator saved **example video titles**. They are the **only** contract for headline **format and register** (how the line is built and how it sounds). THEME voice, tagline, or "documentary narrator" instructions below apply to narration and shots — **not** as an excuse to pick a different headline species (e.g. "The X: Why Y" if the examples never do that).',
    '',
    'Before hook or beats:',
    '1. Read every example title. Note shared format: length band, punctuation, question vs statement, proper nouns vs generic words, curiosity level — not the historical facts (those are samples only).',
    '2. Write **one** new `title` for **TOPIC FOR THIS VIDEO** that is the **next line in the same numbered list** as those examples — same format and content register, new words only.',
    '3. If your `title` could be mistaken for a different channel or a TV episode title, start over until it matches the example list.',
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
    '5. Only after that `title` matches the example list in format and register, write hook + beats so they **deliver what the title promises**.',
    '',
    'Invalid: a `title` that follows THEME/marketing habits instead of the example-title list. Valid: indistinguishable in *species* from the examples, new wording for this topic only.',
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

/** Example titles + optional full scripts for style (never verbatim copy). */
export function buildStyleExamplesPrompt(styleBible?: PersonalAccountStyleBible): string {
  if (!styleBible) return '';
  const titles = styleBible.exampleVideoTitles?.filter(Boolean) ?? [];
  const fullScripts = styleBible.referenceFullScripts?.filter(Boolean) ?? [];
  const titleGuide = styleBible.videoTitleGuidance?.trim();
  if (!titles.length && !fullScripts.length && !titleGuide) return '';
  const lines: string[] = [
    '',
    'STYLE REFERENCES (required: shape your video title, hook, beats, and caption to match this energy — do not ignore):',
    '',
    titles.length
      ? 'When example video titles appear below, the JSON `title` is **strictly** bound to them: **same format and same content register** (how direct, how curious, how “documentary” vs punchy) as those lines — not merely “inspired by”. Theme/tagline voice does not override this for the title string.'
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
      'TITLE PATTERN (when examples exist — mandatory):',
      '- The JSON `title` must read as the **next line in the same list** as the examples: same headline **format** (length band, punctuation habits including `:` only if samples use it, `?` vs statement) and same **register** (tone/density of names and numbers).',
      '- Do **not** import title shapes from THEME, generic Shorts tropes, or prestige-TV naming unless the examples already look that way.',
      '- New facts and nouns only for this topic — never reuse or lightly edit an example line.',
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
    '- **Title:** If example titles exist, the new `title` must match their **format and register** strictly (same species of headline; new words for this topic only). Theme narration style does not change that rule. If only operator title preferences exist, follow those for `title`.',
    '- **Script / storyboard:** If reference full scripts exist, match **how** they build curiosity, land facts, and pace lines — without reusing phrases.',
    '- Do not output generic hooks or titles when the references show punchy, specific, or numbered patterns.',
  );
  return lines.join('\n');
}

/**
 * Short clause for per-shot image/video prompts so Flux/Kling/etc. see brand hints
 * (never paste example titles as literal on-image text — image models render quoted strings).
 */
export function buildVisualBrandHintsForShots(styleBible?: PersonalAccountStyleBible): string | undefined {
  if (!styleBible) return undefined;
  const parts: string[] = [
    'Do not render channel titles, JSON titles, example video headlines, hook samples, or script snippets as typography in the image — diffusion models often literalize quoted strings from briefs. Convey the brand only through palette, composition, lighting, and subject matter.',
    'Unless a script-locked on-image fact label is explicitly requested for this shot, generate a text-free frame: no captions, titles, watermarks, or readable signage.',
  ];
  if (styleBible.typography?.trim()) {
    parts.push(
      `Overall type hierarchy / label feel (never spell sample titles; only apply when a script-locked label is present): ${styleBible.typography.trim()}`,
    );
  }
  const dos = styleBible.dos?.filter(Boolean).slice(0, 6) ?? [];
  if (dos.length) {
    parts.push(`Always: ${dos.join('; ')}`);
  }
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

/** Hint average on-screen seconds per shot / beat — tight band so dashboard “Avg clip” is respected. */
export function buildAverageShotPrompt(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const s = Math.min(12, Math.max(1.5, seconds));
  return `\n\nSHOT PACING (account): Target **~${s.toFixed(2)}s** per shot on average — keep most \`durationSeconds\` in **${(s * 0.85).toFixed(1)}–${(s * 1.15).toFixed(1)}s** unless that shot's VO clearly needs more air. **Vary** lengths; never paste one duration on every shot. Split into more shots when narration is dense — do not stretch one visual to carry unrelated lines.`;
}

/**
 * Minimum / maximum shot counts for short-form director prompts from target runtime
 * and average clip preference (keeps image count in line with VO length).
 */
export function directorShotCountRange(args: {
  targetDurationSeconds: number;
  averageShotSeconds?: number;
  cutPace?: 'relaxed' | 'normal' | 'rapid';
}): { min: number; max: number } {
  const tgt = Math.max(15, args.targetDurationSeconds);
  const ac =
    args.averageShotSeconds != null &&
    Number.isFinite(args.averageShotSeconds) &&
    args.averageShotSeconds > 0
      ? Math.min(10, Math.max(1.6, args.averageShotSeconds))
      : 3;
  const pace = args.cutPace ?? 'normal';
  const spanLo = pace === 'rapid' ? ac * 0.82 : pace === 'relaxed' ? ac * 1.12 : ac * 0.92;
  const spanHi = pace === 'rapid' ? ac * 1.2 : pace === 'relaxed' ? ac * 1.55 : ac * 1.42;
  /** When avg clip is low, require more shots so VO does not balloon each beat past the pacing hint. */
  const minFromTightPace =
    ac <= 2
      ? Math.ceil(tgt / (ac * 0.9))
      : ac <= 2.75
        ? Math.ceil(tgt / (ac * 1.0))
        : 0;
  const min = Math.max(
    pace === 'rapid' ? 7 : pace === 'relaxed' ? 4 : 5,
    Math.ceil(tgt / spanHi),
    minFromTightPace,
    /** Slightly more cuts than spanHi alone so VO rarely outruns planned stills. */
    Math.ceil(tgt / (ac * 1.28)),
  );
  const max = Math.min(
    52,
    Math.max(min + 2, Math.floor(tgt / spanLo)),
  );
  return { min, max: Math.max(min, max) };
}

/** Ask the model for enough distinct shots/beats for the target runtime (still images vs VO timing are aligned in post). */
export function buildMinShotsForRuntimePrompt(
  targetDurationSeconds?: number,
  averageClipSeconds?: number,
  opts?: { longform?: boolean; cutPace?: 'relaxed' | 'normal' | 'rapid' },
): string {
  if (targetDurationSeconds == null || !Number.isFinite(targetDurationSeconds)) return '';
  if (opts?.longform) {
    const tgt = Math.max(5, targetDurationSeconds);
    const ac =
      averageClipSeconds != null && Number.isFinite(averageClipSeconds)
        ? Math.min(10, Math.max(1.8, averageClipSeconds))
        : 5.5;
    const minShots = Math.max(3, Math.ceil(tgt / (ac * 0.92)));
    const softCap = 72;
    const capHint =
      minShots > softCap
        ? ` If that implies more than ~${softCap} shots, use slightly longer beats instead of micro-cuts, but never fewer than ~${Math.ceil(tgt / (ac * 1.35))} shots for this runtime.`
        : '';
    return `\n\nSHOT COUNT (runtime): Target ~${Math.round(tgt)}s total. Plan at least **${minShots}** shots/beats at roughly ${ac.toFixed(1)}s average on-screen each so the edit can match narration without holding one image too long.${capHint}`;
  }
  const { min } = directorShotCountRange({
    targetDurationSeconds: targetDurationSeconds,
    averageShotSeconds: averageClipSeconds,
    cutPace: opts?.cutPace ?? 'normal',
  });
  const tgt = Math.max(5, targetDurationSeconds);
  return `\n\nSHOT COUNT (runtime): Target ~${Math.round(tgt)}s total. Plan at least **${min}** distinct shots (more is fine up to the director max) so each VO line can get its own visual — the pipeline measures real speech and will not keep every clip identical in length. Avoid one still carrying multiple unrelated lines; the last shot must not absorb the entire outro unless the script there is a single short line.`;
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
