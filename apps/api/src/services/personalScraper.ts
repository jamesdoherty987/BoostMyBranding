/**
 * Asset scraper for personal content.
 *
 * A single unified interface over multiple free / near-free media
 * providers. Each lookup returns a ranked list of candidate assets with
 * proper attribution metadata so downstream code can credit sources
 * correctly.
 *
 * Providers (all optional — missing credentials = provider skipped):
 *   - Pexels       images + videos, free API (PEXELS_API_KEY)
 *   - Unsplash     images only, free tier  (UNSPLASH_ACCESS_KEY)
 *   - Pixabay      images + music          (PIXABAY_API_KEY)
 *   - Wikipedia    REST API — no key, CC-BY-SA encyclopedia imagery
 *   - Google News  RSS — no key, real news headlines + embedded imagery
 *   - Gameplay     loopable MP4s hosted on R2 / local dir
 *
 * Results are cached into `personal_scraped_assets` for 7 days so we
 * don't hammer third-party quotas for repeated topics.
 */

import { createHash } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  personalScrapedAssets,
  type PersonalScrapedItem,
} from '@boost/database';

/* ═══════════════════════════════════════════════════════════════════ */
/* Config                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Curated royalty-free gameplay background loops. Hosted on R2 once
 * uploaded; falls back to the public sample URLs for dev. Add new
 * entries here and they're immediately available to the brainrot
 * template.
 */
const GAMEPLAY_LOOPS: PersonalScrapedItem[] = [
  {
    url: 'https://r2.boostmybranding.com/public/gameplay/subway-surfers-1.mp4',
    kind: 'video',
    durationSeconds: 60,
    title: 'Subway Surfers loop A',
    attribution: 'Royalty-free gameplay loop',
  },
  {
    url: 'https://r2.boostmybranding.com/public/gameplay/minecraft-parkour-1.mp4',
    kind: 'video',
    durationSeconds: 60,
    title: 'Minecraft parkour loop A',
    attribution: 'Royalty-free gameplay loop',
  },
  {
    url: 'https://r2.boostmybranding.com/public/gameplay/gta-driving-1.mp4',
    kind: 'video',
    durationSeconds: 60,
    title: 'GTA driving loop A',
    attribution: 'Royalty-free gameplay loop',
  },
];

/* ═══════════════════════════════════════════════════════════════════ */
/* Cache helpers                                                        */
/* ═══════════════════════════════════════════════════════════════════ */

function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 240);
}

function cacheKey(source: string, query: string): string {
  return createHash('sha1').update(`${source}:${normalizeQuery(query)}`).digest('hex');
}

async function readCache(
  source: string,
  query: string,
  assetType: PersonalScrapedItem['kind'],
): Promise<PersonalScrapedItem[] | null> {
  if (!isDbConfigured()) return null;
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(personalScrapedAssets)
      .where(
        and(
          eq(personalScrapedAssets.source, source),
          eq(personalScrapedAssets.queryKey, cacheKey(source, query)),
          eq(personalScrapedAssets.assetType, assetType),
          gt(personalScrapedAssets.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row?.items ?? null;
  } catch {
    return null;
  }
}

async function writeCache(
  source: string,
  query: string,
  assetType: PersonalScrapedItem['kind'],
  items: PersonalScrapedItem[],
) {
  if (!isDbConfigured()) return;
  try {
    const db = getDb();
    const key = cacheKey(source, query);
    // Upsert via delete-then-insert — the unique index on (source, key, type)
    // makes a tx-less delete safe.
    await db
      .delete(personalScrapedAssets)
      .where(
        and(
          eq(personalScrapedAssets.source, source),
          eq(personalScrapedAssets.queryKey, key),
          eq(personalScrapedAssets.assetType, assetType),
        ),
      );
    await db.insert(personalScrapedAssets).values({
      source,
      queryKey: key,
      assetType,
      items,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    });
  } catch (e) {
    console.warn('[personalScraper] cache write failed:', (e as Error).message);
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Pexels                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  photographer_url: string;
  alt?: string;
  url: string;
  src: { original: string; large2x: string; large: string; portrait: string };
}
interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  user: { name: string; url: string };
  url: string;
  video_files: Array<{ link: string; quality: string; width: number; height: number }>;
  image: string;
}

export async function searchPexelsPhotos(
  query: string,
  count = 10,
): Promise<PersonalScrapedItem[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  const cached = await readCache('pexels', query, 'image');
  if (cached) return cached;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${count}`,
      { headers: { Authorization: apiKey } },
    );
    if (!res.ok) throw new Error(`pexels ${res.status}`);
    const body = (await res.json()) as { photos: PexelsPhoto[] };
    const items: PersonalScrapedItem[] = body.photos.map((p) => ({
      url: p.src.large2x ?? p.src.original,
      downloadUrl: p.src.original,
      kind: 'image',
      width: p.width,
      height: p.height,
      title: p.alt ?? undefined,
      attribution: `Photo by ${p.photographer} on Pexels`,
      creditUrl: p.photographer_url,
      thumbnailUrl: p.src.large,
    }));
    await writeCache('pexels', query, 'image', items);
    return items;
  } catch (e) {
    console.warn('[pexels] failed:', (e as Error).message);
    return [];
  }
}

export async function searchPexelsVideos(
  query: string,
  count = 5,
): Promise<PersonalScrapedItem[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  const cached = await readCache('pexels', query, 'video');
  if (cached) return cached;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${count}`,
      { headers: { Authorization: apiKey } },
    );
    if (!res.ok) throw new Error(`pexels-video ${res.status}`);
    const body = (await res.json()) as { videos: PexelsVideo[] };
    const items: PersonalScrapedItem[] = body.videos.map((v) => {
      // Pick the best vertical-ish file ≤ 1920x1080.
      const file =
        v.video_files
          .filter((f) => f.link && f.width > 0)
          .sort(
            (a, b) =>
              Math.abs((a.width / a.height) - 9 / 16) -
              Math.abs((b.width / b.height) - 9 / 16),
          )[0] ?? v.video_files[0];
      if (!file) {
        return {
          url: '',
          kind: 'video' as const,
        } satisfies PersonalScrapedItem;
      }
      return {
        url: file.link,
        kind: 'video',
        width: v.width,
        height: v.height,
        durationSeconds: v.duration,
        attribution: `Video by ${v.user.name} on Pexels`,
        creditUrl: v.user.url,
        thumbnailUrl: v.image,
      };
    });
    const valid = items.filter((it) => Boolean(it.url));
    await writeCache('pexels', query, 'video', valid);
    return valid;
  } catch (e) {
    console.warn('[pexels-video] failed:', (e as Error).message);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Unsplash                                                             */
/* ═══════════════════════════════════════════════════════════════════ */

export async function searchUnsplashPhotos(
  query: string,
  count = 10,
): Promise<PersonalScrapedItem[]> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  const cached = await readCache('unsplash', query, 'image');
  if (cached) return cached;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${count}`,
      { headers: { Authorization: `Client-ID ${apiKey}` } },
    );
    if (!res.ok) throw new Error(`unsplash ${res.status}`);
    const body = (await res.json()) as {
      results: Array<{
        id: string;
        width: number;
        height: number;
        urls: { raw: string; full: string; regular: string; small: string };
        user: { name: string; username: string };
        alt_description?: string;
      }>;
    };
    const items: PersonalScrapedItem[] = body.results.map((p) => ({
      url: `${p.urls.raw}&w=1920&h=1920&fit=max&auto=format`,
      downloadUrl: p.urls.full,
      kind: 'image',
      width: p.width,
      height: p.height,
      title: p.alt_description ?? undefined,
      attribution: `Photo by ${p.user.name} on Unsplash`,
      creditUrl: `https://unsplash.com/@${p.user.username}`,
      thumbnailUrl: p.urls.small,
    }));
    await writeCache('unsplash', query, 'image', items);
    return items;
  } catch (e) {
    console.warn('[unsplash] failed:', (e as Error).message);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Pixabay — images + music                                             */
/* ═══════════════════════════════════════════════════════════════════ */

export async function searchPixabayPhotos(
  query: string,
  count = 10,
): Promise<PersonalScrapedItem[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  const cached = await readCache('pixabay', query, 'image');
  if (cached) return cached;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&orientation=vertical&image_type=photo&per_page=${count}&safesearch=true`,
    );
    if (!res.ok) throw new Error(`pixabay ${res.status}`);
    const body = (await res.json()) as {
      hits: Array<{
        id: number;
        webformatURL: string;
        largeImageURL: string;
        imageWidth: number;
        imageHeight: number;
        user: string;
        pageURL: string;
        tags: string;
      }>;
    };
    const items: PersonalScrapedItem[] = body.hits.map((h) => ({
      url: h.largeImageURL,
      downloadUrl: h.largeImageURL,
      kind: 'image',
      width: h.imageWidth,
      height: h.imageHeight,
      title: h.tags,
      attribution: `Image by ${h.user} on Pixabay`,
      creditUrl: h.pageURL,
      thumbnailUrl: h.webformatURL,
    }));
    await writeCache('pixabay', query, 'image', items);
    return items;
  } catch (e) {
    console.warn('[pixabay] failed:', (e as Error).message);
    return [];
  }
}

/**
 * Pixabay Music — requires a separate "music" API key. Returns
 * previewable mp3 urls suitable for backing a 30-60s video.
 */
export async function searchPixabayMusic(
  query: string,
  count = 8,
): Promise<PersonalScrapedItem[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  const cached = await readCache('pixabay', query, 'music');
  if (cached) return cached;
  if (!apiKey) return [];

  try {
    // Pixabay's audio endpoint is under music, same API key.
    const res = await fetch(
      `https://pixabay.com/api/music/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${count}`,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as {
      hits?: Array<{
        id: number;
        audio?: string;
        title?: string;
        user?: string;
        pageURL?: string;
        duration?: number;
      }>;
    };
    const items: PersonalScrapedItem[] = (body.hits ?? [])
      .filter((h) => Boolean(h.audio))
      .map((h) => ({
        url: h.audio!,
        kind: 'music',
        title: h.title,
        durationSeconds: h.duration,
        attribution: h.user ? `Music by ${h.user} on Pixabay` : 'Pixabay',
        creditUrl: h.pageURL,
      }));
    await writeCache('pixabay', query, 'music', items);
    return items;
  } catch (e) {
    console.warn('[pixabay-music] failed:', (e as Error).message);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Wikipedia — real encyclopedia imagery                                */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Looks up Wikipedia page images for a topic. Uses the MediaWiki API
 * with `action=query&prop=pageimages|images`. Returns the lead image +
 * up to N gallery images. All Wikimedia Commons images are licensed
 * under free licenses; we pass the page URL through as attribution.
 */
export async function searchWikipediaImages(
  query: string,
  count = 8,
): Promise<PersonalScrapedItem[]> {
  const cached = await readCache('wikipedia', query, 'image');
  if (cached) return cached;

  try {
    // Step 1 — resolve the query to a page title.
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query,
      )}&srlimit=3&format=json&origin=*`,
    );
    const searchBody = (await searchRes.json()) as {
      query?: { search?: Array<{ title: string }> };
    };
    const titles =
      searchBody.query?.search?.map((s) => s.title).slice(0, 3) ?? [];
    if (titles.length === 0) return [];

    const items: PersonalScrapedItem[] = [];
    for (const title of titles) {
      // Step 2 — get page images via prop=pageimages (lead image) +
      // prop=images (all images on the page).
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
          title,
        )}&prop=pageimages|images&pithumbsize=1920&imlimit=20&format=json&origin=*`,
      );
      const body = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title: string;
              fullurl?: string;
              thumbnail?: { source: string; width: number; height: number };
              images?: Array<{ title: string }>;
            }
          >;
        };
      };
      const pages = Object.values(body.query?.pages ?? {});
      for (const p of pages) {
        if (p.thumbnail?.source) {
          items.push({
            url: p.thumbnail.source,
            kind: 'image',
            width: p.thumbnail.width,
            height: p.thumbnail.height,
            title: p.title,
            attribution: `Wikipedia — ${p.title}`,
            creditUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
          });
        }
        // Resolve a few inline images to direct Commons urls.
        for (const img of (p.images ?? []).slice(0, 6)) {
          if (!img.title) continue;
          const imageName = img.title.replace(/^File:/i, '').trim();
          if (!/\.(jpg|jpeg|png|webp)$/i.test(imageName)) continue;
          const commons = await resolveCommonsFile(imageName);
          if (commons) items.push(commons);
          if (items.length >= count) break;
        }
        if (items.length >= count) break;
      }
      if (items.length >= count) break;
    }

    const trimmed = items.slice(0, count);
    await writeCache('wikipedia', query, 'image', trimmed);
    return trimmed;
  } catch (e) {
    console.warn('[wikipedia] failed:', (e as Error).message);
    return [];
  }
}

async function resolveCommonsFile(name: string): Promise<PersonalScrapedItem | null> {
  try {
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(
        name,
      )}&prop=imageinfo&iiprop=url|size|extmetadata&format=json&origin=*`,
    );
    const body = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title: string;
            imageinfo?: Array<{
              url: string;
              width: number;
              height: number;
              extmetadata?: { Artist?: { value?: string } };
            }>;
          }
        >;
      };
    };
    const page = Object.values(body.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    if (!info?.url) return null;
    const artist =
      info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim() ?? 'Wikimedia Commons';
    return {
      url: info.url,
      kind: 'image',
      width: info.width,
      height: info.height,
      title: name,
      attribution: artist,
      creditUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`,
    };
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Google News RSS — real-world news imagery                            */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Fetches the top N items for a query from Google News RSS. Each item
 * carries a description HTML blob that usually includes an article
 * thumbnail. We extract image urls, title, publisher, and link.
 *
 * Rate-limited by Google but unauthenticated, so we cache aggressively.
 */
export async function searchGoogleNews(
  query: string,
  count = 10,
): Promise<PersonalScrapedItem[]> {
  const cached = await readCache('google_news', query, 'article');
  if (cached) return cached;

  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BoostBot/1.0)' },
    });
    if (!res.ok) throw new Error(`google-news ${res.status}`);
    const xml = await res.text();
    const rawItems = parseRssItems(xml);
    const items: PersonalScrapedItem[] = rawItems
      .slice(0, count)
      .map((it) => {
        const description = it.description ?? '';
        const imgMatch = description.match(/<img[^>]+src="([^"]+)"/i);
        return {
          url: imgMatch?.[1] ?? '',
          kind: 'article' as const,
          title: it.title,
          description: description.replace(/<[^>]+>/g, '').trim().slice(0, 280),
          attribution: it.source ?? 'Google News',
          creditUrl: it.link,
        } satisfies PersonalScrapedItem;
      })
      .filter((it) => it.title);
    await writeCache('google_news', query, 'article', items);
    return items;
  } catch (e) {
    console.warn('[google-news] failed:', (e as Error).message);
    return [];
  }
}

/**
 * Minimal, regex-based RSS item parser. Handles the standard RSS 2.0
 * shape Google News returns without pulling in an XML library. We keep
 * it tolerant — malformed items are skipped, not thrown.
 */
function parseRssItems(xml: string): Array<{
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  source?: string;
}> {
  const items: Array<{
    title?: string;
    link?: string;
    description?: string;
    pubDate?: string;
    source?: string;
  }> = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const inner = m[1] ?? '';
    items.push({
      title: extractTag(inner, 'title'),
      link: extractTag(inner, 'link'),
      description: extractTag(inner, 'description'),
      pubDate: extractTag(inner, 'pubDate'),
      source: extractTag(inner, 'source'),
    });
  }
  return items;
}

function extractTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return undefined;
  let value = m[1]?.trim() ?? '';
  // Strip CDATA wrapper.
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) value = cdata[1]!;
  return value.trim() || undefined;
}

/**
 * When we need actual photographs alongside the news narrative (not
 * just thumbnails), we run the article's keywords through Pexels /
 * Wikipedia. This is the "grounded imagery" path for the News theme.
 */
export async function searchNewsImagery(
  query: string,
  count = 6,
): Promise<PersonalScrapedItem[]> {
  const [news, wiki, pexels] = await Promise.all([
    searchGoogleNews(query, 5),
    searchWikipediaImages(query, 4),
    searchPexelsPhotos(query, 4),
  ]);

  // Prefer news thumbnails (real photojournalism) → Wikipedia → Pexels
  const real: PersonalScrapedItem[] = news
    .filter((n) => n.url)
    .map((n) => ({
      url: n.url,
      kind: 'image',
      title: n.title,
      attribution: n.attribution,
      creditUrl: n.creditUrl,
    }));
  const combined = [...real, ...wiki, ...pexels];
  // De-dupe by URL.
  const seen = new Set<string>();
  return combined.filter((it) => {
    if (!it.url || seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  }).slice(0, count);
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Gameplay loops                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

export function pickGameplayLoop(seed?: string): PersonalScrapedItem {
  if (GAMEPLAY_LOOPS.length === 0) {
    return {
      url: 'https://r2.boostmybranding.com/public/gameplay/fallback.mp4',
      kind: 'video',
      durationSeconds: 60,
      title: 'Fallback gameplay loop',
    };
  }
  const hash = seed
    ? createHash('sha1').update(seed).digest().readUInt32BE(0)
    : Math.floor(Math.random() * 1e9);
  return GAMEPLAY_LOOPS[hash % GAMEPLAY_LOOPS.length]!;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Unified search                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

export interface SearchAssetsArgs {
  query: string;
  /** Ordered providers to try. First non-empty result wins. */
  sources: Array<
    'pexels' | 'unsplash' | 'pixabay' | 'wikipedia' | 'news' | 'gameplay'
  >;
  count?: number;
  /** Prefer video over image when possible. */
  preferVideo?: boolean;
}

/**
 * One-stop search that walks the `sources` list in order. Returns the
 * first provider that yields ≥ 1 result. Use this from the pipeline —
 * theme.mediaSources flows directly in.
 */
export async function searchAssets(
  args: SearchAssetsArgs,
): Promise<{ source: string; items: PersonalScrapedItem[] }> {
  const count = args.count ?? 8;

  for (const src of args.sources) {
    if (src === 'pexels') {
      const videos = args.preferVideo ? await searchPexelsVideos(args.query, count) : [];
      const photos = videos.length >= count ? [] : await searchPexelsPhotos(args.query, count);
      const combined = [...videos, ...photos].slice(0, count);
      if (combined.length > 0) return { source: 'pexels', items: combined };
    } else if (src === 'unsplash') {
      const items = await searchUnsplashPhotos(args.query, count);
      if (items.length > 0) return { source: 'unsplash', items };
    } else if (src === 'pixabay') {
      const items = await searchPixabayPhotos(args.query, count);
      if (items.length > 0) return { source: 'pixabay', items };
    } else if (src === 'wikipedia') {
      const items = await searchWikipediaImages(args.query, count);
      if (items.length > 0) return { source: 'wikipedia', items };
    } else if (src === 'news') {
      const items = await searchNewsImagery(args.query, count);
      if (items.length > 0) return { source: 'news', items };
    } else if (src === 'gameplay') {
      return { source: 'gameplay', items: [pickGameplayLoop(args.query)] };
    }
  }

  return { source: 'none', items: [] };
}

export const scraperFeatures = {
  get pexels() { return Boolean(process.env.PEXELS_API_KEY); },
  get unsplash() { return Boolean(process.env.UNSPLASH_ACCESS_KEY); },
  get pixabay() { return Boolean(process.env.PIXABAY_API_KEY); },
  wikipedia: true, // no key needed
  googleNews: true,
};
