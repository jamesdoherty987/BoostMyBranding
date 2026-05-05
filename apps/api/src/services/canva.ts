/**
 * Canva Connect API wrapper.
 *
 * Docs: https://www.canva.com/developers/docs/connect-api/
 *
 * The integration is per-client: each client can optionally connect
 * their own Canva account (Free, Pro, Teams, or Enterprise) so the
 * agency can design inside that workspace and pipe finished designs
 * straight into the client's media library.
 *
 * OAuth flow (authorization code + PKCE):
 *
 *   1. Agency clicks "Connect Canva" on a client → GET /api/v1/canva/connect?clientId=…
 *      We build the authorize URL with a state-encoded {clientId, nonce}
 *      and redirect the browser.
 *
 *   2. User authorises on canva.com → Canva redirects to
 *      CANVA_REDIRECT_URI with ?code=… &state=…
 *
 *   3. We exchange the code for access + refresh tokens and store them
 *      in `client_canva_connections`.
 *
 *   4. Every subsequent API call goes through `withAccessToken(clientId)`
 *      which transparently refreshes the token when it's within 60s
 *      of expiry.
 *
 * This file only talks to the Canva REST API. Routes live in
 * routes/canva.ts; UI lives in the Media Studio and Content Studio.
 *
 * When CANVA_CLIENT_ID isn't set every function throws with a clear
 * message so the agency knows what to configure. The `features.canva`
 * flag in env.ts lets callers short-circuit before hitting these.
 */

import { randomBytes, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clientCanvaConnections } from '@boost/database';
import { env, features } from '../env.js';

const CANVA_OAUTH = 'https://www.canva.com/api/oauth';
const CANVA_API = 'https://api.canva.com/rest/v1';

const REQUESTED_SCOPES = [
  'design:content:read',
  'design:content:write',
  'design:meta:read',
  'asset:read',
  'asset:write',
  'brandtemplate:content:read',
  'brandtemplate:meta:read',
].join(' ');

export interface CanvaConnection {
  clientId: string;
  canvaUserId?: string | null;
  canvaTeamId?: string | null;
  expiresAt: Date;
  scopes?: string | null;
}

/* ------------------------------------------------------------------ */
/* OAuth — authorize URL + token exchange                              */
/* ------------------------------------------------------------------ */

/**
 * PKCE bits. We stash the verifier alongside the state token so the
 * callback can prove it started the flow. In a multi-instance deployment
 * this would need to be in Redis — for now it's a process-local Map,
 * which is fine because the flow completes within seconds.
 */
const pkceStore = new Map<string, { verifier: string; clientId: string; createdAt: number }>();

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildPkcePair() {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

/**
 * Build the Canva authorize URL and stash the PKCE verifier keyed by a
 * random state token. Agency hits this redirect, user authorises,
 * Canva sends the browser back to our callback with ?code=…&state=…
 */
export function buildAuthorizeUrl(clientId: string): { url: string; state: string } {
  if (!features.canva) {
    throw new Error(
      'Canva is not configured. Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, and CANVA_REDIRECT_URI.',
    );
  }

  const state = base64url(randomBytes(24));
  const pkce = buildPkcePair();

  pkceStore.set(state, { verifier: pkce.verifier, clientId, createdAt: Date.now() });
  pruneStalePkce();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.CANVA_CLIENT_ID!,
    redirect_uri: env.CANVA_REDIRECT_URI!,
    scope: REQUESTED_SCOPES,
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
  });

  return { url: `${CANVA_OAUTH}/authorize?${params.toString()}`, state };
}

function pruneStalePkce() {
  const cutoff = Date.now() - 10 * 60 * 1000; // 10 min TTL
  for (const [k, v] of pkceStore.entries()) {
    if (v.createdAt < cutoff) pkceStore.delete(k);
  }
}

/**
 * Exchange the `code` from Canva's redirect for access/refresh tokens
 * and persist them against the client. Returns the clientId so the
 * callback route can redirect back to the right dashboard page.
 */
export async function handleAuthorizationCode(args: {
  code: string;
  state: string;
}): Promise<{ clientId: string }> {
  if (!features.canva) {
    throw new Error('Canva is not configured.');
  }
  if (!isDbConfigured()) {
    throw new Error('Database is not configured — cannot persist Canva tokens.');
  }

  const pkce = pkceStore.get(args.state);
  if (!pkce) {
    throw new Error('OAuth state expired or invalid. Please restart the Canva connection flow.');
  }
  pkceStore.delete(args.state);

  const resp = await fetch(`${CANVA_OAUTH}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' + Buffer.from(`${env.CANVA_CLIENT_ID}:${env.CANVA_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: args.code,
      code_verifier: pkce.verifier,
      redirect_uri: env.CANVA_REDIRECT_URI!,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Canva token exchange failed (${resp.status}): ${body.slice(0, 200)}`);
  }

  const tokens = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };

  // Optionally look up user + team id so we can surface "you're connected
  // as X" in the UI. Failure is non-fatal — the tokens still work.
  let canvaUserId: string | null = null;
  let canvaTeamId: string | null = null;
  try {
    const me = await callCanva('/users/me', tokens.access_token);
    canvaUserId = me?.user?.id ?? null;
    canvaTeamId = me?.team?.id ?? null;
  } catch (e) {
    console.warn('[canva] users/me lookup failed:', (e as Error).message);
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const db = getDb();

  // Upsert on clientId — one connection per client.
  const [existing] = await db
    .select()
    .from(clientCanvaConnections)
    .where(eq(clientCanvaConnections.clientId, pkce.clientId));

  if (existing) {
    await db
      .update(clientCanvaConnections)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scopes: tokens.scope ?? null,
        canvaUserId,
        canvaTeamId,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(clientCanvaConnections.id, existing.id));
  } else {
    await db.insert(clientCanvaConnections).values({
      clientId: pkce.clientId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: tokens.scope ?? null,
      canvaUserId,
      canvaTeamId,
      expiresAt,
    });
  }

  return { clientId: pkce.clientId };
}

/**
 * Get the current connection status for a client. Used by the UI to
 * decide whether to show a "Connect" or "Connected" state without
 * actually hitting the Canva API.
 */
export async function getConnection(clientId: string): Promise<CanvaConnection | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(clientCanvaConnections)
    .where(eq(clientCanvaConnections.clientId, clientId));
  if (!row) return null;
  return {
    clientId: row.clientId,
    canvaUserId: row.canvaUserId,
    canvaTeamId: row.canvaTeamId,
    expiresAt: row.expiresAt,
    scopes: row.scopes,
  };
}

export async function disconnect(clientId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const deleted = await db
    .delete(clientCanvaConnections)
    .where(eq(clientCanvaConnections.clientId, clientId))
    .returning();
  return deleted.length > 0;
}

/* ------------------------------------------------------------------ */
/* Authenticated API access                                            */
/* ------------------------------------------------------------------ */

/**
 * Run a function with a guaranteed-fresh access token for this client.
 * Refreshes transparently if the stored token is within 60s of expiry.
 *
 * Throws if the client never connected Canva. Callers should branch on
 * `features.canva` and `getConnection()` before reaching this helper so
 * the error message they surface can be specific.
 */
export async function withAccessToken<T>(
  clientId: string,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  if (!features.canva) {
    throw new Error('Canva is not configured.');
  }
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }
  const db = getDb();
  const [row] = await db
    .select()
    .from(clientCanvaConnections)
    .where(eq(clientCanvaConnections.clientId, clientId));
  if (!row) {
    throw new Error('This client is not connected to Canva.');
  }

  const msUntilExpiry = row.expiresAt.getTime() - Date.now();
  if (msUntilExpiry < 60_000) {
    const refreshed = await refreshAccessToken(row.refreshToken);
    await db
      .update(clientCanvaConnections)
      .set({
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? row.refreshToken,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(clientCanvaConnections.id, row.id));
    return fn(refreshed.access_token);
  }

  return fn(row.accessToken);
}

async function refreshAccessToken(refreshToken: string) {
  const resp = await fetch(`${CANVA_OAUTH}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' + Buffer.from(`${env.CANVA_CLIENT_ID}:${env.CANVA_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Canva token refresh failed (${resp.status}): ${body.slice(0, 200)}`);
  }
  return (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

/** Minimal fetch wrapper. Returns parsed JSON; throws on non-2xx with Canva's error body. */
async function callCanva<T = any>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const resp = await fetch(`${CANVA_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Canva ${path} → ${resp.status}: ${body.slice(0, 200)}`);
  }
  return (await resp.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Designs + brand templates                                           */
/* ------------------------------------------------------------------ */

export interface CanvaDesignSummary {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  updatedAt?: string;
  editUrl?: string;
}

/**
 * List the client's recent Canva designs. Paginated server-side — we
 * return the first page for the UI.
 */
export async function listDesigns(clientId: string): Promise<CanvaDesignSummary[]> {
  return withAccessToken(clientId, async (token) => {
    const body = await callCanva<{
      items: Array<{
        id: string;
        title?: string;
        thumbnail?: { url?: string };
        updated_at?: string;
        urls?: { edit_url?: string; view_url?: string };
      }>;
    }>('/designs?ownership=any&sort_by=relevance', token);
    return (body.items ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      thumbnailUrl: d.thumbnail?.url,
      updatedAt: d.updated_at,
      editUrl: d.urls?.edit_url,
    }));
  });
}

export interface CanvaBrandTemplate {
  id: string;
  title: string;
  thumbnailUrl?: string;
}

/**
 * List the brand templates the connected team/user has access to. Used
 * to power the Media Studio's "design from template" flow: we show the
 * template thumbnails, agency picks one, we autofill with brand colors
 * + a caption suggestion.
 *
 * Requires Canva Pro/Teams — Free accounts get an empty list and we
 * surface that in the UI with a helpful message.
 */
export async function listBrandTemplates(clientId: string): Promise<CanvaBrandTemplate[]> {
  return withAccessToken(clientId, async (token) => {
    try {
      const body = await callCanva<{
        items: Array<{ id: string; title: string; thumbnail?: { url?: string } }>;
      }>('/brand-templates', token);
      return (body.items ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        thumbnailUrl: t.thumbnail?.url,
      }));
    } catch (e) {
      const msg = (e as Error).message;
      // Free plans return 403 here — treat as empty list, not an error.
      if (/403|Forbidden|brand_templates|subscription/i.test(msg)) return [];
      throw e;
    }
  });
}

/**
 * Autofill a brand template with field values. Returns a job id to poll.
 *
 * Typical fields for a social post template:
 *   - headline: string
 *   - subheadline: string
 *   - photo: image asset id (see uploadAssetFromUrl)
 *   - brandColor: hex
 */
export async function autofillBrandTemplate(args: {
  clientId: string;
  brandTemplateId: string;
  data: Record<string, { type: 'text'; text: string } | { type: 'image'; asset_id: string }>;
}): Promise<{ jobId: string }> {
  return withAccessToken(args.clientId, async (token) => {
    const body = await callCanva<{ job: { id: string } }>('/autofills', token, {
      method: 'POST',
      body: JSON.stringify({
        brand_template_id: args.brandTemplateId,
        data: args.data,
      }),
    });
    return { jobId: body.job.id };
  });
}

/**
 * Poll an autofill job until Canva finishes. Returns the resulting
 * designId + edit URL. Canva typically takes 2-5s; we poll every 1.5s
 * with a 45s cap. Non-fatal: callers can re-poll if we time out.
 */
export async function waitForAutofill(
  clientId: string,
  jobId: string,
  { timeoutMs = 45_000, intervalMs = 1500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ designId: string; editUrl?: string; viewUrl?: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await withAccessToken(clientId, (token) =>
      callCanva<{
        job: {
          status: 'in_progress' | 'success' | 'failed';
          result?: { design?: { id: string; urls?: { edit_url?: string; view_url?: string } } };
          error?: { message: string };
        };
      }>(`/autofills/${jobId}`, token),
    );
    const s = status.job.status;
    if (s === 'success') {
      const d = status.job.result?.design;
      if (!d) throw new Error('Autofill succeeded but returned no design');
      return { designId: d.id, editUrl: d.urls?.edit_url, viewUrl: d.urls?.view_url };
    }
    if (s === 'failed') {
      throw new Error(status.job.error?.message ?? 'Autofill failed');
    }
    await sleep(intervalMs);
  }
  throw new Error('Autofill timed out');
}

/**
 * Upload a PNG/JPG/MP4 that's accessible at a public URL (e.g. an R2
 * URL or one of our uploaded client media items) to the client's Canva
 * assets. Returns the asset id, which can be plugged into `autofillBrandTemplate`.
 *
 * Canva accepts both direct-upload (multipart) and asset-url flows. We
 * use the URL flow because our media already lives at a public R2 URL,
 * which skips a round-trip through our API bandwidth.
 */
export async function uploadAssetFromUrl(args: {
  clientId: string;
  url: string;
  name: string;
}): Promise<{ assetId: string }> {
  return withAccessToken(args.clientId, async (token) => {
    const job = await callCanva<{ job: { id: string } }>('/asset-uploads', token, {
      method: 'POST',
      body: JSON.stringify({
        name: args.name,
        asset_url: args.url,
      }),
    });
    // Poll
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const status = await callCanva<{
        job: {
          status: 'in_progress' | 'success' | 'failed';
          asset?: { id: string };
          error?: { message: string };
        };
      }>(`/asset-uploads/${job.job.id}`, token);
      if (status.job.status === 'success' && status.job.asset) {
        return { assetId: status.job.asset.id };
      }
      if (status.job.status === 'failed') {
        throw new Error(status.job.error?.message ?? 'Canva asset upload failed');
      }
      await sleep(1500);
    }
    throw new Error('Canva asset upload timed out');
  });
}

/* ------------------------------------------------------------------ */
/* Export — pull a Canva design back into our media library            */
/* ------------------------------------------------------------------ */

/**
 * Export a Canva design and stream the result back to us. Returns the
 * exported file URLs (Canva hosts these temporarily — callers should
 * copy them into R2 immediately for long-term storage).
 *
 * Formats:
 *   - png   (default) — great for social posts
 *   - jpg   — smaller, for photo-heavy designs
 *   - pdf   — for print/brochure-style designs
 *   - mp4   — when the design has animations/video
 */
export async function exportDesign(args: {
  clientId: string;
  designId: string;
  format?: 'png' | 'jpg' | 'pdf' | 'mp4';
  pageWidth?: number;
}): Promise<{ urls: string[]; format: string }> {
  const format = args.format ?? 'png';
  return withAccessToken(args.clientId, async (token) => {
    const job = await callCanva<{ job: { id: string } }>('/exports', token, {
      method: 'POST',
      body: JSON.stringify({
        design_id: args.designId,
        format: {
          type: format,
          ...(format === 'png' || format === 'jpg'
            ? { width: args.pageWidth ?? 1080 }
            : {}),
        },
      }),
    });

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const status = await callCanva<{
        job: {
          status: 'in_progress' | 'success' | 'failed';
          result?: { urls?: string[] };
          error?: { message: string };
        };
      }>(`/exports/${job.job.id}`, token);
      if (status.job.status === 'success' && status.job.result?.urls?.length) {
        return { urls: status.job.result.urls, format };
      }
      if (status.job.status === 'failed') {
        throw new Error(status.job.error?.message ?? 'Canva export failed');
      }
      await sleep(1500);
    }
    throw new Error('Canva export timed out');
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
