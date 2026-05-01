'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from './cn';

interface SectionWrapperProps extends HTMLMotionProps<'section'> {
  delay?: number;
}

/**
 * Section wrapper with scroll-triggered fade-and-rise animation.
 * Reused across all marketing pages for consistent reveal animation.
 */
export function SectionWrapper({
  children,
  className,
  delay = 0,
  ...props
}: SectionWrapperProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('relative', className)}
      {...props}
    >
      {children}
    </motion.section>
  );
}
