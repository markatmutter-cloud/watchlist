# Watchlist — Session Handoff (2026-05-03)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — the durable rules graduate to CLAUDE.md, the durable plans
graduate to ROADMAP.md.

## TL;DR

Long iterative session across 2026-05-02 evening + 2026-05-03. **Net
deliverables:** Watchurbia + Maunder + Watch Club + Vintage Watch
Shop + Watches of Lancashire shipped (5 new dealers — count is now
**34, past the 30-dealer target**); Epic 0 verification script +
admin source-quality dashboard shipped; refresh-preserves-location
landed; manual single-source scrape workflow added; Wind Vintage
sold-detection false-positive fixed; eBay short-URL tracking fixed;
roadmap restructured (Strategic bets, User journeys, multi-tier
save reinstated, AI recommendation surfaces, comprehensive auction
inventory, etc.).

Production is **green**. Bundle hash will flip on the next merge to
main once the open PRs land — see "Open PRs" below.

## What shipped (newest first)

- **Four UK dealer sources** (`9d28029` lineage on
  `claude/four-new-sources`): Maunder Watches (WooCommerce, ~95
  items, GBP), Watch Club (TaffyDB JS catalog, ~57 active items,
  GBP), Vintage Watch Shop / Vintage Heuer (WordPress custom-post
  + detail walker, ~20 items, GBP), Watches of Lancashire
  (WooCommerce, ~73 items, GBP). Three platform quirks worth
  remembering: (1) Maunder's WC API ignores `page` — pagination
  is `offset` only; (2) Maunder + WoL return 403 to long Chrome
  UAs but accept short `Mozilla/5.0`; (3) Watch Club paginates
  client-side via TaffyDB queries, so the entire ~5MB JS catalog
  has to be downloaded and parsed.

- **eBay short-URL tracking fix.** Mark's `ebay.us/m/PpFLll`
  failed silently because the URL dispatcher only matched eBay
  TLDs (ebay.com / *.ebay.com / *.ebay.*), and the legacy-id
  regex needs `/itm/<digits>`. Fixed by recognising `ebay.us` /
  `ebay.gg` / `ebay.to` and following the FIRST redirect via
  Location header (not full HEAD-with-redirects, which times out
  at 15s on eBay's product HTML).

- **Watchurbia source** (30th dealer; WooCommerce, EUR, ~7 items
  with `category=watches-in-stock` filter to skip sold archive).

- **Epic 0 verification script** (`verify_sources.py`). Runs after
  every merge.py; counts live listings per source, flags drops to
  zero or <30% of rolling-7-day median. Outputs
  `public/verification.json` + `public/verification_history.json`.
  Wired as `|| true` step in scrape-listings.yml so a glitch never
  blocks the cron.

- **Admin source-quality dashboard** (`?tab=admin`). Gated by
  `REACT_APP_ADMIN_EMAILS` env var. Per-source table with live
  count, new/wk, 14-day sparkline, days stale, hearts/heart-rate,
  hides/hide-rate, avg price, top brand %, health, earning-keep
  chip (🟢🟡🔴). Sortable; default sort by Earning so prune
  candidates surface first.

- **Refresh preserves location.** `tab` / `sub` / `col` query
  params get written via `history.replaceState` and read on mount.
  No `react-router`; extends the existing share-URL pattern.

- **European Watch source** (28th, Next.js / RSC chunk parsing,
  USD, **pre-2000 filter** via `Circa. YYYY` in model — ~26 items).

- **Vintage Watch Collective source** (29th, Wix, EUR, ~40 items —
  same `productsWithMetaData.list[]` pattern as Chronoholic).

- **Hidden listings → Watchlist > Collections row.** Replaces the
  user-dropdown "Manage hidden" modal. Synthetic collection with
  sentinel id `__hidden__`; `HiddenModal.js` deleted.

- **Backfilled-aware date sort.** Two-tier comparator demotes
  newly-added-source items so they don't crowd the top of the feed.

- **User-menu polish.** Settings above Sign out; "Source quality"
  entry visible only for admin users.

- **Manual single-source scrape workflow.**
  `.github/workflows/scrape-single.yml` — dispatch-only; type the
  scraper basename (e.g. `watchurbia`) in the Actions UI to refresh
  one source on demand without waiting for cron.

- **Wind Vintage sold-detection fix.** Fallback regex
  `r'.{0,150}PRICE.{0,150}'` was matching "sold in 2020" in
  description text 150 chars before the price line. Tightened to
  forward-only-from-PRICE. Recovers ~hundreds of false-positive
  sold listings on the next WV scrape.

- **Roadmap consolidation.** Strategic bets section, User journeys
  section, multi-tier save reinstated as Strength-of-save, AI
  recommendation surfaces (including "For [name]"), comprehensive
  auction inventory capture, narrowed Tools section, "Parked,
  strategy needed" section for selling-Mark's-watches, quarterly
  review discipline. See ROADMAP.md update log for the full diff.

## Open PRs (as of session end)

Five branches with PRs that need merging in this order. Watchurbia
+ verify, admin dashboard, scrape-single, WV fix, and roadmap
consolidation may already be merged by the time the next session
starts — `git log origin/main` is the authoritative check.

```
claude/four-new-sources           — 4 dealers + eBay short-URL fix (this branch)
[merge order earlier:]
claude/fix-windvintage-sold-detection — WV recovery
claude/scrape-single-workflow     — manual single-source dispatch
claude/admin-source-quality       — admin dashboard
claude/watchurbia-and-verify      — Watchurbia + verify_sources
claude/roadmap-major-update       — roadmap consolidation pass
claude/roadmap-strategic-bets     — strategic bets / user journeys
```

## Setup steps still needed from Mark

- **Set `REACT_APP_ADMIN_EMAILS` in Vercel.** Production + Preview
  environments. Use the Google email Mark signs in with. Dashboard
  is unreachable until this is set; nothing else depends on it.
- **Optional**: same env var in `.env.local` if running `npm start`
  locally.

## Open user-reported issues (likely resolved by next-cron pass)

- **eBay tracking with `ebay.us/m/<token>` short URL.** Fix is in
  this branch; lands on next merge. Test with the same URL after
  deploy: should resolve to `ebay.com/itm/198313266410` (Mark's
  example) and start populating tracked_lots.json.

- **Wind Vintage missing listings (~ Cartier Tank Asymétrique
  WGTA0043, etc).** Fix is in `claude/fix-windvintage-sold-detection`
  PR. Recovery happens automatically when the next WV scrape runs;
  merge.py's reappear logic clears the sold flag for items the
  scraper now correctly reports as active.

## Architecture notes added this session

- **No `react-router`.** Confirmed by extending `?tab=…` / `?sub=…` /
  `?col=…` query-param pattern. CLAUDE.md picked up a "Location URL
  params" section alongside the existing Share URL note.

- **Admin dashboard gated by env var, not user_id.**
  `REACT_APP_ADMIN_EMAILS` (comma-separated). Empty / unset = nobody
  is admin. Avoids hardcoding a specific UUID into the bundle.
  Documented in CLAUDE.md "Admin tab" paragraph.

- **Verification script's rolling-window heuristic.** Flags drops to
  zero (ERROR) or <30% of recent median (WARN). Won't judge a
  source until 3 days of non-zero history exist — avoids
  false-alarms on newly-added sources.

- **Watch Club platform discovery: TaffyDB.** A site can ship its
  entire catalog as a single client-side JS file. If `?n=` / `?p=`
  / `?page=` all return identical pages, look for a TaffyDB-style
  init call — much cleaner to scrape than HTML walks.

- **eBay redirects time out via HEAD-allow-redirects.** eBay's
  product HTML is slow enough that following a full redirect chain
  to a final 200 response times out at 15s. The first redirect's
  `Location` header is enough to extract the legacy item ID.

- **Bot-protection UA quirks.** Two of the four new sources (Maunder,
  WoL) return 403 to a long Chrome UA but accept the short
  `Mozilla/5.0`. Counterintuitive. Worth trying both when a Store
  API call inexplicably fails.

## Doc files updated this session

- **CLAUDE.md** — Hidden-as-virtual-collection paragraph; Location
  URL params section; Admin tab section; new "Things to never do"
  rule about JSX comments before `return (`.
- **README.md** — dealer count 27 → 34 (architecture diagram +
  header + table); Hidden mention in the × bullet; Source quality
  admin row; verification.json + verification_history.json in folder
  layout; AdminTab.js + ShareReceiver.js in components layout;
  REACT_APP_ADMIN_EMAILS docs.
- **ROADMAP.md** — Strategic bets section; User journeys section
  (J10 + J11); Watchbox + Build-a-collection v2 expanded;
  Strength-of-save / Multi-signal taste / Discover mode / AI
  recommendation surfaces added; comprehensive auction inventory
  added; site discoverability + welcome page added under Epic 0;
  Tools section narrowed; Parked-strategy-needed section; Quarterly
  review section; multiple update log entries.
- **archive/** — old SESSION_HANDOFF_2026-05-01.md moved here. This
  doc is the new in-flight one.

## Commits worth knowing for next-me

```
[on this branch]
9d28029   Roadmap consolidation pass (additions, reinstatements, edits)
[merged earlier today]
af68062 / bcaccb2 / 5566734 / c6ef32d / 3274604 / a4f842e
[and the cron commits between them]
```

Use `git log origin/main --oneline -30` for the actual merged history.

## Next session

Per the refreshed [ROADMAP.md](ROADMAP.md) priority order:

1. **References as first-class entities (Epic 0).** The lone
   remaining Epic 0 foundation. Several downstream features gate on
   this.
2. **Site discoverability + welcome page (Epic 0).** Half-session.
   robots / sitemap / og:image / Schema.org / first-time-visitor page.
3. **Strength-of-save model (Epic 3).** Two-tier (Love / Watch).
   Small UI lift; the feature *is* the gesture.
4. **Stop-rule prune** under Epic 1 — at 34 dealers we're past the
   30-dealer end-state. Audit + prune to 25.

Plus the maintenance-rhythm beat: every 4th-5th session is hygiene
only. We're due.
