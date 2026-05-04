/**
 * BoostMyBranding API — Express entry point.
 *
 * Production-hardened: strict CORS allowlist, same-origin guard on unsafe
 * methods, helmet with a tailored CSP, rate limits, and an error handler
 * that never leaks stack traces to clients.
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';

import { env } from './env.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/logger.js';
import { sameOriginOnly, extraHeaders } from './middleware/security.js';

import { authRouter } from './routes/auth.js';
import { clientsRouter } from './routes/clients.js';
import { postsRouter } from './routes/posts.js';
import { imagesRouter } from './routes/images.js';
import { messagesRouter } from './routes/messages.js';
import { automationRouter } from './routes/automation.js';
import { billingRouter } from './routes/billing.js';
import { webhooksRouter } from './routes/webhooks.js';
import { realtimeRouter } from './routes/realtime.js';
import { systemRouter } from './routes/system.js';
import { leadsRouter } from './routes/leads.js';
import { videosRouter } from './routes/videos.js';
import { domainsRouter } from './routes/domains.js';
import { startScheduler } from './services/scheduler.js';
import { localUploadDir } from './services/r2.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // We are always behind a proxy in prod (Render/Vercel).

// Helmet with a CSP that allows our own assets + Stripe.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.NODE_ENV === 'production' ? {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'connect-src': ["'self'", 'https://api.stripe.com'],
        'script-src': ["'self'", 'https://js.stripe.com'],
        'frame-src': ["'self'", 'https://checkout.stripe.com', 'https://js.stripe.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    } : false,
  }),
);
app.use(extraHeaders);
app.use(requestLogger);

app.use(
  cors({
    origin: (origin, cb) => {
      // Normalize env URLs to origin-only (protocol://host) since the
      // browser Origin header never includes a path.
      const allowed = [env.APP_URL, env.PORTAL_URL, env.DASHBOARD_URL].map(
        (u) => {
          try {
            const p = new URL(u);
            return `${p.protocol}//${p.host}`;
          } catch {
            return u;
          }
        },
      );
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cron-Secret'],
    maxAge: 86400,
  }),
);
app.use(cookieParser());

// Webhooks mounted BEFORE json — Stripe needs the raw body for signature verify.
app.use('/api/v1/webhooks', webhooksRouter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(generalLimiter);
app.use(sameOriginOnly);

// Static serve for local uploads (dev fallback when R2 not configured)
app.use('/uploads', express.static(localUploadDir(), {
  fallthrough: true,
  dotfiles: 'deny',
  index: false,
}));

app.get('/health', (_req, res) => {
  res.json({
    data: {
      ok: true,
      uptime: process.uptime(),
      ts: Date.now(),
      env: env.NODE_ENV,
    },
  });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/clients', clientsRouter);
app.use('/api/v1/posts', postsRouter);
app.use('/api/v1/images', imagesRouter);
app.use('/api/v1/messages', messagesRouter);
app.use('/api/v1/automation', automationRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/realtime', realtimeRouter);
app.use('/api/v1/system', systemRouter);
app.use('/api/v1/leads', leadsRouter);
app.use('/api/v1/videos', videosRouter);
app.use('/api/v1/domains', domainsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Route not found', code: 'NOT_FOUND' } });
});

// Central error handler. Only the error message is ever returned to the
// client; stack traces live in server logs only.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const anyErr = err as any;
  if (anyErr?.issues) {
    return res
      .status(400)
      .json({ error: { message: 'Validation failed', code: 'VALIDATION', details: anyErr.issues } });
  }
  console.error('[api] error:', err);
  const safeMessage =
    env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : err.message;
  res.status(500).json({ error: { message: safeMessage, code: 'INTERNAL' } });
});

const server = app.listen(env.API_PORT, () => {
  console.log(`🚀 BoostMyBranding API → http://localhost:${env.API_PORT}`);
  startScheduler();
});

// Graceful shutdown so in-flight requests finish cleanly.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`\n${sig} received, shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
