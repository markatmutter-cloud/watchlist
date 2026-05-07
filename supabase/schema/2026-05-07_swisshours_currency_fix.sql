-- One-shot migration: relabel Swiss Hours rows from USD → HKD.
--
-- Background: Swiss Hours is a Hong Kong-based dealer whose Shopify
-- products.json variant `price` field carries raw HKD amounts, but
-- merge.py's source mapping was tagging the source as USD. Every
-- saved Swiss Hours snapshot in watchlist_items / collection_items
-- has the wrong currency label and a `*_price_usd` value equal to
-- the raw HKD number (i.e. 8× too large).
--
-- The merge.py + state.json + listings.json fix landed in PR #111.
-- This migration corrects the per-user data already stored in
-- Supabase. Idempotent — re-running it is a no-op (the WHERE clauses
-- gate on saved_currency = 'USD').
--
-- HKD→USD rate matches FX dict in merge.py + src/utils.js: 0.128.
--
-- Run order: paste into the Supabase SQL editor and execute.

-- ── watchlist_items ─────────────────────────────────────────────
update public.watchlist_items
set
  saved_currency  = 'HKD',
  saved_price_usd = round(saved_price * 0.128)::int,
  listing_snapshot = jsonb_set(
    jsonb_set(
      coalesce(listing_snapshot, '{}'::jsonb),
      '{currency}', '"HKD"'::jsonb, true
    ),
    '{priceUSD}',
    to_jsonb(round(coalesce((listing_snapshot->>'price')::numeric, 0) * 0.128)::int),
    true
  )
where coalesce(listing_snapshot->>'source', '') = 'Swiss Hours'
  and coalesce(saved_currency, 'USD') = 'USD';

-- Relabel priceHistory entries inside the snapshot. Done as a
-- separate UPDATE so the jsonb_set chain above stays readable.
-- We rebuild the priceHistory array element-by-element, swapping
-- the `currency` field where it equals 'USD'.
update public.watchlist_items
set listing_snapshot = jsonb_set(
  listing_snapshot,
  '{priceHistory}',
  coalesce(
    (
      select jsonb_agg(
        case when h->>'currency' = 'USD'
             then jsonb_set(h, '{currency}', '"HKD"'::jsonb, false)
             else h
        end
        order by ordinality
      )
      from jsonb_array_elements(listing_snapshot->'priceHistory') with ordinality as t(h, ordinality)
    ),
    '[]'::jsonb
  ),
  true
)
where coalesce(listing_snapshot->>'source', '') = 'Swiss Hours'
  and listing_snapshot ? 'priceHistory'
  and exists (
    select 1
    from jsonb_array_elements(listing_snapshot->'priceHistory') h
    where h->>'currency' = 'USD'
  );

-- ── collection_items (Lists, challenge picks) ──────────────────
-- Same fix pattern. is_pick rows (challenge picks) and is_pick=false
-- rows (legacy shortlist) both use listing_snapshot, both need the
-- relabel. is_manual=true rows have null listing_id and don't carry
-- a Swiss Hours snapshot, so the source-equality WHERE filters them
-- out automatically.
update public.collection_items
set
  saved_currency  = 'HKD',
  saved_price_usd = round(saved_price * 0.128)::int,
  listing_snapshot = jsonb_set(
    jsonb_set(
      coalesce(listing_snapshot, '{}'::jsonb),
      '{currency}', '"HKD"'::jsonb, true
    ),
    '{priceUSD}',
    to_jsonb(round(coalesce((listing_snapshot->>'price')::numeric, 0) * 0.128)::int),
    true
  )
where coalesce(listing_snapshot->>'source', '') = 'Swiss Hours'
  and coalesce(saved_currency, 'USD') = 'USD';

update public.collection_items
set listing_snapshot = jsonb_set(
  listing_snapshot,
  '{priceHistory}',
  coalesce(
    (
      select jsonb_agg(
        case when h->>'currency' = 'USD'
             then jsonb_set(h, '{currency}', '"HKD"'::jsonb, false)
             else h
        end
        order by ordinality
      )
      from jsonb_array_elements(listing_snapshot->'priceHistory') with ordinality as t(h, ordinality)
    ),
    '[]'::jsonb
  ),
  true
)
where coalesce(listing_snapshot->>'source', '') = 'Swiss Hours'
  and listing_snapshot ? 'priceHistory'
  and exists (
    select 1
    from jsonb_array_elements(listing_snapshot->'priceHistory') h
    where h->>'currency' = 'USD'
  );

-- Verification: should return 0 rows in both queries after running.
-- select count(*) from public.watchlist_items
--   where coalesce(listing_snapshot->>'source','') = 'Swiss Hours'
--     and coalesce(saved_currency,'USD') = 'USD';
-- select count(*) from public.collection_items
--   where coalesce(listing_snapshot->>'source','') = 'Swiss Hours'
--     and coalesce(saved_currency,'USD') = 'USD';
