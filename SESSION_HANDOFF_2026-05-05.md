# Watchlist — Session Handoff (2026-05-05)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — the durable rules graduate to CLAUDE.md, the durable plans
graduate to ROADMAP.md.

## TL;DR

Long day. **Sixteen PRs (#38 → #53)**, all merged. Production current.
Bundle hash floats with each Vercel deploy.

The session arc, plain English:
1. **AM polish — Watchlist sub-tabs.** Count badge bug (it was reading
   the listings count, not watchlist), mobile +buttons spilled the
   sub-tab strip into a horizontal scroller, heart-tap-target was tiny
   on 1-col mobile.
2. **Cool Stuff rename + Links page + dead-code sweep + SEO basics.**
   References tab → "Cool Stuff" (label only). New Links resource
   under Cool Stuff with auto-derived Dealers + curated References /
   Art / Straps / Editorial sections. ~150 lines of dead code from
   the April restructures swept. Title / description / OG / robots /
   sitemap / JSON-LD shipped.
4. **Three new dealers** (Luna Royster, S.Song Watches, Swiss Hours)
   = 39 dealers. Avocado Vintage removed later in the day = 38.
5. **Phase D Phillips archive scrape** — 42 Heuer lots from
   Crosthwaite & Gavin Geneva 2017 land in Listings > All sold via
   a new manual_archive_scraper pipeline.
6. **Auction-lot coverage step-change** — Phillips cap 60→1000
   (CH080226 / HK080226 finally scraping in full); Antiquorum
   switched from broken `catalog.antiquorum.swiss` paginator to
   `live.antiquorum.swiss/...?limit=1000` (single 5MB fetch, 540 lots
   in 2s).
7. **Sotheby's lot images** finally working via per-lot og:image
   fetch.
8. **`merge.py lastMeaningfulPrice`** — backend-durable version of
   the inline priceHistory walk Card had been doing.
9. **Brand cleanup pass** — consolidations, exclusions (Corum,
   Scatola Del Tempo, Royal Oak Offshore), force-Other pooling,
   suppress-at-sold list, bracelet filter.
10. **Roadmap section-by-section restructure** — the headline
    structural work. Old Epic 3 ("Lovable features", a grab-bag)
    split into four; Mac mini folded into Epic 0; Site analytics
    renumbered → Epic 8. Reflective-tool framing demoted from
    Strategic-bets primary lens to one-of-several. New Jobs-to-be-done
    chain at the top as the priority-ordering principle.

Dealer count: **38** (was 36 at start of day; LR + S.Song + Swiss
Hours added in #41; Avocado removed in #49).

## What shipped (in order)

- **PR #38** — Watchlist sub-tab UX (count fix, inline +buttons,
  bigger heart on mobile 1-col).
- **PR #39** — Cool Stuff rename + Links page + dead-code sweep +
  SEO basics.
- **PR #40** — Test fixes for #38 + #39 (mock fixture missed
  `displayedCount`, `DesktopShell.test.jsx` still asserted "Reference").
- **PR #41** — Cool Stuff v2 (shared SubTabIntro, accordion Links,
  3 new dealers).
- **PR #42** — Phase D Phillips CH080317 archive scrape.
- **PR #43** — Mark's docs catch-up (PRs #37–#41).
- **PR #44** — Docs catch-up extension (Phase D #42 in handover +
  roadmap).
- **PR #45** — Auction brand detection + sub-tab-scoped chips +
  Major Auctions friendly label.
- **PR #46** — Sotheby's lot images via per-lot og:image fetch.
- **PR #47** — merge.py emits `lastMeaningfulPrice`; frontend uses
  it (with priceHistory-walk fallback for older state).
- **PR #48** — Auction lot scrape uncap. Phillips 60→1000;
  Antiquorum switched to live.antiquorum.swiss?limit=1000.
- **PR #49** — Roadmap review + Avocado Vintage removed (39→38);
  Stop-rule threshold raised 30→50; "Listing event capture" →
  "Site analytics" with dealer + user halves; Phase D admin form
  dropped from roadmap.
- **PR #50** — Brand cleanup pass (consolidations, Corum + Scatola
  Del Tempo excluded, force-Other pooling, suppress-at-sold list,
  bracelet filter).
- **PR #51** — Roadmap "Pending review" prep block + CLAUDE.md
  scraper-helper unlock.
- **PR #52** — Quick edits: drop Saved-auctions intro banner,
  expansion-panel padding 12→20, Royal Oak Offshore exclusion,
  agent suggestions detailed in roadmap.
- **PR #53** — Roadmap section-by-section restructure. **Headline
  doc PR.** Re-numbering: Epic 3 → split into 3, 4, 6, 7; Epic 4 →
  Epic 8; Epic 6 (Mac mini) → folded into Epic 0; Epic 5 stays.
  Reflective-tool framing demoted; Jobs-to-be-done chain added.

## Architecture notes added this session

- **Phillips `sold_price` was the LOW estimate, not the hammer.**
  The existing comment had flagged "provisional until validated
  against a sold lot"; PR #42 was that validation. JSON-LD `price`
  is always the low estimate; rendered "Sold For" panel carries
  the real hammer. Affects every sold lot — fix benefits the daily
  comprehensive sweep too. Graduated to CLAUDE.md.
- **`is_excluded_title` matched "o'clock"** (positional reference
  inside watch titles) and silently dropped 9/42 lots in the
  CH080317 archive run. Fix: strip `\bo['']clock\b` before running
  the exclusion regex. Graduated to CLAUDE.md.
- **Antiquorum live-page approach.** `catalog.antiquorum.swiss`'s
  `?page=N` pagination is vendor-broken (301-redirects to /lots),
  so the catalog scraper had only ever seen the first 20 of 600+
  lots per sale. `live.antiquorum.swiss/auctions/<id>/...?limit=1000`
  embeds the entire lot set in a single `viewVars.lots.result_page`
  blob — one fetch, no pagination. Server caps `?limit=1000` at the
  actual lot count, future-proof. Graduated to CLAUDE.md.
- **Sotheby's lot images via og:image.** algoliaJson hits don't
  carry the brightspotcdn URL (hash isn't derivable). One per-lot
  fetch + `og:image` regex; brightspotcdn body-scan fallback for
  the small minority without a social preview. ~+2.4 min per cron.
- **`lastMeaningfulPrice` as a durable field on enriched records.**
  ~40% of sold dealer items end up with a trailing 0 in priceHistory
  (dealer flips to "SOLD"/"Price on request" before disappearing).
  merge.py now writes the last non-zero entry as a top-level field;
  frontend prefers it, falls back to inline priceHistory walk.
  Graduated to CLAUDE.md.
- **Brand-counts scoped to active sub-tab.** Pre-2026-05-05
  `brandCounts` always read live dealer items, so on Listings >
  Live auctions you could tap a brand chip and find no matches.
  Now switches pool by sub-tab. Graduated to CLAUDE.md.
- **Frontend brand pooling pattern: `FORCE_OTHER_BRANDS` +
  `SUPPRESS_AT_SOLD_BRANDS`.** Frontend-only constants in
  `src/utils.js`. Data layer keeps the original brand label
  (no merge.py rewrite); UI does the pooling and the suppression.
  Reverting either is a one-line edit. Graduated to CLAUDE.md.
- **Standalone bracelet filter.** Pattern: title starts with
  `<digits>mm` AND contains "bracelet". 58 hits, 0 false positives.
  Lives next to a generic `EXCLUDED_TITLE_PATTERNS` list in
  merge.py — adding the next title-level exclusion (Royal Oak
  Offshore was the second) is a one-line append.
- **Shared scraper helper library is now allowed.** CLAUDE.md
  Scraper conventions updated. Opt-in helpers in `scraper_lib.py`
  (TBD); per-dealer files keep their quirks. Driver-style collapse
  (one config-driven script for all Shopify dealers) still guarded
  against — Bulang & Sons collection-scoping etc. is exactly the
  divergence that argues for keeping per-dealer files.

## Open PRs

**None.** Everything from today is merged. Stale branches
auto-cleaned post-merge.

## Open user-reported issues — all resolved this session

- ✓ Watchlist count badge wrong with no filters → `displayedCount`
  prop (#38).
- ✓ Mobile sub-tab strip horizontally scrolling → +buttons moved
  inline (#38).
- ✓ Heart icon too small on mobile 1-col → tap-target scales with
  card density (#38).
- ✓ Lists section needed instructions banner with embedded +
  button → searches sub-tab got the same shape (#38).
- ✓ "Reference" tab name → "Cool Stuff" (#39).
- ✓ Sotheby's Cartier lots filing under "Other" → Sotheby's
  emits `maker`; new `detectAuctionLotBrand` walks every signal
  (#45).
- ✓ Brand chip rail showing brands not in the current sub-tab →
  `brandCounts` now scoped per sub-tab (#45).
- ✓ Phillips sales like CH080226 only scraping 60 of 227 lots →
  cap raised 60 → 1000 (#48).
- ✓ Antiquorum sales only ever showing first 20 of 600+ lots →
  switched to live.antiquorum.swiss?limit=1000 (#48).
- ✓ Sotheby's lots had no thumbnails → per-lot og:image fetch
  (#46).
- ✓ Sold dealer items showing "$0" / "Price on request" when they
  had a real ask in history → `lastMeaningfulPrice` field (#47).
- ✓ Royal Oak Offshore in feed despite Mark not wanting it → new
  `EXCLUDED_TITLE_PATTERNS` list (#52).
- ✓ Filter expansion panel touching the listings section header →
  bottom padding 12 → 20 (#52).
- ✓ Saved auctions sub-tab intro banner cluttered → removed (#52).

## Doc files updated this session

- **CLAUDE.md** — Scraper conventions: shared helpers ARE allowed
  now (was guarded against). New durable conventions added below
  during this handoff.
- **ROADMAP.md** — Two big restructure passes:
  1. PR #49 renamed Listing event capture → Site analytics with
     Dealer + User halves; raised Stop-rule threshold; dropped
     Phase D admin form.
  2. PR #53 — full section-by-section restructure. Epics renumbered;
     "Reflective tool" framing demoted; Jobs-to-be-done chain added;
     Mac mini folded into Epic 0; Pending review block dissolved.
- **README.md** — Dealer count 36 → 39 → 38 across the day.
- **archive/SESSION_HANDOFF_2026-05-04.md** — yesterday's handoff
  archived. This doc replaces it.

## Commits worth knowing for next-me

```
git log origin/main --oneline -20
```

Latest stretch (newest first, with the headline ones):
```
[2026-05-05]
PR #53  Roadmap restructure (epics renumbered)
PR #52  Quick edits — Saved-auctions intro removed, RO Offshore filter
PR #51  Roadmap "Pending review" prep + CLAUDE.md scraper helpers unlocked
PR #50  Brand cleanup pass
PR #49  Avocado removed; site-analytics rename; threshold 30→50
PR #48  Auction lot uncap (Phillips, Antiquorum live page)
PR #47  merge.py lastMeaningfulPrice
PR #46  Sotheby's lot images
PR #45  Auction brand detection + sub-tab-scoped chips
PR #44  Docs catch-up extension
PR #43  Docs catch-up (Mark)
PR #42  Phase D Phillips CH080317 archive
PR #41  Cool Stuff v2 + 3 new dealers
PR #40  Test fixes
PR #39  Cool Stuff rename + Links + dead-code + SEO
PR #38  Watchlist sub-tab UX
```

## Next session

Roadmap is now structurally clean (PR #53). Top of the priority list,
in epic-numbered form:

1. **Site analytics — User stats half (Epic 8).** `listing_events`
   table + RLS + rollup-and-prune cron + admin panels. Half-session
   to a day. Gates the Stop-rule prune (#9 below).
2. **Site analytics — Source stats extensions (Epic 8).** Throughput,
   sales-by-watch-type per dealer/house, listing-quality signals,
   auction-house quality dashboard.
3. **Watch Challenges v1.5 (Epic 6).** `?newchallenge=1` receive
   flow + public read of completed challenges. Half-session.
4. **References as first-class entities (Epic 0).** The remaining
   foundation; gates Epic 5 (encyclopedia + research) and Epic 7
   (recommender quality).
5. **Welcome page + og:image (Epic 0).** SEO basics shipped; this
   is the visitor-facing companion. Half-session.
6. **Strength-of-save model (Epic 3).**
7. **User limits + user-management dashboard (Epic 3 + 8).**
8. **Image cache for List items (Epic 3).**
9. **Source pruning at the 50-dealer threshold (Epic 1).**
10. **Mac mini Phase A (Epic 0).** When Tropical Watch hits a Browse
    AI snag OR ready for Epic 5 generation.

Plus the maintenance-rhythm beat: every 4th-5th session is hygiene
only.

## Open questions left from this session

- **Roadmap drift cadence.** PR #53's restructure was a one-time
  catch-up. The Pending review block at the top of the doc was the
  flag-for-next-session mechanism — worth re-introducing if it
  drifts again, but quarterly review is the catch-everything
  backstop.
- **Personal-learning agent side track.** Mark accepted both
  use cases (brand-watcher, maintenance-assistant) but hasn't
  picked a starting one. Defer to its own session whenever Mark
  wants to start.
- **App.js extraction pass.** Captured in Epic 0 refactor track;
  not urgent. Recommended next-touch when there's a focused refactor
  session.
- **Mark's wife as the seed user-limit-expansion case.** When
  user limits ship (priority #7), her account needs a manual
  expansion path through the user-management dashboard.

## Things to remember when running with this codebase

CLAUDE.md is the durable rules. Skim it once per session. New rules
this session that graduated:
- Brand-counts scope to the active sub-tab; check `displayBrand`
  + `brandCounts` if a chip-rail bug surfaces.
- Frontend brand pooling: `FORCE_OTHER_BRANDS` +
  `SUPPRESS_AT_SOLD_BRANDS` in `src/utils.js`.
- `lastMeaningfulPrice` is the canonical "last non-zero ask" field;
  prefer it over walking priceHistory.
- Phillips `sold_price` extraction uses the rendered "Sold For"
  panel, not the JSON-LD price (which is the low estimate).
- `is_excluded_title` strips "o'clock" before running clock-related
  patterns.
- Antiquorum lot scraping uses `live.antiquorum.swiss?limit=1000`,
  not the broken `catalog.antiquorum.swiss` paginator.
- Standalone bracelet filter pattern is `^<digits>mm.*\bbracelet\b`;
  generic `EXCLUDED_TITLE_PATTERNS` is the home for future title-
  level exclusions.
- Shared scraper helpers are allowed (`scraper_lib.py` opt-in);
  per-dealer files still keep their quirks.
