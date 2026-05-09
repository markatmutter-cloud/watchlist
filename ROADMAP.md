# Watchlist Roadmap

Last updated: 2026-05-06
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
- When suggesting work, name the epic it lives under. ("This is Epic 3: Watchlist work.")
- When work is finished, suggest updating this doc to reflect the change.


## North star

Watchlist is a personal vintage-watch tool first, a public site second.
Built for me to discover, track, and understand vintage watches across
the dealer and auction market. Public access is a secondary benefit,
not the primary purpose.

The long-term value compounds in two places: (1) the accumulated
cross-source data — listings, prices, what sold, what stuck — across
dealers and auctions, and (2) the analytics and learning experiences
built on top of that data. Listings are today's surface; reference
research, reference learning, and collection-as-play are the next
chapters.

Watchlist is not trying to be Watchcharts or Chrono24. Don't compete on historical
price-per-reference; build what they don't.

## Jobs to be done

The product solves a chain of jobs, roughly sequenced by the order a
collector would feel each pain. Each step depends on the previous
working well. The roadmap's priority ordering follows this sequence —
when two features compete, pick the one earlier in the chain.

1. **Aggregator** — bring enough vintage stock from independent
   dealers + auction houses into one feed that the user doesn't
   need to bounce between Chrono24, eBay, Bezel, and individual
   dealer sites to scan the market.
2. **Watchlist features** — monitor, filter, sort, save, file
   into lists, and bring permanency to sold lots so the saved set
   is durable even after the dealer pulls the listing.
3. **Sharing** — bring others in via a one-tap share to the native
   share sheet; the recipient sees the listing in the same UI with
   a Save / Dismiss banner. No in-app messaging — chosen messenger
   handles replies.
4. **Reference research** — the actual core value. Look across
   every listing of a given reference (e.g. every Seamaster
   165.024 currently or recently in market) and answer: is this
   one priced reasonably? What dial/hand variations come up?
   What did comparable ones sell for? Cross-source, cross-time.
5. **Reference learning** — synthesize what's known about a
   reference: dealer descriptions accumulated over time, curated
   external links, hand-written notes, dial variation gallery.
   Hodinkee-style depth, but built from multiple sources books.
6. **Collection mentality** — support the collecting journey:
   real watchbox tracking (current + parted-with), reflections on
   each piece, a thinking-tool for "why do we collect, what
   mistakes have I made", and hypothetical-collection challenges
   that scratch the collector itch without committing cash.
7. **Discovery / recommender** — expand the user's awareness
   beyond what they already know. Surface obscurity relative to
   their browsing pattern, not absolute. AI recommendation and
   serendipity layers built on the multi-signal taste capture
   from #1–#6.
8. **Commercial signals** — if dealers / marketers / collectors
   would pay for any of #1–#7, build the test path. Not the
   driver; an awareness item.

## Strategic bets

A few distinguishing positions Watchlist is willing to hold:

- **Aggregator that respects the dealer ecosystem.** Every card
  links straight to the dealer's own site; Watchlist is a
  directory layer, not a marketplace. No hiding sender identity
  in shares, no sniping, no replacing dealer relationships.
  Dealers blocking us is a real risk; staying clearly additive
  (drives traffic, doesn't capture the transaction) is the
  hedge.
- **The accumulated dataset is the moat.** Watchcharts has
  prices. Hodinkee has editorial. Dealer sites have inventory.
  Nobody has the cross-source dataset of dealer descriptions +
  realized auction prices + active inventory + per-user
  engagement, all stitched together. Job-#4 (reference research)
  and job-#5 (reference learning) are the headline differentiators
  that this dataset enables.
- **Reflective-tool quality is a delighter, not the primary
  purpose.** Some features (watchbox journey notes, AI reflection
  bot, the Watch Challenges thought experiment) make Watchlist
  read as a reflective collector tool rather than a transactional
  one. That's a real differentiator from Chrono24 et al — and
  worth investing in once the aggregator + watchlist + research
  base is solid. Not the lens that decides every priority; one
  characteristic among several.
- **Personal-tool-first means me-centric curation is allowed.**
  Brand exclusions, model exclusions, sold-archive suppression,
  bracelets-are-not-watches — these are MY rules, baked in. Other
  users get the same lens. Open-submission paths (Epic 1) are
  deferred until there are users who'd benefit.
- **Build with Claude as co-author.** The whole platform is an
  example of what a non-technical builder can ship in a passion
  project. That visible-craft angle has its own value: PM-skill
  honing, vibe-coding learning, a portfolio piece for work, and
  proof-of-concept for what AI-paired solo builds look like.

The prioritization lens: when two features compete and both make
sense, pick the one earlier in the Jobs to be done chain above.

## Constraints

- Solo non-technical builder, co-authoring with Claude.
- Budget: under $20/month for hosted services.
- Free-tier-first: Vercel, Supabase, GitHub Actions. Mac mini at home
  as a later-phase capability for jobs that don't fit free tiers
  (Playwright, embeddings, reference-guide generation).
- Don't surface admin / analytics features in any UI text reachable
  by regular users. Dealers blocking us is a real risk; the safer
  posture is "additive directory layer" not "commercial threat."
  This is a presentation rule, not a denial of job-#8 — exploring
  commercial paths happens off-platform until there's something
  worth showing.
- References will be 70-80% accurate via parsing, with LLM fallback
  for the long tail and manual curation for the unparseable. Don't
  let perfect be the enemy of good.

(*User journeys section deleted 2026-05-05 during the section-by-
section review. The two forward-looking journeys it carried — the
Returning Reflection and the Source Suggestion — are folded into
the relevant epics' descriptions, anchored next to the features
they depend on rather than as a standalone section.*)

## Epic 0: Foundations

Cross-cutting infrastructure. Everything else depends on this layer
working. Mostly invisible to users; entirely visible to next-session-me
when something breaks.

### References as first-class entities

The data-layer prerequisite for jobs #4 (reference research) and #5
(reference learning). Today every listing carries a `ref` field as a
free-text title; nothing stitches multiple listings of the same
reference into one entity. Without that stitching, "show me every
Seamaster 165.024 currently in market" needs string-matching gymnastics.

Build: a normalised `references` table in Supabase (or wherever it
ends up — could be a JSON file at the static layer if Supabase row
limits get tight). Each reference has brand, model, era/years,
category. Listings, auction lots, and curated content all link to a
reference. Detection runs in three layers: per-source structured
fields where the dealer surfaces them, regex on title + description
where the format is predictable, and LLM fallback for the long tail.
Manual curation for the unparseable.

This is the substrate Epic 5 (research + learning) sits on. Until
this lands, those epics can't ship cleanly.

### Verification + scrape health

- **Pending — auction verification expansions.** Two checks that
  don't exist yet: (a) sales whose `date_end` has passed should
  flip to status=ended within N days; flag stuck-active sales;
  (b) new sales appearing on each house's calendar should show up
  in our calendar scrape within N days; flag misses. Both
  catch silent breakage modes the count-vs-median check can't.

### Infrastructure / refactor track

- **`listings.json` split by status.** Currently 3.5 MB; users
  fetch the whole file on every page load. Split into
  `listings_live.json` (active dealer items) and
  `listings_sold.json` (archive). Saves ~half the initial fetch.
  Plan before file crosses 5 MB. Sub-MB target for the live file.
- **App.js extraction pass.** App.js is 1,853 lines (down from a
  ~2,200 high-water before the shell extraction). Three concrete
  targets: a `useAuctionLotProjection` hook (lifts ~140 lines of
  near-duplication between `auctionLotItems` and `watchItems`),
  a `useDerivedTaxonomies` hook for the brand / source / refs
  facets (~100 lines), display-style derivation. Could land
  App.js around 1,300–1,400. Not urgent; cleanup-rhythm work.
- **Internal-naming cleanup pass.** Three UI renames left their
  internals on the old name. Carrying the divergence indefinitely
  is a real cost — every new piece of list-related code has to
  remember "UI says lists, DB says collections."
  - **Collections → Lists** (PR #24, 2026-05-04). DB tables
    (`collections`, `collection_items`), hook (`useCollections`),
    URL params (`?col=<uuid>`), localStorage (post-Bundle-2A:
    `dial_collections_sub_tab`), `SUB_VALUES` key, mutator names
    (`addItemToCollection`, `removeItemFromCollection`, etc.) all
    still say "collections." **Decision parked**: Mark's framing
    for keeping the umbrella DB name (`collections` covers Lists,
    Wishlist, Owned, Sold, Challenges, shared inbox) is in
    CLAUDE.md and is sound — likely DON'T rename the DB layer.
    The hook + sub-tab key are the candidates if anything.
  - **Watchlist → Saved (URL renamed PR #130, internals pending).**
    URL `?tab=watchlist` → `?tab=saved` shipped Bundle 2A. Internal
    state still uses `tab="watchlist"`, hook is `useWatchlist`,
    component is `WatchlistTab.js`, localStorage is
    `dial_watch_top_tab`, plus `LEGACY_WATCHLIST_KEY` for the
    pre-Supabase data import (see Things-to-never-do — that one
    DOES NOT bump). Renaming the file + hook + state value is a
    mechanical sweep: rename the file, update every import, find/
    replace `tab === "watchlist"` to `tab === "saved"`, etc. The
    DB table for hearts (`watchlist_items`) probably stays named
    that since it's specifically the "items the user hearted"
    table, not a tab — analogous to the `collections` umbrella.
  - **References → Learn (URL renamed PR #130, internals pending).**
    URL `?tab=references` → `?tab=learn` shipped Bundle 2A.
    Internal state still uses `tab="references"`, component is
    `ReferencesTab.js`, `TAB_VALUES` entry, icon kind, schema files
    all still say "references." (Naming note: "Learn" is the
    user-facing label; "references" is fine as an internal name
    even post-cleanup since we already need a separate term for
    "watch reference numbers" — Epic 0 references-as-entities work.
    Decide at refactor time whether to touch this rename at all.)
  - **Cleanup work**: rename component files + every import,
    update internal state values (`tab="watchlist"` → `"saved"`,
    `tab="references"` → `"learn"`), keep URL/localStorage
    backward-compat (read either form, write the new one — the
    URL boundary maps already exist from PR #130), find/replace
    string literals in conditionals + tests + handoffs. Plus
    decide the DB-side rename question (probably no).
  - **Risk**: any miss = a tab silently doesn't render or a state
    machine wedge. The render-without-crash tests catch some of
    this. Manual smoke-test post-rename mandatory.
  - **Effort**: half-day to a day. Low urgency. Slot during a
    maintenance-rhythm session.
- **Maintenance rhythm.** Every 4th–5th session is hygiene only:
  bug fixes, dependency updates, source pruning, doc cleanup.
  No new features in maintenance sessions.

### Site discoverability + welcome page

**Pending:** og:image refresh (currently the 1024×1024
apple-touch-icon as placeholder; want a proper 1200×630), and the
**welcome/about page** for first-time visitors. The cold-landing
gap: a stranger hitting `the-watch-list.app` from search currently
sees the Listings feed with no context for what the site is or
how to use it. Half-session of mostly-content work.

### Privacy notice (legal/compliance)

Added to the roadmap 2026-05-06. Nothing is shipped yet.

The product collects per-user state in Supabase (watchlist items,
saved searches, hidden listings, lists, challenges, manual-entry
photos uploaded to Storage) plus anonymous telemetry (`listing_events`
keyed by an anon UUID in `dial_watch_anon_id` localStorage) and
admin-side analytics. None of this is currently disclosed in a
user-facing privacy notice. Auth-via-Google plus uploaded photos
also raise the bar for what should be in writing.

Minimum viable shape:

- A `/privacy` page (one-pager) covering: what's stored per-user,
  where (Supabase + Vercel Blob), retention, what's NOT stored
  (no sale data, no account credentials, no payment info), how to
  delete an account.
- A `/terms` companion (one-pager) — minimal, "use at your own
  risk, listings come from third parties, we don't broker sales."
- Linked from the user-dropdown footer + the welcome page once
  that ships.

When this becomes load-bearing: before Watchlist gets actively
shared with users outside Mark's circle, OR before any feature
that handles payment / personal data beyond the current scope.

### User feedback / bug report surface (parked)

Added 2026-05-06 — Mark's question: "Is there a place to put a bug
report on pages?" Currently there isn't one in-app. The minimum
shape would be a small "Report a bug" link in the user dropdown
that opens a mailto: or a Supabase-backed form.

Parked rather than active because the current loop (Mark + Claude
in the same session) is fast enough that an in-app channel adds
overhead without much yield. Revisit when others start using
Watchlist regularly.

### Mac mini infrastructure (future hardware tier)

Folded into Foundations 2026-05-05 (was a standalone Epic 6).
It's infrastructure — the same shape as the verification scripts
or the listings.json split, just deferred to a future hardware
tier. Learning project plus capability extension. Phased.

- **Phase A:** Mac mini scrapes hard sources (Cloudflare-protected,
  JS-heavy) using headed Playwright. Pushes CSVs to repo. Rest of
  system unchanged. ~1 weekend setup. Concrete and useful. The
  immediate value is moving Tropical Watch off Browse AI (only
  paid-credit dependency) and unlocking Heritage / Bonhams /
  Monaco Legend lot scraping.
- **Phase A.5 (likely combined with A):** Mac mini stores full
  dealer descriptions for tracked references. Generates reference
  guides via local LLM (Llama 3 or similar). Pushes results to
  Supabase. Powers Epic 5 encyclopedia without burning cloud LLM
  budget.
- **Phase B (later, optional):** Mac mini runs Postgres and the
  API; Vercel still serves frontend.
- **Phase C (later, optional):** Full self-hosting on Mac mini.

Watch out for: CGNAT on home internet (check before buying),
power/network reliability, SSL cert renewal, backup strategy.

Hardware: M4 Mac mini base, 16GB RAM, ~$600.

(*Source quality dashboard moved out of this epic and into Epic 8
during the 2026-05-05 review — it's about analytics, not
foundations. Cross-reference only.*)

## Epic 1: Sources

Serves **job-#1 (aggregator)**. Cover the dealer + auction-house
universe enough that the user doesn't bounce to Chrono24, eBay, Bezel,
or individual dealer sites to scan the market. Target end state: ~50
dealers + 6 auction houses, all earning their keep.

Currently at **38 dealers + 6 auction houses** (post Luna Royster +
S.Song Watches + Swiss Hours added 2026-05-04 PR #41; Avocado Vintage
removed 2026-05-05). Twelve dealers under the 50-target, so adding
remains the active mode.

### Active candidates

| Candidate | Status |
|---|---|
| Wrist Icons | WordPress; `/wp-json/wc/store/v1/products` returned 301 — follow redirect to confirm WooCommerce |
| Vision Vintage Watches | Wix (not Squarespace despite the URL trick); needs custom HTML parsing |
| Specific pushers.io dealers | reuse the Moonphase pattern (~30 lines per dealer) |

### Scraper refactor — shared helper library

Per-source structure stays the rule (one breaking site = one file
to debug). What's now ALLOWED is opt-in helpers: a new `scraper_lib.py`
exposing `fetch_shopify_products(base, collection)`,
`fetch_woocommerce_store_api(base, **filters)`, `parse_wix_products_blob(html)`,
etc. Each dealer keeps its own file and quirks; just stops repeating
~80 lines of boilerplate.

Pre-flight: 38 dealers split roughly into Shopify (~12), WooCommerce
(~6), Squarespace (~3), Wix (~3), custom HTML (~4), and one-offs
(eBay, Browse AI, Watch Club's TaffyDB). Helper library would
collapse the four big platform groups; one-offs stay one-offs.

CLAUDE.md updated 2026-05-05 to allow this. Half-day refactor with
low risk if scoped tight.

### Brand and listing curation

Mark-as-curator. Watchlist surfaces what Mark wants visible; the
exclusion + canonicalization rules accumulate in `merge.py` and
`src/utils.js`. Initial set of hard exclusions, brand consolidations,
Force-Other pooling, suppress-at-sold rules, and title-pattern
exclusions shipped (PR #50, partial PR #52).

**Pending:** more curation as Mark spots low-tier inventory.
Long-term: brand × price-floor rules ("drop Tissot under $500"),
which is filter-engineering rather than a hard exclusion.

### Stop rule (plain English: when to stop adding new dealers)

The "stop rule" is a simple agreement with myself: once dealer count
hits ~50, stop adding new ones blindly. Audit the set with click +
save data from Epic 8 (Site analytics) — figure out which dealers
users actually engage with — and prune the underperformers down to
a smaller, higher-quality set. After that, only add a new dealer
when it brings inventory we don't already cover or covers a
reference category Mark cares about.

Threshold raised from 30 to 50 on 2026-05-05 — the original 30
was set before Watchlist had analytics. Better to grow first, then
audit with real engagement data. Currently at 38, so adding remains
the active mode.

### Tropical Watch → Mac mini (cross-reference to Epic 0 → Mac mini)

Tropical Watch is the only Browse AI-routed dealer. Their site
actively blocks `requests`; Browse AI fills the gap on a paid
subscription. Move to Mac-mini-hosted Playwright when Phase A of
the Mac mini infrastructure (Epic 0) lands — removes the only
paid-credit dependency in the scrape pipeline.

### eBay integration (one of the source kinds)

eBay is a source like the dealers, just with a different shape. It
has a free Browse API (5k calls/day, OAuth); admin configures search
topics in `data/ebay_searches.json`; the scraper fetches matching
listings 3×/day. Buy-It-Now eBay items show up in the main Listings
feed alongside dealer items (`source = "eBay"`).

**What's pulled in.** Each entry in `data/ebay_searches.json` has
a `label`, a `query` (the eBay search string), an optional
`country` filter, and an optional `seller` filter. Today we run
two queries (Omega Railmaster CK2914, Heuer Autavia GMT) globally —
the original USA/UK/Europe per-region split was collapsed because
country was input-side only and never made it to the UI.

**Where eBay items show.** Buy-It-Now eBay listings flow into
Listings > Live listings as regular Cards. Auction-format eBay
items go through the +Track flow into Saved auctions. Watchlist >
Searches sub-tab surfaces the contents of `ebay_searches.json`
read-only with an "Edit on GitHub" link.

**How searches are managed.** Today: option 1 of 3 — JSON config
file edited via GitHub's in-browser editor by Mark (admin). Pending
work: option 2 — Supabase migration + admin form so Mark can
edit search topics in-app from the admin dashboard. Deferred until
the GitHub-edit friction is real.

**Saved searches vs eBay source-searches.** Two separate concepts
deliberately:
- **eBay source-searches** (admin-only) configure what eBay queries
  the scraper runs. They CHANGE THE FEED.
- **Saved searches** (per-user) are filters over the existing feed
  that any user can save. They don't change what's pulled in;
  they just rerun a filter.

**Things explicitly NOT in scope for eBay:**
- Re-listing detection (dropped 2026-04-28, too speculative).
- Broad keyword searches like "vintage Rolex". Targeted
  reference-level searches only.
- Per-user eBay search configuration. Search-topic management is
  admin-only and platform-wide, not user-controlled.

### Open submission v2 — plain English: "Suggest a source" form

The roadmap idea (deferred): a "Suggest a source" form on the public
site so users can recommend dealers Mark should add. Submissions
queue for moderation; Mark approves or declines. Not wiki-editable.

Probably 6+ months out — worth shipping only once the platform has
more than Mark + his wife as users (until then there's nobody to
suggest). Use case: a friend emails Mark — "you should add Italian
Vintage Watch Co. to Watchlist, great dealer." Friend goes to the
form, fills it in, Mark reviews and approves, friend gets notified.

Until then, Mark adds dealers himself in-session.

## Epic 2: Auction houses

Everything related to the six auction houses: calendar, per-lot
detail, archive sales, verification, future analytics. Distinct from
Epic 1 (dealers + eBay) because the scraper machinery is different
(per-house orchestrator, JSON-blob parsers, lot-detail extraction)
and the cadence + data shape (estimates, sold prices, sale dates)
have nothing to do with dealer inventory.

Serves **job-#1 (aggregator)** for the auction side, and is the
substrate that **job-#4 (reference research)** mostly draws from
once enough lots accumulate. Three layers, increasingly ambitious:

1. **Calendar** — upcoming sales surfaced in Cool Stuff > Auction
   Calendar. ✓ shipped; six houses (Antiquorum, Bonhams,
   Christie's, Monaco Legend, Phillips, Sotheby's).
2. **Live lots** — comprehensive per-lot scraping for active
   sales. ✓ shipped for the four working houses (Antiquorum,
   Christie's, Phillips, Sotheby's). Bonhams + Monaco Legend
   parked at lot level (calendar-only).
3. **Archive** — historical sales pulled in on demand. Pipeline
   shipped (PR #42); first sale in (Phillips CH080317, 42 Heuer
   lots Geneva 2017).

### House coverage gaps

- **Heritage** still to add at the calendar level — DataDome blocks
  `requests` at the TLS/browser level. Three escape hatches:
  Browse AI robot (paid credits), Mac mini at home running headed
  Playwright (Epic 0 → Mac mini), or manual entry via
  `data/manual_auctions.csv`.
- **Per-lot tracking parked for** Bonhams (Cloudflare), Monaco
  Legend (SPA with no server-rendered lot links), Heritage
  (DataDome). Same three escape hatches.

### Calendar — pending UX

**Pending — auction date display.** Today the calendar chip shows
the start date only. Auctions vary in shape: in-room sales run a
single day; online sales run ~7 days. Need to surface the date
RANGE (start + end) when they differ, and a "live now" indicator
when today is inside the window. Data is already in the CSVs +
JSON; just a render change. Half-session.

### Live lots — pending coverage gaps

**Pending coverage:** Bonhams + Monaco Legend lot scraping (parked
per Epic 1). Heritage entirely (DataDome).

### Archive (manual historical entry)

**Adding more archive sales is in-session work**, not a roadmap
item — Mark's call (the JSON-edit-and-rerun workflow is fine at
the rare cadence). The two parked target URLs (Phillips CH080218,
Antiquorum Geneva 2007-04-15) get picked up when there's reason.

### Reference-led realized-prices

Not "every auction forever" — that's the comprehensive archive
above, which is happening mostly automatically now. This is the
**research-led lens**: "show me every time the AP 5548BA has been
to auction" pulled from the accumulated lot data. UI work, not
scraper work. Lands once Epic 0's references-as-entities ships
(needs the reference table to group lots by ref).

The `lastMeaningfulPrice` field merge.py emits (PR #47) plus the
sold-price extraction work (PRs #42, #46) get us most of the
data; the missing piece is the per-reference grouping query +
view.

### Comprehensive auction inventory capture (long horizon)

What's shipping now is "active sales + on-demand archive sales."
The comprehensive vision — every lot from every supported house,
forever — wants a different storage shape (probably a Supabase
table rather than a static JSON file once lot count crosses ~5k)
and a different retention policy.

High value for serendipitous discovery and reference research —
the use case Mark experienced going through old auction catalogs
with his mum.

Plan when the time comes: migrate `auction_lots.json` to a
Supabase table, write a slow background backfill against past
sales we have URLs for, keep the static JSON as the active-sales
projection.

### Auction verification expansions (cross-reference to Epic 0)

Two checks beyond the existing count-vs-median:
- Sales whose `date_end` has passed should flip to status=ended
  within N days; flag stuck-active sales.
- New sales appearing on each house's calendar should show up in
  our calendar scrape within N days; flag misses.

Spec lives in Epic 0 (verification) but the failure modes
manifest here.

### Auction-house quality (cross-reference to Epic 8 / Site analytics)

Parallel of the Source Quality dashboard for auction houses: avg
lot price, brand mix, total hammer value, sale frequency, saved/
clicked lots. Lands in Epic 8 → Source stats (renamed from "Dealer
stats" to encompass houses too).

## Epic 3: Watchlist

Serves **job-#2 (watchlist features)**. The saved-set surface where
users monitor inventory, filter and sort, save things they care about,
file them into lists, and keep permanency across the live → sold
transition.

### Pending — Alerts on saved-search matches

Turn Watchlist from a browse tool into a daily-open tool. Built after
the saved-search inventory is rich enough to make alerts useful;
covers both dealer matches AND eBay matches in the same notification.
Email or push (decide based on user preference at sign-up). Quiet by
default — daily digest, not per-match push.

### Pending — Image cache for items in Lists

Today `cache_watchlist_images.mjs` only caches Vercel Blob copies
for `watchlist_items` rows. An item only in a user's list (not
hearted) doesn't get its image preserved if the dealer pulls it.
Affects collector-research lists where a dealer like Somlo pulls
images post-sale. Soon-ish per Mark.

Implementation: extend the cache cron to query
`collection_items.listing_id` alongside `watchlist_items.listing_id`
and cache for both sets. Same blob path, same dedup-by-listing-id —
a single cached image can satisfy a heart AND multiple list memberships.

### Pending — Strength-of-save (reinstated 2026-05-03)

Replace single-tier hearts with two levels: **"Love"** (strong,
definitive) and **"Watch"** (lighter, "keep an eye on this").

**Critical constraint:** must not add UI clutter or extra friction.
Likely a single tap that cycles through three states (none → watch
→ love → none), or a long-press to escalate. Bad UX kills the
feature; the simpler the gesture, the better.

Was rejected during Collections + Sharing v1 because it added
complexity. Reinstated because the distinction is real ("I love
this" vs "I'm tracking this lightly") and because it's the
entry-level shape of the broader Multi-signal taste capture
(Epic 7).

## Epic 4: Sharing

Serves **job-#3 (sharing)**. The bring-others-in primitive. Deliberately
narrow scope — Watchlist's share surface is a one-tap export to the
native share sheet plus a lightweight in-app receive banner.
Everything social *between* users (replies, reactions, sender
identity reveal) lives in the user's own messenger of choice
(iMessage / WhatsApp / email / Slack / AirDrop), not in this app.

### Collaborator lists — slice 4 deferred (Plan B)

Mark + wife flow: "Watches for our wedding" / "Family wishlist"
where two named users can both view AND add items to one list.
Distinct from the read-only list-share primitive — collaborators
keep their identity, and item attribution surfaces "M added" /
"J added" chips so contributions are legible.

Slices 1–3 (schema + RLS + RPCs + `useCollaborators` hook +
Manage-list sheet + accept-invite on share link) are in.

**Pending — Slice 4:** `who_added` attribution chip on item cards.
The column landed in slice 1, but slice-2 mid-build accidentally
shipped `who_added: user.id` on inserts before Mark's DB had the
column applied (caused widespread "could not find column" errors
→ hotfix #127 removed the column write). Slice 4 needs to re-add
the column write after confirming slice-1 SQL is live in the
target DB, then add the chip rendering.

**Known follow-up:** other inserts into `public.collections` (system
list auto-create, manual user-list create) currently use direct
INSERT. Mark's project hit a state on 2026-05-08 where direct INSERT
under role `authenticated` was rejected by RLS regardless of policy
expression — fix was to route challenge create through a SECURITY
DEFINER RPC (`create_challenge_v2`, schema in
`supabase/schema/2026-05-08_challenge_rpc.sql`). If/when other
direct INSERTs hit the same rejection, copy that pattern. See
CLAUDE.md "Challenge create via SECURITY DEFINER RPC" for details.

Mark picked Plan B over the lighter "anyone with the link" token
approach 2026-05-07 because the recurring use-case (couples /
family) wants persistent identity per contributor, not viral
reach.

### Things explicitly NOT in scope (reaffirmed)

- In-app messaging, reactions, replies — chosen messenger handles.
- Sender-identity exposure on the receive banner — keeps the
  primitive lightweight + deniable.
- Notifications for new shares — out-of-app messenger handles.
- Auto-redirect of shared listing links to dealer / external site —
  recipient sees the listing in the same UI they'd browse.

## Epic 5: References

Serves **jobs-#4 + #5 (reference research + reference learning)**.
The actual core value the platform builds toward — the feature
nobody else on the market has. Two distinct sub-areas, sharing the
same per-reference data substrate (Epic 0's references-as-entities).

(*This was previously labelled "References (collector resources
surface)" and was unrelated-feeling to Epic 3's "Reference-level
grouping" + Epic 0's "References as first-class entities". Pulled
together 2026-05-05 to make the chain explicit: Epic 0 builds the
reference table → Epic 5 surfaces both research and learning views
on top of it.*)

### Sub-area: Reference research (job #4)

The "compare every Seamaster 165.024 currently or recently in
market" feature. Cross-source, cross-time. Distinct from the
encyclopedia (which is reference content); this is reference
ANALYTICS over current and historical inventory.

Sub-features:
- **Reference-level grouping** — three saved 5548BAs collapse into
  one card with "3 listings, click to expand." Depends on Epic 0
  references-as-entities.
- **Per-reference search UI** — "Show me every time the AP 5548BA
  has been to auction" with prices, dates, photos, links. Pulls
  from the auction-lot dataset (Epic 2) once per-reference grouping
  is live.
- **Variation gallery** — dial / hand / bezel / case variants
  surfaced as a visual grid for a given ref. Useful for spotting
  what variations exist in market vs reading about them in
  Hodinkee. Depends on per-listing variant detection (LLM-led).
- **Listing-quality signals** — per-listing "priced above/below
  this dealer's norm" chips. Cross-references the per-dealer
  historical-price substrate (Epic 8 dealer stats) with the
  current ask.
- **Comparison view** for similar saved items — side-by-side specs,
  price, condition, dealer.

### Sub-area: Reference-number encyclopedia (job #5 — the headline learning feature)

Reference-number-led learning resource. Combines three layers:

1. **LLM-synthesised body.** Aggregates dealer descriptions,
   auction lot notes, and other on-platform writing about a
   reference number into a coherent reference guide. Refreshes
   periodically. Credit: "synthesized from descriptions by
   Hairspring, Wind Vintage, Analog Shift, ..."
2. **Curated layer.** Hand-picked links to deep dives, forum
   threads, videos, photo galleries. Public can suggest via form;
   I moderate. Inspired by explorer1016.com and similar
   collector-built sites.
3. **Live layer.** Currently-available listings of that reference
   number, plus past auction results, plus price trends.

Surfaces on listings of relevant reference numbers and as a
standalone browseable encyclopedia inside the Cool Stuff section
(today's UI label for what was originally called "References" —
see naming note below).

Watchcharts has prices. Hodinkee has editorial. Dealer sites have
inventory. Nobody has all three synthesized into a single
reference-number-led learning view drawn from the dealer market
itself. **This is potentially the platform's most differentiated
feature.**

Depends on: Epic 0 references + Mac mini Phase A (Epic 0) or cloud LLM access
for generation + accumulated dealer descriptions (already happening
passively if we start storing full descriptions for tracked
reference numbers).

Storage decision: full dealer descriptions for tracked reference
numbers stored locally on Mac mini and synced to Supabase, rather
than bloating `listings.json` for everyone.

**Moderated user contributions v2 (deferred — Epic 5 ships first).**
Users can suggest corrections to entries and propose additional
links via a contribution form. Submissions queue for moderation;
Mark approves or declines. Not wiki-editable — every change goes
through review. Probably a year+ out: the encyclopedia has to
exist first, with enough entries to make contributions useful.

### Sub-area: Tools and calculators

Tactile tools that solve specific calculation or visualization
problems collectors actually have — narrow scope by design.

- **Auction total-cost calculator (pending).** Hammer × buyer's
  premium + shipping + duty/VAT → all-in cost in user's primary
  currency. BP schedules from the four scraped houses (vary by
  hammer band, change ~yearly). Inputs: hammer, house, ship-to
  country (+ optional state/region for US sales tax). Tactile,
  runs every time a collector eyes a lot.

Resist building lug-to-lug calculators, strap-size calculators,
etc. as separate tools. Most of that calculation is better surfaced
**within reference guides themselves** — the 1675's reference guide
can include lug-to-lug context for that specific reference, where
the data is actually meaningful.

### Naming note

UI label is "Cool Stuff" (renamed 2026-05-04 per Mark from
"References"). URL key (`?tab=references`), component name
(`ReferencesTab`), and route still say `references`. The internal
"watch reference number" data concept (Rolex 1675 etc.) is also
called "reference"; when both meanings appear in the same paragraph,
prefer the explicit forms ("Cool Stuff section" and "watch reference
numbers") to keep them distinct.

## Epic 6: Collection mentality

Serves **job-#6 (collection mentality)**. The reflective layer over
"watches I own / have owned / am thinking about." Where Watchlist
becomes a thinking-tool for collecting, not just a browsing-tool for
listings.

This epic is what gives the Strategic-bets "reflective tool" position
real teeth — it's the home for everything that would feel
inappropriate in Chrono24 or eBay because those tools optimize for
transactions, not reflection.

### Watch Challenges

Constrained hypothetical collections — "3 watches for $50k", "5-watch
starter", etc. ONE collection per challenge with `type='challenge'`;
picks live in `collection_items` with `is_pick=true`; price
snapshotted into `saved_price/_currency/_price_usd` so totals are
immutable post-share. v1 + 2026-05-06 rebuild + v1.5 (receive flows
+ sender attribution) all in.

**Future — open question, not in priority order:**
- Should completed challenges be editable? v1 says no (immutable
  for share-stability). Revisit if usage demands.
- "Save this collection back to me" — when a friend takes my
  challenge and shares their completion back, I'd ideally see
  their picks nested under the original challenge with their name.
  PR #90 already wires `parent_challenge_id` on the schema; the
  receive-surface UI for saving someone else's complete-share is
  the missing piece.

**Held — Mark's "Collection Planner" pivot consideration
(2026-05-06).** Mid-session reframe: Watch Challenges is
fundamentally social (sender attribution, shared-with-me inbox,
recipient responses, response collection). Possibly merges with
Watchbox v2 as one feature: wishlist → buy → into watchbox. The
Collections build (PRs #85-#90, see below) materially advanced
the underlying data model in this direction — Owned, Sold, and
Wishlist are now hard system lists, and Wishlist is force-rankable.
The pivot is now de facto in progress; what remains is the
strategic question of whether to fold Challenges fully into the
Collection Planner mental model or keep them as siblings.

**v2 (deferred — design exploration ongoing):**
- Source from current AND past listings (sold archive becomes a
  query-able set, not just an archive tab). Depends on Epic 0
  references being normalized.
- Value-over-time tracking — show how the cost of assembling the
  collection has shifted. Powerful only after enough price history
  accumulates.
- Per-challenge cap (skipped in v1; revisit if usage patterns
  demand). Soft suggestion ("you have N challenges, consider
  archiving older ones") preferred over hard limits.

### Watchbox v2 — real ownership tracking (deferred — high personal value)

Track watches users actually own and have owned. A Watchbox is a
collection with `type='watchbox'`.

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

Use case for the returning reflection: Mark opens his watchbox three
years from now, reads what he wrote about his first Heuer, realizes
how his taste has shifted, adds a note. That arc only happens because
the reflection layer accumulated over years of small, low-friction
entries.

### Pending — AI reflection bot (delighter)

Conversational layer over the watchbox + reflection data. Helps
the user think about their own collecting: "what mistakes have I
made", "why am I gravitating toward chronographs lately", "what's
the through-line in the watches I've kept vs the ones I've parted
with." Stays narrowly scoped to the user's own data — not a
general watch knowledge bot.

Inspired by the editorial line at Screwdown Crown about why we
collect / what mistakes we make. The bot is the collector-mind
equivalent.

Depends on Watchbox v2 + reflection-layer data + cloud LLM access
or Mac mini local LLM (Epic 0).

## Epic 7: Discovery & recommender

Serves **job-#7 (discovery / recommender)**. Expand the user's
awareness beyond what they already know. Obscurity is relative to
the user's browsing pattern, not absolute — what's obscure for a
Rolex-only collector is everyday for a Heuer-deep one.

This epic is enabled by — and only meaningful after — Epics 3
(watchlist data), 6 (taste-rich watchbox data), and 8 (engagement
data). Depth-first ordering: don't ship a recommender until the
inputs are rich.

### Multi-signal taste capture

Beyond binary heart/no-heart, capture calibrated taste signals along
a spectrum:

- **Love** — strong positive
- **Watch** — light positive (covered by Strength-of-save in Epic 3)
- **Keep but don't recommend** — neutral; don't surface in suggestions
  but don't actively reject
- **Not for me but show others** — mild negative for me only
- **Never recommend this kind of thing** — strong negative

Hide is currently doing too many jobs (clutter removal, taste signal,
"I don't want this"); this disambiguates them.

Powers the AI taste model with calibrated signals. Implementation
can be progressive: start with the strongest signals (Love, Never),
add finer-grained ones as the UI for capturing them gets easier.

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

Restricted initially to Mark's household. Can extend to friends
later, or remain admin/household only indefinitely. Cost estimate:
pennies per month at current scale.

Depends on Multi-signal taste capture + embeddings infrastructure
(Supabase pgvector, computed once per listing on first sight).

### Deferred under this epic

- **Taste arcs** ("you love Rolex, fall out, return"). Defer until
  embeddings prove themselves; embeddings cover ~70% of this
  naturally.
- **Cross-source duplicate detection.** Possibly combine with
  reference normalization.

## Epic 8: Site analytics (admin-only)

A separate area of the same site (`/admin` route, gated to my
Supabase user ID via `REACT_APP_ADMIN_EMAILS`). Hidden from regular
users. Different visual language: dense, data-heavy.

Two halves with different signals and different consumers:

### Source stats (renamed from "Dealer stats" 2026-05-05 — covers houses too)

About *supply* — the inventory side of the marketplace. Powers
inventory decisions: which dealers to keep, which to prune, which
brand/model verticals are well-served, where the gaps are.

- **Pending — sales by watch type per dealer.** For each dealer,
  break sold inventory down by brand × decade × type (chronograph
  / dive / dress / etc.). Two uses: (a) tells me which dealers
  reliably surface a given vertical (Heuertime → Heuer chronos,
  no surprise; useful for the long tail) and (b) feeds future
  dealer recommendations on listing pages ("dealers who sell
  more 1960s Rolex chronos: ..."). Also gates Strength-of-save's
  taste-vs-dealer-norm question.
- **Pending — cross-source live inventory** for any reference.
  Side-by-side prices for the same ref across dealers in stock
  today.
- **Pending — listing-quality signals.** Per-listing "priced
  above/below this dealer's norm" chips. Lighter-weight version
  of the personal taste-relative pricing idea below.
- **Pending — auction lot prediction.** "Phillips Geneva has 3
  lots that match your interests." Cross-references saved-set
  embeddings with the comprehensive auction-lot scrape.
- **Pending — personal taste-relative pricing.** "This Heuer is
  priced 15% above where similar Heuers from this dealer have
  sold in the last year." More personal than the listing-quality
  signal above; shares the per-dealer historical-price substrate.

### User stats (visitors, clicks, hearts, list-saves, shares)

About *demand* — what users actually engage with. Pre-2026-05-05
only **saves** (`watchlist_items`) and **hides** (`hidden_listings`)
were captured, and only for signed-in users.

- **Pending — public surface.** A "what's hot this week" strip on
  the Listings tab, derived from anonymised engagement rollups.
  Gated behind enough volume to anonymise meaningfully — defer
  until traffic warrants.
- **Pending — per-listing top rows.** "Most viewed" / "most saved"
  / "most shared" lists in AdminTab. Useful once a few weeks of
  rollup data accumulates; until then, the per-source columns
  carry the signal.
- **Pending — privacy disclosure.** A one-line tracking note on
  the Welcome page (Epic 0). Defensible already (admin-only reads,
  no PII), but the note is correct etiquette and small to ship.

**Out of scope for v1**: filter usage telemetry, time-on-listing,
scroll depth, search-query analytics. Add only if the per-listing
events prove useful and Mark wants more granularity.

What Watchcharts already does well: don't compete on historical
price-per-reference. Use it; build what it doesn't.


## Priority order

Current best-guess sequence. Will shift; update this doc when it does.
Last refreshed end of 2026-05-09 — Watchlists IA + Realtime + auction
time-of-day fix + listing velocity all shipped today; reactions and
usernames now plausible follow-ons because Realtime is in place.

1. **Watchbox v2 — reflection + watch management on My Watches
   (Epic 6).** Promoted from #10 today — Mark's stated "after the
   bugs" goal. Owned + Sold + Wishlist are already real (the
   Collections build moved the data model here); what remains is
   the reflective UX layer. Reasonable scope choices to pick from:
   per-watch reflection journal (why bought / how reality compared /
   would-buy-again), deeper purchase-and-value tracking (purchase
   date + condition + service history + value-over-time), watchbox
   journey narrative (single editable per-user collecting story),
   detail-page-per-watch as the shell that holds everything.
2. **Usernames / display_name on user_profiles.** Load-bearing for
   reactions + the `who_added` chip readability. Default derives
   from `auth.users.raw_user_meta_data.full_name` (Google fills
   this) → email-local-part fallback. Editable in Settings.
3. **Reactions on shared-list items.** Schema +
   `collection_item_reactions` table. Realtime pipe is in place
   (#150) so updates push immediately. Depends on usernames so
   chips read clean. Mark's "watch group voting" use case.
4. **Welcome page + og:image (Epic 0).** First-impression page for
   non-share visitors. og:image still the 1024×1024 apple-touch-icon
   placeholder. Half-session.
5. **Privacy notice + minimal terms (Epic 0).** Becomes load-bearing
   before Watchlist gets shared with users outside Mark's circle.
   One-pager `/privacy` covering Supabase + Vercel Blob storage,
   retention, deletion; companion `/terms` ("use at your own risk,
   listings come from third parties"). Linked from the user dropdown
   footer.
6. **References as first-class entities (Epic 0).** The remaining
   foundation. Several downstream features (Epic 5 encyclopedia,
   per-reference comparison views, auction lot grouping, Discover
   mode quality, per-reference velocity rollup) gate on this.
7. **Image cache for List items (Epic 3).** Extend
   `cache_watchlist_images.mjs` to cover `collection_items`, not
   just `watchlist_items`. Promoted by Mark 2026-05-05; deferred
   through the Collections build. Newly-relevant after the
   Collections build because Owned/Sold/Wishlist all live in
   `collection_items` and benefit from the cache.
8. **"Save someone's complete-share back" — child-challenge linkage
   (Epic 6).** When a friend shares THEIR completion of MY
   challenge back to me, I should be able to save it as a child
   challenge with `parent_challenge_id` linkage. Schema column
   already exists from 2026-05-03; the receive-side UI to surface
   "save this collection" on the complete-receive page hasn't been
   built. Closes the social loop fully — Mark's "three other
   friends' solutions sent back to you" framing.
9. **Site analytics — remaining Source-stats extensions (Epic 8).**
   User stats + throughput-in-value + auction-house quality + per-
   source / per-brand cycle-speed all shipped through 2026-05-09.
   Remaining: sales by watch type per dealer (gated on Epic 0
   references for "type" classification), cross-source live
   inventory (also Epic-0-gated), per-reference velocity (Epic-0-
   gated), listing-quality signals, taste-relative pricing.
10. **Strength-of-save model (Epic 3 + Epic 7 entry point).**
    Two-tier (Love / Watch) is the gesture entry point to the broader
    Multi-signal taste capture. Small UI lift; the feature is *the
    gesture*, not the underlying data.
11. **Source pruning (Epic 1 Stop rule).** At ~50 dealers, audit
    with the click + save data and prune. Currently at 38.
12. **Mac mini Phase A (Epic 0).** When Tropical Watch hits a Browse
    AI snag OR when Heritage / Bonhams / Monaco Legend need a
    Playwright runner OR when ready to start Epic 5 encyclopedia
    generation. Also potentially relevant if Phillips' WAF tightens
    to block single-URL fetches too — the auction-page Turbo-Stream
    pattern from PR #100 buys time, but tracked-lot detail-fetches
    are still single-URL today.
13. **Epic 5 encyclopedia.** Built incrementally as dealer
    descriptions accumulate. Depends on Epic 0 references + Mac
    mini A.5 for local LLM generation (or cloud LLM access).
14. **Multi-signal taste capture + Discover mode + AI recommendations
    (Epic 7).** Stack progressively. Multi-signal first; Discover
    and recommendations layer on top once signals are rich.
15. **Watch Challenges further polish (Epic 6).** Audit-deferred
    items from 2026-05-06: autosave indicator, hoist hardcoded
    colors to tokens, mobile tap-confirm on slot remove, target=7-
    style orphan-row layout, share-success state, sticky-pick-
    shrink-on-scroll. (Cool Stuff resource cards card-unification
    is the only remaining cosmetic carry-over; "save complete-share
    back" graduated to its own #8 priority above.)
16. **Watch Challenges v2 (Epic 6).** Past-listings as a source,
    value-over-time tracking, challenge response threads — once
    Epic 0 references land.
17. **Comprehensive auction inventory capture beyond active sales
    (Epic 2).** Substrate for serendipitous discovery + reference
    research at scale.

**Items deliberately NOT in the priority order:**

- **Manual historical auction entry (Epic 2 archive layer).** The
  pipeline shipped (PR #42); adding more archive sales is
  in-session work, not a roadmap item — Mark's call 2026-05-05.
  The JSON-edit-and-rerun workflow handles Phillips trivially; the
  Antiquorum-archive enumerator is a session of work if/when needed.
- **Open submission v2 (Epic 1).** Deferred until there are users
  who'd benefit from suggesting sources.
- **Personal-learning agent side track.** Brand-watcher agent and
  maintenance-assistant agent both accepted in concept (2026-05-05);
  defer the build to its own session whenever Mark wants to start.

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

> **Note on epic numbers in older entries.** The 2026-05-05 evening
> restructure changed the epic numbering: Epic 3 (Lovable features)
> split into Epic 3 Watchlist + Epic 4 Sharing + Epic 6 Collection
> mentality + Epic 7 Discovery & recommender; old Epic 4 (Site
> analytics) became Epic 8; old Epic 6 (Mac mini) folded into Epic 0.
> Epic 0/1/2/5 numbering unchanged. Entries below dated before
> 2026-05-05 evening reference the pre-restructure scheme.

- 2026-05-09: **Watchlists IA + Realtime + auction time-fix +
  velocity.** 8 PRs merged (#144–#151), 4 SQL migrations applied
  via MCP. Six arcs:
  - **Watchlists IA pass (PRs #144–#148).** Tab rename Saved →
    Watchlists. Strip 5 → 4 pills (Lists / Favorite searches /
    Owned Watches / Challenges; "My Watches" relabel mid-day).
    Saved virtual list at top of Lists view (synthetic
    `__saved__`, backed by `watchlist_items`, non-deletable);
    Shared-with-me as second permanent. Drill-in filter row
    (#145) — Date / Price / $ / Source / Brand inside a list.
    View-settings inline (#147) — Currency / Theme / Columns
    move out of SettingsModal into mobile filter drawer +
    desktop account menu. Heart icon clarifications (#148):
    Listings Saved chip heart goes red; Watchlists tab pill
    heart → bookmark glyph.
  - **Share flow rewrite (#146).** "Collaboration Link" /
    "View Only Link" buttons. Token-based accept (`?invite=<id>`
    in URL) bypasses email-match gate via two new RPCs:
    `accept_invite_by_token`, `pending_invite_by_token`.
    Receiver page surfaces Collaborate / View only as explicit
    choices instead of an implicit Save-a-copy fallback ladder.
    `who_added` attribution chip (slice 4) re-added to JS write
    path + new `list_members_for_collection` RPC for any-member
    roster reads. Chip renders only on lists with 2+ members.
  - **iOS PWA favicon (#144).** Added 180×180
    `apple-touch-icon-180.png` (the size iOS reads on Add-to-
    Home-Screen) + `manifest.json`. The 1024×1024 icon was being
    rejected by iOS so it fell back to a screenshot.
  - **Auction time-of-day awareness (#149).** EU-timezone auctions
    whose date was today but start time hadn't passed got pinned
    to Archive Sold. Three call sites now check
    `auction_start > now` AND `auction_end > now` before trusting
    `status:"ended"`. Plus second cron at 12/16/20 UTC for the
    auction-lot scraper — daily 06:00 calendar walk unchanged.
  - **Realtime on shared lists (#150).** `useCollections`
    subscribes to postgres_changes events on `collections` +
    `collection_items`; debounce-bumped refetch tick converges
    local state to canonical DB after wife's writes propagate.
    RLS enforced server-side on broadcast. Migration adds the
    two tables to `supabase_realtime`. Free tier handles family
    use comfortably; Pro tier ($25/mo) is the next cliff at
    ~5–10k actively-grouped users.
  - **Listing velocity (#151 + #152 stacked).** Per-card SOLD
    chip now reads "SOLD · 4d" (auction-shaped rows skip the
    suffix). New `daysOnSale` / `daysOnSaleLabel` helpers in
    utils.js. Admin Source-quality table gets "Cycle (30d)"
    column. Per-brand velocity rollup table (#152, stacked)
    between Source quality and Auction-house quality, default
    sort = ascending Cycle so fastest-flippers float to the
    top. Per-reference rollup deferred — depends on Epic 0.

- 2026-05-08 (afternoon/evening continuation): **UI consistency +
  design system + create-list bug fix + Supabase cleanup.** 12 commits
  on `eod-cleanup-2026-05-08` (now pushed). Three arcs:
  - **Design system layer.** New file [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
    + CLAUDE.md pointer. Tokens added: `--brand`, `--danger`,
    `--accent-positive` CSS vars; `actionButton`, `signInButton`,
    `inputBase`, `innerToggleButton` style tokens. Components added:
    `EmptyState` (3 sizes), `Section` (lifted from CollectionsTab).
    88+ inline hex literals consolidated to vars; ~30 inline
    button/empty-state copies migrated to tokens. Net negative LOC.
    `inp` prop-drilling removed across 9 files + test fixtures.
  - **Create-list RLS fix.** `create_collection_v2` SECURITY DEFINER
    RPC (same pattern as `create_challenge_v2` from earlier in the
    day). `createCollection` JS now routes through the RPC. Migration
    applied to production via Supabase MCP. Same-pattern follow-ups
    for `ensureSharedInbox` and the hard-list auto-create stay
    deferred (rows already exist for Mark; only fire for new users).
  - **Supabase security hardening.** Enabled RLS on
    `listing_events_daily` (was advisor-flagged ERROR — policies
    inert). Revoked anon EXECUTE on 15 SECURITY DEFINER functions;
    revoked authenticated EXECUTE on `rollup_and_prune_listing_events`
    + `rls_auto_enable`. Pinned `search_path` on
    `default_watchlist_cap` + `prevent_system_collection_delete`.
    Added intent-documenting `comment` on `admin_emails` table +
    `listing_events.Anyone insert` policy so future audits don't
    re-flag. Deleted three stale local SQL files
    (failed-RLS-attempt migrations + COMBINED catch-up bundle).
    Dropped the broad `watch-photos` bucket SELECT policy (public
    URL fetches via getPublicUrl bypass storage RLS, so no
    rendering impact). Schema-wide `alter default privileges`
    revoke from anon held for the user to apply via SQL editor
    (needs superuser).
  - **list_collaborators type-cast fix.** `auth.users.email` is
    varchar but the function declared `user_email text` — Postgres
    raised "structure of query does not match function result type"
    once any auth.users row joined. Added `::text` casts.
  - **Critical regression caught + fixed in same PR sequence:** the
    initial `--brand`/`--danger` migration's batch perl pass
    rewrote the var DEFINITIONS too, producing self-referencing
    `var(--brand)` for the var values. Caught + fixed before push.
- 2026-05-08: **Bundle 2A IA shipped end-to-end + List Sharing v2
  collaborator slices 1–3 + saved-search \$ filters + RLS investigation
  + a flotilla of hotfixes.** ~20 PRs (#121 → #140), 9 SQL migrations
  applied. Three arcs:
  - **Bundle 2A.2b — Saved tab consolidation (5 sub-tabs).** PRs
    #133 (collapse hearted Listings/Auctions/Sold into one Saved
    pill with a toggle), #134 (consolidate Shortlist into My
    watches as a fourth Owned/Sold/All/Shortlist toggle + enlarge
    Shortlist row cards), #135 (merge the toggle into the filter
    row). End-state Saved strip: Saved / Searches / My watches /
    Lists / Challenges (5 pills). Plus #117/#118 (label + structural
    collapse from 2026-05-07 evening), #130 (URL key alignment:
    `?tab=saved` / `?tab=learn`), #129 ("X new" → "X new this
    week"), #131 (add-to-list sort + mobile sub-tab horizontal
    scroll).
  - **List Sharing v2 — Collaborator lists, slices 1–3.** PR #121
    (schema + RLS expansion via `can_view_collection` /
    `can_edit_collection` security-definer functions), PR #122
    (RPCs + `useCollaborators` hook surface + Manage-list sheet
    on collection drill-in), PR #123 (accept-invite **on the share
    link** at `?list=<id>&shared=1` with focused share-receive
    surface — same hooks-isolation pattern as ShareReceiver /
    ChallengeReceiver). Slice 4 (`who_added` attribution chip on
    item cards) deferred — needs to re-add the column write that
    was removed in hotfix #127, after confirming slice-1 SQL is
    live in target DBs.
  - **Saved-search \$ filter persistence (the long-flagged bug).**
    PR #136 (SQL: `min_price` / `max_price` nullable numeric
    columns) + PR #137 (JS: full wiring across `useSearches` hook,
    AddSearchModal, inline editor, FavSearchModal heart capture,
    `runSearch` re-apply, `savedSearchStats` count, `currentIsSaved`
    dedup). End-to-end so a saved "Speedmaster pro under \$5k"
    actually persists + restores the band on tap.
  - **The deep RLS investigation (PR #138 + #139).** Mark hit
    "Couldn't create challenge: new row violates row-level
    security policy for table 'collections'" even after applying
    PR #132's INSERT policy fix. 40 minutes of SQL probing (full
    findings preserved in PR #139's description) established that
    `with check (true)` ALSO fails under the simulated authenticated
    session, while RLS-disabled INSERT works fine. Never fully
    diagnosed root cause — likely a project-specific relcache /
    policy-evaluation quirk. Pragmatic fix: route challenge create
    through a SECURITY DEFINER RPC (`create_challenge_v2`) that
    bypasses RLS while still resolving `auth.uid()` to set
    `user_id`. CLAUDE.md gained a note about this pattern as the
    fallback when direct INSERT hits the same RLS rejection in
    future. Plus PR #138 aligned the INSERT policy roles from
    `{authenticated}` → `{public}` (the policy-creation half of
    the fix that didn't end up sufficient on its own).
  - **Production white-screen hotfixes.** PR #120 (TDZ: useEffect's
    deps array referenced a state variable declared LATER), PR
    #124 (referenced `props.X` after destructuring props at the
    top), PR #126 (`user undefined` inside ListsView; collections
    mapper dropped `user_id`), PR #127 (`who_added` column missing
    on Mark's DB — JS payload included the column before slice-1
    SQL was applied). Four white-screens in one session because
    shell smoke tests use `mockShellProps` with pre-built JSX
    consts that never render the actual component trees. PR #128
    added render-without-crash tests for App / CollectionsTab /
    WatchlistTab to close that gap, plus three new
    Things-to-never-do entries in CLAUDE.md.
  - **End-of-session ambiguous-column SQL bug** (PR #140) —
    `list_collaborators` RPC had unqualified `select user_id from
    public.collections` shadowing the OUT parameter; alias the
    table + qualify the column.
  - **Cleanup pass:** 27 merged-PR local branches deleted, dead
    `ShareBanner.js` removed, dead `extractRef` / `logToPrice`
    exports stripped from utils, `.gitignore` rules for macOS
    Finder dupes added.

- 2026-05-06 (late evening, addendum): **Three more shipped after
  the EOD doc pass:** Collections four-sub-tab restructure (PR #99,
  My collection / Wishlist / Lists / Challenges — replacing the
  flat hard-lists-on-top index from PR #86); Lot # catalog-order
  sort pill on auction sub-tabs (PR #98); **Phillips full
  enumeration via Turbo-Stream** (PR #100, 6 → 224 lots — see
  CLAUDE.md "Scraper conventions" for the mechanic). All four
  auction houses now at full coverage for the May 9-10 sales.

- 2026-05-06: **Collections build (PRs #85–#90) + auction-scrape
  fixes + UX polish.** Major arc of work captured in the priority
  order + Epic 3 Collections refactor section.
  - **Watch Challenges v1.5 ✓ shipped** (PRs #78, #80, #90):
    `?newchallenge=1` and `?challenge=<id>&shared=1` receive
    flows, sender attribution via `&from=<senderName>`,
    "Sent to you" / "Yours" sections, sign-in CTA on receivers,
    `setTabWithReceiveEscape` so the logo + main tabs let you
    out of share-receive surfaces. Closed out the previously-#1
    priority.
  - **Collections becomes a top-level tab** (PR #86) — Mark's
    locked plan "everything is a list." Owned, Sold, Wishlist
    auto-create as hard system lists (PR #85). Lists moved out
    of Watchlist; Watch Challenges moved out of Cool Stuff;
    both now live under Collections. Mobile bottom-bar grows
    from 2 → 3 pills. Old `?tab=watchlist&sub=collections`
    redirects to `?tab=collections`.
  - **Manual entry + photo upload** (PR #87) on Owned/Sold —
    `is_manual` boolean + `manual_*` columns, new `watch-photos`
    Supabase Storage bucket with RLS per-user folders, client-
    side canvas resize to 1600px JPEG q0.85 before upload
    (typical 5-10× cut on phone photos).
  - **Archive picker + Owned→Sold transition** (PR #88) —
    `ListingPickerModal` for picking from Favorites/Lists/feed/
    paste-link. `MarkAsSoldModal` captures sold price + date.
    Card extended with optional `extraMenuItems` so the "..."
    menu can carry "Mark sold" without Card knowing about
    collection semantics.
  - **Wishlist force-rank** (PR #89) — `position` column,
    vertical ranked list with ↑/↓ controls, optimistic local
    update + parallel UPDATE persistence.
  - **Auction-scrape coverage gap fixes** (PRs #93, #94) —
    Christie's full pagination via `lot_search` API + Phillips
    WAF retry-with-backoff; Sotheby's full enumeration via the
    apolloCache `lotCards` array on any single lot page (151
    lots vs the previous 48-lot SSR ceiling). Mark's report
    that auction coverage was at ~50% across the board for the
    upcoming May 9-10 Geneva sales — fixed in time for the
    sales to land in the data.
  - **Smaller wins.** Saved-search count + sub-tab fix (PR
    #91) — the "17 for sale but only 3 shown" bug. UI fixes
    bundle (PR #92) — HardListRow image strip width, picker
    chip overflow, restored Share + Delete buttons on
    challenges list rows. Browser back/forward parity (PR #96)
    — pushState on real navigations + popstate listener;
    fixes "back leaves the site" behaviour. Listings divider
    deduplication (PR #95) — backfilled items collapse under
    one "Earlier additions" header so duplicate "Last week"
    headers can't appear.
  - **Roadmap additions**: privacy-notice section under Epic 0
    (legal/compliance, becomes load-bearing before broader
    sharing); user-feedback / bug-report surface parked under
    Epic 0; catalog-order sort for auction lots added at
    priority #6.

- 2026-05-05 (evening): **Roadmap section-by-section review.** Per
  Mark, the roadmap had drifted from how he was actually thinking
  + building. Walk-through restructured the doc:
  - **Strategic bets demoted "reflective tool"** from primary
    framing to one-of-several distinguishing positions.
  - Added a **Jobs-to-be-done chain** as the priority-ordering
    principle (aggregator → watchlist → sharing → reference
    research → reference learning → collection → discovery →
    commercial signals).
  - **Epic 3 (Lovable features) split into four:** new Epic 3
    Watchlist, Epic 4 Sharing, Epic 6 Collection mentality, Epic 7
    Discovery & recommender.
  - **Epic 5 (References)** kept its number; restructured into
    Reference research vs Reference learning vs Tools vs Curated
    links sub-areas to match Mark's distinction between research
    (analytics over inventory) and learning (encyclopedia /
    editorial).
  - **Epic 8 (Site analytics)** = old Epic 4 renumbered. Dealer
    stats half renamed Source stats to encompass auction-house
    analytics too.
  - **Mac mini infrastructure** (was standalone Epic 6) folded
    into Epic 0 as a future-hardware-tier sub-section. Same
    phasing (A / A.5 / B / C); just lives next to the other infra
    items.
  - **Epic 1 + Epic 2 split adjusted** so Epic 1 covers dealers +
    eBay (the dealer-shaped sources) and Epic 2 covers the full
    auction-house pipeline (calendar + lots + archive). Auction-
    house gaps moved out of Epic 1 into Epic 2.
  - **eBay integration moved from old Epic 3 to new Epic 1** — it
    was always source-shaped work, not a "lovable feature."
  - **Pending review block deleted** — items dissolved into the
    right epics during the review.
  - **User journeys section deleted** — the two forward-looking
    journeys (Returning Reflection, Source Suggestion) folded
    into the relevant epics' descriptions.
  - **Constraints note** about commercial intent reframed so it
    doesn't conflict with job-#8 (commercial signals).

- 2026-05-05 (afternoon): **Roadmap review + Avocado prune.** Per Mark:
  - **Avocado Vintage removed.** Scraper file, merge.py SOURCES
    entry, workflow steps, README dealer table, and 66 `state.json`
    entries all dropped. Dealer count 39 → 38.
  - **Stop-rule threshold raised 30 → 50.** Original 30 was set
    before analytics existed to inform a meaningful prune.
  - **"Listing event capture" → "Site analytics"** with explicit
    Dealer stats (existing) and User stats (new build) halves.
    User stats expanded to include list-add + share events
    alongside view / click / save / hide. Dealer stats expanded
    with throughput-in-value, sales-by-watch-type per dealer,
    listing-quality signals, taste-relative pricing.
  - **Phase D / manual historical auction entry dropped from
    roadmap.** Becomes in-session work as needed; the existing
    JSON-registry + scraper workflow is sufficient at the rare
    cadence Mark adds archive sales.

- 2026-05-05 (morning): **Auction-coverage step-change + small
  fixes (PRs #45 → #48).** Four PRs on a single day:
  - **PR #45** — auction lot brand detection: Sotheby's titles
    are pure model descriptions ("Baignoire, Reference 866034 |
    A yellow gold ..."), so Cartier-branded lots had been landing
    in "Other". New `detectAuctionLotBrand` walks `data.maker` →
    title → "<Maker> — " description prefix → full description.
    Brand chip rail also scoped per active sub-tab so Live
    auctions doesn't show brands with zero matches. Major
    Auctions Links entry got a friendly label override
    (CH080317 → "Phillips · Exceptional Heuer Chronographs from
    the Jack Heuer Era"). Auction total-cost calculator added to
    Cool Stuff > Tools as pending.
  - **PR #46** — Sotheby's lot images. Per-lot fetch to grab
    canonical brightspotcdn URL from `og:image` (with body-scan
    fallback for the small minority of lots without the meta
    tag). 100% coverage on the 15-lot smoke sample. ~+2.4 min
    per cron.
  - **PR #47** — `merge.py` emits `lastMeaningfulPrice` (last
    non-zero entry from priceHistory) on every enriched record.
    Backend-durable version of the inline priceHistory walk Card
    had been doing. Frontend prefers the field, falls back to
    the walk for older state snapshots. Four new pytest cases.
  - **PR #48** — auction lot scrape coverage step-change.
    Phillips cap 60 → 1000 (CH080226 has 227 lots, HK080226 has
    308; cap was missing 70-80% of every large sale). Antiquorum
    switched from `catalog.antiquorum.swiss` (paginated `?page=N`
    301-redirects, vendor broken) to
    `live.antiquorum.swiss/...?limit=1000` — single 5MB fetch
    returns the full `viewVars.lots.result_page` array. CDGBNO:
    540 lots in ~2s (was 20). ~+25 min per daily auctions cron;
    well under the 6h job timeout.

- 2026-05-05 (very early AM): **Phase D first archive sale shipped
  (PR #42).** 42 Heuer lots from "The Crosthwaite & Gavin
  Collection: Exceptional Heuer Chronographs From The Jack Heuer
  Era" (Phillips Geneva, 2017-11-11) land in Listings > All sold.
  Hammer range CHF 7,500–137,500. Generalised pipeline so adding
  another archive sale is one append to
  `data/manual_archive_sales.json` + one `manual_archive_scraper.py`
  run + commit. Output lives in `public/manual_archive_lots.json`
  (separate file from `auction_lots.json` so the daily comprehensive
  sweep doesn't clobber archive entries on every cron). App.js
  loads + merges into `auctionLotItems` alongside the comprehensive
  + tracked-lot sources. Two `scrape_phillips_lot` bugs fixed
  along the way (also benefit the daily sweep): `sold_price` was
  the LOW estimate not the hammer (existing comment had flagged
  "provisional until validated against a sold lot" — this was the
  validation; now extracts from the rendered "Sold For" panel),
  and `is_excluded_title` was matching "o'clock" inside watch
  titles ("date aperture at 6 o'clock"), silently dropping 9 of
  42 lots. Next-session: Phillips CH080218 (drop-in append) and
  Antiquorum 2007 Geneva (needs the Antiquorum side of the manual
  scraper plumbed in).

- 2026-05-04 (overnight): **Cool Stuff (was References) + Links
  page + Watchlist sub-tab UX tweaks + 3 new dealers (PRs #38 →
  #41).** Five PRs that landed after the Watchlist restructure
  doc PR (#37):
  - **PR #38** — five Watchlist sub-tab UX fixes:
    `displayedCount` (shellProps now exposes the right count for
    Watchlist vs Listings; previously the count badge read the
    Listings figure regardless of tab); mobile sub-tab strip no
    longer scrolls (trailing +buttons removed and moved into a
    new `subTabIntroJSX` per-sub-tab intro banner); Lists rows
    drop the heavy left accent; heart + ⋯ tap targets scale with
    card density (26px at compact, 36px at 1/2/3 cols).
  - **PR #39** — Top-tab label "Reference" → "Cool Stuff"
    (label-only; URL key + component name unchanged for
    bookmark-stability). New Cool Stuff > **Links** resource:
    auto-derived Dealers list, hand-curated Reference clusters
    per watch reference (1675, 7021, Seamaster 300, 1016, 5548
    BA, 1803, Heuer), Art / Straps / Editorial sections.
    WatchlistTab signed-out copy now per sub-tab via
    `SIGNED_OUT_BY_SUBTAB`. Dead-code sweep: −150ish lines (the
    sidebar drag-resize machinery, `statusSegmentJSX` /
    `endingSoonJSX` `null`-pass-through wiring, sidebar toggle,
    11 unused App.js imports). SEO basics shipped: `<title>` +
    `<meta description>`.
  - **PR #40** — test fixes: PR #38 + PR #39 each missed a mock
    fixture / test-string update; CI on main caught both.
    Process flag in next-session for shell-prop changes.
  - **PR #41** — Cool Stuff v2: lifted `subTabIntroJSX` to a
    real `SubTabIntro.js` component used by both WatchlistTab +
    ReferencesTab, so Cool Stuff landing matches the Lists +
    Saved-searches visual shell. Cool Stuff > Links sections
    converted to accordions. New Major Auctions section seeded
    with Phillips CH080317 (the actual lot scrape for that
    archive sale is real Phase D work, parked). **Three new
    dealer sources** lift count 36 → 39: Luna Royster (NYC,
    WooCommerce), S.Song Watches (Shopify, scoped to
    `/collections/vintage`), Swiss Hours (Shopify, scoped to
    `/collections/watches`).

- 2026-05-04 (latest): **Watchlist sub-tab restructure + Challenges
  to References + Lists UI tweaks (PRs #34, #35, #36).** Three more
  PRs after the listings restructure landed, mirroring the same
  pattern on Watchlist:
  - **PR #34** — docs sync for the listings sub-tab work.
  - **PR #35** — listings tweaks: richer Antiquorum lot titles,
    sold-with-historic-price fallback in Card, top-of-feed count
    on desktop, `data/manual_lot_urls.json` config + plumbing in
    `auction_lots_scraper.py`, `verify_auction_lots.py` health-
    check + cron wiring.
  - **PR #36** — Watchlist gets 5 sub-tabs mirroring Listings:
    Saved listings (sort: savedAt desc) / Saved auctions (sort:
    ending-soonest, +Track eBay button moves here, Buy-It-Now eBay
    items always live here regardless of format) / Saved sold
    (sort: sold-date desc, sold-date dividers) / Favorite searches /
    Lists. Removed: Status segment, Auctions-only toggle, EndingSoon
    pinned strip, watchLive/Sold derived memos. Watch Challenges
    moved from a Watchlist sub-tab to a resource under the
    **References tab** (challenges are a reflective collector
    resource, not a saved-items surface). Lists sub-tab also got a
    help banner + folder-icon disc treatment per Mark feedback.

- 2026-05-04 (later PM): **Listings sub-tab restructure (PR #33).**
  Replaced Phase A's tri-state All/Dealers/Auctions pill +
  weighted-blend sort + Lots/Calendar toggle with four explicit
  Listings sub-tabs:
  - **Live listings** — currently-active dealers, sort newest
    `firstSeen` first, date dividers (Today / Yesterday / weekday /
    Last week / Older).
  - **Live auctions** — currently-active auction lots, sort
    ending-soonest (live → upcoming asc → ended desc → non-auction
    last), no date dividers.
  - **All sold** — sold dealers ∪ sold auction lots, sort
    most-recently-sold first, sold-date dividers.
  - **Auction calendar** — month-banded list of upcoming sales.
  Date pill semantics depend on sub-tab; Price pill uniform.
  Sub-tabs gate filter exposure (Live listings hides Auction
  houses chip group; Live auctions hides Dealers; Sold + Calendar
  show both). Calendar sub-tab hides the filter row entirely.
  Removed: `feedFilter` state, `auctionsView` state, `blendBucket`
  function + BLEND_* constants, "Ending" sort pill, Status segment
  on Listings (kept on Watchlist). URL: `?tab=listings&sub=<live|auctions|sold|calendar>`.
  Things-to-never-do entries added in CLAUDE.md to prevent the
  pill + blend sort from coming back.

- 2026-05-04 (PM): **Unified listings/auctions feed + comprehensive
  auction-lot scrape + heart-on-lot (Phases A / B1 / B2, PRs
  #30 / #31 / #32).** Net deliverables:
  - **PR #30 (Phase A):** Listings tab gets a tri-state All /
    Dealers / Auctions pill in the filter row. Tracked-lot data
    projects into the main feed alongside dealers; "All" view's
    default Date sort uses a weighted blend (lots ending within
    14 days at top, dealers + far-out lots middle by
    effectiveDate, recently sold next, older sold last). Auction
    houses appear in the source filter under a sub-header.
    Calendar of upcoming sales moved out of `Watchlist > Calendar`
    (sub-tab removed) into `Listings > Auctions > Calendar`
    toggle. Hearts on auction-lot cards stay no-op via the
    existing `_isTrackedLot` guard pending Phase B2.
  - **PR #31 (Phase B1):** New `auction_lots_scraper.py` walks
    every active sale in `auctions.json` and pulls per-lot detail
    for the four houses with working access. Antiquorum (catalog
    page → per-lot fetch), Christie's (inline
    `window.chrComponents.lots` blob), Sotheby's (`__NEXT_DATA__`
    algoliaJson.hits, paginated), Phillips (auction-page tile
    enumeration → per-lot fetch, capped at 60/sale). Output goes
    to `public/auction_lots.json` (URL-keyed, same shape as
    tracked_lots.json). Per-house category filter at scrape time
    excludes pocket watches / clocks / loose dials only — Mark
    explicitly kept other accessories (boxes, hats, original
    adverts, equipment, watch parts) in. Bonhams + Monaco Legend
    still skipped (Cloudflare / SPA). Wired into the daily
    auctions cron after `merge.py --auctions-only`. **Initial
    scrape: 296 lots** (AQ 20, CH 82, SO 94, PH 100). Sotheby's
    images null in v1 (brightspot CDN URL has an unguessable
    hash; needs a per-lot fetch to extract — easy follow-up).
    Antiquorum's catalog `?page=N` 301s back to `/lots`, so we
    get the first 20 lots per sale for now; they typically fill
    in batches before the sale.
  - **PR #32 (Phase B2):** Hearts on auction-lot cards now write
    to `watchlist_items` (no more `_isTrackedLot` no-op guard).
    `useTrackedLots.add` URL validator narrowed to **eBay only** —
    auction-house URLs come in via the comprehensive scrape and
    are saved via hearts. New `<LotMigrationBanner/>` component
    runs a per-user one-shot migration: each non-eBay tracked URL
    gets copied into `watchlist_items` keyed by `shortHash(url)`,
    then the tracked_lots row is removed. eBay rows untouched.
    Idempotent via `dial_lot_migration_v1_<uid>` localStorage
    flag. `watchItems` projection dedupes a URL appearing in both
    surfaces. TrackNewItemModal copy + +Track button label
    rewritten for eBay-only.
  - **Epic 2** comprehensive auction inventory capture — partially
    shipped (PR #31). Antiquorum + Christie's + Sotheby's +
    Phillips covered for currently-active sales; comprehensive
    historical archive backfill still future. Bonhams / MLA /
    Heritage still need Mac mini Phase A.
  - **Epic 3** Lots tab / explicit-tracking framing retired.
    Hearting is the unified save gesture for dealer listings AND
    auction-house lots.
  - **Things to never do (CLAUDE.md)** updated: don't re-add
    `_isTrackedLot` guard, don't widen +Track past eBay.

- 2026-05-04: **Bug-fix session + UI rename + scraper sharpening.**
  Net: 8 PRs (#21–#28), all merged. Highlights:
  - **Collections → Lists UI rename** (#24). User-facing only; data
    model (DB tables, hooks, URL params, localStorage values, sub-tab
    keys) unchanged. Documented in CLAUDE.md.
  - **Ending Soon hearts + scope** (#21). Tracked-lot cards rendered
    un-filled and clicking duplicated them; root cause was
    `toggleWatchlist` writing phantom `watchlist_items` rows for
    tracked-lot synthetic ids. `handleWish` now guards on
    `_isTrackedLot` and the Ending Soon section is Favorites-only.
    Same guard also fixes a latent duplicate bug in Favorites.
  - **Heuertime image fix saga** (#22 → #23). v1's
    `<source srcSet>` regex on detail pages worked locally but
    failed on GH Actions runners because Wix serves different SSR
    markup per edge variant. v2 pivoted to extracting tile
    thumbnails from the homepage gallery, which Wix renders
    consistently. Lesson graduated to CLAUDE.md.
  - **Watches of Lancashire image proxy** (#25). Cloudflare 403 on
    cross-origin Referer; routed through `/api/img` (third dealer
    on the proxy after Watchfid).
  - **ClassicHeuer SOLD detection saga** (#26 → #27). v1 detector
    was too greedy (DOTALL `.*?` skipped past empty `</div>` and
    matched the next SOLD badge later on the page) AND fetched the
    German default permalink instead of the English locale users
    browse — those two bugs compounded into a 116/117-sold cohort.
    v2 tightened the regex to require immediate-child structure
    AND added an `english_url()` rewrite so the CSV stores `/en/`
    URLs that match what users see when clicking through. 46 live
    / 71 sold in main. ClassicHeuer is effectively an archive site
    at 60%-sold; relevant for the eventual Stop-rule prune.
    Per-locale dealer HTML lesson graduated to CLAUDE.md.
  - **Heuertime template-slug inclusion** (#28). 4 watches living
    at `kopie-van-template-for-watches-N` URLs were being skipped
    as placeholders. They aren't. Removed the slug-pattern filter;
    feed now matches Mark's manual count of 24 (23 after the
    $500-floor still drops the €375 Trackstar). "Don't filter
    dealer URLs by slug pattern alone" lesson graduated to CLAUDE.md.
  - **Main-branch protection ruleset.** GitHub repo settings →
    `main protection` (id 15930708): block force-push, block
    deletion, require linear history. Mark has admin bypass.
    Skipped status-check requirement so the cron's direct-pushes
    aren't blocked.
  - **Listing event capture added to Epic 4.** Mark wants click +
    save telemetry to power "what's hot" / "most saved" /
    per-listing CTR signals. Scoped with periodic rollup + prune
    so the events table doesn't grow unbounded. Slotted as
    priority #2 after the next session's auction-inclusion work.

- 2026-05-03 (later evening): **Build-a-collection v1 / Watch
  Challenges shipped (Epic 3).** New Watchlist > Challenges sub-tab
  with the multi-stage flow: Create (set count + budget + title) →
  Picking (drag-drop on desktop, tap-to-select on mobile via the
  pointer-coarse media query) → Reasoning (one-line per pick;
  optional) → Complete (read-only summary + share). Schema lives
  in `supabase/schema/2026-05-03_challenges.sql`: existing
  `collections` table extended with `target_count`, `budget`,
  `description_long`, `state` (draft|complete), `parent_challenge_id`;
  `collection_items` extended with `is_pick` boolean (shortlist vs
  final picks) and `reasoning` text. Single-collection-per-challenge
  (one row in collections, items split by is_pick). Drafts persist
  as you go via the existing useCollections write-through. Picks
  snapshot `saved_price`/`saved_currency`/`saved_price_usd` so the
  challenge total is immutable once shared. Budget guardrail: 20%
  soft warn, >20% over hard-blocks the Complete button. Share
  button generates a URL encoding the challenge spec
  (`?newchallenge=1&n=N&b=BUDGET&t=TITLE&d=DESC`) — recipients
  build their own response under the same constraints. Out of v1
  scope, in code comments: photo/custom upload (removed),
  mutability after share (immutable), version history,
  per-challenge cap, public read of completed challenges (RLS
  surgery deferred), and the spec-encoded-URL receive flow itself
  (currently the URL just opens the app; auto-prompted
  "build-a-response" lands next session). ROADMAP "Strategic bets"
  framing applied: this is the *hypothetical* picker, NOT the
  reflective Watchbox v2 layer (per-pick reasoning stays
  surface-level: rows={2}, "Why this one?" prompt).

- 2026-05-03 (later): **Heuertime + ClassicHeuer added (Epic 1, 35th
  + 36th dealers, both EUR).** Two vintage-Heuer specialists.
  Heuertime is a Dutch dealer on a Wix Pages site (no Wix Stores
  backend) — every watch is a hand-built page with a `kopie-van-X`
  slug; scraper walks the homepage for URLs then fetches each
  detail page for title, price ("PRICE" rich-text label → "X.XXX
  euro" or "On Request"), and image. ~20 active items; mostly
  Heuer with a few Zenith / Lejour. ClassicHeuer is a German
  dealer on standard WooCommerce Store API; ~117 items. Brand
  quirk: most categories are Heuer model FAMILIES (Carrera,
  Autavia, Camaro, Monaco, Skipper, Silverstone, Monza, Montreal,
  Calculator, Bundeswehr, Chronosplit, Rallyetimer, "Andere
  Hersteller") — `detect_brand` checks title for known brands
  first, then categories for literal Rolex/Omega/Orfina, then
  falls back to Heuer when any category looks like a Heuer family.
  ~98% price-on-request → `priceOnRequest=True` so merge.py's
  500-floor doesn't drop them. **36 dealers now**, six over the
  30-dealer end-state target — Stop-rule audit + prune to 25 is
  more urgent, not less, after this.

- 2026-05-03 (evening): **Auction urgency surfacing shipped (Epic 2).**
  Two complementary changes: (1) "Ending soon" pinned section at the
  top of the Watchlist tab — auction-format tracked lots ending
  within 7 days OR currently live, three urgency tiers (LIVE NOW
  red / TODAY-TOMORROW amber / upcoming standard), horizontal-scroll
  strip, visible across every Watchlist sub-tab. Returns null when
  empty per spec (no empty state). (2) "Ending soonest" sort, third
  pill alongside Date and Price; auto-defaults on when the
  auctions-only filter is toggled, reverts to date-desc when off.
  Comparator tiers items live → upcoming asc → ended (most-recent
  first) → non-auction last, used by both the Watchlist watchItems
  sort and the Available allFiltered sort. EndingSoon component
  exports `classifyEndingSoon` + `selectEndingSoonItems` so future
  work (alerts on the same window, etc.) can reuse the windowing
  logic. Auto-default useEffect lives at the top of App.js with the
  other top-level effects per CLAUDE.md "don't add hooks deep in
  App.js." Comprehensive auction inventory capture (the bigger Epic
  2 substrate item) is still future work — this is purely the
  surfacing layer over what's already tracked.

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
- 2026-04-30: **Structural cleanup pass.** App.js extraction (~2,130 → ~1,853 lines), shared `styles.js` tokens introduced, modal unification.
- 2026-04-29 (AM): **Shipped References tab + Watch size comparison tool.** Print-to-scale sheet via React Portal pattern. Epic 5 restructured under "References (collector resources)".
- 2026-04-28 (PM): Card-tile flash fix on heart click; Auctions tab sub-tabs (Tracked lots / Calendar); eBay integration scope finalized; pytest suite for `merge.update_state` shipped (10 tests, CI on every push).
- 2026-04-28: **Roadmap created.** Initial structure + epics. Build-a-collection promoted; reference encyclopedia reframed as headline feature.

