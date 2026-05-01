'use client';

import Image from 'next/image';
import { cn } from './cn';

type LogoVariant = 'gradient' | 'light' | 'dark' | 'mono';
type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  className?: string;
  wordmark?: boolean;
  variant?: LogoVariant;
  size?: LogoSize;
  href?: string;
  tagline?: string;
}

const SIZE_PX: Record<LogoSize, { icon: number; text: string }> = {
  sm: { icon: 24, text: 'text-sm' },
  md: { icon: 32, text: 'text-base' },
  lg: { icon: 40, text: 'text-lg' },
  xl: { icon: 56, text: 'text-2xl' },
};

/**
 * BoostMyBranding rocket logo. Renders the actual client-supplied rocket
 * asset as a masked SVG so we can recolor it (gradient / light / dark) per
 * placement. The rocket silhouette is a hand-traced path from the logo PNG.
 */
export function Logo({
  className,
  wordmark = true,
  variant = 'gradient',
  size = 'md',
  tagline,
}: LogoProps) {
  const { icon, text } = SIZE_PX[size];

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <RocketMark size={icon} variant={variant} />
      {wordmark ? (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              'font-bold tracking-tight',
              text,
              variant === 'light' ? 'text-white' : 'text-slate-900',
            )}
          >
            Boost<span className="text-[#1D9CA1]">My</span>Branding
          </span>
          {tagline ? (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
              {tagline}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface RocketMarkProps {
  size?: number;
  variant?: LogoVariant;
  className?: string;
}

export function RocketMark({ size = 32, variant = 'gradient', className }: RocketMarkProps) {
  const fillId = `rocket-fill-${variant}`;

  const fill =
    variant === 'gradient'
      ? `url(#${fillId})`
      : variant === 'light'
        ? '#FFFFFF'
        : variant === 'dark'
          ? '#0B1220'
          : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="BoostMyBranding"
      role="img"
    >
      {variant === 'gradient' ? (
        <defs>
          <linearGradient id={fillId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#48D886" />
            <stop offset="0.55" stopColor="#1D9CA1" />
            <stop offset="1" stopColor="#FFEC3D" />
          </linearGradient>
        </defs>
      ) : null}

      {/* Rocket body (hand-traced from the supplied logo) */}
      <g fill={fill}>
        {/* Nose cone + body */}
        <path
          d="M44 6c1.5 0 3 .4 4.3 1.3 1.3.8 2.3 2 3 3.4.7 1.3 1 2.8.9 4.3-.2 1.5-.7 3-1.6 4.2l-17 23.6-5-3.4L45.2 15c.2-.3.3-.7.2-1-.1-.4-.3-.7-.6-.9-.3-.2-.7-.3-1-.2-.4 0-.7.3-.9.6L27.7 34.7l-5-3.4 16.9-23.6c.8-1.1 1.9-1.9 3.2-2.3 1-.3 2.1-.5 3.2-.5Z"
        />
        {/* Lower body */}
        <path d="M26.5 35.5l6.3 4.3-5.2 7.3-6.3-4.3 5.2-7.3Z" />
        {/* Left fin / exhaust trail */}
        <path d="M20 41c-3 1-5.7 3-7.8 5.6-2 2.7-3.2 5.8-3.4 9.2 3.4-.5 6.6-1.9 9.2-4 2.7-2 4.7-4.7 5.9-7.8L20 41Z" />
        {/* Right fin */}
        <path d="M34 52c.5 2 1.7 3.9 3.3 5.3 1.7 1.3 3.7 2.1 5.8 2.3l-3.2-10.4L34 52Z" />
        {/* Flame accent */}
        <path
          d="M18 52c-1 1.5-1.5 3.3-1.4 5.1.1 1.8.7 3.5 1.9 4.9 1.6-.5 3-1.5 4-2.9 1-1.3 1.5-3 1.5-4.6-.2-1.6-1-3.1-2.2-4.1L18 52Z"
          opacity="0.85"
        />
      </g>
    </svg>
  );
}

interface LogoPngProps {
  size?: number;
  className?: string;
  /** Use when placing on dark backgrounds; the source PNG is white/transparent. */
  invert?: boolean;
}

/**
 * Renders the client-supplied PNG directly. Useful on fully dark hero panels
 * where the SVG trace is too simplified.
 */
export function LogoPng({ size = 40, className, invert }: LogoPngProps) {
  return (
    <Image
      src="/logo/boost-rocket.png"
      alt="BoostMyBranding"
      width={size}
      height={size}
      className={cn('object-contain', invert ? 'invert' : '', className)}
      priority
    />
  );
}
