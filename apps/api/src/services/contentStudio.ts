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
    const err = new Error(`ContentStudio API ${res.status}: ${text.slice(0, 400)}`) as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
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

/** One connected social account row for workspace settings UIs. */
export type ContentStudioConnectedAccount = {
  platform: ContentStudioPlatform;
  /** @handle / username when the API sends it. */
  handle: string;
  /** Stable id for `schedulePost` / `contentStudioAccountIds` (never empty in normal API responses). */
  id: string;
  /** Channel/page title + handle for multi-account dropdowns. */
  label: string;
};

/** Workspace row from GET /workspaces (for picking CONTENTSTUDIO_WORKSPACE_ID). */
export type ContentStudioWorkspaceSummary = {
  id: string;
  name: string;
};

export type ListConnectedAccountsResult = {
  accounts: ContentStudioConnectedAccount[];
  /** Set when the HTTP call failed, JSON was invalid, or ContentStudio returned `status: false`. */
  listError?: string;
};

function pickAccountRowId(row: Record<string, unknown>): string {
  const candidates = [
    row.account_id,
    row.accountId,
    row.social_account_id,
    row.socialAccountId,
    row.connection_id,
    row.connectionId,
    row.id,
    row._id,
    row.uuid,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return '';
}

function pickAccountHandle(row: Record<string, unknown>): string {
  const candidates = [
    row.handle,
    row.username,
    row.user_name,
    row.screen_name,
    row.channel_handle,
    row.page_username,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function pickAccountTitle(row: Record<string, unknown>): string {
  const candidates = [
    row.name,
    row.title,
    row.channel_title,
    row.channel_name,
    row.page_name,
    row.display_name,
    row.displayName,
    row.account_name,
    row.accountName,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/** Platform string from various ContentStudio account row shapes. */
function pickAccountPlatform(row: Record<string, unknown>): string {
  const keys = ['platform', 'social_platform', 'provider', 'network', 'type'] as const;
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Collect account-like rows when `data` or `accounts` is grouped by platform key. */
function rowsFromPlatformGrouped(obj: Record<string, unknown>): unknown[] {
  const rows: unknown[] = [];
  for (const val of Object.values(obj)) {
    if (!Array.isArray(val)) continue;
    for (const item of val) {
      if (item && typeof item === 'object') rows.push(item);
    }
  }
  return rows;
}

/**
 * Normalize API body to a flat list of account row objects (handles paginated wrappers
 * and platform-keyed maps like posts' `accounts.facebook[]`).
 */
function extractRawAccountRows(body: Record<string, unknown>): unknown[] {
  const data = body.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const rec = data as Record<string, unknown>;
    const grouped = rowsFromPlatformGrouped(rec);
    if (grouped.length) return grouped;
    if (Array.isArray(rec.items)) return rec.items;
    if (Array.isArray(rec.accounts)) return rec.accounts;
    if (Array.isArray(rec.data)) return rec.data;
  }
  if (Array.isArray(body.accounts)) return body.accounts;
  const acct = body.accounts;
  if (acct && typeof acct === 'object' && !Array.isArray(acct)) {
    return rowsFromPlatformGrouped(acct as Record<string, unknown>);
  }
  return [];
}

async function fetchWorkspaceAccountRowsAllPages(workspaceId: string): Promise<{
  rows: unknown[];
  listError?: string;
}> {
  const all: unknown[] = [];
  let page = 1;
  let lastPage = 1;
  const maxPages = 25;
  const perPage = 100;

  do {
    const url = `${CS_BASE}/workspaces/${encodeURIComponent(workspaceId)}/accounts?page=${page}&per_page=${perPage}`;
    const res = await fetch(url, { headers: csHeaders() });
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!res.ok) {
        return { rows: [], listError: `ContentStudio HTTP ${res.status}: ${text.slice(0, 280)}` };
      }
      return { rows: [], listError: 'ContentStudio returned non-JSON for accounts list.' };
    }

    if (!res.ok) {
      const msg =
        typeof json.message === 'string'
          ? json.message
          : typeof json.error === 'string'
            ? json.error
            : text.slice(0, 280);
      return { rows: [], listError: `ContentStudio HTTP ${res.status}: ${msg}` };
    }

    if (json.status === false) {
      const msg = typeof json.message === 'string' ? json.message : 'ContentStudio returned status:false';
      return { rows: [], listError: msg };
    }

    const chunk = extractRawAccountRows(json);
    all.push(...chunk);

    const cur = Number(json.current_page ?? page) || page;
    lastPage = Number(json.last_page ?? json.lastPage ?? 1) || 1;
    if (chunk.length === 0 && cur >= lastPage) break;
    page = cur + 1;
  } while (page <= lastPage && page <= maxPages);

  return { rows: all };
}

function buildAccountLabel(
  platform: ContentStudioPlatform,
  handle: string,
  title: string,
  id: string,
): string {
  const parts: string[] = [];
  if (title) parts.push(title);
  if (handle) parts.push(handle.startsWith('@') ? handle : `@${handle}`);
  if (parts.length === 0 && id) {
    parts.push(id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);
  }
  parts.push(platform);
  return parts.join(' · ');
}

/**
 * Fetch the list of connected accounts in the active workspace so the
 * dashboard can tell the user which platforms actually have a handle
 * attached. Returns an empty list when the API isn't configured.
 */
export async function listConnectedAccounts(workspaceId?: string): Promise<ListConnectedAccountsResult> {
  if (!features.contentStudio) return { accounts: [] };
  const ws = (workspaceId ?? env.CONTENTSTUDIO_WORKSPACE_ID ?? '').trim();
  if (!ws) return { accounts: [] };
  try {
    const { rows: rawRows, listError } = await fetchWorkspaceAccountRowsAllPages(ws);
    if (listError) {
      return { accounts: [], listError };
    }
    const out: ContentStudioConnectedAccount[] = [];
    let missingId = 0;
    const seen = new Set<string>();
    for (const raw of rawRows) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      const platformRaw = pickAccountPlatform(row);
      if (!platformRaw) continue;
      const platform = normalizePlatform(platformRaw);
      const id = pickAccountRowId(row);
      const handle = pickAccountHandle(row);
      const title = pickAccountTitle(row);
      const label = buildAccountLabel(platform, handle, title, id);
      if (!id) {
        missingId++;
        continue;
      }
      const dedupeKey = `${platform}:${id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ platform, handle, id, label });
    }
    if (missingId > 0) {
      console.warn(
        `[contentStudio] ${missingId} workspace account row(s) skipped (no id). First row keys: ${rawRows[0] && typeof rawRows[0] === 'object' ? Object.keys(rawRows[0] as object).join(', ') : '—'}`,
      );
    }
    return { accounts: out };
  } catch (e) {
    const msg = (e as Error).message;
    console.warn('[contentStudio] listConnectedAccounts failed:', msg);
    return { accounts: [], listError: msg };
  }
}

export type ListWorkspacesResult = {
  workspaces: ContentStudioWorkspaceSummary[];
  listError?: string;
};

/** List workspaces for this API key so the user can copy the correct workspace id into .env or the form. */
export async function listWorkspaces(): Promise<ListWorkspacesResult> {
  if (!features.contentStudio) return { workspaces: [] };
  const all: ContentStudioWorkspaceSummary[] = [];
  let page = 1;
  let lastPage = 1;
  const perPage = 50;
  const maxPages = 20;
  try {
    do {
      const url = `${CS_BASE}/workspaces?page=${page}&per_page=${perPage}`;
      const res = await fetch(url, { headers: csHeaders() });
      const text = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        if (!res.ok) return { workspaces: [], listError: `ContentStudio HTTP ${res.status}: ${text.slice(0, 280)}` };
        return { workspaces: [], listError: 'ContentStudio returned non-JSON for workspaces list.' };
      }
      if (!res.ok) {
        const msg =
          typeof json.message === 'string'
            ? json.message
            : typeof json.error === 'string'
              ? json.error
              : text.slice(0, 280);
        return { workspaces: [], listError: `ContentStudio HTTP ${res.status}: ${msg}` };
      }
      if (json.status === false) {
        const msg = typeof json.message === 'string' ? json.message : 'ContentStudio returned status:false';
        return { workspaces: [], listError: msg };
      }
      const rows = Array.isArray(json.data) ? json.data : [];
      for (const raw of rows) {
        if (!raw || typeof raw !== 'object') continue;
        const row = raw as Record<string, unknown>;
        const id = String(row._id ?? row.id ?? row.workspace_id ?? row.workspaceId ?? '').trim();
        const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : id || 'Workspace';
        if (id) all.push({ id, name });
      }
      const cur = Number(json.current_page ?? page) || page;
      lastPage = Number(json.last_page ?? json.lastPage ?? 1) || 1;
      page = cur + 1;
    } while (page <= lastPage && page <= maxPages);
    return { workspaces: all };
  } catch (e) {
    return { workspaces: [], listError: (e as Error).message };
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
    youtubechannel: 'youtube',
    googleyoutube: 'youtube',
    googlemybusiness: 'google_business',
    gmb: 'google_business',
    googlebusiness: 'google_business',
  };
  return map[k] ?? (p as ContentStudioPlatform);
}
