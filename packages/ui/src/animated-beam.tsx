'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { motion } from 'framer-motion';

interface AnimatedBeamProps {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  curvature?: number;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStart?: string;
  gradientStop?: string;
}

/**
 * Animated gradient beam connecting two DOM elements inside a container.
 * Ideal for showing "integrations" or "flow" in landing heroes.
 * Self-contained SVG with gradient animation + ResizeObserver for responsiveness.
 */
export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 4,
  delay = 0,
  pathColor = '#e2e8f0',
  pathWidth = 2,
  pathOpacity = 0.4,
  gradientStart = '#48D886',
  gradientStop = '#1D9CA1',
}: AnimatedBeamProps) {
  const id = useId();
  const [path, setPath] = useState('');
  const [size, setSize] = useState({ w: 0, h: 0 });

  const update = () => {
    const c = containerRef.current;
    const f = fromRef.current;
    const t = toRef.current;
    if (!c || !f || !t) return;
    const cr = c.getBoundingClientRect();
    const fr = f.getBoundingClientRect();
    const tr = t.getBoundingClientRect();

    const sx = fr.left - cr.left + fr.width / 2;
    const sy = fr.top - cr.top + fr.height / 2;
    const ex = tr.left - cr.left + tr.width / 2;
    const ey = tr.top - cr.top + tr.height / 2;
    const cx = (sx + ex) / 2;
    const cy = (sy + ey) / 2 - curvature;

    setPath(`M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`);
    setSize({ w: cr.width, h: cr.height });
  };

  useEffect(() => {
    update();
    const ro = new ResizeObserver(() => update());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!path) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      aria-hidden
    >
      <path d={path} stroke={pathColor} strokeOpacity={pathOpacity} strokeWidth={pathWidth} fill="none" />
      <motion.path
        d={path}
        stroke={`url(#${id})`}
        strokeWidth={pathWidth + 0.5}
        strokeLinecap="round"
        fill="none"
        initial={{ strokeDasharray: '0 1000', strokeDashoffset: 0 }}
        animate={{ strokeDasharray: ['0 1000', '30 970', '0 1000'] }}
        transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
      />
      <defs>
        <motion.linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          initial={{ x1: reverse ? '100%' : '0%', x2: reverse ? '0%' : '100%' }}
        >
          <stop stopColor={gradientStart} stopOpacity="0" />
          <stop offset="50%" stopColor={gradientStart} />
          <stop offset="100%" stopColor={gradientStop} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
}
