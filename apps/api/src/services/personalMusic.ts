/**
 * Background music sourcing for personal content.
 *
 * Walks a prioritized list of music providers and returns the first
 * match for a mood query. Falls back to a small built-in royalty-free
 * library at `{R2_PUBLIC_URL}/public/music/` (or `PERSONAL_MUSIC_CDN_URL`)
 * when those bases are set and reachable — otherwise Pixabay-only or no
 * background track. When R2 is configured (and built-ins are not using
 * `PERSONAL_MUSIC_CDN_URL`), catalog entries are filtered to files that exist
 * under `public/music/`; any other audio in that prefix (operator uploads) is
 * merged in with generic attribution so uploads are pickable without editing
 * this module. Partial buckets do not 404 on missing catalog files.
 * The operator R2 library step lists the entire configured prefix (paginated),
 * de-duplicates, then picks one track from that full list. Empty `musicMood`
 * falls back to a generic query so R2 / built-ins can still run.
 */

import { createHash } from 'node:crypto';
import { searchPixabayMusic } from './personalScraper.js';
import type { PersonalScrapedItem } from '@boost/database';
import { env, features } from '../env.js';
import { listMusicAssetKeysUnderPrefix } from './r2.js';

const PUBLIC_MUSIC_PREFIX = 'public/music/';

/** Object key under `public/music/` on the R2 public bucket (same layout as production CDN). */
type BuiltinTrackMeta = Omit<PersonalScrapedItem, 'url'> & { file: string };

/** When R2 is on, only offer built-in tracks whose files exist under `public/music/` (avoids 404 on partial buckets). */
let publicMusicBasenamesCache: { set: Set<string>; fetchedAt: number } | null = null;
const PUBLIC_MUSIC_LIST_TTL_MS = 2 * 60 * 1000;

/** Basenames present in R2 under `public/music/`. `undefined` = listing failed — do not filter. */
async function getBuiltinFilenamesPresentOnR2(): Promise<Set<string> | undefined> {
  if (!features.r2 || !env.R2_BUCKET_NAME?.trim()) return undefined;
  const now = Date.now();
  if (publicMusicBasenamesCache && now - publicMusicBasenamesCache.fetchedAt < PUBLIC_MUSIC_LIST_TTL_MS) {
    return publicMusicBasenamesCache.set;
  }
  try {
    const keys = await listMusicAssetKeysUnderPrefix(PUBLIC_MUSIC_PREFIX, {
      maxKeys: 20_000,
      maxPages: 100,
    });
    const set = new Set(
      keys.map((k) => k.split('/').pop()).filter((b): b is string => Boolean(b)),
    );
    publicMusicBasenamesCache = { set, fetchedAt: now };
    return set;
  } catch (e) {
    console.warn('[music] could not list public/music/ for built-ins:', (e as Error).message);
    return undefined;
  }
}

/**
 * Built-in, cleared-for-commercial-use tracks. Keyed loosely by mood
 * tag so a theme's `musicMood` can route to the right vibe. Files are
 * read from `{R2_PUBLIC_URL}/public/music/{file}` when R2 is fully
 * configured — never hard-code a hostname so local dev can use a
 * resolvable tunnel or skip music when R2 is off.
 */
const BUILT_IN: Record<string, BuiltinTrackMeta[]> = {
  corporate: [
    {
      file: 'corporate-minimal-1.mp3',
      kind: 'music',
      durationSeconds: 120,
      title: 'Minimal Corporate',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
    {
      file: 'corporate-piano-1.mp3',
      kind: 'music',
      durationSeconds: 90,
      title: 'Soft Piano',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  cinematic: [
    {
      file: 'cinematic-orchestral-1.mp3',
      kind: 'music',
      durationSeconds: 180,
      title: 'Cinematic Orchestra',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
    {
      file: 'cinematic-hopeful-1.mp3',
      kind: 'music',
      durationSeconds: 150,
      title: 'Hopeful Cinematic',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  upbeat: [
    {
      file: 'upbeat-pop-1.mp3',
      kind: 'music',
      durationSeconds: 90,
      title: 'Upbeat Pop',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
    {
      file: 'energetic-build-1.mp3',
      kind: 'music',
      durationSeconds: 90,
      title: 'Energetic Build',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  lofi: [
    {
      file: 'lofi-study-1.mp3',
      kind: 'music',
      durationSeconds: 180,
      title: 'Lo-Fi Study',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
    {
      file: 'lofi-chill-1.mp3',
      kind: 'music',
      durationSeconds: 150,
      title: 'Lo-Fi Chill',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  tech: [
    {
      file: 'synthwave-ambient-1.mp3',
      kind: 'music',
      durationSeconds: 120,
      title: 'Synthwave Ambient',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  news: [
    {
      file: 'news-intro-urgent-1.mp3',
      kind: 'music',
      durationSeconds: 60,
      title: 'News Intro Urgent',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
  ],
  calm: [
    {
      file: 'bossa-lofi-1.mp3',
      kind: 'music',
      durationSeconds: 150,
      title: 'Bossa Lo-Fi',
      attribution: 'Royalty-free, BoostMyBranding library',
    },
    {
      file: 'sappheiros-dawn-calm.mp3',
      kind: 'music',
      durationSeconds: 221,
      title: 'Dawn',
      attribution: 'Sappheiros — Dawn; confirm NCM / artist terms for your distribution',
    },
  ],
};

/** Basenames declared in {@link BUILT_IN}. */
function allCatalogFilenames(): Set<string> {
  const s = new Set<string>();
  for (const arr of Object.values(BUILT_IN)) {
    for (const m of arr) s.add(m.file);
  }
  return s;
}

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg)$/i;

/** Turn `neutrin05-missing-you.mp3` into a short display title. */
function humanizeMusicBasename(file: string): string {
  const base = file.replace(AUDIO_EXT, '').replace(/[-_]+/g, ' ').trim();
  if (!base) return file;
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Deduped catalog entries whose `file` exists in `present`, plus any other
 * audio basenames under `public/music/` (operator uploads) so R2-only tracks
 * still participate in the built-in pool without editing this file.
 */
function builtinMetasOnDisk(present: Set<string>): BuiltinTrackMeta[] {
  const seen = new Set<string>();
  const out: BuiltinTrackMeta[] = [];
  for (const arr of Object.values(BUILT_IN)) {
    for (const m of arr) {
      if (!present.has(m.file) || seen.has(m.file)) continue;
      seen.add(m.file);
      out.push(m);
    }
  }
  const catalogFiles = allCatalogFilenames();
  for (const file of present) {
    if (seen.has(file) || !AUDIO_EXT.test(file)) continue;
    if (catalogFiles.has(file)) continue;
    seen.add(file);
    out.push({
      file,
      kind: 'music',
      title: humanizeMusicBasename(file),
      attribution: 'Public music library — confirm license fits your distribution',
      durationSeconds: 120,
    });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

function builtinMusicPublicUrl(file: string): string | null {
  const override = process.env.PERSONAL_MUSIC_CDN_URL?.trim().replace(/\/$/, '');
  if (override) return `${override}/public/music/${file}`;
  if (!features.r2) return null;
  const base = env.R2_PUBLIC_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/public/music/${file}`;
}

/**
 * Full paginated listing under the library prefix, de-duplicated and sorted,
 * then one track is chosen from this array (see {@link pickMusic}).
 */
async function listAllLibraryMusicKeysForPrefix(prefix: string): Promise<string[]> {
  const raw = await listMusicAssetKeysUnderPrefix(prefix, { maxKeys: 50_000, maxPages: 200 });
  return [...new Set(raw)].sort((a, b) => a.localeCompare(b));
}

function materializeBuiltin(meta: BuiltinTrackMeta): PersonalScrapedItem | null {
  const url = builtinMusicPublicUrl(meta.file);
  if (!url) return null;
  const { file: _f, ...rest } = meta;
  return { ...rest, url };
}

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
  /**
   * When set and R2 is on, lists **every** audio object under
   * `public/personal-music/{accountId}/` or `PERSONAL_MUSIC_LIBRARY_PREFIX`
   * (paginated), then picks **one** key from that full list (deterministic
   * from `seed`). Runs before built-in CDN tracks.
   */
  accountId?: string;
}

export interface PickedMusic {
  url: string;
  attribution: string;
  creditUrl?: string;
  durationSeconds?: number;
  source: 'pixabay' | 'builtin' | 'r2_library' | 'none';
}

/**
 * Picks a background music track for a given mood. Tries Pixabay first
 * (real-world long-tail) and falls back to our built-in library.
 * Returns `source: 'none'` when music is explicitly disabled or no
 * provider is available — templates can honor that by omitting the
 * `<Audio>` component.
 */
export async function pickMusic(args: PickMusicArgs): Promise<PickedMusic | null> {
  // Themes sometimes set `musicMood` to "". Still run R2 + built-in paths with a generic query.
  const mood = args.mood?.trim() ? args.mood.trim() : 'ambient instrumental';

  // 1. Pixabay ----------------------------------------------------------
  if (process.env.PIXABAY_API_KEY) {
    try {
      const tracks = await searchPixabayMusic(mood, 10);
      const long = tracks.filter(
        (t) =>
          t.url &&
          (!args.minDurationSeconds ||
            (t.durationSeconds ?? 0) >= args.minDurationSeconds),
      );
      const pool = long.length > 0 ? long : tracks.filter((t) => t.url);
      if (pool.length > 0) {
        const idx = hashIndex(args.seed ?? mood, pool.length);
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

  // 1b. R2 operator library — full folder listing, then one deterministic pick
  if (features.r2 && args.accountId) {
    const base = env.R2_PUBLIC_URL?.trim().replace(/\/$/, '');
    if (base) {
      const envPrefix = process.env.PERSONAL_MUSIC_LIBRARY_PREFIX?.trim().replace(/^\/+/, '').replace(/\/+$/, '');
      const prefix = envPrefix
        ? `${envPrefix}/`
        : `public/personal-music/${args.accountId}/`;
      try {
        const allKeys = await listAllLibraryMusicKeysForPrefix(prefix);
        if (allKeys.length > 0) {
          const idx = hashIndex(args.seed ?? mood, allKeys.length);
          const key = allKeys[idx]!;
          return {
            url: `${base}/${key.replace(/^\/+/, '')}`,
            attribution: 'From your R2 music library',
            source: 'r2_library',
          };
        }
      } catch (e) {
        console.warn('[music] R2 library listing failed:', (e as Error).message);
      }
    }
  }

  // 2. Built-in (same paths as prod CDN, but resolved from R2_PUBLIC_URL) ---
  const bucket = moodToBucket(mood);
  const poolRaw = BUILT_IN[bucket] ?? BUILT_IN.corporate ?? [];
  // When built-ins are served from PERSONAL_MUSIC_CDN_URL, do not filter by R2 inventory.
  const cdnBuiltin = process.env.PERSONAL_MUSIC_CDN_URL?.trim();
  const presentOnR2 = cdnBuiltin ? undefined : await getBuiltinFilenamesPresentOnR2();

  let candidateMetas: BuiltinTrackMeta[] = poolRaw;
  if (presentOnR2 !== undefined) {
    candidateMetas = poolRaw.filter((m) => presentOnR2.has(m.file));
    if (candidateMetas.length === 0 && presentOnR2.size > 0) {
      // e.g. cinematic mood but only calm stock files uploaded — use any catalog track on disk
      candidateMetas = builtinMetasOnDisk(presentOnR2);
    }
    if (candidateMetas.length === 0 && presentOnR2.size === 0) {
      console.warn(
        '[music] no audio under public/music/ on R2 — built-in CDN tracks skipped. Upload .mp3 there, set PIXABAY_API_KEY, or use public/personal-music/…',
      );
    }
  }

  const pool = candidateMetas.map(materializeBuiltin).filter((x): x is PersonalScrapedItem => x !== null);
  if (pool.length === 0 && poolRaw.length > 0 && !features.r2 && !process.env.PERSONAL_MUSIC_CDN_URL?.trim()) {
    console.warn(
      '[music] built-in library skipped (no R2 and no PERSONAL_MUSIC_CDN_URL). Set R2_* + R2_PUBLIC_URL, set PERSONAL_MUSIC_CDN_URL to a reachable https base, add PIXABAY_API_KEY, or use custom account audio.',
    );
  }
  if (pool.length > 0) {
    const idx = hashIndex(args.seed ?? mood, pool.length);
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
