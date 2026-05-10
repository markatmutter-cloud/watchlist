-- 2026-05-10: wrap auth.uid() / auth.email() in (select …) across
-- every RLS policy in `public`.
--
-- Supabase's database advisor flagged 26 policies with the
-- `auth_rls_initplan` warning. The fix Postgres-side is to wrap the
-- call in a SELECT subquery — Postgres treats it as an InitPlan and
-- evaluates the value once per query instead of re-running the
-- function for every row. Semantically identical; just faster at
-- scale.
--
-- Pattern:
--   using (user_id = auth.uid())
--     →  using (user_id = (select auth.uid()))
--
--   with check (user_id = auth.uid())
--     →  with check (user_id = (select auth.uid()))
--
-- The drop-and-recreate pattern is the cleanest path on hosted
-- Supabase — there's no `alter policy … using (…)` form that's
-- supported reliably across releases.
--
-- One caveat that affects ZERO of the policies below but is worth
-- noting for next time: every policy here uses the default
-- `roles={public}` scope. Per CLAUDE.md "Don't add `to authenticated`
-- to a new RLS policy unless every other policy on the same table
-- already uses the same role scope" — we keep `public` to maintain
-- consistency. The unauthenticated case (auth.uid() returns null)
-- naturally fails the equality test.

-- ─────────────────────────────────────────────────────────────────
-- watchlist_items
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "own watchlist select" on public.watchlist_items;
create policy "own watchlist select" on public.watchlist_items
  for select using ((select auth.uid()) = user_id);

drop policy if exists "own watchlist insert" on public.watchlist_items;
create policy "own watchlist insert" on public.watchlist_items
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "own watchlist update" on public.watchlist_items;
create policy "own watchlist update" on public.watchlist_items
  for update using ((select auth.uid()) = user_id);

drop policy if exists "own watchlist delete" on public.watchlist_items;
create policy "own watchlist delete" on public.watchlist_items
  for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────
-- hidden_listings
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "own hidden select" on public.hidden_listings;
create policy "own hidden select" on public.hidden_listings
  for select using ((select auth.uid()) = user_id);

drop policy if exists "own hidden insert" on public.hidden_listings;
create policy "own hidden insert" on public.hidden_listings
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "own hidden delete" on public.hidden_listings;
create policy "own hidden delete" on public.hidden_listings
  for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────
-- saved_searches
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "own searches select" on public.saved_searches;
create policy "own searches select" on public.saved_searches
  for select using ((select auth.uid()) = user_id);

drop policy if exists "own searches insert" on public.saved_searches;
create policy "own searches insert" on public.saved_searches
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "own searches update" on public.saved_searches;
create policy "own searches update" on public.saved_searches
  for update using ((select auth.uid()) = user_id);

drop policy if exists "own searches delete" on public.saved_searches;
create policy "own searches delete" on public.saved_searches
  for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────
-- tracked_lots
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "Users see their own tracked lots" on public.tracked_lots;
create policy "Users see their own tracked lots" on public.tracked_lots
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Users add their own tracked lots" on public.tracked_lots;
create policy "Users add their own tracked lots" on public.tracked_lots
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own tracked lots" on public.tracked_lots;
create policy "Users delete their own tracked lots" on public.tracked_lots
  for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────
-- user_settings
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "Users select own settings" on public.user_settings;
create policy "Users select own settings" on public.user_settings
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own settings" on public.user_settings;
create policy "Users insert own settings" on public.user_settings
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own settings" on public.user_settings;
create policy "Users update own settings" on public.user_settings
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────
-- user_limits
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "Users select own limit" on public.user_limits;
create policy "Users select own limit" on public.user_limits
  for select using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────
-- collections
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "Users insert owned collections" on public.collections;
create policy "Users insert owned collections" on public.collections
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users update owned collections" on public.collections;
create policy "Users update owned collections" on public.collections
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete owned collections" on public.collections;
create policy "Users delete owned collections" on public.collections
  for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────
-- collection_items
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "Users delete own additions" on public.collection_items;
create policy "Users delete own additions" on public.collection_items
  for delete using (
    (select auth.uid()) = who_added
    OR (select auth.uid()) IN (
      SELECT collections.user_id
      FROM collections
      WHERE collections.id = collection_items.collection_id
    )
  );

drop policy if exists "Users update own additions" on public.collection_items;
create policy "Users update own additions" on public.collection_items
  for update using (
    (select auth.uid()) = who_added
    OR (select auth.uid()) IN (
      SELECT collections.user_id
      FROM collections
      WHERE collections.id = collection_items.collection_id
    )
  )
  with check (can_edit_collection(collection_id));

-- ─────────────────────────────────────────────────────────────────
-- collection_collaborators
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "Owners + invitees see collaborators" on public.collection_collaborators;
create policy "Owners + invitees see collaborators" on public.collection_collaborators
  for select using (
    (select auth.uid()) IN (
      SELECT collections.user_id
      FROM collections
      WHERE collections.id = collection_collaborators.collection_id
    )
    OR (select auth.uid()) = user_id
    OR (status = 'pending'::text AND lower(invited_email) = lower(COALESCE((select auth.email()), ''::text)))
  );

-- ─────────────────────────────────────────────────────────────────
-- collection_item_comments
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "members can post comments" on public.collection_item_comments;
create policy "members can post comments" on public.collection_item_comments
  for insert with check (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM collection_items ci
      WHERE ci.id = collection_item_comments.collection_item_id
        AND can_edit_collection(ci.collection_id)
    )
  );

drop policy if exists "author can edit own comment" on public.collection_item_comments;
create policy "author can edit own comment" on public.collection_item_comments
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "author can delete own comment" on public.collection_item_comments;
create policy "author can delete own comment" on public.collection_item_comments
  for delete using (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────
-- user_profiles
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "user_profiles_insert_self" on public.user_profiles;
create policy "user_profiles_insert_self" on public.user_profiles
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "user_profiles_update_self" on public.user_profiles;
create policy "user_profiles_update_self" on public.user_profiles
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────
-- collection_item_reactions
-- ─────────────────────────────────────────────────────────────────
drop policy if exists "reactions_insert_self_member" on public.collection_item_reactions;
create policy "reactions_insert_self_member" on public.collection_item_reactions
  for insert with check (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM collection_items ci
      WHERE ci.id = collection_item_reactions.collection_item_id
        AND can_view_collection(ci.collection_id)
    )
  );

drop policy if exists "reactions_delete_self" on public.collection_item_reactions;
create policy "reactions_delete_self" on public.collection_item_reactions
  for delete using ((select auth.uid()) = user_id);
