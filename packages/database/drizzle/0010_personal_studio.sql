-- ═══════════════════════════════════════════════════════════════════
-- Personal content studio — media library, characters, style bible.
--
--   1. New enums: personal_media_role, personal_character_status
--   2. personal_characters
--   3. personal_account_media
--   4. Extra columns on personal_accounts: style_bible, generator_config,
--      character_id
-- ═══════════════════════════════════════════════════════════════════

-- ── Enums ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "personal_media_role" AS ENUM (
    'style_reference',
    'avatar_reference',
    'brand_asset',
    'broll',
    'voice_sample',
    'music',
    'inspiration',
    'location',
    'product'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "personal_character_status" AS ENUM (
    'draft', 'analyzing', 'ready', 'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── personal_characters ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "personal_characters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "tagline" text,
  "backstory" text,
  "character_sheet" jsonb,
  "prompt_fragment" text,
  "negative_prompt" text,
  "voice_id" text,
  "locale" text,
  "status" "personal_character_status" DEFAULT 'draft' NOT NULL,
  "error" text,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "personal_characters_user_idx"
  ON "personal_characters" ("user_id");

-- ── personal_account_media ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "personal_account_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "personal_accounts"("id") ON DELETE CASCADE,
  "file_url" text NOT NULL,
  "file_name" text,
  "mime_type" text,
  "kind" text NOT NULL,
  "role" "personal_media_role" DEFAULT 'inspiration' NOT NULL,
  "description" text,
  "tags" text[] DEFAULT ARRAY[]::text[],
  "ai_description" text,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "character_id" uuid,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "personal_account_media_account_idx"
  ON "personal_account_media" ("account_id");
CREATE INDEX IF NOT EXISTS "personal_account_media_role_idx"
  ON "personal_account_media" ("role");
CREATE INDEX IF NOT EXISTS "personal_account_media_character_idx"
  ON "personal_account_media" ("character_id");

DO $$ BEGIN
  ALTER TABLE "personal_account_media"
    ADD CONSTRAINT "personal_account_media_character_id_fk"
    FOREIGN KEY ("character_id") REFERENCES "personal_characters"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── personal_accounts: style bible + generator config + character ─

ALTER TABLE "personal_accounts"
  ADD COLUMN IF NOT EXISTS "style_bible" jsonb,
  ADD COLUMN IF NOT EXISTS "generator_config" jsonb,
  ADD COLUMN IF NOT EXISTS "character_id" uuid;

DO $$ BEGIN
  ALTER TABLE "personal_accounts"
    ADD CONSTRAINT "personal_accounts_character_id_fk"
    FOREIGN KEY ("character_id") REFERENCES "personal_characters"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "personal_accounts_character_idx"
  ON "personal_accounts" ("character_id");
