-- 2026-05-08 — security hardening pass.
--
-- Tightens two classes of advisor warnings:
--
--   1. SECURITY DEFINER functions executable by `anon` — Supabase's
--      default ACL on the `public` schema grants EXECUTE on every
--      newly-created function directly to the `anon`, `authenticated`,
--      and `service_role` roles (NOT via the PUBLIC pseudo-role).
--      This means `REVOKE EXECUTE ... FROM PUBLIC` is a no-op for
--      functions in `public` — the implicit grants persist on each
--      role individually. To actually drop anon access we have to
--      `REVOKE ... FROM anon` explicitly. Most of the listed functions
--      have an internal `auth.uid() is null` guard that refuses
--      anonymous calls, so the practical risk is low — but the linter
--      is right that the surface should be removed.
--
--   2. Function `search_path` mutable — `default_watchlist_cap` and
--      `prevent_system_collection_delete` were created without an
--      explicit search_path. Re-create them with `set search_path =
--      public` so a malicious schema in the caller's path can't
--      shadow `public` references.
--
-- Public-by-design RPCs (`get_public_challenge`, `get_public_list`)
-- are intentionally left callable by anon and not revoked here.
--
-- The pre-existing default privileges on `public` mean any FUTURE
-- function created in this schema will again be auto-granted to anon.
-- Each new function therefore needs an explicit `REVOKE ... FROM anon`
-- pair after its `GRANT ... TO authenticated`. A future hardening
-- could ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON
-- FUNCTIONS FROM anon, but that's a broader change that touches every
-- existing migration's expectations and isn't done here.
--
-- Storage policy tightening for the watch-photos bucket is tracked
-- separately — needs a paired verification that getPublicUrl-based
-- rendering is unaffected before dropping the broad SELECT policy.

-- ── 1. Revoke anon EXECUTE on auth-required RPCs ─────────────────
-- These keep their `authenticated` grant from the original migration.

revoke execute on function public.accept_invite(uuid)               from anon;
revoke execute on function public.decline_invite(uuid)              from anon;
revoke execute on function public.create_challenge_v2(text, integer, numeric, text, uuid, text) from anon;
revoke execute on function public.create_collection_v2(text, text, text, boolean) from anon;
revoke execute on function public.invite_collaborator(uuid, text, text) from anon;
revoke execute on function public.revoke_collaborator(uuid, uuid, uuid) from anon;
revoke execute on function public.list_collaborators(uuid)          from anon;
revoke execute on function public.pending_invites_for_me()          from anon;
revoke execute on function public.list_user_limits()                from anon;
revoke execute on function public.set_watchlist_cap_by_email(text, integer, text) from anon;
revoke execute on function public.source_engagement_summary(integer) from anon;
revoke execute on function public.is_admin()                        from anon;
revoke execute on function public.can_view_collection(uuid)         from anon;
revoke execute on function public.can_edit_collection(uuid)         from anon;
revoke execute on function public.enforce_watchlist_cap()           from anon;

-- ── 2. Admin/internal RPCs — drop both anon and authenticated ────
-- `rollup_and_prune_listing_events` is invoked by the GitHub Actions
-- daily cron as the service role and (rarely) by an admin pasting
-- the call into the SQL editor. It's never called from the React
-- app, so authenticated users don't need execute access.
-- `rls_auto_enable` is a setup helper that doesn't need to be
-- callable from any client.

revoke execute on function public.rollup_and_prune_listing_events(integer) from anon;
revoke execute on function public.rollup_and_prune_listing_events(integer) from authenticated;

revoke execute on function public.rls_auto_enable()                 from anon;
revoke execute on function public.rls_auto_enable()                 from authenticated;

-- ── 3. Pin search_path on mutable-path functions ─────────────────

create or replace function public.default_watchlist_cap()
returns integer
language sql
immutable
set search_path = public
as $$ select 2500 $$;

create or replace function public.prevent_system_collection_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_system = true then
    raise exception 'Cannot delete a system collection (id=%, name=%)', old.id, old.name
      using errcode = 'P0001';
  end if;
  return old;
end $$;
