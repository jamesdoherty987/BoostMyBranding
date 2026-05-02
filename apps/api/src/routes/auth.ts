import { Router } from 'express';
import { z } from 'zod';
import {
  sendMagicLink,
  signupAndSendMagicLink,
  consumeMagicLink,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  revokeSession,
  getSessionToken,
  requireAuth,
  isSafeRedirect,
  COOKIE_NAME,
} from '../services/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { env, features } from '../env.js';

export const authRouter = Router();

const sendSchema = z.object({
  email: z.string().email().max(200),
  redirectTo: z.string().url().optional(),
});

authRouter.post('/send', authLimiter, async (req, res, next) => {
  try {
    const { email, redirectTo } = sendSchema.parse(req.body);
    const host = `${req.protocol}://${req.get('host')}`;
    const result = await sendMagicLink({ email, callbackBase: host, redirectTo });
    // Don't leak the dev link in prod even if Resend is misconfigured.
    res.json({
      data: {
        sent: true,
        devLink:
          env.NODE_ENV === 'production' || features.resend ? undefined : result.devUrl,
      },
    });
  } catch (e) {
    next(e);
  }
});

const signupSchema = z.object({
  email: z.string().email().max(200),
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  industry: z.string().max(100).optional(),
  websiteUrl: z.string().url().max(500).optional().or(z.literal('')),
  tier: z.enum(['social_only', 'website_only', 'full_package']).default('full_package'),
  redirectTo: z.string().url().optional(),
});

/**
 * Self-serve signup. Creates a client + user record and mails a magic link.
 * No payment required at this stage — the user lands in the portal with
 * `subscriptionStatus: 'none'` and pays in-app when they try to use a
 * locked feature.
 */
authRouter.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const host = `${req.protocol}://${req.get('host')}`;
    const result = await signupAndSendMagicLink({
      email: body.email,
      businessName: body.businessName,
      contactName: body.contactName,
      industry: body.industry,
      websiteUrl: body.websiteUrl || undefined,
      tier: body.tier,
      callbackBase: host,
      redirectTo: body.redirectTo,
    });
    res.json({
      data: {
        sent: true,
        devLink:
          env.NODE_ENV === 'production' || features.resend ? undefined : result.devUrl,
      },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.get('/callback', async (req, res) => {
  const token = String(req.query.token ?? '');
  const redirectTo = String(req.query.redirectTo ?? '');
  if (!token || token.length < 32) return res.status(400).send('Invalid token.');

  const consumed = await consumeMagicLink(token);
  if (!consumed) return res.status(400).send('This magic link is invalid or expired.');

  const session = await createSession(consumed.userId);
  setSessionCookie(res, session.token);

  // Only redirect to URLs on our own apps to prevent open-redirect phishing.
  const target =
    redirectTo && isSafeRedirect(redirectTo) ? redirectTo : env.PORTAL_URL;
  res.redirect(target);
});

authRouter.get('/me', requireAuth, (req, res) => {
  const { id, email, name, role, clientId } = (req as any).user;
  res.json({ data: { id, email, name, role, clientId } });
});

authRouter.post('/logout', async (req, res) => {
  const token = getSessionToken(req);
  if (token) await revokeSession(token);
  clearSessionCookie(res);
  res.json({ data: { ok: true } });
});

export { COOKIE_NAME };
