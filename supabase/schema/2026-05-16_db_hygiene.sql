-- DB hygiene — maintenance session 2026-05-16.
--
-- Three independent changes, each reversible:
--
-- 1. Revoke EXECUTE on accept_invite_by_token from PUBLIC.
--    The function body already raises on auth.uid() IS NULL, so this
--    is defense-in-depth — invite acceptance is intentionally a
--    signed-in-only operation. Anon callability was an artifact of
--    the Supabase platform's PUBLIC-grant-by-default behaviour on
--    function creation (see CLAUDE.md Supabase ACL gotcha). The
--    three other anon-callable SECDEF RPCs stay anon-callable on
--    purpose:
--      - pending_invite_by_token: recipient sees invite details
--        before sign-in ("X invited you to a list. Sign in to accept")
--      - get_public_challenge / get_public_list: shared-link receive
--        flow for read-only public surfaces
--
-- 2. Consolidate duplicate permissive SELECT policies on
--    admin_hidden_listings + user_limits. Pre-fix both tables had
--    an "Admins manage" FOR ALL policy and a public/owner SELECT
--    policy, overlapping for SELECT. Postgres executes both per
--    select, which the linter flags as a perf nit. Splitting the
--    admin policy into FOR INSERT / FOR UPDATE / FOR DELETE
--    eliminates the SELECT overlap without weakening admin write
--    permissions. Public/owner SELECT policies are untouched.
--
-- 3. Drop four unused admin-convenience indexes. All were on
--    secondary columns (updated_at, updated_by, hidden_at,
--    hidden_by) and the advisor reports zero uses since creation.
--    Recreatable from schema if a future admin query needs one.

begin;

-- 1. accept_invite_by_token: tighten ACL.
revoke execute on function public.accept_invite_by_token(uuid) from public;

-- 2a. admin_hidden_listings — split the FOR ALL admin policy into
--     write-only policies. Public SELECT ("Anyone select admin
--     hidden listings") covers reads.
drop policy if exists "Admins manage admin hidden listings" on public.admin_hidden_listings;
create policy "Admins insert admin hidden listings"
  on public.admin_hidden_listings
  for insert
  with check (is_admin());
create policy "Admins update admin hidden listings"
  on public.admin_hidden_listings
  for update
  using (is_admin())
  with check (is_admin());
create policy "Admins delete admin hidden listings"
  on public.admin_hidden_listings
  for delete
  using (is_admin());

-- 2b. user_limits — same split. Owner SELECT ("Users select own
--     limit") covers per-user reads.
drop policy if exists "Admins manage user limits" on public.user_limits;
create policy "Admins insert user limits"
  on public.user_limits
  for insert
  with check (is_admin());
create policy "Admins update user limits"
  on public.user_limits
  for update
  using (is_admin())
  with check (is_admin());
create policy "Admins delete user limits"
  on public.user_limits
  for delete
  using (is_admin());

-- 3. Drop unused admin-convenience indexes.
drop index if exists public.user_limits_updated_at_idx;
drop index if exists public.user_limits_updated_by_idx;
drop index if exists public.admin_hidden_listings_hidden_at_idx;
drop index if exists public.admin_hidden_listings_hidden_by_idx;

commit;

-- Verify (run separately after apply):
--   select has_function_privilege('anon', 'public.accept_invite_by_token(uuid)', 'EXECUTE');
--     -- expect: false
--   select policyname, cmd from pg_policies
--    where tablename in ('admin_hidden_listings','user_limits')
--    order by tablename, cmd;
--     -- expect: 4 policies per table (1 SELECT + INSERT + UPDATE + DELETE)
--   select indexname from pg_indexes
--    where tablename in ('admin_hidden_listings','user_limits');
--     -- expect: no rows ending in _idx for the dropped four
