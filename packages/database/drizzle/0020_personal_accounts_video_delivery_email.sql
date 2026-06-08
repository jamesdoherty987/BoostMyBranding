-- Optional email with download link when a rendered video is ready (Resend).
ALTER TABLE "personal_accounts"
  ADD COLUMN IF NOT EXISTS "email_video_on_ready" boolean DEFAULT false NOT NULL;
ALTER TABLE "personal_accounts"
  ADD COLUMN IF NOT EXISTS "video_delivery_email" text;
