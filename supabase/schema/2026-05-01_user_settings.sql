-- User settings table — kitchen-sink home for user-level preferences
-- (cross-device, unlike theme/column-count which are per-device and live
-- in localStorage). v1 holds only `primary_currency`; future fields go
-- here too (default sort, notification opt-ins, etc.) so we don't
-- proliferate one-off tables.
--
-- One row per user, keyed by user_id. The row is created lazily on
-- first save — useUserSettings emits an upsert, so a missing row is
-- fine and the hook's defaults take over until the user changes
-- something.
--
-- Run order: paste into the Supabase SQL editor and execute.
-- Idempotent — `if not exists` on table, index, policies. Safe to re-run.

create table if not exists public.user_settings (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  -- ISO 4217 codes. v1 surface is USD / GBP / EUR. The check
  -- constraint keeps drift in check; add new codes here as more
  -- currencies surface.
  primary_currency  text not null default 'USD'
                    check (primary_currency in ('USD', 'GBP', 'EUR')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.user_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='user_settings' and policyname='Users select own settings') then
    create policy "Users select own settings"
      on public.user_settings for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='user_settings' and policyname='Users insert own settings') then
    create policy "Users insert own settings"
      on public.user_settings for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='user_settings' and policyname='Users update own settings') then
    create policy "Users update own settings"
      on public.user_settings for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
