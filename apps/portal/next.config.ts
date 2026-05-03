import type { NextConfig } from 'next';

/**
 * Portal is served at `/portal/*` in production (proxied from the web app).
 * In dev it stays at `http://localhost:3001/`. We drive this from the
 * `PORTAL_BASE_PATH` env var so local dev and Vercel can set it
 * independently.
 *
 * Important: `basePath` applies to route matching AND to the `_next/*`
 * asset paths, so every internal link in the app still says `/dashboard`
 * but Next resolves that to `/portal/dashboard` automatically.
 */
const basePath = process.env.PORTAL_BASE_PATH || '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath,
  assetPrefix: basePath || undefined,
  transpilePackages: ['@boost/ui', '@boost/core', '@boost/api-client'],
  images: {
    // When serving under a basePath, Next's image loader needs the same prefix.
    path: `${basePath}/_next/image`,
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: '**.fal.media' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
