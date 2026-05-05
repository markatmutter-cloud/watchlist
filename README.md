# Watchlist

A personal vintage watch listing aggregator. Watchlist pulls active inventory from a handful of independent dealers I trust, merges it into one browsable feed, and tracks listings across runs so new arrivals, price changes, and disappearances are easily visible. It also tracks upcoming auctions from the houses worth following.

**Live:** [the-watch-list.app](https://the-watch-list.app)

Built without a development background — architecture, scrapers, React front-end, Supabase auth/data, and CI/CD all co-authored with [Claude](https://claude.com/claude-code).

> For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and what's explicitly out of scope, see [ROADMAP.md](ROADMAP.md).

---

## Why this exists

I wanted a single place to see vintage watches from the specific dealers I follow, in one chronological feed, without the ads or the dealer-specific UIs. Chrono24 covers the universe but its interface buries things; dealer sites are all different. Auctions add another moving target — Phillips, Bonhams, Antiquorum, Monaco Legend each publish their schedules differently, and tracking what's coming up across all of them shouldn't take five tabs.

Not commercial. Not trying to be a marketplace. Just an aggregator for myself — and now open to anyone who wants to see how a non-technical person can ship something useful with an LLM as a pair-programmer.

---

## What it does

Three top-level tabs:

- **Listings** — aggregates 38 curated dealer sources + targeted eBay searches into one feed (see table below). Live/Sold/All status pill defaults to live.
- **Watchlist** — five sub-tabs:
  - **Favorites** — items you've hearted (your default list), with price-at-save preserved.
  - **Lists** — group watches by reference, theme, or research thread ("Rolex 5513s", "Vintage divers"). Auto-populates a "Shared with me" inbox when other users share listings with you. Anything you've hidden from the Available feed surfaces here too as a "Hidden" row — drill in, use the "..." menu's Unhide to put it back.
  - **Challenges** — build-a-collection v1. Pick N watches under a budget, write a one-line rationale per pick, share the spec so a friend can build their own answer. Multi-stage flow with a 20% over-budget soft-warn / hard-block guardrail. Drag-drop between shortlist and slots on desktop; tap-to-select on mobile.
  - **Searches** — saved queries you can re-run with one tap, plus a read-only view of the eBay source-searches feeding the main feed.
  - **Auction Calendar** — upcoming + recently-closed sales from 6 houses, grouped by month.
- **References** — collector resource tools (currently: a print-to-scale watch size comparison tool; encyclopedia and curated-link aggregator are roadmap'd).
- **Source quality** *(admin only — invisible to other users)* — dense per-source dashboard at `?tab=admin`: live count, new-per-week, hearts/hides, avg price, top brand, scraper health, and an "earning its keep" suggestion. Reachable via the user dropdown for users whose email is in `REACT_APP_ADMIN_EMAILS`.

Plus:

- Cross-device sync via Google sign-in (Supabase auth + tables, RLS-protected).
- Per-user **saved searches** — add/edit/delete your own queries, with live counts of matching listings.
- Per-user **tracked lots** — paste an auction-house lot URL to follow it through to hammer (Antiquorum, Christie's, Sotheby's, eBay).
- Per-user **lists** + **share** — organise hearted watches into named lists, share any listing with anyone via the native share sheet. Recipients see the listing in the same UI with a Save / Dismiss banner; signed-in saves auto-populate a "Shared with me" inbox. No in-app messaging — the user's chosen messaging tool handles replies.
- **Hide** any listing with the × button — it stays out of the live feed but its history is preserved. Hidden items show up in Watchlist > Lists > Hidden so you can unhide them later.
- Runs a Python scrape pipeline daily via GitHub Actions — no server to babysit.
- Tracks listings across runs with **stable URL-hash IDs**, so:
  - "NEW" badges only show for listings actually new in the last 24 hours.
  - Price drops get a green ↓ chip.
  - Watchlist stays glued to the right listing even as dealers add new inventory.
  - Listings that disappear from the scrape are flipped to inactive and surface in the sold/archive view.
- Client-side search (whitespace-tokenized — word order doesn't matter), filter (by source / brand / price / recency / Live-Sold-All / auctions-only), sort.
- Implicit weekday-based date dividers (Today / Yesterday / weekday / Last week / Older) when sorted by date.
- Dark/light mode following system preference, with manual override.
- GBP→USD conversion for UK dealers, shown alongside the native price.
- Mobile: configurable 1-3 col grid with a slide-up filter drawer, sticky search/sort row, and a 2-tab bottom-nav (Listings / Watchlist).
- Desktop: full-width top bar with three main tab pills, an inline pill-style filter row, and configurable 3-7 col grid (or auto fluid).

---

## Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                  GitHub Actions (cron, daily)               │
  │                                                             │
  │   38× listing scrapers + 6× auction scrapers (Python)       │
  │            │                              │                 │
  │            ▼                              ▼                 │
  │     *_listings.csv               *_auctions.csv             │
  │            │                              │                 │
  │            └──────────────┬───────────────┘                 │
  │                           ▼                                 │
  │                       merge.py                              │
  │                           │                                 │
  │      ┌───────────┬────────┼─────────┬──────────────┐        │
  │      ▼           ▼        ▼         ▼              ▼        │
  │  listings.json state.json auctions.json auctions_state.json │
  │      (the app reads these; state files = cross-run memory) │
  │                           │                                 │
  │   commit & push back to main                                │
  └───────────────────────────┼─────────────────────────────────┘
                              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                Vercel (auto-deploy on push)                 │
  │   React bundle + listings.json/auctions.json (static)       │
  └─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴────────────────┐
            ▼                                  ▼
     Browser fetches JSON                 Supabase (Postgres + Auth)
       — filter/sort/state                  — watchlist_items
       lives in React                       — hidden_listings
                                            — saved_searches
                                            — Google OAuth, RLS per-user
```

Listings/auctions are static JSON committed to the repo. The only thing behind a server is per-user data (watchlist, hidden listings, saved searches), which lives in Supabase with row-level security so each user can only read/write their own rows. Anonymous visitors can browse and search; signing in unlocks saving.

---

## Data sources

### Dealers (38)

All scrapers hit each dealer's existing public endpoint — no credential-protected APIs, no headless browsers where it can be avoided.

| Source | Platform | Method | Currency |
|---|---|---|---|
| Wind Vintage | Squarespace | `?format=json` + HTML price parse | USD |
| Tropical Watch | Custom (JS-rendered) | [Browse AI](https://browse.ai) | USD |
| Menta Watches | WooCommerce | Store API | USD |
| Collectors Corner NY | Shopify | `/products.json` | USD |
| Falco Watches | Shopify | `/products.json` | GBP |
| Grey & Patina | WooCommerce | Store API | USD |
| Oliver & Clarke | Shopify | `/products.json` | USD |
| Craft & Tailored | Shopify | `/products.json` | USD |
| Watch Brothers London | Squarespace | `?format=json` items[] | GBP |
| MVV Watches | Squarespace | `?format=json` items[] | USD |
| Analog Shift | Shopify | `/products.json` | USD |
| Watches of Knightsbridge | Custom | HTML parse | GBP |
| Belmont Watches | Shopify | `/products.json` | USD |
| Bob's Watches (vintage Omega) | Custom | JSON-LD + HTML | USD |
| DB1983 | Shopify | `/products.json` | GBP |
| Hairspring | Shopify | `/products.json` | USD |
| Somlo | Shopify | `/products.json` | GBP |
| Bulang & Sons | Shopify | collection-scoped `/products.json` | EUR |
| Watchfid | Custom (WordPress) | WP REST API; images proxied via `/api/img` | EUR |
| Moonphase | pushers.io | `/api/dealers/{handle}.json` (structured brand + price + state) | EUR |
| Huntington Company | Shopify | `/collections/watchshop/products.json` | USD |
| The Vintage Watch | Shopify | `/collections/available-watches/products.json` | USD |
| Chronoholic (Omega only) | Wix | `productsWithMetaData.list[]` JSON embedded in HTML | USD |
| Vintage Watch Fam | Shopify | collection-scoped `/products.json` | USD |
| Shuck the Oyster | Custom (WordPress) | `/portfolio/` listing pages + per-item detail-page price extraction (`PRICE NNNN€`) | EUR |
| Central Watch | Custom (PHP) | HTML parse of `prod_result_item` cards + `/R{offset}` pagination | USD |
| European Watch | Next.js (RSC) | Inline `__next_f.push` chunks, regex-extracted product objects; **pre-2000 filter** via `Circa. YYYY` in model | USD |
| Vintage Watch Collective | Wix | `productsWithMetaData.list[]` JSON embedded in HTML (same as Chronoholic) | EUR |
| Watchurbia | WooCommerce | Store API; filtered to `category=watches-in-stock` so the sold archive doesn't surface | EUR |
| Maunder Watches | WooCommerce | Store API; uses `offset` (not `page`) since their build ignores `page` | GBP |
| Watch Club | Custom (TaffyDB) | Single 5MB JS catalog at `/upload/js/watches2018_bis.js` wrapped as `TAFFY([…])`; status="1" filter for active items | GBP |
| Vintage Watch Shop | WordPress (custom CPT) | `/watches-accessories/` index walk + per-item detail page for "Our price: £NNNN" | GBP |
| Watches of Lancashire | WooCommerce | Store API; `category=watches`; images proxied via `/api/img` (Cloudflare hot-link protection) | GBP |
| Heuertime | Wix Pages (no Wix Stores) | Homepage links → per-page detail walk for "PRICE" rich-text label (mostly POR) | EUR |
| ClassicHeuer | WooCommerce | Store API; categories used as Heuer model families, mostly price-on-request | EUR |
| Luna Royster | WooCommerce | Store API; independent + neo-vintage heavy (F.P. Journe, MB&F); placeholder $1/$0 prices filtered out | USD |
| S.Song Watches | Shopify | `/collections/vintage/products.json` | USD |
| Swiss Hours | Shopify | `/collections/watches/products.json` | USD |

Tropical Watch is the only source still routed through Browse AI — their site actively blocks scrapers. Every other source is scraped with vanilla `requests`. Browse AI robot ID and API key live in GitHub Secrets, never in the repo.

### Auction houses (6)

| House | Method | Notes |
|---|---|---|
| Antiquorum | HTML calendar parse + HEAD-check on catalog URLs | Only links to a specific catalog when its URL returns 200 |
| Monaco Legend | HTML, anchored on `<p class="auction-date">` | Both featured + grid card layouts share that element |
| Phillips | HTML, walking backward from each `atc_date_start` block | Phillips puts the auction href above the date block |
| Bonhams | HTML, explicit `_pair(y1, mo1, d1, y2, mo2, d2)` date parser | Earlier helper had a buggy implicit-end-year bug |
| Christie's | Next.js `__NEXT_DATA__` Sitecore JSS payload from `/en/departments/watches-and-wristwatches` | Structured `Auctions[]` array with SaleNumber, dates, location, URL |
| Sotheby's | Calendar URL with watches filter (`f4=...`); flat-text parse of card descriptors | Cross-month date ranges supported (`29 April–13 May 2026`) |

### Tracked auction lots

Signed-in users can paste a lot URL into the Auctions tab's **+ Track lot** input to follow that specific lot through to hammer. Supported houses (auctionlots_scraper.py): **Antiquorum, Christie's, Sotheby's**. Each scraper pulls title, image, estimate, starting price, current bid, sold price, and auction end date. Phillips, Bonhams, Monaco Legend, and Heritage are parked — their lot pages are JS-rendered and/or behind bot mitigation that requires Browse AI / a self-hosted Playwright runner / manual entry to bypass.

---

## How state tracking works

The biggest design decision in the project is `public/state.json` (and its sibling `public/auctions_state.json`), committed to the repo alongside the user-facing JSON.

**The problem:** a naive scraper run every day produces a full list of current listings. If everything gets a "scraped today" stamp, you can't distinguish genuinely new arrivals from old inventory that just happened to be in today's scrape. And if a listing moves position in a source's catalog, its array index changes — which would break any reference the app holds.

**The fix:** every listing gets a stable 12-char ID — `sha1(normalized_url)[:12]`. URLs don't shift around the way array indices do, so the same listing keeps the same ID across runs.

`merge.py` then reads the previous state, compares this run's items to it, and maintains:

- `firstSeen` — the date we first observed this URL. The "NEW" chip reads from this, not from the scrape date.
- `lastSeen` — so disappearances can be detected.
- `priceHistory` — appended only when price changes, not on every run. Cheap to store, makes price-drop detection trivial.
- `active` / `sold` — flipped when a listing drops out of the scrape. The frontend's Archive tab reads from this; the saved fields (`lastTitle`, `lastImg`, `lastBrand`, `lastCurrency`) are cached at the moment of disappearance so cards still render in the archive even though the source no longer has them.

This means the pipeline is **self-healing**: if a single run misses listings (scrape limit set too low, dealer briefly slow), the next run picks them back up automatically and flips them active again. No manual reconciliation.

---

## Stack

- **Scrapers:** Python 3.11 with `requests`. No Playwright, no Selenium — Browse AI fills the gap for JS-rendered sources.
- **Pipeline:** GitHub Actions (ubuntu-latest). Each scraper step uses `continue-on-error: true` so one failing source doesn't kill the batch.
- **Frontend:** React (Create React App), inline styles only, no UI libraries. `App.js` is the orchestrator (~1,470 lines — owns state and JSX consts); render is delegated to `src/components/MobileShell.js` + `DesktopShell.js`, each receiving a single `shellProps` bag. Domain-state hooks live under `src/hooks/` (`useTrackModal`, `useFavSearchModal`, `useViewSettings`, `useFilters`, `useEBaySearches`); shared style tokens in `src/styles.js`. Pure helpers in `src/utils.js`.
- **Per-user image persistence:** Hearted listings get their dealer image cached to **Vercel Blob** by `cache_watchlist_images.mjs` (runs once a day inside the auctions workflow). The frontend prefers the cached URL, so favorited cards survive a dealer deleting the original. Listings/auction images aren't cached — auction houses keep theirs up long-term, and caching the full feed isn't worth the storage cost.
- **Auth + per-user data:** [Supabase](https://supabase.com) — Postgres with row-level security, Google OAuth provider. Free tier; no backend code of my own.
- **Hosting:** Vercel free tier, auto-deploy from `main`.
- **Static data:** JSON committed to the repo. At current scale (~1,800 listings, ~2 MB) keeping this in git is cheaper and simpler than running a database for it. Per-user data (which actually needs writes) lives in Supabase.

---

## Folder layout

```
watchlist/
├─ .github/workflows/
│   ├─ scrape-listings.yml         # 3×/day dealer listings pipeline
│   ├─ scrape-auctions.yml         # daily auctions + tracked-lots + watchlist-image cache
│   ├─ scrape-ebay.yml             # 3×/day eBay Browse API run
│   ├─ scrape-tropicalwatch.yml    # higher-cadence Browse AI run (TW only)
│   └─ tests.yml                   # pytest + jest, run on push + PR
├─ *_scraper.py                    # one file per dealer + auction house
├─ ebay_oauth.py                   # eBay Browse API token refresh
├─ ebay_search_scraper.py          # reads data/ebay_searches.json, calls Browse API
├─ merge.py                        # state + listings + auctions enrichment
├─ verify_sources.py               # post-merge scrape-health check (rolling-median anomaly detection)
├─ cache_watchlist_images.mjs      # Vercel Blob image persistence for hearted items
├─ api/img.js                      # serverless image proxy for hot-link-protected dealers
├─ data/
│   ├─ <source>.csv                # one CSV per dealer / auction house
│   └─ ebay_searches.json          # eBay search config (label, query, country, seller)
├─ public/
│   ├─ listings.json               # what the Listings + Watchlist tabs read
│   ├─ auctions.json               # what the Auction Calendar sub-tab reads
│   ├─ tracked_lots.json           # scraped state for tracked auction lots
│   ├─ state.json                  # cross-run memory for listings
│   ├─ auctions_state.json         # cross-run memory for auctions
│   ├─ verification.json           # latest source-health report (per-source counts + alerts)
│   ├─ verification_history.json   # rolling 14-day per-source counts (baseline for anomaly detection)
│   ├─ apple-touch-icon.png        # iOS home-screen icon
│   ├─ favicon-32.png              # browser tab favicon
│   └─ index.html
├─ supabase/
│   └─ schema/                     # SQL migrations — paste into Supabase SQL editor
│       ├─ 2026-05-01_collections.sql  # collections + collection_items tables
│       └─ 2026-05-03_challenges.sql   # Watch Challenges columns (target_count, budget, is_pick, reasoning, …)
├─ src/
│   ├─ App.js                      # orchestrator — owns state, builds shellProps, delegates to shells
│   ├─ supabase.js                 # auth + per-user data hooks
│   ├─ styles.js                   # shared inline-style tokens (pillBase, modalShell, ...)
│   ├─ utils.js                    # pure helpers + constants (matchesSearch, ageBucketFromDate, ...)
│   ├─ hooks.js                    # useWidth, useSystemDark (DOM-tracker hooks)
│   ├─ setupTests.js               # jest setup — auto-loaded
│   ├─ index.js                    # bootstrap + service-worker registration
│   ├─ hooks/                      # domain-state hooks
│   │   ├─ useTrackModal.js        #   Track new item modal state + submit
│   │   ├─ useFavSearchModal.js    #   Save-search prompt state + submit
│   │   ├─ useViewSettings.js      #   theme + column count (View popover folded into Settings)
│   │   ├─ useFilters.js           #   the filter row's full input state
│   │   └─ useEBaySearches.js      #   read-only fetch of data/ebay_searches.json + counts
│   └─ components/
│       ├─ MobileShell.js          # mobile render path (sticky stack, drawer, bottom nav)
│       ├─ DesktopShell.js         # desktop render path (top bar, filter row, fluid grid)
│       ├─ MobileShell.test.jsx    # render-without-crash + key visibility smoke tests
│       ├─ DesktopShell.test.jsx   # symmetric smoke tests for desktop
│       ├─ __fixtures__/
│       │   └─ mockShellProps.js   # default props bag used by both test files
│       ├─ WatchlistTab.js         # Watchlist tab body (Listings/Searches/Calendar sub-tabs)
│       ├─ AuctionCalendar.js      # month-banded auction calendar (used inside WatchlistTab)
│       ├─ ReferencesTab.js        # References-section landing list
│       ├─ SizeCompare.js          # print-to-scale watch size comparison tool
│       ├─ Card.js                 # listing card (also used for tracked lots)
│       ├─ Chip.js                 # filter pills (Chip + SidebarChip)
│       ├─ icons.js                # Filter, Search, Tab icons
│       ├─ AboutModal.js           # about modal
│       ├─ TrackNewItemModal.js    # paste-a-URL flow for tracked lots
│       ├─ FavSearchModal.js       # save-search prompt
│       ├─ AddSearchModal.js       # add-search modal (parity with Track new item)
│       ├─ CollectionEditModal.js  # create + rename collections
│       ├─ CollectionPickerModal.js # add a listing to a collection
│       ├─ SettingsModal.js        # currency picker + theme + columns + about (View menu lives here)
│       ├─ ShareBanner.js          # in-app banner for ?listing=<id>&shared=1 receive flow
│       ├─ ShareReceiver.js        # hook-isolated mount for share-receive logic (avoids App.js hook bloat)
│       ├─ EndingSoon.js           # auction-urgency pinned section + ending-soonest comparator
│       ├─ AdminTab.js             # source-quality dashboard at ?tab=admin (gated by REACT_APP_ADMIN_EMAILS)
│       └─ ChallengeFlow.js        # Watch Challenges multi-stage flow (Watchlist > Challenges)
└─ package.json
```

---

## Running locally

```bash
# Python scrapers — each writes a CSV to data/
pip install requests
python windvintage_scraper.py
python menta_scraper.py
# ...one per dealer/auction house

# Browse AI scraper needs an API key
export BROWSE_AI_API_KEY=your_key
python tropicalwatch_scraper.py --latest

# Merge all CSVs into listings.json + auctions.json
python merge.py

# Frontend — needs Supabase env vars in .env.local for auth/sync to work
# (the app falls back to read-only mode without them)
npm install
npm start
```

`.env.local` (gitignored):

```
REACT_APP_SUPABASE_URL=https://<your-project>.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# Optional — comma-separated emails for the admin dashboard at ?tab=admin.
# Leave empty (or omit) and the dashboard is unreachable. See "Admin
# dashboard" below.
REACT_APP_ADMIN_EMAILS=you@example.com
```

The app no-ops auth gracefully if these aren't set — you just can't sign in. Useful for running locally without a Supabase project of your own.

```bash
# Tests (state-transition coverage on merge.py)
pip install -r requirements-dev.txt
pytest
```

---

## Triggering a manual scrape

**Actions** tab → **Scrape watch listings** → **Run workflow**.

The pushed `state.json` / `auctions_state.json` will be updated on completion and Vercel redeploys automatically.

---

## What's next

Direction, priorities, and what's explicitly off the roadmap live in [ROADMAP.md](ROADMAP.md). Short version: foundations (references as first-class entities, verification script) come before more sources or features.

Test coverage is two suites, both in CI on every push and PR (`.github/workflows/tests.yml`):

- **pytest** — `merge.update_state` state transitions, the layer where a regression would silently corrupt the cross-run memory that drives "NEW" badges, price-drop detection, and the sold/archive view.
- **jest** — render-without-crash + key visibility smoke tests for `MobileShell` and `DesktopShell`. Catches the TDZ class of bug that shipped a white screen on mobile in late April 2026.

Scrapers aren't tested — most breakage there comes from external page changes that unit tests don't catch.

---

## Acknowledgments

Built iteratively with [Claude](https://claude.com/claude-code) as co-author — architecture decisions, all Python scrapers, the React component, the Supabase integration, the GitHub Actions workflow, and the state-tracking design. Every commit after the initial scaffold was a paired session.

Inventory credit: all listings and auction entries link directly back to their respective dealers and houses — Watchlist is read-only and ad-free.
