/**
 * Claude wrapper. Uses the real Anthropic SDK when ANTHROPIC_API_KEY is set,
 * otherwise returns deterministic mock output so the rest of the app works
 * out of the box.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env, features } from '../env.js';

const MODEL_MAP = {
  sonnet: 'claude-sonnet-4-5',
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
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function generateText(prompt: string, opts: ClaudeOptions = {}): Promise<string> {
  if (!features.claude || !client()) {
    return mockText(prompt);
  }
  const model = MODEL_MAP[opts.model ?? 'sonnet'];
  const resp = await client()!.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.7,
    system: opts.systemPrompt
      ? opts.cacheSystemPrompt
        ? [{ type: 'text', text: opts.systemPrompt, cache_control: { type: 'ephemeral' } }]
        : opts.systemPrompt
      : undefined,
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlocks = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text);
  return textBlocks.join('\n').trim();
}

export async function generateJSON<T>(prompt: string, opts: ClaudeOptions = {}): Promise<T> {
  const raw = await generateText(
    `${prompt}\n\nReturn ONLY valid JSON with no markdown fences, no prose.`,
    { ...opts, temperature: opts.temperature ?? 0.4 },
  );
  const cleaned = raw.replace(/^```json\s*|```$/gi, '').trim();
  return JSON.parse(cleaned) as T;
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
  const model = MODEL_MAP[opts.model ?? 'sonnet'];
  const resp = await client()!.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
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
  const text = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
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
