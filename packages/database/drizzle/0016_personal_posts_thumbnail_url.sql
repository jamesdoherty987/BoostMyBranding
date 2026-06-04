-- Custom poster / YouTube thumbnail for long-form personal renders.
ALTER TABLE "personal_posts" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
