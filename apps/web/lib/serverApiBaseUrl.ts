/**
 * Absolute API origin for **server-side** fetches (RSC, route handlers, `site-loader`).
 * Relative `/api/...` is not valid from Node — we need a full URL.
 *
 * Priority:
 *   1. `API_UPSTREAM` — preferred in production (Railway / Render URL).
 *   2. `NEXT_PUBLIC_API_URL` if it is an absolute `http(s)` URL.
 *   3. On Vercel only: `https://${VERCEL_URL}` so the deployment can call itself
 *      and rely on Next.js rewrites to reach the upstream API (same pattern as the browser).
 *   4. Local dev: `http://127.0.0.1:4000` (matches `next.config.ts` rewrites)
 */

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

export function getServerApiBaseUrl(): string {
  const upstream = process.env.API_UPSTREAM?.trim();
  if (upstream) return stripTrailingSlashes(upstream);

  const next = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (next && /^https?:\/\//i.test(next)) return stripTrailingSlashes(next);

  const vercel = process.env.VERCEL_URL?.trim();
  if (process.env.NODE_ENV === 'production' && vercel) {
    return stripTrailingSlashes(`https://${vercel}`);
  }

  return 'http://127.0.0.1:4000';
}

export const SERVER_API_BASE_URL = getServerApiBaseUrl();
