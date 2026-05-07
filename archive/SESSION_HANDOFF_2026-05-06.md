# Watchlist — Session Handoff (2026-05-06)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — the durable rules graduate to CLAUDE.md, the durable plans
graduate to ROADMAP.md.

## TL;DR

Marathon day. **Forty-four PRs (#57 → #100)**, all merged. Production
current. Bundle hash floats with each Vercel deploy. The day arc:

1. **Morning** (#57 → #76) — Listings divider count fix; site
   analytics user stats half + source stats extensions; user limits;
   shared-link landing surface (5 iterations); dynamic OG preview;
   Watch Challenges polish (D1→D4).
2. **Afternoon** (#77 → #81) — EOD docs round 1; Watch Challenges
   v1.5 receive flow; eBay TAG Heuer filter; D5 polish; admin-hide
   global blocklist.
3. **Evening / late night** (#82 → #100) — **Collections build**
   (six PRs: hard system lists, top-level tab, manual entry, archive
   picker, wishlist rank, sender attribution); saved-search count
   fix; UI fixes bundle; **auction-scrape coverage rebuild** for the
   May 9–10 Geneva sales (Christie's pagination, Sotheby's apolloCache
   lotCards, Phillips Turbo-Stream — none of the four houses at ≤50%
   capture anymore); listings divider dedup; browser back/forward
   parity; lot-number catalog-sort pill; Collections four-sub-tab
   restructure; ROADMAP refresh.

See **Continuation — afternoon work** + **Continuation — evening /
late night** below.

The session arc, plain English:

1. **AM polish — Listings divider count.** "Today: 148" actually
   counted backfilled items that sort to the bottom of the list, so
   the count badge at the top didn't match the visible run of cards.
   Fixed by counting the contiguous run in `allFiltered` instead of
   the global bucket total (#57).

2. **Site analytics — User stats half (Epic 8) shipped.** Whole
   demand-side telemetry pipeline: `listing_events` table (insert-
   anon, select-admin via RLS), `listing_events_daily` rollup table,
   `rollup_and_prune_listing_events()` function, `is_admin()` helper,
   anon-UUID-in-localStorage hook, IntersectionObserver view capture,
   click/save/hide/list_add/share wiring, daily GitHub Actions cron,
   AdminTab Engagement columns (Views/CTR/♥/100v/+List/100v/Sh/100v).
   Three follow-ups during the rollout: hotfix #59 for a React #310
   white-screen (one too many useCallback past App.js's loading
   early-return), schema fix #60 to make the rollup table internal
   (RLS-off + RPC-gated reads), and #64 to cast `auth.users.email`
   varchar→text inside `list_user_limits()` so the User-limits
   admin panel actually returned rows. (#58, #59, #60, #64.)

3. **Site analytics — Source stats extensions.** Per-source
   `$ added (30d)` + `$ sold (30d)` columns on the dealer table.
   New "Auction house quality" table covering the 6 houses (4
   lot-level, 2 calendar-only) with Live/Upcoming sales, Lots,
   Sold %, $ sold (90d), median Hammer/Low ratio. Both panels are
   client-side over already-fetched static data — no schema changes.
   (#61.)

4. **User limits (Epic 3) shipped.** 2,500 default cap, soft-warn
   at 80%, hard cap blocked in UI + by a BEFORE INSERT trigger on
   `watchlist_items` as the line of defense. Per-user overrides via
   `user_limits` table; admin grants expansion via the AdminTab
   "User limits" section + an inline `set_watchlist_cap_by_email`
   RPC. Same admin section also surfaces per-user engagement
   (hearts / hides / lists / saved-searches / 30-day clicks/views/
   shares / top saved brand). (#62, #64.)

5. **Shared link landing surface (Epic 4) shipped — five iterations.**
   v1: focused full-width landing card replaces the cramped thumbnail
   that used to sit above an unrelated browse view; left=image,
   right=details + Save/Dismiss + onboarding (#63). v2: tighter
   vertical fit + light-mode card shadow + "Source quality" → "Site
   stats" rename in the user dropdown (#65). v3: mobile fit
   (16:10 image + tighter padding so action buttons stay above the
   fold) (#66). v4: strip browse chrome (filter pills, sub-tabs,
   watch-count) + stronger shadow + wider max for desktop (#67).
   v5: drop the "Shared with you" chip (#69). v6 (separately): copy
   tweak on the "First time on Watchlist?" blurb (#72).

6. **Dynamic OG preview for share links (#70).** New `api/share.js`
   serverless function emits per-listing og:image / og:title for
   share links so iMessage / Slack / Discord rich-link cards show
   the actual watch + a Mark-spec caption ("Watchlist — Vintage
   watches in one feed") instead of the site logo. Vercel rewrites
   `/share/:id` → the function; real browsers redirect to the SPA's
   existing share-receive surface unchanged.

7. **Watch Challenges polish — five iterations (D1 → D4).**
   - **D1 (#73):** Drop description from CreateStage. Comma-format
     budget input. Soft-cap copy ("Soft cap of 20% over budget"
     instead of arithmetic). Skip the Reasoning stage — comments
     fold inline below the slot grid in PickingStage. Stepper drops
     4→3 (Set / Pick / Share). Tighten StageHeader / StatCard /
     slot grid spacing. Empty-state + Card copy refresh. Clearer
     labeled "Delete" button. **Share bug fix** —
     `ChallengeFlow.shareChallenge` was passing `{ title, url }` to
     `handleShare` which returned early without an `item.id`; the
     button silently no-op'd. App.js's `handleShare` now accepts
     either the listing-shape OR a pre-built `{ url, title? }` shape.
   - **A (#71):** Delete button on each challenge row + budget-
     remaining display ("$X spent · $Y left" / "$Z over").
   - **D2 (#74):** Replace search-allListings drawer with a Lists/
     Favorites tile picker — tap a chip (♥ Favorites / each List /
     Paste link) → tile grid below, tap a tile → adds to shortlist.
     URL paste accepts share URL, dealer URL, or 12-char ID.
   - **D3 (#75):** Wholesale rewrite. **Drop the shortlist
     concept entirely** — Lists/Favorites ARE the shortlist. Tap a
     tile → adds straight as a pick. Drag-drop gone — click-pick
     everywhere. Sticky stat row + boxShadow. Single page-scroll
     (source picker no longer has its own overflow). Single
     challenge-wide note (challenges.descriptionLong) replaces
     per-pick reasoning. Drop SlotPickerModal + ShortlistTile +
     hasFinePointer.
   - **D4 (#76):** Tighter slot photos (4:3 / 110px). Sticky stat
     marginTop fix + soft shadow. "Mark complete" → "Finish".
     CompleteStage redesign — Reopen + Share lifted to the TOP
     above the picks list, polished card-theme with shadow, compact
     pick rows. Share-feedback toast ("Link copied!" / "Shared.")
     so users see the share fired. Drop dart 🎯 emoji. Quick-share
     button on each challenge list row.

Dealer count: **38** (unchanged this session).

## Continuation — afternoon work (PRs #77 → #81)

After the EOD docs landed (#77), the afternoon picked up four
sharp-edges items:

1. **Watch Challenges v1.5 — receive flow (#78).** The original "next
   session" #1 priority shipped same-day. Pasting a challenge share
   link landed on the home page because the SPA didn't parse
   `?newchallenge=…&t=…&n=…&b=…`. New `ChallengeReceiver` component
   detects both share shapes on mount:
   - **Spec link** (`?newchallenge=1&t=&n=&b=`) → orientation card
     "Mark sent you a challenge: 3 watches for $50k. Take it on?"
     with **Take this challenge** (drills into the Cool-Stuff
     challenges view + creates a draft with the same constraints) +
     **Dismiss** + sign-in CTA.
   - **Complete link** (`?challenge=<uuid>&shared=1`) → read-only
     view of the picks via the new `get_public_challenge` security-
     definer RPC, gated by `state='complete'` inside the function so
     drafts can't leak.
   ChallengeFlow's two share buttons map to the two modes —
   "Share the challenge" (spec) before completion, "Share my
   collection" (complete) after. Both surface a copy-feedback toast.

2. **eBay scrape — TAG Heuer title exclusion (#79).** Mark wired the
   Autavia GMT eBay search to "Heuer" only and was getting modern TAG
   Heuer hits in the feed. Title-level filter at scrape time:
   `\btag[\s\-]*heuer\b` (case-insensitive). Per-search counter logs
   the drop count so future false-positives are visible. Filter is
   purely scrape-time; doesn't touch existing rows.

3. **Watch Challenges D5 — copy + escape + drill + sign-in (#80).**
   Five small but cumulative fixes on top of #78:
   - **Copy:** "Share my picks" → "Share my collection"; "Share
     constraints" → "Share the challenge".
   - **Escape from share-receive:** clicking the Watchlist logo or a
     main tab from the receive surfaces now actually leaves. New
     `setTabWithReceiveEscape` wrapper deletes the share params from
     the URL, drops both `shareActive` flags, and bumps a
     `shareReceiveResetTick` counter that ShareReceiver +
     ChallengeReceiver watch as a reset signal.
   - **Take-this-challenge drill-in:** ChallengeReceiver lifts a
     `pendingChallengeDrillId` up to App.js → ReferencesTab →
     ChallengesView, which auto-selects the new draft so the user
     lands on the picking page instead of the challenges list.
   - **Sign-in CTA:** OrientationAnchors got an `onSignIn` prop so
     the receive cards can trigger the auth modal without re-routing.
   - **Mobile chrome:** dropped a leftover blue "Shared with you"
     chip on small screens for breathing room.

4. **Admin-hide as global blocklist (#81).** Mark's framing: "I still
   want my hidden items to be deleted rather than just hidden — me.
   as the taste maker I'm fine with. prefer to have good quality
   stock." Per-user `hidden_listings` stays as-is; new global
   `admin_hidden_listings` table mirrors the per-user shape but is
   admin-write / anyone-read. When an admin user (Mark) hides via
   the Card "..." menu, the listing is also added to the global set
   and `mainFeedItems` filters by it for **every** user (signed-in,
   anonymous, admin alike). Schema:
   `supabase/schema/2026-05-06_admin_hidden_listings.sql`. Hook:
   `useAdminHidden` in `src/supabase.js`. Admin gating reuses the
   existing `is_admin()` helper. Rollback is one row delete from
   the SQL editor; the per-user hide row is preserved alongside.

After #81 Mark flagged two new items as next-session work — sign-in
CTA prominence + saved challenges with sender's name. Both ended up
shipping the same day (see continuation below); the actual roll-over
work is now what's at the top of **Next session**.

## Continuation — evening / late night (PRs #82 → #100)

After #81 Mark merged the EOD-docs PR (#77 was the prior continuation)
and pivoted to a wider plan: **"this is the time to build out the
collections feature."** The 19 PRs from this block are dominated by
the Collections build, plus three other arcs that came up during /
after it.

### Collections build (PRs #85 → #90)

Mark's locked plan: "everything is a list." Four kinds — Owned, Sold,
Wishlist, Challenges — surfaced together under a new top-level
**Collections** tab. Six PRs in sequence:

- **#85 Schema + hook** — `is_system` flag on `collections` +
  `prevent_system_collection_delete` BEFORE-DELETE trigger
  (defense-in-depth so even an accidental DELETE on a hard list
  fails). Three hard lists (Owned/Sold/Wishlist) auto-create per
  user via the `useCollections` first-load effect, with a lazy
  retry if the auto-create fails (Mark hit this — the SQL hadn't
  been run yet, hook silently warned; running the migration after
  the fact let the next page-load fix everything).
- **#86 Top-level Collections tab + nav restructure** —
  `TAB_VALUES` gains `"collections"`. Migration: old
  `?tab=watchlist&sub=collections` redirects to `?tab=collections`.
  WatchlistTab drops the Lists sub-tab; ReferencesTab drops the
  Watch Challenges resource. Mobile bottom-bar grows from 2 → 3
  pills (Listings / Watchlist / Collections).
- **#87 Manual entry + photo upload** — `is_manual` boolean +
  `manual_*` columns on `collection_items` (nullable on every row;
  check constraint requires `listing_id IS NOT NULL OR is_manual`).
  New `watch-photos` Supabase Storage bucket with RLS per-user
  folders (`{auth.uid}/{random}.jpg`). Client-side canvas resize
  to 1600px JPEG q0.85 (5–10× cut on phone photos). Slim
  `ManualItemCard` for items without a dealer URL.
- **#88 Archive picker + Owned→Sold transition** — new
  `ListingPickerModal` (Favorites / All listings / each user list
  / Paste link). New `MarkAsSoldModal` captures sold price + sold
  date. `markItemAsSold` mutator UPDATEs `collection_id` + the
  manual_sold_* columns in one shot — preserves snapshot + savedAt
  + rowId. Card extended with optional `extraMenuItems` so the
  "..." menu can carry "Mark sold" without Card knowing about
  collection semantics.
- **#89 Wishlist force-rank** — `position` integer column on
  `collection_items` + composite index. New `WishlistRankedList`
  vertical-list render with rank number + ↑/↓ controls per row +
  remove ×. Optimistic local update on swap; parallel UPDATEs
  persist. Tap-based controls (no drag-drop) for cross-device
  parity with the challenges D3 model.
- **#90 Saved challenges with sender's name** — `sender_name`
  column on `collections`. Spec link appends `&from=<senderName>`;
  `createChallenge` accepts `senderName` and labels the saved draft
  "James's 3 watches for $50k". ChallengesView splits into
  **Sent to you** + **Yours** sections + adds a small `from <name>`
  attribution chip per row.

### Auction-scrape coverage rebuild (PRs #93, #94, #100)

Mark flagged that all four auction houses were undercapturing for
the upcoming **May 9–10 Geneva sales** (Phillips CH080226, Christie's
31080, Sotheby's GE2601 + GE2611). Three PRs landed full coverage:

- **#93 Christie's pagination + Phillips WAF backoff (first attempt).**
  Christie's auction page only embedded ~80 lots; switched to their
  `lot_search` paginated REST API which exposes the full set.
  Phillips got per-lot retry-with-backoff to dodge their WAF. (The
  Phillips approach didn't break through in practice — see #100.)
- **#94 Sotheby's full enumeration via apolloCache lotCards.** The
  algoliaJson SSR endpoint hardcodes `page=0` server-side, so we
  could only ever see the first 48 lots. Workaround: each Sotheby's
  lot page's `__NEXT_DATA__.props.pageProps.apolloCache` ships a
  full Auction object whose `lotCards` field has every lot in the
  sale. Two-pass strategy: fetch the auction page → get one slug
  via algoliaJson → fetch that lot page → harvest lotCards (151+
  lots) → for each lot, per-lot fetch grabs estimateV2 + media +
  description from its own LotV2 in apolloCache. UTF-8 unpacked
  via `Amount` object (`{__typename: "Amount", amount: "55000"}`).
- **#100 Phillips Turbo-Stream payload (the one that worked).**
  WAF backoff from #93 didn't break through Phillips' edge — only
  6 of 225 lots got captured on the next CI run. Pivot: parse the
  React Router 7 / Remix v3 Turbo-Stream payload that's INLINE in
  the auction-page response. Multiple `streamController.enqueue("…")`
  chunks deliver a flat JSON array using
  `{"_K_idx": V_idx}` references; resolve the graph and the
  auction object's `lots[]` field is every lot with title +
  estimates + image + status + lot_number — everything per-lot
  fetches were returning, in **one** request that the WAF doesn't
  block. Live result: 6 → 224 lots. UTF-8 fixed by re-parsing
  chunks via `json.loads('"' + c + '"')` instead of
  `encode/decode("unicode_escape")` (which mangles multi-byte
  characters; verified Élégante → Ã‰lÃ©gante before the fix).

Final coverage check post-#100 (live data):
- Antiquorum: 540 lots ✓
- Christie's: 226 lots ✓
- Sotheby's: 324 lots ✓ (was 94 before #94)
- Phillips: ~224 lots ✓ (was 6 before #100)

### Other evening work (PRs #82, #91, #92, #95, #96, #97, #98, #99)

- **#82 EOD docs continuation** — extension of the morning's
  handoff doc covering #77–#81.
- **#91 Saved-search count + sub-tab match** — Mark's report:
  saved search showed "17 for sale" but tapping landed on a view
  with 3 results. Two compounding bugs: (a) count computed off
  `items.filter(!sold)` (dealers) but `runSearch` didn't reset
  `listingsSubTab`, so a user on Live auctions saw 3 auction
  matches with the count reflecting dealer-side matches; (b) the
  count omitted the hidden filter. Fix: `runSearch` now also
  `setListingsSubTab("live")` and the count filter adds
  `!hidden[i.id]`.
- **#92 UI fixes bundle** — three small reports:
  - HardListRow image strip rendered ~1900px on desktop with one
    item (`flex:1 + aspectRatio:1/1`). Switched to fixed 64×64
    thumbnails.
  - `ListingPickerModal` source chips were vertically clipped via
    `overflowX:auto`'s implicit Y-clipping in some browsers.
    Switched to `flexWrap:wrap + flexShrink:0` — no scroll, no
    clipping.
  - Restored Share + Delete on challenges list rows (had been
    removed in PR #84). Done by extending `ListRow` with an
    optional `actions` prop. Outer flips from `<button>` to
    `<div role="button">` when actions are present (nested
    `<button>`s would be invalid HTML).
- **#95 Listings divider dedup** — Mark saw two "Last week"
  dividers stacked at top. Root cause: `allFiltered` puts
  non-backfilled items first, backfilled second; both subsections
  bucket by the same date labels, so when each section starts in
  "Last week" you get two consecutive same-name dividers. Fix:
  return a single "Earlier additions" label for every backfilled
  item regardless of date. Non-backfilled section keeps its
  natural date dividers; backfilled all collapse under one header.
- **#96 Browser back/forward parity** — every URL writer used
  `history.replaceState`, so the browser stack only had one
  Watchlist entry; back jumped straight to whatever opened
  Watchlist. New shape: `pushState` on real navigations (tab,
  sub-tab, drill-in change after first mount) + a `popstate`
  listener that re-derives state from URL. Both App.js and
  CollectionsTab follow the same `useRef(prev) + useRef(isFirst)`
  pattern. Other writers (ShareReceiver / ChallengeReceiver /
  setTabWithReceiveEscape) stay on `replaceState` — they're URL
  cleanup, not navigations.
- **#97 ROADMAP refresh** — Privacy notice section added under
  Epic 0; user-feedback / bug-report surface parked under Epic 0
  in response to Mark's question "is there a place to put a bug
  report on pages?"; today's progress captured in the update log
  + Epic 3 Collections refactor section + Epic 6 Watch Challenges
  v1.5 marked shipped; priority order rewritten.
- **#98 Lot # sort pill (catalog order)** — Mark's lot-number
  question. New sort value `"lot"` + a third pill rendered on
  Listings > Live auctions and Watchlist > Saved auctions only.
  Sort dispatch groups by `auction_url` then ascending
  `lot_number`. Toggles between `sort="lot"` and `sort="date"`.
- **#99 Collections four-sub-tab restructure** — Mark's request
  after living with #86's stacked-index design for an hour. New
  structure: **My collection** (Owned/Sold/All toggle, single
  grid, no drill-in) / **Wishlist** (standalone ranked list) /
  **Lists** (user lists + shared inbox + Hidden synthetic) /
  **Challenges** (delegates to ChallengesView). New
  `collectionsSubTab` state + `?sub=` URL sync + `localStorage`
  persistence. CollectionsTab fully rewritten as a sub-tab
  dispatcher.

## What shipped (in order)

```
[2026-05-06 evening / late night]
PR #100 Auction lots: full Phillips enumeration via Turbo-Stream (6 → 224 lots)
PR #99  Collections: four sub-tabs (My collection / Wishlist / Lists / Challenges)
PR #98  Sort: Lot # pill on auction sub-tabs (catalog order)
PR #97  ROADMAP: capture Collections build + privacy notice + refresh priorities
PR #96  Browser back/forward parity: pushState + popstate listener
PR #95  Listings dividers: collapse backfilled under "Earlier additions"
PR #94  Auction lots: full Sotheby's enumeration via apolloCache lotCards (94 → 324)
PR #93  Auction lots: Christie's full pagination + Phillips WAF backoff
PR #92  Collections UI: HardListRow image / picker chips / share+delete restore
PR #91  Saved searches: count + sub-tab match what the user sees on tap
PR #90  Collections: saved challenges with sender's name
PR #89  Collections: Wishlist force-rank with ↑/↓ controls
PR #88  Collections: archive-listing picker + Owned→Sold transition
PR #87  Collections: manual entry form + photo upload (Owned/Sold)
PR #86  Collections: top-level tab + nav restructure
PR #85  Collections: schema + hook for hard system lists (Owned/Sold/Wishlist)
PR #82  SESSION_HANDOFF: extend 2026-05-06 with afternoon PRs (#77–#81)

[2026-05-06 afternoon]
PR #81  Admin-hide: taste-maker hides drop the listing globally
PR #80  Watch Challenges D5 — copy + escape + drill + sign-in
PR #79  eBay: filter TAG Heuer at scrape time (keep vintage Heuer)
PR #78  Watch Challenges v1.5 — receive flow + dual share modes
PR #77  EOD docs: 2026-05-06 session handoff + ROADMAP/CLAUDE.md/README

[2026-05-06 morning]
PR #76  Watch Challenges D4 — tighter photos, share fixes, list-row share
PR #75  Watch Challenges D3 — drop shortlist, click-pick, sticky stat
PR #74  Watch Challenges D2 — Lists/Favorites picker + URL paste
PR #73  Watch Challenges D1 — simplify create, fold notes inline, fix share
PR #72  Share landing: copy update on the orientation block
PR #71  Watch Challenges A — delete + budget remaining
PR #70  Dynamic OG preview for share links
PR #69  Share landing: drop "Shared with you" chip
PR #68  Watch Challenges: top-5 UX polish
PR #67  Share landing: strip browse chrome + stronger shadow + wider max
PR #66  Share landing: tighten mobile layout (actions above fold)
PR #65  Share landing tweaks + rename admin dropdown ("Site stats")
PR #64  Schema fix: cast email + brand to text in list_user_limits RPC
PR #63  Share-receive landing surface — focused full-page redesign
PR #62  User limits (Epic 3) — cap, banner, admin user-management
PR #61  Source stats extensions — throughput + auction-house dashboard
PR #60  Schema fix: listing_events_daily becomes internal
PR #59  Hotfix: drop useCallback that triggered React #310 white screen
PR #58  Site analytics — User stats half v1 (Epic 8)
PR #57  Fix Listings date-divider count (run length, not bucket total)
```

## Architecture notes added this session

- **Listing events telemetry (Epic 8 — User stats half).** Six event
  types written to `listing_events` from the frontend:
  `view` / `click` / `save` / `hide` / `list_add` / `share`. Anon
  UUID per browser in `localStorage` at key `dial_watch_anon_id`
  (don't bump). Reads gated by `is_admin()` against an
  `admin_emails` table seeded from the SQL editor. Daily rollup at
  09:15 UTC (`.github/workflows/rollup-events.yml`); raw events
  pruned past 90 days; admin queries hit the rollup via
  `source_engagement_summary`. Telemetry is fire-and-forget — never
  await `recordEvent`, never surface errors. View dedup is
  module-scoped per page-load. Schema:
  `supabase/schema/2026-05-05_listing_events.sql`. Hook:
  `src/hooks/useEventTelemetry.js`. Graduated to CLAUDE.md.
- **listing_events_daily is internal-only.** RLS off; direct table
  access REVOKE'd from anon/authenticated; the only client read
  path is `source_engagement_summary` (security definer with an
  explicit `is_admin()` guard). Fixed during the rollout — original
  RLS-with-only-SELECT-policy quietly blocked the rollup function's
  inserts because the SQL-editor role didn't bypass RLS.
- **User limits (Epic 3).** Default cap 2,500. Per-user overrides
  in `user_limits` (admin-only mutate). BEFORE INSERT trigger
  `enforce_watchlist_cap` on `watchlist_items` is the defense if
  the JS check is bypassed. `set_watchlist_cap_by_email` admin-only
  RPC + `list_user_limits` admin-only RPC for the dashboard.
  Schema: `supabase/schema/2026-05-06_user_limits.sql`. Hook:
  `src/hooks/useUserLimit.js`. Banner:
  `src/components/UserLimitBanner.js`. Graduated to CLAUDE.md.
- **Share URL format.** Outbound share links built by
  `handleShare` use the `/share/<id>` path. Vercel rewrites that
  to `api/share.js` which emits per-listing OG tags + a meta-
  refresh + JS redirect to `?listing=<id>&shared=1` on the root.
  Real browsers land on the SPA's share-receive surface unchanged;
  preview-bots stop after the head-scrape and never see the
  redirect. Older `?listing=&shared=1` links still work — the
  receiver still parses them — they just don't get dynamic OG.
  Graduated to CLAUDE.md.
- **Share-receive landing surface.** ShareReceiver mirrors a
  one-bit `shareActive` flag up to App.js via `setShareActive`.
  When true, both shells skip the regular tab content + filter
  pills + sub-tabs + watch count + sort row — the focused landing
  surface takes over the main content area. ShareReceiver itself
  owns all share-related hooks (the v3 isolation pattern after
  v2's React #310 in production). Graduated to CLAUDE.md.
- **handleShare accepts two shapes.** Listing share (existing
  callers): pass the item, URL is built as `/share/<id>`. Pre-
  built share (challenges, future): pass `{ url, title? }` with the
  URL already constructed. Without this, ChallengeFlow's
  `shareChallenge` was no-opping because `handleShare` rejected
  payloads without an `id`.
- **Watch Challenges D3 paradigm shift.** No more shortlist —
  Lists / Favorites are the source. Click-pick everywhere (no
  drag-drop). Sticky stat row + single page-scroll. Single
  challenge-wide note instead of per-pick reasoning. The supabase
  helper `addToShortlist` gained an `{ isPick: true }` opt that
  inserts straight as a pick + snapshots price.
- **Challenge share — two modes.** Outbound share is dual-mode:
  spec links (`?newchallenge=1&t=&n=&b=`) carry the constraints so a
  recipient can take the same challenge on a fresh draft; complete
  links (`?challenge=<uuid>&shared=1`) carry a finished collection
  for read-only viewing via `get_public_challenge` (security definer,
  state='complete' gate inside the function). ChallengeReceiver
  parses both shapes on mount and renders matching orientation
  cards; the receive surface is gated by `challengeShareActive`
  the same way listing share is gated by `shareActive`.
- **`setTabWithReceiveEscape` + `shareReceiveResetTick`.** The
  escape-hatch pattern when a user clicks the logo or a main tab
  from a share-receive surface. App.js's wrapper deletes share
  params from the URL, drops both `shareActive` and
  `challengeShareActive`, and bumps a counter that ShareReceiver +
  ChallengeReceiver watch via a `resetTick` prop to clear their
  internal `shareIntent` state. Cleaner than lifting receiver intent
  up to App.js, which would have grown the App.js hook list past
  the loading-early-return line and re-triggered React #310.
- **Admin-hide as global blocklist.** New `admin_hidden_listings`
  table — admin-write, anyone-read. When an admin (Mark) hides via
  the Card "..." menu, the listing is also added to the global set
  and `mainFeedItems` filters by it for every user. Per-user
  `hidden_listings` stays untouched; the two writes happen in
  parallel. `useAdminHidden` hook in `src/supabase.js` exposes the
  Set + a `toggleAdminHidden` mutator that's a no-op for non-admins.
  Schema: `supabase/schema/2026-05-06_admin_hidden_listings.sql`.
- **Title-level scrape exclusions can ride past `\b…\b`.** The eBay
  TAG Heuer filter (`\btag[\s\-]*heuer\b`) is the second instance of
  this pattern (after `is_excluded_title` for auction lots). When
  adding a new title-pattern exclusion, log the drop count per run
  so false-positives surface — a silent `continue` is invisible
  until someone notices a watch they expected isn't there.

## Open PRs

**None.** Everything from today is merged. Stale branches
auto-cleaned post-merge.

## Open user-reported issues — afternoon additions

- ✓ Pasted challenge share link landed on home page → #78 receive
  flow.
- ✓ eBay Heuer search returning modern TAG Heuer hits → #79 title
  filter.
- ✓ "Share my picks" / "Share constraints" copy unclear → #80.
- ✓ Couldn't escape from share-receive by clicking logo / main tab →
  #80 `setTabWithReceiveEscape`.
- ✓ "Take this challenge" didn't drill into the new draft → #80.
- ✓ Mark wanted hidden items dropped globally as taste-maker → #81.

Two new items flagged at end of session, queued for next session:

- **Sign-in CTA prominence on share-receive surfaces.** The
  orientation card on both listing-share and challenge-share receive
  views currently leads with "First time on Watchlist?" with a
  smaller "Or sign in to your account →" link below. Mark wants the
  sign-in option more prominent, with copy that explains what it
  unlocks: "Sign in here (to add searches, complete challenge etc.)".
  The change has to handle both first-timer and returning-user
  receive surfaces without forcing a binary either/or — both options
  should be visible.
- **Saved-challenges with sender's name + section.** When a recipient
  takes a shared challenge, save it labeled with the sender ("James's
  3 watch collection for $50k"). Build a saved-challenges section
  surfacing: the original challenge, the recipient's completion, and
  any responses friends sent back. Touches schema (sender_name on
  the draft, response-back relation), the receive flow's "Take this
  challenge" branch (capture sender), and ChallengesView (new
  section grouping). Multi-PR.

## Open user-reported issues — all resolved this morning

- ✓ Listings count badge "148 today" miscounted backfilled items →
  contiguous-run count (#57).
- ✓ Site analytics not capturing demand → User stats half pipeline
  (#58, #60, #64).
- ✓ React #310 white screen on Production from PR #58 → hotfix
  #59 (replaced useCallback with plain function past loading
  early-return).
- ✓ User-limit admin panel showed 0 users despite 2 having data →
  schema fix #64 (text cast on auth.users.email).
- ✓ User-limit admin panel email typo (`gmail,com`) → Mark fixed
  via SQL editor.
- ✓ Source stats lacked $ throughput → #61.
- ✓ Auction house quality not surfaced → #61.
- ✓ Share landing "looks like one square not really fitting on the
  page" → #63 redesign + #65/#66/#67 tweaks.
- ✓ Share preview on iMessage showed site logo instead of watch →
  #70 dynamic OG.
- ✓ Watch Challenges UX audit → #68 (5 fixes).
- ✓ Watch Challenges share button doesn't work → #73 handleShare
  accepts `{ url, title }`; #76 adds visible toast feedback.
- ✓ Test challenge couldn't be deleted → #71.
- ✓ Budget remaining not shown → #71.
- ✓ Search-allListings drawer images tiny + can't see → #74
  Lists/Favorites picker.
- ✓ Two competing scrolls on the picking page → #75 single page
  scroll.
- ✓ Drag-drop didn't work well on mobile → #75 click-pick
  everywhere.
- ✓ Per-pick reasoning felt like too many steps → #75 single
  challenge-wide note.
- ✓ Photos too big in picking → #76 (slot 4:3 / 110px, source
  tile minmax 80).
- ✓ "Mark complete" wording → "Finish" (#76).
- ✓ Reopen + Share buttons buried at the bottom of CompleteStage
  → top of card (#76).
- ✓ Dart 🎯 emoji → dropped (#76).
- ✓ No quick-share from the challenges list → row Share button (#76).

## Doc files updated this session

- **CLAUDE.md** — new durable sections graduated:
  - "Listing events telemetry" + Things-to-never-do entries
    (don't bump `dial_watch_anon_id`, don't await `recordEvent`,
    don't query raw `listing_events` from the dashboard).
  - "User limits".
  - "Share URL format" rewrite for `/share/<id>` + `api/share.js`.
  - "Share-receive landing surface" architecture note.
  - "Admin tab" updated for the "Site stats" rename.
- **ROADMAP.md** — Site analytics user stats + source stats both
  shipped + reordered priorities. User limits shipped. Watch
  Challenges polish items shipped. Image cache for Lists promoted.
- **README.md** — minor; dealer count unchanged at 38.
- **archive/SESSION_HANDOFF_2026-05-05.md** — yesterday's handoff
  archived. This doc replaces it.

## Next session

Refreshed end-of-evening — both the morning's top items (sign-in
CTA, saved challenges with sender) shipped today via PRs #80 + #90,
and the entire Collections build slotted in around them. New top of
the queue:

1. **Welcome page + og:image (Epic 0).** First-impression page for
   non-share visitors. og:image still the 1024×1024 apple-touch-icon
   placeholder. Half-session.
2. **Privacy notice + minimal terms (Epic 0).** Added to the
   roadmap during today's #97 update. Becomes load-bearing before
   Watchlist gets shared with users outside Mark's circle. One-pager
   `/privacy` + companion `/terms`, linked from the user-dropdown
   footer.
3. **References as first-class entities (Epic 0).** Big substrate
   work; gates Epic 5 (encyclopedia) + Epic 7 (recommender).
   Multi-session.
4. **Image cache for List items (Epic 3).** Extend
   `cache_watchlist_images.mjs` to cover `collection_items` rows.
   Promoted by Mark earlier in the day; deferred through the
   Collections build.
5. **Strength-of-save model (Epic 3 + 7).** Two-tier hearts.
6. **Source pruning at 50-dealer threshold (Epic 1 Stop rule).**
   Currently at 38.
7. **"Save this collection back" — child-challenge linkage (Epic 6).**
   When a friend shares THEIR completion of MY challenge back to me,
   I should be able to save it as a child challenge with
   `parent_challenge_id` linkage. Schema column already exists from
   2026-05-03; the receive-side UI to surface "save this collection"
   on the complete-receive page hasn't been built. Closes the social
   loop fully — Mark's "three other friends' solutions sent back to
   you" framing.
8. **Card unification carry-over.** Cool Stuff resource cards still
   need to match Favorites/Lists card style; drop the clip-art icons
   (referenced 2026-05-06 morning, still pending). Cosmetic.

Plus the maintenance-rhythm beat: every 4th-5th session is hygiene
only.

**Strong recommendation: start with #1 (Welcome page + og:image).**
Small, well-scoped, ships in one PR. After today's marathon Mark
should have an easy roll-back-in. The Privacy notice (#2) is the
right second item — same shape (single-page content) and it gets
the legal/compliance baseline in place before any wider sharing.

## Getting started in next session

Read order, top to bottom — should take ~3 minutes:

1. **This file** — you're already in it. The TL;DR + Continuation
   section catch you up to end of 2026-05-06.
2. **[CLAUDE.md](CLAUDE.md)** — durable rules, especially the
   "Things to never do" list. Several rules graduated this session
   (don't-bump anon-id, don't-add-hooks-past-loading-return,
   don't-await-recordEvent, the dual-shape-handleShare pattern).
3. **[ROADMAP.md](ROADMAP.md)** — for direction. The two new
   top-priority items above are reflected there too.
4. **`git log --oneline -15`** — to see today's PRs in the order
   they landed. Skim any PR you want context on via `gh pr view <N>`.

Production state at end of session:
- All 44 PRs merged. No open PRs. No stale branches.
- Vercel green on the latest deploy. Bundle hash floats; verify a
  fresh deploy is serving before claiming any new PR is shipped
  (the `index.html` hash changes per deploy — that's the canary).
- Supabase schema files added today — Mark ran them all via the
  Supabase SQL editor (none need re-running unless you reset the DB):
  - `supabase/schema/2026-05-05_listing_events.sql`
  - `supabase/schema/2026-05-06_user_limits.sql`
  - `supabase/schema/2026-05-06_public_challenge.sql`
  - `supabase/schema/2026-05-06_admin_hidden_listings.sql`
  - `supabase/schema/2026-05-06_collections_hard_lists.sql` (#85)
  - `supabase/schema/2026-05-06_collection_items_manual.sql` (#87)
  - `supabase/schema/2026-05-06_collection_items_position.sql` (#89)
  - `supabase/schema/2026-05-06_collections_sender_name.sql` (#90)
- Admin gate (`admin_emails` table) is seeded with Mark's email.
  Don't surface admin existence in any user-facing copy.
- **Auction coverage post-#100**: all four houses at full counts
  (Antiquorum 540, Christie's 226, Sotheby's 324, Phillips 224)
  for the May 9-10 Geneva sales. Phillips is no longer
  WAF-blocked — the Turbo-Stream payload pattern means we don't
  hit per-lot detail pages from CI at all.

Immediate verifications before starting work:
- `npm test` (jest single-run) and `pytest` should both be green.
  CI runs both on push, but a local pass before opening a PR
  saves a round-trip.
- Open the site signed-in as Mark, hit Collections (the new
  top-level tab), step through each sub-tab (My collection /
  Wishlist / Lists / Challenges), confirm Owned/Sold/All toggle
  works, +Add controls work, ranked Wishlist controls work, and
  the four-house auction-lot data is visible on Listings > Live
  auctions. That's the smoke test for everything the evening
  shipped — if any step feels broken, flag it before adding new
  code.

Where the queued work is captured:
- Top items — in this file's `## Next session` block above.
- Older items — ROADMAP.md.

Suggested first action of next session: confirm Mark wants to start
with #1 (Welcome page + og:image) — small, well-scoped — rather
than #2 (Privacy notice). Both are single-page content work and
can ship in the same arc.

## Open questions left from this session

- **Mark's "social rethink" memo, partly resolved.** Mid-session
  pivot argued Watch Challenges is fundamentally social (sender
  attribution, recipient responses, response collection). The
  Collections build (#85-#90) materially advanced this — Owned,
  Sold, Wishlist are real now, sender_name on challenges captures
  attribution, parent_challenge_id linkage exists in schema. What
  remains: the "save someone's complete-share back as a child
  challenge nested under my original" UI on the receive surface
  (in next session's queue at #7).
- **Older challenges with shortlist rows in the DB.** D3 dropped
  the shortlist concept; new UI doesn't surface `is_pick=false`
  rows. Existing DB rows from earlier challenges are harmless but
  invisible. One-shot migration if Mark revisits and notices.
- **Phillips per-lot fetches still 403 from CI.** PR #100 sidesteps
  by parsing the auction-page Turbo-Stream payload — works for the
  comprehensive batch scrape. But the tracked-lots flow
  (`auctionlots_scraper.scrape_phillips_lot`) is single-URL and
  user-triggered, so it doesn't hit the WAF the same way (verified
  in the field). If WAF tightens further and starts blocking
  even single-URL fetches, the only option is a different IP
  source (paid scrape proxy, headed Playwright runner).
- **Auction-archive Phillips lots, post-Turbo-Stream.** Old archive
  Phillips sales captured via the per-lot path stayed correct;
  future archive runs should use the same Turbo-Stream extractor
  so they don't hit the 403 wall. Likely one-line change to
  `manual_archive_scraper.py` to call `enumerate_phillips`
  instead of per-lot.

## Things to remember when running with this codebase

CLAUDE.md is the durable rules. Skim it once per session. New rules
this session that graduated:

- **`listing_events` is admin-only-read; mirror RLS when adding
  new admin-only tables.** And don't make the DAILY rollup table
  RLS-gated — gate the RPC instead.
- **Telemetry is fire-and-forget.** Never await `recordEvent`,
  never surface errors. View dedup is module-scoped Set per
  page-load.
- **Don't bump `dial_watch_anon_id` localStorage key.**
- **Don't add new useState/useMemo/useCallback past App.js's
  loading + loadError early-return** (lines ~1330). React #310
  white screen — bitten this session, hotfixed in #59. The rule
  was already in CLAUDE.md; it's in there twice now.
- **`auth.users.email` is `varchar(255)`** — cast to `text`
  explicitly when returning from a `RETURNS TABLE (..., email text)`
  function or Postgres throws 42804.
- **Don't reintroduce shortlist as a separate UI surface in
  challenges.** D3's design is "Lists/Favorites ARE the shortlist".
  Tap-to-pick is the single interaction model.
- **`handleShare` accepts both listing-shape AND pre-built
  `{ url, title? }`.** Don't drop the dual-shape branch — it's the
  share-bug fix from D1.
- **Share landing surface hides browse chrome when
  `shareActive`.** Both shells gate listingsSubTabsJSX,
  watchSubTabsJSX, filter pill row, and watch count on this flag.
- **Two share-active flags now: `shareActive` (listing) +
  `challengeShareActive` (challenge).** Both gate browse chrome the
  same way and both reset via `setTabWithReceiveEscape`. When
  adding a new share-receive surface, mirror the flag pattern; when
  adding a tab-change path, route through `setTabWithReceiveEscape`
  rather than calling `setTab` directly so the URL params get
  cleaned up.
- **Receiver-isolation pattern.** All hooks for a share-receive
  surface live INSIDE the receiver component (ShareReceiver,
  ChallengeReceiver) — App.js only owns the one-bit active flag
  and the optional drill-id lift. This is the v3 fix for React
  #310; lifting receiver intent state up to App.js will re-trigger
  it. Pre-#80 the rule was implicit; it's now an explicit
  architectural commitment.
- **Admin gate via `is_admin()` for any new admin-only mutate.**
  Don't roll your own email check on the client. The
  `admin_emails` seed table + `is_admin()` SQL helper is the
  single source of truth, and BEFORE-INSERT triggers / security-
  definer RPCs are the enforcement layer. (Per-user UI hide via
  a client `isAdmin` flag is fine for affordance, but the DB has
  to mirror the gate.)
