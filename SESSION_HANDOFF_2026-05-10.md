# Watchlist — Session Handoff (2026-05-10)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — durable rules graduate to CLAUDE.md, durable plans graduate to
ROADMAP.md.

## TL;DR

**Two sessions today.** Combined: **28 PRs merged (#168 → #196)**,
seven SQL migrations applied, plus two production bug fixes triaged
during the second session (saved-search schema drift, Vercel Blob
private-store config) and one open issue (Blob token in GH Actions
needs the new public store's token).

**Part 1 — mid-day shipping (PRs #168 → #185).** Eighteen PRs, five
SQL migrations + one in-session SQL fix, one new column on
collection_items, three new RPCs, two existing RPCs rewritten.
Headlines: usernames + reactions on shared lists both live with
sentiment-bucket sorting, watch-management feature stress-tested
end-to-end, privacy + terms shipped, list-image cache extended,
GitHub repo URL no longer exposed.

**Part 2 — late-evening maintenance pass (PRs #187 → #196).** Ten
PRs, two SQL migrations applied, one prod bug fixed mid-pass
(`saved_searches` was missing the May 8 `min_price`/`max_price`
columns — JS had been writing them since May 8). Empty-state warming,
copy de-genericising, design tokens, doc rot fixes, anon-access
revoke that actually works this time (PUBLIC, not anon), RLS
performance sweep, FK covering indexes. See "Part 2 — Maintenance
pass" section below.

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

---

## Part 2 — Late-evening maintenance pass (PRs #187 → #196)

Discovery-driven hygiene session. Mark kicked off a "no new features"
maintenance pass per the CLAUDE.md maintenance-rhythm rule. Four
parallel audit streams (empty states, copy voice, visual consistency,
code hygiene) plus a doc audit and a Supabase audit produced a
consolidated discovery report; Mark green-lit "all 6" and a few more
on top.

Two production bugs surfaced mid-pass and were triaged inline:
1. **Saved-search create failed with `Could not find the 'max_price'
   column of 'saved_searches' in the schema cache`.** The May 8
   migration `2026-05-08_saved_searches_price_filters.sql` had never
   been applied to prod even though the JS has been writing
   `min_price` / `max_price` for two days. Classic "JS ahead of
   migration" — the exact trap pinned in CLAUDE.md "Things to never
   do." Applied via Supabase MCP + bumped PostgREST cache. Mark
   confirmed save-without-price works.
2. **All image loads slow.** Vercel Blob image cache had been
   silently failing on every cron run: the cache script uploads
   with `access: "public"` but the Blob store was configured for
   **private** access — every upload rejected with "Cannot use
   public access on a private store." DB confirmed: **0 of 274
   hearts and 0 of 92 listing-backed `collection_items` had a
   cached image URL.** Fix required Mark dashboard-side (store
   access mode is immutable post-creation): delete + recreate as
   public, rotate token in GH Actions. **At handoff: token rotation
   in flight; new public store created, GH Actions secret updated,
   workflow rerun.** Verify cache_watchlist_images.mjs no longer
   errors on next run and `cached_img_url` columns start filling.

### What shipped — Part 2 by PR

- **#187 — Clear-filters CTA on no-match empty states.** The bare
  "No watches match your filters" was the most-hit dead-end in the
  app. Wrapped in `<EmptyState/>` with an inline "Clear filters"
  button when `hasFilters` is true. Applied to the Listings card
  grid (App.js) and the Saved sub-tab card grid (WatchlistTab). Also
  threaded `hasFilters` + `resetFilters` props through to
  WatchlistTab.
- **#188 — Loading copy: enthusiast voice.** Generic "Loading
  listings...", "Loading more...", "Loading list…", "Loading
  challenge…" → "Pulling the latest listings…" / "More on the way…"
  variants. Five surfaces: App.js cold-load + scroll-loader +
  load-error, ListReceiver, ChallengeReceiver, ManageListSheet.
  Admin-only "Loading…" strings left as-is (out of scope).
- **#189 — window.alert + naked Error: strings → inline status.**
  Four flows: share-a-list (ephemeral "Link copied — paste
  anywhere" chip with 2s auto-clear), local-data import (inline
  danger message under the import buttons), create-challenge
  failure (red banner at top of CreateStage), SettingsModal
  display-name save ("Error: <msg>" → "Didn't save — <msg>").
  Sign-in alert (rare OAuth failure path) left for a follow-up.
- **#190 — Design tokens + radii snap.** Added `--brand-tint-08 /
  -10 / -12` and `--accent-warn` (#c9a227 gold) CSS variables to
  both light + dark themes in App.js. Replaced 18 inline literals:
  6× `rgba(24,95,165,…)` → `var(--brand-tint-*)` across
  ListReceiver / ReferencesTab / CollectionPickerModal /
  ChallengesView / CollectionsTab; 12× `#c9a227` →
  `var(--accent-warn)` across AdminTab / ChallengesView /
  ChallengeFlow. `borderRadius: 16 → 14` snap on AdminTab (×3) +
  LotMigrationBanner. `strokeWidth="2.2" → "2"` on the
  reactions-trigger icon.
- **#191 — Doc rot.** README App.js line count `~1,470 → ~2,900`
  (actual 2,908). Removed `useEBaySearches` from both README's
  hooks list and folder-layout diagram (deleted PR #181). Removed
  `EndingSoon.js` from README folder-layout diagram (deleted PR
  #36). Updated CLAUDE.md architecture quick reference to drop
  `useEBaySearches`. Replaced CLAUDE.md's stale `WishlistRankedList`
  description with the post-#170 reality (renders via
  `MyCollectionView` with the wishlist as the Shortlist source).
- **#192 — Actually block anon from 3 signed-in-only SECURITY
  DEFINER RPCs.** The May 10 reactions / member-roster / reaction-
  counts migrations each tried `revoke execute from anon` but that
  was a no-op on the current Supabase platform: the function ACL
  grants EXECUTE to PUBLIC (everyone, including anon via
  inheritance), not to anon directly. Discovered when
  `has_function_privilege('anon', …)` kept returning true even
  after re-running the original revoke. Fix: `revoke from public`
  instead; authenticated keeps its direct grant. **CLAUDE.md
  "Supabase public schema default ACL gotcha" section corrected**
  to describe current behavior — old text described an earlier
  platform version's per-role direct grants. Three RPCs revoked:
  `list_item_reactions`, `list_members_for_collection`,
  `list_reaction_counts_for_user`. Verified anon=false post-apply.
- **#193 — Remove unused `importLocalData` import.** App.js:2
  destructured it from `./supabase` but never called it
  (WatchlistTab is the real consumer). One-line cleanup.
- **#194 — Empty-state polish round 2.** Four more bare strings
  warmed: ShortlistPickerSection (CollectionsTab) chosen-list
  empty, ListReceiver shared-list-empty ("Nothing in this list
  yet — the owner hasn't added any watches."), Links section
  accordion ("Nothing curated here yet — check back as the section
  grows."), ListingPickerModal Favorites/All/List no-match (now
  uses `<EmptyState/>` with source-specific blurbs).
- **#195 — RLS performance: `auth.uid()` → `(select auth.uid())`
  sweep.** Supabase advisor flagged 26 policies with the
  `auth_rls_initplan` warning — calls to `auth.uid()` /
  `auth.email()` were being re-evaluated per row instead of once
  per query. Wrapped each call in a SELECT subquery so Postgres
  treats it as an InitPlan. **30 policies dropped + recreated
  across 11 tables**: watchlist_items (4), hidden_listings (3),
  saved_searches (4), tracked_lots (3), user_settings (3),
  user_limits (1), collections (3), collection_items (2 —
  multi-auth.uid quals), collection_collaborators (1 —
  `auth.uid()` + `auth.email()`), collection_item_comments (3),
  collection_item_reactions (2), user_profiles (2). Post-apply
  advisor scan: the `auth_rls_initplan` category is fully clean
  (was 26, now 0).
- **#196 — Covering indexes on 7 unindexed FKs.** Supabase advisor
  `unindexed_foreign_keys` flagged seven. Most immediately useful:
  `collection_items.who_added` (drives the attribution chip on
  every shared-list render). Plus admin_hidden_listings.hidden_by,
  collection_collaborators.invited_by, collection_item_comments
  .user_id, collection_item_reactions.user_id, listing_events
  .user_id, user_limits.updated_by. All idempotent
  `CREATE INDEX IF NOT EXISTS`.

### SQL migrations applied this session (all via MCP)

1. `2026-05-08_saved_searches_price_filters.sql` — backfill of the
   already-committed May 8 migration that never reached prod.
2. `2026-05-10_revoke_anon_signed_in_rpcs.sql` — the actually-effective
   anon revoke (revoke from PUBLIC).
3. `2026-05-10_rls_initplan_perf.sql` — 30 policy rewrites for the
   auth.uid() InitPlan wrapping.
4. `2026-05-10_fk_covering_indexes.sql` — 7 covering indexes.

### Things to know for next session — Part 2 additions

- **`(select auth.uid())` is now the only acceptable pattern in new
  RLS policies.** Bare `auth.uid()` in `using` / `with check` gets
  flagged by the advisor and re-evaluates per row. CLAUDE.md
  "Things to never do" should probably get a pin for this if
  another RLS policy lands.
- **Supabase ACL gotcha is updated in CLAUDE.md.** The old advice
  (`revoke execute from anon` to block anon access) is wrong on the
  current platform. Use `revoke execute from public` instead.
- **Blob store config caveat.** Vercel Blob's access mode (public
  vs private) is **immutable post-creation**. If a store gets
  recreated, the GH Actions `BLOB_READ_WRITE_TOKEN` secret has to
  be rotated to match the new store's token — Vercel won't auto-
  sync that one (only the project env var).
- **Saved-search field is properly nullable end-to-end now.**
  `min_price` / `max_price` are nullable in DB, JS already passes
  `null` when blank. The "could not find max_price column" error
  was the missing migration, not a JS bug.
- **Discovery report**: `~30 advisor warnings cleared` across the
  RLS perf sweep + FK indexes + anon revoke. Remaining advisor
  warnings (intentionally not in scope): 5 unused indexes (low
  signal — might light up later), 8 `multiple_permissive_policies`
  on `admin_hidden_listings` + `user_limits` (admin-table cleanup
  candidate), 1 `auth_leaked_password_protection` (one-click
  Vercel dashboard setting).

### Open carry-overs — Part 2

- **Render-without-crash tests** for ReferencesTab, AdminTab,
  AuctionCalendar, Card. Each is a top-level surface where a TDZ
  regression would white-screen. Pattern is already established
  by `App.test.jsx` / `CollectionsTab.test.jsx`.
- **"Saving…" copy sweep** deferred from #188 (6+ surfaces). Same
  pattern as the loading-copy work.
- **`multiple_permissive_policies` consolidation** on
  `admin_hidden_listings` + `user_limits` — slightly trickier
  because it requires merging "Admins manage X" + "Anyone select
  X" into one policy without losing either gate.
- **Unused index drop** — wait another 30 days of observation;
  some may light up after the next AdminTab usage spike.
- **Vercel Auth leaked-password protection** — one click; not done
  in this session because it's a dashboard setting not a code
  change.
- **Blob token rotation verification** — still in flight as of
  handoff; new public store should now be receiving uploads.
