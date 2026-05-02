/**
 * Video template definitions for social media Reels/Stories/TikToks.
 *
 * These configs describe the structure and timing of short-form video
 * templates. They're designed to be rendered by Remotion (or any video
 * framework) using the client's brand colors, images, and copy.
 *
 * To add Remotion rendering:
 *   1. `pnpm add remotion @remotion/cli @remotion/renderer` in a new `apps/video` package
 *   2. Create Remotion compositions that consume these template configs
 *   3. Add a `/api/v1/automation/render-video` endpoint that calls Remotion's `renderMedia`
 *   4. Store rendered videos in R2 and attach to posts
 *
 * Each template is a sequence of scenes with timing, transitions, and
 * slots for dynamic content (text, images, brand colors).
 */

export interface VideoScene {
  /** Unique key for this scene. */
  id: string;
  /** Duration in frames (at 30fps). */
  durationFrames: number;
  /** Scene type determines the visual layout. */
  type:
    | 'title'        // Big text + brand gradient background
    | 'image'        // Full-bleed image with text overlay
    | 'split'        // Image left, text right (or vice versa)
    | 'stats'        // Animated counter with label
    | 'quote'        // Testimonial with author
    | 'cta'          // Call-to-action with button
    | 'logo'         // Logo reveal / outro
    | 'text-stack'   // Multiple text lines appearing sequentially
    | 'before-after' // Side-by-side comparison
    | 'carousel';    // Multiple images cycling
  /** Transition into this scene. */
  transition?: 'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'none';
  /** Content slots — filled dynamically per post. */
  slots: {
    headline?: string;
    subtext?: string;
    imageIndex?: number | null;
    imagePrompt?: string;
    stat?: { value: number; suffix?: string; label: string };
    quote?: { text: string; author: string };
    cta?: { label: string; href?: string };
    items?: string[];
  };
}

export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  /** Target aspect ratio. */
  aspect: '9:16' | '1:1' | '16:9';
  /** Total duration in seconds. */
  durationSeconds: number;
  /** Frames per second. */
  fps: 30;
  /** Scenes in order. */
  scenes: VideoScene[];
  /** Which content types this template works best for. */
  bestFor: string[];
}

/**
 * Pre-built video templates. Each is designed to be simple, modern, and
 * brand-driven — the client's colors, fonts, and images slot in automatically.
 */
export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: 'product-showcase',
    name: 'Product Showcase',
    description: 'Hero image → 3 features → CTA. Clean and punchy.',
    aspect: '9:16',
    durationSeconds: 15,
    fps: 30,
    bestFor: ['promotional', 'educational'],
    scenes: [
      {
        id: 'hero',
        durationFrames: 120,
        type: 'image',
        transition: 'zoom',
        slots: { headline: '', imageIndex: 0 },
      },
      {
        id: 'features',
        durationFrames: 180,
        type: 'text-stack',
        transition: 'slide-up',
        slots: { items: [] },
      },
      {
        id: 'cta',
        durationFrames: 90,
        type: 'cta',
        transition: 'fade',
        slots: { cta: { label: 'Book now' } },
      },
      {
        id: 'outro',
        durationFrames: 60,
        type: 'logo',
        transition: 'fade',
        slots: {},
      },
    ],
  },
  {
    id: 'testimonial-reel',
    name: 'Testimonial Reel',
    description: 'Quote → stats → CTA. Builds trust fast.',
    aspect: '9:16',
    durationSeconds: 12,
    fps: 30,
    bestFor: ['testimonial', 'engagement'],
    scenes: [
      {
        id: 'hook',
        durationFrames: 60,
        type: 'title',
        transition: 'fade',
        slots: { headline: 'What our customers say' },
      },
      {
        id: 'quote',
        durationFrames: 150,
        type: 'quote',
        transition: 'slide-left',
        slots: { quote: { text: '', author: '' } },
      },
      {
        id: 'stat',
        durationFrames: 90,
        type: 'stats',
        transition: 'zoom',
        slots: { stat: { value: 0, suffix: '', label: '' } },
      },
      {
        id: 'cta',
        durationFrames: 60,
        type: 'cta',
        transition: 'fade',
        slots: { cta: { label: 'Get started' } },
      },
    ],
  },
  {
    id: 'before-after',
    name: 'Before & After',
    description: 'Split comparison → result → CTA. Great for transformations.',
    aspect: '9:16',
    durationSeconds: 10,
    fps: 30,
    bestFor: ['behind-the-scenes', 'promotional'],
    scenes: [
      {
        id: 'compare',
        durationFrames: 150,
        type: 'before-after',
        transition: 'slide-left',
        slots: { headline: 'The difference' },
      },
      {
        id: 'result',
        durationFrames: 90,
        type: 'image',
        transition: 'zoom',
        slots: { headline: '', imageIndex: null },
      },
      {
        id: 'cta',
        durationFrames: 60,
        type: 'cta',
        transition: 'fade',
        slots: { cta: { label: 'Book yours' } },
      },
    ],
  },
  {
    id: 'tip-carousel',
    name: 'Quick Tips',
    description: '3-5 tips with animated text. Educational and shareable.',
    aspect: '9:16',
    durationSeconds: 20,
    fps: 30,
    bestFor: ['educational', 'engagement'],
    scenes: [
      {
        id: 'hook',
        durationFrames: 60,
        type: 'title',
        transition: 'zoom',
        slots: { headline: '' },
      },
      {
        id: 'tips',
        durationFrames: 420,
        type: 'text-stack',
        transition: 'slide-up',
        slots: { items: [] },
      },
      {
        id: 'cta',
        durationFrames: 60,
        type: 'cta',
        transition: 'fade',
        slots: { cta: { label: 'Follow for more' } },
      },
      {
        id: 'outro',
        durationFrames: 60,
        type: 'logo',
        transition: 'fade',
        slots: {},
      },
    ],
  },
  {
    id: 'story-promo',
    name: 'Story Promo',
    description: 'Fast-paced promo for Instagram/TikTok Stories. 6 seconds.',
    aspect: '9:16',
    durationSeconds: 6,
    fps: 30,
    bestFor: ['promotional', 'seasonal'],
    scenes: [
      {
        id: 'flash',
        durationFrames: 45,
        type: 'image',
        transition: 'zoom',
        slots: { headline: '', imageIndex: 0 },
      },
      {
        id: 'offer',
        durationFrames: 75,
        type: 'title',
        transition: 'slide-up',
        slots: { headline: '', subtext: '' },
      },
      {
        id: 'cta',
        durationFrames: 60,
        type: 'cta',
        transition: 'fade',
        slots: { cta: { label: 'Swipe up' } },
      },
    ],
  },
];

/** Look up a video template by id. */
export function getVideoTemplate(id: string): VideoTemplate | undefined {
  return VIDEO_TEMPLATES.find((t) => t.id === id);
}
