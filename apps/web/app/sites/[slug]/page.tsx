import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteRenderer } from '@boost/ui/site';
import type { WebsiteConfig } from '@boost/core';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface SiteData {
  businessName: string;
  slug: string;
  clientId?: string;
  config: WebsiteConfig | null;
  images: string[];
  status?: 'pending' | 'ready';
}

/**
 * Fetch the site payload from the API. Runs on the server so the rendered
 * HTML ships pre-populated with the correct meta tags. Returns null if the
 * slug doesn't resolve so the page can 404 cleanly.
 *
 * We use `no-store` so a fresh generation is visible immediately — a client's
 * first site is too high-signal to wait for cache invalidation.
 */
async function loadSite(slug: string): Promise<SiteData | null> {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) {
    return { title: 'Site not found' };
  }
  if (!site.config) {
    return {
      title: site.businessName,
      description: `${site.businessName} - site coming soon.`,
    };
  }
  return {
    title: site.config.meta.title,
    description: site.config.meta.description,
    keywords: site.config.meta.keywords,
    openGraph: {
      title: site.config.meta.title,
      description: site.config.meta.description,
      type: 'website',
    },
  };
}

export default async function ClientSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) notFound();

  // If the client hasn't had a site generated yet, show a friendly holding page.
  if (!site.config) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{site.businessName}</h1>
          <p className="mt-3 text-sm text-slate-600">
            Your site is being prepared. Check back shortly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <SiteRenderer
      config={site.config}
      businessName={site.businessName}
      images={site.images}
      clientId={site.clientId}
      apiUrl={API_URL}
    />
  );
}
