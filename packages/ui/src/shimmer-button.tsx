'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'md' | 'lg';
}

/**
 * Premium CTA with an animated gradient frame. Uses a dedicated @property
 * CSS registration (see styles.css) so the gradient angle can be animated.
 * Falls back to a static border gradient if @property isn't supported.
 */
export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  ({ className, size = 'lg', children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'group relative inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-2xl bg-slate-900 font-semibold text-white transition-transform active:scale-[0.98]',
        size === 'lg' ? 'h-14 px-7 text-base' : 'h-11 px-5 text-sm',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-[-2px] rounded-2xl opacity-70 blur-md transition-opacity group-hover:opacity-100 shimmer-spin"
        style={{
          background:
            'conic-gradient(from var(--shimmer-angle, 0deg), transparent 0deg, #48D886 80deg, #1D9CA1 160deg, #FFEC3D 240deg, transparent 320deg)',
        }}
      />
      <span className="absolute inset-[1px] rounded-2xl bg-slate-900" aria-hidden />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  ),
);
ShimmerButton.displayName = 'ShimmerButton';
