/**
 * Claude model metadata shared between client and server.
 *
 * The API's `claude.ts` wrapper defines the actual model IDs (e.g.
 * `claude-opus-4-7`) — this file only exposes the KEY (`'opus'` /
 * `'sonnet'` / `'haiku'`) plus human-friendly labels so the dashboard
 * can render a model picker without needing to know the provider IDs.
 *
 * Adding a new model means:
 *   1. Add the key + ID to `MODEL_MAP` in apps/api/src/services/claude.ts
 *   2. Add the key to `AiModelKey` here
 *   3. Add a metadata entry to `AI_MODELS` here
 * The dashboard UI picks it up automatically.
 */

export type AiModelKey = 'opus' | 'sonnet' | 'haiku';

export interface AiModelMeta {
  key: AiModelKey;
  /** Human-friendly name shown in the picker. */
  label: string;
  /** One-liner explaining when to pick this model. */
  blurb: string;
  /** Rough relative cost indicator — "$", "$$", "$$$". */
  cost: '$' | '$$' | '$$$';
  /** Rough relative speed indicator — "Fast", "Medium", "Slower". */
  speed: 'Fast' | 'Medium' | 'Slower';
  /** Quality score for sorting. Higher = smarter. */
  tier: 1 | 2 | 3;
  /** Default choice for each job class so the UI can preselect sensibly. */
  defaultFor: Array<'generate' | 'edit' | 'scoped' | 'page'>;
}

/**
 * Models exposed to the dashboard AI chat. Ordered so the smartest
 * option (best for complex reasoning) is first.
 */
export const AI_MODELS: AiModelMeta[] = [
  {
    key: 'opus',
    label: 'Opus 4.7',
    blurb: 'Smartest. Best for full-site generation, new pages, and nuanced instructions.',
    cost: '$$$',
    speed: 'Slower',
    tier: 3,
    defaultFor: ['generate', 'page'],
  },
  {
    key: 'sonnet',
    label: 'Sonnet 4.6',
    blurb: 'Balanced. Best for live editing — plenty smart, noticeably faster.',
    cost: '$$',
    speed: 'Medium',
    tier: 2,
    defaultFor: ['edit', 'scoped'],
  },
  {
    key: 'haiku',
    label: 'Haiku 4.5',
    blurb: 'Fastest + cheapest. Best for tiny tweaks and short instructions.',
    cost: '$',
    speed: 'Fast',
    tier: 1,
    defaultFor: [],
  },
];

/**
 * Pick the default model for a given job class. Falls back to `sonnet`
 * if the class has no explicit default.
 */
export function defaultModelFor(
  job: 'generate' | 'edit' | 'scoped' | 'page',
): AiModelKey {
  const match = AI_MODELS.find((m) => m.defaultFor.includes(job));
  return match?.key ?? 'sonnet';
}

/** Lookup a model entry by key. */
export function getModelMeta(key: AiModelKey): AiModelMeta | undefined {
  return AI_MODELS.find((m) => m.key === key);
}

/** Guard so zod / form handlers can safely coerce unknown strings. */
export function isAiModelKey(value: unknown): value is AiModelKey {
  return value === 'opus' || value === 'sonnet' || value === 'haiku';
}
