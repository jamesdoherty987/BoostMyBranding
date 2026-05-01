'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}

/**
 * Counts up from 0 → value when scrolled into view. Honors prefers-reduced-motion
 * and falls back to the final value during SSR so the page never flashes "0".
 */
export function AnimatedCounter({ value, suffix = '', prefix = '', duration = 1.6 }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(reduced ? value : 0);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });
  // Start with `value` to avoid flashing "0" on server-rendered markup.
  const [display, setDisplay] = useState(value);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!reduced) setDisplay(0);
  }, [reduced]);

  useEffect(() => {
    if (mounted && inView && !reduced) motionValue.set(value);
  }, [inView, motionValue, value, mounted, reduced]);

  useEffect(() => {
    const unsub = spring.on('change', (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);

  return (
    <span ref={ref}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
