# Watchlist

A personal vintage watch listing aggregator. Watchlist pulls active inventory from a handful of independent dealers I trust, merges it into one browsable feed, and tracks listings across runs so new arrivals, price changes, and disappearances are easily visible. It also tracks upcoming auctions from the houses worth following.

**Live:** [the-watch-list.app](https://the-watch-list.app)

Built without a development background — architecture, scrapers, React front-end, Supabase auth/data, and CI/CD all co-authored with [Claude](https://claude.com/claude-code).

> For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and what's explicitly out of scope, see [ROADMAP.md](ROADMAP.md).

---

## Why this exists

I wanted a single place to see vintage watches from the specific dealers I follow, in one chronological feed, without the ads or the dealer-specific UIs. Chrono24 covers the universe but its interface buries things; dealer sites are all different. Auctions add another moving target — Phillips, Bonhams, Antiquorum, Monaco Legend each publish their schedules differently, and tracking what's coming up across all of them shouldn't take five tabs.

Not commercial. Not trying to be a marketplace. Just an aggregator for myself — and now open to anyone who wants to see how a non-technical person can ship something useful with an LLM as a pair-programmer.

---

## What it does

Three top-level tabs in the main nav, plus a Home landing reached via the wordmark, a Watchbox destination reached via the avatar dropdown, and an admin-only Site stats surface. Internal-vs-UI naming divergence is real and documented in CLAUDE.md (the URLs use the rebranded names; internal state still says the old ones).

- **Home** *(URL `?tab=home`; reached via the wordmark)* — landing surface with horizontal-slider strips of recently-added listings + thematic groups, plus a "N new listings since {date} — Start screening" banner that opens a fullscreen screener over the new arrivals.
- **Listings** *(URL `?tab=listings`)* — aggregates ~40 curated dealer sources + targeted eBay searches + the major auction houses' active lots (Antiquorum, Christie's, Sotheby's, Phillips, Monaco Legend, Watches of Knightsbridge, Marteau & Co; Bonhams via its residential lots pipeline) into one feed. Sub-tabs: Live listings (dealer items) / Live auctions (auction lots, ending-soonest) / Archive (sold) / Auction calendar. Each calendar row has three inline actions: **View catalog** (external link), **Add to list** (bulk-add every lot to a user-private auction-catalog list), **Review** (swipe-screen through the catalog).
- **Watchlists** *(URL `?tab=saved`; internal key `watchlist`)* — two sub-tabs:
  - **Lists** *(default)* — user-created lists by model, theme, or research thread, plus a "Shared with me" inbox for single-listing shares and **Auction catalogs** populated by the Listings calendar's Add-to-list / Review actions. Email-invite collaborators with viewer / editor roles. A "Saved" pseudo-list at the top holds your hearted items, with an inline Listings / Auctions / Sold toggle (active hearted dealer items / hearted auction lots + all eBay items / hearted items that went sold).
  - **Searches** — saved-searches editor. Each row stores label + query + optional `$ Min` / `$ Max` band; tapping a row applies all three to the Listings tab and lands you there. Live count + "X new this week" badge per row.
- **Collecting** *(URL `?tab=learn`; internal key `references`)* — the collector-resource + intelligence surface. Five sub-tabs: **Editorial** (browse the editorial corpus across ~12 sources; heart/save articles), **Screening** (swipe-review destination over pools — auction catalogs, your lists, shared lists), **Challenges** (build-a-collection: pick N watches under a budget, share the spec or the picks; sender attribution on shared challenges), **Size comparison** (print-to-scale case-size tool), **Links** (curated outbound-link aggregator). The per-model-line research page + encyclopedia are roadmap'd. (Renamed from "Learn" 2026-05-14; Challenges moved here from Watchlists.)
- **Watchbox** *(URL `?tab=watchbox`; reached via the avatar dropdown — no main-nav pill)* — Owned + Sold + Wishlist combined surface with a three-way toggle (Collection / Archive / Plan). Watches you own today (Collection), watches you've sold (Archive), and a planning view (Plan) for what's next.
- **Site stats** *(admin only — invisible to other users)* — dense admin dashboard at `?tab=admin` covering three sections: per-source quality (live count, new-per-week, hearts/hides, avg price, top brand, $ added/sold over 30d, 30-day engagement, scraper health, "earning its keep" chip), auction-house quality (live + upcoming sales, lots, sold rate, $ sold over 90d, median Hammer/Low ratio), and per-user limits (hearts / hides / lists / saved-searches counts, 30-day clicks/views/shares/list-adds, top saved brand, current cap, with an inline form to set a user's cap by email). Engagement signals come from a `listing_events` table seeded by anonymous + signed-in views/clicks/saves/hides/list-adds/shares; daily rollup at 09:15 UTC. Reachable via the user dropdown for users whose email is in `REACT_APP_ADMIN_EMAILS`.

Plus:

- Cross-device sync via Google sign-in (Supabase auth + tables, RLS-protected).
- Per-user **saved searches** — add/edit/delete your own queries, with live counts of matching listings. Tap a saved search to land on Live listings filtered to that query.
- Per-user **tracked lots** — paste an auction-house lot URL to follow it through to hammer (Antiquorum, Christie's, Sotheby's, eBay).
- Per-user **lists + share** — organise hearted watches into named lists. Three share primitives: share any single listing via the native share sheet (recipient sees the listing in the same UI with a Save / Dismiss banner; signed-in saves auto-populate a "Shared with me" inbox); share an entire list read-only via `?list=<id>&shared=1`; OR invite collaborators to a list by email with viewer/editor roles (collaborators co-edit; attribution chip shows who added each item — landing in slice 4). No in-app messaging — the user's chosen messaging tool handles replies.
- **Browser back/forward parity** — back walks you backwards through Watchlist instead of leaving the site (proper pushState / popstate handling).
- **Hide** any listing with the × button — it stays out of the live feed but its history is preserved. Hidden items show up in Collections > Lists > Hidden so you can unhide them later.
- Runs a Python scrape pipeline daily via GitHub Actions — no server to babysit.
- Tracks listings across runs with **stable URL-hash IDs**, so:
  - "NEW" badges only show for listings actually new in the last 24 hours.
  - Price drops get a green ↓ chip.
  - Watchlist stays glued to the right listing even as dealers add new inventory.
  - Listings that disappear from the scrape are flipped to inactive and surface in the sold/archive view.
- Client-side search (whitespace-tokenized — word order doesn't matter), filter (by source / brand / price / recency / Live-Sold-All / auctions-only), sort.
- Implicit weekday-based date dividers (Today / Yesterday / weekday / Last week / Older) when sorted by date.
- Dark/light mode following system preference, with manual override.
- GBP→USD conversion for UK dealers, shown alongside the native price.
- **Screening** — a swipe interface for working through a set one card at a time (Yes / Pass / Heart, Tinder-style swipes, haptics, full-bg colour wash, per-list bookmarked resume). Reached as a destination under **Collecting > Screening**, which lists pools to screen — auction catalogs, your own lists, and shared-with-you lists. On a shared list, Yes/Pass write reactions (Liked / Open / Disliked buckets); on your own pools, Yes hearts. Fullscreen on both mobile and desktop.
- Mobile: configurable 1-3 col grid with a slide-up filter drawer, sticky search/sort row, and a 3-tab bottom-nav (Listings / Watchlists / Collecting).
- Desktop: full-width top bar with three main tab pills + an avatar pill with the "Watchbox" label, an inline pill-style filter row, and configurable 3-7 col grid (or auto fluid).

---

## Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                  GitHub Actions (cron, daily)               │
  │                                                             │
  │   38× listing scrapers + 6× auction scrapers (Python)       │
  │            │                              │                 │
  │            ▼                              ▼                 │
  │     *_listings.csv               *_auctions.csv             │
  │            │                              │                 │
  │            └──────────────┬───────────────┘                 │
  │                           ▼                                 │
  │                       merge.py                              │
  │                           │                                 │
  │      ┌───────────┬────────┼─────────┬──────────────┐        │
  │      ▼           ▼        ▼         ▼              ▼        │
  │  listings.json state.json auctions.json auctions_state.json │
  │      (the app reads these; state files = cross-run memory) │
  │                           │                                 │
  │   commit & push back to main                                │
  └───────────────────────────┼─────────────────────────────────┘
                              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                Vercel (auto-deploy on push)                 │
  │   React bundle + listings.json/auctions.json (static)       │
  └─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴────────────────┐
            ▼                                  ▼
     Browser fetches JSON                 Supabase (Postgres + Auth)
       — filter/sort/state                  Per-user data, all RLS-gated:
       lives in React                       — watchlist_items / hidden_listings
                                            — saved_searches (with $ band)
                                            — collections + collection_items
                                            — collection_collaborators
                                            — collection_comments
                                            — listing_events / _daily (telemetry)
                                            — user_profiles / user_settings / user_limits
                                            — admin_emails / admin_hidden_listings
                                            — tracked_lots (eBay) / saved_auctions
                                            — Google OAuth provider
```

Listings/auctions are static JSON committed to the repo. The only thing behind a server is per-user data (watchlist, hidden listings, saved searches, collections + items, collaborator invites, listing events for admin analytics), which lives in Supabase with row-level security so each user can only read/write their own rows. Anonymous visitors can browse and search; signing in unlocks saving.

**Reference-intelligence pipeline (Collecting ▸ References).** Per-model reference pages (e.g. Submariner 5512/5513) are built by a manual GitHub-Actions pipeline: `reference_corpus_scraper.py` assembles an attributed source corpus from a `reference_sources/<node>.json` manifest (reusing the editorial corpus, fetching the rest), `reference_synthesis.py` runs one Claude Opus pass into source-grounded, `applies_to`-scoped JSON, and `reference_digest.py` emits a readable `docs/reference_synthesis_<node>.md` (the human-review surface + gap backlog). The React `ReferencePage` renders a hand-authored content node (`src/data/referencePages/`) enriched by that synthesis at runtime. Same chunked corpus is the planned input to a reference RAG bot.

---

## Data sources

### Dealers (~40)

All scrapers hit each dealer's existing public endpoint — no credential-protected APIs, no headless browsers where it can be avoided.

| Source | Platform | Method | Currency |
|---|---|---|---|
| Wind Vintage | Squarespace | `?format=json` + HTML price parse | USD |
| Tropical Watch | Custom (server-rendered HTML) | Index walk + HTML parse | USD |
| Menta Watches | WooCommerce | Store API | USD |
| Collectors Corner NY | Shopify | `/products.json` | USD |
| Falco Watches | Shopify | `/products.json` | GBP |
| Grey & Patina | WooCommerce | Store API | USD |
| Oliver & Clarke | Shopify | `/products.json` | USD |
| Craft & Tailored | Shopify | `/products.json` | USD |
| Watch Brothers London | Squarespace | `?format=json` items[] | GBP |
| MVV Watches | Squarespace | `?format=json` items[] | USD |
| Analog Shift | Shopify | `/products.json` | USD |
| Watches of Knightsbridge | Custom | HTML parse | GBP |
| Belmont Watches | Shopify | `/products.json` | USD |
| Bob's Watches (vintage Omega) | Custom | JSON-LD + HTML | USD |
| DB1983 | Shopify | `/products.json` | GBP |
| Hairspring | Shopify | `/products.json` | USD |
| Somlo | Shopify | `/products.json` | GBP |
| Bulang & Sons | Shopify | collection-scoped `/products.json` | EUR |
| Watchfid | Custom (WordPress) | WP REST API; images proxied via `/api/img` | EUR |
| Moonphase | pushers.io | `/api/dealers/{handle}.json` (structured brand + price + state) | EUR |
| Huntington Company | Shopify | `/collections/watchshop/products.json` | USD |
| The Vintage Watch | Shopify | `/collections/available-watches/products.json` | USD |
| Chronoholic (Omega only) | Wix | `productsWithMetaData.list[]` JSON embedded in HTML | USD |
| Vintage Watch Fam | Shopify | collection-scoped `/products.json` | USD |
| Shuck the Oyster | Custom (WordPress) | `/portfolio/` listing pages + per-item detail-page price extraction (`PRICE NNNN€`) | EUR |
| Central Watch | Custom (PHP) | HTML parse of `prod_result_item` cards + `/R{offset}` pagination | USD |
| European Watch | Next.js (RSC) | Inline `__next_f.push` chunks, regex-extracted product objects; **pre-2000 filter** via `Circa. YYYY` in model | USD |
| Vintage Watch Collective | Wix | `productsWithMetaData.list[]` JSON embedded in HTML (same as Chronoholic) | EUR |
| Watchurbia | WooCommerce | Store API; filtered to `category=watches-in-stock` so the sold archive doesn't surface | EUR |
| Maunder Watches | WooCommerce | Store API; uses `offset` (not `page`) since their build ignores `page` | GBP |
| Watch Club | Custom (TaffyDB) | Single 5MB JS catalog at `/upload/js/watches2018_bis.js` wrapped as `TAFFY([…])`; status="1" filter for active items | GBP |
| Vintage Watch Shop | WordPress (custom CPT) | `/watches-accessories/` index walk + per-item detail page for "Our price: £NNNN" | GBP |
| Watches of Lancashire | WooCommerce | Store API; `category=watches`; images proxied via `/api/img` (Cloudflare hot-link protection) | GBP |
| Heuertime | Wix Pages (no Wix Stores) | Homepage links → per-page detail walk for "PRICE" rich-text label (mostly POR) | EUR |
| ClassicHeuer | WooCommerce | Store API; categories used as Heuer model families, mostly price-on-request | EUR |
| Luna Royster | WooCommerce | Store API; independent + neo-vintage heavy (F.P. Journe, MB&F); placeholder $1/$0 prices filtered out | USD |
| S.Song Watches | Shopify | `/collections/vintage/products.json` | USD |
| Swiss Hours | Shopify | `/collections/watches/products.json` | USD |
| Amsterdam Watch Company | WooCommerce | Store API; walks the vintage-watches, newwatches and special-editions categories; their `stock_status` filter double-counts, so stock is checked in code + deduped by id | EUR |
| Amsterdam Vintage Watches | WooCommerce | Store API; `stock_status=instock`; drops the not-for-sale Museum category and price-on-request rows | EUR |

Every source is scraped with vanilla `requests` — no third-party scraping service. Tropical Watch server-renders its listing index (live inventory first, then a sold archive); its scraper walks the index pages and stops at the live→sold boundary. (It was the last source routed through Browse AI; that dependency was retired 2026-05-26 — see SHIPPED.)

### Auction houses (6)

| House | Method | Notes |
|---|---|---|
| Antiquorum | HTML calendar parse + HEAD-check on catalog URLs | Only links to a specific catalog when its URL returns 200 |
| Monaco Legend | HTML, anchored on `<p class="auction-date">` | Both featured + grid card layouts share that element |
| Phillips | HTML, walking backward from each `atc_date_start` block | Phillips puts the auction href above the date block |
| Bonhams | HTML, explicit `_pair(y1, mo1, d1, y2, mo2, d2)` date parser | Earlier helper had a buggy implicit-end-year bug |
| Christie's | Next.js `__NEXT_DATA__` Sitecore JSS payload from `/en/departments/watches-and-wristwatches` | Structured `Auctions[]` array with SaleNumber, dates, location, URL |
| Sotheby's | Calendar URL with watches filter (`f4=...`); flat-text parse of card descriptors | Cross-month date ranges supported (`29 April–13 May 2026`) |

### Tracked auction lots

Auction-house lots flow into the feed via the comprehensive scrape and are saved by hearting them like any dealer card (Listings > Live auctions). The only lots that come in by URL are **eBay** items, via a paste-a-URL modal — there's no longer a standalone Auctions tab or a visible "+ Track" trigger (the modal infrastructure stays wired for re-adding one). `tracked_lots_scraper.py` supports per-lot tracking for **Antiquorum, Christie's, Sotheby's, eBay**, pulling title, image, estimate, current bid, sold price, and end date.

---

## How state tracking works

The biggest design decision in the project is `public/state.json` (and its sibling `public/auctions_state.json`), committed to the repo alongside the user-facing JSON.

**The problem:** a naive scraper run every day produces a full list of current listings. If everything gets a "scraped today" stamp, you can't distinguish genuinely new arrivals from old inventory that just happened to be in today's scrape. And if a listing moves position in a source's catalog, its array index changes — which would break any reference the app holds.

**The fix:** every listing gets a stable 12-char ID — `sha1(normalized_url)[:12]`. URLs don't shift around the way array indices do, so the same listing keeps the same ID across runs.

`merge.py` then reads the previous state, compares this run's items to it, and maintains:

- `firstSeen` — the date we first observed this URL. The "NEW" chip reads from this, not from the scrape date.
- `lastSeen` — so disappearances can be detected.
- `priceHistory` — appended only when price changes, not on every run. Cheap to store, makes price-drop detection trivial.
- `active` / `sold` — flipped when a listing drops out of the scrape. The frontend's Archive tab reads from this; the saved fields (`lastTitle`, `lastImg`, `lastBrand`, `lastCurrency`) are cached at the moment of disappearance so cards still render in the archive even though the source no longer has them.

This means the pipeline is **self-healing**: if a single run misses listings (scrape limit set too low, dealer briefly slow), the next run picks them back up automatically and flips them active again. No manual reconciliation.

---

## Stack

- **Scrapers:** Python 3.11 with `requests`. No Playwright, no Selenium, no third-party scraping service — every source is reachable with plain HTTP.
- **Pipeline:** GitHub Actions (ubuntu-latest). Each scraper step uses `continue-on-error: true` so one failing source doesn't kill the batch.
- **Frontend:** React (Create React App), inline styles only, no UI libraries. `App.js` is the orchestrator (the largest file by far — owns state and JSX consts); render is delegated to `src/components/MobileShell.js` + `DesktopShell.js`, each receiving a single `shellProps` bag. Home is `MagazineHome` (magazine format, 2026-09-07 — it replaced `HomeTab`, which was deleted); its chrome lives in `MagazineChrome` and is the one place the app loads its three display faces. Domain-state hooks live under `src/hooks/` (`useTrackModal`, `useFavSearchModal`, `useViewSettings`, `useFilters`, …); shared style tokens in `src/styles.js`. Pure helpers in `src/utils.js`.
- **Image delivery + persistence:** Display images route through **wsrv.nl** (a free resize CDN) in `imgSrc()` — served at ~720px WebP so the page never pulls multi-MB dealer originals (Phillips/Monaco use their own CDN resize; hot-link-protected, Cloudflare-blocked (Bonhams), and tiny-source (Tropical Watch) hosts serve direct). Hearted/tracked items also get their image cached to **Vercel Blob** by `cache_watchlist_images.mjs` (daily, in the auctions workflow) at **thumbnail** size, so favorited cards survive a dealer deleting the original. Blob *storage* is cheap (~1 GB free); *transfer/egress* is the metered cost — never cache or serve full-res.
- **Auth + per-user data:** [Supabase](https://supabase.com) — Postgres with row-level security, Google OAuth provider. Free tier; no backend code of my own.
- **Hosting:** Vercel free tier, auto-deploy from `main`.
- **Static data:** JSON committed to the repo. At current scale (~1,800 listings, ~2 MB) keeping this in git is cheaper and simpler than running a database for it. Per-user data (which actually needs writes) lives in Supabase.

---

## Folder layout

```
watchlist/
├─ .github/workflows/
│   ├─ scrape-listings.yml         # daily dealer listings pipeline (matrix variant is dispatch-only)
│   ├─ scrape-auctions.yml         # auctions + tracked-lots + watchlist-image cache
│   ├─ scrape-auction-lots-frequent.yml  # comprehensive per-lot scrape
│   ├─ scrape-ebay.yml             # eBay Browse API run
│   ├─ scrape-editorial-corpus.yml # weekly editorial-corpus scrapers
│   ├─ rollup-events.yml           # daily telemetry rollup + prune
│   ├─ notify-scrape-failure.yml   # opens a GitHub Issue on scrape failure
│   └─ tests.yml                   # pytest + jest, on push + PR  (+ a few more: matrix, single, tropicalwatch, topic-index, collector-profile)
├─ *_scraper.py                    # one file per dealer + auction house
├─ ebay_oauth.py                   # eBay Browse API token refresh
├─ ebay_search_scraper.py          # reads data/ebay_searches.json, calls Browse API
├─ merge.py                        # state + listings + auctions enrichment
├─ verify_sources.py               # post-merge scrape-health check (rolling-median anomaly detection)
├─ cache_watchlist_images.mjs      # Vercel Blob image persistence for hearted items
├─ api/img.js                      # serverless image proxy for hot-link-protected dealers
├─ data/
│   ├─ <source>.csv                # one CSV per dealer / auction house
│   └─ ebay_searches.json          # eBay search config (label, query, country, seller)
├─ public/
│   ├─ listings.json               # full feed — backend tools + stale PWA bundles
│   ├─ listings_live.json          # live half — frontend fetches eager (critical path)
│   ├─ listings_sold.json          # sold half — frontend fetches lazy after first paint
│   ├─ auctions.json               # what the Auction Calendar sub-tab reads
│   ├─ tracked_lots.json           # scraped state for tracked auction lots
│   ├─ state.json                  # cross-run memory for listings
│   ├─ auctions_state.json         # cross-run memory for auctions
│   ├─ verification.json           # latest source-health report (per-source counts + alerts)
│   ├─ verification_history.json   # rolling 14-day per-source counts (baseline for anomaly detection)
│   ├─ apple-touch-icon.png        # iOS home-screen icon
│   ├─ favicon-32.png              # browser tab favicon
│   └─ index.html
├─ supabase/
│   └─ schema/                     # 30+ SQL migrations dated by ship date.
│                                  # Apply via the Supabase MCP `apply_migration`
│                                  # tool or the dashboard SQL editor. The
│                                  # foundational ones are 2026-05-01_collections
│                                  # (collections + collection_items) and
│                                  # 2026-05-03_challenges (Watch Challenges
│                                  # columns); subsequent migrations layer on
│                                  # hard lists, manual entries, reactions,
│                                  # collaborators, RLS hardening, perf indexes.
├─ src/
│   ├─ App.js                      # orchestrator — owns state, builds shellProps, delegates to shells
│   ├─ supabase.js                 # auth + per-user data hooks
│   ├─ styles.js                   # shared inline-style tokens (pillBase, modalShell, actionButton, ...)
│   ├─ utils.js                    # pure helpers + constants (matchesSearch, ageBucketFromDate, ...)
│   ├─ hooks.js                    # useWidth, useSystemDark (DOM-tracker hooks)
│   ├─ setupTests.js               # jest setup — auto-loaded
│   ├─ index.js                    # bootstrap + service-worker registration
│   ├─ hooks/                      # domain-state hooks
│   │   ├─ useTrackModal.js        #   Track new item modal state + submit
│   │   ├─ useFavSearchModal.js    #   Save-search prompt state + submit
│   │   ├─ useViewSettings.js      #   theme + column count
│   │   ├─ useFilters.js           #   the filter row's full input state
│   │   ├─ useLastVisit.js         #   "new since last visit" tracker
│   │   ├─ useHomeHidden.js        #   Home-only hide set (separate from global hidden)
│   │   ├─ useRecentSearches.js    #   recent-search history for the Home search bar
│   │   ├─ useUserLimit.js         #   per-user watchlist cap state + soft/hard-warn thresholds
│   │   └─ useEventTelemetry.js    #   fire-and-forget anonymous + signed-in event recording
│   └─ components/
│       ├─ MobileShell.js          # mobile render path (sticky stack, drawer, bottom nav)
│       ├─ DesktopShell.js         # desktop render path (top bar, filter row, fluid grid)
│       ├─ MagazineHome.js        # Home landing — magazine format (rotator, featured watch, auction calendar)
│       ├─ MagazineChrome.js      # the landing chrome: masthead, tabs, search, account row
│       ├─ SiteFooter.js          # the site footer (About / Privacy / Terms)
│       ├─ WatchlistTab.js         # Watchlists tab body (Lists / Searches / Challenges sub-tabs)
│       ├─ CollectionsTab.js       # Lists / Wishlist / My collection / Challenges drill-in surface
│       ├─ ChallengesView.js       # Challenges list view + drill-in to ChallengeFlow
│       ├─ ChallengeFlow.js        # Watch Challenges multi-stage flow (Set / Pick / Share)
│       ├─ ReferencesTab.js        # Collecting tab landing — print-to-scale + curated links
│       ├─ AdminTab.js             # ?tab=admin dashboard (gated by REACT_APP_ADMIN_EMAILS)
│       ├─ AuctionCalendar.js      # month-banded auction calendar (View / Add / Review per row)
│       ├─ SizeCompare.js          # print-to-scale watch size comparison tool
│       ├─ Links.js                # curated outbound-link aggregator under Collecting
│       ├─ ListReviewMode.js       # Tinder-style screener (list + feed modes)
│       ├─ Card.js                 # listing card (also used for tracked lots + auction lots)
│       ├─ Chip.js                 # filter pills (Chip + SidebarChip)
│       ├─ ListRow.js              # collection-list row used in Lists view
│       ├─ Section.js              # sub-section grouping primitive inside tab bodies
│       ├─ EmptyState.js           # standard empty-state surface (compact / default / tall)
│       ├─ SubTabIntro.js          # callout banner with optional action (largely retired post-2026-05-14)
│       ├─ ViewSettingsControls.js # currency + theme + column-count picker (also embedded in Settings modal)
│       ├─ WatchDetailSheet.js     # collection-item detail / edit drill-in
│       ├─ ManageListSheet.js      # collaborator + member-roster panel for shared lists
│       ├─ ShareReceiver.js        # hook-isolated mount for single-listing share-receive
│       ├─ ListReceiver.js         #   shared-list receive flow
│       ├─ ChallengeReceiver.js    #   shared-challenge receive flow
│       ├─ ListingPickerModal.js   # picker for adding listings to a collection
│       ├─ CollectionPickerModal.js # picker for adding a listing to a collection
│       ├─ CollectionEditModal.js  # create + rename collections
│       ├─ ManualEntryForm.js      # add a manual entry (manual_* columns) to a collection
│       ├─ MarkAsSoldModal.js      # mark an Owned collection item as Sold
│       ├─ AddSearchModal.js / FavSearchModal.js  # saved-search add / inline-save flows
│       ├─ TrackNewItemModal.js    # paste-a-URL flow for tracked lots (eBay)
│       ├─ SettingsModal.js        # currency + theme + columns + about
│       ├─ AboutModal.js           # about modal
│       ├─ SignInPromptModal.js    # sign-in CTA modal triggered from gated actions
│       ├─ UserLimitBanner.js      # top-of-app banner for watchlist-cap soft-warn / hard-cap
│       ├─ LotMigrationBanner.js   # one-shot per-user tracked-lot → watchlist migration prompt
│       ├─ ErrorBoundary.js        # wraps the App shell render — surfaces stack instead of white-screening
│       ├─ ConfirmModal.js         # styled confirm dialog (replaces window.confirm) — `confirm()` returns Promise<boolean>
│       ├─ icons.js                # shared SVG icon set
│       └─ *.test.jsx              # render-without-crash smoke tests for App, shells, tab bodies, screener
└─ package.json
```

---

## Running locally

```bash
# Python scrapers — each writes a CSV to data/
pip install -r requirements.txt
python windvintage_scraper.py
python menta_scraper.py
python tropicalwatch_scraper.py
# ...one per dealer/auction house — all plain requests, no keys

# Merge all CSVs into listings.json + auctions.json
python merge.py

# Frontend — needs Supabase env vars in .env.local for auth/sync to work
# (the app falls back to read-only mode without them)
npm install
npm start
```

`.env.local` (gitignored):

```
REACT_APP_SUPABASE_URL=https://<your-project>.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# Optional — comma-separated emails for the admin dashboard at ?tab=admin.
# Leave empty (or omit) and the dashboard is unreachable. See "Admin
# dashboard" below.
REACT_APP_ADMIN_EMAILS=you@example.com
```

The app no-ops auth gracefully if these aren't set — you just can't sign in. Useful for running locally without a Supabase project of your own.

```bash
# Tests (state-transition coverage on merge.py)
pip install -r requirements-dev.txt
pytest
```

---

## Triggering a manual scrape

**Actions** tab → **Scrape watch listings** → **Run workflow**.

The pushed `state.json` / `auctions_state.json` will be updated on completion and Vercel redeploys automatically.

---

## What's next

Direction, priorities, and what's explicitly off the roadmap live in [ROADMAP.md](ROADMAP.md). Short version: foundations (references as first-class entities, verification script) come before more sources or features.

Test coverage is two suites, both in CI on every push and PR (`.github/workflows/tests.yml`):

- **pytest** — `merge.update_state` state transitions, the layer where a regression would silently corrupt the cross-run memory that drives "NEW" badges, price-drop detection, and the sold/archive view.
- **jest** — render-without-crash + key visibility smoke tests for `MobileShell` and `DesktopShell`. Catches the TDZ class of bug that shipped a white screen on mobile in late April 2026.

Scrapers aren't tested — most breakage there comes from external page changes that unit tests don't catch.

---

## Acknowledgments

Built iteratively with [Claude](https://claude.com/claude-code) as co-author — architecture decisions, all Python scrapers, the React component, the Supabase integration, the GitHub Actions workflow, and the state-tracking design. Every commit after the initial scaffold was a paired session.

Inventory credit: all listings and auction entries link directly back to their respective dealers and houses — Watchlist is read-only and ad-free.
