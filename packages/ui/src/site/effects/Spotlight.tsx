'use client';

/**
 * Premium mouse-following spotlight. Pointer movement inside the host
 * section drives a large radial gradient that feels soft and expensive.
 * Ideal for professional / medical / premium templates where the hero
 * shouldn't shout but should feel considered.
 *
 * When the mouse leaves the host, the spotlight drifts gently to the
 * center rather than snapping — preserves the premium feel.
 *
 * The listener is scoped to the host section (not the window) so the
 * component can be composed with other effects without fighting over
 * pointer events.
 */

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '../../cn';

interface SpotlightProps {
  className?: string;
  /** Brand color for the glow. */
  color: string;
  /** Radius of the spotlight in CSS pixels. Default 420. */
  size?: number;
  /** Opacity of the glow at center. Default 0.25. */
  intensity?: number;
}

export function Spotlight({
  className,
  color,
  size = 420,
  intensity = 0.25,
}: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    // Reduced motion: park the spotlight at the center with no listeners.
    if (reduced) {
      host.style.setProperty('--spot-x', '50%');
      host.style.setProperty('--spot-y', '40%');
      return;
    }

    let rafId = 0;
    let targetX = 50;
    let targetY = 40;
    let currentX = 50;
    let currentY = 40;

    // Scope the listener to the nearest relatively-positioned ancestor
    // (the hero section) so pointer coords are local.
    const section = host.parentElement;
    if (!section) return;

    const onMove = (e: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width) * 100;
      targetY = ((e.clientY - rect.top) / rect.height) * 100;
    };

    const onLeave = () => {
      targetX = 50;
      targetY = 40;
    };

    const loop = () => {
      // Exponential ease so the glow feels liquid, not snappy.
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      host.style.setProperty('--spot-x', `${currentX}%`);
      host.style.setProperty('--spot-y', `${currentY}%`);
      rafId = requestAnimationFrame(loop);
    };

    section.addEventListener('pointermove', onMove);
    section.addEventListener('pointerleave', onLeave);
    rafId = requestAnimationFrame(loop);

    return () => {
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(rafId);
    };
  }, [reduced]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        background: `radial-gradient(${size}px circle at var(--spot-x, 50%) var(--spot-y, 40%), ${color}${toHexAlpha(intensity)}, transparent 70%)`,
        transition: reduced ? 'none' : undefined,
      }}
    />
  );
}

/** Convert a 0–1 opacity to a 2-char hex alpha suffix. */
function toHexAlpha(opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  return Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
}
