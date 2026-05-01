# Watchlist — Session Handoff (2026-04-29)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — what just shipped, what's mid-flight, and the immediate next
task. Nothing else.

## What just shipped (most recent first)

**2026-04-29 AM:**

- **References section + Watch size comparison tool.** New top-level
  References tab in the main nav (4th tab alongside Available /
  Auctions / Watchlist). Lands on a list of available resources;
  currently one — the Watch size comparison. Clicking the card flips
  in-component state to the tool. No client-side URL routing
  introduced. The size-compare tool is a React port of the standalone
  HTML prototype Mark uploaded: two case-dimension inputs (width ×
  length in mm), live preview SVGs for owned / comparison / overlay,
  three stat boxes (width / length / footprint diff), and a print-to-
  scale sheet for US Letter that includes a 50mm calibration ruler.
  Print sheet lives behind a React Portal mounted to `document.body`
  only when print is active; global `@media print` rule in
  `public/index.html` hides every body child except
  `.size-compare-print-sheet-portal` so printing from any other page
  on the site is unaffected. Default values are Tank Must (owned) vs
  Tank Cintrée (comparison), illustrative only.

  Naming: "References" here is the section name — collector resources.
  It's distinct from "watch reference numbers" (Rolex 1675, Omega
  2998 etc.), which are still tracked under Epic 0 in ROADMAP. Both
  meanings will coexist; product copy and code prefer the explicit
  forms ("References section" vs "reference numbers") when both
  appear in the same paragraph.

  ROADMAP Epic 5 restructured: was "Reference encyclopedia"; now
  "References (collector resources surface)" with three sub-areas
  (Tools and calculators / Reference-number encyclopedia / Curated
  link aggregator) and a parking lot of tool ideas under the first
  sub-area. CLAUDE.md gained a "Print scoping for in-app tools"
  section documenting the React Portal + scoped @media print pattern
  for future printable tools.

  Tested:
  - ✓ React component compiles + renders against the existing CSS
    variables (dark mode included).
  - ✓ URL allow-list unchanged (no impact on existing flows).
  - ✓ Mobile bottom nav now shows 4 tabs at fontSize 13; "References"
    fits comfortably at 375px-wide iPhones.

  Not yet verified on production (push + Vercel rebuild + bundle
  hash check is the next step):
  - Print preview shows the print sheet only, not the rest of the
    site (check Chrome's print preview from any non-References page
    too — should still print that page normally).
  - 50mm calibration ruler measures 50mm on a real ruler when set to
    100% / no scaling on US Letter.
  - Dark mode renders correctly (it should — every color uses CSS
    variables, no hardcoded greys).
  - Mobile print via AirPrint produces a usable sheet (lower priority
    per spec; not actively optimized for).

## What was queued before References work but is still pending

- **Phillips lots time-remaining + auction lots ordering by closing
  soonest with closed at the end.** The first half (Phillips
  countdown) shipped in commit 32712ab earlier this session; the
  ordering question is still open. Currently `merge.py` sorts the
  auctions calendar by status_rank then dateStart, which puts live →
  upcoming → past. Within each bucket, dateStart ascending means
  oldest-first. For the past bucket Mark wants most-recently-ended
  first; for live + upcoming the closing-soonest sort he asked about
  effectively means dateEnd ascending. That's a small merge.py sort-
  key change.

## Mid-flight / immediate-next

- **Verify on production.** Push the References commit, wait ~60s
  for Vercel, confirm the new bundle hash is serving via `index.html`
  on `the-watch-list.app`, then walk the verification checklist
  above (especially the print preview behavior and the 50mm ruler).

- **Auctions ordering** (above). Half-hour task once verified.

## Known intermittent gotchas

- `gh` CLI is not installed in the assistant environment, so manual
  verification of GitHub Actions runs has to use the GitHub web UI
  or a `curl` against the public API. Documented in
  CLAUDE.md "Working with Mark" implicitly.
- All push commands need `git pull --rebase && git push` as a fallback
  whenever a scrape cron has committed concurrently. Pattern shows up
  3-4× per session.
