-- Site analytics — User stats half (Epic 8).
--
-- Demand-side telemetry: views, clicks, saves, hides, list-adds, shares.
-- Anonymous-friendly: anon UUID kept in localStorage so first-time
-- visitors get counted even before they sign in. Reads are admin-only
-- via RLS.
--
-- Run order: paste the entire file into the Supabase SQL editor and
-- execute. Idempotent — running it twice does no harm. The seed step
-- for `admin_emails` at the bottom is the one place a human edit is
-- needed (replace the placeholder with the actual admin email(s)).

-- ── admin_emails (auth gate for SELECT on listing_events) ────────────
-- Mirrors REACT_APP_ADMIN_EMAILS frontend gate at the DB layer.
-- No RLS policies on this table = no client read/write access; only
-- the Supabase SQL editor / service role can mutate. Seed via SQL
-- editor when the admin set changes.
create table if not exists public.admin_emails (
  email text primary key
);
alter table public.admin_emails enable row level security;

-- ── is_admin() ───────────────────────────────────────────────────────
-- Used as the SELECT predicate on listing_events + listing_events_daily.
-- security definer so RLS on admin_emails (no policies = no read for
-- anyone) doesn't block the lookup.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'email') in (select email from public.admin_emails),
    false
  );
$$;

-- ── listing_events (raw event table) ─────────────────────────────────
-- One row per event. event_type is checked at write time. source is
-- denormalized from the listing payload at fire time so per-source
-- aggregation is a simple group-by. anon_session_id stays nullable so
-- a server-side cron or a future auth-required endpoint can write
-- with only user_id; user_id stays nullable so anonymous browsers
-- can write with only the session UUID.
create table if not exists public.listing_events (
  id              bigserial primary key,
  listing_id      text not null,
  event_type      text not null
                  check (event_type in ('view','click','save','hide','list_add','share')),
  source          text,
  anon_session_id text,
  user_id         uuid references auth.users(id) on delete set null,
  occurred_at     timestamptz not null default now()
);

create index if not exists listing_events_occurred_at_idx
  on public.listing_events (occurred_at);
create index if not exists listing_events_listing_id_idx
  on public.listing_events (listing_id);
create index if not exists listing_events_event_type_idx
  on public.listing_events (event_type);
create index if not exists listing_events_source_idx
  on public.listing_events (source);

alter table public.listing_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='listing_events' and policyname='Anyone insert listing events') then
    create policy "Anyone insert listing events"
      on public.listing_events for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='listing_events' and policyname='Admins select listing events') then
    create policy "Admins select listing events"
      on public.listing_events for select using (public.is_admin());
  end if;
end $$;

-- ── listing_events_daily (rollup table) ──────────────────────────────
-- Per-day, per-source, per-listing, per-event-type counts. Survives
-- raw-event pruning so admin queries can see history beyond the raw
-- retention window. Querying:
--   per-source totals  → group by day, source, event_type
--   per-listing totals → filter by listing_id, group by event_type
create table if not exists public.listing_events_daily (
  day         date not null,
  source      text not null default '',
  listing_id  text not null default '',
  event_type  text not null,
  count       integer not null default 0,
  primary key (day, source, listing_id, event_type)
);

create index if not exists listing_events_daily_source_idx
  on public.listing_events_daily (source, day);
create index if not exists listing_events_daily_listing_id_idx
  on public.listing_events_daily (listing_id, day);

alter table public.listing_events_daily enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='listing_events_daily' and policyname='Admins select listing events daily') then
    create policy "Admins select listing events daily"
      on public.listing_events_daily for select using (public.is_admin());
  end if;
end $$;

-- ── rollup_and_prune_listing_events() ────────────────────────────────
-- Idempotent. Aggregates the current contents of listing_events into
-- listing_events_daily (upsert), then deletes raw events older than
-- the retention window. Default 90 days — passed in by the cron caller
-- so the threshold is tunable in one place (the workflow file).
--
-- Order matters: rollup BEFORE prune. If the prune ran first, events
-- in the cutoff window would be lost before being aggregated.
create or replace function public.rollup_and_prune_listing_events(retain_days integer default 90)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz;
begin
  cutoff := now() - make_interval(days => retain_days);

  -- Recompute daily aggregates for every day with raw events present.
  -- ON CONFLICT overwrite is correct: this run sees all raw events for
  -- the day (the prune runs after); next run sees the same set unless
  -- new late-arriving events come in (re-aggregated correctly).
  insert into public.listing_events_daily (day, source, listing_id, event_type, count)
    select
      (occurred_at at time zone 'UTC')::date,
      coalesce(source, ''),
      listing_id,
      event_type,
      count(*)::integer
    from public.listing_events
    group by 1, 2, 3, 4
  on conflict (day, source, listing_id, event_type) do update
    set count = excluded.count;

  delete from public.listing_events where occurred_at < cutoff;
end;
$$;

-- Restrict execution to authenticated callers — service-role key (used
-- by the GitHub Actions cron) qualifies; anonymous browsers do not.
revoke all on function public.rollup_and_prune_listing_events(integer) from public;
grant execute on function public.rollup_and_prune_listing_events(integer) to service_role;

-- ── source_engagement_summary() ──────────────────────────────────────
-- Per-source engagement counts over a rolling window. Used by the
-- AdminTab Source quality dashboard. security invoker so the
-- listing_events_daily SELECT RLS gates reads to admins; non-admin
-- callers get an empty result set without an error.
--
-- Reads only the rollup table — today's raw events show up after the
-- next daily rollup runs. Tradeoff is cleanliness of the query vs.
-- live-testability; admins can trigger the rollup manually from the
-- SQL editor (`select public.rollup_and_prune_listing_events();`)
-- when validating telemetry wiring.
create or replace function public.source_engagement_summary(window_days integer default 30)
returns table (
  source     text,
  views      bigint,
  clicks     bigint,
  saves      bigint,
  hides      bigint,
  list_adds  bigint,
  shares     bigint
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    coalesce(source, '')                                       as source,
    sum(case when event_type='view'     then count else 0 end)::bigint as views,
    sum(case when event_type='click'    then count else 0 end)::bigint as clicks,
    sum(case when event_type='save'     then count else 0 end)::bigint as saves,
    sum(case when event_type='hide'     then count else 0 end)::bigint as hides,
    sum(case when event_type='list_add' then count else 0 end)::bigint as list_adds,
    sum(case when event_type='share'    then count else 0 end)::bigint as shares
  from public.listing_events_daily
  where day >= ((now() at time zone 'UTC')::date - make_interval(days => window_days))
  group by coalesce(source, '');
$$;

-- ── Seed admin_emails (manual step) ──────────────────────────────────
-- Replace the email below with the actual admin email(s) before
-- enabling. Match the REACT_APP_ADMIN_EMAILS env var used by the
-- frontend gate.
--
--   insert into public.admin_emails (email) values ('you@example.com')
--   on conflict (email) do nothing;
