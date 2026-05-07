-- Public read for user-created lists (List Sharing v1).
--
-- Mirrors the get_public_challenge pattern (PR #78 / 2026-05-06):
-- a security-definer RPC that returns the list row + its items
-- ONLY when the row qualifies as a shareable list. We don't relax
-- RLS on the underlying tables.
--
-- Shareability rules — the function gates on:
--   * `type = 'free-form'` (regular user list) — system lists
--     (owned / sold / wishlist), challenges, and watchbox lists are
--     NOT shareable through this RPC. Challenges have their own
--     get_public_challenge.
--   * NOT a shared-with-me inbox (those mirror what someone shared
--     to the user; sharing them onward would loop).
--   * NOT a system list (defense-in-depth — type already covers
--     this since system lists carry their own type values).
--
-- Items returned for each row include:
--   * listing_id, saved_price, saved_currency, saved_price_usd,
--     added_at — what the recipient SPA needs to look the listing
--     up against listings.json.
--   * manual_* columns — for manual entries (which have no
--     listing_id). The recipient renders these via ManualItemCard
--     just like the owner does.
--
-- Recipient SPA fetches via the public/anon key. No auth required.
-- "Save copy to my collections" is a separate authenticated action
-- (creates a fresh collection_items row owned by the recipient).
--
-- Run order: paste into the Supabase SQL editor and execute.
-- Idempotent. Depends on 2026-05-07_manual_source_url.sql being
-- applied first (this RPC references collection_items.manual_source_url
-- which that migration adds).

create or replace function public.get_public_list(list_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  c record;
  items jsonb;
begin
  -- Fetch the list row. Gate on type=null (regular user list);
  -- system + challenge + shared-inbox rows return null so the
  -- recipient SPA can render a clean "this list isn't shareable"
  -- state instead of leaking system-list contents.
  select id, name, user_id, type, is_system, is_shared_inbox,
         created_at, updated_at
    into c
    from public.collections
    where id = list_id
      and type = 'free-form'
      and is_system is not true
      and (is_shared_inbox is null or is_shared_inbox = false);
  if not found then
    return null;
  end if;

  -- Pull the items. Ordered by added_at ascending so the recipient
  -- sees them in the order the owner added them. Both
  -- listing-backed (listing_id non-null) and manual entries
  -- (is_manual=true) are returned; the SPA renders each kind
  -- through its existing card component.
  select coalesce(jsonb_agg(jsonb_build_object(
    'rowId',          ci.id,
    'listingId',      ci.listing_id,
    'savedPrice',     ci.saved_price,
    'savedCurrency',  ci.saved_currency,
    'savedPriceUSD',  ci.saved_price_usd,
    'addedAt',        ci.added_at,
    'isManual',       coalesce(ci.is_manual, false),
    -- Manual snapshot (null on listing-backed rows; ManualItemCard
    -- on the recipient handles whichever is populated).
    'manualImageUrl',     ci.manual_image_url,
    'manualBrand',        ci.manual_brand,
    'manualModel',        ci.manual_model,
    'manualReference',    ci.manual_reference,
    'manualMaterial',     ci.manual_material,
    'manualPricePaid',    ci.manual_price_paid,
    'manualPriceCurrency',ci.manual_price_currency,
    'manualSoldPrice',    ci.manual_sold_price,
    'manualSoldDate',     ci.manual_sold_date,
    'manualComments',     ci.manual_comments,
    'manualSourceUrl',    ci.manual_source_url
  ) order by ci.added_at), '[]'::jsonb)
    into items
    from public.collection_items ci
    where ci.collection_id = list_id;

  return jsonb_build_object(
    'id',         c.id,
    'name',       c.name,
    'ownerId',    c.user_id,
    'createdAt',  c.created_at,
    'updatedAt',  c.updated_at,
    'items',      items
  );
end;
$$;

-- Allow anonymous + authenticated callers to invoke. The function
-- itself gates by list type, so no further auth check is needed.
grant execute on function public.get_public_list(uuid) to anon, authenticated;
