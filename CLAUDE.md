# Working with this repo

Notes for Claude Code (and any human picking this up cold). Keep this
file tight — read it once at the start of a session and you should know
how to behave for the rest of it.

**Doc separation (each has one job):**
- This file (CLAUDE.md) — durable working conventions. Read every session.
- [README.md](README.md) — what the project is + architecture. Public-facing.
- [ROADMAP.md](ROADMAP.md) — priorities, epics, what's explicitly out of scope.
- `SESSION_HANDOFF_*.md` — in-flight snapshot per session. **Not durable.**
  The current one is [SESSION_HANDOFF_2026-05-01.md](SESSION_HANDOFF_2026-05-01.md);
  older ones live in `archive/`.

If a gotcha or convention is durable (still true next session), graduate
it from the handoff to this file. If it's session-specific, leave it in
the handoff. When in doubt, ask.

## Working with Mark

- **Non-technical, but ships often.** Explain in plain English; flag risks
  but don't overexplain. Default to terse responses. No unprompted recap
  of work just done — the diff is right there.
- **Based in California (PT).** All time-of-day references are PT, not UTC.
- **Iterates by feel.** Mark adjusts priorities mid-session; that's normal,
  not a contract violation. But discipline is part of the value — when an
  ask drifts off-roadmap, point it out before complying. (See ROADMAP.md
  "For Claude Code" instructions.)
- **Verify before claiming done.** Vercel rebuilds ~60s after push. If the
  push touched JS/JSX/component files, confirm the new bundle is serving
  before reporting "shipped". Build-failures-that-don't-fail-loud have
  bitten this project once already.
- **iOS PWA install** at `the-watch-list.app`, so iOS-specific quirks
  (safe areas, icon caching, service-worker-controlled stale bundles)
  matter. When it works on desktop but not mobile, ReferenceError from
  hoisting order is a likely culprit (browsers report different errors).

For current priorities, direction, and what's explicitly out of scope,
read [ROADMAP.md](ROADMAP.md) before suggesting work.

## Architecture quick reference

Full diagram + folder layout in [README.md](README.md). One-paragraph summary:

Scrapers (Python `requests`, GitHub Actions 3×/day PT) write per-source
CSVs into `data/`. `merge.py` enriches into `public/listings.json` +
`public/state.json` (cross-run memory via stable URL-hash IDs).
Frontend is React (CRA, inline styles). `App.js` is the orchestrator
that owns state and JSX consts; render is delegated to
`src/components/MobileShell.js` + `DesktopShell.js`, each receiving
a single `shellProps` bag. Domain state hooks live under `src/hooks/`
(useTrackModal, useFavSearchModal, useViewSettings, useFilters,
useEBaySearches); shared style tokens in `src/styles.js`; pure
helpers in `src/utils.js`. Per-user data (watchlist, hidden, saved
searches, tracked lots, **collections + collection_items**) is in
Supabase with RLS. One serverless function: `api/img.js` (image
proxy for hot-link-protected dealers). Vercel Blob caches dealer
images for hearted items **only** — see `cache_watchlist_images.mjs`;
**don't extend the blob cache to the full feed**.

**Watchlist data model (post-Collections, 2026-05-01).** Approach A:
the user's default Favorites collection (the heart-on-card flow) is
implicit and remains backed by the existing `watchlist_items` table.
The `collections` + `collection_items` tables only store
user-created collections + the auto Shared-with-me inbox. The
asymmetry — default in one table, additional in another — is
intentional: it limits code churn and keeps `useWatchlist` /
heart-on-Card working without a migration. Schema lives in
`supabase/schema/2026-05-01_collections.sql`.

**Hidden listings as a virtual collection (2026-05-01).** Hidden
follows the same Approach A pattern as Favorites: data stays in the
existing `hidden_listings` table, but the UI surface is a synthetic
"Hidden" row inside Watchlist > Collections (rendered by
WatchlistTab.js, not a real DB row). Sentinel id `__hidden__` keeps
the synthetic row from colliding with real collection UUIDs. The
drill-in renders the items grid with `isHidden={true}` so each
Card's "..." menu Hide entry flips to "Unhide" automatically. There
is no `HiddenModal` anymore — the old user-dropdown "Manage hidden"
item was removed and the file deleted. Don't migrate
`hidden_listings` into `collection_items` for the same reason as
Favorites: the migration would touch every read path that already
uses `useWatchlist().hidden`.

**Share URL format.** Inbound share links use
`?listing=<id>&shared=1` on the root URL — no `react-router`, no
`/share/*` route. App.js parses on mount and renders a non-modal
banner + the listing's Card above `listingsGridJSX` in both shells.
URL is rewritten via `history.replaceState` after action so a
refresh doesn't re-trigger.

**Location URL params (2026-05-02).** `tab` (listings | watchlist |
references | admin), `sub` (listings | collections | searches |
calendar — only meaningful when tab=watchlist) and `col` (collection
UUID, or `__hidden__` for the synthetic Hidden collection) get
reflected in the URL via `history.replaceState`. App.js owns `tab`
+ `sub`; WatchlistTab owns `col`. App.js's effect also clears `col`
when leaving the watchlist tab so the URL stays clean. Both effects
skip when share-receive params (`shared=1`) are present so the share
flow controls URL until it acts. Refresh on any of these lands the
user back where they were. Stay on this query-param pattern — it's
deliberate that we don't bring in `react-router`.

**Admin tab (2026-05-02).** `tab=admin` is gated by
`REACT_APP_ADMIN_EMAILS` (comma-separated, set in Vercel + .env.local).
Empty / unset = nobody is admin and the tab is unreachable. The
"Source quality" entry in the user dropdown is the only navigation
affordance — intentionally NOT in the main tab strip per ROADMAP
"Don't telegraph commercial intent publicly". Non-admins hitting
`?tab=admin` get silently redirected to listings (App.js useEffect
guards once `authReady` resolves, so signed-in admin users don't
flicker). Admin data: verification.json + verification_history.json
+ listings.json (all public on the static site) + Supabase
watchlist_items / hidden_listings (RLS-gated to the user's own rows).
Don't surface admin existence to non-admin users in any UI text.

## Scraper conventions

- Each dealer / auction house has its own `*_scraper.py` at repo root.
  Per-source structure is intentional — one breaking site means one file
  to debug. Don't refactor into a shared module unless a class of bug
  spans many scrapers (this is on ROADMAP.md as explicitly NOT-now).
- Each scraper writes a CSV to `<name>_listings.csv` in cwd; the workflow
  step then moves it to `data/<name>.csv`. `merge.py`'s SOURCES list maps
  CSV path → display name → currency.
- Auction calendars produce `*_auctions_listings.csv` and land in
  `data/<name>_auctions.csv`; `merge.py` auto-globs `data/*_auctions.csv`
  so adding a new auction scraper doesn't require touching merge.py.
- `continue-on-error: true` on each scrape step in the workflow so one
  failing source doesn't kill the batch.

## Tests

Two suites, both run on every push to main and every PR via
`.github/workflows/tests.yml`:

- **pytest** (`tests/test_merge_state.py`) — state-transition logic in
  `merge.update_state`. Cross-run memory layer where regressions would
  be costly and silent. Synthetic input dicts only.
- **jest** (`src/components/*.test.jsx`) — render-without-crash + key
  visibility assertions for `MobileShell` + `DesktopShell`. Catches
  the TDZ class of bug that shipped a white screen on mobile in late
  April 2026. Single mock fixture in
  `src/components/__fixtures__/mockShellProps.js`; tests override
  individual fields rather than rebuilding the ~60-prop bag.

Run locally:

```
pip install -r requirements-dev.txt    # one-time setup
pytest                                  # Python suite

npm install                             # one-time setup
npm test                                # jest watch mode
npm run test:ci                         # jest single-run (CI mode)
```

When adding new state-transition behavior to `merge.py`, add a
corresponding test in `tests/test_merge_state.py`. When adding a new
prop to either shell, mirror it in `mockShellProps.js` so the smoke
tests keep covering missing-prop regressions.

Currently-documented bugs in pytest (e.g. silent currency switches)
live as behavior-documenting tests rather than expected-failures —
when those bugs are fixed, the relevant test needs an update too.

## Print scoping for in-app tools

Anything that needs to print (currently: References → Watch size
comparison) should NOT use the prototype pattern of
`body * { visibility: hidden }`. That pattern is brittle inside a
React app — it visibility-hides the entire app tree and depends on
incidental CSS specificity to surface the print content.

Instead, use a **React Portal** mounted to `document.body`:

```jsx
const [printActive, setPrintActive] = useState(false);
const handlePrint = () => {
  setPrintActive(true);
  setTimeout(() => {
    try { window.print(); } finally { setPrintActive(false); }
  }, 60);
};
// ...
{printActive && createPortal(<PrintSheet ... />, document.body)}
```

The portal renders the print sheet as a direct child of `<body>`,
sibling to `#root`. The global `@media print` rule in
`public/index.html` hides every body child except the portal:

```css
@media print {
  body > *:not(.size-compare-print-sheet-portal) { display: none !important; }
}
```

When `printActive` is false the portal isn't in the DOM at all, so
printing from any other page on the site is unaffected. Verify the
calibration ruler measures correctly in Chrome's print preview at
100% scale — that's the killer feature for size comparison and the
non-negotiable bar for any future print-to-scale tool.

To add a new printable tool: render its sheet via `createPortal` to
`document.body` with a class that matches a selector in the
`index.html` print rules (or extend the rule's selector list).

## Things to never do

- **Don't bump `LEGACY_WATCHLIST_KEY` / `LEGACY_HIDDEN_KEY`** in App.js —
  they're stable storage keys for users' pre-Supabase localStorage data
  that the import banner reads on first sign-in.
- **Don't extend the Vercel Blob cache** to listings/auctions feeds.
  Watchlist-only is intentional (auction images stay up long-term;
  caching ~1,800 dealer images costs storage for transient inventory).
- **Don't skip Vercel verification** after a JS change. Use the bundle
  hash in `index.html` to confirm the new build is serving before
  reporting done.
- **Don't reintroduce in-app messaging, reactions, replies, sender
  identity exposure, or notifications for shares.** The user's chosen
  messaging tool (iMessage / WhatsApp / email / Slack / AirDrop)
  handles all of that. Watchlist's share primitive is a one-tap export
  to the native share sheet + a recipient banner. Adding any kind of
  in-app social layer was explicitly rejected in the v1 design and
  belongs in ROADMAP's "Explicitly NOT" list.
- **Don't auto-redirect shared listing links** to a separate landing
  page or to the dealer's site. The recipient sees the listing in the
  same UI they'd browse to themselves, with an additive banner. The
  dealer link is one tap on the Card.
- **Don't migrate `watchlist_items` into `collection_items`** without
  a deliberate decision. Approach A (default-Favorites-stays-implicit)
  is the agreed shape; flipping to a fuller migration would touch
  every read path that hits `useWatchlist`. Revisit only if the
  asymmetry causes real pain.
- **Don't add new `useState`/`useMemo`/`useCallback` deep into App.js**
  near render-conditional code paths. Adding hooks to the back of
  App.js's already-large hook list triggered React error #310
  ("rendered more hooks than during the previous render") TWICE during
  the Collections + Sharing build. New rule: if a feature needs new
  hooks, put them in a self-contained component App.js mounts
  unconditionally. `<ShareReceiver/>` (commit b6cb57b) is the
  reference pattern.
- **Don't put a `{/* ... */}` JSX comment between `return (` and the
  root JSX element.** CRA's parser reads it as a stray object literal
  → "Unexpected token, expected ','" → CRA's `CI=true` upgrades the
  parse error to a build failure → Vercel ships eight consecutive red
  Production deploys before anyone notices. Cost us a session on
  2026-05-01 (commit `01104d6` was the fix). Comments belong INSIDE
  the JSX tree (`<div>{/* ... */}</div>`) or above the `return`. Same
  trap exists for any expression that isn't a single JSX element in
  that slot.

## When in doubt

Read ROADMAP.md and the latest SESSION_HANDOFF, then ask. Mark prefers
"here's the tradeoff, want me to A or B?" over "I assumed B and shipped"
for anything bigger than a one-file fix.
