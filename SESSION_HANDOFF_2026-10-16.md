# Session handoff — 2026-10-16

## What this is

An **auction-pipeline audit** that started from one missing sale and ended with
four PRs merged. Mark pasted an Antiquorum link (a timed "Only Online Auction"
in Hong Kong, launched that day) and asked why it wasn't on our calendar, then
asked for a wider check of which sales are scheduled, which have catalogues,
and what the houses actually list.

Full report: [docs/audits/2026-10-16-auction-pipeline/AUDIT_REPORT.md](docs/audits/2026-10-16-auction-pipeline/AUDIT_REPORT.md).
Grade **C**. Everything still open is B-102 … B-107 in BUGS.md.

## What shipped (all four merged today)

- **#985 — Antiquorum online sales + reschedule ghosts.** The calendar page
  lists online sales month-only ("Hong Kong September 2026"); our regex
  required a day and one fixed sale title, so the sale was dropped silently and
  the miss also made the *next* row's city read "Auction New York". Month-only
  sales now take real dates from the live host, any live-host sale the calendar
  page hasn't caught up with is added on its own, and `superseded_auction_ids`
  stops emitting a sale that a reschedule replaced.
- **#990 — Marteau & Co.** Missing for five weeks: they rebuilt their Bootstrap
  cards between 08-30 and 10-02 and three regexes stopped matching at once. A
  zero-row parse now exits non-zero.
- **#991 — Phillips.** Their WAF widened from lot pages to the auction page on
  10-03 and every sale went to zero lots. Fetch now walks `/browse` (the path
  their app shares, Mark's find) then `/overview`, curl-cffi before requests.
- **#992 — Mixed jewellery sales.** Carried whole, non-watch lots dropped per
  lot, **mixed sales only** per Mark: a watch sale keeps its own odd necklace.

## Verification state — read this first

- #985/#990/#992 are calendar-and-filter logic, verified by running the real
  scrapers against the live sites plus unit tests (309 pytest green).
- **#991 is the one with an owed proof.** curl-cffi fixes TLS fingerprints,
  never a JavaScript challenge (B-81), and nothing here can probe from a
  GitHub Actions IP. A `workflow_dispatch` run of `scrape-auctions.yml` was
  fired after the merges to check it on CI's own IPs; **read that run's log for
  `[Phillips] /browse via …`**. If it still says 403 via curl-cffi, the answer
  is the residential agent that already runs Bonhams, not more header tweaks.
- The same run is the first one that should produce: Marteau's "The Encore"
  (4 sales, 42 lots), and Antiquorum's Hong Kong online sale with realised
  prices.

## The one live clock

Antiquorum's Hong Kong online sale ran **14–28 September** and we never showed
it, because #985 sat unmerged for 11 days. Antiquorum still serves its results
(183 lots, 174 with realised prices as of 10-05), and `RECENT_SOLD_WINDOW_DAYS`
is 30, so the lot scraper can still capture them **until roughly 28 October**.
After that the sale is lost to us.

## Open decision for Mark

Christie's **Rétromobile New York** is a classic-car sale listed on their
watches department page. Keep it or blocklist it? (B-105; asked 10-05.)

## Next session

1. Read the dispatched run's log; close out #991 or move Phillips to the
   residential agent.
2. **B-102 + B-103** — the delisted-sale rule. Designed and validated against
   the real registry (it hid exactly the 12 sales the live-site diff had found
   and nothing else); it only needs writing now that #985 is in. This is what
   clears the last six ghosts and the two dateless Bonhams rows that sit at the
   top of the calendar as "live" since June.
3. **B-106** — make the coverage gate able to go green, so the daily auctions
   workflow stops being red for reasons nobody can act on.
