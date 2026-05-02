/**
 * Product Showcase — vertical hero with product image floating on
 * brand-gradient backdrop.
 *
 * Polished version:
 * - Configurable duration, headline size/font, mood
 * - Dual rotating conic gradients (opposite directions) for richer depth
 * - Optional spotlight beam that sweeps across the product
 * - Configurable float intensity
 * - Better fallback typography when no image provided
 */

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Img,
  Sequence,
  Easing,
} from 'remotion';
import { FONTS, moodSpeed } from '../types';
import type { VideoProps } from '../types';
import { Rise, SceneFade, BrandMark } from '../components/helpers';

const Scene: React.FC<VideoProps> = ({
  businessName,
  headline,
  subheadline,
  cta = 'Shop now',
  domain,
  brand,
  imageUrl,
  options,
}) => {
  const f = useCurrentFrame();

  const headlineSize = options?.headlineSize ?? 120;
  const headlineFont = options?.headlineFont ?? 'display';
  const speed = moodSpeed(options?.mood);
  const intensity = options?.intensity ?? 1;
  const showBrandMark = options?.showBrandMark ?? true;
  const showCta = options?.showCta ?? true;

  // Product motion
  const floatY = Math.sin(f * 0.04 * speed) * 20;
  const floatX = Math.sin(f * 0.03 * speed + 1) * 8;
  const zoom = interpolate(f, [0, 60, 300, 360], [1.05, 1, 1.02, 1.04], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Dual counter-rotating conic gradients for depth
  const rot1 = f * 0.08 * speed;
  const rot2 = -f * 0.05 * speed;

  // Spotlight beam sweep — passes across the product once mid-scene
  const beamX = interpolate(f, [60, 180], [-600, 1680], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const beamOpacity = interpolate(f, [60, 90, 150, 180], [0, 0.6, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: brand.dark, overflow: 'hidden' }}>
      {/* Primary rotating conic gradient */}
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          background: `conic-gradient(from ${rot1}deg at 50% 50%, ${brand.primary}, ${brand.accent}, ${brand.pop}, ${brand.primary})`,
          opacity: 0.35 * intensity,
          filter: 'blur(80px)',
        }}
      />

      {/* Secondary counter-rotating layer for complexity */}
      <div
        style={{
          position: 'absolute',
          inset: '-30%',
          background: `conic-gradient(from ${rot2}deg at 30% 70%, transparent, ${brand.accent}, transparent, ${brand.pop}, transparent)`,
          opacity: 0.25 * intensity,
          filter: 'blur(120px)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Soft vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* Floating accent orbs */}
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 300,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: brand.accent,
          opacity: 0.18,
          filter: 'blur(40px)',
          transform: `translateY(${Math.sin(f * 0.03 * speed) * 30}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 60,
          bottom: 400,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: brand.pop,
          opacity: 0.15,
          filter: 'blur(60px)',
          transform: `translateY(${Math.cos(f * 0.025 * speed) * 40}px)`,
        }}
      />

      {/* Spotlight beam */}
      <div
        style={{
          position: 'absolute',
          left: beamX,
          top: -200,
          width: 300,
          height: 2400,
          background: `linear-gradient(90deg, transparent, rgba(255,255,255,${beamOpacity * 0.2}), transparent)`,
          transform: 'rotate(15deg)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Hero image (or typographic fallback) */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '160px 60px 0',
        }}
      >
        {imageUrl ? (
          <Rise delay={10} from={60} dur={22}>
            <div
              style={{
                width: 720,
                height: 720,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `translate(${floatX}px, ${floatY}px) scale(${zoom})`,
                filter: 'drop-shadow(0 40px 80px rgba(0,0,0,0.5))',
              }}
            >
              <Img
                src={imageUrl}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          </Rise>
        ) : (
          <Rise delay={10} from={60} dur={22}>
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 280,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: -14,
                lineHeight: 0.85,
                textAlign: 'center',
                transform: `translateY(${floatY * 0.5}px)`,
                textShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              {businessName.charAt(0).toUpperCase()}
            </div>
          </Rise>
        )}

        {subheadline && (
          <Rise delay={34} dur={14}>
            <div
              style={{
                marginTop: 40,
                fontFamily: FONTS.display,
                fontSize: 24,
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: 4,
                textTransform: 'uppercase',
                fontWeight: 800,
              }}
            >
              {subheadline}
            </div>
          </Rise>
        )}

        <Rise delay={44} from={50} dur={20}>
          <div
            style={{
              marginTop: 20,
              fontFamily: headlineFont === 'serif' ? FONTS.serif : FONTS.display,
              fontSize: headlineSize,
              fontWeight: headlineFont === 'serif' ? 700 : 900,
              color: '#fff',
              letterSpacing: headlineFont === 'serif' ? -4 : -5,
              lineHeight: 0.95,
              textAlign: 'center',
              maxWidth: 960,
              textShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
          >
            {headline}
          </div>
        </Rise>
      </AbsoluteFill>

      {/* Bottom CTA bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
        }}
      >
        {showBrandMark && (
          <Rise delay={66} dur={14}>
            <BrandMark businessName={businessName} color="#fff" size={46} markColor={brand.accent} />
          </Rise>
        )}
        {showCta && (
          <Rise delay={78} dur={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  padding: '18px 40px',
                  background: brand.accent,
                  color: brand.dark,
                  borderRadius: 999,
                  fontFamily: FONTS.display,
                  fontSize: 28,
                  fontWeight: 800,
                  boxShadow: `0 10px 40px ${brand.accent}60`,
                }}
              >
                {cta}
              </div>
              {domain && (
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    color: 'rgba(255,255,255,0.75)',
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

export const ProductShowcase: React.FC<VideoProps> = (props) => {
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

export const ProductShowcaseMeta = {
  id: 'product-showcase',
  name: 'Product Showcase',
  description: 'Hero product image on dual-layer conic gradient with spotlight sweep and floating orbs. Premium e-commerce.',
  durationFrames: 360,
  usesImage: true,
  bestFor: ['promotional', 'product-launch'] as const,
};
