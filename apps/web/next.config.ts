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
 * **API_UPSTREAM** must be a full URL including the scheme, e.g. `https://your-api.up.railway.app`
 * (not `your-api.up.railway.app` alone). Otherwise Next throws **Invalid rewrite** at build time.
 */

/** Next.js only allows rewrite destinations that start with `http://` or `https://`. */
function isAbsoluteHttpUrl(s: string): boolean {
  return /^https:\/\//i.test(s) || /^http:\/\//i.test(s);
}

const rawUpstream = process.env.API_UPSTREAM?.trim() ?? '';
const vercelDeploy =
  process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

let warnedApiUpstream = false;
function warnApiUpstream(msg: string) {
  if (warnedApiUpstream) return;
  warnedApiUpstream = true;
  console.warn(`[next.config] ${msg}`);
}

let API = '';
if (rawUpstream && isAbsoluteHttpUrl(rawUpstream)) {
  API = rawUpstream.replace(/\/+$/, '');
} else if (rawUpstream && !isAbsoluteHttpUrl(rawUpstream)) {
  if (vercelDeploy) {
    warnApiUpstream(
      `API_UPSTREAM must include the scheme (${process.env.VERCEL_ENV ?? 'unknown'}). Use e.g. https://your-api.up.railway.app — not "${rawUpstream.slice(0, 80)}${rawUpstream.length > 80 ? '…' : ''}". /api rewrites disabled until fixed.`,
    );
  } else if (process.env.NODE_ENV === 'development') {
    warnApiUpstream(
      `API_UPSTREAM is set but is not an absolute http(s) URL — using http://127.0.0.1:4000 for rewrites in dev.`,
    );
    API = 'http://127.0.0.1:4000';
  }
} else if (process.env.NODE_ENV === 'development') {
  API = 'http://127.0.0.1:4000';
} else if (vercelDeploy) {
  warnApiUpstream(
    `Missing API_UPSTREAM (${process.env.VERCEL_ENV ?? 'unknown'}): add https://your-api.up.railway.app in Vercel → Environment Variables, then redeploy so /api/* proxies to your API.`,
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** No flat ESLint config here; `lint` uses `tsc`. Next 15 + ESLint 9 can fail the default build lint step on Vercel without this. */
  eslint: {
    ignoreDuringBuilds: true,
  },
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
