-- Manual entries on collection_items + photo storage bucket.
-- 2026-05-06 (PR #87) — second pillar of the Collections build.
--
-- Mark's framing (replayed end-of-day): Owned + Sold lists hold
-- watches that were either (a) acquired from a tracked dealer (link
-- to the existing listing_id, no new fields needed) or (b) entered
-- manually with a photo + brand/model/ref/material + price paid + a
-- few notes. This migration adds the manual-entry shape without
-- forcing any change to the existing listing-backed rows.

-- 1. Allow listing_id to be null (manual entries don't have one).
alter table public.collection_items alter column listing_id drop not null;

-- 2. Manual-entry columns. All nullable; populated only when
--    is_manual=true. Image url points at the watch-photos storage
--    bucket below (or any other publicly-readable URL — the column
--    is opaque on the DB side).
alter table public.collection_items add column if not exists is_manual boolean not null default false;
alter table public.collection_items add column if not exists manual_image_url       text;
alter table public.collection_items add column if not exists manual_brand           text;
alter table public.collection_items add column if not exists manual_model           text;
alter table public.collection_items add column if not exists manual_reference       text;
alter table public.collection_items add column if not exists manual_material        text;
alter table public.collection_items add column if not exists manual_price_paid      numeric;
alter table public.collection_items add column if not exists manual_price_currency  text;
alter table public.collection_items add column if not exists manual_sold_price      numeric;
alter table public.collection_items add column if not exists manual_sold_date       date;
alter table public.collection_items add column if not exists manual_comments        text;

-- 3. Either listing_id is set (listing-backed row) or is_manual=true
--    (manual entry). Never both null. Drop a prior version of the
--    constraint if re-running.
alter table public.collection_items drop constraint if exists collection_items_listing_or_manual;
alter table public.collection_items add constraint collection_items_listing_or_manual
  check (listing_id is not null or is_manual = true);

-- 4. Replace the (collection_id, listing_id) unique index with a
--    partial — the uniqueness rule only makes sense for
--    listing-backed rows. Manual entries can repeat freely (e.g.
--    two of the same reference).
drop index if exists collection_items_unique_per_collection;
create unique index if not exists collection_items_unique_per_collection
  on public.collection_items (collection_id, listing_id)
  where listing_id is not null;

-- ── Storage bucket: watch-photos ─────────────────────────────────
-- Public read so <img src> works without signed URLs (matches the
-- pattern dealer images use: opaque URL embedded in the row, browser
-- fetches without auth). Authenticated users write into a folder
-- prefixed with their auth.uid() — RLS enforces the folder boundary
-- so users can't overwrite each other's photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('watch-photos', 'watch-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Storage policies. RLS on storage.objects is enabled by Supabase
-- by default. Each policy is wrapped in an existence check so the
-- migration is idempotent.

do $$ begin
  if not exists (select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='watch-photos public read') then
    create policy "watch-photos public read"
      on storage.objects for select
      using (bucket_id = 'watch-photos');
  end if;

  if not exists (select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='watch-photos owner write') then
    create policy "watch-photos owner write"
      on storage.objects for insert
      with check (
        bucket_id = 'watch-photos'
        and auth.role() = 'authenticated'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='watch-photos owner delete') then
    create policy "watch-photos owner delete"
      on storage.objects for delete
      using (
        bucket_id = 'watch-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='watch-photos owner update') then
    create policy "watch-photos owner update"
      on storage.objects for update
      using (
        bucket_id = 'watch-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
