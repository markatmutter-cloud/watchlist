-- Watch management v1 schema (2026-05-09 — Mark spec).
--
-- Adds the fields the new My Watches > Plan + per-watch detail
-- surface needs:
--
--   1. flagged_for_sale         — drives the Selling column in Plan
--   2. assumed_sell_value       — what you think you'd get; drives
--                                 the Selling-column running total
--   3. description / thoughts   — the two free-form text fields on
--                                 the detail sheet (replaced the
--                                 earlier 6-field reflection plan
--                                 because Mark prefers fewer prompts)
--   4. buy/sell breakdown +
--      FX snapshot              — proper P&L tracking (mirrors the
--                                 spreadsheet shape with hammer +
--                                 premium + shipping + tax + other)
--
-- Plus a new `collection_item_comments` table for the datestamped
-- journal — append-only "what I think about this watch over time"
-- entries shown on the detail sheet.
--
-- All collection_items columns are nullable so existing manual
-- entries stay valid. flagged_for_sale defaults to false.

alter table public.collection_items
  add column if not exists flagged_for_sale boolean not null default false;

alter table public.collection_items
  add column if not exists assumed_sell_value numeric;

alter table public.collection_items
  add column if not exists manual_description text;

alter table public.collection_items
  add column if not exists manual_thoughts text;

-- Buy-side breakdown. All optional; the existing manual_price_paid
-- field remains the source of truth for total cost basis when the
-- breakdown is empty.
alter table public.collection_items
  add column if not exists manual_buy_hammer numeric;
alter table public.collection_items
  add column if not exists manual_buy_premium numeric;
alter table public.collection_items
  add column if not exists manual_buy_shipping numeric;
alter table public.collection_items
  add column if not exists manual_buy_tax numeric;
alter table public.collection_items
  add column if not exists manual_buy_other numeric;
alter table public.collection_items
  add column if not exists manual_buy_fx_to_usd numeric;
alter table public.collection_items
  add column if not exists manual_buy_all_in_usd numeric;

-- Sell-side breakdown. manual_sold_price (existing) remains the
-- source-of-truth headline; the breakdown columns let the detail
-- sheet show how that headline composes.
alter table public.collection_items
  add column if not exists manual_sell_platform_fee numeric;
alter table public.collection_items
  add column if not exists manual_sell_shipping_out numeric;
alter table public.collection_items
  add column if not exists manual_sell_other numeric;
alter table public.collection_items
  add column if not exists manual_sell_fx_to_usd numeric;
alter table public.collection_items
  add column if not exists manual_sell_net_usd numeric;

-- ── Journal (datestamped append-only comments) ─────────────────
--
-- Per-watch journal. One row per comment, ordered by created_at.
-- Authored by user_id so future shared-list collaboration can
-- show "Jacquelin: …" / "Mark: …". RLS gates read+write to the
-- collection's owner OR an accepted collaborator (same expansion
-- as collection_items, via the can_view / can_edit helper fns).

create table if not exists public.collection_item_comments (
  id              uuid primary key default gen_random_uuid(),
  collection_item_id uuid not null references public.collection_items(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists collection_item_comments_item_created_idx
  on public.collection_item_comments (collection_item_id, created_at desc);

alter table public.collection_item_comments enable row level security;

-- SELECT: members of the parent collection (owner or accepted
-- collaborator) can see all comments.
create policy "members can read comments"
  on public.collection_item_comments
  for select
  using (
    exists (
      select 1 from public.collection_items ci
       where ci.id = collection_item_comments.collection_item_id
         and (
           public.can_view_collection(ci.collection_id)
         )
    )
  );

-- INSERT: members can post comments. Caller's user_id is enforced
-- = auth.uid() so spoofed authorship is rejected.
create policy "members can post comments"
  on public.collection_item_comments
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.collection_items ci
       where ci.id = collection_item_comments.collection_item_id
         and public.can_edit_collection(ci.collection_id)
    )
  );

-- UPDATE / DELETE: only the comment author can mutate their own
-- comment. Collection owner doesn't get blanket delete to keep
-- the journal append-only (deletion of the parent collection
-- cascades the comments via on-delete on the FK above).
create policy "author can edit own comment"
  on public.collection_item_comments
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "author can delete own comment"
  on public.collection_item_comments
  for delete
  using (user_id = auth.uid());

-- Realtime: opt the comments table into the publication so journal
-- entries appear live for collaborators (mirrors the collections /
-- collection_items realtime setup from #150).
alter publication supabase_realtime add table public.collection_item_comments;
