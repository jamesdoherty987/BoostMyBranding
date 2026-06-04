/**
 * Small focused call: one headline from example titles + topic, then we lock
 * it into the director/script so the big JSON pass cannot rewrite it.
 */

import type { PersonalAccountStyleBible } from '@boost/database';
import { generateJSON } from './claude.js';
import { withRetry } from './retry.js';
import { dedupeTitleLines, validateChannelHeadline } from './personalContentHints.js';

const TITLE_DEBUG = process.env.PERSONAL_DEBUG_TITLES === '1';

function titleLog(msg: string, extra?: Record<string, unknown>) {
  if (TITLE_DEBUG) console.info(`[channel_title] ${msg}`, extra ?? '');
}

export interface GenerateChannelVideoTitleArgs {
  topic: string;
  language?: string;
  styleBible?: PersonalAccountStyleBible;
  recentVideoTitles?: string[];
  scriptModel?: 'sonnet' | 'opus';
}

function buildTitleOnlyPrompt(
  topic: string,
  examples: string[],
  recent: string[],
  language: string | undefined,
  titleGuidance: string | undefined,
  rejectionHint: string | undefined,
): string {
  const recentBlock =
    recent.length > 0
      ? `\nAlready published on this channel (do not copy or paraphrase too closely):\n${recent
          .slice(0, 30)
          .map((t) => `  • ${t}`)
          .join('\n')}`
      : '';

  const reject = rejectionHint ? `\nFix this and try again: ${rejectionHint}\n` : '';

  const lang =
    language && language !== 'en'
      ? `\nWrite the title in language code "${language}".\n`
      : '';

  const guide =
    titleGuidance && titleGuidance.trim().length > 0
      ? `\nWhat the channel owner wants in a title (follow alongside the examples):\n"""${titleGuidance.trim().replace(/"/g, '\\"')}"""\n`
      : '';

  return `${reject}Write ONE video title for this topic.

Study the example titles: copy their **species** (length, punctuation, tone, curiosity) — not their facts or wording. Invent a fresh line for this topic only.

Topic: """${topic.replace(/"/g, '\\"')}"""${lang}${guide}

Examples from this channel:
${examples.map((t) => `  • ${t}`).join('\n')}
${recentBlock}

Rules: JSON only { "title": "..." }. One line, no emoji.

Return ONLY valid JSON, no markdown.`;
}

export async function generateChannelVideoTitle(
  args: GenerateChannelVideoTitleArgs,
): Promise<string> {
  const examples = (args.styleBible?.exampleVideoTitles ?? []).map((t) => t.trim()).filter(Boolean);
  const topic = args.topic.trim();
  if (examples.length === 0) return topic;

  const recent = dedupeTitleLines(args.recentVideoTitles);
  const titleGuidance = args.styleBible?.videoTitleGuidance;
  let lastTitle = '';
  let rejectionHint: string | undefined;

  titleLog('start', {
    topic: topic.slice(0, 120),
    exampleCount: examples.length,
    recentCount: recent.length,
    hasTitleGuidance: Boolean(titleGuidance?.trim()),
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const prompt = buildTitleOnlyPrompt(
      topic,
      examples,
      recent,
      args.language,
      titleGuidance,
      rejectionHint,
    );
    const raw = await withRetry(
      () =>
        generateJSON<{ title?: string }>(prompt, {
          model: args.scriptModel ?? 'sonnet',
          maxTokens: 200,
          temperature: 0.45,
        }),
      { label: `channel_title:${topic.slice(0, 48)}`, attempts: 2 },
    );
    lastTitle = String(raw.title ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    const err = validateChannelHeadline(lastTitle, topic, examples, recent);
    titleLog(`attempt ${attempt + 1}`, { candidate: lastTitle.slice(0, 140), err: err ?? 'ok' });
    if (!err) return lastTitle;
    rejectionHint = err;
  }

  if (lastTitle.length > 0) return lastTitle;
  return topic;
}
