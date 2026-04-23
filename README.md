# Dial

A personal vintage watch listing aggregator. Dial pulls active inventory from a handful of independent dealers I trust, merges it into one browsable feed, and tracks listings across runs so new arrivals and price drops actually mean something.

**Live:** [watchdial.vercel.app](https://watchdial.vercel.app)

Built without a traditional development background — architecture, scrapers, React front-end, and CI/CD all co-authored with [Claude](https://claude.com/claude-code).

---

## Why this exists

I wanted a single place to see vintage watches from the specific dealers I follow, in one chronological feed, without the ads or the dealer-specific UIs. Chrono24 covers the universe but its interface buries things; dealer sites are all different. This is the minimum-viable version of what I actually look at every morning.

Not commercial. Not trying to be a marketplace. Just an aggregator for myself — and now open to anyone who wants to see how a non-technical person can ship something useful with an LLM as a pair-programmer.

---

## What it does

- Aggregates 10 curated dealer sources into one feed (see table below)
- Runs a Python scrape pipeline daily via GitHub Actions — no server to babysit
- Tracks listings across runs with **stable URL-hash IDs**, so:
  - "NEW" badges only show for listings actually new in the last 24 hours
  - Price drops get a green ↓ chip
  - Watchlist stays glued to the right listing even as dealers add new inventory
  - Listings that disappear from the scrape are marked inactive (groundwork for a sold archive)
- Client-side search, filter (by source / brand / price / recency), and sort
- Saved searches (configurable label + search query)
- Watchlist with price-at-save preservation
- Dark/light mode following system preference, with manual override
- GBP→USD conversion for UK dealers, shown alongside the native price
- Mobile: 3-col grid with a slide-up filter drawer and bottom-tab nav
- Desktop: resizable sidebar with a fluid column count based on width

---

## Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                  GitHub Actions (cron, daily)               │
  │                                                             │
  │   10× Python scrapers ──▶ *_listings.csv in data/           │
  │                              │                              │
  │                              ▼                              │
  │                          merge.py                           │
  │                          │                                  │
  │            ┌─────────────┴──────────────┐                   │
  │            ▼                            ▼                   │
  │    public/listings.json        public/state.json            │
  │    (what the app reads)        (cross-run memory:           │
  │                                 firstSeen, priceHistory)    │
  │                              │                              │
  │   commit & push back to main │                              │
  └──────────────────────────────┼──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                Vercel (auto-deploy on push)                 │
  │   React bundle served as static files + listings.json       │
  └─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    Browser fetches listings.json
                    — all filtering, sorting, state
                       lives client-side in React
```

No backend server. No database. No auth. The entire stack is static files, a scheduled job, and a CDN.

---

## Data sources

All scrapers hit each dealer's existing public endpoint — no credential-protected APIs, no headless browsers where it can be avoided.

| Source | Platform | Method | Currency |
|---|---|---|---|
| Wind Vintage | Squarespace | `?format=json` + HTML price parse | USD |
| Tropical Watch | Custom (JS-rendered) | [Browse AI](https://browse.ai) | USD |
| Menta Watches | WooCommerce | Store API `/wp-json/wc/store/v1/products` | USD |
| Collectors Corner NY | Shopify | `/products.json` | USD |
| Falco Watches | Shopify | `/products.json` | GBP |
| Grey & Patina | WooCommerce | Store API | USD |
| Oliver & Clarke | Shopify | `/products.json` | USD |
| Craft & Tailored | Shopify | `/products.json` | USD |
| Watch Brothers London | Squarespace | `?format=json` items[] API | GBP |
| MVV Watches | Squarespace | `?format=json` items[] API | USD |

Tropical Watch is the only source that still uses Browse AI — their site actively blocks scrapers. Every other source is scraped with vanilla `requests`. Browse AI robot ID and API key live in GitHub Secrets, never in the repo.

---

## How state tracking works

The biggest design decision in the project is `public/state.json`, committed to the repo alongside `listings.json`.

**The problem:** a naive scraper run every day produces a full list of current listings. If everything gets a "scraped today" stamp, you can't distinguish genuinely new arrivals from old inventory that just happened to be in today's scrape. And if a listing moves position in a source's catalog (e.g. a new listing is added above it), its array index changes — which would break any reference the app holds, like a watchlist entry.

**The fix:** every listing gets a stable 12-char ID — `sha1(normalized_url)[:12]`. URLs don't shift around the way array indices do, so the same listing keeps the same ID across runs.

`merge.py` then reads the previous state, compares this run's items to it, and maintains:

- `firstSeen` — the date we first observed this URL. The "NEW" chip reads from this, not from the scrape date.
- `lastSeen` — so disappearances can be detected (future sold-archive feature).
- `priceHistory` — appended only when price changes, not on every run. Cheap to store, makes price-drop detection trivial.
- `active` — flipped off when a listing drops out of the scrape.

This means the pipeline is **self-healing**: if a single run misses listings (e.g. a scrape limit set too low), the next run picks them back up automatically and flips them active again. No manual reconciliation.

---

## Stack

- **Scrapers:** Python 3.11 with `requests`. No Playwright, no Selenium — Browse AI fills the gap for JS-rendered sources.
- **Pipeline:** GitHub Actions (ubuntu-latest). Each scraper step uses `continue-on-error: true` so one failing source doesn't kill the batch.
- **Frontend:** React (Create React App), single-file component, no UI libraries — inline styles only. Kept intentionally simple for a sub-1000-line codebase.
- **Hosting:** Vercel free tier, auto-deploy from `main`.
- **Data storage:** JSON committed to the repo. At current scale (~700 listings, 676 KB total) a database would be pure overhead. If persistence needs grow (cross-device watchlist sync, long-term price history), this would graduate to Supabase.

---

## Folder layout

```
Dial/
├─ .github/workflows/scrape.yml    # daily cron pipeline
├─ *_scraper.py                    # one file per dealer
├─ merge.py                        # state + listings enrichment
├─ data/                           # generated CSVs, one per source
├─ public/
│   ├─ listings.json               # what the app reads
│   ├─ state.json                  # cross-run memory
│   └─ index.html
├─ src/
│   ├─ App.js                      # entire React UI
│   └─ index.js
└─ package.json
```

---

## Running locally

```bash
# Python scrapers — each writes a CSV to the repo root
pip install requests
python windvintage_scraper.py
python menta_scraper.py
# ...one per dealer

# Browse AI scraper needs an API key
export BROWSE_AI_API_KEY=your_key
python tropicalwatch_scraper.py --latest

# Merge all CSVs into listings.json and update state.json
python merge.py

# Run the React app
npm install
npm start
```

---

## Triggering a manual scrape

**Actions** tab → **Scrape watch listings** → **Run workflow**.

The pushed `state.json` will be updated on completion and Vercel redeploys automatically.

---

## What I'd do differently next

Honest list, since this is a learning project:

- **Extract React components out of `App.js`.** Sub-components are currently defined inside the main `Dial()` function, which causes unmount/remount on every render. Worked around with callback refs where it mattered (infinite scroll) but the right fix is proper separation.
- **Add a verification script.** Fetch each dealer's homepage, compare URL count to `state.json`, flag silent drop-outs. Catches scrape regressions that don't throw errors.
- **Move to Supabase** when/if I want cross-device watchlist sync or long-term analytics. Current JSON-in-repo design hits a wall somewhere north of ~5,000 active listings.
- **Automated tests for merge.py's state transitions** — fixtures with two sequential scrape outputs, assert the expected ID/firstSeen/priceHistory changes. Only layer of the app where tests would meaningfully prevent regressions.

No automated tests today. It's a personal project scraping sites I don't control; most breakage comes from a dealer changing their page shape, which isn't something unit tests catch anyway. I rely on catching issues on the site itself.

---

## Acknowledgments

Built iteratively with [Claude](https://claude.com/claude-code) as co-author — architecture decisions, all Python scrapers, the React component, the GitHub Actions workflow, and the state-tracking design. Every commit after the initial scaffold was a paired session.

Inventory credit: all listings link directly back to their respective dealers — Dial is read-only and ad-free.
