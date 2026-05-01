/**
 * Client-side auth helpers for the portal.
 *
 * In development without a live API, pages fall back to mock data so the UI
 * can be toured without signing in. In production we redirect to the login
 * page on any 401/403. Intermediate failure modes (network down, 5xx) bubble
 * up so the route `error.tsx` can show a retry screen.
 */

import { ApiError } from '@boost/api-client';

/** True when we should serve mock data instead of redirecting on auth errors. */
export const ALLOW_MOCK_FALLBACK = process.env.NODE_ENV !== 'production';

/**
 * Handle an error from the API client consistently across portal pages. If
 * it's an auth error and we're not in dev, redirect to the login page.
 * Otherwise rethrow so SWR / the caller can decide.
 */
export function handlePortalAuthError(err: unknown): void {
  if (typeof window === 'undefined') return;
  if (err instanceof ApiError && err.isAuthError && !ALLOW_MOCK_FALLBACK) {
    // Redirect and bail; the page won't render again in this session.
    window.location.href = '/';
  }
}
