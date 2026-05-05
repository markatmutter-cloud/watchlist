# Working with this repo

Notes for Claude Code (and any human picking this up cold). Keep this
file tight — read it once at the start of a session and you should know
how to behave for the rest of it.

**Doc separation (each has one job):**
- This file (CLAUDE.md) — durable working conventions. Read every session.
- [README.md](README.md) — what the project is + architecture. Public-facing.
- [ROADMAP.md](ROADMAP.md) — priorities, epics, what's explicitly out of scope.
- `SESSION_HANDOFF_*.md` — in-flight snapshot per session. **Not durable.**
  The current one is [SESSION_HANDOFF_2026-05-04.md](SESSION_HANDOFF_2026-05-04.md);
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
2026-05-04).** Challenges are collections with `type='challenge'`.
Schema additions in `supabase/schema/2026-05-03_challenges.sql`:
`target_count`, `budget`, `description_long`, `state`
(draft|complete), `parent_challenge_id` on collections; `is_pick`
(shortlist vs final pick) + `reasoning` on collection_items. ONE
collection per challenge — picks and shortlist live in the same
items table, distinguished by the boolean. Picks snapshot
`saved_price`/`saved_currency`/`saved_price_usd` so the total is
immutable once shared. Drafts persist as you go via useCollections.
Multi-stage UI flow lives in `ChallengeFlow.js`; stage is
component-local state. Drag-drop on desktop (HTML5 DnD; gated on
`(pointer: fine)`), tap-to-select on mobile.

**Surface (2026-05-04, PR #36):** Challenges moved from a Watchlist
sub-tab to a resource under the **References tab** (Mark's framing:
challenges are a reflective collector resource, not a saved-items
surface). The list + drill-in flow lives in
`src/components/ChallengesView.js`; ReferencesTab adds it as a
resource card alongside Watch size comparison. Selection state is
component-local (no URL persistence in this iteration). Stale
`?sub=challenges` / `dial_watch_top_tab=challenges` values
silently map to "listings" via the watchTopTab normalize().

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

**Share URL format.** Inbound share links use
`?listing=<id>&shared=1` on the root URL — no `react-router`, no
`/share/*` route. App.js parses on mount and renders a non-modal
banner + the listing's Card above `listingsGridJSX` in both shells.
URL is rewritten via `history.replaceState` after action so a
refresh doesn't re-trigger.

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
  No date dividers. **+Track eBay item** button lives in this
  sub-tab's strip.
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
(`public/tracked_lots.json` ∪ `public/auction_lots.json`) projects
into the main feed via `auctionLotItems` + `mainFeedItems` in
App.js. Hearts on auction-lot cards work like hearts on dealer
cards (Phase B2, PR #32): write to `watchlist_items` keyed by
`shortHash(url)`, no `_isTrackedLot` guard. The +Track button
stays for **eBay only** — auction-house URLs route through hearts
now. The `tracked_lots` table is the eBay scraping queue plus a
transient migration target; Phase B2's `<LotMigrationBanner/>`
does a one-shot per-user copy of any non-eBay tracked URL into
watchlist_items + delete from tracked_lots, idempotent via
`dial_lot_migration_v1_<uid>` localStorage.

**Comprehensive auction-lot scraping (2026-05-04, PR #31).**
`auction_lots_scraper.py` reads `public/auctions.json` and walks
every active sale, scraping per-lot detail for the four houses
with working access: **Antiquorum** (catalog page → per-lot fetch
of the catalog detail page), **Christie's** (inline
`window.chrComponents.lots.data.lots` blob — no per-lot fetch),
**Sotheby's** (`__NEXT_DATA__.props.pageProps.algoliaJson.hits`,
paginated via &page=N), **Phillips** (auction-page tile
enumeration → per-lot fetch via `scrape_phillips_lot`, capped at
60/sale to bound CI time). Output goes to
`public/auction_lots.json` keyed by URL — same shape as
`tracked_lots.json` so App.js projects them through one path,
deduping by URL with the comprehensive scrape winning ties.
Bonhams + Monaco Legend skipped (CF + SPA respectively). Per-house
enumeration failures are soft — one breakage doesn't kill the run.
Wired into `.github/workflows/scrape-auctions.yml` after the
`merge.py --auctions-only` step so the calendar is fresh when the
walker runs.

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

**Admin tab (2026-05-02).** `tab=admin` is gated by
`REACT_APP_ADMIN_EMAILS` (comma-separated, set in Vercel + .env.local).
Empty / unset = nobody is admin and the tab is unreachable. The
"Source quality" entry in the user dropdown is the only navigation
affordance — intentionally NOT in the main tab strip per ROADMAP
"Don't telegraph commercial intent publicly". Non-admins hitting
`?tab=admin` get silently redirected to listings (App.js useEffect
guards once `authReady` resolves, so signed-in admin users don't
flicker). Admin data: verification.json + verification_history.json
+ listings.json (all public on the static site) + Supabase
watchlist_items / hidden_listings (RLS-gated to the user's own rows).
Don't surface admin existence to non-admin users in any UI text.

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

## When in doubt

Read ROADMAP.md and the latest SESSION_HANDOFF, then ask. Mark prefers
"here's the tradeoff, want me to A or B?" over "I assumed B and shipped"
for anything bigger than a one-file fix.
