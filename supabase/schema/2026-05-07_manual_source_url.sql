-- 2026-05-07 — Manual entries optional source URL
--
-- Mark feedback: "Add a watch should have a URL to link to for now."
-- Owned/Sold manual entries can carry an optional dealer / auction /
-- eBay URL the user wants the watch linked back to. Stored alongside
-- the existing manual_* columns on collection_items so the data lives
-- with the row it belongs to (vs. trying to look up via listing_id —
-- which is null for manual entries by definition).
--
-- Pure additive: no constraint changes, no RLS shifts, no backfill.
-- Apply via the Supabase SQL editor; existing rows get NULL.

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS manual_source_url text;

-- Comment for the schema browser.
COMMENT ON COLUMN collection_items.manual_source_url IS
  'Optional URL the user pasted when manually adding a watch — typically the dealer listing, eBay sold page, or auction lot URL. Display layer renders as "View source" when present.';
