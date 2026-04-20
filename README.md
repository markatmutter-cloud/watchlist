# Dial

A personal vintage watch listing aggregator. Dial pulls active inventory from selected independent dealers, merges it into a single browsable feed, and serves it as a clean web app — updated automatically twice daily.

Built without a traditional development background, props to Claude as a co-author throughout.

## What it does

- Aggregates listings from Wind Vintage, Tropical Watch, Menta Watches, Collectors Corner NY, and Falco Watches
- Runs scrapers automatically via GitHub Actions at 8am and 10pm UK time
- Serves a React front-end via Vercel that fetches the latest data on load
- Supports filtering by source, brand, price range, and recency (today / 3 days / this week / this month)
- Watchlist with price preservation (saved price survives listings going sold or offline)
- Column switcher (3/4/5) for mobile and desktop
- Dark and light mode
- GBP→USD conversion for UK-based dealers

## Architecture

```
GitHub Actions (cron)
    └── runs 5 scrapers (Python)
    └── merge.py combines CSVs → public/listings.json
    └── commits back to repo

Vercel (auto-deploy on commit)
    └── builds React app
    └── serves listings.json as static file

Browser
    └── fetches /listings.json on load
    └── all filtering and sorting runs client-side
```

No backend server. No database. No auth. The entire stack is static files, a scheduled job, and a CDN.

## Data sources

| Source | Method | Currency |
|--------|--------|----------|
| Wind Vintage | Squarespace JSON API | USD |
| Tropical Watch | Browse AI robot (bot-protected site) | USD |
| Menta Watches | WooCommerce public REST API | USD |
| Collectors Corner NY | Shopify products.json | USD |
| Falco Watches | Shopify products.json | GBP |

Tropical Watch uses [Browse AI](https://browse.ai) because the site actively blocks headless browsers. The robot ID and API key are stored as GitHub Secrets and never appear in the codebase.

## Stack

- **Scrapers**: Python with `requests` — no Playwright, no Selenium
- **Pipeline**: GitHub Actions (ubuntu-latest, Python 3.11)
- **Frontend**: React (Create React App), single-file component, no external UI libraries
- **Hosting**: Vercel (free tier, auto-deploy from main branch)
- **Data storage**: JSON file committed to repo — no database needed at this scale

## Running locally

```bash
# Install dependencies
pip install requests

# Run individual scrapers (outputs CSV to repo root)
python windvintage_scraper.py
python menta_scraper.py
python collectorscorner_scraper.py
python falco_scraper.py
python tropicalwatch_scraper.py --latest  # requires BROWSE_AI_API_KEY env var

# Merge all CSVs into listings.json
python merge.py

# Run the React app
npm install
npm start
```

## Triggering a manual scrape

Go to the **Actions** tab in GitHub → **Scrape watch listings** → **Run workflow**.

## Co-authored with

[Claude](https://claude.ai) (Anthropic) — architecture, all scraper code, React component, GitHub Actions workflow, and debugging throughout.
