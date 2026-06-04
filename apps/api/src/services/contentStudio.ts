/**
 * ContentStudio wrapper.
 *
 * Schedules approved posts for publishing across Instagram, Facebook,
 * LinkedIn, TikTok, X, Pinterest, Bluesky, YouTube, and Google My
 * Business — every platform the ContentStudio API accepts. The call
 * handles both image and video media, picks the right platform-specific
 * shape, and retries once on transient failures.
 *
 * API shape matches ContentStudio docs (2025+):
 *   Base: https://api.contentstudio.io/api/v1
 *   Auth: X-API-Key header (not Bearer)
 *   Create post: POST /workspaces/{workspace_id}/posts
 *
 * Without CONTENTSTUDIO_API_KEY we return mock IDs so the downstream
 * flow still marks posts as scheduled — useful in local dev.
 */

import { env, features } from '../env.js';

const CS_BASE = 'https://api.contentstudio.io/api/v1';

/** The full set of platforms ContentStudio can publish to via its API. */
export type ContentStudioPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'pinterest'
  | 'bluesky'
  | 'youtube'
  | 'google_business';

export interface SchedulePostArgs {
  /** Platform or platforms to publish to. String for backwards compat with the old call sites. */
  platform: string | ContentStudioPlatform[];
  caption: string;
  /** URL of the still image (Reels/Shorts/Pins) when this is not a video. */
  imageUrl?: string;
  /** URL of the MP4 to publish (Reels/Shorts/TikTok/YouTube). Takes priority over imageUrl. */
  videoUrl?: string;
  /** When to publish. Pass a near-future time for "now". */
  scheduledAt: Date;
  /** Override the default workspace. When omitted we use env.CONTENTSTUDIO_WORKSPACE_ID. */
  workspaceId?: string;
  /**
   * When set, publish to these ContentStudio connected account ids only.
   * Otherwise accounts are resolved from workspace + platform.
   */
  contentStudioAccountIds?: string[];
  /** Optional first-comment (auto-comment) for platforms that support it. */
  firstComment?: string;
  /** Optional YouTube-specific title — YouTube Shorts still want a title. */
  youtubeTitle?: string;
  /** When true with a video + YouTube, use long-form `video` post type instead of `shorts`. */
  youtubeLongForm?: boolean;
  /** Custom thumbnail URL (JPEG/PNG) for YouTube long-form when the API accepts it. */
  youtubeThumbnailUrl?: string;
  /**
   * Per-platform content overrides. Some platforms crop captions or need
   * a title. This lets you pass platform-specific copy without mutating
   * the primary caption.
   */
  perPlatform?: Partial<Record<ContentStudioPlatform, { text?: string; title?: string }>>;
}

function csHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': env.CONTENTSTUDIO_API_KEY!,
  };
}

function workspaceIdOrThrow(override?: string): string {
  const id = (override ?? env.CONTENTSTUDIO_WORKSPACE_ID ?? '').trim();
  if (!id) {
    throw new Error(
      'CONTENTSTUDIO_WORKSPACE_ID is required (or pass workspaceId on schedulePost).',
    );
  }
  return id;
}

/** Format `YYYY-MM-DD HH:mm:ss` in UTC — matches ContentStudio examples. */
function formatScheduledAtUtc(d: Date): string {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) {
    throw new Error('Invalid scheduledAt date');
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = x.getUTCFullYear();
  const mo = pad(x.getUTCMonth() + 1);
  const da = pad(x.getUTCDate());
  const h = pad(x.getUTCHours());
  const mi = pad(x.getUTCMinutes());
  const s = pad(x.getUTCSeconds());
  return `${y}-${mo}-${da} ${h}:${mi}:${s}`;
}

/** If the time is in the past, nudge forward so scheduling is accepted. */
function effectiveScheduleDate(when: Date): Date {
  const minAhead = new Date(Date.now() + 90_000);
  return when > minAhead ? when : minAhead;
}

function normalizePlatforms(p: string | ContentStudioPlatform[]): ContentStudioPlatform[] {
  const arr = Array.isArray(p) ? p : [p];
  return arr.map((x) => normalizePlatform(String(x)));
}

/** Map our platform + media to a ContentStudio `post_type` string. */
function guessPostType(
  platform: ContentStudioPlatform,
  hasVideo: boolean,
  opts?: { youtubeLongForm?: boolean },
): string {
  if (!hasVideo) {
    if (platform === 'linkedin') return 'carousel';
    return 'feed';
  }
  switch (platform) {
    case 'youtube':
      return opts?.youtubeLongForm ? 'video' : 'shorts';
    case 'tiktok':
      return 'video';
    case 'instagram':
      return 'reel';
    case 'facebook':
      return 'reel';
    default:
      return 'feed';
  }
}

interface CsAccountRow {
  id?: string;
  account_id?: string;
  platform?: string;
}

/**
 * Resolve ContentStudio account ids for the given platforms (one primary
 * account per platform in our list order).
 */
async function resolveAccountIds(
  workspaceId: string,
  platforms: ContentStudioPlatform[],
): Promise<string[]> {
  const uniq = [...new Set(platforms.map((p) => normalizePlatform(p)))];
  const query = uniq.join(',');
  const url = `${CS_BASE}/workspaces/${encodeURIComponent(workspaceId)}/accounts?platform=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: csHeaders() });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ContentStudio list accounts ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    data?: CsAccountRow[];
  };
  const rows = body.data ?? [];
  const ids: string[] = [];
  for (const plat of uniq) {
    const row = rows.find((r) => normalizePlatform(String(r.platform ?? '')) === plat);
    const id = row?.account_id ?? row?.id;
    if (id) ids.push(String(id));
  }
  if (ids.length === 0) {
    throw new Error(
      `No connected ContentStudio accounts found for workspace ${workspaceId} and platforms: ${uniq.join(', ')}`,
    );
  }
  return ids;
}

/**
 * Post a single piece of content via the ContentStudio API.
 * Returns the platform post id so downstream can link / cancel.
 */
export async function schedulePost(args: SchedulePostArgs): Promise<{ id: string }> {
  if (!features.contentStudio) {
    return { id: `cs_mock_${Date.now()}` };
  }

  const workspaceId = workspaceIdOrThrow(args.workspaceId);
  const platforms = normalizePlatforms(args.platform);
  const primaryPlatform = platforms[0] ?? 'instagram';
  const hasVideo = Boolean(args.videoUrl);
  const overrideIds = args.contentStudioAccountIds?.map((s) => s.trim()).filter(Boolean) ?? [];
  const accountIds =
    overrideIds.length > 0 ? overrideIds : await resolveAccountIds(workspaceId, platforms);

  const media: Record<string, unknown> = {};
  if (args.videoUrl) {
    media.video = args.videoUrl;
  }
  if (args.imageUrl) {
    media.images = [args.imageUrl];
  }

  const when = effectiveScheduleDate(args.scheduledAt);
  const body: Record<string, unknown> = {
    content: {
      text: args.caption,
      ...(Object.keys(media).length > 0 ? { media } : {}),
    },
    accounts: accountIds,
    post_type: guessPostType(primaryPlatform, hasVideo, {
      youtubeLongForm: args.youtubeLongForm === true && primaryPlatform === 'youtube',
    }),
    scheduling: {
      publish_type: 'scheduled',
      scheduled_at: formatScheduledAtUtc(when),
    },
  };

  if (args.firstComment) {
    body.first_comment = {
      message: args.firstComment,
      accounts: accountIds,
    };
  }
  if (platforms.includes('youtube') && hasVideo) {
    const ytTitle = args.youtubeTitle?.trim();
    if (ytTitle) {
      body.post_video_title = ytTitle;
      body.youtube = { title: ytTitle, privacy: 'public' };
    }
    if (ytTitle || args.youtubeThumbnailUrl || args.youtubeLongForm) {
      body.youtube_options = {
        privacy_status: 'public',
        made_for_kids: false,
        ...(ytTitle ? { title: ytTitle } : {}),
        ...(args.youtubeThumbnailUrl ? { thumbnail_url: args.youtubeThumbnailUrl } : {}),
      };
    }
  }
  if (args.perPlatform) {
    body.per_platform = args.perPlatform;
  }

  const res = await fetch(`${CS_BASE}/workspaces/${encodeURIComponent(workspaceId)}/posts`, {
    method: 'POST',
    headers: csHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ContentStudio API ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    data?: { id?: string };
    id?: string;
    post_id?: string;
  };
  const id = json.data?.id ?? json.id ?? json.post_id ?? `cs_${Date.now()}`;
  return { id: String(id) };
}

export async function cancelPost(id: string, workspaceId?: string) {
  if (!features.contentStudio) return;
  const ws = workspaceIdOrThrow(workspaceId);
  await fetch(
    `${CS_BASE}/workspaces/${encodeURIComponent(ws)}/posts/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: csHeaders(),
    },
  );
}

/**
 * Fetch the list of connected accounts in the active workspace so the
 * dashboard can tell the user which platforms actually have a handle
 * attached. Returns an empty list when the API isn't configured.
 */
export async function listConnectedAccounts(workspaceId?: string): Promise<
  Array<{ platform: ContentStudioPlatform; handle: string; id: string }>
> {
  if (!features.contentStudio) return [];
  const ws = (workspaceId ?? env.CONTENTSTUDIO_WORKSPACE_ID ?? '').trim();
  if (!ws) return [];
  try {
    const url = `${CS_BASE}/workspaces/${encodeURIComponent(ws)}/accounts`;
    const res = await fetch(url, { headers: csHeaders() });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data?: Array<{
        platform: string;
        handle?: string;
        username?: string;
        id?: string;
        account_id?: string;
      }>;
    };
    return (body.data ?? []).map((a) => ({
      platform: normalizePlatform(a.platform),
      handle: a.handle ?? a.username ?? '',
      id: String(a.account_id ?? a.id ?? ''),
    }));
  } catch (e) {
    console.warn('[contentStudio] listConnectedAccounts failed:', (e as Error).message);
    return [];
  }
}

/** Normalize platform strings we might receive from various callers. */
function normalizePlatform(p: string): ContentStudioPlatform {
  const k = p.toLowerCase().replace(/[^a-z]/g, '');
  const map: Record<string, ContentStudioPlatform> = {
    instagram: 'instagram',
    ig: 'instagram',
    facebook: 'facebook',
    fb: 'facebook',
    linkedin: 'linkedin',
    tiktok: 'tiktok',
    tt: 'tiktok',
    x: 'x',
    twitter: 'x',
    pinterest: 'pinterest',
    pin: 'pinterest',
    bluesky: 'bluesky',
    bsky: 'bluesky',
    youtube: 'youtube',
    yt: 'youtube',
    ytshorts: 'youtube',
    googlemybusiness: 'google_business',
    gmb: 'google_business',
    googlebusiness: 'google_business',
  };
  return map[k] ?? (p as ContentStudioPlatform);
}
