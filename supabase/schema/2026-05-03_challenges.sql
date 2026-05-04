-- Watch Challenges (Build-a-collection v1) schema additions.
--
-- Approach: challenges are collections with type='challenge' (the
-- `type` column already exists from 2026-05-01_collections.sql and
-- already permits this value). One challenge = one collection;
-- shortlist + final picks live in the same collection's items, with
-- an `is_pick` boolean distinguishing the two. Per-pick rationale
-- lives on collection_items as a `reasoning` text column.
--
-- Price snapshot fields (saved_price, saved_currency, saved_price_usd)
-- already exist on collection_items — they're used here too. When an
-- item flips is_pick=true we snapshot the listing's current price so
-- the challenge total is immutable once shared.
--
-- Run order: paste into Supabase SQL editor and execute. Idempotent
-- via `if not exists` so re-running is safe.

-- ── collections: challenge-specific columns ──────────────────────────
alter table public.collections
  add column if not exists target_count       integer,        -- desired number of picks (1..10)
  add column if not exists budget             numeric,        -- USD budget for the challenge
  add column if not exists description_long   text,           -- "frame the challenge" prose
  add column if not exists state              text default 'complete'
                                              check (state in ('draft', 'complete')),
  add column if not exists parent_challenge_id uuid           -- response-mode link (see below)
                                              references public.collections(id) on delete set null;

-- A response collection (someone else's reply to this user's challenge)
-- copies the parent's target_count + budget + description_long and sets
-- parent_challenge_id to the original. The parent's existence guarantee
-- + on-delete=set-null lets responses survive their parent's deletion
-- (they become orphan collections, still visible to their owner).

create index if not exists collections_parent_challenge_idx
  on public.collections (parent_challenge_id)
  where parent_challenge_id is not null;

-- Drafts are private to their owner. Public-share URL resolution should
-- check state='complete' before returning a challenge to the share
-- flow. Enforced in application code, not a DB constraint, because
-- the same row transitions from draft -> complete during normal use.

-- ── collection_items: pick / reasoning columns ───────────────────────
-- is_pick distinguishes shortlist (false) from final picks (true).
-- Items default to false (added to shortlist first); the picking flow
-- promotes them to is_pick=true with the price snapshot. Demotion
-- back to shortlist clears the snapshot so the next promotion captures
-- a fresh price (handled in application code).

alter table public.collection_items
  add column if not exists is_pick   boolean not null default false,
  add column if not exists reasoning text;                     -- one-line per-pick rationale

create index if not exists collection_items_pick_idx
  on public.collection_items (collection_id, is_pick);
