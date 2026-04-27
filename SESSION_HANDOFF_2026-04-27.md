# Watchlist — Session Handoff (2026-04-27)

Self-contained handoff for a fresh Claude Code session. Read this top-to-bottom and you should be able to pick up without further questions.

## Project at a glance

- **Name:** Watchlist (folder/repo formerly named `Dial`; rename completed in code 2026-04-27).
- **Repo:** `https://github.com/markatmutter-cloud/watchlist.git`
- **Local path:** `~/Documents/watchlist` (the old `~/Documents/Dial` folder is empty apart from `.DS_Store` and `.claude/`).
- **Live:** [the-watch-list.app](https://the-watch-list.app) (custom domain bought via Vercel 2026-04-27; the old `dial-watchlist.vercel.app` was removed since there were no other users).
- **What it is:** personal vintage-watch listing aggregator. 19 dealers + 4 auction houses scraped daily, merged into static JSON committed to the repo, deployed via Vercel. Per-user data (watchlist, hidden, saved searches, tracked auction lots) lives in Supabase with RLS.
- **Builder:** Mark — non-technical; Claude is co-author. Tone: terse, action-oriented; flag risks but don't overexplain.

## Stack

- **Scrapers:** Python 3.11, `requests` only. Browse AI for the one JS-rendered hold-out (Tropical Watch).
- **Pipeline:** GitHub Actions, three workflows — `scrape-listings.yml`, `scrape-auctions.yml` (also includes the watchlist Vercel-Blob image cache step), `scrape-tropicalwatch.yml` (separate cadence).
- **Frontend:** React (CRA), single big `App.js` (~2,735 lines, due for component-splitting), inline styles, no UI library.
- **Backend:** Supabase (Postgres + Auth, Google OAuth, RLS-protected per-user tables). Free tier.
- **Hosting:** Vercel free tier, auto-deploy from `main`. One serverless function: `api/img.js` (image proxy for hot-link-protected dealers).
- **Image persistence:** Vercel Blob, scoped to favorited items only. See `cache_watchlist_images.mjs`.

## Data model — what lives where

- **`public/listings.json`** (~2 MB) — what the Available/Watchlist/Archive tabs read.
- **`public/auctions.json`** — Auctions tab.
- **`public/tracked_lots.json`** — user-tracked auction lots.
- **`public/state.json` (~1.1 MB) and `public/auctions_state.json`** — cross-run memory: stable `sha1(normalized_url)[:12]` IDs, `firstSeen`, `lastSeen`, `priceHistory`, `active/sold` flags. The pipeline is self-healing because of this.
- **Supabase tables (RLS, per-user):** `watchlist_items` (with `cached_img_url`), `hidden_listings`, `saved_searches`, plus a tracked-lots table.

## Sources (current count is 19 dealers + 4 auction houses)

Dealers: Wind Vintage, Tropical Watch (Browse AI), Menta, Collectors Corner NY, Falco, Grey & Patina, Oliver & Clarke, Craft & Tailored, Watch Brothers London, MVV Watches, Analog Shift, Watches of Knightsbridge, Belmont, Bob's Watches (vintage Omega only), DB1983, Hairspring, Somlo, Bulang & Sons (EUR, Shopify), Watchfid (EUR, WP REST API; images proxied via `/api/img`).

Auctions: Antiquorum, Monaco Legend, Phillips, Bonhams. Plus a manual-entry CSV (`data/manual_auctions.csv`) and a tracked-lots scraper (`auctionlots_scraper.py`) that reads the union of users' tracked lot URLs from Supabase.

## What just shipped (in roughly reverse chronological order)

- **Watchlist image cache to Vercel Blob** (commit `ae3ef0f`): `cache_watchlist_images.mjs` (164 lines) caches favorited-listing images to Blob and reaps orphans when items are unfavorited. Wired into `scrape-auctions.yml` only (once per day). **Design intent (confirmed with Mark):** scoped to watchlist only — auction images stay up long-term, dealer images vanish, caching the full feed isn't worth the storage cost. Don't propose extending to listings/auctions.
- **Hourglass placeholder + bulk-select on Watchlist** (`86e8314`).
- **Card placeholder when image URL 404s** (`8e5827d`).
- **Cumulative price drops — track from peak, bubble re-cut items to top** (`bc2670d`).
- **Service worker** (`3c09e1f`): one-shot reload on `controllerchange` so iOS PWA users don't get stuck on stale JS.
- **Force revalidation** on listings.json / auctions.json / tracked_lots.json (`a786fab`).
- **Workflow split** from one `scrape.yml` into three (`9f7979b`).
- **Heart on desktop search; auction-house filter on tracked lots** (`671b456`).
- **Watchfid switched to WP REST API**, all 64 listings (`cdbfddb`).
- **Save current search as a favorite from the search bar** (`224cb71`) — closes the "editable saved searches" pending task from the previous handoff.
- **Image proxy for hot-link-protected dealers (Watchfid)** (`8a5a0c1`) — `api/img.js`.
- **Auctions: manual entry source for hand-curated dates** (`af01606`).
- **Auction lots: Christie's URL support** (`9482076`).
- **PWA padding + watchlist count removed** (`97c9527`): bottom bar uses `safe-area-inset-bottom + 14px`; Watchlist tab no longer shows the count.
- **Wind Vintage bracelet/accessory filter removed** (`55f791c`): WV scraper had a title-based exclusion that was dropping legit listings. Audit confirmed it was the only scraper with title-based filtering.
- **Sort preference removed for WV/TW** (`58fc78b`): newest-first now sorts purely by `firstSeen`.

## Known issues / loose ends

- **App.js bloat.** ~2,735 lines. Two focus-loss bugs already caused by sub-components defined inside the root `Watchlist` component. Roadmap-flagged.
- **Grey & Patina 401** from WooCommerce Store API — likely auth/cookie change on their side.
- **Cron timezone.** Daily run is UTC; "new" badges flip at the wrong local time for Mark.
- **Inflated NEW counts.** `firstSeen` window catching items that have actually been on dealer sites for ages — needs a tweaked rule.
- **Heart-click while signed-out is lossy.** Sign-in flow doesn't preserve the click target.
- **Wind Vintage 264→137 drop.** Bracelet filter explained part of it (now removed); worth re-checking after next scrape for any other silent loss.

## Roadmap (Mark's priorities, last discussed)

Sources blocked / parked:
- Cloudflare-protected dealers — needs either a home Mac mini running headed Playwright or a paid solver.
- Christie's / Sotheby's / Loupe This auction houses.

Wanted features (rough priority order):
1. **Alerts** — email/push when a saved search matches a new listing. Flagged as highest-leverage.
2. Lot-level auction tracking (currently only sale dates).
3. Market stats / price history per reference once enough sold-archive data accumulates.
4. Editorial content / reference resources.
5. ~~Custom domain~~ — DONE 2026-04-27 (`the-watch-list.app`).
6. **Watch box** (added 2026-04-27, low priority) — record watches owned (bought from listings or elsewhere) and watches sold over time. Personal collection history; separate from Watchlist (wishlist) and Auction lots (upcoming). Likely a new Supabase table + new top-level tab; parallels the existing watchlist_items snapshot pattern.

Code quality:
- **Split `App.js` into proper components.** Pays for everything else after it.
- Verification script — fetch each dealer homepage, compare URL count to `state.json`, alert on silent drop-outs.
- Tests for `merge.py` state transitions.

Quick wins (under an hour each):
- Cron timezone fix.
- "Inflated NEW counts" rule tweak.
- Mobile browser-tab favicon sanity-check.

## Working with Mark — quick notes

- He doesn't read diffs in detail. Tell him in plain English what changed and what's next.
- Default to terse responses. No unprompted summaries of work just done.
- Confirm a deploy actually shipped before reporting "done" — Vercel rebuild ~60s after push.
- Watch for dealer-site changes; that's the main source of breakage. Unit tests don't help there.
- He uses an iPhone PWA install of the site, so iOS-specific quirks (safe areas, icon caching) matter.

## Memory pointers

Persistent memory at `~/.claude/projects/-Users-markmutter-Documents-Dial/memory/`. Key files:
- `dial_project.md` — overview
- `dial_pipeline.md` — pipeline shape
- `dial_sources.md` — **6 sources listed, stale; current count is 19**
- `dial_open_issues.md`, `dial_pending_sources.md`, `dial_parked_features.md` — roadmap-adjacent
- `dial_image_caching.md` — watchlist-only-by-design rationale (added 2026-04-27)
- `browse_ai.md` — Browse AI config

Memory was last consolidated ~6 days ago; treat older entries as point-in-time observations and verify against current code before acting on them.
