-- 2026-05-08 — re-align the collections INSERT policy with its
-- SELECT / UPDATE / DELETE siblings on `roles: {public}`.
--
-- The earlier fix (2026-05-08_fix_collections_insert_policy.sql)
-- created the policy with `to authenticated`. The other three policies
-- on this table are role-unscoped (`{public}`), so under any session
-- where Postgres saw the connection as anything other than role
-- `authenticated`, the INSERT policy didn't apply and Postgres
-- rejected the insert with "new row violates row-level security
-- policy for table 'collections'".
--
-- Mark hit this on 2026-05-08 with a session whose JWT was apparently
-- stale enough that the API role wasn't `authenticated`, even though
-- the JS had a user object. Dropping the role clause makes the policy
-- apply uniformly — auth.uid() returning NULL on a truly anonymous
-- session is still false for `auth.uid() = user_id`, so this doesn't
-- weaken security.
--
-- Idempotent.

do $$ begin
  drop policy if exists "Users insert owned collections" on public.collections;
  create policy "Users insert owned collections"
    on public.collections for insert
    with check (auth.uid() = user_id);
end $$;

-- Confirm post-state matches sibling policies on roles={public}.
do $$
declare
  r record;
begin
  select roles into r
  from pg_policies
  where schemaname = 'public' and tablename = 'collections' and cmd = 'INSERT';
  if r.roles is null then
    raise exception 'collections INSERT policy missing after role-alignment migration';
  end if;
  raise notice 'collections INSERT policy roles = %', r.roles;
end $$;
