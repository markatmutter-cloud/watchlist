# Reference Intelligence — strategy

The differentiator for this site, written down so a session-cold reader
(human or model) can pick it up without re-deriving the argument.

> *"Same reference. Omega Seamaster 300 165.024. Very different prices.
> Based on quality and details that are in the descriptions. It's not
> about the watch, it's about THE watch."* — Mark

Two real listings, same reference number `165.024`:

- **Antiquorum, CHF 4,250 sold.** Description: *"A fine, attractive, stainless
  steel, self winding diver's wristwatch."*
- **Bulang & Sons, €31,900.** Multi-paragraph essay covering the British
  Royal Navy commissioning, the Circle-T tritium-lume marker, the Big
  Triangle dial, the 0552 Royal Navy service identifier, the broad
  arrow case-back engraving, the original Zürich Omega card, the
  Caliber 552, the dial signature variants.

Same calibre. Same case. **6× price difference.** The information that
justifies the price gap lives in the description — nowhere else.

That is the entire product. Not "we show you 21 examples of the same
reference;" we explain *why* each one is priced where it is, identify
the variant signals that drive value, and surface the listings whose
combination of signals matches what a given collector responds to.

This document is the strategy for getting there. It's deliberately
opinionated and supersedes earlier framings in `ROADMAP.md` Epic 0 and
Epic 5 (which describe the data layer at a coarser grain; this doc is
the connoisseur-knowledge layer underneath them).

-----

## The stack, end to end

Six layers, built bottom-up. Lower layers are the *substrate*; higher
layers are the *product*.

1. **Scaffolding** — the curated reference index (`docs/watch_references.md`).
   Canonical brand, model line, reference numbers, common nicknames per
   reference. **Status: shipped (PR #327).** Grows iteratively against
   the gap report (`docs/watch_references_gaps.md`).

2. **Knowledge base** — every description, every guide, every condition
   report we can capture, attached to a `reference_id`. Five content
   types (see below). **Status: in progress.** Dealer descriptions are
   ~90% captured (PRs #324, #325, #329). Auction descriptions and
   in-listing reference essays are the next push.

3. **Per-reference variant taxonomy** — for each reference with enough
   corpus, an LLM-extracted structured taxonomy: which features matter
   for *this* model line, what variants exist for each, what collectors
   call each one, rough desirability notes. The gold-standard output
   shape is Eric Wind's Rolex 1675 collector's guide:
   <https://www.windvintage.com/blog/collectors-guide-the-rolex-gmt-master-reference-1675-in-steel>.
   **Status: not started.** Gated on corpus depth.

4. **Per-listing variant tagging** — for each listing, an LLM matches
   its description against the reference's variant taxonomy and emits
   structured tags: `{dial: "MK1 frog foot", bezel: "fuchsia faded",
   case: "unpolished", provenance: ["original Omega card", "broad arrow
   case back"], service_state: "fully serviced 2024", originality: "all
   original parts"}`. **Status: not started.** Gated on (3).

5. **Price-impact model** — with variant tags + sold prices across many
   examples of each reference, fit a per-reference feature-impact model.
   "Broad arrow case back" adds ~€10K to a 165.024 baseline; "polished
   case" subtracts 60%. The model learns connoisseur intuition from data
   instead of being told. **Status: not started.** Gated on (4).

6. **Recommender** — variant tags × user reactions × per-reference
   price-impact model → rank unseen listings with explanations:
   *"This 1675 is mispriced low — fuchsia faded bezel, long-E coronet,
   MK1 dial. You've ❤️ tropical 1675s. Three similar examples sold for
   40% more in the last 6 months."* **Status: not started.** The endgame.

A photo / vision-model layer augments (3)–(6) once the text layer is
mature — most variants are visually identifiable (lume color, dial
printing crispness, bezel fade pattern, hand finishing).

**Mark's admin reading view** is a parallel consumer of layer 2, gated
by `REACT_APP_ADMIN_EMAILS` (same pattern as the existing Site Stats
admin surface). Per-reference reading list rendering the full
captured corpus — dealer descriptions, in-listing Worth Reading,
standalone guides, auction condition reports — verbatim with source
attribution. Personal research surface; not the public encyclopedia
(see Licensing section below).

-----

## Five content types — confirmed sources

The knowledge base draws from five distinct content types. Each was
audited by a per-source agent and has a confirmed scrape path. The
agent reports are the basis of every entry below.

### Type A — In-listing reference essays

Structurally distinct prose sections inside an individual listing,
covering reference-level history + variant taxonomy. *Different
audience* from the standard description (which sells the specific
watch). Three dealers do this well today:

| Dealer | Section name | Length (chars, stripped) | Coverage | Extraction cost |
|---|---|---|---|---|
| **Hairspring** | Worth Reading | 2,150 – 4,800 | 100% | 0 new HTTPs (existing scraper already fetches detail page) |
| **A Collected Man** | Worth Reading | 3,000 – 6,600 | 100% | 0 new HTTPs (in Shopify `body_html`, split on `<!-- SECTION BREAK -->`) |
| **Analog Shift** | Why We Love it | TBD | TBD | +691 HTTPs/cron (needs per-listing detail fetch) |

Hairspring also exposes per-listing **Condition** and **Specifications**
blocks via the same template — four extractable content blocks per
listing, all distinguished by `<h3 class="text_popup-heading">` text.

Negative confirmations (no separable ref-essay section): Phillips Bacs
& Russo, Bulang & Sons, Craft & Tailored, Sheartime, Time + Tide,
Crown & Caliber, Bob's Watches (their "Why We Love This Watch" is
marketing copy, not reference-grade history). Wind Vintage interleaves
ref history into the main description — needs LLM segmentation rather
than CSS extraction.

### Type B — Standalone reference guides

Whole articles dedicated to one reference (or model line). The
densest, most expert-written source of variant taxonomy on the public
web.

| Source | Volume | Cost |
|---|---|---|
| **Wind Vintage blog (Eric Wind)** | ~50 per-ref deep dives out of 367 total posts; avg ~6,900 words / ~42K chars | Free; Squarespace `/blog?format=json`; new file `windvintage_guides_scraper.py` |
| A Collected Man journal (`/blogs/journal/tagged/collectors-guide`) | dozens of long-form guides | Free; Shopify; auxiliary to the listings scraper |
| Hodinkee Reference Points | ~12–15 articles (smaller than expected) | IP-blocked from our scraper; needs real UA + rate limit |
| Millenary Watches `/journal/` | ~30–50 per-ref guides; 123-page paginated index | Free; standard HTML |
| gmtmaster1675.com / explorer1016.com / speedmaster101.com | dedicated single-ref sites (same author, two of them) | Free; small per-site scrapers |
| Monochrome-Watches in-depth | scattered lineage pieces (e.g. Patek perpetual chrono 1518→5270) | Free; lower priority |

Eric Wind's guides also include a **cross-brand variant glossary**
("What is a soleil dial / gilt dial / matte dial / exclamation dial /
chapter ring dial / Rolex coronet"). Perfect seed vocabulary for the
variant taxonomy layer — separate from per-reference content.

### Type C — Auction condition data

| House | What's available | Cost | Status |
|---|---|---|---|
| **Antiquorum** | **Fully structured grading** on every lot: Overall (Exceptional / AAA / AA / A / B), per-component (Case / Dial / Movement: 1–5), 70+ modifier codes, service flags (`*` overhaul recommended, `**` repair required). Published PDF legend. | 0 new HTTPs — already in `viewVars.lots` | not extracted yet |
| **Phillips** | Free-text `Case: … Dial: … Movement: … Bracelet: …` condition prose. Adjective grading ("excellent overall condition"). | 0 new HTTPs — already in lot HTML / Turbo-Stream payload | not extracted yet |
| Sotheby's | Login-gated | skip | — |
| Christie's | Login-gated | skip | — |

Antiquorum's structured grading is **machine-comparable across lots**
— directly useful for the price-impact model. The per-component
modifier codes (Slightly repolished vs Restored vs Original) are
exactly the variant taxonomy this whole strategy is built on.

### Type D — Dealer descriptions

The dealer's per-watch pitch + condition prose. Now ~90% captured
end-to-end (PRs #324, #325, #329 lifted scraper caps and merge.py
truncation). Bulang & Sons, Wind Vintage in-listing, Maunder, Falco,
Craft & Tailored, Somlo, Huntington, Oliver & Clarke, Vintage Watch
Fam, Shuck the Oyster.

Skipped intentionally: Central Watch (boilerplate only), Chronoholic
(+80 HTTPs/cron for so-so content), Tropical Watch (Browse AI robot
reconfig friction not worth the content quality).

### Type E — Auction lot essays

The long-form "Catalogue Essay" published by auction houses for each
lot. Less consistent than dealer descriptions but very high quality
where present.

| House | Status | Path |
|---|---|---|
| Sotheby's | `catalogueNote` + `provenance` + `literature` + `condition` fields sitting in the LotV2 we already fetch. **Not yet extracted.** | 0 new HTTPs |
| Christie's | Long essays on lot detail pages; auction-page payload may carry a short variant. **Investigation pending.** | Cheap detail fetches |
| Phillips | Full essays only on detail pages — WAF-blocks our scraper IP after ~7 requests. **Parked.** Likely unblocked by the Mac-mini Playwright path in the roadmap. | High effort |
| Antiquorum | `truncated_description` field is empty in their auction-page payload; long content (where present) is on detail pages. | Partial via per-lot fetches |

-----

## Storage shape

Two surfaces, fed from the same underlying corpus.

**Per-listing / per-lot fields** (existing files `public/listings.json`
and `public/auction_lots.json`):

```jsonc
{
  // existing fields (price, url, img, brand, …)
  "reference_no":     "1675",
  "reference_id":     "rolex_gmt_master_1675",   // FK into the index, set at merge time
  "model_name":       "GMT-Master",
  "description":      "…",                       // dealer's pitch / per-watch prose
  "worth_reading":    "…",                       // Hairspring / ACM / Analog Shift (Type A)
  "condition_text":   "…",                       // Phillips / Hairspring Condition block
  "condition_overall":"AAA",                     // Antiquorum structured grade
  "condition_case":   {"grade": 3, "modifiers": [7, 9, 12], "service_flag": null},
  "condition_dial":   {"grade": 2, "modifiers": [1, 6],     "service_flag": null},
  "condition_movement":{"grade": 3, "modifiers": [],         "service_flag": "overhaul"},
  "lot_essay":        "…",                       // Sotheby's catalogueNote etc. (Type E)
  "provenance":       "…",
  "literature":       "…"
}
```

**Reference-guide corpus** (new file
`public/reference_guides.json` — separate from the per-listing feed so
the main file stays lean):

```jsonc
{
  "rolex_gmt_master_1675": [
    {
      "source": "windvintage_blog",
      "source_type": "standalone_guide",            // Type B
      "url": "https://www.windvintage.com/blog/collectors-guide-the-rolex-gmt-master-reference-1675-in-steel",
      "title": "Collector's Guide: the Rolex GMT-Master Reference 1675 in Steel",
      "author": "Eric Wind",
      "published_at": "2024-04-12",
      "word_count": 6900,
      "body_text": "…"
    },
    {
      "source": "hodinkee_reference_points",
      "source_type": "standalone_guide",
      "url": "https://www.hodinkee.com/articles/rolex-gmt-master-reference-points",
      "title": "Reference Points: Understanding the Rolex GMT-Master",
      "body_text": "…"
    },
    {
      "source": "gmtmaster1675_com",
      "source_type": "standalone_guide",
      "url": "https://gmtmaster1675.com/",
      "body_text": "…"   // multi-page; one record per page or one record concatenated
    }
  ]
}
```

`reference_guides.json` is consumed by:

- **Mark's admin reading view** (gated AdminTab surface) — renders the
  full corpus per reference for personal research. Verbatim,
  source-attributed.
- **The future public per-reference UI page** (Slice 3 in roadmap
  Epic 0) — renders synthesized output only, cited.
- **The LLM synthesizer** for encyclopedia entries (Slice 4 / Epic 5).
  Reads the full corpus; emits factual extraction.
- **The variant-taxonomy + price-impact pipeline** (layers 3–5 of the
  stack). Reads the full corpus internally.

Not fetched on the main listings feed, so its size is unconstrained
by the page-load budget.

`source_type` is the discriminator the synthesizer reads to weight
content: `in_listing_essay`, `standalone_guide`, `condition_grade`,
`dealer_description`, `auction_essay`, `variant_glossary`.

-----

## Licensing posture — display layer, not storage layer

Important enough to write down explicitly.

All external sources have permissive `robots.txt` for crawling. **None
grant derivative-work rights.** Copyright stays with each publisher.

**The constraint applies at the display layer, not the storage layer.**
The corpus is captured in full once. Two distinct consumers read from
it under different rules.

### Consumer 1 — Mark (admin), personal research

Mark consumes the full corpus directly for his own knowledge-building.
Full prose, full essays, full collector guides, verbatim,
source-attributed, organised per reference. Same posture that lets a
collector keep a Pocket library, an Instapaper queue, a folder of
saved dealer pages.

Surface: gated AdminTab reading view (already gated by
`REACT_APP_ADMIN_EMAILS` — same pattern as the existing Site Stats
admin surface). Per-reference reading list aggregating every source
on a given ref: dealer description, in-listing Worth Reading,
standalone guides (Wind Vintage, Hodinkee, gmtmaster1675.com),
auction condition reports.

### Consumer 2 — Public site users

Synthesized output only — factual extraction (production years, dial
variants, calibres, variant→price impact). **Never near-verbatim
paraphrases.** Always source-cited.

- Cite sources per reference entry. Every public reference page that
  displays synthesized content links to the sources it was distilled
  from.
- Counsel review before public encyclopedia ship. Fair-use-adjacent
  but legally non-trivial.

### Crawling conduct (both consumers, both surfaces)

- Honor robots.txt, rate-limit, real user-agent. Hodinkee currently
  blocks our scraper IP — production fetches need care.
- Storage capture is internal-only at rest; only the display surfaces
  are externally visible.

### Implication for Session A onward

Scrape full-text aggressively into `public/reference_guides.json` and
inline fields on listings/lots. **No truncation, no paraphrasing at
storage time.** Display-layer transforms (synthesizer, summarizer,
extractor) run on top of the full corpus when shipping to the public
surface; admin reading view consumes the same raw data directly.

-----

## Sequenced plan

Three coding sessions to get the data + condition layers complete.
Variant taxonomy / per-listing tagging / price model / recommender are
multi-session beyond these and aren't scoped here.

### Session A — corpus capture + structured condition

One coherent PR; all zero-new-HTTP or one-time-fetch.

1. **Hairspring** — extract `worth_reading`, `condition_text`,
   `specifications` as separate fields. Lift the 400-char description
   cap. Anchor on `<h3 class="text_popup-heading">` text.
2. **Antiquorum structured grading** — parse `viewVars.lots[*]` for
   overall grade + per-component (grade + modifiers + service flag).
   Emit as typed fields on auction lots.
3. **Phillips condition prose** — extract `condition_text` from the
   existing payload.
4. **Wind Vintage blog scraper** — new file
   `windvintage_guides_scraper.py`. Squarespace `/blog?format=json`
   pagination; filter to ~50 deep-dive posts + the variant glossary
   series; persist to `public/reference_guides.json` keyed by
   `reference_id` (resolved via the index matcher).

### Session B — premium-dealer adds

5. **A Collected Man** scraper (new dealer file). Listings + Worth
   Reading splits via `<!-- SECTION BREAK -->`.
6. **Standalone reference sites** — small per-site scrapers for
   gmtmaster1675.com, explorer1016.com, speedmaster101.com.

### Session C — editorial corpus (carries licensing care)

7. **Hodinkee Reference Points** — real UA, rate limit, careful headers.
8. **Millenary Watches journal** paginator.
9. **A Collected Man journal** extension (separate from their dealer
   listings).
10. **Analog Shift "Why We Love it"** — cost/benefit decision (+691
    HTTPs/cron). Defer unless content quality clears the bar.
11. **Sotheby's `catalogueNote` / `provenance` / `literature`** — pull
    from LotV2 we already fetch.

-----

## Open questions

- **Admin reading view shape.** Once the corpus has accumulated a few
  weeks of content, what's the right UI for Mark's personal
  consumption? Options: per-reference reading list (chronological
  newest-first within a ref), a "saved to read" queue (Pocket-style
  bookmarking on top of the corpus), full-text search across all
  prose, export-to-Markdown/ePub for offline reading on iPad. Probably
  start with the simplest (per-reference list under AdminTab) and let
  usage reveal what's missing.
- **LLM budget.** Variant taxonomy extraction + per-listing tagging
  + condition narrative parsing all want an LLM. Cloud (cheap, fast,
  ongoing cost) vs Mac-mini Phase A (one-time hardware, free
  inference). The Mac-mini path is already in the roadmap — this is the
  workload that justifies it.
- **Photo signals.** A vision model on cached listing images would
  catch the variants prose misses (lume color shade, dial printing
  crispness, bezel fade pattern). Not in scope this strategy doc but
  the architecture should leave room.
- **Login-gated sources.** Sotheby's and Christie's condition reports
  are real value behind auth. Manual research field? Browser-based
  scrape with persisted session? Out of scope for now.
- **Corpus refresh cadence.** Standalone guides change rarely; in-listing
  essays come and go with the listings. Different scrape cadences per
  content type — TBD.
- **Variant taxonomy benchmark.** Eric Wind's 1675 guide is the
  gold-standard output. The LLM extraction is "good enough" when its
  synthesized 1675 taxonomy reads recognisably like Eric's guide.
  Concrete benchmark, not a vibe check.

-----

## What this strategy supersedes / amends

- **`ROADMAP.md` Epic 0** said the foundation was "a normalised
  references table + detection in three layers." That's still right
  but undersold — references are *the scaffolding*, not the product.
  The product is the variant-taxonomy + price-impact layer that sits on
  top.
- **`ROADMAP.md` Epic 5** ("Reference research + learning") is the
  user-visible surface for this strategy. Slice 3 (per-reference page)
  and Slice 4 (encyclopedia) consume layers 2–5 of the stack above.
- Earlier framings of "extract `reference_no` from titles" are
  necessary but not sufficient. The reference number is the join key;
  the content attached to that join key is what makes the product
  unique.

-----

## Provenance of this document

Written 2026-05-16 / 2026-05-17 across one extended chat session
covering:

1. Detection survey (`reference_survey.py`) — measured baseline
   regex-extraction hit rate at 53%.
2. Per-dealer + per-auction-house audit agents — identified the leaks
   and confirmed content types.
3. Six PRs landing the Phase 1A–1F data-layer fixes (PRs #324–#329).
4. The Bulang vs. Antiquorum 165.024 example crystallising the value
   gap.
5. Mark's pointers to Eric Wind's 1675 guide, Hairspring's "Worth
   Reading" sections, A Collected Man's editorial template,
   gmtmaster1675.com, Hodinkee Reference Points, Millenary Watches.
6. Six follow-up audit agents confirming the scrape paths for the
   reference-guide corpus.

Agent reports are not committed (transient artifacts) but the
findings they produced are baked into the source catalog above.
