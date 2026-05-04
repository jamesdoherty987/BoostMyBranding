"use client";
import React from "react";
import { cn } from "@/lib/utils";

export function TeamSectionWithSmallAvatars() {
  const team = [
    {
      title: "Manu Arora",
      designation: "Founder & CEO",
      src: "https://assets.aceternity.com/avatars/manu.webp",
    },
    {
      title: "John Doe",
      designation: "Co-Founder & CTO",
      src: "https://assets.aceternity.com/avatars/1.webp",
    },
    {
      title: "Glennfiddich Doe",
      designation: "Software Engineer",
      src: "https://assets.aceternity.com/avatars/2.webp",
    },
    {
      title: "Jameson Beam",
      designation: "Designer",
      src: "https://assets.aceternity.com/avatars/3.webp",
    },
    {
      title: "Johnny Walker",
      designation: "Marketing Manager",
      src: "https://assets.aceternity.com/avatars/4.webp",
    },
    {
      title: "Jack Daniels",
      designation: "HR & Management",
      src: "https://assets.aceternity.com/avatars/5.webp",
    },
    {
      title: "Samantha Rives",
      designation: "Product Manager",
      src: "https://assets.aceternity.com/avatars/6.webp",
    },
    {
      title: "Evelyn Martinez",
      designation: "QA Lead",
      src: "https://assets.aceternity.com/avatars/7.webp",
    },
    {
      title: "Priya Patel",
      designation: "Lead UX Researcher",
      src: "https://assets.aceternity.com/avatars/8.webp",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-20 lg:py-32">
      <h2 className="mx-auto max-w-2xl text-center text-3xl font-semibold tracking-tight text-balance text-neutral-900 md:text-4xl dark:text-white">
        The team building the future
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-center text-lg text-neutral-600 dark:text-neutral-400">
        We are a team of builders, focused on building for the world, one step
        at a time. We are not afraid to take risks and bet on ourselves.
      </p>
      <div className="my-4 flex flex-col items-center justify-center gap-4 md:flex-row">
        <button className="cursor-pointer rounded-md bg-linear-to-b from-blue-400 to-blue-600 px-4 py-2 text-white ring-1 ring-white/50 ring-offset-2 ring-offset-blue-400 ring-inset text-shadow-black/20 text-shadow-md">
          We are hiring
        </button>
        <button className="cursor-pointer rounded-md bg-linear-to-b px-4 py-2 text-neutral-600 text-shadow-black/5 dark:text-neutral-400">
          Our culture &rarr;
        </button>
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 md:gap-12 xl:max-w-7xl xl:grid-cols-3">
        {team.map((member) => (
          <div
            key={member.title + "first-team-section"}
            className="flex items-center gap-2 overflow-hidden rounded-3xl p-1"
          >
            <img
              src={member.src}
              alt={member.title}
              height={1020}
              width={1024}
              className="aspect-square size-8 rounded-md object-cover shadow-sm ring-1 shadow-black/20 ring-black/20 duration-200 will-change-transform group-hover/team:scale-105"
            />

            <p className="text-base font-semibold tracking-tight text-balance text-neutral-900 dark:text-white">
              {member.title}
            </p>
            <div className="size-1 rounded-full bg-neutral-300 dark:bg-neutral-700"></div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {member.designation}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
