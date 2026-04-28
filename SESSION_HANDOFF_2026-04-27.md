# Watchlist — Session Handoff (2026-04-27)

Self-contained handoff for a fresh Claude Code session. Read this top-to-bottom and you should be able to pick up without further questions.

## Project at a glance

- **Name:** Watchlist (folder/repo formerly named `Dial`).
- **Repo:** `https://github.com/markatmutter-cloud/watchlist.git`
- **Local path:** `~/Documents/watchlist`
- **Live:** [the-watch-list.app](https://the-watch-list.app) (custom domain via Vercel; old `dial-watchlist.vercel.app` sunset).
- **What it is:** personal vintage-watch listing aggregator. **23 dealers + 4 auction houses** scraped 3x/day (PT-aligned: 6am, noon, 6pm), merged into static JSON committed to the repo, deployed via Vercel. Per-user data (watchlist, hidden, saved searches, tracked auction lots) lives in Supabase with RLS.
- **Builder:** Mark — based in California (PT). Non-technical; Claude is co-author. Tone: terse, action-oriented; flag risks but don't overexplain.

## Stack

- **Scrapers:** Python 3.11, `requests` only. Browse AI for the one JS-rendered hold-out (Tropical Watch).
- **Pipeline:** GitHub Actions, three workflows — `scrape-listings.yml` (3x daily PT), `scrape-auctions.yml` (1x daily, also runs the watchlist Vercel-Blob image cache step), `scrape-tropicalwatch.yml` (manual trigger only because Browse AI quotas).
- **Frontend:** React (CRA). After the 3-phase split: `App.js` is ~1,700 lines (down from 2,735) and the rest lives in `src/components/` and `src/utils.js` / `src/hooks.js`. Inline styles, no UI library.
- **Backend:** Supabase (Postgres + Auth, Google OAuth, RLS-protected per-user tables). Free tier.
- **Hosting:** Vercel free tier, auto-deploy from `main`. One serverless function: `api/img.js` (image proxy for hot-link-protected dealers; sends Referer per host).
- **Image persistence:** Vercel Blob, scoped to favorited items only. See `cache_watchlist_images.mjs`.

## File map (post-split)

```
src/
├─ App.js                     ~1,700 lines — root state, tab routing, auth UI, sidebar, filter bar, listings grid
├─ utils.js                   pure helpers: fmt, fmtUSD, daysAgo (local-tz), freshDate, imgSrc, logToPrice, extractRef
├─ hooks.js                   useWidth, useSystemDark
├─ supabase.js                auth + per-user data hooks
├─ index.js                   bootstrap + service-worker registration
└─ components/
   ├─ Card.js                 listing card (with imgFailed state, NEW/SOLD/HIDDEN badges, price-drop indicator)
   ├─ Chip.js                 Chip + SidebarChip pill components
   ├─ icons.js                HeartIcon, FilterIcon, SearchIcon, TabIcon
   ├─ AuctionsTab.js          full auction calendar tab; computes auctionGroups internally
   ├─ AboutModal.js           "About Watchlist" modal
   ├─ HiddenModal.js          hidden-items modal grid
   └─ WatchlistTab.js         the entire Watchlist tab — Listings/Lots/Searches sub-tabs (~750 lines)
api/img.js                    Vercel serverless image proxy (Watchfid-allowlisted)
```

## Data model — what lives where

- **`public/listings.json`** (~2 MB) — Available/Watchlist/Archive feed.
- **`public/auctions.json`** — Auctions tab.
- **`public/tracked_lots.json`** — user-tracked auction lots.
- **`public/state.json` (~1.1 MB) and `public/auctions_state.json`** — cross-run memory: stable `sha1(normalized_url)[:12]` IDs, `firstSeen`, `lastSeen`, `priceHistory`, `active/sold` flags. The pipeline is self-healing because of this. Dates are PT-anchored.
- **Supabase tables (RLS, per-user):** `watchlist_items` (with `cached_img_url`), `hidden_listings`, `saved_searches`, `tracked_lots`.

## Sources (23 dealers + 4 auction houses)

**Dealers:** Wind Vintage, Tropical Watch (Browse AI), Menta, Collectors Corner NY, Falco, Grey & Patina, Oliver & Clarke, Craft & Tailored, Watch Brothers London, MVV Watches, Analog Shift, Watches of Knightsbridge, Belmont, Bob's Watches (vintage Omega only), DB1983, Hairspring (brand from JSON-LD detail-page scrape), Somlo, Bulang & Sons (EUR Shopify), Watchfid (EUR, WP REST API; images proxied via `/api/img`), Moonphase (EUR, Paris-based, sourced via pushers.io JSON API), **Huntington Company** (Shopify, `/collections/watchshop`), **The Vintage Watch** (Shopify, `/collections/available-watches`), **Avocado Vintage** (Squarespace).

**Auctions:** Antiquorum, Monaco Legend, Phillips, Bonhams. Plus a manual-entry CSV (`data/manual_auctions.csv`) and a tracked-lots scraper (`auctionlots_scraper.py`) that reads the union of users' tracked lot URLs from Supabase (Christie's URL support added).

## What just shipped (most recent first)

**This session (2026-04-27):**

- **Three more dealer sources** (now 23 total): Huntington Company (Shopify, scoped to `/collections/watchshop`), The Vintage Watch (Shopify, scoped to `/collections/available-watches`), Avocado Vintage Watches (Squarespace `?format=json`). All three brought in cleanly with the existing scraper templates.
- **Mobile blank-screen fix** — `statusSegmentJSX` was being referenced in the mobile render path before its `const` declaration (~200 lines later in App.js). JS const isn't hoisted → ReferenceError → white screen. Desktop's render is below the declaration so it worked. Moved the declaration above the `watchlistTabJSX` const so both renders are below it.
- **App.js syntax-error fix** — earlier in the session, an orphan `};` left over from runImport extraction was breaking every Vercel build for several commits. Spotted only because Mark reported the master tri-state pill / sticky-tab fix / Hairspring brand / Moonphase weren't visible. Lesson: check Vercel deploy status after every push, especially after a destructive cleanup pass.
- **Moonphase added** (was 20th dealer source) via the pushers.io JSON API. pushers.io is a multi-dealer marketplace with a clean `/api/dealers/{handle}.json` endpoint that exposes brand, price, state, and images as structured fields — no HTML scraping. Same pattern works for any other dealer hosted on pushers.io.
- **Master Live/Sold/All pill.** `showSoldHistory` boolean → `statusMode` string. One global tri-state segment drives Available + Watchlist Listings + Watchlist Lots. WatchlistTab no longer has its own per-tab segment. Lots in `'all'` mode shows upcoming + past combined.
- **Watchlist sticky sub-tab gap fix.** Removed paddingTop from the pinned bar, tightened marginBottom, added a hairline borderBottom so it reads as integrated chrome.
- **Hairspring brand fix.** Their titles lead with model names ("Tank Cintrée", "Royal Oak", "Lange 1") not manufacturer names, so detect_brand returned "Other" for ~90% of inventory. Scraper now visits each detail page (~6s extra per scrape) and pulls brand from JSON-LD; merge.py now respects the scraper's brand column when set.
- **Reference filter dropped** from both the desktop top filter row and the desktop sidebar (auto-extracted ref numbers were noisy).
- **App.js split (3 phases).** 2,735 → ~1,700 lines:
  - Phase 1: extract pure helpers (utils.js), hooks (hooks.js), icons, Card, Chip
  - Phase 2: extract AuctionsTab, AboutModal, HiddenModal
  - Phase 3: extract WatchlistTab (the big one, ~750 lines, 36-prop interface)
- **PT-anchored dates.** `merge.py` TODAY uses `America/Los_Angeles` via zoneinfo. `App.js` `daysAgo()` parses YYYY-MM-DD as local-tz midnight. Closes the cron-timezone + inflated-NEW-counts open issues together.
- **Bug sweep:**
  - Midday cron slot added (3x/day total: 6am, noon, 6pm PT)
  - Grey & Patina 401 fix: scraper now uses requests.Session() with warm-up GET so Cloudflare's `__cf_bm` cookie persists across paginated requests
  - Heart-click while signed-out: intent saved to sessionStorage before OAuth redirect; replayed once user returns and items load
- **Watchlist tri-state Live/Sold/All + Group by** (Brand/Source/Reference) — earlier in this session, before being promoted to the global pill.

**Earlier (carried over):**

- Custom domain `the-watch-list.app`; rename Dial → Watchlist throughout
- Watchfid `.jpg` images: `api/img.js` now sends Referer for hot-link-protected hosts (fixed 40 of 66 broken images)
- Auction lot card label: BID/START → CURRENT (since pre-bid the starting price IS the current price)
- Watchlist image cache to Vercel Blob (`cache_watchlist_images.mjs`)
- Service worker for reliable bundle updates / iOS PWA staleness
- Cumulative price drops, hourglass placeholder, bulk-select on Watchlist
- Manual auction entry CSV; Christie's URL support for tracked lots
- Workflow split into three; Watchfid switched to WP REST API
- Editable saved searches
- Wind Vintage bracelet filter removed (CSV jumped from 137 → 265)

## Known issues / loose ends

- **Cloudflare-protected dealers** — none currently blocked from GitHub Actions, but if a future target is, the Mac-mini-at-home option is parked (see `dial_pending_sources.md`).
- **Verification script** — would fetch each dealer's homepage, compare URL count to `state.json`, alert on silent drop-outs. Not built yet.
- **Tests for `merge.py` state transitions** — only layer of the codebase where unit tests would meaningfully prevent regressions. Not built yet.

That's it. The big bug list from the previous handoff is resolved.

## Roadmap (Mark's stated priorities)

**Next big features:**

1. **eBay API integration scoped to saved searches.** Highest-impact single feature. eBay has a stable Browse API (free tier, OAuth). Recommended scope: extend saved searches with an "include eBay matches" toggle rather than dumping all of eBay into the main feed.
2. **Alerts** — email/push when a saved search matches a new listing. Mark's flagged this as the feature that turns it from "browse tool" into "daily-open tool". Best built after eBay so it covers both dealer + eBay matches.
3. **Sotheby's / Christie's / Heritage auction houses.** Christie's lot-URL support already exists for tracked lots. Sotheby's is the unknown (likely Cloudflare). Manual entry CSV exists as a safety net.

**More dealer sources to evaluate** (Mark's list, 2026-04-27):

| Dealer | URL | Notes |
|---|---|---|
| Moonphase | https://pushers.io/dealers/@moonphase.fr | ✅ Live — pushers.io API pattern |
| Huntington Company | https://huntingtoncompany.com/collections/watchshop | ✅ Live — Shopify `/collections/watchshop/products.json` |
| The Vintage Watch | https://thevintage.watch/collections/available-watches | ✅ Live — Shopify `/collections/available-watches/products.json` |
| Avocado Vintage | https://www.avocadovintagewatches.com/watches | ✅ Live — Squarespace `?format=json` |
| Vintage Watch Collective | https://www.vintagewatchcollective.com/shop | ❌ probed: not standard Shopify (400 on `/products.json`) — needs HTML scrape or different platform |
| Wrist Icons | https://www.wristicons.com/all-watches/ | ⚠️ probed: WordPress, `/wp-json/wc/store/v1/products` returned 301 — follow redirect to confirm WooCommerce |
| Vision Vintage Watches | https://www.visionvintagewatches.com/vintage-watches | ❌ probed: Wix (not Squarespace despite the URL trick). Needs custom HTML parsing |
| Chronoholic | https://www.chronoholic.com/omega-2 | ❌ probed: neither Shopify nor WooCommerce Store API; unknown platform |
| Shuck the Oyster | https://www.shucktheoyster.com/portfolio-category/vintage-watches/ | ⏭️ WordPress; prices behind click-through. Previously parked. |

**Pattern:** anything Shopify can use the existing `/products.json` template (low effort, ~30 lines per source). pushers.io-hosted dealers can use the moonphase pattern (also ~30 lines). WordPress/custom sites need bespoke parsing.

**Wanted later:**

- Lot-level auction tracking (currently only sale dates surfaced)
- Market stats / price-history per reference once enough sold-archive data accumulates
- Editorial content / reference-resource links
- Watch box (low priority): record watches owned + sold over time. Personal collection history. Parallels existing watchlist_items snapshot pattern.

**Code quality:**

- Verification script (see "Known issues")
- Tests for `merge.py` (see "Known issues")
- **Refactor scrapers** — currently each scraper duplicates `BRANDS`, headers, request boilerplate, and CSV writing (~50 lines copy-paste each). Worth extracting a shared `scrapers/_common.py` only when (a) we add 5+ more sources, or (b) a bug class needs fixing across many scrapers at once. Not now.
- Mac mini at home — fallback if a future source is hard-Cloudflared and has no JSON endpoint. ~$600 one-time + $5/mo electricity. Decision deferred.

## Working with Mark — quick notes

- He doesn't read diffs in detail. Tell him in plain English what changed and what's next.
- Default to terse responses. No unprompted summaries of work just done.
- Confirm a deploy actually shipped before reporting "done" — Vercel rebuild ~60s after push.
- Watch for dealer-site changes; that's the main source of breakage. Unit tests don't help there.
- He uses an iPhone PWA install at `the-watch-list.app`, so iOS-specific quirks (safe areas, icon caching) matter.
- Repo is **public** → unlimited GitHub Actions minutes. Vercel Hobby easily handles 4-6 deploys/day. Browse AI (Tropical Watch) is the only paid component with a quota — don't bump TW cadence without checking it.

## Memory pointers

Persistent memory at `~/.claude/projects/-Users-markmutter-Documents-Dial/memory/`. Key files:
- `user_profile.md` — Mark, California (PT), non-technical, repo cloned at `~/Documents/watchlist`
- `dial_project.md` — overview
- `dial_pipeline.md` — pipeline shape
- `dial_sources.md` — *stale; current count is 20*
- `dial_open_issues.md` — current open items (refresh to match this handoff)
- `dial_pending_sources.md` — Sotheby's + Mac-mini-at-home discussion
- `dial_parked_features.md` — Watch box, alerts, etc.
- `dial_image_caching.md` — watchlist-only-by-design rationale
- `browse_ai.md` — Browse AI config

Memory was last consolidated several days ago; treat older entries as point-in-time observations and verify against current code before acting on them.
