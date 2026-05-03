/**
 * Shared helpers for the client-site routes (/sites/[slug] and
 * /sites/[slug]/[page]). Handles fetching the site payload, building
 * metadata, and deciding which API URL to use in each environment.
 *
 * Server-side fetch is used everywhere so the rendered HTML ships
 * pre-populated with the right meta tags — critical for SEO and for
 * social link previews.
 */

import type { Metadata } from 'next';
import type { WebsiteConfig, PageConfig } from '@boost/core';
import { resolvePage } from '@boost/core';

export interface SiteData {
  businessName: string;
  slug: string;
  clientId?: string;
  config: WebsiteConfig | null;
  images: string[];
  status?: 'pending' | 'ready';
}

/**
 * API URL resolution.
 *
 *   In prod (Vercel/Render), `API_UPSTREAM` points at the Render API
 *   deployment. Server-rendered pages need an absolute URL since a
 *   relative `/api/*` doesn't work from a Node environment.
 *
 *   In dev, `NEXT_PUBLIC_API_URL` is the localhost:4000 fallback.
 */
export const API_URL =
  process.env.API_UPSTREAM ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

/**
 * Fetch the site payload by slug. Returns null on any failure so the caller
 * can `notFound()` cleanly. `no-store` so a fresh generation is visible
 * immediately — first-site visibility is too high-signal to wait for cache
 * invalidation.
 */
export async function loadSite(slug: string): Promise<SiteData | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/clients/public/by-slug/${encodeURIComponent(slug)}/site`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: SiteData };
    return payload.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the `<head>` metadata for a rendered page. Prefers the per-page
 * meta override when the site is multipage; falls back to the root meta.
 */
export function buildPageMetadata(
  site: SiteData,
  pageSlug?: string,
): Metadata {
  if (!site.config) {
    return {
      title: site.businessName,
      description: `${site.businessName} - site coming soon.`,
    };
  }

  const page: PageConfig = resolvePage(site.config, pageSlug);
  const baseTitle = site.config.meta.title;
  const baseDescription = site.config.meta.description;

  const title =
    page.meta?.title ??
    (pageSlug && pageSlug !== 'home'
      ? `${page.title} — ${site.businessName}`
      : baseTitle);
  const description = page.meta?.description ?? baseDescription;

  return {
    title,
    description,
    keywords: site.config.meta.keywords,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

/**
 * Friendly holding-page component used when a client's site hasn't been
 * generated yet. Rendered by both the home route and sub-page route.
 */
export function siteNotReadyMarkup(businessName: string) {
  return {
    businessName,
    message: 'Your site is being prepared. Check back shortly.',
  };
}
