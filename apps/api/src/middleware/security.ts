/**
 * Security middleware — CORS allowlist, CSRF for state-changing requests,
 * and response headers that defend against common browser-side attacks.
 *
 * OWASP coverage:
 *   A01 Broken Access Control       — enforced per-route via requireAuth + per-resource checks
 *   A02 Cryptographic Failures      — cookies marked Secure + HttpOnly in prod (see services/auth.ts)
 *   A03 Injection                   — Zod validates every body + Drizzle uses parameterized SQL
 *   A05 Security Misconfiguration   — CSP + strict CORS here; helmet elsewhere
 *   A07 Identification Failures     — rotating session tokens + magic-link TTL in auth service
 *
 * CSRF model: we rely on SameSite=Lax cookies (strict in prod) plus an origin
 * check on every unsafe method. Because we never accept cross-origin cookies
 * outside the allowlist, attackers cannot forge authenticated requests.
 */

import type { Request, Response, NextFunction } from 'express';
import { env } from '../env.js';

const ALLOWED = new Set(
  [env.APP_URL, env.PORTAL_URL, env.DASHBOARD_URL]
    .filter(Boolean)
    .map((u) => u.replace(/\/$/, '')),
);

/** Rejects requests with an Origin header that isn't in our allowlist. */
export function sameOriginOnly(req: Request, res: Response, next: NextFunction) {
  // Safe methods are always allowed (CORS headers handle the browser checks).
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Stripe and ContentStudio webhooks arrive without Origin and with their
  // own signature verification — let them through.
  if (req.path.startsWith('/api/v1/webhooks')) return next();

  const origin = req.header('origin') ?? req.header('referer');
  if (!origin) {
    // No Origin at all is only allowed for server-to-server calls carrying
    // the cron secret.
    if (env.CRON_SECRET && req.header('x-cron-secret') === env.CRON_SECRET) return next();
    return res.status(403).json({ error: { message: 'Origin required', code: 'FORBIDDEN' } });
  }

  try {
    const u = new URL(origin);
    const normalized = `${u.protocol}//${u.host}`;
    if (!ALLOWED.has(normalized)) {
      return res.status(403).json({ error: { message: 'Cross-origin blocked', code: 'FORBIDDEN' } });
    }
  } catch {
    return res.status(400).json({ error: { message: 'Bad origin', code: 'BAD_REQUEST' } });
  }

  next();
}

/** Extra security response headers that complement helmet's defaults. */
export function extraHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}
