'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';

interface OrbitProps {
  children: ReactNode;
  className?: string;
  /** Size of each orbit item in pixels. */
  iconSize?: number;
  /** Radius of the orbit in pixels. */
  radius?: number;
  /** Duration of one full orbit in seconds. */
  duration?: number;
  reverse?: boolean;
  delay?: number;
}

/**
 * Orbits a set of children around a central point. Wrap multiple `<Orbit>`s
 * at different radii for a cool tech-graph effect.
 */
export function Orbit({
  children,
  className,
  iconSize = 40,
  radius = 160,
  duration = 20,
  reverse = false,
  delay = 0,
}: OrbitProps) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div
      className={cn('absolute inset-0 flex items-center justify-center', className)}
      aria-hidden
    >
      <div
        className="absolute rounded-full border border-slate-200/60"
        style={{
          width: radius * 2,
          height: radius * 2,
          animation: `${reverse ? 'orbit-reverse' : 'orbit'} ${duration}s linear ${delay}s infinite`,
        }}
      >
        {items.map((child, i) => {
          const angle = (360 / items.length) * i;
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                transform: `rotate(${angle}deg) translateX(${radius}px) rotate(-${angle}deg)`,
                width: iconSize,
                height: iconSize,
              }}
            >
              <div
                className="flex h-full w-full items-center justify-center rounded-full border border-slate-200 bg-white shadow-md"
                style={{
                  animation: `${reverse ? 'orbit' : 'orbit-reverse'} ${duration}s linear ${delay}s infinite`,
                }}
              >
                {child}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
