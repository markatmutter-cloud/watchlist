-- Cached image URL on collection_items.
-- 2026-05-10 — extends the Vercel Blob cache to listing-backed
-- collection_items so dealer images stay alive after the dealer pulls
-- the URL. Manual entries already store their own photo in the
-- watch-photos bucket, so this column stays null for them.
--
-- Cache lookup chain (listing-backed rows):
--   collection_items.cached_img_url
--     → fall back to listing_snapshot.img (the dealer's URL at save time)
--
-- The cache_watchlist_images.mjs cron populates this column. The same
-- blob path (`watchlist/<listing_id>.<ext>`) is shared with
-- watchlist_items so a listing hearted AND in a list re-uses one blob.

alter table public.collection_items
  add column if not exists cached_img_url text;
