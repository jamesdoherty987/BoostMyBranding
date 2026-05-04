"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function TestimonialsBackgroundWithDrag() {
  return (
    <TestimonialsCanvas>
      <div className="flex h-full items-center justify-center">
        <div className="max-w-2xl px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl font-medium tracking-tight text-neutral-800 md:text-6xl dark:text-neutral-100"
          >
            Loved by thousands <br /> of happy customers
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mx-auto mt-4 max-w-md text-base text-neutral-500 md:text-lg dark:text-neutral-400"
          >
            Hear from our community of builders, designers, and creators who
            trust us to power their projects.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-neutral-900 shadow-md ring-1 ring-black/5 transition-all hover:shadow-lg active:scale-[0.98] dark:bg-neutral-800 dark:text-white dark:ring-white/10"
          >
            Read all reviews
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="size-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </motion.button>
        </div>
      </div>
    </TestimonialsCanvas>
  );
}

// Default testimonials data
const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    title: "Best investment for our startup",
    quote:
      "We shipped our landing page in two days instead of two weeks. The components are polished and the code quality is excellent.",
    imageSrc: "https://assets.aceternity.com/avatars/manu.webp",
    name: "Sarah Chen",
  },
  {
    title: "Exceeded all expectations",
    quote:
      "The attention to detail is remarkable. Every animation, every transition — it all feels premium without any extra effort.",
    imageSrc: "https://assets.aceternity.com/avatars/1.webp",
    name: "Marcus Johnson",
  },
  {
    title: "Game changer for our team",
    quote:
      "Our design team used to spend weeks on UI. Now we prototype in hours and ship pixel-perfect interfaces effortlessly.",
    imageSrc: "https://assets.aceternity.com/avatars/2.webp",
    name: "Emily Rodriguez",
  },
  {
    title: "Worth every penny",
    quote:
      "The templates saved us months of development time. Our clients can't believe how fast we deliver beautiful websites.",
    imageSrc: "https://assets.aceternity.com/avatars/3.webp",
    name: "David Park",
  },
  {
    title: "Our secret weapon",
    quote:
      "Aceternity UI is the competitive edge we didn't know we needed. The quality is on par with top-tier design agencies.",
    imageSrc: "https://assets.aceternity.com/avatars/4.webp",
    name: "Lisa Thompson",
  },
  {
    title: "Incredible developer experience",
    quote:
      "Copy, paste, customize. It's that simple. The documentation is clear and the components just work out of the box.",
    imageSrc: "https://assets.aceternity.com/avatars/5.webp",
    name: "James Wilson",
  },
  {
    title: "Saved us $50k in design costs",
    quote:
      "We were about to hire a design agency. Instead, we used these components and achieved even better results at a fraction of the cost.",
    imageSrc: "https://assets.aceternity.com/avatars/6.webp",
    name: "Priya Patel",
  },
  {
    title: "The animations are butter smooth",
    quote:
      "I've never seen such smooth animations in a component library. The motion design alone is worth the investment.",
    imageSrc: "https://assets.aceternity.com/avatars/7.webp",
    name: "Alex Turner",
  },
  {
    title: "Perfect for rapid prototyping",
    quote:
      "We went from concept to production in record time. The flexibility of each component makes customization a breeze.",
    imageSrc: "https://assets.aceternity.com/avatars/8.webp",
    name: "Nina Kowalski",
  },
  {
    title: "Clients love the results",
    quote:
      "Every project we deliver now gets compliments on the UI. It has genuinely elevated the perceived value of our work.",
    imageSrc: "https://assets.aceternity.com/avatars/9.webp",
    name: "Robert Kim",
  },
  {
    title: "Best in class components",
    quote:
      "After trying every UI library out there, this is the one that stuck. The quality and consistency are unmatched.",
    imageSrc: "https://assets.aceternity.com/avatars/10.webp",
    name: "Olivia Martinez",
  },
  {
    title: "A designer's dream toolkit",
    quote:
      "As a designer who codes, these components speak my language. Beautiful defaults with enough flexibility to make them truly mine.",
    imageSrc: "https://assets.aceternity.com/avatars/11.webp",
    name: "Chris Anderson",
  },
  {
    title: "Supercharged our workflow",
    quote:
      "We integrated these components into our design system and now ship features twice as fast with better visual consistency.",
    imageSrc: "https://assets.aceternity.com/avatars/12.webp",
    name: "Aisha Mohammed",
  },
  {
    title: "The dark mode is chef's kiss",
    quote:
      "Finally a library that gets dark mode right. The color palette transitions are seamless and the contrast ratios are perfect.",
    imageSrc: "https://assets.aceternity.com/avatars/13.webp",
    name: "Tom Bradley",
  },
  {
    title: "Highly recommend to every dev",
    quote:
      "If you're building modern web apps and want them to look incredible without spending weeks on design, this is it.",
    imageSrc: "https://assets.aceternity.com/avatars/14.webp",
    name: "Maya Singh",
  },
  {
    title: "Our go-to component library",
    quote:
      "We've standardized on Aceternity UI across all our projects. The consistency and quality have transformed our output.",
    imageSrc: "https://assets.aceternity.com/avatars/15.webp",
    name: "Daniel Lee",
  },
];

interface Testimonial {
  title: string;
  quote: string;
  imageSrc: string;
  name: string;
}

interface TestimonialCardItem {
  id: string;
  testimonial: Testimonial;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// Seeded random number generator for consistent tile generation
function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Check if two rectangles overlap (with padding)
function rectanglesOverlap(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number,
  padding: number = 20,
): boolean {
  return !(
    x1 + w1 + padding < x2 ||
    x2 + w2 + padding < x1 ||
    y1 + h1 + padding < y2 ||
    y2 + h2 + padding < y1
  );
}

// Check if a card overlaps with the center exclusion zone (in world coordinates)
function isInWorldCenterZone(
  absoluteX: number,
  absoluteY: number,
  width: number,
  height: number,
  exclusionWidth: number,
  exclusionHeight: number,
): boolean {
  const zoneLeft = -exclusionWidth / 2;
  const zoneRight = exclusionWidth / 2;
  const zoneTop = -exclusionHeight / 2;
  const zoneBottom = exclusionHeight / 2;

  const cardRight = absoluteX + width;
  const cardBottom = absoluteY + height;

  return !(
    cardRight < zoneLeft ||
    absoluteX > zoneRight ||
    cardBottom < zoneTop ||
    absoluteY > zoneBottom
  );
}

// Generate testimonial cards for a tile based on its position
function generateTileCards(
  tileX: number,
  tileY: number,
  tileSize: number,
  testimonials: Testimonial[],
  cardCount: number = 4,
  exclusionWidth: number = 700,
  exclusionHeight: number = 600,
  randomRotate: boolean = false,
): TestimonialCardItem[] {
  const seed = tileX * 10000 + tileY;
  const random = seededRandom(seed);

  const cards: TestimonialCardItem[] = [];
  const maxAttempts = 100;

  // Minimum gap between cards for even spacing
  const minGap = 80;

  for (let i = 0; i < cardCount; i++) {
    const testimonialIndex =
      Math.abs(tileX * cardCount + tileY + i) % testimonials.length;

    // Testimonial cards - wider rectangular shape
    const baseWidth = 380 + random() * 60;
    const height = 200 + random() * 30;

    let x = 0;
    let y = 0;
    let attempts = 0;
    let validPosition = false;

    while (attempts < maxAttempts && !validPosition) {
      x = random() * (tileSize - baseWidth - 80) + 40;
      y = random() * (tileSize - height - 80) + 40;

      const absoluteX = tileX * tileSize + x;
      const absoluteY = tileY * tileSize + y;

      if (
        isInWorldCenterZone(
          absoluteX,
          absoluteY,
          baseWidth,
          height,
          exclusionWidth,
          exclusionHeight,
        )
      ) {
        attempts++;
        continue;
      }

      validPosition = true;
      for (const existingCard of cards) {
        if (
          rectanglesOverlap(
            x,
            y,
            baseWidth,
            height,
            existingCard.x,
            existingCard.y,
            existingCard.width,
            existingCard.height,
            minGap,
          )
        ) {
          validPosition = false;
          break;
        }
      }

      attempts++;
    }

    if (validPosition) {
      const rotation = randomRotate ? random() * 16 - 8 : 0;

      cards.push({
        id: `${tileX}-${tileY}-${i}`,
        testimonial: testimonials[testimonialIndex],
        x,
        y,
        width: baseWidth,
        height,
        rotation,
      });
    }
  }

  return cards;
}

// Easing function for smooth animation
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface FocusPosition {
  x: number;
  y: number;
  cardWidth: number;
  cardHeight: number;
  cardId: string;
}

// Generate fixed focus positions for auto-pan (deterministic based on seed)
function generateFocusPositions(
  count: number,
  tileSize: number,
  testimonials: Testimonial[],
  cardsPerTile: number,
  exclusionWidth: number,
  exclusionHeight: number,
): FocusPosition[] {
  const positions: FocusPosition[] = [];

  // Generate positions from tiles around the origin
  const tileRange = 3;
  for (let tx = -tileRange; tx <= tileRange && positions.length < count; tx++) {
    for (
      let ty = -tileRange;
      ty <= tileRange && positions.length < count;
      ty++
    ) {
      // Skip the center tile (exclusion zone)
      if (tx === 0 && ty === 0) continue;

      const cards = generateTileCards(
        tx,
        ty,
        tileSize,
        testimonials,
        cardsPerTile,
        exclusionWidth,
        exclusionHeight,
        false,
      );

      // Pick one card from this tile if available
      if (cards.length > 0) {
        const card = cards[0];
        const absoluteX = tx * tileSize + card.x;
        const absoluteY = ty * tileSize + card.y;
        positions.push({
          x: absoluteX + card.width / 2,
          y: absoluteY + card.height / 2,
          cardWidth: card.width,
          cardHeight: card.height,
          cardId: card.id,
        });
      }
    }
  }

  return positions;
}

interface TestimonialsCanvasProps {
  testimonials?: Testimonial[];
  tileSize?: number;
  cardsPerTile?: number;
  className?: string;
  children?: React.ReactNode;
  centerExclusionWidth?: number;
  centerExclusionHeight?: number;
  randomRotate?: boolean;
  autoPanInterval?: number;
  autoPanDuration?: number;
}

export function TestimonialsCanvas({
  testimonials = DEFAULT_TESTIMONIALS,
  tileSize = 800,
  cardsPerTile = 4,
  className,
  children,
  centerExclusionWidth = 700,
  centerExclusionHeight = 600,
  randomRotate = false,
  autoPanInterval = 3000,
  autoPanDuration = 1200,
}: TestimonialsCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastTimeRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  // Auto-pan refs
  const autoPanRafRef = useRef<number | null>(null);
  const autoPanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoPanningRef = useRef(false);
  const focusIndexRef = useRef(0);
  const focusPositionsRef = useRef<FocusPosition[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [visibleTiles, setVisibleTiles] = useState<
    { tileX: number; tileY: number; cards: TestimonialCardItem[] }[]
  >([]);

  // Calculate visible tiles based on current offset
  const updateVisibleTiles = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    const { x, y } = offsetRef.current;

    const buffer = 1;
    const startTileX = Math.floor(x / tileSize) - buffer;
    const startTileY = Math.floor(y / tileSize) - buffer;
    const endTileX = Math.ceil((x + width) / tileSize) + buffer;
    const endTileY = Math.ceil((y + height) / tileSize) + buffer;

    const tiles: {
      tileX: number;
      tileY: number;
      cards: TestimonialCardItem[];
    }[] = [];

    for (let tx = startTileX; tx <= endTileX; tx++) {
      for (let ty = startTileY; ty <= endTileY; ty++) {
        tiles.push({
          tileX: tx,
          tileY: ty,
          cards: generateTileCards(
            tx,
            ty,
            tileSize,
            testimonials,
            cardsPerTile,
            centerExclusionWidth,
            centerExclusionHeight,
            randomRotate,
          ),
        });
      }
    }

    setVisibleTiles(tiles);
  }, [
    tileSize,
    testimonials,
    cardsPerTile,
    centerExclusionWidth,
    centerExclusionHeight,
    randomRotate,
  ]);

  // Update transform directly without React re-render
  const updateTransform = useCallback(() => {
    if (contentRef.current) {
      const { x, y } = offsetRef.current;
      contentRef.current.style.transform = `translate3d(${-x}px, ${-y}px, 0)`;
    }
  }, []);

  // Animation loop for momentum
  const animate = useCallback(() => {
    if (isDraggingRef.current) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const friction = 0.95;
    const minVelocity = 0.5;

    velocityRef.current.x *= friction;
    velocityRef.current.y *= friction;

    if (
      Math.abs(velocityRef.current.x) > minVelocity ||
      Math.abs(velocityRef.current.y) > minVelocity
    ) {
      offsetRef.current.x -= velocityRef.current.x;
      offsetRef.current.y -= velocityRef.current.y;
      updateTransform();
      updateVisibleTiles();
      rafRef.current = requestAnimationFrame(animate);
    } else {
      velocityRef.current = { x: 0, y: 0 };
    }
  }, [updateTransform, updateVisibleTiles]);

  // Auto-pan to next testimonial
  const panToNextTestimonial = useCallback(() => {
    if (isDraggingRef.current || isAutoPanningRef.current) return;

    const container = containerRef.current;
    if (!container || focusPositionsRef.current.length === 0) return;

    const { width, height } = container.getBoundingClientRect();

    // Get next focus position
    focusIndexRef.current =
      (focusIndexRef.current + 1) % focusPositionsRef.current.length;
    const target = focusPositionsRef.current[focusIndexRef.current];

    // Calculate target offset to center this testimonial
    // The testimonial should appear well above the hero text so hero is visible
    const targetX = target.x - width / 2;
    const targetY = target.y - height / 2 + 280; // Offset further up so hero text is visible below

    const startX = offsetRef.current.x;
    const startY = offsetRef.current.y;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;

    const startTime = performance.now();
    isAutoPanningRef.current = true;

    const animateAutoPan = (currentTime: number) => {
      if (isDraggingRef.current) {
        isAutoPanningRef.current = false;
        setActiveCardId(null);
        return;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / autoPanDuration, 1);
      const easedProgress = easeOutCubic(progress);

      offsetRef.current.x = startX + deltaX * easedProgress;
      offsetRef.current.y = startY + deltaY * easedProgress;

      updateTransform();
      updateVisibleTiles();

      if (progress < 1) {
        autoPanRafRef.current = requestAnimationFrame(animateAutoPan);
      } else {
        isAutoPanningRef.current = false;
        // Set the active card when animation completes
        setActiveCardId(target.cardId);
        // Schedule next auto-pan
        if (!isDraggingRef.current) {
          autoPanTimerRef.current = setTimeout(
            panToNextTestimonial,
            autoPanInterval,
          );
        }
      }
    };

    autoPanRafRef.current = requestAnimationFrame(animateAutoPan);
  }, [autoPanDuration, autoPanInterval, updateTransform, updateVisibleTiles]);

  // Start auto-pan cycle
  const startAutoPan = useCallback(() => {
    if (autoPanTimerRef.current) {
      clearTimeout(autoPanTimerRef.current);
    }
    autoPanTimerRef.current = setTimeout(panToNextTestimonial, autoPanInterval);
  }, [autoPanInterval, panToNextTestimonial]);

  // Stop auto-pan
  const stopAutoPan = useCallback(() => {
    if (autoPanTimerRef.current) {
      clearTimeout(autoPanTimerRef.current);
      autoPanTimerRef.current = null;
    }
    if (autoPanRafRef.current) {
      cancelAnimationFrame(autoPanRafRef.current);
      autoPanRafRef.current = null;
    }
    isAutoPanningRef.current = false;
    setActiveCardId(null);
  }, []);

  // Mouse drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      lastTimeRef.current = Date.now();
      velocityRef.current = { x: 0, y: 0 };

      // Stop auto-pan when user starts dragging
      stopAutoPan();

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [stopAutoPan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;

      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      const now = Date.now();
      const dt = now - lastTimeRef.current;

      if (dt > 0) {
        velocityRef.current.x = (dx / dt) * 16;
        velocityRef.current.y = (dy / dt) * 16;
      }

      offsetRef.current.x -= dx;
      offsetRef.current.y -= dy;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      lastTimeRef.current = now;

      updateTransform();
      updateVisibleTiles();
    },
    [updateTransform, updateVisibleTiles],
  );

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    rafRef.current = requestAnimationFrame(animate);
    // Resume auto-pan after momentum settles
    startAutoPan();
  }, [animate, startAutoPan]);

  // Touch drag handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      isDraggingRef.current = true;
      setIsDragging(true);
      lastPosRef.current = { x: touch.clientX, y: touch.clientY };
      lastTimeRef.current = Date.now();
      velocityRef.current = { x: 0, y: 0 };

      // Stop auto-pan when user starts dragging
      stopAutoPan();

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [stopAutoPan],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();

      const touch = e.touches[0];
      const dx = touch.clientX - lastPosRef.current.x;
      const dy = touch.clientY - lastPosRef.current.y;
      const now = Date.now();
      const dt = now - lastTimeRef.current;

      if (dt > 0) {
        velocityRef.current.x = (dx / dt) * 16;
        velocityRef.current.y = (dy / dt) * 16;
      }

      offsetRef.current.x -= dx;
      offsetRef.current.y -= dy;
      lastPosRef.current = { x: touch.clientX, y: touch.clientY };
      lastTimeRef.current = now;

      updateTransform();
      updateVisibleTiles();
    },
    [updateTransform, updateVisibleTiles],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    rafRef.current = requestAnimationFrame(animate);
    // Resume auto-pan after momentum settles
    startAutoPan();
  }, [animate, startAutoPan]);

  // Initialize (no wheel handler — drag only)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Center the viewport on world origin (0, 0) where the exclusion zone is
    const { width, height } = container.getBoundingClientRect();
    offsetRef.current = { x: -width / 2, y: -height / 2 };

    // Generate focus positions for auto-pan
    focusPositionsRef.current = generateFocusPositions(
      16,
      tileSize,
      testimonials,
      cardsPerTile,
      centerExclusionWidth,
      centerExclusionHeight,
    );

    // Initial tile calculation
    updateVisibleTiles();
    updateTransform();

    // Start auto-pan after initial delay
    const initialTimer = setTimeout(() => {
      startAutoPan();
    }, autoPanInterval);

    return () => {
      clearTimeout(initialTimer);
      stopAutoPan();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    updateVisibleTiles,
    updateTransform,
    tileSize,
    testimonials,
    cardsPerTile,
    centerExclusionWidth,
    centerExclusionHeight,
    autoPanInterval,
    startAutoPan,
    stopAutoPan,
  ]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => updateVisibleTiles();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateVisibleTiles]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative isolate h-screen w-full overflow-hidden bg-[#f5f3f0] dark:bg-neutral-950",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dot grid background */}
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(0,0,0,0.08)_1px,transparent_1px)] [background-size:24px_24px] dark:[background-image:radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)]" />

      {/* Scrollable content layer */}
      <div
        ref={contentRef}
        className="absolute will-change-transform"
        style={{ transform: "translate3d(0, 0, 0)" }}
      >
        {visibleTiles.map((tile) => (
          <div
            key={`${tile.tileX}-${tile.tileY}`}
            className="absolute"
            style={{
              left: tile.tileX * tileSize,
              top: tile.tileY * tileSize,
              width: tileSize,
              height: tileSize,
            }}
          >
            {tile.cards.map((card) => {
              const isActive = activeCardId === card.id;
              const hasActiveCard = activeCardId !== null;
              return (
                <motion.div
                  key={card.id}
                  className="absolute origin-center overflow-hidden rounded-xl bg-white p-5 shadow-lg ring-1 ring-black/5 dark:bg-neutral-800 dark:ring-white/10"
                  style={{
                    left: card.x,
                    top: card.y,
                    width: card.width,
                    rotate: card.rotation || 0,
                  }}
                  initial={false}
                  animate={{
                    scale: isActive ? 1.15 : 1,
                    opacity: hasActiveCard ? (isActive ? 1 : 0.1) : 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  {/* Testimonial content */}
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <p className="text-base leading-snug font-semibold text-neutral-800 dark:text-neutral-100">
                        &ldquo;{card.testimonial.title}&rdquo;
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                        {card.testimonial.quote}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <img
                        src={card.testimonial.imageSrc}
                        alt={card.testimonial.name}
                        className="size-8 rounded-full object-cover"
                        loading="lazy"
                        draggable={false}
                      />
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        {card.testimonial.name}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Children overlay */}
      {children && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="pointer-events-auto size-full">{children}</div>
        </div>
      )}
    </div>
  );
}
