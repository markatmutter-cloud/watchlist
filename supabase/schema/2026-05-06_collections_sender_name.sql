-- Sender attribution on shared challenges.
-- 2026-05-06 (PR #90) — Mark's framing: "Be good to save a completed
-- challenge with a name - James's 3 watch collection for $50k and
-- have a saved challenges section."
--
-- When a recipient takes a shared challenge, the new draft they get
-- now records the sender's display name (passed via the spec link's
-- &from=<name> param). The Challenges list groups attributed
-- challenges into a "Sent to you" section; the row shows a small
-- "from <name>" chip.
--
-- One nullable text column on collections — derive everything else
-- (display label override, grouping in the list) from whether the
-- column is set.

alter table public.collections
  add column if not exists sender_name text;
