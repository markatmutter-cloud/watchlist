# Watchlist — Session Handoff (2026-05-01)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only.

## TL;DR

Big session: Collections + Sharing v1 shipped, currency picker shipped,
Central Watch source added (27th dealer), View menu folded into Settings,
the Vercel deploy wedge resolved, **a backfilled-aware date sort fix to
keep newly-added sources from dominating the feed**, and **Hidden
listings surfaced as a synthetic Watchlist > Collections row** (the
"Manage hidden" user-dropdown item is gone). Production is **green**,
currently serving `main.b97a2421.js`.

## What shipped this session (newest first)

- **Hidden listings → synthetic Watchlist > Collections row**
  (`039bb8c`). Replaces the user-dropdown "Manage hidden" modal.
  The Hidden row only appears when the user has ≥1 hidden listing;
  drill-in shows the items grid with `isHidden=true` so the Card
  "..." menu's Hide entry reads as "Unhide". `HiddenModal.js`
  deleted (no longer reachable). CLAUDE.md updated with the
  Hidden-as-virtual-collection rule (Approach A pattern, parallel
  to Favorites — data stays in `hidden_listings`, UI surface is
  synthetic). User dropdown is now just **Settings / Sign out**.

- **Backfilled-aware date sort** (`cb1e3ca`). `merge.py` already
  flags items in newly-added sources as `backfilled:true` when ≥10
  appear in one run, but the default date-desc sort still treated
  `firstSeen` as authoritative — Central Watch's 180 listings,
  all stamped today, dominated the top of the feed pre-fix. New
  two-tier comparator: non-backfilled items always sort above
  backfilled in either direction; existing `effectiveDate` logic
  unchanged within each tier. Future sources benefit automatically.

- **User menu reorganize** (`e6de1c7`). Settings moved above
  "Manage hidden" + dropped the "· USD/GBP/EUR" suffix. Was
  superseded by `039bb8c` removing the Manage hidden item entirely;
  the commit is still on the branch's history but its UX impact is
  zero on the deployed build.

- **View menu → Settings consolidation** (`25adbbf`) — theme + column
  count + about folded into the Settings modal. Header now carries
  filter button + avatar only (was filter + view + avatar). Avatar
  sized 40px on mobile / 32px on desktop to match the filter button.
  Desktop sub-tab "+ Track new item / + Add search / + New
  collection" buttons pushed right via `marginLeft: auto`; mobile
  keeps inline-after-tabs because the strip is horizontally
  scrollable. Collections list left-accent extended from
  shared-inbox-only to every collection row. Drops the now-unused
  `viewMenuOpen` state from `useViewSettings`.

- **Vercel build wedge — resolved** (`01104d6`). Eight consecutive
  Production deploys had been red since `aea9c93` (Share polish).
  Root cause: a `{/* ... */}` JSX comment placed between `return (`
  and the root `<div>` in `Card.js`. CRA's parser reads that as a
  stray object literal and `CI=true` treats the parse error as a
  build failure. Removing the comment unblocked the chain; the
  share/menu/sub-tab fixes from the back half of the session all
  rode out on the next green deploy. Lesson graduated to CLAUDE.md
  "Things to never do".

- **Share polish chain (now live):**
   - `c7f7aba` Share detection by User Agent (was matchMedia, was
     viewport width — both false-positived on Mac)
   - `3bdda18` Card root `overflow: hidden` restored + menu labels
     shortened ("Add to…" / "Hide" / "Share" / "Remove") so menu
     fits 3-col mobile cards (~114px wide)
   - `49966cc` Sub-tab strip horizontally scrollable on mobile —
     drops `marginLeft: auto`, every child `flexShrink: 0`,
     scrollbar hidden via inline styles
   - `5dc7fba` Share payload URL-only (no title/text — iMessage was
     rendering them as preamble lines)
   - `aea9c93` First menu-clip fix attempt + desktop-copy + inbox
     surfacing in Collections list (3px blue accent + tray icon)

- **Collections + Sharing v1 (3-session feature pair):**
   - `b6cb57b` Session 3 v3 — Share, hook-isolated in
     `<ShareReceiver/>`. Earlier v1 (`ca49fa2`) and v2 (`e8521a2`)
     both white-screened on production with React error #310
     ("rendered more hooks than during previous render"). Both
     reverted. v3 moved all share-receive hooks into a self-contained
     component, leaving App.js's hook count unchanged.
   - `c2aeabd` Session 2 — Collections UI (sub-tab, drill-in, "..."
     menu on Card with Add/Hide).
   - `212d89a` Session 1 — `useCollections` hook + SQL
     (`supabase/schema/2026-05-01_collections.sql`).

- **User settings / currency picker** (`5aaf880`, `c7497db`):
   - New `user_settings` table in Supabase
     (`supabase/schema/2026-05-01_user_settings.sql` — Mark ran it).
   - Settings modal in user-dropdown menu, USD/GBP/EUR picker (HKD
     trimmed mid-build).
   - `priceIn(item, target)` helper in utils.js converts via
     priceUSD bridge.
   - Easter egg in helper text: "(you're welcome George Longfoot)".

- **Central Watch source** (`28671bf`) — 27th dealer. Custom PHP
  catalogue, HTML-parsed.

- **UI polish**:
   - `c9a5982` Searches sub-tab dividers harmonized to match
     Listings + Calendar (bold 14/600 + borderBottom).
   - `c68ae08` eBay rows match saved-search row type scale.
   - `7bcdc2e` Watchlist > Listings sub-tab renamed → Favorites.
     Collection example copy switched to reference themes.

- **Bug fixes**:
   - `8bca9db` Watchlist bucket order via rank table (was
     timestamp-math, broke on rows with empty savedAt).
   - `22190b5` Search tokenization — word order no longer matters
     ("rolex gold" = "gold rolex").

## Open user-reported issues

These were reported in the back half of the session while the wedge
was holding fixes off prod. With the wedge resolved, the deployed
fixes should now address most of them — verify on the live site
when convenient.

1. **Desktop share showing native share sheet** — `c7f7aba` UA-based
   detection now deployed. Should be resolved.
2. **Mobile menu items clipped on cards** — `3bdda18` shortens
   labels to "Add to…" / "Hide" / "Share" / "Remove". Should be
   resolved.
3. **"Shared with me" not appearing after Save** — separate from
   the wedge, may still be open. Mark tested by sharing-to-self,
   clicking Save, but Watchlist → Collections only showed his own
   collection. Two possibilities to check:
    - `addToSharedInbox` returns `{error}` silently rather than
      throwing; `ShareReceiver`'s `try/catch` only catches throws.
      **Add explicit error logging when returning errors from
      collections hook.**
    - Or the inbox row was created but UI is filtering it out
      somewhere we missed. Verify by querying:
       ```sql
       select * from public.collections
       where user_id = auth.uid() and is_shared_inbox = true;
       ```
       in Supabase SQL editor while signed in.

## Architecture notes added this session

- **App.js hook count must stay stable.** Adding hooks deep in App.js
  near render-conditional code paths triggered React error #310
  twice. Rule: if a feature needs new hooks, put them in a
  self-contained component that App.js mounts unconditionally.
  Pattern proven in `<ShareReceiver/>`. Already in CLAUDE.md
  "Things to never do".

- **CRA + Vercel + JSX comments before root element.** CRA's parser
  reads `{/* ... */}` between `return (` and the root JSX element as
  a stray object literal; `CI=true` treats the parse error as a
  build failure. Cost us 8 consecutive red deploys before being
  diagnosed. Graduated to CLAUDE.md "Things to never do".

- **Share URL routing on iOS:** iOS does NOT route external https
  links to installed PWAs. Share recipient with the home-screen
  install will see the link in Safari, not the PWA. Limitation,
  not a bug — Universal Links / custom URL schemes require native
  apps.

## Manual steps from Mark — all done

- ✓ Run `supabase/schema/2026-05-01_collections.sql`
- ✓ Run `supabase/schema/2026-05-01_user_settings.sql`
- ✓ Diagnose Vercel deploy failures (resolved by `01104d6`)

## Doc files updated this session

- `README.md` — dealer count → 27 (Central Watch). Architecture
  diagram scraper count corrected. Watchlist → Favorites rename and
  Collections + Sharing primitive reflected. App.js line count
  refreshed. `useViewSettings` description trimmed (View menu folded
  into Settings).
- `ROADMAP.md` — Collections + Sharing v1 marked shipped under Epic
  3, build-a-collection demoted to v2, watchbox added as separate
  v2 item, three-tier-save model marked rejected. User Settings /
  Currency Preference added under Epic 0 and immediately marked
  shipped. View menu consolidation + Vercel wedge resolution noted
  in update log.
- `CLAUDE.md` — Watchlist data model paragraph (Approach A
  asymmetry: default Favorites in `watchlist_items`, additional
  collections in new tables). Share URL format note. New entries
  in "Things to never do": don't reintroduce in-app messaging,
  don't auto-redirect shared links, don't migrate watchlist_items
  without a deliberate decision, don't add hooks deep in App.js,
  don't put JSX comments before the return root.

## Commits worth knowing for future me

```
039bb8c   Hidden → Watchlist > Collections row (HEAD-ish; merge of branch)
cb1e3ca   Demote backfilled items in date-sort comparator
e6de1c7   User menu: Settings above Manage hidden + drop · USD (since superseded)
898347a   Refresh post-session docs after Vercel wedge resolution
25adbbf   View menu → Settings consolidation
01104d6   Fix Vercel build (drop misplaced JSX comment in Card.js)
fff15fb   Handoff + doc touchups (this doc, since updated)
c7f7aba   Share detection: UA-based
3bdda18   Card menu fixes
49966cc   Sub-tab horiz scroll
5dc7fba   Share URL-only
aea9c93   Share polish (originally wedged the build chain)
b6cb57b   Session 3 v3 Share — hook-isolated <ShareReceiver/>
4734c28   Revert v2
e8521a2   Session 3 v2 (white-screened, reverted)
cf10472   Revert v1
ca49fa2   Session 3 v1 (white-screened, reverted)
c2aeabd   Session 2 Collections UI
212d89a   Session 1 Collections data
5aaf880   User settings hook + modal
c7497db   Settings: drop HKD + easter egg
28671bf   Central Watch source
8bca9db   Bucket order rank table
22190b5   Search tokenization
```

## Next session

Per [ROADMAP.md](ROADMAP.md) priority order, the near-term currency
item is shipped, so the next pickup is **Epic 0 foundations** —
likely the verification script (smallest, highest-leverage) or the
references-as-first-class-entities scaffolding (bigger swing). See
ROADMAP for the full priority order.
