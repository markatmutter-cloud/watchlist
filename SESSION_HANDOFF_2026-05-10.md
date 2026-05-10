# Watchlist — Session Handoff (2026-05-10)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — durable rules graduate to CLAUDE.md, durable plans graduate to
ROADMAP.md.

## TL;DR

Marathon session. **Eighteen PRs merged today (#168 → #185)**, five
SQL migrations + one in-session SQL fix, one new column on
collection_items, three new RPCs, two existing RPCs rewritten.
Headlines: usernames + reactions on shared lists both live with
sentiment-bucket sorting, watch-management feature stress-tested
end-to-end, privacy + terms shipped, list-image cache extended,
GitHub repo URL no longer exposed.

Twelve arcs:

1. **My Watches bug fixes (PR #168)** — Wants ↑↓ arrows wired to
   the real reorder mutator, ⋯ menu portalled with `position:fixed`
   so it escapes the card's overflow:hidden, ManualItemCard gets a
   "Watch details" entry.
2. **Detail sheet (PR #169)** — photo upload from desktop on
   manual entries, "View original listing ↗" link surfaces
   item.url, editable Listing-link field for manual rows (Mark's
   1675 from Menta), hourglass-favicon fallback replaces the ⌚
   emoji across every tile.
3. **Plan view rebuild (PR #170)** — Wants → Shortlist rename,
   tile grid (no more list-rows), all-lists picker replaces
   hearts-only Pool, ↑ overlay button on Keeping cards for
   one-tap flag-for-sale, section explanations.
4. **Toggle restyle + tab copy + How-to-use (PR #171)** —
   segmented-control replaces pill chips for Collection / Archive
   / Plan, six SubTabIntro rewrites, "How to use it" cards in the
   About modal.
5. **Auction multi-session + velocity stats (PR #172)** — Phillips
   Geneva XXIII session-1 lots stuck in Live; fixed by trusting
   `sold_price` over the calendar-level `auction_end`. Same-day
   archive imports (Chronoholic, ClassicHeuer) now excluded from
   fastest-sales (`days >= 1`).
6. **Auction calendar archive (PR #173)** — full list always,
   collapsible Archive section for past auctions; merge.py drops
   the 30-day prune so past auctions stay in the feed.
7. **Usernames + CSS-var portal fix (PR #174)** — new
   `user_profiles` table, Settings UI, list_collaborators +
   list_members_for_collection prefer profile display_name. Also
   moves theme CSS variables to `:root` so portal nodes inherit.
8. **UI tweaks + descriptions + alignment + shared-list icon
   (#175 + #176 + #183)** — listings sub-tab one-liners,
   detail-sheet safe-area inset, Collection/Archive summary stats
   above the grid, alignment cleanup so headers + grid + summary
   cards all sit at MobileShell's 14px edge, two-person icon on
   shared lists. (#176's second commit got orphaned and re-shipped
   in #183 — see Process notes below.)
9. **Reactions on shared list items (PR #177)** — emoji reactions
   table + RLS + realtime publication + RPC; ReactionStrip below
   each shared-list card with the 👍 ❤️ 🔥 🤔 ❌ picker.
10. **Privacy + terms + extend About to mobile (#179).** Static
    `public/privacy.html` + `public/terms.html` (one-pagers,
    dark-mode aware via `prefers-color-scheme`); AboutModal extras
    (features grid + How-to-use + Why I built this) now visible on
    mobile too; Privacy · Terms links in the footer.
11. **Image cache extension to collection_items (#180)** + **hide
    GitHub repo URL (#181).** New `cached_img_url` column on
    collection_items so list-only items survive dealer churn;
    cache_watchlist_images.mjs gets a third pass that mirrors
    watchlist blobs by listing_id. Same-origin data fetches replace
    the six raw.githubusercontent URLs in App.js; unused
    `useEBaySearches` hook deleted (it was the only surface still
    fetching from GitHub).
12. **Reactions polish: ErrorBoundary, sentiment buckets, count
    chip, brand blue (#182, #183, #184, #185).** ErrorBoundary
    around the App shell so render-time crashes show an inline
    error card with stack instead of white-screen. Realtime
    subscribe wrapped in try/catch. Self-attribution ("Added by
    Mark" on Mark's own items) hidden. New `list_reaction_counts_for_user`
    RPC drives a small blue 👍 N chip on list rows so a glance at
    the Lists view tells you which lists have collaborator
    activity. Sentiment-bucket grid splits shared lists into
    👍 Liked / Open / ❌ Set aside sections with `gridColumn: 1/-1`
    sub-headers. Reaction-strip border removed (was reading as a
    card boundary inside the unit). Picker-trigger SVG and
    list-row chip both switched from yellow emoji to brand-blue
    SVG matching the interface.

## What shipped — by arc

### My Watches bug fixes (PR #168)

- Wants `↑/↓` arrows reorder again — PlanView was wired with
  `onReorder={() => {}}` instead of the real mutator.
- ⋯ menu on Card and ManualItemCard now renders via a React Portal
  to `document.body` with `position:fixed` at coords computed from
  the trigger's bounding rect. Long labels (Remove from collection,
  Watch details) used to clip on the card's `overflow:hidden`.
- ManualItemCard menu gains a "Watch details" entry.

### Detail sheet — photo upload + listing link + favicon (PR #169)

- Tap the photo region in the detail sheet to upload a new image
  (manual entries only — listing-backed rows have a dealer-CDN
  image we don't own).
- "View original listing ↗" link surfaces whenever `item.url` is
  set.
- Editable "Listing link" field for manual rows so Mark can paste
  e.g. the Menta dealer URL on his 1675.
- Hourglass favicon (`/favicon-192.png`) replaces the ⌚ emoji as
  the missing-image placeholder in WatchDetailSheet, ManualItemCard,
  PoolCard, WishlistRankedList, and ListingPickerModal Tile.
- `detailItem` is now derived from `itemsByCollection` by rowId, so
  in-sheet edits re-render the sheet immediately.

### Plan view rebuild (PR #170)

- "Wants" → "Shortlist" across summary, section label, copy.
- Shortlist now renders as a tile grid via CollectionGrid (was a
  list of rows). Tiles get heart, ⋯ menu, currency conversion for
  free.
- New `quickAction` prop on Card — small overlay button at top-left.
  Plan > Keeping cards get an `↑` (flag for sale, one tap); Selling
  cards get a red `↓` ("keep instead").
- "Select from your lists" picker replaces the hearts-only Pool.
  Chip group for Favorites + every user list; tap a tile →
  addItemToWants.
- Short grey explainer line under each section title.

### Toggle restyle + tab copy + How-to-use (PR #171)

- Collection / Archive / Plan switched from `innerToggleButton`
  pill chips to a unified segmented control. Active state is a
  raised inset button + count chip.
- Rewrites for SubTabIntros across My Watches, Lists, Searches,
  Challenges, Learn, Links — tighter, more action-oriented copy
  that names the gesture (`⋯ → Add to…`, etc.).
- AboutModal gains a "How to use it" section: six concrete-job
  cards walking through heart, save searches, build a list,
  share a list, track ownership, plan a move.

### Auction multi-session + velocity stats (PR #172)

- Phillips Geneva XXIII (CH080226) runs across two days; session-1
  lots (e.g. Krayon ref 227857) sold today with the scraper
  correctly returning `status:"ended" + sold_price`, but App.js's
  `auction_end > now` override was force-resetting per-lot ended
  state. Fix: `sold_price != null` short-circuits the override.
- Chronoholic + ClassicHeuer archive imports land with
  `firstSeen == soldAt` at scrape time. Filter `days >= 1` at four
  AdminTab call sites (per-source, per-brand, fastestSales,
  fastestBrands chips). Same-day flips are dominated by imports;
  the noise reduction beats the rare-real-flip false negative.
- Auction lots already excluded from velocity (verified).

### Auction calendar archive (PR #173)

- Removed the "Show all auctions · N more" preview — full list
  always renders.
- New Archive section under the calendar — collapsible, every past
  auction (most-recently-ended first). Matches the auctions whose
  lots are now in Listings > Archive (Sold).
- merge.py drops the 30-day post-auction prune. Past auctions stay
  in `auctions.json` indefinitely so Archive has full history.
  State entries were already persisted, so no data was being lost.
- Archive populates after the next auction-scrape cron run (or a
  manual trigger).

### Usernames + CSS-var portal fix (PR #174)

- New `user_profiles` table (user_id PK, display_name, timestamps)
  with RLS — read-all signed-in, write self only. Auto-create on
  first sign-in with default derived from full_name → name →
  email-local-part (capitalized).
- `useUserProfile(user)` hook — `{ displayName, setDisplayName,
  loaded }`. Settings modal gains a "Display name" field.
- `list_collaborators` + `list_members_for_collection` updated to
  prefer profile display_name (coalesce: profile → full_name →
  name → email).
- **CSS variable portal fix** (carried in this PR): `--bg` and
  friends were inline-styled on the App root. Portal nodes (the ⋯
  menu) sit under `<body>` so `var(--bg)` resolved to nothing →
  transparent. Now mirrored to `document.documentElement.style` via
  useEffect on the theme object.
- App.test mock gets useUserProfile.

### UI tweaks (#175 + #176)

- **#175 — detail sheet top inset + listings descriptions +
  collection summary stats.** WatchDetailSheet mobile sheet uses
  `paddingTop: max(28px, env(safe-area-inset-top, 28px))`. Listings
  sub-tab strip gains a one-line description below it. Collection /
  Archive get a 3-card summary row above the grid (count / total /
  average). Segmented-control row trims its bottom border.
- **#176 — descriptions bolder + alignment + shared-list icon.**
  Listings sub-tab descriptions go fontWeight 500 / text2 / 12px;
  copy tightened so most fit on one line. Segmented-control row,
  summary-cards row, Plan totals row all stripped of their inner
  horizontal padding so they align with the watch grid at
  MobileShell's 14px edge. Lists with at least one accepted
  collaborator render with a two-person icon (instead of folder)
  + " · shared" subtitle suffix.

### 50 Fathoms ghost row (in-session SQL)

- Mark's "test" Blancpain 50 Fathoms (Shuck the Oyster, listing-id
  `388f767147d2`) was stuck in his Owned hard list with row id
  `ff1766d0-a551-48c8-901a-1d977ce5fa23`. The clipped ⋯ menu (PR
  #168 fix in flight) made the Remove action unreachable. Hard-
  deleted via Supabase MCP `delete from collection_items` once the
  row was found.

### Reactions on shared list items (PR #177)

- New `collection_item_reactions` table — (id, collection_item_id,
  user_id, emoji, created_at) with unique index on (item, user,
  emoji) for toggle semantics; multi-emoji per user per item is
  fine.
- RLS: SELECT + INSERT gate on `can_view_collection` (existing
  helper from PR #121); DELETE gates on `auth.uid() = user_id`.
  Editors AND viewers both react.
- Realtime publication entry so co-collaborator reactions push
  live without a refresh.
- `list_item_reactions(p_collection_id)` SECURITY DEFINER RPC
  joins user_profiles + auth.users for the reactor's display name
  in one round-trip.
- `fetchReactions` + `toggleReaction` on useCollections. Toggle is
  select → delete-or-insert.
- `ReactionStrip` component below each shared-list card. Aggregated
  emojis with counts, brand-coloured active state for the user's
  own reactions, "+" button to open the 👍 ❤️ 🔥 🤔 ❌ picker.
  Solo lists (memberCount < 2) skip the strip entirely.

## SQL migrations applied this session

All applied via Supabase MCP, committed under `supabase/schema/`:

1. `2026-05-10_user_profiles.sql` — new `user_profiles` table,
   RLS, updated_at trigger, `list_collaborators` +
   `list_members_for_collection` rewrites that coalesce on
   `user_profiles.display_name`.
2. `2026-05-10_reactions.sql` — `collection_item_reactions` table,
   RLS, realtime publication entry, `list_item_reactions` RPC.
3. `2026-05-10_collection_items_cached_img.sql` — adds
   `cached_img_url text` column on `collection_items` so the
   image cache cron can populate it for listing-backed rows.
4. `2026-05-10_reaction_counts.sql` — `list_reaction_counts_for_user`
   SECURITY DEFINER RPC; returns per-collection count of reactions
   by people other than the caller. Drives the chip on list rows.
5. **In-session SQL (no migration file):** `delete from
   collection_items where id = 'ff1766d0-...';` to clear Mark's
   stuck 50 Fathoms test row.

## Process notes (worth pinning)

- **Don't push followup commits to an already-open PR.** PR #176
  was merged with only its first commit; the second commit
  (alignment + shared-list icon) was orphaned because the merge
  picked up the head ref before GitHub had registered the second
  push. Re-shipped via #183 as a fresh branch + fresh PR. Going
  forward: every new logical change → its own branch + its own
  PR, no follow-on commits onto open PRs.

## Open / pending at handoff

- **og:image refresh** — privacy + terms pages shipped with the
  apple-touch-icon as the placeholder OG image. The 1200×630
  proper hero needs designing (an asset task, not a code one).
  Welcome page itself is effectively the AboutModal, which
  auto-opens on first visit and now (post-#179) shows full
  content on mobile too.
- **Design pass.** Mark asked for an honest design rating and the
  answer is: shipped chrome is functional, not designed. A design
  brief has been drafted in conversation — paste into a fresh
  claude.ai session with Artifacts, one surface at a time (Card,
  Plan view, Detail sheet) for visual mockups. Implementation in
  code waits until mockups land.
- References as first-class entities (Epic 0).
- "Save complete-share back" child-challenge linkage.
- **Reactions follow-ons.** v1 covers shared-list items only.
  Next: reactions on **journal entries**
  (collection_item_comments), summary stats per list ("3 hearts
  on this list this week"), "new reactions since you last
  opened" badge (the count chip is a per-collection total — it
  doesn't yet diff against last-visit). Realtime substrate
  already in place.
- Site-analytics extensions (sales-by-watch-type-per-dealer,
  taste-relative pricing — Epic 0 references gated).
- Strength-of-save (Love / Watch two-tier).

## Things to know for next session

- **Reactions are live.** Send a Collaboration Link to a friend;
  they accept; both members see emoji chips below each card in
  the shared list. Realtime-pushed.
- **Display name override** is in Settings — works across `who_added`
  chips, Manage list sheet roster, and reaction author tooltips.
- **CSS variables now live on `:root` (via documentElement.style)**
  in addition to the App-root inline style. If you ship a new
  portal-rendered surface, it will inherit theme colours
  automatically. Don't go back to inline-only.
- **Past auctions stay in `auctions.json` forever now.** First-time
  effect is on the next auction-scrape cron run; until then the
  Archive section will be empty.
- **Velocity stats exclude `days < 1`** at four AdminTab call sites
  to filter out same-day archive imports. If a real same-day flip
  ever needs to count, revisit `Number.isFinite(days) && days >= 1`.
- **Phillips multi-session sales work now** because App.js trusts
  `sold_price` over `auction_end > now`. Same-shape pattern would
  apply to any future multi-session house.
- **One-line `?invite=<token>` flow is the only path that gets a
  recipient to "accepted" status.** View Only Link → "save a
  copy"; Collaboration Link → token → accept. If a "Pending"
  collaborator never moves, they used the View Only link.
- **The Card ⋯ menu portals to document.body**; if you add a new
  Card variant, route the menu through the same portal pattern
  (triggerRef + portalRef + getBoundingClientRect coords).
- **Privacy + terms are static HTML** at `public/privacy.html`
  and `public/terms.html`, served outside the SPA. Both have
  their own theme-token CSS with `prefers-color-scheme` dark
  mode. Update the `Last updated` line whenever something
  material changes (new table, new third party, new event type).
- **Data fetches now use same-origin paths.** App.js no longer
  reaches `raw.githubusercontent.com` — `/listings.json`,
  `/auctions.json`, `/tracked_lots.json`, `/auction_lots.json`,
  `/manual_archive_lots.json`, `/manual_historical_listings.json`
  all live at the site root via Vercel. If you add a new public
  data file, drop it under `public/` and reference it by its
  same-origin path. Don't reintroduce the GitHub raw URL pattern.
- **List images survive dealer churn now.** PR #180 extended the
  Vercel Blob cache to listing-backed `collection_items` rows.
  Every collection_items row gets a `cached_img_url` after the
  next cron run; frontend prefers it over the dealer URL. Manual
  entries unaffected (their photo is already in `watch-photos`).
- **Sentiment-bucket grid for shared lists.** Items split into
  👍 Liked / Open / ❌ Set aside via `gridColumn: 1/-1` sub-headers.
  Classification: any 👍/❤️/🔥 → positive; ❌ (no positive) →
  negative; everything else → neutral. Solo lists keep the plain
  unsorted order. POSITIVE/NEGATIVE constants live next to the
  bucketing IIFE in `CollectionsTab.js`.
- **Reactions count chip on list rows** — small blue 👍 N pill on
  any list row with reactions from people other than the viewer.
  Refreshes when the user navigates back from a drill-in.
  `list_reaction_counts_for_user` RPC excludes self-reactions
  server-side.
- **ErrorBoundary wraps the App shell.** A render-time crash
  anywhere downstream now surfaces an inline error card with
  message + stack instead of a white screen. Useful for debugging
  user-environment-specific bugs (e.g. iOS Safari without USB
  tethering).
- **Don't push followup commits to an already-open PR.** PR #176
  was merged with only its first commit; the second was orphaned
  due to a race between push + merge. Rule of thumb: every new
  logical change → its own branch + its own PR.

## Cleanup pass

- Local merged branches deleted as they landed.
- Remote refs pruned.
- Dead `WishlistRankedList` and `rankBtnStyle` removed in PR #170
  (Plan view tile-grid replaces them).
- Dead `innerToggleButton` import removed from CollectionsTab.js
  in PR #171 (still imported by App.js for Listings sub-axis).
- Dead `menuRef` removed from Card.js after the portal refactor.

## Open carry-overs (graduated to next session)

- Reactions on **journal entries** (collection_item_comments) —
  same shape would apply but punted from this session for scope.
- Reactions counts as a **summary stat** on shared lists (e.g.
  "3 hearts on this list this week").
- Per-list **notification badge** when a collaborator reacts —
  intentionally NOT in scope (out-of-app messaging is the channel
  per CLAUDE.md "Things to never do") but the realtime substrate
  would support a "new reactions since you last opened" badge.
- Welcome page + og:image — still parked, near the top of the
  ROADMAP priority order.
- References as first-class entities (Epic 0) — gates several
  downstream features.
