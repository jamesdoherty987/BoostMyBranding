'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from './cn';

interface ParallaxProps {
  children: ReactNode;
  /** Pixel offset at scroll end. Positive moves up. */
  offset?: number;
  className?: string;
}

/**
 * Parallax layer that translates on vertical scroll while its container is in view.
 * Use multiple layers with different offsets to create depth.
 */
export function Parallax({ children, offset = 80, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  return (
    <motion.div ref={ref} style={{ y }} className={cn('will-change-transform', className)}>
      {children}
    </motion.div>
  );
}
