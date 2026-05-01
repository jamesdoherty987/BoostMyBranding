'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';

interface BentoCellProps {
  className?: string;
  children?: ReactNode;
  title?: string;
  description?: string;
  icon?: ReactNode;
  background?: ReactNode;
  /** Uses tailwind col-span + row-span classes for the grid layout. */
  span?: string;
}

/**
 * Bento cell. Places title + description at the bottom of a tall card, with an
 * optional decorative background fill. Subtle hover lift for interactivity.
 */
export function BentoCell({
  className,
  title,
  description,
  icon,
  background,
  children,
  span,
}: BentoCellProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl',
        span,
        className,
      )}
    >
      {background ? (
        <div className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_20%,transparent_80%)]">
          {background}
        </div>
      ) : null}
      <div className="relative flex h-full flex-col">
        {icon ? (
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-cta text-white shadow-brand">
            {icon}
          </div>
        ) : null}
        {children}
        {(title || description) && (
          <div className="mt-auto pt-6">
            {title ? <h3 className="text-lg font-semibold text-slate-900">{title}</h3> : null}
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[220px]',
        className,
      )}
    >
      {children}
    </div>
  );
}
