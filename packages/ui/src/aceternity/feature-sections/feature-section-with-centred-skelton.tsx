"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Lock, ShieldCheck, Sparkles, Users } from "lucide-react";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const leftFeatures = [
  {
    icon: Sparkles,
    title: "Generative editing",
    description:
      "Describe the look you want in plain language—relight scenes, swap backgrounds, and refine portraits with models built for real photography, not generic stock.",
  },
  {
    icon: Users,
    title: "Teams & workspaces",
    description:
      "Invite retouchers and producers with the right permissions, sync brand looks and LUTs, and keep every shoot and gallery in one studio.",
  },
] as const;

const rightFeatures = [
  {
    icon: ShieldCheck,
    title: "Privacy & originals",
    description:
      "Your raws and exports stay yours. Enterprise plans add encryption, optional zero-retention processing, and help with compliance when you need it.",
  },
  {
    icon: Lock,
    title: "Client-ready delivery",
    description:
      "Share proofs and finals with expiring links, password-protected albums, and watermarks so only invited clients see their work.",
  },
] as const;

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

function FeatureColumn({
  items,
  className,
}: {
  items: readonly FeatureItem[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-12 lg:gap-14", className)}>
      {items.map(({ icon: Icon, title, description }) => (
        <div key={title} className="flex flex-col gap-3">
          <Icon className="size-5 stroke-[1.5]" aria-hidden />
          <h3 className="text-base font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {description}
          </p>
        </div>
      ))}
    </div>
  );
}

function MiddleSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-[min(420px,70vw)] w-full flex-col justify-center overflow-hidden rounded-[2rem] border border-neutral-200/80 bg-neutral-100 p-6 sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/80",
        className,
      )}
      aria-hidden
    >
      <img
        src="https://assets.aceternity.com/components/mountains-snow.webp"
        alt="mountains-snow"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <FlippingImagesWithBar />
    </div>
  );
}

export function FeatureSectionWithCenteredSkeleton() {
  return (
    <section className="w-full bg-white px-4 py-16 text-neutral-950 sm:px-6 lg:py-24 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_minmax(300px,1.15fr)_1fr] lg:gap-12 xl:max-w-7xl xl:gap-16">
        <FeatureColumn items={leftFeatures} />
        <MiddleSkeleton />
        <FeatureColumn items={rightFeatures} />
      </div>
    </section>
  );
}

export function FlippingImagesWithBar() {
  const images = [
    {
      title: "Manu",
      href: "https://assets.aceternity.com/avatars/manu.webp",
    },
    {
      title: "Second Person",
      href: "https://assets.aceternity.com/avatars/2.webp",
    },
    {
      title: "Third Person",
      href: "https://assets.aceternity.com/avatars/3.webp",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"appear" | "scanning" | "flipping">(
    "appear",
  );
  const [barProgress, setBarProgress] = useState(0);

  useEffect(() => {
    if (phase === "appear") {
      const timer = setTimeout(() => setPhase("scanning"), 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, currentIndex]);

  useEffect(() => {
    if (phase === "scanning") {
      const duration = 2000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setBarProgress(progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setTimeout(() => {
            setPhase("flipping");
          }, 100);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "flipping") {
      const timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setBarProgress(0);
        setPhase("appear");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [phase, images.length]);

  const currentImage = images[currentIndex];

  return (
    <div className="mx-auto h-full w-full">
      <div className="relative h-full w-full rounded-lg bg-gray-200/50 p-4 dark:bg-neutral-800/50">
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-white shadow-sm ring-1 shadow-black/10 ring-black/5 dark:bg-neutral-800">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={currentIndex}
              className="absolute inset-0"
              initial={{ filter: "blur(12px)", opacity: 0 }}
              animate={{
                filter: phase === "flipping" ? "blur(12px)" : "blur(0px)",
                opacity: phase === "flipping" ? 0 : 1,
              }}
              exit={{ filter: "blur(12px)", opacity: 0 }}
              transition={{
                duration: 0.5,
                ease: "easeInOut",
              }}
            >
              {/* Grayscale image (base layer) */}
              <img
                src={currentImage.href}
                alt={currentImage.title}
                className="h-full w-full object-cover grayscale"
              />

              {/* Colored image revealed by bar */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  clipPath: `inset(0 ${100 - barProgress * 100}% 0 0)`,
                }}
              >
                <img
                  src={currentImage.href}
                  alt={currentImage.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Scanning bar */}
              {phase === "scanning" && (
                <motion.div
                  className="absolute top-0 bottom-0 w-px bg-linear-to-b from-transparent via-sky-500 to-transparent"
                  style={{
                    left: `${barProgress * 100}%`,

                    boxShadow:
                      "0 0 20px rgba(59, 130, 246, 0.9), 0 0 40px rgba(99, 102, 241, 0.7), 0 0 60px rgba(139, 92, 246, 0.5)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                ></motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
