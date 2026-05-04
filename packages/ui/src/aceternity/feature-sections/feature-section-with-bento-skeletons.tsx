"use client";
import React, { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { IconPointerFilled } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export function FeatureSectionBentoSkeletons() {
  const cards = [
    {
      title: "Real time messaging",
      description: "Send and receive messages in real time with text.",
      skeleton: <MessageSkeleton />,
      className: "md:col-span-1 md:row-span-1",
    },
    {
      title: "Secure file sharing",
      description: "Share files securely with end-to-end encryption.",
      skeleton: (
        <FileTransferSkeleton className="mask-r-from-80% mask-l-from-80%" />
      ),
      className: "md:col-span-1 md:row-span-1",
    },
    {
      title: "Team collaboration",
      description: "Collaborate with your team in shared workspaces.",
      skeleton: <TeamCollaborationSkeleton />,
      className: "md:col-span-1 md:row-span-2",
    },
    {
      title: "Loved by developers",
      description: "Trusted by thousands of developers and teams worldwide.",
      skeleton: <TestimonialsIllustration />,
      className: "md:col-span-2 md:row-span-1",
    },
  ];

  return (
    <section className="px-4 py-10 md:px-8 md:py-24 lg:px-16 lg:py-32">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-1 md:grid-cols-3 md:grid-rows-2">
        {cards.map((card) => (
          <Card key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}

const MessageSkeleton = ({ className }: { className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const messages = [
    {
      id: 1,
      name: "Sarah",
      avatar: "https://assets.aceternity.com/avatars/1.webp",
      text: "Hey! Are you free for a quick call?",
      isUser: false,
    },
    {
      id: 2,
      name: "You",
      avatar: "https://assets.aceternity.com/avatars/manu.webp",
      text: "Sure, give me 5 minutes!",
      isUser: true,
    },
    {
      id: 3,
      name: "Tyler",
      avatar: "https://assets.aceternity.com/avatars/8.webp",
      text: "Sounds good 👍",
      isUser: false,
    },
    {
      id: 4,
      name: "Sarah",
      avatar: "https://assets.aceternity.com/avatars/manu.webp",
      text: "I'm not sure if I can make it.",
      isUser: true,
    },
  ];

  return (
    <div
      ref={ref}
      className={cn("flex h-full flex-col justify-center gap-2", className)}
    >
      {messages.map((message, index) => {
        const baseDelay = index * 0.3;
        return (
          <div
            key={message.id}
            className={`flex items-start gap-2 ${message.isUser ? "flex-row-reverse" : ""}`}
          >
            <motion.img
              src={message.avatar}
              alt={message.name}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.3, delay: baseDelay }}
              className="size-5 shrink-0 rounded-full object-cover"
            />
            <motion.div
              initial={{ opacity: 0, x: message.isUser ? 10 : -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.3, delay: baseDelay + 0.15 }}
              className="rounded-lg bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm ring-1 shadow-black/5 ring-black/5 dark:bg-neutral-800 dark:text-neutral-200"
            >
              {message.text}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
};

const FileTransferSkeleton = ({ className }: { className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [isHovered, setIsHovered] = useState(false);

  const files = [
    "https://assets.aceternity.com/avatars/1.webp",
    "https://assets.aceternity.com/avatars/manu.webp",
    "https://assets.aceternity.com/avatars/8.webp",
  ];

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-full items-center justify-center",
        className,
      )}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="relative h-px w-full">
            <div className="absolute inset-0 border-t border-dashed border-neutral-200 dark:border-neutral-700" />
            <motion.div
              className="absolute top-0 h-px w-12 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
              initial={{ x: "-100%", opacity: 0 }}
              animate={
                isInView
                  ? {
                      x: ["0%", "800%"],
                      opacity: [0, 1, 1, 0],
                    }
                  : {}
              }
              transition={{
                duration: 2,
                delay: i * 0.3,
                repeat: Infinity,
                repeatDelay: 1,
                ease: "linear",
              }}
            />
          </div>
        ))}
      </div>

      <div className="relative z-10 flex items-end gap-12">
        <motion.div
          className="relative cursor-pointer"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.2 }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{ perspective: "1000px" }}
        >
          <div
            className="relative"
            style={{ width: 72, height: 54, transformStyle: "preserve-3d" }}
          >
            <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 shadow-sm dark:from-amber-500 dark:to-amber-600">
              <div
                className="absolute left-1.5 rounded-t-sm bg-gradient-to-b from-amber-300 to-amber-400 dark:from-amber-400 dark:to-amber-500"
                style={{ top: -8, width: 26, height: 10 }}
              />
            </div>

            {files.map((image, index) => {
              const hoverY = -55 - (2 - index) * 5;
              const hoverX = (index - 1) * 32;
              const hoverRotation = (index - 1) * 12;
              const teaseY = -6 - (2 - index) * 2;
              const teaseRotation = (index - 1) * 3;

              return (
                <motion.div
                  key={index}
                  className="absolute top-1.5 left-1/2 origin-bottom overflow-hidden rounded bg-white shadow-sm ring-1 shadow-black/10 ring-black/10 dark:bg-neutral-800"
                  animate={{
                    x: `calc(-50% + ${isHovered ? hoverX : 0}px)`,
                    y: isHovered ? hoverY : teaseY,
                    rotate: isHovered ? hoverRotation : teaseRotation,
                    width: isHovered ? 56 : 36,
                    height: isHovered ? 40 : 24,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                    delay: index * 0.03,
                  }}
                  style={{ zIndex: 10 + index }}
                >
                  <img
                    src={image}
                    alt={`File ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </motion.div>
              );
            })}

            <motion.div
              className="absolute inset-x-0 bottom-0 h-[85%] origin-bottom rounded-lg bg-gradient-to-b from-amber-300 to-amber-400 shadow-sm dark:from-amber-400 dark:to-amber-500"
              animate={{
                rotateX: isHovered ? -45 : -25,
                scaleY: isHovered ? 0.8 : 1,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              style={{ transformStyle: "preserve-3d", zIndex: 20 }}
            >
              <div className="absolute top-2 right-2 left-2 h-px bg-amber-200/50 dark:bg-amber-300/50" />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div
            className="relative rounded-lg bg-gradient-to-b from-gray-50 to-gray-50 shadow-sm dark:from-neutral-700 dark:to-neutral-800"
            style={{ width: 56, height: 72 }}
          >
            <div className="absolute inset-x-1.5 top-1.5 h-3 rounded-sm bg-white shadow-sm ring-1 shadow-black/5 ring-black/5 dark:bg-neutral-900">
              <div className="flex h-full items-center justify-center gap-0.5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 w-px bg-neutral-600 dark:bg-neutral-700"
                  />
                ))}
              </div>
            </div>

            <div className="absolute right-1.5 bottom-1.5 left-1.5 flex flex-col gap-1">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-4 rounded-sm bg-white shadow-sm ring-1 shadow-black/5 ring-black/5 dark:bg-neutral-800 dark:ring-white/10"
                >
                  <div className="mt-1 ml-1 h-0.5 w-3 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const TeamCollaborationSkeleton = ({ className }: { className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const collaborators = [
    {
      id: 1,
      name: "Sarah",
      avatar: "https://assets.aceternity.com/avatars/1.webp",
      color: "#3b82f6",
      path: [
        { x: 20, y: 15 },
        { x: 85, y: 45 },
        { x: 45, y: 85 },
        { x: 20, y: 15 },
      ],
    },
    {
      id: 2,
      name: "Tyler",
      avatar: "https://assets.aceternity.com/avatars/8.webp",
      color: "#10b981",
      path: [
        { x: 120, y: 75 },
        { x: 60, y: 25 },
        { x: 100, y: 55 },
        { x: 120, y: 75 },
      ],
    },
  ];

  const codeLines = [
    { indent: 0, width: "60%", color: "bg-purple-400/60 dark:bg-purple-500/50" },
    { indent: 1, width: "75%", color: "bg-neutral-300 dark:bg-neutral-600" },
    { indent: 1, width: "50%", color: "bg-blue-400/60 dark:bg-blue-500/50" },
    { indent: 2, width: "80%", color: "bg-neutral-300 dark:bg-neutral-600" },
    { indent: 2, width: "45%", color: "bg-emerald-400/60 dark:bg-emerald-500/50" },
    { indent: 2, width: "65%", color: "bg-neutral-300 dark:bg-neutral-600" },
    { indent: 1, width: "30%", color: "bg-neutral-300 dark:bg-neutral-600" },
    { indent: 0, width: "20%", color: "bg-purple-400/60 dark:bg-purple-500/50" },
    { indent: 0, width: "0%", color: "bg-transparent" },
    { indent: 0, width: "55%", color: "bg-amber-400/60 dark:bg-amber-500/50" },
    { indent: 1, width: "70%", color: "bg-neutral-300 dark:bg-neutral-600" },
    { indent: 1, width: "40%", color: "bg-blue-400/60 dark:bg-blue-500/50" },
    { indent: 2, width: "85%", color: "bg-neutral-300 dark:bg-neutral-600" },
    { indent: 1, width: "25%", color: "bg-neutral-300 dark:bg-neutral-600" },
    { indent: 0, width: "15%", color: "bg-amber-400/60 dark:bg-amber-500/50" },
  ];

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-full items-center justify-center overflow-visible",
        className,
      )}
    >
      <motion.div
        className="relative w-full max-w-[200px] rounded-lg bg-white p-3 shadow-sm ring-1 shadow-black/10 ring-black/10 dark:bg-neutral-900 dark:ring-white/10"
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-3 flex items-center gap-1.5">
          <div className="flex gap-1">
            <div className="size-2 rounded-full bg-red-400" />
            <div className="size-2 rounded-full bg-yellow-400" />
            <div className="size-2 rounded-full bg-green-400" />
          </div>
          <div className="ml-2 flex gap-1">
            <div className="h-2 w-10 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-2 w-8 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex flex-col items-end gap-1.5 pr-1 text-[8px] text-neutral-400 dark:text-neutral-600">
            {codeLines.map((_, index) => (
              <span key={index} className="leading-none">
                {index + 1}
              </span>
            ))}
          </div>
          <div className="flex-1">
            {codeLines.map((line, index) => (
              <div
                key={index}
                className="my-1 flex items-center"
                style={{ paddingLeft: line.indent * 8 }}
              >
                <div
                  className={`h-1.5 rounded-full ${line.color}`}
                  style={{ width: line.width }}
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {collaborators.map((collaborator, index) => (
        <motion.div
          key={collaborator.id}
          className="absolute"
          initial={{ opacity: 0 }}
          animate={
            isInView
              ? {
                  opacity: 1,
                  x: collaborator.path.map((p) => p.x),
                  y: collaborator.path.map((p) => p.y),
                }
              : {}
          }
          transition={{
            opacity: { duration: 0.3, delay: 0.5 + index * 0.2 },
            x: {
              duration: 6,
              delay: 0.5 + index * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            },
            y: {
              duration: 6,
              delay: 0.5 + index * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        >
          <IconPointerFilled
            className="size-5 drop-shadow-sm"
            style={{ color: collaborator.color }}
          />
          <div
            className="absolute top-5 left-3 z-50 flex w-max items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 shadow-sm"
            style={{ backgroundColor: collaborator.color }}
          >
            <img
              src={collaborator.avatar}
              alt={collaborator.name}
              className="size-5 shrink-0 rounded-full object-cover ring-1 ring-white/30"
            />
            <span className="shrink-0 text-[10px] font-medium text-white">
              {collaborator.name}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const TestimonialsIllustration = ({ className }: { className?: string }) => {
  const testimonials = [
    {
      quote:
        "Aceternity UI is the best UI library I have ever used. It is very easy to use and very customizable.",
      name: "Bill Gates",
      designation: "CEO of Microsoft",
      src: "https://assets.aceternity.com/avatars/1.webp",
    },
    {
      quote:
        "The components are beautifully designed and saved us hundreds of hours of development time.",
      name: "Sarah Chen",
      designation: "CTO at TechFlow",
      src: "https://assets.aceternity.com/avatars/2.webp",
    },
    {
      quote:
        "I've tried many UI libraries, but Aceternity stands out with its attention to detail and smooth animations.",
      name: "Marcus Johnson",
      designation: "Lead Developer at Stripe",
      src: "https://assets.aceternity.com/avatars/3.webp",
    },
    {
      quote:
        "Our team productivity increased by 40% after switching to Aceternity UI. The documentation is excellent.",
      name: "Emily Rodriguez",
      designation: "Product Manager at Vercel",
      src: "https://assets.aceternity.com/avatars/4.webp",
    },
  ];

  const variants = {
    initial: {
      rotate: 0,
      x: 0,
      y: 0,
    },
    animate: {
      rotate: 5,
      x: 20,
      y: 20,
    },
  };

  return (
    <div
      className={cn(
        "relative flex h-full items-center overflow-hidden mask-x-from-90%",
        className,
      )}
    >
      <div className="flex items-stretch gap-3 px-4">
        {testimonials.map((card, index) => (
          <motion.div
            whileHover="animate"
            initial="initial"
            key={card.name}
            className="group relative w-56 shrink-0 rounded-xl"
          >
            <div className="absolute inset-0 h-full w-full rounded-[inherit] bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:5px_5px] bg-fixed shadow-sm ring-1 shadow-black/5 ring-black/5 [--pattern-fg:var(--color-gray-950)]/5 dark:shadow-white/5 dark:ring-white/5 dark:[--pattern-fg:var(--color-white)]/5" />
            <motion.div
              variants={variants}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
              }}
              style={{
                zIndex: 10 - index,
              }}
              className="relative flex h-full flex-col rounded-xl bg-white p-4 shadow-sm ring-1 shadow-black/5 ring-black/5 dark:bg-neutral-900 dark:shadow-white/5 dark:ring-white/10"
            >
              <p className="mb-3 flex-1 text-xs leading-relaxed text-neutral-900 dark:text-neutral-100">
                {card.quote}
              </p>
              <div className="flex items-center gap-2">
                <img
                  src={card.src}
                  alt={card.name}
                  className="size-5 rounded-full object-cover"
                />
                <div>
                  <p className="text-[10px] font-medium text-neutral-900 dark:text-neutral-100">
                    {card.name}
                  </p>
                  <p className="text-[8px] text-gray-500 dark:text-gray-400">
                    {card.designation}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const Card = ({
  title,
  description,
  skeleton,
  className,
}: {
  title: string;
  description: string;
  skeleton: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-xl bg-white p-6 shadow-sm shadow-black/5 ring-1 ring-black/5 md:p-8 dark:bg-neutral-950 dark:shadow-white/5 dark:ring-white/5",
        className,
      )}
    >
      <div className="h-48 w-full overflow-visible rounded-md md:h-full md:min-h-48">
        {skeleton}
      </div>
      <div className="mt-4 shrink-0">
        <h3 className="text-base font-bold tracking-tight text-neutral-700 dark:text-neutral-200">
          {title}
        </h3>
        <p className="mt-2 text-sm tracking-tight text-neutral-700 dark:text-neutral-400">
          {description}
        </p>
      </div>
    </div>
  );
};
