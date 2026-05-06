# Working with this repo

Notes for Claude Code (and any human picking this up cold). Keep this
file tight — read it once at the start of a session and you should know
how to behave for the rest of it.

**Doc separation (each has one job):**
- This file (CLAUDE.md) — durable working conventions. Read every session.
- [README.md](README.md) — what the project is + architecture. Public-facing.
- [ROADMAP.md](ROADMAP.md) — priorities, epics, what's explicitly out of scope.
- `SESSION_HANDOFF_*.md` — in-flight snapshot per session. **Not durable.**
  The current one is [SESSION_HANDOFF_2026-05-06.md](SESSION_HANDOFF_2026-05-06.md);
  older ones live in `archive/`.

If a gotcha or convention is durable (still true next session), graduate
it from the handoff to this file. If it's session-specific, leave it in
the handoff. When in doubt, ask.

## Working with Mark

- **Non-technical, but ships often.** Explain in plain English; flag risks
  but don't overexplain. Default to terse responses. No unprompted recap
  of work just done — the diff is right there.
- **Based in California (PT).** All time-of-day references are PT, not UTC.
- **Iterates by feel.** Mark adjusts priorities mid-session; that's normal,
  not a contract violation. But discipline is part of the value — when an
  ask drifts off-roadmap, point it out before complying. (See ROADMAP.md
  "For Claude Code" instructions.)
- **Verify before claiming done.** Vercel rebuilds ~60s after push. If the
  push touched JS/JSX/component files, confirm the new bundle is serving
  before reporting "shipped". Build-failures-that-don't-fail-loud have
  bitten this project once already.
- **iOS PWA install** at `the-watch-list.app`, so iOS-specific quirks
  (safe areas, icon caching, service-worker-controlled stale bundles)
  matter. When it works on desktop but not mobile, ReferenceError from
  hoisting order is a likely culprit (browsers report different errors).

For current priorities, direction, and what's explicitly out of scope,
read [ROADMAP.md](ROADMAP.md) before suggesting work.

## Architecture quick reference

Full diagram + folder layout in [README.md](README.md). One-paragraph summary:

Scrapers (Python `requests`, GitHub Actions 3×/day PT) write per-source
CSVs into `data/`. `merge.py` enriches into `public/listings.json` +
`public/state.json` (cross-run memory via stable URL-hash IDs).
Frontend is React (CRA, inline styles). `App.js` is the orchestrator
that owns state and JSX consts; render is delegated to
`src/components/MobileShell.js` + `DesktopShell.js`, each receiving
a single `shellProps` bag. Domain state hooks live under `src/hooks/`
(useTrackModal, useFavSearchModal, useViewSettings, useFilters,
useEBaySearches); shared style tokens in `src/styles.js`; pure
helpers in `src/utils.js`. Per-user data (watchlist, hidden, saved
searches, tracked lots, **collections + collection_items**) is in
Supabase with RLS. One serverless function: `api/img.js` (image
proxy for hot-link-protected dealers). Vercel Blob caches dealer
images for hearted items **only** — see `cache_watchlist_images.mjs`;
**don't extend the blob cache to the full feed**.

**Watchlist data model (post-Collections, 2026-05-01).** Approach A:
the user's default Favorites collection (the heart-on-card flow) is
implicit and remains backed by the existing `watchlist_items` table.
The `collections` + `collection_items` tables only store
user-created collections + the auto Shared-with-me inbox. The
asymmetry — default in one table, additional in another — is
intentional: it limits code churn and keeps `useWatchlist` /
heart-on-Card working without a migration. Schema lives in
`supabase/schema/2026-05-01_collections.sql`.

**UI rename Collections → Lists (2026-05-04, PR #24).** The Watchlist
sub-tab is now labeled "Lists" in the UI (and "+ New list", "Add to
list…", "Remove from list", etc. throughout). **Internals stayed
unchanged**: DB tables (`collections`, `collection_items`), hook
(`useCollections`), URL params (`?sub=collections`, `?col=<uuid>`),
localStorage value (`dial_watch_top_tab=collections`), sub-tab key
in `SUB_VALUES`, mutator names (`addItemToCollection`, etc.). The
Watch Challenges feature still says "challenge" in copy; only the
Lists sub-tab + its modals use the new label. When a future doc or
comment refers to "the Collections sub-tab", read it as "the Lists
sub-tab"; the UI label moved, the data model didn't.

**Watch Challenges (Build-a-collection v1, 2026-05-03; relocated
2026-05-04; rebuilt 2026-05-06).** Challenges are collections with
`type='challenge'`. Schema additions in
`supabase/schema/2026-05-03_challenges.sql`: `target_count`, `budget`,
`description_long`, `state` (draft|complete), `parent_challenge_id`
on collections; `is_pick` (legacy shortlist vs pick) + `reasoning`
on collection_items. ONE collection per challenge. Picks snapshot
`saved_price`/`saved_currency`/`saved_price_usd` so the total is
immutable once shared. Drafts persist as you go via useCollections.

**D3 paradigm shift (2026-05-06).** The shortlist concept is gone
in the UI — Lists + Favorites ARE the shortlist. Tap a tile in
the source picker → adds straight as a pick at the next empty
slot via `addToShortlist(..., { isPick: true })`. Drag-drop is
gone everywhere; click-pick is the single interaction model. The
`is_pick=false` rows in older challenges still exist in the DB
but the UI doesn't surface them — harmless ghost data. Sticky
stat row at the top of the picking page; one page-scroll (no
nested overflow on the source picker). Single challenge-wide note
in `challenges.descriptionLong` replaces the per-pick reasoning
column (which still exists for older data but isn't surfaced).
Stepper is 3 stages: Set / Pick / Share — the standalone
Reasoning stage was retired.

**Pivot consideration (held).** Mark mid-session 2026-05-06
floated a "Collection Planner" reframe (wishlist → buy → into
watchbox) that would merge Watch Challenges with Watchbox v2 and
embrace social loops (sender attribution, shared-with-me inbox,
recipient responses). He paused that pivot and asked for tactical
fixes (D1→D4) instead. The pivot stays an open question for a
future session — not in ROADMAP yet. If a future Mark message
revisits it, that's the entry point.

**Surface (2026-05-04, PR #36):** Challenges moved from a Watchlist
sub-tab to a resource under the **Cool Stuff tab** (UI label;
internal route + component name are still `references` /
`ReferencesTab` per the rename note above). Mark's framing:
challenges are a reflective collector resource, not a saved-items
surface. The list + drill-in flow lives in
`src/components/ChallengesView.js`; ReferencesTab adds it as a
resource card alongside Watch size comparison + Cool Stuff > Links.
Selection state is component-local (no URL persistence in this
iteration). Stale `?sub=challenges` / `dial_watch_top_tab=challenges`
values silently map to "listings" via the watchTopTab normalize().

**Hidden listings as a virtual list (2026-05-01).** Hidden follows
the same Approach A pattern as Favorites: data stays in the existing
`hidden_listings` table, but the UI surface is a synthetic "Hidden"
row inside Watchlist > Lists (rendered by WatchlistTab.js, not a
real DB row). Sentinel id `__hidden__` keeps the synthetic row from
colliding with real collection UUIDs. The drill-in renders the
items grid with `isHidden={true}` so each Card's "..." menu Hide
entry flips to "Unhide" automatically. There is no `HiddenModal`
anymore — the old user-dropdown "Manage hidden" item was removed
and the file deleted. Don't migrate `hidden_listings` into
`collection_items` for the same reason as Favorites: the migration
would touch every read path that already uses `useWatchlist().hidden`.

**Share URL format (post-2026-05-06).** Outbound share links built
by `handleShare` use the `/share/<id>` path. Vercel rewrites that
to the `api/share.js` serverless function (see `vercel.json`) which
returns HTML with per-listing Open Graph tags (so iMessage / Slack
/ Discord preview cards show the actual watch + a "Watchlist —
Vintage watches in one feed" caption rather than the site logo)
plus a meta-refresh + JS redirect to `?listing=<id>&shared=1` on
the root. Real browsers land on the SPA's existing share-receive
surface unchanged; preview bots stop after the head-scrape and
never see the redirect. Older share links using the legacy
`?listing=<id>&shared=1` pattern still work — ShareReceiver still
parses them — they just won't get the dynamic OG preview. URL is
rewritten via `history.replaceState` after action so a refresh
doesn't re-trigger.

**Share-receive landing surface (2026-05-06 redesign).**
ShareReceiver detects share intent in a `useEffect` on mount, sets
its own `shareIntent` state, AND mirrors a one-bit `shareActive`
flag back up to App.js via the `setShareActive` prop. App.js stores
that in a `useState` at the TOP of its hook list (before the
loading/loadError early returns — adding hooks past those triggers
React #310, see Things-to-never-do). Both shells gate their regular
tab content on `shareActive`: when true, only the focused share
surface renders in the main content area; when false, business as
usual. ShareReceiver itself owns all share-related hooks (the v3
isolation pattern after v2's React #310 in production) — only the
single `shareActive` mirror lives at the parent. The focused
surface is two-column on desktop (image left, details + Save /
Dismiss + onboarding text right) and stacked on mobile, with three
orientation anchors below ("Browse all listings", "Go to your
saved list", "Cool stuff") for first-time visitors. Bottom padding
on the surface is 110px so it clears the mobile tab bar.

**Listings tab structure (sub-tabs, 2026-05-04, PR #33).** Four
sub-tabs replace the earlier blend-sort + tri-state pill experiment:
- **Live listings** — currently-active dealer items only. Default
  sort = newest `firstSeen` first; date dividers Today / Yesterday /
  weekday / Last week / Older.
- **Live auctions** — currently-active auction lots only. Default
  sort = ending soonest (live → upcoming asc → ended desc →
  non-auction last). No date dividers.
- **All sold** — sold dealers ∪ sold auction lots. Default sort =
  most-recently-sold first; sold-date dividers Today sold /
  Yesterday sold / weekday sold / Last week sold / Older sold.
- **Auction calendar** — month-banded list of upcoming sales
  (existing AuctionCalendar component, no card grid; filter row
  hidden).

State: `listingsSubTab` in `useFilters` is no longer there — it
moved to App.js (own useState since the URL/localStorage init
needed access to query params). Persisted under
`dial_listings_sub_tab`. URL: `?tab=listings&sub=<live|auctions|sold|calendar>`,
default ("live") stripped from URL. Watchlist's own `?sub=` keeps
working for its sub-tab values; the App.js URL sync writes
whichever sub-tab matches the active main tab.

Date pill semantics depend on sub-tab — Date↓ means newest
firstSeen on Live listings, ending-soonest on Live auctions,
most-recently-sold on All sold. Dispatch lives in App.js's
`allFiltered` sort branch. Date dividers in `visibleWithDividers`.

Sub-tabs gate filter exposure: Live listings hides the Auction
houses chip group (no live dealer items in those sources); Live
auctions hides the Dealers group; Sold + Calendar show both.
Calendar sub-tab hides the filter row entirely.

The Listings tab no longer has a Status (Live/Sold/All) segment —
the sub-tabs cover that role. (Watchlist also dropped the segment
2026-05-04 PR #36 — see Watchlist sub-tabs note below.)

**Watchlist tab structure (sub-tabs, 2026-05-04, PR #36).** Mirrors
the Listings tab restructure. Five sub-tabs:
- **Saved listings** (key `listings`) — currently-active hearted
  dealer items. Default sort = `savedAt` desc. Date dividers
  ("Today saved" / weekday saved / "Last week saved" / "Older saved").
- **Saved auctions** (key `auctions`) — currently-active auction
  lots + ALL eBay items (BIN included, per Mark — eBay always lives
  here regardless of buying_option). Default sort = ending soonest.
  No date dividers. (The +Track eBay item trigger button briefly
  lived here in PR #38 + #41, then was removed in PR #52 along with
  the SubTabIntro banner. The TrackNewItemModal infrastructure +
  `openTrackModal` prop wiring stay in place — re-adding a trigger
  anywhere is a one-line change.)
- **Saved sold** (key `sold`) — saved items that went sold (dealer
  or lot). Default sort = sold-date desc. Sold-date dividers.
- **Favorite searches** (key `searches`) — saved-search editor.
- **Lists** (key `collections`) — user-created collections + Shared
  inbox + synthetic Hidden row.

Sub-tab routing in `App.js`'s watchItems memo: filter by
watchTopTab BEFORE applying source/brand/ref/search/price filters.
Sort dispatch depends on sub-tab — savedAt for Saved listings,
endingSoonComparator for Saved auctions, sold-date for Saved sold.
The eBay-as-auctions classification: `i.source === "eBay"` OR
`/\bebay\.[a-z.]+\//i.test(i.url)` OR `i._isAuctionFormat`.

**Removed in PR #36:** the Status (Live/Sold/All) segment, the
Auctions-only toggle (filterAuctionsOnly state gone from useFilters),
the EndingSoon pinned strip + the EndingSoon component file (Mark's
call: Saved auctions sub-tab IS the ending-soon view now), the
`watchLive` / `watchSold` derived memos. Stale localStorage values
(`challenges`, `calendar`) silently map to `listings`.

**Listings → auction-lot data flow.** Tracked-lot data
(`public/tracked_lots.json` ∪ `public/auction_lots.json` ∪
`public/manual_archive_lots.json`) projects into the main feed via
`auctionLotItems` + `mainFeedItems` in App.js. Hearts on auction-lot
cards work like hearts on dealer cards (Phase B2, PR #32): write to
`watchlist_items` keyed by `shortHash(url)`, no `_isTrackedLot`
guard. The `tracked_lots` table remains **eBay-only** as a routing
rule — auction-house URLs flow through hearts on the unified feed
(no `tracked_lots` insert), eBay items still flow through
`tracked_lots` because eBay isn't in the comprehensive sweep
infrastructure. The `+Track eBay item` UI trigger was removed in
PR #52; the modal + hook stay wired through App.js for re-add.
Phase B2's `<LotMigrationBanner/>` does a one-shot per-user copy
of any non-eBay tracked URL into watchlist_items + delete from
tracked_lots, idempotent via
`dial_lot_migration_v1_<uid>` localStorage.

**Comprehensive auction-lot scraping (2026-05-04, PR #31; significantly
revised 2026-05-05 PR #48).** `auction_lots_scraper.py` reads
`public/auctions.json` and walks every active sale, scraping per-lot
detail for the four houses with working access:
- **Antiquorum** — `live.antiquorum.swiss/auctions/<id>?limit=1000`
  single fetch; parses `viewVars.lots.result_page`. Pre-PR #48 used
  the catalog paginator, which was vendor-broken (?page=N
  301-redirected). Catalog URL bridge in
  `_resolve_antiquorum_live_auction_url`. See Scraper conventions
  below for the full "live page" rule.
- **Christie's** — inline `window.chrComponents.lots.data.lots` JSON
  blob on the auction page; no per-lot fetch.
- **Sotheby's** — `__NEXT_DATA__.props.pageProps.algoliaJson.hits`,
  paginated via `&page=N`. PR #46 added a per-lot fetch to extract
  the canonical `og:image` brightspotcdn URL (algoliaJson hit
  doesn't carry it).
- **Phillips** — auction-page tile enumeration → per-lot fetch via
  `scrape_phillips_lot`. Cap raised 60 → 1000 in PR #48. Sold-price
  extraction uses the rendered "Sold For" panel (PR #42 fix; JSON-LD
  `price` is the low estimate, not hammer). See Scraper conventions
  below.

Output goes to `public/auction_lots.json` keyed by URL — same shape
as `tracked_lots.json` so App.js projects them through one path,
deduping by URL with the comprehensive scrape winning ties. Bonhams
+ Monaco Legend lot-level scraping skipped (Cloudflare + SPA-no-
server-rendered-links respectively); calendar-only at the Epic 1
level. Per-house enumeration failures are soft — one breakage
doesn't kill the run. Wired into `.github/workflows/scrape-auctions.yml`
after the `merge.py --auctions-only` step so the calendar is fresh
when the walker runs.

Manual archive sales feed a separate file
(`public/manual_archive_lots.json`) via `manual_archive_scraper.py`
to avoid being clobbered by the daily comprehensive sweep — see the
"Manual archive-sale pipeline" section below.

**Auction-lot category exclusion (2026-05-04).** Per Mark: filter
ONLY pocket watches, clocks, and loose dials at scrape time. KEEP
every other accessory (boxes, hats, original adverts, equipment,
watch parts other than dials). Title-based regex in
`auction_lots_scraper.EXCLUDE_PATTERNS`: bare `\bpocket\b` is broad
enough to catch "openface pocket", "pocket chronometer", etc.
without false positives in auction-watch titles. Future
auction-side scrapers (e.g. when Bonhams/MLA come online) should
import + apply the same `is_excluded_title` predicate so the
display layer can keep assuming inputs are pre-filtered.

**Location URL params.** `tab` (listings | watchlist | references |
admin) and `sub` (per-active-tab) reflect navigation state via
`history.replaceState`. `sub` values:
- `tab=listings` → live | auctions | sold | calendar (default
  "live" stripped from URL)
- `tab=watchlist` → listings | auctions | sold | searches |
  collections (default "listings" stripped from URL; key stays
  `collections` for the Lists sub-tab — see UI rename note above;
  `challenges` was retired with PR #36)

`col` (collection UUID, or `__hidden__` for the synthetic Hidden
list) is Watchlist-only. App.js owns `tab` + `sub`; WatchlistTab
owns `col`. App.js's effect clears `col` when leaving the watchlist
tab so the URL stays clean. All URL-sync effects skip when
share-receive params (`shared=1`) are present so the share flow
controls URL until it acts. Refresh on any of these lands the user
back where they were. Stay on this query-param pattern — it's
deliberate that we don't bring in `react-router`.

**Admin tab (2026-05-02; renamed dropdown entry 2026-05-06).**
`tab=admin` is gated by `REACT_APP_ADMIN_EMAILS` (comma-separated,
set in Vercel + .env.local). Empty / unset = nobody is admin and
the tab is unreachable. The "Site stats" entry in the user
dropdown is the only navigation affordance — intentionally NOT in
the main tab strip per ROADMAP "Don't telegraph commercial intent
publicly". (Was labeled "Source quality" until the admin page
grew Auction house quality + User limits sections.) Non-admins hitting
`?tab=admin` get silently redirected to listings (App.js useEffect
guards once `authReady` resolves, so signed-in admin users don't
flicker). Admin data: verification.json + verification_history.json
+ listings.json (all public on the static site) + Supabase
watchlist_items / hidden_listings (RLS-gated to the user's own rows).
Don't surface admin existence to non-admin users in any UI text.

**Listing events telemetry (Epic 8 — User stats half, 2026-05-05).**
Six event types written to `listing_events` from the frontend:
`view` / `click` / `save` / `hide` / `list_add` / `share`. Anonymous-
friendly via a stable UUID in `localStorage` at key `dial_watch_anon_id`
(don't bump it — same person across visits hinges on this). Reads are
admin-only via RLS, gated by an `admin_emails` table + `is_admin()`
SQL function (mirrors `REACT_APP_ADMIN_EMAILS` at the DB layer; seed
the table once via the SQL editor). Schema:
`supabase/schema/2026-05-05_listing_events.sql`. Hook:
`src/hooks/useEventTelemetry.js`. **Telemetry is fire-and-forget** —
never await `recordEvent`, never surface errors to the user; on
view-event failure the dedup is rolled back so the next intersection
can re-fire. View events are deduped per page-load via a module-scoped
Set (refresh resets — that's deliberate; "session view" is the unit).
Daily rollup runs at 09:15 UTC (`.github/workflows/rollup-events.yml`)
and aggregates raw events into `listing_events_daily`, then prunes
raw rows older than 90 days. **Don't query raw `listing_events` from
the dashboard** — read from the rollup via the
`source_engagement_summary` RPC. Today's events appear after the
next rollup; admin can trigger one early via
`select public.rollup_and_prune_listing_events();` in the SQL editor.

**User limits (Epic 3, 2026-05-06).** Default cap of 2,500 hearts
per user, enforced by a BEFORE INSERT trigger on `watchlist_items`
(`enforce_watchlist_cap`). Per-user overrides live in `user_limits`
(admin-only mutate via RLS). System default lives in one place —
the `default_watchlist_cap()` SQL function — bump there if it ever
changes. Frontend hook `useUserLimit(user, count)` returns
`{ cap, count, isAtSoftWarn, isAtHardCap }`; the soft-warn
threshold is 80% of cap. UI surface is `<UserLimitBanner/>`,
mounted next to `<ShareReceiver/>` in both shells (so it's visible
on every tab). `handleWish` no-ops on the add-direction when at
hard cap so the user gets the persistent banner instead of an
invisibly-failed insert. Admin expansion via the AdminTab "User
limits" section or the `set_watchlist_cap_by_email(email, cap, note)`
RPC (admin-only on the SQL side). Schema:
`supabase/schema/2026-05-06_user_limits.sql`. Hook:
`src/hooks/useUserLimit.js`. Banner:
`src/components/UserLimitBanner.js`.

## Scraper conventions

- Each dealer / auction house has its own `*_scraper.py` at repo root.
  Per-source structure is intentional — one breaking site means one file
  to debug. **Shared helpers ARE allowed (post-2026-05-05)** — Mark
  signed off on a shared `scraper_lib.py` of opt-in helpers (e.g.
  `fetch_shopify_products(base, collection)`,
  `fetch_woocommerce_store_api(base)`, `parse_wix_products_blob(html)`)
  that scrapers can call into without being forced to. Keep helpers
  *opt-in*, not driver-style: the per-dealer file should still exist
  and own its quirks, just delegating the boilerplate. The original
  guard against driver-collapse (one config-driven script for all
  Shopify dealers) still stands — Bulang & Sons collection-scoping,
  Falco's nonstandard fields, etc. are exactly the divergence that
  argues for keeping per-dealer files.
- Each scraper writes a CSV to `<name>_listings.csv` in cwd; the workflow
  step then moves it to `data/<name>.csv`. `merge.py`'s SOURCES list maps
  CSV path → display name → currency.
- Auction calendars produce `*_auctions_listings.csv` and land in
  `data/<name>_auctions.csv`; `merge.py` auto-globs `data/*_auctions.csv`
  so adding a new auction scraper doesn't require touching merge.py.
- `continue-on-error: true` on each scrape step in the workflow so one
  failing source doesn't kill the batch.
- **Per-locale dealer HTML.** Some multi-locale sites (e.g.
  ClassicHeuer at `/chronographs/<slug>` vs `/en/chronographs/<slug>`)
  serve different HTML per locale, with one lagging behind the other on
  state changes (e.g. SOLD overlay shows on the German page hours
  before the English page). Fetch from the locale users actually
  browse, not whatever the API permalink hands back. Write the same
  locale URL into the CSV so the card click-through lands on the
  page users would have reached themselves. ClassicHeuer's
  `english_url()` helper is the reference pattern.
- **Don't trust URL slug patterns alone for content classification.**
  Dealers often reuse slot names: Heuertime publishes real watches
  into pages slugged `kopie-van-template-for-watches-N` that look
  like leftover scaffolding. Skip URLs only when the rendered detail
  page genuinely lacks content (empty title, no price). The Heuertime
  fix on 2026-05-04 (PR #28) reinstated 4 watches that the
  slug-pattern filter was dropping.
- **Greedy regex with `re.S` (DOTALL) can leak past closing tags.**
  Pattern `class="...is-larger...">.*?>SOLD<` with DOTALL skipped
  past an empty `</div>` and matched the next SOLD badge later on
  the page — false-positive on every live item. Anchor on
  immediate-child structural markers (`<div ... badge ...>` directly
  inside the container, with only `\s*` between layers), not just
  text. Cost a re-roll on 2026-05-04 (PR #26 → PR #27).
- **Wix detail pages aren't stable across edge variants.** Wix
  serves different SSR markup to GitHub Actions runners than to
  local development machines (likely IP / region / Accept-header
  driven). The Heuertime image picker hit this twice (PR #22 fix
  worked locally, broke on cron; PR #23 pivoted to homepage tile
  thumbnails). Where possible extract from the homepage rendering
  instead of detail pages, and only fall back to detail pages for
  fields the home grid doesn't carry (title, price text).
- **Image-proxy pattern for hot-link-protected dealers.** Three
  dealers route through `/api/img` (Watchfid, Watches of Lancashire,
  + a future fourth eventually). When a dealer returns 4xx to
  cross-origin browser fetches (Cloudflare 403 with `vary: referer`,
  Apache 404 on `Accept: image/webp`, etc.), add the host to BOTH
  `src/utils.js` `PROXIED_IMG_HOSTS` AND `api/img.js` `ALLOWED_HOSTS`
  + `REFERER_BY_HOST` in lockstep. The proxy fetches with the
  dealer's own domain in Referer and minimal Accept. The CSV's
  raw image URL stays unchanged; `imgSrc()` rewrites at render time.
- **`is_excluded_title` strips "o'clock" before running the
  clock-pattern regex.** The bare `\bclock\b` pattern matched
  "date aperture at 6 o'clock" and silently dropped 9/42 lots in
  the CH080317 archive run on 2026-05-05. Fix lives in
  `auction_lots_scraper.is_excluded_title` — strip
  `\bo['']clock\b` (both ASCII and curly apostrophe variants)
  before iterating EXCLUDE_PATTERNS. Same regex shape lives in any
  future title-pattern exclusion; check for similar false-positive
  vectors before trusting `\bclock\b` / `\bdial\b` / `\bpocket\b`
  without context.
- **Phillips `sold_price` extraction uses the rendered "Sold For"
  panel, not the JSON-LD price.** JSON-LD `offers.price` on Phillips
  lot pages is always the *low estimate* — it just happens to
  coincide with the hammer for some lots, so the original
  `auctionlots_scraper.scrape_phillips_lot` mapping was provisional.
  Validated against CH080317 archive 2026-05-05: real hammer is
  rendered inside `<span ...>Sold For</span> ... <span ...>CHF20,000</span>`.
  Extractor anchors on that pattern; falls back to ld_price only when
  the panel is missing (very rare). Affects every sold Phillips lot,
  including the daily comprehensive sweep — fix is global.
- **Antiquorum lot scraping uses `live.antiquorum.swiss`, not
  `catalog.antiquorum.swiss`.** Catalog's `?page=N` 301-redirects
  to `/lots`, so the catalog scraper had only ever seen the first
  20 of 600+ lots per sale (vendor-broken pagination, can't fix).
  Live page embeds the entire lot set in
  `viewVars.lots.result_page` — single fetch, no pagination. URL
  pattern: `live.antiquorum.swiss/auctions/<id>/...?limit=1000`;
  the server caps `?limit=1000` at the actual lot count, so it's
  future-proof without us tracking sale sizes. The catalog URL in
  `data/antiquorum_auctions.csv` is bridged at scrape time:
  `_resolve_antiquorum_live_auction_url` fetches the catalog page,
  finds any per-lot live URL, follows it, parses `auction._detail_url`
  out of the live lot's viewVars. ~1.5s of overhead per sale.
- **Sotheby's lot images via per-lot `og:image` fetch.** algoliaJson
  hits don't carry the brightspotcdn URL (hash isn't derivable). One
  per-lot HTTP fetch grabs the canonical 4096×4096 brightspot URL
  from the `og:image` meta. Body-scan fallback (largest-resize
  brightspotcdn URL anywhere in the body) catches the small minority
  of older lots without a social preview. Cost: ~1.5s per lot.
- **Per-sale lot caps are CI-time guards, not policy.** Phillips
  was capped at 60/sale before 2026-05-05 (CH080226 = 227, HK080226
  = 308 — missing 70-80% of every large sale). Cap raised to 1000.
  GitHub Actions on this public repo has unlimited minutes; only
  cost is wall-clock. Default to "scrape all lots" unless there's a
  specific reason to truncate.

## Manual archive-sale pipeline

For historical auction sales (Phase D / Epic 2 archive layer):

- **Registry:** `data/manual_archive_sales.json` — one entry per
  archive sale with `{url, house, title, date}`.
- **Scraper:** `manual_archive_scraper.py` reads the registry, walks
  each sale via the existing per-house enumerators (with the lot cap
  removed for archive runs), writes `public/manual_archive_lots.json`.
  Idempotent — re-running merges cleanly.
- **Output is immutable:** archive sales never update post-hoc, so
  the JSON file is committed once per added sale and stays frozen.
  This is why it's a SEPARATE file from `auction_lots.json` (which
  the daily comprehensive sweep rebuilds from scratch — co-locating
  would clobber archive entries every cron run).
- **App.js loads + merges** `manual_archive_lots.json` alongside
  `auction_lots.json` and `tracked_lots.json` into `auctionLotItems`
  with the same shape.
- **Adding a new archive sale is an in-session task**, not a roadmap
  item — Mark's call. Phillips archive URLs work on the existing
  Phillips path; Antiquorum archive URLs would need an enumerator
  extension when needed.

## Backend-emitted display fields (prefer over inline derivation)

`merge.py` emits a few computed fields on every enriched record so
the frontend doesn't re-derive them inline. Prefer the field over
re-walking the source data:

- **`lastMeaningfulPrice`** — last non-zero entry from `priceHistory`
  (or current `price` when history is clean / a fresh listing).
  Surfaces a usable display value for items whose CURRENT price is
  0 — typically because they've gone "Price on request" before
  disappearing. ~40% of sold dealer items hit this case. The Card
  render prefers `item.lastMeaningfulPrice`; falls back to inline
  priceHistory walk only for older `state.json` snapshots that
  predate this field.

When adding new computed-display fields, follow the same shape:
emit at merge time, prefer the field on the frontend, keep an
inline-derive fallback for older snapshots.

## Tests

Two suites, both run on every push to main and every PR via
`.github/workflows/tests.yml`:

- **pytest** (`tests/test_merge_state.py`) — state-transition logic in
  `merge.update_state`. Cross-run memory layer where regressions would
  be costly and silent. Synthetic input dicts only.
- **jest** (`src/components/*.test.jsx`) — render-without-crash + key
  visibility assertions for `MobileShell` + `DesktopShell`. Catches
  the TDZ class of bug that shipped a white screen on mobile in late
  April 2026. Single mock fixture in
  `src/components/__fixtures__/mockShellProps.js`; tests override
  individual fields rather than rebuilding the ~60-prop bag.

Run locally:

```
pip install -r requirements-dev.txt    # one-time setup
pytest                                  # Python suite

npm install                             # one-time setup
npm test                                # jest watch mode
npm run test:ci                         # jest single-run (CI mode)
```

When adding new state-transition behavior to `merge.py`, add a
corresponding test in `tests/test_merge_state.py`. When adding a new
prop to either shell, mirror it in `mockShellProps.js` so the smoke
tests keep covering missing-prop regressions.

Currently-documented bugs in pytest (e.g. silent currency switches)
live as behavior-documenting tests rather than expected-failures —
when those bugs are fixed, the relevant test needs an update too.

## Print scoping for in-app tools

Anything that needs to print (currently: References → Watch size
comparison) should NOT use the prototype pattern of
`body * { visibility: hidden }`. That pattern is brittle inside a
React app — it visibility-hides the entire app tree and depends on
incidental CSS specificity to surface the print content.

Instead, use a **React Portal** mounted to `document.body`:

```jsx
const [printActive, setPrintActive] = useState(false);
const handlePrint = () => {
  setPrintActive(true);
  setTimeout(() => {
    try { window.print(); } finally { setPrintActive(false); }
  }, 60);
};
// ...
{printActive && createPortal(<PrintSheet ... />, document.body)}
```

The portal renders the print sheet as a direct child of `<body>`,
sibling to `#root`. The global `@media print` rule in
`public/index.html` hides every body child except the portal:

```css
@media print {
  body > *:not(.size-compare-print-sheet-portal) { display: none !important; }
}
```

When `printActive` is false the portal isn't in the DOM at all, so
printing from any other page on the site is unaffected. Verify the
calibration ruler measures correctly in Chrome's print preview at
100% scale — that's the killer feature for size comparison and the
non-negotiable bar for any future print-to-scale tool.

To add a new printable tool: render its sheet via `createPortal` to
`document.body` with a class that matches a selector in the
`index.html` print rules (or extend the rule's selector list).

## Things to never do

- **Don't bump `LEGACY_WATCHLIST_KEY` / `LEGACY_HIDDEN_KEY`** in App.js —
  they're stable storage keys for users' pre-Supabase localStorage data
  that the import banner reads on first sign-in.
- **Don't bump `dial_watch_anon_id`.** It's the stable per-browser
  UUID for `listing_events` telemetry. Bumping resets every visitor's
  identity in the rollup, breaking 30-day per-source comparisons.
  Same applies to renaming the localStorage key.
- **Don't `await` `recordEvent` / route telemetry through the user
  flow.** The hook is fire-and-forget by design — surfacing errors,
  retrying, or blocking the heart toggle on a failed insert breaks
  the user experience for the sake of an analytics row that doesn't
  affect anything user-visible.
- **Don't query raw `listing_events` from the dashboard.** Read
  `listing_events_daily` via `source_engagement_summary`. The raw
  table is pruned to a 90-day retention window AND can grow large
  enough to bump into PostgREST row limits — the rollup is what the
  UI is supposed to read. If you need a never-rolled-up event for
  debugging, query directly from the SQL editor.
- **Don't extend the Vercel Blob cache** to listings/auctions feeds.
  Watchlist-only is intentional (auction images stay up long-term;
  caching ~1,800 dealer images costs storage for transient inventory).
- **Don't skip Vercel verification** after a JS change. Use the bundle
  hash in `index.html` to confirm the new build is serving before
  reporting done.
- **Don't reintroduce in-app messaging, reactions, replies, sender
  identity exposure, or notifications for shares.** The user's chosen
  messaging tool (iMessage / WhatsApp / email / Slack / AirDrop)
  handles all of that. Watchlist's share primitive is a one-tap export
  to the native share sheet + a recipient banner. Adding any kind of
  in-app social layer was explicitly rejected in the v1 design and
  belongs in ROADMAP's "Explicitly NOT" list.
- **Don't auto-redirect shared listing links** to a separate landing
  page or to the dealer's site. The recipient sees the listing in the
  same UI they'd browse to themselves, with an additive banner. The
  dealer link is one tap on the Card.
- **Don't migrate `watchlist_items` into `collection_items`** without
  a deliberate decision. Approach A (default-Favorites-stays-implicit)
  is the agreed shape; flipping to a fuller migration would touch
  every read path that hits `useWatchlist`. Revisit only if the
  asymmetry causes real pain.
- **Don't reintroduce the `_isTrackedLot` no-op guard on hearts.**
  Phase B2 (2026-05-04) intentionally removed it — auction-lot
  cards now write to `watchlist_items` keyed by `shortHash(url)`
  via `toggleWatchlist`, the same code path dealer hearts use.
  Duplicate-card prevention lives in two places now:
  (a) the `watchItems` projection skips the tracked_lots loop entry
  when the same shortHash id is already in the user's watchlist;
  (b) the per-user migration in `<LotMigrationBanner/>` deletes the
  tracked_lots row after copying it into watchlist_items, so eBay
  is the only routine source of tracked_lots inserts going forward.
  If a future change adds a new tracked_lots-shaped surface, mirror
  the dedup in watchItems rather than reintroducing the guard.
- **Don't widen the +Track URL validator past eBay.** Auction-house
  lots come in via the comprehensive scrape (Phase B1) and get
  hearted from the unified feed. Re-allowing Antiquorum / Christie's
  / Sotheby's / Phillips URL patterns in `useTrackedLots.add`
  would create a parallel save path that the comprehensive scraper
  can't deduplicate. eBay stays because it's not in the
  comprehensive scrape (different infrastructure).
- **Don't bring back the Listings tri-state pill or the blend
  sort.** PR #33 (2026-05-04) replaced both with explicit sub-tabs
  (Live / Live auctions / All sold / Auction calendar) because the
  blend was hard to explain and mixed time-axes. Each sub-tab now
  has a clear default sort and a clear scope. Adding the pill back
  would re-introduce a control with overlapping semantics; mixing
  dealer items + auction lots in one card grid with a single sort
  axis was the underlying mistake.
- **Don't add a Status (Live/Sold/All) segment to either Listings
  or Watchlist.** Both tabs use sub-tabs for that scope now (PR #33
  on Listings; PR #36 on Watchlist). The earlier two-axis system
  (status pill × auctions-only toggle) was retired because the
  combinations were hard to reason about and the sub-tabs read
  cleanly. If a single-tab "All status for this reference" view is
  needed in future, fold it into the search-result UI rather than
  re-introducing the segment.
- **Don't reintroduce the EndingSoon pinned strip on Watchlist.**
  Removed PR #36; Saved auctions sub-tab IS the ending-soon view
  now (default sort is ending-soonest, and the user gets there in
  one click). Adding the strip back puts the same data in two
  places — the strip and the sub-tab — and re-creates the heart-
  click duplicate-card class of bug it had on its first ship.
- **Don't put Watch Challenges back under a Watchlist sub-tab.**
  Lives under References tab now (PR #36). Mark's framing:
  challenges are a *reflective collector resource* (constrained-set
  thought experiments), not a saved-items surface — the Watchlist
  tab is for things you own/want, References is for tools that help
  you think about collecting.
- **Don't add new `useState`/`useMemo`/`useCallback` deep into App.js**
  near render-conditional code paths. Adding hooks to the back of
  App.js's already-large hook list triggered React error #310
  ("rendered more hooks than during the previous render") TWICE during
  the Collections + Sharing build. New rule: if a feature needs new
  hooks, put them in a self-contained component App.js mounts
  unconditionally. `<ShareReceiver/>` (commit b6cb57b) is the
  reference pattern.
- **Don't write `// eslint-disable-next-line <rule>` for a rule that
  isn't configured in this CRA project.** The setup doesn't enable
  `react-hooks/exhaustive-deps` (and several others), so an unknown-
  rule disable comment fails as "Definition for rule 'X' was not
  found" → `CI=true` upgrades it to a build failure → Vercel red.
  Cost one rebuild on 2026-05-03 (PR #14). If you intentionally
  omit a hook dep, just leave a plain comment explaining why
  (no eslint-disable needed because no rule is firing).
- **Don't put a `{/* ... */}` JSX comment between `return (` and the
  root JSX element.** CRA's parser reads it as a stray object literal
  → "Unexpected token, expected ','" → CRA's `CI=true` upgrades the
  parse error to a build failure → Vercel ships eight consecutive red
  Production deploys before anyone notices. Cost us a session on
  2026-05-01 (commit `01104d6` was the fix). Comments belong INSIDE
  the JSX tree (`<div>{/* ... */}</div>`) or above the `return`. Same
  trap exists for any expression that isn't a single JSX element in
  that slot.
- **Don't update brand aliases on only one side.** `merge.py`
  `BRAND_ALIASES` (Python) and `src/utils.js` `BRAND_ALIASES` (JS)
  must stay in lockstep. The frontend canonicalises saved snapshots
  at read time so older `watchlist_items` rows benefit from new
  aliases without a re-scrape; the backend canonicalises during
  scrape merge. A new alias added to one but not the other will
  manifest as the same brand showing under two chips for older
  saved entries vs new ones. Same rule applies to `EXCLUDED_BRANDS`
  (backend only — never reaches the user-facing feed).
- **Don't promote `FORCE_OTHER_BRANDS` or `SUPPRESS_AT_SOLD_BRANDS`
  to a backend rewrite without a deliberate decision.** Both are
  intentionally frontend-only (`src/utils.js`) so the data layer
  keeps the original brand label. `FORCE_OTHER_BRANDS` makes the
  brand chip rail collapse a brand into "Other" without losing the
  field; `SUPPRESS_AT_SOLD_BRANDS` hides specific brands from
  Listings > All sold UNLESS the user has hearted them
  (`watchlist[i.id]` override). Reverting either is a one-line edit.
  A backend rewrite (e.g. mapping brand=Mulco → brand=Other in
  `merge.py`) loses the original label and can't be undone without
  re-scraping. The Mulco / Wittnauer / Pro Hunter pooling done in
  PR #50 is the reference pattern.
- **Don't compute `brandCounts` off `items` alone.** Pre-2026-05-05
  it was — meaning Listings > Live auctions could surface a brand
  chip whose `auctionLotItems` set was empty. The fix in `App.js`'s
  `brandCounts` memo dispatches on `tab` + `listingsSubTab`:
  `auctions` reads the live auction-lot pool, `sold` reads the
  sold-mixed pool, everything else falls through to live dealer
  items. When adding a new sub-tab or surface that has its own
  filterable set, extend the dispatch — don't fall back to the
  global `items` set.
- **Don't ship a `merge.py`-touching change without updating
  `tests/test_merge_state.py`.** The state-transition layer is the
  one place we have unit-test coverage; regressions there silently
  corrupt the cross-run memory that drives "NEW" badges, price-drop
  detection, the sold/archive view, and (post-2026-05-05) the
  `lastMeaningfulPrice` field. Add a behaviour-pinning test for
  any new field merge.py emits AND for any change in the
  enrichment / disappearance logic.
- **Don't claim a PR is "shipped" until CI is green on it.** Twice
  in this session I described work as shipped before the test
  workflow finished, and twice the test workflow caught a real
  regression after the merge had landed. PR #38 + PR #39 each
  introduced a test failure that was only visible post-merge; both
  needed a hotfix. Watch CI to completion (Bash `run_in_background`
  with an `until` loop is the canonical pattern) before reporting
  done. Pair with: when adding a new shell prop, mirror it in
  `mockShellProps.js` in the same edit.

## When in doubt

Read ROADMAP.md and the latest SESSION_HANDOFF, then ask. Mark prefers
"here's the tradeoff, want me to A or B?" over "I assumed B and shipped"
for anything bigger than a one-file fix.
