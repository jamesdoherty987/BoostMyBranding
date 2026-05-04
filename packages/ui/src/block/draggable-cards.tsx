"use client";

import { cn } from "@/lib/utils";
import {
  animate,
  motion,
  PanInfo,
  useMotionValue,
  useTransform,
} from "motion/react";
import Image from "next/image";
import React, { useCallback, useState } from "react";

export type DraggableCardItem = {
  id: string | number;
  image: string;
  name: string;
  title: string;
  lookingFor: string;
};

export type SwipeDirection = "left" | "right";

type DraggableCardsProps = {
  cards?: DraggableCardItem[];
  onSwipe?: (card: DraggableCardItem, direction: SwipeDirection) => void;
  className?: string;
};

const DEFAULT_CARDS: DraggableCardItem[] = [
  {
    id: 1,
    name: "Ava Chen",
    title: "Frontend Developer",
    lookingFor: "Looking for a front-end role",
    image: "https://assets.aceternity.com/avatars/1.webp",
  },
  {
    id: 2,
    name: "Liam Patel",
    title: "Product Designer",
    lookingFor: "Looking for a senior design role",
    image: "https://assets.aceternity.com/avatars/6.webp",
  },
  {
    id: 3,
    name: "Mia Tanaka",
    title: "Full-stack Engineer",
    lookingFor: "Looking for a full-stack role",
    image: "https://assets.aceternity.com/avatars/5.webp",
  },
  {
    id: 4,
    name: "Noah Weber",
    title: "Engineering Manager",
    lookingFor: "Looking for an EM role",
    image: "https://assets.aceternity.com/avatars/4.webp",
  },
  {
    id: 5,
    name: "Zoe Almeida",
    title: "Backend Engineer",
    lookingFor: "Looking for a backend role",
    image: "https://assets.aceternity.com/avatars/5.webp",
  },
  {
    id: 6,
    name: "Ethan Singh",
    title: "DevOps Engineer",
    lookingFor: "Looking for remote DevOps opportunities",
    image: "https://assets.aceternity.com/avatars/16.webp",
  },
  {
    id: 7,
    name: "Sophia Lee",
    title: "UI/UX Designer",
    lookingFor: "Looking for innovative design projects",
    image: "https://assets.aceternity.com/avatars/17.webp",
  },
  {
    id: 8,
    name: "Jackson Kim",
    title: "Mobile Developer",
    lookingFor: "Looking for a React Native role",
    image: "https://assets.aceternity.com/avatars/18.webp",
  },
];

const STACK_SIZE = 3;
const SWIPE_THRESHOLD = 110;
const SWIPE_VELOCITY = 500;
const FLING_MIN_VELOCITY = 1600;

const SWIPE_SPRING = {
  type: "spring" as const,
  stiffness: 120,
  damping: 16,
  mass: 1,
};

const SNAP_BACK = {
  type: "spring" as const,
  stiffness: 400,
  damping: 32,
};

const STACK_SPRING = {
  type: "spring" as const,
  stiffness: 260,
  damping: 26,
  mass: 0.7,
};

export default function DraggableCards({
  cards = DEFAULT_CARDS,
  onSwipe,
  className,
}: DraggableCardsProps) {
  const [order, setOrder] = useState<(string | number)[]>(() =>
    cards.map((c) => c.id),
  );

  const swipe = useCallback(
    (card: DraggableCardItem, direction: SwipeDirection) => {
      setOrder((prev) => [...prev.filter((id) => id !== card.id), card.id]);
      onSwipe?.(card, direction);
    },
    [onSwipe],
  );

  return (
    <div
      className={cn(
        "relative mx-auto my-10 h-[460px] w-full max-w-sm md:my-20",
        className,
      )}
    >
      {cards.map((card) => {
        const position = order.indexOf(card.id);
        return (
          <Card key={card.id} card={card} position={position} onSwipe={swipe} />
        );
      })}
    </div>
  );
}

type CardProps = {
  card: DraggableCardItem;
  position: number;
  onSwipe: (card: DraggableCardItem, direction: SwipeDirection) => void;
};

const Card = ({ card, position, onSwipe }: CardProps) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);

  const isTop = position === 0;
  const visualPosition = Math.min(position, STACK_SIZE - 1);

  const handleDragEnd = (_: PointerEvent, info: PanInfo) => {
    const passedDistance = Math.abs(info.offset.x) > SWIPE_THRESHOLD;
    const passedVelocity = Math.abs(info.velocity.x) > SWIPE_VELOCITY;

    if (!(passedDistance || passedVelocity)) {
      animate(x, 0, { ...SNAP_BACK, velocity: info.velocity.x });
      return;
    }

    const direction: SwipeDirection = info.offset.x > 0 ? "right" : "left";
    const sign = direction === "right" ? 1 : -1;
    const fling =
      sign * Math.max(Math.abs(info.velocity.x), FLING_MIN_VELOCITY);

    let swapped = false;
    let last = x.get();

    animate(x, 0, {
      ...SWIPE_SPRING,
      velocity: fling,
      onUpdate: (latest) => {
        if (!swapped && Math.abs(latest) > 20 && (latest - last) * sign <= 0) {
          swapped = true;
          onSwipe(card, direction);
        }
        last = latest;
      },
    });
  };

  return (
    <motion.div
      className={cn(
        "absolute inset-0 touch-none overflow-hidden rounded-3xl bg-neutral-100 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5 select-none dark:bg-neutral-900 dark:ring-white/5",
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
      )}
      style={{
        x,
        rotate,
        zIndex: 100 - position,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.4}
      dragMomentum={true}
      onDragEnd={handleDragEnd}
      initial={{
        scale: 1 - visualPosition * 0.05,
        y: visualPosition * 14,
      }}
      animate={{
        scale: 1 - visualPosition * 0.05,
        y: visualPosition * 14,
      }}
      transition={STACK_SPRING}
    >
      <div className="relative h-full w-full">
        <Image
          src={card.image}
          alt={card.name}
          fill
          sizes="(max-width: 640px) 100vw, 384px"
          className="pointer-events-none object-cover"
          draggable={false}
          unoptimized
          priority={isTop}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/80 via-black/30 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h3 className="text-2xl font-semibold drop-shadow-sm">{card.name}</h3>
          <p className="mt-0.5 text-sm text-white/85">{card.title}</p>
          <p className="mt-3 text-sm leading-snug text-white/90">
            {card.lookingFor}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
