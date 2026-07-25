/**
 * Email service. Uses Resend when RESEND_API_KEY is configured. Otherwise
 * logs to the console — handy during local magic-link development.
 */

import { Resend } from 'resend';
import { env, features } from '../env.js';

let _resend: Resend | null = null;
function client() {
  if (!_resend && features.resend) _resend = new Resend(env.RESEND_API_KEY!);
  return _resend;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(args: SendArgs) {
  // When RESEND_API_KEY is unset, `features.resend` is false — do not call the client.
  if (!features.resend) {
    console.log('\n📧 [dev] Email would be sent:');
    console.log('  To:     ', args.to);
    console.log('  Subject:', args.subject);
    console.log('  Body:   ', args.text ?? args.html.slice(0, 160));
    return { id: 'mock', ok: true };
  }
  const from = env.FROM_EMAIL.trim();
  if (!from) {
    throw new Error(
      'FROM_EMAIL is empty. Set FROM_EMAIL in .env to a sender address verified in your Resend dashboard.',
    );
  }
  let res: { data?: { id?: string } | null; error?: unknown };
  try {
    res = await client()!.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[resend] emails.send threw:', msg);
    throw new Error(
      `Resend transport error: ${msg}. Check RESEND_API_KEY and network; see https://resend.com/docs`,
    );
  }
  if (res.error) {
    const err = res.error as { message?: string; name?: string };
    const msg = err?.message ? String(err.message) : String(res.error);
    const code = err?.name ? String(err.name) : '';
    console.error('[resend] emails.send error:', code || '(no code)', msg);
    const domainUnverified =
      /domain is not verified|not verified.*resend\.com\/domains/i.test(msg);
    const fromRelated =
      code === 'invalid_from_address' ||
      /invalid.*from/i.test(msg) ||
      /from address/i.test(msg);
    const hint =
      domainUnverified || fromRelated
        ? ' Verify the domain for FROM_EMAIL in https://resend.com/domains (DNS), or for local-only testing set FROM_EMAIL to a Resend-allowed address such as "BoostMyBranding <onboarding@resend.dev>" (never use that in production).'
        : code === 'validation_error' || code === 'invalid_parameter'
          ? ' Check "to" address, FROM_EMAIL, and HTML length.'
          : '';
    throw new Error((msg || 'Resend emails.send failed') + hint);
  }
  return { id: res.data?.id ?? '', ok: true };
}

export function magicLinkEmail(link: string, name?: string) {
  return {
    subject: 'Your BoostMyBranding sign-in link',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h1 style="font-size:20px;">Welcome ${name ? name + ', ' : ''}</h1>
        <p style="color:#334155;">Tap the button below to sign in. The link is good for 15 minutes.</p>
        <p style="margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(90deg,#48D886,#1D9CA1);color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">
            Sign in
          </a>
        </p>
        <p style="color:#64748B;font-size:12px;">If you didn't request this email, you can ignore it.</p>
      </div>
    `,
    text: `Sign in to BoostMyBranding: ${link} (expires in 15 minutes)`,
  };
}

/**
 * Email template for a client invite sent from the agency dashboard.
 * `link` is the pre-filled signup URL (includes email, business, name
 * as query params). The client clicks it, lands on /signup with the
 * form pre-filled, picks a password, and is signed in.
 *
 * Keep the voice friendly and low-pressure — many clients have never
 * heard of us before, they're agreeing because the agency they trust
 * told them to.
 */
export function clientInviteEmail(args: {
  link: string;
  agencyName?: string;
  contactName?: string;
  businessName: string;
}) {
  const firstName = args.contactName?.split(' ')[0];
  const from = args.agencyName ? ` from ${args.agencyName}` : '';
  return {
    subject: `${args.agencyName ?? 'Your agency'} set up a BoostMyBranding workspace for ${args.businessName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h1 style="font-size:22px;margin-bottom:12px;">Welcome${firstName ? ', ' + firstName : ''}</h1>
        <p style="color:#334155;line-height:1.6;">
          Your team${from} set up a BoostMyBranding workspace for
          <strong>${args.businessName}</strong>. Click below to finish setup — it takes
          30 seconds. You just need to pick a password.
        </p>
        <p style="margin:28px 0;">
          <a href="${args.link}" style="display:inline-block;background:linear-gradient(90deg,#48D886,#1D9CA1);color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">
            Finish setting up
          </a>
        </p>
        <p style="color:#64748B;font-size:13px;line-height:1.5;">
          Once you're in, you can review your site, approve social posts, message your agency,
          and upload photos — all from one dashboard.
        </p>
        <p style="color:#94A3B8;font-size:12px;margin-top:24px;">
          If you weren't expecting this, it's safe to ignore. The link will stop working in 7 days.
        </p>
      </div>
    `,
    text: `Your agency set up a BoostMyBranding workspace for ${args.businessName}. Finish setup: ${args.link}`,
  };
}

/** Link-based delivery — large MP4s are not attached (Resend size limits). */
export function personalVideoReadyEmail(args: {
  accountName: string;
  /** Video title shown in the email (preferred over topic). */
  title: string;
  topic?: string;
  captionPreview?: string;
  postId: string;
  /** One-tap save page (copy title / save video / save thumbnail). */
  savePageUrl: string;
  copyTitleUrl: string;
  saveVideoUrl: string;
  previewUrl: string;
  saveThumbnailUrl?: string | null;
}) {
  const title = (args.title || args.topic || 'Video').trim() || 'Video';
  const safeTitle = escapeHtml(title);
  const copyUrl = escapeHtml(args.copyTitleUrl);
  const videoSaveUrl = escapeHtml(args.saveVideoUrl);
  const previewUrl = escapeHtml(args.previewUrl);
  const pageUrl = escapeHtml(args.savePageUrl);
  const thumbSaveUrl = (args.saveThumbnailUrl ?? '').trim();
  const safeThumb = thumbSaveUrl ? escapeHtml(thumbSaveUrl) : '';

  const thumbButton = safeThumb
    ? `<p style="margin:10px 0 0 0;">
          <a href="${safeThumb}" style="display:block;background:#0f172a;color:#f8fafc;padding:14px 18px;border-radius:12px;text-decoration:none;font-weight:650;text-align:center;">
            Save thumbnail
          </a>
        </p>`
    : '';

  return {
    subject: title,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:28px 20px;">
        <p style="margin:0 0 6px 0;color:#64748B;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Video ready</p>
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 22px 0;color:#0f172a;letter-spacing:-0.02em;">${safeTitle}</h1>
        <p style="margin:0;">
          <a href="${copyUrl}" style="display:block;background:#f1f5f9;color:#0f172a;padding:14px 18px;border-radius:12px;text-decoration:none;font-weight:650;text-align:center;">
            Copy title
          </a>
        </p>
        <p style="margin:10px 0 0 0;">
          <a href="${previewUrl}" style="display:block;background:#e2e8f0;color:#0f172a;padding:14px 18px;border-radius:12px;text-decoration:none;font-weight:650;text-align:center;">
            Preview video
          </a>
        </p>
        <p style="margin:10px 0 0 0;">
          <a href="${videoSaveUrl}" style="display:block;background:linear-gradient(90deg,#48D886,#1D9CA1);color:#ffffff;padding:14px 18px;border-radius:12px;text-decoration:none;font-weight:650;text-align:center;">
            Save video
          </a>
        </p>
        ${thumbButton}
        <p style="margin:18px 0 0 0;text-align:center;">
          <a href="${pageUrl}" style="color:#64748B;font-size:13px;">Open all options</a>
        </p>
      </div>
    `,
    text: [
      title,
      '',
      `Copy title: ${args.copyTitleUrl}`,
      `Preview: ${args.previewUrl}`,
      `Save video: ${args.saveVideoUrl}`,
      thumbSaveUrl ? `Save thumbnail: ${thumbSaveUrl}` : '',
      `All options: ${args.savePageUrl}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

/** Alert when scheduled personal generation or ContentStudio posting fails. */
export function personalPostFailedEmail(args: {
  accountName: string;
  topic: string;
  postId: string;
  error: string;
  /** When set, video rendered but scheduling/publish failed — include save link. */
  savePageUrl?: string | null;
}) {
  const topic = (args.topic || 'Video').trim() || 'Video';
  const safeTopic = escapeHtml(topic);
  const safeAccount = escapeHtml(args.accountName || 'Personal account');
  const safeError = escapeHtml((args.error || 'Unknown error').slice(0, 800));
  const pageUrl = (args.savePageUrl ?? '').trim();
  const safePage = pageUrl ? escapeHtml(pageUrl) : '';
  const saveBlock = safePage
    ? `<p style="margin:18px 0 0 0;">
          <a href="${safePage}" style="display:block;background:#0f172a;color:#f8fafc;padding:14px 18px;border-radius:12px;text-decoration:none;font-weight:650;text-align:center;">
            Open video / options
          </a>
        </p>`
    : '';

  return {
    subject: `Error: ${topic}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:28px 20px;">
        <p style="margin:0 0 6px 0;color:#B45309;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Posting error</p>
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 12px 0;color:#0f172a;letter-spacing:-0.02em;">${safeTopic}</h1>
        <p style="margin:0 0 16px 0;color:#64748B;font-size:14px;line-height:1.45;">
          Something went wrong for <strong style="color:#0f172a;">${safeAccount}</strong>. The scheduled post did not complete successfully.
        </p>
        <pre style="margin:0;padding:14px 16px;background:#f8fafc;border-radius:12px;color:#334155;font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-word;">${safeError}</pre>
        ${saveBlock}
        <p style="margin:18px 0 0 0;color:#94A3B8;font-size:12px;">Post id: ${escapeHtml(args.postId)}</p>
      </div>
    `,
    text: [
      `Posting error: ${topic}`,
      `Account: ${args.accountName}`,
      '',
      args.error,
      '',
      pageUrl ? `Open: ${pageUrl}` : '',
      `Post id: ${args.postId}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
