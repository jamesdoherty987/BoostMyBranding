-- 0007 — Media provenance + Canva integration
--
-- Adds a `source` column to `client_images` so the Media Studio can
-- distinguish uploaded, AI-generated, template-rendered, Canva-exported
-- and stock-sourced assets. Also creates the `client_canva_connections`
-- table for OAuth credential storage.
--
-- Safe to run on existing data: both changes are additive. Legacy rows
-- default to NULL for `source` and the UI treats that as "upload".

ALTER TABLE "client_images" ADD COLUMN IF NOT EXISTS "source" text;

CREATE TABLE IF NOT EXISTS "client_canva_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "canva_user_id" text,
  "canva_team_id" text,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "scopes" text,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_canva_connections_client_idx"
  ON "client_canva_connections" ("client_id");
