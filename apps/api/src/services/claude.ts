/**
 * Claude wrapper. Uses the real Anthropic SDK when ANTHROPIC_API_KEY is set,
 * otherwise returns deterministic mock output so the rest of the app works
 * out of the box.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env, features } from '../env.js';

/**
 * Model identifier map. Updated May 2026 to the latest Claude 4.5/4.6/4.7
 * series. `opus` is the most capable (best reasoning, best code, best
 * complex instructions); `sonnet` balances speed and quality; `haiku`
 * is fastest + cheapest for lightweight tasks.
 *
 * Aliases (no date suffix) are preferred over full IDs — Anthropic keeps
 * the alias pointing at the latest minor version automatically.
 */
const MODEL_MAP = {
  opus: 'claude-opus-4-7',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
} as const;

type ModelKey = keyof typeof MODEL_MAP;

export interface ClaudeOptions {
  model?: ModelKey;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  cacheSystemPrompt?: boolean;
}

let _client: Anthropic | null = null;
function client() {
  if (!_client && env.ANTHROPIC_API_KEY) {
    _client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      /** Long director JSON can run past the SDK’s default; streaming is primary fix below. */
      timeout: 25 * 60 * 1000,
    });
  }
  return _client;
}

export async function generateText(prompt: string, opts: ClaudeOptions = {}): Promise<string> {
  if (!features.claude || !client()) {
    return mockText(prompt);
  }
  const modelKey = opts.model ?? 'sonnet';
  const model = MODEL_MAP[modelKey];

  // Opus 4.7 runs extended thinking by default and rejects explicit
  // `temperature` overrides — the API returns:
  //   `temperature` is deprecated for this model.
  // Let Opus use its default when no explicit temperature was asked
  // for, and drop the override entirely when one was (Opus ignores it
  // regardless). Other models still accept the override.
  const omitTemperature = modelKey === 'opus';

  const maxTokens = opts.maxTokens ?? 2048;

  // Anthropic’s SDK rejects (or warns then fails) non-streaming calls that
  // are expected to run longer than ~10 minutes when max_tokens is large.
  // Long-form storyboards use 32k output — always stream and assemble the
  // final message so idle connections and the client-side guard behave.
  const stream = client()!.messages.stream({
    model,
    max_tokens: maxTokens,
    ...(omitTemperature ? {} : { temperature: opts.temperature ?? 0.7 }),
    system: opts.systemPrompt
      ? opts.cacheSystemPrompt
        ? [{ type: 'text', text: opts.systemPrompt, cache_control: { type: 'ephemeral' } }]
        : opts.systemPrompt
      : undefined,
    messages: [{ role: 'user', content: prompt }],
  });

  const resp = await stream.finalMessage();
  const textBlocks = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text);
  const out = textBlocks.join('\n').trim();
  if (!out) {
    throw new SyntaxError(
      'Claude returned an empty text response (no text blocks; likely refusal, model stop, or upstream issue).',
    );
  }
  return out;
}

export async function generateJSON<T>(prompt: string, opts: ClaudeOptions = {}): Promise<T> {
  const raw = await generateText(
    `${prompt}\n\nReturn ONLY valid JSON with no markdown fences, no prose.`,
    { ...opts, temperature: opts.temperature ?? 0.4 },
  );
  // Defensive JSON extraction. Claude sometimes wraps in ```json fences,
  // prefixes with a sentence ("Here's the JSON:"), or trails with
  // commentary — all of which break JSON.parse. Pull the first {...}
  // or [...] block out of the text before parsing.
  const cleaned = extractJsonBlock(raw).trim();
  if (!cleaned) {
    throw new SyntaxError(
      'Claude returned no JSON object or array (empty after extraction; prose-only or malformed output).',
    );
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    if (e instanceof SyntaxError) {
      const head = cleaned.length > 200 ? `${cleaned.slice(0, 200)}…` : cleaned;
      throw new SyntaxError(
        `${e.message} (jsonLen=${cleaned.length}, head=${JSON.stringify(head)})`,
        { cause: e },
      );
    }
    throw e;
  }
}

/**
 * Pull the first JSON value out of raw Claude output. Handles:
 *   - Plain JSON (returned as-is)
 *   - Fenced code blocks ```json ... ```
 *   - JSON preceded / followed by commentary
 *   - Mixed content where the JSON starts with either `{` or `[`
 *
 * We don't try to fix broken JSON — truncated output still throws a
 * SyntaxError, which the retry layer catches and re-rolls.
 */
function extractJsonBlock(raw: string): string {
  // Strip code fences first — easiest common case.
  const deFenced = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/g, '')
    .trim();

  // Find the first balanced JSON object or array span. We don't walk
  // the grammar — a simple bracket-balance scan is enough because
  // Claude doesn't interleave commentary inside the JSON value.
  const firstBraceIdx = firstStructuralIdx(deFenced);
  if (firstBraceIdx < 0) return deFenced.trim();

  const end = matchingClosingIdx(deFenced, firstBraceIdx);
  if (end < 0) return deFenced.slice(firstBraceIdx).trim();

  return deFenced.slice(firstBraceIdx, end + 1);
}

/** Return the index of the first `{` or `[` outside of quoted strings. */
function firstStructuralIdx(s: string): number {
  let inStr = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{' || c === '[') return i;
  }
  return -1;
}

/** Return the index of the balanced closing bracket for the opener at `start`. */
function matchingClosingIdx(s: string, start: number): number {
  const opener = s[start];
  if (opener !== '{' && opener !== '[') return -1;
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === opener) depth++;
    else if (c === closer) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export async function analyzeImage(
  imageUrl: string,
  prompt: string,
  opts: ClaudeOptions = {},
): Promise<any> {
  if (!features.claude || !client()) {
    return {
      qualityScore: 8,
      usable: true,
      issues: [],
      subject: 'mock subject',
      mood: 'warm',
      bestPlatforms: ['instagram_feed', 'facebook'],
      suggestedCrop: 'square',
      captionAngle: 'Behind-the-scenes look at the team',
      needsEditing: false,
      editingSuggestions: [],
    };
  }
  const modelKey = opts.model ?? 'sonnet';
  const model = MODEL_MAP[modelKey];
  const omitTemperature = modelKey === 'opus';
  const stream = client()!.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    ...(omitTemperature ? {} : { temperature: opts.temperature ?? 0.3 }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: imageUrl } },
          { type: 'text', text: `${prompt}\n\nReturn ONLY valid JSON.` },
        ],
      },
    ],
  });
  const resp = await stream.finalMessage();
  const text = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
  if (!text) {
    return { error: 'empty_response', raw: '' };
  }
  const cleaned = text.replace(/^```json\s*|```$/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { error: 'parse_failed', raw: cleaned };
  }
}

function mockText(prompt: string) {
  const trimmed = prompt.slice(0, 60);
  return `[mock] ${trimmed}...`;
}
