-- Convert `clients.custom_domain_status` from free-text to a strict enum.
-- Prevents a bad write from leaving a row in a state the dashboard can't
-- render (e.g. 'provisoning' typo) by failing the write at the DB level.
--
-- Safe to re-apply: the IF NOT EXISTS guards on the type + the USING
-- clause on the ALTER COLUMN make this idempotent.

DO $$ BEGIN
  CREATE TYPE "custom_domain_status" AS ENUM ('pending', 'provisioning', 'verified', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Existing rows with a known status get re-cast. Anything else is nulled
-- out (the row still has custom_domain set so the site still resolves,
-- but the status is reset to be filled by the next verify call).
ALTER TABLE "clients"
  ALTER COLUMN "custom_domain_status" TYPE "custom_domain_status"
  USING (
    CASE
      WHEN "custom_domain_status" IN ('pending', 'provisioning', 'verified', 'failed')
        THEN "custom_domain_status"::"custom_domain_status"
      ELSE NULL
    END
  );
