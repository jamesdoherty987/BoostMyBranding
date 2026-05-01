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
  return { id: res.data?.id ?? '', ok: !res.error };
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
