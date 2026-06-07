/**
 * Standalone channel headline pass. Output is locked into director/script JSON
 * so the large storyboard/script model cannot replace it.
 *
 * One simple LLM prompt (examples + topic + past titles — model is told not to
 * copy past lines), then {@link validateChannelHeadline} for example/topic/colon/? guards only.
 *
 * **Canonical title pass:** {@link channelVideoTitleLikeIsolatedTest} — the same
 * sequence as `pnpm test:isolated-channel-title` (DB recent titles, longform from
 * generator config + resolved theme template, then {@link resolveLockedChannelVideoTitle}).
 */

import type { PersonalAccountStyleBible, PersonalGeneratorConfig } from '@boost/database';
import { generateJSON } from './claude.js';
import { withRetry } from './retry.js';
import { dedupeTitleLines, validateChannelHeadline } from './personalContentHints.js';
import { env } from '../env.js';
import { recentVideoTitles } from './personalAccounts.js';
import { getTheme } from './personalThemes.js';
import { findThemeForUser } from './personalCustomThemes.js';

const DEBUG = process.env.PERSONAL_DEBUG_TITLES === '1';

function log(msg: string, extra?: Record<string, unknown>) {
  if (DEBUG) console.info(`[channel_video_title] ${msg}`, extra ?? '');
}

export interface GenerateChannelVideoTitleArgs {
  topic: string;
  language?: string;
  styleBible?: PersonalAccountStyleBible;
  recentVideoTitles?: string[];
  /**
   * When true (long-form YouTube edit), the title must still match example-title
   * shape — not a prestige "Series: subtitle" line unless examples use that.
   */
  longform?: boolean;
}

/** Same inputs the isolated title test and production use before the director/script JSON pass. */
export type ResolveLockedChannelVideoTitleArgs = {
  topic: string;
  language?: string;
  styleBible?: PersonalAccountStyleBible;
  recentVideoTitles?: string[];
  longform?: boolean;
  /** When the operator (or tests) already fixed the headline, skip the title pass. */
  lockedVideoTitle?: string;
};

/**
 * Single entry for “what is the channel video title?” — matches
 * `pnpm test:isolated-channel-title`: only {@link generateChannelVideoTitle}
 * when examples exist and no lock was supplied.
 */
export async function resolveLockedChannelVideoTitle(
  args: ResolveLockedChannelVideoTitleArgs,
): Promise<string | undefined> {
  const preset = args.lockedVideoTitle?.trim();
  if (preset) return preset;

  const examples = (args.styleBible?.exampleVideoTitles ?? []).map((t) => t.trim()).filter(Boolean);
  if (examples.length === 0) return undefined;

  return generateChannelVideoTitle({
    topic: args.topic,
    language: args.language,
    styleBible: args.styleBible,
    recentVideoTitles: args.recentVideoTitles,
    longform: args.longform === true,
  });
}

/** DB row fields needed to mirror `isolated-channel-title-test.ts` exactly. */
export type PersonalAccountLikeForChannelTitle = {
  id: string;
  userId: string;
  themeId: string;
  language?: string | null;
  styleBible?: unknown;
  generatorConfig?: unknown;
};

/**
 * Same implementation as `apps/api/scripts/isolated-channel-title-test.ts`:
 * `recentVideoTitles(account.id, 40)`, `longform = gen.longformEnabled || theme is animated-explainer`,
 * then {@link resolveLockedChannelVideoTitle}. Pipelines should prefer this over
 * hand-assembling `resolve*` arguments so production cannot drift from the test.
 */
export async function channelVideoTitleLikeIsolatedTest(opts: {
  account: PersonalAccountLikeForChannelTitle;
  topic: string;
  lockedVideoTitle?: string;
}): Promise<string | undefined> {
  const styleBible = (opts.account.styleBible as PersonalAccountStyleBible) ?? {};
  const gen = (opts.account.generatorConfig as PersonalGeneratorConfig) ?? {};
  const theme =
    getTheme(opts.account.themeId) ??
    (await findThemeForUser(opts.account.userId, opts.account.themeId));
  const longform = gen.longformEnabled === true || theme?.template === 'animated-explainer';
  const past = await recentVideoTitles(opts.account.id, 40);
  return resolveLockedChannelVideoTitle({
    topic: opts.topic,
    language: opts.account.language ?? undefined,
    styleBible,
    recentVideoTitles: past,
    longform,
    lockedVideoTitle: opts.lockedVideoTitle,
  });
}

function escapeForPrompt(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildSimpleTitlePrompt(params: {
  topic: string;
  language?: string;
  examples: string[];
  recent: string[];
  operatorNotes: string;
  correction?: string;
  longform?: boolean;
}): string {
  const lang =
    params.language && params.language !== 'en'
      ? `Write the title in language "${params.language}" (ISO code).\n\n`
      : '';

  const examplesBlock = params.examples.map((e, i) => `${i + 1}. ${e}`).join('\n');

  const pastBlock =
    params.recent.length > 0
      ? params.recent
          .slice(0, 40)
          .map((t) => `- ${t}`)
          .join('\n')
      : '(No past titles on file — any fresh line is fine.)';

  const fix = params.correction?.trim()
    ? `Your last answer was rejected:\n"""${escapeForPrompt(params.correction.trim())}"""\nFix that and respond again.\n\n`
    : '';

  const op = params.operatorNotes.trim()
    ? `Extra direction from the operator (use if it fits the examples):\n${escapeForPrompt(params.operatorNotes.trim())}\n\n`
    : '';

  const longformNote = params.longform
    ? '- Long runtime does **not** change headline species: stay in the same punctuation + length band as **EXAMPLE_TITLES** only.\n'
    : '';

  return `${fix}${lang}${op}You are writing one video title for a channel.

TASK
- Make a new title that feels like it belongs in the same list as the EXAMPLE TITLES (same vibe, length, punctuation habits) but is for the NEW TOPIC below.
- Do not copy any example. Do not reuse the same line with tiny edits.
- The examples are only for style; the subject of the video is NEW TOPIC.
- **Punctuation cloning:** use \`:\` **only if more than half** of the EXAMPLE_TITLE lines contain a colon followed by a space (\`: \`); otherwise do **not** use that pattern. Same instinct for other punctuation — mirror the examples, do not import "documentary episode" packaging.
- More than one good headline usually exists — vary the hook or emphasis when you can; do not always default to the same opening pattern if another line would still match the list.
${longformNote}
NEW TOPIC:
${params.topic.trim()}

EXAMPLE TITLES (style reference — do not copy):
${examplesBlock}

PAST TITLES FROM THIS ACCOUNT (videos that already shipped — do not copy, quote, or trivially paraphrase any of these; write a new line for NEW TOPIC even if the format matches your examples):
${pastBlock}

Return only valid JSON: {"title":"your single title line here"}
No emoji. Do not wrap the title in extra quotation marks inside the string.`;
}

export async function generateChannelVideoTitle(args: GenerateChannelVideoTitleArgs): Promise<string> {
  const examples = (args.styleBible?.exampleVideoTitles ?? []).map((t) => t.trim()).filter(Boolean);
  const topic = args.topic.trim();
  if (examples.length === 0) {
    throw new Error(
      'generateChannelVideoTitle requires at least one saved example video title (styleBible.exampleVideoTitles).',
    );
  }

  const recent = dedupeTitleLines(args.recentVideoTitles);
  const operatorNotes = args.styleBible?.videoTitleGuidance?.trim() ?? '';

  const model = env.PERSONAL_TITLE_MODEL ?? 'haiku';
  const maxTokens = 160;
  /** Default ~0.78 — low temps repeat the same title for the same topic. */
  const baseTemp =
    env.PERSONAL_TITLE_TEMPERATURE != null && Number.isFinite(env.PERSONAL_TITLE_TEMPERATURE)
      ? Math.min(1, Math.max(0, env.PERSONAL_TITLE_TEMPERATURE))
      : 0.78;

  let lastTitle = '';
  let correction: string | undefined;
  const errorLog: string[] = [];

  log('start', {
    topic: topic.slice(0, 120),
    exampleCount: examples.length,
    recentCount: recent.length,
    titleModel: model,
    baseTemp,
    longform: args.longform === true,
  });

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = buildSimpleTitlePrompt({
      topic,
      language: args.language,
      examples,
      recent,
      operatorNotes,
      correction,
      longform: args.longform === true,
    });

    const raw = await withRetry(
      () =>
        generateJSON<{ title?: string }>(prompt, {
          model,
          maxTokens,
          temperature: attempt === 1 ? baseTemp : Math.min(0.95, baseTemp + 0.12 * (attempt - 1)),
        }),
      { label: `channel_video_title:${topic.slice(0, 44)}`, attempts: 2 },
    );

    lastTitle = String(raw.title ?? '')
      .trim()
      .replace(/\s+/g, ' ');

    const err = validateChannelHeadline(lastTitle, topic, examples);
    log(`attempt ${attempt}`, { candidate: lastTitle.slice(0, 140), err: err ?? 'ok' });
    if (!err) return lastTitle;

    correction = err;
    errorLog.push(`Attempt ${attempt}: ${err}`);
  }

  throw new Error(
    `[channel_video_title] Could not produce an acceptable title after ${maxAttempts} attempts. ` +
      `Last candidate: "${lastTitle.slice(0, 120)}${lastTitle.length > 120 ? '…' : ''}". ` +
      `Errors:\n${errorLog.join('\n')}`,
  );
}
