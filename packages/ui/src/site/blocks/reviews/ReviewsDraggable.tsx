'use client';

/**
 * Draggable reviews cards. Each review becomes a physical-feeling card
 * that visitors can drag around the container. Playful and tactile —
 * good for personal-service businesses (salons, cafes, kids' classes)
 * where "fun" fits the brand.
 *
 * Cards are absolutely positioned in a loose layout so they overlap
 * slightly on load; dragging rearranges them. On mobile with limited
 * horizontal space, the container becomes scrollable.
 */

import type { WebsiteConfig } from '@boost/core';
import { Star } from 'lucide-react';
import {
  DraggableCardBody,
  DraggableCardContainer,
} from '../../../aceternity/ui/draggable-card';

interface ReviewsDraggableProps {
  config: WebsiteConfig;
}

// Starting positions — lightly random, skewed around the center so the
// composition feels curated rather than scattered.
const LAYOUTS = [
  { top: '5%', left: '5%', rotate: -6 },
  { top: '10%', left: '45%', rotate: 4 },
  { top: '15%', left: '70%', rotate: -3 },
  { top: '55%', left: '10%', rotate: 2 },
  { top: '50%', left: '50%', rotate: -4 },
  { top: '60%', left: '75%', rotate: 5 },
];

export function ReviewsDraggable({ config }: ReviewsDraggableProps) {
  const reviews = (config.reviews ?? []).slice(0, LAYOUTS.length);
  if (reviews.length === 0) return null;

  return (
    <DraggableCardContainer className="relative mx-auto h-[600px] w-full max-w-6xl">
      {reviews.map((r, i) => {
        const pos = LAYOUTS[i] ?? LAYOUTS[0]!;
        return (
          <div
            key={i}
            // Positioning lives on the wrapper so the DraggableCardBody
            // stays a clean visual card that can be dragged freely.
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              transform: `rotate(${pos.rotate}deg)`,
            }}
          >
            <DraggableCardBody className="flex w-64 flex-col gap-3 rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
              <div
                className="flex items-center gap-0.5"
                style={{ color: 'var(--bmb-site-pop)' }}
              >
                {Array.from({
                  length: Math.max(1, Math.min(5, Math.round(r.rating ?? 5))),
                }).map((_, j) => (
                  <Star key={j} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote className="text-sm text-slate-800">
                &ldquo;{r.text}&rdquo;
              </blockquote>
              <figcaption className="text-xs font-semibold text-slate-500">
                &mdash; {r.author}
              </figcaption>
            </DraggableCardBody>
          </div>
        );
      })}
    </DraggableCardContainer>
  );
}
