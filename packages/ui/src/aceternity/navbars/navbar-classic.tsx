"use client";

import { useState } from "react";
import {
  IconMenu2 as Menu,
  IconX as X,
  IconSearch as Search,
  IconChevronRight as ChevronRight,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

const nav = [
  { label: "Home", href: "#" },
  { label: "Products", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Company", href: "#" },
];

// Utility to get subtle micro-interaction props
const tapProps = {
  whileTap: { scale: 0.98 },
  transition: {
    type: "spring" as const,
    stiffness: 500,
    damping: 30,
    mass: 0.6,
  },
};

export function NavbarClassic() {
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-card text-card-foreground w-full rounded-xl border">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex w-full items-center justify-between gap-3 md:w-auto">
            <a href="#" className="flex items-center gap-2 font-semibold">
              <img
                src="/logo.png"
                alt="Logo"
                width={24}
                height={24}
                className="dark:hidden"
              />
              <img
                src="/logo-dark.png"
                alt="Logo"
                width={24}
                height={24}
                className="hidden dark:block"
              />
              <span>Classic</span>
            </a>
            <motion.button
              aria-label="Toggle menu"
              className="hover:bg-muted inline-flex size-10 items-center justify-center rounded-md border md:hidden"
              onClick={() => setOpen((s) => !s)}
              whileTap={{ scale: 0.92 }}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </motion.button>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            {nav.map((item) => (
              <motion.a
                key={item.label}
                href={item.href}
                className="text-sm/6 hover:text-black dark:hover:text-white"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                {item.label}
              </motion.a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <div className="relative hidden lg:block">
              <Search
                className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2"
                size={16}
              />
              <input
                placeholder="Search"
                className="bg-background h-9 w-44 rounded-md border border-transparent pr-3 pl-8 text-sm shadow-sm ring shadow-black/10 ring-black/10 focus:ring-black/10 focus:outline-none dark:shadow-white/10 dark:ring-white/10"
              />
            </div>

            {/* Primary CTA: black/white theme per request */}
            <motion.button
              {...tapProps}
              className="hidden rounded-lg bg-black px-8 py-2 text-sm font-bold text-white shadow-[0px_-2px_0px_0px_rgba(255,255,255,0.4)_inset] md:block dark:bg-white dark:text-black"
            >
              Get started
            </motion.button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="border-t py-3 md:hidden"
            >
              <nav className="grid gap-1">
                {nav.map((item) => (
                  <motion.a
                    key={item.label}
                    href={item.href}
                    className="hover:bg-muted flex items-center justify-between rounded-md px-3 py-2 text-sm"
                    onClick={() => setOpen(false)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>{item.label}</span>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </motion.a>
                ))}
                <div className="flex items-center gap-2 px-3 pt-2">
                  <div className="flex-1" />

                  <motion.button
                    {...tapProps}
                    className="rounded-full bg-black px-4 py-2 text-sm font-bold text-white shadow-[0px_-2px_0px_0px_rgba(255,255,255,0.4)_inset] dark:bg-white dark:text-black"
                  >
                    Get started
                  </motion.button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
