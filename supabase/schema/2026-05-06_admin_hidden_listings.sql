-- Admin-hide curation list (Mark 2026-05-06).
--
-- Mark's framing: "I still want my hidden items to be deleted
-- rather than just hidden — me. as the taste maker I'm fine with.
-- prefer to have good quality stock."
--
-- The Hide menu in Card was per-user (`hidden_listings`); that
-- stays. This new table is a global blocklist — when an admin user
-- (Mark) hides a listing, it's also added here, and the frontend
-- filters mainFeedItems by this set so the listing disappears
-- from EVERY user's live feed.
--
-- Read is anonymous (frontend has to filter for unauthenticated
-- visitors too); write is admin-only via the existing is_admin()
-- function.

create table if not exists public.admin_hidden_listings (
  -- 12-char shortHash(URL) — same shape as watchlist_items.listing_id.
  listing_id text primary key,
  -- Audit: who hid it + when, optional reason. user_id nullable so
  -- a row survives if the admin's auth user is later deleted.
  hidden_by  uuid references auth.users(id) on delete set null,
  hidden_at  timestamptz not null default now(),
  reason     text
);

create index if not exists admin_hidden_listings_hidden_at_idx
  on public.admin_hidden_listings (hidden_at desc);

alter table public.admin_hidden_listings enable row level security;

do $$ begin
  -- Anyone can SELECT — frontend filters mainFeedItems for ALL
  -- users (signed-in, anonymous, admin alike) so the blocklist has
  -- to be readable without auth.
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='admin_hidden_listings'
      and policyname='Anyone select admin hidden listings') then
    create policy "Anyone select admin hidden listings"
      on public.admin_hidden_listings for select using (true);
  end if;
  -- Only admins can INSERT/UPDATE/DELETE — gated by is_admin()
  -- against the admin_emails seed table that already powers the
  -- Site stats dashboard reads.
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='admin_hidden_listings'
      and policyname='Admins manage admin hidden listings') then
    create policy "Admins manage admin hidden listings"
      on public.admin_hidden_listings for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;
