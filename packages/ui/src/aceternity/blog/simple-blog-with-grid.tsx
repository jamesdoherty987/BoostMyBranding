"use client";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function SimpleBlogWithGrid() {
  return (
    <div className="relative overflow-hidden py-20 md:py-0">
      <div className="relative overflow-hidden px-4 py-4 md:px-8 md:py-10">
        <GridPatternContainer className="opacity-50" />
        <div className="relative z-20 py-10">
          <h1
            className={cn(
              "mb-6 scroll-m-20 text-center text-4xl font-bold tracking-tight text-black md:text-left dark:text-white",
            )}
          >
            Blog
          </h1>

          <p className="dark:text-neutral-400-foreground !mb-6 max-w-xl text-center text-lg text-neutral-600 md:text-left">
            Discover insightful resources and expert advice from our seasoned
            team to elevate your knowledge.
          </p>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between px-4 pb-20 md:px-8">
        <div className="relative z-20 grid w-full grid-cols-1 gap-10 md:grid-cols-3">
          {blogs.map((blog, index) => (
            <BlogCard blog={blog} key={blog.title + index} />
          ))}
        </div>
      </div>
    </div>
  );
}

const Logo = () => {
  return (
    <Link
      href="/"
      className="relative z-20 mr-4 flex items-center space-x-2 px-2 py-1 text-sm font-normal text-black"
    >
      <div className="h-5 w-6 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
      <span className="font-medium text-black dark:text-white">DevStudio</span>
    </Link>
  );
};

export const BlogCard = ({ blog }: { blog: Blog }) => {
  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + "..." : text;
  };
  return (
    <Link
      className="shadow-derek w-full overflow-hidden rounded-3xl border bg-white transition duration-200 hover:scale-[1.02] dark:border-neutral-800 dark:bg-neutral-900"
      href="#"
    >
      {blog.image ? (
        <img
          src={blog.image || ""}
          alt={blog.title}
          height="800"
          width="800"
          className="h-52 w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-52 items-center justify-center bg-white dark:bg-neutral-900">
          <Logo />
        </div>
      )}
      <div className="bg-white p-4 md:p-8 dark:bg-neutral-900">
        <div className="mb-2 flex items-center space-x-2">
          <img
            src={blog.authorAvatar}
            alt={blog.author}
            width={20}
            height={20}
            className="h-5 w-5 rounded-full"
          />
          <p className="text-sm font-normal text-neutral-600 dark:text-neutral-400">
            {blog.author}
          </p>
        </div>
        <p className="mb-4 text-lg font-bold text-neutral-800 dark:text-neutral-100">
          {blog.title}
        </p>
        <p className="mt-2 text-left text-sm text-neutral-600 dark:text-neutral-400">
          {truncate(blog.description, 100)}
        </p>
      </div>
    </Link>
  );
};

type Blog = {
  title: string;
  description: string;
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
    slug: "changelog-for-2024",
    image:
      "https://images.unsplash.com/photo-1696429175928-793a1cdef1d3?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "Understanding React Hooks",
    description:
      "A comprehensive guide to understanding and using React Hooks in your projects.",
    slug: "understanding-react-hooks",
    image:
      "https://images.unsplash.com/photo-1560958089-b8a1929cea89?q=80&w=3542&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "CSS Grid Layout",
    description: "Learn how to create complex layouts easily with CSS Grid.",
    slug: "css-grid-layout",
    image:
      "https://images.unsplash.com/photo-1697577418970-95d99b5a55cf?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "JavaScript ES2021 Features",
    description:
      "An overview of the new features introduced in JavaScript ES2021.",
    slug: "javascript-es2021-features",
    image:
      "https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=4846&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "Building RESTful APIs with Node.js",
    description:
      "Step-by-step guide to building RESTful APIs using Node.js and Express.",
    slug: "building-restful-apis-with-nodejs",
    image:
      "https://images.unsplash.com/photo-1484557052118-f32bd25b45b5?q=80&w=5069&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    author: "Manu Arora",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
  {
    title: "Mastering TypeScript",
    description:
      "A deep dive into TypeScript, its features, and how to effectively use it in your projects.",
    slug: "mastering-typescript",
    image:
      "https://images.unsplash.com/photo-1535223289827-42f1e9919769?q=80&w=3212&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    author: "Jane Doe",
    authorAvatar: "https://assets.aceternity.com/manu.png",
  },
];

export function GridPatternContainer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]",
        className,
      )}
    >
      <GridPattern />
    </div>
  );
}
export function GridPattern() {
  const columns = 30;
  const rows = 11;
  return (
    <div className="flex flex-shrink-0 scale-105 flex-wrap items-center justify-center gap-x-px gap-y-px bg-gray-200 dark:bg-neutral-700">
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: columns }).map((_, col) => {
          const index = row * columns + col;
          return (
            <div
              key={`${col}-${row}`}
              className={`flex h-10 w-10 flex-shrink-0 rounded-[1px] ${
                index % 2 === 0
                  ? "bg-gray-100 dark:bg-neutral-800"
                  : "bg-gray-100 shadow-[0px_0px_0px_3px_rgba(255,255,255,1)_inset] dark:bg-neutral-800 dark:shadow-[0px_0px_0px_3px_rgba(0,0,0,0.2)_inset]"
              }`}
            />
          );
        }),
      )}
    </div>
  );
}
