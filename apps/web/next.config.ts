import type { NextConfig } from 'next';

/**
 * Single Next.js app that serves everything:
 *   /                    → marketing site
 *   /sites/[slug]        → client-facing sites
 *   /dashboard/*         → agency dashboard
 *   /portal/*            → client portal
 *   /api/*               → proxied to the Express API (Railway / etc.)
 *   /signup              → unified signup / login / forgot
 *
 * The dashboard and portal are regular Next.js route segments now, not
 * separate deployments. Only the API lives elsewhere because it needs a
 * long-running Node process (cron, websockets, 30s+ generation jobs).
 *
 * Required env vars for production (Vercel):
 *   API_UPSTREAM — must be set **before** `next build` (rewrites are build-time).
 *   Omit in local dev: defaults to http://127.0.0.1:4000 for `/api/*` rewrites.
 */

/** Upstream Express API for Next rewrites (`/api/*` → API). In local dev, default to the API port so you do not need API_UPSTREAM in `.env`. */
const API =
  process.env.API_UPSTREAM?.trim() ||
  (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:4000' : '');

// `rewrites()` is evaluated at **build time** (see Next.js discussions on build-time
// rewrites). `API_UPSTREAM` must exist in the Vercel **Production** build environment
// or `/api/*` will not be proxied. Changing the Railway URL requires a new Vercel build.
if (process.env.VERCEL_ENV === 'production' && !process.env.API_UPSTREAM?.trim()) {
  throw new Error(
    '[next.config] Missing API_UPSTREAM: add it to Vercel → Environment Variables (Production), e.g. https://your-api.up.railway.app (no trailing slash), then redeploy.',
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@boost/ui', '@boost/core', '@boost/api-client'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fal.media' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
  async rewrites() {
    // Only API requests get proxied. Dashboard/portal are now built into
    // this same app as route segments, so no rewrite is needed for them.
    if (!API) return [];
    const base = API.replace(/\/+$/, '');
    return [{ source: '/api/:path*', destination: `${base}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
