-- User limits — Epic 3 defensive engineering.
--
-- Soft cap (UI only): 500 hearted items per user, friendly banner.
-- Hard cap (UI + DB trigger): 2,500 by default, overridable per user
-- via the user_limits table. Admin-grantable for cases like Mark's
-- wife who plans to use the system for shopping research.
--
-- The DB trigger is the line of defense — if a malicious or buggy
-- frontend bypasses the JS check, the insert is rejected with a
-- recognisable error code so the UI can degrade gracefully.
--
-- Run order: paste the entire file into the Supabase SQL editor and
-- execute. Idempotent — running it twice does no harm.

-- ── user_limits ──────────────────────────────────────────────────────
-- Per-user override of the default cap. No row = use defaults.
-- updated_by tracks which admin made the change for audit.
create table if not exists public.user_limits (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  watchlist_cap    integer not null default 2500
                   check (watchlist_cap >= 0 and watchlist_cap <= 100000),
  notes            text,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null
);

create index if not exists user_limits_updated_at_idx
  on public.user_limits (updated_at desc);

alter table public.user_limits enable row level security;

do $$ begin
  -- Users can read their own row so the frontend can fetch their cap.
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='user_limits' and policyname='Users select own limit') then
    create policy "Users select own limit"
      on public.user_limits for select using (auth.uid() = user_id);
  end if;
  -- Only admins can mutate. Regular users can never escalate themselves.
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='user_limits' and policyname='Admins manage user limits') then
    create policy "Admins manage user limits"
      on public.user_limits for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- ── default_watchlist_cap() ──────────────────────────────────────────
-- Single source of truth for the system-wide default. Bumping it here
-- automatically applies to every user without a user_limits row.
create or replace function public.default_watchlist_cap()
returns integer
language sql
immutable
as $$ select 2500 $$;

-- ── enforce_watchlist_cap (trigger fn) ───────────────────────────────
-- BEFORE INSERT trigger on watchlist_items. Counts the user's current
-- rows, looks up their cap (custom from user_limits or system default),
-- and rejects with a recognisable error code if they're at the limit.
-- The UI inspects this error to show a "you've hit your cap" message.
create or replace function public.enforce_watchlist_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  user_cap integer;
begin
  if new.user_id is null then
    return new;  -- Nothing to enforce — RLS will reject anyway.
  end if;

  select count(*) into current_count
    from public.watchlist_items
    where user_id = new.user_id;

  select coalesce(
    (select watchlist_cap from public.user_limits where user_id = new.user_id),
    public.default_watchlist_cap()
  ) into user_cap;

  if current_count >= user_cap then
    raise exception 'watchlist_cap_exceeded: user has reached the %-item limit', user_cap
      using errcode = 'P0001';  -- recognisable + non-fatal class
  end if;

  return new;
end;
$$;

-- Drop + recreate so the trigger is idempotent across re-runs of the
-- migration. CREATE OR REPLACE doesn't apply to triggers themselves.
drop trigger if exists watchlist_items_cap_check on public.watchlist_items;
create trigger watchlist_items_cap_check
  before insert on public.watchlist_items
  for each row execute function public.enforce_watchlist_cap();

-- ── set_watchlist_cap_by_email (admin convenience) ───────────────────
-- Admin-only helper so Mark can expand a user's cap without having to
-- look up their auth user_id by hand. Resolves email → user_id, then
-- upserts into user_limits with the new cap.
create or replace function public.set_watchlist_cap_by_email(
  user_email text,
  new_cap integer,
  note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin_only: only admins can set watchlist caps';
  end if;
  if new_cap < 0 or new_cap > 100000 then
    raise exception 'invalid_cap: must be between 0 and 100000, got %', new_cap;
  end if;

  select id into target_id from auth.users where email = user_email limit 1;
  if target_id is null then
    raise exception 'no_such_user: no user with email %', user_email;
  end if;

  insert into public.user_limits (user_id, watchlist_cap, notes, updated_by)
    values (target_id, new_cap, note, auth.uid())
  on conflict (user_id) do update
    set watchlist_cap = excluded.watchlist_cap,
        notes         = coalesce(excluded.notes, public.user_limits.notes),
        updated_at    = now(),
        updated_by    = excluded.updated_by;

  return target_id;
end;
$$;

revoke all on function public.set_watchlist_cap_by_email(text, integer, text) from public;
grant execute on function public.set_watchlist_cap_by_email(text, integer, text) to authenticated;
-- (security definer + admin-check inside means the grant is gated by
--  the function body, not by the role grant.)

-- ── list_user_limits (admin dashboard feed) ──────────────────────────
-- Per-user admin overview. Joins auth.users with hearts /
-- hides / lists / saved-search counts, plus engagement totals over
-- the 30-day window from listing_events, plus the user's most-saved
-- brand pulled out of the listing_snapshot JSON. Admin-only via the
-- is_admin() guard at the top of the function body.
--
-- Engagement counts read raw listing_events (which retains 90 days),
-- not the daily rollup — the rollup intentionally drops user_id when
-- it aggregates by (day, source, listing_id, event_type), so a per-
-- user view has to come from raw.
create or replace function public.list_user_limits()
returns table (
  user_id        uuid,
  email          text,
  hearts_count   bigint,
  hides_count    bigint,
  searches_count bigint,
  lists_count    bigint,
  views_30d      bigint,
  clicks_30d     bigint,
  shares_30d     bigint,
  list_adds_30d  bigint,
  top_brand      text,
  watchlist_cap  integer,
  is_default_cap boolean,
  notes          text,
  updated_at     timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  cutoff timestamptz := now() - interval '30 days';
begin
  if not public.is_admin() then
    return;
  end if;
  return query
  with hearts as (
    select wi.user_id, count(*)::bigint as n
    from public.watchlist_items wi
    where wi.user_id is not null
    group by wi.user_id
  ),
  hides as (
    select hl.user_id, count(*)::bigint as n
    from public.hidden_listings hl
    where hl.user_id is not null
    group by hl.user_id
  ),
  searches as (
    select ss.user_id, count(*)::bigint as n
    from public.saved_searches ss
    where ss.user_id is not null
    group by ss.user_id
  ),
  lists as (
    -- User-created collections excluding the synthetic shared-inbox
    -- so the count reflects intentional list-creation activity.
    select c.user_id, count(*)::bigint as n
    from public.collections c
    where c.user_id is not null and not c.is_shared_inbox
    group by c.user_id
  ),
  events_by_user as (
    select
      le.user_id,
      sum(case when le.event_type = 'view'     then 1 else 0 end)::bigint as views,
      sum(case when le.event_type = 'click'    then 1 else 0 end)::bigint as clicks,
      sum(case when le.event_type = 'share'    then 1 else 0 end)::bigint as shares,
      sum(case when le.event_type = 'list_add' then 1 else 0 end)::bigint as list_adds
    from public.listing_events le
    where le.user_id is not null and le.occurred_at >= cutoff
    group by le.user_id
  ),
  brand_counts as (
    -- Pull "brand" out of the listing_snapshot JSONB. listing_snapshot
    -- is the full Card-renderable payload at save time so this is
    -- always populated for non-corrupt rows. NULL/empty brands roll
    -- into a single "" bucket which we filter out below.
    select
      wi.user_id,
      coalesce(nullif(wi.listing_snapshot->>'brand', ''), 'Other') as brand,
      count(*)::bigint as n
    from public.watchlist_items wi
    where wi.user_id is not null
    group by wi.user_id, brand
  ),
  top_brands as (
    select distinct on (bc.user_id)
      bc.user_id, bc.brand
    from brand_counts bc
    order by bc.user_id, bc.n desc, bc.brand
  )
  -- Explicit text casts: auth.users.email is varchar(255) and
  -- the JSONB-extracted brand is also varchar-ish, but the function
  -- signature declares both as text. Postgres is strict here in
  -- RETURN QUERY from a RETURNS TABLE function and throws 42804
  -- ("structure of query does not match function result type")
  -- without the casts. Don't drop them.
  select
    u.id                                                       as user_id,
    u.email::text                                              as email,
    coalesce(h.n, 0)                                           as hearts_count,
    coalesce(hd.n, 0)                                          as hides_count,
    coalesce(s.n, 0)                                           as searches_count,
    coalesce(l.n, 0)                                           as lists_count,
    coalesce(e.views, 0)                                       as views_30d,
    coalesce(e.clicks, 0)                                      as clicks_30d,
    coalesce(e.shares, 0)                                      as shares_30d,
    coalesce(e.list_adds, 0)                                   as list_adds_30d,
    tb.brand::text                                             as top_brand,
    coalesce(ul.watchlist_cap, public.default_watchlist_cap()) as watchlist_cap,
    (ul.user_id is null)                                       as is_default_cap,
    ul.notes                                                   as notes,
    ul.updated_at                                              as updated_at
  from auth.users u
  left join hearts        h  on h.user_id  = u.id
  left join hides         hd on hd.user_id = u.id
  left join searches      s  on s.user_id  = u.id
  left join lists         l  on l.user_id  = u.id
  left join events_by_user e on e.user_id  = u.id
  left join top_brands    tb on tb.user_id = u.id
  left join public.user_limits ul on ul.user_id = u.id
  where coalesce(h.n, 0) > 0
     or coalesce(hd.n, 0) > 0
     or coalesce(s.n, 0) > 0
     or coalesce(l.n, 0) > 0
     or e.user_id is not null
     or ul.user_id is not null
  order by coalesce(h.n, 0) desc, u.email;
end;
$$;
