-- Collaborator slice 2 — RPCs.
--
-- Four security-definer RPCs that gate writes on the
-- collection_collaborators table. Slice 1 RLS denies all direct
-- writes from the client; these RPCs are the only path. Each one
-- enforces its own owner / invitee check inside the function so
-- the gate isn't relying on RLS round-trips.
--
-- Run order: paste into the Supabase SQL editor and execute AFTER
-- 2026-05-07_collection_collaborators.sql. Idempotent.

-- ── invite_collaborator ───────────────────────────────────────────
--
-- Owner adds a collaborator to one of their collections by email.
-- If the email already maps to a Supabase user, user_id is filled
-- in at invite time so accept_invite has nothing to resolve.
-- Otherwise, user_id stays null and gets set when the invitee
-- accepts (which gates on email match against auth.email()).
--
-- Idempotent on (collection_id, email): if a pending invite already
-- exists, returns the existing row id rather than creating a
-- duplicate (the partial unique index would block a second insert
-- anyway). Re-inviting after a previous decline creates a new row.

create or replace function public.invite_collaborator(
  p_collection_id uuid,
  p_email         text,
  p_role          text default 'editor'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_uid uuid;
  normalized_email text := lower(trim(p_email));
  resolved_user_id uuid;
  existing_id uuid;
  new_id uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if normalized_email = '' then raise exception 'email required' using errcode = '22023'; end if;
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if p_role not in ('viewer', 'editor') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  -- Confirm the caller owns the collection.
  select user_id into owner_uid from public.collections where id = p_collection_id;
  if owner_uid is null then
    raise exception 'collection not found' using errcode = '02000';
  end if;
  if owner_uid <> uid then
    raise exception 'only the owner can invite collaborators' using errcode = '42501';
  end if;

  -- Self-invite refuse.
  if lower(coalesce((select email from auth.users where id = uid), '')) = normalized_email then
    raise exception 'cannot invite yourself' using errcode = '22023';
  end if;

  -- Resolve the email to an existing user_id when possible.
  select id into resolved_user_id
    from auth.users
   where lower(email) = normalized_email
   limit 1;

  -- If the resolved user is already an accepted collaborator, no-op.
  if resolved_user_id is not null then
    if exists (
      select 1 from public.collection_collaborators
       where collection_id = p_collection_id
         and user_id = resolved_user_id
         and status = 'accepted'
    ) then
      raise exception 'already a collaborator' using errcode = '23505';
    end if;
  end if;

  -- Idempotent: if a pending invite already exists for this email +
  -- collection, return its id.
  select id into existing_id
    from public.collection_collaborators
   where collection_id = p_collection_id
     and lower(invited_email) = normalized_email
     and status = 'pending'
   limit 1;
  if existing_id is not null then return existing_id; end if;

  insert into public.collection_collaborators
    (collection_id, user_id, invited_email, role, status, invited_by)
    values (p_collection_id, resolved_user_id, normalized_email, p_role, 'pending', uid)
    returning id into new_id;
  return new_id;
end;
$$;

-- ── accept_invite ─────────────────────────────────────────────────
--
-- Invitee accepts a pending invite. Auth check: the caller's email
-- must match the invite's `invited_email` (case-insensitive). On
-- accept we also resolve `user_id` to the caller — so even if the
-- invite was created before the invitee signed up, accept_invite
-- fills it in.

create or replace function public.accept_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_email text;
  inv record;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select lower(email) into caller_email from auth.users where id = uid;
  if caller_email is null then
    raise exception 'caller email missing' using errcode = '42501';
  end if;
  select id, collection_id, invited_email, status into inv
    from public.collection_collaborators
   where id = p_invite_id;
  if inv.id is null then raise exception 'invite not found' using errcode = '02000'; end if;
  if inv.status <> 'pending' then
    raise exception 'invite is not pending' using errcode = '22023';
  end if;
  if lower(inv.invited_email) <> caller_email then
    raise exception 'this invite is for a different email' using errcode = '42501';
  end if;
  update public.collection_collaborators
     set status = 'accepted',
         user_id = uid,
         responded_at = now()
   where id = p_invite_id;
end;
$$;

-- ── decline_invite ────────────────────────────────────────────────
--
-- Same auth shape as accept_invite — the caller's email must match.
-- Sets status='declined' so the row stays for audit; the partial
-- unique index allows a re-invite later.

create or replace function public.decline_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_email text;
  inv record;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select lower(email) into caller_email from auth.users where id = uid;
  if caller_email is null then
    raise exception 'caller email missing' using errcode = '42501';
  end if;
  select id, invited_email, status into inv
    from public.collection_collaborators
   where id = p_invite_id;
  if inv.id is null then raise exception 'invite not found' using errcode = '02000'; end if;
  if inv.status <> 'pending' then
    raise exception 'invite is not pending' using errcode = '22023';
  end if;
  if lower(inv.invited_email) <> caller_email then
    raise exception 'this invite is for a different email' using errcode = '42501';
  end if;
  update public.collection_collaborators
     set status = 'declined',
         responded_at = now()
   where id = p_invite_id;
end;
$$;

-- ── revoke_collaborator ───────────────────────────────────────────
--
-- Owner removes a collaborator (or pending invite). Hard-delete via
-- the on-delete-cascade chain; if needed for audit later we can
-- switch to a status='revoked' soft-delete (the check constraint
-- would need expansion).
--
-- Targets either:
--   * an accepted user (pass user_id, leave invite_id null), OR
--   * a specific invite row by id (pass invite_id, leave user_id null)

create or replace function public.revoke_collaborator(
  p_collection_id uuid,
  p_user_id       uuid default null,
  p_invite_id     uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_uid uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select user_id into owner_uid from public.collections where id = p_collection_id;
  if owner_uid is null then raise exception 'collection not found' using errcode = '02000'; end if;
  if owner_uid <> uid then
    raise exception 'only the owner can revoke collaborators' using errcode = '42501';
  end if;
  if p_invite_id is not null then
    delete from public.collection_collaborators
     where id = p_invite_id and collection_id = p_collection_id;
  elsif p_user_id is not null then
    delete from public.collection_collaborators
     where collection_id = p_collection_id and user_id = p_user_id;
  else
    raise exception 'pass either p_user_id or p_invite_id' using errcode = '22023';
  end if;
end;
$$;

-- ── pending_invites_for_me ────────────────────────────────────────
--
-- Returns all pending invites whose invited_email matches the
-- caller's auth email. Drives the dropdown badge + accept/decline
-- modal in slice 3. Joins to `collections` for the list name + to
-- `auth.users` for the inviter name.

create or replace function public.pending_invites_for_me()
returns table (
  invite_id      uuid,
  collection_id  uuid,
  collection_name text,
  inviter_email  text,
  inviter_name   text,
  role           text,
  invited_email  text,
  created_at     timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_email text;
begin
  if uid is null then return; end if;
  select lower(email) into caller_email from auth.users where id = uid;
  if caller_email is null then return; end if;
  return query
    select cc.id,
           cc.collection_id,
           c.name,
           u.email,
           coalesce(
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email
           ),
           cc.role,
           cc.invited_email,
           cc.created_at
      from public.collection_collaborators cc
      join public.collections c on c.id = cc.collection_id
      join auth.users u on u.id = cc.invited_by
     where cc.status = 'pending'
       and lower(cc.invited_email) = caller_email
     order by cc.created_at desc;
end;
$$;

-- ── list_collaborators ────────────────────────────────────────────
--
-- Returns the collaborator + pending-invite roster for a collection.
-- Owner-only — call from the Manage-list sheet (slice 2 UI). The
-- function checks ownership inside, so no caller-side gate needed.

create or replace function public.list_collaborators(p_collection_id uuid)
returns table (
  invite_id     uuid,
  user_id       uuid,
  invited_email text,
  role          text,
  status        text,
  user_email    text,
  user_name     text,
  created_at    timestamptz,
  responded_at  timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_uid uuid;
begin
  if uid is null then return; end if;
  -- Alias the table so unqualified `user_id` resolves to the column
  -- and not the RETURNS TABLE OUT parameter of the same name.
  -- Without the alias, plpgsql raises "column reference 'user_id' is
  -- ambiguous" because the function's OUT params shadow column names.
  -- (Mark hit this trying to open the Manage list sheet, 2026-05-08.)
  select c.user_id into owner_uid from public.collections c where c.id = p_collection_id;
  if owner_uid is null or owner_uid <> uid then return; end if;
  return query
    select cc.id,
           cc.user_id,
           cc.invited_email,
           cc.role,
           cc.status,
           u.email::text,
           coalesce(
             u.raw_user_meta_data->>'full_name',
             u.raw_user_meta_data->>'name',
             u.email::text
           ),
           cc.created_at,
           cc.responded_at
      from public.collection_collaborators cc
      left join auth.users u on u.id = cc.user_id
     where cc.collection_id = p_collection_id
       and cc.status in ('pending', 'accepted')
     order by cc.created_at asc;
end;
$$;
-- 2026-05-08 follow-up: u.email is varchar in auth.users; cast to text
-- inside the SELECT to match the RETURNS TABLE user_email text column,
-- otherwise Postgres raises "structure of query does not match function
-- result type" once a real auth.users row joins the result. Same fix
-- pattern in any future RPC that reads auth.users.email.

-- Grant execute to authenticated only (anon never invites or accepts).
grant execute on function public.invite_collaborator(uuid, text, text) to authenticated;
grant execute on function public.accept_invite(uuid)                   to authenticated;
grant execute on function public.decline_invite(uuid)                  to authenticated;
grant execute on function public.revoke_collaborator(uuid, uuid, uuid) to authenticated;
grant execute on function public.pending_invites_for_me()              to authenticated;
grant execute on function public.list_collaborators(uuid)              to authenticated;
