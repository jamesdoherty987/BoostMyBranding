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

// Render and most PaaS hosts inject $PORT. Map it to API_PORT if not already set
// so the schema picks it up transparently.
if (!process.env.API_PORT && process.env.PORT) {
  process.env.API_PORT = process.env.PORT;
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),

  APP_URL: z.string().url().default('http://localhost:3000'),
  PORTAL_URL: z.string().url().default('http://localhost:3000/portal'),
  DASHBOARD_URL: z.string().url().default('http://localhost:3000/dashboard'),

  AUTH_SECRET: z.string().min(16).default('dev-secret-change-me-0000000000000000'),

  DATABASE_URL: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional().or(z.literal('')),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_SOCIAL: z.string().optional(),
  STRIPE_PRICE_WEBSITE: z.string().optional(),
  STRIPE_PRICE_FULL: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().default('contact@boostmybranding.com'),

  CONTENTSTUDIO_API_KEY: z.string().optional(),
  CONTENTSTUDIO_WORKSPACE_ID: z.string().optional(),

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
  CANVA_REDIRECT_URI: z.string().url().optional(),

  CRON_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Extra prod-safety checks: refuse to start if we'd silently run with insecure defaults.
if (env.NODE_ENV === 'production') {
  const errors: string[] = [];
  if (env.AUTH_SECRET.startsWith('dev-secret-change-me'))
    errors.push('AUTH_SECRET must be a real 32+ char random string in production.');
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required in production.');
  if (!env.STRIPE_SECRET_KEY) errors.push('STRIPE_SECRET_KEY is required in production.');
  if (!env.STRIPE_WEBHOOK_SECRET)
    errors.push('STRIPE_WEBHOOK_SECRET is required in production (signing secret).');
  if (errors.length > 0) {
    console.error('❌ Production environment is misconfigured:');
    for (const e of errors) console.error(`   - ${e}`);
    process.exit(1);
  }
}

export const features = {
  db: Boolean(env.DATABASE_URL),
  claude: Boolean(env.ANTHROPIC_API_KEY),
  fal: Boolean(env.FAL_KEY),
  r2: Boolean(env.R2_ACCESS_KEY_ID && env.R2_BUCKET_NAME),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  resend: Boolean(env.RESEND_API_KEY),
  contentStudio: Boolean(env.CONTENTSTUDIO_API_KEY),
  vercel: Boolean(env.VERCEL_API_TOKEN && env.VERCEL_PROJECT_ID),
  /** Canva Connect API is only useful when all three OAuth bits are set. */
  canva: Boolean(env.CANVA_CLIENT_ID && env.CANVA_CLIENT_SECRET && env.CANVA_REDIRECT_URI),
};

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
