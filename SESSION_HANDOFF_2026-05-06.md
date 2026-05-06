# Watchlist — Session Handoff (2026-05-06)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — the durable rules graduate to CLAUDE.md, the durable plans
graduate to ROADMAP.md.

## TL;DR

Another long day. **Twenty PRs (#57 → #76)**, all merged. Production
current. Bundle hash floats with each Vercel deploy.

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

## What shipped (in order)

```
[2026-05-06]
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

## Open PRs

**None.** Everything from today is merged. Stale branches
auto-cleaned post-merge.

## Open user-reported issues — all resolved this session

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

Top of the priority list, in epic-numbered form:

1. **Watch Challenges v1.5 — receive flow (Epic 6).** The most
   logical next gap. Outbound share is now polished
   (`?newchallenge=1&t=…&n=…&b=…`), but the recipient SPA doesn't
   parse those params. Ship a focused share-receive surface for
   challenges (similar to the listing share-receive landing in
   #63) so the recipient lands on a polished page that says "Mark
   sent you a challenge: 3 watches for $50k. Want to take it on?"
   with options to start a fresh challenge under the same
   constraints, dismiss, or sign in to track. Plus an
   `api/share-challenge.js` for dynamic OG preview, mirroring
   `api/share.js` for listings.

2. **Welcome page + og:image (Epic 0).** First-impression page
   for non-share visitors. Half-session.

3. **References as first-class entities (Epic 0).** Big substrate
   work; gates Epic 5 (encyclopedia) + Epic 7 (recommender).
   Multi-session.

4. **Image cache for List items (Epic 3).** Extend
   `cache_watchlist_images.mjs` to cover `collection_items` rows.
   Soon-ish per Mark.

5. **Strength-of-save model (Epic 3 + 7).** Two-tier hearts.

6. **Source pruning at 50-dealer threshold (Epic 1 Stop rule).**
   Currently at 38; engagement data now flowing so the prune-vs-
   keep decision is data-backed.

Plus the maintenance-rhythm beat: every 4th-5th session is hygiene
only.

**Strong recommendation: start with #1 (Watch Challenges v1.5
receive flow).** Mark put a lot of effort into the picking flow
this session; a recipient-side experience closes the loop. It
also covers the "How do I beat it?" question Mark's wife asked,
which Mark called out as the actual product.

## Open questions left from this session

- **Mark's "social rethink" memo is not yet captured in ROADMAP.**
  His mid-session message argued Watch Challenges is fundamentally
  social (sender attribution, shared-with-me inbox, recipient
  responses, per-challenge response collection) and might re-frame
  as a "Collection Planner" (wishlist → buy → into watchbox). He
  paused that pivot ("forget the collector wishlist thing for the
  moment") and asked for tactical fixes instead — D1 through D4.
  The pivot stays a question for a future session: do we ship the
  social features under "Watch Challenges v2" without re-framing,
  or carry through the Collection Planner re-conception that
  merges Challenges + Watchbox? Holding without action.
- **Older challenges with shortlist rows in the DB.** D3 dropped
  the shortlist concept; the new UI doesn't surface
  `is_pick=false` rows. Existing DB rows from earlier challenges
  are harmless but invisible. Acceptable for a feature in heavy
  iteration; if Mark revisits an old challenge and notices ghost
  data, we can write a one-shot migration.

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
