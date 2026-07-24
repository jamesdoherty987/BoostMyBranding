/**
 * Signed, unauthenticated delivery links for personal videos (email → phone).
 * Anyone with the link can download until expiry — same trust model as a public R2 URL.
 */

import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb, isDbConfigured, personalPosts } from '@boost/database';
import { env } from '../env.js';

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type PersonalDeliveryPayload = {
  /** account id */
  a: string;
  /** post id */
  p: string;
  /** unix ms expiry */
  e: number;
};

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return b.toString('base64url');
}

function signRaw(data: string): string {
  return crypto.createHmac('sha256', env.AUTH_SECRET).update(data).digest('base64url');
}

export function createPersonalDeliveryToken(accountId: string, postId: string, ttlMs = TOKEN_TTL_MS): string {
  const payload: PersonalDeliveryPayload = {
    a: accountId,
    p: postId,
    e: Date.now() + Math.max(60_000, ttlMs),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = signRaw(body);
  return `${body}.${sig}`;
}

export function verifyPersonalDeliveryToken(token: string): PersonalDeliveryPayload | null {
  const raw = (token ?? '').trim();
  const dot = raw.lastIndexOf('.');
  if (dot < 8) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!body || !sig) return null;
  const expect = signRaw(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PersonalDeliveryPayload;
    if (!parsed?.a || !parsed?.p || !Number.isFinite(parsed.e)) return null;
    if (parsed.e < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function personalDeliveryPublicBase(): string {
  return (env.API_PUBLIC_URL?.trim() || env.APP_URL).replace(/\/+$/, '');
}

export function personalDeliveryUrls(accountId: string, postId: string) {
  const token = createPersonalDeliveryToken(accountId, postId);
  const base = `${personalDeliveryPublicBase()}/api/v1/personal/delivery/${encodeURIComponent(token)}`;
  return {
    token,
    pageUrl: base,
    copyUrl: `${base}?a=copy`,
    videoUrl: `${base}/video`,
    thumbnailUrl: `${base}/thumbnail`,
    saveVideoUrl: `${base}?a=video`,
    saveThumbUrl: `${base}?a=thumb`,
  };
}

function filenameFromTitle(title: string, ext: 'mp4' | 'jpg'): string {
  const raw = (title.trim() || (ext === 'mp4' ? 'video' : 'thumbnail'))
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 72);
  const base = raw || (ext === 'mp4' ? 'video' : 'thumbnail');
  const lower = base.toLowerCase();
  if (ext === 'mp4') return lower.endsWith('.mp4') ? base : `${base}.mp4`;
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return base;
  return `${base}.jpg`;
}

export type PersonalDeliveryAsset = {
  accountId: string;
  postId: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  videoFilename: string;
  thumbnailFilename: string;
};

export async function resolvePersonalDeliveryAsset(
  token: string,
): Promise<PersonalDeliveryAsset | null> {
  const payload = verifyPersonalDeliveryToken(token);
  if (!payload || !isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: personalPosts.id,
      accountId: personalPosts.accountId,
      topic: personalPosts.topic,
      script: personalPosts.script,
      videoUrl: personalPosts.videoUrl,
      thumbnailUrl: personalPosts.thumbnailUrl,
    })
    .from(personalPosts)
    .where(and(eq(personalPosts.id, payload.p), eq(personalPosts.accountId, payload.a)))
    .limit(1);
  if (!row) return null;
  const videoUrl = (row.videoUrl ?? '').trim();
  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) return null;
  const scriptTitle =
    row.script && typeof row.script === 'object' && typeof (row.script as { title?: unknown }).title === 'string'
      ? String((row.script as { title: string }).title).trim()
      : '';
  const title = scriptTitle || (row.topic ?? '').trim() || 'Video';
  const thumb = (row.thumbnailUrl ?? '').trim();
  return {
    accountId: row.accountId,
    postId: row.id,
    title,
    videoUrl,
    thumbnailUrl: thumb && /^https?:\/\//i.test(thumb) ? thumb : null,
    videoFilename: filenameFromTitle(title, 'mp4'),
    thumbnailFilename: filenameFromTitle(title, 'jpg'),
  };
}

/** Minimal mobile save page — copy title / save video / save thumbnail in one tap. */
export function personalDeliverySavePageHtml(args: {
  title: string;
  videoDownloadUrl: string;
  thumbnailDownloadUrl: string | null;
  videoFilename: string;
  thumbnailFilename: string;
  action: 'copy' | 'video' | 'thumb' | null;
}): string {
  const titleJson = JSON.stringify(args.title);
  const videoUrlJson = JSON.stringify(args.videoDownloadUrl);
  const thumbUrlJson = JSON.stringify(args.thumbnailDownloadUrl);
  const videoNameJson = JSON.stringify(args.videoFilename);
  const thumbNameJson = JSON.stringify(args.thumbnailFilename);
  const actionJson = JSON.stringify(args.action);
  const safeTitle = args.title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="light" />
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100dvh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center;
      padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
    }
    main {
      width: 100%; max-width: 420px; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px;
      padding: 28px 20px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
    }
    h1 { font-size: 22px; line-height: 1.25; margin: 0 0 8px; letter-spacing: -0.02em; }
    p.hint { margin: 0 0 22px; color: #64748b; font-size: 14px; line-height: 1.4; }
    .stack { display: flex; flex-direction: column; gap: 10px; }
    button {
      appearance: none; border: 0; border-radius: 14px; padding: 16px 18px; font-size: 16px; font-weight: 650;
      text-align: center; cursor: pointer; display: block; width: 100%;
    }
    .primary { background: linear-gradient(90deg,#48D886,#1D9CA1); color: #fff; }
    .secondary { background: #0f172a; color: #f8fafc; }
    .ghost { background: #f1f5f9; color: #0f172a; }
    .status {
      margin-top: 14px; min-height: 1.25em; font-size: 14px; color: #0f766e; font-weight: 600; text-align: center;
    }
    .status.err { color: #b91c1c; }
  </style>
</head>
<body>
  <main>
    <h1 id="title">${safeTitle}</h1>
    <p class="hint" id="hint">One tap — copy the title, or save straight to Photos.</p>
    <div class="stack" id="stack">
      <button type="button" class="ghost" id="btnCopy">Copy title</button>
      <button type="button" class="primary" id="btnVideo">Save video to Photos</button>
      ${
        args.thumbnailDownloadUrl
          ? `<button type="button" class="secondary" id="btnThumb">Save thumbnail to Photos</button>`
          : ''
      }
    </div>
    <p class="status" id="status" aria-live="polite"></p>
  </main>
  <script>
    const TITLE = ${titleJson};
    const VIDEO_URL = ${videoUrlJson};
    const THUMB_URL = ${thumbUrlJson};
    const VIDEO_NAME = ${videoNameJson};
    const THUMB_NAME = ${thumbNameJson};
    const ACTION = ${actionJson};
    const statusEl = document.getElementById('status');
    const hintEl = document.getElementById('hint');
    const stackEl = document.getElementById('stack');
    function setStatus(msg, isErr) {
      statusEl.textContent = msg || '';
      statusEl.className = 'status' + (isErr ? ' err' : '');
    }
    async function copyTitle() {
      try {
        await navigator.clipboard.writeText(TITLE);
        setStatus('Title copied');
        return;
      } catch (_) {}
      try {
        const ta = document.createElement('textarea');
        ta.value = TITLE;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setStatus('Title copied');
      } catch (e) {
        setStatus('Could not copy — long-press the title instead', true);
      }
    }
    async function shareOrDownload(url, filename, mime) {
      setStatus('Preparing…');
      try {
        const res = await fetch(url, { credentials: 'omit', cache: 'no-store' });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const file = new File([blob], filename, { type: mime || blob.type || 'application/octet-stream' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: TITLE });
          setStatus('Choose Save Video / Save Image');
          return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
        setStatus('Download started');
      } catch (e) {
        window.location.href = url;
      }
    }
    document.getElementById('btnCopy').addEventListener('click', function () { void copyTitle(); });
    document.getElementById('btnVideo').addEventListener('click', function () {
      void shareOrDownload(VIDEO_URL, VIDEO_NAME, 'video/mp4');
    });
    var btnThumb = document.getElementById('btnThumb');
    if (btnThumb && THUMB_URL) {
      btnThumb.addEventListener('click', function () {
        void shareOrDownload(THUMB_URL, THUMB_NAME, 'image/jpeg');
      });
    }
    /** iOS needs a real tap for share — email deep-links show one big confirm button. */
    if (ACTION === 'copy') {
      void copyTitle();
    } else if (ACTION === 'video' || (ACTION === 'thumb' && THUMB_URL)) {
      var isVideo = ACTION === 'video';
      hintEl.textContent = 'Tap once to save to Photos.';
      stackEl.innerHTML = '';
      var confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = isVideo ? 'primary' : 'secondary';
      confirm.textContent = isVideo ? 'Save video to Photos' : 'Save thumbnail to Photos';
      confirm.addEventListener('click', function () {
        if (isVideo) void shareOrDownload(VIDEO_URL, VIDEO_NAME, 'video/mp4');
        else void shareOrDownload(THUMB_URL, THUMB_NAME, 'image/jpeg');
      });
      stackEl.appendChild(confirm);
    }
  </script>
</body>
</html>`;
}
