/**
 * MediaStory — the personalized template.
 *
 * Unlike the other templates (which are mostly brand-color abstractions
 * layered over a single image), MediaStory is *driven* by the client's
 * own media. Each clip in `mediaClips` gets its own Remotion Sequence
 * with:
 *
 *   - a Ken Burns zoom (photos) or trimmed inline playback (videos)
 *   - a brand-gradient bottom scrim
 *   - per-clip eyebrow + caption in the brand voice
 *   - a small progress-dot row so viewers feel the pacing
 *
 * The result is a 15–25s short that reads as "this specific business",
 * not "any business". Works on Instagram Reels / TikTok / Shorts
 * (1080×1920 vertical).
 *
 * If no clips are provided we render a graceful fallback using the
 * single `imageUrl` and the headline — so the template never crashes
 * from missing data.
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
  Easing,
} from 'remotion';
import { FONTS, moodSpeed } from '../types';
import type { VideoProps, MediaClip, BrandPalette, TemplatePreset } from '../types';
import { applyPreset } from '../presets';
import { Rise, BrandMark } from '../components/helpers';

const bezier = Easing.bezier(0.22, 1, 0.36, 1);

const DEFAULT_CLIP_SECONDS = 2.8;
const OUTRO_SECONDS = 2.8;

/** Compute the per-clip frame count. */
function clipFrames(clip: MediaClip | undefined, fps: number) {
  const seconds = clip?.durationSeconds ?? DEFAULT_CLIP_SECONDS;
  return Math.round(Math.max(1.5, Math.min(6, seconds)) * fps);
}

/**
 * Single clip: photo with Ken Burns OR video played in-place. A scrim
 * plus per-clip copy is overlaid. Each clip has its own independent
 * timeline so a slow zoom at the start of clip 2 isn't tied to the
 * absolute video frame.
 */
const MediaClipScene: React.FC<{
  clip: MediaClip;
  palette: BrandPalette;
  index: number;
  total: number;
}> = ({ clip, palette, index, total }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = clipFrames(clip, fps);

  // Ken Burns: scale from 1 -> 1.12 across the clip; nudge origin toward
  // the caller-provided focal point so the zoom doesn't drift off-subject.
  const scale = interpolate(f, [0, dur], [1, 1.12], {
    extrapolateRight: 'clamp',
    easing: Easing.linear,
  });
  const fx = ((clip.focalX ?? 0.5) * 100).toFixed(1);
  const fy = ((clip.focalY ?? 0.5) * 100).toFixed(1);

  // Copy rises from the bottom at 8f, holds, and drifts up near the end.
  const copyOp = interpolate(f, [8, 22, dur - 16, dur - 4], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const copyY = interpolate(f, [8, 22], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: bezier,
  });

  return (
    <AbsoluteFill
      style={{ background: palette.dark, overflow: 'hidden', fontFamily: FONTS.display }}
    >
      {/* The media itself, zoomed with a focal-point transform-origin. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: `${fx}% ${fy}%`,
        }}
      >
        {clip.kind === 'video' ? (
          <OffthreadVideo
            src={clip.url}
            muted
            startFrom={0}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Img
            src={clip.url}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

      {/* Brand-color gradient scrim along the bottom for copy legibility.
          Uses the resolved palette's dark color so presets like "Editorial"
          can switch from navy to near-black without losing the wash. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to top, ${palette.dark}e6 0%, ${palette.dark}8c 28%, ${palette.dark}00 55%)`,
        }}
      />

      {/* Top-left progress dots. */}
      <div
        style={{
          position: 'absolute',
          top: 54,
          left: 54,
          right: 54,
          display: 'flex',
          gap: 10,
        }}
      >
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i < index ? '#fff' : i === index ? palette.primary : 'rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>

      {/* Caption stack bottom-left. */}
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          bottom: 140,
          opacity: copyOp,
          transform: `translateY(${copyY}px)`,
        }}
      >
        {clip.eyebrow ? (
          <div
            style={{
              fontSize: 32,
              textTransform: 'uppercase',
              letterSpacing: 4,
              color: palette.accent,
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            {clip.eyebrow}
          </div>
        ) : null}
        {clip.caption ? (
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.08,
              color: '#fff',
              fontFamily: FONTS.serif,
              fontWeight: 600,
              letterSpacing: -0.5,
              textShadow: '0 2px 18px rgba(0,0,0,0.4)',
            }}
          >
            {clip.caption}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** End card: headline + CTA + domain, uses brand colors only. */
const Outro: React.FC<{
  businessName: string;
  headline: string;
  cta?: string;
  domain?: string;
  palette: BrandPalette;
}> = ({ businessName, headline, cta, domain, palette }) => {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, 16], [0.96, 1], {
    extrapolateRight: 'clamp',
    easing: bezier,
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONTS.display,
        background: `radial-gradient(circle at 30% 20%, ${palette.primary}44, transparent 60%), radial-gradient(circle at 70% 80%, ${palette.accent}44, transparent 60%), ${palette.dark}`,
        padding: 90,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transform: `scale(${scale})`,
      }}
    >
      <Rise delay={6} dur={16}>
        <BrandMark businessName={businessName} color="#fff" markColor={palette.primary} size={60} />
      </Rise>

      <Rise delay={12} dur={18}>
        <div>
          <div
            style={{
              fontSize: 140,
              lineHeight: 1.02,
              fontFamily: FONTS.serif,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: -1.5,
            }}
          >
            {headline}
          </div>
        </div>
      </Rise>

      <Rise delay={22} dur={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {cta ? (
            <div
              style={{
                display: 'inline-block',
                padding: '22px 44px',
                borderRadius: 999,
                background: palette.accent,
                color: palette.dark,
                fontWeight: 700,
                fontSize: 38,
                letterSpacing: 0.2,
              }}
            >
              {cta}
            </div>
          ) : null}
          {domain ? (
            <div style={{ color: '#fff', fontSize: 30, opacity: 0.85 }}>{domain}</div>
          ) : null}
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

/**
 * Fallback renderer when no `mediaClips` are provided. Gracefully shows
 * the single `imageUrl` (or a brand-colored canvas) and the headline so
 * the template isn't a blank frame.
 */
const FallbackClip: React.FC<{
  imageUrl?: string;
  headline: string;
  palette: BrandPalette;
}> = ({ imageUrl, headline, palette }) => {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, 120], [1, 1.08], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: palette.dark, overflow: 'hidden' }}>
      {imageUrl ? (
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})` }}>
          <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : null}
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${palette.primary}ee, ${palette.accent}dd)`,
          opacity: imageUrl ? 0.35 : 1,
        }}
      />
      <AbsoluteFill
        style={{
          padding: 90,
          display: 'flex',
          alignItems: 'flex-end',
          fontFamily: FONTS.serif,
        }}
      >
        <Rise delay={10} dur={16}>
          <div style={{ fontSize: 120, color: '#fff', fontWeight: 700, lineHeight: 1.05 }}>
            {headline}
          </div>
        </Rise>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const MediaStory: React.FC<VideoProps> = (props) => {
  const { fps } = useVideoConfig();
  const { palette, options: merged } = applyPreset(
    props.brand,
    props.options,
    MEDIA_STORY_PRESETS,
  );
  const speed = moodSpeed(merged.mood);
  const clips = (props.mediaClips ?? []).slice(0, 6);

  if (clips.length === 0) {
    return (
      <AbsoluteFill>
        <Series>
          <Series.Sequence durationInFrames={Math.round(6 * fps * speed)}>
            <FallbackClip imageUrl={props.imageUrl} headline={props.headline} palette={palette} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={Math.round(OUTRO_SECONDS * fps * speed)}>
            <Outro
              businessName={props.businessName}
              headline={props.headline}
              cta={props.cta}
              domain={props.domain}
              palette={palette}
            />
          </Series.Sequence>
        </Series>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <Series>
        {clips.map((clip, i) => (
          <Series.Sequence key={i} durationInFrames={Math.round(clipFrames(clip, fps) / speed)}>
            <MediaClipScene clip={clip} palette={palette} index={i} total={clips.length} />
          </Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={Math.round(OUTRO_SECONDS * fps * speed)}>
          <Outro
            businessName={props.businessName}
            headline={props.headline}
            cta={props.cta}
            domain={props.domain}
            palette={palette}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

export const MediaStoryMeta = {
  id: 'media-story',
  name: 'Media Story',
  description:
    'Your photos and clips, sequenced with per-moment captions and a brand outro. The most personalized template — uses the client\'s uploaded media directly.',
  /**
   * 6 clips × 2.8s + 2.8s outro = 19.6s. The renderer recomputes this
   * dynamically based on `mediaClips.length` (see `computeDuration`
   * below), so this constant is only the default for Remotion Studio.
   */
  durationFrames: 30 * 20,
  usesImage: true,
  bestFor: [
    'Brand reels',
    'Grand openings',
    'Before/after showcases',
    'Team introductions',
    'Menu reveals',
  ],
} as const;

/**
 * MediaStory preset roster. Photography stays untouched — only the
 * bottom scrim, outro gradient, accent captions, and progress dots
 * take on the preset palette. This keeps the client's own photos
 * front-and-centre, which is what MediaStory is for.
 */
export const MEDIA_STORY_PRESETS: readonly TemplatePreset[] = [
  {
    id: 'default',
    name: 'Brand default',
    description: 'Uses the client brand palette directly — no overrides.',
    thumbnailSeed: 'story-default',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Near-black scrim with warm cream accents. Magazine-style.',
    palette: {
      primary: '#F5F1EA',
      accent: '#E8DCC8',
      pop: '#D4A574',
      dark: '#0A0A0A',
    },
    options: { mood: 'calm' },
    thumbnailSeed: 'story-editorial',
  },
  {
    id: 'cinema',
    name: 'Cinema',
    description: 'Deep cinematic teal with copper accents. Moody storytelling.',
    palette: {
      primary: '#0E5E5F',
      accent: '#D97706',
      pop: '#FBBF24',
      dark: '#051112',
    },
    options: { mood: 'calm' },
    thumbnailSeed: 'story-cinema',
  },
  {
    id: 'sunlit',
    name: 'Sunlit',
    description: 'Warm peach scrim with gold pop. Bright, daytime outdoor.',
    palette: {
      primary: '#FBBF77',
      accent: '#F97316',
      pop: '#FEF3C7',
      dark: '#1F0F07',
    },
    thumbnailSeed: 'story-sunlit',
  },
  {
    id: 'nordic',
    name: 'Nordic',
    description: 'Cool cloudy greys with slate pop. Minimal Scandinavian feel.',
    palette: {
      primary: '#CBD5E1',
      accent: '#94A3B8',
      pop: '#F8FAFC',
      dark: '#0F172A',
    },
    options: { mood: 'calm' },
    thumbnailSeed: 'story-nordic',
  },
  {
    id: 'midnight-mag',
    name: 'Midnight',
    description: 'Pure-black scrim with electric cyan accent. Tech / nightlife.',
    palette: {
      primary: '#22D3EE',
      accent: '#06B6D4',
      pop: '#67E8F9',
      dark: '#000000',
    },
    thumbnailSeed: 'story-midnight',
  },
  {
    id: 'harvest',
    name: 'Harvest',
    description: 'Deep forest with ochre. Agricultural, artisanal, farm-to-table.',
    palette: {
      primary: '#14532D',
      accent: '#CA8A04',
      pop: '#FDE68A',
      dark: '#0A1A10',
    },
    options: { mood: 'calm' },
    thumbnailSeed: 'story-harvest',
  },
  {
    id: 'romance',
    name: 'Romance',
    description: 'Rose pink scrim with champagne accent. Weddings, salons.',
    palette: {
      primary: '#F472B6',
      accent: '#FDE68A',
      pop: '#FDF2F8',
      dark: '#2D0818',
    },
    options: { mood: 'calm' },
    thumbnailSeed: 'story-romance',
  },
  {
    id: 'pulse',
    name: 'Pulse',
    description: 'Electric red with hot pink pop. High-energy fitness / nightlife.',
    palette: {
      primary: '#EF4444',
      accent: '#EC4899',
      pop: '#FDE047',
      dark: '#0A0205',
    },
    options: { mood: 'energetic' },
    thumbnailSeed: 'story-pulse',
  },
  {
    id: 'ocean-story',
    name: 'Ocean',
    description: 'Deep blues with seafoam accent. Coastal, travel, wellness.',
    palette: {
      primary: '#0284C7',
      accent: '#22D3EE',
      pop: '#A7F3D0',
      dark: '#03101E',
    },
    thumbnailSeed: 'story-ocean',
  },
  {
    id: 'legacy',
    name: 'Legacy',
    description: 'Monochrome cream on black. Heritage brands, documentary style.',
    palette: {
      primary: '#F5F1EA',
      accent: '#D1C6B3',
      pop: '#FBBF24',
      dark: '#000000',
    },
    options: { mood: 'calm' },
    thumbnailSeed: 'story-legacy',
  },
] as const;

/**
 * Dynamically size the composition based on the number of clips. The
 * render.ts layer calls this so the output video length matches the
 * actual data instead of always being the Remotion default.
 */
export function computeMediaStoryDuration(props: VideoProps): number {
  const fps = 30;
  const clips = (props.mediaClips ?? []).slice(0, 6);
  const speed = moodSpeed(props.options?.mood);
  if (clips.length === 0) {
    return Math.round((6 + OUTRO_SECONDS) * fps * speed);
  }
  const body = clips.reduce((acc, c) => acc + clipFrames(c, fps), 0);
  return Math.round(body / speed + OUTRO_SECONDS * fps * speed);
}
