/**
 * Inspiration analysis — Claude Vision reads one or more reference
 * images/videos and returns a structured creative brief: style, mood,
 * composition, palette, subject, and a recommendation of what to
 * produce (image, video, or both) with a suggested prompt.
 *
 * The output is the jumping-off point for the generation plan. The
 * user can accept it verbatim, tweak the prompt, or override the
 * output-type decision.
 *
 * Falls back to a deterministic mock when `features.claude` is false
 * so dev works without an Anthropic key.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env, features } from '../env.js';

export interface InspirationItem {
  id: string;
  url: string;
  mimeType: string;
  /** Human label or filename — used only as a hint to Claude. */
  label?: string;
}

export interface InspirationAnalysis {
  /** One-line style summary — e.g. "editorial food photography, moody low-key". */
  style: string;
  /** Emotional register — e.g. "warm, intimate, unhurried". */
  mood: string;
  /** Framing/composition — e.g. "tight overhead flat-lay, negative space top-left". */
  composition: string;
  /** Palette — an array of colour hex codes or evocative names. */
  colorPalette: string[];
  /** What the references actually depict — e.g. "coffee beans, linen cloth, dark wood". */
  subjectType: string;
  /** Which output formats the inspiration best supports. */
  suggestedOutputTypes: Array<'image' | 'video'>;
  /**
   * A ready-to-use generation prompt that captures the style and subject
   * without fabricating factual claims. Pass this straight to Flux /
   * Kling / etc.
   */
  suggestedPrompt: string;
  /** Plain-language reasoning the UI surfaces to the user. */
  reasoning: string;
  fromMock: boolean;
}

let _client: Anthropic | null = null;
function client() {
  if (!_client && env.ANTHROPIC_API_KEY) {
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Run Claude Vision on up to N inspiration items. Videos are treated as
 * their poster URL — we don't frame-sample server-side because fal.ai
 * already serves a poster, and Claude Vision handles images.
 *
 * If a large inspiration set is passed, we cap at 6 items per call to
 * keep token usage sane.
 */
export async function analyzeInspiration(
  items: InspirationItem[],
  userDirection?: string,
): Promise<InspirationAnalysis> {
  if (items.length === 0) {
    throw new Error('No inspiration items to analyse');
  }

  if (!features.claude || !client()) {
    return mockAnalysis(items, userDirection);
  }

  const capped = items.slice(0, 6);
  const imageBlocks = capped
    .filter((i) => !i.mimeType.startsWith('video/'))
    .map((i) => ({
      type: 'image' as const,
      source: { type: 'url' as const, url: i.url },
    }));

  // If no analysable images made it through (e.g. user sent only videos),
  // skip the API call and let the mock carry the style forward.
  if (imageBlocks.length === 0) {
    return mockAnalysis(items, userDirection);
  }

  const directive = [
    'You are a creative director analysing inspiration media for a marketing brief.',
    '',
    'Extract the following from the attached references and return JSON matching the schema below.',
    'Do NOT invent factual claims about businesses, people, or events. Describe only what you see.',
    '',
    'Schema:',
    '{',
    '  "style": "one-line style summary",',
    '  "mood": "one-line emotional register",',
    '  "composition": "framing and composition notes",',
    '  "colorPalette": ["hex or evocative colour names, 3-6 items"],',
    '  "subjectType": "what the references depict",',
    '  "suggestedOutputTypes": ["image" | "video"] (non-empty),',
    '  "suggestedPrompt": "a self-contained prompt usable for a generation model. Visual/style instructions only. No factual claims, no business names, no named people.",',
    '  "reasoning": "why you chose this output type(s), 2-3 sentences"',
    '}',
    '',
    userDirection?.trim()
      ? `The user has added this direction — weave it into suggestedPrompt without inventing facts:\n"${userDirection.trim().slice(0, 800)}"`
      : '',
    '',
    'Return ONLY valid JSON.',
  ].join('\n');

  let resp: Anthropic.Message;
  try {
    resp = await client()!.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: directive },
          ],
        },
      ],
    });
  } catch (e) {
    // Anthropic can fail if it can't fetch the image URLs (e.g. localhost
    // in dev) or when rate-limited. A failed analysis should not kill
    // the whole generation run — return a mock analysis marked as such
    // so the user sees that the vision step didn't complete.
    console.warn('[inspiration] Claude Vision failed, falling back to mock:', (e as Error).message);
    return mockAnalysis(items, userDirection);
  }

  const text = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  const cleaned = text.replace(/^```json\s*|```$/gi, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as Omit<InspirationAnalysis, 'fromMock'>;
    // Normalise: ensure suggestedOutputTypes is non-empty and valid.
    const validOutputs = (parsed.suggestedOutputTypes ?? []).filter(
      (t): t is 'image' | 'video' => t === 'image' || t === 'video',
    );
    return {
      style: parsed.style ?? 'editorial, modern',
      mood: parsed.mood ?? 'neutral',
      composition: parsed.composition ?? 'balanced',
      colorPalette: Array.isArray(parsed.colorPalette) ? parsed.colorPalette.slice(0, 6) : [],
      subjectType: parsed.subjectType ?? 'unknown',
      suggestedOutputTypes: validOutputs.length > 0 ? validOutputs : ['image'],
      suggestedPrompt: parsed.suggestedPrompt ?? 'A high-quality marketing image.',
      reasoning: parsed.reasoning ?? '',
      fromMock: false,
    };
  } catch (e) {
    console.warn('[inspiration] JSON parse failed, using fallback:', (e as Error).message);
    return mockAnalysis(items, userDirection);
  }
}

/**
 * Deterministic mock so dev works without Claude. The mock biases toward
 * an "image" recommendation with a generic editorial prompt.
 */
function mockAnalysis(items: InspirationItem[], userDirection?: string): InspirationAnalysis {
  const hasVideo = items.some((i) => i.mimeType.startsWith('video/'));
  return {
    style: 'editorial marketing photography',
    mood: 'warm, intentional, premium',
    composition: 'balanced, shallow depth of field',
    colorPalette: ['#1D9CA1', '#48D886', '#F5EFE7', '#1F2937'],
    subjectType: items[0]?.label ?? 'lifestyle subject',
    suggestedOutputTypes: hasVideo ? ['video'] : ['image'],
    suggestedPrompt: [
      'Editorial marketing shot in the style of the reference,',
      'warm natural light, shallow depth of field, premium muted palette,',
      'no text, no logos.',
      userDirection?.trim() ? userDirection.trim() : '',
    ]
      .filter(Boolean)
      .join(' '),
    reasoning: 'Mock analysis — Claude is not configured. Defaulting to an image recommendation grounded in the uploaded reference.',
    fromMock: true,
  };
}
