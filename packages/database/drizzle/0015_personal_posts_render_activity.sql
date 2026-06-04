ALTER TABLE "personal_posts" ADD COLUMN IF NOT EXISTS "render_progress_label" text;
ALTER TABLE "personal_posts" ADD COLUMN IF NOT EXISTS "render_activity_log" jsonb DEFAULT '[]'::jsonb;
