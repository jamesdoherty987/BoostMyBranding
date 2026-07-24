/**
 * Signed, unauthenticated delivery links for personal videos (email → phone).
 * Anyone with the link can download until expiry — same trust model as a public R2 URL.
 *
 * The save page is HTML-first (`<a href>`) so buttons work even when CSP / in-app
 * browsers block scripts. Optional inline JS only upgrades copy + share.
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
  const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : TOKEN_TTL_MS;
  const payload: PersonalDeliveryPayload = {
    a: accountId,
    p: postId,
    e: Date.now() + ttl,
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
  const enc = encodeURIComponent(token);
  const base = `${personalDeliveryPublicBase()}/api/v1/personal/delivery/${enc}`;
  return {
    token,
    pageUrl: base,
    copyUrl: `${base}?a=copy`,
    /** Opens the hub page with the in-page player (keeps other buttons available). */
    previewUrl: `${base}?a=preview`,
    /** Raw MP4 stream for `<video src>` / direct playback. */
    previewStreamUrl: `${base}/preview`,
    videoUrl: `${base}/video`,
    thumbnailUrl: `${base}/thumbnail`,
    saveVideoUrl: `${base}/video`,
    saveThumbUrl: `${base}/thumbnail`,
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

/** CSP for the delivery HTML page — allows inline script so Copy title can work. */
export const PERSONAL_DELIVERY_PAGE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https: blob:",
  "media-src 'self' https: blob:",
  "connect-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
].join('; ');

/**
 * Minimal mobile save page. Primary actions are real links (work without JS).
 * Optional script upgrades Copy title + share-to-Photos when the browser allows it.
 */
export function personalDeliverySavePageHtml(args: {
  title: string;
  videoDownloadUrl: string;
  thumbnailDownloadUrl: string | null;
  previewUrl: string;
  videoFilename: string;
  thumbnailFilename: string;
  action: 'copy' | 'video' | 'thumb' | 'preview' | null;
}): string {
  const titleJson = JSON.stringify(args.title);
  const videoUrlJson = JSON.stringify(args.videoDownloadUrl);
  const thumbUrlJson = JSON.stringify(args.thumbnailDownloadUrl);
  const previewUrlJson = JSON.stringify(args.previewUrl);
  const videoNameJson = JSON.stringify(args.videoFilename);
  const thumbNameJson = JSON.stringify(args.thumbnailFilename);
  const actionJson = JSON.stringify(args.action);
  const safeTitle = args.title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const safeVideoHref = escapeAttr(args.videoDownloadUrl);
  const safePreviewHref = escapeAttr(args.previewUrl);
  const safeThumbHref = args.thumbnailDownloadUrl ? escapeAttr(args.thumbnailDownloadUrl) : '';
  const safeVideoName = escapeAttr(args.videoFilename);
  const safeThumbName = escapeAttr(args.thumbnailFilename);

  const thumbLink = safeThumbHref
    ? `<a class="btn secondary" id="btnThumb" href="${safeThumbHref}" download="${safeThumbName}">Save thumbnail to Photos</a>`
    : '';
  const previewOn = args.action === 'preview' ? ' on' : '';

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
    h1 { font-size: 22px; line-height: 1.25; margin: 0 0 8px; letter-spacing: -0.02em; word-break: break-word; }
    p.hint { margin: 0 0 16px; color: #64748b; font-size: 14px; line-height: 1.4; }
    .title-box {
      width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; font-size: 15px;
      background: #f8fafc; color: #0f172a; margin: 0 0 16px;
    }
    .stack { display: flex; flex-direction: column; gap: 10px; }
    .btn, button.btn {
      appearance: none; border: 0; border-radius: 14px; padding: 16px 18px; font-size: 16px; font-weight: 650;
      text-align: center; cursor: pointer; display: block; width: 100%; text-decoration: none;
      -webkit-tap-highlight-color: transparent;
    }
    .primary { background: linear-gradient(90deg,#48D886,#1D9CA1); color: #fff !important; }
    .secondary { background: #0f172a; color: #f8fafc !important; }
    .ghost { background: #f1f5f9; color: #0f172a !important; }
    .preview-wrap { margin: 0 0 16px; display: none; }
    .preview-wrap.on { display: block; }
    video {
      width: 100%; max-height: 280px; border-radius: 14px; background: #0f172a; display: block;
    }
    .status {
      margin-top: 14px; min-height: 1.25em; font-size: 14px; color: #0f766e; font-weight: 600; text-align: center;
    }
    .status.err { color: #b91c1c; }
  </style>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p class="hint">Tap a button below. On iPhone, after download use Share → Save Video / Save Image.</p>
    <input class="title-box" id="titleInput" type="text" readonly value="${safeTitle}" aria-label="Video title" />
    <div class="preview-wrap${previewOn}" id="previewWrap">
      <video id="player" controls playsinline preload="metadata" src="${safePreviewHref}"></video>
    </div>
    <div class="stack" id="stack">
      <button type="button" class="btn ghost" id="btnCopy">Copy title</button>
      <a class="btn secondary" id="btnPreview" href="${safePreviewHref}">Preview video</a>
      <a class="btn primary" id="btnVideo" href="${safeVideoHref}" download="${safeVideoName}">Save video to Photos</a>
      ${thumbLink}
    </div>
    <p class="status" id="status" aria-live="polite"></p>
  </main>
  <script>
    (function () {
      var TITLE = ${titleJson};
      var VIDEO_URL = ${videoUrlJson};
      var THUMB_URL = ${thumbUrlJson};
      var PREVIEW_URL = ${previewUrlJson};
      var VIDEO_NAME = ${videoNameJson};
      var THUMB_NAME = ${thumbNameJson};
      var ACTION = ${actionJson};
      var statusEl = document.getElementById('status');
      var previewWrap = document.getElementById('previewWrap');
      var player = document.getElementById('player');
      function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.className = 'status' + (isErr ? ' err' : '');
      }
      function copyTitle() {
        var input = document.getElementById('titleInput');
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(TITLE).then(function () {
              setStatus('Title copied');
            }).catch(function () { fallbackCopy(input); });
            return;
          }
        } catch (e) {}
        fallbackCopy(input);
      }
      function fallbackCopy(input) {
        try {
          if (input) {
            input.focus();
            input.select();
            input.setSelectionRange(0, input.value.length);
          }
          var ok = document.execCommand('copy');
          setStatus(ok ? 'Title copied' : 'Select the title above and copy', !ok);
        } catch (e) {
          setStatus('Select the title above and copy', true);
        }
      }
      function shareOrDownload(url, filename, mime) {
        setStatus('Preparing…');
        fetch(url, { credentials: 'omit', cache: 'no-store' })
          .then(function (res) {
            if (!res.ok) throw new Error('fail');
            return res.blob();
          })
          .then(function (blob) {
            var file = new File([blob], filename, { type: mime || blob.type || 'application/octet-stream' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              return navigator.share({ files: [file], title: TITLE }).then(function () {
                setStatus('Choose Save Video / Save Image');
              });
            }
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
            setStatus('Download started');
          })
          .catch(function () {
            window.location.href = url;
          });
      }
      var btnCopy = document.getElementById('btnCopy');
      if (btnCopy) btnCopy.addEventListener('click', function (e) {
        e.preventDefault();
        copyTitle();
      });
      var btnVideo = document.getElementById('btnVideo');
      if (btnVideo) btnVideo.addEventListener('click', function (e) {
        if (!(navigator.canShare)) return;
        e.preventDefault();
        shareOrDownload(VIDEO_URL, VIDEO_NAME, 'video/mp4');
      });
      var btnThumb = document.getElementById('btnThumb');
      if (btnThumb && THUMB_URL) btnThumb.addEventListener('click', function (e) {
        if (!(navigator.canShare)) return;
        e.preventDefault();
        shareOrDownload(THUMB_URL, THUMB_NAME, 'image/jpeg');
      });
      var btnPreview = document.getElementById('btnPreview');
      if (btnPreview) btnPreview.addEventListener('click', function (e) {
        e.preventDefault();
        if (previewWrap) previewWrap.classList.add('on');
        if (player) {
          try { player.play(); } catch (err) {}
        }
        setStatus('Playing preview');
      });
      if (ACTION === 'copy') copyTitle();
      if (ACTION === 'preview') {
        if (previewWrap) previewWrap.classList.add('on');
        if (player) { try { player.play(); } catch (err) {} }
      }
      if (ACTION === 'video') {
        setStatus('Tap Save video again if the download did not start');
      }
    })();
  </script>
</body>
</html>`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
