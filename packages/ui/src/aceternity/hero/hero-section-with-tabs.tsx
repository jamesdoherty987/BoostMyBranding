"use client";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { AnimatePresence, motion } from "motion/react";
export function HeroSectionWithTabs() {
  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 px-4 py-8 md:px-8 md:py-12 lg:px-12">
      <div className="mt-4 flex w-full min-w-0 flex-col items-start px-2 md:px-8 xl:px-0">
        <h1
          className={cn(
            "relative mt-4 max-w-7xl text-left text-4xl font-bold tracking-tight text-balance text-neutral-900 sm:text-5xl md:text-6xl xl:text-8xl dark:text-neutral-50",
          )}
        >
          Ship software faster with Keyboard AI.
        </h1>
        <div className="mt-4 flex w-full flex-col items-start justify-between gap-4 md:mt-12 md:flex-row md:items-end md:gap-10">
          <div>
            <h2
              className={cn(
                "relative mb-8 max-w-2xl text-left text-sm tracking-wide text-neutral-600 antialiased sm:text-base md:text-xl dark:text-neutral-400",
              )}
            >
              Ship software so fast, your keyboard will file for overtime. Our
              AI writes code while you pretend to look busy—finally, a coworker
              who never asks about your weekend.
            </h2>

            <div className="relative mb-4 flex w-full flex-col justify-center gap-y-2 sm:flex-row sm:justify-start sm:space-y-0 sm:space-x-4">
              <a
                href="#"
                className="flex h-14 w-full items-center justify-center rounded-lg bg-black text-center text-base font-medium text-white shadow-sm ring-1 shadow-black/10 ring-black/10 transition duration-150 active:scale-98 sm:w-52 dark:bg-white dark:text-black"
              >
                Browse Keyboards
              </a>
              <a
                href="/pricing"
                className="flex h-14 w-full items-center justify-center rounded-lg border border-transparent bg-white text-base font-medium text-black shadow-sm ring-1 shadow-black/10 ring-black/10 transition duration-150 active:scale-98 sm:w-52 dark:border-neutral-600 dark:bg-black dark:text-white"
              >
                Get a mouse instead
              </a>
            </div>
          </div>
          <FeaturedImagesSimple showStars />
        </div>
        <BrowserWindow />
      </div>
    </div>
  );
}

// Define tab metadata outside component to avoid recreating on each render
const TAB_ITEMS = [
  {
    title: "Hero Section",
    image: "https://assets.aceternity.com/templates/template-preview-1.webp",
  },
  {
    title: "Portfolio",
    image: "https://assets.aceternity.com/templates/template-preview-2.webp",
  },
  {
    title: "Pricing",
    image: "https://assets.aceternity.com/templates/template-preview-3.webp",
  },
  {
    title: "Testimonials",
    image: "https://assets.aceternity.com/templates/template-preview-4.webp",
  },

  {
    title: "Bento Grid",
    image: "https://assets.aceternity.com/templates/template-preview-5.webp",
  },
  {
    title: "Call To Action",
    image: "https://assets.aceternity.com/templates/template-preview-6.webp",
  },
  {
    title: "Blogs",
    image: "https://assets.aceternity.com/templates/template-preview-7.webp",
  },
  {
    title: "Grid Cards",
    image: "https://assets.aceternity.com/templates/template-preview-9.webp",
  },
  {
    title: "Rotating Cards",
    image: "https://assets.aceternity.com/templates/template-preview-1.webp",
  },
  {
    title: "Sub Hero",
    image: "https://assets.aceternity.com/templates/template-preview-2.webp",
  },
] as const;

export const BrowserWindow = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItem = TAB_ITEMS[selectedIndex];
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      setSelectedIndex((prevIndex) => (prevIndex + 1) % TAB_ITEMS.length);
    }, 10000);
  }, []);

  useEffect(() => {
    startInterval();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startInterval]);

  const handleTabClick = (index: number) => {
    setSelectedIndex(index);
    startInterval(); // Reset the timer on click
  };

  const viewRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={viewRef}
      className="relative my-4 flex w-full flex-col items-start justify-start overflow-hidden rounded-2xl shadow-2xl md:my-12"
    >
      <div className="flex w-full items-center justify-start overflow-hidden bg-gray-200 py-4 pl-4 dark:bg-neutral-800">
        <div className="mr-6 flex items-center gap-2">
          <div className="size-3 rounded-full bg-red-500" />
          <div className="size-3 rounded-full bg-yellow-500" />
          <div className="size-3 rounded-full bg-green-500" />
        </div>
        <div className="no-visible-scrollbar flex min-w-0 shrink flex-row items-center justify-start gap-2 overflow-x-auto mask-l-from-98% py-0.5 pr-2 pl-2 md:pl-4">
          {TAB_ITEMS.map((item, index) => (
            <React.Fragment key={item.title}>
              <button
                onClick={() => handleTabClick(index)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition duration-150 hover:bg-white sm:text-sm dark:hover:bg-neutral-950",
                  selectedIndex === index &&
                    "bg-white shadow ring-1 shadow-black/10 ring-black/10 dark:bg-neutral-900",
                )}
              >
                {item.title}
              </button>
              {index !== TAB_ITEMS.length - 1 && (
                <div className="h-4 w-px shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="w-full overflow-hidden bg-gray-100/50 px-4 pt-4 perspective-distant dark:bg-neutral-950">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.99,
              filter: "blur(10px)",
            }}
            animate={{
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
            }}
            exit={{
              opacity: 0,
              scale: 0.98,
              filter: "blur(10px)",
            }}
            transition={{
              duration: 0.3,
              ease: "easeOut",
            }}
            key={selectedItem?.title}
            className="relative h-140 overflow-hidden rounded-tl-xl rounded-tr-xl bg-white shadow-sm ring-1 shadow-black/10 ring-black/10 will-change-transform md:h-200 dark:bg-neutral-950"
          >
            <img
              src={selectedItem?.image}
              alt={selectedItem?.title}
              className="h-full w-full object-cover object-top"
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// Placeholder avatar URLs
const FEATURED_AVATARS = [
  {
    name: "Manu",
    image: "https://assets.aceternity.com/avatars/manu.webp",
  },
  {
    name: "Tyler",
    image: "https://assets.aceternity.com/avatars/1.webp",
  },
  {
    name: "Narrator",
    image: "https://assets.aceternity.com/avatars/5.webp",
  },
  {
    name: "Fincher",
    image: "https://assets.aceternity.com/avatars/8.webp",
  },
  {
    name: "De Niro",
    image: "https://assets.aceternity.com/avatars/9.webp",
  },
];

const FeaturedImagesSimple = memo(function FeaturedImagesSimple({
  showStars = false,
}: {
  showStars?: boolean;
}) {
  return (
    <div className="flex flex-col items-start justify-start">
      <p className="mb-4 text-left text-sm text-neutral-500 lg:text-lg dark:text-neutral-400">
        Trusted by 120,000+ founders
        <br className="hidden lg:block" /> developers and creators
      </p>
      <div className="mb-2 flex flex-row items-center justify-center md:flex-col lg:flex-row">
        <div className="flex flex-row items-center">
          {FEATURED_AVATARS.map((avatar) => (
            <div className="group relative -mr-4 shrink-0" key={avatar.name}>
              <div className="relative size-10 overflow-hidden rounded-full border-2 border-white lg:size-14 dark:border-black">
                <img
                  src={avatar.image}
                  alt={avatar.name}
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>
          ))}
        </div>
        {showStars && (
          <div className="ml-6 flex justify-center">
            {[...Array(5)].map((_, index) => (
              <svg
                key={index}
                className="mx-0.5 size-3 text-yellow-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
