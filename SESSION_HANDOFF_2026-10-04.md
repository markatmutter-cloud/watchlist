# Session handoff — 2026-10-04

## What this is

**A late close.** The work below shipped on **2026-09-08** (#978, #979) and has
been live ever since. The session that built it never ran its close, so until
today SHIPPED carried nothing about it and the active handoff was still
`SESSION_HANDOFF_2026-09-07.md` — the one whose "next session" section pointed
at this very task. Anyone reading the repo in the last month would have thought
the Watches restyle was still to do.

This close is doc-only. No code changed today. Scope is deliberately narrow:
it records the 09-08 work and nothing about the month of scraper, tagger and
alerting sessions that ran in between — those own their own records.

## What shipped on 2026-09-08

**The Watches tab in the magazine's chrome, at `?view=watches` (#978).** Built
to the rule the 09-07 handoff set: *restyle, do not rebuild*. `MagazineWatches`
owns the chrome and nothing else — the grid, cards, hearts, ⋯ menus, date
dividers, infinite scroll and the calendar modal all arrive as the shells' own
`listingsTabContentJSX`, and every control in the new chrome is wired to the
same App state (sub-tabs, search + the save-search heart, source/brand/model
panels with their cross-axis filtering and +N expanders, saved-only, price,
sort, clear all, the count). The wordmark is the way back to Home. App swaps
the page in at the shell boundary, so the live Watches tab is untouched.

**Then one round of live feedback (#979)**, which is most of what the session
actually was:
- The fonts came off. Mark: "like the original interface but with different
  colors and change the word mark." The three magazine faces are overridden
  back to the system stack, scoped `.mag.magw`; the landing page keeps Bodoni.
- Home showed **two hamburgers** on mobile — `MobileShell` was still rendering
  its brand row under `MagazineChrome`'s masthead. Desktop had suppressed its
  equivalent when the magazine shipped; mobile was missed. Signed-out now reads
  "Sign in" and opens the same menu the signed-in initial does, both viewports.
- The dealer rail's label moved above its pills (inline it ate ~160px of a row
  that already scrolls — one pill visible at 390px).
- The saved heart lost its count badge and matched the account disc's size.

## The one open decision

**Promote `?view=watches`, or drop it.** The magazine landing page sat behind
its flag for a week before promotion; this has sat behind its flag for a month
with no verdict. Two things to settle:

1. Is the chrome swap right, now the type matches the rest of the app?
2. **The mobile filter drawer did not come across.** The parallel page puts
   those controls inline as pills instead. That is the one shell behaviour it
   does not have, and it was a deliberate call to see which reads better on a
   phone — it needs a verdict before promotion, not after.

A third surface wearing `MagazineChrome` should wait on that call.

## Worth knowing before touching this code

- **`MAG_CSS` / `MAGW_CSS` are template literals.** A backtick inside a
  *comment* in one ends the string early and the rest parses as JavaScript. It
  compiles clean and throws at render, so no build catches it. It happened
  twice in one session. `MagazineWatches.test.jsx` now asserts the shape of
  `MAGW_CSS` — keep that test.
- **`MagazineChrome` renders nothing it doesn't own** (the rule from 09-07,
  still true). It gained two optional slots for the second surface: `searchJSX`
  (Watches types into its own filter rather than routing) and `onHome`. Home
  passes neither.
- **App tests only started really rendering on 09-08.** The fetch mock matched
  `listings.json` while the app fetches `listings_live.json`, so every App test
  had been asserting against the load-error screen — including a `/Listings/i`
  matcher that "Couldn't pull the listings" satisfies. If an App test starts
  failing oddly, check what it is actually rendering before assuming a
  regression.

## Carried over, unchanged

`B-90` (card ⋯ menu opens off-screen) and `B-96` (36pt action buttons, under
the iOS 44pt minimum) were listed as open threads on the 09-07 handoff and are
still open in BUGS.md, which is their home. Reference guides still have no
presence on the landing page — the content Watchlist owns outright and the one
thing a competitor can't get by scraping the same dealers.

---

## Addendum — later on 2026-10-04: two Amsterdam dealers (#988)

**Shipped and live.** Amsterdam Watch Company (awco.nl) and Amsterdam Vintage
Watches, both WooCommerce Store API in EUR. Merged and refreshed via
`scrape-single.yml`; the-watch-list.app was serving 275 + 74 listings when checked
from a runner. Both are in the 3×/day cron and the matrix workflow.

Decisions made:
- **AWCo includes new watches and special editions** (Mark: over-including beats
  an arbitrary vintage cutoff). Special-editions also holds AWCo silk pocket
  squares, so anything filed under gifts/straps is dropped.
- **AVW drops its Museum category** (not for sale) and price-on-request rows.

Worth knowing:
- AWCo's `stock_status` filter is broken upstream (in-stock count exceeds the
  unfiltered total and every product comes back twice), so stock is checked in
  code and rows deduped by id. Explained at the top of `awco_scraper.py`.
- The feed shows fewer than the scrapers write (281 → 275, 76 → 74). That gap is
  the existing site-wide Corum and Royal Oak Offshore exclusions, not a bug.
- 24 AVW listings have no image upstream ("The Loop" stocklist) and show the
  favicon placeholder.

**Loose end:** remote branch `claude/tmp-probe-amsterdam` (CI probe scaffolding,
never merge) still needs deleting by hand; the session's git access can't
delete branches.

---

## Addendum — 2026-10-04 (evening): the topic tagger stops re-paying (#986)

**Merged 2026-10-04 23:59 UTC. Not yet proven in production** — the proof is
the next two scheduled runs.

The weekly Haiku tagger had made ~72,000 calls since May for a ~13,300-article
corpus, because editorial scrapers rebuilt re-fetched records without `themes`,
and Rolex Magazine / On The Dash rewrote their whole feed every run. Fixed at
the shared write (`editorial_corpus_io.write_split` carries `themes` forward by
URL), at the two scrapers (incremental mode stops at the first post already
held), and with a cost guard in `corpus_topic_indexer.py` (a default run with
more than 300 untagged articles exits non-zero before calling the API).

**Check next session (30 seconds each):**
- **Wed 2026-10-07** "Editorial corpus refresh" commit must NOT remove `themes`
  lines from `public/rolex_magazine.json`.
- **Sun 2026-10-11** "Index editorial corpus topics" commit should touch a few
  dozen records, not thousands. A red run saying `COST GUARD` means stripping
  has regressed; it spends nothing.

Worth knowing:
- The PR was opened green on 09-28 and sat unmerged for six days, so the old
  code ran one more Wed/Sun cycle and re-tagged ~4,200 articles (about $5).
  Tags were whole at merge time; no backfill is needed.
- `themes: []` now means "tagged, nothing applies" and is skipped. Previously
  ~30 of those were re-paid weekly.
- Any future enrichment pass that writes a new field onto corpus meta files
  must add it to `CARRY_FORWARD_FIELDS` in `editorial_corpus_io.py`, or the
  scrapers will strip it the same way.
- A deliberate large backfill (new source, new theme) needs a manual dispatch
  with a limit, or `--retag`; the no-limit default will refuse above 300.
- Jest could not run on this Mac (no Node installed); CI ran it on the PR.

**Still open, not this session's:** PR #985 (Antiquorum online sales).

## Addendum — 2026-10-04/05: alert quality, the triage agent, and B-99

**Shipped (#981, merged, CI green on main).** Four things that had been parked:
Watch Center re-snoozed to 2026-10-15, the triage agent rewired so it can
actually fire, the editorial corpus moved to a daily 08:00 UTC cron, and Watches
of Lancashire escalating to a real browser.

**The headline lesson is not any of the bugs — it is that #981 sat finished,
green and mergeable for three weeks.** In that time the Watch Center alert it
silences piled 62 comments onto issue #983. Mark's response was standing
permission: merge green PRs without asking (now a rule in CLAUDE.md).

### Two of my own fixes shipped broken, both the same way

1. **The triage agent never ran — zero runs in a week**, while seven alerts went
   unanswered. GitHub does not start a workflow from an event created with
   GITHUB_TOKEN, and the notifier opens its issue with exactly that token, so
   `on: issues: [opened]` was structurally incapable of firing. Now a second job
   in the notifier, joined by `needs:` (an edge, not an event).
2. **The failure classifier missed two real failures** — it matched `::error::`,
   the form a script *emits*, but the runner rewrites that to `##[error]` on the
   way into the log, which is the only form the classifier ever reads.

Both passed their unit tests. Both were caught only by looking at a real log or a
real run. The standing habit worth keeping: **fixtures I wrote prove nothing
about wiring.**

### B-99 — Watches of Lancashire (OPEN, and the one thing needing Mark)

Frozen at 54 rows since 2026-08-24; Mark confirms the dealer is live with 61.
B-81 "fixed" it by moving to the laptop, but the block is a Cloudflare **managed
challenge** (`cType: 'managed'` on the API, homepage and sitemap alike) which
demands JavaScript from every client — so relocating could never have worked.
CLAUDE.md already carried that rule, written by B-81 itself.

**Mark's one action:** run `scripts/install_residential_host.sh` (PR #989 teaches
it Playwright + Chromium), or by hand:
`pip3 install -r requirements-residential.txt && python3 -m playwright install chromium`.
**B-99 stays open until a laptop run produces ~61 rows** — the browser leg cannot
be tested from CI or a cloud container, neither of which can reach the dealer.

### Still open

- **#989** — residential installer installs Playwright (raised at close, since a
  fresh host built from the installer would silently lack it).
- **#987** — Scrape auctions red since 10-01: a Sotheby's 10-14 sale is in the
  scraped calendar but never reaches `auctions.json`, so its lots never enumerate.
  Untouched.
- **Residential blind spot, half-built.** The agent now writes
  `data/residential_status.json`, but **nothing reads it yet**. A CI source that
  dies pages in 3 runs; a residential one still hides behind the 21-day freshness
  budget. The gate that fails on a stale residential source is the next piece.
- **Tier 2** (an agent that opens fix PRs but never merges) discussed and
  deliberately deferred — tier 1 had not fired once at the time.
