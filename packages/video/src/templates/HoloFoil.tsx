/**
 * Holo Foil — a trading-card-style holographic foil effect. The headline
 * sits on a floating card that tilts in 3D while iridescent foil patterns
 * sweep across its surface. Multiple parallax star layers in the background
 * move at different rates to sell depth.
 *
 * Premium, collectible-card energy. Great for launches and product drops.
 *
 * Configurable: duration, headline size/font, mood (tilt speed),
 * intensity (foil strength), showBrandMark, showCta.
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
import type { VideoProps, TemplatePreset } from '../types';
import { applyPreset } from '../presets';
import { Rise, SceneFade, BrandMark } from '../components/helpers';

const Scene: React.FC<VideoProps> = ({
  businessName,
  headline,
  subheadline,
  cta = 'Collect',
  domain,
  brand,
  options,
}) => {
  const f = useCurrentFrame();

  const { palette, options: merged } = applyPreset(brand, options, HOLO_FOIL_PRESETS);

  const headlineSize = merged.headlineSize ?? 140;
  const headlineFont = merged.headlineFont ?? 'display';
  const speed = moodSpeed(merged.mood);
  const intensity = merged.intensity ?? 1;
  const showBrandMark = merged.showBrandMark ?? true;
  const showCta = merged.showCta ?? true;

  // Card tilt — slow oscillation
  const tiltX = Math.sin(f * 0.03 * speed) * 12;
  const tiltY = Math.cos(f * 0.025 * speed) * 10;

  // Card entrance
  const cardScale = interpolate(f, [0, 30], [0.7, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.5)),
  });
  const cardOpacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Foil sweep position
  const foilPos = ((f * 1.5 * speed) % 300) - 150;

  return (
    <AbsoluteFill style={{ background: palette.dark, overflow: 'hidden' }}>
      {/* Deep gradient backdrop */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse at 50% 40%, ${palette.primary}50 0%, transparent 55%),
            radial-gradient(ellipse at 20% 80%, ${palette.accent}30 0%, transparent 45%),
            linear-gradient(180deg, #141420, ${palette.dark}, #080810)
          `,
        }}
      />

      {/* Far parallax star layer — slow */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 60 }).map((_, i) => {
          const seed = i * 7.31;
          const x = (Math.sin(seed) * 0.5 + 0.5) * 1080;
          const baseY = (Math.cos(seed * 1.1) * 0.5 + 0.5) * 1920;
          const y = (baseY + f * 0.3 * speed) % 1920;
          const twinkle = 0.3 + Math.abs(Math.sin(f * 0.04 + i)) * 0.5;
          return <circle key={i} cx={x} cy={y} r={1} fill="#fff" opacity={twinkle * 0.4} />;
        })}
      </svg>

      {/* Near parallax star layer — faster */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 30 }).map((_, i) => {
          const seed = i * 11.7;
          const x = (Math.sin(seed * 1.2) * 0.5 + 0.5) * 1080;
          const baseY = (Math.cos(seed * 0.9) * 0.5 + 0.5) * 1920;
          const y = (baseY + f * 1.2 * speed) % 1920;
          const twinkle = 0.4 + Math.abs(Math.sin(f * 0.08 + i)) * 0.5;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2}
              fill={i % 3 === 0 ? palette.accent : i % 3 === 1 ? palette.pop : '#fff'}
              opacity={twinkle * 0.7}
            />
          );
        })}
      </svg>

      {/* Light sweep spotlight */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 1200,
          height: 1200,
          marginLeft: -600,
          marginTop: -600,
          background: `radial-gradient(circle, ${palette.accent}20, transparent 60%)`,
          filter: 'blur(40px)',
          mixBlendMode: 'screen',
        }}
      />

      {/* The holo card */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -360,
          marginTop: -500,
          width: 720,
          height: 1000,
          opacity: cardOpacity,
          transform: `
            perspective(1400px)
            rotateY(${tiltY}deg)
            rotateX(${-tiltX}deg)
            scale(${cardScale})
          `,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Card base */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 36,
            background: `
              linear-gradient(135deg, ${palette.primary}, ${palette.accent})
            `,
            boxShadow: `
              0 40px 120px rgba(0,0,0,0.6),
              0 20px 60px ${palette.primary}40,
              inset 0 2px 0 rgba(255,255,255,0.3),
              inset 0 -2px 0 rgba(0,0,0,0.2)
            `,
            overflow: 'hidden',
          }}
        >
          {/* Holo pattern — conic gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `conic-gradient(
                from ${f * 2}deg at 50% 50%,
                ${palette.primary},
                ${palette.accent},
                ${palette.pop},
                #ff00ff,
                ${palette.primary}
              )`,
              opacity: 0.35 * intensity,
              mixBlendMode: 'overlay',
            }}
          />

          {/* Diagonal foil stripes */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(
                ${65 + tiltY * 2}deg,
                transparent 0px,
                transparent 20px,
                rgba(255,255,255,0.04) 20px,
                rgba(255,255,255,0.04) 22px,
                transparent 22px,
                transparent 40px
              )`,
              opacity: intensity,
            }}
          />

          {/* Moving foil sweep — the signature holographic shine */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${foilPos}%`,
              width: '60%',
              background: `linear-gradient(
                115deg,
                transparent 0%,
                rgba(255,255,255,0.05) 30%,
                rgba(255,255,255,0.45) 48%,
                ${palette.pop}80 50%,
                rgba(255,255,255,0.45) 52%,
                rgba(255,255,255,0.05) 70%,
                transparent 100%
              )`,
              mixBlendMode: 'overlay',
              opacity: intensity,
            }}
          />

          {/* Inner border */}
          <div
            style={{
              position: 'absolute',
              inset: 20,
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: 24,
              pointerEvents: 'none',
            }}
          />

          {/* Card corners — gem markers */}
          {[
            { top: 34, left: 34 },
            { top: 34, right: 34 },
            { bottom: 34, left: 34 },
            { bottom: 34, right: 34 },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                ...pos,
                width: 14,
                height: 14,
                borderRadius: 4,
                background: palette.pop,
                transform: 'rotate(45deg)',
                boxShadow: `0 0 10px ${palette.pop}`,
              }}
            />
          ))}

          {/* Card text content */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 50px',
              textAlign: 'center',
            }}
          >
            {subheadline && (
              <Rise delay={28}>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 20,
                    letterSpacing: 8,
                    textTransform: 'uppercase',
                    color: '#fff',
                    fontWeight: 700,
                    marginBottom: 22,
                    padding: '6px 18px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.25)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  {subheadline}
                </div>
              </Rise>
            )}

            <Rise delay={40} from={30} dur={18}>
              <div
                style={{
                  fontFamily: headlineFont === 'serif' ? FONTS.serif : FONTS.display,
                  fontSize: headlineSize,
                  fontWeight: headlineFont === 'serif' ? 700 : 900,
                  color: '#fff',
                  letterSpacing: -5,
                  lineHeight: 0.95,
                  textShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 40px ${palette.pop}40`,
                }}
              >
                {headline}
              </div>
            </Rise>

            <Rise delay={58} style={{ marginTop: 36 }}>
              <div
                style={{
                  width: 120,
                  height: 3,
                  background: palette.pop,
                  borderRadius: 2,
                  boxShadow: `0 0 10px ${palette.pop}`,
                }}
              />
            </Rise>
          </div>
        </div>

        {/* Card shadow — cast beneath */}
        <div
          style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            bottom: -40,
            height: 50,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 70%)',
            filter: 'blur(20px)',
            transform: 'translateZ(-50px)',
          }}
        />
      </div>

      {/* Bottom signature */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        {showBrandMark && (
          <Rise delay={80}>
            <BrandMark businessName={businessName} color="#fff" size={40} markColor={palette.accent} />
          </Rise>
        )}
        {showCta && (
          <Rise delay={92}>
            <div
              style={{
                padding: '12px 28px',
                borderRadius: 999,
                background: `linear-gradient(135deg, ${palette.pop}, ${palette.accent})`,
                color: palette.dark,
                fontFamily: FONTS.display,
                fontSize: 22,
                fontWeight: 800,
                boxShadow: `0 10px 30px ${palette.pop}40`,
              }}
            >
              {cta} →
              {domain && <span style={{ opacity: 0.65, marginLeft: 10 }}>{domain}</span>}
            </div>
          </Rise>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const HoloFoil: React.FC<VideoProps> = (props) => {
  const duration = props.options?.duration ?? 330;
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

export const HoloFoilMeta = {
  id: 'holo-foil',
  name: 'Holo Foil',
  description: 'Trading-card holographic foil effect with 3D tilt, iridescent sweep, and parallax starfield. Collectible energy.',
  durationFrames: 330,
  usesImage: false,
  bestFor: ['launch', 'premium-brand', 'drop'] as const,
};

/**
 * Holo Foil preset roster. Each preset reshapes the card's gradient,
 * foil shine, and gem markers. The motion (tilt, sweep, twinkle) stays
 * identical — only the palette changes.
 */
export const HOLO_FOIL_PRESETS: readonly TemplatePreset[] = [
  {
    id: 'default',
    name: 'Brand default',
    description: 'Uses the client brand palette directly — no overrides.',
    thumbnailSeed: 'holo-default',
  },
  {
    id: 'rainbow',
    name: 'Rainbow holo',
    description: 'Classic trading-card rainbow iridescence — pink, teal, gold.',
    palette: {
      primary: '#8B5CF6',
      accent: '#22D3EE',
      pop: '#FACC15',
      dark: '#0A0519',
    },
    thumbnailSeed: 'holo-rainbow',
  },
  {
    id: 'pokemon',
    name: 'Crystal',
    description: 'Cool blues and silvers with ice-blue pop. Tech launch.',
    palette: {
      primary: '#0EA5E9',
      accent: '#38BDF8',
      pop: '#E0F2FE',
      dark: '#050915',
    },
    thumbnailSeed: 'holo-crystal',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    description: 'Deep crimson card with gold pop. Fine dining, luxury.',
    palette: {
      primary: '#991B1B',
      accent: '#DC2626',
      pop: '#FBBF24',
      dark: '#0A0303',
    },
    thumbnailSeed: 'holo-ruby',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Rich greens with gold. Legal, accounting, fine spirits.',
    palette: {
      primary: '#047857',
      accent: '#10B981',
      pop: '#FDE68A',
      dark: '#02120A',
    },
    thumbnailSeed: 'holo-emerald',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Near-black card with silver and white pop. Exclusive, VIP.',
    palette: {
      primary: '#1F2937',
      accent: '#6B7280',
      pop: '#F9FAFB',
      dark: '#000000',
    },
    options: { intensity: 0.6 },
    thumbnailSeed: 'holo-obsidian',
  },
  {
    id: 'gold-bar',
    name: 'Gold bar',
    description: 'Full gold foil with copper and cream accents. Premium drop.',
    palette: {
      primary: '#B45309',
      accent: '#F59E0B',
      pop: '#FEF3C7',
      dark: '#0E0703',
    },
    thumbnailSeed: 'holo-gold',
  },
  {
    id: 'candy',
    name: 'Candy',
    description: 'Bubblegum pink, mint, yellow. Playful, beauty, confectionery.',
    palette: {
      primary: '#F472B6',
      accent: '#34D399',
      pop: '#FEF08A',
      dark: '#1F0F1A',
    },
    options: { mood: 'energetic' },
    thumbnailSeed: 'holo-candy',
  },
  {
    id: 'arcade',
    name: 'Arcade',
    description: 'Hot pink + cyan neon on black. Retro drop, esports, nightlife.',
    palette: {
      primary: '#EC4899',
      accent: '#06B6D4',
      pop: '#FDE047',
      dark: '#050010',
    },
    options: { mood: 'energetic', intensity: 1.2 },
    thumbnailSeed: 'holo-arcade',
  },
  {
    id: 'sepia',
    name: 'Sepia',
    description: 'Muted browns and cream. Heritage, artisan, vintage brand.',
    palette: {
      primary: '#78350F',
      accent: '#D97706',
      pop: '#FEF3C7',
      dark: '#140A03',
    },
    options: { intensity: 0.75, headlineFont: 'serif' },
    thumbnailSeed: 'holo-sepia',
  },
] as const;
