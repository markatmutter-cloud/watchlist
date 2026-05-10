-- 2026-05-10: actually block anon from three signed-in-only SECURITY
-- DEFINER RPCs.
--
-- The May 10 migrations (2026-05-10_reactions.sql,
-- 2026-05-10_reaction_counts.sql, 2026-05-10_user_profiles.sql)
-- each tried to revoke EXECUTE from anon with the pattern:
--   grant execute on function … to authenticated;
--   revoke execute on function … from anon;
--
-- That `revoke … from anon` was a no-op: the function's actual ACL
-- granted EXECUTE to PUBLIC (everyone), not to anon directly. Anon
-- inherited EXECUTE via PUBLIC, so removing the (non-existent) direct
-- grant did nothing.
--
-- Discovered 2026-05-10 in a maintenance audit. The CLAUDE.md
-- "Supabase public schema default ACL gotcha" note describes the
-- old behavior (direct anon grants); current Supabase platform
-- grants to PUBLIC instead. The fix is structurally the same — keep
-- the explicit `grant to authenticated` so signed-in users stay
-- callable, and `revoke from public` to actually pull the implicit
-- anon access.
--
-- Three RPCs need this fix:
--   list_item_reactions(uuid)            — list a list's reactions
--   list_members_for_collection(uuid)    — list a list's members
--   list_reaction_counts_for_user()      — per-list reaction counts
--
-- All three are frontend-gated by `if (!user) return …` in
-- useCollections, so a working anon caller would just bypass the
-- gate. None expose data anon can't already see through other paths
-- (collaborator email is owner-only via list_collaborators which
-- *was* correctly revoked; the public RPCs return data that's
-- self-filtering on auth.uid()) — but defense-in-depth still wins.

revoke execute on function public.list_item_reactions(uuid)            from public;
revoke execute on function public.list_members_for_collection(uuid)    from public;
revoke execute on function public.list_reaction_counts_for_user()      from public;

-- Re-affirm signed-in EXECUTE in case a future ALTER FUNCTION resets
-- the ACL. These were already granted by the original migrations;
-- this is belt-and-braces.
grant execute on function public.list_item_reactions(uuid)            to authenticated;
grant execute on function public.list_members_for_collection(uuid)    to authenticated;
grant execute on function public.list_reaction_counts_for_user()      to authenticated;

-- Verify intent: after this runs, has_function_privilege('anon', …,
-- 'EXECUTE') should return false for all three; authenticated and
-- service_role keep their access via their own direct grants.
