/**
 * Prompt + Claude interaction for personal-content scripts.
 *
 * Given a theme, a topic angle, and the account's context, produces a
 * structured video script that the downstream renderer can consume
 * without further interpretation:
 *
 *   {
 *     title, hook, topic, beats: [ { text, imageQuery, durationSeconds, onScreen, voiceover } ],
 *     outro, caption, hashtags, musicMoodOverride?
 *   }
 *
 * The `beats` array is the primary contract between Claude and the
 * Remotion compositions. Each beat is one on-screen segment with its
 * own image search query, narrated text, and burned-in caption.
 */

import { randomInt, randomUUID } from 'node:crypto';
import { generateJSON } from './claude.js';
import { withRetry } from './retry.js';
import type { PersonalTheme } from './personalThemes.js';
import type { PersonalAccountStyleBible } from '@boost/database';
import {
  buildStyleExamplesPrompt,
  buildTitleFirstWorkflowPrompt,
} from './personalContentHints.js';
import { resolveLockedChannelVideoTitle } from './personalChannelTitle.js';
import { clampLongformTargetSeconds } from './personalLongform.js';
import { normalizeYoutubeCaption } from './personalDirector.js';

export interface PersonalScript {
  title: string;
  hook: string;
  topic: string;
  beats: PersonalScriptBeat[];
  outro: string;
  caption: string;
  hashtags: string[];
  /** Claude can override the theme's music mood for a specific story. */
  musicMoodOverride?: string;
  /** Safety — set to true when Claude decides the topic is inappropriate. */
  blocked?: boolean;
  blockReason?: string;
}

export interface PersonalScriptBeat {
  /** Ordinal, starting at 0. */
  order: number;
  /** Narrated text (voiceover). Keep 1–2 short sentences. */
  voiceover: string;
  /** Big-text burned into the frame. Shorter than voiceover. */
  onScreen: string;
  /** Search query used to fetch imagery for this beat. */
  imageQuery: string;
  /** Optional smaller subtitle / eyebrow. */
  eyebrow?: string;
  /** Seconds this beat should stay on screen. */
  durationSeconds: number;
}

export interface GenerateScriptArgs {
  theme: PersonalTheme;
  topic: string;
  /** Account-level custom direction layered on top of the theme. */
  customDirection?: string;
  /** Topics to avoid. */
  blacklist?: string[];
  /** Language for the narration. ISO 639-1. */
  language?: string;
  /** Target duration in seconds. Overrides theme default. */
  targetDurationSeconds?: number;
  /** Optional recent-news context for news-style themes. */
  newsContext?: string;
  /** Per-account style bible (vibe, palette, examples, etc.). */
  styleBible?: PersonalAccountStyleBible;
  /** Character guidance — dropped into the prompt when the account uses an AI persona. */
  characterGuide?: {
    name: string;
    promptFragment?: string;
    voiceTone?: string;
    voicePace?: string;
    catchphrases?: string[];
  };
  /** Descriptions + tags of the user's uploaded reference media. */
  referenceMediaDigest?: string;
  /** Extra blocks (content rules, style examples, pacing, media bias). */
  promptAppendix?: string;
  /** Target seconds per beat — centers the duration clamp when set. */
  averageClipSeconds?: number;
  /** Claude model for script JSON. */
  scriptModel?: 'sonnet' | 'opus';
  /** Recent `script.title` values on this channel — avoid duplicate headlines. */
  recentVideoTitles?: string[];
  /**
   * Long-form flag — forwarded to the same title pass as {@link planStoryboard} / isolated test.
   */
  longform?: boolean;
  /**
   * When set, script JSON `title` must match exactly (normally from
   * {@link resolveLockedChannelVideoTitle} inside {@link generateScript}).
   */
  lockedVideoTitle?: string;
}

export async function generateScript(
  args: GenerateScriptArgs,
): Promise<PersonalScript> {
  const exampleTitles = (args.styleBible?.exampleVideoTitles ?? []).map((t) => t.trim()).filter(Boolean);

  const lockedVideoTitle = await resolveLockedChannelVideoTitle({
    topic: args.topic,
    language: args.language,
    styleBible: args.styleBible,
    recentVideoTitles: args.recentVideoTitles,
    longform: args.longform === true,
    lockedVideoTitle: args.lockedVideoTitle,
  });

  if (exampleTitles.length > 0 && !lockedVideoTitle?.trim()) {
    throw new Error(
      '[personal_script] Example video titles are configured but no locked title was produced.',
    );
  }

  const prompt = buildScriptPrompt({
    ...args,
    lockedVideoTitle: lockedVideoTitle || undefined,
  });
  const script = await withRetry(
    () =>
      generateJSON<PersonalScript>(prompt, {
        model: args.scriptModel ?? 'sonnet',
        maxTokens: args.longform === true ? 4096 : 2048,
      }),
    { label: `personal_script:${args.theme.id}:${args.topic.slice(0, 40)}`, attempts: 3 },
  );

  if (exampleTitles.length > 0) {
    script.title = lockedVideoTitle!.trim();
  } else if (lockedVideoTitle) {
    script.title = lockedVideoTitle;
  }

  // Sanity defaults — Claude very occasionally omits fields.
  const maxBeats = args.longform === true ? 48 : 8;
  script.beats = (script.beats ?? [])
    .map((b, i) => ({
      order: b.order ?? i,
      voiceover: (b.voiceover ?? '').trim(),
      onScreen: (b.onScreen ?? '').trim(),
      imageQuery: (b.imageQuery ?? args.topic).trim(),
      eyebrow: b.eyebrow?.trim() || undefined,
      durationSeconds: clampDuration(b.durationSeconds, args.averageClipSeconds, args.longform === true),
    }))
    .filter((b) => b.voiceover.length > 0 || b.onScreen.length > 0)
    .slice(0, maxBeats);

  if (script.beats.length === 0) {
    throw new Error('Script came back with no beats');
  }

  script.caption = normalizeYoutubeCaption((script.caption ?? '').trim(), {
    longform: args.longform === true,
  });
  if (!script.caption) {
    script.caption = normalizeYoutubeCaption(
      [(script.hook ?? '').trim(), (script.outro ?? '').trim()].filter(Boolean).join('\n\n') ||
        (script.title || args.topic),
      { longform: args.longform === true },
    );
  }

  return script;
}

function clampDuration(n: number | undefined, averageSeconds?: number, longform = false): number {
  const lo = longform ? 2 : 1.5;
  const hi = longform ? 14 : 8;
  const defaultCenter = longform ? 5 : 3;
  const center =
    averageSeconds != null && Number.isFinite(averageSeconds)
      ? Math.min(hi, Math.max(lo, Math.min(longform ? 12 : 7, Math.max(2, averageSeconds))))
      : defaultCenter;
  if (n == null || Number.isNaN(n)) return center;
  return Math.max(lo, Math.min(hi, n));
}

function buildScriptPrompt(args: GenerateScriptArgs): string {
  const target =
    args.longform === true
      ? clampLongformTargetSeconds(args.targetDurationSeconds ?? args.theme.targetDurationSeconds)
      : (args.targetDurationSeconds ?? args.theme.targetDurationSeconds);
  const longformBlock =
    args.longform === true
      ? `\n\nLONG-FORM MODE (~${target}s total runtime, about ${Math.floor(target / 60)} min):\n- Output **12–48 beats** (not 4–7). Each beat is one on-screen segment with its own imageQuery.\n- The **sum** of every beat's \`durationSeconds\` must land within **±18%** of ${target} seconds — this is a hard pacing contract.\n- Keep each beat's voiceover substantive (this is a longer video), but still one clear idea per beat.\n`
      : '';
  const blacklist =
    args.blacklist && args.blacklist.length > 0
      ? `\n\nNEVER mention or imply any of the following: ${args.blacklist.join(', ')}.`
      : '';
  const direction = args.customDirection
    ? `\n\nACCOUNT-LEVEL DIRECTION (layered on top of the theme): ${args.customDirection}`
    : '';
  const newsContext = args.newsContext
    ? `\n\nRECENT NEWS CONTEXT (ground your claims in this):\n${args.newsContext}`
    : '';
  const langLine =
    args.language && args.language !== 'en'
      ? `\n\nAll voiceover and on-screen text MUST be written in ISO language code "${args.language}".`
      : '';

  // ── Format cue — tells Claude the output medium ──────────
  const isSlideshow =
    args.theme.template === 'slideshow' ||
    args.theme.template === 'satisfying-loop' ||
    args.theme.template === 'scripture-card' ||
    args.theme.defaultFormat === 'slideshow';

  const formatNote = isSlideshow
    ? `\n\nFORMAT: Slideshow — still images in sequence. Voiceover is optional (leave blank when the theme's useVoiceover is false). Every beat's \`onScreen\` is what viewers see — keep them crisp (3-8 words), legible on a still image.`
    : '';

  // ── Style bible (the biggest anti-slop lever we have) ───────
  const sb = args.styleBible;
  const styleExamples = buildStyleExamplesPrompt(sb);
  const coreStyleBible = sb
    ? [
        '',
        'ACCOUNT STYLE BIBLE (this is the vibe the operator wants — match it; your title + hook + beats must feel like this voice):',
        sb.vibe ? `- Vibe: ${sb.vibe}` : '',
        sb.dos && sb.dos.length > 0 ? `- Always do: ${sb.dos.join(' · ')}` : '',
        sb.donts && sb.donts.length > 0 ? `- Never do: ${sb.donts.join(' · ')}` : '',
        sb.palette && sb.palette.length > 0
          ? `- Brand palette (use in imagery and mood): ${sb.palette.join(', ')}`
          : '',
        sb.typography?.trim()
          ? `- Typography / on-screen text: ${sb.typography.trim()}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  const styleBibleBlock = [coreStyleBible.trim(), styleExamples.trim()].filter(Boolean).join('\n');

  // ── Character ─────────────────────────────────────────────
  const charBlock = args.characterGuide
    ? `\n\nON-CAMERA PERSONA (the video features this character — write in their voice):\n- Name: ${args.characterGuide.name}\n${args.characterGuide.promptFragment ? `- Look: ${args.characterGuide.promptFragment}\n` : ''}${args.characterGuide.voiceTone ? `- Voice tone: ${args.characterGuide.voiceTone}\n` : ''}${args.characterGuide.voicePace ? `- Pace: ${args.characterGuide.voicePace}\n` : ''}${args.characterGuide.catchphrases && args.characterGuide.catchphrases.length > 0 ? `- Catchphrases (use sparingly): ${args.characterGuide.catchphrases.join(' · ')}` : ''}`
    : '';

  // ── Reference media digest ───────────────────────────────
  const refBlock = args.referenceMediaDigest
    ? `\n\nUSER-UPLOADED REFERENCES (pull visual cues from these when choosing imageQuery — match the vibe):\n${args.referenceMediaDigest}`
    : '';

  const appendix = args.promptAppendix?.trim() ? `\n\n${args.promptAppendix.trim()}` : '';

  const locked = args.lockedVideoTitle?.trim();
  const exampleTitleCount = sb?.exampleVideoTitles?.filter(Boolean).length ?? 0;
  const titleFirst =
    locked && locked.length > 0
      ? ''
      : buildTitleFirstWorkflowPrompt(sb, args.recentVideoTitles);
  const lockedTitleBlock =
    locked && locked.length > 0
      ? `\n\nLOCKED TITLE — JSON "title" must be this exact string (do not edit):\n<<< ${locked} >>>\nThis string matches the account’s **example video titles** (format + register). Hook and beats must match this title. VOICE GUIDE below is for narration — do not reinterpret the title.\n`
      : '';
  const scriptTitleContract =
    exampleTitleCount > 0
      ? '<one line — STRICT: same format and content register as STYLE example titles for THIS topic; must differ from ALREADY-PUBLISHED; theme voice is NOT a different title format>'
      : '<catchy title, 5-9 words>';
  const titleJsonLine =
    locked && locked.length > 0
      ? `  "title": ${JSON.stringify(locked)},`
      : `  "title": "${scriptTitleContract}",`;

  return `You are a short-form video scriptwriter specialised in the "${args.theme.name}" niche, writing for an operator who HATES generic AI-slop content. Your job is to produce a script a skilled human editor would not be embarrassed to ship.
${titleFirst}${lockedTitleBlock}
THEME: ${args.theme.name} — ${args.theme.tagline}
DESCRIPTION: ${args.theme.description}
VOICE GUIDE: ${args.theme.voiceGuide}
VISUAL STYLE HINT: ${args.theme.visualStyle}
TARGET DURATION: ~${target} seconds
HOOK FORMULAS (pick and adapt one): ${args.theme.hookFormulas.join(' | ')}
TOPIC FOR THIS VIDEO: ${args.topic}${direction}${newsContext}${blacklist}${langLine}${formatNote}${styleBibleBlock}${charBlock}${refBlock}${appendix}

ANTI-SLOP RULES (non-negotiable):
1. No LLM clichés. Never write: "let's dive in", "in the realm of", "it's no secret", "game-changer", "paradigm shift", "at the end of the day", "moreover", "furthermore", "in conclusion", "unleash", "revolutionary", "cutting-edge", "this will blow your mind", "you won't believe", "this one simple trick".
2. Be concrete. Names, dates, exact numbers, specific places. Not "a lot of people" — "42% of Gen Z".
3. Voice is human, not explainer. Use contractions, occasional fragments, rhythm. Avoid encyclopedia register.
4. Specificity earns retention. Each beat should teach one unambiguous thing.
5. Never invent statistics, quotes, or events. If the grounding above doesn't support a claim, drop it.
6. No hashtag soup. 5-8 hashtags, mixing high-volume and niche, lowercase, no leading #.
7. No emoji salad. Caption uses 0-3 emoji, purposefully.

OUTPUT CONTRACT:
1. **Hook** — one-line attention grabber. ≤3 seconds of VO. Must pass the anti-slop rules above.
2. **Beats** — ${args.longform === true ? '**12–48 beats** (see LONG-FORM MODE above).' : '4-7 beats.'} Each beat:
   - \`voiceover\` — 1 short sentence, natural, conversational.
   - \`onScreen\` — shorter (3-8 words), burned-in big text.
   - \`imageQuery\` — 2-10 concrete-noun keywords for Pexels/Unsplash/etc. Prefer specific tangible things over abstract concepts.
     IMPORTANT: every beat's imageQuery must be **visually distinct** from the others. No near-duplicates like "person thinking" repeated 5 times.
     Each image must have a purpose tied to that beat's idea (e.g. "factory smokestacks at dusk" vs "coal plant aerial" vs "bar chart of emissions" vs "EV charging station close-up").
     Avoid using the same core subject noun more than twice across the whole script unless it's required for the story.
   - \`durationSeconds\` — ${args.longform === true ? 'usually 3–10s per beat; vary pacing.' : 'usually 2-5s.'}
   - \`eyebrow\` — optional 1-3 word label.
3. **Outro** — 1 sentence CTA in the theme's voice. Conversational, not salesy.
4. **Caption** — YouTube/Shorts description: 1–2 short sentences (~120–320 chars). Front-load topic keywords, tease one concrete payoff, optional soft CTA. Not a full summary; built to help get clicks/views. 0–2 emoji. No hashtags in the prose.
5. **Hashtags** — 5-10 hashtags.
6. **musicMoodOverride** — only when a specific mood suits this topic better than the theme default.

ACCURACY CONSTRAINT: Never invent people, quotes, dates, or figures. If a detail is uncertain, say "reportedly" or drop it.

SAFETY CONSTRAINT: If the topic requires medical, legal, or financial advice, keep it general and educational. If the topic is inappropriate for a general short-form audience, respond: { "blocked": true, "blockReason": "..." }.

Return ONLY JSON matching:
{
${titleJsonLine}
  "hook": "<spoken opener>",
  "topic": "<normalised topic>",
  "beats": [
    { "order": 0, "voiceover": "...", "onScreen": "...", "imageQuery": "...", "eyebrow": "...", "durationSeconds": 3 }
  ],
  "outro": "<final CTA>",
  "caption": "<YouTube description: 1–2 short sentences, keyword-front hook>",
  "hashtags": ["tag1", "tag2"],
  "musicMoodOverride": "<optional>"
}
`;
}

/* ─── Topic chooser ──────────────────────────────────────────────── */

export interface ChooseTopicArgs {
  theme: PersonalTheme;
  topicSeeds?: string[];
  recentTopics?: string[]; // avoid immediate repeats
  customDirection?: string;
  /**
   * When the account has no topic seeds, we infer a topic from these example
   * titles instead of using built-in `theme.topicSeeds` (avoids Ötzi/Lascaux
   * defaults on Ancient Origins, etc.).
   */
  styleBible?: PersonalAccountStyleBible;
}

/**
 * Picks the next topic for a personal account.
 *
 * 1. Uses **account topic seeds** when the operator configured any.
 * 2. Otherwise, if **example video titles** exist on the style bible, invents
 *    a fresh factual topic seed from that list (same idea as the isolated
 *    title test) — never silently falls back to built-in `theme.topicSeeds`
 *    when examples exist.
 * 3. Otherwise falls back to `theme.topicSeeds` (e.g. slideshow / accounts
 *    with no examples yet), then the usual refresh LLM pass.
 */
export async function chooseTopic(args: ChooseTopicArgs): Promise<string> {
  const recent = new Set(args.recentTopics ?? []);
  const accountSeeds = (args.topicSeeds ?? []).map((t) => t.trim()).filter(Boolean);

  if (accountSeeds.length === 0) {
    const examples = (args.styleBible?.exampleVideoTitles ?? [])
      .map((t) => String(t).trim())
      .filter(Boolean);
    if (examples.length > 0) {
      return await inventTopicSeedFromExampleTitles(examples, args.theme, args.customDirection, recent);
    }
  }

  const pool =
    accountSeeds.length > 0
      ? accountSeeds
      : (args.theme.topicSeeds ?? []).filter((t) => t.trim().length > 0);
  if (pool.length === 0) {
    throw new Error(
      '[chooseTopic] No topic seeds and no example video titles on this account. Add topic seeds (one per line) or example titles under Style & config.',
    );
  }

  const freshSeeds = pool.filter((t) => !recent.has(t));
  const seedChoice =
    freshSeeds.length > 0
      ? freshSeeds[Math.floor(Math.random() * freshSeeds.length)]!
      : pool[Math.floor(Math.random() * pool.length)]!;

  try {
    const prompt = `You are planning the next post for a "${args.theme.name}" channel.

THEME: ${args.theme.tagline}
SEED TOPIC: ${seedChoice}
${args.customDirection ? `ACCOUNT DIRECTION: ${args.customDirection}\n` : ''}${
      args.recentTopics && args.recentTopics.length > 0
        ? `AVOID REPEATING: ${args.recentTopics.slice(0, 12).join(' | ')}\n`
        : ''
    }
Task: return a single, fresh, specific topic line for the next video. Keep it concrete — include a name, number, or event when relevant. 4-12 words.

Return JSON only: { "topic": "..." }`;
    const { topic } = await generateJSON<{ topic: string }>(prompt, {
      model: 'sonnet',
      maxTokens: 200,
    });
    return topic.trim();
  } catch {
    return seedChoice;
  }
}

const TOPIC_INVENT_SPIN_AXES = [
  'food, hunger, digestion, or feasts',
  'stone tools, fire, clothing, or shelter',
  'migration, coasts, boats, or getting lost',
  'families, elders, kids, or social tension',
  'night, sleep, dreams, fear, or boredom',
  'hunting, animals, dogs, or dangerous wildlife',
  'weather extremes: cold, heat, storms, drought',
  'art, caves, pigments, ornaments, music',
  'burials, grief, bodies, or afterlife beliefs',
] as const;

async function inventTopicSeedFromExampleTitles(
  examples: string[],
  theme: PersonalTheme,
  customDirection: string | undefined,
  recent: Set<string>,
): Promise<string> {
  const list = examples.map((e, i) => `${i + 1}. ${e}`).join('\n');
  const rid = randomUUID();
  const spin = TOPIC_INVENT_SPIN_AXES[randomInt(0, TOPIC_INVENT_SPIN_AXES.length)]!;
  const modelRaw = process.env.PERSONAL_TOPIC_INVENT_MODEL?.trim().toLowerCase();
  const model = modelRaw === 'opus' || modelRaw === 'sonnet' ? modelRaw : 'sonnet';

  const avoid =
    recent.size > 0
      ? `\n- Do **not** re-use the same core story as any of these recent topics (new angle only): ${[...recent].slice(0, 12).join(' | ')}`
      : '';

  const prompt = `(Ignore: request_id=${rid})

Channel theme (context only — do not copy theme marketing as the topic): ${theme.name} — ${theme.tagline}

These are real video titles from one channel (tone + subject-matter hints only):

${list}

TASK
- Infer what kinds of stories this channel covers.
- Invent **one** new video **topic seed**: 1–3 short sentences naming a concrete angle (place, era, behavior, or mystery) that would still fit this channel.
- Do **not** copy the exact question or subject of any line above.
- Plain factual seed text only (not a clickbait title).
- **This run:** lean toward material about: **${spin}** (do not paste this bullet into the JSON verbatim).
${customDirection ? `- Respect operator direction when it fits: ${customDirection}\n` : ''}${avoid}

Return ONLY valid JSON: {"topic":"..."}`;

  const raw = await generateJSON<{ topic?: string }>(prompt, {
    model,
    maxTokens: 260,
    temperature: Math.min(1, 0.94 + Math.random() * 0.06),
  });
  const topic = String(raw.topic ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!topic) {
    throw new Error('[chooseTopic] Topic invention from example titles returned an empty topic.');
  }
  return topic;
}
