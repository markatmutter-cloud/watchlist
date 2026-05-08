# Watchlist — Session Handoff (2026-05-07)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — durable rules graduate to CLAUDE.md, durable plans graduate
to ROADMAP.md.

## TL;DR

Cleanup-and-data-correction day. **Six PRs (#106–#109, #111) merged**
plus one closed-as-superseded (#110). All production. The day arc:

1. **Morning** — UI bug-batch from yesterday's screenshots: mobile
   card grid overflow, Watchlist > Auctions silently dropping
   hearted auction-house lots, challenge-share picks not clickable,
   HKD lots displaying 1:1 with USD.
2. **Afternoon** — Phillips lot 229796 investigation (turned into
   a stale-scrape diagnosis, fixed by the cron tick that ran after
   #109 merged), then Swiss Hours source-currency correction
   including a state.json + listings.json + Supabase data migration.
3. **Late afternoon** — Plan B (collaborator lists) chosen for
   shared-list functionality; sketched 4-slice rollout, captured
   in ROADMAP Epic 4. Cleanup pass for stale branches, worktrees,
   docs.

## What shipped

### #106 — Card grid overflow on mobile

CSS grid's bare `1fr` is `minmax(auto, 1fr)`. Long Phillips/
Sotheby's titles from PR #104 pushed the right column past the
viewport on 3-col mobile. One-character fix: `repeat(N, 1fr)` →
`repeat(N, minmax(0, 1fr))` in [src/App.js:1513](src/App.js:1513).
Card's existing `minWidth: 0` + 2-line clamp finally constrains
the row.

### #107 — Watchlist > Auctions silently dropping hearted lots

Mark reported only ~23 saved auction items showing in the
Watchlist > Auctions sub-tab vs many more actually hearted.
`liveStateById` in [src/App.js:1190](src/App.js:1190) was built
only from dealer `items[]` — auction-house-lot ids
(`shortHash(url)`) never resolved to a live entry, so the
`!live || !!live.sold` check flagged every hearted lot as
`_isSold=true`. The auctions sub-tab filter then dropped them all.

The ~23 still visible were eBay-hearted items + Watchcollecting-
style items whose ids resolve via the dealer feed or eBay's
tracked_lots projection.

Fix: also load `auctionLotItems` into the lookup. Each entry
carries a correct `sold` flag from `data.status === "ended"`,
so the existing liveness check works unchanged for them.

### #108 — Challenge-share picks clickable

Mark's wife shared her completed challenge via the
`?challenge=<UUID>&shared=1` link. ChallengeReceiver rendered
the three picks, but each pick row was a plain `<div>` — no
click handler, no link. Mark could see them, just couldn't drill
in.

Fix: wrap each pick row in an `<a href={snapshot.url}
target="_blank" rel="noopener noreferrer">`. Matches Card
behaviour everywhere else in the app. The `listing_snapshot` jsonb
stored by `addToShortlist` is the full listing object so `url` is
always present; left a plain `<div>` fallback for paranoia.

### #109 — `merge.py` FX: add HKD

[PR #104](https://github.com/markatmutter-cloud/watchlist/pull/104)
was titled *"Auction lots: fix titles + FX rates (Sotheby's
maker, Phillips description, HKD)"* but the squash only included
the title-fix commit (`auction_lots_scraper.py`). The FX commit
on the same branch was orphaned. Result: every HKD lot in
`public/auction_lots.json` had `*_usd` fields equal to the raw
HKD amount, because `FX.get("HKD", 1.0)` in `merge.py` fell
through to 1.0.

Verified in current data — Phillips lot with starting_price
170,000 HKD had `starting_price_usd: 170000` (should be ~21,760).

One-line fix to [merge.py:223](merge.py:223). Local sanity check:
`to_usd(170000, "HKD") = 21760`.

### #110 — Phillips lot 229796 investigation (closed-as-superseded)

Mark couldn't see lot 229796 in the app. The lot **was** in the
data, but its title was just `"Rolex"` because the most recent
auctions cron commit (`7583563`, 03:14 UTC) ran *before* PR #104's
title-enrichment fix landed. 112 Phillips lots in the same
condition. Searching by reference / model / description didn't
match because the projection only carries `title` into the search
haystack.

I re-scraped four active sales locally (Phillips GE/HK/NY +
Sotheby's GE2601, 776 lot updates) and opened PR #110. Before
review completed, the regular auctions cron at 12:40 UTC ran on
main with #109 already merged and produced a fresh
`auction_lots.json` with both fixes (title enrichment from #104,
HKD FX from #109). PR #110 became redundant; closed without merge.

Verified on main: lot 229796 has the rich title, 0 Phillips lots
with bare-brand titles, HKD lots converting at ratio 0.128.

### #111 — Swiss Hours source currency: HKD, not USD

Mark spotted Swiss Hours listings showing raw HKD values rendered
as USD — Cartier CPCP Tortue at "$395,000". Confirmed via
storefront markup: `<meta data-currency="HKD">` + `"currency":"HKD"`
in the storefront JSON. Swiss Hours is a Hong Kong-based dealer
whose Shopify `products.json` `price` field has carried raw HKD
amounts all along; `merge.py:632` was labelling the source as USD
and skipping FX conversion.

Fix went beyond the source-currency mapping after Mark flagged
"that's all listings from this source":
- [merge.py:632](merge.py:632): source currency `'USD'` → `'HKD'`
- [swisshours_scraper.py](swisshours_scraper.py): docstring corrected
- `public/state.json`: 81 rows + 81 priceHistory entries relabelled
  USD → HKD in place
- `public/listings.json`: 80 entries relabelled USD → HKD with
  `priceUSD` recomputed at the 0.128 rate
- [supabase/schema/2026-05-07_swisshours_currency_fix.sql](supabase/schema/2026-05-07_swisshours_currency_fix.sql) —
  one-shot migration updating `watchlist_items` + `collection_items`
  where `listing_snapshot.source = 'Swiss Hours'`. Mark ran it in
  the SQL editor right after the merge.

After Vercel redeployed, Cartier CPCP Tortue displays at
~$50,560 (= 395,000 × 0.128).

## Schema migration audit

Mark asked at end-of-day whether any other Supabase migrations
might have been skipped. Built a single auditor query that
returns OK/MISSING per migration; covers all 11 schema-changing
files plus the data-only Swiss Hours fix. Mark to paste into the
SQL editor after this session if curious. Practical signal:
features that work end-to-end imply policies + grants are
intact, since RLS gaps tend to manifest as silent write failures.

## Plan B — Collaborator lists (chosen, not started)

Mark proposed at end-of-day: shared lists where named users (his
wife specifically) can both view AND add items, with attribution.
Two architectures sketched:

- **Plan A** (lighter): "anyone with the link" share token on
  `collections`. Half-day build. Risk: no per-user revoke
  granularity.
- **Plan B** (heavier): per-user `collection_collaborators` table
  with invite-by-email + accept/decline + role. Multi-day build.
  Better fit for recurring couple/family use-case.

Mark picked Plan B because his recurring use-case wants persistent
identity per contributor. Captured in [ROADMAP.md](ROADMAP.md)
Epic 4 with 4-slice rollout:

1. Schema + RLS + smoke-test SQL (backend-only, no user impact)
2. RPCs + `useCollaborators` hook + Manage-list sheet
3. Pending-invite badge + accept/decline modal
4. `who_added` attribution chip on item cards

Next session entry point: Slice 1.

## Cleanup also done

- This handoff written; 2026-05-06 archived to `archive/`.
- CLAUDE.md gained one durable convention in Scraper section:
  "Verify a dealer's display currency from the storefront, not
  the domain TLD" — so the next session doesn't repeat the Swiss
  Hours mistake on the next HK-based dealer added.
- ROADMAP.md gained the Plan B Epic 4 sub-section.

## Carry-overs (not blocking)

- The five claude/* feature branches from this session
  (grid-overflow-fix, watchlist-auctions-live-state,
  challenge-picks-clickable, fx-add-hkd, swisshours-hkd) are still
  on origin even after merge — GitHub doesn't auto-delete on
  squash-merge. Plus `share-handler-fix` (recreated when I
  accidentally pushed to a deleted branch), `eod-docs-2026-05-06`
  (from yesterday), `lot-titles` (a pre-cron working branch from
  the Sotheby's title work), `refresh-auction-lots` (the closed
  #110), `auction-scrape-fix` (older), `collections-ui-fixes`
  (older). Mark to delete via GitHub UI or `git push origin
  --delete claude/<name>` per branch.
- ~50 stale Claude Code worktrees under `.claude/worktrees/`.
  `git worktree list | grep -v watchlist$ | awk '{print $1}'` to
  enumerate, `git worktree remove <path>` per dir or
  `git worktree prune` for orphaned ones.
