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

/** Safe ASCII filename for email `download` hints (browsers may ignore cross-origin). */
function safeVideoDownloadFilename(topic: string): string {
  const t = topic
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 72);
  const base = t || 'video';
  return base.toLowerCase().endsWith('.mp4') ? base : `${base}.mp4`;
}

/** Link-based delivery — large MP4s are not attached (Resend size limits). */
export function personalVideoReadyEmail(args: {
  accountName: string;
  topic: string;
  captionPreview: string;
  videoUrl: string;
  postId: string;
  /** Logged-in users get a proper `Content-Disposition: attachment` download from the API. */
  openInAppUrl?: string;
}) {
  const safeName = escapeHtml(args.accountName);
  const safeTopic = escapeHtml(args.topic);
  const safeCaption =
    args.captionPreview.length > 400
      ? `${escapeHtml(args.captionPreview.slice(0, 400))}…`
      : escapeHtml(args.captionPreview);
  const safeUrl = escapeHtml(args.videoUrl);
  const safePost = escapeHtml(args.postId);
  const downloadName = escapeHtml(safeVideoDownloadFilename(args.topic));
  const appUrl = (args.openInAppUrl ?? '').trim();
  const safeApp = appUrl ? escapeHtml(appUrl) : '';
  const appButton =
    safeApp.length > 0
      ? `<p style="margin:12px 0 0 0;">
          <a href="${safeApp}" style="display:inline-block;background:#0f172a;color:#f8fafc;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:600;border:1px solid #334155;">
            Open in BoostMyBranding
          </a>
        </p>
        <p style="color:#64748B;font-size:12px;line-height:1.5;margin:8px 0 0 0;">Sign in, open your Personal channel, then use <strong>Download</strong> on the post for a file save with the correct filename.</p>`
      : '';

  return {
    subject: `Video ready — ${args.accountName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:20px;">Your video is ready</h1>
        <p style="color:#334155;"><strong>${safeName}</strong> — topic: <strong>${safeTopic}</strong></p>
        <p style="margin:20px 0 8px 0;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <a href="${safeUrl}" download="${downloadName}" style="display:inline-block;background:linear-gradient(90deg,#48D886,#1D9CA1);color:white;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:600;">
            Download video
          </a>
          <a href="${safeUrl}" style="display:inline-block;color:#0f766e;padding:12px 16px;border-radius:12px;text-decoration:underline;font-weight:600;font-size:14px;">
            Open video in browser
          </a>
        </p>
        ${appButton}
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:22px 0;">
          <p style="margin:0 0 10px 0;font-weight:600;color:#0f172a;font-size:14px;">Save to camera roll (phone)</p>
          <p style="margin:0;color:#475569;font-size:13px;line-height:1.55;">
            <strong>iPhone / iPad:</strong> Tap <strong>Open video in browser</strong> (or <strong>Download video</strong>) so it opens in <strong>Safari</strong> if you can — then tap the <strong>Share</strong> icon → <strong>Save Video</strong> to add it to Photos (camera roll). If the link opened inside your mail app, use the “⋯” / share menu and choose <strong>Open in Safari</strong> first.<br/><br/>
            <strong>Android:</strong> Tap <strong>Download video</strong>, then open the file from notifications or Downloads and use <strong>Share</strong> or <strong>Save to Gallery</strong> (wording varies by device).
          </p>
        </div>
        <p style="color:#64748B;font-size:13px;line-height:1.5;">Direct link (copy if a button does not work):<br/><a href="${safeUrl}" style="color:#0d9488;word-break:break-all;">${safeUrl}</a></p>
        <p style="color:#64748B;font-size:13px;line-height:1.5;">Post id: <code>${safePost}</code></p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
        <p style="color:#475569;font-size:13px;line-height:1.5;"><strong>Caption preview</strong><br/>${safeCaption || '<em>(none)</em>'}</p>
      </div>
    `,
    text: [
      `Video ready for ${args.accountName} — ${args.topic}`,
      '',
      'DOWNLOAD (tap and hold on phone to save, or open in a browser):',
      args.videoUrl,
      '',
      safeApp
        ? [
            'OPEN IN APP (sign in → Personal channel → Download on the post for best filename):',
            appUrl,
            '',
          ].join('\n')
        : '',
      'SAVE TO CAMERA ROLL:',
      '- iPhone/iPad: Open the link in Safari → Share → Save Video.',
      '- Android: Download the file, then Share / Save to Gallery from Downloads.',
      '',
      `Post id: ${args.postId}`,
      '',
      args.captionPreview ? `Caption preview:\n${args.captionPreview.slice(0, 600)}` : '',
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
