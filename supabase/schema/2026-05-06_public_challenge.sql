-- Public read for completed Watch Challenges (v1.5 receive flow).
--
-- Completed challenges are share-able artefacts: anyone with the
-- link can see the sender's picks. Drafts stay private. We don't
-- relax RLS on the underlying tables — instead a security-definer
-- RPC returns the challenge row + its picks ONLY when the
-- challenge state is 'complete'.
--
-- The recipient SPA fetches via this RPC with the public/anon key;
-- there's no JWT requirement, no admin gate. Picks-shapes match
-- the listing_snapshot the sender already stored, so the
-- recipient surface can render thumbnails + brand/ref/price
-- without a second join against listings.json.
--
-- Run order: paste into the Supabase SQL editor and execute.
-- Idempotent.

create or replace function public.get_public_challenge(challenge_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  c record;
  picks jsonb;
begin
  -- Fetch the challenge row. If the row doesn't exist OR isn't
  -- complete, return null so the recipient SPA can render a clean
  -- "this challenge isn't shareable" state instead of leaking
  -- intermediate data.
  select id, name, target_count, budget, description_long, state,
         created_at, updated_at
    into c
    from public.collections
    where id = challenge_id
      and type = 'challenge'
      and state = 'complete';
  if not found then
    return null;
  end if;

  -- Pull the picks. Only is_pick=true rows; ordered by added_at
  -- ascending so the recipient sees them in the same slot order
  -- the sender saw. listing_snapshot carries brand / ref / source /
  -- img / url so the recipient surface doesn't need listings.json.
  select coalesce(jsonb_agg(jsonb_build_object(
    'rowId',          ci.id,
    'listingId',      ci.listing_id,
    'savedPrice',     ci.saved_price,
    'savedCurrency',  ci.saved_currency,
    'savedPriceUSD',  ci.saved_price_usd,
    'addedAt',        ci.added_at,
    'reasoning',      ci.reasoning,
    'snapshot',       ci.listing_snapshot
  ) order by ci.added_at), '[]'::jsonb)
    into picks
    from public.collection_items ci
    where ci.collection_id = challenge_id
      and ci.is_pick = true;

  return jsonb_build_object(
    'id',              c.id,
    'name',            c.name,
    'targetCount',     c.target_count,
    'budget',          c.budget,
    'descriptionLong', c.description_long,
    'state',           c.state,
    'createdAt',       c.created_at,
    'updatedAt',       c.updated_at,
    'picks',           picks
  );
end;
$$;

-- Allow anonymous + authenticated callers to invoke. The function
-- itself gates by state='complete', so no further auth check is
-- needed — drafts stay invisible.
grant execute on function public.get_public_challenge(uuid) to anon, authenticated;
