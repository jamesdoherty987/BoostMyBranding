import type { NextConfig } from 'next';

/**
 * Single Next.js app that serves everything:
 *   /                    → marketing site
 *   /sites/[slug]        → client-facing sites
 *   /dashboard/*         → agency dashboard
 *   /portal/*            → client portal
 *   /api/*               → proxied to the Express API (Render)
 *   /signup              → unified signup / login / forgot
 *
 * The dashboard and portal are regular Next.js route segments now, not
 * separate deployments. Only the API lives elsewhere because it needs a
 * long-running Node process (cron, websockets, 30s+ generation jobs).
 *
 * Required env vars for production:
 *   API_UPSTREAM — e.g. https://boost-api.onrender.com
 */

const API = process.env.API_UPSTREAM;

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
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
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
