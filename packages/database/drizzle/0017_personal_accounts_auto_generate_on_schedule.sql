-- Scheduled video autopilot: only accounts with this flag run on the 5-minute cron.
ALTER TABLE "personal_accounts" ADD COLUMN IF NOT EXISTS "auto_generate_on_schedule" boolean DEFAULT false NOT NULL;
-- Existing channels default to off; clear stale next_run_at so nothing fires until the user opts in.
UPDATE "personal_accounts" SET "next_run_at" = NULL WHERE NOT "auto_generate_on_schedule";
