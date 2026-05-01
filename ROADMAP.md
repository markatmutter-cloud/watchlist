# Watchlist Roadmap

Last updated: 2026-05-01
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
- **User settings / currency preference (near-term).** New
  `user_settings` table — for now a single column
  (`primary_currency`: USD / GBP / EUR / CHF / JPY / native), but
  designed as a kitchen-sink user-prefs surface so future settings
  (notification opt-ins, default sort, etc.) co-locate. New
  Settings route from the user dropdown. Frontend: replace the
  hardcoded "USD primary" decision in Card with a lookup against
  the user's preference; default to "native" for users with nothing
  set (matches behavior pre-2026-04-30). Half-session of infra +
  half-session of Card refactor. Goes under Epic 0 because the
  table will outgrow currency to be the home for every user-prefs
  field.

## Epic 1: Sources

Target end state: ~30 dealers + 6 auction houses, all earning their keep.
Currently at 27 dealers + 6 auction houses.

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

### eBay integration (mostly shipped, 2026-04-30)

Highest-impact single feature on the list when it landed. eBay has a
stable Browse API (free tier 5k calls/day, OAuth).

**What shipped:**

- `ebay_oauth.py` — OAuth client-credentials token refresh.
- `ebay_search_scraper.py` — reads `data/ebay_searches.json`, calls
  Browse API per (search × country), writes `data/ebay.csv`.
- `.github/workflows/scrape-ebay.yml` — runs 3×/day at 6:30am /
  12:30pm / 6:30pm PT, offset 30 minutes from the dealer scrape.
- `data/ebay_searches.json` — config file. Each entry has `label`,
  `query`, optional `country` (ISO-2 string or array), optional
  `seller` (filter to a specific seller's listings).
- Buy-It-Now eBay items show up in the main Listings feed with
  `source = "eBay"`. Same Card, same filters.
- Watchlist > Searches sub-tab now surfaces the contents of
  `data/ebay_searches.json` read-only, with an "Edit on GitHub" link
  to the file's in-browser editor. Counts come from `data/ebay.csv`'s
  `_search_label` column.
- Manual single-item URL tracking — paste an eBay item URL into Track
  new item; the auctionlots scraper handles eBay alongside auction
  houses.

**What changed from the original 2026-04-28 design:**

- **No separate Auctions tab for timed auctions.** That tab was
  retired before eBay landed (calendar moved into Watchlist >
  Auction Calendar). Timed eBay auctions surface as tracked lots
  inside Watchlist > Listings via the Track new item flow.
- **No region split in the live config.** Country was input-side only
  — never plumbed through to the UI — so the original USA/UK/Europe
  per-query split was collapsed to single global queries on
  2026-04-30. Two queries today (Omega Railmaster CK2914, Heuer
  Autavia GMT). Re-add country filter per query if a future search
  is noisy enough to fill 50 results in one country.

**Future work:**

- **In-app CRUD for eBay searches.** Currently option 1 of 3:
  read-only display + GitHub edit link. Option 2 (Supabase migration
  + admin form) deferred until Mark hits the GitHub-edit friction.
- **NOT in scope:** re-listing detection (dropped 2026-04-28 — too
  speculative).
- **NOT in scope:** broad keyword searches like "vintage Rolex".
  Targeted reference-level searches only.

### Alerts (email or push) on saved-search matches

Turns Watchlist from a browse tool into a daily-open tool. Built after
eBay so it covers both dealer matches AND eBay matches in the same
notification.

### Collections + Sharing v1 (shipped 2026-05-01)

Three-session feature pair. Made collections the underlying data
model for Watchlist content (see CLAUDE.md "Watchlist data model");
introduced the first user-to-user primitive (sharing) deliberately
without any in-app messaging, reactions, or sender-identity surface.

What landed:
- `collections` + `collection_items` Supabase tables (Approach A —
  default Favorites stays in `watchlist_items`; new tables hold
  user-created collections + the auto Shared-with-me inbox).
- Watchlist sub-tab structure: **Favorites / Collections / Searches
  / Auction Calendar** (4-up). Favorites is the renamed Listings
  sub-tab; default heart-flow unchanged.
- New `"..."` menu on every Card: Share, Add to collection…, Hide
  (or Remove from collection inside a drill-in).
- Share via Web Share API → clipboard fallback. Deep link is
  `?listing=<id>&shared=1` on root (no `react-router`). Recipient
  sees a non-modal banner above the listing's Card with Save /
  Dismiss; anonymous gets a passive Sign-in CTA, no nag.
- "Shared with me" auto-collection lazy-created on first received
  share. Items tagged `source_of_entry='shared_with_me'`.

The collections primitive is forward-compatible with the next two
v2 surfaces below — both gated on Epic 0 references for full
power, but the `type` marker (free-form / shared-inbox / challenge
/ watchbox) is already in the schema.

### Build-a-collection v2 (deferred — reuses the Collections primitive)

The interactive challenge layer on top of collections — pick a
target count + budget + theme, source from past + present
listings, track value over time. The plumbing (collections table
with `type='challenge'`) already exists; this is purely UI + a few
extra columns (target_count, budget, theme).

- **User picks:** number of watches, challenge headline ("3 watches for
  business"), budget.
- **Source:** picks from current AND past listings (sold archive becomes
  a query-able source, not just an archive tab).
- **Send as challenge:** invite another user to build a collection responding
  to your spec.
- **Share later:** public read-only link to a collection (extends the
  v1 single-listing share primitive — a future "share collection"
  surface).
- **Value-over-time tracking:** show how the cost of assembling that
  collection has shifted since you built it. Powerful only after enough price
  history accumulates.

Depends on: Epic 0 (references), past listings being browseable as a query-
able set rather than just an archive tab.

### Watchbox v2 (deferred — also reuses Collections)

Owned-watch tracking — a Watchbox is a collection with
`type='watchbox'`. Per-item ownership status, purchase price,
purchase date, sold price + date, photos. Historical-cost vs
current-comp delta. Future session.

### Sharing collections (deferred — extends v1 share primitive)

Share an entire collection by link, not just a single listing.
URL shape will mirror v1: `?collection=<id>&shared=1`. Recipient
banner gives "Save copy to my collections" / "Just browsing".
Public read-only collection links also live here.

### Three-tier save model (rejected — Collections supersedes)

Was: heart / watch / note as separate save tiers. Collections
(any name, any number) covers the same UX surface with more
flexibility, so the tiered model is no longer needed. Archived in
the change log for historical reference.

### Reference-level grouping
Three saved 5548BAs collapse into one card with "3 listings, click to expand."
Depends on Epic 0 references.

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

1. **User settings / currency preference (Epic 0).** Near-term and
   small. UK friend's GBP-primary case is real and the fix is half
   a session of infra + half of Card refactor.
2. **Epic 0 foundations** (references, verification script,
   source-quality dashboard). Without these, everything downstream
   is shaky.
3. **Epic 6 Phase A** when a specific blocked source needs it OR
   when ready to start Epic 5 generation work.
4. **Build-a-collection v2 (Epic 3).** The Collections primitive
   shipped 2026-05-01; v2 = challenge mechanics on top
   (target_count, budget, theme, value-over-time). Reuses
   `type='challenge'` on the existing collections table. Strongest
   showcase feature once references land.
5. **Epic 1 source list** to target end state, then close it.
6. **Epic 2 auction history**, reference-led, open houses first.
7. **Epic 5 encyclopedia** built incrementally as descriptions
   accumulate.
8. **Epic 3 discovery features** (embeddings, weekly email) once
   references and Mac mini are in place.
9. **Watchbox v2 (Epic 3).** `type='watchbox'` collections — the
   ownership-tracking surface. Lower priority than
   build-a-collection because it's personal-collection-first vs
   discovery-first.
10. **Epic 4 admin analytics** built incrementally throughout.

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
- **In-app messaging / reactions / replies / sender-identity exposure
  / share notifications.** Watchlist's share primitive (2026-05-01) is
  one-tap export to the native share sheet + a recipient banner.
  Replies happen in iMessage / WhatsApp / wherever the link came in.
  Adding any in-app social layer was explicitly designed against in
  the v1 spec.
- **Generic public social features** (comments, ratings, profiles).
  Listing-share + future collection-share are the only social
  primitives on the roadmap. Keep it small.
- **Three-tier save model** (heart / watch / note as separate save
  tiers). Superseded by Collections — any name, any number. More
  flexible than fixed tiers.

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

- 2026-05-01: **Collections + Sharing v1 shipped** (3 sessions —
  commits `212d89a`, `c2aeabd`, `ca49fa2`). Made collections the
  underlying data model for Watchlist content via Approach A:
  default Favorites stays in `watchlist_items`, additional
  collections + the auto Shared-with-me inbox live in new
  `collections` + `collection_items` tables. Sub-tab structure
  reshaped: Watchlist > Listings → Watchlist > **Favorites** +
  new **Collections** sub-tab. Card gained a `"..."` menu housing
  Share / Add to collection / Hide. Share uses Web Share API →
  clipboard fallback. Recipient banner is non-modal, renders above
  the active tab content, signed-in gets Save / Dismiss, anonymous
  gets a passive Sign-in CTA. URL format
  `?listing=<id>&shared=1` on root — no `react-router`. Roadmap
  restructure: build-a-collection and watchbox demoted from
  near-term to v2 (both reuse the new collections primitive via
  the `type` marker already in the schema); three-tier save model
  rejected in favor of Collections. Open question on sender-
  identity exposure resolved as "no in v1" — the messaging app
  the link came in handles sender attribution. User Settings /
  Currency Preference added under Epic 0 as the next near-term
  item.
- 2026-05-01: **Source added — Central Watch** (Grand Central Watch
  Repair, NYC). 27th dealer; custom PHP catalogue, HTML-parsed,
  USD-priced. ~180 listings, mostly Rolex / Cartier / Breitling /
  Omega / Patek with a long tail of vintage one-offs (Concord,
  Zodiac, Waltham, ...). Two dealers from the Active candidates
  table (Vintage Watch Collective, Wrist Icons, Vision Vintage,
  Vintage Heuer) still open; Stop rule says audit + prune to 25
  once the active count hits ~30.
- 2026-04-30: **Structural cleanup pass.** App.js dropped from 2,130 →
  ~1,250 lines (-41%). Mobile + Desktop render branches extracted
  into `src/components/MobileShell.js` + `DesktopShell.js`. Domain
  state moved into hooks (`useTrackModal`, `useFavSearchModal`,
  `useViewSettings`, `useFilters`). Modals broken out into their own
  files (`TrackNewItemModal`, `FavSearchModal`, `AddSearchModal`).
  Shared style tokens consolidated in `src/styles.js` (4 copies of
  the modal × button → 1; 3 copies of pill style → 1). Dead
  `AuctionsTab.js` (504 lines) deleted. **Tests:** new jest job
  runs RTL smoke tests for both shells on every push — would have
  caught the TDZ class of bug that shipped a white screen on mobile
  in late April. **Search tokenization:** word order no longer
  matters ("rolex gold" = "gold rolex"). **Watchlist bucket order:**
  Date↓ now puts Today first (was always-Today-last regardless of
  direction). **eBay searches:** surfaced read-only in Watchlist >
  Searches sub-tab with an Edit-on-GitHub link; collapsed 6 region-
  split entries to 2 global queries.
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
