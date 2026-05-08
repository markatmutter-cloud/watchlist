# Watchlist — shipped archive

Items moved here from ROADMAP.md so the live document reads as
current state. History only — for design rationale, see commit
history and SESSION_HANDOFF archives.

## How this is organized

Grouped by epic (matching ROADMAP epic numbering). Each entry is
two-line max: title + ship date + one-sentence what.

---

## Epic 0 — Foundations

- **2026-05-02 — verify_sources.py.** Per-source liveness counter +
  rolling-7-day-median delta tracker; outputs verification.json.
- **2026-05-XX — verify_auction_lots.py (PR #35).** Same shape as
  verify_sources but for `auction_lots.json` per house.
- **2026-05-01 — User settings / currency preference.** `user_settings`
  Supabase table + USD/GBP/EUR picker in Settings.
- **2026-05-XX — SEO basics (PR #39).** Descriptive `<title>`, meta
  description, OG / Twitter card, canonical, JSON-LD, robots, sitemap.

## Epic 1 — Sources

- **2026-04-30 — eBay integration.** Free Browse API source; admin
  configures `data/ebay_searches.json`; BIN items in main feed.
- **2026-05-02 — Vintage Watch Collective.** Wix
  productsWithMetaData (Chronoholic clone), EUR, ~40 listings.
- **2026-05-03 — Vintage Watch Shop (Vintage Heuer).** WordPress
  custom-post + detail-page walker for "Our price: £NNNN"; ~20 items.
- **2026-05-XX — Brand and listing curation (PR #50, partial #52).**
  Hard exclusions, brand consolidations, Force-Other pooling, suppress-at-sold.

## Epic 2 — Auction houses

- **2026-05-XX — Calendar.** Six house calendars
  (Antiquorum, Bonhams, Christie's, Monaco Legend, Phillips, Sotheby's)
  scraped daily into `auctions.json`; month-banded UI.
- **2026-05-XX — Live lots.** Comprehensive per-lot scrape for
  Antiquorum / Christie's / Sotheby's / Phillips into `auction_lots.json`.
- **2026-05-XX — Archive (PR #42).** Manual-archive pipeline +
  Phillips CH080317 (42 Heuer lots, Geneva 2017) as first sale in.
- **2026-05-03 → retired 2026-05-04 — Auction urgency surfacing.**
  "Ending soon" pinned strip; superseded by Saved Auctions sub-tab.

## Epic 3 — Watchlist

- **2026-05-XX — Sub-tab structure.** Five Watchlist sub-tabs (Saved
  listings / auctions / sold / Favorite searches / Lists).
- **2026-05-04 — Lists (Collections renamed in UI).** User-created
  lists via `collections` + `collection_items`; Hidden as virtual list.
- **2026-05-06 — Collections refactor (PRs #85–#90).** "Everything is
  a list": Owned/Sold/Wishlist hard system lists, manual entry, force-rank.
- **2026-05-XX — Permanency across live → sold transition.** Saved
  entries keep price-at-save + cached image post-disappearance.
- **2026-05-08 — Saved searches \$ Min/Max persistence (PRs #136 + #137).**
  `saved_searches` gained nullable min_price / max_price + full wiring.
- **2026-05-06 — User limits.** 2,500-heart default cap, soft-warn at
  80%, BEFORE-INSERT trigger, admin expansion via `user_limits` table.

## Epic 4 — Sharing

- **2026-05-01 — Single-listing share.** Web Share API + clipboard
  fallback; `?listing=<id>&shared=1` deep link with Save/Dismiss banner.
- **2026-05-06 — Shared-link landing surface.** Focused full-width
  landing card (PRs #63–#72); browse chrome hides when share-receive active.
- **2026-05-06 — Dynamic OG preview (PR #70).** `api/share.js` emits
  per-listing og:image / og:title; rewrites `/share/:id`.
- **2026-05-07 — Sharing collections (List Share v1, PR #119).**
  `?list=<id>&shared=1` with read-only landing + Save-a-copy flow.
- **2026-05-07/08 — Collaborator lists slices 1–3 (PRs #121–#123).**
  Schema + RLS + RPCs + Manage-list sheet + accept-invite on share link.

## Epic 5 — References

- **2026-04-29 — Watch size comparison.** Two case dimensions →
  preview + print-to-scale on US Letter via React Portal pattern.
- **2026-05-XX — Curated link aggregator (Cool Stuff > Links).**
  Dealers / References / Topics accordion sections.

## Epic 6 — Collection mentality

- **2026-05-03 — Watch Challenges v1.** Constrained hypothetical
  collections; ONE collection per challenge with `type='challenge'`.
- **2026-05-06 — Watch Challenges rebuild (PRs #71, #73, #74, #75, #76).**
  3-stage stepper, click-pick everywhere, source picker over Lists/Favorites.
- **2026-05-06 — Watch Challenges v1.5 (PRs #78, #80, #90).**
  `?newchallenge=1` + `?challenge=<id>&shared=1` receive flows + sender attribution.

## Epic 8 — Site analytics (admin-only)

- **2026-05-02 — Source quality dashboard.** Per-source admin table:
  live count, hearts, heart-rate, avg price, top brand, earning-its-keep chip.
- **2026-05-05 — Total throughput in value.** Per-source rolling
  30-day `$ added` and `$ sold` columns on Source quality table.
- **2026-05-05 — Auction-house quality dashboard.** Six-house table:
  sales counts, sold rate, $ sold (90d), median Hammer/Low ratio.
- **2026-05-05 — User stats v1 (`listing_events`).** Raw events table +
  daily rollup + telemetry hook + engagement columns on Source quality.
