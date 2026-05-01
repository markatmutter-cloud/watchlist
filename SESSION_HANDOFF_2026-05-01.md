# Watchlist — Session Handoff (2026-05-01)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap and
direction, see [ROADMAP.md](ROADMAP.md). This doc is in-flight state
only.

## 🚨 STOP — production is wedged

**Vercel has been failing to deploy every push since `aea9c93` (the
"Share polish" commit). Eight consecutive Production deploys are
red ❌ on the Vercel dashboard.**

Production is therefore stuck on whatever bundle was last green —
probably `b6cb57b` (Session 3 v3) or the commit just before it. That
explains every UX bug Mark reported in the back half of the session
(desktop still showing native share sheet, mobile menu still clipped
with long labels, "Shared with me" not appearing after Save). The
fixes ARE in main, just not running.

**First task next session:**
1. Open the Vercel dashboard → click into one of the red deployments
   → read the build log. Likely candidates given recent code:
    - Lint error treated as build error in CI (CRA + `CI=true` flag —
      we have unused-var protection that has bitten us before).
    - A syntax error or import path snuck in mid-edit.
    - A new file that wasn't included in git but was referenced.
2. Once root cause is known: fix in a single commit titled
   `Fix Vercel build` and push. Subsequent green deploys will
   bring all the pending fixes live at once.

Listed deploy attempts since wedge (newest first):
```
FbfyN9oNX  259f4f4  TW listings cron        Error 16s
HVqto6Ng9  8557e82  eBay cron               Error 16s
4KvvEspRM  c7f7aba  Share detection: UA     Error 16s
3tPYRXM3Y  3bdda18  Card menu width fix     Error 17s
8tw3gMvLx  49966cc  Sub-tab horiz scroll    Error 17s
3sFHiKW4H  5dc7fba  Share: URL-only payload Error 15s
4w7aSTZwH  cedcfbc  Listings cron           Error 15s
A99XkWZxY  aea9c93  Share polish            Error 17s
```

## What shipped this session (newest first)

- **Share polish chain (all in main, none deployed):**
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
     surfacing in Collections list (3px blue accent + tray icon).
     **Has a side effect:** removing Card overflow let long titles
     push grid wider than viewport → fixed in `3bdda18`.

- **Collections + Sharing v1 (3-session feature pair):**
   - `b6cb57b` Session 3 v3 — Share, hook-isolated in
     `<ShareReceiver/>`. Earlier v1 (`ca49fa2`) and v2 (`e8521a2`)
     both white-screened on production with React error #310
     ("rendered more hooks than during previous render"). Both
     reverted. v3 moved all share-receive hooks into a self-contained
     component, leaving App.js's 54-hook count unchanged. **v3
     renders fine in production.**
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

## Open user-reported issues (will resolve once Vercel deploys)

1. **Desktop share still shows native share sheet** — `c7f7aba`'s
   UA-based detection should fix once deployed. Old detection
   misfired on Mac.
2. **Mobile menu items still clipped on cards** — `3bdda18` shortens
   labels to "Add to…" / "Hide" / "Share" / "Remove". Old labels
   ("Add to collection…" / "Hide from feed") were too wide for 3-col
   mobile.
3. **"Shared with me" not appearing after Save** — Mark tested by
   sharing-to-self, clicking Save, but Watchlist → Collections only
   shows his own collection. Two possibilities:
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
  twice. New rule (informally): if a feature needs new hooks, put
  them in a self-contained component that App.js mounts
  unconditionally. Pattern proven in `<ShareReceiver/>`.

- **Share URL routing on iOS:** iOS does NOT route external https
  links to installed PWAs. Share recipient with the home-screen
  install will see the link in Safari, not the PWA. Limitation,
  not a bug — Universal Links / custom URL schemes require native
  apps. Documented in CLAUDE.md "Things to never do".

- **Vercel + CRA CI=true:** unused-var warnings become errors in
  the production build. Bitten 3+ times this session. When in doubt,
  err toward over-using a destructured prop or drop it from the
  destructure — never leave a dangling unused name.

## Manual steps still needed from Mark

- **Run `supabase/schema/2026-05-01_collections.sql`** ✓ done earlier
  this session.
- **Run `supabase/schema/2026-05-01_user_settings.sql`** ✓ done.
- **Diagnose Vercel deploy failures** — next session priority.

## Doc files updated

- `README.md` — dealer count 26 → 27 (Central Watch), reflects
  Watchlist → Favorites rename, mentions Collections + Sharing
  primitive. Folder layout includes `supabase/schema/` and the
  new component files.
- `ROADMAP.md` — Collections + Sharing v1 marked shipped under
  Epic 3, build-a-collection demoted to v2 (deferred), watchbox
  added as separate v2 item, three-tier-save model marked
  rejected. Update log entry. User Settings / Currency added
  under Epic 0. Currency primary-picker shipped (was originally a
  near-term unbuilt item).
- `CLAUDE.md` — Watchlist data model paragraph (Approach A
  asymmetry: default Favorites in `watchlist_items`, additional
  collections in new tables). Share URL format note. New entries
  in "Things to never do": don't reintroduce in-app messaging,
  don't auto-redirect shared links, don't migrate watchlist_items
  without a deliberate decision.

## Commits worth knowing for future me

```
c7f7aba   Share detection: UA-based (latest, undeployed)
3bdda18   Card menu fixes (undeployed)
49966cc   Sub-tab horiz scroll (undeployed)
5dc7fba   Share URL-only (undeployed)
aea9c93   Share polish (undeployed — first wedge attempt)
b6cb57b   Session 3 v3 Share (deployed, working)
4734c28   Revert v2
e8521a2   Session 3 v2 (white-screened, reverted)
cf10472   Revert v1
ca49fa2   Session 3 v1 (white-screened, reverted)
c2aeabd   Session 2 Collections UI (deployed)
212d89a   Session 1 Collections data (deployed)
5aaf880   User settings hook + modal (deployed)
c7497db   Settings: drop HKD + easter egg (deployed)
28671bf   Central Watch source (deployed)
8bca9db   Bucket order rank table (deployed)
22190b5   Search tokenization (deployed)
```

## Quick-reference if Vercel build is the issue

- Most recent green deploy was likely `b6cb57b` or earlier.
- Mark mentioned `aea9c93` (first wedge) introduced overflow:hidden
  removal on Card root. That was reverted in `3bdda18`. Not the
  build problem.
- Suspect: a typo or unused-var in one of the share-polish files.
  Run `npm run build` locally if Node is installed; the error will
  surface in seconds.
- If too sus to debug live: revert the chain back to `b6cb57b`
  with `git revert b6cb57b..HEAD --no-commit && git commit && git
  push`. That returns prod to the last known-green state. Then
  re-apply the fixes one at a time.
