# Watchlist — Session Handoff (2026-05-04)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — the durable rules graduate to CLAUDE.md, the durable plans
graduate to ROADMAP.md.

## TL;DR

Two-half day. AM: bug-fix session (8 PRs). PM: **Listings unified
feed → comprehensive auction-lot scrape → heart-on-lot → Listings
sub-tab restructure**. Four PRs (#30 / #31 / #32 / #33), all
merged. Production live on bundle `main.101d166a.js`.

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
  Status segment dropped from Listings (kept on Watchlist).
  Removed: feedFilter / auctionsView state, blendBucket function,
  Ending sort pill.

Production: bundle `main.101d166a.js`. Dealer count: **36**.
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

Auction-inclusion work is **shipped** (PRs #30 merged + #31/#32 in
flight). Per refreshed priority order:

1. **Listing event capture (Epic 4)** — top of queue. Click + save
   events feeding "what's hot" / "most saved" / per-listing CTR on
   the Source Quality dashboard. Anonymous-friendly UUID in
   localStorage; admin-only RLS for reads; periodic rollup + prune
   cron.
2. **Sotheby's lot images** — Phase B1 v1 left these null. Easy
   30-min addition: per-lot detail-page fetch to extract the
   brightspotcdn URL.
3. **Manual historical auction entry (original Phase D, deferred
   from this session)** — Mark's three target URLs:
   `https://www.phillips.com/auctions/auction/CH080317`,
   `https://www.phillips.com/auction/CH080218/browse`,
   `https://catalog.antiquorum.swiss/en/auctions/geneva-mandarin-oriental-hotel-du-rhone-2007-04-15/lots/`.
   Phillips + Antiquorum scrapers may need archive-URL extensions.
   Admin-only form gated by `REACT_APP_ADMIN_EMAILS`.
4. **Watch Challenges v1.5** — close the social loop: implement the
   `?newchallenge=1` receive flow (auto-prompt a draft response)
   and decide on public read of completed challenges (RLS surgery).
5. **References as first-class entities (Epic 0).**
6. **Site discoverability + welcome page (Epic 0).** Half-session.
7. **Strength-of-save model (Epic 3).**
8. **Stop-rule prune** — at 36 dealers, audit + prune to 25.
   Source Quality dashboard already exists. ClassicHeuer is at
   60%-sold-as-archive — strong prune candidate.

Plus the maintenance-rhythm beat: every 4th-5th session is hygiene
only.

## Open questions left from this session

- **Tests workflow glitch** — fired late on this session's PRs
  (#31 + #32 merged with only Vercel green at squash time; Tests
  fired on the push-to-main and PR #33's pre-merge run worked
  normally). Watch for recurrence next session.
- **Phase D not started.** Manual historical entry deferred per
  scope/time. Captured in priority order above. Mark's three
  target URLs preserved.
- **Sotheby's lot images null in v1.** brightspot CDN URL needs a
  per-lot fetch to extract the hash. ~30-min addition.
- **Antiquorum catalog pagination broken at the source** — `?page=N`
  301s back to /lots, so we get the first 20 lots per sale. Lots
  fill in over time as the catalog publishes more batches.
