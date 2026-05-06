-- Wishlist force-ranking column.
-- 2026-05-06 (PR #89) — Mark's locked plan: wishlist-only force
-- rank. Other lists (Owned, Sold, regular user lists, Lists) keep
-- the savedAt/added_at default ordering.
--
-- The column is on collection_items (not on a wishlist-specific
-- table) so the schema stays uniform — non-wishlist rows just
-- leave it null. Lower position = higher rank (1 = most wanted).

alter table public.collection_items
  add column if not exists position integer;

-- Composite index on (collection_id, position) supports the
-- per-list ordered fetch the frontend uses for the Wishlist
-- drill-in. Includes nulls so non-wishlist rows still get scanned.
create index if not exists collection_items_position_idx
  on public.collection_items (collection_id, position);
