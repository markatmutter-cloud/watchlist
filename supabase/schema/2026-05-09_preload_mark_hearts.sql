-- Heart Mark's spreadsheet URLs in watchlist_items so the same
-- watches show up in his Saved virtual list alongside the manual
-- entries in My Watches > Collection / Archive.
--
-- 2026-05-09 — Mark question "can the listings I scrape go to
-- favorites?" Answer A: hearts only (this file). Answer B (also
-- adding to the public sold/auctions feed for everyone) was held
-- pending explicit confirmation.
--
-- listing_id is shortHash(url) — the 12-char FNV-flavoured hash
-- the JS side uses for hearts on auction-shaped URLs (Phase B2).
-- Idempotent: skip if user already has a row for this listing_id.
--
-- Already applied to production via Supabase MCP. File committed
-- as a record of what landed.

insert into public.watchlist_items (
  user_id, listing_id, saved_at, saved_price, saved_currency,
  saved_price_usd, listing_snapshot
)
select * from (values
  ('3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid, '26663f4e10a6'::text, '2024-12-15T12:00:00Z'::timestamptz, 10000::numeric, 'USD'::text, 10000::numeric,
    jsonb_build_object('id','26663f4e10a6','url','https://tropicalwatch.com/watches/1960-rolex-explorer-1016-with-service-papers-box/ye0k','brand','Rolex','ref','1016','title','1960 Rolex Explorer 1016','source','Tropical Watch','price',10000,'priceUSD',10000,'currency','USD','img','https://d29ueykkv8fpnq.cloudfront.net/ec79spw75dixhxwk9rh8g2q6adbg','sold',true,'soldAt','2026-03-15','firstSeen','2024-12-15')),
  ('3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid, '81f6a174359c', '2023-08-15T12:00:00Z'::timestamptz, 7500, 'USD', 7500,
    jsonb_build_object('id','81f6a174359c','url','https://catalog.antiquorum.swiss/en/lots/tudor-ref-7021-0-submariner-snowflake-lot-362-91','brand','Tudor','ref','7021/0','title','Tudor Submariner Snowflake 7021/0','source','Antiquorum','price',7500,'priceUSD',7500,'currency','USD','img','','sold',true,'soldAt','2024-08-15','firstSeen','2023-08-15')),
  ('3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid, '0eaaaa8d2e14', '2023-06-15T12:00:00Z'::timestamptz, 13000, 'USD', 13000,
    jsonb_build_object('id','0eaaaa8d2e14','url','https://tropicalwatch.com/watches/1971-rolex-gmt-master-1675-with-box-and-pamphlets/s3mm','brand','Rolex','ref','1675','title','1971 Rolex GMT-Master 1675','source','Tropical Watch','price',13000,'priceUSD',13000,'currency','USD','img','https://d29ueykkv8fpnq.cloudfront.net/00y14r31wk7vkeo3e0an84ed89zn','sold',true,'soldAt','2024-06-15','firstSeen','2023-06-15')),
  ('3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid, 'c78ccd5a8977', '2024-03-15T12:00:00Z'::timestamptz, 3000, 'USD', 3000,
    jsonb_build_object('id','c78ccd5a8977','url','https://tropicalwatch.com/watches/1996-omega-speedmaster-3592-50/xtdg','brand','Omega','ref','3592.50','title','1996 Omega Speedmaster 3592.50','source','Tropical Watch','price',3000,'priceUSD',3000,'currency','USD','img','https://d29ueykkv8fpnq.cloudfront.net/qsj524hanetibqyn3pl7ma7va7bo','sold',true,'soldAt','2025-05-15','firstSeen','2024-03-15')),
  ('3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid, '57e252e9bac6', '2024-02-15T12:00:00Z'::timestamptz, 7000, 'USD', 7000,
    jsonb_build_object('id','57e252e9bac6','url','https://tropicalwatch.com/watches/1970-rolex-18k-yg-day-date-1803-champagne-dial/b2ok','brand','Rolex','ref','1803','title','1970 Rolex 18k YG Day-Date 1803','source','Tropical Watch','price',7000,'priceUSD',7000,'currency','USD','img','https://d29ueykkv8fpnq.cloudfront.net/r00m92fxwvr35dlskw6vsk1lupye','sold',true,'soldAt','2025-05-15','firstSeen','2024-02-15')),
  ('3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid, '890bcc961871', '2023-11-15T12:00:00Z'::timestamptz, 6450, 'USD', 6450,
    jsonb_build_object('id','890bcc961871','url','https://jewelry.ha.com/itm/timepieces/wristwatch/omega-stainless-seamaster-300-new-vintage-watch-circa-2010/a/5550-54136.s','brand','Omega','ref','Seamaster 300','title','Omega Seamaster 300 (New Vintage)','source','Heritage Auctions','price',6450,'priceUSD',6450,'currency','USD','img','','sold',true,'soldAt','2024-02-15','firstSeen','2023-11-15')),
  ('3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid, '1e10b599f645', '2025-10-15T12:00:00Z'::timestamptz, 3850, 'USD', 3850,
    jsonb_build_object('id','1e10b599f645','url','https://www.windvintage.com/an0rdain-model-1-in-paynes-grey-fum-full-set','brand','anOrdain','ref','Model 1','title','anOrdain Model 1','source','Wind Vintage','price',3850,'priceUSD',3850,'currency','USD','img','','sold',true,'soldAt','2026-02-15','firstSeen','2025-10-15')),
  ('3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid, 'd17061a4d9d3', '2017-06-15T12:00:00Z'::timestamptz, 12000, 'USD', 12000,
    jsonb_build_object('id','d17061a4d9d3','url','https://www.mvvwatches.com/watches-2/p/2017-rolex-gmt-master-ii-ref-116710blnr-batman-nos-stickers-box-and-papers','brand','Rolex','ref','116710BLNR','title','Rolex GMT-Master II Batman 116710BLNR','source','mvvwatches','price',12000,'priceUSD',12000,'currency','USD','img','http://static1.squarespace.com/static/5eadfcb28a5c8f3b7610d5f1/5f4c453481a96034f68fdb44/67e4624a56da4c2a0338a0d1/1743020618755/1.jpg?format=1500w','sold',true,'soldAt','2025-05-15','firstSeen','2017-06-15')),
  ('3bf3f9e7-cd1b-4289-8b47-0536a15ea1eb'::uuid, '0ae7d59109af', '2025-05-15T12:00:00Z'::timestamptz, 18000, 'USD', 18000,
    jsonb_build_object('id','0ae7d59109af','url','https://mentawatches.com/product/rolex-mk1-1675-gmt-master-7/','brand','Rolex','ref','1675 Mk1','title','Rolex GMT-Master 1675 Mk1 (currently owned)','source','Menta Watches','price',18000,'priceUSD',18000,'currency','USD','img','https://mentawatches.com/wp-content/uploads/2025/05/VINTAGE-54.jpg','sold',false,'firstSeen','2025-05-15'))
) as v(user_id, listing_id, saved_at, saved_price, saved_currency, saved_price_usd, listing_snapshot)
where not exists (
  select 1 from public.watchlist_items wi
  where wi.user_id = v.user_id and wi.listing_id = v.listing_id
);
