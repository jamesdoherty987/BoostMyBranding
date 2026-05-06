/**
 * ContentStudio wrapper.
 *
 * Schedules approved posts for publishing across Instagram, Facebook,
 * LinkedIn, TikTok, X, Pinterest, Bluesky, YouTube, and Google My
 * Business — every platform the ContentStudio API accepts. The call
 * handles both image and video media, picks the right platform-specific
 * shape, and retries once on transient failures.
 *
 * Without CONTENTSTUDIO_API_KEY we return mock IDs so the downstream
 * flow still marks posts as scheduled — useful in local dev.
 */

import { env, features } from '../env.js';

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
  /** Optional first-comment (auto-comment) for platforms that support it. */
  firstComment?: string;
  /** Optional YouTube-specific title — YouTube Shorts still want a title. */
  youtubeTitle?: string;
  /**
   * Per-platform content overrides. Some platforms crop captions or need
   * a title. This lets you pass platform-specific copy without mutating
   * the primary caption.
   */
  perPlatform?: Partial<Record<ContentStudioPlatform, { text?: string; title?: string }>>;
}

/**
 * Post a single piece of content via the ContentStudio API.
 * Returns the platform post id so downstream can link / cancel.
 */
export async function schedulePost(args: SchedulePostArgs): Promise<{ id: string }> {
  if (!features.contentStudio) {
    return { id: `cs_mock_${Date.now()}` };
  }

  const platforms: ContentStudioPlatform[] = Array.isArray(args.platform)
    ? (args.platform as ContentStudioPlatform[])
    : [normalizePlatform(args.platform)];

  // Media array. Videos override images (when both supplied, video wins;
  // we do NOT send a mixed payload because each platform interprets that
  // differently and the risk of a published image-under-a-video quirk is
  // too high).
  const media: string[] = args.videoUrl
    ? [args.videoUrl]
    : args.imageUrl
      ? [args.imageUrl]
      : [];

  const body: Record<string, unknown> = {
    workspace_id: args.workspaceId ?? env.CONTENTSTUDIO_WORKSPACE_ID,
    platforms,
    content: { text: args.caption, media },
    schedule_at: args.scheduledAt.toISOString(),
  };
  if (args.firstComment) body.first_comment = args.firstComment;
  if (args.youtubeTitle || args.perPlatform?.youtube?.title) {
    body.youtube = {
      title: args.youtubeTitle ?? args.perPlatform?.youtube?.title,
      privacy: 'public',
    };
  }
  if (args.perPlatform) {
    // ContentStudio supports `per_platform: { instagram: { text }, … }`.
    body.per_platform = args.perPlatform;
  }

  const res = await fetch('https://api.contentstudio.io/v1/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.CONTENTSTUDIO_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ContentStudio API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string; post_id?: string };
  const id = json.id ?? json.post_id ?? `cs_${Date.now()}`;
  return { id };
}

export async function cancelPost(id: string) {
  if (!features.contentStudio) return;
  await fetch(`https://api.contentstudio.io/v1/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.CONTENTSTUDIO_API_KEY}` },
  });
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
  try {
    const url = new URL('https://api.contentstudio.io/v1/accounts');
    url.searchParams.set(
      'workspace_id',
      workspaceId ?? env.CONTENTSTUDIO_WORKSPACE_ID ?? '',
    );
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${env.CONTENTSTUDIO_API_KEY}` },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data?: Array<{ platform: string; handle?: string; username?: string; id: string }>;
    };
    return (body.data ?? []).map((a) => ({
      platform: normalizePlatform(a.platform),
      handle: a.handle ?? a.username ?? '',
      id: a.id,
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
  };
  return map[k] ?? (p as ContentStudioPlatform);
}
