/**
 * Optional Resend notification when a personal channel finishes a new render.
 * Sends a **link** to the hosted MP4 (no attachment — size / deliverability), with
 * download / open-in-browser CTAs, camera-roll save steps for phones, and a dashboard link.
 *
 * Reads `emailVideoOnReady` / `videoDeliveryEmail` / `accountName` from the DB
 * at send time so a long render still honors settings saved after the job started.
 */

import { eq } from 'drizzle-orm';
import { getDb, personalAccounts } from '@boost/database';
import { env, features } from '../env.js';
import { sendEmail, personalVideoReadyEmail } from './resend.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function maybeEmailPersonalVideoReady(args: {
  accountId: string;
  postId: string;
  videoUrl: string | null | undefined;
  topic: string;
  captionPreview: string;
}): Promise<void> {
  if (!features.resend) return;

  const db = getDb();
  const [row] = await db
    .select({
      accountName: personalAccounts.accountName,
      emailVideoOnReady: personalAccounts.emailVideoOnReady,
      videoDeliveryEmail: personalAccounts.videoDeliveryEmail,
    })
    .from(personalAccounts)
    .where(eq(personalAccounts.id, args.accountId))
    .limit(1);

  if (!row) {
    console.warn('[personalVideoDeliveryEmail] skipped: account not found');
    return;
  }
  if (!row.emailVideoOnReady) {
    console.info('[personalVideoDeliveryEmail] skipped: emailVideoOnReady is off', {
      postId: args.postId,
    });
    return;
  }
  const to = (row.videoDeliveryEmail ?? '').trim();
  if (!to || !EMAIL_RE.test(to)) {
    console.warn(
      '[personalVideoDeliveryEmail] skipped: set a valid "Video delivery email" in Personal settings (toggle "Email when ready" needs a real address).',
      { postId: args.postId, hadValue: Boolean((row.videoDeliveryEmail ?? '').trim()) },
    );
    return;
  }
  const url = (args.videoUrl ?? '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    console.warn(
      '[personalVideoDeliveryEmail] skipped: video URL is missing or not http(s) (check R2_PUBLIC_URL / upload).',
      { postId: args.postId },
    );
    return;
  }
  const openInAppUrl = `${env.DASHBOARD_URL.replace(/\/+$/, '')}/personal`;
  const tpl = personalVideoReadyEmail({
    accountName: row.accountName,
    topic: args.topic || 'Personal post',
    captionPreview: args.captionPreview || '',
    videoUrl: url,
    postId: args.postId,
    openInAppUrl,
  });
  try {
    const result = await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
    const toRedacted = to.includes('@') ? `${to.slice(0, 2)}…@${to.split('@')[1]}` : '(set)';
    console.info('[personalVideoDeliveryEmail] sent', {
      postId: args.postId,
      to: toRedacted,
      resendId: result.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const toRedacted = to.includes('@') ? `${to.slice(0, 2)}…@${to.split('@')[1]}` : '(set)';
    console.error('[personalVideoDeliveryEmail] send failed', {
      postId: args.postId,
      to: toRedacted,
      msg,
    });
    throw e;
  }
}
