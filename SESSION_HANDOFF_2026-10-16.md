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

## Verified on CI, after the merges (run 38983842851, dispatched 2026-10-16)

- **Phillips: fixed, and the hypothesis was right.** `[Phillips] /browse via
  curl-cffi: ok` with 218 lots (Geneva XXIV) and 329 (Hong Kong XXIII), while
  plain requests still 403s in the same run. So it was a TLS-fingerprint block
  on CI, not an IP ban, and no residential move is needed. Two December sales
  log "200 but no lot payload" on both paths: that is an unpublished catalogue,
  not a failure, but the log line reads like one and could be worded better.
- **Marteau: fixed, and already earning.** 5 sales now, including The Encore
  (ran 8–15 Oct) and a sale we had never seen, **The Blueprint, 6 November**,
  catalogue already up. Both are in `auctions.json`.
- **#985's reschedule rule is live:** `auctions: hiding 5 rescheduled sale(s)`.
- **Sotheby's Milan "Fine Jewelry and Watches"** is scraped into the CSV and,
  with #992 now merged, passes the catalogue check. It lands in
  `auctions.json` on the next run.
- **The only failing step is the coverage gate (B-106)**, which is the gate
  that cannot go green by construction.

## The Hong Kong sale is now manual-only (the automated window has closed)

The calendar fix cannot recover it: the sale ENDED on 28 September, so it has
dropped out of the live host's upcoming index, and the scraper correctly logs
`Hong Kong September 2026 Only Online Auction: no live sale yet, skipped`. The
fix protects every FUTURE online sale; this one it cannot reach.

Antiquorum still serves the results (183 lots, 174 with realised prices as of
10-05), so the only route left is the manual archive pipeline, which supports
Antiquorum: append to `data/manual_archive_sales.json`

```json
{"url": "https://live.antiquorum.swiss/auctions/1-DBHZ27/only-online-auction-hong-kong",
 "house": "Antiquorum", "title": "Only Online Auction - Hong Kong", "date": "2026-09-28"}
```

then run `manual_archive_scraper.py` and commit `public/manual_archive_lots.json`.
Offered to Mark 2026-10-17, awaiting his word. Not urgent in the old sense (the
30-day lot-scrape window no longer applies to a manual pull), but do it while
the house still serves the page.

## Open decision for Mark

Christie's **Rétromobile New York** is a classic-car sale listed on their
watches department page. Keep it or blocklist it? (B-105; asked 10-05.)

## Next session

1. **B-102 + B-103** — the delisted-sale rule. Designed and validated against
   the real registry (it hid exactly the 12 sales the live-site diff had found
   and nothing else); it only needs writing now that #985 is in. This is what
   clears the last six ghosts and the two dateless Bonhams rows that sit at the
   top of the calendar as "live" since June.
2. **B-106** — make the coverage gate able to go green, so the daily auctions
   workflow stops being red for reasons nobody can act on.
