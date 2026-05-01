/**
 * Minimal structured request logger. Never logs cookie values, Authorization
 * headers, or request bodies — only method, path, status, and timing.
 */

import type { Request, Response, NextFunction } from 'express';

const SLOW_MS = 1500;

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - started;
    const tag = res.statusCode >= 500 ? '⚠️ ' : ms > SLOW_MS ? '🐢' : '→';
    // eslint-disable-next-line no-console
    console.log(
      `${tag} ${req.method} ${sanitizePath(req.originalUrl)} ${res.statusCode} ${ms}ms`,
    );
  });
  next();
}

/** Strip obvious secrets from logged paths (tokens in query strings, etc). */
function sanitizePath(path: string) {
  return path.replace(/([?&](token|secret|key)=)[^&]+/gi, '$1[redacted]');
}
