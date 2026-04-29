# Watchlist Roadmap

Last updated: 2026-04-28
Living document. Updated as priorities shift.

For project context and architecture, see [README.md](README.md). For
working conventions, see [CLAUDE.md](CLAUDE.md).

## How to use this doc

This is the strategic doc for Watchlist. Architecture and conventions live in
CLAUDE.md; current status of in-flight work lives in handoff docs. This doc is
direction, not state.

### For me (Mark)

- Skim the priority order before starting a session. The order changes; the
  epics rarely do.
- When tempted to add scope mid-session, check the "explicitly NOT" section
  before saying yes.
- Update this doc when an epic ships, when a priority changes, or when a "no"
  becomes a "yes."

### For Claude Code

- Read this doc at the start of any new session, after CLAUDE.md and any
  active handoff doc.
- Don't propose work outside this roadmap without flagging it as out-of-scope.
- When asked "what's next?", default to the priority order in this doc.
- When the user wavers on priorities mid-session, point them back here rather
  than just complying. Discipline is part of the value.
- When suggesting work, name the epic it lives under. ("This is Epic 3 work.")
- When work is finished, suggest updating this doc to reflect the change.

## North star

Watchlist is a personal vintage-watch tool first, a public site second. Built
for me to discover, track, and understand vintage watches across the dealer
and auction market. Public access is a secondary benefit, not the primary
purpose.

The long-term value is the accumulated cross-source data and the analytics
and learning experiences on top of it. Listings are the current surface;
discovery, learning, and personal-collection-as-play are the next chapters.

Watchlist is not trying to be Watchcharts. Don't compete on historical
price-per-reference; build what they don't.

## Constraints

- Solo non-technical builder, co-authoring with Claude.
- Budget: under $20/month for hosted services.
- Free-tier-first: Vercel, Supabase, GitHub Actions. Mac mini at home as a
  later-phase capability for jobs that don't fit free tiers (Playwright,
  embeddings, reference-guide generation).
- Don't telegraph commercial intent publicly. Admin/analytics features stay
  hidden from regular users to avoid pressure from dealers and auction houses.
- References will be 70-80% accurate via parsing, with LLM fallback for the
  long tail and manual curation for the unparseable. Don't let perfect be
  the enemy of good.

## Epic 0: Foundations

Cross-cutting infrastructure. Several later epics depend on this.

- **References as first-class entities.** Normalized references table in
  Supabase (or wherever it ends up). Each reference has brand, model,
  era/years, category. Listings, auction lots, and curated content link
  to references. Detection via per-source structured fields, regex on
  title/description, and LLM fallback for the long tail. Manual curation
  for what slips through.
- **Verification script.** Daily check on each source: count listings vs.
  rolling baseline, flag scraper breakage (count to zero, count drop >70%,
  HTTP errors, parse failures). Email or status banner.
- **Source quality dashboard (admin only).** Per-source: total listings,
  hearted-by-me count, scraper health, days since last new listing. Drives
  the "which sources earn their keep" decision.
- **Maintenance rhythm.** Every 4th-5th session is hygiene only: bug fixes,
  dependency updates, source pruning. No new features.

## Epic 1: Sources

Target end state: ~30 dealers + 6 auction houses, all earning their keep.
Currently at 26 dealers + 6 auction houses.

- **Active candidates** (evaluated, not all guaranteed):

  | Candidate | Status |
  |---|---|
  | Vintage Watch Collective | not standard Shopify (400 on `/products.json`); needs HTML scrape or different platform |
  | Wrist Icons | WordPress; `/wp-json/wc/store/v1/products` returned 301 — follow redirect to confirm WooCommerce |
  | Vision Vintage Watches | Wix (not Squarespace despite the URL trick); needs custom HTML parsing |
  | Vintage Heuer | WordPress; would need a Shuck-style detail-page walker |
  | Specific pushers.io dealers | reuse the Moonphase pattern (~30 lines per dealer) |

- **Auction houses still to add:** Heritage. DataDome-blocked at the
  TLS/browser level — `requests` won't get past it. Three options when
  it's worth pursuing:
  - Browse AI robot (extra paid credits)
  - Mac mini at home running headed Playwright (Epic 6 Phase A)
  - Manual entry via `data/manual_auctions.csv`

- **Lot tracking parked for** Phillips (opaque IDs from JS-rendered
  catalog), Bonhams (Cloudflare), Monaco Legend (SPA, no server-rendered
  lot links), Heritage (DataDome). Same three escape hatches as above.

- **Stop rule.** At ~30 dealers, audit and prune to 25. Don't add a source
  unless it brings inventory not already covered or unique to a reference
  category I care about.

## Epic 2: Auction history

Reference-led capture of past auction results. Not "every auction forever"
but "what has come up for this reference, when, and what did it sell for."

- **Open houses (Antiquorum, Phillips, Bonhams):** scrape realized prices
  where publicly available.
- **Gated houses (Christie's, Sotheby's):** skip realized prices behind login
  walls; capture publicly visible lot details, estimates, images.
- **Manual entry** for important results that aren't auto-captured. Admin form,
  paste URL + price.
- **Reference-led search UI.** "Show me every time the AP 5548BA has been to
  auction" with prices, dates, photos, links.
- **Data shape:** auctions are events that happen to references, not the
  primary unit. Reference-first, auction-second.

## Epic 3: Lovable features (organized around discovery and play)

The features that make Watchlist tell me things, not just show me things.

### eBay integration (in design, 2026-04-28)

Highest-impact single feature on this list. eBay has a stable Browse API
(free tier 5k calls/day, OAuth). **Decisions made 2026-04-28:**

- **Two surfaces, single integration:**
  1. Timed auctions → new **eBay sub-tab inside the Auctions tab**
     (third sub-tab alongside Tracked lots / Calendar). Card format
     matches the existing tracked-lots cards (image, title, current
     bid, time-remaining badge, seller). Data kept in a separate
     table from auction-house tracked lots — different schema, same
     visual language.
  2. Buy-It-Now → mixed into the **Available feed** alongside dealer
     listings, with `source = "eBay"`. Same Card component, same
     filters. Source filter lets users hide eBay if they want
     dealer-only.
- **Targeted searches only.** Users define searches as
  reference/keyword strings (e.g. "Railmaster CK2914"). Country filter
  per search: USA / UK / Europe (where Europe = a multi-country list,
  not a single ISO code — eBay's API takes one country at a time, so
  "Europe" means the search runs N times and merges).
- **Manual single-item URL tracking.** Paste an eBay URL → track that
  specific listing's current price + time-remaining. Same flow as the
  existing Christie's/Sotheby's/Antiquorum tracked-lot URL paste.
- **NOT in scope:** re-listing detection (originally considered;
  dropped 2026-04-28 — too speculative for v1).
- **NOT in scope:** broad keyword searches like "vintage Rolex". Only
  targeted reference-level searches to avoid drowning the curated
  dealer feed.

**Setup required from Mark before code starts:**
1. Create an eBay developer account at developer.ebay.com (free).
2. Create a "Production" keyset to get Client ID + Client Secret.
3. Add both as GitHub Actions secrets: `EBAY_CLIENT_ID` /
   `EBAY_CLIENT_SECRET`. Also add to Vercel env (for the eventual
   per-user search panel).
4. Share one example search URL (e.g. the Railmaster CK2914 search on
   ebay.com filtered to USA) so the first scraper can be validated
   against real data.

**Architecture sketch:**
- `ebay_search_scraper.py` — runs each saved search via Browse API,
  writes one CSV per search to `data/ebay/<search-slug>.csv`.
- `ebay_tracked_scraper.py` — polls each manually tracked URL for
  price + time. Writes to `data/ebay_tracked.csv`.
- Both feed `merge.py` extensions that route Buy-It-Now items into
  `listings.json` and timed-auction items into a new
  `ebay_auctions.json`.
- New file: `ebay_oauth.py` — OAuth client-credentials token refresh
  shared by both scrapers.

### Alerts (email or push) on saved-search matches

Turns Watchlist from a browse tool into a daily-open tool. Built after
eBay so it covers both dealer matches AND eBay matches in the same
notification.

### Three-tier save model
Replaces the current single-heart system:
- **Heart (Favorite):** "I love this watch." High bar. Powers AI taste features.
- **Watch (Track):** "Tell me if the price drops or it sells." Medium bar.
- **Note (Save for later):** "I want to come back to this." Low bar. Folder
  system for research/comparison.

### Reference-level grouping
Three saved 5548BAs collapse into one card with "3 listings, click to expand."
Depends on Epic 0 references.

### Build-a-collection (promoted, near-term after references)

User-defined hypothetical collections. Specifications:

- **User picks:** number of watches, challenge headline ("3 watches for
  business"), budget.
- **Source:** picks from current AND past listings (sold archive becomes
  a query-able source, not just an archive tab).
- **Multiple collections per user.** Named collections you maintain over time.
- **Send as challenge:** invite another user to build a collection responding
  to your spec.
- **Share later:** public read-only link to a collection.
- **Value-over-time tracking:** show how the cost of assembling that
  collection has shifted since you built it. Powerful only after enough price
  history accumulates.

Depends on: Epic 0 (references), past listings being browseable as a query-
able set rather than just an archive tab. Once references land, this is fast
to build.

### AI-powered serendipity (admin / household only initially)

- **Text embeddings** on listings from top dealers (Wind Vintage, Tropical
  Watch, Bob's vintage Omega, Hairspring, others I actually browse). Stored in
  Supabase pgvector. Computed once per listing on first sight.
- **"More like this"** on any listing.
- **Weekly "things you might have missed" email.** 5 listings from this week
  matching my taste based on hearted history. Sunday morning ritual.
- **Restricted initially** to my household. Can extend to friends later, or
  remain admin-only indefinitely.
- **Cost** estimate: pennies per month at current scale. Comfortable in
  budget.

### Deferred under this epic
- **Taste arcs** ("you love Rolex, fall out, return"). Defer until
  embeddings prove themselves; embeddings cover ~70% of this naturally.
- **Cross-source duplicate detection.** Possibly combine with reference
  normalization.
- **Listing-quality signals** (priced above/below dealer norm).
- **Comparison view** for similar saved items.

## Epic 4: Personal analytics (admin-only)

A separate area of the same site (`/admin` route, gated to my Supabase user
ID). Hidden from regular users. Different visual language: dense, data-heavy.

Build incrementally as questions surface:

- **Source quality dashboard** (also Epic 0). First view to ship.
- **Cross-source live inventory** for any reference.
- **Personal taste-relative pricing.** "This Heuer is priced 15% above where
  similar Heuers from this dealer have sold in the last year."
- **Auction lot prediction.** "Phillips Geneva has 3 lots that match your
  interests."

What Watchcharts already does well: don't compete on historical
price-per-reference. Use it; build what it doesn't.

## Epic 5: References (collector resources surface)

A top-level **References** section in the app for tools, calculators, and
reference material that supports vintage-watch collecting but isn't tied
to a specific listing or auction. Lives at its own main-nav tab alongside
Available / Auctions / Watchlist.

**Naming note.** "References" here is the section name (collector
resources). It is distinct from "watch reference numbers" (Rolex 1675,
Omega 2998, etc.) which are the data concept tracked under Epic 0. When
both meanings appear in the same paragraph, prefer the explicit forms
"References section" vs "reference numbers" for clarity. If/when the
ambiguity becomes painful in product copy, we can rename one — but in
docs and code the two coexist with the disambiguating qualifier.

### Sub-area: Tools and calculators

Shipped:

- **2026-04-29: Watch size comparison.** Two case dimensions (width ×
  length in mm) → side-by-side preview, stat boxes (width / length /
  footprint diff), and a print-to-scale sheet you can print on US Letter
  to lay on your wrist. First feature in the References section. Print
  scoping uses a React Portal pattern (see CLAUDE.md "Print scoping for
  in-app tools" — pattern is reusable for future printable tools).

Parking lot of future ideas (none promised, surface as Mark's interest
allows):

- Lug-to-lug calculator (wrist size + max lug-to-lug fit)
- Strap size calculator (lug width + wrist size → strap length)
- Round-watch variant of size comparison (case diameter input)
- Serial number decoder (per brand, vintage Rolex / Omega / Heuer / etc.)
- Service interval tracker
- Crystal / case material reference chart

### Sub-area: Reference-number encyclopedia (the headline feature)

Reference-number-led learning resource — what was previously this epic's
sole content. Surfaces under the same References tab once it's built.
Combines three layers:

1. **LLM-synthesized body.** Aggregates dealer descriptions, auction lot
   notes, and other on-platform writing about a reference number into a
   coherent reference guide. Refreshes periodically. Credit: "synthesized
   from descriptions by Hairspring, Wind Vintage, Analog Shift, ..."
2. **Curated layer.** Hand-picked links to deep dives, forum threads,
   videos, photo galleries. Public can suggest via form; I moderate.
   Inspired by explorer1016.com and similar collector-built sites.
3. **Live layer.** Currently-available listings of that reference number,
   plus past auction results, plus price trends.

Surfaces on listings of relevant reference numbers and as a standalone
browseable encyclopedia inside the References section.

This is potentially the platform's most differentiated feature.
Watchcharts has prices. Hodinkee has editorial. Dealer sites have
inventory. Nobody has all three synthesized into a single
reference-number-led learning view drawn from the dealer market itself.

Depends on: Epic 0 (reference numbers) + Epic 6 Phase A or cloud LLM
access for generation + accumulated dealer descriptions (already
happening passively if we start storing full descriptions for tracked
reference numbers).

Storage decision: full dealer descriptions for tracked reference numbers
stored locally on Mac mini and synced to Supabase, rather than bloating
`listings.json` for everyone.

### Sub-area: Curated link aggregator

Hand-picked outbound resources that are useful but don't fit the
encyclopedia structure: forum threads, vintage dealers' shop tours,
historical references, articles. Lives under References as a browsable
list with brand / topic / type filters. Some overlap with the
encyclopedia's curated layer; this surface is the catch-all home when
the link doesn't tie cleanly to one reference number.

## Epic 6: Mac mini infrastructure

Learning project plus capability extension. Phased.

- **Phase A:** Mac mini scrapes hard sources (Cloudflare-protected, JS-heavy)
  using headed Playwright. Pushes CSVs to repo. Rest of system unchanged.
  ~1 weekend setup. Concrete and useful.
- **Phase A.5 (likely combined with A):** Mac mini stores full dealer
  descriptions for tracked references. Generates reference guides via local
  LLM (Llama 3 or similar). Pushes results to Supabase. Powers Epic 5
  encyclopedia without burning cloud LLM budget.
- **Phase B (later, optional):** Mac mini runs Postgres and the API; Vercel
  still serves frontend.
- **Phase C (later, optional):** Full self-hosting on Mac mini.

Watch out for: CGNAT on home internet (check before buying), power/network
reliability, SSL cert renewal, backup strategy.

Hardware: M4 Mac mini base, 16GB RAM, ~$600.

## Priority order

Current best-guess sequence. Will shift; update this doc when it does.

1. **Epic 0 foundations.** References + verification script before adding
   more sources. Without this, everything downstream is shaky.
2. **Epic 6 Phase A** when a specific blocked source needs it OR when ready
   to start Epic 5 generation work.
3. **Epic 1 source list** to target end state, then close it.
4. **Build-a-collection (Epic 3)** as soon as references land. Showcase
   feature that proves references were worth doing.
5. **Epic 2 auction history**, reference-led, open houses first.
6. **Epic 5 encyclopedia** built incrementally as descriptions accumulate.
7. **Epic 3 discovery features** (embeddings, weekly email) once references
   and Mac mini are in place.
8. **Epic 4 admin analytics** built incrementally throughout.

## Explicitly NOT on the roadmap

Saying no is part of the roadmap. These have been considered and rejected
(or deferred indefinitely):

- **Refactoring all scrapers into a shared module.** Premature; current
  per-file structure is debuggable. Revisit only if a class of bug spans
  many scrapers.
- **Mobile native app.** PWA install is sufficient.
- **Public market analytics like Watchcharts.** They do it better.
- **Original editorial content.** Curating and synthesizing others' work
  is enough.
- **Birthday/anniversary mode.** Not interesting to me.
- **Taste arcs as a near-term feature.** Embeddings cover most of this;
  revisit only if embeddings disappoint.
- **Generic public social features** (comments, ratings, profiles). Build-a-
  collection sharing is the only social primitive on the roadmap. Keep it
  small.

## Fun ideas, parked

Not active. Worth keeping a list because some might graduate.

- **Watch arrival animation.** Subtle entrance for firstSeen-today listings.
- **Watchlist export.** PDF or CSV download of saved listings.
- **Random watch button.** Pure serendipity, zero algorithm.
- **Reference browser.** Encyclopedia view as standalone navigation, not
  just attached to listings. (Likely combines with Epic 5.)
- **Year-in-review.** Once a year of data exists: hearted-most, dealers-
  browsed-most, biggest price drops caught.

## Update log

- 2026-04-29 (AM): **Shipped:** new top-level **References** section
  with the Watch size comparison tool as its first feature. Two case
  dimensions in → preview + stat boxes + print-to-scale sheet for US
  Letter. Print scoping uses a React Portal pattern (only the print
  sheet survives `@media print`; the rest of the app, including
  `#root`, is hidden); pattern is reusable for future printable tools.
  Epic 5 restructured under "References (collector resources surface)"
  with the existing reference-number encyclopedia content moved into a
  sub-area; the section/reference-number naming overlap is documented
  inline so we can disambiguate as needed when more sub-areas land.
- 2026-04-28 (PM): **Shipped:** Card-tile flash fix on heart click /
  scroll. `ListingsGrid` was a function-component nested inside `App`,
  giving it new identity each render → React unmounted+remounted the
  whole grid → every `<img>` re-fetched. Converted to a JSX expression;
  wrapped `Card` in `React.memo`. Live on `the-watch-list.app` at bundle
  `main.bd1be653.js`. Same commit also renamed the "None" group option
  to "Date" on Available (the implicit Today / Last 3 days / This week
  / Older dividers were misleadingly labeled).
- 2026-04-28 (PM): **Shipped:** Auctions tab gets two sub-tabs —
  Tracked lots (default) + Calendar. Mirrors Watchlist's
  Listings/Searches sub-tab pattern. Choice persists in localStorage.
  Sets up the eBay sub-tab landing as a third entry once that
  integration ships.
- 2026-04-28 (PM): **Designed:** eBay integration scope finalized.
  Sub-tab inside Auctions for timed lots; mixed into Available feed
  for Buy-It-Now (with `source = "eBay"`). Targeted reference searches
  + manual URL tracking. No re-listing detection. Setup blocker:
  Mark needs to create developer.ebay.com keyset and add
  `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` to GitHub Actions secrets
  before code can begin. Full plan under Epic 3.
- 2026-04-28 (PM): **Shipped:** pytest suite for `merge.update_state`
  state transitions (`tests/test_merge_state.py`, 10 tests covering
  new/persist/drop/increase/disappear/reappear/currency-edge/multi-cycle).
  CI runs on every push to main and every PR. The "tests for merge.py
  state transitions" item that was on Epic 0 / Code quality is now
  done.
- 2026-04-28 (PM): Doc-hygiene pass. Absorbed in-flight roadmap items
  from SESSION_HANDOFF_2026-04-27 — eBay integration and Alerts named
  under Epic 3; Heritage's DataDome blocking + the three escape hatches
  documented under Epic 1; the dealer-evaluation table consolidated under
  Epic 1 "Active candidates" with platform notes per source. Removed
  "Custom domain" from "Explicitly NOT" (it's shipped, not declined).
  Cross-reference header added.
- 2026-04-28: Roadmap created. Build-a-collection promoted. Reference
  encyclopedia reframed as headline feature using LLM synthesis of dealer
  descriptions. Birthday mode dropped. Taste arcs deferred. Three-tier save
  added. References established as cross-cutting foundation.
