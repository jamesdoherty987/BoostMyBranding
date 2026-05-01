import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { posts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Practical social media and marketing advice for local businesses. Tips on content, photography, strategy, and growing your brand online.',
  alternates: { canonical: '/blog' },
};

export default function BlogIndexPage() {
  return (
    <main className="bg-white">
      <Navbar />

      <section className="mx-auto max-w-4xl px-4 pb-20 pt-32 md:pt-40">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Blog
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Practical advice on social media, content, and marketing for local businesses.
          </p>
        </div>

        <div className="mt-12 space-y-1">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-transparent p-5 transition-all hover:border-slate-200 hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('en-IE', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span>·</span>
                <span>{post.readingTime}</span>
                {post.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-slate-900 group-hover:text-[#1D9CA1] md:text-xl">
                {post.title}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{post.excerpt}</p>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
