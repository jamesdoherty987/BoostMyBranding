'use client';

/**
 * Parallax-drifting icons or emojis that populate a hero background.
 * Accepts a mix of Lucide icon names ("Coffee") and raw emoji ("☕") so
 * Claude can pick whatever reads best for the business.
 *
 * Each icon gets:
 *   - a pseudo-random resting position anchored to a 4x3 grid
 *   - an independent Y drift with a long, sinusoidal period
 *   - an independent rotation
 *
 * All motion respects `prefers-reduced-motion`. When reduced, icons render
 * statically at their resting positions so the hero still has texture.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { cn } from '../../cn';
import { resolveIcon, ICON_MAP } from '../icon-map';

interface FloatingIconsProps {
  className?: string;
  /** Icon names or emojis. 6–10 recommended. */
  icons: string[];
  /** Brand tint applied to Lucide icons. */
  color: string;
  /** Opacity applied to every icon. Default 0.14. */
  opacity?: number;
}

export function FloatingIcons({
  className,
  icons,
  color,
  opacity = 0.14,
}: FloatingIconsProps) {
  const reduced = useReducedMotion();

  const items = useMemo(() => {
    if (!icons.length) return [];
    return icons.slice(0, 10).map((name, i) => {
      // Deterministic pseudo-random position so SSR and CSR agree.
      const seed = (i * 9301 + 49297) % 233280;
      const jitter = seed / 233280;
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 15 + col * 22 + jitter * 8; // 15–85% horizontally
      const y = 18 + row * 26 + jitter * 6; // 18–86% vertically
      const size = 32 + Math.round(jitter * 24); // 32–56px
      const duration = 6 + jitter * 6; // 6–12s drift
      const delay = jitter * 2;
      const rotate = (jitter - 0.5) * 30; // -15° to +15°
      return { name, x, y, size, duration, delay, rotate, key: `fi-${i}-${name}` };
    });
  }, [icons]);

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {items.map((it) => {
        const isLucide = Boolean(ICON_MAP[it.name]);
        return (
          <motion.div
            key={it.key}
            className="absolute"
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              color,
              opacity,
            }}
            initial={{ y: 0, rotate: it.rotate }}
            animate={
              reduced
                ? { y: 0, rotate: it.rotate }
                : {
                    y: [0, -18, 0, 18, 0],
                    rotate: [it.rotate, it.rotate + 6, it.rotate, it.rotate - 6, it.rotate],
                  }
            }
            transition={
              reduced
                ? undefined
                : {
                    duration: it.duration,
                    delay: it.delay,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
          >
            {isLucide ? (
              <LucideFloat name={it.name} size={it.size} />
            ) : (
              <span
                style={{
                  fontSize: it.size,
                  lineHeight: 1,
                  // Emojis should stay in full color — opacity already applied on parent.
                  color: 'inherit',
                  filter: 'grayscale(0.15)',
                }}
              >
                {it.name}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function LucideFloat({ name, size }: { name: string; size: number }) {
  const Icon = resolveIcon(name);
  return <Icon size={size} strokeWidth={1.5} />;
}
