/**
 * Multi-tenant middleware. When a request comes in on a custom domain
 * (anything that isn't our app host), we look up the corresponding
 * client slug and rewrite the URL to `/sites/[slug]` internally so the
 * same page handler serves it.
 *
 * Hostnames handled untouched (no rewrite):
 *   - Our primary app domain (APP_URL)
 *   - Our primary app domain's `www.` variant
 *   - localhost / *.localhost (dev)
 *   - Vercel preview URLs (*.vercel.app)
 *
 * Lookup cache: resolutions are cached in-memory for 5 minutes. The
 * cache is keyed by host so a domain swap on the client row gets picked
 * up automatically after the TTL without a cold edge bounce.
 *
 * Failure behavior: if the API is unreachable or the host doesn't
 * resolve to a client, we redirect to the main app home rather than
 * showing a broken page. That way a misconfigured DNS record still
 * shows the agency's site, not a 500.
 */

import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? '';

/** Hosts the middleware should always pass through without a lookup. */
function isReservedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.vercel.app')) return true;
  if (h.endsWith('.vercel.dev')) return true;
  if (h.endsWith('.ngrok.io') || h.endsWith('.ngrok-free.app')) return true;

  if (APP_URL) {
    try {
      const appHost = new URL(APP_URL).host.toLowerCase();
      if (h === appHost) return true;
      if (h === `www.${appHost}`) return true;
    } catch {
      // ignore malformed APP_URL
    }
  }
  return false;
}

// In-memory cache per edge instance. Split TTLs:
//   - Hits (known slug)   : 5 min — fine to serve stale briefly on a domain swap
//   - Misses (unknown)    : 30 s  — short so a newly-configured domain lights up fast
//   - Network errors      : 10 s  — retry quickly without hammering the API
type CacheEntry = { slug: string | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const HIT_TTL_MS = 5 * 60 * 1000;
const MISS_TTL_MS = 30 * 1000;
const ERROR_TTL_MS = 10 * 1000;

async function resolveHost(host: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(host);
  if (cached && cached.expiresAt > now) return cached.slug;

  try {
    const res = await fetch(
      `${API_URL}/api/v1/clients/public/by-host/${encodeURIComponent(host)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      cache.set(host, { slug: null, expiresAt: now + MISS_TTL_MS });
      return null;
    }
    const payload = (await res.json()) as { data?: { slug?: string } };
    const slug = payload.data?.slug ?? null;
    cache.set(host, {
      slug,
      expiresAt: now + (slug ? HIT_TTL_MS : MISS_TTL_MS),
    });
    return slug;
  } catch {
    cache.set(host, { slug: null, expiresAt: now + ERROR_TTL_MS });
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0]!.toLowerCase();
  const pathname = request.nextUrl.pathname;

  // Never intercept Next internals / API / static assets.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/sites/') || // already on the right path, let it through
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    /\.[a-z0-9]{2,5}$/i.test(pathname) // any file-like path (e.g. /icon.png)
  ) {
    return NextResponse.next();
  }

  if (isReservedHost(host)) {
    return NextResponse.next();
  }

  // Custom domain — resolve to a client slug and rewrite internally.
  const slug = await resolveHost(host);
  if (!slug) {
    // Unknown host: send them to the main marketing site rather than a 500.
    if (APP_URL) {
      return NextResponse.redirect(APP_URL);
    }
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${slug}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Match everything except static files, Next internals, and the API proxy.
  matcher: ['/((?!_next/|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)'],
};
