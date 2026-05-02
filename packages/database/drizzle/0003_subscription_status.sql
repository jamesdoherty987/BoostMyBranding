-- Add subscription lifecycle tracking. Separates "is this site active" from
-- "is the customer paying us" so we can gate premium features without
-- deactivating the record entirely.

DO $$ BEGIN
  CREATE TYPE "subscription_status" AS ENUM ('none', 'active', 'past_due', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "subscription_status" "subscription_status" NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "subscription_started_at" timestamp;

-- Any existing client that has a Stripe subscription id should be treated as
-- active so this migration doesn't lock out current paying customers.
UPDATE "clients"
  SET "subscription_status" = 'active',
      "subscription_started_at" = COALESCE("subscription_started_at", "onboarded_at", "created_at")
  WHERE "stripe_subscription_id" IS NOT NULL
    AND "subscription_status" = 'none';
