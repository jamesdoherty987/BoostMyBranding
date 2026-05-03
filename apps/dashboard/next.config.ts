import type { NextConfig } from 'next';

/**
 * Dashboard is served at `/dashboard/*` in production (proxied from the
 * web app). Dev runs at `http://localhost:3002/` without a basePath. The
 * `DASHBOARD_BASE_PATH` env var flips this per-environment.
 */
const basePath = process.env.DASHBOARD_BASE_PATH || '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath,
  assetPrefix: basePath || undefined,
  transpilePackages: ['@boost/ui', '@boost/core', '@boost/api-client'],
  images: {
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
