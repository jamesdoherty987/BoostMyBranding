/**
 * Slideshow — image-only carousel template.
 *
 * Perfect for themes that don't need narration or motion: fashion
 * slideshows, trading-card reveals, luxury-lifestyle mood boards,
 * scripture verses, product catalogs. Each beat is one still image
 * with a short on-screen caption and (optionally) an eyebrow chapter
 * label. The entire composition is driven by music and the visual
 * rhythm of the cuts.
 *
 * Key differences from ViralShort:
 *   - No gameplay / news-chyron / language-card modes — this template
 *     is purely about showing imagery.
 *   - Per-slide Ken Burns zoom is gentle (no gimmicks).
 *   - A numbered progress indicator (e.g. "3 / 7") sits in the
 *     top-right when enabled.
 *   - Supports a trailing CTA slide with the account watermark.
 *
 * Props are passed via VideoProps.options (runtime cast) so the same
 * pipeline can choose this template by setting generatorConfig.
 */

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Series,
  Img,
  Audio,
  Easing,
  spring,
} from 'remotion';
import { FONTS } from '../types';
import type { VideoProps, BrandPalette, TemplatePreset } from '../types';

/* ═══════════════════════════════════════════════════════════════════ */
/* Extended props (shared shape with ViralShort)                        */
/* ═══════════════════════════════════════════════════════════════════ */

export interface SlideshowBeat {
  imageUrl?: string;
  onScreen: string;
  eyebrow?: string;
  durationSeconds: number;
  attribution?: string;
}

export interface SlideshowExtras {
  variant?: 'slideshow' | 'satisfying-loop' | 'scripture-card';
  slides?: SlideshowBeat[];
  hook?: string;
  outro?: string;
  musicUrl?: string;
  voiceoverUrl?: string;
  watermarkHandle?: string;
  accentColor?: string;
  themeColor?: string;
  /** Numbered progress indicator ("3 / 7") in the corner. */
  showProgress?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Main                                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

export const Slideshow: React.FC<VideoProps> = (props) => {
  const { fps } = useVideoConfig();
  const extras = (props.options ?? {}) as unknown as SlideshowExtras;
  const slides = (extras.slides ?? []).slice(0, 12);
  const palette = props.brand;
  const accent = extras.accentColor ?? extras.themeColor ?? palette.accent;
  const variant = extras.variant ?? 'slideshow';

  const beatFrames = slides.map((s) =>
    Math.round(Math.max(1.2, Math.min(6, s.durationSeconds)) * fps),
  );
  const hookFrames = extras.hook ? Math.round(2 * fps) : 0;
  const outroFrames = extras.outro || extras.watermarkHandle ? Math.round(2 * fps) : 0;

  return (
    <AbsoluteFill style={{ background: palette.dark }}>
      {extras.musicUrl ? <Audio src={extras.musicUrl} volume={0.28} /> : null}
      {extras.voiceoverUrl ? <Audio src={extras.voiceoverUrl} volume={1.0} /> : null}

      <Series>
        {extras.hook ? (
          <Series.Sequence durationInFrames={hookFrames}>
            <HookSlide text={extras.hook} palette={palette} accent={accent} variant={variant} />
          </Series.Sequence>
        ) : null}

        {slides.map((slide, i) => (
          <Series.Sequence key={i} durationInFrames={beatFrames[i]!}>
            <SlideScene
              slide={slide}
              index={i}
              total={slides.length}
              palette={palette}
              accent={accent}
              variant={variant}
              showProgress={extras.showProgress ?? variant === 'slideshow'}
              watermark={extras.watermarkHandle}
            />
          </Series.Sequence>
        ))}

        {outroFrames > 0 ? (
          <Series.Sequence durationInFrames={outroFrames}>
            <OutroSlide
              text={extras.outro ?? ''}
              watermark={extras.watermarkHandle}
              palette={palette}
              accent={accent}
            />
          </Series.Sequence>
        ) : null}
      </Series>
    </AbsoluteFill>
  );
};

/* ─── Individual slide ────────────────────────────────────── */

const SlideScene: React.FC<{
  slide: SlideshowBeat;
  index: number;
  total: number;
  palette: BrandPalette;
  accent: string;
  variant: SlideshowExtras['variant'];
  showProgress: boolean;
  watermark?: string;
}> = ({ slide, index, total, palette, accent, variant, showProgress, watermark }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Subtle Ken Burns. Less aggressive than ViralShort since slideshow
  // viewers focus on the image, not the motion.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.05], {
    extrapolateRight: 'clamp',
  });
  const translate = interpolate(frame, [0, durationInFrames], [0, variant === 'satisfying-loop' ? 0 : -12], {
    extrapolateRight: 'clamp',
  });

  // Text fade in/out, with a quick exit so the next slide feels tight.
  const textFade = interpolate(
    frame,
    [0, 6, durationInFrames - 10, durationInFrames - 2],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const isScripture = variant === 'scripture-card';
  const isSatisfying = variant === 'satisfying-loop';

  return (
    <AbsoluteFill style={{ background: palette.dark, overflow: 'hidden' }}>
      {/* Background image */}
      {slide.imageUrl ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${scale}) translateY(${translate}px)`,
          }}
        >
          <Img
            src={slide.imageUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${palette.primary}, ${accent})`,
          }}
        />
      )}

      {/* Bottom scrim (always present for legibility) */}
      {!isSatisfying ? (
        <AbsoluteFill
          style={{
            background: `linear-gradient(to top, ${palette.dark}d0 0%, ${palette.dark}66 30%, ${palette.dark}00 60%)`,
          }}
        />
      ) : null}

      {/* Progress indicator ("3 / 7") top-right */}
      {showProgress ? (
        <div
          style={{
            position: 'absolute',
            top: 64,
            right: 64,
            padding: '8px 18px',
            borderRadius: 999,
            background: `${palette.dark}cc`,
            backdropFilter: 'blur(10px)',
            color: '#fff',
            fontFamily: FONTS.display,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: 1,
          }}
        >
          {index + 1} / {total}
        </div>
      ) : null}

      {/* Eyebrow (chapter label) */}
      {slide.eyebrow ? (
        <div
          style={{
            position: 'absolute',
            top: 120,
            left: 56,
            padding: '8px 18px',
            background: accent,
            color: palette.dark,
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            opacity: textFade,
          }}
        >
          {slide.eyebrow}
        </div>
      ) : null}

      {/* Main copy */}
      {isScripture ? (
        // Scripture gets centered serif treatment, no on-screen attribution
        // so the verse reads cleanly and the reference lands on the next beat.
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '120px 56px',
            opacity: textFade,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.serif,
              color: '#fff',
              fontSize: 82,
              lineHeight: 1.18,
              fontStyle: 'italic',
              textAlign: 'center',
              letterSpacing: -0.2,
              textShadow: `0 2px 24px ${palette.dark}aa`,
            }}
          >
            &ldquo;{slide.onScreen}&rdquo;
          </div>
        </AbsoluteFill>
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            bottom: 160,
            opacity: textFade,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.display,
              fontWeight: 900,
              fontSize: 88,
              lineHeight: 1.06,
              color: '#fff',
              letterSpacing: -1,
              textShadow: '0 2px 20px rgba(0,0,0,0.6)',
            }}
          >
            {slide.onScreen}
          </div>
        </div>
      )}

      {/* Watermark */}
      {watermark ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            right: 56,
            color: 'rgba(255,255,255,0.6)',
            fontFamily: FONTS.display,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: 0.3,
          }}
        >
          {watermark}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ─── Hook / intro slide ─────────────────────────────────── */

const HookSlide: React.FC<{
  text: string;
  palette: BrandPalette;
  accent: string;
  variant: SlideshowExtras['variant'];
}> = ({ text, palette, accent, variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const fontSize = variant === 'scripture-card' ? 110 : 128;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, ${accent}44, transparent 55%), ${palette.dark}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
      }}
    >
      <div
        style={{
          transform: `scale(${0.92 + s * 0.08})`,
          color: '#fff',
          fontFamily: variant === 'scripture-card' ? FONTS.serif : FONTS.display,
          fontWeight: 900,
          fontSize,
          lineHeight: 1.03,
          textAlign: 'center',
          letterSpacing: -2,
          textShadow: `0 6px 30px ${palette.dark}`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Outro slide ────────────────────────────────────────── */

const OutroSlide: React.FC<{
  text: string;
  watermark?: string;
  palette: BrandPalette;
  accent: string;
}> = ({ text, watermark, palette, accent }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 30%, ${accent}33, transparent 55%), ${palette.dark}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        opacity: fade,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {text ? (
          <div
            style={{
              fontFamily: FONTS.display,
              color: '#fff',
              fontWeight: 800,
              fontSize: 84,
              lineHeight: 1.08,
              marginBottom: 36,
              letterSpacing: -0.8,
            }}
          >
            {text}
          </div>
        ) : null}
        {watermark ? (
          <div
            style={{
              display: 'inline-block',
              padding: '18px 36px',
              borderRadius: 999,
              background: accent,
              color: palette.dark,
              fontFamily: FONTS.display,
              fontWeight: 800,
              fontSize: 34,
            }}
          >
            {watermark}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
/* Meta + duration                                                      */
/* ═══════════════════════════════════════════════════════════════════ */

export const SlideshowMeta = {
  id: 'slideshow',
  name: 'Slideshow',
  description:
    'Pure image-carousel template for fashion, card reveals, luxury lifestyle, scripture, and product catalogs. Narration optional, music-driven by default.',
  durationFrames: 30 * 24,
  usesImage: true,
  bestFor: [
    'Fashion slideshows (Fit Check, Lookbook)',
    'Luxury lifestyle boards (Quiet Luxury)',
    'Trading-card reveals',
    'Scripture / quote cards',
    'Product catalog drops',
  ],
} as const;

export const SLIDESHOW_PRESETS: readonly TemplatePreset[] = [];

export function computeSlideshowDuration(props: VideoProps): number {
  const fps = 30;
  const extras = (props.options ?? {}) as unknown as SlideshowExtras;
  const slides = extras.slides ?? [];
  const body = slides.reduce(
    (acc, s) => acc + Math.round(Math.max(1.2, Math.min(6, s.durationSeconds)) * fps),
    0,
  );
  const hook = extras.hook ? Math.round(2 * fps) : 0;
  const outro = extras.outro || extras.watermarkHandle ? Math.round(2 * fps) : 0;
  return Math.max(fps * 3, body + hook + outro);
}
