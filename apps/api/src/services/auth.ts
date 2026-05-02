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
import { eq, gt, and, isNull } from 'drizzle-orm';
import { getDb, isDbConfigured, users, magicLinks, sessions, clients } from '@boost/database';
import { slugify } from '@boost/core';
import type { SubscriptionTier } from '@boost/core';
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

    // Atomic claim: update only if the row is unused AND unexpired, returning
    // the row in a single statement. This closes the TOCTOU window between
    // "check if used" and "mark used" that would otherwise allow a token to
    // be consumed twice by concurrent requests.
    const [claimed] = await db
      .update(magicLinks)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(magicLinks.tokenHash, tokenHash),
          isNull(magicLinks.usedAt),
          gt(magicLinks.expiresAt, new Date()),
        ),
      )
      .returning({ email: magicLinks.email });
    if (!claimed) return null;

    let [user] = await db.select().from(users).where(eq(users.email, claimed.email));
    if (!user) {
      const role = claimed.email.endsWith('@boostmybranding.com') ? 'agency_admin' : 'client';
      // If a client record already exists for this email (e.g. they signed
      // up via /auth/signup which created the client but the user hadn't
      // clicked the magic link yet), link the new user to it. Without this,
      // a client-role user lands in the portal with no clientId and every
      // `/clients/me` call 404s.
      let linkedClientId: string | undefined;
      if (role === 'client') {
        const [existingClient] = await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.email, claimed.email))
          .limit(1);
        linkedClientId = existingClient?.id;
      }
      [user] = await db
        .insert(users)
        .values({
          email: claimed.email,
          role,
          emailVerified: new Date(),
          clientId: linkedClientId,
        })
        .returning();
    } else if (user.role === 'client' && !user.clientId) {
      // Existing user but never linked to a client — backfill if possible.
      const [existingClient] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.email, claimed.email))
        .limit(1);
      if (existingClient) {
        await db
          .update(users)
          .set({ clientId: existingClient.id })
          .where(eq(users.id, user.id));
        user = { ...user, clientId: existingClient.id };
      }
    }
    if (!user) return null;
    return { userId: user.id };
  }

  const link = memMagic.get(tokenHash);
  if (!link || link.expiresAt < Date.now()) return null;
  // Dev mem store: delete immediately so reuse returns null.
  memMagic.delete(tokenHash);

  let user = Array.from(memUsers.values()).find((u) => u.email === link.email);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email: link.email,
      role: link.email.includes('admin') ? 'agency_admin' : 'client',
      // Dev fallback: without a DB, attach every new client-role user to
      // the first mock client so the portal has something to render.
      clientId: link.email.includes('admin') ? undefined : 'c_murphy',
    };
    memUsers.set(user.id, user);
  } else if (user.role === 'client' && !user.clientId) {
    user.clientId = 'c_murphy';
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

/* ------------------------------------------------------------------ */
/* Self-serve signup (no payment yet)                                 */
/* ------------------------------------------------------------------ */

interface SignupArgs {
  email: string;
  businessName: string;
  contactName: string;
  industry?: string;
  websiteUrl?: string;
  tier: SubscriptionTier;
  callbackBase: string;
  redirectTo?: string;
}

/**
 * Create (or reuse) a client record and its matching client-role user for a
 * self-serve signup — then mail a magic link. Payment happens later inside
 * the portal once the user is signed in.
 *
 * Idempotent: if the email already has a user or client, reuse them. That way
 * hitting submit twice never creates duplicate records.
 */
export async function signupAndSendMagicLink(args: SignupArgs) {
  const email = args.email.trim().toLowerCase();

  if (isDbConfigured()) {
    const db = getDb();

    // 1. Find or create the client record (business).
    let [client] = await db.select().from(clients).where(eq(clients.email, email));
    if (!client) {
      const baseSlug = slugify(args.businessName) || 'site';
      let slug = baseSlug;
      for (let i = 2; i < 50; i++) {
        const [existing] = await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.slug, slug))
          .limit(1);
        if (!existing) break;
        slug = `${baseSlug}-${i}`;
      }
      [client] = await db
        .insert(clients)
        .values({
          businessName: args.businessName,
          contactName: args.contactName,
          email,
          slug,
          industry: args.industry,
          websiteUrl: args.websiteUrl || null,
          subscriptionTier: args.tier,
          subscriptionStatus: 'none',
          isActive: true,
        })
        .returning();
    }

    // 2. Find or create the user, linked to that client.
    let [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email,
          name: args.contactName,
          role: 'client',
          clientId: client?.id,
        })
        .returning();
    } else if (user.role === 'client' && !user.clientId && client) {
      await db.update(users).set({ clientId: client.id }).where(eq(users.id, user.id));
    }
  } else {
    // Dev / mock path: stash the user in memory so the magic-link callback
    // can claim it.
    let user = Array.from(memUsers.values()).find((u) => u.email === email);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email,
        name: args.contactName,
        role: 'client',
      };
      memUsers.set(user.id, user);
    }
  }

  return sendMagicLink({ email, callbackBase: args.callbackBase, redirectTo: args.redirectTo });
}
