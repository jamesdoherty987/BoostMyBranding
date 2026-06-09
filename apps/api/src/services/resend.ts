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
  if (!features.resend || !client()) {
    console.log('\n📧 [dev] Email would be sent:');
    console.log('  To:     ', args.to);
    console.log('  Subject:', args.subject);
    console.log('  Body:   ', args.text ?? args.html.slice(0, 160));
    return { id: 'mock', ok: true };
  }
  const res = await client()!.emails.send({
    from: env.FROM_EMAIL,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
  if (res.error) {
    const msg =
      typeof res.error === 'object' && res.error && 'message' in res.error
        ? String((res.error as { message?: string }).message)
        : String(res.error);
    throw new Error(msg || 'Resend emails.send failed');
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
  topic: string;
  captionPreview: string;
  videoUrl: string;
  postId: string;
}) {
  const safeName = escapeHtml(args.accountName);
  const safeTopic = escapeHtml(args.topic);
  const safeCaption =
    args.captionPreview.length > 400
      ? `${escapeHtml(args.captionPreview.slice(0, 400))}…`
      : escapeHtml(args.captionPreview);
  const safeUrl = escapeHtml(args.videoUrl);
  const safePost = escapeHtml(args.postId);
  return {
    subject: `Video ready — ${args.accountName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:20px;">Your video is ready</h1>
        <p style="color:#334155;"><strong>${safeName}</strong> — topic: <strong>${safeTopic}</strong></p>
        <p style="margin:20px 0;">
          <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(90deg,#48D886,#1D9CA1);color:white;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:600;">
            Download / open video
          </a>
        </p>
        <p style="color:#64748B;font-size:13px;line-height:1.5;">Link expires only if you move or delete the file in your dashboard storage. Post id: <code>${safePost}</code></p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
        <p style="color:#475569;font-size:13px;line-height:1.5;"><strong>Caption preview</strong><br/>${safeCaption || '<em>(none)</em>'}</p>
      </div>
    `,
    text: `Video ready for ${args.accountName} — ${args.topic}\n\nOpen: ${args.videoUrl}\n\nPost id: ${args.postId}`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
