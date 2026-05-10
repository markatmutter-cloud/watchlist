-- 2026-05-10: covering indexes on 7 foreign keys flagged by the
-- Supabase advisor `unindexed_foreign_keys` lint.
--
-- Without a covering index on the FK column, Postgres has to do a
-- sequential scan to enforce ON DELETE / ON UPDATE actions, and joins
-- using the FK column hit the same penalty. At the current row counts
-- (low thousands per table) this is not yet biting, but the cost of
-- adding the indexes is near-zero and the indexes pay off as soon as
-- a join lands on the column.
--
-- One particularly worth-it: collection_items.who_added drives the
-- "who_added" attribution chip on every shared-list render. Joins
-- through list_members_for_collection's user-profile coalesce path
-- benefit immediately.
--
-- All idempotent.

create index if not exists admin_hidden_listings_hidden_by_idx
  on public.admin_hidden_listings (hidden_by);

create index if not exists collection_collaborators_invited_by_idx
  on public.collection_collaborators (invited_by);

create index if not exists collection_item_comments_user_id_idx
  on public.collection_item_comments (user_id);

create index if not exists collection_item_reactions_user_id_idx
  on public.collection_item_reactions (user_id);

create index if not exists collection_items_who_added_idx
  on public.collection_items (who_added);

create index if not exists listing_events_user_id_idx
  on public.listing_events (user_id);

create index if not exists user_limits_updated_by_idx
  on public.user_limits (updated_by);
