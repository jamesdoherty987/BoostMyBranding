/**
 * Optional Resend notification when a personal channel finishes a new render.
 * Sends a **link** to the hosted MP4 (no attachment — size / deliverability).
 */

import { features } from '../env.js';
import { sendEmail, personalVideoReadyEmail } from './resend.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function maybeEmailPersonalVideoReady(args: {
  accountName: string;
  emailVideoOnReady: boolean;
  videoDeliveryEmail: string | null | undefined;
  postId: string;
  videoUrl: string | null | undefined;
  topic: string;
  captionPreview: string;
}): Promise<void> {
  if (!features.resend) return;
  if (!args.emailVideoOnReady) return;
  const to = (args.videoDeliveryEmail ?? '').trim();
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
    accountName: args.accountName,
    topic: args.topic || 'Personal post',
    captionPreview: args.captionPreview || '',
    videoUrl: url,
    postId: args.postId,
  });
  await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
}
