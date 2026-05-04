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

export function CTACenteredMasonryGallery() {
  return (
    <section className="relative mx-auto my-20 w-full max-w-7xl overflow-hidden px-4 md:my-28 md:px-8">
      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance text-black md:text-4xl dark:text-white">
          Build the front end your team will actually ship.
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-base text-neutral-600 md:text-lg dark:text-neutral-400">
          Drop in blocks, tune copy, and keep momentum. No wrestling with layout
          primitives every time you need a new section.
        </p>
        <button
          type="button"
          className="group mx-auto mt-10 flex cursor-pointer items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 font-medium text-white shadow-[0px_0px_10px_0px_rgba(255,255,255,0.2)_inset] ring ring-white/20 ring-offset-2 ring-offset-blue-700 transition-all duration-200 ring-inset hover:shadow-[0px_0px_20px_0px_rgba(255,255,255,0.35)_inset] hover:ring-white/40 active:scale-98 dark:bg-blue-500 dark:ring-offset-blue-600"
        >
          <span>Browse CTA blocks</span>
          <IconArrowRight className="mt-0.5 h-4 w-4 text-white transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </div>

      <div className="relative mx-auto mt-16 max-w-4xl mask-b-from-50% p-4">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
          <div className="flex flex-col gap-2.5 pt-0 sm:gap-3 md:gap-4">
            {images.slice(0, 2).map((image) => (
              <figure
                key={image.src}
                className="overflow-hidden rounded-md shadow-sm ring-1 shadow-black/10 ring-black/5 dark:shadow-black/40 dark:ring-white/10"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  width={400}
                  height={280}
                  className="aspect-4/3 w-full object-cover sm:h-36 md:h-44 dark:invert dark:filter"
                />
              </figure>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 pt-8 sm:gap-3 sm:pt-12 md:gap-4 md:pt-16">
            {images.slice(2, 4).map((image) => (
              <figure
                key={image.src}
                className="overflow-hidden rounded-md shadow-sm ring-1 shadow-black/10 ring-black/5 dark:shadow-black/40 dark:ring-white/10"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  width={400}
                  height={280}
                  className="aspect-4/3 w-full object-cover sm:h-36 md:h-44 dark:invert dark:filter"
                />
              </figure>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 pt-0 sm:gap-3 md:gap-4">
            {images.slice(4, 6).map((image) => (
              <figure
                key={image.src}
                className="overflow-hidden rounded-md shadow-sm ring-1 shadow-black/10 ring-black/5 dark:shadow-black/40 dark:ring-white/10"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  width={400}
                  height={280}
                  className="aspect-4/3 w-full object-cover sm:h-36 md:h-44 dark:invert dark:filter"
                />
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
