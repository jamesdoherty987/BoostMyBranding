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
 * BoostMyBranding logo. Uses the real cutout PNG rocket (BMBGreen.PNG) —
 * transparent background, no added tile or backdrop. The PNG is RGBA so it
 * sits cleanly on any surface.
 *
 * Wordmark uses brand colors in a three-tone split: slate "Boost", teal
 * "My", slate "Branding". On dark backgrounds the outer words flip to white.
 */
export function Logo({
  className,
  wordmark = true,
  variant = 'default',
  size = 'md',
  tagline,
}: LogoProps) {
  const { icon, text } = SIZE_PX[size];

  const boostColor = variant === 'light' ? 'text-white' : 'text-slate-900';
  const brandingColor = variant === 'light' ? 'text-white' : 'text-slate-900';

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <RocketMark size={icon} />
      {wordmark ? (
        <div className="flex flex-col leading-none">
          <span className={cn('font-bold tracking-tight', text)}>
            <span className={boostColor}>Boost</span>
            <span className="text-[#3CC878]">My</span>
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
 * Just the rocket cutout, no wordmark. Transparent-background PNG served
 * from /logo/boost-rocket.png. Marked `unoptimized` so Next's image
 * optimizer doesn't re-encode the RGBA transparency.
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
 * Legacy alias — kept for backwards compatibility.
 */
export function LogoPng({ size = 40, className }: LogoPngProps) {
  return <RocketMark size={size} className={className} />;
}
