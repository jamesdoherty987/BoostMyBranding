/**
 * Agency + client notifications. In production these go out as email via
 * Resend. In dev they log to the console, so every flow is visible.
 *
 * Each function is a thin template — the bodies live here so they're easy
 * to tune without touching the pipeline.
 */

import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, users } from '@boost/database';
import { sendEmail } from './resend.js';
import { env } from '../env.js';

export async function notifyAgencyBatchReady(args: {
  clientName: string;
  batchId: string;
  postsGenerated: number;
  costCents: number;
}) {
  const admins = await listAgencyAdmins();
  if (admins.length === 0) {
    console.log(
      `📣 [notify] Batch ready for ${args.clientName} (${args.postsGenerated} posts) — no admins to email`,
    );
    return;
  }
  const cta = `${env.DASHBOARD_URL}/review`;
  await Promise.all(
    admins.map((email) =>
      sendEmail({
        to: email,
        subject: `New content ready to review — ${args.clientName}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 12px;">New batch is ready 🚀</h2>
            <p style="color:#334155;">
              We drafted <strong>${args.postsGenerated} posts</strong> for
              <strong>${args.clientName}</strong>. Estimated cost: €${(args.costCents / 100).toFixed(2)}.
            </p>
            <p style="margin:28px 0;">
              <a href="${cta}" style="display:inline-block;background:linear-gradient(90deg,#48D886,#1D9CA1);color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">
                Open review queue
              </a>
            </p>
            <p style="color:#64748B;font-size:12px;">Batch ID: ${args.batchId}</p>
          </div>
        `,
        text: `New batch ready for ${args.clientName}: ${args.postsGenerated} posts. ${cta}`,
      }),
    ),
  );
}

export async function notifyClientPostsAwaiting(args: {
  clientEmail: string;
  clientName: string;
  pendingCount: number;
}) {
  const cta = `${env.PORTAL_URL}/calendar`;
  await sendEmail({
    to: args.clientEmail,
    subject: `${args.pendingCount} posts ready for your review`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;">Your calendar is ready</h2>
        <p style="color:#334155;">
          Hi ${args.clientName}, we've drafted <strong>${args.pendingCount} posts</strong> for the month.
          It takes about 7 minutes to review — swipe right to approve, left to send back.
        </p>
        <p style="margin:28px 0;">
          <a href="${cta}" style="display:inline-block;background:linear-gradient(90deg,#48D886,#1D9CA1);color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">
            Review posts
          </a>
        </p>
      </div>
    `,
    text: `${args.pendingCount} posts ready for your review: ${cta}`,
  });
}

async function listAgencyAdmins(): Promise<string[]> {
  if (!isDbConfigured()) return [env.FROM_EMAIL];
  const db = getDb();
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, 'agency_admin'));
  return rows.map((r) => r.email);
}

/**
 * Generic agency-wide notification. Used for low-frequency, high-signal
 * events (new leads, failed runs). Goes to every agency_admin user.
 */
export async function sendAgencyNotification(args: {
  subject: string;
  body: string;
}) {
  const admins = await listAgencyAdmins();
  if (admins.length === 0) {
    console.log(`📣 [notify] ${args.subject}`);
    return;
  }
  await Promise.all(
    admins.map((email) =>
      sendEmail({
        to: email,
        subject: args.subject,
        text: args.body,
        html: `<pre style="font-family:Inter,sans-serif;white-space:pre-wrap;color:#0f172a;font-size:14px;line-height:1.55;padding:20px;">${escapeHtml(args.body)}</pre>`,
      }),
    ),
  );
}

/** Minimal HTML-escape for safe text-in-html rendering of user input. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
