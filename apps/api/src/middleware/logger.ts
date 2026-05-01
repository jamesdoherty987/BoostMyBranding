/**
 * Minimal structured request logger. Never logs cookie values, Authorization
 * headers, or request bodies — only method, path, status, and timing.
 *
 * Also attaches an `X-Request-Id` to each request/response so log lines can
 * be correlated across services. If the caller supplies one (Render, Cloudflare,
 * etc.) we preserve it; otherwise we generate a short random id.
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const SLOW_MS = 1500;

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  const id =
    (req.headers['x-request-id'] as string | undefined) ??
    crypto.randomBytes(6).toString('hex');
  (req as any).id = id;
  res.setHeader('X-Request-Id', id);

  res.on('finish', () => {
    const ms = Date.now() - started;
    const tag = res.statusCode >= 500 ? '⚠️ ' : ms > SLOW_MS ? '🐢' : '→';
    // eslint-disable-next-line no-console
    console.log(
      `${tag} ${id} ${req.method} ${sanitizePath(req.originalUrl)} ${res.statusCode} ${ms}ms`,
    );
  });
  next();
}

/** Strip obvious secrets from logged paths (tokens in query strings, etc). */
function sanitizePath(path: string) {
  return path.replace(/([?&](token|secret|key)=)[^&]+/gi, '$1[redacted]');
}
