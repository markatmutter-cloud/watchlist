-- Preload Mark's watches from his Watch_Portfolio_Tracker.xlsx
-- (2026-05-09 — Mark request: "preload these watches; where there
-- is a link, scrape the listing image"). Six of nine listing URLs
-- yielded an og:image via curl; the other three (Antiquorum,
-- Heritage, Wind Vintage) are anti-bot — those rows insert without
-- a photo so Mark can add them via the manual-entry form later.
--
-- Idempotent: each insert is gated on a `not exists` clause that
-- matches by (user, brand, reference). Re-running is a no-op.
--
-- IMPORTANT: this migration is intentionally NOT applied
-- automatically — Mark wanted to review the watch data before it
-- lands in his account. Apply when ready via:
--   supabase migration up   (if using local CLI)
--   OR paste into Supabase SQL editor
--   OR (with Mark's approval) Claude can apply via MCP

-- Resolved IDs (read from Mark's account 2026-05-09):
--   user_id    = 3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb (markatmutter@gmail.com)
--   Owned coll = ca9e8a36-1c17-44a3-a555-2efc25ab177d
--   Sold coll  = 6d168ae8-7c19-4fdf-b3ab-daac3da8b9be

-- ── SOLD (11 watches) ──────────────────────────────────────────

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'Rolex', 'Explorer', '1016',
  11637, 'USD',
  10000, '2026-03-15'::date,
  9000, 1800, null, 837, null,
  1, 11637,
  'Sotheby''s: hammer $9,000 + BP $1,800 + sales tax $837. Sold to Tropical Watch.',
  'https://tropicalwatch.com/watches/1960-rolex-explorer-1016-with-service-papers-box/ye0k',
  'https://d29ueykkv8fpnq.cloudfront.net/ec79spw75dixhxwk9rh8g2q6adbg',
  '2024-12-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Rolex')
    and lower(coalesce(ci.manual_reference,'')) = lower('1016')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'Tudor', 'Submariner Snowflake', '7021/0',
  7094.10, 'USD',
  7500, '2024-08-15'::date,
  5000, 1500, null, null, null,
  1.0914, 7094.10,
  'Antiquorum Monaco: hammer €5,000 + commission €1,500 = €6,500. Sold on Reddit (USD).',
  'https://catalog.antiquorum.swiss/en/lots/tudor-ref-7021-0-submariner-snowflake-lot-362-91',
  null,
  '2023-08-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Tudor')
    and lower(coalesce(ci.manual_reference,'')) = lower('7021/0')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'Rolex', 'GMT-Master', '1675',
  17182.06, 'USD',
  13000, '2024-06-15'::date,
  12000, 3712, null, null, 143,
  1.0837, 17182.06,
  'Sotheby''s: hammer €12,000 + BP €3,712 + fees €143 = €15,855. Sold to Tropical Watch (USD).',
  'https://tropicalwatch.com/watches/1971-rolex-gmt-master-1675-with-box-and-pamphlets/s3mm',
  'https://d29ueykkv8fpnq.cloudfront.net/00y14r31wk7vkeo3e0an84ed89zn',
  '2023-06-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Rolex')
    and lower(coalesce(ci.manual_reference,'')) = lower('1675')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'Omega', 'Speedmaster', '3592.50',
  4200, 'USD',
  3000, '2025-05-15'::date,
  4200, null, null, null, null,
  1, 4200,
  'Bought and sold via Tropical Watch.',
  'https://tropicalwatch.com/watches/1996-omega-speedmaster-3592-50/xtdg',
  'https://d29ueykkv8fpnq.cloudfront.net/qsj524hanetibqyn3pl7ma7va7bo',
  '2024-03-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Omega')
    and lower(coalesce(ci.manual_reference,'')) = lower('3592.50')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'Rolex', '18k YG Day-Date', '1803',
  8400, 'USD',
  7000, '2025-05-15'::date,
  8400, null, null, null, null,
  1, 8400,
  'Bought and sold via Tropical Watch.',
  'https://tropicalwatch.com/watches/1970-rolex-18k-yg-day-date-1803-champagne-dial/b2ok',
  'https://d29ueykkv8fpnq.cloudfront.net/r00m92fxwvr35dlskw6vsk1lupye',
  '2024-02-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Rolex')
    and lower(coalesce(ci.manual_reference,'')) = lower('1803')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'Omega', 'Seamaster 300 (New Vintage)', 'Seamaster 300',
  5032.20, 'USD',
  6450, '2024-02-15'::date,
  3700, 925, 45.25, 361.95, null,
  1, 5032.20,
  'Heritage: hammer $3,700 + BP $925 + S&H $45.25 + tax $361.95 = $5,032.20. Sold on eBay.',
  'https://jewelry.ha.com/itm/timepieces/wristwatch/omega-stainless-seamaster-300-new-vintage-watch-circa-2010/a/5550-54136.s',
  null,
  '2023-11-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Omega')
    and lower(coalesce(ci.manual_reference,'')) = lower('Seamaster 300')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'anOrdain', 'Model 1 (Payne''s Grey)', 'Model 1',
  2900, 'USD',
  3850, '2026-02-15'::date,
  2900, null, null, null, null,
  1, 2900,
  'Bought from Wind Vintage; sold on eBay.',
  'https://www.windvintage.com/an0rdain-model-1-in-paynes-grey-fum-full-set',
  null,
  '2025-10-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('anOrdain')
    and lower(coalesce(ci.manual_reference,'')) = lower('Model 1')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'Rolex', 'GMT-Master II Batman (NOS)', '116710BLNR',
  8950, 'USD',
  12000, '2025-05-15'::date,
  8950, null, null, null, null,
  1, 8950,
  '2017 US retail $8,950 (per chrono24 / aBlogtoWatch). Las Vegas AD, no sales tax. Sold to Tropical Watch.',
  'https://www.mvvwatches.com/watches-2/p/2017-rolex-gmt-master-ii-ref-116710blnr-batman-nos-stickers-box-and-papers',
  'http://static1.squarespace.com/static/5eadfcb28a5c8f3b7610d5f1/5f4c453481a96034f68fdb44/67e4624a56da4c2a0338a0d1/1743020618755/1.jpg?format=1500w',
  '2017-06-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Rolex')
    and lower(coalesce(ci.manual_reference,'')) = lower('116710BLNR')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'Heuer', 'Carrera', 'CS3111',
  2801, 'USD',
  3075, '2024-07-15'::date,
  2801, null, null, null, null,
  1, 2801,
  'eBay buy / sell. (Original message had two numbers $3,075.91 and $2,801; used $2,801 as buy — confirm.)',
  null, null,
  '2024-03-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Heuer')
    and lower(coalesce(ci.manual_reference,'')) = lower('CS3111')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'De Rijke & Co', 'Miffy', 'Miffy',
  3350.79, 'USD',
  5000, '2024-06-15'::date,
  3100, null, null, null, null,
  1.0809, 3350.79,
  'Bought €3,100 direct (Nov-2023, FX 1.0809). Sold on Reddit (USD).',
  null, null,
  '2023-11-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('De Rijke & Co')
    and lower(coalesce(ci.manual_reference,'')) = lower('Miffy')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_sold_price, manual_sold_date,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  '6d168ae8-7c19-4fdf-b3ab-daac3da8b9be'::uuid, null, true,
  'Omega', 'Speedmaster Mk40', 'Mk40',
  4526, 'USD',
  6700, '2023-09-15'::date,
  4526, null, null, null, null,
  1, 4526,
  'Bought from Hodinkee, sold on eBay.',
  null, null,
  '2023-04-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Omega')
    and lower(coalesce(ci.manual_reference,'')) = lower('Mk40')
);

-- ── HELD (5 watches) ───────────────────────────────────────────

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  'ca9e8a36-1c17-44a3-a555-2efc25ab177d'::uuid, null, true,
  'Rolex', 'GMT-Master 1675 Mk1', '1675 Mk1',
  18000, 'USD',
  18000, null, null, null, null,
  1, 18000,
  'Currently owned. Cost basis $18,000 from Menta Watches.',
  'https://mentawatches.com/product/rolex-mk1-1675-gmt-master-7/',
  'https://mentawatches.com/wp-content/uploads/2025/05/VINTAGE-54.jpg',
  '2025-05-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Rolex')
    and lower(coalesce(ci.manual_reference,'')) = lower('1675 Mk1')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  'ca9e8a36-1c17-44a3-a555-2efc25ab177d'::uuid, null, true,
  'Audemars Piguet', '5548 BA (yellow gold)', '5548 BA',
  19059, 'USD',
  15000, null, null, null, null,
  1.2706, 19059,
  'Currently owned. £15,000 in Aug-2023 (FX 1.2706) ≈ $19,059.',
  null, null,
  '2023-08-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Audemars Piguet')
    and lower(coalesce(ci.manual_reference,'')) = lower('5548 BA')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  'ca9e8a36-1c17-44a3-a555-2efc25ab177d'::uuid, null, true,
  'Omega', 'Seamaster', '165.024',
  12865.73, 'USD',
  9495, null, null, null, null,
  1.355, 12865.73,
  'Currently owned. £9,495 in Apr-2026 (FX ~1.355) ≈ $12,866.',
  null, null,
  '2026-04-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Omega')
    and lower(coalesce(ci.manual_reference,'')) = lower('165.024')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  'ca9e8a36-1c17-44a3-a555-2efc25ab177d'::uuid, null, true,
  'Omega', 'Railmaster', 'CK2914',
  11856.25, 'USD',
  8750, null, null, null, null,
  1.355, 11856.25,
  'Currently owned. £8,750 in Apr-2026 (FX ~1.355) ≈ $11,856.',
  null, null,
  '2026-04-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Omega')
    and lower(coalesce(ci.manual_reference,'')) = lower('CK2914')
);

insert into public.collection_items (
  collection_id, listing_id, is_manual,
  manual_brand, manual_model, manual_reference,
  manual_price_paid, manual_price_currency,
  manual_buy_hammer, manual_buy_premium, manual_buy_shipping,
  manual_buy_tax, manual_buy_other,
  manual_buy_fx_to_usd, manual_buy_all_in_usd,
  manual_comments, manual_source_url, manual_image_url,
  added_at, source_of_entry, who_added
)
select
  'ca9e8a36-1c17-44a3-a555-2efc25ab177d'::uuid, null, true,
  'Omega', 'Speedmaster', '310.30.42.50.04.001',
  9020, 'USD',
  9020, null, null, null, null,
  1, 9020,
  'Currently owned. Cost basis $9,020 (Mar-2026).',
  null, null,
  '2026-03-15T12:00:00Z'::timestamptz, 'preload-2026-05-09',
  '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
where not exists (
  select 1 from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  where c.user_id = '3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid
    and ci.is_manual = true
    and lower(coalesce(ci.manual_brand,'')) = lower('Omega')
    and lower(coalesce(ci.manual_reference,'')) = lower('310.30.42.50.04.001')
);
