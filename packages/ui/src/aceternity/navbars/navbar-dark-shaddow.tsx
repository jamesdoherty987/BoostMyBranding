"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  IconChevronDown,
  IconMenu2,
  IconX,
  IconChevronRight,
  IconBolt,
  IconChartBar,
  IconCloud,
  IconCode,
  IconCpu,
  IconShield,
  IconBook,
  IconUsers,
  IconHeadset,
  IconFileText,
  IconArrowRight,
  IconDatabase,
  IconWebhook,
  IconBrandOpenai,
  IconRouteAltLeft,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

type LinkItem = {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type BlogPost = {
  title: string;
  description: string;
  href: string;
  image: string;
};

type DropdownConfig = {
  label: string;
  columns: [LinkItem[], LinkItem[]];
  columnHeadings: [string, string];
  blog?: BlogPost;
};

const dropdowns: DropdownConfig[] = [
  {
    label: "Products",
    columnHeadings: ["Platform", "Developer"],
    columns: [
      [
        {
          label: "Analytics",
          description: "Real-time dashboards and metrics",
          href: "#",
          icon: IconChartBar,
        },
        {
          label: "Automation",
          description: "Workflows that run themselves",
          href: "#",
          icon: IconBolt,
        },
        {
          label: "Infrastructure",
          description: "Edge compute and storage",
          href: "#",
          icon: IconCloud,
        },
        {
          label: "Database",
          description: "Managed Postgres and Redis",
          href: "#",
          icon: IconDatabase,
        },
        {
          label: "Integrations",
          description: "Connect with 200+ services",
          href: "#",
          icon: IconWebhook,
        },
      ],
      [
        {
          label: "Developer Tools",
          description: "SDKs, APIs, and CLI",
          href: "#",
          icon: IconCode,
        },
        {
          label: "AI Engine",
          description: "Built-in machine learning",
          href: "#",
          icon: IconCpu,
        },
        {
          label: "Security",
          description: "Enterprise-grade protection",
          href: "#",
          icon: IconShield,
        },
        {
          label: "AI Agents",
          description: "Autonomous task runners",
          href: "#",
          icon: IconBrandOpenai,
        },
        {
          label: "Routing",
          description: "Traffic splitting and canary",
          href: "#",
          icon: IconRouteAltLeft,
        },
      ],
    ],
    blog: {
      title: "Introducing Acme Analytics 2.0",
      description:
        "Faster queries, smarter dashboards, and real-time collaboration for your entire team.",
      href: "#",
      image:
        "https://assets.aceternity.com/components/hero-section-with-shadow-and-scales.webp",
    },
  },
  {
    label: "Resources",
    columnHeadings: ["Learn", "Connect"],
    columns: [
      [
        {
          label: "Documentation",
          description: "Guides and API reference",
          href: "#",
          icon: IconBook,
        },
        {
          label: "Changelog",
          description: "What we shipped recently",
          href: "#",
          icon: IconFileText,
        },
      ],
      [
        {
          label: "Community",
          description: "Forums and Discord",
          href: "#",
          icon: IconUsers,
        },
        {
          label: "Support",
          description: "Get help from our team",
          href: "#",
          icon: IconHeadset,
        },
      ],
    ],
  },
];

const plainLinks = [
  { label: "Pricing", href: "#" },
  { label: "Enterprise", href: "#" },
];

export function NavbarDarkShadow() {
  return (
    <div className="w-full bg-neutral-100 px-2 py-20 dark:bg-neutral-950">
      <NavbarRidge />
    </div>
  );
}

function LogoPulse({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M2 12h4l2-6 3 12 3-8 2 4h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

function NavbarRidge() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDropdown = useCallback((label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveDropdown(label);
  }, []);

  const closeDropdown = useCallback(() => {
    timeoutRef.current = setTimeout(() => setActiveDropdown(null), 150);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="relative z-50 mx-auto w-full max-w-5xl">
      <header className="inset-shadow-lg rounded-2xl bg-white shadow-lg ring-1 shadow-black/8 ring-black/5 inset-shadow-white dark:bg-neutral-950 dark:shadow-xl dark:shadow-black/50 dark:ring-white/10 dark:inset-shadow-white/3">
        <div className="px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <a
              href="/"
              aria-label="Homepage"
              className="flex shrink-0 items-center gap-2"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 shadow-sm ring-1 inset-shadow-sm shadow-black/8 ring-black/5 inset-shadow-white dark:bg-neutral-900 dark:shadow-black/40 dark:ring-white/10 dark:inset-shadow-white/8">
                <LogoPulse className="size-5 text-neutral-950 dark:text-white" />
              </div>
              <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                Reverb
              </span>
            </a>

            <DesktopNav
              activeDropdown={activeDropdown}
              onOpen={openDropdown}
              onClose={closeDropdown}
            />

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 lg:flex">
                <a
                  href="#"
                  className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                >
                  Sign in
                </a>
                <button className="rounded-md bg-linear-to-b from-neutral-800 to-neutral-950 px-3 py-1.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.15),0_1px_2px_rgba(0,0,0,0.1)] ring-1 inset-shadow-[0_1px_0_0_rgba(255,255,255,0.12),0_-1px_0_0_rgba(0,0,0,0.2)] ring-neutral-900/90 hover:from-neutral-700 hover:to-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:from-neutral-100 dark:to-neutral-300 dark:text-neutral-950 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.3)] dark:inset-shadow-[0_1px_0_0_rgba(255,255,255,0.9),0_-1px_0_0_rgba(0,0,0,0.08)] dark:ring-white/70 dark:hover:from-white dark:hover:to-neutral-200">
                  Get started
                </button>
              </div>
              <button
                aria-label="Toggle menu"
                className="relative inline-flex size-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:text-neutral-400 dark:hover:bg-white/6 dark:hover:text-white"
                onClick={() => setMobileOpen((s) => !s)}
              >
                {mobileOpen ? (
                  <IconX className="size-5" />
                ) : (
                  <IconMenu2 className="size-5" />
                )}
                <span
                  className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {mobileOpen && <MobileNav />}
        </AnimatePresence>
      </header>
    </div>
  );
}

function DesktopNav({
  activeDropdown,
  onOpen,
  onClose,
}: {
  activeDropdown: string | null;
  onOpen: (label: string) => void;
  onClose: () => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const activeConfig = dropdowns.find((d) => d.label === activeDropdown);
  const activeButton = activeDropdown
    ? buttonRefs.current.get(activeDropdown)
    : null;
  const navRect = navRef.current?.getBoundingClientRect();
  const buttonRect = activeButton?.getBoundingClientRect();
  const dropdownLeft =
    buttonRect && navRect ? buttonRect.left - navRect.left : 0;

  return (
    <nav
      ref={navRef}
      className="relative hidden items-center gap-1 lg:flex"
      onMouseLeave={onClose}
    >
      {dropdowns.map((dd) => (
        <button
          key={dd.label}
          ref={(el) => {
            if (el) buttonRefs.current.set(dd.label, el);
          }}
          className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/6 dark:hover:text-white"
          onMouseEnter={() => onOpen(dd.label)}
          onClick={() =>
            activeDropdown === dd.label ? onClose() : onOpen(dd.label)
          }
          aria-expanded={activeDropdown === dd.label}
        >
          {dd.label}
          <IconChevronDown
            className={`size-3.5 text-neutral-400 dark:text-neutral-500 ${activeDropdown === dd.label ? "rotate-180" : ""}`}
          />
        </button>
      ))}
      {plainLinks.map((link) => (
        <a
          key={link.label}
          href={link.href}
          className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/6 dark:hover:text-white"
          onMouseEnter={onClose}
        >
          {link.label}
        </a>
      ))}

      <AnimatePresence>
        {activeConfig && (
          <motion.div
            key="dropdown-shell"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full right-0 z-50 pt-3"
            onMouseEnter={() => onOpen(activeConfig.label)}
          >
            <motion.div
              layout
              transition={springTransition}
              className="overflow-hidden rounded-xl bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.06)] ring-1 inset-shadow-[0_1px_0_0_rgba(255,255,255,1),0_-1px_0_0_rgba(0,0,0,0.03)] ring-black/5 dark:bg-neutral-900 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4)] dark:inset-shadow-[0_1px_0_0_rgba(255,255,255,0.06),0_-1px_0_0_rgba(0,0,0,0.2)] dark:ring-white/10"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={activeConfig.label}
                  initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -20, filter: "blur(4px)" }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                >
                  <DropdownContent config={activeConfig} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function DropdownContent({ config }: { config: DropdownConfig }) {
  const [col1, col2] = config.columns;
  const [heading1, heading2] = config.columnHeadings;
  const hasBlog = !!config.blog;

  return (
    <div
      className={
        hasBlog
          ? "grid w-[48rem] grid-cols-[1fr_1fr_15rem] gap-0"
          : "grid w-[32rem] grid-cols-2 gap-0"
      }
    >
      <div className="p-1">
        <p className="px-2 pt-2 pb-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">
          {heading1}
        </p>
        <ul role="list" className="grid gap-0.5">
          {col1.map((item) => (
            <li key={item.label}>
              <LinkRow item={item} />
            </li>
          ))}
        </ul>
      </div>

      <div className="border-l border-neutral-100 p-1 dark:border-white/6">
        <p className="px-2 pt-2 pb-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">
          {heading2}
        </p>
        <ul role="list" className="grid gap-0.5">
          {col2.map((item) => (
            <li key={item.label}>
              <LinkRow item={item} />
            </li>
          ))}
        </ul>
      </div>

      {config.blog && (
        <div className="border-l border-neutral-100 p-2 dark:border-white/6">
          <p className="px-1 pt-1 pb-2 text-xs font-medium text-neutral-400 dark:text-neutral-500">
            From the blog
          </p>
          <a href={config.blog.href} className="group block">
            <div className="overflow-hidden rounded-lg">
              <img
                src={config.blog.image}
                alt=""
                className="aspect-16/10 w-full object-cover outline-1 -outline-offset-1 outline-black/5 dark:outline-white/10"
              />
            </div>
            <p className="mt-2.5 text-sm font-medium text-neutral-700 group-hover:text-neutral-950 dark:text-neutral-200 dark:group-hover:text-white">
              {config.blog.title}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
              {config.blog.description}
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-neutral-500 group-hover:text-neutral-950 dark:text-neutral-400 dark:group-hover:text-white">
              Read more <IconArrowRight className="size-3" />
            </p>
          </a>
        </div>
      )}
    </div>
  );
}

function LinkRow({ item }: { item: LinkItem }) {
  return (
    <a
      href={item.href}
      className="group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-neutral-50 dark:hover:bg-white/6"
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 shadow-sm ring-1 inset-shadow-sm shadow-black/5 ring-black/5 inset-shadow-white group-hover:bg-neutral-200/70 dark:bg-neutral-800/80 dark:shadow-black/30 dark:ring-white/8 dark:inset-shadow-white/6 dark:group-hover:bg-neutral-800">
        <item.icon className="size-4 text-neutral-500 group-hover:text-neutral-950 dark:text-neutral-400 dark:group-hover:text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-700 group-hover:text-neutral-950 dark:text-neutral-200 dark:group-hover:text-white">
          {item.label}
        </p>
        <p className="text-xs text-neutral-400 group-hover:text-neutral-500 dark:text-neutral-500 dark:group-hover:text-neutral-400">
          {item.description}
        </p>
      </div>
    </a>
  );
}

function MobileNav() {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden border-t border-neutral-200 lg:hidden dark:border-white/8"
    >
      <div className="px-4 py-4 sm:px-6">
        {dropdowns.map((dd) => (
          <MobileDropdown key={dd.label} config={dd} />
        ))}
        {plainLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-white/6"
          >
            <span>{link.label}</span>
            <IconChevronRight className="size-4 text-neutral-400 dark:text-neutral-600" />
          </a>
        ))}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-white/8">
          <a
            href="#"
            className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
          >
            Sign in
          </a>
          <button className="rounded-md bg-linear-to-b from-neutral-800 to-neutral-950 px-3 py-1.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.15),0_1px_2px_rgba(0,0,0,0.1)] ring-1 inset-shadow-[0_1px_0_0_rgba(255,255,255,0.12),0_-1px_0_0_rgba(0,0,0,0.2)] ring-neutral-900/90 dark:from-neutral-100 dark:to-neutral-300 dark:text-neutral-950 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.3)] dark:inset-shadow-[0_1px_0_0_rgba(255,255,255,0.9),0_-1px_0_0_rgba(0,0,0,0.08)] dark:ring-white/70">
            Get started
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function MobileDropdown({ config }: { config: DropdownConfig }) {
  const [open, setOpen] = useState(false);
  const allItems = [...config.columns[0], ...config.columns[1]];

  return (
    <div>
      <button
        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-white/6"
        onClick={() => setOpen((s) => !s)}
      >
        <span>{config.label}</span>
        <IconChevronDown
          className={`size-4 text-neutral-400 dark:text-neutral-600 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="py-1 pl-3">
              {allItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50 dark:hover:bg-white/6"
                >
                  <item.icon className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      {item.label}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-600">
                      {item.description}
                    </p>
                  </div>
                </a>
              ))}
              {config.blog && (
                <a
                  href={config.blog.href}
                  className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50 dark:hover:bg-white/6"
                >
                  <img
                    src={config.blog.image}
                    alt=""
                    className="size-10 shrink-0 rounded-md object-cover outline-1 -outline-offset-1 outline-black/5 dark:outline-white/10"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      {config.blog.title}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-600">
                      Read more
                    </p>
                  </div>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
