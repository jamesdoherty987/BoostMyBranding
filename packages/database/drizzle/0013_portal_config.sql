-- Per-client portal customization. Lets the agency tailor what each
-- client sees in their portal: which tabs are visible, custom labels,
-- reordering, a personalized welcome message, and extra links (e.g.
-- "Menu", "Book us", "Fleet") a particular company wants surfaced
-- alongside the built-in nav.
--
-- Stored as a single JSONB blob so we can iterate on the shape without
-- migrations. Nullable — when NULL the portal uses defaults (same nav
-- everyone sees today), so this change is backward-compatible.

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "portal_config" jsonb;
