-- Fix: re-create the INSERT policy on `collections`.
--
-- Mark's report 2026-05-08: creating a challenge fails with
--   new row violates row-level security policy for table "collections"
-- when calling `supabase.from('collections').insert(...)` even though
-- the JS payload sets user_id = auth.uid() correctly.
--
-- Cause: my slice-1 / COMBINED_2026-05-07 migration dropped + recreated
-- the SELECT, UPDATE, and DELETE policies on `collections`, but
-- assumed the INSERT policy from 2026-05-01_collections.sql ("Users
-- insert own collections") was still in place. Mark's DB ended up
-- without that policy — possibly because of an earlier intermediate
-- DROP that wasn't recorded. With RLS enabled and no INSERT policy,
-- Postgres denies every INSERT.
--
-- Fix: explicitly drop+recreate the INSERT policy under a new
-- canonical name. Idempotent.
--
-- Run order: paste into the Supabase SQL editor and execute.

do $$ begin
  drop policy if exists "Users insert own collections" on public.collections;
  drop policy if exists "Users insert owned collections" on public.collections;
  create policy "Users insert owned collections"
    on public.collections for insert
    with check (auth.uid() = user_id);
end $$;

-- Sanity: confirm the policy now exists.
do $$
declare
  has_insert boolean;
begin
  select exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'collections'
       and cmd = 'INSERT'
  ) into has_insert;
  if not has_insert then
    raise exception 'collections INSERT policy still missing after migration';
  end if;
  raise notice 'collections INSERT policy is in place.';
end $$;
