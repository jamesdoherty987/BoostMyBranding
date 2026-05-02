/**
 * Liquid Blob — vertical close card with morphing gradient blobs.
 *
 * Polished version:
 * - Configurable duration, headline size, mood (affects blob speed)
 * - Three-phase animation: blob settle → text reveal → hold
 * - Depth layer with backlight glow behind headline
 * - Optional accent styles: underline, dot, bar, ring, none
 * - Smoother easing throughout with custom bezier curves
 */

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Sequence,
  Easing,
} from 'remotion';
import { FONTS, moodSpeed } from '../types';
import type { VideoProps } from '../types';
import { Rise, SceneFade, BrandMark } from '../components/helpers';

const bezier = Easing.bezier(0.22, 1, 0.36, 1);

const Blob: React.FC<{
  r?: number;
  x: number;
  y: number;
  c1: string;
  c2: string;
  seed?: number;
  delay?: number;
  speed?: number;
}> = ({ r = 320, x, y, c1, c2, seed = 0, delay = 0, speed = 1 }) => {
  const f = useCurrentFrame();
  const t = (f + seed * 37) * 0.025 * speed;
  // Graceful, slower motion with micro-oscillation for life
  const bx = x + Math.sin(t) * 70 + Math.sin(t * 2.3) * 20;
  const by = y + Math.cos(t * 0.7) * 50 + Math.cos(t * 1.7) * 15;
  const sc = 1 + Math.sin(t * 0.8) * 0.1;
  const op = interpolate(f - delay, [0, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: bezier,
  });
  return (
    <div
      style={{
        position: 'absolute',
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        left: bx,
        top: by,
        transform: `translate(-50%,-50%) scale(${sc})`,
        background: `radial-gradient(circle at 40% 40%, ${c1} 0%, ${c2} 60%, transparent 75%)`,
        filter: 'blur(24px)',
        opacity: op * 0.85,
        mixBlendMode: 'screen',
      }}
    />
  );
};

const Scene: React.FC<VideoProps> = ({
  businessName,
  headline,
  subheadline,
  cta = 'Get started',
  domain,
  brand,
  options,
}) => {
  const f = useCurrentFrame();

  const headlineSize = options?.headlineSize ?? 180;
  const headlineFont = options?.headlineFont ?? 'serif';
  const accentStyle = options?.accentStyle ?? 'underline';
  const speed = moodSpeed(options?.mood);
  const intensity = options?.intensity ?? 1;
  const showBrandMark = options?.showBrandMark ?? true;
  const showCta = options?.showCta ?? true;

  // Staggered animations
  const underlinePct = interpolate(f, [50, 85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: bezier,
  });

  // Depth glow behind headline — builds slowly
  const glowStrength = interpolate(f, [30, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ background: brand.dark }}>
      {/* Filters */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="liquidGoo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="30" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" />
          </filter>
          <filter id="liquidGrain">
            <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="2" seed={f % 8} />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0" />
          </filter>
        </defs>
      </svg>

      {/* Blob field */}
      <AbsoluteFill style={{ filter: 'url(#liquidGoo)', opacity: intensity }}>
        <Blob x={300} y={500} c1={brand.primary} c2={brand.accent} seed={0} delay={0} speed={speed} />
        <Blob x={760} y={700} c1={brand.accent} c2={brand.primary} seed={1} delay={8} speed={speed} />
        <Blob x={540} y={1200} c1={brand.pop} c2={brand.primary} seed={2} delay={16} speed={speed} />
        <Blob x={200} y={1500} c1={brand.primary} c2={brand.accent} seed={3} delay={24} speed={speed} />
        <Blob x={880} y={1400} c1={brand.accent} c2={brand.pop} seed={4} delay={32} speed={speed} />
      </AbsoluteFill>

      {/* Depth backlight behind headline */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 700,
          height: 400,
          marginLeft: -350,
          marginTop: -200,
          background: `radial-gradient(ellipse, ${brand.accent}${Math.floor(glowStrength * 60).toString(16).padStart(2, '0')}, transparent 70%)`,
          filter: 'blur(60px)',
          opacity: glowStrength,
        }}
      />

      {/* Grain */}
      <AbsoluteFill style={{ filter: 'url(#liquidGrain)', mixBlendMode: 'overlay', pointerEvents: 'none' }} />

      {/* Content stack */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 60px',
        }}
      >
        {subheadline && (
          <Rise delay={18} dur={18}>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 24,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: 8,
                textTransform: 'uppercase',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              {subheadline}
            </div>
          </Rise>
        )}

        <Rise delay={30} from={60} dur={28}>
          <div
            style={{
              fontFamily: headlineFont === 'serif' ? FONTS.serif : FONTS.display,
              fontSize: headlineSize,
              color: '#fff',
              letterSpacing: headlineFont === 'serif' ? -9 : -6,
              lineHeight: 0.92,
              textAlign: 'center',
              marginTop: 22,
              fontWeight: headlineFont === 'serif' ? 700 : 900,
              textShadow: '0 8px 40px rgba(0,0,0,0.5)',
              position: 'relative',
              display: 'inline-block',
            }}
          >
            {headline}

            {/* Accent decoration */}
            {accentStyle === 'underline' && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -8,
                  height: 4,
                  width: `${underlinePct * 60}%`,
                  transform: 'translateX(-50%)',
                  background: `linear-gradient(90deg, ${brand.accent}, ${brand.pop})`,
                  borderRadius: 2,
                }}
              />
            )}
            {accentStyle === 'dot' && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -24,
                  width: 14,
                  height: 14,
                  marginLeft: -7,
                  borderRadius: '50%',
                  background: brand.pop,
                  boxShadow: `0 0 20px ${brand.pop}`,
                  opacity: underlinePct,
                  transform: `scale(${underlinePct})`,
                }}
              />
            )}
            {accentStyle === 'bar' && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -16,
                  height: 8,
                  width: `${underlinePct * 140}px`,
                  transform: 'translateX(-50%)',
                  background: brand.accent,
                  borderRadius: 4,
                }}
              />
            )}
            {accentStyle === 'ring' && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 440 * underlinePct,
                  height: 180 * underlinePct,
                  marginLeft: -220 * underlinePct,
                  marginTop: -90 * underlinePct,
                  border: `2px solid ${brand.accent}`,
                  borderRadius: 200,
                  opacity: 0.6,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </Rise>

        {showBrandMark && (
          <Rise delay={80} dur={16} style={{ marginTop: 70 }}>
            <BrandMark businessName={businessName} color="#fff" size={54} markColor={brand.accent} />
          </Rise>
        )}

        {showCta && (
          <Rise delay={92} dur={16} style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div
                style={{
                  padding: '16px 34px',
                  background: '#fff',
                  color: brand.dark,
                  borderRadius: 999,
                  fontFamily: FONTS.display,
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: -0.3,
                }}
              >
                {cta}
              </div>
              {domain && (
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: 22,
                  }}
                >
                  {domain}
                </span>
              )}
            </div>
          </Rise>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const LiquidBlob: React.FC<VideoProps> = (props) => {
  const duration = props.options?.duration ?? 450;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={duration}>
        <SceneFade dur={duration}>
          <Scene {...props} />
        </SceneFade>
      </Sequence>
    </AbsoluteFill>
  );
};

export const LiquidBlobMeta = {
  id: 'liquid-blob',
  name: 'Liquid Gradient',
  description: 'Morphing brand-colored blobs with elegant serif typography, depth backlight, and configurable accent styles.',
  durationFrames: 450,
  usesImage: false,
  bestFor: ['promotional', 'announcement', 'brand-story'] as const,
};
