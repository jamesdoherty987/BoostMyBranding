'use client';

import { cn } from './cn';

interface RetroGridProps {
  className?: string;
  angle?: number;
}

/**
 * Subtle animated perspective grid used behind heroes. Pure CSS, no canvas.
 */
export function RetroGrid({ className, angle = 65 }: RetroGridProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden [perspective:200px]',
        className,
      )}
      style={{ perspective: '200px' }}
    >
      <div
        className="absolute inset-0 [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${angle}deg)` }}
      >
        <div
          className="animate-[retro-grid_14s_linear_infinite] [background-size:80px_80px] [height:200vh] [inset:0%_0px] [margin-left:-50%] [transform-origin:100%_0_0] [width:200vw]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(29,156,161,0.25) 1px, transparent 0), linear-gradient(to bottom, rgba(29,156,161,0.25) 1px, transparent 0)',
          }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}
