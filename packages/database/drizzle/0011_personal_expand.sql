-- ═══════════════════════════════════════════════════════════════════
-- Personal content expansion
--   1. Add 'youtube' and 'google_business' to the platform enum
--   2. Add personal_accounts.format_kind, custom_audio_url, custom_audio_attribution
--   3. Add personal_posts.post_kind
--
-- Postgres does not allow ALTER TYPE ... ADD VALUE inside a
-- transaction, which is what Drizzle's migrator wraps each statement
-- in. Workaround: re-create the enum via the rename-dance so the two
-- new values land without needing ADD VALUE at all. This runs cleanly
-- inside a transaction.
-- ═══════════════════════════════════════════════════════════════════

-- ── platform enum: rename-dance to add youtube + google_business ──
ALTER TYPE "platform" RENAME TO "platform_old";

CREATE TYPE "platform" AS ENUM (
  'instagram',
  'facebook',
  'linkedin',
  'tiktok',
  'x',
  'pinterest',
  'bluesky',
  'youtube',
  'google_business'
);

-- Recast every column that used the old type. Order matters: alter,
-- then drop the old type.
ALTER TABLE "posts"
  ALTER COLUMN "platform" TYPE "platform"
  USING "platform"::text::"platform";

ALTER TABLE "personal_accounts"
  ALTER COLUMN "platform" TYPE "platform"
  USING "platform"::text::"platform";

DROP TYPE "platform_old";

-- ── Columns on personal_accounts ──────────────────────────────────
ALTER TABLE "personal_accounts"
  ADD COLUMN IF NOT EXISTS "format_kind" text DEFAULT 'video' NOT NULL,
  ADD COLUMN IF NOT EXISTS "custom_audio_url" text,
  ADD COLUMN IF NOT EXISTS "custom_audio_attribution" text;

-- ── Column on personal_posts ──────────────────────────────────────
ALTER TABLE "personal_posts"
  ADD COLUMN IF NOT EXISTS "post_kind" text DEFAULT 'video' NOT NULL;
