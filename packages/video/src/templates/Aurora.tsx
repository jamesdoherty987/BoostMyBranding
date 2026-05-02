/**
 * Aurora — cinematic flowing light gradients with depth-of-field text reveal.
 *
 * Polished version:
 * - Configurable duration, mood (affects aurora drift speed)
 * - Four aurora layers instead of three for richer light play
 * - Depth-of-field headline reveal with per-word staggered blur
 * - Horizon-line gradient adds subtle grounding
 * - Slight camera-zoom feel on the whole scene
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

const AuroraLayer: React.FC<{
  color: string;
  speed: number;
  seed: number;
  opacity: number;
  size?: number;
  blur?: number;
}> = ({ color, speed, seed, opacity, size = 1800, blur = 80 }) => {
  const f = useCurrentFrame();
  const t = f * speed;

  const x = Math.sin((t + seed * 10) * 0.02) * 300;
  const y = Math.cos((t + seed * 7) * 0.025) * 200;
  const rot = (t + seed * 30) * 0.3;

  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        left: 540 + x - size / 2,
        top: 960 + y - size / 2,
        background: `conic-gradient(from ${rot}deg at 50% 50%, ${color} 0deg, transparent 120deg, transparent 240deg, ${color} 360deg)`,
        filter: `blur(${blur}px)`,
        opacity,
        mixBlendMode: 'screen',
      }}
    />
  );
};

const Scene: React.FC<VideoProps> = ({
  businessName,
  headline,
  subheadline,
  cta = 'Explore',
  domain,
  brand,
  options,
}) => {
  const f = useCurrentFrame();

  const headlineSize = options?.headlineSize ?? 170;
  const speed = moodSpeed(options?.mood);
  const intensity = options?.intensity ?? 1;
  const showBrandMark = options?.showBrandMark ?? true;
  const showCta = options?.showCta ?? true;

  const words = headline.split(' ');

  // Subtle camera zoom on whole composition
  const zoom = interpolate(f, [0, 360], [1, 1.04], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* Deep space background */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 120%, ${brand.dark}, #000 80%)`,
        }}
      />

      {/* Camera zoom wrapper */}
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        {/* Four aurora layers for richer depth */}
        <AuroraLayer color={brand.primary} speed={1 * speed} seed={0} opacity={0.7 * intensity} />
        <AuroraLayer color={brand.accent} speed={-0.8 * speed} seed={5} opacity={0.6 * intensity} />
        <AuroraLayer color={brand.pop} speed={0.6 * speed} seed={12} opacity={0.4 * intensity} />
        <AuroraLayer
          color={brand.primary}
          speed={-0.4 * speed}
          seed={20}
          opacity={0.3 * intensity}
          size={2400}
          blur={140}
        />
      </AbsoluteFill>

      {/* Horizon-line gradient — subtle grounding light at the bottom */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 400,
          background: `linear-gradient(0deg, ${brand.accent}30, transparent)`,
          mixBlendMode: 'screen',
          filter: 'blur(40px)',
        }}
      />

      {/* Fine film grain */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      >
        <filter id="auroraGrain">
          <feTurbulence type="fractalNoise" baseFrequency={1.4} seed={f % 6} />
        </filter>
        <rect width="100%" height="100%" filter="url(#auroraGrain)" />
      </svg>

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 80px',
        }}
      >
        {subheadline && (
          <Rise delay={16} from={20}>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 24,
                letterSpacing: 10,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.6)',
                fontWeight: 500,
                marginBottom: 34,
              }}
            >
              {subheadline}
            </div>
          </Rise>
        )}

        {/* Headline — letters focus in with per-word staggered blur */}
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: headlineSize,
            fontWeight: 600,
            color: '#fff',
            letterSpacing: -8,
            lineHeight: 0.95,
            textAlign: 'center',
            maxWidth: 900,
            textShadow: '0 10px 60px rgba(0,0,0,0.5)',
          }}
        >
          {words.map((word, i) => {
            const delay = 24 + i * 8;
            const blur = interpolate(f - delay, [0, 20], [12, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            const op = interpolate(f - delay, [0, 16], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const y = interpolate(f - delay, [0, 20], [20, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  marginRight: i < words.length - 1 ? 20 : 0,
                  filter: `blur(${blur}px)`,
                  opacity: op,
                  transform: `translateY(${y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {showBrandMark && (
          <Rise delay={words.length * 8 + 40} style={{ marginTop: 70 }}>
            <BrandMark businessName={businessName} color="#fff" size={44} markColor={brand.accent} />
          </Rise>
        )}

        {showCta && (
          <Rise delay={words.length * 8 + 54} style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div
                style={{
                  padding: '14px 32px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontFamily: FONTS.display,
                  fontSize: 22,
                  fontWeight: 600,
                }}
              >
                {cta} →
              </div>
              {domain && (
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 18,
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

export const Aurora: React.FC<VideoProps> = (props) => {
  const duration = props.options?.duration ?? 360;
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

export const AuroraMeta = {
  id: 'aurora',
  name: 'Aurora',
  description: 'Four-layer flowing light gradients with depth-of-field text reveal and horizon glow. Apple-hero premium.',
  durationFrames: 360,
  usesImage: false,
  bestFor: ['brand-story', 'announcement', 'premium-launch'] as const,
};
