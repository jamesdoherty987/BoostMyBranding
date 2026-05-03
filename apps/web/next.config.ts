import type { NextConfig } from 'next';

/**
 * The `web` project owns the main domain (boostmybranding.com). Other
 * apps are proxied in at path prefixes so the user only ever sees one
 * domain, even though each app is a separate deployment.
 *
 * URLs:
 *   /             → web itself (marketing + /sites/[slug])
 *   /portal/*     → apps/portal
 *   /dashboard/*  → apps/dashboard
 *   /api/*        → apps/api
 *
 * Each proxied app sets its own `basePath` via its next.config so links
 * inside it resolve under the right prefix. In local dev the path prefixes
 * aren't used (each app runs at its own port), but the same URLs work
 * because the apps don't assume a basePath when `*_BASE_PATH` is unset.
 *
 * Required env vars for production:
 *   PORTAL_UPSTREAM     – e.g. https://boost-portal.vercel.app
 *   DASHBOARD_UPSTREAM  – e.g. https://boost-dashboard.vercel.app
 *   API_UPSTREAM        – e.g. https://boost-api.onrender.com
 */

const PORTAL = process.env.PORTAL_UPSTREAM;
const DASHBOARD = process.env.DASHBOARD_UPSTREAM;
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
    const rules: Array<{ source: string; destination: string }> = [];
    // The upstream apps set `basePath` so the prefix is already in their
    // internal URLs. We still send the full path including the prefix,
    // matching how Vercel multi-deploy proxies work.
    if (PORTAL) {
      rules.push({ source: '/portal/:path*', destination: `${PORTAL}/portal/:path*` });
    }
    if (DASHBOARD) {
      rules.push({ source: '/dashboard/:path*', destination: `${DASHBOARD}/dashboard/:path*` });
    }
    if (API) {
      rules.push({ source: '/api/:path*', destination: `${API}/api/:path*` });
    }
    return rules;
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
