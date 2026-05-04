"use client";
import React, { memo, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { IconRocket } from "@tabler/icons-react";

const features = [
  {
    icon: <IconRocket className="h-8 w-8 text-neutral-200" />,
    title: "Generate ultra realistic images in seconds",
    description:
      "With our state of the art AI, you can generate ultra realistic images in no time at all.",
    content: (
      <div>
        <img
          src="https://assets.aceternity.com/pro/car-1.jpg"
          alt="car"
          height="500"
          width="500"
          className="rounded-lg"
        />
      </div>
    ),
  },
  {
    icon: <IconRocket className="h-8 w-8 text-neutral-200" />,
    title: "Replicate great Art",
    description:
      "Generate the painting of renowned artists, like Van Gogh or Monet or Majnu bhai.",
    content: (
      <img
        src="https://assets.aceternity.com/pro/art.jpeg"
        alt="car"
        height="500"
        width="500"
        className="rounded-lg"
      />
    ),
  },
  {
    icon: <IconRocket className="h-8 w-8 text-neutral-200" />,
    title: "Batch generate images with a single click.",
    description:
      "With our state of the art AI, you can generate a batch of images within 10 seconds with absolutely no compute power.",
    content: (
      <div className="relative">
        <div className="-rotate-[10deg]">
          <img
            src="https://assets.aceternity.com/pro/car-1.jpg"
            alt="car"
            height="500"
            width="500"
            className="rounded-lg"
          />
        </div>
        <div className="absolute inset-0 rotate-[10deg] transform">
          <img
            src="https://assets.aceternity.com/pro/car-2.jpg"
            alt="car"
            height="500"
            width="500"
            className="rounded-lg"
          />
        </div>
      </div>
    ),
  },
];

export function FeaturesWithStickyScroll() {
  return (
    <div className="relative mx-auto h-full w-full max-w-7xl bg-neutral-900 pt-20 md:pt-40">
      <div className="flex flex-col items-center px-6 text-center">
        <h2 className="mt-4 text-lg font-bold text-white md:text-2xl lg:text-4xl">
          AI Smarter than Aliens
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-white md:text-base">
          Our AI is smarter than aliens, it can predict the future and help you
          generate wild images.
        </p>
      </div>
      <StickyScroll content={features} />
    </div>
  );
}

export const StickyScroll = memo(function StickyScroll({
  content,
}: {
  content: { title: string; description: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="py-4 md:py-20">
      <div className="relative mx-auto hidden h-full max-w-7xl flex-col justify-between p-10 lg:flex">
        {content.map((item, index) => (
          <ScrollContent key={item.title + index} item={item} index={index} />
        ))}
      </div>
      <div className="relative mx-auto flex max-w-7xl flex-col justify-between p-10 lg:hidden">
        {content.map((item, index) => (
          <ScrollContentMobile
            key={item.title + index}
            item={item}
            index={index}
          />
        ))}
      </div>
    </div>
  );
});

export const ScrollContent = memo(function ScrollContent({
  item,
  index,
}: {
  item: {
    title: string;
    description: string;
    icon?: React.ReactNode;
    content?: React.ReactNode;
  };
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const translate = useTransform(scrollYProgress, [0, 1], [0, 250]);
  const translateContent = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.05, 0.5, 0.7, 1],
    [0, 1, 1, 0, 0],
  );

  const opacityContent = useTransform(
    scrollYProgress,
    [0, 0.2, 0.5, 0.8, 1],
    [0, 0, 1, 1, 0],
  );

  return (
    <div ref={ref} className="relative my-40 grid grid-cols-2 gap-8">
      <div className="w-full">
        <motion.div
          style={{ y: translate, opacity: index === 0 ? opacityContent : 1 }}
        >
          <div>{item.icon}</div>
          <h2 className="mt-2 inline-block max-w-md bg-linear-to-b from-white to-white bg-clip-text text-left text-2xl font-bold text-transparent lg:text-4xl">
            {item.title}
          </h2>
          <p className="mt-2 max-w-sm text-lg text-neutral-500">
            {item.description}
          </p>
        </motion.div>
      </div>
      <motion.div
        style={{ y: translateContent, opacity }}
        className="h-full w-full self-start rounded-md"
      >
        {item.content}
      </motion.div>
    </div>
  );
});

export const ScrollContentMobile = memo(function ScrollContentMobile({
  item,
}: {
  item: {
    title: string;
    description: string;
    icon?: React.ReactNode;
    content?: React.ReactNode;
  };
  index: number;
}) {
  return (
    <div className="relative my-10 flex flex-col md:flex-row md:gap-20">
      <div className="mb-8 w-full self-start rounded-md">{item.content}</div>
      <div className="w-full">
        <div className="mb-6">
          <div>{item.icon}</div>
          <h2 className="mt-2 inline-block bg-linear-to-b from-white to-white bg-clip-text text-left text-2xl font-bold text-transparent lg:text-4xl">
            {item.title}
          </h2>
          <p className="mt-2 max-w-sm text-sm font-bold text-neutral-500 md:text-base">
            {item.description}
          </p>
        </div>
      </div>
    </div>
  );
});
