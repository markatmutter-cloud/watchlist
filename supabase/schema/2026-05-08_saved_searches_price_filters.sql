-- 2026-05-08: saved_searches gains optional min/max price columns.
--
-- The saved-search row used to capture only label + query (text). The
-- $ Min / $ Max chips on the filter row weren't persisted, so a saved
-- search like "Speedmaster pro under $5k" would re-run on tap and
-- show every Speedmaster pro at any price — the price guard was lost.
--
-- Both columns are nullable. A search with no price guard stores both
-- as NULL and behaves exactly as before. The frontend treats either
-- being non-null as "user wants this guard re-applied on runSearch".
--
-- Idempotent: re-running this migration is a no-op once the columns
-- exist.

alter table public.saved_searches
  add column if not exists min_price numeric,
  add column if not exists max_price numeric;

-- Defensive bound: prices are always non-negative. A NULL is allowed
-- (unset) but a row with min_price < 0 or max_price < 0 would be a
-- frontend bug — block at the DB layer rather than letting it land.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_searches_min_price_nonneg'
  ) then
    alter table public.saved_searches
      add constraint saved_searches_min_price_nonneg
      check (min_price is null or min_price >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_searches_max_price_nonneg'
  ) then
    alter table public.saved_searches
      add constraint saved_searches_max_price_nonneg
      check (max_price is null or max_price >= 0);
  end if;
end $$;
