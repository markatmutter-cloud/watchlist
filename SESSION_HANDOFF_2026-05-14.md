# Watchlist — Session Handoff (2026-05-13 → 2026-05-14)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap, see
[ROADMAP.md](ROADMAP.md). Durable rules graduate to CLAUDE.md; durable
direction graduates to ROADMAP.md. This doc is the in-flight snapshot.

## TL;DR

Long session spanning two arcs:

1. **Morning** — five small bug fixes shipped as separate PRs (#259–#262):
   Owned→Sold "cannot coerce" PostgREST error, watchlist image cache
   PK mismatch, Sotheby's premature-sold scraper bug, swipe-mode image
   field-name (folded into the bigger redesign below).
2. **Afternoon / evening** — full **Screening Mode redesign** (Mark's
   "tinder function"). Shipped as PRs #263 → #270 in rapid iteration
   against live preview testing. Editorial chrome, inline-on-desktop,
   onboarding card, undo + reset, peek/rise animation, tap-opens-listing,
   full-bg swipe wash, mutex on Yes/Pass, blue+grey colour scheme,
   haptics. Listed in detail below.

## PRs merged today

| PR | Title | Status |
|---|---|---|
| #259 | Owned→Sold "cannot coerce" error | merged |
| #260 | Watchlist image cache PK mismatch | merged |
| #261 | Sotheby's lots premature-sold scraper fix | merged |
| #262 | Swipe-mode image field-name | closed (superseded by #263) |
| #263 | Screening v1: editorial redesign + primitives | merged |
| #264 | Screening v1.1: interaction fixes + responsive layout | merged |
| #265 | Screening v1.2: inline desktop + onboarding + undo/reset | merged |
| #266 | Hotfix: screeningResetTick scope (white-screen) | merged |
| #267 | Screening v1.3: condense drill-in header + sans + cumulative tally | merged |
| #268 | Screening v1.3.1+2: smaller card · tap-opens-listing · full-bg wash · hide Reset on mobile | merged |
| #269 | v1.3.3: Yes/Pass mutex (no more stacking reactions) | merged |
| #270 | v1.4: drop in-flow Reset · Yes blue / Pass grey · haptics · list menu clamp | **open at handoff** |

PR #270 is mergeable, all four checks green at handoff. Merge it when
ready; nothing else depends on it.

## What shipped today — by arc

### Morning bugfixes

- **Owned→Sold "cannot coerce" (#259).** `markItemAsSold` chained
  `.update().select().single()`; the post-update SELECT goes through
  RLS and rare cases return 0 rows even when the write succeeded.
  Dropped the round-trip — the patch object IS what was written.
- **Image cache PK fix (#260).** `cache_watchlist_images.mjs` was
  selecting and `.eq()`-ing on `id`, but `watchlist_items`' PK is
  `(user_id, listing_id)`. The direct watchlist pass had been
  silently no-op'ing every update; cache fills were happening only
  as a side-effect of the collection_items pass.
- **Sotheby's premature-sold (#261).** algoliaJson `hit.price` is
  dual-meaning: realised hammer for sold lots, low estimate for
  everything else. Without gating on `lotState=="sold"`, active lots
  ended up with `sold_price = low_estimate` and downstream merge.py
  + App.js flagged them as sold. Two-gate fix: (a) lotState must be
  explicitly "sold", (b) reject sold_price == low_estimate as the
  transitional-window placeholder.

### Screening Mode redesign (the big arc)

A blow-by-blow of how the screening / "tinder function" landed:

**v1 (#263).** Editorial chrome: thin borders, brand-blue / danger
accents, monochrome SVG glyphs (no cellphone emoji). Two reactions
(Yes / Pass), heart-as-tap, ⋯ menu with Add to list / Share / Watch
details. Edge color washes for swipe feedback. Bottom action bar with
Back / Skip as edge buttons. Tap-to-expand → WatchDetailSheet. Card-
stack peek behind active card. Per-list localStorage persistence
(rowId-keyed). Break interstitial every 25 reviewed cards. Recap with
tally cards. **Approach A — fullscreen overlay portal'd to body.**

**v1.1 (#264).** Bug fixes from Mark's live test of v1:
- ⋯ menu didn't open (parent's setPointerCapture swallowed pointer
  events meant for the heart + ⋯ buttons) — added `data-no-drag`
  marker + early-return in onPointerDown.
- Tap-to-detail invisible (`WatchDetailSheet`'s modalBackdrop was at
  z-index 200, beneath the screening overlay's 2000) — bumped
  modalBackdrop to 2500.
- Resume off-by-one (was persisting numeric idx; rowId-based now).
- New cards slid in from the swipe-off direction — added
  `key={current.rowId}` + rise-from-peek animation.
- ⋯ moved from top-left to top-right under heart (Card.js convention).
- Drop shadows on the card. Card-stack peek visible. Bigger top-bar
  text. Refined Yes/Pass typography (letterSpacing 0.14em / weight 500).
- Edge wash with gradient holding color from 0–12% (vs 0–20% before).

**v1.2 (#265).** Architectural moves + onboarding:
- **Inline on desktop (Approach B)** — at viewports ≥900px, screening
  renders inline in the tab body instead of a fullscreen portal. Top
  wordmark / nav / filter row stay visible. Mobile keeps the
  fullscreen portal for focus. CollectionsTab skips the drill-in card
  grid entirely when inline-screening is active.
- **`WatchDetailSheet` portal'd to document.body.** The v1.1 z-index
  bump alone wasn't enough — CollectionsTab ancestors create stacking
  contexts that trap any inline modal beneath an overlay at body
  level. Portal to body fixes it cleanly.
- **One-time onboarding card.** localStorage flag
  `screening_intro_seen_v1`; never shown again per user.
- **Undo** (renamed from Back): steps back one AND clears the user's
  reaction on the previous card if one exists.
- **Reset list** as a first-class subtle link with editorial confirm
  modal.

**Hotfix #266.** v1.2 (#265) was merged with a ReferenceError:
`screeningResetTick` + `isWide` were declared in `CollectionsTab` but
used in `ListsView` — separate components, separate scope. Production
white-screened on any shared-list drill-in until the hotfix landed.

**v1.3 (#267).** From Mark's preview testing of v1.2:
- **Drill-in header condensed.** Two-row layout (title + recipient
  banner) → one row. Back link + list title + discovery caption
  ("Jacquelin shared · 0/6 reacted") + small Review → CTA + Share + ⋯
  inline. The standalone banner is gone.
- **Tap-to-detail end-to-end fix.** The portal in v1.2 was correct,
  but `setDetailRowId` was being called from `ListsView` where it
  wasn't a prop. Threaded through.
- **Sans typography everywhere except brand name on active card.**
  RecapView / OnboardingCard / ResetConfirm / BreakInterstitial /
  TallyCard headlines all off serif. TallyCard numbers use
  `lining-nums` since serif "1" rendered as "I".
- **Cumulative tally on recap.** Was session-only (exit-and-return
  showed only the latest session's count). Now derived from
  `reactionsByItem` + `watchlist`.
- **Reset → left of Undo.** Smaller Yes/Pass buttons. Onboarding adds
  the WHY paragraph + button "Start review."
- Emoji removed from banner copy. Test list name cleaned via SQL
  ("🧪 Test —" → "Test —").
- Height constant 220 → 150px.

**v1.3.1 (in #268).** Smaller desktop card (520 → 420px) so total
content fits viewport without scroll.

**v1.3.2 (in #268).**
- **Tap on the card image is a no-op now.** Tapping the side detail
  block (brand / title / price) opens the original listing URL in a
  new tab. The unwanted My-Watches-style detail sheet is gone from
  the screening flow entirely. ⋯ menu "Watch details" → "View
  original listing ↗".
- **Full-background swipe wash.** Replaces the side-only gradient.
  Red tints the whole screening surface when dragging left, green
  (later changed to blue + grey) when dragging right. Max opacity 0.20.
- **Reset hidden on mobile** (later removed everywhere — see v1.4).

**v1.3.3 (#269).** Reaction stacking bug:
- `toggleReaction` RPC only acts on the SPECIFIC emoji passed.
  Switching from Yes to Pass inserts Pass without removing Yes, so
  both rows persist. Mark report: "I hit like/pass and it kept
  adding to the summary not changing."
- Fix in three places (recordReaction / handleUndo /
  handleClearCurrent): enumerate the user's existing Yes/Pass rows
  on the item and clear them all before inserting the new emoji.
- Hardened cumulativeTally to count each item once even with stale
  duplicates.

**v1.4 (#270, open at handoff).**
- **Reset retired from the in-flow UI** on both viewports. Still
  reachable via the list-level ⋯ overflow ("Reset my reactions (N)").
- **Yes / Pass recolour.** Yes button + edge wash + tally card →
  `var(--brand)` blue. Pass → neutral `var(--text2)` grey, near-black
  edge wash (reads as dimming, not colour swap).
- **Haptics.** Tiny `haptic(pattern)` helper wrapping
  `navigator.vibrate`. 15ms pulse on every Yes/Pass tap; 40-30-40-30-60
  pattern when the queue completes. Android only — iOS PWAs no-op
  silently until Apple ships a web haptic API or we wrap in a native
  shell.
- **List-level ⋯ menu off-screen fix.** "Reset my reactions (N)"
  pushed the menu wider than its 160px min-width; clamp the right
  anchor so the menu's left edge stays inside the viewport.

## Where to start next session — **journey design + roadmap update**

Mark's instruction at end of today: *"work on handoff — with the next
step to get back to the journey and update roadmap."*

The journey conversation Mark was leading is **the Screening journey**
(start / pause / resume / reset / review / share). v1.0 through v1.4
shipped the *mechanics* — persistence hook, interstitial card, recap
shell, undo / reset semantics. The *journey copy + entry points + recap
CTAs* are the next chapter.

Mark's sketch of the journey from a prior session, for context:

> 1. Receive — link arrives via iMessage / WhatsApp / etc.
> 2. Land — recipient banner names the owner + count
> 3. Onboard (first time only) — single intro card before card 1
> 4. Screen — the swipe interface
> 5. Pause via interstitial or manual exit → bookmark
> 6. Resume — re-enter, pick up where you left off
> 7. Complete — editorial recap with counts
> 8. Share results back to owner — native share with a URL filtered
>    to the user's Yes + Hearted reactions
> 9. Review results — tap recap tiles to filter list view by bucket
> 10. Reset — list ⋯ overflow ("Reset my reactions")

**Of these, what shipped in v1–v1.4:** 2 (banner), 3 (onboarding),
4 (screen), 5 (pause), 6 (resume), 7 (recap shell), 10 (reset via menu).

**Open journey work:**

- **8 — Share results back.** Right now the recap closes back to the
  list view. Nothing on the recap nudges the user to send their
  shortlist back to the owner. Needs a "Send my picks to <owner>"
  CTA, with a share URL that opens the owner's list filtered to the
  recipient's Yes + Hearted reactions. New URL parameter on the share
  link (e.g., `?filter=picks-from=<user>`).
- **9 — Review results via tap-on-tally.** Recap tally cards
  currently display counts. Add: tap a tile to close the recap +
  filter the list-drill-in view to that bucket. Connects to the
  sentiment-bucket grid already in CollectionsTab.
- **Pause UX framing.** Currently the break interstitial fires every
  25 cards. Could also surface as a "Continue where you left off"
  banner on re-entry to the list. Today re-entry just lands silently
  at the right card — Mark might want explicit "Resume / Start over"
  framing.

**Other suggestions Mark queued for "later":**

- **Reviewer / Writer journey** — comments per item via the existing
  `collection_item_comments` table (0 rows today). Adds a "long-form
  opinion" path distinct from binary Yes/Pass.
- **List polarity / intent capture** — see
  `[[feedback-list-polarity-sentiment]]` in memory. Important for the
  recommender pipeline; would require a UI nudge at list-create time
  + a column on `collections`.
- **Other entry points for Screening** — auction catalog (live + archive
  "what if I'd bid"), "new since last visit" on Listings, self-screen
  on long personal lists. The mechanics are reusable; each needs an
  entry CTA on its surface.

## Durable rules from today — candidates for CLAUDE.md

- **Modal backdrops at z-index 2500.** Bumped from 200 to keep modals
  invoked from inside the screening overlay (z-index 2000) on top.
  Any new full-viewport modal should match. UserLimitBanner at 9000
  still floats above all modals.
- **WatchDetailSheet portals to document.body.** Don't render it
  inline within a CollectionsTab subtree — ancestor stacking contexts
  trap it. Same applies to any modal that needs to layer above a
  body-level overlay.
- **`data-no-drag` attribute pattern.** On any interactive child
  inside a swipeable / draggable parent, set `data-no-drag` so the
  parent's pointer-event handlers can short-circuit and let the
  child's own onClick fire. Used for heart + ⋯ buttons inside the
  screening card.
- **`toggleReaction` is single-emoji.** The RPC only acts on the
  emoji passed — it does NOT clear other emoji reactions on the same
  item. UI surfaces that want mutex (Yes XOR Pass) must enumerate the
  user's existing reactions and clear them before inserting a new
  one. See `recordReaction` in ListReviewMode.
- **Persistence by rowId, not numeric idx.** When the queue filters
  out items the user has reacted to, indexes shift. Persist the rowId
  of the currently-viewed item; resume locates it in the freshly-
  filtered queue.
- **Editorial typography: brand-name serif only.** The serif system
  stack (`'Hoefler Text', 'Garamond', 'Georgia', 'Times New Roman'`)
  is for one slot: the brand name on the active screening card.
  Everywhere else in screening uses sans (`SANS_STACK`). Numbers
  always use `lining-nums` so serif "1" doesn't render as "I".
- **Squash-merge timing trap.** If you push follow-up commits to a PR
  branch AFTER the squash-merge fires, those commits don't reach
  main. Verify the PR is still open before pushing on top. Bit us
  twice today (#264 + #268 / #269). When in doubt, open a new PR
  branch for follow-ups.

## Process notes

- **Mark merged PRs in real-time as I shipped them.** The model:
  Mark drives the live preview tests; Claude opens PRs; Mark reads
  the diff and merges in order. Worked well. Two squash-merge timing
  surprises (above) but otherwise smooth.
- **The v1.2 white-screen** was caught in production for ~10 minutes
  before hotfix #266 landed. Mark's report ("can't see an updated
  pr") tipped me off. The `App.test.jsx` render-test doesn't
  exercise `reviewModeOpen=true && isRecipient=true` — coverage gap
  to fill.
- **Test list "🧪 Test — Pick my next watch, Mark?"** had its emoji
  stripped via SQL. The test list itself still exists at
  `12e2f653-efa3-4e19-ad50-f58f29a434e2` (owned by Jacquelin Reed,
  shared with Mark) for ongoing testing. Per the May 11 handoff there
  was already a `delete from collections where name like '🧪 Test —%'`
  cleanup query — that's now obsolete since the emoji is gone, but
  the test data is still alive.

## Open at handoff

- **PR #270** (v1.4) — mergeable, all checks green. Merge when
  ready.
- **Reactions surface monochrome sweep** — `ReactionStrip` on
  regular grid cards, sentiment-bucket headers (`❤️ Liked / Open / ❌
  Disliked / 📋 To review`), and the per-list count chip still use
  the old emoji + colour set. The screening surface is fully on
  blue/grey/red-heart; the wider app isn't. Worth a dedicated PR if
  Mark wants visual consistency across all reaction surfaces.
- **`watchlist_items` cache backlog** — should clear on the next
  cron run after PR #260 landed. Verify with
  ```sql
  select count(*) filter (where cached_img_url is null) from watchlist_items;
  ```
  expecting the count to drop substantially from 233.
- **About modal copy refresh** — task #4 still pending. Existing
  How-to-use cards predate the Share tab, screening, reactions,
  recipient banner. Stale on a feature Mark's been showing people.

## Re-entry checklist

1. Merge PR #270 if not already.
2. Pick up the journey work (next chapter — see "Where to start next
   session" above).
3. Update ROADMAP.md to reflect: screening v1 → v1.4 shipped; reviewer
   journey + recommender taxonomy still parked; broader reactions
   sweep queued.
4. Optional follow-ups, low priority:
   - About modal copy (#4)
   - `ReactionStrip` monochrome sweep
   - Coverage gap in `App.test.jsx` (recipient-mode render)

## Open questions for Mark

- The journey shape — does step 8 ("Share my picks back to <owner>")
  ship as the next thing, or do you want to explore an alternative
  entry point first (e.g., screening on auction catalogs)?
- Polarity/intent capture timing — capture at list-create now via a
  small UI nudge, or defer until the recommender is being built?
- Editorial wordmark: brand name serif is in. Do you want to extend
  serif to other display surfaces (e.g., the Home wordmark, the
  AboutModal hero), or keep it scoped to the screening card?
- IA conversation (Live / Watchlists / Collecting) still parked.
  Worth revisiting after the journey chapter lands?
