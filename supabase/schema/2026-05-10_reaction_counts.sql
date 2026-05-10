-- Per-list "reactions by other people" counter.
-- 2026-05-10 — Mark spec: "How do I know Jackie reacted to one of my
-- suggestions other than looking at the list?" Surface a count on
-- each list row so a glance at the Lists view tells you "this list
-- has activity from a collaborator."
--
-- Excludes the caller's own reactions (own reactions are noise to
-- the same user — they already know they reacted). Returns one row
-- per collection_id with at least one reaction-by-someone-else.

create or replace function public.list_reaction_counts_for_user()
returns table (
  collection_id           uuid,
  others_reaction_count   int
)
language sql
security definer
stable
set search_path = public
as $$
  select ci.collection_id, count(*)::int
    from public.collection_item_reactions r
    join public.collection_items ci on ci.id = r.collection_item_id
   where public.can_view_collection(ci.collection_id)
     and r.user_id <> auth.uid()
   group by ci.collection_id;
$$;

grant execute on function public.list_reaction_counts_for_user() to authenticated;
revoke execute on function public.list_reaction_counts_for_user() from anon;
