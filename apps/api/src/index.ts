/**
 * BoostMyBranding API — Express entry point.
 *
 * Production-hardened: strict CORS allowlist, same-origin guard on unsafe
 * methods, helmet with a tailored CSP, rate limits, and an error handler
 * that never leaks stack traces to clients.
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
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
import { canvaRouter } from './routes/canva.js';
import { domainsRouter } from './routes/domains.js';
import { inspirationRouter } from './routes/inspiration.js';
import { inspirationProfilesRouter } from './routes/inspirationProfiles.js';
import { tonePairsRouter } from './routes/tonePairs.js';
import { productsRouter } from './routes/products.js';
import { talkingHeadRouter } from './routes/talkingHead.js';
import { personalRouter } from './routes/personal.js';
import { startScheduler } from './services/scheduler.js';
import { localUploadDir } from './services/r2.js';

const app = express();
app.disable('x-powered-by');
/** JSON APIs should not participate in conditional GET / 304 — dashboards need fresh rows after mutations. */
app.set('etag', false);
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

/** Root — avoids a bare 404 when someone opens the API URL in a browser. */
app.get('/', (_req, res) => {
  res.json({
    data: {
      service: 'BoostMyBranding API',
      health: '/health',
      apiPrefix: '/api/v1',
      port: env.API_PORT,
      hint:
        env.NODE_ENV === 'production'
          ? 'Use the hosted dashboard URL from your deployment.'
          : 'Run the Next.js app separately (e.g. repo root `pnpm dev` or `pnpm --filter web dev`) — usually http://localhost:3000',
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
app.use('/api/v1/canva', canvaRouter);
app.use('/api/v1/domains', domainsRouter);
app.use('/api/v1/inspiration', inspirationRouter);
// Nested brand-intel routes scoped per client.
app.use('/api/v1/clients/:clientId/inspiration-profiles', inspirationProfilesRouter);
app.use('/api/v1/clients/:clientId/tone-pairs', tonePairsRouter);
app.use('/api/v1/clients/:clientId/products', productsRouter);
app.use('/api/v1/talking-head', talkingHeadRouter);
app.use('/api/v1/personal', personalRouter);

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

  // Multer — size limits, wrong field names, etc.
  if (err instanceof multer.MulterError) {
    console.warn('[api] upload:', err.code, err.message);
    return res.status(400).json({
      error: {
        message: err.message || 'Upload rejected',
        code: err.code,
      },
    });
  }

  // fileFilter rejects with a plain Error (mime type, wrong audio type, …)
  const msg = String(err.message ?? '');
  if (
    msg.startsWith('Unsupported mime:') ||
    msg.includes('uploads are allowed') ||
    msg.startsWith('Supported:') ||
    msg.startsWith('Audio must be')
  ) {
    return res.status(400).json({
      error: { message: msg, code: 'BAD_UPLOAD' },
    });
  }

  console.error('[api] error:', err);

  // Postgres driver errors surface a `.code` — give operators an
  // actionable message when the cause is a missing column/table
  // (almost always "you forgot to run migrations") or a bad enum value.
  const pgCode = (anyErr?.code ?? '').toString();
  if (pgCode === '42703' || pgCode === '42P01') {
    // 42703 = undefined_column, 42P01 = undefined_table.
    return res.status(500).json({
      error: {
        message:
          env.NODE_ENV === 'production'
            ? 'Database schema is out of date.'
            : `Schema drift: ${err.message}. Run \`pnpm --filter @boost/database migrate\` to apply pending migrations.`,
        code: 'SCHEMA_DRIFT',
      },
    });
  }
  if (pgCode === '22P02' || pgCode === '23514') {
    // 22P02 = invalid_text_representation (bad enum/uuid), 23514 = check_violation.
    return res.status(400).json({
      error: { message: err.message, code: 'BAD_INPUT' },
    });
  }

  const safeMessage =
    env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : err.message;
  res.status(500).json({ error: { message: safeMessage, code: 'INTERNAL' } });
});

const server = app.listen(env.API_PORT, () => {
  console.log(`🚀 BoostMyBranding API → http://localhost:${env.API_PORT}`);
  if (env.NODE_ENV !== 'production') {
    console.log(
      `   Next.js UI → http://localhost:3000 (not started by this process). From repo root run: pnpm dev  or  pnpm dev:stack`,
    );
  }
  startScheduler();
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n❌ Port ${env.API_PORT} is already in use — another API process is still running (often from repo-root \`pnpm dev\` / \`pnpm dev:stack\`).`,
    );
    console.error(
      `   Stop that terminal with Ctrl+C, or set API_PORT in .env to a free port. Your browser can still work if you only need the existing server.`,
    );
    console.error(
      `   Avoid running two APIs on the same DB: in-flight personal posts can fail on the next clean boot with a "restarted during sourcing" message.\n`,
    );
  } else {
    console.error('[api] listen error:', err);
  }
  process.exit(1);
});

// Dev-safety net: keep the server up when a background task (cron, fire-
// and-forget, SSE heartbeat) rejects without a handler. In prod these
// still get logged via the real error monitor; locally they used to kill
// the process and force a turbo restart.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// Graceful shutdown so in-flight requests finish cleanly.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`\n${sig} received, shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
