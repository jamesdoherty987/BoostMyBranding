-- ═══════════════════════════════════════════════════════════════════
-- Personal custom themes — user-editable niche library
--
-- Users can create their own themes or override built-ins. A row with
-- overrides_builtin=true and the same slug as a built-in takes
-- precedence when listing.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "personal_custom_themes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "tagline" text NOT NULL,
  "description" text NOT NULL,
  "emoji" text DEFAULT '✨' NOT NULL,
  "accent_color" text DEFAULT '#6366F1' NOT NULL,
  "virality_score" integer DEFAULT 7 NOT NULL,
  "cpm_tier" text DEFAULT 'medium' NOT NULL,
  "preferred_platforms" text[] DEFAULT ARRAY[]::text[],
  "template" text DEFAULT 'viral-text' NOT NULL,
  "media_sources" text[] DEFAULT ARRAY[]::text[],
  "use_voiceover" boolean DEFAULT true NOT NULL,
  "use_music" boolean DEFAULT true NOT NULL,
  "hook_formulas" text[] DEFAULT ARRAY[]::text[],
  "topic_seeds" text[] DEFAULT ARRAY[]::text[],
  "voice_guide" text DEFAULT '' NOT NULL,
  "visual_style" text DEFAULT '' NOT NULL,
  "music_mood" text DEFAULT '',
  "target_duration_seconds" integer DEFAULT 35 NOT NULL,
  "default_hashtags" text[] DEFAULT ARRAY[]::text[],
  "requires_grounded_images" boolean DEFAULT false NOT NULL,
  "default_format" text DEFAULT 'video',
  "overrides_builtin" boolean DEFAULT false NOT NULL,
  "derived_from" text,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "personal_custom_themes_user_idx"
  ON "personal_custom_themes" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "personal_custom_themes_user_slug_idx"
  ON "personal_custom_themes" ("user_id", "slug");
