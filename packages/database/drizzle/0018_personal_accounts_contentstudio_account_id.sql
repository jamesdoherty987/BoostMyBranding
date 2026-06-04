-- Optional ContentStudio social account id when a workspace has multiple accounts on the same platform.
ALTER TABLE "personal_accounts" ADD COLUMN IF NOT EXISTS "contentstudio_account_id" text;
