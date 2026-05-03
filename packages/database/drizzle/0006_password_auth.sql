-- Add password-based login alongside magic links.
-- password_hash is nullable because users created before this migration
-- (and users who only ever signed in via magic link) don't have one.
-- Nulls mean "password login not set up; use magic link".

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_hash" text;
