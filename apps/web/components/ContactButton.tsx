'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X } from 'lucide-react';
import { Button } from '@boost/ui';

/**
 * Floating "Get in touch" button that opens a small email popup.
 * Renders fixed in the bottom-right corner of the viewport.
 */
export function ContactButton() {
  const [open, setOpen] = useState(false);

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
        <Mail className="h-5 w-5" />
        <span className="hidden text-sm font-medium md:inline">Get in touch</span>
      </motion.button>

      {/* Popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-5 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Get in touch</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Drop us an email and we&apos;ll get back to you within a day.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <a href="mailto:contact@boostmybranding.com" className="mt-4 block">
              <Button size="lg" className="w-full">
                <Mail className="h-4 w-4" />
                contact@boostmybranding.com
              </Button>
            </a>

            <p className="mt-3 text-center text-[11px] text-slate-400">
              Or call us — we&apos;re real people.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
