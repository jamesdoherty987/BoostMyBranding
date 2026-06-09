/**
 * Optional Resend notification when a personal channel finishes a new render.
 * Sends a **link** to the hosted MP4 (no attachment — size / deliverability).
 *
 * Reads `emailVideoOnReady` / `videoDeliveryEmail` / `accountName` from the DB
 * at send time so a long render still honors settings saved after the job started.
 */

import { eq } from 'drizzle-orm';
import { getDb, personalAccounts } from '@boost/database';
import { features } from '../env.js';
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
  if (!row.emailVideoOnReady) return;
  const to = (row.videoDeliveryEmail ?? '').trim();
  if (!to || !EMAIL_RE.test(to)) {
    console.warn('[personalVideoDeliveryEmail] skipped: no valid videoDeliveryEmail');
    return;
  }
  const url = (args.videoUrl ?? '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    console.warn('[personalVideoDeliveryEmail] skipped: no public video URL');
    return;
  }
  const tpl = personalVideoReadyEmail({
    accountName: row.accountName,
    topic: args.topic || 'Personal post',
    captionPreview: args.captionPreview || '',
    videoUrl: url,
    postId: args.postId,
  });
  await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
}
