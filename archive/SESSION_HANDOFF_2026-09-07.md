# Session handoff — 2026-09-07

## Where things stand

**The magazine landing page is live and is the default.** `the-watch-list.app`
with no parameter. `HomeTab` is deleted, not hidden behind a flag. CI green on
main, no branches in flight.

## What happened

A UI review of the old landing page ("a series of scrollable lines, boring but
functional") turned into a full replacement, built in the open across ~20 PRs.

1. **`/ui-review`** (#942) — a reusable six-lens expert panel: capture one
   measured evidence pack, fan out six non-overlapping lenses with named
   best-in-class references, then a synthesis that *decides* rather than
   summarises. Its verdict drove everything after it.
2. **Mockups** — three directions, all built from live data (magazine, a
   contemporary "Index", a dated "Almanac"). Mark chose the magazine.
3. **Parallel page** (#955) behind `?view=magazine`, reading exactly the props
   Home already received. Used daily for a week.
4. **~12 rounds of live feedback**, each verified on the deployed page.
5. **Promotion** (#972) — magazine becomes Home, `HomeTab` (1,048 lines)
   deleted, footer extracted to `SiteFooter.js`.
6. **Chrome extracted** (#977) — `MagazineChrome` owns masthead, tabs, search
   and account row, ready for a second surface.

## Next session

**Read the Watches tab, then apply the new styling to it, in parallel.**

Mark likes how that tab *works* and wants it to *look* like the new UI. The
rule is **restyle, do not rebuild**: the shells keep rendering sub-tabs,
filters, sort, density, the hearted behaviour and the grid; only the chrome
above them is swapped, behind a flag, until he says switch.

Start by reading, not editing: `DesktopShell` / `MobileShell` Watches chrome,
`useFilters`, the listings sub-tabs, `SavedHeartLink`, the hearted sub-tab, and
how `cols` / `compact` flow. The failure mode is not ugly styling, it is
quietly dropping one of those behaviours.

## What to know before touching this code

- **`MagazineChrome` renders nothing it doesn't own.** The account control
  arrives as `authJSX` (App builds the real one); tabs arrive as the shared
  `topTabs` model. Three separate duplicate-control bugs came from ignoring
  this. There is a test asserting it never builds its own Sign in or About.
- **Never `:focus-within` in the injected stylesheet.** jsdom's nwsapi
  resolves it with `contains(activeElement)` and throws, breaking every
  `getByRole` in the file. It regressed twice; there's a comment at the site.
- **The page's own `<style>` block is namespaced `mag-`** and takes colour
  from the app's `:root` tokens, so dark mode needs no second palette.
- **Fonts load on mount in `MagazineChrome` only**, so the rest of the app's
  payload is unchanged. This is the one sanctioned exception to
  DESIGN_SYSTEM's no-new-typefaces rule.

## Open threads

- **B-90** card ⋯ menu opens off-screen near the viewport bottom (CardShell,
  needs a flip + `maxHeight`).
- **B-96** card action buttons are 36pt, under the iOS 44pt minimum.
- **PR #961** (scrape failure alerts) is a draft from another session — not
  this work, left alone.
- **Reference guides still have no presence on the landing page.** It is the
  content Watchlist owns outright and the only thing a competitor can't get by
  scraping the same dealers. Was in the screens mockup, never built.
