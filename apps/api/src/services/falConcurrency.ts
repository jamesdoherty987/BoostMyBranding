/**
 * Global limiter for fal.ai `subscribe` calls.
 *
 * fal enforces a low concurrent-job cap (often ~10). Without coordination,
 * overlapping workloads exceed it:
 *   - Personal director resolves many shots with parallel workers
 *   - Cron runs scheduled personal accounts
 *   - Inspiration mode, image enhance, talking-head, etc. all share the same key
 *
 * Nested calls from the same async chain reuse the same slot (AsyncLocalStorage)
 * so e.g. `generateImageWithReference` → `generateImage` does not deadlock.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../env.js';

const inFalSlot = new AsyncLocalStorage<boolean>();

function maxSlots(): number {
  const fromEnv = env.FAL_MAX_CONCURRENT;
  if (fromEnv != null && Number.isFinite(fromEnv)) {
    return Math.max(1, Math.min(10, Math.floor(fromEnv)));
  }
  return 8;
}

let active = 0;
const queue: Array<() => void> = [];

function acquire(): Promise<void> {
  const cap = maxSlots();
  if (active < cap) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    queue.push(() => {
      active++;
      resolve();
    });
  });
}

function release(): void {
  active--;
  const next = queue.shift();
  if (next) next();
}

/**
 * Run `fn` while holding at most `FAL_MAX_CONCURRENT` (default 8) global
 * fal.ai jobs across the whole process. Re-entrant for nested awaits in
 * the same logical request.
 */
export async function withFalConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  if (inFalSlot.getStore()) {
    return fn();
  }
  await acquire();
  return inFalSlot.run(true, async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}
