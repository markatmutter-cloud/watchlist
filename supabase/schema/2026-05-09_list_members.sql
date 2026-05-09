-- List Sharing v2 / slice 4 — member roster RPC.
--
-- `list_collaborators` is owner-only: the wife/collaborator can't
-- call it to read who else is on the list. For the `who_added`
-- attribution chip we need every member (including the recipient
-- themselves and the owner) to be able to read the names of
-- everyone who can add items to a shared list, so the chip can
-- render "Added by Mark" / "Added by Jacquelin" instead of a bare
-- UUID.
--
-- This RPC returns: the owner + every accepted collaborator. Gates
-- on "caller is a member" (owner or accepted collaborator), so
-- random users with the list URL can't enumerate names — the chip
-- only renders for actual members anyway.
--
-- Returns id + name + email for each member. The frontend builds a
-- Map<user_id, display_name> at drill-in time and looks up the
-- chip text from `collection_items.who_added`.

create or replace function public.list_members_for_collection(p_collection_id uuid)
returns table (
  user_id    uuid,
  user_email text,
  user_name  text,
  is_owner   boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_uid uuid;
  is_member boolean;
begin
  if uid is null then return; end if;
  select c.user_id into owner_uid from public.collections c where c.id = p_collection_id;
  if owner_uid is null then return; end if;

  -- Caller must be the owner OR an accepted collaborator.
  is_member := (uid = owner_uid) or exists (
    select 1 from public.collection_collaborators cc
     where cc.collection_id = p_collection_id
       and cc.user_id = uid
       and cc.status = 'accepted'
  );
  if not is_member then return; end if;

  -- Owner row.
  return query
    select u.id,
           u.email::text,
           coalesce(
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email::text
           ),
           true
      from auth.users u
     where u.id = owner_uid;

  -- Accepted collaborator rows.
  return query
    select u.id,
           u.email::text,
           coalesce(
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email::text
           ),
           false
      from public.collection_collaborators cc
      join auth.users u on u.id = cc.user_id
     where cc.collection_id = p_collection_id
       and cc.status = 'accepted';
end;
$$;

grant execute on function public.list_members_for_collection(uuid) to authenticated;
revoke execute on function public.list_members_for_collection(uuid) from anon;
