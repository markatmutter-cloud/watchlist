-- Reactions on shared list items.
-- 2026-05-10 — Mark spec: when his wife/collaborator browses a
-- shared list, they should be able to "vote" on each watch with a
-- small set of emojis. Realtime is in place (PR #150) so reactions
-- push live to the other person without a refresh.
--
-- Scope: reactions on collection_items only (not comments yet).
-- Emoji set kept small + curated to keep the picker tappable on
-- mobile and the rendered summary readable. Schema is permissive
-- (any string up to 8 chars) so we can extend the picker later
-- without a migration.

create table if not exists public.collection_item_reactions (
  id                  uuid        primary key default gen_random_uuid(),
  collection_item_id  uuid        not null references public.collection_items(id) on delete cascade,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  emoji               text        not null check (length(emoji) between 1 and 8),
  created_at          timestamptz not null default now()
);

-- One reaction per (item, user, emoji). Re-tapping the same emoji is
-- a delete; toggling is the natural gesture. A user can stack
-- multiple distinct emojis on the same item.
create unique index if not exists collection_item_reactions_unique_per_user_emoji
  on public.collection_item_reactions (collection_item_id, user_id, emoji);

create index if not exists collection_item_reactions_by_item
  on public.collection_item_reactions (collection_item_id);

-- RLS: any member of the parent collection (owner or accepted
-- collaborator) can read and write reactions. Editors and viewers
-- BOTH can react — viewers losing the ability to react would defeat
-- the "is this watch interesting?" use case the feature exists for.
alter table public.collection_item_reactions enable row level security;

drop policy if exists "reactions_select_members"  on public.collection_item_reactions;
drop policy if exists "reactions_insert_self_member" on public.collection_item_reactions;
drop policy if exists "reactions_delete_self"     on public.collection_item_reactions;

create policy "reactions_select_members"
  on public.collection_item_reactions
  for select
  using (
    exists (
      select 1 from public.collection_items ci
       where ci.id = collection_item_id
         and public.can_view_collection(ci.collection_id)
    )
  );

create policy "reactions_insert_self_member"
  on public.collection_item_reactions
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.collection_items ci
       where ci.id = collection_item_id
         and public.can_view_collection(ci.collection_id)
    )
  );

create policy "reactions_delete_self"
  on public.collection_item_reactions
  for delete
  using (
    auth.uid() = user_id
  );

-- Realtime publication so co-collaborator reactions push live to the
-- other user's open browser. Mirrors what we did for collections /
-- collection_items / collection_item_comments.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'collection_item_reactions'
  ) then
    alter publication supabase_realtime
      add table public.collection_item_reactions;
  end if;
end $$;

-- list_item_reactions — returns every reaction for items in a
-- collection, plus the reactor's display name resolved through
-- user_profiles → auth metadata. Frontend buckets by item +
-- emoji. Owner-or-collaborator gate enforced inside via
-- can_view_collection so an unrelated user with the URL can't
-- enumerate reactions.

create or replace function public.list_item_reactions(p_collection_id uuid)
returns table (
  id                  uuid,
  collection_item_id  uuid,
  user_id             uuid,
  emoji               text,
  user_name           text,
  created_at          timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if not public.can_view_collection(p_collection_id) then return; end if;
  return query
    select r.id,
           r.collection_item_id,
           r.user_id,
           r.emoji,
           coalesce(
             up.display_name,
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email::text
           ),
           r.created_at
      from public.collection_item_reactions r
      join public.collection_items ci on ci.id = r.collection_item_id
 left join public.user_profiles up    on up.user_id = r.user_id
 left join auth.users u               on u.id = r.user_id
     where ci.collection_id = p_collection_id
     order by r.created_at asc;
end;
$$;

grant execute on function public.list_item_reactions(uuid) to authenticated;
revoke execute on function public.list_item_reactions(uuid) from anon;
