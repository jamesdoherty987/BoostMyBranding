import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteRenderer } from '@boost/ui/site';
import { API_URL, buildPageMetadata, loadSite } from '@/lib/site-loader';

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
  return buildPageMetadata(site, 'home');
}

/**
 * Client-site home page. Handles both single-page configs (the original
 * flow) and multipage configs (homepage rendered with `pageSlug: 'home'`).
 */
export default async function ClientSiteHomePage({
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
      pageSlug="home"
    />
  );
}
