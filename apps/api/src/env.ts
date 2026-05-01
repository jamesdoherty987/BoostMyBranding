/**
 * Centralized, typed env config. Loads `.env` from the repo root and validates
 * required vars at boot. Optional integrations are marked so the app can run
 * with a subset of features when keys are missing.
 */

import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),

  APP_URL: z.string().url().default('http://localhost:3000'),
  PORTAL_URL: z.string().url().default('http://localhost:3001'),
  DASHBOARD_URL: z.string().url().default('http://localhost:3002'),

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
  FROM_EMAIL: z.string().default('hello@boostmybranding.com'),

  CONTENTSTUDIO_API_KEY: z.string().optional(),
  CONTENTSTUDIO_WORKSPACE_ID: z.string().optional(),

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
};
