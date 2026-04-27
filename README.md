# Watchlist

A personal vintage watch listing aggregator. Watchlist pulls active inventory from a handful of independent dealers I trust, merges it into one browsable feed, and tracks listings across runs so new arrivals, price changes, and disappearances are easily visible. It also tracks upcoming auctions from the houses worth following.

**Live:** [the-watch-list.app](https://the-watch-list.app)

Built without a development background — architecture, scrapers, React front-end, Supabase auth/data, and CI/CD all co-authored with [Claude](https://claude.com/claude-code).

---

## Why this exists

I wanted a single place to see vintage watches from the specific dealers I follow, in one chronological feed, without the ads or the dealer-specific UIs. Chrono24 covers the universe but its interface buries things; dealer sites are all different. Auctions add another moving target — Phillips, Bonhams, Antiquorum, Monaco Legend each publish their schedules differently, and tracking what's coming up across all of them shouldn't take five tabs.

Not commercial. Not trying to be a marketplace. Just an aggregator for myself — and now open to anyone who wants to see how a non-technical person can ship something useful with an LLM as a pair-programmer.

---

## What it does

- **Available** — aggregates 19 curated dealer sources into one feed (see table below)
- **Auctions** — tracks upcoming auctions from 4 houses, grouped by month
- **Archive** — sold/delisted items (kept around so you can search reference history) and hidden listings
- **Watchlist** — heart any listing to save it; price-at-save is preserved so you can see drops
- Cross-device sync via Google sign-in (Supabase auth + tables, RLS-protected)
- Per-user **saved searches** — add/edit/delete your own queries, with live counts of matching listings
- **Hide** any listing with the X button — it stays out of Available but lives in the Archive in case you change your mind
- Runs a Python scrape pipeline daily via GitHub Actions — no server to babysit
- Tracks listings across runs with **stable URL-hash IDs**, so:
  - "NEW" badges only show for listings actually new in the last 24 hours
  - Price drops get a green ↓ chip
  - Watchlist stays glued to the right listing even as dealers add new inventory
  - Listings that disappear from the scrape are flipped to inactive and slide into the Archive
- Client-side search, filter (by source / brand / reference / price / recency), sort
- Dynamic reference filter chips, scoped to whatever brands you've selected
- Dark/light mode following system preference, with manual override
- GBP→USD conversion for UK dealers, shown alongside the native price
- Mobile: 3-col grid with a slide-up filter drawer and bottom-tab nav
- Desktop: full-width top bar with collapsible filter sidebar; resizable, fluid column count

---

## Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                  GitHub Actions (cron, daily)               │
  │                                                             │
  │   19× listing scrapers + 4× auction scrapers (Python)       │
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

### Dealers (19)

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

Tropical Watch is the only source still routed through Browse AI — their site actively blocks scrapers. Every other source is scraped with vanilla `requests`. Browse AI robot ID and API key live in GitHub Secrets, never in the repo.

### Auction houses (4)

| House | Method | Notes |
|---|---|---|
| Antiquorum | HTML calendar parse + HEAD-check on catalog URLs | Only links to a specific catalog when its URL returns 200 |
| Monaco Legend | HTML, anchored on `<p class="auction-date">` | Both featured + grid card layouts share that element |
| Phillips | HTML, walking backward from each `atc_date_start` block | Phillips puts the auction href above the date block |
| Bonhams | HTML, explicit `_pair(y1, mo1, d1, y2, mo2, d2)` date parser | Earlier helper had a buggy implicit-end-year bug |

Auction tracking is lot-agnostic — we surface upcoming sale dates and a link, not individual lots.

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
- **Frontend:** React (Create React App), single-file component, no UI libraries — inline styles only. Now ~2,700 lines — overdue for splitting (see "What I'd do differently next" below).
- **Per-user image persistence:** Hearted listings get their dealer image cached to **Vercel Blob** by `cache_watchlist_images.mjs` (runs once a day inside the auctions workflow). The frontend prefers the cached URL, so favorited cards survive a dealer deleting the original. Listings/auction images aren't cached — auction houses keep theirs up long-term, and caching the full feed isn't worth the storage cost.
- **Auth + per-user data:** [Supabase](https://supabase.com) — Postgres with row-level security, Google OAuth provider. Free tier; no backend code of my own.
- **Hosting:** Vercel free tier, auto-deploy from `main`.
- **Static data:** JSON committed to the repo. At current scale (~1,800 listings, ~2 MB) keeping this in git is cheaper and simpler than running a database for it. Per-user data (which actually needs writes) lives in Supabase.

---

## Folder layout

```
watchlist/
├─ .github/workflows/
│   ├─ scrape-listings.yml         # daily dealer listings pipeline
│   ├─ scrape-auctions.yml         # daily auctions + tracked-lots + watchlist-image cache
│   └─ scrape-tropicalwatch.yml    # higher-cadence Browse AI run (TW only)
├─ *_scraper.py                    # one file per dealer + auction house
├─ merge.py                        # state + listings + auctions enrichment
├─ data/                           # generated CSVs, one per source
├─ public/
│   ├─ listings.json               # what the Available/Watchlist/Archive tabs read
│   ├─ auctions.json               # what the Auctions tab reads
│   ├─ state.json                  # cross-run memory for listings
│   ├─ auctions_state.json         # cross-run memory for auctions
│   ├─ apple-touch-icon.png        # iOS home-screen icon
│   ├─ favicon-32.png              # browser tab favicon
│   └─ index.html
├─ src/
│   ├─ App.js                      # entire React UI
│   ├─ supabase.js                 # auth + per-user data hooks
│   └─ index.js
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
```

The app no-ops auth gracefully if these aren't set — you just can't sign in. Useful for running locally without a Supabase project of your own.

---

## Triggering a manual scrape

**Actions** tab → **Scrape watch listings** → **Run workflow**.

The pushed `state.json` / `auctions_state.json` will be updated on completion and Vercel redeploys automatically.

---

## What I'd do differently next

Honest list, since this is a learning project:

- **Extract React components out of `App.js`.** Sub-components defined inside the root component cause unmount/remount on every render — bit me twice already (input focus loss, slider drag breaking). Worked around with JSX-const helpers and callback refs, but the right fix is splitting the component into its own files.
- **Add a verification script.** Fetch each dealer's homepage, compare URL count to `state.json`, flag silent drop-outs. Catches scrape regressions that don't throw errors.
- **Lot-level auction tracking.** Currently we surface auction *dates* but not individual lots. Would be a meaningful step up but adds a lot of scraper surface area.
- **Automated tests for `merge.py`'s state transitions** — fixtures with two sequential scrape outputs, asserting the expected ID/firstSeen/priceHistory changes. Only layer of the app where tests would meaningfully prevent regressions.

No automated tests today. It's a personal project scraping sites I don't control; most breakage comes from a dealer changing their page shape, which isn't something unit tests catch anyway. I rely on catching issues on the site itself.

---

## Acknowledgments

Built iteratively with [Claude](https://claude.com/claude-code) as co-author — architecture decisions, all Python scrapers, the React component, the Supabase integration, the GitHub Actions workflow, and the state-tracking design. Every commit after the initial scaffold was a paired session.

Inventory credit: all listings and auction entries link directly back to their respective dealers and houses — Watchlist is read-only and ad-free.
