import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { posts } from '@/lib/blog';

const TAG_COLORS: Record<string, string> = {
  'social media': 'bg-[#1D9CA1]/10 text-[#1D9CA1]',
  'local business': 'bg-[#48D886]/10 text-emerald-700',
  marketing: 'bg-[#FFEC3D]/20 text-amber-700',
  'content strategy': 'bg-purple-100 text-purple-700',
  'small business': 'bg-[#48D886]/10 text-emerald-700',
  photography: 'bg-rose-100 text-rose-700',
  Instagram: 'bg-pink-100 text-pink-700',
  'content creation': 'bg-sky-100 text-sky-700',
  'marketing strategy': 'bg-indigo-100 text-indigo-700',
  website: 'bg-[#1D9CA1]/10 text-[#1D9CA1]',
};

const CARD_ACCENTS = [
  'from-[#1D9CA1] to-[#48D886]',
  'from-[#48D886] to-[#FFEC3D]',
  'from-[#FFEC3D] to-[#1D9CA1]',
  'from-[#1D9CA1] to-[#48D886]',
];

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Practical social media and marketing advice for local businesses. Tips on content, photography, strategy, and growing your brand online.',
  alternates: { canonical: '/blog' },
};

export default function BlogIndexPage() {
  return (
    <main className="bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-5xl px-4 pb-20 pt-32 md:pt-40">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Blog
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Practical advice on social media, content, and marketing for local businesses.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {posts.map((post, i) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Accent gradient bar */}
              <div
                className={`h-1.5 w-full bg-gradient-to-r ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`}
              />

              <div className="flex flex-1 flex-col p-5 md:p-6">
                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        TAG_COLORS[tag] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h2 className="mt-3 text-lg font-bold text-slate-900 transition-colors group-hover:text-[#1D9CA1] md:text-xl">
                  {post.title}
                </h2>

                {/* Excerpt */}
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                  {post.excerpt}
                </p>

                {/* Footer */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <time
                    dateTime={post.publishedAt}
                    className="text-xs text-slate-500"
                  >
                    {new Date(post.publishedAt).toLocaleDateString('en-IE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                  <span className="text-xs font-medium text-slate-500">
                    {post.readingTime}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
