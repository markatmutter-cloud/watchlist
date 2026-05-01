# Watchlist — Session Handoff (2026-04-30)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — what just shipped, what's mid-flight, and the immediate next
task. Nothing else.

## What just shipped — structural cleanup pass

A long session focused on code health rather than features. Net effect:
**App.js dropped from 2,130 → ~1,250 lines (-41%)** while behavior is
unchanged from the user's view. Each commit is independently revertable.

In rough order:

- **Mobile UI audit (M1-M12)** — touch targets bumped to 40px, sub-tab
  strip wrap fixed at 375px, Hidden listings surfaced in the View menu,
  bottom-nav safe-area bumped, modal × close buttons unified, chip
  legibility on 2-col mobile, keyboard hints on the Track URL input.
- **Dead code purge** — `AuctionsTab.js` (504 lines, retired since
  2026-04-30 when the calendar moved into Watchlist) deleted.
- **TDZ class eliminated** — `App.js` had a mobile early-return that
  forced any JSX const referenced by mobile to be declared before the
  `if (isMobile)` block. Slipping a declaration below it triggered a
  `ReferenceError → white screen on mobile` bug that hit us once and
  was easy to re-introduce. Two-stage fix:
   - Stage 1 (`02b2045`): single bottom return — both render branches
     became named consts (`mobileJSX`, `desktopJSX`), with one
     `return isMobile ? mobileJSX : desktopJSX` at the bottom.
   - Stage 2 (`6e54195`): extracted `MobileShell.js` + `DesktopShell.js`
     into their own files. App.js builds a single `shellProps` bag and
     spreads it into whichever shell renders.
- **Style tokens** — new `src/styles.js` with shared `pillBase`,
  `tabPill`, `iconButton`, `modalBackdrop`, `modalShell`,
  `modalCloseButton`, `modalTitleRow`, `modalTitle`. Replaces 4 copies
  of the modal × button and 3 copies of the pill style with one token
  each. M6 sub-pixel mismatch class is gone.
- **Modals extracted** — `TrackNewItemModal`, `FavSearchModal`, and
  `AddSearchModal` (new — replaces the inline editor for the "+ Add
  search" flow per Mark's parity ask) all live in `src/components/`
  alongside the existing `HiddenModal` / `AboutModal`. State machines
  for the first two moved into hooks (see below).
- **Hooks file for state shape** — four new hooks under `src/hooks/`:
  - `useTrackModal({ addTrackedLot })` → owns Track modal state + submit.
  - `useFavSearchModal({ search, quickAddSearch })` → owns Save-search
    label/error + open/submit handlers.
  - `useViewSettings()` → theme override, mobile/desktop column counts,
    view-menu open flag. localStorage persistence + option validation
    co-located with state.
  - `useFilters()` → the big one. Owns the entire filter row's input
    state (search, source/brand/ref multi-selects, sort, price text +
    parsed bounds, status mode, expansion toggles, popover state +
    click-outside effect). ~25 named return fields. Trades App.js
    bloat for one focused hook.
- **React Testing Library smoke tests** — first frontend tests in this
  repo. `MobileShell.test.jsx` + `DesktopShell.test.jsx` cover
  render-without-crash + key visibility assertions (sub-tabs, drawer,
  view menu). 14/15 passing initially; one assertion was over-specific
  (`getByRole` against a button name that legitimately had two
  matches) — fixed in `6cc2872`. Tests run on every push via the
  `jest` job in `tests.yml` (parallel to `pytest`).
- **Sub-tab style** — switched from filled-pill to underline pattern so
  the Watchlist sub-tabs (Listings / Searches / Auction Calendar) sit
  visibly below the main tab pills in the hierarchy. Same `tabPill`
  token drives both mobile and desktop.
- **Sub-tab counts trimmed** — Searches and Calendar pills no longer
  carry trailing counts (just noise — the count was visible inside
  the tab anyway). Listings keeps its count because that signals "how
  many items you're tracking" even when the tab isn't active.
- **Search tokenization** — `matchesSearch(item, query)` helper in
  `utils.js`. Splits the query on whitespace and ANDs each token across
  `brand + ref`. Word order no longer matters: "rolex gold" and "gold
  rolex" find the same listings. Replaced 3 inline copies of the old
  single-substring filter.
- **Watchlist bucket order** — Date↓ / Date↑ pill direction now drives
  the bucket order (Today first vs Older first), not just within-bucket
  order. Originally fixed by max-savedAt comparator (`198e153`); when
  that didn't hold on production (tracked lots with empty `savedAt`
  collapsed all groups to recency=0), replaced with explicit rank
  table (`8bca9db`). Today=0 ... Older=9.
- **eBay source-searches surfaced** — Searches sub-tab now shows the
  contents of `data/ebay_searches.json` above the user's saved
  searches. Read-only; "Edit on GitHub ↗" button opens the JSON file
  in GitHub's in-browser editor. Counts come from `data/ebay.csv`
  (last column = `_search_label`). Roadmap option 1 of 3 (option 2
  = Supabase migration + admin form, deferred until Mark hits the
  GitHub-edit friction).
- **eBay searches collapsed 6 → 2** — the 3-region split
  (USA/UK/Europe) per query was input-only; country never made it to
  `listings.json`. Two global queries now (Omega Railmaster CK2914,
  Heuer Autavia GMT) — same coverage, half the API calls.

## CI plumbing

`tests.yml` extended:
- Two parallel jobs: `pytest` (existing — `merge.update_state` coverage)
  and `jest` (new — shell smoke tests). Both run on every push and PR.
- `npm install` step (no committed lockfile by design — fresh install
  each run, ~30s).
- Workflow-level env opts actions running on Node 20 into Node 24 to
  silence the deprecation warning ahead of the June 2026 forced upgrade.
- `cache: 'npm'` was tried but errors when no lockfile is committed —
  removed (commit `18bc563`).

## Ongoing — Collections + Sharing v1 (Session 1 of 3)

Three-session feature pair underway (collections data model →
collections UI → share). Approach A (minimal migration) + query-param
URL routing for the share flow, both confirmed by Mark before start.

**Session 1 — what just shipped (this commit only adds the data
layer; no user-visible change):**

- New SQL schema file: `supabase/schema/2026-05-01_collections.sql`.
  Two tables: `collections` (free-form / shared-inbox / type-marker
  fields for future challenge / watchbox surfaces) and
  `collection_items` (denormalized listing snapshot + source-of-entry
  tag + future shared_by_handle hook). RLS via auth.uid() on
  collections; collection_items inherits via the parent's user_id.
  Idempotent — run once in the Supabase SQL editor; subsequent runs
  no-op. Partial unique index enforces one shared-inbox per user.
- New `useCollections(user)` hook in `src/supabase.js`. Returns
  `{ collections, itemsByCollection, createCollection,
  renameCollection, deleteCollection, addItemToCollection,
  removeItemFromCollection, ensureSharedInbox, addToSharedInbox }`.
  All mutators are no-ops when signed out (return `{ error }` so
  callers can prompt for sign-in).
- The existing `useWatchlist(user)` hook is unchanged. The user's
  default "Watchlist" collection remains backed by the
  `watchlist_items` table — Approach A's intentional asymmetry. New
  user-created collections + the auto Shared-with-me inbox live in
  the new tables.
- Hook is NOT wired into App.js yet. Session 2 is the first consumer
  (the new Collections sub-tab); avoiding the import now keeps
  CI=true builds clean (CRA treats unused-var warnings as errors).

**Mark — manual step required before Session 2:**

Run `supabase/schema/2026-05-01_collections.sql` in the Supabase
SQL editor. Until that runs, the hook will fail-soft (errors logged,
no UI breakage) but the Collections sub-tab in Session 2 will appear
empty for everyone.

**Session 2 — Collections UI (shipped 2026-05-01, commit c2aeabd):**

- 4th sub-tab in Watchlist: **Collections** (Listings / Collections /
  Searches / Auction Calendar). Sub-tab strip gained a "+ New
  collection" trailing button when active. List view → drill-in view
  of items as Cards using the Watchlist > Listings visual treatment.
- New `"..."` menu on every Card replaces the standalone `×` (hide).
  Houses **Add to collection…** + **Hide from feed** (or "Unhide",
  or context-overridden "Remove from collection" inside a drill-in
  via the new `hideLabel` prop). Click-outside + Escape close.
- New `CollectionEditModal` (single name field, used for both create
  and rename) and `CollectionPickerModal` (collection list + inline
  "+ Create new" that creates+adds in one go; greys out collections
  the item already belongs to; hides the shared-inbox).
- State ownership: `editingCollection` + `pickerTarget` lifted to
  App.js so any Card anywhere can fire them. `selectedCollectionId`
  stays local to WatchlistTab.
- Filter row gating extended to hide on Collections (collections
  aren't filtered the same way listings are).

**Session 3 — Share (next):**

**Session 3 — Share (after Session 2):**

- `"..."` menu gains Share. Web Share API on mobile, Copy link
  fallback on desktop.
- URL format: `?listing=<id>&shared=1` on root.
- Receive handler in App.js: parse share param on mount, render a
  banner above the listing card. Save / Dismiss for signed-in users
  (both populate Shared-with-me; Save also adds to default).
  Anonymous: passive sign-in CTA, no nag.
- URL gets rewritten to drop the share param after action so refresh
  isn't sticky.

## Mid-flight / immediate-next

- **Verify on production** — Mark already reported the date-header
  bug on the previous fix; the rank-table replacement (`8bca9db`)
  shipped late in the session. Worth a 30-second sanity click on
  Watchlist > Listings: Date↓ should now show Today first, Older last.
  If still broken, the sus path is `bucketRank` returning unexpected
  values for some weekday label that ageBucketFromDate emits — but
  the rank table is hardcoded so this should hold.
- **Other docs touch-ups still pending** — README and ROADMAP get an
  update right after this handoff. Specifically:
   - README: tab structure (Available/Auctions/Watchlist → Listings/
     Watchlist/References), App.js line count, folder listing, test
     section additions.
   - ROADMAP: update log entry + Epic 3 eBay integration partly
     shipped.

## Known intermittent gotchas (unchanged)

- `gh` CLI not installed in the assistant environment — verifying
  GitHub Actions runs needs the GitHub web UI or a `curl` against the
  public API.
- `git pull --rebase && git push` is needed 3-4× per session to
  resolve concurrent scrape-cron commits.

## Commits this session (most recent first)

```
8bca9db  Watchlist bucket order: rank table instead of timestamp math
038833d  Drop count from Searches + Auction Calendar sub-tab pills
f459cac  Collapse eBay searches: 6 region-split → 2 global
92ef576  eBay source-searches surfaced in Searches sub-tab (option 1)
198e153  Watchlist: bucket order tracks Date sort direction (later replaced)
22190b5  Search: tokenize query so word order stops mattering
6cc2872  Fix MobileShell smoke test — two "Watchlist" buttons by design
18bc563  CI: drop npm cache (no lockfile), opt into Node 24
6a85080  #6 phase 3: extract useFilters hook
10d1b6f  #6 phase 2: extract useViewSettings hook
487750a  #6 phase 1: extract useTrackModal + useFavSearchModal hooks
11affd3  #5 React Testing Library smoke tests for both shells
d00dc9c  Sub-tab style + Add Search modal (Track parity)
6e54195  Stage 2 of #1: extract MobileShell + DesktopShell
99af182  Style tokens (#2) + extract Track/FavSearch modals (#4)
02b2045  Single bottom return — eliminate mobile/desktop early-return TDZ class
9720e21  Delete dead AuctionsTab.js (504 lines)
b7ce590  Mobile UI audit: M1-M12
```
