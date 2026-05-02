/**
 * Shared low-level animation primitives used across all video templates.
 * Every helper respects Remotion's frame-based timeline.
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { FONTS } from '../types';

/** Full-scene crossfade — fades in at the start, holds, fades out at the end. */
export const SceneFade: React.FC<{
  children: React.ReactNode;
  dur: number;
  hold?: number;
}> = ({ children, dur, hold = 8 }) => {
  const f = useCurrentFrame();
  const op = interpolate(f, [0, hold, dur - hold, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>;
};

/** Rises from below with a cubic ease-out. Standard in-animation for text. */
export const Rise: React.FC<{
  children: React.ReactNode;
  delay?: number;
  from?: number;
  dur?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, from = 30, dur = 14, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f - delay, [0, dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${(1 - p) * from}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Scales in from 0.92 with a snappy spring-like curve. */
export const Pop: React.FC<{
  children: React.ReactNode;
  delay?: number;
  dur?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, dur = 12, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f - delay, [0, dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.4)),
  });
  return (
    <div
      style={{
        opacity: p,
        transform: `scale(${0.92 + p * 0.08})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Business name + mark, consistent across all templates. */
export const BrandMark: React.FC<{
  businessName: string;
  color?: string;
  size?: number;
  markColor?: string;
}> = ({ businessName, color = '#0b1220', size = 42, markColor }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontFamily: FONTS.display,
    }}
  >
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        background: markColor ?? color,
        color: markColor ? '#fff' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONTS.serif,
        fontWeight: 800,
        fontSize: size * 0.58,
      }}
    >
      {businessName.charAt(0).toUpperCase()}
    </div>
    <span
      style={{
        fontSize: size * 0.6,
        fontWeight: 800,
        letterSpacing: -0.4,
        color,
      }}
    >
      {businessName}
    </span>
  </div>
);
