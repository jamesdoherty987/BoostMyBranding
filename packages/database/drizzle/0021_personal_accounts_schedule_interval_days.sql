-- Cadence between posting days (1 = daily, 2 = every other day, 7 = weekly, …).
ALTER TABLE "personal_accounts"
  ADD COLUMN IF NOT EXISTS "schedule_interval_days" integer DEFAULT 1 NOT NULL;
