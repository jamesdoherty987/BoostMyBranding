'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, Copy, Check, ExternalLink } from 'lucide-react';

import { COMPANY } from '@boost/core';

const EMAIL = COMPANY.email;

/**
 * Floating "Get in touch" button with a compact popup. Shown on the
 * marketing surface only. Hidden on /dashboard/*, /portal/*, and the
 * rendered client sites at /sites/* where it would clash with each
 * surface's own chrome and CTA patterns.
 */
export function ContactButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Scoped to marketing only. Keep the check above every other hook so
  // Next's hook rules stay happy.
  const hide =
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/portal') ||
    pathname?.startsWith('/sites/');

  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = EMAIL;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  if (hide) return null;

  return (
    <>
      {/* Floating trigger */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-colors hover:bg-slate-800 md:h-auto md:w-auto md:gap-2 md:rounded-full md:px-4 md:py-2.5"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Get in touch"
      >
        {open ? <X className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
        <span className="hidden text-sm font-medium md:inline">
          {open ? 'Close' : 'Get in touch'}
        </span>
      </motion.button>

      {/* Popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-5 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="bg-slate-900 px-4 py-3 text-white">
              <h3 className="text-sm font-bold">Get in touch</h3>
              <p className="mt-0.5 text-[11px] text-white/70">
                We reply within a day.
              </p>
            </div>

            {/* Email display + actions */}
            <div className="p-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] font-medium text-slate-500">Email</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-900 break-all">
                  {EMAIL}
                </p>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={copyEmail}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#48D886]" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <a
                  href={`mailto:${EMAIL}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#1D9CA1] px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-[#1a8a8e] active:scale-95"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Email us
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
