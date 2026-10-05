# Watchlist — shipped log

The single changelog for the project. Everything that ships lands here
as a two-line entry (title + date + one sentence). ROADMAP holds
direction only; this holds history. For design rationale, see commit
history and the SESSION_HANDOFF archives.

## How this is organized

Grouped by epic (matching ROADMAP epic numbering), plus a cross-cutting
**UI & chrome** section for work that doesn't sit under one epic. Each
entry is two-line max: title + ship date + one-sentence what. Newest
within each section roughly last.

> A handful of older entries carry `2026-05-XX` where the exact ship
> date wasn't recovered — fill on next touch, don't guess.

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
- **2026-05-17 — Reference index + matcher.** Curated
  `docs/watch_references.md` (26 brands · 312 model lines · 1,666 refs) +
  `reference_index_match.py` + regenerated gap report; research-chat
  patch workflow established.
- **2026-05-19 — Matcher wired into every scrape path (PR #378).**
  merge.py + all auction enumerators + editorial scrapers fill
  reference_id / model / model_line where the matcher hits.
- **2026-05-24 — Scrape reliability + observability (PRs #530–#536).**
  continue-on-error on all steps, `scraper_lib.fetch_json_with_retry`,
  `health.py` CLI, notify-scrape-failure GitHub-Issue workflow,
  verify_sources `updated_at` + STALE signal, parallel matrix workflow
  (dispatch-only, ~2× faster).
- **2026-05-26 — Cold vibe-code audit (grade B−).** 6-agent read-only audit of
  the whole codebase; report + 6 domain findings archived to
  `docs/audits/2026-05-24-vibe-code/`, findings filed as BUGS B-15–B-22
  (`[audit:2026-05-24]`), direction items to ROADMAP (#574, #575).
- **2026-06-06 — Cold usability audit (grade C+) (#813).** First-time-user
  walkthrough; report + screens archived to `docs/audits/2026-06-06-usability/`,
  findings routed.
- **2026-05-26 — Scrape integrity: disappearance debounce (B-15).** A listing
  must be absent 2 consecutive runs before flipping to sold — a single
  empty/failed scrape can no longer silently mark a whole source SOLD (#576).
- **2026-05-26 — Pinned Python scraper deps (B-16).** `requirements.txt` /
  `-auctions` / `-ai`; scrape workflows install via `-r` instead of
  latest-on-the-day. JS lockfile still pending a Node env (#578).
- **2026-05-26 — Service-worker feed coverage + drift test (B-21).** SW
  network-firsts the post-split feed files again; `service-worker.test.js`
  fails if its file list drifts from App.js's `*_URL` constants (#580).
- **2026-05-26 — Browse AI 403 surfacing + notifier hardening (B-23).** Tropical
  Watch scraper now prints Browse AI's error body on failure; the
  failure-notifier uses the pre-installed `gh` CLI (no action download at setup)
  so a GitHub-CDN blip can't crash it into a misleading "all jobs failed" email
  (#582).
- **2026-05-29 — Richard Mille mis-branded as Enicar fixed (B-26).** "RM 002-V2"
  matched Enicar's ref 002 because Richard Mille wasn't on the brand-detection
  lists; added it (merge.py + utils.js) so the cross-pollination guard rejects
  the hit, + corrected the cached `lastBrand` (#674, #679). No share-URL leak —
  the `/share/` link was just the listing's own id.
- **2026-05-29 — FX parity guard (B-18).** pytest fails if `merge.py` FX and
  `utils.js` FX_RATES_USD_PER drift (currency sets + rates), so a one-sided edit
  can't go "8× off" silently (#675).
- **2026-05-29 — RLS provability + listing_events forge fix (B-19).** Committed
  idempotent enable-RLS for the 4 dashboard-made user tables (was unprovable
  from code); tightened the `listing_events` insert from `with check (true)` to
  own-or-anonymous so a client can't forge another user's `user_id` — applied to
  prod + committed (#677).
- **2026-05-29 — Inert-code sweep pass 2 (B-27).** Deleted orphaned
  `SubTabIntro.js`; marked `useLastVisit.js` DORMANT (planned pulse consumer);
  kept Eyebrow/windvintage/ListReviewMode (finder mis-called them). Thread stays
  open as a recurring sweep (#678).
- **2026-06-02 — Brand-aware reference matching + Explorer fix (B-54, #773).**
  `match_against_index` now prefers a same-brand token, so a leading year that
  collides with another brand's ref (1991→Cartier) can't shadow the real ref;
  fixed the curated index (Explorer refs were orphaned under a parser-invisible
  label; 14270 mis-parked under Submariner). Re-tags 29 rows on next scrape.
  Spun off B-57 (same-brand collision sweep).
- **2026-06-02 — Same-brand reference collisions fixed (B-57, #779).** Web-search
  adjudicated the curated index: removed the wrong-family entry for 7 refs (Patek
  5236P off Calatrava→Perpetual Calendar, IWC IW5004 off Portugieser→Big Pilot,
  Lange 216.026/233.026, Heuer 73463→Skipper, UG 22409, Rolex 69173/69178→Lady
  Datejust). Left deliberate annotated cross-refs; flagged Cartier WJTA0001 +
  Breitling 765 for Mark.
- **2026-06-02 — Scraper filename de-clash (B-20, #776).** Renamed
  `auctionlots_scraper.py` → `tracked_lots_scraper.py` so it's no longer one
  underscore from `auction_lots_scraper.py`; updated both importers + the
  workflow + docs (the import that breaks if missed is `auction_lots_scraper.py`'s
  `from … import`).
- **2026-06-02 — CI gate on the Lumé synthesis workflow (B-44, #777).**
  `synthesise-saved-nodes.yml` now runs pytest+jest on its generated outputs
  (fails the run, commits nothing, if red) AND opens a PR instead of pushing to
  main. Both needed: a PR opened by the default `GITHUB_TOKEN` doesn't trigger
  `tests.yml`, so the in-workflow run is the real gate (no PAT).
- **2026-06-02 — JS-lockfile generator shipped, rollout held (B-16, #778).**
  Manual-only `generate-lockfile.yml` cloud-generates `package-lock.json` (no
  local npm). NOT yet dispatched — committing the lockfile auto-switches Vercel
  to `npm ci`, so it waits until the in-flight branches merge; then dispatch →
  merge → flip `tests.yml` to `npm ci`. Procedure in the workflow header.

- **2026-06-03 — Chrome-consistency CI guard (#791).** Source-scan jest suite: FilterRow stays
  retired, PageHeader one-inset rule, topTabs.js owns tab labels, no "Hearted" UI label — drift fails the build.

- **2026-06-06 — PageSpeed remediation wave (#825–#829, B-34).** Article images finally route through
  imgSrc/wsrv (raw 2MB blogger originals were the 33.8s mobile LCP); 480px thumbs for strip cards + intrinsic
  image dims; /static/* immutable cache; editorial corpus fetch deduped (fetchJsonCached — was downloaded 2×
  per visit); first article images eager. Page weight ~8.4MB→~3MB; remaining gap = B-22 JS split.
- **2026-06-06 — Maunder Watches images fixed (#828).** Jetpack Photon (i0.wp.com) 400s wsrv's fetcher —
  imgSrc now uses Photon's native resize (306KB→23KB); covers any future WordPress-hosted dealer.
- **2026-06-06 — CardShell direct render tests (#830).** BREAK-NOW "Can't find variable: aspect" shipped
  inside CardImage because shells' jest tests render mock grids; CardShell.test.jsx now exercises the real
  frame (image square/editorial + placeholder) so the shared card frame can't ship a render error blind.
- **2026-06-07 — Tier 1 road tests (#856).** Five render components — Card, PageHeader, StandardFilterBar
  (+ StandardSearchInput), ShareReceiver, CatalogReceiver — gain direct render tests (CardShell.test.jsx
  pattern); each was previously only exercised via shell mocks. Closes the "compiles but never runs" gap on
  the central / recently-edited surfaces.
- **2026-06-07 — Tier 2 road tests, modal suite (#857).** 11 modals get direct render tests —
  AddSearchModal, CollectionEditModal, CollectionPickerModal, ConfirmModal (+ ConfirmHost), FavSearchModal,
  ListingPickerModal, MarkAsSoldModal, NotePickerModal, SettingsModal (mocks ../supabase for
  LumeMemorySettings), SignInPromptModal, TrackNewItemModal. Post-state: 29/63 user-facing components
  road-tested in CI (up from ~13). Tier 3 leaf elements left to the standing rule.
- **2026-06-09 — Scrape-health gate (#859, B-60).** A final `always()` step
  (`scrape_health_gate.py`) fails the Scrape-listings workflow when any source
  produced no CSV this run or `verify_sources` logged an ERROR, so the existing
  notifier opens an issue. Closes the silent-rot gap that hid Watch Center (B-58).

- **2026-08-30 — .gitignore covers the JS frontend (#935).** The file was seeded
  from a Python-only template, so `npm install` left `node_modules/` untracked in
  the repo root, one `git add -A` from being committed; adds `node_modules/`,
  `.eslintcache`, `/coverage`. `package-lock.json` deliberately NOT ignored —
  B-16's fix is to commit one.

- **2026-08-30 — Alert on every scheduled workflow (#923).** `notify-scrape-failure.yml`
  watched 5 of 7 crons; both editorial workflows were missing, which is why the corpus
  froze for a month in silence. `test_alert_coverage.py` now fails the build on any
  unwatched cron (and on stale entries — workflow_run matches on display name).
- **2026-08-30 — Push-retry loops can no longer bin a run's work (#920, #924).** The
  editorial commit step staged a hand-listed file set, so a stray unstaged file made
  `git pull --rebase` refuse and all 3 retries discard a 40-min scrape — every run
  2026-07-15→08-16. Broad `git add <dir>/` + `--autostash` across all 9 pushing
  workflows, guarded by `test_push_retry_safety.py`.
- **2026-08-30 — Unified source-freshness ledger + scheduled health sweep (#926).**
  `source_freshness.py` asks one question — "when did this source last produce data?" —
  across 69 sources on all four surfaces, building its registry by importing
  `merge.LISTING_SOURCES` rather than copying it. `health-report.yml` runs it daily
  alongside `health.py`, which had existed for months with no cron.
- **2026-09-05 — Failure alerts say why (#953).** `scrape_failure_reason.py` reads
  the failed steps' log and names the cause in plain English (dealer block, push
  race, quiet source, rotted test, crash); the notifier also watches `Tests` on
  `main`, and a date-rotted fixture that had reddened every push since 09-02 is fixed.
- **2026-09-09 — Triage agent, tier 1 (#961).** On a failure it probes each
  implicated dealer from a runner and answers "is this ours?" on the issue —
  read-only by design. One snooze file now mutes both the scrape-health and
  freshness gates, and slow-rotating dealers get their own content budget.
- **2026-10-04 — Triage made to actually run + browser-based Lancashire (#981).**
  The agent had never fired once: GitHub won't start a workflow from a
  GITHUB_TOKEN-created issue, so it is now a `needs:`-gated job inside the
  notifier. Lancashire escalates to headless Chromium for its Cloudflare managed
  challenge, and the residential agent records per-source outcomes.

- **2026-10-04 — Topic tagger stops re-paying for tagged articles (#986).** Scrapers dropped
  `themes` on every rewrite and Rolex Magazine / On The Dash re-walked their whole feed, so the
  weekly Haiku run made ~72k calls for a ~13k corpus. `write_split` now carries `themes` forward,
  both scrapers stop at the first held post, and the indexer refuses to spend above 300 untagged.

## Epic 1 — Sources

- **2026-06-09 — Watch Club liveness fix (#860, B-59).** Keyed "sold" on the
  TaffyDB `status==30` signal (not `status=="1"`), which the catalog reshuffles
  between rebuilds; recovered ~48 live listings and unfroze the source (was stuck
  at 61 since 06-04). (B-58 was already self-healed by the curl_cffi probe.)

- **2026-04-30 — eBay integration.** Free Browse API source; admin
  configures `data/ebay_searches.json`; BIN items in main feed.
- **2026-05-02 — Vintage Watch Collective.** Wix
  productsWithMetaData (Chronoholic clone), EUR, ~40 listings.
- **2026-05-03 — Vintage Watch Shop (Vintage Heuer).** WordPress
  custom-post + detail-page walker for "Our price: £NNNN"; ~20 items.
- **2026-05-XX — Brand and listing curation (PR #50, partial #52).**
  Hard exclusions, brand consolidations, Force-Other pooling, suppress-at-sold.
- **2026-05-19 — Editorial corpus, 8 sources end-to-end (PRs #346–#364).**
  ~8,556 articles; body-split persistence via `editorial_corpus_io.py`
  (meta eager, bodies lazy).
- **2026-05-20→22 — Editorial corpus grew to 12 sources.** WOE Dispatch,
  Screw Down Crown (free + paid), Fratello (brand-filtered), Christie's
  Stories.
- **2026-05-24 — Shopify retry + Watch Club low-count abort (PRs #531/#534).**
  Kills "single 503 wipes the source" and the truncated-catalog flap.
- **2026-05-26 — Tropical Watch off Browse AI → direct scraper (B-23).**
  Server-rendered index walker (`requests`, no key), reachable from CI. Browse
  AI now fully removed from the project; sold-price history preserved via the
  URL-hash IDs (#586/#587).
- **2026-06-02 — Pascal Karp (Brussels) dealer source (#772).** Shopify
  `products.json` clone of the Falco pattern, EUR; brand left "Other" so
  merge.py owns resolution (no "TAG Heuer"→"Heuer" override, no third brand list).
- **2026-06-04 — Tokant (Paris) dealer source (#803).** Shopify Pascal Karp
  clone scoped to its watches collection, EUR; ~38 listings, non-watch gimmick
  product filtered.
- **2026-06-04 — Romain Réa (Paris) dual source (#804).** Listings (~233, EUR,
  store-wide products.json — collection JSON hidden) + editorial corpus from
  both blogs (16 essays; video/dead-PDF stubs dropped at the <100-word threshold).
- **2026-06-02 — Chrono24 per-reference scraper, residential (#775).** curl-cffi
  Chrome impersonation (CI gets 403, like Bonhams), JSON-LD AggregateOffer parse;
  narrow by design (JLC E2643 test), own `chrono24_lots.json` folded into Listings
  + the reference-guide filter. Manual-run for now; launchd later.
- **2026-06-05 — Chrono24 reference additions (#805/#806).** Omega Seamaster
  145.006 + Heuer 1153 added to `chrono24_lots_scraper.REFERENCES`; runs on the
  same residential cadence as the JLC E2643 test.
- **2026-06-05 — B-58 Watch Center silent CI block fixed (#807).** Site
  errno-101'd on the GHA runner every cron for 6 days, silently swallowed by
  `continue-on-error: true`. Swapped `requests` → `curl_cffi` Chrome
  impersonation (same pattern as Bonhams/Chrono24); workflow install now
  pulls `requirements-auctions.txt`. Logged **B-59** (Watch Club chronic
  truncation-abort, log-only) + **B-60** (silent-fail notifier gap — the
  meta-bug behind B-58) at the same time.
- **2026-06-06 — Hodinkee Picks: curated one-off articles (#810).** Hand-curated
  URL list (`data/hodinkee_picks_urls.json`) for the OCCASIONAL vintage-relevant
  general `/articles/...` piece, complementing Bring a Loupe + Reference Points.
  Reuses BAL's `parse_article()`; same shape as Christie's Stories. Seeded with
  the James Stacey Tudor-collector meet-up.
- **2026-06-07 — Le Monde Edmond editorial source (#835).** WordPress REST API
  scoped to the watch-side categories (fine-watches tree + collecting-investing;
  classic-cars excluded); 278 articles to 2012 seeded. Feeds the corpus + future
  JLC nodes via corpus-reuse.
- **2026-06-07 — Strictly Vintage Watches editorial source (#838).** Charlie
  Dunne's collector-guides site (Squarespace, sitemap discovery); 55 articles
  incl. the 4,400-word "Collectibles of Jaeger-LeCoultre" + the Memovox
  single-reference guides.
- **2026-06-07 — Shuck the Oyster deep-tail retention (B-65, #858).** Slow-moving
  stock drifts past the 50-page crawl cap (a full-site sweep found 36 available
  watches as deep as page ~150). Prior-CSV URLs unseen by the capped walk now
  re-verify each run (available → tracked for life, sold → drop); 36 finds seeded
  + a production cron confirmed the fill.
- **2026-06-12 — Scrape-health gate debounced + maunder hardened + Node-20 bump (#876, B-66/67/68).**
  The gate now pages only after a source misses THRESHOLD=3 consecutive runs (`data/scrape_health_state.json`),
  not on one transient flap; maunderwatches → curl_cffi; checkout@v5 / setup-python@v6 / setup-node@v5.

- **2026-08-30 — Luna Royster keeps the pages it already fetched (#933, B-79).**
  A single 502 on page 19 of a 19-page walk raised and discarded pages 1–18, so no
  CSV was written and three runs of that crossed the gate; `fetch_page` now returns
  None, the walk stops and keeps what it has, and the watchclub/B-59 truncation
  guard (<50% of prior AND <25 absolute) gates the write.
- **2026-08-30 — Watchfid editorial source (#934).** WordPress REST
  `/wp-json/wp/v2/posts`; the existing `watchfid_scraper.py` reads inventory from a
  separate custom post type, so the two can't collide. Elementor installs can
  return bare shortcodes, so shortcodes are stripped, the parse falls back to
  `excerpt.rendered` under a 200-char floor, and the floor is pinned by a test.
- **2026-08-30 — Watches of Lancashire moved to the residential host (#937, B-81).**
  The whole domain 403s datacenter IPs — the homepage too, so there is no page to
  warm a cookie from and curl_cffi no longer helps. Scraper step and its move-step
  line come out of `scrape-listings.yml` (removing the move line is what stops the
  paging); added to the existing Bonhams LaunchAgent, no reinstall needed.
- **2026-08-30 — Scrape-health gate: dated per-source snooze (#938, B-80).**
  Debouncing answers "is this a flap?" but not "we know, and the fix isn't ours";
  `data/scrape_health_snooze.json` mutes a source until a date. It still prints
  every run, expires itself, applies only at/over threshold, flags a stale entry
  once the source recovers, and a malformed or undated entry mutes nothing.

- **2026-08-30 — MVV Watches → Sierra Time Co (#921).** The dealer rebranded and
  replatformed; `mvvwatches.com` now redirects to a Shopify store. Rewrote onto
  `/products.json` (USD confirmed from the storefront, not the TLD).
- **2026-08-30 — Knightsbridge + Lancashire: curl_cffi Chrome impersonation (#922).**
  Both began 403ing CI on a TLS/JA3 check. Knightsbridge holds; **Lancashire relapsed
  within two weeks and is not fixed — see B-81.**
- **2026-10-04 — Two Amsterdam dealers: Amsterdam Watch Company + Amsterdam Vintage Watches (#988).**
  Both WooCommerce Store API, EUR (~275 + ~74 live). AWCo walks vintage, new and special-editions
  categories (gifts dropped) and checks stock in code because its `stock_status` filter double-counts.

## Epic 2 — Auction houses

- **2026-05-XX — Calendar.** Six house calendars (Antiquorum, Bonhams,
  Christie's, Monaco Legend, Phillips, Sotheby's) scraped daily into
  `auctions.json`; month-banded UI.
- **2026-05-XX — Live lots.** Comprehensive per-lot scrape for
  Antiquorum / Christie's / Sotheby's / Phillips into `auction_lots.json`.
- **2026-05-XX — Archive (PR #42).** Manual-archive pipeline +
  Phillips CH080317 (42 Heuer lots, Geneva 2017) as first sale in.
- **2026-05-03 → retired 2026-05-04 — Auction urgency surfacing.**
  "Ending soon" pinned strip; superseded by Saved Auctions sub-tab.
- **2026-05-10 — Auction calendar archive (PR #173).** Past auctions kept
  in `auctions.json` indefinitely; collapsible Archive section.
- **2026-05-19 — Auction lot essays.** Sotheby's catalogueNote /
  provenance / literature (#374), Christie's Lot Essay (#377), Antiquorum
  Notes / Provenance / Literature (#377).
- **2026-05-22 — Monaco Legend comprehensive lots (PR #477).** 5th house
  live via server-rendered Livewire HTML (~428 lots).
- **2026-05-22 — Antiquorum live-URL fallback (PR #473).** Enumerate sales
  whose catalog page hasn't published yet.
- **2026-05-22 — Archive +3 landmark sales (PR #484).** OAK Part 1,
  Daytona Lesson One 2013, Antiquorum Monaco 2023 (399 lots, 272 realised).
- **2026-05-22 — Bonhams comprehensive scrape — blocked from CI.** Code
  works locally; Cloudflare IP-reputation 403s from GitHub Actions (PRs
  #486/#488 didn't clear it).
- **2026-05-24 — Sotheby's archive support (PR #539).** manual_archive_scraper
  gains a Sotheby's URL branch.
- **2026-05-26 — Bonhams lots live, via a residential host (B-24/B-25).** The
  existing-but-CI-blocked `enumerate_bonhams` now runs from a laptop `launchd`
  agent → separate `bonhams_lots.json` folded into the Auctions grid; adaptive
  throttle, one-command portable installer, non-watch (dept≠WCH) sales filtered
  out (#590/#591/#593/#594).
- **2026-05-26 — Auction calendar: house filter + sale→grid (Phase 1A).** Chip
  row filters the calendar by house (#595); "View lots" / title click open the
  in-app grid pre-filtered to that sale — Auctions if live, Sold if past, with a
  subtle ↗ to the house page (#596).
- **2026-05-27 — Auction redesign Phases 2–4 (#604–617).** Image-forward
  calendar cards (top-lot/cover hero → branded colored placeholder); heart/save a
  SALE → `saved_auctions` table + Hearted filter + a "Saved auctions" Watchlists
  row; merged the Calendar sub-tab into a **modal** (sub-tabs 4→3) auto-opening on
  first Auctions visit, launched by a far-left Calendar pill; flat grid with
  **closing-time date headers** + a single sale header when filtered to one sale;
  month-jump nav (Archive→"Closed", pinned right); removed the Sale-picker pill.
- **2026-05-27 — Auction sale cover images: plumbing + Christie's (#619).**
  `merge.py` carries an `image` field end-to-end to `auctions.json`; Christie's
  maps its `__NEXT_DATA__` `ImageUrl`. Other 5 houses are a follow-up (per-house
  extraction); frontend already renders `a.image`.
- **2026-05-28 — Non-watch catalogs removed (#656).** Catalog-level exclusion
  (`EXCLUDE_CATALOG_TITLES` + `is_excluded_catalog`, kept lockstep in
  `auction_lots_scraper.py` for lots + `merge.py` for the calendar) drops
  Sotheby's "Noble & Private Collections" + Bonhams "Espionage: Fact & Fiction"
  from scrape + calendar; purged the existing lots/sales.
- **2026-06-02 — Sotheby's "Fine Jewelry" excluded (#780).** L26050 (~225 jewels,
  ~6 watches) polluted the grid. Added the title to `EXCLUDE_CATALOG_TITLES`, plus
  a new `EXCLUDE_CATALOG_URL_SLUGS` (jewel*) because the calendar cross-lists it in
  the watches category with a misleading "Fine Watches" title but a
  `/fine-jewelry-l26050` URL. Pruned 225 lots + 1 calendar entry.
- **2026-06-02 — Christie's lot images fixed (#781).** Every Christie's lot showed
  "IMAGE NOT AVAILABLE": wsrv.nl's fetcher now times out on `christies.com` (same
  block Bonhams hits) though direct fetch is 200. Added christies.com to
  `imgSrc()`'s direct-serve exceptions.
- **2026-06-06 — Watches of Knightsbridge: 7th comprehensive house (#808).**
  UK Metropress / ab-initio platform; server-rendered HTML with ~60 lots inline
  per sale. New `watchesofknightsbridge_auctions_scraper.py` + an
  `enumerate_watchesofknightsbridge()` registered in `ENUMERATORS`. Heat Wave
  (Jun 6, 60 lots) live-tracked.
- **2026-06-06 — Marteau & Co: 8th comprehensive house (#809).** Geneva-based
  Tandem Auctions platform; contemporary independents (Daniel Roth, Furlan Marri,
  F.P. Journe, MB&F, De Bethune × Urwerk). CHF with the U+2019 thousands
  separator. Previous 2 sales (Echo + First Strike, 55 lots / 53 with realised)
  one-shot backfilled — they're outside the orchestrator's 30-day past-active
  window and would otherwise never get enumerated.
- **2026-06-06 — B-62 WoK post-sale hammer-price recovery (#811 + #812).**
  WoK's main `/auctions/<id>/<slug>` URL hides hammer prices post-close (lot
  card classes only show sold/unsold); the parallel `/past-auctions/<slug>`
  archive surface exposes `data-current-bid="<hammer>"` publicly. Enumerator
  now fetches both, merges hammer by lot UUID, and falls back to prior
  `auction_lots.json` for fields the post-sale grid strips (estimate /
  description / image). Heat Wave: 46 sold (GBP 127,700 realised) + 14 unsold.
  New `lot_outcome` field: `sold` / `sold_price_withheld` / `unsold` / `active`.

- **2026-06-06 — Past-sale catalogs + house-logo stand-ins (#831/#833).** Archive calendar rows get
  "View results →" into the sale's Sold catalog (sold lots now count toward the sale map; past sales gain
  top-lot heroes); coverless tiles render public/logos/<house>.svg|png with text fallback (logos pending Mark).
- **2026-06-12 — Sotheby's lots → GraphQL (#877, B-69).** Their SSR algoliaJson went empty; rewrote
  `enumerate_sothebys` onto the `lotCardsConnection` GraphQL API (clientapi.prod.sothelabs.com), paginated.
  1 lot → 414, with estimates/images/realised prices.
- **2026-06-12 — Monaco Legend sold prices fixed (#878, B-70).** CHF thousands separator is the HTML entity
  `&#039;`; `html.unescape()` before parsing — was reading CHF 32'500 as 32.
- **2026-06-13 — Non-watch Sotheby's sales excluded (#880, B-71).** Added Artistic Luxury + Maurice
  Tempelsman to `EXCLUDE_CATALOG_TITLES` (both lockstep copies).
- **2026-06-13 — Bonhams calendar → residential (#882, B-72).** Department page now 403s CI too; the laptop
  wrapper runs the calendar scraper + commits `data/bonhams_auctions.csv`. Fixed `has_catalog` count-span regex.
- **2026-06-13/14 — Christie's "Watches Online" online-only (#881/#883/#884/#886, B-73).** Read the whole-blob
  `chrComponents`, route the sso URL to the enumerator, curl_cffi the CI-timing-out fetch, reconstruct the
  IP-gated lot images from the deterministic LotImages path. 0 → 87 lots + images, verified in CI.
- **2026-06-14 — DKK added to FX tables (#885, B-74).** Bonhams Copenhagen prices were showing raw DKK as `$`.
- **2026-06-14 — Per-house auction health check (#888, B-75).** `auction_health.py` reds the job when a house
  has a published current catalog but 0 lots (debounced, THRESHOLD=3) — catches the silent-zero enumerator break.
- **2026-06-14/15 — Follow feature, Phase A (#889/#890).** "Follow" = the existing heart/Save-catalog. Home
  **"Finishing soon"** strip (followed lots closing ≤3 days) + **"Auctions you're following"** calendar-style
  catalog tiles (shared `auctionThumb.js`). Phase B (email reminders, Lumé-voiced) is next session.
- **2026-06-18 — Finishing-soon Home section removed (#904).** Both Phase-A strips
  ("Finishing soon" + "Auctions you're following") dropped — Mark judged the on-Home
  ending-soon surfacing wrong after living with it; a better approach is TBD.
- **2026-06-18 — Bonhams calendar: stale 'upcoming' → past (#906, B-78).** Extracted
  `emit_auction_status()`; the date-sanity override now demotes both stale 'live' AND
  'upcoming' hints to 'past' once the end date passes (recycled weekly-sale ids kept
  closed Weeklys flagged 'upcoming' forever). Shared, all houses. +5 pytest cases.

- **2026-08-30 — Auction-calendar health gate + no more fake success (#925).** Four
  calendar scrapers printed "site template may have changed" then `sys.exit(0)`; Monaco
  Legend and Phillips were dead six weeks with a green workflow. They now exit non-zero,
  and `auction_calendar_health.py` gates on the committed CSV (absent *or* header-only)
  with the same debounce as its two siblings.
- **2026-08-30 — Calendar canary (#929).** `calendar_canary.py` fetches all 7 houses for
  real twice weekly and fails on zero, with no debounce — turns "we noticed eventually"
  into "we noticed the day it shipped". Complements the artifact-based gate.
- **2026-08-30 — One auction date grammar instead of five (#928).** Five scrapers each
  carried their own `MONTHS` dict and `parse_date_range`; Phillips' copy parsed
  "7 – 8 November" as a one-day sale while Bonhams' handled it. Now
  `scraper_lib.parse_auction_date_range`; all four migrated scrapers byte-identical
  against live baselines. Sotheby's deliberately left (its parser also returns match
  position).
- **2026-08-30 — Monaco Legend reads structured data (#930).** Parses its schema.org
  `EventSeries` (real ISO dates) with the card parser kept as fallback. Probed all 7
  houses: only this one publishes usable event data, so regex stays elsewhere.
- **2026-08-30 — Calendar coverage gate (#939).** Closes the CSV→`auctions.json` link, so
  a sale lost in the merge can't silently take its lots with it. Keys on
  `merge.auction_id`, not URL — Antiquorum points 5 upcoming sales at one placeholder
  page, and URL keying collapsed 89 sales into 70 lookups.

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
- **2026-05-09 — Watchlists IA pass (PRs #144–#148).** Tab rename
  Saved→Watchlists, Saved virtual list, drill-in filter row, inline view
  settings.
- **2026-05-10 — Usernames + image-cache extension (PRs #174, #180).**
  `user_profiles` table + display name; image cache extended to
  `collection_items` via `cached_img_url`.
- **2026-05-24 — desc-restore for hearted listings (PR #538).** Lazy
  `listings_desc.json` sidecar hydrates desc at heart-time; initial paint
  stays slim.

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
- **2026-05-09 — Share flow rewrite (PR #146).** Collaboration vs
  view-only links; token-based accept (`?invite=<id>`).
- **2026-05-10 — Reactions on shared lists (PRs #177, #183–#185).**
  `collection_item_reactions` + realtime; sentiment-bucket grid + list-row
  count chip.
- **2026-05-11 — Recipient journey (PRs #245–#253).** Recipient banner,
  To-review bucket, ListReviewMode Tinder swipes, undo affordances.
- **2026-05-11 → retired 2026-05-14 — Top-level Share tab (#248/#251 → #282).**
  Discovery folded into Watchlists > Lists; send via per-list Share button.
- **2026-05-14/15 — Screening on new entry points (PRs #283, #310).**
  feed-mode (new-since-last-visit) + auction Review as list-mode screening.

- **2026-05-26 — Reference-intelligence pipeline (PRs #566, #567, #570).**
  Repeatable per-node scrape → Opus 4.7 synthesis → readable digest
  (`reference_sources/` manifests, `reference_corpus_scraper.py`,
  `reference_synthesis.py`, `reference_digest.py`); source-grounded cited JSON,
  every item `applies_to`-scoped so a reference page shows only its slice;
  Submariner + Speedmaster run. First Anthropic-Opus integration.

- **2026-06-03 — Per-type share pass (#787).** Real OG cards for lists/guides/articles
  (name + cover via /share/list_·ref_ links); guide shares land ON the guide; ListReceiver gains a
  view grid + snapshot covers (get_public_list returns listing_snapshot); Save = toggle not dismiss.

## Epic 5 — References

- **2026-05-26 — Reference page pilot: Submariner 5512/5513 (PRs #564, #565,
  #568, #572).** New References sub-tab (2nd in Collecting) — magazine-style
  guide: story, marks, variants, live/auction/sold sliders, connections,
  debated, further reading; LLM synthesis wired in; sticky scroll-spy wayfinding
  + section-header tier + guided learning journey.
- **2026-06-01 — JLC E2643 verified reference guide (#723).** First VERIFIED,
  source-authored node (hand-built from a research dossier cross-checked against
  dealer/auction/forum sources — NOT scraped/synthesised): Shark/Vogue naming,
  Valjoux 72/726, bezel system, marks, variants, all bridge refs; index entry +
  regenerated `watch_references_index.json`. The authored-not-scraped moat.
- **2026-06-01 — Reference-enrichment runbook + helper (#724).** `docs/REFERENCE_ENRICHMENT.md`
  (the 3 homes a source lives in → guide/corpus/synthesis; 7-step add process) +
  `scripts/add_reference_sources.py` (dedup + stub-append source URLs to a node's manifest).
- **2026-04-29 — Watch size comparison.** Two case dimensions →
  preview + print-to-scale on US Letter via React Portal pattern.
- **2026-05-XX — Curated link aggregator (Collecting > Links).**
  Dealers / References / Topics accordion sections.
- **2026-06-02 — Editorial corpus scrape twice weekly (B-28, #774).** Cron
  Sun→Sun+Wed for fresher article rotation. LLM topic-tagger stays Sunday-only
  by design (Wed articles tag the following Sunday) — recorded in both workflow
  headers; themes are recommender substrate, not UI-surfaced.
- **2026-06-07 — JLC Polaris E859 guide, built end-to-end (#834-#836, #839).**
  Mark's verified dossier + a 36-source Opus synthesis (manifest → pipeline →
  authored page). Anchors the vintage E859, carries the line through the 2008
  Tribute + 2018 collection; 6 Wind Vintage sold examples seeded into the public
  archive. Hybrid (Route A + B) is now the node recipe.
- **2026-06-07 — Reference-page editorial redesign (#841, #843-#845, #849, #854).**
  All guides moved from encyclopedia modules to a collector-led essay: single
  reading column (drop-cap + two-column intro gone), Production narrative (was
  the Evidence/debate blocks), Reference stories promoted into the body,
  What-to-notice + Key-configurations as image strips, grey due-diligence
  checklist removed. E2643 + Submariner 5512/5513 content-edited to match.
- **2026-06-07 — Collecting-arc connections across all 5 guides (#837).**
  Similar/Adjacent/Edge buckets whose why-line explains the bridge, not the
  resemblance; edge recs as taste-hypothesis tests (rationale in
  RECOMMENDER_STRATEGY "Reference-page connection buckets").
- **2026-06-07 — Coming-soon guides: frosted preview + suggestion box (#846-#848).**
  Stubs render the real layout under a blur with an interest button + a
  suggest-the-next-guide box (mailto); hero thumbnails on the Seamaster 300 /
  Railmaster cards. (#847 = break-now guard for stubs' missing `market`;
  #848 = its render-test.)

## Epic 6 — Collection mentality

- **2026-05-03 — Watch Challenges v1.** Constrained hypothetical
  collections; ONE collection per challenge with `type='challenge'`.
- **2026-05-06 — Watch Challenges rebuild (PRs #71, #73, #74, #75, #76).**
  3-stage stepper, click-pick everywhere, source picker over Lists/Favorites.
- **2026-05-06 — Watch Challenges v1.5 (PRs #78, #80, #90).**
  `?newchallenge=1` + `?challenge=<id>&shared=1` receive flows + sender attribution.
- **2026-05-14 — Watchbox top-level tab (PR #289).** My Watches lifted to
  `tab=watchbox`, reached via the avatar dropdown (no main-nav pill).

## Epic 7 — Discovery & recommender

- **2026-05-18 — RECOMMENDER_STRATEGY.md.** Three-layer model (reference
  knowledge / collector mentality / recommendation) + Robustness Anxiety
  case pattern.
- **2026-05-20 — Articles as first-class (PRs #403–#405, #399).** Hearted
  articles, saved-articles virtual row, add-to-list + Articles section in
  drill-ins, my-reactions virtual list.
- **2026-05-20 — collector_profile_analyzer.py.** LLM collector-profile
  generation from hearts / lists / reactions (→ COLLECTOR_HANDOFF).
- **2026-05-27 — Screening collapse → binary skip/heart (#598–603).** The swipe
  screener reshaped to right=heart→watchlist / left=skip; Undo reverses a save.
  Retired the whole emoji-reaction system — code AND data: dropped the
  `collection_item_reactions` table + 3 RPCs + `get_or_create_auction_list`,
  deleted 191 reactions + the auction auto-list collections (migration
  `2026-05-26_drop_reaction_substrate.sql`); removed the buckets, per-card rating,
  "My reactions" row, Screening sub-tab, and the auction Review/Add-to-list flow.

## Epic 8 — Site analytics (admin-only)

- **2026-05-02 — Source quality dashboard.** Per-source admin table:
  live count, hearts, heart-rate, avg price, top brand, earning-its-keep chip.
- **2026-05-05 — Total throughput in value.** Per-source rolling
  30-day `$ added` and `$ sold` columns on Source quality table.
- **2026-05-05 — Auction-house quality dashboard.** Six-house table:
  sales counts, sold rate, $ sold (90d), median Hammer/Low ratio.
- **2026-05-05 — User stats v1 (`listing_events`).** Raw events table +
  daily rollup + telemetry hook + engagement columns on Source quality.
- **2026-05-09 — Realtime + listing velocity (PRs #150, #151/#152).**
  Live shared-list sync; "SOLD · Nd" chip + per-brand cycle-speed rollup.
- **2026-05-24 — AdminTab freshness signal (PR #535).** `updated_at`
  render + "STALE — last run Nh ago" above 12h.

## Epic 9 — IA / UX redesign

- **2026-05-27 — IA/UX redesign plan filed (#623).** docs/IA_REDESIGN.md canonical
  (three-speeds tab model · dossier keystone); BUGS → Epics A/B/C + phase tracker; ROADMAP Epic 9.
- **2026-05-27 — Reference browsing tree (#625/#627).** Brand › Model line › Reference +
  breadcrumbs (ReferenceBrowse); 5512/5513 live + 2 Omega "coming soon" stubs + subscribe teaser.
- **2026-05-27 — Watchlists dossier, Phase 1b (#628).** `collection_blocks` table + DossierBlocks
  (note/reference/saved-search free-order blocks) in list drill-ins. Plumbing only; B-08 tab-unify pending.
- **2026-05-27 — Editorial → "Articles" (#626).** Sub-tab + saved-articles copy renamed.
- **2026-05-27 — Search: Articles bar + reference guides in results (#630/#631).** In-Articles search
  restored; reference-guides strip in global search; results use current tab names.
- **2026-05-27 — Watchlists unified into one rich scroll · Phase 1 / B-08 (#638).** Lists + Searches
  sub-tabs collapsed into a single landing — Watchbox anchor · unified Saved (type filter) · cover-image
  list cards · Saved searches · Shared; pills retired, legacy `?sub=` coerced to the landing.
- **2026-05-27 — Watchlists landing polish (#639–#644).** Magazine look-and-feel (serif = editorial,
  sans = UI), article-style list cards, favicon image fallback (B-38), Watchbox → slim link with
  hearted/Saved leading, bigger tiles, distinct in-list header, drill-in back-nav fix, list rename/delete
  (cards + in-list), hearted "♡ Saved" filter chip, Saved band on the shared CardStrip.

- **2026-06-02 — Lists tab redesign · Phases 1–5 (#729–#734, #742, #750, #755, #758).**
  Sub-tabbed Lists landing on **♡ Saved** (typed bookmark sections Watches/Articles/Sales;
  search matches dealer); **save reference guides** + Guides type (closes B-37); bigger
  list cards (title-below, matched to guide/article cards); land-in-new-list + boxed
  empty-list onboarding; **sectioned Lists page** (Your lists · Shared · Saved sales,
  retiring the Shared sub-tab); auctions get a **prominent catalog header + save/share**.
- **2026-06-02 — Collecting tab redesign (#733, #743, #753, #757).** Reference guides
  flattened to **cards + search/filter**; size/links/challenges bundled under **"Tools"**;
  "References" → "Reference guides"; bespoke H1/explainer dropped to match other surfaces;
  guide cards get **heart + ⋯ menu** (save / add-to-list / share / Ask Lumé).
- **2026-06-02 — Unified share surface · Phase 6 (#735–#741, #746–#749, #752).** Extracted
  **`SharedReceiveFrame`** — one parametrized bleed shell (attribution + hero/identity slots
  + fixed-verb action bar + responsive two-column desktop + viewport-dynamic hero); listing
  receiver renders through it; **seeded "Ask Lumé"** via the floating launcher callout (not
  a button), generic launcher suppressed on share surfaces; sender `?from` preserved.
- **2026-06-02 — Chrome unification + curation (#744, #745, #751, #754, #756, #759).**
  Unified **bleed-bar `PageHeader`** across catalog / Saved / Lists / Searches / Reference
  guides (Watchbox folded into the Lists header, vault card retired); **red-heart → Saved**
  shortcut in the top-right, white-outline icon matching Home, fills red on hover; Home
  **"×"** overlay retired (admin Hide is the single curation tool); duplicate signed-out
  "About" removed; filter bar left-aligned + reset-to-base on Auctions return.
- **2026-06-02 — Shared-list two-mode surface (#760/#761).** Recipient reskinned onto
  `SharedReceiveFrame` (cover-card preview, no read-only grid) with two clearly-labelled
  outcomes; sender share sheet relabelled **Send a copy** / **Collaborate**.
- **2026-06-02 — Collapsing header pattern (#762/#764/#771).** Title scrolls away while the
  filter bar pins — shipped on the auction catalog, the Saved tab, and the Reference guides +
  Articles sub-tabs (one pattern, four surfaces).
- **2026-06-02 — Auction catalog Share → in-app link (#765).** Share emits `?catalog=…` →
  new `CatalogReceiver` (unified frame) instead of the dead-end auction-house URL; added a
  "→ Auction house" link by the header.
- **2026-06-02 — Auctions copy + Add-to-list + B-55 (#766/#767/#768).** Desktop "Auction
  Calendar" label + "sales"→"auctions" consistency; Add-to-list **Done** in a sticky header
  (no scroll-to-commit); leaving a catalog for Watches/Listings resets the sale filter.
- **2026-06-02 — Standard-library card grid (#769).** One shared `cardGridStyle` → article =
  reference-guide = list cards (same size).
- **2026-06-02 — Saved grouping dropped (#770).** The Brand/Source group pills (briefly added
  #763) were redundant with the Source/Brand filters — removed (−186 lines); Saved is a flat
  newest-first grid.

### Lumé — the AI spine (Epic 9 / Phase A)

- **2026-05-29 — Lumé AI concierge v1 (#680/#681/#682).** Grounded watch-expert chat in a
  bottom-right bubble — signed-in only, daily-capped (`ai_chat_usage` + `consume_chat_quota` RPC).
  `api/chat.js` runs a bounded tool-use loop over the corpus (user's saved data, live/sold listings,
  auction state, reference index + deep-dive syntheses); cites source URLs, never free-generates facts.
- **2026-05-29 — Lumé bubble polish + offer→do actions.** Markdown + clickable links, mic dictation,
  "Ask me" callout, signed-out→sign-in prompt, hide-on-action; action set show_listings / open_watch /
  read_more / add_to_list / create_list / save_note wired via an ActionBus to App handlers.
- **2026-05-29 — Watch lexicon Phase 1 (#691).** `public/watch_lexicon.json` seed injected as a cached
  glossary so Lumé expands collector slang (speedie/panda/QP/DON) to canonical terms; Phase-2 corpus
  miner + workflow built (cost-capped, not yet run).
- **2026-05-30 — Lumé Phase 2: generic reference grounding (#702).** `get_reference` now serves ANY
  saved model line's deep-dive by node slug (drops the hardcoded Sub/Speedy grep) and returns named dial
  "marks"; SYSTEM_PROMPT externalised to `public/lume_system_prompt.txt`; ref search-term discipline +
  sold/auction offers. Built on `node_slug` + saved-node pipeline (#698) + `min_sources` knob (#703).
- **2026-05-30 — Lumé saved-node syntheses (fan-out).** Mined 607 saved watches → 5 source-cited
  model-line deep-dives synthesised + live (Heuer Carrera/Autavia, Omega Seamaster 300, Rolex
  Day-Date/Datejust); Lumé's deep coverage 2 → 7 model lines.
- **2026-05-30 — Lumé mark + chat timeout hotfix (#700/#701/#704).** Vintage flat-patina lume-triangle
  icon; `api/chat` `maxDuration: 60` — Opus tool-loop turns were being killed at Vercel's ~10–15s
  default (the "Something went wrong" outage); same PR repaired two tests the fan-out had broken on main.
- **2026-05-31 — Lumé knowledge + behaviour pass (#702/#709/#713/#714/#715).** `search_articles` tool
  (Lumé can finally read the 13k-article editorial corpus — fixed the Enicar blindness); prompt: lead
  with knowledge not listings, know-your-limits (filter tiers: brand/model/single-ref only; attributes
  aren't filterable → coach), don't quote listing counts ("there are N listed", not "we have N"), never
  join two refs, humble + no plumbing-talk, never call a real listing mislabeled, never reply actions-only.
  Fixed two empty-answer dead-ends (loop-exhaustion + actions-only).
- **2026-05-31 — Lumé eval harness (#710 + fixes).** `src/lume_eval.test.js` drives the real prompt+tools
  over regression scenarios (LUME_EVAL=1 workflow, gated/skipped on normal CI); first live run confirmed
  6/8 fixes + auto-caught 2 real bugs. Foundation for the discovery eval (LLM-judge, next).
- **2026-05-31 — Collector-mentality tagging live on essay sources.** `corpus_topic_indexer` taxonomy +4
  mentality themes (collecting_philosophy/collector_mindset/life_lessons/community_ethics) + 4 sources;
  tagged Screwdown Crown (175 mentality) / A Collected Man / Christie's (WOE re-running). search_articles
  returns `themes` so Lumé sees them. Fixed the commit step that had discarded a 3.5h/$12 run (B-44 class).
- **2026-05-31 — Lumé mobile + reach (#705/#700/#701/#712).** Full-screen mobile chat + scroll-lock +
  minimise; flat mint-pip → glowing-pip icon; SW cache-version bump (purged a stale old-build cache).
- **2026-05-31 — Share with Lumé + article actions (#717/#718).** B-52: a built-in "Share with Lumé" ⋯
  row on every card (LumeBus, app→Lumé) opens the bubble seeded with that listing. B-37: heart + ⋯
  (add-to-list/share/Share-with-Lumé) on Home article tiles via articleAsListing.
- **2026-05-31 — Lumé remembers you (#719/#721).** `ai_user_profile` table (RLS own-row, `enabled` switch)
  — an evolving per-user taste profile loaded into chat context (durable across sessions + survives the
  20-msg history truncation = fixes long-chat forgetfulness), refreshed by a cheap gated Haiku pass. Write
  via SECURITY DEFINER RPC (direct authenticated upserts are rejected on this project). Settings →
  "Lumé memory" panel: view / on-off / reset.
- **2026-05-31 — Lumé: explore-not-shop + hedge + leak fix (#720).** Stop driving to buy (journey not
  checkout); never claim a complete list / superlative it can't ground ("three notable ones", not "the
  only"); strip dangling `<actions>` so truncated replies can't leak raw code.
- **2026-06-01 — Lumé web search (#722).** Anthropic native `web_search` server tool, corpus-FIRST
  (last resort for knowledge only, never inventory), always cited (auto Sources footer), `max_uses` 3 —
  Lumé's reach beyond our library and the knowledge-gap SENSOR.
- **2026-06-01 — Lumé "always suggest a next step" + config ledger (#725).** Prompt rule: every reply
  ends with a concrete next step from a REAL capability. `docs/LUME_CONFIG_REQUESTS.md` = the running
  ledger of Mark's behavioral/config requests (date · request · where encoded · status).

- **2026-06-03 — IA restructure: 4 top tabs (#784).** Watches · **Saved** (was "Lists") ·
  **Articles** · **Reference Guides** ("Guides" mobile); Collecting dissolved, Tools → account
  menu, mobile Saved-heart parity. One shared topTabs model; internal keys/URLs unchanged.
- **2026-06-03 — Standard chrome library (#786/#788).** One PageHeader (one-inset rule, count
  slots) + StandardFilterBar (pills left · centered fixed search slot · reserved right count) +
  StandardSearchInput across Watches/Saved/Articles/Guides; Date pill + duplicate searches removed;
  ActiveFiltersStrip stops echoing single-pill state.
- **2026-06-03 — Polish wave from Mark's live pass (#782/#783/#789/#790/#792).** Settings sheet
  pinned header + modal viewport guard; guide section-nav sticky fix; re-tap active sub-tab exits
  drill-ins; in-list view → PageHeader + section quick-nav + compact add-pills; counts never under
  titles (bar/right rule).

- **2026-06-06 — First-time-user usability audit (#813, grade C+).** Playwright walkthrough of
  the live site, 9-task battery, screenshot evidence + repeatable driver in docs/audits/2026-06-06-usability/;
  findings routed (U-01 sub-tab/pill confusion field-confirmed → dispatch-layer evidence; B-51 upgraded; B-63/B-64 opened).
- **2026-06-06 — Sub-tab restyle + audit quick fixes (#814–#817).** SubTabBar → enclosed segmented
  control (segTrack/segItem; nav out-shouts filter pills) + "For sale" outcome label; HAMMER→SOLD FOR / CURRENT BID
  copy sweep + brand-first search placeholders + labeled mobile Filter pill; Escape closes sign-in modal & filter
  sheet (B-63); empty Saved drops the "0"+sort-pill chrome.
- **2026-06-06 — Desktop top-bar rework (#818/#819/#822/#823).** Tabs left (sub-tabs align beneath),
  wordmark centered ≥1280px (text-only), ⌂ home button leads the tab row at every width — two collision
  regressions found by Mark and fixed same-hour, with DesktopShell viewport tests pinning both states.
- **2026-06-06 — Search improvements (#820/#821).** Home "Search in" menu gains an Articles target
  (routes to the Articles tab with the query applied); StandardSearchInput surface-filled so the field
  is visible off-Home.
- **2026-06-06 — Responsive chrome ladder (#832, closes B-64).** StandardFilterBar stacks (search line +
  wrapping pills) below 1250px; mobile cutover raised 640→760px; ladder now <760 mobile · 760–1250 stacked · ≥1280 full bar.
- **2026-06-06 — Admin article curation (#824).** "Remove article (admin)" in the article ⋯ menu writes
  the shortHash(url) id into admin_hidden_listings; removed articles drop from Articles tab, Home strip, Search-all.
- **2026-06-07 — About modal v2 (#850, #853).** Three-question restructure (what / why trust / what next):
  six count-free capability cards incl. **Ask (Lumé)**, How-it-works second view with current naming, letter badges + stale counts gone; B-56 modal half.
- **2026-06-07 — Home bottom bleed band removed (#851, #852).** Briefly re-anchored Watchbox → Reference
  Guides, then cut entirely per Mark; dead LiveCounts/homeCounts gone; HomeTab + AboutModal got their first direct render tests.
- **2026-06-13 — Auction catalogue = full-page surface (#879).** Drilling into a sale promotes it to a
  full-page view like the calendar: green bar + sale title + persistent × → calendar, Save/Share/Auction-house
  row beneath; both shells via a shared `catalogFullPage` chrome takeover.

## Epic 10 — Lumé (AI spine)

- **2026-08-31 — Seeded Lumé opens skip the standard intro (#936).** "Share with Lumé" (card ⋯) and
  the share-receive "Ask Lumé" callout now open the chat with no greeting and no starter chips, so the
  answer about that watch leads instead of the "what's your watch problem?" boilerplate; a plain
  launcher open is unchanged. `ChatBubbleHost` tracks the seeded open; sticks for the life of the thread.

- **2026-06-18 — Lumé canvas: prompt-driven → guided editorial session (#894–#901).** Built the Lumé
  tab from a static page into a morphing canvas: prompt-driven view router + unified in-canvas search
  over listings/sold/auctions (#894/#895), warm designed landing with greeting + hero + live counts
  (#896), desktop two-pane content/chat-rail (#897), a perceptive hook library that turns real data
  into one named "it-knew-that" opener (#898), warmer chat-rail cold open + saved-search grammar fix
  (#899). Then re-cut to Mark's revised spec (#901): ONE "Start here" lead with visible evidence,
  curated shelves (Worth your attention / Useful comps / Rabbit holes) over feature-category views,
  grounded reason chips, demoted counts, and a contextual session-guide rail ("Ask Lumé about this
  view"). New: lumeHooks/lumeReasons/lumeColdOpen + LumeLead/LumeModule/LumeReasonChip.
- **2026-06-18 — Lumé model-routing A/B switch (#900, #902→#903).** `LUME_FORCE_SMART_MODEL` env switch
  + `chooseModel`/`MODEL_FAST`/`MODEL_SMART` in api/lume_reference.js (SDK-free so jest can test it) to
  isolate weak-chat-feel as Haiku-tier vs prompt-overload. #902 temporarily forced chat to Opus for a
  live A/B; reverted in #903 (chat is back on the Haiku-default router).
- **2026-06-18 — Standalone Lumé tab removed; design re-homed in the bubble (#905).** Dropped the 5th
  "Lumé" top pill, `lumeTabJSX`, the App-owned `lumeChat` instance, and the "Make Lumé my home" landing
  pref (DB column left dormant). The bubble's desktop ⤢-expanded mode now mounts the full `LumeCanvas`
  (greeting + lead + shelves + chat rail); the corner frame + mobile keep the bare `LumeConversation`.
  `ChatBubbleHost` gained the feed props; `LumeTab.test.jsx` → `LumeCanvas.test.jsx`.

- **2026-06-16 — Lumé full-page surface (#871–#873, #891, #893).** A real **Lumé tab** (journey
  launchers + inline chat) over a shared `LumeConversation` core extracted from the bubble; bubble
  gained desktop **expand-to-fullscreen**; shared-surface link gets a top-right × + stays open on
  desktop (#871); **"Make Lumé my home"** default-landing pref (#893, `user_settings.default_landing_tab`).
- **2026-06-16 — Lumé find_missed fix + catch-up journeys (#869/#870).** Killed the quoted listing
  count (tool no longer hands the model the total); every named watch is now an inline link + action
  chips; the "what did I miss" family chains live → got-away → widen-30d → hearted-sold → latest.
- **2026-06-16 — Saved sub-tab ♡ Saved → ♡ Watches (#892).** Kills the Saved▸Saved echo; label-only,
  internal `hearted` key unchanged. (Auctions-promotion restructure logged in ROADMAP Epic 9, not built.)

- **2026-06-03 — Lumé seed re-send fix (#785).** Reopening a seeded chat no longer re-fires the
  seed question (one wasted model turn per round-trip); transcripts persist in the bubble.
- **2026-06-03 — One Lumé list.** docs/LUME_ROADMAP.md retired; all AI direction lives as ROADMAP
  Epic 10's single 15-item list (incl. graduated B-45/46/47/51 + the P-27/28/31 UX trio).

- **2026-06-03 — Verification-round polish (#794–#802).** Heart-matched avatar ring; one-row
  PageHeader (actions/count inline); title-height ledger (one px-above-title rule); CHROME metrics
  token sheet; sign-out under the identity; Articles flat grid (year roll-up retired); About
  auto-open retired; CardStrip webkit-scrollbar hide; guide images filled from cited og:image +
  wsrv→raw→favicon retry ladder.

- **2026-06-09 — Lumé "What You Missed" feature (#861–#864, #868).** The
  twin user story end-to-end. **Voice (#861):** tone brief merged into
  `lume_system_prompt.txt` (plain words, no price ladder, never invent user
  constructs, concrete reasons, recommendation distance, don't-pad) + CI static
  guard + live tone evals; brief saved as docs/LUME_TONE_GUIDANCE.md.
  **Retrieval (#862):** `find_missed` tool, saved-state aware, 3 modes —
  `live_unsaved` / `sold_unsaved` (the ones that got away, sorted fastest-sale
  first w/ time-to-sell + sold price) / `sold_saved`. **Journey (#863):** body
  links → in-app shared surface, "← Back" control, re-clickable chips. **Link
  fix (#864):** every surfaced watch linked inline; never re-search and claim a
  shown watch "isn't in our system". **Routing + em-dash (#868):** resolve reply
  links by URL match (the feed id is SHA1, not shortHash — the hash resolver sent
  every link to the dealer); em-dashes stripped server-side.
- **2026-06-09 — Lumé conversation+judge probe (#865).** `tools/lume_probe.py`
  runs multi-turn scenarios through the real prompt+data on the real models, then
  an LLM judge grades each reply against the LUME_TONE_GUIDANCE rubric. Dev tool
  (needs the API key); the systematic replacement for spot-checking live.

## UI & chrome (cross-cutting)

- **2026-09-08 — Watches tab in the magazine's chrome, behind `?view=watches` (#978).** A parallel
  page (`MagazineWatches`) that restyles the chrome only: the grid, cards, hearts, filters and the
  calendar modal arrive as the shells' own `listingsTabContentJSX`. Still flagged — not promoted.
- **2026-09-08 — Watches page takes the app's type, keeps the magazine's colour (#979).** Mark on the
  live page: the three magazine faces came off, the system stack came back, and the wordmark changed
  to the app's uppercase treatment in olive. Scoped `.mag.magw`, so the landing page keeps Bodoni.
- **2026-09-08 — One account control on mobile Home (#978).** `MobileShell` still rendered its brand
  row under `MagazineChrome`'s masthead, so Home showed two hamburgers; signed-out now reads
  "Sign in" and opens the same menu the signed-in initial opens, on both viewports.
- **2026-09-08 — Masthead and dealer-rail polish (#978/#979).** The dealer label moved above its
  scrolling pills (inline, it ate ~160px of a row already scrolling — one pill visible at 390px);
  the saved heart dropped its count badge and matched the account disc's size.
- **2026-09-08 — App.test.jsx was passing vacuously (#978).** Its fetch mock matched `listings.json`
  while the app fetches `listings_live.json`, so every App test rendered the load-error screen — and
  the `/Listings/i` sanity matcher was satisfied by "Couldn't pull the listings". Now a real render.
- **2026-09-07 — Magazine landing page, and HomeTab retired (#955–#977).** A magazine-format Home
  built behind `?view=magazine`, used daily for a week, then promoted to the default; the old
  HomeTab (1,048 lines) deleted and its footer extracted to `SiteFooter.js`.
- **2026-09-07 — MagazineChrome extracted (#977).** Masthead, tabs, search and account row pulled
  into one component that renders the app's own `authJSX` rather than a second set of controls.
- **2026-09-07 — Dealer shortcuts from your own hearts (#962/#971).** Chips ranked from the user's
  watchlist (auction houses excluded), seeded from a curated order when signed out, marks resolved
  from each dealer's favicon so no logo files are needed.
- **2026-09-07 — Tab order Watches · Articles · Saved · Reference Guides (#971).** Reading moves
  second; Saved follows the two browse surfaces.
- **2026-09-07 — Publication names, not corpus keys (#973).** `App` attached `_source.label = key`,
  so every surface rendered "ROLEX_MAGAZINE"; `EditorialView` now exports `sourceLabel` and App uses it.
- **2026-09-07 — `/ui-review` panel + the review that drove all of the above (#942).** Six expert
  lenses over one measured evidence pack, then a synthesis that ranks a build sequence.

- **2026-05-27 — Home "Articles" strip + reorder (#636).** Idle-loaded recent editorial; Home strips
  reordered added·articles·sold·hearted·ending.
- **2026-05-27 — CardStrip scroll indicator (#635).** Slim desktop-only horizontal scroll indicator on every shared strip.
- **2026-05-27 — Auction calendar nav (#632).** Removed the no-op "ALL"; "CLOSED" moved left of the month chips.
- **2026-05-27 — Settings green + mobile view-settings (#634).** Selected buttons use brand green; view settings off the mobile filter tray → Display settings.
- **2026-05-15 — Maintenance session (PRs #296–#307).** Test hardening,
  dead-code deletion, 8 new design tokens, `confirm()`/ConfirmHost
  replacing every `window.confirm`.
- **2026-05-22 — Olive chrome identity zone (PRs #445–#453).** Olive
  (`#3b4a36`) on non-Home tabs both shells; identity bands retired (#448);
  dynamic PWA theme-color.
- **2026-05-22 — Mobile shell redesign (PRs #432–#443).** Main tabs to the
  top stack, bottom nav retired, Spotify-pattern search-focus overlay.
- **2026-05-22 — Cross-tab "Search all" destination (PR #444).** Reworked
  into a 4-strip search-results surface (live / auctions / articles / sold).
- **2026-05-22 — Editorial density pass (PR #454).** Card excerpt dropped,
  initial page 100→40, infinite scroll.
- **2026-05-22 — Screening relocated to a Collecting destination (#512–#522).**
  Pool cards (auction catalogs / your lists / shared lists) instead of an action.
- **2026-05-22 — Auction tab closing-time bands + Sale filter chip (#524–#528).**
  "Closing today / this week / …" grouping replaces sale-grouping.
- **2026-05-24 — Shared FilterRow primitive (PR #537).** Listings +
  Editorial filter rows extracted so they can't drift apart.
- **2026-05-24 — listings.json live/sold split, Phase 1 (PR #542).**
  merge.py emits listings_live.json (eager) + listings_sold.json (lazy);
  first-paint payload 4.15→2.93 MB (~29%). Full file kept for backend +
  stale PWA bundles; Phase 2 (drop the dup) tracked in ROADMAP.
- **2026-05-24 — Unified card design system, S1–S4 (PRs #558/#560/#561/#562).**
  Shared `CardShell` (image + L1/L2/L3 text slots + action stack + one portal
  menu) and `CardStrip`; priced cards, all horizontal strips, the Search-all
  article strip, and the Collections article grids now render through one
  primitive. Editorial magazine card is the deliberate exception, parked for
  the design-uplift pass.
- **2026-05-24 — Sticky-chrome pass (PRs #547/#549/#550/#552).** Main tabs
  pinned on scroll across all tabs; Home nav band made olive + sticky; the
  long-recurring desktop see-through "divider gap" fixed at the root (a sticky
  child sitting below the scroll-pane's top padding).
- **2026-05-24 — Search-all + editorial fixes (PRs #554/#555/#556/#557).**
  Search-all returns articles for any query (was a meta-only parse bug that
  dropped every source); article cards squared + strip grey edge removed;
  editorial filter chrome portaled into the shell sticky stack so search no
  longer gets squashed.
- **2026-05-24 — Screening + catalog polish (PRs #544/#545/#546).** "Take a
  break" interstitial 25→50; auction-catalog rows show house + sale date;
  auction-screening onboarding distinguishes watch (Yes) vs save (Heart).
- **2026-05-24 — Bug-backlog workflow + consistency principle (PRs #543/#553).**
  BUGS.md durable backlog + `Bug:`/`Plan:` prefixes (nothing lost between
  sessions); CLAUDE.md cross-surface consistency rule (divergence is a smell →
  fix the shared root, not per-surface band-aids).
- **2026-05-28 — Doc-only close lands straight on main (#653).** Fixed the
  recurring strand: `/wrap` step 5 + CLAUDE.md now commit the doc-only close
  directly to main (no PR/side-branch), so SHIPPED can't silently fall behind
  what shipped (root cause of the 2026-05-28 SHIPPED gap, recovered via #652).
- **2026-05-26 — Defer ~15 MB of non-critical JSON off first paint (B-17).**
  Auction/editorial-archive fetches moved to `requestIdleCallback` after first
  paint, so the default Listings>Live no longer competes with ~15 MB of
  fetch+parse on mobile (#577).
- **2026-05-26 — Code-split AdminTab (B-22 phase 1).** `React.lazy` + Suspense
  so admin-only code leaves every public visitor's initial bundle (#579).
- **2026-05-28 — Image resize via wsrv.nl (#646).** All dealer/auction images
  served through the free wsrv resize CDN at display width as WebP (5 MB Loupe
  This photos → ~40 KB); first-load payload ~198→~13 MB, desktop LCP 19→6 s.
- **2026-05-28 — Home first-paint diet (#647).** Below-the-fold strips render
  on scroll (`DeferUntilVisible`); first LCP image eager; `listings_desc` idle-
  loaded; Bonhams served direct.
- **2026-05-28 — Blob images → thumbnails (#648).** `cache_watchlist_images.mjs`
  stores ~600 px WebP via wsrv (not full-res); one-time re-process shrank 382
  existing blobs (storage ~242→~20 MB). Transfer, not storage, was the capped meter.
- **2026-05-28 — Code-split AuctionCalendar + Search-all (#649, B-22 phase 2).**
  `React.lazy` + Suspense — each its own chunk, fetched only when opened.
- **2026-05-28 — Mobile: no auto auction-calendar popup (#650).** Desktop keeps
  the calendar-first popup; mobile drops straight into the grid (button still opens it).
- **2026-05-28 — Tropical Watch images served direct (#651).** TW's ~240 px
  CloudFront source got grainy through the resizer; serve it (and Bonhams) direct.
- **2026-05-28 — Top tabs renamed (#655).** Labels Listings→Watches,
  Watchlists→Lists (Collecting unchanged); internal keys / URLs / storage keys
  unchanged (label-only).
- **2026-05-28 — Auction filter "Calendar" pill + catalog card (#657/#663).**
  Launcher restyled to a filter pill ("Calendar"); a single-sale view shows an
  olive catalog-context card (house·location·date → name → lot count) with
  "← Exit Auction"; mobile dead-end fixed (always-visible exit); the sale filter
  no longer applies on Sold for a LIVE sale (closed sales still show their sold
  lots); redundant "Closing this…" divider suppressed in single-catalog view;
  modal title → "Auction Calendar".
- **2026-05-28 — Pill/button library unified on olive (#658–#662).** One shared
  `SELECTED_FILL` (olive tint + `--brand-olive-ink` + 0.5 px hairline) for every
  active toggle (`pillBase`/`innerToggleButton`/`iconButton`/Chip); new
  `clearAllPill` + `dismissChip` helpers; a SINGLE "Clear all" in the active-
  filters chips strip (per-panel + filter-bar copies removed); primary CTAs
  (`signInButton`/`producedPill` + ~16 inline) swept blue→olive — `--brand` blue
  is now links / text-accents only. DESIGN_SYSTEM documents the state + clear rules.
- **2026-05-28 — Home masthead + account-menu polish (#664–#667).** Account pill
  → bare "M" (Watchbox label dropped; settings popout decluttered — Sign out under
  the name, "Settings" header); desktop subtab font bump; Articles strip's right-
  edge fade moved INTO the shared CardStrip (all strips match); minimal Home top
  bar made an absolute overlay so the moonphase isn't clipped + small top spacing;
  home icon added to the wordmark home-button (a user couldn't tell it was "home").
- **2026-05-28 — CardStrip scroll: drop the laggy thumb (#670).** The custom JS
  thumb drove setState every scroll frame + eased 0.06s behind the scroll; replaced
  with a right-edge fade (hides at end) + snap `mandatory→proximity`. Zero scroll jank.
- **2026-05-28 — Shared SubTabBar component (#671).** All underline sub-tab rows
  (Watches/Collecting sub-tabs + the Lists-page section-nav) now share one component.
  The Lists row was hand-rolled at a different font size/weight/underline — unified.
- **2026-05-28 — Articles: date pill left of search bar (#672).** Sort/Date pill
  reordered ahead of the search input in the Editorial filter row.
- **2026-05-28 — Listings: search bar stable across sub-tabs (#673).** Desktop
  search bar jumped right when switching Listings→Auctions (Calendar pill conditionally
  widened the left cluster). Ghost-pill reserves constant width; search stays put.
- **2026-05-28 — Account menu: unified left edge, drop "Settings" label (#676).**
  Sign-out / Site-stats / settings block all now share one 8 px left inset. Removed the
  redundant "Settings" umbrella label (it duplicated + clashed with Currency/Theme/Columns).
- **2026-05-28 — Typography system: serif/sans codified (#668, #669).** Font
  stacks consolidated into `FONT_SANS`/`FONT_SERIF`/`FONT_SERIF_DISPLAY` tokens
  (the 4 duplicated serif consts + the two colliding `SANS_STACK` removed; editorial
  serif unified on **Hoefler Text**; CardShell's portal stack → `PORTAL_SANS`).
- **2026-05-28 — Editorial type ramp (#669).** `editorialDisplay`/`Heading`/
  `Title`/`Prose` factories bundle the full reading recipe (face+leading+tracking);
  existing editorial surfaces consume them; extended only to the ReferenceBrowse
  teaser. DESIGN_SYSTEM carries the system + the "serif = read, never on chrome"
  guardrail. Serif deliberately NOT added to search hero / empty states / list names.
- **2026-06-07 — Em-dashes removed from all user-facing copy (#840).** ~420 string-literal
  instances rewritten (colon/comma/period/parens; en-dash kept for ranges, lone "—" placeholder glyph kept).
  Durable rule → BRAND.md voice + a hard line in Lumé's system prompt so generated replies comply. The LLM-tell that costs credibility.
- **2026-06-07 — copy-guard.test.js (#855).** Jest enforcement of the BRAND.md em-dash ban
  (chrome-guard pattern: comments stripped, placeholder "—" glyphs allowed); caught + fixed 8 strings the #840 sweep missed.
- **2026-06-14 — Sold sub-tab drops the Auction-Calendar pill (#887).** The calendar is upcoming-sales nav,
  irrelevant on Sold; gated to the Auctions sub-tab only (both shells) so the Sold filter pills fit one line.
- **2026-06-18 — Home "Recently added" excludes backfilled (#907).** A newly-onboarded source (Menta)
  lands its whole back-catalog flagged `backfilled` with firstSeen=today, flooding the strip while
  "View all" parked it last; the strip now mirrors the live feed's `!i.backfilled` rule so the two agree.
