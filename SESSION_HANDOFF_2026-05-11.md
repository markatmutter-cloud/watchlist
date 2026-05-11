# Watchlist — Session Handoff (2026-05-11)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap, see [ROADMAP.md](ROADMAP.md).
This is an in-flight snapshot; durable rules graduate to CLAUDE.md.

## TL;DR

Two arcs today:

**Morning arc — UI redesign attempt + ripout.** Tried to land a new Home tab (activity-grouped landing) and styled section headers per a parallel-Claude design handoff. Shipped, broke production with a React Hooks #310 error (useMemo placed after `if (loading) return …` early returns), white-screened the site. Reverted. Multiple follow-on pivots on header styling. Net result: **Home tab is gone, design pre-redesign restored.** Several real bug fixes survived (PRs #200, #203, #204, #205, #208's Saved-drill-in half).

**Afternoon arc — auction data architecture.** User pointed out hundreds of sold auction lots from this weekend missing from the app. Root cause: scraper architecture has no persistent registry; sales falling out of per-house calendar CSVs disappear from `auctions.json` and thus from lot enumeration. Started building the proper structural fix as a four-PR series.

## What's in production right now

| PR | Title | Status |
|---|---|---|
| #200 | Saved un-heart fix + auction calendar date format | ✅ merged |
| #203 | Closing-time banding on Auctions sub-tab | ✅ merged |
| #204 | Refresh preserves current tab | ✅ merged (now mostly a no-op since Home is gone) |
| #205 | Heart-on-auctions 22P02 fix (float-string int coercion) | ✅ merged |
| #206 | Wider gutters across all tabs (4px more padding) | ✅ merged |
| #207 | Date/Price pills no longer falsely active on Home | ✅ merged (now mostly a no-op) |
| #208 | Pill-shape date-band headers + Saved drill-in shows hearted auctions | ✅ merged (header style later reverted to original in #209) |
| #209 | **Remove Home tab entirely + revert grey headers to original** | ✅ merged |
| #210 | Sold session-1 auction lots (with realised `sold_price`) treated as ended | ✅ merged |
| #212 | Persist historical sold lots permanently in `auction_lots.json` | ✅ merged |

## Auction data — what's broken vs fixed

**Working:**
- Sotheby's: 47 sold lots in the data, correctly captured via algoliaJson
- Image cache: Vercel Blob token now works (run `25653774279` succeeded after Mark updated `BLOB_READ_WRITE_TOKEN`)
- Persistence: PR #212 keeps sold lots across runs even when their parent sale exits the active scrape window

**Broken / in flight:**
- **Antiquorum: 0 lots in data.** Calendar scraper reverts URL to generic `upcoming-auctions-and-viewings/` once `days_until < 0`. Comprehensive scraper can't enumerate.
- **Phillips: 0 sold prices for 426 lots.** Per-lot scraper `scrape_phillips_lot` correctly extracts `Sold For` from the detail page (verified live against a CH080226 Rolex lot — sold_price=190500). The miss is that the Phillips Geneva Watch Auction XXIII (CH080226, May 9-10) isn't in our Phillips calendar at all because phillips.com/watches drops past sales. So we never know to enumerate its lots.
- **Christie's: 0 sold prices for 498 lots.** Different cause: `price_realised` field exists in inline JSON but is null on every lot — the May 11-12 sale hasn't ended yet and results haven't posted. Need a re-scrape pass after sales end to catch the realised-price update.

**Hearted Antiquorum lots are NOT lost.** They live in `watchlist_items` with full `listing_snapshot`. They render as stale (sold:false from the pre-sale snapshot) because `watchItems` falls back to snapshot when `liveStateById` has no entry. Recovery: once Antiquorum lots flow back into `auction_lots.json` (PRs #213+#214), `watchItems` merges the live sold state in.

## Four-PR series in progress

Per Mark's direction "I don't want simple for you - I want good fix":

1. **#213 — Auctions registry: emit auctions.json from full state, not just current CSVs.** ✅ **OPEN, ready for review.**
   - `auctions_state.json` becomes a proper registry with full sale identity (house/title/dates/location/catalogUrl)
   - `process_auctions()` emits `auctions.json` by walking the WHOLE registry
   - New `catalogUrl` field preserved separately from `lastUrl` — never overwritten with a generic page
   - Per-house calendar scrapers unchanged in this PR

2. **#214 — Antiquorum: always probe catalog URL.** Drop the `days_until` gate entirely. HEAD-check on every scrape regardless of sale status. If 200, use catalog URL; if 404 (sale archived someday), fall back to generic. No arbitrary windows.

3. **#215 — Two-pass `auction_lots_scraper`.**
   - **Pass 1 (enumeration)**: sales in `[today - 7d, today + 90d]` window — full lot fetch as today
   - **Pass 2 (results-refresh)**: sales in `[today - 30d, today - 7d]` window — for each existing lot in our data lacking sold_price, re-fetch just the per-lot detail to extract sold_price
   - **Lot freshness**: never re-fetch lots that already have sold_price (settled lots are immutable)
   - Sotheby's, Christie's, Phillips, Antiquorum all benefit

4. **#216 — Phillips past-sales discovery + tracked-lot auto-register.**
   - New source for Phillips calendar: scrape phillips.com/auctions or /results (need to verify URL) for past sales — phillips.com/watches only shows upcoming
   - Auto-register from tracked-lot URLs: when a user pastes `phillips.com/detail/<brand>/<sku>`, extract the auction code from the image URL (`CH080226` pattern), look up that auction, ADD it to the registry. Discovery via user behaviour as a fallback to discovery via index pages.

## Things to remember

- **`auctions_state.json` schema expanded in #213.** It now carries the full sale identity, not just metadata. Pre-existing entries (only `firstSeen`, `lastUrl`, `lastTitle`) get backfilled the next time their CSV row appears. The schema is forward-compatible.
- **`catalogUrl` vs `lastUrl`.** lastUrl is whatever the current scrape wrote; catalogUrl is the last-known working catalog URL. `auction_lots_scraper.py` (once #214 lands) should prefer catalogUrl when present.
- **PR #212's persistence merge** only preserves lots with `sold_price` set. Passed/unsold/never-resolved lots are NOT persisted — they have no settled outcome.
- **Image policy (unchanged):** hearted items → Vercel Blob via `cache_watchlist_images.mjs`; everything else → source URL at the auction house. Auction houses keep their lot images up indefinitely for marketing, so source URLs are reliable for historical sold lots.
- **PWA service worker cache.** Many of Mark's "X isn't changing" reports today were the SW serving a stale bundle. Hard refresh / incognito to verify.

## Things NOT to do

- Don't bring back the Home tab. Mark explicitly killed it: "honestly i want to delete that fucking landing page."
- Don't restyle the date-band section headers. Mark's settled position: "just go back to how they were at the start of today" (the original `borderBottom: "0.5px solid var(--border)"` + grid background bleed-through). Reverted in #209.
- Don't ship multiple things in one commit. Mark's lesson today (after the home tab debacle): "smaller commits + preview-URL verification = bug hits a preview deploy, not production."
- Don't push to `main` directly via Claude — the auto-mode classifier blocks it. Open a PR.
- Don't run any scrape against a real auction house from this session (Cloudflare / DataDome blocks; user-side trigger only).

## Critical finding (2026-05-11 ~08:00 UTC): workflow race condition

The two scrape workflows (`scrape-auctions.yml` and `scrape-auction-lots-frequent.yml`) trigger simultaneously. They both checkout `main` and run independently. The auctions workflow runs `merge.py` to update `public/auctions.json`, then commits + pushes. The lots workflow reads `public/auctions.json` directly from the runner's working tree.

If the lots workflow gets to its read step BEFORE the auctions workflow commits, it gets the stale file. That happened tonight: Antiquorum's May 9-10 catalog URL landed in `auctions.json` at 08:02:21 (merge.py emit), but the lots scraper had already logged "10 sale(s) in active window" at 08:00:23 — two minutes earlier. Antiquorum got skipped.

**Mitigation tonight:** manually re-triggered `scrape-auction-lots-frequent.yml` at run `25658557634` after the auctions workflow had finished committing. That run should pick up Antiquorum's May 9-10 sale.

**Permanent fix needed (tomorrow):** change `scrape-auction-lots-frequent.yml` to use a `workflow_run` trigger so it fires AFTER the auctions workflow finishes, instead of in parallel. Example:
```yaml
on:
  workflow_run:
    workflows: ["Scrape auctions"]
    types: [completed]
```
The cron + manual-dispatch triggers can stay alongside, but the parallel parent-cron coupling should be replaced with the workflow_run dependency.

## Open questions for Mark (when convenient)

- For Phillips past-sales discovery (PR #216): is there a known phillips.com/auctions/past URL or similar? I haven't verified empirically.
- Should `auctions_state.json` ever GC entries that are >5 years old? Currently grows forever.
- Reaction system on shared lists (the original parallel-Claude design ask) is still parked. Not part of the auction-data series.
