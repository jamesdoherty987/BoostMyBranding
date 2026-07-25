/**
 * Base URL for browser `fetch()` calls from the Next.js app to the Express API.
 *
 * - **Default (dev + prod):** leave `NEXT_PUBLIC_API_URL` unset so this is `''`.
 *   Requests go to same-origin `/api/...`, and `next.config.ts` proxies to the
 *   API (`API_UPSTREAM`, or `http://127.0.0.1:4000` in local dev). Same-origin
 *   keeps the `bmb_session` cookie first-party after Team sign-in — calling
 *   `:4000` directly from `:3000` is cross-site and often drops the cookie.
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
  if (raw) return stripTrailingSlashes(raw);
  return '';
}

/** Resolved once per bundle (client + server for client components). */
export const PUBLIC_API_BASE_URL = getPublicApiBaseUrl();
