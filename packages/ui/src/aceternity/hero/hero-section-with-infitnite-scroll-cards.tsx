"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { IconX, IconMenu2 } from "@tabler/icons-react";

export function HeroSectionWithInfiniteScrollCards() {
  return (
    <InfiniteScrollCanvas>
      <div className="flex h-full items-center justify-center">
        <div className="max-w-2xl px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl font-medium tracking-tight text-neutral-800 md:text-6xl dark:text-neutral-100"
          >
            Ship landing pages <br /> at lightning speed
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mx-auto mt-4 max-w-md text-base text-neutral-500 md:text-lg dark:text-neutral-400"
          >
            200+ production-ready components and templates that make your site
            feel like you hired a design team.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-neutral-900 shadow-md ring-1 ring-black/5 transition-all hover:shadow-lg active:scale-[0.98] dark:bg-neutral-800 dark:text-white dark:ring-white/10"
          >
            Try 5 components for free
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
    </InfiniteScrollCanvas>
  );
}
// Navbar Component
function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Pricing", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
  ];

  return (
    <>
      {/* Desktop Navbar */}
      <motion.nav
        initial={{ opacity: 0, filter: "blur(10px)", y: -10 }}
        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
        transition={{ duration: 0.6, delay: 0 }}
        className="absolute top-4 left-1/2 z-50 hidden -translate-x-1/2 md:block"
      >
        <div className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white/80 px-2 py-1.5 shadow-sm backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80">
          {/* Logo */}
          <a
            href="#"
            className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none">
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                fill="currentColor"
                className="opacity-90"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          {/* Nav Links */}
          <div className="flex items-center">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

          {/* Login */}
          <a
            href="#"
            className="px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            Login
          </a>

          {/* Get Started Button */}
          <a
            href="#"
            className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
          >
            Get Started &rarr;
          </a>
        </div>
      </motion.nav>

      {/* Mobile Navbar */}
      <motion.nav
        initial={{ opacity: 0, filter: "blur(10px)", y: -10 }}
        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
        transition={{ duration: 0.6, delay: 0 }}
        className="absolute top-4 right-4 left-4 z-50 md:hidden"
      >
        <div className="flex items-center justify-between rounded-full border border-neutral-200 bg-white/80 px-2 py-1.5 shadow-sm backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80">
          {/* Logo */}
          <a
            href="#"
            className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none">
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                fill="currentColor"
                className="opacity-90"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          {/* Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex size-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <IconMenu2 className="size-4" />
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          "absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          isMobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Menu Panel */}
      <div
        className={cn(
          "absolute top-4 right-4 left-4 z-[101] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl transition-all duration-300 md:hidden dark:border-neutral-800 dark:bg-neutral-900",
          isMobileMenuOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-4 opacity-0",
        )}
      >
        {/* Header with Logo and Close */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <a
            href="#"
            className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none">
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                fill="currentColor"
                className="opacity-90"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex size-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <IconX className="size-4" />
          </button>
        </div>

        {/* Nav Links */}
        <div className="flex flex-col px-2 py-2">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-lg px-4 py-3 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-neutral-100 dark:bg-neutral-800" />

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2 p-4">
          <a
            href="#"
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-full rounded-lg px-4 py-3 text-center text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Login
          </a>
          <a
            href="#"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            Get Started &rarr;
          </a>
        </div>
      </div>
    </>
  );
}

// Default images for the scattered layout
const DEFAULT_IMAGES = [
  "https://assets.aceternity.com/components/hero-1.webp",
  "https://assets.aceternity.com/components/hero-2.webp",
  "https://assets.aceternity.com/components/shader-3.webp",
  "https://assets.aceternity.com/components/shader-2.webp",
  "https://assets.aceternity.com/components/shader-1.webp",
  "https://assets.aceternity.com/pro/agenforce-1.webp",
  "https://assets.aceternity.com/pro/agenforce-2.webp",
  "https://assets.aceternity.com/pro/agenforce-3.webp",
  "https://assets.aceternity.com/pro/notus-1-min.webp",
  "https://assets.aceternity.com/pro/minimal-3-min.webp",
  "https://assets.aceternity.com/pro/minimal-1-min.webp",
  "https://assets.aceternity.com/pro/text-animations.webp",
  "https://assets.aceternity.com/pro/landing/10.webp",
  "https://assets.aceternity.com/templates/schedule-1-min.webp",
  "https://assets.aceternity.com/templates/schedule-3-min.webp",
  "https://assets.aceternity.com/templates/cryptgen-1.webp",
];

interface CardItem {
  id: string;
  src: string;
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
  // Center exclusion zone is around world origin (0, 0)
  const zoneLeft = -exclusionWidth / 2;
  const zoneRight = exclusionWidth / 2;
  const zoneTop = -exclusionHeight / 2;
  const zoneBottom = exclusionHeight / 2;

  // Check if card overlaps with the exclusion zone
  const cardRight = absoluteX + width;
  const cardBottom = absoluteY + height;

  return !(
    cardRight < zoneLeft ||
    absoluteX > zoneRight ||
    cardBottom < zoneTop ||
    absoluteY > zoneBottom
  );
}

// Generate image cards for a tile based on its position
function generateTileCards(
  tileX: number,
  tileY: number,
  tileSize: number,
  images: string[],
  cardCount: number = 6,
  exclusionWidth: number = 700,
  exclusionHeight: number = 600,
  randomRotate: boolean = false,
): CardItem[] {
  const seed = tileX * 10000 + tileY;
  const random = seededRandom(seed);

  const cards: CardItem[] = [];
  const maxAttempts = 50; // Prevent infinite loops

  for (let i = 0; i < cardCount; i++) {
    // Cycle through images to ensure all are used
    const imgIndex = Math.abs(tileX * cardCount + tileY + i) % images.length;

    // Increased minimum size so far away cards aren't too small
    const baseWidth = 280 + random() * 100;
    const aspectRatio = 1.2 + random() * 0.3;
    const height = baseWidth * aspectRatio;

    let x = 0;
    let y = 0;
    let attempts = 0;
    let validPosition = false;

    // Try to find a non-overlapping position
    while (attempts < maxAttempts && !validPosition) {
      x = random() * (tileSize - baseWidth - 60) + 30;
      y = random() * (tileSize - height - 60) + 30;

      // Calculate absolute world position
      const absoluteX = tileX * tileSize + x;
      const absoluteY = tileY * tileSize + y;

      // Check if in center exclusion zone
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

      // Check overlap with existing cards in this tile
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
          )
        ) {
          validPosition = false;
          break;
        }
      }

      attempts++;
    }

    // Only add the card if we found a valid position
    if (validPosition) {
      // Generate rotation between -10 and 10 degrees if randomRotate is enabled
      const rotation = randomRotate ? random() * 20 - 10 : 0;

      cards.push({
        id: `${tileX}-${tileY}-${i}`,
        src: images[imgIndex],
        x,
        y,
        width: baseWidth,
        height: height,
        rotation,
      });
    }
  }

  return cards;
}

interface InfiniteScrollCanvasProps {
  images?: string[];
  tileSize?: number;
  cardsPerTile?: number;
  className?: string;
  children?: React.ReactNode;
  centerExclusionWidth?: number;
  centerExclusionHeight?: number;
  randomRotate?: boolean;
}

export function InfiniteScrollCanvas({
  images = DEFAULT_IMAGES,
  tileSize = 800,
  cardsPerTile = 5,
  className,
  children,
  centerExclusionWidth = 700,
  centerExclusionHeight = 600,
  randomRotate = false,
}: InfiniteScrollCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastTimeRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [visibleTiles, setVisibleTiles] = useState<
    { tileX: number; tileY: number; cards: CardItem[] }[]
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

    const tiles: { tileX: number; tileY: number; cards: CardItem[] }[] = [];

    for (let tx = startTileX; tx <= endTileX; tx++) {
      for (let ty = startTileY; ty <= endTileY; ty++) {
        tiles.push({
          tileX: tx,
          tileY: ty,
          cards: generateTileCards(
            tx,
            ty,
            tileSize,
            images,
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
    images,
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

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    lastTimeRef.current = Date.now();
    velocityRef.current = { x: 0, y: 0 };

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

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
  }, [animate]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    isDraggingRef.current = true;
    setIsDragging(true);
    lastPosRef.current = { x: touch.clientX, y: touch.clientY };
    lastTimeRef.current = Date.now();
    velocityRef.current = { x: 0, y: 0 };

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

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
  }, [animate]);

  // Wheel handler with gesture prevention
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      offsetRef.current.x += e.deltaX;
      offsetRef.current.y += e.deltaY;
      updateTransform();
      updateVisibleTiles();
    },
    [updateTransform, updateVisibleTiles],
  );

  // Initialize and setup event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Center the viewport on world origin (0, 0) where the exclusion zone is
    const { width, height } = container.getBoundingClientRect();
    offsetRef.current = { x: -width / 2, y: -height / 2 };

    // Prevent browser gestures
    container.addEventListener("wheel", handleWheel, { passive: false });

    // Initial tile calculation
    updateVisibleTiles();
    updateTransform();

    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleWheel, updateVisibleTiles, updateTransform]);

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
      style={{
        touchAction: "none",
        overscrollBehavior: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Navbar */}
      <Navbar />

      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

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
            {tile.cards.map((card) => (
              <div
                key={card.id}
                className="absolute overflow-hidden rounded-lg bg-white p-1.5 shadow-lg ring-1 ring-black/5 dark:bg-neutral-800 dark:ring-white/10"
                style={{
                  left: card.x,
                  top: card.y,
                  transform: card.rotation
                    ? `rotate(${card.rotation}deg)`
                    : undefined,
                }}
              >
                <div
                  className="overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-700"
                  style={{ height: card.height - 12 }}
                >
                  <img
                    src={card.src}
                    alt=""
                    className="size-full object-cover object-left-top"
                    loading="lazy"
                    draggable={false}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Children overlay - for any UI elements passed from outside */}
      {children && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="pointer-events-auto size-full">{children}</div>
        </div>
      )}
    </div>
  );
}
