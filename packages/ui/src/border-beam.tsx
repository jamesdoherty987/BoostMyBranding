'use client';

import { cn } from './cn';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
}

/**
 * A radial "comet" glow that travels along a container's border. Apply to a
 * relatively-positioned element — the beam sits inside it as a mask-clipped
 * gradient. Pure CSS, no JavaScript animation needed.
 */
export function BorderBeam({
  className,
  size = 200,
  duration = 8,
  colorFrom = '#48D886',
  colorTo = '#1D9CA1',
}: BorderBeamProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]', className)}
      style={{
        maskImage: 'linear-gradient(white, white)',
      }}
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          padding: '1.5px',
          background: `radial-gradient(${size}px circle at var(--x, 50%) var(--y, 50%), ${colorFrom}, ${colorTo}, transparent 40%)`,
          WebkitMask:
            'linear-gradient(white, white) content-box, linear-gradient(white, white)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude' as any,
          animation: `border-beam ${duration}s linear infinite`,
        }}
      />
    </div>
  );
}
