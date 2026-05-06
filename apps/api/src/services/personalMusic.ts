/**
 * Background music sourcing for personal content.
 *
 * Walks a prioritized list of music providers and returns the first
 * match for a mood query. Falls back to a small built-in royalty-free
 * library hosted on our own R2 so the pipeline always has *some*
 * music to work with, even without API keys.
 */

import { createHash } from 'node:crypto';
import { searchPixabayMusic } from './personalScraper.js';
import type { PersonalScrapedItem } from '@boost/database';

/**
 * Built-in, cleared-for-commercial-use tracks. Keyed loosely by mood
 * tag so a theme's `musicMood` can route to the right vibe. Add more
 * over time — these live on our own CDN so rendering never blocks on
 * an external 404.
 */
const BUILT_IN: Record<string, PersonalScrapedItem[]> = {
  corporate: [
    {
      url: 'https://r2.boostmybranding.com/public/music/corporate-minimal-1.mp3',
      kind: 'music',
      durationSeconds: 120,
      title: 'Minimal Corporate',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
    {
      url: 'https://r2.boostmybranding.com/public/music/corporate-piano-1.mp3',
      kind: 'music',
      durationSeconds: 90,
      title: 'Soft Piano',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  cinematic: [
    {
      url: 'https://r2.boostmybranding.com/public/music/cinematic-orchestral-1.mp3',
      kind: 'music',
      durationSeconds: 180,
      title: 'Cinematic Orchestra',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
    {
      url: 'https://r2.boostmybranding.com/public/music/cinematic-hopeful-1.mp3',
      kind: 'music',
      durationSeconds: 150,
      title: 'Hopeful Cinematic',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  upbeat: [
    {
      url: 'https://r2.boostmybranding.com/public/music/upbeat-pop-1.mp3',
      kind: 'music',
      durationSeconds: 90,
      title: 'Upbeat Pop',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
    {
      url: 'https://r2.boostmybranding.com/public/music/energetic-build-1.mp3',
      kind: 'music',
      durationSeconds: 90,
      title: 'Energetic Build',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  lofi: [
    {
      url: 'https://r2.boostmybranding.com/public/music/lofi-study-1.mp3',
      kind: 'music',
      durationSeconds: 180,
      title: 'Lo-Fi Study',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
    {
      url: 'https://r2.boostmybranding.com/public/music/lofi-chill-1.mp3',
      kind: 'music',
      durationSeconds: 150,
      title: 'Lo-Fi Chill',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  tech: [
    {
      url: 'https://r2.boostmybranding.com/public/music/synthwave-ambient-1.mp3',
      kind: 'music',
      durationSeconds: 120,
      title: 'Synthwave Ambient',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  news: [
    {
      url: 'https://r2.boostmybranding.com/public/music/news-intro-urgent-1.mp3',
      kind: 'music',
      durationSeconds: 60,
      title: 'News Intro Urgent',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  calm: [
    {
      url: 'https://r2.boostmybranding.com/public/music/bossa-lofi-1.mp3',
      kind: 'music',
      durationSeconds: 150,
      title: 'Bossa Lo-Fi',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
};

function moodToBucket(mood: string): keyof typeof BUILT_IN {
  const m = mood.toLowerCase();
  if (/cinem|orchestr|epic|hist/.test(m)) return 'cinematic';
  if (/upbeat|pop|ener|build/.test(m)) return 'upbeat';
  if (/lofi|lo-fi|chill|study|bossa|soft/.test(m)) return 'lofi';
  if (/tech|synth|wave|ambient/.test(m)) return 'tech';
  if (/news|urgent|break/.test(m)) return 'news';
  if (/calm|quiet|sleep/.test(m)) return 'calm';
  return 'corporate';
}

export interface PickMusicArgs {
  mood: string;
  /** Deterministic pick for a given post (so repeat renders match). */
  seed?: string;
  /** Target duration — we prefer tracks long enough to back this. */
  minDurationSeconds?: number;
}

export interface PickedMusic {
  url: string;
  attribution: string;
  creditUrl?: string;
  durationSeconds?: number;
  source: 'pixabay' | 'builtin' | 'none';
}

/**
 * Picks a background music track for a given mood. Tries Pixabay first
 * (real-world long-tail) and falls back to our built-in library.
 * Returns `source: 'none'` when music is explicitly disabled or no
 * provider is available — templates can honor that by omitting the
 * `<Audio>` component.
 */
export async function pickMusic(args: PickMusicArgs): Promise<PickedMusic | null> {
  if (!args.mood || args.mood.trim().length === 0) return null;

  // 1. Pixabay ----------------------------------------------------------
  if (process.env.PIXABAY_API_KEY) {
    try {
      const tracks = await searchPixabayMusic(args.mood, 10);
      const long = tracks.filter(
        (t) =>
          t.url &&
          (!args.minDurationSeconds ||
            (t.durationSeconds ?? 0) >= args.minDurationSeconds),
      );
      const pool = long.length > 0 ? long : tracks.filter((t) => t.url);
      if (pool.length > 0) {
        const idx = hashIndex(args.seed ?? args.mood, pool.length);
        const pick = pool[idx]!;
        return {
          url: pick.url,
          attribution: pick.attribution ?? 'Pixabay',
          creditUrl: pick.creditUrl,
          durationSeconds: pick.durationSeconds,
          source: 'pixabay',
        };
      }
    } catch (e) {
      console.warn('[music] pixabay failed:', (e as Error).message);
    }
  }

  // 2. Built-in ---------------------------------------------------------
  const bucket = moodToBucket(args.mood);
  const pool = BUILT_IN[bucket] ?? BUILT_IN.corporate;
  if (pool && pool.length > 0) {
    const idx = hashIndex(args.seed ?? args.mood, pool.length);
    const pick = pool[idx]!;
    return {
      url: pick.url,
      attribution: pick.attribution ?? 'BoostMyBranding',
      creditUrl: pick.creditUrl,
      durationSeconds: pick.durationSeconds,
      source: 'builtin',
    };
  }

  return null;
}

function hashIndex(seed: string, mod: number): number {
  if (mod <= 0) return 0;
  const hash = createHash('sha1').update(seed).digest();
  return hash.readUInt32BE(0) % mod;
}
