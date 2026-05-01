import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { getPost, getAllSlugs, posts } from '@/lib/blog';

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: 'Post not found' };

  return {
    title: post.title,
    description: post.metaDescription ?? post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.metaDescription ?? post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.metaDescription ?? post.excerpt,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.metaDescription ?? post.excerpt,
    author: { '@type': 'Organization', name: post.author },
    datePublished: post.publishedAt,
    publisher: {
      '@type': 'Organization',
      name: 'BoostMyBranding',
      logo: {
        '@type': 'ImageObject',
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://boostmybranding.com'}/favicon.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://boostmybranding.com'}/blog/${post.slug}`,
    },
  };

  // Find next/prev for internal linking
  const idx = posts.findIndex((p) => p.slug === post.slug);
  const prev = idx < posts.length - 1 ? posts[idx + 1] : undefined;
  const next = idx > 0 ? posts[idx - 1] : undefined;

  return (
    <main className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <article className="mx-auto max-w-3xl px-4 pb-16 pt-32 md:pt-40">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Link href="/blog" className="hover:text-slate-900">
            Blog
          </Link>
          <span>/</span>
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString('en-IE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <span>·</span>
          <span>{post.readingTime}</span>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl lg:text-5xl">
          {post.title}
        </h1>

        <p className="mt-4 text-lg text-slate-600">{post.excerpt}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <hr className="my-8 border-slate-200" />

        <div className="space-y-5 text-[16px] leading-[1.75] text-slate-700">
          {post.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center md:p-8">
          <h3 className="text-lg font-semibold text-slate-900">
            Want this handled for you?
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            We plan, write, and publish your social media every month. Start a free trial and
            see your first content plan within a week.
          </p>
          <Link
            href="/signup"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1D9CA1] via-[#48D886] to-[#FFEC3D] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
          >
            Start free trial
          </Link>
        </div>

        {/* Prev / Next navigation for internal linking */}
        {(prev || next) ? (
          <nav className="mt-10 grid grid-cols-1 gap-4 border-t border-slate-200 pt-8 md:grid-cols-2">
            {prev ? (
              <Link
                href={`/blog/${prev.slug}`}
                className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50"
              >
                <span className="text-xs text-slate-500">Previous</span>
                <span className="mt-1 block text-sm font-semibold text-slate-900">
                  {prev.title}
                </span>
              </Link>
            ) : <div />}
            {next ? (
              <Link
                href={`/blog/${next.slug}`}
                className="rounded-xl border border-slate-200 p-4 text-right transition-colors hover:bg-slate-50"
              >
                <span className="text-xs text-slate-500">Next</span>
                <span className="mt-1 block text-sm font-semibold text-slate-900">
                  {next.title}
                </span>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </article>

      <Footer />
    </main>
  );
}
