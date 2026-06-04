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

import { generateJSON } from './claude.js';
import { withRetry } from './retry.js';
import type { PersonalTheme } from './personalThemes.js';
import type { PersonalAccountStyleBible } from '@boost/database';
import { buildStyleExamplesPrompt } from './personalContentHints.js';

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
}

export async function generateScript(
  args: GenerateScriptArgs,
): Promise<PersonalScript> {
  const prompt = buildScriptPrompt(args);
  const script = await withRetry(
    () =>
      generateJSON<PersonalScript>(prompt, {
        model: args.scriptModel ?? 'sonnet',
        maxTokens: 2048,
      }),
    { label: `personal_script:${args.theme.id}:${args.topic.slice(0, 40)}`, attempts: 2 },
  );

  // Sanity defaults — Claude very occasionally omits fields.
  script.beats = (script.beats ?? [])
    .map((b, i) => ({
      order: b.order ?? i,
      voiceover: (b.voiceover ?? '').trim(),
      onScreen: (b.onScreen ?? '').trim(),
      imageQuery: (b.imageQuery ?? args.topic).trim(),
      eyebrow: b.eyebrow?.trim() || undefined,
      durationSeconds: clampDuration(b.durationSeconds, args.averageClipSeconds),
    }))
    .filter((b) => b.voiceover.length > 0 || b.onScreen.length > 0)
    .slice(0, 8);

  if (script.beats.length === 0) {
    throw new Error('Script came back with no beats');
  }

  return script;
}

function clampDuration(n: number | undefined, averageSeconds?: number): number {
  const lo = 1.5;
  const hi = 8;
  const center =
    averageSeconds != null && Number.isFinite(averageSeconds)
      ? Math.min(hi, Math.max(lo, Math.min(7, Math.max(2, averageSeconds))))
      : 3;
  if (n == null || Number.isNaN(n)) return center;
  return Math.max(lo, Math.min(hi, n));
}

function buildScriptPrompt(args: GenerateScriptArgs): string {
  const target = args.targetDurationSeconds ?? args.theme.targetDurationSeconds;
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
  const exampleTitleCount = sb?.exampleVideoTitles?.filter(Boolean).length ?? 0;
  const scriptTitleContract =
    exampleTitleCount > 0
      ? '<title for THIS topic — match PATTERN of STYLE REFERENCES example titles (length, punctuation, specificity); 5-12 words typical when examples exist>'
      : '<catchy title, 5-9 words>';
  const coreStyleBible = sb
    ? [
        '',
        'ACCOUNT STYLE BIBLE (this is the vibe the operator wants — match it; your title + hook + beats must feel like this voice):',
        sb.vibe ? `- Vibe: ${sb.vibe}` : '',
        sb.dos && sb.dos.length > 0 ? `- Always do: ${sb.dos.join(' · ')}` : '',
        sb.donts && sb.donts.length > 0 ? `- Never do: ${sb.donts.join(' · ')}` : '',
        sb.motifs && sb.motifs.length > 0 ? `- Recurring motifs: ${sb.motifs.join(' · ')}` : '',
        sb.palette && sb.palette.length > 0
          ? `- Brand palette (use in imagery and mood): ${sb.palette.join(', ')}`
          : '',
        sb.typography?.trim()
          ? `- Typography / on-screen text: ${sb.typography.trim()}`
          : '',
        sb.bannedPhrases && sb.bannedPhrases.length > 0
          ? `- BANNED phrases (never write these verbatim): ${sb.bannedPhrases.join(' · ')}`
          : '',
        sb.copySamples && sb.copySamples.length > 0
          ? `- Copy samples that capture the voice (mimic this rhythm and lexicon):\n${sb.copySamples.map((s) => `  • "${s}"`).join('\n')}`
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

  return `You are a short-form video scriptwriter specialised in the "${args.theme.name}" niche, writing for an operator who HATES generic AI-slop content. Your job is to produce a script a skilled human editor would not be embarrassed to ship.

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
2. **Beats** — 4-7 beats. Each beat:
   - \`voiceover\` — 1 short sentence, natural, conversational.
   - \`onScreen\` — shorter (3-8 words), burned-in big text.
   - \`imageQuery\` — 2-6 concrete-noun keywords for Pexels/Unsplash/etc. Prefer specific tangible things over abstract concepts.
   - \`durationSeconds\` — usually 2-5s.
   - \`eyebrow\` — optional 1-3 word label.
3. **Outro** — 1 sentence CTA in the theme's voice. Conversational, not salesy.
4. **Caption** — 1-3 sentences, 0-3 emoji. Not a summary of the video; a hook for readers.
5. **Hashtags** — 5-10 hashtags.
6. **musicMoodOverride** — only when a specific mood suits this topic better than the theme default.

ACCURACY CONSTRAINT: Never invent people, quotes, dates, or figures. If a detail is uncertain, say "reportedly" or drop it.

SAFETY CONSTRAINT: If the topic requires medical, legal, or financial advice, keep it general and educational. If the topic is inappropriate for a general short-form audience, respond: { "blocked": true, "blockReason": "..." }.

Return ONLY JSON matching:
{
  "title": "${scriptTitleContract}",
  "hook": "<spoken opener>",
  "topic": "<normalised topic>",
  "beats": [
    { "order": 0, "voiceover": "...", "onScreen": "...", "imageQuery": "...", "eyebrow": "...", "durationSeconds": 3 }
  ],
  "outro": "<final CTA>",
  "caption": "<post caption>",
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
}

/**
 * Picks the next topic for an account. Prefers topicSeeds when the
 * user provided them, otherwise falls back to theme defaults. Always
 * sends a short prompt to Claude to rotate + refresh the angle so
 * viewers don't see identical titles twice.
 */
export async function chooseTopic(args: ChooseTopicArgs): Promise<string> {
  const pool =
    args.topicSeeds && args.topicSeeds.length > 0
      ? args.topicSeeds
      : args.theme.topicSeeds;

  // If we have a rich seed pool, rotate through it deterministically.
  // Otherwise ask Claude for a fresh angle to keep variety high.
  const recent = new Set(args.recentTopics ?? []);
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
