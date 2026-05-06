-- ═══════════════════════════════════════════════════════════════════
-- Brand intelligence upgrade
--   1. Inspiration profiles (competitor / "brands I admire" ingestion)
--   2. Inspiration profile media (per-profile image/video refs)
--   3. Tone-of-voice pairs (good/bad copy training examples)
--   4. Products catalog as first-class objects
--   5. clientImages.productId for linking media to products
-- ═══════════════════════════════════════════════════════════════════

-- ── Enums ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "inspiration_profile_status" AS ENUM (
    'idle', 'scraping', 'ready', 'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "product_status" AS ENUM (
    'draft', 'active', 'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Inspiration profiles ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "inspiration_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "reference_url" text,
  "logo_url" text,
  "description" text,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "visual_analysis" jsonb,
  "copy_voice" jsonb,
  "color_palette" jsonb,
  "copy_samples" jsonb,
  "status" "inspiration_profile_status" DEFAULT 'idle' NOT NULL,
  "scrape_error" text,
  "last_scraped_at" timestamp,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "inspiration_profiles_client_idx"
  ON "inspiration_profiles" ("client_id");

-- ── Inspiration profile media ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "inspiration_profile_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "inspiration_profiles"("id") ON DELETE CASCADE,
  "file_url" text NOT NULL,
  "file_name" text,
  "mime_type" text,
  "source" text NOT NULL,
  "ai_description" text,
  "created_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "inspiration_profile_media_profile_idx"
  ON "inspiration_profile_media" ("profile_id");

-- ── Tone-of-voice pairs ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tone_of_voice_pairs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "category" text,
  "good_example" text NOT NULL,
  "bad_example" text,
  "explanation" text,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "tone_of_voice_pairs_client_idx"
  ON "tone_of_voice_pairs" ("client_id");

-- ── Products ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "sku" text,
  "price_cents" integer,
  "currency" text DEFAULT 'EUR',
  "primary_image_url" text,
  "tags" text[] DEFAULT ARRAY[]::text[],
  "status" "product_status" DEFAULT 'draft' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "products_client_idx" ON "products" ("client_id");
CREATE INDEX IF NOT EXISTS "products_status_idx" ON "products" ("status");

-- ── client_images.product_id ───────────────────────────────────────

ALTER TABLE "client_images"
  ADD COLUMN IF NOT EXISTS "product_id" uuid;

DO $$ BEGIN
  ALTER TABLE "client_images"
    ADD CONSTRAINT "client_images_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "client_images_product_idx"
  ON "client_images" ("product_id");
