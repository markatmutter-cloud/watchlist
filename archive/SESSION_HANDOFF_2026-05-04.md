# Watchlist — Session Handoff (2026-05-04)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — the durable rules graduate to CLAUDE.md, the durable plans
graduate to ROADMAP.md.

## TL;DR

Long day. AM: bug-fix session (8 PRs). PM: **Listings unified feed
→ comprehensive auction-lot scrape → heart-on-lot → Listings
sub-tab restructure → tweaks → Watchlist sub-tab restructure +
Challenges → References → Watchlist UI tweaks → Cool Stuff rename
+ Links + dead-code sweep + SEO basics → test fixes → Cool Stuff
v2 (shared SubTabIntro + accordion Links + 3 new dealers) → Phase D
Phillips archive scrape**. Thirteen PRs (#30 → #42), all merged.
Production live on bundle `main.0a6f14c3.js`. Dealer count: **39**
(up from 36).

**PM net deliverables**:
- **Phase A (PR #30 ✓ merged)**: First pass at unifying dealer
  listings + auction lots into the main feed. Tri-state pill +
  weighted-blend sort + Lots/Calendar toggle. **Superseded same
  session by PR #33** below.
- **Phase B1 (PR #31 ✓ merged)**: New `auction_lots_scraper.py`
  walks every active sale in `auctions.json` and pulls per-lot
  detail for Antiquorum (catalog → per-lot fetch), Christie's
  (inline `chrComponents.lots` blob), Sotheby's (`__NEXT_DATA__`
  algoliaJson, paginated), Phillips (page enum → per-lot fetch,
  capped 60/sale). Output: `public/auction_lots.json`. Per Mark:
  filter pocket / clocks / dials only at scrape time; keep
  accessories. **Initial scrape: 296 lots; first cron refresh: 202.**
  Wired into daily auctions cron after merge.py.
- **Phase B2 (PR #32 ✓ merged)**: Hearts on auction-lot cards
  write to watchlist_items (no more `_isTrackedLot` guard).
  +Track URL validator narrowed to eBay-only. Per-user one-shot
  migration via `<LotMigrationBanner/>` copies non-eBay tracked
  URLs into watchlist_items + removes the tracked_lots row.
  Idempotent via localStorage flag. eBay tracking workflow stays.
- **Listings sub-tabs (PR #33 ✓ merged)**: Replaced Phase A's
  pill + blend with four explicit sub-tabs: **Live listings**
  (dealers, sort newest-first, freshness dividers), **Live
  auctions** (lots, sort ending-soonest), **All sold** (mixed
  sold dealers + lots, sort most-recently-sold first, sold-date
  dividers), **Auction calendar**. Date pill semantics depend on
  sub-tab; Price pill uniform. Sub-tabs gate filter exposure.
  Removed: feedFilter / auctionsView state, blendBucket function,
  Ending sort pill.
- **Listings tweaks (PR #35 ✓ merged)**: Antiquorum live-lot title
  enrichment (model + ref pulled from description so cards aren't
  all "OMEGA"); search includes description (refs in body text are
  findable); sold-with-historic-price fallback (sold dealer items
  with priceOnRequest now show last non-zero `priceHistory` entry
  ~40% coverage win); top-of-feed count on desktop;
  `data/manual_lot_urls.json` short-term manual-tracking config +
  cron plumbing; `verify_auction_lots.py` health-check + cron step.
- **Watchlist sub-tabs (PR #36 ✓ merged)**: Five sub-tabs
  mirroring Listings: **Saved listings** (savedAt desc, saved-date
  dividers), **Saved auctions** (ending-soonest, +Track eBay button
  here, BIN eBay always lives here), **Saved sold** (sold-date
  desc, sold-date dividers), **Favorite searches**, **Lists**
  (with new help banner + folder icon disc). Watch Challenges
  moved from Watchlist sub-tab to a resource under **References
  tab**. Removed: Status segment everywhere, Auctions-only toggle,
  EndingSoon pinned strip + component file, watchLive/Sold derived
  memos, filterAuctionsOnly state.
- **Listings sub-tab restructure docs (PR #34 ✓ merged)** and
  **Watchlist restructure docs (PR #37 ✓ merged)** — CLAUDE.md +
  ROADMAP + SESSION_HANDOFF passes for #33 and #36 respectively.
- **Watchlist sub-tab UX tweaks (PR #38 ✓ merged)**: Five small
  fixes that surfaced together. Count badge on Watchlist read
  `allFiltered.length` (the dealer-feed count) regardless of
  sub-tab — App.js now exposes `displayedCount` (`watchItems.length`
  on Watchlist, `allFiltered.length` elsewhere); both shells
  consume it. Mobile sub-tab strip stopped being a horizontal
  scroller — trailing +buttons removed and moved into per-sub-tab
  intro banners (new `subTabIntroJSX` helper inside WatchlistTab).
  Saved auctions / Searches / Lists each now have title + blurb +
  inline +button. Lists rows: dropped the heavy `borderLeft: 3px
  solid #185FA5` (the icon disc already carries identity). Heart +
  ⋯ tap targets scale with card density (26px at cols ≥ 4, 36px
  at 1/2/3 cols).
- **Cool Stuff rename + Links page + dead-code sweep + SEO
  (PR #39 ✓ merged)**: Top-tab "Reference" relabelled "Cool
  Stuff" — label-only change, URL key (`?tab=references`) and
  component name (`ReferencesTab`) unchanged so old links still
  resolve. New **Links** resource under Cool Stuff: auto-derived
  Dealers list (one per source), hand-curated Reference clusters
  (Rolex GMT 1675, Tudor Sub 7021, Omega Seamaster 300, Rolex
  Explorer 1016, AP 5548 BA, Rolex DayDate 1803, Heuer), Art /
  Straps / Editorial outbound links. WatchlistTab signed-out copy
  now per sub-tab via `SIGNED_OUT_BY_SUBTAB` map (was a generic
  outer `!user` short-circuit that hid tailored copy in Searches +
  Lists). Dead-code sweep: −150ish lines — `sidebarFilterPanelJSX`,
  the entire sidebar drag-resize machinery (`SIDEBAR_*` constants,
  `[sidebarWidth]` + `[sidebarCollapsed]` state, `isDragging` /
  `dragStart` / `widthStart` refs, `onDragStart`, mousemove
  effect), `statusSegmentJSX = null` + `endingSoonJSX = null`
  pass-through wiring through both shells, `sidebarToggleJSX = null`,
  unused `auctions` prop on WatchlistTab, dead App.js imports
  (`CURRENCY_SYM`, `fmt`, `fmtUSD`, `imgSrc`, `logToPrice`,
  `extractRef`, `FilterIcon`, `SearchIcon`, `TabIcon`, `Chip`,
  `SidebarChip`, `AboutModal`). SEO basics: `<title>` upgraded
  from bare "Watchlist" to a descriptive form; `<meta
  name="description">` added.
- **Test fixes (PR #40 ✓ merged)**: PR #38 introduced
  `displayedCount` but didn't add it to `mockShellProps.js` →
  drawer's `Show {displayedCount} watches` rendered as "Show
  watches" + the `/Show 0 watches/` matcher failed. PR #39
  relabelled the third top-tab "Reference" → "Cool Stuff" but
  `DesktopShell.test.jsx` still asserted `getByText("Reference")`.
  Both fixed.
- **Cool Stuff v2 + 3 new dealers (PR #41 ✓ merged)**: Visual
  alignment — Cool Stuff landing now uses the same `SubTabIntro`
  banner + icon-disc/label/chevron row treatment as Watchlist >
  Lists and Watchlist > Saved searches. `subTabIntroJSX` lifted
  from WatchlistTab to a real `src/components/SubTabIntro.js`
  component (WatchlistTab + ReferencesTab both import it). Cool
  Stuff > Links sections converted to accordions, all collapsed
  by default, count badge + 90°-rotating chevron per header. New
  Editorial entry (monochrome-watches), additional Heuer /
  Fratello row, new top-level "Major Auctions" section seeded
  with the Phillips CH080317 archive URL (the actual lot scrape
  for that sale is real Phase D work — `auction_lots_scraper.py`
  only walks active sales from `auctions.json`; archive sales
  need a manual one-shot URL list path, parked for a separate
  PR). Three new dealer sources lift count **36 → 39**:
  - **Luna Royster** (NYC, WooCommerce, USD) — independent +
    neo-vintage heavy (F.P. Journe, MB&F). Skips placeholder
    $1/$0 prices LR uses for "price on request" pieces.
  - **S.Song Watches** (Shopify, USD, collection-scoped to
    `/collections/vintage` so straps don't leak).
  - **Swiss Hours** (Shopify, USD, collection-scoped to
    `/collections/watches`).
  All wired into `merge.py` SOURCES + `scrape-listings.yml` with
  `continue-on-error`.
- **Phase D — Phillips CH080317 archive scrape (PR #42 ✓ merged)**:
  First archive sale lands in Listings > All sold — 42 Heuer lots
  from "The Crosthwaite & Gavin Collection: Exceptional Heuer
  Chronographs From The Jack Heuer Era" (Phillips Geneva,
  2017-11-11), hammer range CHF 7,500–137,500. Generalised
  pipeline: `data/manual_archive_sales.json` is the registry,
  `manual_archive_scraper.py` reads it and writes
  `public/manual_archive_lots.json` (separate file from
  `auction_lots.json` so the daily comprehensive sweep doesn't
  clobber archive entries on every cron). App.js loads + merges
  into `auctionLotItems` alongside tracked + comprehensive lots.
  Two `scrape_phillips_lot` bugs fixed along the way that also
  benefit the daily sweep:
  - `sold_price` was the LOW estimate, not the hammer (the
    existing comment had flagged "provisional until validated
    against a sold lot"). Now extracts the real hammer from the
    rendered "Sold For" panel.
  - `is_excluded_title` was matching "o'clock" inside watch
    titles ("date aperture at 6 o'clock"), silently dropping 9
    of 42 lots. Strip "o'clock" / "o'clock" before running the
    exclusion regex.

Production: bundle `main.0a6f14c3.js`. Dealer count: **39** (up
from 36 mid-day; LR + S.Song + Swiss Hours added in PR #41).
Branch list: clean.

**AM bug-fix deliverables** (preserved below):

## What shipped (newest first)

- **Heuertime: include template-slug URLs** (PR #28). The dealer's
  homepage links to 24 watches; 4 of them have URL slugs of the form
  `kopie-van-template-for-watches-N` that look like scaffolding but
  hold real watches (CHARLES NICOLET TRAMELAN, JAEGER LeCOULTRE
  TRAVEL CLOCK, GIGANDET ROSE GOLD CHRONOGRAPH, JACQUES MONNAT
  CHRONOGRAPH). Removed the slug-pattern exclusion. Feed shows 23
  not 24 because merge.py's $500 floor still drops the €375 Heuer
  Trackstar — known behavior across every dealer.

- **ClassicHeuer: SOLD detector v3** (PR #27). First two attempts had
  two distinct bugs that compounded:
  - **Loose regex**: `class="...is-larger..."[^>]*>.*?>SOLD<` with
    `re.S` matched lazily across the empty `</div>` of a live item's
    badge container and hit the next SOLD badge later on the page.
    Marked 116/117 sold. Tightened to require the SOLD-bearing div
    nest immediately inside the `is-larger` container with only
    whitespace between layers.
  - **Locale mismatch**: the dealer serves DIFFERENT HTML on
    `/chronographs/<slug>` (German default, what the WC Store API
    returns as permalink) vs `/en/chronographs/<slug>` (English
    locale, what users browse). The German page sometimes flags
    SOLD before the English page. Added `english_url()` to rewrite
    every API permalink before fetching detail AND before writing
    the CSV — so the URL stored in `listings.json` matches what
    users see. Verified 8/8 against Mark's known-state pairs.

  Final state: 46 live / 71 sold. Mark's three originally-flagged
  items still SOLD. ClassicHeuer is effectively an archive site at
  60% sold — worth flagging when Stop-rule prune time comes.

- **ClassicHeuer: SOLD detection v1** (PR #26). First-pass per-item
  detail-page fetch with `is-larger` SOLD badge regex. Shipped before
  realizing both bugs above; PR #27 was the follow-up.

- **Watches of Lancashire image proxy** (PR #25). WoL's Cloudflare
  returns 403 to any GET whose Referer isn't `watchesoflancashire.com`
  (response carries `vary: referer`). Browsers always send the page
  origin as Referer for `<img>` loads from a different host →
  silent 403 on every WoL card. Added the dealer to `PROXIED_IMG_HOSTS`
  in `src/utils.js` AND `ALLOWED_HOSTS`/`REFERER_BY_HOST` in
  `api/img.js` — same pattern Watchfid already uses. Plain curl
  works because curl sends no Referer.

- **Heuertime image extraction v2** (PR #23). v1 (PR #22) used a
  `<source srcSet=...>` regex on each detail page to skip the B&W
  banner. Worked locally but Wix's edge serves a different SSR
  variant to GH Actions runners — gallery markup absent → the
  fallback picked the banner anyway. Pivoted to extracting tile
  thumbnails from the **homepage** gallery (which Wix renders
  consistently across edge variants). One homepage fetch builds a
  `{detail_url → image}` map; detail pages are still walked for
  title + price.

- **Heuertime image v1, half-fix** (PR #22). Detail-page
  `<source srcSet>` regex. Locally correct, prod-broken — rolled
  forward by #23. Documented in this handoff so the lesson sticks.

- **Ending Soon: hearts + Favorites-only scope** (PR #21). Two bugs:
  - Hearts on Ending Soon cards rendered un-filled even though items
    were saved. Tracked auction lots live in `tracked_lots` (keyed
    by URL), not `watchlist_items` (keyed by listing_id), so the
    `wished={!!watchlist[item.id]}` lookup always returned false.
    Worse, clicking the heart called `toggleWatchlist` with the
    tracked-lot's synthetic `shortHash(url)` id — writing a phantom
    `watchlist_items` row that the watchItems memo then projected
    alongside the original tracked-lot, surfacing as a duplicate
    card. Fixed by `wished={true}` in EndingSoon (mirroring the
    Favorites tab pattern) AND a `_isTrackedLot` guard in `handleWish`
    so the click is a no-op everywhere — also resolves the same
    latent bug in Favorites that nobody had reported.
  - Section was rendering across every Watchlist sub-tab; tightened
    to Favorites only.

- **Collections → Lists rename** (PR #24). UI copy only. DB tables
  (`collections`, `collection_items`), hooks (`useCollections`),
  URL params (`?sub=collections`, `?col=<uuid>`), localStorage key
  values, sub-tab keys, mutator names — all unchanged. Existing
  user lists load from the same table; no migration. The Watch
  Challenges sign-in prompt body was the only user-visible
  "collection" inside ChallengeFlow that needed swapping.

- **Main-branch protection ruleset.** GitHub repo settings →
  ruleset id 15930708, name "main protection", three rules:
  `non_fast_forward`, `deletion`, `required_linear_history`. Mark
  has admin bypass = always. Skipped `required_status_checks`
  because it would block the cron's direct-push to main (cron
  commits don't run jest/pytest). Skipped `pull_request` for the
  same reason.

## Open PRs

**None.** Everything from today is merged. Stale branches deleted
post-merge by GitHub auto-cleanup.

## Setup steps from Mark — all done ✓

- ✓ `gh auth login` set up earlier in the day; PR creation +
  squash-merge + branch deletion all flow via `gh` from this shell.
- ✓ Main-branch ruleset live.
- ✓ Vercel + cron + scrape-single workflow all working.

## Open user-reported issues — all resolved this session

- ✓ Watches of Lancashire no images → proxied via /api/img.
- ✓ ClassicHeuer items SOLD on dealer page were showing live →
  detector + locale fix.
- ✓ Heuertime banner-image-instead-of-color → homepage tile.
- ✓ Heuertime 19 vs 24 listings → template-slug inclusion.
- ✓ Ending Soon hearts un-filled + duplicate cards → wished=true +
  handleWish guard.

## Architecture notes added this session

- **Per-locale dealer HTML.** ClassicHeuer serves different HTML on
  `/chronographs/<slug>` (German default, what the WC API returns)
  vs `/en/chronographs/<slug>` (English locale, what users browse).
  The German page sometimes flags SOLD ahead of the English page,
  producing a phantom-sold cohort. **Lesson for any future
  multi-locale dealer scraper: fetch from the locale users actually
  browse, not whatever the API hands back.** Graduated to CLAUDE.md.

- **Greedy regex with `re.S` can leak past closing tags.** First-pass
  ClassicHeuer SOLD detector used `class="...is-larger...">.*?>SOLD<`
  with DOTALL. The lazy `.*?` happily skipped past an empty
  `</div>` and matched the next SOLD badge later on the page — so
  empty containers (= live items) read as sold. Anchor on immediate-
  child structural markers, not just text. Graduated to CLAUDE.md.

- **Don't trust URL slug patterns alone for content classification.**
  Heuertime's `kopie-van-template-for-watches-N` slugs sound like
  scaffolding but host real watches. Better signal: detail-page
  title + price. Graduated to CLAUDE.md.

- **Image-proxy pattern: 3 dealers now.** When a dealer's
  cross-origin browser fetch returns 4xx (Cloudflare 403 with
  `vary: referer`, Apache 404 on Accept image/webp, etc.), add
  the host to BOTH `src/utils.js` `PROXIED_IMG_HOSTS` AND
  `api/img.js` `ALLOWED_HOSTS` + `REFERER_BY_HOST` in lockstep.
  The proxy fetches with the dealer's own domain in Referer and
  strips `Accept` to a minimum. Watchfid + Watches of Lancashire
  done; future hot-link-protected dealers piggyback on the same
  path.

- **Wix detail pages are not stable across edge variants.** Wix
  serves different markup to GH Actions runners than to local
  development machines (likely IP/region/Accept-header driven).
  Don't depend on detail-page DOM structure for critical extraction.
  Where possible, use the homepage rendering (which Wix serves
  consistently) and only fall back to detail pages for fields that
  aren't on the home grid (title, price text).

## Doc files updated this session

- **CLAUDE.md** — Updated SESSION_HANDOFF reference; added Scraper
  conventions sub-bullets for per-locale dealer HTML + greedy-regex
  trap; added "Don't toggleWatchlist on tracked-lot items" to
  Things to never do; added "Don't filter dealer URLs by slug
  pattern alone" to Things to never do.
- **ROADMAP.md** — Added "Listing event capture (clicks + saves)"
  under Epic 4 with periodic rollup-and-prune note. Update log
  entries for today's PRs.
- **README.md** — No changes (count still 36, no architectural
  shift).
- **archive/SESSION_HANDOFF_2026-05-03.md** — yesterday's handoff
  archived. This doc replaces it.

## Commits worth knowing for next-me

```
git log origin/main --oneline -15
```

Latest stretch (newest first):
```
[scraper-fix arc 2026-05-04]
heuertime: include template-for-watches slugs (#28)
classicheuer: tighten SOLD detector + use /en/ locale (#27)
classicheuer: detect SOLD via detail-page badge (#26)
WoL: route through /api/img proxy (#25)
heuertime: tile-image extraction (#23)
heuertime: srcSet image picker, half-broken (#22)
ending-soon: hearts + Favorites-only scope (#21)
collections → lists rename (#24)
session-handoff-update + dealer count entries (#20)
```

## Next session

Auction-inclusion work + Watchlist restructure + Cool Stuff +
dealer additions + Phase D first archive sale all **shipped**
across 13 PRs (#30 → #42). Per refreshed priority order:

1. **Listing event capture (Epic 4)** — top of queue. Click + save
   events feeding "what's hot" / "most saved" / per-listing CTR on
   the Source Quality dashboard. Anonymous-friendly UUID in
   localStorage; admin-only RLS for reads; periodic rollup + prune
   cron.
2. **Sotheby's lot images** — left null in v1. ~30-min addition:
   per-lot detail-page fetch to extract the brightspotcdn URL.
3. **Phase D — next archive sales.** Pipeline shipped via PR #42;
   the first sale (Phillips CH080317) is live in Listings > All
   sold. Two more parked URLs:
   - `https://www.phillips.com/auction/CH080218/browse` — should
     work as-is on the existing Phillips path; one append to
     `data/manual_archive_sales.json` + one `manual_archive_scraper.py`
     run + commit. Sub-30-minute job.
   - `https://catalog.antiquorum.swiss/en/auctions/geneva-mandarin-oriental-hotel-du-rhone-2007-04-15/lots/`
     — the Antiquorum side of the manual scraper isn't built yet.
     `enumerate_phillips_uncapped` works because Phillips renders
     `/detail/<slug>/<id>` tile paths server-side; Antiquorum's
     archive URL pattern + per-lot scraper coverage (`scrape_catalog_antiquorum_lot`
     was built for active catalogs; archives may differ) need a
     small extension. Half-session.
4. **merge.py last-known price retention** — frontend fallback in
   PR #35 surfaces last non-zero `priceHistory` entry for sold
   items with priceOnRequest. Durable backend version (preserve
   the last meaningful price in the output entry) needs
   `tests/test_merge_state.py` updates.
5. **Watch Challenges v1.5** — close the social loop:
   `?newchallenge=1` receive flow + public read of completed
   challenges (RLS surgery). Lives under Cool Stuff > Watch
   challenges now.
6. **References as first-class entities (Epic 0).**
7. **Welcome page (Epic 0)** — `<title>` + `<meta description>`
   shipped in PR #39; the welcome/about page for first-time
   visitors is the remaining piece.
8. **Strength-of-save model (Epic 3).**
9. **Stop-rule prune** — at **39 dealers** now (post LR + S.Song +
   Swiss Hours in PR #41), audit + prune to 25. ClassicHeuer is at
   60%-sold-as-archive — strong prune candidate.

Plus the maintenance-rhythm beat: every 4th-5th session is hygiene
only.

## Open questions left from this session

- **Tests workflow glitch** (early in the day) — fired late on
  PRs #31 + #32 (merged with only Vercel green at squash time).
  Self-resolved by PR #33 onward; Tests fire normally now. Watch
  for recurrence next session.
- **Test fixture drift.** PR #40 caught that #38 added
  `displayedCount` to shellProps without mirroring it in
  `mockShellProps.js`, and #39 relabelled the top-tab without
  updating `DesktopShell.test.jsx`. CLAUDE.md is explicit about
  the fixture mirror rule but Tests fired AFTER the merge in both
  cases; the gate is post-hoc rather than pre-merge for shell-prop
  changes. Worth a process check next session — maybe a pre-commit
  hook that runs `react-scripts test --watchAll=false` if any
  `src/components/*Shell*` file changed.
- **Phase D first sale shipped (PR #42).** 42 Heuer lots from
  CH080317 live in Listings > All sold. The other two parked
  archive URLs (Phillips CH080218 + Antiquorum 2007 Geneva) are
  next-session work — see priority #3 above.
- **Sotheby's lot images null in v1.** brightspot CDN URL needs a
  per-lot fetch.
- **Antiquorum catalog pagination broken at the source** —
  `?page=N` 301s back to /lots, so we get the first 20 lots per
  sale. Lots fill over time as the catalog publishes batches.
- **Phillips Saved auctions cap** — `auction_lots_scraper.py`
  caps Phillips at 60 lots/sale for CI time. Mark may want this
  tunable or the cap raised once we have a sense of total minutes
  per cron run.
