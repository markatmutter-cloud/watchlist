# Watchlist — Session Handoff (2026-05-09)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only — durable rules graduate to CLAUDE.md, durable plans graduate to
ROADMAP.md.

## TL;DR

Marathon session. **23 PRs merged today (#144 → #166-1)**, 5 SQL
migrations applied to production via Supabase MCP, and the watch-
management feature shipped end-to-end (Phases 1–5 + preload + public
archive backfill). Plus the Watchlists IA finished, Realtime live
updates wired, listing velocity tracking landed, and a long tail of
mobile UX polish (filter jitter, padding, sub-tab intros, bottom-nav
visibility iterations).

Five arcs:

1. **Watchlists IA + bug fixes (#144 → #148)** — Saved tab → "Watchlists",
   strip restructure (Lists default), drill-in filter row, share-link
   one-button + token-bypass, view-settings inline, heart icons.
2. **Auction time + Realtime + velocity (#149 → #152)** — auction
   time-of-day classification fix + 4×/day refresh, Supabase Realtime
   on shared lists, listing velocity (per-card chip + per-source +
   per-brand cycle column).
3. **Admin + polish (#153 → #158)** — Admin Fastest-sales view +
   section nav + cycle color-coding, watchlist-bugs batch, mobile
   fixes batch (2-col default, filter jitter, list drill-in clipping),
   sign-in modal consistency + mobile padding.
4. **Watch management feature (#159 → #162)** — Phase 1-5 + Phase 8.
   Collection / Archive / Plan toggle, per-watch detail sheet with
   reflection fields and dated journal, plan-view inline pool below
   Wants. Preloaded Mark's 16 spreadsheet watches into Collection +
   Archive AND added the 9 listing URLs to the public archive.
5. **Sub-tab intros + bottom-nav visibility (#163 → #166)** —
   consistent expandable intros across all four Watchlists sub-tabs,
   tighter filter drawer, mobile bottom-nav visibility (three
   iterations on shadow/border to make the favicon-green tab edge
   actually read on iOS Safari).

## What shipped — by arc

### Watchlists IA + bug fixes (PRs #144–#148, #156)

- **Tab "Saved" → "Watchlists"** (mobile + desktop)
- Strip pills: Lists (default) / Favorite searches / Owned Watches
  → renamed to **My Watches** / Challenges (4 pills)
- "All" combined view dropped; "Shortlist" folded into Plan > Wants
- **Saved virtual list** at top of Lists view (synthetic id
  `__saved__`, backed by `watchlist_items`, can't be deleted)
- **Shared with me** as second permanent system list
- **Drill-in filter row** — same Date / Price / $ / Source / Brand
  pills as the Listings tab, narrows list contents
- **Listings > "Sold" → "Archive (Sold)"**
- **Archive (Sold) date headers fixed** — backfilled-items "Earlier
  additions" override no longer interleaves with sold-date dividers
- **Today's completed auctions** appear in Archive (Sold) — added a
  reverse-direction time-aware override so auctions that ended
  between scraper runs (auction_end with time-of-day in the past)
  flip active→ended for display
- **Saved virtual list un-heart UX** — tap a heart off, card stays
  visible until refresh so misclicks are reversible (snapshot
  pattern extended from legacy hearted sub-tabs)
- **"Fetching…" placeholder** filtered out of Saved virtual list
- **Add-to-list picker** hides Wishlist / Owned / Sold / Challenges /
  Shared inbox (managed via dedicated surfaces, not generic picker)
- **Lists list-cards** get pencil + trash icons inline (owner-only,
  matches Challenges card pattern)
- **ManualItemCard ⋯ menu** click-outside + Escape dismiss
- **Listings > Saved chip** heart now red (`var(--danger)`), filled
  when active, outlined when off
- **Watchlists tab pill** heart → bookmark glyph (heart conflicted
  visually with the Listings Saved chip)

### Share-link rewrite (within #156)

- **Manage-list sheet**: "View Only Link" / "Collaboration Link"
  buttons (was "Read-only link" + "Invite"); 4-second per-button
  copy/share confirmation
- **Token-based accept**: `?invite=<id>` URL bypasses the email-match
  gate that previously failed when the recipient's Google email
  differed from what the owner typed. Two new RPCs:
  `accept_invite_by_token`, `pending_invite_by_token` (security
  definer, authenticated-only)
- **Receiver page**: Collaborate / View only as explicit choices
  instead of an implicit Save-a-copy fallback ladder
- **`who_added` attribution chip** (slice 4) re-added to JS write
  path + new `list_members_for_collection` RPC for any-member roster
  reads. Chip renders only on lists with 2+ members.

### iOS PWA favicon (within #144)

- Added 180×180 `apple-touch-icon-180.png` (the size iOS reads on
  Add-to-Home-Screen). 1024×1024 was likely being rejected, falling
  back to a screenshot.
- Added `manifest.json` for Android Chrome / desktop PWA install.

### Auction time + 4×/day refresh (PR #149)

EU-timezone auctions whose calendar date was today but whose start
time hadn't been reached got pinned to Archive Sold. Three call sites
now check `auction_start > now` AND `auction_end > now` before
trusting `status:"ended"`. Plus second cron at 12:00 / 16:00 / 20:00
UTC for the comprehensive auction-lot scraper — daily 06:00 UTC
calendar walk unchanged.

### Realtime on shared lists (PR #150)

`useCollections` subscribes to `postgres_changes` events on
`collections` + `collection_items`; debounce-bumped refetch tick
converges local state to canonical DB after any member's writes
propagate. RLS enforced server-side on broadcast. Migration adds the
two tables to `supabase_realtime` publication. Free tier handles
family use comfortably.

### Listing velocity (#151 + #152)

- Per-card SOLD chip now reads "SOLD · 4d" (auction-shaped rows skip
  the suffix). New `daysOnSale` / `daysOnSaleLabel` helpers in
  utils.js.
- Admin Source-quality table: "Cycle (30d)" column — median
  days-on-sale across rolling-30d sold sample, sample-size subscript.
- Per-brand velocity rollup table (between Source quality and
  Auction-house quality), default sort = ascending Cycle.

### Admin Fastest-sales + UX (#153, #155)

- New "Fastest sales" admin section using the Card grid (the
  "SOLD · 4d" chip carries the velocity headline). Window toggle
  (30d / 90d / All), Top N (25/50/100), brand chip filter.
- **Section nav at top of admin**: anchor-linked Sources / Brands /
  Fastest sales / Auction houses / User limits. Dense admin page is
  jumpable now.
- Cycle column color-coded: <7d green (hot), >30d red (slow).
- ROADMAP entry for **conversational ask-Claude** added to the
  deferred-future section.

### Mobile fixes batch (#157, #158)

- Default mobile cols **2** (was 3). 3-col was too tight on a 393px
  iPhone — overlay buttons collided.
- 3-col mobile cards now use `compact` flag (smaller heart + ⋯
  buttons, denser typography).
- Filter row jitter on Saved toggle eliminated: count gets a 38px
  fixed-width slot; × clear button shrunk to 30×30 to match pill
  height.
- List drill-in actions wrap on narrow viewports (was clipping
  Share/Manage/Rename/Delete off the right edge).
- "X new this week" chip on saved searches removed.
- Caption added inside list drill-ins explaining "Date sort uses
  when items were added to this list".
- Mobile title block tightened (font 18 → 15, padding 4/14/2 →
  2/14/0). ~14px saved above the fold.
- Bottom nav safe-area-inset bumped 4 → 12 (was tight enough in
  iOS PWA standalone that the active tab pill caught the swipe-up
  gesture and triggered Siri).
- `requireSignIn` (heart, hide, save-search on signed-out) now
  opens the SignInPromptModal instead of firing OAuth directly.
  Mobile + desktop now consistent.

### Watch management feature — Phases 1–5 + 6 + 8 (#159, #160, #161, #162)

**Phase 1 — toggle restructure** (PR #159)
- My Watches toggle: Owned/Sold/All/Shortlist → **Collection /
  Archive / Plan**.
- Plan view: three sections (Keeping / Selling / Wants) with
  running totals header (Owned value, Selling proceeds, Wants
  cost, Net cash impact, Future collection value).
- "All" dropped (Collection + Archive cover it). "Shortlist" folds
  into Plan > Wants. URL `?sub=wishlist` still routes to Plan for
  back-compat.

**Phase 2 — detail sheet read-only** (PR #159)
- New `WatchDetailSheet` component: photo + identifying info +
  Description + Thoughts + Plan controls + computed P&L. Mobile =
  full-screen sheet; desktop = side panel.
- Cards expose "Watch details" via the ⋯ menu (listing-backed) or
  tap-on-card (manual entries).

**Phase 3 — schema + editable detail** (PR #159)
- `2026-05-09_watch_management.sql` migration: adds
  `flagged_for_sale`, `assumed_sell_value`, `manual_description`,
  `manual_thoughts` + buy/sell breakdown columns + FX snapshots.
- Detail sheet edit-on-tap for every text field; toggle for-sale
  flag; assumed sell value drives Plan running totals.

**Phase 4 — journal** (PR #159)
- `collection_item_comments` table (id, collection_item_id,
  user_id, body, created_at). RLS gates members of the parent
  collection (owner OR accepted collaborator). Realtime
  publication entry so co-collaborator entries push live.
- Append-only journal UI in detail sheet with delete-self
  affordance.

**Phase 5 — pool** (PR #161)
- Inline pool below Plan's Wants section: hearted watches not yet
  in Wants, sorted by savedAt desc. Tap to promote.
- Capped at 24 visible with "Show all" toggle.
- Hidden when there's nothing to promote.

**Phase 6 — preload** (PR #160 + DB-direct)
- Mark's 16 spreadsheet watches inserted into his account: 5 held
  → Collection, 11 sold → Archive. Buy/sell breakdown + FX
  populated from Transactions tab. Listing URLs and og:image
  populated for the 6 of 9 URLs that yielded an image (Antiquorum,
  Heritage, Wind Vintage are anti-bot and need a manual photo
  upload).
- Same 9 URLs hearted in `watchlist_items` so they appear in
  Saved virtual list with images.

**Phase 7 — drag-and-drop** — skipped (tap actions cover the use
case).

**Phase 8 — public archive backfill** (PR #162)
- New `public/manual_historical_listings.json` — hand-curated
  historical sold listings, same shape as listings.json entries.
- App.js loads in parallel and merges before `setItems()`. Dedup by
  id. The 9 spreadsheet URLs now appear in **Listings > Archive
  (Sold)** for everyone, not just Mark.

### Sub-tab intros + bottom-nav visibility (#163 → #166)

- **SubTabIntro** made `expandable` + `defaultExpanded`. Default
  collapses when content present, expands when empty.
- **Lists / Searches / My Watches / Challenges** all use the same
  intro shape now. Pages stop jumping vertically as you switch.
- **Mobile filter drawer**: ViewSettingsControls compact on mobile
  (~30% shorter buttons), section padding tightened, "Show N
  watches" CTA bumped slightly.
- **Bottom nav visibility** (three iterations):
  - #163: olive drop-shadow at 0.18 alpha (invisible on iOS Safari)
  - #165: 1.5px olive border at 0.55 + stronger shadow (still read
    as grey because #3b4a36 is desaturated by design + transparency)
  - #166 (open at handoff time): solid `#3b4a36` at full alpha +
    2px so the favicon green is unmistakable

## SQL migrations applied this session

All applied via Supabase MCP, all committed under `supabase/schema/`:

1. `2026-05-08_invite_by_token.sql` — `accept_invite_by_token` +
   `pending_invite_by_token` RPCs (token-path collaborator accept)
2. `2026-05-09_list_members.sql` — `list_members_for_collection`
   RPC (any-member roster reads for `who_added` chip)
3. `2026-05-09_realtime_publication.sql` — adds `collections` +
   `collection_items` to `supabase_realtime`
4. `2026-05-09_watch_management.sql` — `flagged_for_sale`,
   `assumed_sell_value`, `manual_description`, `manual_thoughts`,
   buy/sell breakdown columns; `collection_item_comments` table;
   adds the comments table to `supabase_realtime`
5. **Direct preload** (committed as artifacts under
   `2026-05-09_preload_mark_watches.sql` and `_preload_mark_hearts.sql`)
   — 16 manual entries + 9 watchlist hearts for Mark's account

## Open / pending at handoff

- **PR #166** (solid olive bottom-nav border) — open, awaiting Mark's
  test/merge. If solid olive still reads grey to him, swap is
  one-line to brighter Material green `#2e7d32`.
- **iOS PWA cache** — Mark experienced a stretch where merged code
  wasn't reaching his device. Hard-quit + reopen, or visit in
  regular Safari, picks up the fresh bundle. Root cause is iOS's
  aggressive service-worker caching for PWAs; not a deployment
  issue.

## Things to know for next session

- **Watch-management feature is live end-to-end.** Mark has 16
  watches preloaded; he can edit Description / Thoughts, flag for
  sale, set assumed sell value, journal entries with timestamps,
  see running P&L on Plan.
- **Mark's 9 spreadsheet listing URLs are in the PUBLIC archive.**
  Anyone visiting Listings > Archive (Sold) sees them. Adding more:
  edit `public/manual_historical_listings.json` directly. merge.py
  is unaware of this file (intentional — it's static curation).
- **Realtime is on for shared-list edits AND journal comments.**
  Free tier ample for current scale; Pro ($25/mo) is the next tier
  somewhere ~5–10k actively-grouped users. Hard-limited not
  soft-billed.
- **Conversational ask-Claude** is in ROADMAP's deferred-future
  section. The velocity rollups (PRs #151 + #152) prove the
  aggregation primitives work; foundation is ready when Mark wants
  to build it.
- **Username / display_name on user_profiles** still pending —
  needed before reactions ship usefully (otherwise journal entries
  read with bare email addresses). Promoted to ROADMAP #2 in the
  earlier docs pass.
- **Reactions on shared-list items** — schema not yet built. Next
  natural step after usernames. Realtime is in place to make it
  snap.

## Cleanup pass

- Local merged branches deleted as they landed (kept the working
  copy clean throughout the session).
- Remote refs pruned.
- Dead `lastHeartedSubRef` removed in #154.
- `watchHeartedToggleJSX` left in (still serves stale-URL
  back-compat for `?sub=listings|auctions|sold` on Watchlists tab).

## Open carry-overs (graduated to next session)

- **PR #166** merge + green-tab visibility settled
- **Username feature** before reactions
- **Reactions** on shared-list items + journal
- **Per-reference velocity rollup** (depends on Epic 0 references)
- **Mark's "thumbs-up/down on shared list" use case** — the
  reactions follow-on
