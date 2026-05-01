'use client';

import Image from 'next/image';
import { cn } from './cn';

type LogoVariant = 'default' | 'light' | 'dark';
type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  className?: string;
  wordmark?: boolean;
  variant?: LogoVariant;
  size?: LogoSize;
  tagline?: string;
}

const SIZE_PX: Record<LogoSize, { icon: number; text: string }> = {
  sm: { icon: 24, text: 'text-sm' },
  md: { icon: 32, text: 'text-base' },
  lg: { icon: 40, text: 'text-lg' },
  xl: { icon: 56, text: 'text-2xl' },
};

/**
 * BoostMyBranding logo. Uses the real PNG rocket the client supplied so it
 * always looks exactly as they drew it — no hand-traced approximation.
 *
 * Wordmark uses brand colors in a three-tone split: green "Boost", teal
 * "My", yellow "Branding". On dark backgrounds the same tones stay visible;
 * only the outer "Boost" and "Branding" flip to keep contrast.
 */
export function Logo({
  className,
  wordmark = true,
  variant = 'default',
  size = 'md',
  tagline,
}: LogoProps) {
  const { icon, text } = SIZE_PX[size];

  // Outer letters adapt to the backdrop; middle letters always brand-colored.
  const boostColor = variant === 'light' ? 'text-white' : 'text-slate-900';
  const brandingColor = variant === 'light' ? 'text-white' : 'text-slate-900';

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <RocketMark size={icon} />
      {wordmark ? (
        <div className="flex flex-col leading-none">
          <span className={cn('font-bold tracking-tight', text)}>
            <span className={boostColor}>Boost</span>
            <span className="text-[#1D9CA1]">My</span>
            <span className={brandingColor}>Branding</span>
          </span>
          {tagline ? (
            <span
              className={cn(
                'mt-1 text-[10px] font-medium uppercase tracking-[0.2em]',
                variant === 'light' ? 'text-white/60' : 'text-slate-500',
              )}
            >
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
  className?: string;
}

/**
 * Just the rocket, no wordmark. Always the real PNG so the mark stays
 * consistent across placements. Marked `unoptimized` because Next 15's
 * image optimizer rejects some PNG variants with "not a valid image";
 * the PNG is only 96KB so we lose nothing by serving it as-is.
 */
export function RocketMark({ size = 32, className }: RocketMarkProps) {
  return (
    <Image
      src="/logo/boost-rocket.png"
      alt="BoostMyBranding"
      width={size}
      height={size}
      priority
      unoptimized
      className={cn('object-contain', className)}
    />
  );
}

interface LogoPngProps {
  size?: number;
  className?: string;
}

/**
 * Legacy alias — kept for backwards compatibility with call-sites that
 * previously distinguished PNG vs SVG. Now both are the same PNG.
 */
export function LogoPng({ size = 40, className }: LogoPngProps) {
  return <RocketMark size={size} className={className} />;
}
