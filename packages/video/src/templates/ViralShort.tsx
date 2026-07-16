/**
 * ViralShort — the general-purpose personal-content template.
 *
 * Built for vertical short-form video (1080×1920) where the primary
 * retention driver is burned-in large text + voiceover + background
 * media. Covers the following theme styles with a single configurable
 * composition:
 *
 *   - fact-drop        Single big fact card per beat
 *   - viral-text       Bold text overlays with B-roll
 *   - quote-card       Minimal motion quote
 *   - language-card    Word → translation → example
 *   - listicle         Numbered count-up
 *   - news-reel        Chyron + image + narrator
 *   - story-narration  Sustained image + long-form caption
 *   - brainrot         Gameplay background + top caption overlay
 *
 * The visual variant is controlled by `options.visualVariant`. Each
 * variant tweaks layout, typography, and accent so one template can
 * play many parts. Audio (voiceover + music) is layered via separate
 * `<Audio>` tags in the Root-level Composition wrapper; this file
 * stays purely visual.
 */

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Series,
  Img,
  OffthreadVideo,
  Audio,
  Sequence,
  Easing,
  spring,
  staticFile,
} from 'remotion';
import { FONTS } from '../types';
import type { VideoProps, BrandPalette, TemplatePreset } from '../types';

/* ═══════════════════════════════════════════════════════════════════ */
/* Extended props                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Beat spec passed in via `options.personalBeats`. We extend VideoProps
 * non-invasively — the compositor casts options to this shape when the
 * personal pipeline is rendering.
 */
export interface PersonalBeat {
  voiceover: string;
  onScreen: string;
  eyebrow?: string;
  imageUrl?: string;
  imageKind?: 'image' | 'video';
  durationSeconds: number;
  attribution?: string;
}

export interface ViralShortExtras {
  variant?:
    | 'fact-drop'
    | 'viral-text'
    | 'quote-card'
    | 'language-card'
    | 'listicle'
    | 'news-reel'
    | 'story-narration'
    | 'brainrot';
  personalBeats?: PersonalBeat[];
  hook?: string;
  outro?: string;
  voiceoverUrl?: string;
  musicUrl?: string;
  backgroundLoopUrl?: string;
  watermarkHandle?: string;
  accentColor?: string;
  /** Theme-provided color for progress bar / chyron. */
  themeColor?: string;
  /** Background music linear gain (Remotion). Default 0.15. */
  musicBedVolume?: number;
  /** When false, hide burned-in hook / beat / outro text (audio unchanged). Default true. */
  showBurnedInText?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Top-level component                                                  */
/* ═══════════════════════════════════════════════════════════════════ */

export const ViralShort: React.FC<VideoProps> = (props) => {
  const { fps } = useVideoConfig();
  const extras = (props.options ?? {}) as unknown as ViralShortExtras;
  const variant = extras.variant ?? 'fact-drop';
  const beats = extras.personalBeats ?? [];
  const palette = props.brand;
  const musicVol = extras.musicBedVolume ?? 0.15;
  const showBurnedInText = extras.showBurnedInText !== false;

  // Figure out cumulative duration. Each beat's duration is in seconds.
  const beatFrames = beats.map((b) =>
    Math.round(Math.max(1.5, Math.min(8, b.durationSeconds)) * fps),
  );
  const hookFrames = extras.hook ? Math.round(2.5 * fps) : 0;
  const outroFrames = extras.outro ? Math.round(2.5 * fps) : 0;

  return (
    <AbsoluteFill style={{ background: palette.dark }}>
      {/* Audio tracks — Remotion mixes them automatically. */}
      {extras.musicUrl ? (
        <Audio src={extras.musicUrl} volume={musicVol} />
      ) : null}
      {extras.voiceoverUrl ? (
        <Sequence from={hookFrames}>
          <Audio src={extras.voiceoverUrl} volume={1.0} />
        </Sequence>
      ) : null}

      <Series>
        {extras.hook ? (
          <Series.Sequence durationInFrames={hookFrames}>
            <HookCard
              text={extras.hook}
              palette={palette}
              accent={extras.accentColor ?? extras.themeColor ?? palette.accent}
              variant={variant}
              backgroundUrl={beats[0]?.imageUrl}
              backgroundLoopUrl={extras.backgroundLoopUrl}
              watermark={extras.watermarkHandle}
              showBurnedInText={showBurnedInText}
            />
          </Series.Sequence>
        ) : null}

        {beats.map((beat, i) => (
          <Series.Sequence key={i} durationInFrames={beatFrames[i]!}>
            <BeatScene
              beat={beat}
              index={i}
              total={beats.length}
              palette={palette}
              accent={extras.accentColor ?? extras.themeColor ?? palette.accent}
              variant={variant}
              backgroundLoopUrl={extras.backgroundLoopUrl}
              watermark={extras.watermarkHandle}
              showBurnedInText={showBurnedInText}
            />
          </Series.Sequence>
        ))}

        {extras.outro ? (
          <Series.Sequence durationInFrames={outroFrames}>
            <OutroCard
              text={extras.outro}
              palette={palette}
              accent={extras.accentColor ?? extras.themeColor ?? palette.accent}
              watermark={extras.watermarkHandle}
              showBurnedInText={showBurnedInText}
            />
          </Series.Sequence>
        ) : null}
      </Series>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
/* Beat scene — the per-slide layout                                    */
/* ═══════════════════════════════════════════════════════════════════ */

const BeatScene: React.FC<{
  beat: PersonalBeat;
  index: number;
  total: number;
  palette: BrandPalette;
  accent: string;
  variant: ViralShortExtras['variant'];
  backgroundLoopUrl?: string;
  watermark?: string;
  showBurnedInText?: boolean;
}> = ({
  beat,
  index,
  total,
  palette,
  accent,
  variant,
  backgroundLoopUrl,
  watermark,
  showBurnedInText = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // The media — B-roll or AI image. For brainrot variants we overlay a
  // gameplay loop instead. For news-reel we hold the image still with a
  // chyron. For others we Ken Burns-zoom.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateRight: 'clamp',
  });

  // Text in/out
  const textIn = spring({
    frame: frame - 4,
    fps,
    config: { damping: 16, stiffness: 160, mass: 0.6 },
  });
  const textFade = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames - 2],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  const isBrainrot = variant === 'brainrot';
  const isNews = variant === 'news-reel';
  const isLanguage = variant === 'language-card';
  const isQuote = variant === 'quote-card';

  return (
    <AbsoluteFill style={{ background: palette.dark, overflow: 'hidden' }}>
      {/* ───── Background ───── */}
      {isBrainrot && backgroundLoopUrl ? (
        <AbsoluteFill>
          {/* Top half: the beat media */}
          <div style={{ width: '100%', height: '60%', overflow: 'hidden' }}>
            {beat.imageUrl ? (
              beat.imageKind === 'video' ? (
                <OffthreadVideo
                  src={beat.imageUrl}
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Img
                  src={beat.imageUrl}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(135deg, ${palette.primary}, ${accent})`,
                }}
              />
            )}
          </div>
          {/* Bottom half: gameplay loop */}
          <div style={{ width: '100%', height: '40%', overflow: 'hidden' }}>
            <OffthreadVideo
              src={backgroundLoopUrl}
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </AbsoluteFill>
      ) : beat.imageUrl ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${scale})`,
          }}
        >
          {beat.imageKind === 'video' ? (
            <OffthreadVideo
              src={beat.imageUrl}
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Img
              src={beat.imageUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
      ) : (
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${palette.primary}, ${accent})`,
          }}
        />
      )}

      {/* Darkening scrim so text is always readable */}
      {!isLanguage && !isQuote ? (
        <AbsoluteFill
          style={{
            background: isBrainrot
              ? 'transparent'
              : `linear-gradient(to top, ${palette.dark}ee 0%, ${palette.dark}66 40%, ${palette.dark}00 70%)`,
          }}
        />
      ) : null}

      {/* ───── Top-bar progress ───── */}
      {showBurnedInText ? (
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 48,
            right: 48,
            display: 'flex',
            gap: 8,
          }}
        >
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 3,
                background:
                  i < index
                    ? accent
                    : i === index
                      ? accent + 'cc'
                      : 'rgba(255,255,255,0.22)',
              }}
            />
          ))}
        </div>
      ) : null}

      {/* ───── Eyebrow (small label top-left) ───── */}
      {showBurnedInText && beat.eyebrow ? (
        <div
          style={{
            position: 'absolute',
            top: 120,
            left: 48,
            padding: '10px 20px',
            borderRadius: 999,
            background: accent,
            color: palette.dark,
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            transform: `scale(${textIn})`,
          }}
        >
          {beat.eyebrow}
        </div>
      ) : null}

      {/* ───── Main on-screen text ───── */}
      {showBurnedInText ? (
        isNews ? (
          <NewsChyron
            text={beat.onScreen}
            palette={palette}
            accent={accent}
            attribution={beat.attribution}
            opacity={textFade}
          />
        ) : isLanguage ? (
          <LanguageCard
            text={beat.onScreen}
            eyebrow={beat.eyebrow}
            palette={palette}
            accent={accent}
            opacity={textFade}
          />
        ) : isQuote ? (
          <QuoteCard text={beat.onScreen} palette={palette} opacity={textFade} />
        ) : (
          <BigText
            text={beat.onScreen}
            variant={variant}
            palette={palette}
            accent={accent}
            isBrainrot={isBrainrot}
            opacity={textFade}
          />
        )
      ) : null}

      {/* ───── Watermark ───── */}
      {watermark ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            right: 48,
            color: 'rgba(255,255,255,0.55)',
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

/* ═══════════════════════════════════════════════════════════════════ */
/* Sub-components                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

const BigText: React.FC<{
  text: string;
  variant: ViralShortExtras['variant'];
  palette: BrandPalette;
  accent: string;
  isBrainrot: boolean;
  opacity: number;
}> = ({ text, palette, accent, isBrainrot, opacity }) => {
  const vertical = isBrainrot ? 'flex-start' : 'flex-end';
  const padTop = isBrainrot ? '64%' : 0;
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: vertical,
        paddingBottom: isBrainrot ? 48 : 220,
        paddingTop: padTop,
        paddingLeft: 48,
        paddingRight: 48,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.display,
          fontWeight: 900,
          fontSize: 108,
          lineHeight: 1.05,
          letterSpacing: -1,
          color: '#fff',
          textShadow: '0 3px 24px rgba(0,0,0,0.55)',
          // Highlight last important word with a block background.
          background: isBrainrot ? `${palette.dark}cc` : undefined,
          padding: isBrainrot ? '18px 24px' : 0,
          borderRadius: isBrainrot ? 16 : 0,
          WebkitTextStroke: isBrainrot ? `2px ${accent}` : undefined,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const NewsChyron: React.FC<{
  text: string;
  palette: BrandPalette;
  accent: string;
  attribution?: string;
  opacity: number;
}> = ({ text, palette, accent, attribution, opacity }) => {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 220,
          padding: '32px 48px',
          background: palette.dark + 'ee',
          borderTop: `6px solid ${accent}`,
          opacity,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            color: '#fff',
            fontWeight: 800,
            fontSize: 60,
            lineHeight: 1.12,
            letterSpacing: -0.4,
          }}
        >
          {text}
        </div>
        {attribution ? (
          <div
            style={{
              marginTop: 12,
              color: accent,
              fontFamily: FONTS.mono,
              fontSize: 22,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Source · {attribution}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 48,
          padding: '10px 22px',
          background: accent,
          color: palette.dark,
          fontFamily: FONTS.display,
          fontWeight: 900,
          fontSize: 28,
          letterSpacing: 2,
          textTransform: 'uppercase',
          opacity,
        }}
      >
        Breaking
      </div>
    </>
  );
};

const LanguageCard: React.FC<{
  text: string;
  eyebrow?: string;
  palette: BrandPalette;
  accent: string;
  opacity: number;
}> = ({ text, eyebrow, palette, accent, opacity }) => {
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        opacity,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 48,
          padding: '80px 64px',
          textAlign: 'center',
          boxShadow: `0 20px 80px ${palette.dark}55`,
          maxWidth: '88%',
          borderTop: `12px solid ${accent}`,
        }}
      >
        {eyebrow ? (
          <div
            style={{
              color: accent,
              fontFamily: FONTS.display,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: 24,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: FONTS.serif,
            color: palette.dark,
            fontSize: 128,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: -1.5,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const QuoteCard: React.FC<{
  text: string;
  palette: BrandPalette;
  opacity: number;
}> = ({ text, palette, opacity }) => {
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 64px',
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.serif,
          color: '#fff',
          fontSize: 84,
          lineHeight: 1.15,
          fontWeight: 400,
          fontStyle: 'italic',
          textAlign: 'center',
          letterSpacing: -0.3,
          textShadow: `0 2px 24px ${palette.dark}aa`,
        }}
      >
        &ldquo;{text}&rdquo;
      </div>
    </AbsoluteFill>
  );
};

const HookCard: React.FC<{
  text: string;
  palette: BrandPalette;
  accent: string;
  variant: ViralShortExtras['variant'];
  backgroundUrl?: string;
  backgroundLoopUrl?: string;
  watermark?: string;
  showBurnedInText?: boolean;
}> = ({
  text,
  palette,
  accent,
  variant,
  backgroundUrl,
  backgroundLoopUrl,
  watermark,
  showBurnedInText = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });
  const isBrainrot = variant === 'brainrot';

  return (
    <AbsoluteFill style={{ background: palette.dark, overflow: 'hidden' }}>
      {isBrainrot && backgroundLoopUrl ? (
        <OffthreadVideo
          src={backgroundLoopUrl}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : backgroundUrl ? (
        <Img
          src={backgroundUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${palette.primary}, ${accent})`,
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, ${palette.dark}77 0%, ${palette.dark}dd 100%)`,
        }}
      />
      {showBurnedInText ? (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 60,
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              color: '#fff',
              fontFamily: FONTS.display,
              fontWeight: 900,
              fontSize: 128,
              lineHeight: 1.03,
              textAlign: 'center',
              letterSpacing: -2,
              textShadow: `0 6px 36px ${palette.dark}`,
            }}
          >
            {text}
          </div>
        </AbsoluteFill>
      ) : null}
      {watermark ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 48,
            color: accent,
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: 28,
          }}
        >
          {watermark}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const OutroCard: React.FC<{
  text: string;
  palette: BrandPalette;
  accent: string;
  watermark?: string;
  showBurnedInText?: boolean;
}> = ({ text, palette, accent, watermark, showBurnedInText = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 40%, ${accent}33, transparent 60%), ${palette.dark}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        opacity: fade,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {showBurnedInText ? (
          <div
            style={{
              fontFamily: FONTS.display,
              color: '#fff',
              fontWeight: 800,
              fontSize: 92,
              lineHeight: 1.08,
              letterSpacing: -1,
              marginBottom: 48,
            }}
          >
            {text}
          </div>
        ) : null}
        {watermark ? (
          <div
            style={{
              display: 'inline-block',
              padding: '20px 40px',
              borderRadius: 999,
              background: accent,
              color: palette.dark,
              fontFamily: FONTS.display,
              fontWeight: 800,
              fontSize: 36,
              letterSpacing: 0.5,
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

export const ViralShortMeta = {
  id: 'viral-short',
  name: 'Viral Short',
  description:
    'Vertical short for personal / viral-niche channels. Renders a scripted beat sequence with voiceover, music, and burned-in captions. Supports fact-drop, news-reel, language-card, quote-card, listicle, and brainrot variants.',
  durationFrames: 30 * 30,
  usesImage: true,
  bestFor: [
    'Faceless educational channels',
    'News recap videos',
    'Language learning micro-lessons',
    'Quote/motivation cards',
    'Brainrot explainers',
  ],
} as const;

export const VIRAL_SHORT_PRESETS: readonly TemplatePreset[] = [];

/** Dynamic duration — sum beat frames + hook + outro. */
export function computeViralShortDuration(props: VideoProps): number {
  const fps = 30;
  const extras = (props.options ?? {}) as unknown as ViralShortExtras;
  const beats = extras.personalBeats ?? [];
  const body = beats.reduce(
    (acc, b) => acc + Math.round(Math.max(1.5, Math.min(8, b.durationSeconds)) * fps),
    0,
  );
  const hook = extras.hook ? Math.round(2.5 * fps) : 0;
  const outro = extras.outro ? Math.round(2.5 * fps) : 0;
  return Math.max(fps * 4, body + hook + outro);
}
