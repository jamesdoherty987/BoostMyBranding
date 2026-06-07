-- New channels default to in-app only until Posting → "Send to Content Studio" is enabled.
-- Existing rows keep their current auto_schedule value.
ALTER TABLE "personal_accounts" ALTER COLUMN "auto_schedule" SET DEFAULT false;
