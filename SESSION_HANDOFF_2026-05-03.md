# Watchlist — Session Handoff (2026-05-03)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — the durable rules graduate to CLAUDE.md, the durable plans
graduate to ROADMAP.md.

## TL;DR

Long iterative session across 2026-05-02 evening + 2026-05-03. **Net
deliverables**, latest first: **Watch Challenges (Build-a-collection
v1)** shipped as a new Watchlist > Challenges sub-tab; **Heuertime
+ Classic Heuer** added as the 35th + 36th dealers (via a parallel
session); auction urgency surfacing; Watchurbia + Maunder + Watch
Club + Vintage Watch Shop + Watches of Lancashire (5 UK dealers);
Epic 0 verification script + admin source-quality dashboard;
refresh-preserves-location; manual single-source scrape workflow;
Wind Vintage sold-detection false-positive fix; eBay short-URL
tracking fix; roadmap restructured (Strategic bets, User journeys,
multi-tier save reinstated, AI recommendation surfaces,
comprehensive auction inventory, etc.).

Production is **green**, currently serving `main.0f340f6a.js`.
Dealer count: **36** (target was 30; Stop-rule pruning to 25 is
the next Epic 1 priority). All open PRs from this session arc are
merged.

## What shipped (newest first)

- **Watch Challenges / Build-a-collection v1** (PR #18, merged
  2026-05-03 late, bundle `0f340f6a`). New Watchlist > Challenges
  sub-tab — the 5th sub-tab alongside Favorites / Collections /
  Searches / Auction Calendar. Multi-stage flow: Create (set count
  + budget + title) → Picking (drag-drop on desktop, tap-to-select
  on mobile via the SlotPickerModal) → Reasoning (one-line per pick;
  optional, rows={2}) → Complete (read-only summary + share). Same
  20% over-budget soft-warn / >20% hard-block as the mockup. Schema
  in `supabase/schema/2026-05-03_challenges.sql` extends collections
  (target_count, budget, description_long, state draft|complete,
  parent_challenge_id) and collection_items (is_pick, reasoning).
  ONE collection per challenge — picks and shortlist live in the
  same items table, distinguished by is_pick. Picks snapshot
  saved_price/saved_currency/saved_price_usd at promotion time so
  totals are immutable post-share. Drafts persist as you go via
  the existing useCollections write-through. Drag-drop is gated on
  `(pointer: fine)` so HTML5 DnD only fires on desktop. Share
  button generates a URL encoding the spec
  (`?newchallenge=1&n=N&b=B&t=TITLE&d=DESC`) — recipients build
  their own response under the same constraints. **v1.5 work
  deliberately deferred**, captured in commit + ROADMAP comments:
  the `?newchallenge=1` receive flow that auto-prompts a response
  challenge from the URL params (currently the URL just opens the
  app); public read of completed challenges (RLS surgery deferred);
  per-challenge cap (no cap for v1); photo/custom-watch upload
  (removed entirely — eliminates the moderation surface and the
  budget-guardrail loophole). Reasoning stays surface-level by
  design; long-form journaling is Watchbox v2 territory.

- **Heuertime + Classic Heuer sources** (PR #17, merged
  2026-05-03 late). Two more EUR-priced dealers, both bringing
  vintage Heuer inventory. Specifics owned by the parallel session
  that built them — see commit `5a438bd` for full implementation
  notes. Dealer count: 34 → 36. Currently at 0 visible items each
  in listings.json because the dealer-listings cron hasn't run
  since the merge; auto-populates on next cron cycle (~8h max), or
  trigger now via Actions tab → "Scrape single source (manual)"
  with `heuertime` and `classicheuer` as the inputs.

- **Auction urgency surfacing** (PR #14, merged 2026-05-03 evening,
  bundle `cc73e77d`). Two complementary surfaces for time-sensitive
  tracked auction lots in Watchlist:
  - **"Ending soon" pinned section** at the top of the Watchlist
    tab. Auction-format tracked lots ending within 7 days OR
    currently live appear in a horizontal-scroll strip with three
    urgency tiers (LIVE NOW red / TODAY-TOMORROW amber / upcoming
    standard). Visible across every Watchlist sub-tab. Returns null
    when empty (no empty state per spec).
  - **"Ending soonest" sort** as a third pill alongside Date and
    Price. Auto-defaults on when the auctions-only filter is
    toggled; reverts to date-desc when off. Comparator: live now →
    upcoming asc → ended (most-recent first) → non-auction last.
    Same comparator drives both the Watchlist watchItems sort and
    the Available allFiltered sort.
  - New file: `src/components/EndingSoon.js` (exports
    `classifyEndingSoon` + `selectEndingSoonItems` so future alert
    triggers on the same window can reuse the windowing logic).
  - Auto-default `useEffect` lives at the top of App.js next to
    other top-level effects (NOT deep in render-conditional code)
    per CLAUDE.md "don't add hooks deep in App.js".
  - **One placement deviation worth knowing:** spec said "above the
    existing sub-tab navigation," but on mobile the sub-tab strip
    sits inside the sticky stack and pinning the section there would
    eat ~half the viewport. Mounted instead inside the scroll area
    above the sub-tab content — visually below the sticky strip but
    the first thing in scrollable content. Easy to flip if Mark
    wants strict above-the-strip placement.
  - **Lint trap, repeating:** the initial commit used
    `// eslint-disable-next-line react-hooks/exhaustive-deps`. CRA's
    eslint config doesn't enable that rule, so the disable comment
    failed `CI=true` linting and Vercel red-flagged the deploy.
    Worth remembering for future hook deps work in this repo: only
    use eslint-disable comments for rules that are actually
    configured.

- **Four UK dealer sources** (`9d28029` lineage on
  `claude/four-new-sources`): Maunder Watches (WooCommerce, ~95
  items, GBP), Watch Club (TaffyDB JS catalog, ~57 active items,
  GBP), Vintage Watch Shop / Vintage Heuer (WordPress custom-post
  + detail walker, ~20 items, GBP), Watches of Lancashire
  (WooCommerce, ~73 items, GBP). Three platform quirks worth
  remembering: (1) Maunder's WC API ignores `page` — pagination
  is `offset` only; (2) Maunder + WoL return 403 to long Chrome
  UAs but accept short `Mozilla/5.0`; (3) Watch Club paginates
  client-side via TaffyDB queries, so the entire ~5MB JS catalog
  has to be downloaded and parsed.

- **eBay short-URL tracking fix.** Mark's `ebay.us/m/PpFLll`
  failed silently because the URL dispatcher only matched eBay
  TLDs (ebay.com / *.ebay.com / *.ebay.*), and the legacy-id
  regex needs `/itm/<digits>`. Fixed by recognising `ebay.us` /
  `ebay.gg` / `ebay.to` and following the FIRST redirect via
  Location header (not full HEAD-with-redirects, which times out
  at 15s on eBay's product HTML).

- **Watchurbia source** (30th dealer; WooCommerce, EUR, ~7 items
  with `category=watches-in-stock` filter to skip sold archive).

- **Epic 0 verification script** (`verify_sources.py`). Runs after
  every merge.py; counts live listings per source, flags drops to
  zero or <30% of rolling-7-day median. Outputs
  `public/verification.json` + `public/verification_history.json`.
  Wired as `|| true` step in scrape-listings.yml so a glitch never
  blocks the cron.

- **Admin source-quality dashboard** (`?tab=admin`). Gated by
  `REACT_APP_ADMIN_EMAILS` env var. Per-source table with live
  count, new/wk, 14-day sparkline, days stale, hearts/heart-rate,
  hides/hide-rate, avg price, top brand %, health, earning-keep
  chip (🟢🟡🔴). Sortable; default sort by Earning so prune
  candidates surface first.

- **Refresh preserves location.** `tab` / `sub` / `col` query
  params get written via `history.replaceState` and read on mount.
  No `react-router`; extends the existing share-URL pattern.

- **European Watch source** (28th, Next.js / RSC chunk parsing,
  USD, **pre-2000 filter** via `Circa. YYYY` in model — ~26 items).

- **Vintage Watch Collective source** (29th, Wix, EUR, ~40 items —
  same `productsWithMetaData.list[]` pattern as Chronoholic).

- **Hidden listings → Watchlist > Collections row.** Replaces the
  user-dropdown "Manage hidden" modal. Synthetic collection with
  sentinel id `__hidden__`; `HiddenModal.js` deleted.

- **Backfilled-aware date sort.** Two-tier comparator demotes
  newly-added-source items so they don't crowd the top of the feed.

- **User-menu polish.** Settings above Sign out; "Source quality"
  entry visible only for admin users.

- **Manual single-source scrape workflow.**
  `.github/workflows/scrape-single.yml` — dispatch-only; type the
  scraper basename (e.g. `watchurbia`) in the Actions UI to refresh
  one source on demand without waiting for cron.

- **Wind Vintage sold-detection fix.** Fallback regex
  `r'.{0,150}PRICE.{0,150}'` was matching "sold in 2020" in
  description text 150 chars before the price line. Tightened to
  forward-only-from-PRICE. Recovers ~hundreds of false-positive
  sold listings on the next WV scrape.

- **Roadmap consolidation.** Strategic bets section, User journeys
  section, multi-tier save reinstated as Strength-of-save, AI
  recommendation surfaces (including "For [name]"), comprehensive
  auction inventory capture, narrowed Tools section, "Parked,
  strategy needed" section for selling-Mark's-watches, quarterly
  review discipline. See ROADMAP.md update log for the full diff.

## Open PRs

**None as of late 2026-05-03.** All session PRs merged. Two stale
merged branches still exist on remote (`claude/build-a-collection-v1`,
`claude/heuertime-classicheuer`) — Mark can trash-icon them via the
GitHub branches page when convenient. No urgency.

## Setup steps from Mark — all done ✓

- ✓ `REACT_APP_ADMIN_EMAILS` set in Vercel (Production + Preview).
  Admin source-quality dashboard at `?tab=admin` now reachable via
  the user dropdown.
- ✓ Supabase SQL migration `2026-05-03_challenges.sql` applied.
  Watch Challenges feature ready to use.
- *Optional*: same `REACT_APP_ADMIN_EMAILS` in `.env.local` if running
  `npm start` locally.

## Open user-reported issues (likely resolved by next-cron pass)

- **eBay tracking with `ebay.us/m/<token>` short URL.** Fix is in
  this branch; lands on next merge. Test with the same URL after
  deploy: should resolve to `ebay.com/itm/198313266410` (Mark's
  example) and start populating tracked_lots.json.

- **Wind Vintage missing listings (~ Cartier Tank Asymétrique
  WGTA0043, etc).** Fix is in `claude/fix-windvintage-sold-detection`
  PR. Recovery happens automatically when the next WV scrape runs;
  merge.py's reappear logic clears the sold flag for items the
  scraper now correctly reports as active.

## Architecture notes added this session

- **No `react-router`.** Confirmed by extending `?tab=…` / `?sub=…` /
  `?col=…` query-param pattern. CLAUDE.md picked up a "Location URL
  params" section alongside the existing Share URL note.

- **Admin dashboard gated by env var, not user_id.**
  `REACT_APP_ADMIN_EMAILS` (comma-separated). Empty / unset = nobody
  is admin. Avoids hardcoding a specific UUID into the bundle.
  Documented in CLAUDE.md "Admin tab" paragraph.

- **Verification script's rolling-window heuristic.** Flags drops to
  zero (ERROR) or <30% of recent median (WARN). Won't judge a
  source until 3 days of non-zero history exist — avoids
  false-alarms on newly-added sources.

- **Watch Club platform discovery: TaffyDB.** A site can ship its
  entire catalog as a single client-side JS file. If `?n=` / `?p=`
  / `?page=` all return identical pages, look for a TaffyDB-style
  init call — much cleaner to scrape than HTML walks.

- **eBay redirects time out via HEAD-allow-redirects.** eBay's
  product HTML is slow enough that following a full redirect chain
  to a final 200 response times out at 15s. The first redirect's
  `Location` header is enough to extract the legacy item ID.

- **Bot-protection UA quirks.** Two of the four new sources (Maunder,
  WoL) return 403 to a long Chrome UA but accept the short
  `Mozilla/5.0`. Counterintuitive. Worth trying both when a Store
  API call inexplicably fails.

- **Challenges = one-collection-per-feature with type marker.**
  Watch Challenges shipped as `type='challenge'` on the existing
  collections table — same architectural pattern as the planned
  Watchbox v2 (`type='watchbox'`). Picks vs shortlist split via
  an `is_pick` boolean on collection_items rather than two parallel
  tables — keeps the count of writeable surfaces low and lets the
  picking flow demote/promote by toggling one field. Snapshot
  pricing (saved_price/_currency/_price_usd) reused from
  watchlist_items for immutability post-share. Don't introduce a
  new table for the next feature in this family unless the data
  shape genuinely diverges; the type-marker pattern scales.

- **Drag-drop is gated on `(pointer: fine)`, not viewport width.**
  Mark explicitly asked for tap-to-select on mobile and drag-drop
  on desktop. Pointer-coarse / pointer-fine is the right axis —
  large touchscreens still get tap, hybrid laptops with mouse get
  DnD even at narrow widths. Same primitive the share-detection
  commit (c7f7aba) uses. If a future feature needs the same
  binary "interaction tier" decision, reach for this, not viewport.

## Doc files updated this session

- **CLAUDE.md** — Hidden-as-virtual-collection paragraph; Location
  URL params section; Admin tab section; new "Things to never do"
  rule about JSX comments before `return (`; **Watch Challenges
  data model paragraph** (one-collection-per-challenge with is_pick
  split, snapshot pricing pattern reused from watchlist_items).
- **README.md** — dealer count 27 → **36** (architecture diagram +
  header + table); Hidden mention in the × bullet; Source quality
  admin row; **Challenges sub-tab** added to the Watchlist 4-up;
  verification.json + verification_history.json in folder layout;
  AdminTab.js + ShareReceiver.js in components layout;
  REACT_APP_ADMIN_EMAILS docs.
- **ROADMAP.md** — Strategic bets section; User journeys section
  (J10 + J11); Watchbox + Build-a-collection v2 expanded;
  Strength-of-save / Multi-signal taste / Discover mode / AI
  recommendation surfaces added; comprehensive auction inventory
  added; site discoverability + welcome page added under Epic 0;
  Tools section narrowed; Parked-strategy-needed section; Quarterly
  review section; multiple update log entries including the
  **Watch Challenges v1 ship**.
- **archive/** — old SESSION_HANDOFF_2026-05-01.md moved here. This
  doc is the new in-flight one.

## Commits worth knowing for next-me

```
[on this branch]
9d28029   Roadmap consolidation pass (additions, reinstatements, edits)
[merged earlier today]
af68062 / bcaccb2 / 5566734 / c6ef32d / 3274604 / a4f842e
[and the cron commits between them]
```

Use `git log origin/main --oneline -30` for the actual merged history.

## Next session

Per the refreshed [ROADMAP.md](ROADMAP.md) priority order:

1. **Watch Challenges v1.5** — close the gap left by v1: implement
   the `?newchallenge=1` receive flow (auto-prompt a draft response
   when a recipient lands on a spec URL) and decide whether to ship
   public read of completed challenges (RLS surgery on collections
   table to allow anon SELECT on `state='complete'` rows). Half a
   session. Ship before References if you want the social loop to
   actually close.
2. **References as first-class entities (Epic 0).** The lone
   remaining Epic 0 foundation. Several downstream features gate on
   this.
3. **Site discoverability + welcome page (Epic 0).** Half-session.
   robots / sitemap / og:image / Schema.org / first-time-visitor page.
4. **Strength-of-save model (Epic 3).** Two-tier (Love / Watch).
   Small UI lift; the feature *is* the gesture.
5. **Stop-rule prune** under Epic 1 — at 36 dealers we're past the
   30-dealer end-state. Audit + prune to 25. Source quality
   dashboard now exists, so this is a "look at the data and decide"
   session, not a "build something to inform the decision" session.

Plus the maintenance-rhythm beat: every 4th-5th session is hygiene
only. We're due.
