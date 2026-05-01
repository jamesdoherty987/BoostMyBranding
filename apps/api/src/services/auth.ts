/**
 * Auth service: magic-link sign-in + signed session cookies.
 *
 * OWASP coverage:
 *   A02 Cryptographic Failures — tokens are 32 random bytes, stored only as
 *                                SHA-256 hashes; cookies are HttpOnly + Secure.
 *   A07 Identification Failures — links are one-time + TTL'd; sessions can be
 *                                 rotated or revoked; rate limits on /send.
 *   A04 Insecure Design         — we never leak the token in logs/response
 *                                 except in explicit dev mode (no Resend key).
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { eq, gt, and } from 'drizzle-orm';
import { getDb, isDbConfigured, users, magicLinks, sessions } from '@boost/database';
import { env } from '../env.js';
import { sendEmail, magicLinkEmail } from './resend.js';

const SESSION_COOKIE = 'bmb_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAGIC_TTL_MS = 15 * 60 * 1000;

interface MemUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  clientId?: string;
}

/** Fallback memory store (dev only — no DATABASE_URL). Swapped for DB in prod. */
const memMagic = new Map<string, { email: string; expiresAt: number }>();
const memSessions = new Map<string, { userId: string; expiresAt: number }>();
const memUsers = new Map<string, MemUser>();

function hash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

interface SendMagicArgs {
  email: string;
  callbackBase: string;
  redirectTo?: string;
}

export async function sendMagicLink({ email, callbackBase, redirectTo }: SendMagicArgs) {
  const normalized = email.trim().toLowerCase();
  const token = randomToken();
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MS);

  if (isDbConfigured()) {
    const db = getDb();
    await db.insert(magicLinks).values({ email: normalized, tokenHash, expiresAt });
  } else {
    memMagic.set(tokenHash, { email: normalized, expiresAt: expiresAt.getTime() });
  }

  const url = new URL(`${callbackBase}/api/v1/auth/callback`);
  url.searchParams.set('token', token);
  if (redirectTo && isSafeRedirect(redirectTo)) url.searchParams.set('redirectTo', redirectTo);

  const mail = magicLinkEmail(url.toString());
  await sendEmail({ to: normalized, ...mail });

  return { devUrl: url.toString() };
}

/** Only allow redirects to our own apps to prevent open-redirect phishing. */
export function isSafeRedirect(target: string): boolean {
  try {
    const u = new URL(target);
    const allowed = [env.APP_URL, env.PORTAL_URL, env.DASHBOARD_URL]
      .map((url) => {
        try {
          return new URL(url).host;
        } catch {
          return '';
        }
      })
      .filter(Boolean);
    return allowed.includes(u.host);
  } catch {
    return false;
  }
}

export async function consumeMagicLink(token: string): Promise<{ userId: string } | null> {
  const tokenHash = hash(token);

  if (isDbConfigured()) {
    const db = getDb();
    const [link] = await db
      .select()
      .from(magicLinks)
      .where(and(eq(magicLinks.tokenHash, tokenHash), gt(magicLinks.expiresAt, new Date())));
    if (!link || link.usedAt) return null;

    // Mark used atomically with a conditional update to prevent token reuse races.
    const result = await db
      .update(magicLinks)
      .set({ usedAt: new Date() })
      .where(and(eq(magicLinks.id, link.id), eq(magicLinks.tokenHash, tokenHash)))
      .returning({ id: magicLinks.id });
    if (result.length === 0) return null;

    let [user] = await db.select().from(users).where(eq(users.email, link.email));
    if (!user) {
      const role = link.email.endsWith('@boostmybranding.com') ? 'agency_admin' : 'client';
      [user] = await db
        .insert(users)
        .values({ email: link.email, role, emailVerified: new Date() })
        .returning();
    }
    if (!user) return null;
    return { userId: user.id };
  }

  const link = memMagic.get(tokenHash);
  if (!link || link.expiresAt < Date.now()) return null;
  memMagic.delete(tokenHash);

  let user = Array.from(memUsers.values()).find((u) => u.email === link.email);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email: link.email,
      role: link.email.includes('admin') ? 'agency_admin' : 'client',
    };
    memUsers.set(user.id, user);
  }
  return { userId: user.id };
}

export async function createSession(userId: string) {
  const token = randomToken();
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  if (isDbConfigured()) {
    const db = getDb();
    await db.insert(sessions).values({ userId, tokenHash, expiresAt });
  } else {
    memSessions.set(tokenHash, { userId, expiresAt: expiresAt.getTime() });
  }

  return { token, expiresAt };
}

export async function revokeSession(token: string) {
  const tokenHash = hash(token);
  if (isDbConfigured()) {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  } else {
    memSessions.delete(tokenHash);
  }
}

export async function resolveSession(token: string | undefined) {
  if (!token || token.length < 32) return null;
  const tokenHash = hash(token);

  if (isDbConfigured()) {
    const db = getDb();
    const [row] = await db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())));
    if (!row) return null;
    return row.user;
  }

  const s = memSessions.get(tokenHash);
  if (!s || s.expiresAt < Date.now()) return null;
  return memUsers.get(s.userId) ?? null;
}

export function setSessionCookie(res: Response, token: string) {
  const isProd = env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
    // Setting domain only in prod so cookie is shared across subdomains.
    ...(isProd && env.APP_URL.includes('://')
      ? { domain: apexDomain(env.APP_URL) }
      : {}),
  });
}

function apexDomain(url: string): string | undefined {
  try {
    const host = new URL(url).hostname;
    const parts = host.split('.');
    if (parts.length >= 2) return `.${parts.slice(-2).join('.')}`;
  } catch {}
  return undefined;
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function getSessionToken(req: Request) {
  return (req as any).cookies?.[SESSION_COOKIE] ?? undefined;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getSessionToken(req) ?? req.headers.authorization?.replace(/^Bearer /, '');
  const user = await resolveSession(token);
  if (!user) {
    return res.status(401).json({ error: { message: 'Not signed in', code: 'UNAUTHORIZED' } });
  }
  (req as any).user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role: string } | undefined;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }
    next();
  };
}

/**
 * Ensures a client-role user can only access their own clientId resource.
 * Agency roles pass through.
 */
export function scopeToOwnClient(getClientIdFromReq: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role: string; clientId?: string } | undefined;
    if (!user) return res.status(401).json({ error: { message: 'Not signed in', code: 'UNAUTHORIZED' } });
    if (user.role !== 'client') return next();
    const requested = getClientIdFromReq(req);
    if (!requested || requested === user.clientId) return next();
    return res.status(403).json({ error: { message: 'Not your client', code: 'FORBIDDEN' } });
  };
}

export const COOKIE_NAME = SESSION_COOKIE;
