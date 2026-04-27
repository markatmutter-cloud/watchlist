# Watchlist image cache — setup

One-time SQL migration in Supabase. After this, the cron pipeline
auto-populates `cached_img_url` for every watchlisted item by fetching
the dealer image and uploading to Vercel Blob.

## SQL

Open the Supabase SQL editor for the `dial-watchlist` project and run:

```sql
alter table public.watchlist_items
  add column if not exists cached_img_url text;
```

That's it. No RLS changes — the same row policies that gated
read/insert/delete already cover the new column.

## What happens after

- Each cron run, `cache_watchlist_images.mjs` queries
  `watchlist_items` for rows with `cached_img_url IS NULL`.
- For each, it fetches `listing_snapshot.img` (with the right Referer
  header for hot-link-protected dealers like Watchfid), uploads to
  Vercel Blob at `watchlist/<listing_id>.<ext>`, and writes the Blob
  URL back to the row.
- The frontend prefers `cached_img_url` over `listing_snapshot.img`
  when rendering watchlist cards. Once cached, the image survives the
  dealer deleting the file.
- Orphan cleanup runs in the same pass: any blob whose listing_id no
  longer appears in `watchlist_items` is deleted, freeing the space.

Storage budget: ~50 KB per image × hundreds of watchlisted items =
well under the Vercel Blob 1 GB free tier even at 10× current scale.
