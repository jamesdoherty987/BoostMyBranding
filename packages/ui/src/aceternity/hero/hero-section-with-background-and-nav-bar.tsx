"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { motion } from "motion/react";

const navLinks = [
  { name: "Features", href: "#features" },
  { name: "Pricing", href: "#pricing" },
  { name: "Blog", href: "#blog" },
  { name: "Docs", href: "#docs" },
];

export function HeroWithBackgroundAndNavbar() {
  return (
    <div className="relative w-full">
      {/* Navbar */}
      <nav className="absolute inset-x-4 top-4 z-50 flex items-center justify-between px-4 py-4 md:inset-x-10 md:top-10 md:px-10">
        <Logo className="py-0" />
        <div className="flex items-center gap-4 md:gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="hidden text-sm font-medium text-neutral-600 mix-blend-multiply transition-colors hover:text-neutral-900 sm:block dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              {link.name}
            </a>
          ))}
          <Button text="Try for free" />
        </div>
      </nav>
      <div className="relative flex min-h-screen w-full flex-col justify-end p-4 md:p-14">
        {/* Background image with fade-in */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="pointer-events-none absolute inset-4 overflow-hidden md:inset-10"
        >
          <img
            src="https://assets.aceternity.com/screenshots/13.jpg"
            alt="Background"
            className="h-full w-full mask-t-from-20% mask-b-from-50% mask-l-from-50% object-cover object-center"
          />
        </motion.div>
        <Scales />
        <div className="relative z-40 p-4 md:p-4">
          <h1 className="max-w-3xl text-3xl font-medium tracking-tight text-neutral-800 sm:text-4xl md:text-6xl lg:text-8xl dark:text-neutral-200">
            Image generation at your fingertips
          </h1>
          <p className="mt-4 max-w-xl text-base text-neutral-600 md:mt-6 md:text-lg dark:text-neutral-400">
            Create breathtaking images with AI that understands your vision. No
            design skills needed—just describe what you imagine and watch it
            come to life.
          </p>
          <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center md:mt-10">
            <Button text="Try for free" />
            <button className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Read Documentation &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Scales = () => {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-4 h-px w-full bg-neutral-200 md:top-10 dark:bg-neutral-800"></div>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 h-px w-full bg-neutral-200 md:bottom-10 dark:bg-neutral-800"></div>
      <div className="pointer-events-none absolute inset-y-0 left-4 h-full w-px bg-neutral-200 md:left-10 dark:bg-neutral-800"></div>
      <div className="pointer-events-none absolute inset-y-0 right-4 h-full w-px bg-neutral-200 md:right-10 dark:bg-neutral-800"></div>
    </>
  );
};

export const Button = ({
  text = "Try for free",
  containerClassName,
}: {
  text?: string;
  showAvatar?: boolean;
  containerClassName?: string;
}) => {
  return (
    <button
      className={cn(
        "group/button relative flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-black py-2 pr-4 pl-11 tracking-tight",
        containerClassName,
      )}
    >
      <Box />
      <div className="absolute -inset-px rounded-lg bg-white/20 transition-[clip-path] duration-400 ease-out [clip-path:inset(0_100%_0_0)] group-hover/button:[clip-path:inset(0_0%_0_0)]" />
      <span className="inline-block text-white transition-transform duration-400 group-hover/button:-translate-x-8">
        {text}
      </span>
    </button>
  );
};

const Box = () => {
  return (
    <div className="absolute inset-y-0 left-1 z-40 my-auto flex size-8 flex-col items-center justify-center gap-px rounded-[5px] bg-yellow-500 transition-all duration-400 ease-out group-hover/button:left-[calc(100%-2.3rem)] group-hover/button:rotate-180 group-hover/button:transform">
      <BubblesGroup />
    </div>
  );
};

const BubblesGroup = () => {
  return (
    <div className={cn("flex flex-col gap-px")}>
      <div className="flex gap-px">
        <Bubble />
        <Bubble />
        <Bubble highlight />
        <Bubble />
        <Bubble />
      </div>
      <div className="flex gap-px">
        <Bubble />
        <Bubble />
        <Bubble />
        <Bubble highlight />
        <Bubble />
      </div>
      <div className="flex gap-px">
        <Bubble highlight />
        <Bubble highlight />
        <Bubble highlight />
        <Bubble highlight />
        <Bubble highlight />
      </div>
      <div className="flex gap-px">
        <Bubble />
        <Bubble />
        <Bubble />
        <Bubble highlight />
        <Bubble />
      </div>
      <div className="flex gap-px">
        <Bubble />
        <Bubble />
        <Bubble highlight />
        <Bubble />
        <Bubble />
      </div>
    </div>
  );
};

const Bubble = ({ highlight }: { highlight?: boolean }) => {
  return (
    <span
      className={cn(
        "inline-block size-[3px] shrink-0 rounded-full bg-white/25",
        highlight && "animate-pulse bg-white duration-200 ease-linear",
      )}
    />
  );
};

export const Logo = ({ className }: { className?: string }) => {
  return (
    <a
      href="/"
      className={cn(
        "flex items-center justify-center space-x-2 py-6 text-center text-2xl font-bold text-neutral-600 selection:bg-emerald-500 dark:text-gray-100",
        className,
      )}
    >
      <div className="relative flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-black text-sm text-white antialiased">
        <div className="absolute inset-x-0 -top-10 h-10 w-full rounded-full bg-white/20 blur-xl" />
        <div className="relative z-20 text-sm">
          <img
            src="https://assets.aceternity.com/logo.png"
            height="50"
            width="50"
            alt="Logo"
          />
        </div>
      </div>
      <div className="hidden flex-col sm:flex">
        <h1 className={cn("font-sans text-black dark:text-white")}>
          {" "}
          Saasternity
        </h1>
      </div>
    </a>
  );
};
