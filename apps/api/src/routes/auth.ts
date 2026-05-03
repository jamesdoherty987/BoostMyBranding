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
  registerClient,
  registerAgencyMember,
  authenticatePassword,
} from '../services/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { env, features } from '../env.js';

export const authRouter = Router();

/* ------------------------------------------------------------------ */
/* Magic-link flow (kept as a fallback / "forgot password" path)      */
/* ------------------------------------------------------------------ */

const sendSchema = z.object({
  email: z.string().email().max(200),
  redirectTo: z.string().url().optional(),
});

authRouter.post('/send', authLimiter, async (req, res, next) => {
  try {
    const { email, redirectTo } = sendSchema.parse(req.body);
    const host = `${req.protocol}://${req.get('host')}`;
    const result = await sendMagicLink({ email, callbackBase: host, redirectTo });
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

/* ------------------------------------------------------------------ */
/* Password login                                                     */
/* ------------------------------------------------------------------ */

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

/** Sign in with email + password. Sets a session cookie on success. */
authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authenticatePassword(email, password);
    if (!result) {
      // Same message for "no user" and "wrong password" — no enumeration.
      return res
        .status(401)
        .json({ error: { message: 'Invalid email or password.', code: 'BAD_CREDENTIALS' } });
    }
    const session = await createSession(result.userId);
    setSessionCookie(res, session.token);
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

/* ------------------------------------------------------------------ */
/* Client self-serve signup (password)                                */
/* ------------------------------------------------------------------ */

const registerClientSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  industry: z.string().max(100).optional(),
});

/**
 * Create a client-role account with email + password. No payment collected
 * here — they land in the portal with `subscription_status: 'none'` and pick
 * a plan when they want to use locked features.
 */
authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const body = registerClientSchema.parse(req.body);
    const result = await registerClient(body);
    if ('error' in result) {
      return res.status(400).json({ error: { message: result.error, code: 'REGISTER_FAILED' } });
    }
    const session = await createSession(result.userId);
    setSessionCookie(res, session.token);
    res.json({ data: { ok: true, clientId: result.clientId } });
  } catch (e) {
    next(e);
  }
});

/* ------------------------------------------------------------------ */
/* Team (agency) signup                                                */
/* ------------------------------------------------------------------ */

const registerAgencySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200),
});

/**
 * Create an agency team account. Domain-gated to @boostmybranding.com so a
 * random signup can't escalate into agency privileges.
 */
authRouter.post('/register-team', authLimiter, async (req, res, next) => {
  try {
    const body = registerAgencySchema.parse(req.body);
    const result = await registerAgencyMember(body);
    if ('error' in result) {
      return res.status(400).json({ error: { message: result.error, code: 'REGISTER_FAILED' } });
    }
    const session = await createSession(result.userId);
    setSessionCookie(res, session.token);
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

/* ------------------------------------------------------------------ */
/* Legacy magic-link signup (kept for backwards compatibility)         */
/* ------------------------------------------------------------------ */

const signupSchema = z.object({
  email: z.string().email().max(200),
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  industry: z.string().max(100).optional(),
  websiteUrl: z.string().url().max(500).optional().or(z.literal('')),
  tier: z.enum(['social_only', 'website_only', 'full_package']).default('social_only'),
  redirectTo: z.string().url().optional(),
});

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

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

authRouter.get('/callback', async (req, res) => {
  const token = String(req.query.token ?? '');
  const redirectTo = String(req.query.redirectTo ?? '');
  if (!token || token.length < 32) return res.status(400).send('Invalid token.');

  const consumed = await consumeMagicLink(token);
  if (!consumed) return res.status(400).send('This magic link is invalid or expired.');

  const session = await createSession(consumed.userId);
  setSessionCookie(res, session.token);

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
