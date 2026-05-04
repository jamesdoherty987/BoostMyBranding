"use client";

import { Container } from "@/components/container";
import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FuzzySearch from "fuzzy-search";

type Blog = {
  title: string;
  description: string;
  date: string;
  slug: string;
  image: string;
  author: string;
  authorAvatar: string;
};

const blogs: Blog[] = [
  {
    title: "Changelog for 2024",
    description:
      "Explore the latest updates and enhancements in our 2024 changelog. Discover new features and improvements that enhance user experience.",
    date: "2021-01-01",
    slug: "changelog-for-2024",
    image:
      "https://assets.aceternity.com/components/feature-section-with-centered-skeleton.webp",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "Understanding React Hooks",
    description:
      "A comprehensive guide to understanding and using React Hooks in your projects.",
    date: "2021-02-15",
    slug: "understanding-react-hooks",
    image:
      "https://assets.aceternity.com/components/hero-section-with-mousemove.webp",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "CSS Grid Layout",
    description: "Learn how to create complex layouts easily with CSS Grid.",
    date: "2021-03-10",
    slug: "css-grid-layout",
    image:
      "https://assets.aceternity.com/components/feature-section-with-terminal.webp",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "JavaScript ES2021 Features",
    description:
      "An overview of the new features introduced in JavaScript ES2021.",
    date: "2021-04-05",
    slug: "javascript-es2021-features",
    image: "https://assets.aceternity.com/components/clouds.webp",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "Building RESTful APIs with Node.js",
    description:
      "Step-by-step guide to building RESTful APIs using Node.js and Express.",
    date: "2021-05-20",
    slug: "building-restful-apis-with-nodejs",
    image: "https://assets.aceternity.com/components/mountains-snow.webp",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "TypeScript patterns for large apps",
    description:
      "Structuring modules, narrowing types, and keeping refactors safe as your codebase grows.",
    date: "2021-06-12",
    slug: "typescript-patterns-large-apps",
    image:
      "https://assets.aceternity.com/components/keyboard-illustration.webp",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "Parallax hero sections that feel alive",
    description:
      "Layer depth, motion, and imagery so your landing heroes respond naturally to scroll and pointer movement.",
    date: "2021-07-08",
    slug: "parallax-hero-sections",
    image: "https://assets.aceternity.com/components/parallax-hero-images.webp",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
];

function truncate(text: string, length: number) {
  return text.length > length ? text.slice(0, length) + "…" : text;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function BlogWithSearchMagazine() {
  const featured = blogs[0];

  return (
    <div className="relative overflow-hidden bg-neutral-50 px-4 md:px-8 dark:bg-neutral-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.12),transparent)]" />
      <Container className="relative pt-12 pb-24 md:pt-20">
        <header className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase dark:text-neutral-400">
              Editorial
            </p>
            <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-neutral-900 md:text-5xl dark:text-neutral-50">
              The journal
            </h1>
            <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
              Long-form notes on product, engineering, and design. Search the
              archive or start with this week&apos;s cover story.
            </p>
          </div>
        </header>

        <MagazineFeatured blog={featured} />

        <MagazineSearchGrid blogs={blogs} featuredSlug={featured.slug} />
      </Container>
    </div>
  );
}

function MagazineFeatured({ blog }: { blog: Blog }) {
  return (
    <Link
      href="#"
      className="group/cover relative mb-14 block overflow-hidden rounded-3xl border border-neutral-200/80 bg-neutral-900 shadow-sm dark:border-neutral-800 dark:shadow-none"
    >
      <div className="md:aspect-2.4/1 relative aspect-21/9 min-h-[220px]">
        {blog.image ? (
          <img
            src={blog.image}
            alt={blog.title}
            className="h-full w-full object-cover transition duration-500 group-hover/cover:scale-[1.03]"
          />
        ) : null}
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
          <span className="mb-2 inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            Cover story
          </span>
          <h2 className="max-w-3xl font-serif text-2xl leading-tight font-medium text-white md:text-4xl">
            {blog.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-white/85 md:text-base">
            {truncate(blog.description, 160)}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/90">
            <span className="flex items-center gap-2">
              <img
                src={blog.authorAvatar}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 rounded-full ring-2 ring-white/30"
                aria-hidden
              />
              {blog.author}
            </span>
            <span className="text-white/50">·</span>
            <time dateTime={blog.date}>
              {format(new Date(blog.date), "MMMM d, yyyy")}
            </time>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MagazineSearchGrid({
  blogs: allBlogs,
  featuredSlug,
}: {
  blogs: Blog[];
  featuredSlug: string;
}) {
  const [search, setSearch] = useState("");

  const searcher = useMemo(
    () =>
      new FuzzySearch(allBlogs, ["title", "description"], {
        caseSensitive: false,
      }),
    [allBlogs],
  );

  const [results, setResults] = useState(allBlogs);
  useEffect(() => {
    setResults(searcher.search(search));
  }, [search, searcher]);

  const gridItems = useMemo(() => {
    if (search.trim()) {
      return results;
    }
    return results.filter((b) => b.slug !== featuredSlug);
  }, [results, search, featuredSlug]);

  return (
    <section aria-labelledby="archive-heading">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="archive-heading"
          className="font-serif text-2xl font-medium text-neutral-900 dark:text-neutral-100"
        >
          From the archive
        </h2>
        <label className="relative w-full sm:max-w-md">
          <span className="sr-only">Search articles</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or topic…"
            className="w-full rounded-full bg-white py-3 pr-4 pl-12 text-sm text-neutral-800 shadow-sm ring-1 shadow-black/10 ring-black/10 transition outline-none placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-700/50"
          />
        </label>
      </div>

      {gridItems.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 py-16 text-center text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          No articles match that search.
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {gridItems.map((blog) => (
            <li key={blog.slug}>
              <MagazineCard blog={blog} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MagazineCard({ blog }: { blog: Blog }) {
  return (
    <Link
      href="#"
      className="group/card flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 shadow-black/10 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700"
    >
      <div className="relative aspect-16/10 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        {blog.image ? (
          <img
            src={blog.image}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <time
          className="text-xs font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400"
          dateTime={blog.date}
        >
          {format(new Date(blog.date), "MMM d, yyyy")}
        </time>
        <h3 className="mt-2 font-serif text-lg leading-snug font-medium text-neutral-900 dark:text-neutral-100">
          {blog.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {truncate(blog.description, 110)}
        </p>
        <div className="mt-4 flex items-center gap-2 pt-4">
          <img
            src={blog.authorAvatar}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 rounded-full object-cover"
          />
          <span className="text-xs text-neutral-600 dark:text-neutral-300">
            {blog.author}
          </span>
        </div>
      </div>
    </Link>
  );
}
