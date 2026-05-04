"use client";
import React, { useEffect, useState } from "react";
import { HiArrowRight } from "react-icons/hi2";
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
  animate,
  stagger,
} from "motion/react";

import { BsStarFill } from "react-icons/bs";
import { cn } from "@/lib/utils";

export function TwoColumnWithImage() {
  return (
    <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 overflow-hidden px-4 pt-20 md:gap-20 md:px-8 md:pt-40 lg:grid-cols-2">
      <div className="flex flex-col items-start">
        <h1 className="max-w-5xl bg-gradient-to-b from-neutral-800 via-neutral-600 to-neutral-600 bg-clip-text text-left text-3xl font-bold tracking-tight text-transparent md:text-5xl md:leading-tight dark:from-neutral-800 dark:via-white dark:to-white">
          Make your dashboard 10x more optimized.
        </h1>
        <p className="relative z-10 mt-2 max-w-3xl text-left text-neutral-600 md:mt-6 md:text-xl dark:text-neutral-400">
          With our expert dashboard solutions, you&apos;ll have no trouble
          tracking your leads, campaigns, and more.
        </p>
        <FeaturedImages
          textClassName="lg:text-left text-left"
          className="items-center justify-start lg:justify-start"
          showStars
        />
        <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row sm:justify-start">
          <div className="relative z-10 my-4 flex items-center justify-start gap-4">
            <button className="group flex items-center space-x-2 rounded-2xl bg-gradient-to-b from-indigo-500 to-blue-600 px-4 py-2 text-white shadow-[0px_3px_0px_0px_rgba(255,255,255,0.1)_inset]">
              <span>Book a demo</span>{" "}
              <HiArrowRight className="mt-0.5 h-3 w-3 stroke-[1px] text-white transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          </div>
          <button className="dark:text-300 text-base font-medium text-neutral-700">
            Know more
          </button>
        </div>
      </div>
      <div>
        <div className="rounded-3xl border border-neutral-200 bg-neutral-100 p-4 shadow-[0px_0px_5px_1px_rgba(0,0,0,0.05)_inset] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0px_0px_5px_1px_rgba(255,255,255,0.05)_inset]">
          <img
            src="https://assets.aceternity.com/pro/dashboard.webp"
            alt="Dashboard Image"
            width={1000}
            height={1000}
            className="rounded-2xl"
          />
        </div>
      </div>
    </div>
  );
}

export const testimonials = [
  {
    name: "John Doe",
    designation: "Software Engineer",
    image:
      "https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3387&q=80",
  },
  {
    name: "Robert Johnson",
    designation: "Product Manager",
    image:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXZhdGFyfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60",
  },
  {
    name: "Jane Smith",
    designation: "Data Scientist",
    image:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8YXZhdGFyfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60",
  },
  {
    name: "Emily Davis",
    designation: "UX Designer",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGF2YXRhcnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60",
  },
  {
    name: "Tyler Durden",
    designation: "Soap Developer",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3540&q=80",
  },
  {
    name: "Dora",
    designation: "The Explorer",
    image:
      "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=3534&q=80",
  },
];

export const FeaturedImages = ({
  textClassName,
  className,
  showStars = false,
  containerClassName,
}: {
  textClassName?: string;
  className?: string;
  showStars?: boolean;
  containerClassName?: string;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);
  const translateX = useSpring(
    useTransform(x, [-100, 100], [-50, 50]),
    springConfig,
  );

  const handleMouseMove = (event: any) => {
    const halfWidth = event.target.offsetWidth / 2;
    x.set(event.nativeEvent.offsetX - halfWidth);
  };

  useEffect(() => {
    animate(
      ".animation-container",
      { scale: [1.1, 1, 0.9, 1], opacity: [0, 1] },
      { duration: 0.4, delay: stagger(0.1) },
    );
  }, []);
  return (
    <div
      className={cn(
        "mt-10 mb-10 flex flex-col items-center",
        containerClassName,
      )}
    >
      <div
        className={cn(
          "mb-2 flex flex-col items-center justify-center sm:flex-row",
          className,
        )}
      >
        <div className="mb-4 flex flex-row items-center sm:mb-0">
          {testimonials.map((testimonial, idx) => (
            <div
              className="group relative -mr-4"
              key={testimonial.name}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <AnimatePresence>
                {hoveredIndex === idx && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.6 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        type: "spring",
                        stiffness: 160,
                        damping: 20,
                      },
                    }}
                    exit={{ opacity: 0, y: 20, scale: 0.6 }}
                    style={{ translateX: translateX, whiteSpace: "nowrap" }}
                    className="absolute -top-16 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-xs shadow-xl"
                  >
                    <div className="absolute inset-x-0 -bottom-px z-30 mx-auto h-px w-[20%] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                    <div className="absolute inset-x-0 -bottom-px z-30 mx-auto h-px w-[70%] bg-gradient-to-r from-transparent via-sky-500 to-transparent" />
                    <div className="flex items-center gap-2">
                      <div className="relative z-30 text-sm font-bold text-white">
                        {testimonial.name}
                      </div>
                      <div className="rounded-sm bg-neutral-950 px-1 py-0.5 text-xs text-neutral-300">
                        {testimonial.designation}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="animation-container">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{
                    rotate: `${Math.random() * 15 - 5}deg`,
                    scale: 1,
                    opacity: 1,
                  }}
                  whileHover={{ scale: 1.05, zIndex: 30 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden rounded-2xl border-2 border-neutral-200"
                >
                  <img
                    onMouseMove={handleMouseMove}
                    height={100}
                    width={100}
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-14 w-14 object-cover object-top"
                  />
                </motion.div>
              </div>
            </div>
          ))}
        </div>

        <div className="ml-6 flex justify-center">
          {[...Array(5)].map((_, index) => (
            <BsStarFill
              key={index}
              className={showStars ? "mx-1 h-4 w-4 text-yellow-400" : "hidden"}
            />
          ))}
        </div>
      </div>
      <p
        className={cn(
          "relative z-40 ml-8 text-center text-sm text-neutral-400",
          textClassName,
        )}
      >
        Trusted by 27,000+ creators
      </p>
    </div>
  );
};
