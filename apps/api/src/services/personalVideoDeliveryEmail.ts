/**
 * Optional Resend notification when a personal channel finishes a new render.
 * Sends a **short** email with title + one-tap save links (copy / video / thumbnail).
 */

import { and, eq } from 'drizzle-orm';
import { getDb, personalAccounts, personalPosts } from '@boost/database';
import { features } from '../env.js';
import { sendEmail, personalVideoReadyEmail } from './resend.js';
import { personalDeliveryUrls } from './personalDeliveryLinks.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailPersonalVideoResult =
  | { ok: true; to: string; resendId?: string }
  | {
      ok: false;
      code:
        | 'RESEND_OFF'
        | 'ACCOUNT_NOT_FOUND'
        | 'EMAIL_OFF'
        | 'EMAIL_MISSING'
        | 'EMAIL_INVALID'
        | 'NO_VIDEO'
        | 'SEND_FAILED';
      message: string;
    };

async function loadDeliveryAccount(accountId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      accountName: personalAccounts.accountName,
      emailVideoOnReady: personalAccounts.emailVideoOnReady,
      videoDeliveryEmail: personalAccounts.videoDeliveryEmail,
    })
    .from(personalAccounts)
    .where(eq(personalAccounts.id, accountId))
    .limit(1);
  return row ?? null;
}

function titleFromScript(script: unknown, topic: string): string {
  if (script && typeof script === 'object' && typeof (script as { title?: unknown }).title === 'string') {
    const t = String((script as { title: string }).title).trim();
    if (t) return t;
  }
  return (topic || '').trim() || 'Video';
}

async function loadPostForDelivery(accountId: string, postId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: personalPosts.id,
      topic: personalPosts.topic,
      script: personalPosts.script,
      videoUrl: personalPosts.videoUrl,
      thumbnailUrl: personalPosts.thumbnailUrl,
    })
    .from(personalPosts)
    .where(and(eq(personalPosts.id, postId), eq(personalPosts.accountId, accountId)))
    .limit(1);
  return row ?? null;
}

/**
 * Auto-send after render. No-ops when the account toggle is off or email is unset.
 */
export async function maybeEmailPersonalVideoReady(args: {
  accountId: string;
  postId: string;
  videoUrl: string | null | undefined;
  topic: string;
  captionPreview: string;
}): Promise<void> {
  const result = await emailPersonalVideoReady({
    ...args,
    requireAutoToggle: true,
  });
  if (!result.ok && result.code === 'SEND_FAILED') {
    throw new Error(result.message);
  }
}

/**
 * Send (or re-send) the delivery email for a finished video.
 * When `requireAutoToggle` is false (manual Send button), only a valid delivery
 * address is required — the "Email when ready" toggle can stay off.
 */
export async function emailPersonalVideoReady(args: {
  accountId: string;
  postId: string;
  videoUrl: string | null | undefined;
  topic: string;
  captionPreview: string;
  /** When true (default for post-render), skip if `emailVideoOnReady` is off. */
  requireAutoToggle?: boolean;
}): Promise<EmailPersonalVideoResult> {
  if (!features.resend) {
    console.warn(
      '[personalVideoDeliveryEmail] skipped: RESEND_API_KEY is not set on the API (features.resend=false).',
      { postId: args.postId, accountId: args.accountId },
    );
    return {
      ok: false,
      code: 'RESEND_OFF',
      message: 'RESEND_API_KEY is not configured on the API',
    };
  }

  const row = await loadDeliveryAccount(args.accountId);
  if (!row) {
    console.warn('[personalVideoDeliveryEmail] skipped: account not found');
    return { ok: false, code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' };
  }

  const requireToggle = args.requireAutoToggle !== false;
  if (requireToggle && !row.emailVideoOnReady) {
    console.info('[personalVideoDeliveryEmail] skipped: emailVideoOnReady is off', {
      postId: args.postId,
    });
    return {
      ok: false,
      code: 'EMAIL_OFF',
      message: 'Email when ready is turned off for this account',
    };
  }

  const to = (row.videoDeliveryEmail ?? '').trim();
  if (!to) {
    console.warn(
      '[personalVideoDeliveryEmail] skipped: set a valid "Video delivery email" in Personal settings.',
      { postId: args.postId },
    );
    return {
      ok: false,
      code: 'EMAIL_MISSING',
      message: 'Set a video delivery email in Personal → Posting first',
    };
  }
  if (!EMAIL_RE.test(to)) {
    return {
      ok: false,
      code: 'EMAIL_INVALID',
      message: 'Video delivery email is not a valid address',
    };
  }

  const url = (args.videoUrl ?? '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    console.warn(
      '[personalVideoDeliveryEmail] skipped: video URL is missing or not http(s) (check R2_PUBLIC_URL / upload).',
      { postId: args.postId },
    );
    return {
      ok: false,
      code: 'NO_VIDEO',
      message: 'This post has no downloadable video URL yet',
    };
  }

  const post = await loadPostForDelivery(args.accountId, args.postId);
  const title = post
    ? titleFromScript(post.script, post.topic || args.topic)
    : (args.topic || '').trim() || 'Video';
  const hasThumb = Boolean((post?.thumbnailUrl ?? '').trim());
  const links = personalDeliveryUrls(args.accountId, args.postId);

  const tpl = personalVideoReadyEmail({
    accountName: row.accountName,
    title,
    topic: args.topic,
    postId: args.postId,
    savePageUrl: links.pageUrl,
    copyTitleUrl: links.copyUrl,
    saveVideoUrl: links.saveVideoUrl,
    saveThumbnailUrl: hasThumb ? links.saveThumbUrl : null,
  });

  try {
    const result = await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
    const toRedacted = to.includes('@') ? `${to.slice(0, 2)}…@${to.split('@')[1]}` : '(set)';
    console.info('[personalVideoDeliveryEmail] sent', {
      postId: args.postId,
      to: toRedacted,
      resendId: result.id,
    });
    return { ok: true, to, resendId: result.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const toRedacted = to.includes('@') ? `${to.slice(0, 2)}…@${to.split('@')[1]}` : '(set)';
    console.error('[personalVideoDeliveryEmail] send failed', {
      postId: args.postId,
      to: toRedacted,
      msg,
    });
    return { ok: false, code: 'SEND_FAILED', message: msg };
  }
}
