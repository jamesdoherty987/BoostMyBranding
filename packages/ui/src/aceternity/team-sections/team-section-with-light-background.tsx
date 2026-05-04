"use client";
import React from "react";
import { cn } from "@/lib/utils";

export function TeamSectionWithLightBackground() {
  const team = [
    {
      title: "Manu Arora",
      designation: "Founder & CEO",
      src: "https://assets.aceternity.com/avatars/manu.webp",
      excerpt:
        "Builder of digital products and founder at Aceternity, Manu focuses on product innovation and cross-disciplinary leadership.",
    },
    {
      title: "John Doe",
      designation: "Co-Founder & CTO",
      src: "https://assets.aceternity.com/avatars/1.webp",
      excerpt:
        "Architects scalable infrastructures and leads our technology vision, with a passion for mentoring the engineering team.",
    },
    {
      title: "Glennfiddich Doe",
      designation: "Software Engineer",
      src: "https://assets.aceternity.com/avatars/2.webp",
      excerpt:
        "Specializes in frontend frameworks and UI systems—Glennfiddich crafts seamless and accessible user interfaces.",
    },
    {
      title: "Jameson Beam",
      designation: "Designer",
      src: "https://assets.aceternity.com/avatars/3.webp",
      excerpt:
        "Designs clear, elegant digital experiences, blending visual storytelling with empathetic user research.",
    },
    {
      title: "Johnny Walker",
      designation: "Marketing Manager",
      src: "https://assets.aceternity.com/avatars/4.webp",
      excerpt:
        "Drives brand growth through creative campaigns and analytics, always seeking meaningful community engagement.",
    },
    {
      title: "Jack Daniels",
      designation: "HR & Management",
      src: "https://assets.aceternity.com/avatars/5.webp",
      excerpt:
        "Fosters company culture and supports team wellbeing, ensuring seamless operations and professional development.",
    },
    {
      title: "Samantha Rives",
      designation: "Product Manager",
      src: "https://assets.aceternity.com/avatars/6.webp",
      excerpt:
        "Bridges vision and execution, keeping projects on track and fostering collaboration across all disciplines.",
    },
    {
      title: "Evelyn Martinez",
      designation: "QA Lead",
      src: "https://assets.aceternity.com/avatars/7.webp",
      excerpt:
        "Ensures every release meets rigorous quality standards, blending keen attention to detail with a love for process improvement.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-20 lg:py-32">
      <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance text-neutral-900 md:text-4xl dark:text-white">
        A team who is not afraid to take risks and bet on themselves.
      </h2>
      <p className="mt-4 max-w-3xl text-lg text-neutral-600 dark:text-neutral-400">
        Meet the creators, strategists, and makers who move our mission forward,
        combining design, code, and vision to achieve remarkable results.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:mt-12 md:grid-cols-2 md:gap-12 lg:grid-cols-4">
        {team.map((member) => (
          <div
            key={member.title + "first-team-section"}
            className="overflow-hidden rounded-3xl bg-gray-100 p-1 dark:bg-neutral-900"
          >
            <img
              src={member.src}
              alt={member.title}
              height={1020}
              width={1024}
              className="aspect-square rounded-2xl object-cover shadow-sm ring-1 shadow-black/20 ring-black/20 duration-200 will-change-transform group-hover/team:scale-105"
            />
            <div className="p-2 md:p-4">
              <p className="mt-2 text-base font-semibold tracking-tight text-balance text-neutral-900 dark:text-white">
                {member.title}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {member.designation}
              </p>
              <Separator className="my-2" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {member.excerpt}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Separator({ className }: { className?: string }) {
  return (
    <svg
      className={cn(
        "h-3 w-full shrink-0 overflow-visible text-neutral-300 dark:text-neutral-700",
        className,
      )}
      viewBox="0 0 100 1"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1="0"
        y1="0.5"
        x2="100"
        y2="0.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="0.2 10"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
