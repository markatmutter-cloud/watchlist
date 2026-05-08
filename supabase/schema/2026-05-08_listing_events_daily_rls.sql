-- 2026-05-08 — enable RLS on listing_events_daily.
--
-- Supabase advisors flagged this as an ERROR: the table has SELECT
-- policies (the admin-only "Admins select listing events daily"
-- policy from 2026-05-05_listing_events.sql) but RLS itself was
-- never enabled, so the policies are inert and the table is
-- effectively wide-open to anyone with a valid JWT.
--
-- Enabling RLS activates the existing policy. The policy already
-- gates SELECT on `is_admin()` so no other change is needed —
-- this is a one-liner that closes the gap.
--
-- Writes happen exclusively via `rollup_and_prune_listing_events`
-- (SECURITY DEFINER cron RPC), so there's no INSERT/UPDATE/DELETE
-- policy to add — the function bypasses RLS by design and the lack
-- of a write policy means direct writes from any other path are
-- refused.

alter table public.listing_events_daily enable row level security;
