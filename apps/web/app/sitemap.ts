import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/examples`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
  ];
}
