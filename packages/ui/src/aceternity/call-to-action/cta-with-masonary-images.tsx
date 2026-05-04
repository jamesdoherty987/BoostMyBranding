"use client";

import React from "react";
import { IconArrowRight } from "@tabler/icons-react";

const images = [
  {
    src: "https://assets.aceternity.com/components/pricing-minimal.webp",
    alt: "Creative product workspace",
  },
  {
    src: "https://assets.aceternity.com/components/contact-section-with-shader.webp",
    alt: "Team collaboration desk setup",
  },
  {
    src: "https://assets.aceternity.com/components/feature-section-with-bento-skeletons.webp",
    alt: "Developer dashboard on laptop",
  },
  {
    src: "https://assets.aceternity.com/components/features-with-isometric-blocks.webp",
    alt: "Design system components layout",
  },
  {
    src: "https://assets.aceternity.com/components/illustrations.webp",
    alt: "Code editor with app interface",
  },
  {
    src: "https://assets.aceternity.com/components/globe-3.webp",
    alt: "UI mockups and product visuals",
  },
];

export function CTAWithMasonryImages() {
  return (
    <section className="mx-auto my-20 grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 md:my-28 md:grid-cols-2 md:gap-16 md:px-8">
      <div className="max-w-xl">
        <h2 className="text-3xl font-bold tracking-tight text-balance text-black md:text-4xl dark:text-white">
          Launch faster with production-ready UI blocks.
        </h2>
        <p className="mt-6 max-w-lg text-base text-neutral-600 md:text-base dark:text-neutral-400">
          Ship polished landing pages in hours. Pick a block, customize it, and
          move from idea to launch without rebuilding layout primitives.
        </p>
        <button className="group mt-8 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-[0px_0px_10px_0px_rgba(255,255,255,0.2)_inset] ring ring-white/20 ring-offset-2 ring-offset-blue-700 transition-all duration-200 ring-inset hover:shadow-[0px_0px_20px_0px_rgba(255,255,255,0.35)_inset] hover:ring-white/40 active:scale-98 dark:bg-blue-500 dark:ring-offset-blue-600">
          <span>Get all CTA blocks</span>
          <IconArrowRight className="mt-0.5 h-4 w-4 text-white transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </div>

      <div className="relative max-h-140 overflow-hidden rounded-2xl bg-white/60 mask-t-from-50% mask-b-from-50% p-3 dark:bg-neutral-950/50">
        <div className="grid h-full grid-cols-2 gap-3">
          <div className="flex flex-col gap-3">
            {images.slice(0, 3).map((image) => (
              <div
                key={image.src}
                className="overflow-hidden rounded-xl shadow-sm ring-1 shadow-black/10 ring-black/5"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  width={500}
                  height={320}
                  className="h-44 w-full object-cover"
                />
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-3">
            {images.slice(3).map((image) => (
              <div
                key={image.src}
                className="overflow-hidden rounded-xl shadow-sm ring-1 shadow-black/10 ring-black/5"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  width={500}
                  height={320}
                  className="h-44 w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
