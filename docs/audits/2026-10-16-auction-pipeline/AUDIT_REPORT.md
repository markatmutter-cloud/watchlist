# Auction pipeline audit — 2026-10-16

**Grade: C.** Every house's calendar parses except one, and lot coverage is
healthy where it isn't blocked, but three sources were silently broken, the
daily workflow had been red for days on gates nobody triaged, and the calendar
carried twelve sales the houses no longer list.

Scope: the whole auction pipeline, site → calendar scraper → CSV →
`auctions.json` → lot enumeration → committed JSON. Triggered by Mark spotting
one missing Antiquorum sale (an "Only Online Auction" in Hong Kong) and asking
whether the rest was right.

Method: each house's scraper run live and diffed against its own site; the
health gates (`calendar_canary`, `auction_calendar_health`, `calendar_coverage`,
`auction_health`, `source_freshness`) run against committed artifacts; the
**CI run logs** read per sale rather than trusting a laptop run (CI ≠
residential); lot counts attributed per sale across `auction_lots.json`,
`bonhams_lots.json` and `manual_archive_lots.json`.

## What was broken

| # | Finding | Evidence | Outcome |
|---|---|---|---|
| 1 | Antiquorum's timed online sales never reached the calendar; the same miss made the next row's location read "Auction New York" | Calendar lists them month-only ("Hong Kong September 2026"); the regex required a day and one fixed title | Fixed #985 |
| 2 | Marteau & Co missing entirely for five weeks, including The Encore (opened 8 Oct, catalogue live, 42 lots) | Site rebuilt its Bootstrap cards between 08-30 and 10-02; three regexes stopped matching; scraper wrote a header-only CSV and **exited 0** | Fixed #990 |
| 3 | Phillips returned zero lots for every sale from 2026-10-03, including a live one | WAF widened from lot pages to the auction page; `403` per sale in CI, 200 + 88 lots residentially | Fixed #991, CI-proven |
| 4 | Twelve sales on the calendar that the houses no longer list, two of them pinned at the top as "live" with no dates since June | Registry keys on (house, dateStart, title), so a date change mints a new entry and the old one is emitted forever | 6 fixed #985; rest B-102, B-103 |
| 5 | Mixed "Jewellery & Watches" sales dropped whole | Title and URL-slug blocklist matched "Fine Jewelry & Watches" (Milan, 14 Oct) twice over; would also have killed Monaco Legend's recurring "Exclusive Timepieces & Jewels" | Fixed #992 |
| 6 | The daily auctions workflow had failed every run for days | Two health gates, both pointing at findings 2 and 5. The alarm worked; nobody triaged it | Gate noise B-106 |

## What was already right

- Sotheby's, Christie's, Antiquorum, Monaco Legend and Watches of Knightsbridge
  all parse their sites correctly.
- Lot coverage where not blocked: Sotheby's 413 / 364 / 348 / 109 per sale,
  Christie's live Hong Kong Edit 207, Bonhams 508 lots scraped on audit day via
  the residential agent (healthy, 14 sales).
- 6,074 lots held across the three lot files, updating every run.
- Sales more than 90 days out legitimately have no lots (`UPCOMING_WINDOW_DAYS`).

## Two things worth keeping as lessons

**A scrape that parses nothing must exit non-zero.** Marteau wrote an empty CSV
and reported success. The rule already existed in CLAUDE.md; the scraper
predated it. Finding 2's fix adds the exit.

**A plausible regex is not a verified one.** The first fix for Marteau's card
matched the card's own `auction-card-image` / `-detail` children, splitting
every card into fragments and silently dropping its cover image. The live page
still produced four rows, so only a test caught it. Pin the markup shape, don't
eyeball the output.

## Verified on CI after the fixes

Run 38983842851, dispatched the same day: Phillips `/browse via curl-cffi: ok`
(218 + 329 lots) while plain requests 403s in the same run, which confirms a
TLS-fingerprint block rather than an IP ban; Marteau back to 5 sales including
one we had never seen (The Blueprint, 6 Nov); `hiding 5 rescheduled sale(s)`
from the merge. The coverage gate (B-106) is now the only failing step.

The Antiquorum sale that started this audit cannot be recovered by the fix:
it ended 28 September and has left the live host's upcoming index, so it is a
manual-archive job (see the handoff).

## Open questions for Mark

- Christie's **Rétromobile New York** is a classic-car sale that appears on
  their watches department page. Keep it or exclude it? (Two rows today, one of
  them an accent-only duplicate: B-105.)

## Routing

Findings 1, 2, 3, 5 and part of 4 shipped (see SHIPPED.md, 2026-10-16).
Everything still open is in BUGS.md as B-102 … B-107, tagged
`[audit:2026-10-16]`.
