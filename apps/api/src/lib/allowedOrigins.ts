/**
 * Browser origins allowed for CORS and the same-origin guard on unsafe methods.
 */

import { env } from '../env.js';

/** `Origin` header is protocol + host only (no path). */
export function urlToOrigin(url: string): string | null {
  try {
    const p = new URL(url);
    return `${p.protocol}//${p.host}`;
  } catch {
    return null;
  }
}

/**
 * Dev-only: `localhost` and `127.0.0.1` are different browser origins. If the
 * env allowlist only lists one, credentialed dashboard requests from the other
 * fail CORS with "Failed to fetch".
 */
function withDevLoopbackAliases(origins: string[]): string[] {
  const set = new Set(origins.filter(Boolean));
  if (env.NODE_ENV !== 'development') return [...set];
  for (const o of [...set]) {
    try {
      const u = new URL(o);
      const portPart = u.port ? `:${u.port}` : '';
      if (u.hostname === 'localhost') {
        set.add(`${u.protocol}//127.0.0.1${portPart}`);
      } else if (u.hostname === '127.0.0.1') {
        set.add(`${u.protocol}//localhost${portPart}`);
      }
    } catch {
      /* skip malformed */
    }
  }
  return [...set];
}

/** Origins derived from APP_URL / PORTAL_URL / DASHBOARD_URL (normalized + dev aliases). */
export function allowedBrowserOrigins(): string[] {
  return withDevLoopbackAliases(
    [env.APP_URL, env.PORTAL_URL, env.DASHBOARD_URL].map((u) => urlToOrigin(u) ?? u),
  );
}
