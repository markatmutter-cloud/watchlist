# Watchlist Roadmap

Last updated: 2026-05-03
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

## Strategic bets

Watchlist's distinctive role is as a **reflective tool for serious
collectors, not a transactional one**. Features that deepen reflection
(collecting journeys, per-watch context, reference learning) earn
priority over features that optimize for transaction speed (faster
price lookups, more inventory, lower latency). The collecting community
has plenty of transactional tools; reflective ones are rare.

This is the lens for prioritization tradeoffs: when two features compete
for a session and both make sense, pick the one that helps the user
*think about* their collecting more, not the one that helps them *act
faster* on it.

## User journeys

Selected journeys grounding the design. Journeys 1-9 live in the
product brief; 10-11 added here as speculative-until-shipped to keep
forward-looking features grounded in concrete user intent.

- **Journey 10 — The Returning Reflection.** Mark opens his watchbox
  three years from now. Reads what he wrote about his first Heuer.
  Realizes how his taste has shifted. Adds a note to his journey
  narrative. *(Depends on Watchbox v2 + per-watch reflections.)*
- **Journey 11 — The Source Suggestion.** A friend in Italy emails
  Mark: "you should add Italian Vintage Watch Co. to Watchlist;
  great dealer." Friend goes to Watchlist's "Suggest a source" form,
  fills it in. Mark reviews, agrees, adds the source. Friend is
  notified. *(Depends on Epic 1 v2 open-submission flow.)*

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
- **Verification script ✓ shipped 2026-05-02.** `verify_sources.py`
  runs after merge.py, counts live listings per source, compares each
  to its rolling 7-day median, and flags drops to zero or <30% of
  median. Outputs `public/verification.json` (today's report) +
  `public/verification_history.json` (rolling 14-day baseline). Wired
  as a non-blocking step in scrape-listings.yml.
- **Source quality dashboard ✓ shipped 2026-05-02.** Admin-only view
  at `?tab=admin`, gated by `REACT_APP_ADMIN_EMAILS`. Per-source
  table with live count, new-per-week, sparkline trend, days stale,
  hearts/heart-rate, hides/hide-rate, avg price, top brand %, health
  (from verification alerts), earning-keep chip (🟢🟡🔴). Drives the
  "which sources earn their keep" decision; folded into Epic 4 too.
- **Site discoverability and welcome page (pending).** robots.txt,
  sitemap.xml, og:image refresh, meta-tag pass, Schema.org markup,
  plus a welcome/about page for first-time visitors. Foundation for
  organic discovery (not promotion in the marketing sense). The
  welcome page addresses the "what is this and how do I use it" gap
  a first-time visitor hits when landing on the Available feed cold.
  Half-session of work; mostly content + a few public/ files.
- **Maintenance rhythm.** Every 4th-5th session is hygiene only: bug fixes,
  dependency updates, source pruning. No new features.
- **User settings / currency preference ✓ shipped 2026-05-01.** New
  `user_settings` Supabase table; primary_currency picker (USD /
  GBP / EUR) in the Settings modal. Card render reads the
  preference and shows it as primary, native as secondary. Designed
  as a kitchen-sink user-prefs surface so future settings co-locate.

## Epic 1: Sources

Target end state: ~30 dealers + 6 auction houses, all earning their keep.
Currently at 34 dealers + 6 auction houses (past the 30-dealer
end-state target — **Stop rule pruning is now the next Epic 1
priority**).

- **Active candidates** (evaluated, not all guaranteed):

  | Candidate | Status |
  |---|---|
  | Vintage Watch Collective | **shipped 2026-05-02** — Wix, productsWithMetaData pattern (Chronoholic clone), EUR, ~40 active listings |
  | Wrist Icons | WordPress; `/wp-json/wc/store/v1/products` returned 301 — follow redirect to confirm WooCommerce |
  | Vision Vintage Watches | Wix (not Squarespace despite the URL trick); needs custom HTML parsing |
  | Vintage Heuer | **shipped 2026-05-03 as "Vintage Watch Shop"** — WordPress custom-post + detail-page walker for the "Our price: £NNNN" pattern; ~20 active items |
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

### Open submission v2 (deferred — needs users)

Open submission with moderation. Users suggest sources via a
"Suggest a source" form; Mark approves or declines. Criteria for
accepting sources documented separately. Probably 6+ months out —
worth shipping when the platform has more than just Mark and his
wife as users; until then, there's nobody to suggest. Grounded by
Journey 11.

## Epic 2: Auction history

Two complementary surfaces: (1) **calendar-level tracking** of upcoming
sales (already shipped — Watchlist > Auction Calendar surfaces 6
houses); (2) **reference-led realized-price capture** of past results;
(3) **comprehensive lot archive** as the data foundation that powers
both serendipitous discovery and reference research.

### Reference-led realized-prices

Not "every auction forever" but "what has come up for this reference,
when, and what did it sell for."

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

### Comprehensive auction inventory capture

Currently Watchlist tracks auction calendars (when a sale is happening)
but doesn't capture all the lots that come through. Expand to scrape
every auction lot from supported houses and keep them as a permanent
historical archive after the sale. Filter out: clocks, pocket watches,
loose dials, watch parts, jewellery. Keep: complete wristwatches.

Sold lots become a search-able back catalog ("show me every Heuer
Carrera that's been to auction in the last 5 years"). High value for
serendipitous discovery and reference research — the use case Mark
experienced going through old auction catalogs with his mum.

Bigger than the reference-led capture above (which is selective). This
is comprehensive historical capture; data volume + scraping work is
meaningfully larger. The two work together: reference-led is the lens,
comprehensive is the substrate.

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

### Build-a-collection / Watch Challenges v2 (deferred — reuses the Collections primitive)

Constrained hypothetical collections: "3 watches for $50k", "5-watch
starter collection", "3 watches for business", etc. User picks from
current AND past listings (sold archive becomes a query-able source,
not just an archive tab). Multiple challenges per user.

Workflow surfaces (currently in design exploration in a separate chat;
UI/workflow not yet resolved):
- **Send-as-completed.** Share a finished collection with a friend.
- **Send-as-empty.** Challenge a friend to build their own response
  to your spec.
- **Public read-only link.** Extends the v1 single-listing share
  primitive into a future "share collection" surface.
- **Value-over-time tracking.** Show how the cost of assembling that
  collection has shifted since you built it. Powerful only after
  enough price history accumulates.

The plumbing (collections table with `type='challenge'`) already
exists; this is purely UI + a few extra columns (target_count,
budget, theme).

Not a near-term build target; revisit when design questions in the
exploration thread are answered. Depends on Epic 0 (references) +
past listings being browseable as a query-able set.

### Watchbox v2 — real ownership tracking (deferred)

Track watches Mark and other users actually own and have owned. A
Watchbox is a collection with `type='watchbox'`.

Per-item ownership data:
- Purchase price + date acquired
- Sold price + date sold (if disposed)
- Photos (user uploads, optional)
- Historical-cost vs current-comp delta

Per-watch **reflection** layer (the differentiator):
- Why bought
- Expectations going in
- How reality compared
- Would-buy-again

Per-user **collecting journey narrative**:
- A single editable story about the user's collecting arc — started
  with vintage Heuer, moved to Rolex, exploring obscure brands now.
- Strictly private by default; optionally shareable later.
- Compounds in value over time as the reflection layer accumulates.

Grounded by Journey 10 (the returning reflection). This is the
exemplar of the **Strategic bets** "reflective tool, not transactional
tool" lens — highest personal value of any roadmap item; low platform
risk; low implementation cost on top of the watchbox data model.

### Sharing collections (deferred — extends v1 share primitive)

Share an entire collection by link, not just a single listing.
URL shape will mirror v1: `?collection=<id>&shared=1`. Recipient
banner gives "Save copy to my collections" / "Just browsing".
Public read-only collection links also live here.

### Strength-of-save model (reinstated 2026-05-03)

Replace single-tier hearts with two levels of save signal: **"Love"**
(strong, definitive) and **"Watch"** (lighter, "keep an eye on this").

**Critical constraint:** must not add UI clutter or extra friction.
Likely a single tap that cycles through three states (none → watch
→ love → none), or a long-press to escalate. Bad UX kills the
feature; the simpler the gesture, the better.

Was rejected during Collections + Sharing v1 because it added
complexity. Reinstated because the underlying need (distinguishing "I
love this" from "I'm tracking this lightly") is real, especially as
input for the AI taste features below. The challenge is the UI, not
the concept.

This is the entry-level shape of the broader **Multi-signal taste
capture** below — start here, expand later.

### Multi-signal taste capture

Beyond binary heart/no-heart, capture calibrated taste signals along
a spectrum:

- **Love** — strong positive
- **Watch** — light positive (covered by Strength-of-save above)
- **Keep but don't recommend** — neutral; don't surface in suggestions
  but don't actively reject
- **Not for me but show others** — mild negative for me only
- **Never recommend this kind of thing** — strong negative

Hide is currently doing too many jobs (clutter removal, taste signal,
"I don't want this"); this disambiguates them.

Powers the AI taste model with calibrated signals. Implementation can
be progressive: start with the strongest signals (Love, Never), add
finer-grained ones as the UI for capturing them gets easier.

### Discover mode (with serendipity)

Single-card swipe interface as alternative to feed browsing. Two
streams woven together:

- **High-precision stream** — watches similar to what you've loved.
  Low surprise; reliable hits.
- **Serendipity stream** — watches *adjacent* to your taste but
  outside your usual patterns. Lower precision, higher surprise.
  Answers "show me something I wouldn't have looked at on my own
  but might love."

The serendipity element is what makes the feature worth building.
Discover mode without it is just a swipe-version of the feed.

Mobile-first. Doubles as a calibration mode for fast taste-signal
generation. Ships after Multi-signal taste capture so the underlying
signals are rich enough to drive both streams.

### AI recommendation surfaces

Specific recommendation views inside the app, distinct from Discover
mode's swipe interface:

- **"Things you might have missed"** — weekly digest of watches
  matching your taste that you didn't see in the feed. Sunday-morning
  ritual.
- **"More like this"** — on any listing, surfaces similar watches.
- **"For [name]"** — recommendations for someone else based on what
  *they've* reacted to in shared listings. The killer feature for
  couples who share watches with each other; makes Watchlist
  bidirectionally useful for shared collecting interests. Mark sees
  a watch Jackie would like; the system already knows Jackie's taste
  from her own use; Mark can ask "what does Jackie's taste model say
  about this?" before sharing.

Restricted initially to Mark's household. Can extend to friends later,
or remain admin/household only indefinitely. Cost estimate: pennies
per month at current scale.

Depends on Multi-signal taste capture + embeddings infrastructure
(Supabase pgvector, computed once per listing on first sight).

### Reference-level grouping
Three saved 5548BAs collapse into one card with "3 listings, click to expand."
Depends on Epic 0 references.

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

**Tools section is intentionally narrow.** The Watch size comparison
tool is the seed. Future tools should solve specific *tactile* or
*calculation* problems collectors actually have — e.g. "lay this watch
on my wrist before I buy it" — not a generic toolbox.

Resist building lug-to-lug calculators, strap-size calculators, etc.
as separate tools. Most of that calculation is better surfaced
**within reference guides themselves** (the 1675's reference guide
can include lug-to-lug context for that specific reference, where
the data is actually meaningful). Keep Tools tiny.

Shipped:

- **2026-04-29: Watch size comparison.** Two case dimensions (width ×
  length in mm) → side-by-side preview, stat boxes (width / length /
  footprint diff), and a print-to-scale sheet you can print on US Letter
  to lay on your wrist. First feature in the References section. Print
  scoping uses a React Portal pattern (see CLAUDE.md "Print scoping for
  in-app tools" — pattern is reusable for future printable tools).

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

**Moderated user contributions v2 (deferred — Epic 5 ships first).**
Users can suggest corrections to entries and propose additional links
via a contribution form. Submissions queue for moderation; Mark
approves or declines. Not wiki-editable — every change goes through
review. The intent is to leverage community knowledge while preserving
editorial integrity, so the encyclopedia keeps reading like a curated
resource rather than a free-for-all. Probably a year+ out: the
encyclopedia has to exist and have enough entries that contributions
become useful.

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

1. **References as first-class entities (Epic 0).** The remaining
   foundation. Several downstream features (encyclopedia, comparison
   view, auction lot grouping, Discover mode quality) gate on this.
2. **Site discoverability + welcome page (Epic 0).** Half-session;
   robots / sitemap / og / Schema.org / first-time-visitor page.
   Foundation for organic discovery.
3. **Strength-of-save model (Epic 3).** Two-tier (Love / Watch) is
   the entry point to the broader Multi-signal taste capture. Small
   UI lift; the feature is *the gesture*, not the underlying data.
4. **Epic 6 Phase A** when a specific blocked source needs it OR
   when ready to start Epic 5 generation work.
5. **Watchbox v2 — reflection layer (Epic 3).** Highest personal
   value of any roadmap item. Reflective-tool exemplar per Strategic
   bets. Unlocks Journey 10.
6. **Epic 1 source pruning** under the Stop rule. At 30 dealers,
   audit + prune to 25.
7. **Epic 2 comprehensive auction inventory capture.** Substrate for
   serendipitous discovery and reference research.
8. **Epic 5 encyclopedia** built incrementally as dealer descriptions
   accumulate.
9. **Multi-signal taste capture + Discover mode + AI recommendation
   surfaces (Epic 3).** Stack progressively. Multi-signal first;
   Discover and recommendations layer on top once signals are rich.
10. **Build-a-collection / Watch Challenges v2 (Epic 3).** Resume
    once design exploration in the separate chat resolves.
11. **Epic 4 admin analytics** built incrementally throughout.

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

(Note: an earlier "three-tier save" rejection was reinstated
2026-05-03 as **Strength-of-save** under Epic 3. The earlier
rejection was framed around UI clutter, which is still the binding
constraint — but a single-gesture cycle through three states
addresses that constraint while preserving the calibrated-signal
value. The reinstated version explicitly supersedes the earlier
"Collections covers it" framing: Collections answers *organisation*,
strength-of-save answers *signal*, and they're complementary.)

## Parked, strategy needed

Not "explicitly NOT" — these are real ideas that need a dedicated
strategic session before they can be scoped, because the design
questions are foundational rather than tactical.

- **Featured selling section (Mark's own watches).** A surface where
  Mark could sell from his own collection through Watchlist. Strategic
  questions to answer first: hobbyist vs dealer line; conflict of
  interest with curatorial features (e.g. personal-taste-relative
  pricing if Mark is also a seller); dealer relationship implications
  (existing dealers may chill on cooperation if Mark becomes one
  himself); tax / legal questions; UI separation needed so users can
  trust the curatorial signals. Capture so it doesn't get lost; do
  the strategy session before the build session.

## Fun ideas, parked

Not active. Worth keeping a list because some might graduate.

- **Watch arrival animation.** Subtle entrance for firstSeen-today listings.
- **Watchlist export.** PDF or CSV download of saved listings.
- **Random watch button.** Pure serendipity, zero algorithm.
- **Reference browser.** Encyclopedia view as standalone navigation, not
  just attached to listings. (Likely combines with Epic 5.)
- **Year-in-review.** Once a year of data exists: hearted-most, dealers-
  browsed-most, biggest price drops caught.

## Quarterly roadmap review

A recurring discipline to keep the doc honest as the product evolves.

**First Sunday of each quarter:** re-read this roadmap end-to-end,
mark what shipped, update the priority order, and surface anything
parked too long for an explicit ship-or-drop call. Same cadence
applied to user-journeys and metrics docs when they exist.

Not formal — just a calendar reminder to do the pass. The risk this
addresses: roadmap rot. Items get added, shipped items don't get
moved, priorities drift. A quarterly pass catches that before it
becomes confusion.

## Update log

- 2026-05-03 (later): **Four UK dealer sources added (34th total),
  + eBay tracked-lot URL fix.** Mark added Maunder Watches
  (WooCommerce, GBP, ~95 items), Watch Club (custom TaffyDB JS
  catalog at /upload/js/watches2018_bis.js, GBP, ~57 active items
  out of 4365 in the file — most are sold archive with status≠"1"),
  Vintage Watch Shop / Vintage Heuer (WordPress custom-post + per-
  item detail walk for "Our price: £NNNN", GBP, ~20 items), and
  Watches of Lancashire (WooCommerce, GBP, ~73 items). All four are
  UK-based — the feed gets meaningfully more GBP-priced inventory.
  Three patterns surfaced: (1) Maunder's WC API ignores `page` —
  pagination is `offset` only; (2) Maunder + WoL bot-protection
  returns 403 to long Chrome UAs but is fine with short
  `Mozilla/5.0` (counterintuitive); (3) Watch Club paginates
  client-side via TaffyDB queries against an in-memory JSON, so
  there's no server-side pagination and naive ?n=N walks return the
  same 20 items. **34 dealers is past the 30-dealer end-state
  target**: Stop-rule pruning to 25 is now the next Epic 1 decision.
  Separately, **eBay short-URL fix in auctionlots_scraper.py**:
  Mark's `ebay.us/m/<token>` share-link URL didn't track because (a)
  the dispatcher only matched `ebay.com` / `*.ebay.com` / `*.ebay.*`
  patterns, and (b) `scrape_ebay_lot` extracts the legacy item ID
  via `/itm/(\d+)` regex — `ebay.us/m/PpFLll` has neither. Fixed by
  recognising `ebay.us` / `ebay.gg` / `ebay.to` as eBay domains in
  the dispatcher, and following the first redirect (Location header
  only, not the full eBay item page which times out at 15s) to
  resolve to canonical `ebay.com/itm/<id>` before parsing.

- 2026-05-03: **Roadmap consolidation pass (additions / reinstatements
  / edits from a parallel design conversation).** Multi-tier save
  reinstated as Strength-of-save under Epic 3, with strict UI
  constraints (single-gesture three-state cycle); the earlier
  rejection note in "Explicitly NOT" updated with the reinstatement
  reasoning. Multi-signal taste capture added as the richer five-tier
  evolution that subsumes "hide as negative signal." Discover mode
  added with explicit serendipity stream (the high-precision +
  serendipity weave is what differentiates it from a swipe-version
  of the feed). AI recommendation surfaces added as a separate Epic
  3 item — "Things you might have missed", "More like this", and the
  "For [name]" view that closes the loop on couples sharing tastes.
  Watchbox v2 expanded with explicit reflection-layer + journey-
  narrative framing (the Strategic-bets exemplar). Build-a-collection
  v2 reframed as "Watch Challenges" with send-as-completed and
  send-as-empty flows; flagged as gated on a separate design
  exploration. Comprehensive auction inventory capture added to
  Epic 2 as a distinct surface from the calendar-level tracking and
  reference-led realized prices already there. Site discoverability
  + welcome page added under Epic 0 (robots / sitemap / og /
  Schema.org / first-time-visitor page). Tools section under Epic 5
  narrowed — most tool-like content belongs *inside* reference
  guides, not as a generic toolbox; lug-to-lug etc. parking lot
  removed. Selling-Mark's-own-watches captured in a new "Parked,
  strategy needed" section between "Explicitly NOT" and "Fun ideas,
  parked" so the strategic questions are surfaced before the build.
  Quarterly review section added at the end as a recurring
  discipline. Verification script + Source quality dashboard moved
  from active items to "shipped 2026-05-02" alongside the existing
  User-settings shipped marker; the Epic 0 foundations layer is
  meaningfully more solid than three sessions ago. Priority order
  refreshed accordingly — references-as-first-class is now the lone
  remaining Epic 0 foundation; Strength-of-save promoted because
  it's small, gates other Epic 3 work, and is high-leverage.

- 2026-05-02 (evening): **Source quality dashboard shipped (Epic 0
  + Epic 4 admin-only).** New `?tab=admin` route gated by
  `REACT_APP_ADMIN_EMAILS` env var (empty = nobody is admin).
  Hidden in the user-dropdown only for matching emails — not
  surfaced in the main tab strip per the "don't telegraph
  commercial intent" constraint. Dense table view, one row per
  source, sortable: Live / New per week / 14-day trend
  sparkline / Days stale / Hearts / Heart% / Hides / Hide% /
  Avg $ / Top brand% / Health (from verification.json alerts) /
  Earning-its-keep chip (🟢🟡🔴 derived from heart-rate, hide-
  rate, throughput, staleness — tunable in one place). Default
  sort by Earning so prune candidates surface first. Reads
  verification.json + verification_history.json + listings.json
  (all public static); hearts and hides come from Supabase via
  existing watchItems / hiddenItems hooks. Hide-by-source is
  bounded to currently-active listings (the schema doesn't
  snapshot at hide time); heart/hide rates use a max(live,
  hearts+hides) proxy for "ever seen" to avoid loading the
  ~2MB state.json. Both noted in code as v1 caveats.

- 2026-05-02 (afternoon): **Watchurbia source (30th dealer) +
  Epic 0 verification script shipped.** Watchurbia is a small
  German vintage dealer running WooCommerce. Scraper filters at
  the Store API to `category=watches-in-stock` so the sold archive
  doesn't surface (~7 active items today, EUR; vintage Heuer-heavy).
  Hits the dealer-count target end-state: 30 dealers, 6 auction
  houses. The Stop rule (audit + prune to 25) becomes the next
  Epic 1 decision. Separately, **`verify_sources.py` ships as the
  Epic 0 verification script** — runs after merge.py, counts live
  listings per source, compares each to its rolling 7-day median,
  flags drops to zero or <30% of median. Outputs
  `public/verification.json` (today's report) +
  `public/verification_history.json` (rolling 14-day baseline).
  Wired as a `|| true` step in scrape-listings.yml so a glitch
  never blocks the cron. Alerts surface in GitHub Actions logs +
  the committed report; future admin UI / status banner can render
  the JSON.

- 2026-05-02 (afternoon): **Roadmap structure expansion: Strategic
  bets + User journeys + three v2 deferrals.** New "Strategic bets"
  section captures the reflective-vs-transactional positioning lens
  that resolves prioritization ties (reflective wins). New "User
  journeys" section seeds Journey 10 (returning to a watchbox
  reflection three years out) and Journey 11 (friend suggests a
  source) — speculative-until-shipped, but useful to ground future
  feature design. Three v2 items added: per-watch reflection +
  collecting-journey narrative under Watchbox v2 (Epic 3, ships
  with the watchbox surface — highest personal value, low platform
  risk); open submission with moderation under Epic 1 (deferred
  6+ months until users beyond Mark's household exist); moderated
  user contributions under Epic 5 reference encyclopedia (deferred
  a year+, gated on the encyclopedia existing first). All three
  fold into existing priority slots rather than disrupting the
  order.

- 2026-05-02: **Refresh preserves location + European Watch source
  added (28th dealer, pre-2000 only).** `tab` / `sub` / `col` query
  params get written via `history.replaceState` as the user
  navigates and read on mount, so a refresh on
  `?tab=watchlist&sub=collections&col=<id>` lands the user back
  where they were instead of the default Listings tab. Pattern
  documented in CLAUDE.md alongside the existing Share URL note;
  no `react-router` brought in. Separately, European Watch Co.
  (Boston) added as the 28th dealer source — Next.js site,
  product data extracted from the inline `__next_f.push` RSC
  chunks. The dealer's inventory is mostly modern; the scraper
  applies a **scraper-side pre-year-2000 filter** (matching the
  dealer's "Circa. YYYY" model-title convention) to keep the feed
  focused on the vintage slice that fits the rest of Watchlist's
  curation. ~26 listings pass the filter (out of ~780 total).
  Standalone-year fallback was tried and rejected — it
  false-positived on model-line names like "Luminor 1950" and
  "Speedmaster 1957 Trilogy".

- 2026-05-01 (evening): **Backfilled-aware date sort + Hidden
  surfaced as a Watchlist > Collections row.** New-source
  ergonomics + cleanup of the user dropdown. Triggered by a
  same-day demo where Central Watch's 180 fresh listings (all
  stamped firstSeen=today, all backfilled:true) crowded the top
  of the date-desc feed despite the existing backfilled flag.
  Two-tier comparator added in App.js: non-backfilled items
  always sort above backfilled in either direction, with the
  existing effectiveDate logic unchanged within each tier. Future
  newly-added sources (ROADMAP Epic 1 still wants ~30 dealers)
  benefit automatically. Separately, the user-dropdown "Manage
  hidden" item was removed and Hidden listings now surface as a
  synthetic row in Watchlist > Collections (eye-slash icon, only
  appears when the user has ≥1 hidden listing). Drill-in renders
  the items grid with isHidden=true so the Card "..." menu's Hide
  entry flips to "Unhide" via existing semantics. Followed
  Approach A (same as Favorites): data still lives in the
  existing `hidden_listings` table, no schema change. The
  HiddenModal component file was deleted. CLAUDE.md picked up the
  Hidden-as-virtual-collection note alongside the existing
  Favorites-as-virtual-collection guidance.

- 2026-05-01 (PM late): **View menu → Settings consolidation +
  Vercel wedge resolved.** View popover (theme + columns + about)
  folded into the Settings modal as new sections (`25adbbf`); header
  carries filter button + avatar only now. Avatar sized 40 mobile /
  32 desktop to match the filter button. Desktop sub-tab "+ Track /
  + Add search / + New collection" buttons pushed right via
  `marginLeft: auto`; mobile keeps inline-after-tabs because the
  strip is horizontally scrollable. Collections list left-accent
  extended from shared-inbox-only to every collection row. Drops
  the now-unused `viewMenuOpen` state from `useViewSettings`.
  Separately: the 8-deploy Vercel wedge that piled up over the
  share-polish chain (`aea9c93` onward) was diagnosed and fixed in
  `01104d6` — root cause was a `{/* ... */}` JSX comment placed
  between `return (` and the root `<div>` in `Card.js`; CRA's
  parser reads that as an object literal and `CI=true` turns the
  parse error into a build failure. Lesson graduated to CLAUDE.md
  "Things to never do".

- 2026-05-01 (PM): **User settings / currency picker shipped**
  (Epic 0 near-term item, completed same day it was scoped). New
  `user_settings` Supabase table; primary_currency picker (USD /
  GBP / EUR) in the user-dropdown menu. Card render reads the
  preference and shows it as primary, native as secondary. UK-friend
  case (George Longfoot) resolved with an easter-egg credit line.
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
