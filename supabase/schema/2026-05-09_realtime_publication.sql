-- Enable Supabase Realtime for shared-list tables.
--
-- Adds collection_items + collections to the supabase_realtime
-- publication so postgres_changes subscriptions broadcast row
-- INSERT / UPDATE / DELETE events to authenticated clients. RLS
-- still applies to the broadcast (Realtime filters per-row against
-- the subscribing user's JWT) so a client only receives events for
-- collections they own or are an accepted collaborator on.
--
-- Why these two: the canonical "shared state" tables. When wife
-- adds a watch to a list Mark also collaborates on, his client
-- needs to see the new item without a manual refresh. Renames /
-- deletes / new lists likewise. collection_collaborators stays
-- polled (Manage-list sheet re-fetches on open) — those changes
-- are infrequent and their UI is modal, so realtime would be
-- over-engineering for now.
--
-- Pricing context: free tier is 200 concurrent connections + 2M
-- messages/month. For Mark's family use this is overhead-free; at
-- ~1000 active users we'd still be well under Pro tier ($25/mo,
-- 500 concurrent, 5M msgs). Hard-limited not soft-billed, so a
-- usage spike caps connections rather than billing surprise.

alter publication supabase_realtime add table public.collections;
alter publication supabase_realtime add table public.collection_items;
