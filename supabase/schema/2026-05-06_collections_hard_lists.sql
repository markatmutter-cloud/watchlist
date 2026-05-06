-- Collections feature build-out 2026-05-06: hard system lists.
--
-- Mark's framing (replayed end of 2026-05-06 session): everything is
-- a list — Owned, Sold, Wishlist, Challenges, regular user lists. Add
-- three system-flagged collections that auto-create per user and
-- can't be deleted: Owned (current watches), Sold (your journey),
-- Wishlist (force-rankable in a future PR).
--
-- Two changes:
-- 1. Extend the `type` check constraint to allow 'owned' / 'sold' /
--    'wishlist'. Existing 'free-form' / 'shared-inbox' / 'challenge'
--    / 'watchbox' values still allowed.
-- 2. Add `is_system` boolean (default false). Used by the frontend
--    to hide the Delete affordance and pin these rows at the top of
--    the Collections list with prominent visual treatment.
--
-- Auto-creation happens client-side in useCollections() — same
-- pattern as the shared-inbox auto-create. RLS already covers insert
-- (auth.uid() = user_id), so no policy change needed.

alter table public.collections drop constraint if exists collections_type_check;
alter table public.collections add constraint collections_type_check
  check (type in (
    'free-form', 'shared-inbox', 'challenge', 'watchbox',
    'owned', 'sold', 'wishlist'
  ));

alter table public.collections add column if not exists is_system boolean not null default false;

-- Defense-in-depth: a trigger that prevents DELETE on system lists
-- even if the client misses the guard. Mirrors the watchlist_items
-- enforce_watchlist_cap pattern (UI gate + DB enforcement).
create or replace function public.prevent_system_collection_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_system = true then
    raise exception 'Cannot delete a system collection (id=%, name=%)', old.id, old.name
      using errcode = 'P0001';
  end if;
  return old;
end
$$;

drop trigger if exists prevent_system_collection_delete_trigger on public.collections;
create trigger prevent_system_collection_delete_trigger
  before delete on public.collections
  for each row execute function public.prevent_system_collection_delete();
