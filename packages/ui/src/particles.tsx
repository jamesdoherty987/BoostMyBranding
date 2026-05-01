'use client';

import { useEffect, useRef } from 'react';
import { cn } from './cn';

interface ParticlesProps {
  className?: string;
  quantity?: number;
  /** Single color, or a palette of colors to mix across particles. */
  color?: string | string[];
  speed?: number;
  /** Max particle radius in CSS pixels. Default 3. */
  maxSize?: number;
}

/**
 * Lightweight canvas particle field. Renders crisp on HiDPI screens, gently
 * floats particles upward with slight mouse attraction, and wraps them around
 * the edges so the field stays populated. Uses a persistent RAF loop, a
 * pointer listener on the document (not the wrapper) so mouse reaction works
 * even when the particles sit behind other elements via pointer-events: none.
 */
export function Particles({
  className,
  quantity = 60,
  color = '#1D9CA1',
  speed = 0.3,
  maxSize = 3,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapperRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect OS-level reduced motion.
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mql.matches) return;

    // Normalize + validate the color palette. Invalid entries are filtered out
    // so `fillStyle` never receives a string the canvas can't parse.
    const rawPalette = Array.isArray(color) ? color : [color];
    const palette = rawPalette.filter((c) => /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(c));
    if (palette.length === 0) palette.push('#1D9CA1');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999 };

    type P = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      colorIndex: number;
      phase: number;
    };
    let particles: P[] = [];
    let width = 0;
    let height = 0;

    const seedParticles = (): P[] =>
      Array.from({ length: quantity }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * speed,
        vy: -(Math.random() * speed + speed * 0.45),
        size: Math.random() * (maxSize - 0.6) + 0.6,
        // Higher base alpha so each particle is clearly visible on the light backdrop.
        alpha: Math.random() * 0.35 + 0.65,
        colorIndex: Math.floor(Math.random() * palette.length),
        phase: Math.random() * Math.PI * 2,
      }));

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // setTransform (not scale) so repeated calls don't compound.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = seedParticles();
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Pointer listener is on the document so the field reacts even when
    // it sits behind other z-indexed layers (the wrapper is pointer-events:none).
    const onPointer = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    document.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.016;
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        // Sinusoidal horizontal drift so particles sway as they rise.
        p.vx += Math.sin(t * 0.7 + p.phase) * 0.003;

        // Mouse attraction when near.
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140 && dist > 0) {
          p.vx += (dx / dist) * 0.025;
          p.vy += (dy / dist) * 0.025;
        }
        p.vx *= 0.97;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around when floating off the top.
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
          p.vy = -(Math.random() * speed + speed * 0.35);
          p.vx = (Math.random() - 0.5) * speed;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        // Slightly stronger opacity pulse so particles are visibly shimmering.
        const shimmer = 0.65 + 0.35 * Math.sin(t * 1.4 + p.phase);
        const c = palette[p.colorIndex] ?? palette[0]!;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = hexWithAlpha(c, p.alpha * shimmer);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('pointermove', onPointer);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [quantity, color, speed, maxSize]);

  return (
    <div
      ref={wrapperRef}
      className={cn('pointer-events-none absolute inset-0', className)}
      aria-hidden
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

function hexWithAlpha(hex: string, alpha: number) {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
