import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@boost/ui', '@boost/core', '@boost/api-client'],
  images: {
    // We serve every hero image from /public locally. No remote fetch on page load.
    remotePatterns: [],
  },
};

export default nextConfig;
