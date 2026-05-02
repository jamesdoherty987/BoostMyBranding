/**
 * Glitch Art — controlled digital glitch into a clean neon lock-in.
 *
 * Polished version:
 * - Configurable duration, headline size, mood (affects glitch duration)
 * - Post-lock-in shimmer effect — subtle light ripple across the locked text
 * - Vertical scanline + horizontal scanline for richer CRT feel
 * - Terminal timestamp ticks in real-time
 * - Corner brackets animate in with stagger, not all at once
 */

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  Easing,
} from 'remotion';
import { FONTS, moodSpeed } from '../types';
import type { VideoProps } from '../types';
import { SceneFade, BrandMark, Rise } from '../components/helpers';

function seeded(f: number, seed: number): number {
  const x = Math.sin(f * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const Scene: React.FC<VideoProps> = ({
  businessName,
  headline,
  subheadline,
  cta = 'Now',
  domain,
  brand,
  options,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineSize = options?.headlineSize ?? 200;
  const speed = moodSpeed(options?.mood);
  const intensity = options?.intensity ?? 1;
  const showBrandMark = options?.showBrandMark ?? true;
  const showCta = options?.showCta ?? true;

  // Glitch intensity — high at start, resolves (mood adjusts resolve speed)
  const glitchEnd = 80 / speed;
  const glitchPhase = interpolate(f, [0, glitchEnd * 0.5, glitchEnd], [1, 0.4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const rgbShift = glitchPhase * 20 * intensity * (seeded(f, 1) > 0.6 ? 1 : 0.3);

  const slices = [0, 1, 2, 3, 4, 5].map((i) => {
    const shouldGlitch = seeded(Math.floor(f / 3), i) > 0.75;
    return shouldGlitch ? (seeded(f, i + 10) - 0.5) * 80 * glitchPhase * intensity : 0;
  });

  // Horizontal scanline
  const scanY = (f * 8) % 1920;
  // Vertical scanline for richer CRT feel
  const scanX = ((f * 5) % 1200) - 100;

  // Lock-in snap
  const lockIn = interpolate(f, [glitchEnd, glitchEnd + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.5)),
  });

  // Post-lock-in shimmer — subtle light ripple
  const shimmerX = interpolate(f, [glitchEnd + 40, glitchEnd + 120], [-400, 1500], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Real-time timestamp
  const seconds = Math.floor(f / fps);
  const frames = f % fps;
  const timestamp = `REC · ${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;

  return (
    <AbsoluteFill style={{ background: brand.dark, overflow: 'hidden' }}>
      {/* Horizontal CRT scanlines */}
      <AbsoluteFill
        style={{
          background: `
            repeating-linear-gradient(
              0deg,
              rgba(0,0,0,0.1) 0px,
              rgba(0,0,0,0.1) 2px,
              transparent 2px,
              transparent 4px
            )
          `,
          pointerEvents: 'none',
        }}
      />

      {/* Horizontal bright scanline sweep */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: scanY,
          height: 40,
          background: `linear-gradient(180deg, transparent 0%, ${brand.accent}40 50%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Vertical scanline — fainter, only during glitch */}
      {glitchPhase > 0.1 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: scanX,
            width: 2,
            background: `${brand.pop}50`,
            opacity: glitchPhase,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Random horizontal glitch bands */}
      {glitchPhase > 0.1 &&
        slices.map((offset, i) => {
          if (offset === 0) return null;
          const y = 200 + i * 250;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: offset,
                top: y,
                width: '100%',
                height: 60,
                background: `${brand.accent}30`,
                mixBlendMode: 'screen',
                pointerEvents: 'none',
              }}
            />
          );
        })}

      {/* Headline with RGB split */}
      <div
        style={{
          position: 'absolute',
          top: 640,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 40px',
        }}
      >
        <div style={{ position: 'relative' }}>
          {/* Cyan channel */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              fontFamily: FONTS.display,
              fontSize: headlineSize,
              fontWeight: 900,
              color: '#00FFFF',
              letterSpacing: -8,
              lineHeight: 0.92,
              textAlign: 'center',
              mixBlendMode: 'screen',
              transform: `translate(${-rgbShift}px, 0) skewX(${glitchPhase * 2}deg)`,
              textShadow: `0 0 20px #00FFFF`,
            }}
          >
            {headline}
          </div>
          {/* Magenta channel */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              fontFamily: FONTS.display,
              fontSize: headlineSize,
              fontWeight: 900,
              color: '#FF00AA',
              letterSpacing: -8,
              lineHeight: 0.92,
              textAlign: 'center',
              mixBlendMode: 'screen',
              transform: `translate(${rgbShift}px, 0) skewX(${-glitchPhase * 2}deg)`,
              textShadow: `0 0 20px #FF00AA`,
            }}
          >
            {headline}
          </div>
          {/* Main white channel */}
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: headlineSize,
              fontWeight: 900,
              color: '#fff',
              letterSpacing: -8,
              lineHeight: 0.92,
              textAlign: 'center',
              textShadow: lockIn > 0.5 ? `0 0 40px ${brand.accent}` : 'none',
              transform: `scale(${1 + lockIn * 0.05})`,
              position: 'relative',
            }}
          >
            {headline}
          </div>

          {/* Post-lock-in shimmer */}
          {lockIn > 0.8 && (
            <div
              style={{
                position: 'absolute',
                left: shimmerX,
                top: -40,
                bottom: -40,
                width: 200,
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)`,
                mixBlendMode: 'screen',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* Top terminal tag */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 60,
          right: 60,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: FONTS.mono,
          fontSize: 18,
          color: brand.pop,
          letterSpacing: 3,
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        <Rise delay={6}>
          <span>[ {subheadline || 'Signal active'} ]</span>
        </Rise>
        <Rise delay={10}>
          <span style={{ opacity: 0.6 }}>{timestamp}</span>
        </Rise>
      </div>

      {/* Corner brackets — staggered entrance */}
      {lockIn > 0.3 && (
        <>
          {[
            { top: 600, left: 40, corners: ['top', 'left'] },
            { top: 600, right: 40, corners: ['top', 'right'] },
            { top: 880, left: 40, corners: ['bottom', 'left'] },
            { top: 880, right: 40, corners: ['bottom', 'right'] },
          ].map((bracket, i) => {
            const bDelay = i * 4;
            const bOp = interpolate(f - glitchEnd - bDelay, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const style: React.CSSProperties = {
              position: 'absolute',
              top: bracket.top,
              width: 40,
              height: 60,
              opacity: bOp,
            };
            if ('left' in bracket) style.left = bracket.left;
            if ('right' in bracket) style.right = bracket.right;
            if (bracket.corners.includes('top')) style.borderTop = `3px solid ${brand.accent}`;
            if (bracket.corners.includes('bottom')) style.borderBottom = `3px solid ${brand.accent}`;
            if (bracket.corners.includes('left')) style.borderLeft = `3px solid ${brand.accent}`;
            if (bracket.corners.includes('right')) style.borderRight = `3px solid ${brand.accent}`;
            return <div key={i} style={style} />;
          })}
        </>
      )}

      {/* Bottom signature */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {showBrandMark && (
          <Rise delay={glitchEnd + 20}>
            <BrandMark businessName={businessName} color="#fff" size={40} markColor={brand.accent} />
          </Rise>
        )}
        {showCta && (
          <Rise delay={glitchEnd + 34}>
            <div
              style={{
                padding: '14px 32px',
                background: brand.accent,
                color: brand.dark,
                fontFamily: FONTS.mono,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: 'uppercase',
                clipPath: 'polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)',
              }}
            >
              &gt; {cta}
              {domain && <span style={{ opacity: 0.6, marginLeft: 14 }}>{domain}</span>}
            </div>
          </Rise>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const GlitchArt: React.FC<VideoProps> = (props) => {
  const duration = props.options?.duration ?? 240;
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

export const GlitchArtMeta = {
  id: 'glitch-art',
  name: 'Glitch Art',
  description: 'CRT/VHS distortion with RGB split, dual scanlines, real-time timestamp, post-lock shimmer. High-energy cyber.',
  durationFrames: 240,
  usesImage: false,
  bestFor: ['drop', 'launch', 'youth-brand'] as const,
};
