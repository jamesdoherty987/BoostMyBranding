-- Custom domain support. Clients can attach their own domain (e.g.
-- `murphysplumbing.com`) and the apps/web middleware rewrites matching
-- requests to `/sites/[slug]` internally. Status column tracks the
-- Vercel provisioning lifecycle so the dashboard can surface next steps
-- without having to re-fetch from the Vercel API on every view.

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "custom_domain" text,
  ADD COLUMN IF NOT EXISTS "custom_domain_status" text,
  ADD COLUMN IF NOT EXISTS "custom_domain_verified_at" timestamp,
  ADD COLUMN IF NOT EXISTS "custom_domain_error" text;

-- Unique index (NOT UNIQUE constraint) so NULLs are allowed freely for
-- clients without a custom domain, but no two clients can attach the same
-- host. Partial to make this explicit.
CREATE UNIQUE INDEX IF NOT EXISTS "clients_custom_domain_idx"
  ON "clients" ("custom_domain")
  WHERE "custom_domain" IS NOT NULL;
