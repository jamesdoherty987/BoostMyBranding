import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteRenderer } from '@boost/ui/site';
import { slugify, listPages } from '@boost/core';
import { API_URL, buildPageMetadata, loadSite } from '@/lib/site-loader';

/**
 * Sub-page route for multipage client sites: `/sites/[slug]/[page]`.
 *
 * - `/sites/murphys-plumbing/about`   → About page
 * - `/sites/murphys-plumbing/services` → Services page
 *
 * If the site is single-page (no `config.pages`), any sub-page URL
 * redirects back to the homepage. If the page slug doesn't exist, we 404.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}): Promise<Metadata> {
  const { slug, page } = await params;
  const site = await loadSite(slug);
  if (!site?.config) return { title: 'Site not found' };

  const normalized = slugify(page);
  const pages = listPages(site.config);
  const match = pages.find((p) => p.slug === normalized);
  if (!match) return { title: 'Page not found' };

  return buildPageMetadata(site, match.slug);
}

export default async function ClientSiteSubPage({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}) {
  const { slug, page } = await params;
  const site = await loadSite(slug);
  if (!site) notFound();

  if (!site.config) {
    // The site exists but hasn't been generated yet — send them to the
    // root holding page rather than 404ing on a sub-page URL.
    redirect(`/sites/${slug}`);
  }

  const normalized = slugify(page);

  // `home` belongs at the root. If someone types `/sites/foo/home`, send
  // them to the canonical URL so search engines don't index duplicates.
  if (normalized === 'home') {
    redirect(`/sites/${slug}`);
  }

  const pages = listPages(site.config);

  // Single-page site: no sub-pages exist, send them home.
  if (pages.length === 0) {
    redirect(`/sites/${slug}`);
  }

  // Multipage site with an unknown slug: 404.
  const match = pages.find((p) => p.slug === normalized);
  if (!match) notFound();

  return (
    <SiteRenderer
      config={site.config}
      businessName={site.businessName}
      images={site.images}
      clientId={site.clientId}
      apiUrl={API_URL}
      pageSlug={match.slug}
    />
  );
}
