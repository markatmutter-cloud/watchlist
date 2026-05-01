-- Collections + collection_items tables for the Collections + Sharing
-- feature pair. Approach A (minimal migration): the user's default
-- "Watchlist" collection remains backed by the existing watchlist_items
-- table. This file adds storage for ADDITIONAL user-created collections
-- ("For Wife", "Reference comps", ...) plus the auto "Shared with me"
-- collection.
--
-- Run order: paste the entire file into the Supabase SQL editor and
-- execute. Idempotent guard via `if not exists` so running it twice
-- does no harm. RLS policies use `if not exists` via DO blocks because
-- create policy doesn't natively support it on this Postgres version.

-- ── collections ──────────────────────────────────────────────────────
create table if not exists public.collections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text,
  -- Type marker, forward-compatible with future feature surfaces
  -- (challenge collections for build-a-collection, watchbox collections
  -- for ownership tracking). Today only 'free-form' and 'shared-inbox'
  -- are emitted. UI ignores other types in v1.
  type            text not null default 'free-form'
                  check (type in ('free-form', 'shared-inbox', 'challenge', 'watchbox')),
  is_shared_inbox boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One shared-inbox per user — enforced via a partial unique index so
-- there's no extra constraint table. Multiple free-form collections
-- per user are fine.
create unique index if not exists collections_one_shared_inbox_per_user
  on public.collections (user_id)
  where is_shared_inbox = true;

create index if not exists collections_user_id_idx
  on public.collections (user_id);

alter table public.collections enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='collections' and policyname='Users select own collections') then
    create policy "Users select own collections"
      on public.collections for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='collections' and policyname='Users insert own collections') then
    create policy "Users insert own collections"
      on public.collections for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='collections' and policyname='Users update own collections') then
    create policy "Users update own collections"
      on public.collections for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='collections' and policyname='Users delete own collections') then
    create policy "Users delete own collections"
      on public.collections for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ── collection_items ─────────────────────────────────────────────────
-- Items belong to one collection. Snapshot fields denormalized so each
-- item carries enough context to render a Card without joining against
-- listings.json (mirrors the watchlist_items pattern). Same listing can
-- appear in multiple collections (one collection_items row per pairing)
-- but cannot duplicate within a single collection.

create table if not exists public.collection_items (
  id                uuid primary key default gen_random_uuid(),
  collection_id     uuid not null references public.collections(id) on delete cascade,
  -- 12-char sha1(URL) — same shape as watchlist_items.listing_id and
  -- the stable_id used throughout the pipeline.
  listing_id        text not null,
  saved_price       numeric,
  saved_currency    text,
  saved_price_usd   numeric,
  listing_snapshot  jsonb,
  source_of_entry   text not null default 'manual'
                    check (source_of_entry in ('manual', 'shared_with_me')),
  -- Future hook for sender attribution if/when sender identity is
  -- exposed to recipients. Null in v1 by spec.
  shared_by_handle  text,
  added_at          timestamptz not null default now()
);

create unique index if not exists collection_items_unique_per_collection
  on public.collection_items (collection_id, listing_id);

create index if not exists collection_items_collection_id_idx
  on public.collection_items (collection_id);

alter table public.collection_items enable row level security;

-- RLS through the parent collection's user_id — items are reachable
-- only via collections the user owns. Avoids storing user_id twice.
do $$ begin
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='collection_items' and policyname='Users select own collection items') then
    create policy "Users select own collection items"
      on public.collection_items for select
      using (collection_id in (select id from public.collections where user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='collection_items' and policyname='Users insert into own collections') then
    create policy "Users insert into own collections"
      on public.collection_items for insert
      with check (collection_id in (select id from public.collections where user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='collection_items' and policyname='Users update own collection items') then
    create policy "Users update own collection items"
      on public.collection_items for update
      using (collection_id in (select id from public.collections where user_id = auth.uid()))
      with check (collection_id in (select id from public.collections where user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='collection_items' and policyname='Users delete own collection items') then
    create policy "Users delete own collection items"
      on public.collection_items for delete
      using (collection_id in (select id from public.collections where user_id = auth.uid()));
  end if;
end $$;
