'use client';

import { motion } from 'framer-motion';
import { cn } from './cn';

interface AuroraBgProps {
  className?: string;
}

/**
 * Soft, slowly drifting radial-gradient blobs. Place inside a relative container as the background.
 */
export function AuroraBg({ className }: AuroraBgProps) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <motion.div
        className="absolute -top-1/3 -left-1/4 h-[80vh] w-[80vh] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(72,216,134,0.35), transparent 60%)' }}
        animate={{ x: [0, 60, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/4 -right-1/4 h-[70vh] w-[70vh] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(29,156,161,0.30), transparent 60%)' }}
        animate={{ x: [0, -40, 0], y: [0, 60, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-1/4 left-1/4 h-[60vh] w-[60vh] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(255,236,61,0.25), transparent 60%)' }}
        animate={{ x: [0, 30, 0], y: [0, -40, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
