-- List Sharing v2.1 — token-based invite acceptance.
--
-- Background: the original `accept_invite` (2026-05-07) gates on
-- email match — caller's auth.email() must equal invited_email
-- (case-insensitive). That works when the owner types the exact
-- Google address the invitee will sign in with. In practice a lot
-- of invites fail this gate: the owner types `firstname@gmail.com`
-- but the invitee's Google account is `firstname.lastname@gmail.com`,
-- or `firstname+work@gmail.com`, or a different alias. Result: the
-- invitee opens the link, lands on the receiver, sees "Save a copy"
-- (read-only path) instead of "Accept invite", and the
-- collaborator gate is never crossed.
--
-- This RPC pairs with a URL token (`?invite=<invite_id>`) that the
-- owner sends out via the share sheet. Anyone with the link can
-- accept the invite as themselves, regardless of email match — the
-- secret of the URL substitutes for email matching. This is the
-- right tradeoff for Mark's family/friends-sharing use case AND
-- consistent with `get_public_list` already being anonymously
-- readable from the same URL pattern (the list is already
-- effectively public to anyone with the link).
--
-- Idempotent if already accepted by the same caller (returns
-- silently, useful when the receiver page re-mounts). If accepted
-- by a different user, raises so the second caller gets a clear
-- error.

create or replace function public.accept_invite_by_token(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv record;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select id, collection_id, status, user_id
    into inv
    from public.collection_collaborators
   where id = p_invite_id;
  if inv.id is null then
    raise exception 'invite not found' using errcode = '02000';
  end if;
  -- Already accepted by THIS user? No-op.
  if inv.status = 'accepted' and inv.user_id = uid then
    return;
  end if;
  -- Accepted by someone else → don't let the link transfer ownership.
  if inv.status = 'accepted' then
    raise exception 'this invite has already been accepted by another user' using errcode = '42501';
  end if;
  if inv.status <> 'pending' then
    raise exception 'invite is not pending' using errcode = '22023';
  end if;
  update public.collection_collaborators
     set status = 'accepted',
         user_id = uid,
         responded_at = now()
   where id = p_invite_id;
end;
$$;

grant execute on function public.accept_invite_by_token(uuid) to authenticated;
revoke execute on function public.accept_invite_by_token(uuid) from anon;

-- ── pending_invite_by_token ──────────────────────────────────────
--
-- Read side for the receiver: given an invite token, return the
-- pending invite metadata (without requiring email match) so the
-- receiver page can surface "X invited you to {list} as {role}.
-- Accept?" inline. Returns nothing if the invite is missing,
-- already accepted/declined, or for a different list.

create or replace function public.pending_invite_by_token(p_invite_id uuid)
returns table (
  invite_id      uuid,
  collection_id  uuid,
  inviter_email  text,
  inviter_name   text,
  role           text,
  invited_email  text,
  status         text,
  created_at     timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return query
    select cc.id,
           cc.collection_id,
           u.email::text,
           coalesce(
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email
           )::text,
           cc.role,
           cc.invited_email,
           cc.status,
           cc.created_at
      from public.collection_collaborators cc
      join auth.users u on u.id = cc.invited_by
     where cc.id = p_invite_id
     limit 1;
end;
$$;

grant execute on function public.pending_invite_by_token(uuid) to authenticated;
revoke execute on function public.pending_invite_by_token(uuid) from anon;
