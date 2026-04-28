# Working with this repo

Notes for Claude Code (and any human picking this up cold). Keep this
file tight — read it once at the start of a session and you should know
how to behave for the rest of it.

**Doc separation (each has one job):**
- This file (CLAUDE.md) — durable working conventions. Read every session.
- [README.md](README.md) — what the project is + architecture. Public-facing.
- [ROADMAP.md](ROADMAP.md) — priorities, epics, what's explicitly out of scope.
- `SESSION_HANDOFF_*.md` — in-flight snapshot per session. **Not durable.**
  The current one is [SESSION_HANDOFF_2026-04-27.md](SESSION_HANDOFF_2026-04-27.md);
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
Frontend is React (CRA, inline styles), root `App.js` ~1,700 lines plus
`src/components/` and `src/utils.js`/`src/hooks.js`. Per-user data
(watchlist, hidden, saved searches, tracked lots) is in Supabase with
RLS. One serverless function: `api/img.js` (image proxy for hot-link-
protected dealers). Vercel Blob caches dealer images for hearted items
**only** — see `cache_watchlist_images.mjs`; **don't extend the blob
cache to the full feed**.

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

## Tests

`tests/test_merge_state.py` covers state-transition logic in
`merge.update_state` — the cross-run memory layer where regressions
would be costly and silent. Synthetic input dicts only (no CSV files,
no scraper output, no frontend). Driven by pytest. Each test name
describes the transition it covers so a failure points straight at the
broken case.

Run locally:

```
pip install -r requirements-dev.txt    # one-time setup
pytest                                  # runs the suite
```

The suite also runs in CI on every push to main and every PR
(`.github/workflows/tests.yml`). When adding new state-transition
behavior to `merge.py`, add a corresponding test in the same file.
Currently-documented bugs (e.g. silent currency switches) live as
behavior-documenting tests rather than expected-failures — when those
bugs are fixed, the relevant test needs an update too.

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
