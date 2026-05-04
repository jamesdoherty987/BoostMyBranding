"use client";
import React, { useState } from "react";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

type FeatureItem = {
  title: string;
  description: string;
  content: string;
  src: string;
  className?: string;
};

const DEFAULT_ITEMS: FeatureItem[] = [
  {
    title: "SaaS Founders",
    description: "Founders who  shipping fast.",
    content:
      "Accelerate your product launches without sacrificing quality. Get feedback and iterate quicker to stay ahead of the competition.",
    src: "https://assets.aceternity.com/logos/raycast.webp",
    className: "text-orange-500 dark:text-orange-500",
  },
  {
    title: "Design Agencies",
    description: "Agencies that value efficiency.",
    content:
      "Deliver stunning websites to clients faster than ever. Streamline your workflow and let your team focus on what matters—designing memorable experiences.",
    src: "https://assets.aceternity.com/logos/twitch.webp",
    className: "text-red-500 dark:text-red-500",
  },
  {
    title: "Developers",
    description: "Engineers who skip boilerplate.",
    content:
      "Jumpstart every new project with ready-to-use components. Spend less time wiring up UI and more time fine-tuning your code.",
    src: "https://assets.aceternity.com/logos/spotify.webp",
    className: "text-green-500 dark:text-green-500",
  },
  {
    title: "Product Managers",
    description: "Leaders driving rapid iteration.",
    content:
      "Move from ideation to prototype in hours. Empower your team to experiment, iterate, and ship features with confidence.",
    src: "https://assets.aceternity.com/logos/youtube.webp",
    className: "text-rose-500 dark:text-rose-500",
  },
  {
    title: "Startup Teams",
    description: "Teams punching above their weight.",
    content:
      "Build production-grade apps at startup speed. Eliminate bottlenecks with easy-to-customize building blocks.",
    src: "https://assets.aceternity.com/logos/netflix.webp",

    className: "text-purple-500 dark:text-purple-500",
  },
  {
    title: "Marketing Teams",
    description: "Marketers who need agility.",
    content:
      "Quickly launch campaigns and landing pages with pre-built blocks. Focus on strategy while the design just works—no bottlenecks, no stress.",
    src: "https://assets.aceternity.com/logos/vercel.png",
    className: "text-blue-500 dark:text-blue-500",
  },
];
export function FeaturesWithHoverAndTextAnimatations() {
  const [hovered, setHovered] = useState<FeatureItem | null>(null);
  const isActive = hovered?.title;
  const isItemActive = (item: FeatureItem) => item.title === hovered?.title;
  return (
    <section className="w-full bg-gray-100 dark:bg-neutral-800">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 md:py-20 lg:py-32">
        <h2 className="max-w-2xl text-left text-2xl tracking-tight text-neutral-800 perspective-distant md:text-4xl lg:text-5xl dark:text-neutral-300">
          Loved by thousands of people who are{" "}
          <AnimatePresence mode="popLayout">
            <motion.span
              key={hovered?.title || "Builders"}
              initial={{
                y: -20,
                opacity: 0,
                rotateX: 40,
              }}
              animate={{
                y: 0,
                opacity: 1,
                rotateX: 0,
              }}
              exit={{
                y: 10,
                opacity: 0,
                rotateX: -40,
              }}
              transition={{
                duration: 0.2,
                ease: "easeInOut",
              }}
              className={cn(
                "inline-block whitespace-nowrap",
                isActive && hovered?.className,
              )}
            >
              {hovered?.title || "Builders"}
            </motion.span>
            .
          </AnimatePresence>
        </h2>
        <p className="mt-4 max-w-xl text-lg text-neutral-400 dark:text-neutral-400">
          Browse our catalog of templates and components to find the perfect
          solution for your project.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-px border border-neutral-200 bg-neutral-200 md:mt-12 md:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-800">
          {DEFAULT_ITEMS.map((item) => (
            <motion.div
              onMouseEnter={() => setHovered(item)}
              onMouseLeave={() => setHovered(null)}
              key={item.title + "-card"}
              className="group relative flex flex-col items-start justify-between gap-10 bg-white p-4 hover:shadow-xl md:p-8 dark:bg-neutral-950"
            >
              <p className="text-neutral-400 dark:text-neutral-600">
                <span
                  className={cn(
                    "font-medium text-neutral-700 transition-colors duration-200 dark:text-neutral-300",
                    isItemActive(item) && item.className,
                  )}
                >
                  {item.description}
                </span>{" "}
                {item.content}
              </p>
              <img
                src={item.src}
                alt={item.title}
                className="h-6 object-contain grayscale-10 transition-all duration-200 group-hover:grayscale-0 md:h-10 dark:invert dark:filter"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
