/**
 * Smoke tests for personal email delivery links (no DB required).
 * Run: node --import tsx scripts/test-personal-delivery-links.ts
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  createPersonalDeliveryToken,
  verifyPersonalDeliveryToken,
  personalDeliveryUrls,
  personalDeliverySavePageHtml,
  PERSONAL_DELIVERY_PAGE_CSP,
} from '../src/services/personalDeliveryLinks.ts';
import { personalVideoReadyEmail } from '../src/services/resend.ts';

const accountId = '11111111-1111-1111-1111-111111111111';
const postId = '22222222-2222-2222-2222-222222222222';

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

/* ── tokens ─────────────────────────────────────────────────────── */
{
  const token = createPersonalDeliveryToken(accountId, postId);
  const v = verifyPersonalDeliveryToken(token);
  assert.ok(v);
  assert.equal(v.a, accountId);
  assert.equal(v.p, postId);
  assert.equal(verifyPersonalDeliveryToken(token + 'x'), null);
  assert.equal(verifyPersonalDeliveryToken('not-a-token'), null);

  const short = createPersonalDeliveryToken(accountId, postId, 1);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(verifyPersonalDeliveryToken(short), null, 'expired token must be rejected');
  section('token sign / verify / expiry / tamper');
}

/* ── URL shape ──────────────────────────────────────────────────── */
{
  const urls = personalDeliveryUrls(accountId, postId);
  assert.match(urls.pageUrl, /\/api\/v1\/personal\/delivery\//);
  assert.match(urls.copyUrl, /\?a=copy$/);
  assert.match(urls.previewUrl, /\?a=preview$/);
  assert.match(urls.previewStreamUrl, /\/preview$/);
  assert.match(urls.saveVideoUrl, /\?a=video$/);
  assert.match(urls.saveThumbUrl, /\?a=thumb$/);
  assert.match(urls.videoUrl, /\/video$/);
  assert.match(urls.thumbnailUrl, /\/thumbnail$/);
  section('delivery URL shapes');
}

/* ── HTML page ──────────────────────────────────────────────────── */
{
  const urls = personalDeliveryUrls(accountId, postId);
  const html = personalDeliverySavePageHtml({
    title: 'Test "Title" <b>x</b>',
    description: 'A full YouTube description with takeaways.',
    videoDownloadUrl: urls.videoUrl,
    thumbnailDownloadUrl: urls.thumbnailUrl,
    previewUrl: urls.previewStreamUrl,
    videoFilename: 'clip.mp4',
    thumbnailFilename: 'thumb.jpg',
    action: 'preview',
  });
  assert.match(html, /id="btnCopy"/);
  assert.match(html, /id="btnCopyDesc"/);
  assert.match(html, /id="btnPreview"/);
  assert.match(html, /id="btnVideo"/);
  assert.match(html, /id="btnThumb"/);
  assert.match(html, /download="clip\.mp4"/);
  assert.match(html, /isIos/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /pendingShare|Share to save video|Preparing/);
  assert.match(html, /A full YouTube description with takeaways/);
  assert.match(html, /preview-wrap on/);
  assert.match(html, /<h1>Test &quot;Title&quot; &lt;b&gt;x&lt;\/b&gt;<\/h1>/);
  assert.match(PERSONAL_DELIVERY_PAGE_CSP, /unsafe-inline/);
  section('save page HTML (escaped + preview visible + iOS share)');
}

/* ── email template ─────────────────────────────────────────────── */
{
  const urls = personalDeliveryUrls(accountId, postId);
  const mail = personalVideoReadyEmail({
    accountName: 'Channel',
    title: 'My Episode',
    postId,
    savePageUrl: urls.pageUrl,
    copyTitleUrl: urls.copyUrl,
    copyDescriptionUrl: urls.copyDescriptionUrl,
    saveVideoUrl: urls.saveVideoUrl,
    previewUrl: urls.previewUrl,
    saveThumbnailUrl: urls.saveThumbUrl,
  });
  assert.equal(mail.subject, 'My Episode');
  assert.match(mail.html, /Copy title/);
  assert.match(mail.html, /Copy description/);
  assert.match(mail.html, /Preview video/);
  assert.match(mail.html, /Save video/);
  assert.match(mail.html, /Save thumbnail/);
  assert.match(mail.html, /a=preview/);
  assert.match(mail.html, /a=video/);
  assert.match(mail.html, /a=thumb/);
  assert.match(mail.html, /a=copydesc/);
  assert.doesNotMatch(mail.html, /camera roll \(phone\)/i);
  section('email template is short + has all CTAs');
}

/* ── HTTP routes (in-memory stream, no DB) ──────────────────────── */
{
  const token = createPersonalDeliveryToken(accountId, postId);
  const enc = encodeURIComponent(token);
  const app = express();

  app.get('/api/v1/personal/delivery/:token', (req, res) => {
    const t = decodeURIComponent(String(req.params.token));
    assert.equal(t, token);
    const action = String(req.query.a ?? '') || null;
    res
      .type('html')
      .setHeader('Content-Security-Policy', PERSONAL_DELIVERY_PAGE_CSP)
      .send(
        personalDeliverySavePageHtml({
          title: 'HTTP Title',
          description: 'HTTP description body',
          videoDownloadUrl: `/api/v1/personal/delivery/${enc}/video`,
          thumbnailDownloadUrl: `/api/v1/personal/delivery/${enc}/thumbnail`,
          previewUrl: `/api/v1/personal/delivery/${enc}/preview`,
          videoFilename: 'v.mp4',
          thumbnailFilename: 't.jpg',
          action:
            action === 'preview' || action === 'copy' || action === 'copydesc' ? action : null,
        }),
      );
  });

  async function stream(res: express.Response, body: Buffer, asAttachment: boolean, type: string, name: string) {
    res.setHeader('Content-Type', type);
    res.setHeader(
      'Content-Disposition',
      `${asAttachment ? 'attachment' : 'inline'}; filename="${name}"`,
    );
    await pipeline(Readable.from(body), res);
  }

  const videoBytes = Buffer.from('fake-mp4-bytes');
  const thumbBytes = Buffer.from('fake-jpg-bytes');

  app.get('/api/v1/personal/delivery/:token/video', async (req, res) => {
    assert.equal(decodeURIComponent(String(req.params.token)), token);
    await stream(res, videoBytes, true, 'video/mp4', 'v.mp4');
  });
  app.get('/api/v1/personal/delivery/:token/preview', async (req, res) => {
    assert.equal(decodeURIComponent(String(req.params.token)), token);
    await stream(res, videoBytes, false, 'video/mp4', 'v.mp4');
  });
  app.get('/api/v1/personal/delivery/:token/thumbnail', async (req, res) => {
    assert.equal(decodeURIComponent(String(req.params.token)), token);
    await stream(res, thumbBytes, true, 'image/jpeg', 't.jpg');
  });

  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}/api/v1/personal/delivery/${enc}`;

  const page = await fetch(`${base}?a=preview`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') || '', /html/);
  assert.match(page.headers.get('content-security-policy') || '', /unsafe-inline/);
  const pageHtml = await page.text();
  assert.match(pageHtml, /preview-wrap on/);
  assert.match(pageHtml, /id="btnVideo"/);

  const video = await fetch(`${base}/video`);
  assert.equal(video.status, 200);
  assert.match(video.headers.get('content-disposition') || '', /attachment/);
  assert.equal(Buffer.compare(Buffer.from(await video.arrayBuffer()), videoBytes), 0);

  const preview = await fetch(`${base}/preview`);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('content-disposition') || '', /inline/);

  const thumb = await fetch(`${base}/thumbnail`);
  assert.equal(thumb.status, 200);
  assert.match(thumb.headers.get('content-disposition') || '', /attachment/);
  assert.equal(Buffer.compare(Buffer.from(await thumb.arrayBuffer()), thumbBytes), 0);

  server.close();
  section('HTTP delivery routes (page / video / preview / thumbnail)');
}

console.log('\nAll personal delivery smoke tests passed.\n');
