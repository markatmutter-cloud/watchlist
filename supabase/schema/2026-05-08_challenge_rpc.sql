-- 2026-05-08 — security-definer RPC for creating challenges.
--
-- Mark's project hit a state where direct INSERT into `collections`
-- under role `authenticated` was rejected by RLS regardless of the
-- WITH CHECK expression — even `with check (true)` failed. Isolated
-- SQL tests confirmed:
--   - The role switch was working (current_user = authenticated)
--   - auth.uid() returned the correct UUID under the simulated session
--   - The literal `auth.uid() = user_id` expression evaluated to TRUE
--     in a SELECT
--   - Yet the WITH CHECK still rejected the INSERT
--
-- We never fully diagnosed the root cause (likely a relcache /
-- policy-evaluation quirk specific to Mark's project). The pragmatic
-- fix is to bypass RLS via a `security definer` function that:
--   1. Resolves the caller's auth.uid() from their JWT
--   2. Refuses if uid is null (truly anonymous)
--   3. Inserts user_id := uid (so a malicious caller can't insert
--      under another user's id even though RLS is bypassed)
--
-- This is the standard Supabase pattern for cross-table /
-- multi-step inserts that hit RLS edge cases.

create or replace function public.create_challenge_v2(
  p_name text,
  p_target_count int,
  p_budget numeric,
  p_description_long text default null,
  p_parent_challenge_id uuid default null,
  p_sender_name text default null
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
  insert into public.collections (
    user_id, name, type, state, target_count, budget,
    description_long, parent_challenge_id, sender_name
  )
  values (
    uid, p_name, 'challenge', 'draft', p_target_count, p_budget,
    p_description_long, p_parent_challenge_id, p_sender_name
  )
  returning id into new_id;
  return new_id;
end $$;

grant execute on function public.create_challenge_v2 to authenticated;
