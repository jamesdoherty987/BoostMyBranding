"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export function Hero() {
  return (
    <div className="w-full pt-10 md:pt-20 lg:pt-32">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <h1 className="text-center text-2xl font-bold tracking-tight md:text-left md:text-4xl lg:text-6xl">
          Agents that do the work <br /> Approvals that keep you safe.
        </h1>

        <h2 className="font-inter max-w-xl py-8 text-center text-base text-neutral-500 md:text-left md:text-lg dark:text-neutral-400">
          Deploy AI agents that plan, act through your tools, and report
          outcomes—without changing how your teams work.
        </h2>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <button className="rounded-sm bg-black px-4 py-2 text-white shadow-2xl dark:bg-white dark:text-black">
            Start your free trial
          </button>
          <button className="rounded-sm bg-transparent px-4 py-2 text-black dark:text-white">
            <a href="#">View role based demos</a>
          </button>
        </div>
        <LandingImages />
      </div>
    </div>
  );
}

export const LandingImages = () => {
  return (
    <div className="relative min-h-40 w-full pt-20 perspective-distant sm:min-h-80 md:min-h-100 lg:min-h-200">
      <motion.div
        initial={{
          opacity: 0,
          y: -100,
        }}
        whileInView={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.5,
          ease: "easeOut",
        }}
        viewport={{
          once: true,
        }}
        className="shadow-2xl perspective-[4000px]"
      >
        <img
          src="https://assets.aceternity.com/agenforce-demo-2.jpg"
          alt="Demo 1 for agenforce template"
          height={1080}
          width={1920}
          className={cn(
            "absolute inset-0 rounded-lg mask-r-from-20% mask-b-from-20% shadow-xl",
          )}
          style={{
            transform: "rotateY(20deg) rotateX(40deg) rotateZ(-20deg)",
          }}
        />
      </motion.div>

      <motion.div
        initial={{
          opacity: 0,
          y: -100,
        }}
        whileInView={{
          opacity: 1,
          y: 0,
        }}
        viewport={{
          once: true,
        }}
        transition={{
          duration: 0.5,
          ease: "easeOut",
          delay: 0.1,
        }}
        className="translate-x-20 -translate-y-10 perspective-[4000px] md:-translate-y-20 lg:-translate-y-40"
      >
        <img
          src="https://assets.aceternity.com/agenforce-demo-1.jpg"
          alt="Demo 1 for agenforce template"
          height={1080}
          width={1920}
          className={cn(
            "absolute inset-0 -translate-x-10 rounded-lg mask-r-from-50% mask-b-from-50% shadow-xl",
          )}
          style={{
            transform: "rotateY(20deg) rotateX(40deg) rotateZ(-20deg)",
          }}
        />
      </motion.div>
    </div>
  );
};
