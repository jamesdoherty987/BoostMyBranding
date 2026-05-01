import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boostmybranding.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/pricing/success', '/api/', '/sites/'],
      },
      {
        userAgent: 'GPTBot',
        allow: ['/llms.txt', '/blog/', '/'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: ['/llms.txt', '/blog/', '/'],
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
      },
      {
        userAgent: 'Anthropic-AI',
        allow: ['/llms.txt', '/blog/', '/'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
