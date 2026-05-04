"use client";
import React, { useState, useRef, useEffect } from "react";
import { Easing, motion, useAnimate } from "motion/react";
import Image from "next/image";

interface MacbookIllustrationProps {
  content?: React.ReactNode;
}

export function MacbookIllustration({
  content,
}: MacbookIllustrationProps) {
  const [isHovered, setIsHovered] = useState(false);

  const lidVariants = {
    initial: {
      rotateX: -60,
    },
    animate: {
      rotateX: 20,
    },
  };

  const screenContentVariants = {
    initial: {
      opacity: 0,
      filter: "blur(8px)",
    },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
    },
  };

  const TRANSITION = {
    duration: 0.98,
    ease: [0.901, 0.016, 0, 1.032] as Easing,
  };

  const CONTENT_TRANSITION = {
    duration: 0.3,
    ease: "easeOut" as Easing,
    delay: 0.5,
  };

  return (
    <motion.div
      whileHover="animate"
      initial="initial"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="mx-auto w-full max-w-2xl"
    >
      <div className="mx-auto w-64 perspective-distant">
        {/* lid */}
        <motion.div
          style={{
            transformOrigin: "bottom",
          }}
          variants={lidVariants}
          transition={TRANSITION}
          className="mx-auto h-32 w-[90%] rounded-tl-lg rounded-tr-lg bg-neutral-100 p-1 shadow-sm ring-1 shadow-black/10 ring-black/10 dark:bg-neutral-800 dark:shadow-white/5 dark:ring-white/10"
        >
          <div className="lg relative h-full w-full overflow-hidden rounded-tl rounded-tr-lg rounded-br-sm rounded-bl-sm bg-white dark:bg-neutral-900">
            <motion.div
              variants={screenContentVariants}
              transition={CONTENT_TRANSITION}
              className="absolute inset-0"
            >
              {content ?? <ScreenContent isActive={isHovered} />}
            </motion.div>
          </div>
        </motion.div>
        <div className="relative h-3 w-full rounded-tl-md rounded-tr-md rounded-br-3xl rounded-bl-3xl bg-linear-to-b from-neutral-100 to-neutral-300 shadow-[0px_1px_0px_0px_var(--color-neutral-200)_inset] dark:from-neutral-700 dark:to-neutral-900 dark:shadow-[0px_1px_0px_0px_var(--color-neutral-600)_inset]">
          <div className="absolute inset-x-0 top-0 mx-auto h-1.5 w-10 rounded-br-sm rounded-bl-sm bg-neutral-400 shadow-[0px_-1px_0px_0px_var(--color-neutral-300)_inset] dark:bg-neutral-600 dark:shadow-[0px_-1px_0px_0px_var(--color-neutral-500)_inset]"></div>
        </div>
      </div>
    </motion.div>
  );
}

const ScreenContent: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <>
      <Image
        src="https://assets.aceternity.com/components/parallax-hero-images-2.webp"
        alt="Laptop screen content"
        fill
        className="object-cover"
      />
      <div className="absolute inset-x-0 top-0 z-10">
        <DynamicIslandIllustration isActive={isActive} />
      </div>
    </>
  );
};

interface DynamicIslandIllustrationProps {
  isActive?: boolean;
}

const SPRING_OPTIONS = {
  type: "spring" as const,
  stiffness: 591.79,
  damping: 48.82,
  mass: 2.89,
};

function DynamicIslandIllustration({
  isActive = false,
}: DynamicIslandIllustrationProps) {
  const [scope, animate] = useAnimate();
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      hasAnimatedRef.current = false;
      animate(
        scope.current,
        { width: 36, height: 12, borderRadius: 6 },
        SPRING_OPTIONS,
      );
      animate("#idle-content", { opacity: 1 }, { duration: 0.15 });
      animate("#loading-content", { opacity: 0 }, { duration: 0.1 });
      animate("#connected-content", { opacity: 0 }, { duration: 0.1 });
      return;
    }

    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    const runSequence = async () => {
      await animate("#idle-content", { opacity: 0 }, { duration: 0.1 });

      animate(
        scope.current,
        { width: 20, height: 12, borderRadius: 6 },
        SPRING_OPTIONS,
      );
      await animate("#loading-content", { opacity: 1 }, { duration: 0.15 });

      await new Promise((resolve) => setTimeout(resolve, 1200));

      await animate("#loading-content", { opacity: 0 }, { duration: 0.1 });

      animate(
        scope.current,
        { width: 50, height: 12, borderRadius: 8 },
        SPRING_OPTIONS,
      );
      await animate(
        "#connected-content",
        { opacity: 1 },
        { duration: 0.15, delay: 0.1 },
      );
    };

    runSequence();
  }, [isActive, animate, scope]);

  return (
    <div className="flex h-full w-full items-start justify-center pt-2">
      <div
        ref={scope}
        className="relative overflow-hidden bg-black"
        style={{ width: 20, height: 12, borderRadius: 6 }}
      >
        <div
          id="idle-content"
          className="absolute inset-0 flex items-center justify-center"
          style={{ opacity: 1 }}
        >
          <div className="flex items-center gap-1">
            <div className="h-1 w-1 rounded-full bg-neutral-800" />
            <div className="h-0.5 w-0.5 rounded-full bg-neutral-700" />
          </div>
        </div>

        <div
          id="loading-content"
          className="absolute inset-0 flex items-center justify-center"
          style={{ opacity: 0 }}
        >
          <div className="flex items-center gap-px">
            <LoadingDot delay={0} />
            <LoadingDot delay={0.15} />
            <LoadingDot delay={0.3} />
          </div>
        </div>

        <div
          id="connected-content"
          className="absolute inset-0 flex items-center justify-center"
          style={{ opacity: 0 }}
        >
          <div className="flex items-center gap-1">
            <span className="text-[4px] leading-none font-medium whitespace-nowrap text-white">
              AirPods Pro
            </span>
            <div className="flex items-center gap-px">
              <div className="flex h-1 w-2 items-center rounded-xs border border-green-500">
                <div className="h-full w-[85%] bg-green-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingDot({ delay }: { delay: number }) {
  const [scope, animate] = useAnimate();

  useEffect(() => {
    const pulse = async () => {
      while (true) {
        await animate(scope.current, { opacity: 1 }, { duration: 0.4 });
        await animate(scope.current, { opacity: 0.3 }, { duration: 0.4 });
      }
    };

    const timeout = setTimeout(pulse, delay * 1000);
    return () => clearTimeout(timeout);
  }, [animate, scope, delay]);

  return (
    <div
      ref={scope}
      className="h-0.5 w-0.5 rounded-full bg-white"
      style={{ opacity: 0.3 }}
    />
  );
}
