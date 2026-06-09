/**
 * Base URL for browser `fetch()` calls from the Next.js app to the Express API.
 *
 * - **Vercel + Next rewrites:** leave `NEXT_PUBLIC_API_URL` unset in production so
 *   this is `''`. Requests go to same-origin `/api/...`, and `next.config.ts` proxies
 *   to `API_UPSTREAM` (Railway). Avoids shipping `http://localhost:4000` into the
 *   client bundle (which would break downloads / dashboard API calls in prod).
 *
 * - **Local dev:** defaults to `http://127.0.0.1:4000` when unset (matches `next.config.ts` rewrites).
 *
 * - **Direct API (cross-origin):** set `NEXT_PUBLIC_API_URL=https://your-api.host`
 *   (no trailing slash). CORS on the API must allow your web origin (`APP_URL`, etc.).
 */

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

export function getPublicApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return stripTrailingSlashes(raw);
  if (process.env.NODE_ENV === 'production') return '';
  if (raw) return stripTrailingSlashes(raw);
  return 'http://127.0.0.1:4000';
}

/** Resolved once per bundle (client + server for client components). */
export const PUBLIC_API_BASE_URL = getPublicApiBaseUrl();
