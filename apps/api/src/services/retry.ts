/**
 * Retry helpers for flaky upstream calls (Claude, fal.ai, ContentStudio).
 * Exponential backoff with jitter, bounded attempts, and optional per-error
 * retry predicates.
 */

interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: (err: unknown) => boolean;
  label?: string;
}

/** Rejected when {@link withTimeout} elapses before the wrapped promise settles. */
export class TimeoutError extends Error {
  override readonly name = 'TimeoutError';
  constructor(
    public readonly label: string,
    public readonly ms: number,
  ) {
    super(`${label}: timed out after ${ms}ms`);
  }
}

/**
 * Race `promise` against a timer. Does not cancel upstream work (e.g. fal HTTP);
 * use to avoid indefinite hangs on stuck network calls.
 */
export function withTimeout<T>(ms: number, label: string, promise: Promise<T>): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 400;
  const max = opts.maxDelayMs ?? 8_000;
  const retryOn = opts.retryOn ?? isRetryable;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1 || !retryOn(e)) throw e;
      const delay = Math.min(max, base * 2 ** i) + Math.floor(Math.random() * 200);
      if (opts.label) {
        console.warn(
          `[retry] ${opts.label} failed (attempt ${i + 1}/${attempts}) — retrying in ${delay}ms`,
        );
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Default: retry on network errors, 5xx, 429, timeouts, and JSON parse errors. */
export function isDefaultRetryable(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  /** Empty or truncated model output often surfaces as SyntaxError from JSON.parse. */
  if (err instanceof SyntaxError) return true;
  const anyErr = err as any;
  const status: number | undefined = anyErr?.status ?? anyErr?.statusCode ?? anyErr?.response?.status;
  const code: string | undefined = anyErr?.code ?? anyErr?.name;
  if (status) return status === 429 || (status >= 500 && status < 600);
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND' || code === 'AbortError') return true;
  if (anyErr?.message && /timeout|rate limit|overloaded/i.test(anyErr.message)) return true;
  return false;
}

/** Kept as the internal alias used by withRetry's default. */
const isRetryable = isDefaultRetryable;

/** Fire-and-forget: returns immediately, logs errors. */
export function fireAndForget(label: string, fn: () => Promise<unknown>) {
  queueMicrotask(() => {
    fn().catch((err) => console.error(`[bg ${label}]`, err));
  });
}
