/**
 * Centralized, typed env config. Loads `.env` from the repo root and validates
 * required vars at boot. Optional integrations are marked so the app can run
 * with a subset of features when keys are missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

loadRepoRootEnv();

/** Dotenv-style `KEY=` is an empty string — treat like unset so `.default()` and `.optional()` behave. */
function blankToUndefined(val: unknown): unknown {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'string' && !val.trim()) return undefined;
  return val;
}

function preprocessBlank<S extends z.ZodTypeAny>(schema: S) {
  return z.preprocess(blankToUndefined, schema);
}

/** Escape hatch: boot in NODE_ENV=production without DATABASE_URL / real AUTH_SECRET (sandboxes only). */
function allowIncompleteProductionBoot(): boolean {
  const v = String(process.env.ALLOW_INCOMPLETE_PRODUCTION ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(v);
}

// Render and most PaaS hosts inject $PORT. Map it to API_PORT if not already set
// so the schema picks it up transparently.
if (!process.env.API_PORT && process.env.PORT) {
  process.env.API_PORT = process.env.PORT;
}

// Railway (and similar) inject the public hostname without scheme — use it for
// `/uploads/…` and other absolute API URLs when `API_PUBLIC_URL` wasn't set manually.
if (
  !String(process.env.API_PUBLIC_URL ?? '').trim() &&
  String(process.env.RAILWAY_PUBLIC_DOMAIN ?? '').trim()
) {
  process.env.API_PUBLIC_URL = `https://${String(process.env.RAILWAY_PUBLIC_DOMAIN).trim()}`;
}

const schema = z.object({
  NODE_ENV: preprocessBlank(z.enum(['development', 'production', 'test']).default('development')),
  API_PORT: preprocessBlank(z.coerce.number().int().min(1).max(65535).default(4000)),
  /**
   * Public origin of this API (e.g. https://api.example.com). Used for `/uploads/…`
   * when R2 is off so URLs hit the server that serves `express.static('/uploads')`.
   * In production, prefer this over APP_URL when the web app is on a different host.
   */
  API_PUBLIC_URL: z.string().url().optional().or(z.literal('')),

  APP_URL: preprocessBlank(z.string().url().default('http://localhost:3000')),
  PORTAL_URL: preprocessBlank(z.string().url().default('http://localhost:3000/portal')),
  DASHBOARD_URL: preprocessBlank(z.string().url().default('http://localhost:3000/dashboard')),

  AUTH_SECRET: preprocessBlank(
    z.string().min(16).default('dev-secret-change-me-0000000000000000'),
  ),

  DATABASE_URL: preprocessBlank(z.string().optional()),

  ANTHROPIC_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),
  /**
   * Max concurrent fal.ai `subscribe` jobs for this process (1–10). Default 8.
   * fal often caps ~10; personal director + cron + inspiration can overlap.
   */
  FAL_MAX_CONCURRENT: preprocessBlank(z.coerce.number().int().min(1).max(10).optional()),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional().or(z.literal('')),
  /**
   * Force-disable R2. Accepts `true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off` (case-insensitive).
   * Blank or unset uses R2 when all R2_* credentials + R2_PUBLIC_URL are set.
   */
  R2_DISABLED: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    const s = String(val).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return 'true';
    if (['false', '0', 'no', 'off'].includes(s)) return 'false';
    return undefined;
  }, z.enum(['true', 'false']).optional()),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_SOCIAL: z.string().optional(),
  STRIPE_PRICE_WEBSITE: z.string().optional(),
  STRIPE_PRICE_FULL: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: preprocessBlank(z.string().default('contact@boostmybranding.com')),

  CONTENTSTUDIO_API_KEY: z.string().optional(),
  CONTENTSTUDIO_WORKSPACE_ID: z.string().optional(),
  /** Optional dashboard URL shown in Personal → Posting (OAuth happens in Content Studio, not this app). */
  CONTENTSTUDIO_APP_URL: z.string().url().optional().or(z.literal('')),

  /**
   * Claude model for the **personal channel title** JSON step only (short prompt).
   * Default in code is `haiku` when unset — smaller model, usually better at
   * sticking to example-title format than Sonnet/Opus on the main script pass.
   */
  PERSONAL_TITLE_MODEL: preprocessBlank(z.enum(['haiku', 'sonnet', 'opus']).optional()),
  /**
   * Sampling temperature for the personal channel title JSON call (0–1).
   * Default in code is ~0.78 — low values (e.g. 0.2–0.35) repeat the same headline
   * for the same topic; raise toward 1 for more variation.
   */
  PERSONAL_TITLE_TEMPERATURE: preprocessBlank(z.coerce.number().min(0).max(1).optional()),
  /**
   * Claude model for **topic invention** in the isolated title test script only
   * (when you run `pnpm test:isolated-channel-title` with no CLI topic).
   * Default in script is `sonnet` when unset — broader ideas than Haiku.
   */
  PERSONAL_TOPIC_INVENT_MODEL: preprocessBlank(z.enum(['haiku', 'sonnet', 'opus']).optional()),

  /**
   * Hard cap for a single personal director **AI image** shot (fal / Gemini).
   * Prevents `sourcing_media` from hanging forever when upstream never resolves.
   * Default in code is 4 minutes when unset.
   */
  PERSONAL_AI_IMAGE_TIMEOUT_MS: preprocessBlank(
    z.coerce.number().int().min(30_000).max(900_000).optional(),
  ),
  /**
   * Hard cap for a single personal director **AI video** clip (fal).
   * Default in code is 10 minutes when unset.
   */
  PERSONAL_AI_VIDEO_TIMEOUT_MS: preprocessBlank(
    z.coerce.number().int().min(60_000).max(1_800_000).optional(),
  ),
  /**
   * Hard cap for a single R2 `uploadFile` (e.g. after Gemini / fal image gen).
   * Prevents sourcing from hanging indefinitely on a stuck S3-compatible PUT.
   * Default in code is 2 minutes when unset.
   */
  PERSONAL_R2_UPLOAD_TIMEOUT_MS: preprocessBlank(
    z.coerce.number().int().min(10_000).max(900_000).optional(),
  ),

  /**
   * Vercel API credentials for programmatic custom-domain management.
   * When present, the API can add/remove/verify domains on the web project
   * without the agency touching the Vercel dashboard.
   */
  VERCEL_API_TOKEN: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),
  /** Optional team id — required if the project lives in a team, not a personal account. */
  VERCEL_TEAM_ID: z.string().optional(),

  /**
   * Canva Connect OAuth credentials. When present, the dashboard exposes
   * a per-client "Connect Canva" button that kicks off the OAuth dance
   * and stores tokens in `client_canva_connections`. Optional —
   * everything downstream checks `features.canva` before calling the API.
   */
  CANVA_CLIENT_ID: z.string().optional(),
  CANVA_CLIENT_SECRET: z.string().optional(),
  /** Where Canva sends users after authorising. Usually {API_URL}/api/v1/canva/callback. */
  CANVA_REDIRECT_URI: z.string().url().optional().or(z.literal('')),

  /** Optional — Runway / Replicate keys for personal director models that use those providers. */
  RUNWAY_API_KEY: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),

  CRON_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment', parsed.error.flatten().fieldErrors);
  console.error(
    '   (Fix env var shapes/URLs above — the API exits before listening on PORT, so platform healthchecks will fail.)',
  );
  process.exit(1);
}

export const env = parsed.data;

function r2EnvLooksComplete(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID?.trim() &&
      env.R2_ACCESS_KEY_ID?.trim() &&
      env.R2_SECRET_ACCESS_KEY?.trim() &&
      env.R2_BUCKET_NAME?.trim() &&
      env.R2_PUBLIC_URL?.trim(),
  );
}

// Extra prod-safety checks: refuse to start if we'd silently run with insecure defaults.
if (env.NODE_ENV === 'production') {
  const errors: string[] = [];
  if (env.AUTH_SECRET.startsWith('dev-secret-change-me'))
    errors.push('AUTH_SECRET must be a real 32+ char random string in production.');
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required in production.');
  const r2CredIntent = Boolean(
    env.R2_ACCOUNT_ID?.trim() ||
      env.R2_ACCESS_KEY_ID?.trim() ||
      env.R2_SECRET_ACCESS_KEY?.trim() ||
      env.R2_BUCKET_NAME?.trim() ||
      env.R2_PUBLIC_URL?.trim(),
  );
  if (r2CredIntent && env.R2_DISABLED !== 'true' && !r2EnvLooksComplete()) {
    errors.push(
      'R2 is partially configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL (public https base for object URLs).',
    );
  }
  if (errors.length > 0) {
    if (allowIncompleteProductionBoot()) {
      console.warn(
        '⚠️  ALLOW_INCOMPLETE_PRODUCTION is enabled — API starts with an incomplete configuration (not for public-facing production):',
      );
      for (const e of errors) console.warn(`   - ${e}`);
    } else {
      console.error('❌ Production environment is misconfigured:');
      for (const e of errors) console.error(`   - ${e}`);
      console.error(
        '   (Process exits before listening on PORT — e.g. Railway /health will show service unavailable until these are set. See docs/deployment-railway-vercel.md §2.)',
      );
      console.error(
        '   Sandboxes only: set ALLOW_INCOMPLETE_PRODUCTION=true to boot without DATABASE_URL / a real AUTH_SECRET (unsafe for real users).',
      );
      process.exit(1);
    }
  }
}

// Misleading partial R2 config: uploads would fall back to local /uploads URLs and
// long stitch jobs would fail when the API tries to fetch VO/music by HTTP.
const r2Partial =
  env.R2_DISABLED !== 'true' &&
  Boolean(
    env.R2_ACCOUNT_ID?.trim() ||
      env.R2_ACCESS_KEY_ID?.trim() ||
      env.R2_SECRET_ACCESS_KEY?.trim() ||
      env.R2_BUCKET_NAME?.trim() ||
      env.R2_PUBLIC_URL?.trim(),
  ) &&
  !r2EnvLooksComplete();
if (r2Partial) {
  const missing: string[] = [];
  if (!env.R2_ACCOUNT_ID?.trim()) missing.push('R2_ACCOUNT_ID');
  if (!env.R2_ACCESS_KEY_ID?.trim()) missing.push('R2_ACCESS_KEY_ID');
  if (!env.R2_SECRET_ACCESS_KEY?.trim()) missing.push('R2_SECRET_ACCESS_KEY');
  if (!env.R2_BUCKET_NAME?.trim()) missing.push('R2_BUCKET_NAME');
  if (!env.R2_PUBLIC_URL?.trim()) missing.push('R2_PUBLIC_URL');
  console.warn(
    `[env] R2 is disabled (using local disk uploads) — incomplete config. Missing or empty: ${missing.join(', ')}. ` +
      `The personal video stitcher downloads voice/music via HTTP; set all R2_* vars including a public https base for R2_PUBLIC_URL.`,
  );
}

export const features = {
  db: Boolean(env.DATABASE_URL),
  claude: Boolean(env.ANTHROPIC_API_KEY),
  fal: Boolean(env.FAL_KEY?.trim()),
  /** R2 only when every required field is set and not force-disabled (VO/music/stitcher fetch URLs). */
  r2: r2EnvLooksComplete() && env.R2_DISABLED !== 'true',
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  resend: Boolean(env.RESEND_API_KEY),
  contentStudio: Boolean(env.CONTENTSTUDIO_API_KEY),
  /** True when server .env has a default workspace (id never exposed via API). */
  contentStudioDefaultWorkspace: Boolean(env.CONTENTSTUDIO_WORKSPACE_ID?.trim()),
  /** Public Content Studio web app (for “connect social” links in the dashboard). */
  contentStudioAppUrl: env.CONTENTSTUDIO_APP_URL?.trim() || null,
  vercel: Boolean(env.VERCEL_API_TOKEN && env.VERCEL_PROJECT_ID),
  /** Canva Connect API is only useful when all three OAuth bits are set (non-blank). */
  canva: Boolean(
    env.CANVA_CLIENT_ID?.trim() &&
      env.CANVA_CLIENT_SECRET?.trim() &&
      env.CANVA_REDIRECT_URI?.trim(),
  ),
};

if (env.NODE_ENV === 'production' && !features.stripe) {
  console.warn(
    '[env] Stripe is not configured — checkout, billing portal, and POST /api/v1/webhooks/stripe are disabled.',
  );
}

/**
 * Zero-dep .env loader that walks up from this file looking for a monorepo
 * root (identified by having a pnpm-workspace.yaml or turbo.json) and merges
 * the first .env (or .env.example fallback) it finds there.
 *
 * On Render/production there's no .env at all — everything comes from the
 * real process env, so this is a no-op. Locally it finds the repo root no
 * matter whether we're running from src/ (tsx) or dist/ (node build).
 */
function loadRepoRootEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = findRepoRoot(here);
  if (!root) return;
  for (const name of ['.env', '.env.example']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      if (!key || key in process.env) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    break; // real .env wins over .env.example
  }
}

function findRepoRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(dir, 'turbo.json'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
