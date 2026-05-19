# Watchlist — Session Handoff (2026-05-18 → 2026-05-19)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap, see
[ROADMAP.md](ROADMAP.md). Durable rules graduate to CLAUDE.md;
durable direction graduates to ROADMAP.md. This doc is the in-flight
snapshot.

For the strategic shape of the editorial corpus + recommender work,
see [docs/RECOMMENDER_STRATEGY.md](docs/RECOMMENDER_STRATEGY.md) —
wired into the durable doc index 2026-05-19 (#348).

## TL;DR

**The editorial corpus went from 2 sources to 8 sources in one
extended session. Plus a new Editorial sub-tab on Collecting, a
re-used `editorial_corpus_io.py` body-split persistence pattern,
a dual-track Hodinkee Shop scraper that feeds the Sold archive AND
the corpus, and 110+ curated Links additions.** Nineteen PRs landed
(#346–#364, missing #350-merge → see corrections below).

Three arcs:

1. **Editorial corpus stand-up (PRs #347, #352, #353, #357, #359,
   #362, #364).** Eight sources, ~8,556 articles, ~4.3 M words of
   collector-grade prose. Each new source ships as its own
   ~150-line scraper following the established template, with
   `editorial_corpus_io.write_split()` handling the meta + bodies
   persistence so the surface lazy-loads body text only when the
   user searches.

2. **Editorial sub-tab UI (PRs #349, #350, #351, #358).** Built
   under Collecting (internal `tab="references"`, UI label
   "Collecting") with a Listings-pattern filter row — sort pill +
   inline-expanding Source / Brand chip clusters + free-text search.
   Tinted band (`--brand-tint-10`) anchors the strip as a themed
   surface inside Collecting, not a listings feed. ArticleCard is
   view-settings-aware: respects `cols` 3-7 + `auto`, density scales
   so a 7-col packed grid still reads cleanly.

3. **Links page deep clusters (PRs #354, #356, #361, #363).**
   Promoted 8 single-bookmark entries (Enicar 101, TudorSub,
   Heuer Camaro, Heuerchrono, Heuer Price Guide, OnTheDash master,
   gmtmaster1675, omegaseamaster300, omegaploprof, explorer1016)
   into deep per-variant / per-anchor clusters. The Enicar entry
   alone split into six model-line sections (Sherpa Graph / Aqua
   Graph / Jet Graph / Super Graph / Dive Watches + Reference &
   Provenance). Total: **~200 new curated Links across ~12
   reference sections**, plus a new "Price Guides" topic section.

## Corpus state at handoff

| Source | Articles | Words | Where | Cron |
|---|---|---|---|---|
| Hairspring Finds | 1,613 | ~500K | `public/hairspring_finds.json` + bodies | listings (3×/day) — dual-track |
| Hodinkee Bring a Loupe | 251 | 367K | `public/bring_a_loupe.json` + bodies | editorial (Sun) |
| Rolex Magazine | 3,810 | 1,303K | `public/rolex_magazine.json` + bodies | editorial (Sun) |
| On The Dash | 205 | 369K | `public/onthedash.json` + bodies | editorial (Sun) |
| Bulang & Sons Watch Talks | 161 | 139K | `public/bulang_watch_talks.json` + bodies | editorial (Sun) |
| Hodinkee Shop | 2,346 | 1,039K | `public/hodinkee_shop.json` + bodies | editorial (Sun) — **dual-track** |
| Hodinkee Reference Points | 10 | 50K | `public/hodinkee_reference_points.json` + bodies | editorial (Sun) |
| A Collected Man Journal | 160 | 533K | `public/acollectedman_journal.json` + bodies | editorial (Sun) — **parser gap, see followups** |
| **Total** | **8,556** | **~4.3M** | | |

Total committed JSON: **~30 MB across all editorial sources** (split:
~7 MB meta loaded eagerly + ~23 MB bodies lazy-loaded on first
search keystroke).

## PRs shipped this session

| PR | Title | Status |
|---|---|---|
| #346 | Add Vision Vintage Watches dealer (Wix, GBP) | merged |
| #347 | Add Hodinkee Bring a Loupe scraper + initial 251-article corpus | merged |
| #348 | Wire RECOMMENDER_STRATEGY.md into ROADMAP + CLAUDE doc index | merged |
| #349 | Add Editorial sub-tab under Collecting (step 4: v0 surface) | merged (later moved by #350) |
| #350 | Move Editorial to Collecting tab + restructure with sub-tabs | merged |
| #351 | Editorial: Listings-style filter row + drop SubTabIntro | merged |
| #352 | Add Rolex Magazine scraper + 3,810-post corpus | merged |
| #353 | Split editorial corpus into metadata + lazy bodies files | merged |
| #354 | Links: Enicar + Heuer reference sites + Price Guides section | merged |
| #355 | eBay searches: add Omega 145.016 | merged |
| #356 | Links: expand all four sites + split Enicar into model-line clusters | merged |
| #357 | Add On The Dash scraper + 205-post corpus | merged |
| #358 | Drop SubTabIntro blurb from Links sub-tab | merged |
| #359 | Add Bulang & Sons Watch Talks scraper + 161-article corpus | merged |
| #360 | Fix: Hairspring Finds Sold-archive cards lost desc after body split | merged |
| #361 | Links: TudorSub deep cluster + OnTheDash master-reference + 4 hubs | merged |
| #362 | Add Hodinkee Shop + Reference Points scrapers | merged |
| #363 | Links bundle: 4 single-reference sites promoted to deep clusters | open |
| #364 | Add A Collected Man Journal scraper + 160-article corpus | open |

**19 PRs landed, 2 open at handoff** (#363 + #364). Both clean, no
controversial scope.

## Architectural decisions worth keeping in mind

### Body-text split via `editorial_corpus_io.py`

`public/<source>.json` (meta record + ~240-char excerpt) is loaded
eagerly when the Editorial sub-tab opens; `public/<source>_bodies.json`
(URL → body_text map) is **lazy-loaded on the first search
keystroke**. Cut initial Editorial-tab page weight from 18.7 MB to
6.2 MB at the point of the split (#353) before adding any new
sources. With 8 sources today, eager fetch is still ~7 MB; lazy
bodies ~23 MB.

Future editorial scrapers must:
- Import from `editorial_corpus_io`: `load_existing()`, `write_split()`,
  `derive_bodies_path()`.
- Use them at the load/save boundaries — don't reach for
  `json.load` / `json.dump` on corpus files directly. The split
  contract handles excerpt computation + bodies-only-when-non-empty
  serialization.
- Add the new `*.json` + `*_bodies.json` paths to the `git add` line
  in `scrape-editorial-corpus.yml`.

### Dual-track scrapers (corpus + Sold archive)

Hairspring Finds + Hodinkee Shop feed BOTH the editorial corpus AND
project into `App.js`'s Sold-archive view. Pattern:
- Scraper writes the standard editorial-corpus JSON shape
- App.js adds a useState for the source's JSON
- App.js adds a useMemo (`hairspringFindsItems`, `hodinkeeShopItems`)
  that projects records to listings-shape with `sold:true`
- That memo joins `mainFeedItems` alongside `items` + `auctionLotItems`

Bulang Watch Talks deliberately does NOT feed Sold archive — the
editorial blog has no per-article price metafields. Same likely
applies to most pure-editorial sources. Only emit the projection
when the records carry usable price data.

### Editorial UI under Collecting (internal `tab="references"`)

The UI labels the tab "Collecting" — the internal value is `"references"`
(legacy, naming divergence documented in CLAUDE.md). The Editorial
sub-tab lives in `ReferencesTab.js` alongside Size Comparison + Links.
Editorial is the default sub-tab when entering Collecting (matches
"first sub-tab on cross-tab navigation" rule).

Filter row mirrors Listings:
- Date sort pill (cycles desc ↔ asc)
- Source pill (inline-expansion below the strip)
- Brand pill (inline-expansion below the strip with +N more expander)
- × Clear all when any filter fires
- Search input above the strip (Listings uses global top-bar; Editorial
  needs its own field for body-text matching)
- Tinted band (`--brand-tint-10` strip + search row, `--brand-tint-08`
  expansion panels) anchors the surface as "in Collecting", not Listings

ArticleCard density scales:
- cols ≥4 (compact): smaller padding + fonts, 6px radius
- cols ≥5 (dense): excerpt cropped to 2 lines / 140 chars
- cols ≥6 (veryDense): excerpt dropped, image switches 16:10 → 1:1
- cols ≥7: author + brand chip dropped, maximally compact

### Multi-template body wrappers per source

Different sites use different body wrappers:
- Hodinkee: `<div class="body-copy ...">` (multiple regions per article)
- Hairspring Finds: `<div class="rte article_content-html">`
- Hairspring Journal (queued): `<div class="rte">` plain
- Bulang Watch Talks: `<div class="article__wrapper container--sm">` (single wrapper, walk inner `<p>` etc.)
- Rolex Magazine: Blogger feeds API — `content.$t` directly, no wrapper
- On The Dash: WordPress REST API — `content.rendered` directly
- Hodinkee Shop: Shopify products.json — `body_html` directly (plus Fine Print regex extraction)
- A Collected Man: **TWO templates mixed** — `text-block__content body-1` (older) + `text-block-v2__content` (newer). And a **third template still unidentified** (see followups).

Pattern: agent-driven feasibility report first (especially body wrapper
class), then build. The "Quick test" exploration before writing the
scraper is now standard.

## Known followups for next session

### High priority

| Item | Notes |
|---|---|
| **A Collected Man parser gap** | 161 of 321 enumerated URLs still fail body extraction. Discovery via sitemap works correctly. A third body template needs identification — probably older 2017–2018 articles or embedded-widget articles. Quick parser iteration should recover most. Possibly need a balanced-stack `<div>` parser instead of single regex pass. |
| **Step 5 indexer (`editorial_index.py`)** | The recommender enrichment script — writes `tags / audience / references_mentioned / dates_referenced` across all corpus JSONs. Unlocks: (a) Reference-page Editorial coverage section ("articles that mention Omega Railmaster"); (b) Listing-card "Explore paths" annotation; (c) the recommender layer. **This is the next big build.** Strategy doc covers shape in detail: docs/RECOMMENDER_STRATEGY.md + the planning doc Mark pasted into 2026-05-18 chat (architecture writeup with examples). |
| **Strictly Vintage scraper** | Feasibility agent already reported: Squarespace, ~120 articles, ~180-220K words, Charlie Dunne single-author. Closest template: `bring_a_loupe_scraper.py` (sitemap-based). Date from a second `?format=json-pretty` fetch per article (epoch ms in `seoData.seoImage.publishOn`). Body wrapper: `sqs-html-content` inside `<article class="sections">`. ~2 min scrape. **Not yet built.** |
| **Speedmaster101 scraper** | Feasibility agent already reported: WordPress, 85 blog posts at `/blog/*` with standard hentry meta. ~45 sec scrape. Template fit: closest to Hairspring Finds / Rolex Magazine (`.entry-content.article-content` + `meta[property="article:published_time"]`). Also has ~15 Elementor reference pages that warrant a Links promotion (separate PR). **Not yet built.** |

### Medium priority

| Item | Notes |
|---|---|
| Hairspring Journal scraper | 10 articles at `/blogs/journal`. Same Shopify shape as Finds, one selector tweak (`rte` plain instead of `rte article_content-html`). Trivial. |
| Wind Vintage `/press` extension | 696 entries on Squarespace. Agent's recommendation: extend `windvintage_guides_scraper.py` with a second pass over `/press?format=json`, emit sibling `windvintage_press.json` (separate from the existing guides file). |
| WatchFID Journal scraper | WordPress REST at `/wp-json/wp/v2/posts`. Agent confirmed clean shape during earlier evaluation. |
| Heuer Price Guide editorial blog scraper | 62 blog posts on Duda CMS. Distinct from the price-guide tables (which are already in the Price Guides Links section). |
| Reference-page Editorial coverage section | One-line filter on `references_mentioned` (Step 5 output). Surfaces on existing per-reference pages. |
| Listing-card "Explore paths" annotation | Composite of editorial coverage + Phase 5 curated relationships (anti_magnetic_50s, military_issued_divers, etc.). |

### Low priority / parked

| Item | Notes |
|---|---|
| Speedmaster101 Elementor reference pages | ~15 deep URLs (per-ref catalogue pages) for the existing Heuer-style Links treatment. Separate from the Speedmaster101 scraper PR. |
| Lift the 1,500-char description cap | Mark flagged a concern: hearts cache full snapshot, but `merge.py` already truncated `desc` to 1,500 chars before the snapshot fires. Options: lift the cap globally (~15-25% bigger listings.json), or hearted-only full-prose stash (more code, tighter scope). Not yet built. |
| Phase 4 curated family clusters | `anti_magnetic_50s` / `military_issued_divers` / `racing_chronos_60s` / etc. in `docs/watch_references.md`. Editor-curated. Required for the listing-card Explore paths annotation to feel real. |

## Repo / corpus size status (auditable)

Per the size audit Mark asked about mid-session:

- `public/` total: ~37 MB before this session → ~57 MB after (added ~20 MB across 6 new editorial sources, split into eager-load meta + lazy-load bodies)
- `.git/` history: ~80 MB → ~95 MB (sorted-by-URL JSON commits diff small, but the seed scrapes are large)
- **Initial Editorial-tab page weight: ~7 MB eager + lazy ~23 MB on search.** The body split was the load-bearing decision that made the corpus headroom unlimited.

## PR hygiene incidents this session

Twice we hit the CLAUDE.md "Don't push followup commits to an
already-open PR" gotcha:
- **PR #350 / #354** — second commit on a still-open branch got
  orphaned when the squash-merge took only the head ref. Reshipped
  via #354's fixup and (later) #356's re-ship of the orphan.
- Mark caught both; lesson reaffirmed: every new logical change →
  its own branch + its own PR, even mid-iteration on an open PR. If
  you're tempted to push a follow-up commit because the PR isn't
  merged yet, just open a fresh branch off the same parent and let
  the two PRs stack on review.

## Bottom line

The editorial corpus is **production**, ~8,556 articles strong, with
clean schema + lazy-loaded bodies + a working filter UI. Step 5
(the indexer) is the next build, and it's the unlock for everything
the strategy doc lays out — Reference page editorial coverage, the
listing-card Explore paths annotation, and eventually the recommender
itself.

The 161 missed ACM articles are the only known active gap; everything
else is queued scope, not failure.
