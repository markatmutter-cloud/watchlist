# Working with this repo

Notes for Claude Code (and any human picking this up cold). Keep this
file tight — read it once at the start of a session and you should know
how to behave for the rest of it. Strategy and direction live in
[ROADMAP.md](ROADMAP.md); current in-flight state lives in the latest
`SESSION_HANDOFF_*.md`.

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

## Architecture pointers

- **Static-data architecture.** Scrapers run in GitHub Actions 3x daily
  (PT-aligned), write CSVs into `data/`, `merge.py` enriches into
  `public/listings.json` + `public/state.json` (cross-run memory using
  stable URL-hash IDs). Per-user data (watchlist, hidden, saved searches,
  tracked auction lots) lives in Supabase with row-level security.
- **Frontend.** React (CRA), inline styles, no UI library. App.js was a
  single 2,800-line file; now split across `src/components/` (Card, Chip,
  icons, AuctionsTab, AboutModal, HiddenModal, WatchlistTab) plus
  `src/utils.js` and `src/hooks.js`. Root is ~1,700 lines.
- **One serverless function:** `api/img.js` proxies hot-link-protected
  dealer images (Watchfid). Sends `Referer` per allowlisted host.
- **Vercel Blob** caches dealer images for hearted listings only — see
  `cache_watchlist_images.mjs` and the `dial_image_caching.md` memory
  note. Don't extend that cache to the full feed.

## Scraper conventions

- Each dealer / auction house has its own `*_scraper.py` at repo root.
  Per-source structure is intentional — one breaking site means one file
  to debug. Don't refactor into a shared module unless a class of bug
  spans many scrapers (this is on ROADMAP.md as explicitly NOT-now).
- Each scraper writes a CSV to `<name>_listings.csv` in cwd; the workflow
  step then moves it to `data/<name>.csv`. `merge.py`'s SOURCES list maps
  CSV path → display name → currency.
- Auction calendars produce `*_auctions_listings.csv` and land in
  `data/<name>_auctions.csv`; `merge.py` auto-globs `data/*_auctions.csv`
  so adding a new auction scraper doesn't require touching merge.py.
- `continue-on-error: true` on each scrape step in the workflow so one
  failing source doesn't kill the batch.

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

## When in doubt

Read ROADMAP.md and the latest SESSION_HANDOFF, then ask. Mark prefers
"here's the tradeoff, want me to A or B?" over "I assumed B and shipped"
for anything bigger than a one-file fix.
