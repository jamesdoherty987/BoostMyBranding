-- Add unique slug column to clients for public site URLs.
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint

-- Backfill slugs from business_name using the same algorithm as slugify()
-- so existing rows get a deterministic slug.
UPDATE "clients"
SET "slug" = regexp_replace(
  regexp_replace(
    regexp_replace(lower(trim("business_name")), '[^a-z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ),
  '-+', '-', 'g'
)
WHERE "slug" IS NULL;--> statement-breakpoint

-- Deduplicate any colliding slugs by suffixing the row's short id.
UPDATE "clients" c
SET "slug" = c."slug" || '-' || substr(c.id::text, 1, 4)
WHERE c.id IN (
  SELECT id FROM (
    SELECT id,
      row_number() OVER (PARTITION BY "slug" ORDER BY "created_at") AS rn
    FROM "clients"
  ) t
  WHERE t.rn > 1
);--> statement-breakpoint

ALTER TABLE "clients" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_slug_idx" ON "clients" ("slug");--> statement-breakpoint

-- Leads table for website contact-form submissions.
CREATE TABLE IF NOT EXISTS "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "message" text,
  "source" text DEFAULT 'website_contact',
  "referer" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "leads_client_idx" ON "leads" ("client_id");
