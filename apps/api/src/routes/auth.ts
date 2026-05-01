import { Router } from 'express';
import { z } from 'zod';
import {
  sendMagicLink,
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
