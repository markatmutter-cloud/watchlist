-- 2026-05-08 — security-definer RPC for creating user-created lists
-- (free-form collections). Same pattern as create_challenge_v2 from
-- earlier in the day.
--
-- Mark hit "new row violates row-level security policy for table
-- 'collections'" trying to create a new list via the
-- CollectionPickerModal "+ Create new list" inline form. The
-- underlying cause is the same RLS-rejection-under-authenticated-role
-- quirk that blocked challenge create — see the long-form rationale
-- in 2026-05-08_challenge_rpc.sql. That issue stands open
-- (project-specific relcache / policy-evaluation behavior we never
-- fully diagnosed); the established pragmatic fix is to bypass RLS
-- via a SECURITY DEFINER function that resolves auth.uid() internally
-- so a malicious caller can't spoof user_id.
--
-- This function covers free-form list creation. The shared-inbox
-- create path (ensureSharedInbox) and the hard-system-list auto-create
-- (Owned / Sold / Wishlist on first sign-in) still use direct INSERT;
-- if they break for a future user the same way, route them through
-- this function or a sibling RPC. For Mark personally those rows
-- already exist so the direct INSERTs don't fire on his account.

create or replace function public.create_collection_v2(
  p_name text,
  p_description text default null,
  p_type text default 'free-form',
  p_is_shared_inbox boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_id uuid;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;
  -- Defense: refuse to create system lists via this RPC. System lists
  -- (is_system=true) belong to the hard-list auto-create path; routing
  -- them through here would bypass that path's idempotency guard.
  -- Challenge creation has its own RPC (create_challenge_v2) — refuse
  -- that type too so callers don't bypass the challenge-specific
  -- column writes.
  if p_type = 'challenge' then
    raise exception 'use create_challenge_v2 for challenge creation';
  end if;
  insert into public.collections (
    user_id, name, description, type, is_shared_inbox
  )
  values (
    uid, p_name, p_description, p_type, p_is_shared_inbox
  )
  returning id into new_id;
  return new_id;
end $$;

grant execute on function public.create_collection_v2 to authenticated;
