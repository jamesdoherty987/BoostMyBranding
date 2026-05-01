ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "website_config" jsonb;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "website_generated_at" timestamp;
