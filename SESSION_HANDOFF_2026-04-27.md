# Watchlist — Session Handoff (2026-04-27 → 2026-04-28)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — what just shipped, what's mid-flight, and the immediate next
task. Nothing else.

## What just shipped (most recent first)

**2026-04-28 PM:**

- **Doc-hygiene pass.** Four-doc separation cleaned up: README owns WHAT,
  CLAUDE.md owns HOW, ROADMAP.md owns WHERE-TO, this doc owns WHERE-NOW.
  Cross-references added. Older `SESSION_HANDOFF_2026-04-25.md` moved to
  `archive/`. ROADMAP absorbed the in-flight roadmap items that had
  drifted into earlier handoffs (eBay, Alerts, Heritage, dealer-
  evaluation table). README dropped "What I'd do differently next" (its
  items were roadmap-flavored).

- **Hairspring brand fix v2.** Some Hairspring products list
  `brand: "Hairspring"` (the dealer's own name) in their JSON-LD.
  Updated to (a) JSON-parse each `<script type="application/ld+json">`
  block and find the `Product` whose `name` matches the page title,
  (b) skip "Hairspring" as a brand value, (c) fall back to a curated
  `MODEL_TO_BRAND` + `REF_TO_BRAND` lookup for orphans. "Other" count
  on full re-run dropped from 21/39 to 11/39; the remaining 11 are
  accessories (Watch Roll, Strap, Loupe) that are correctly Other.

- **Group-by lifted to global filter bar.** Was a Watchlist-only
  `<select>`. Now a `Group: None ▾` pill in the desktop filter row +
  chip row in the mobile drawer. Available + Archive use it too.

- **Auctions tab restructure (3 commits):**
  - Sotheby's lot tracking added (3rd house alongside Antiquorum +
    Christie's). Apollo-cache parser inside `__NEXT_DATA__`.
  - + Track lot UI moved from Watchlist > Lots to the Auctions tab.
    Watchlist sub-tabs are now Listings + Searches only.
  - Auction calendar collapsable by default — next 5 entries; "Show
    all auctions · N more" expands. State persisted to localStorage.

- **Christie's + Sotheby's auction calendars** (now 6 auction houses).
  Christie's via Sitecore JSS `__NEXT_DATA__`; Sotheby's via the
  calendar URL with watches filter.

- **Shuck the Oyster** added (26th source). WordPress detail-page
  walker. Reserved-slug denylist (feed/page/embed) added after a
  `/portfolio/feed/` row leaked through as "Portfolio Items Archive".

- **Vintage Watch Fam** (dannysvintagewatches.com, 25th source —
  public name override at Mark's request). 426 listings.

- **Tropical Watch on autopilot.** scrape-tropicalwatch.yml triggers
  Browse AI on a 6am+6pm PT cron rather than fetching `--latest` from
  a separate Browse AI schedule.

- **Chronoholic price=0 = sold.** First implementation treated zero-
  priced items as "Price on request" actives; corrected to mark them
  sold and route to the Archive (which is what the dealer means by it).

**Earlier in 2026-04-27** (mostly fold-up shipped work — see commit log
for detail):

- App.js 3-phase split (2,735 → 1,700 lines; new components/ subfolder).
- Master Live/Sold/All pill (was per-tab tri-state, now global).
- PT-anchored dates in `merge.py` + `App.js daysAgo()`. Closes the
  cron-timezone + inflated-NEW-counts issues.
- Heart-click-while-signed-out replay flow (sessionStorage intent).
- Grey & Patina Cloudflare hardening (`requests.Session()` + warmup).
- Three Shopify/Squarespace dealers added (Huntington, The Vintage
  Watch, Avocado Vintage).
- Moonphase via pushers.io API.
- Mobile blank-screen + App.js syntax-error fixes (orphan `};`).
- Watchlist sticky sub-tab gap fix.
- Reference filter pill dropped (auto-extracted refs were noisy).
- Watchfid `.jpg` images: Referer header in `api/img.js`.
- Custom domain `the-watch-list.app`; rename Dial → Watchlist.

## Mid-flight or paused

Nothing mid-flight as of this update. All recent commits are landed
and verified deployed.

## Tested vs untested

- All scraper changes were re-run locally and the new CSVs land in
  `data/`. Live-feed effect waits on the next `merge.py` cron run
  (or a manual "Scrape listings" workflow trigger).
- Frontend changes (Group-by global, Auctions tab restructure,
  collapsable calendar) were verified deployed to `the-watch-list.app`
  by checking the Vercel bundle hash. Visual smoke test on desktop +
  mobile PWA passed.
- The Sotheby's lot scraper was unit-tested against one live lot URL
  ("The Michael Schumacher" Daytona) but hasn't yet had a
  scrape-auctions cron run pull it through merge.py end-to-end.

## Immediate next task

Per ROADMAP.md priority order, **Epic 0 foundations** is next —
specifically **References as first-class entities** (the cross-cutting
prerequisite for build-a-collection, the encyclopedia, and most of
Epic 3). Verification script is the smaller Epic 0 piece worth doing
first as a maintenance-rhythm step.

Mark hasn't yet said "go" on Epic 0 work in a session, so the
literal-next thing depends on what he picks up. The default if he
asks "what's next" is references work or a verification-script
spike.

## New gotchas surfaced this session (graduated to CLAUDE.md)

- Vercel build can fail silently because of an orphan `};` after a
  range-deletion cleanup — UI keeps serving the prior bundle. Always
  verify the bundle hash changed after a JS-touching push. (Already
  in CLAUDE.md "Things to never do" + "Working with Mark > Verify
  before claiming done".)
- JSX `{var}` hoisting: a `const` referenced before its declaration
  in render order will succeed at build but ReferenceError at runtime,
  and may show up only on one platform (mobile rendered first → blank
  screen; desktop rendered after the const → fine). Already in CLAUDE.md
  Working-with-Mark notes.
