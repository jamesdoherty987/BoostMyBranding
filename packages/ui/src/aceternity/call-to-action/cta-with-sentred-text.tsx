"use client";
import React from "react";
import { cn } from "@/lib/utils";

const CTA_BACKGROUND_IMAGES = [
  "https://assets.aceternity.com/components/feature-section-with-vertical-grids.webp",
  "https://assets.aceternity.com/components/feature-section-with-horizontal-skeletons.webp",
  "https://assets.aceternity.com/components/multi-illustration-bento.webp",
  "https://assets.aceternity.com/components/features-with-isometric-blocks.webp",
  "https://assets.aceternity.com/components/keyboard-2.webp",
  "https://assets.aceternity.com/components/hero-2.webp",
  "https://assets.aceternity.com/components/shader-1.webp",
  "https://assets.aceternity.com/components/hero-3.webp",
] as const;

const CTA_TILE_COUNT = 14;

export function CTAWithCenteredText() {
  return (
    <section className="w-full px-4 md:px-8">
      <div className="relative isolate mx-auto my-12 max-h-96 w-full max-w-4xl overflow-hidden rounded-3xl px-4 shadow-sm ring-1 shadow-black/10 ring-black/10 md:my-20 md:min-h-40 dark:shadow-xl dark:shadow-black/80 dark:ring-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 flex flex-row flex-wrap justify-center gap-3 mask-x-from-80%"
        >
          {Array.from({ length: CTA_TILE_COUNT }, (_, i) => (
            <div
              key={i}
              className="flex aspect-video size-32 items-center justify-center gap-12 overflow-hidden rounded-md bg-neutral-50 shadow-sm ring-1 shadow-black/10 ring-black/10 sm:size-48 md:size-64"
            >
              <img
                src={CTA_BACKGROUND_IMAGES[i % CTA_BACKGROUND_IMAGES.length]}
                alt=""
                className="h-full w-full object-cover object-center dark:brightness-100 dark:invert"
              />
            </div>
          ))}
        </div>

        <div className="relative z-10 mx-auto h-full max-w-md border-x bg-white px-4 py-10 sm:py-16 md:px-8 md:py-32 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mx-auto max-w-[40ch] px-2 text-center text-lg font-semibold tracking-tight text-balance text-neutral-700 sm:px-4 sm:text-xl md:max-w-[35ch] md:px-8 md:text-3xl dark:text-neutral-300">
            Let&apos;s give your agents infinite memory.
          </h2>

          <div className="mt-4 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button>Sign up for free</Button>
            <Button
              href="/#"
              variant="outline"
              className="flex items-center gap-2"
            >
              Read Documentation
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const variantStyles = {
  default:
    "bg-linear-to-b from-blue-600 to-blue-500 text-white shadow-[0px_0px_10px_0px_rgba(255,255,255,0.2)_inset] ring ring-white/20 ring-inset ring-offset-2 ring-offset-blue-500 hover:shadow-[0px_0px_20px_0px_rgba(255,255,255,0.4)_inset] hover:ring-white/40",
  outline:
    "shadow-sm shadow-black/10 ring-1 ring-black/10 bg-white text-black  ring-offset-0 hover:bg-neutral-100 ",
} as const;

export type ButtonProps = {
  href?: string;
  as?: React.ElementType;
  variant?: keyof typeof variantStyles;
  children: React.ReactNode;
  className?: string;
} & Record<string, unknown>;

const Button = ({
  href,
  as,
  variant = "default",
  children,
  className,
  ...props
}: ButtonProps) => {
  const classes = cn(
    "flex cursor-pointer items-center justify-center rounded-xl px-4 py-2 transition-all duration-200 active:scale-98 text-sm",
    variantStyles[variant],
    className,
  );

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
};
