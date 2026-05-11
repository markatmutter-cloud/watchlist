# Watchlist — Session Handoff (2026-05-11)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap, see [ROADMAP.md](ROADMAP.md).
This is an in-flight snapshot; durable rules graduate to CLAUDE.md.

## TL;DR

Three arcs today:

1. **Auction data architecture** (morning) — Antiquorum / Phillips / Christie's enumeration + sold-price scraping fixes. Shipped earlier in the day.
2. **Home tab v2 + UI cleanup** — Brought Home back as an editorial landing (centred WATCHLIST wordmark, typeahead, hearted strip for signed-in users, Recently added / Recently sold / Ending next strips, ManageCallout, FooterBand). Hardened against React #310 (hooks before early returns). Tightened wordmark weight, fixed alignment of Saved sub-tabs.
3. **Reactions + shared-list journey** (afternoon → evening) — Simplified the reaction emoji set, reduced drill-in chrome, framed the recipient experience.

## PRs from this session

| PR | Title | Status |
|---|---|---|
| #237 | View-all pill, drop `~` on currency, admin chip, bottom-nav | ✅ merged |
| #238 | Home: centred wordmark + admin quick-hide overlay | ✅ merged |
| #239 | Home: home-only hide + hearted strip + sticky mobile + dealer typeahead | ✅ merged |
| #240 | SubTabIntro polish, fav-search icon, calendar pill, dividers | ✅ merged |
| #241 | UI cleanup round 2 (SubTabIntro consistency, lighter wordmark, MyWatches alignment) | ✅ merged |
| #242 | Reactions: 3-emoji set (❤️ / 👍 / ❌) + Saved sub-tab alignment fix | ✅ merged |
| #243 | Share-list drill-in: compact single-row header + ⋯ overflow | ✅ merged |
| #244 | SubTabIntro uniform collapsed height + Challenges title consistency | ✅ merged |
| #245 | Shared-list recipient: banner + 📋 To-review bucket | 🟡 **open, awaiting merge** |

## In-flight (branch `feat/mobile-review-mode`)

**Mobile one-at-a-time recipient review view.** When a recipient on mobile drills into a list shared with them, offer a fullscreen review mode: single big card per screen, prominent ❤️ / 👍 / ❌ reaction buttons, progress indicator (`3 of 49`), auto-advance to next unreacted item on tap. Per Mark's earlier mockup.

Nothing committed yet on this branch — interrupted by handoff request.

## Queued after #245 + mobile review ship

- **Filter row polish** — Date / Price as a single segmented pill; search bar collapses on scroll. Polish-tier.
- **Recipient round 2** — sticky progress chip in the header (`3/49 reacted`), bigger / more prominent reaction buttons on the card.
- **Optional: rename "Open" bucket header** — Mark referred to "liked / disliked" pairing; the middle bucket reads "Open" today. Could pair as "Liked / Undecided / Disliked" or leave alone.

## Durable rules added today (graduated to CLAUDE.md candidates)

- **Sub-tab descriptors**: every `<SubTabIntro/>` must collapse to the same height. The `minHeight: 30` on the header row in `SubTabIntro.js` enforces this; don't drop it.
- **Wordmark style**: editorial — uppercase, `fontWeight: 300`, `letterSpacing: 0.14–0.16em`. Used on AboutModal, MobileShell/DesktopShell top wordmark (when shown on non-Home tabs), Home hero (heavier 300 with bigger size).
- **CollectionsTab outer wrapper**: no `paddingTop` on the outer `<div>` — each inner view (ListsView / MyWatchesView / ChallengesView) already adds its own `paddingTop: 4`. Adding the outer pad made the three sub-tabs sit 4px lower than the Searches sub-tab (WatchlistTab).
- **Share-list drill-in header layout**: single row, actions right-aligned (Share button + ⋯ overflow). Manage / Rename / Delete inside the overflow menu, owner-only.
- **Recipient detection**: `memberCount >= 2 && user.id !== selected.userId && !isHiddenColl && !isSavedColl`. Anywhere that branches owner vs recipient should use the same rule.

## Things NOT to do (still valid)

- Don't reintroduce the Home page's heavy bleed bands across multiple sections — settled on ONE dark bleed for ManageCallout, search bar / cards stay on `--bg`.
- Don't add hooks past App.js's early returns (`if (loading) return …`). React #310 hits the moment a render takes a different conditional path.
- Don't push directly to `main` via Claude. Always open a PR.
- Don't ship multiple unrelated changes in one PR. Smaller commits + preview-URL verification = bug hits a preview deploy, not production.

## Open questions

- Mobile recipient review mode: auto-open on drill-in or require a "Start review" CTA? Defaulting to CTA so the user can still scan the full list at-a-glance if they want.
- "Disliked" / "Liked" pair reads better than the original "Set aside" / "Liked"; the middle bucket "Open" is now the odd one out. Consider "Undecided" or just dropping the middle header when only one of (positive, negative) is non-empty.

## Re-entry checklist

1. Check PR #245 status; if merged, pull main.
2. Continue on `feat/mobile-review-mode` — nothing committed yet, start fresh.
3. Pattern reference: the recipient banner + To-review bucket in `CollectionsTab.js` ListsView is the recipient-context entry point; mobile review mode hangs off the same `isRecipient` flag.
