'use client';

import { useEffect, useRef } from 'react';
import { cn } from './cn';

interface ParticlesProps {
  className?: string;
  quantity?: number;
  color?: string;
  speed?: number;
}

/**
 * Lightweight canvas particle field. Renders at the DPR of the device and
 * gently floats particles upward while the cursor draws them toward it.
 * Kept dependency-free for performance.
 */
export function Particles({
  className,
  quantity = 60,
  color = '#1D9CA1',
  speed = 0.3,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapperRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();

    const ro = new ResizeObserver(() => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      resize();
    });
    ro.observe(wrap);

    type P = { x: number; y: number; vx: number; vy: number; size: number; alpha: number };
    const rect = () => wrap.getBoundingClientRect();
    const init = (): P[] =>
      Array.from({ length: quantity }, () => {
        const r = rect();
        return {
          x: Math.random() * r.width,
          y: Math.random() * r.height,
          vx: (Math.random() - 0.5) * speed,
          vy: -(Math.random() * speed + speed * 0.3),
          size: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.5 + 0.3,
        };
      });
    let particles = init();

    const onMouse = (e: MouseEvent) => {
      const r = rect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    wrap.addEventListener('mousemove', onMouse);
    wrap.addEventListener('mouseleave', onLeave);

    let raf = 0;
    const tick = () => {
      const r = rect();
      ctx.clearRect(0, 0, r.width, r.height);
      for (const p of particles) {
        // drift with a slight mouse attraction
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          p.vx += (dx / dist) * 0.02;
          p.vy += (dy / dist) * 0.02;
        }
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.x += p.vx;
        p.y += p.vy;
        // Wrap-around
        if (p.y < -10) {
          p.y = r.height + 10;
          p.x = Math.random() * r.width;
        }
        if (p.x < -10) p.x = r.width + 10;
        if (p.x > r.width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = hexWithAlpha(color, p.alpha);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener('mousemove', onMouse);
      wrap.removeEventListener('mouseleave', onLeave);
    };
  }, [quantity, color, speed]);

  return (
    <div ref={wrapperRef} className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}

function hexWithAlpha(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
