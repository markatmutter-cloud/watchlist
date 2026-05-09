# Watchlist — Session Handoff (2026-05-09)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — durable rules graduate to CLAUDE.md, durable plans graduate to
ROADMAP.md.

## TL;DR

Mostly an IA + UX session driven by user feedback after the day's
earlier IA pass landed. Shipped: Watchlists tab restructure (Saved →
Watchlists, 4 sub-tabs, Lists default with Saved + Shared-with-me as
permanent virtual lists, drill-in filter row), share-flow rewrite
(Collaboration Link with token-based accept), iOS PWA favicon fix,
auction time-of-day awareness + 4x/day refresh, Realtime live
updates on shared lists, and listing-velocity tracking (per-card
SOLD chip + admin per-source + per-brand cycle columns).

8 PRs merged today (#144–#151), 4 SQL migrations applied via MCP.
Two open: PR #152 (per-brand velocity, stacked on #151) and the
small dead-code cleanup branch.

## What shipped

### Watchlists IA pass (PRs #144–#148)

**#144 — IA restructure**: Tab "Saved" → "Watchlists" (mobile +
desktop). Strip pills now Lists / Favorite searches / Owned Watches /
Challenges (4 pills, default `lists`; old hearted sub-tabs still
work via direct URL for back-compat). Saved virtual list at top of
Lists view (synthetic id `__saved__`, backed by `watchlist_items`,
non-deletable) alongside Shared-with-me. Listings tab heart-filter
chip from prior session is the in-flow alternate to the standalone
Saved sub-tab that got removed.

**#145 — Drill-in filter row**: When drilled into a list, the same
Date / Price / $ Min-Max / Source / Brand pills as the Listings tab
appear and narrow the list contents. Implementation: App.js mirrors
CollectionsTab's drill-in id as a one-bit flag; shells extend their
filter-row gating with `inListsDrillIn`. New `applyDrillInFilters`
helper applies the shell filter values to the items array.

**#146 — Polish batch**:
- Listings > Sold → "Archive Sold" (mobile shows "Archive")
- Watchlists > "Owned Watches" → "My Watches"
- Manage-list sheet: "View Only Link" / "Collaboration Link" buttons
  (was "Read-only link" / "Invite") with 4-second per-button copy/
  share confirmation
- ListReceiver: token-link recipients get a clear two-CTA panel
  (Collaborate / View only) instead of being routed through "Save a
  copy" by default
- **`who_added` attribution chip** (slice 4) re-added to the JS
  insert path + new `list_members_for_collection` SECURITY DEFINER
  RPC so any list member (not just owner) can resolve user_id →
  display_name. Chips render only on lists with 2+ members.

**#147 — View settings inline**: Currency / Theme / Columns moved
out of SettingsModal into the in-flow surfaces. Mobile: filter
drawer gets a "View settings" section at the bottom. Desktop:
account-menu dropdown renders the controls inline (compact mode).
SettingsModal kept as a fallback for mobile pages without a filter
button (Watchlists > Lists landing) — accessed via "Display settings"
entry. Shared `ViewSettingsControls` component used in both surfaces.

**#148 — Heart icon clarifications**:
- Listings > Saved chip: heart now red (`var(--danger)`), filled
  when active, outlined when off. Matches the hearted-card overlay
  so the chip reads unambiguously as "the heart filter".
- Watchlists tab pill: heart → bookmark glyph. The heart conflicted
  visually with the Saved chip on Listings; bookmark reads as
  "saved/curated stuff lives here" for a tab that holds Lists +
  Searches + Owned + Challenges.

### Share flow rewrite (within #146)

The 2026-05-08 Manage-list sheet had a two-button flow (Invite,
then Copy invite link) that confused users — Mark's wife got "view
only" access because the email-match accept gate failed when her
Google account email differed from what Mark typed. Today's rewrite:

- One button "Collaboration Link" creates the invite + opens the OS
  share sheet with `?invite=<id>` in the URL.
- New `accept_invite_by_token` + `pending_invite_by_token` SECURITY
  DEFINER RPCs on the receiver side. The URL token is the secret;
  email match is bypassed. Idempotent (same caller re-clicking
  doesn't error; different-user-acquires raises).
- Receiver page shows "Collaborate" / "View only" / Save-a-copy as
  three explicit choices instead of the prior implicit fallback
  ladder.

### Auction time-aware classification (PR #149)

Mark report 2026-05-09: EU-timezone auctions whose calendar date
was today but whose start time hadn't been reached got pinned to
Archive Sold. Fix at three call sites (mainFeedItems projection,
watchItems hearted projection, secondary auctionLotItems
projection): if `auction_start > now` OR `auction_end > now`,
override the scraper's `status:"ended"` flag back to active. Both
checks needed because date-only `auction_end` strings ('2026-05-09')
resolve to 00:00 UTC and would falsely pass the "end is in the
past" gate later in the same day.

Plus second cron schedule on the comprehensive auction-lot scraper
at 12:00 / 16:00 / 20:00 UTC (daily main pipeline still 06:00). At
most ~4-5 hours between bid + status refreshes during EU-evening +
US-business-hours auction windows. Calendar walk + tracked-lots
scrapes stay daily; new workflow only re-runs auction_lots_scraper
+ image cache. New file:
`.github/workflows/scrape-auction-lots-frequent.yml`.

### Realtime: live updates on shared lists (PR #150)

Subscriber pattern in `useCollections`: postgres_changes events on
`collections` + `collection_items` push a refetch tick (debounced
250ms), the existing fetch effect re-runs, local state converges
to canonical DB state. Supabase Realtime applies row-level RLS to
broadcast events — clients only receive changes for collections
they own or are accepted-collaborators on; no client-side filter
needed and no leaking of others' lists.

Migration `2026-05-09_realtime_publication.sql` adds the two tables
to the `supabase_realtime` publication. Already applied.

Cost: free tier (200 concurrent / 2M msg/mo) covers the family-
share case and well past 1k users. Pro tier ($25/mo) is the next
step. Supabase hard-limits Free — usage spike caps connections
rather than billing surprise. Pro → Team is the scary jump
($25 → $599) but Pro cap kicks in well before that.

Foundation for reactions / group-feedback features Mark floated.

### Listing velocity (PRs #151 + #152)

#151 (merged-pending) — per-card SOLD chip now reads "SOLD · 4d"
when both `firstSeen` and `soldAt` are present. Auction-shaped rows
skip the duration suffix (different lifecycle). New `daysOnSale` /
`daysOnSaleLabel` helpers in utils.js. Admin Source-quality table
gets a "Cycle (30d)" column = median days-on-sale across the
rolling-30d sold sample, with sample-size subscript so a median
of 1 isn't visually equivalent to a median of 50.

#152 (open) — Per-brand velocity rollup. New table between Source
quality and Auction house quality. Same data grouped by brand:
Brand · Live · Sold (30d) · Cycle (30d) · $ sold (30d) · Top dealer.
Default sort = ascending by Cycle. Brands with no 30d sample sink
to the bottom regardless of sort direction. Auction lots excluded
from the brand sample (different lifecycle).

Per-reference rollup deferred — depends on Epic 0 references-as-
entities work.

## SQL migrations applied this session

All applied to production via Supabase MCP (Mark approved each):
1. `2026-05-08_invite_by_token.sql` — `accept_invite_by_token` +
   `pending_invite_by_token` RPCs (token-path collaborator accept)
2. `2026-05-09_list_members.sql` — `list_members_for_collection`
   RPC (any-member roster read for `who_added` chip resolution)
3. `2026-05-09_realtime_publication.sql` — adds `collections` +
   `collection_items` to `supabase_realtime` publication

## Cleanup pass

- Archived `SESSION_HANDOFF_2026-05-08.md` to `archive/`.
- Local merged branches deleted: `ia-restructure-2026-05-08`,
  `drill-in-filters`, `watchlists-polish-2026-05-09`,
  `view-settings-into-filter`, `heart-icon-tweaks`,
  `auction-end-time`, `realtime-shared-lists`, plus older
  `docs-followup-2026-05-08` and `eod-cleanup-2026-05-08`.
- Remote refs pruned to match.
- Dead `lastHeartedSubRef` + its useEffect removed from App.js
  (the Saved pill that set it was retired in the IA pass; ref had
  no readers). Branch `cleanup-dead-code` open.

## Open items / follow-ups

- **PR #151 + #152 still open** — both green. #152 is stacked on
  #151; merge #151 first then #152 retargets to main cleanly.
- **PR #cleanup-dead-code** — small, pure removal.
- **Watch management feature on Owned Watches** — original "after
  the bugs" goal. Mark to spec scope; reasonable starting points:
  reflection layer (per-watch journal — why bought / how reality
  compared / would-buy-again), deeper purchase-and-value tracking,
  watchbox journey narrative, or detail-page-per-watch as the
  shell that holds everything.
- **Username / display name in user_profiles** — needed before
  reactions ship usefully (otherwise chips read "name@gmail.com 👍").
  Recommendation: derive default from
  `auth.users.raw_user_meta_data.full_name` (Google fills this) →
  email-local-part fallback, with editable `display_name` field.
- **Reactions on shared-list items** — schema +
  `collection_item_reactions` table. Realtime is now in place to
  make this snappy. Depends on usernames so chips read clean.
- **Per-reference velocity rollup** — depends on Epic 0
  references-as-entities work.
- **`decline_invite` RPC** — kept in DB (harmless) but no UI calls
  it after the receiver redesign retired Decline. Could drop in
  a future cleanup.
- **Auction time + duration scraping on the calendar walk side** —
  Antiquorum + Sotheby's already provide ISO timestamps; Phillips
  + Christie's currently date-only on the calendar. JS time-aware
  fix covers the case regardless because we use whatever's there;
  per-house calendar enhancement is a future small task.

## CLAUDE.md additions this session

(none — most adds were UX state worth keeping local to the handoff.
Graduate to CLAUDE.md only what's durable for next session.)
