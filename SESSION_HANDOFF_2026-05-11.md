# Watchlist — Session Handoff (2026-05-11 EOD → 2026-05-13 morning)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap, see [ROADMAP.md](ROADMAP.md).
This is an in-flight snapshot; durable rules graduate to CLAUDE.md.

## 2026-05-13 morning — addendum

Brief intra-session bug fix before tomorrow's journey work:

- **PR #258 — React #300 white-screen on Challenges drill-in/out.**
  Mark report. Root cause: `useState(createError)` was declared at
  line ~109 of `ChallengesView.js`, **below** two early returns at
  lines 61 (`if (!user)`) and 83 (`if (selected)`). Drilling into a
  challenge → 3 hooks called; drilling back → 4 hooks. React invariant
  300: "Rendered fewer hooks than expected." Fix hoists the hook to
  the top of the function so the hook count is constant across every
  render path. Same class as the App.js #310 traps already documented
  in CLAUDE.md's Things-to-never-do — that rule now applies to
  ChallengesView too. **Action item for the next session**: sweep
  CollectionsTab, WatchlistTab, and App.js for any other hook-below-
  early-return survivors.

Other PRs from the EOD list (#253–#257) also waiting on review/merge
when Mark resumes. Original handoff state below for the planned
journey + emoji work follows unchanged.

## TL;DR

Long session covering three arcs:

1. **Auction data architecture** (morning) — Antiquorum / Phillips / Christie's enumeration + sold-price scraping fixes. Shipped earlier in the day.
2. **Home tab v2 + UI cleanup** — Brought Home back as an editorial landing. Tightened mobile chrome, fixed sub-tab alignment.
3. **Reactions + shared-list journey** (afternoon → night) — Simplified emoji set, reduced drill-in chrome, framed the recipient experience (banner + To-review bucket + one-at-a-time review mode with Tinder swipes), introduced a **top-level Share tab** with a working send flow.

## PRs merged today

| PR | Title |
|---|---|
| #237 | View-all pill, drop `~` on currency, admin chip, bottom-nav |
| #238 | Home: centred wordmark + admin quick-hide overlay |
| #239 | Home: home-only hide + hearted strip + sticky mobile + dealer typeahead |
| #240 | SubTabIntro polish, fav-search icon, calendar pill, dividers |
| #241 | UI cleanup round 2 (SubTabIntro consistency, lighter wordmark) |
| #242 | Reactions: 3-emoji set (❤️ / 👍 / ❌) + Saved sub-tab alignment fix |
| #243 | Share-list drill-in: compact single-row header + ⋯ overflow |
| #244 | SubTabIntro uniform collapsed height + Challenges title consistency |
| #245 | Shared-list recipient: banner + 📋 To-review bucket |
| #246 | Shared-list recipient: one-at-a-time review mode (`ListReviewMode`) |
| #247 | Mobile chrome: tighter top wordmark + bottom nav padding |
| #248 | Add top-level **Share** tab — landing surface for shared lists |
| #249 | ListReviewMode: Tinder-style swipe gestures (R = 👍 / L = ❌ / Up = ❤️) |
| #250 | Home: drop redundant hero search bar on mobile |
| #251 | Share tab: **+ Share a list** send flow + `ShareListPickerModal` |
| #252 | Mobile: drop empty filter-row spacer on filter-less tabs |

## PRs open at EOD (queued for review)

| PR | Title |
|---|---|
| #253 | Reactions: explicit undo/reset affordances (review-mode "Remove my reaction" + drill-in "Reset my reactions (N)") |
| #254 | My Watches: drop Average price card |
| #255 | Home: deeper mobile slider — 14 cards per strip (supersededby #256) |
| #256 | Home: unify mobile+desktop strips as horizontal sliders |

#255 and #256 overlap — when reviewing, merge #256 (which covers both viewports) and close #255 unmerged.

## What's deferred to tomorrow

Mark wrap-up note: "I want to work on the journeys tomorrow some more. Not quite working for reviews or writers. Also want to change the emoji symbols so not using colourful emoji from cell phone — set the wrong tone."

Two open problem areas:

1. **Share-list journeys for "reviewers" / "writers"** — the current shape works for *send a list and get reactions*, but doesn't yet differentiate the journey for:
   - **Reviewer** persona (auction critic, watch journalist) — wants to publish their take with commentary, not just thumbs
   - **Writer** persona — wants to write a longer-form opinion under each watch
   This probably means: comments per item (table exists at `collection_item_comments`, 0 rows), a "reviewer mode" framing in the drill-in, possibly a `mode` enum on collections (`personal` / `shared` / `poll` / `review`).
   Tomorrow's first task is to scope what each journey actually needs and pick one to ship first.

2. **Editorial emoji replacement** — the ❤️ / 👍 / ❌ set reads as cellphone-y and clashes with the editorial wordmark / quiet chrome elsewhere. Replace with monochrome SVG glyphs or refined text labels (e.g. "Love · Yes · Pass" with minimal icons, or refined glyphs like ♥ / ✓ / ✕ rendered in `var(--text1)`). Affects:
   - `REACTION_EMOJIS` constant in `CollectionsTab.js`
   - `ReactionStrip` chips
   - `ListReviewMode` buttons + swipe stamps + commit hint line
   - Recipient banner copy ("tap ❤️ / 👍 / ❌ ...")
   - Bucket labels (`❤️ Liked · N`, `❌ Disliked · N`, `📋 To review · N`)
   The classification sets (POSITIVE / NEGATIVE in `CollectionsTab.js`) keep the legacy emoji strings for back-compat with existing reaction rows.

## Test data (delete when done)

Live on production. Owned by **Jacquelin Reed** (the other user account), shared with Mark as an accepted collaborator. 6 watches copied from Mark's "Watches for Jackie" list. Visible in Mark's Share tab + Watchlists › Lists › "🧪 Test — Pick my next watch, Mark?".

Clean up with:

```sql
delete from public.collections
where name like '🧪 Test —%'
  and user_id = '474038ee-456f-4f5d-9e05-b6586bf80f46';
```

Collection_items, the collaborator row, and any reactions cascade-delete via FKs.

## Durable rules from today (candidates for CLAUDE.md)

- **Top-level Share tab is its own home**. Sharing/recipient/poll journeys live under `tab=share`, NOT bolted onto Lists. The recipient banner + 📋 To-review bucket still live in the Lists drill-in (that's the work surface), but discovery + send live in Share.
- **Recipient detection**: `memberCount >= 2 && user.id !== selected.userId && !isHiddenColl && !isSavedColl`. Anywhere that branches owner vs. recipient must use this exact predicate.
- **Wordmark style is editorial**: uppercase, `fontWeight: 300`, `letterSpacing: 0.14–0.16em`. Don't bump weight or tracking without a Mark spec.
- **Sub-tab descriptors must collapse to the same height**: `minHeight: 30` on the SubTabIntro header row. Same applies to any new SubTabIntro caller — set `expandable` and pass a matching `actionLabel` (or accept that the row will be 30px tall regardless).
- **ListReviewMode pattern**: self-contained, portal-rendered fullscreen overlay. Lazy `useState` snapshots the to-review queue at mount so the index doesn't shift under the user as reactions land. PointerEvents unify touch + mouse + pen.
- **Swipe gesture semantics**: Right = positive primary (👍), Left = negative primary (❌), Up = stronger positive (❤️). Up beats horizontal so a diagonal up-and-right reads as "Love" not "Yes". Don't reverse the polarity — Tinder convention is what users expect.
- **`useState` lazy init for true mount-time snapshot** (vs `useMemo`): see `ListReviewMode.initialQueue`. Lazy useState runs exactly once on first render; useMemo can re-derive if deps change, which would yank current state out from under the user.

## Things to remember (still valid)

- **Don't `// eslint-disable-next-line` for rules CRA doesn't have configured** — fails the build under `CI=true`. (`no-unused-vars` IS configured; `react-hooks/exhaustive-deps` is NOT.) See CLAUDE.md Things-to-never-do.
- **Don't add hooks past App.js's early returns** — React #310. Self-contained components (like `ListReviewMode`, `ShareReceiver`, `ListReceiver`) are the way.
- **Don't push directly to main via Claude** — always open a PR.
- **Don't extend the Vercel Blob cache** to listings/auctions feeds. Watchlist-only is intentional.
- **PWA service worker cache** — when something doesn't appear after deploy, hard-refresh first.

## Re-entry checklist

1. Review + merge #253–#256 (close #255 unmerged in favour of #256).
2. Delete the test list when no longer needed (SQL above).
3. Pick which problem to chew on first — reviewer/writer journey OR editorial emoji set.
4. Reference files for the journey work:
   - `src/components/CollectionsTab.js` — `isRecipient` flag, recipient banner, bucket classification, ⋯ overflow.
   - `src/components/ListReviewMode.js` — fullscreen overlay, swipe gestures, undo affordance.
   - `src/components/SharedTab.js` + `ShareListPickerModal.js` — top-level Share entry surface + send flow.
   - DB tables: `collection_item_comments` (empty, ready for use), `collection_item_reactions`, `collection_collaborators`, `user_profiles`.

## Open questions for Mark

- Reviewer vs. writer — same persona with different intensity, or two distinct journeys with different UI?
- Editorial emoji — keep emoji glyphs but desaturate / make them text-coloured, or move to SVG icons entirely?
- Per-auction review mode (Calendar entry point → review all lots → auto-create collection) — still on the table or deferred for journey work first?
