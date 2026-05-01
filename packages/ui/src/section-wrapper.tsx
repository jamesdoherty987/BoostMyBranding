'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from './cn';

interface SectionWrapperProps extends HTMLMotionProps<'section'> {
  delay?: number;
  /**
   * When true, disables the scroll-triggered reveal and renders fully visible.
   * Use inside embedded previews (e.g. the dashboard preview pane) where the
   * scrollable root isn't the viewport and `whileInView` observers won't fire
   * reliably.
   */
  immediate?: boolean;
}

/**
 * Section wrapper with scroll-triggered fade-and-rise animation.
 * Reused across all marketing pages for consistent reveal animation.
 */
export function SectionWrapper({
  children,
  className,
  delay = 0,
  immediate = false,
  ...props
}: SectionWrapperProps) {
  if (immediate) {
    return (
      <motion.section
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className={cn('relative', className)}
        {...props}
      >
        {children}
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px', amount: 0.15 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('relative', className)}
      {...props}
    >
      {children}
    </motion.section>
  );
}
