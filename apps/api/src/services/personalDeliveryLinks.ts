/**
 * Signed, unauthenticated delivery links for personal videos (email → phone).
 * Anyone with the link can download until expiry — same trust model as a public R2 URL.
 *
 * Hub page: real `<a href>` fallbacks + JS that detects iPhone (Share → Photos)
 * vs desktop/laptop (file download). Preview plays inline via `/preview` + Range.
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
    /** Opens hub and copies the YouTube/feed description (caption). */
    copyDescriptionUrl: `${base}?a=copydesc`,
    /** Opens the hub page with the in-page player (keeps other buttons available). */
    previewUrl: `${base}?a=preview`,
    /** Raw MP4 stream for `<video src>` / direct playback. */
    previewStreamUrl: `${base}/preview`,
    videoUrl: `${base}/video`,
    thumbnailUrl: `${base}/thumbnail`,
    /** Hub page so iPhone can Share → Photos; desktop auto-downloads from there. */
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
  /** YouTube / feed description (post caption + hashtags when stored). */
  description: string;
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
      caption: personalPosts.caption,
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
  const fromCaption = (row.caption ?? '').trim();
  const scriptCaption =
    row.script && typeof row.script === 'object' && typeof (row.script as { caption?: unknown }).caption === 'string'
      ? String((row.script as { caption: string }).caption).trim()
      : '';
  const description = fromCaption || scriptCaption || title;
  const thumb = (row.thumbnailUrl ?? '').trim();
  return {
    accountId: row.accountId,
    postId: row.id,
    title,
    description,
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
 * Delivery hub: preview in-page; iPhone Share → Photos; desktop downloads the file.
 */
export function personalDeliverySavePageHtml(args: {
  title: string;
  description: string;
  videoDownloadUrl: string;
  thumbnailDownloadUrl: string | null;
  previewUrl: string;
  videoFilename: string;
  thumbnailFilename: string;
  action: 'copy' | 'copydesc' | 'video' | 'thumb' | 'preview' | null;
}): string {
  const titleJson = JSON.stringify(args.title);
  const descriptionJson = JSON.stringify(args.description || args.title);
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
  const safeDescription = (args.description || args.title)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
    .label { margin: 0 0 6px; color: #64748b; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .title-box {
      width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; font-size: 15px;
      background: #f8fafc; color: #0f172a; margin: 0 0 12px;
    }
    .desc-box {
      width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; font-size: 14px;
      background: #f8fafc; color: #0f172a; margin: 0 0 16px; min-height: 96px; max-height: 180px;
      resize: vertical; line-height: 1.45; font-family: inherit;
    }
    .stack { display: flex; flex-direction: column; gap: 10px; }
    .btn, button.btn, a.btn {
      appearance: none; border: 0; border-radius: 14px; padding: 16px 18px; font-size: 16px; font-weight: 650;
      text-align: center; cursor: pointer; display: block; width: 100%; text-decoration: none;
      -webkit-tap-highlight-color: transparent; font-family: inherit;
    }
    .primary { background: linear-gradient(90deg,#48D886,#1D9CA1); color: #fff !important; }
    .secondary { background: #0f172a; color: #f8fafc !important; }
    .ghost { background: #f1f5f9; color: #0f172a !important; }
    .preview-wrap { margin: 0 0 16px; display: none; }
    .preview-wrap.on { display: block; }
    video {
      width: 100%; max-height: min(56vh, 360px); border-radius: 14px; background: #0f172a; display: block;
    }
    .status {
      margin-top: 14px; min-height: 1.25em; font-size: 14px; color: #0f766e; font-weight: 600; text-align: center;
    }
    .status.err { color: #b91c1c; }
    .pulse { box-shadow: 0 0 0 3px rgba(29,156,161,0.35); }
  </style>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p class="hint" id="hint">Tap a button below.</p>
    <p class="label">Title</p>
    <input class="title-box" id="titleInput" type="text" readonly value="${safeTitle}" aria-label="Video title" />
    <p class="label">Description</p>
    <textarea class="desc-box" id="descInput" readonly aria-label="Video description">${safeDescription}</textarea>
    <div class="preview-wrap${previewOn}" id="previewWrap">
      <video id="player" controls playsinline webkit-playsinline preload="auto" src="${safePreviewHref}"></video>
    </div>
    <div class="stack" id="stack">
      <button type="button" class="btn ghost" id="btnCopy">Copy title</button>
      <button type="button" class="btn ghost" id="btnCopyDesc">Copy description</button>
      <a class="btn secondary" id="btnPreview" href="${safePreviewHref}">Preview video</a>
      <a class="btn primary" id="btnVideo" href="${safeVideoHref}" download="${safeVideoName}">Save video to Photos</a>
      ${thumbLink}
    </div>
    <p class="status" id="status" aria-live="polite"></p>
  </main>
  <script>
    (function () {
      var TITLE = ${titleJson};
      var DESCRIPTION = ${descriptionJson};
      var VIDEO_URL = ${videoUrlJson};
      var THUMB_URL = ${thumbUrlJson};
      var PREVIEW_URL = ${previewUrlJson};
      var VIDEO_NAME = ${videoNameJson};
      var THUMB_NAME = ${thumbNameJson};
      var ACTION = ${actionJson};
      var statusEl = document.getElementById('status');
      var hintEl = document.getElementById('hint');
      var previewWrap = document.getElementById('previewWrap');
      var player = document.getElementById('player');
      var btnVideo = document.getElementById('btnVideo');
      var btnThumb = document.getElementById('btnThumb');
      var btnPreview = document.getElementById('btnPreview');
      var btnCopy = document.getElementById('btnCopy');
      var btnCopyDesc = document.getElementById('btnCopyDesc');

      function isIos() {
        var ua = navigator.userAgent || '';
        if (/iPhone|iPad|iPod/i.test(ua)) return true;
        if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
        return false;
      }
      var IOS = isIos();

      function setStatus(msg, isErr) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.className = 'status' + (isErr ? ' err' : '');
      }
      function setHint(msg) {
        if (hintEl) hintEl.textContent = msg;
      }

      var pendingShare = null;
      var preparing = false;

      if (IOS) {
        setHint('On iPhone: tap Save once to prepare, then tap Share and choose Save Video / Save Image. Prefer Safari.');
        if (btnVideo) btnVideo.textContent = 'Save video to Photos';
        if (btnThumb) btnThumb.textContent = 'Save thumbnail to Photos';
      } else {
        setHint('On computer: Preview plays here. Save downloads the file.');
        if (btnVideo) btnVideo.textContent = 'Download video';
        if (btnThumb) btnThumb.textContent = 'Download thumbnail';
      }

      function copyText(text, input, okMsg, failMsg) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
              setStatus(okMsg);
            }).catch(function () { fallbackCopy(input, okMsg, failMsg); });
            return;
          }
        } catch (e) {}
        fallbackCopy(input, okMsg, failMsg);
      }
      function copyTitle() {
        copyText(TITLE, document.getElementById('titleInput'), 'Title copied', 'Select the title above and copy');
      }
      function copyDescription() {
        copyText(DESCRIPTION, document.getElementById('descInput'), 'Description copied', 'Select the description above and copy');
      }
      function fallbackCopy(input, okMsg, failMsg) {
        try {
          if (input) {
            input.focus();
            if (typeof input.select === 'function') {
              input.select();
              if (typeof input.setSelectionRange === 'function') {
                input.setSelectionRange(0, (input.value || '').length);
              }
            }
          }
          var ok = document.execCommand('copy');
          setStatus(ok ? okMsg : failMsg, !ok);
        } catch (e) {
          setStatus(failMsg, true);
        }
      }

      function downloadBlob(blob, filename) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
        setStatus('Download started');
      }

      function clearPendingShare() {
        if (pendingShare && pendingShare.btn) {
          pendingShare.btn.textContent = pendingShare.labelReady;
          pendingShare.btn.classList.remove('pulse');
        }
        pendingShare = null;
      }

      function iosShareFallback(kind) {
        if (kind === 'video') {
          showPreview();
          setStatus('Could not open Share. Tap play, then the share icon → Save Video. Or open this page in Safari.', true);
          return;
        }
        if (THUMB_URL) {
          window.location.href = THUMB_URL;
          return;
        }
        setStatus('Open this page in Safari, then try again.', true);
      }

      /** Must run synchronously inside a click handler (iOS WebKit gesture). */
      function sharePrepared() {
        if (!pendingShare || !pendingShare.file) return;
        var prepared = pendingShare;
        clearPendingShare();
        var sharePromise;
        try {
          sharePromise = navigator.share({ files: [prepared.file], title: TITLE });
        } catch (err) {
          iosShareFallback(prepared.kind);
          return;
        }
        if (sharePromise && typeof sharePromise.then === 'function') {
          sharePromise.then(function () {
            setStatus(prepared.kind === 'video' ? 'Shared — choose Save Video' : 'Shared — choose Save Image');
          }).catch(function () {
            iosShareFallback(prepared.kind);
          });
        }
      }

      function prepareThenShare(url, filename, mime, kind, btn) {
        if (!url) return;
        if (pendingShare && pendingShare.kind === kind && pendingShare.file) {
          sharePrepared();
          return;
        }
        if (preparing) return;
        preparing = true;
        clearPendingShare();
        var labelReady = btn ? btn.textContent : '';
        if (btn) {
          btn.textContent = 'Preparing…';
          btn.classList.add('pulse');
        }
        setStatus('Preparing…');
        fetch(url, { credentials: 'omit' }).then(function (res) {
          if (!res.ok) throw new Error('fetch ' + res.status);
          return res.blob();
        }).then(function (blob) {
          preparing = false;
          var file;
          try {
            file = new File([blob], filename, { type: mime || blob.type || 'application/octet-stream' });
          } catch (e) {
            file = blob;
          }
          pendingShare = {
            file: file,
            kind: kind,
            btn: btn,
            labelReady: labelReady,
            labelShare: kind === 'video' ? 'Share to save video' : 'Share to save image',
          };
          if (btn) {
            btn.textContent = pendingShare.labelShare;
            btn.classList.add('pulse');
          }
          setStatus('Ready — tap again to Share');
        }).catch(function (err) {
          preparing = false;
          clearPendingShare();
          if (btn) btn.textContent = labelReady;
          console.warn('[delivery] prepare failed', err && err.message ? err.message : err);
          iosShareFallback(kind);
        });
      }

      function saveMedia(url, filename, mime, kind, btn) {
        if (!url) return;
        if (IOS && navigator.canShare) {
          prepareThenShare(url, filename, mime, kind, btn);
          return;
        }
        fetch(url, { credentials: 'omit' }).then(function (res) {
          if (!res.ok) throw new Error('fetch ' + res.status);
          return res.blob();
        }).then(function (blob) {
          downloadBlob(blob, filename);
        }).catch(function () {
          window.location.href = url;
        });
      }

      function showPreview() {
        if (previewWrap) previewWrap.classList.add('on');
        if (player) {
          try { player.src = PREVIEW_URL; } catch (e) {}
          var playPromise = player.play && player.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(function () {
              setStatus('Playing preview');
            }).catch(function () {
              setStatus('Tap play on the video');
            });
          } else {
            setStatus('Tap play on the video');
          }
        }
      }

      if (btnCopy) btnCopy.addEventListener('click', function (e) {
        e.preventDefault();
        copyTitle();
      });
      if (btnCopyDesc) btnCopyDesc.addEventListener('click', function (e) {
        e.preventDefault();
        copyDescription();
      });
      if (btnPreview) btnPreview.addEventListener('click', function (e) {
        e.preventDefault();
        showPreview();
      });
      if (btnVideo) btnVideo.addEventListener('click', function (e) {
        e.preventDefault();
        saveMedia(VIDEO_URL, VIDEO_NAME, 'video/mp4', 'video', btnVideo);
      });
      if (btnThumb && THUMB_URL) btnThumb.addEventListener('click', function (e) {
        e.preventDefault();
        saveMedia(THUMB_URL, THUMB_NAME, 'image/jpeg', 'image', btnThumb);
      });

      if (ACTION === 'copy') copyTitle();
      if (ACTION === 'copydesc') copyDescription();
      if (ACTION === 'preview') showPreview();
      if (ACTION === 'video') {
        if (IOS) {
          if (btnVideo) btnVideo.classList.add('pulse');
          setStatus('Tap Save video to Photos (then Share once more)');
        } else {
          saveMedia(VIDEO_URL, VIDEO_NAME, 'video/mp4', 'video', btnVideo);
        }
      }
      if (ACTION === 'thumb' && THUMB_URL) {
        if (IOS) {
          if (btnThumb) btnThumb.classList.add('pulse');
          setStatus('Tap Save thumbnail to Photos (then Share once more)');
        } else {
          saveMedia(THUMB_URL, THUMB_NAME, 'image/jpeg', 'image', btnThumb);
        }
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
