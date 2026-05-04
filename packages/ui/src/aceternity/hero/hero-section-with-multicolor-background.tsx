"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export function HeroSectionWithMultiColorBackground() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white dark:bg-neutral-950">
      <Navbar />
      <LinesGradientShader
        className="absolute inset-0 bg-transparent dark:bg-transparent"
        bandCount={5}
        bandSpacing={40}
        bandThickness={100}
        waveAmplitude={0.2}
        speed={1}
      />
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-32">
        <a
          href="#"
          className="flex w-fit items-center gap-2 rounded-full bg-white px-2 py-1 text-sm text-neutral-700 shadow-sm ring-1 shadow-black/10 ring-black/10 active:scale-98 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-white/10"
        >
          We&apos;ve raised $69M seed funding <Arrow className="size-4" />
        </a>
        <h1 className="mt-4 max-w-3xl text-4xl font-medium tracking-tight text-neutral-700 md:text-7xl dark:text-neutral-300">
          Get warm leads for your business in minutes.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-neutral-700 md:text-xl dark:text-neutral-300">
          Our AI-powered platform identifies and qualifies potential customers,
          so you can focus on closing deals instead of chasing cold leads.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <button className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-neutral-800 active:scale-98 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100">
            <span className="flex items-center gap-2">
              Get Started <Arrow className="size-4" />
            </span>
          </button>
          <button className="rounded-full bg-white px-6 py-3 text-sm font-medium text-neutral-900 shadow-sm ring-1 ring-neutral-200 transition-all hover:bg-neutral-50 active:scale-98 dark:bg-neutral-800 dark:text-white dark:ring-neutral-700 dark:hover:bg-neutral-700">
            Learn More
          </button>
        </div>
        {/* MacBook Window */}
        <div className="mt-16 md:mt-24">
          <div className="relative mx-auto max-w-full">
            {/* Window Frame */}
            <div className="overflow-hidden rounded-xl border border-neutral-300/50 backdrop-blur-sm dark:border-neutral-700/50">
              {/* Title Bar */}
              <div className="flex items-center gap-2 border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/50">
                <div className="flex items-center gap-1.5">
                  <div className="size-3 rounded-full bg-red-500" />
                  <div className="size-3 rounded-full bg-yellow-500" />
                  <div className="size-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    ui.aceternity.com
                  </span>
                </div>
                <div className="w-12" />
              </div>
              {/* Window Content */}
              <div className="relative aspect-[16/10] w-full">
                <img
                  src="https://assets.aceternity.com/screenshots/3.jpg"
                  alt="Dashboard Preview"
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);

  const resourcesLeftColumn = [
    {
      title: "Blog",
      href: "#",
      description: "Latest news and articles",
      icon: BlogIcon,
    },
    {
      title: "Documentation",
      href: "#",
      description: "Guides and API references",
      icon: DocsIcon,
    },
    {
      title: "Help Center",
      href: "#",
      description: "Get support and FAQs",
      icon: HelpIcon,
    },
  ];

  const resourcesRightColumn = [
    {
      title: "Community",
      href: "#",
      description: "Join our Discord server",
      icon: CommunityIcon,
    },
    {
      title: "Changelog",
      href: "#",
      description: "See what's new",
      icon: ChangelogIcon,
    },
    {
      title: "Tutorials",
      href: "#",
      description: "Learn with video guides",
      icon: TutorialsIcon,
    },
  ];

  return (
    <nav className="z-60 w-full backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 md:px-8">
        {/* Logo */}
        <a href="#" className="flex items-center space-x-2">
          <LogoIcon className="relative z-20 size-4 text-emerald-500" />

          <span className="text-base font-semibold text-black sm:text-lg dark:text-white">
            Leadgen
          </span>
        </a>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-6 lg:flex lg:gap-8">
          <a
            href="#"
            className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            Product
          </a>

          {/* Resources Dropdown - CSS hover based */}
          <div className="group/hero-navbar relative">
            <button className="flex items-center gap-1 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
              Resources
              <ChevronDownIcon className="size-4 transition-transform duration-200 group-hover/hero-navbar:rotate-180" />
            </button>

            {/* Dropdown - hidden by default, shown on hover */}
            <div className="pointer-events-none absolute top-full left-1/2 z-50 pt-4 opacity-0 transition-all duration-200 group-hover/hero-navbar:pointer-events-auto group-hover/hero-navbar:opacity-100">
              <div className="flex w-[540px] -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 shadow-black/10 ring-black/10 lg:w-[600px] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-white/5 dark:ring-white/5">
                {/* Left Column */}
                <div className="flex-1 p-3 lg:p-4">
                  <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                    Learn
                  </p>
                  {resourcesLeftColumn.map((item) => (
                    <a
                      key={item.title}
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        <item.icon className="size-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-neutral-900 dark:text-white">
                          {item.title}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>

                {/* Right Column */}
                <div className="flex-1 border-l border-neutral-100 p-3 lg:p-4 dark:border-neutral-800">
                  <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                    Connect
                  </p>
                  {resourcesRightColumn.map((item) => (
                    <a
                      key={item.title}
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        <item.icon className="size-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-neutral-900 dark:text-white">
                          {item.title}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>

                {/* Image/CTA Column */}
                <div className="hidden w-44 bg-gradient-to-br from-neutral-900 to-neutral-800 p-4 lg:block lg:w-52 dark:from-neutral-800 dark:to-neutral-900">
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        What&apos;s new
                      </h3>
                      <p className="mt-1 text-xs text-neutral-400">
                        Check out our latest features and improvements.
                      </p>
                    </div>
                    <a
                      href="#"
                      className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      See changelog
                      <Arrow className="size-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <a
            href="#"
            className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            Contact
          </a>
        </div>

        {/* Desktop Right Side */}
        <div className="hidden items-center gap-3 lg:flex lg:gap-4">
          <a
            href="#"
            className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            Login
          </a>
          <a
            href="#"
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-neutral-800 active:scale-98 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Try for free
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex size-10 items-center justify-center rounded-md lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <CloseIcon className="size-5 text-neutral-900 dark:text-white" />
          ) : (
            <MenuIcon className="size-5 text-neutral-900 dark:text-white" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-neutral-200 bg-white px-4 py-4 lg:hidden dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-1">
            <a
              href="#"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              Product
            </a>

            {/* Mobile Resources Accordion */}
            <div>
              <button
                onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                Resources
                <ChevronDownIcon
                  className={`size-4 transition-transform ${mobileResourcesOpen ? "rotate-180" : ""}`}
                />
              </button>
              {mobileResourcesOpen && (
                <div className="mt-1 ml-3 flex flex-col gap-0.5 border-l border-neutral-200 pl-3 dark:border-neutral-700">
                  {[...resourcesLeftColumn, ...resourcesRightColumn].map(
                    (item) => (
                      <a
                        key={item.title}
                        href={item.href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <item.icon className="size-4 text-neutral-500 dark:text-neutral-400" />
                        <div>
                          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            {item.title}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-500">
                            {item.description}
                          </div>
                        </div>
                      </a>
                    ),
                  )}
                </div>
              )}
            </div>

            <a
              href="#"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              Contact
            </a>

            <div className="my-3 h-px bg-neutral-200 dark:bg-neutral-800" />
            <a
              href="#"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              Login
            </a>
            <a
              href="#"
              className="mt-2 rounded-full bg-neutral-900 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all hover:bg-neutral-800 active:scale-98 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Try for free
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

// Resource Icons
const BlogIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

const DocsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const HelpIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CommunityIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ChangelogIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TutorialsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
};

const LogoIcon = (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
  return (
    <img
      src="https://assets.aceternity.com/logo.png"
      alt="Logo"
      width={66}
      height={65}
      {...props}
    />
  );
};

const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
};

const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
};

const Arrow = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M5 12l14 0" />
      <path d="M15 16l4 -4" />
      <path d="M15 8l4 4" />
    </svg>
  );
};

// Lines gradient shader

interface LinesGradientShaderProps {
  /** CSS class name for the container (use Tailwind for background color) */
  className?: string;
  /** Animation speed multiplier (lower = slower) */
  speed?: number;
  /** Number of bands in the spiral */
  bandCount?: number;
  /** Spacing between band centers in pixels */
  bandSpacing?: number;
  /** Thickness of each band in pixels */
  bandThickness?: number;
  /** Wave amplitude as a fraction of container height (0-1) */
  waveAmplitude?: number;
  /** Custom color stops for the gradient (array of RGB tuples) */
  colors?: [number, number, number][];
  /** Target FPS (default: 30 for better performance) */
  targetFps?: number;
}

const DEFAULT_COLORS: [number, number, number][] = [
  [139, 92, 246], // violet-500
  [168, 85, 247], // purple-500
  [217, 70, 239], // fuchsia-500
  [236, 72, 153], // pink-500
  [244, 63, 94], // rose-500
  [249, 115, 22], // orange-500
  [251, 191, 36], // amber-400
  [254, 240, 138], // yellow-200
];

const LinesGradientShader: React.FC<LinesGradientShaderProps> = ({
  className,
  speed = 1,
  bandCount = 12,
  bandSpacing = 25,
  bandThickness = 60,
  waveAmplitude = 0.15,
  colors,
  targetFps = 30,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);

  const colorStops = useMemo(() => colors || DEFAULT_COLORS, [colors]);

  const precomputedColors = useMemo(() => {
    const interpolateColor = (
      color1: [number, number, number],
      color2: [number, number, number],
      t: number,
    ): string => {
      const r = Math.round(color1[0] + (color2[0] - color1[0]) * t);
      const g = Math.round(color1[1] + (color2[1] - color1[1]) * t);
      const b = Math.round(color1[2] + (color2[2] - color1[2]) * t);
      return `rgb(${r},${g},${b})`;
    };

    const getColorAtPosition = (t: number): string => {
      const clampedT = Math.max(0, Math.min(1, t));
      const scaledT = clampedT * (colorStops.length - 1);
      const index = Math.floor(scaledT);
      const fraction = scaledT - index;
      const color1 = colorStops[Math.min(index, colorStops.length - 1)];
      const color2 = colorStops[Math.min(index + 1, colorStops.length - 1)];
      return interpolateColor(color1, color2, fraction);
    };

    const bandColors: { start: string; end: string }[] = [];
    for (let i = 0; i < bandCount; i++) {
      const progress = i / (bandCount - 1);
      bandColors.push({
        start: getColorAtPosition(progress - 0.02),
        end: getColorAtPosition(progress + 0.08),
      });
    }
    return bandColors;
  }, [colorStops, bandCount]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!ctx) return;

    let stopped = false;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const frameInterval = 1000 / targetFps;
    const steps = 40;
    const highlightSteps = 30;

    let cachedWidth = 0;
    let cachedHeight = 0;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      cachedWidth = width;
      cachedHeight = height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${Math.floor(width)}px`;
      canvas.style.height = `${Math.floor(height)}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const io = new IntersectionObserver(
      (entries) => {
        isVisibleRef.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 },
    );
    io.observe(container);

    const handleVisibilityChange = () => {
      if (!document.hidden && isVisibleRef.current) {
        startTimeRef.current = 0;
        lastFrameTimeRef.current = 0;
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const bottomPoints: { x: number; y: number }[] = new Array(steps + 1);
    const topPoints: { x: number; y: number }[] = new Array(steps + 1);
    for (let j = 0; j <= steps; j++) {
      bottomPoints[j] = { x: 0, y: 0 };
      topPoints[j] = { x: 0, y: 0 };
    }

    const draw = (timestamp: number) => {
      if (stopped) return;

      rafRef.current = requestAnimationFrame(draw);

      if (!isVisibleRef.current || document.hidden) {
        return;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      if (elapsed < frameInterval) {
        return;
      }
      lastFrameTimeRef.current = timestamp - (elapsed % frameInterval);

      if (startTimeRef.current === 0) {
        startTimeRef.current = timestamp;
      }

      const time = (timestamp - startTimeRef.current) * 0.001 * speed;
      const width = cachedWidth;
      const height = cachedHeight;

      ctx.clearRect(0, 0, width, height);

      const baseAmplitude = height * waveAmplitude;
      const halfBandCount = bandCount / 2;
      const widthRange = width + 400;

      for (let i = bandCount - 1; i >= 0; i--) {
        const { start: colorStart, end: colorEnd } = precomputedColors[i];

        const gradient = ctx.createLinearGradient(
          width * 0.3,
          0,
          width,
          height,
        );
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);

        ctx.fillStyle = gradient;
        ctx.beginPath();

        const phase1 = time * 0.12 + i * 0.15;
        const phase2 = time * 0.08 + i * 0.1;
        const phase3 = time * 0.05 + i * 0.08;
        const bandOffset = (i - halfBandCount) * bandSpacing;

        ctx.moveTo(-100, height + 200);

        for (let j = 0; j <= steps; j++) {
          const t = j / steps;
          const x = -100 + widthRange * t;
          const baseY = height * 1.4 - t * height * 1.2 + bandOffset;

          const wave1 = Math.sin(t * 2.5 + phase1) * baseAmplitude;
          const wave2 = Math.sin(t * 1.5 + phase2) * baseAmplitude * 0.4;
          const wave3 = Math.sin(t * 4 + phase3) * baseAmplitude * 0.15;
          const waveOffset = wave1 + wave2 + wave3;

          const thickness = bandThickness + 4 * Math.sin(t * 2 + phase1 * 0.3);
          const halfThickness = thickness / 2;

          bottomPoints[j].x = x;
          bottomPoints[j].y = baseY + waveOffset + halfThickness;
          topPoints[j].x = x;
          topPoints[j].y = baseY + waveOffset - halfThickness;
        }

        for (let j = 0; j <= steps; j++) {
          ctx.lineTo(bottomPoints[j].x, bottomPoints[j].y);
        }

        ctx.lineTo(width + 200, -100);

        for (let j = steps; j >= 0; j--) {
          ctx.lineTo(topPoints[j].x, topPoints[j].y);
        }

        ctx.lineTo(-100, height + 200);
        ctx.closePath();
        ctx.fill();
      }

      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;

      for (let i = 0; i < bandCount; i++) {
        const phase1 = time * 0.12 + i * 0.15;
        const phase2 = time * 0.08 + i * 0.1;
        const phase3 = time * 0.05 + i * 0.08;
        const bandOffset = (i - halfBandCount) * bandSpacing;

        ctx.beginPath();

        for (let j = 0; j <= highlightSteps; j++) {
          const t = j / highlightSteps;
          const x = -100 + widthRange * t;
          const baseY = height * 1.4 - t * height * 1.2 + bandOffset;

          const wave1 = Math.sin(t * 2.5 + phase1) * baseAmplitude;
          const wave2 = Math.sin(t * 1.5 + phase2) * baseAmplitude * 0.4;
          const wave3 = Math.sin(t * 4 + phase3) * baseAmplitude * 0.15;
          const y = baseY + wave1 + wave2 + wave3;

          if (j === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      ro.disconnect();
      io.disconnect();
    };
  }, [
    speed,
    bandCount,
    bandSpacing,
    bandThickness,
    waveAmplitude,
    precomputedColors,
    targetFps,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none relative overflow-hidden", className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ display: "block" }}
      />
    </div>
  );
};
