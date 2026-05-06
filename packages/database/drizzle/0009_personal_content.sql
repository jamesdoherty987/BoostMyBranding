-- ═══════════════════════════════════════════════════════════════════
-- Personal content automation
--   1. personal_accounts      — one row per personal social account
--   2. personal_posts         — generated video/post pipeline rows
--   3. personal_scraped_assets — cache for Pexels/Unsplash/Wikipedia/etc
-- ═══════════════════════════════════════════════════════════════════

-- ── Enums ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "personal_account_status" AS ENUM (
    'active', 'paused', 'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "personal_post_status" AS ENUM (
    'queued',
    'scripting',
    'sourcing_media',
    'rendering',
    'ready',
    'scheduled',
    'published',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── personal_accounts ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "personal_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "account_name" text NOT NULL,
  "platform" "platform" NOT NULL,
  "handle" text,
  "contentstudio_workspace_id" text,
  "theme_id" text NOT NULL,
  "custom_direction" text,
  "topic_seeds" text[] DEFAULT ARRAY[]::text[],
  "topic_blacklist" text[] DEFAULT ARRAY[]::text[],
  "language" text DEFAULT 'en' NOT NULL,
  "voice_id" text,
  "locale" text,
  "posts_per_day" integer DEFAULT 1 NOT NULL,
  "posting_hour_utc" integer DEFAULT 8 NOT NULL,
  "posting_minute_utc" integer DEFAULT 0 NOT NULL,
  "post_spacing_minutes" integer DEFAULT 240 NOT NULL,
  "auto_approve" boolean DEFAULT true NOT NULL,
  "auto_schedule" boolean DEFAULT true NOT NULL,
  "accent_color" text DEFAULT '#FFEC3D',
  "logo_url" text,
  "watermark_handle" text,
  "status" "personal_account_status" DEFAULT 'active' NOT NULL,
  "last_generated_at" timestamp,
  "next_run_at" timestamp,
  "total_posts" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "personal_accounts_user_idx"
  ON "personal_accounts" ("user_id");
CREATE INDEX IF NOT EXISTS "personal_accounts_status_idx"
  ON "personal_accounts" ("status");
CREATE INDEX IF NOT EXISTS "personal_accounts_next_run_idx"
  ON "personal_accounts" ("next_run_at");

-- ── personal_posts ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "personal_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "personal_accounts"("id") ON DELETE CASCADE,
  "template_id" text NOT NULL,
  "topic" text NOT NULL,
  "script" jsonb NOT NULL,
  "voiceover_url" text,
  "music_url" text,
  "music_attribution" text,
  "media_assets" jsonb,
  "video_url" text,
  "caption" text,
  "hashtags" text[] DEFAULT ARRAY[]::text[],
  "duration_seconds" integer,
  "quality_score" integer,
  "contentstudio_post_id" text,
  "scheduled_at" timestamp,
  "published_at" timestamp,
  "publish_url" text,
  "status" "personal_post_status" DEFAULT 'queued' NOT NULL,
  "error_message" text,
  "cost_cents" integer DEFAULT 0,
  "engagement" jsonb,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "personal_posts_account_idx"
  ON "personal_posts" ("account_id");
CREATE INDEX IF NOT EXISTS "personal_posts_status_idx"
  ON "personal_posts" ("status");
CREATE INDEX IF NOT EXISTS "personal_posts_scheduled_idx"
  ON "personal_posts" ("scheduled_at");

-- ── personal_scraped_assets ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "personal_scraped_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "query_key" text NOT NULL,
  "asset_type" text NOT NULL,
  "items" jsonb NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "personal_scraped_lookup_idx"
  ON "personal_scraped_assets" ("source", "query_key", "asset_type");
