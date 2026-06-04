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

/** Example titles + script lines + optional full scripts for style (never verbatim copy). */
export function buildStyleExamplesPrompt(styleBible?: PersonalAccountStyleBible): string {
  if (!styleBible) return '';
  const titles = styleBible.exampleVideoTitles?.filter(Boolean) ?? [];
  const snippets = styleBible.exampleScriptSnippets?.filter(Boolean) ?? [];
  const fullScripts = styleBible.referenceFullScripts?.filter(Boolean) ?? [];
  if (!titles.length && !snippets.length && !fullScripts.length) return '';
  const lines: string[] = [
    '',
    'STYLE REFERENCES (required: shape your video title, hook, beats, and caption to match this energy — do not ignore):',
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
      'TITLE PATTERN (mandatory when examples exist):',
      '- Your JSON `title` for THIS topic must read like the **next video in the same playlist** as the examples above.',
      '- Match their **typical length** (similar word count band), **punctuation habits** (colons, dashes, question marks, ALL CAPS bits), **whether they lead with a number or a bold claim**, and **specificity level** (vague "Things you didn\'t know" vs concrete "Why Rome fell in 476").',
      '- Do **not** ship a generic SEO title if the examples are punchy, contrarian, or hyper-specific.',
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
    '- **Title:** If example titles exist, the new `title` must mirror their **visible pattern** (not paraphrase an old title — invent a new one for THIS topic that would sit beside them in a feed).',
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
