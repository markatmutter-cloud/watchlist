This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.

---

## UPDATE — additional messages between handoff summary and 2026-04-27

These exchanges happened after the compaction summary further down was written but before the current session.

**Apple-touch-icon deploy verification:**
- Verified deployed icon SHA matched local — Vercel was serving the hourglass; iOS/browser cache was the issue.
- Steps given: visit icon URLs directly, hard-reload browser, on iOS remove + re-add home-screen shortcut.
- Mark confirmed cell phone shows the new icon. Browser tab favicon needs separate cache clear.

**PWA padding + watchlist count (commit `97c9527`):**
- Mark: "when i add as a homescreen link it opens as an app which is nice. but then the padding at the bottom of the screen is a little tight. Remove the number in watchlist and give the tabs at the bottom a little more room"
- Removed count number from "Watchlist" tab (both mobile bottom nav and desktop top tabs).
- Bottom bar padding bumped to `safe-area-inset-bottom + 14px` plus more vertical room inside each button — clears iOS home indicator with breathing room.

**Wind Vintage missing-listings investigation (commit `55f791c`):**
- Mark flagged a Heuer Autavia bracelet listing live on WV but absent from the app.
- Root cause: WV scraper had a title-based exclusion filter (bracelet, end links, Gay Frères, etc.).
- Mark: "I like bracelets - lets keep them in, also on any other site trinkets or boxes etc."
- Stripped the title filter entirely from the WV scraper.
- **Audit of all 21 scrapers' filtering** — WV was the only one with title-based exclusions. Everywhere else only filters out price==0 (can't display) and already-sold items (those land in Archive via state-tracking). Bob's Watches still scoped to vintage Omega by design.
- WV "ON HOLD" listings: WV keeps these visible with a sold=true label, so they archive automatically. Other dealers just remove sold items, and `merge.py` state tracker detects disappearance.
- Expected WV count to jump from 137 toward ~264 (slides on their `/watches` page) after next scrape. Worth re-checking.

**Sort-order preference removed (commit `58fc78b`):**
- Mark: "remove the preference we added last night for wind vintage and tropical watch and just straight new searches"
- Newest-first now sorts purely by `firstSeen` across all sources, no per-source weighting.
- Note: rebase pulled in another scrape-pipeline commit; cron likely ran during the push.

**Claude Remote Control discussion:**
- Mark asked about a feature that lets him continue a Claude Code session from his iPhone Claude app.
- Verified vs current docs: feature is real (`/remote-control`, alias `/rc`), uses QR code to pair with mobile app, Mac runs the actual session, Pro/Max/Team/Enterprise plans only, no API-key auth, ~10-minute offline timeout.
- Several specifics from the original explanation were fabricated and flagged: "late February 2026" date, the `v2.1.110+` version requirement, a separate `/mobile` slash command, "initially Max-only," push-notification approval flow.
- Action for Mark (outside Claude Code session): `claude --version`, then `npm install -g @anthropic-ai/claude-code` if needed, then `/remote-control` in a fresh session.

**Roadmap snapshot (last big topic before this session):**

Bugs / loose ends:
- Grey & Patina 401 from WooCommerce Store API — likely auth/cookie change.
- Cron timezone — daily run is UTC; "new" badges flip at the wrong local time.
- Inflated NEW counts — `firstSeen` within 7-day window for items that have actually been on dealer sites for ages.
- Heart-click while signed-out is lossy — sign-in flow doesn't preserve the click target.
- Wind Vintage 264→137 drop — bracelet filter explained part of it; re-check after next scrape for any other silent loss.

Sources blocked / parked:
- Cloudflare-protected dealers — needs either a home Mac mini running headed Playwright or a paid solver.
- Christie's / Sotheby's / Loupe This auction houses.

Wanted features:
- Lot-level auction tracking (currently only sale dates).
- Market stats / price history per reference, once enough sold-archive data accumulates.
- **Alerts** — email/push when a saved search matches a new listing. Flagged as highest-leverage.
- Editorial content / reference resources (links to deep-dive articles per ref).
- Custom domain (drop `.vercel.app`).

Code quality:
- **Split App.js into proper components.** Was 1,300 lines at handoff write-time; now 2,735. Two focus-loss bugs already caused by sub-components defined inside `Dial()`. Pays for everything else after it.
- Verification script — fetch each dealer homepage, compare URL count vs `state.json`, alert on silent drop-outs.
- Tests for `merge.py` state transitions.

Quick wins (under an hour each):
- Mobile browser tab favicon sanity-check.
- Cron timezone fix.
- "Inflated NEW counts" rule tweak.

The "if I had to pick" recommendation given to Mark: **alerts** turn this from a browse tool into a daily-open tool; **splitting App.js** is the infrastructure that unblocks everything else.

Mark's reply was cut off ("Update a new hando[ff]"), prompting this update.

---

## UPDATE — 2026-04-27 (current state)

**Repo and path changes since handoff was written:**
- Repo URL: `https://github.com/markatmutter-cloud/watchlist.git` (renamed from `Dial`).
- Local path: `~/Documents/watchlist` (cloned today). The old `~/Documents/Dial` folder is now empty apart from `.DS_Store` and the `.claude` config folder.
- ⚠️ **Stale references to old repo name still in code.** `src/App.js:4-6` hardcodes `https://raw.githubusercontent.com/markatmutter-cloud/Dial/main/public/...` for `LISTINGS_URL`, `AUCTIONS_URL`, `TRACKED_LOTS_URL`. GitHub auto-redirects these for now, but they should be updated to `markatmutter-cloud/watchlist` to be safe against a future repo-name reuse.

**What shipped since the handoff (from `git log`):**
- ✅ **Editable saved searches done.** "Saved searches" pending task from Section 7 is shipped — see commit `224cb71` ("Save current search as a favorite from the search bar"). `useSearches` hook is wired into the UI; `SAVED_SEARCHES` const is gone.
- **Watchfid added as 18th dealer source** (`ccd43ec`). Now uses WP REST API (`cdbfddb`). The README still says "17 dealers" — out of date.
- **Bulang & Sons added** (`0d76a9c`). That probably makes 19 sources, not 18. README/handoff source counts are stale.
- **Image proxy** at `api/img.js` (Vercel serverless function) for hot-link-protected hosts (`8a5a0c1`). Currently only Watchfid routed through it (`PROXIED_IMG_HOSTS = ["watchfid.com"]` in App.js).
- **Watchlist image cache to Vercel Blob** (`ae3ef0f`). New script `cache_watchlist_images.mjs` (164 lines) reads `watchlist_items` rows missing `cached_img_url`, downloads the dealer image (with proper Referer for Watchfid), uploads to Vercel Blob at `watchlist/<listing_id>.<ext>`, writes URL back to the row. Also reaps orphan blobs when items are unfavorited. New DB column: `watchlist_items.cached_img_url`. Frontend prefers cached URL: `src/supabase.js:148` reads `row.cached_img_url || snap.img || ""`.
  - **Design intent (confirmed with Mark 2026-04-27):** scoped to watchlist only by design. Auction images stay up long-term; dealer images vanish; caching the full ~1,800-listing feed isn't worth the storage cost. Don't extend to listings/auctions.
  - Wired into `scrape-auctions.yml` only (runs once per day at 06:00 UTC). Acceptable since image-deletion is a long-tail risk.
- **Service worker** for reliable bundle updates / JSON freshness (`3c09e1f`). `public/service-worker.js` registered from `src/index.js`. One-shot reload on `controllerchange` so iOS PWA users don't get stuck on old JS.
- **Cumulative price drops** — track from peak, bubble re-cut items to top (`bc2670d`).
- **Hourglass placeholder + bulk-select on Watchlist** (`86e8314`).
- **Card placeholder when image URL 404s** (`8e5827d`).
- **Auction lot tracking added.** New `auctionlots_scraper.py` reads union of users' tracked lot URLs from Supabase, writes `public/tracked_lots.json`. Christie's URL support (`9482076`); manual entry source for hand-curated dates (`af01606`); auction-house filter on tracked lots (`671b456`); heart on desktop search (same commit).
- **GBP→USD conversion** for UK dealers shown alongside native price (mentioned in README).

**Workflow changes:**
- The single `scrape.yml` mentioned in the handoff is now **split into three**:
  - `.github/workflows/scrape-listings.yml` (160 lines)
  - `.github/workflows/scrape-auctions.yml` (113 lines, includes the Vercel Blob cache step)
  - `.github/workflows/scrape-tropicalwatch.yml` (50 lines, separate cadence because Browse AI)

**New files since handoff:**
- `cache_watchlist_images.mjs`
- `api/img.js`
- `public/service-worker.js`
- `public/tracked_lots.json`
- `docs/auction-lot-tracking-setup.md`
- `docs/watchlist-image-cache-setup.md`
- `bulangandsons_scraper.py`
- `auctionlots_scraper.py`
- `watchfid_scraper.py`
- `data/manual_auctions.csv`

**App.js size:**
- Handoff implies ~1,300 lines. **Now 2,735 lines** — roughly doubled. The "extract React components out of App.js" point in the README's "what I'd do differently" list is overdue.

**README state:**
- Source counts still say "17 dealers" — likely 19 now (Watchfid + Bulang & Sons added since).
- Otherwise accurate as of today.

**Anonymous browsing / Supabase:**
- Confirmed working — `src/supabase.js` no-ops gracefully when env vars are missing, so the app runs read-only without a Supabase project.

**Open issues from memory worth re-verifying (memory file is 6 days old):**
- G&P 401 errors
- Cron timezone
- Inflated NEW counts
- Mac mini decision for Cloudflare-blocked sources

---

Summary:
1. Primary Request and Intent:
   Mark is building "Watchlist" (originally "Dial"), a personal vintage watch listing aggregator. Live at [dial-watchlist.vercel.app](http://dial-watchlist.vercel.app), repo at github.com/markatmutter-cloud/Dial. He's non-technical; Claude is co-author. Across the conversation, his explicit requests included:
   - Build state-tracking with stable URL-hash IDs (sold archive, firstSeen tracking)
   - Add many new dealer sources (Oliver & Clarke, Craft & Tailored, Watch Brothers London, MVV Watches, DB1983, Hairspring, Somlo, Analog Shift, Watches of Knightsbridge, Belmont, Bob's Watches with vintage Omega sub-collection)
   - Add auction houses (Antiquorum, Monaco Legend, Phillips, Bonhams)
   - UX improvements (sticky mobile header, month-banded auctions, dynamic reference filter chips scoped to brand, hide feature with X button, search bar location, card height fixes, Watchlist title shown only when not scrolled)
   - Rename "Feed" → "Available", app renamed to "Watchlist"
   - Apple-touch-icon (hourglass) for iOS home screen
   - Supabase + Google login for cross-device watchlist (open signup, anonymous can browse but not save, free tier, no paywall)
   - Migrate watchlist/hidden/saved searches from localStorage to Supabase
   - Re-enable editable saved searches (per-user)
   - Import-from-this-browser banner for legacy localStorage data

2. Key Technical Concepts:
   - React (CRA) with hooks (useState, useMemo, useEffect, useCallback, useRef)
   - Rules of Hooks (all hooks before early returns - critical bug encountered)
   - Inline JSX consts vs sub-components (avoiding remount-on-render issues)
   - Supabase (Postgres backend, JS client, Row Level Security, Google OAuth, publishable keys vs anon keys)
   - Python scrapers (requests-based, no Playwright)
   - GitHub Actions cron pipeline
   - Vercel deployment, env vars
   - HTML/JSON-LD parsing patterns (Shopify products.json, WooCommerce Store API, Squarespace ?format=json items[], [schema.org](http://schema.org) Product blocks)
   - OAuth flow (signInWithOAuth, redirect URLs, prompt parameter for account picker)
   - localStorage migration patterns
   - CSS Grid (minWidth: 0 for column overflow), position: sticky
   - iOS home screen icons (apple-touch-icon.png 1024x1024)
   - [merge.py](http://merge.py) state tracking model (firstSeen, lastSeen, priceHistory, soldAt, active flag)

3. Files and Code Sections:
   - **src/supabase.js** (NEW): Auth and data hooks module. Most recent edit added `prompt: 'select_account'` to signInWithGoogle:
     ```js
     const signInWithGoogle = useCallback(async () => {
         if (!supabase) return;
         const { error } = await supabase.auth.signInWithOAuth({
           provider: 'google',
           options: {
             redirectTo: window.location.origin,
             queryParams: { prompt: 'select_account' },
           },
         });
         if (error) {
           console.warn('Sign in error', error);
           alert('Sign in failed: ' + (error.message || 'unknown error'));
         }
       }, []);
     ```
     Also has hardened signOut that clears localStorage sb-* keys, scrubs URL hash, and reloads page. Exports useAuth, useWatchlist, useHidden, useSearches, importLocalData.

   - **src/App.js**: Main component. Key recent changes:
     - Imports `useAuth, useWatchlist, useHidden, importLocalData, isAuthConfigured` from "./supabase"
     - Watchlist/hidden state replaced with hooks: `const { items: watchlist, toggle: toggleWatchlist } = useWatchlist(user);`
     - `requireSignIn` callback that triggers signInWithGoogle when anonymous user clicks heart/X
     - `legacyLocal` state reads localStorage at mount for the import banner
     - `runImport` function with `importBannerJSX` shown in watchlistTabJSX
     - authJSX block: Google sign-in pill or user avatar with dropdown, dropdown opens upward on desktop (bottom: 36) and downward on mobile (top: 36)
     - `LEGACY_WATCHLIST_KEY = "dial_watchlist_v2"` and `LEGACY_HIDDEN_KEY = "dial_hidden_v1"`
     - Removed loadWL/saveWL/loadHidden/saveHidden helpers
     - SAVED_SEARCHES still hardcoded constant (next migration target)

   - **[merge.py](http://merge.py)**: Data pipeline with 17 listing sources + 4 auction sources. Has `process_auctions()` for separate `public/auctions.json` with state tracking. Sources include current/legacy ones plus belmont, bobswatches.

   - **public/index.html**: Has apple-touch-icon, theme-color, apple-mobile-web-app-title="Watchlist".

   - **public/apple-touch-icon.png**: 1024x1024 hourglass icon cropped from Mark's 900x625 source via `sips`.

   - **.env.local** (gitignored): 
     ```
     REACT_APP_SUPABASE_URL=https://abrqfxqmhzycphhbzklm.supabase.co
     REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable__Gz6e2xmTo4EhlkKrqUOzg_mtv1L3za
     ```

   - **package.json**: Added `"@supabase/supabase-js": "^2.45.0"` to dependencies.

   - **Supabase database tables** (created via SQL Editor):
     - `watchlist_items` (user_id, listing_id, saved_at, saved_price, saved_currency, saved_price_usd, listing_snapshot)
     - `hidden_listings` (user_id, listing_id, hidden_at)
     - `saved_searches` (id, user_id, label, query, created_at)
     - All with RLS policies for own-user CRUD only

   - **Many scrapers**: antiquorum_auctions_[scraper.py](http://scraper.py) (with HEAD-check for catalog URL), monacolegend_auctions_[scraper.py](http://scraper.py) (anchored on `<p class="auction-date">`), phillips_auctions_[scraper.py](http://scraper.py), bonhams_auctions_[scraper.py](http://scraper.py), belmont_[scraper.py](http://scraper.py), bobswatches_[scraper.py](http://scraper.py) (multiple collections, JSON-LD parsing), etc.

4. Errors and fixes:
   - **Rules of Hooks violation (blank page bug)**: `auctionGroups` useMemo was after the loading early-return guard. Fixed by moving useMemo above all early returns. User reported "nothing seems to be live on the site... just blank".

   - **Sliders breaking mid-drag**: SidebarFilterPanel was a sub-component defined inside Dial(), causing remount-on-render and DOM element replacement during drag. Fixed by reverting to text boxes for price filter, then later by converting sub-components to JSX consts.

   - **Input focus loss when typing in price boxes**: Same root cause - sub-components defined inside parent. Fixed properly by inlining JSX (sidebarFilterPanelJSX, savedTabJSX, editorRowFor as helper function).

   - **Monaco Legend wrong dates**: Had two card layouts (featured vs grid). Fixed by anchoring on `<p class="auction-date">` which both layouts share.

   - **Phillips URLs swapped between cards**: My scraper looked forward for href, but Phillips puts href above the date block. Fixed by walking backward from atc_date_start.

   - **Antiquorum catalog URLs 500-ing for far-out auctions**: Added HEAD-check in scraper, only use specific catalog URL when it returns 200.

   - **Bonhams date parsing missed LA Weekly**: My _pair helper had a buggy end_year_override. Simplified to explicit y1/mo1/d1/y2/mo2/d2 parameters.

   - **Cards uneven width on mobile Archive**: CSS Grid min-content edge case. Fixed with `minWidth: 0` and `overflow: hidden` on Card outer div.

   - **"Can't sign out / signed back in after refresh"**: OAuth tokens in URL hash being re-parsed by supabase-js on reload. Fixed by hardening signOut to clear localStorage sb-* keys, scrub URL hash via history.replaceState, and reload page.

   - **"Sign in silently completes without Google picker"**: Google's silent SSO re-auth. Fixed by adding `queryParams: { prompt: 'select_account' }` to force account picker. Just committed as `e10e2a4`.

   - **Vercel env vars couldn't be added to Development environment**: Sensitive default for new vars. Told user to skip Development (only used by `vercel dev` CLI), tick Production + Preview only.

   - **User confused "Name" vs "Key" in Vercel form**: Acknowledged, my table column "Name" maps to Vercel's "Key" field.

   - **Supabase Site URL was incorrect**: User caught this themselves. Site URL was probably localhost:3000 default; should be https://dial-watchlist.vercel.app. User fixed it.

   - **iOS home-screen icon was a screenshot, not the hourglass**: Explained iOS caches icons from save-time. User had to delete shortcut + clear Safari cache + re-add from Safari to get new icon.

5. Problem Solving:
   - Cross-source data model with stable IDs solved via SHA1 hash of normalized URL
   - Sold archive emerges from state-based "active=false" detection plus cached display fields (lastTitle, lastImg, lastBrand, lastCurrency)
   - Watch Brothers London / MVV Watches images fixed by reading nested items[] array (not just top-level assetUrl)
   - WooCommerce currency_minor_unit handled per-source (G&P uses 0, Menta uses 2)
   - Sign-out flow hardened with belt-and-braces approach (server call + localStorage clear + URL scrub + reload)

6. All user messages:
   - Initial handoff summary about Dial project status
   - "yes." (approve state.json approach)
   - "run" (approve push)
   - "How do I check the [browse.ai](http://browse.ai) scraping is working? tropical watch has added a number of new listings in the past day or so..."
   - "I've not set up automated monitoring for Grey and patina yet. Should I?"
   - "skip all three for now. Try https://www.analogshift.com/collections/watches?..."
   - "One more source to add https://watchesofknightsbridge.com"
   - Various screenshots showing UI issues
   - "I want to show friends the site tonight but it's currently got my least favorite source first..."
   - "I'd like watchlist when not scrolled. and disappears when scroll..."
   - "agree with your stats list. lets go on getting it set up"
   - Pasted Supabase Project URL: `https://abrqfxqmhzycphhbzklm.supabase.co`
   - "here is publishable key: sb_publishable__Gz6e2xmTo4EhlkKrqUOzg_mtv1L3za"
   - Screenshot of Google Cloud Console
   - "Supabase Decision A - open sign up. Decision B - Option 1. Decision C - free. Decision D - late roadmap when we have a million people hahaha. Will I be able to see what users typically do on the site..."
   - "Success. No rows returned"
   - Screenshot showing OAuth client created
   - "Supabase Google enabled"
   - Screenshot showing "can't add for Development"
   - "you have name in your table - they have key and value"
   - "should I tick sensitive? hide keys"
   - "Then I can add you to all three (no sensitive is unticked and I'm in the watchlist project)"
   - "it signed me in and I can see my 'M' logo. when I click on the 'M' the pop up to sign out is below the page so I have to scroll down to see the sign out option. Maybe it should go to the top right of the page?"
   - "step 1-5 worked. Clicking on heart while signed out I can see changes to the URL bar as in screenshot but nothing happens. Now I'm signed out I can't sign back in again..."
   - "i just reloaded and it almost seems like it didn't log me out / i can't log out"
   - "I log out and refresh the page and click a heart and it's logged me in again"
   - "IN supabase site URL was incorrect"
   - Screenshot of correctly configured URL Configuration
   - "1-3 worked Although I'm not sure it refreshed the page. 4 refresh the page and still signed out. At this point if I click on a heart on one of the listings, the page reloads and the sign-in pill has gone and replaced with my 'M' and no heart, but the watchlist tab now has my count (but I didn't go through the sign in page again). I clicked sign out and the sign in pill is visible and the watchlist doesn't show with any count. If I click sign in it doesn't take me to the usual google process, just reloads screen with me logged in. No redirect to google log in."

7. Pending Tasks:
   - Re-enable editable saved searches (Supabase-backed, per-user) — bring back add/edit/delete UI in the Searches subsection of Watchlist tab. Hook (useSearches) already exists in supabase.js.
   - End-to-end smoke test verification after Mark tests the prompt: select_account fix
   - Heart-click-loses-state issue: when user clicks heart while signed out, item isn't saved after sign-in redirect completes (acknowledged as deferred UX polish)
   - Future roadmap items mentioned by Mark: market stats tracking, custom domain, editorial content, links to reference-specific resources
   - Future tech additions noted: automated verify script, lot-level auction tracking, Christie's/Sotheby's/Loupe This auctions

8. Current Work:
   Most recent work was diagnosing and fixing the sign-out/sign-in flow issues. User reported that after signing out:
   - Refresh kept them signed out (good — earlier fix worked)
   - Clicking heart while signed out silently signed them back in (no Google picker)
   - Clicking Sign In silently signed them back in (no Google picker)
   
   I diagnosed this as Google's silent SSO re-auth working as designed — the OAuth flow happens but Google skips the account picker because of an active Google session. Pushed commit `e10e2a4` that adds `queryParams: { prompt: 'select_account' }` to force Google to always show the account picker.

   The exact code change in src/supabase.js:
   ```js
   const signInWithGoogle = useCallback(async () => {
       if (!supabase) return;
       const { error } = await supabase.auth.signInWithOAuth({
         provider: 'google',
         options: {
           redirectTo: window.location.origin,
           queryParams: { prompt: 'select_account' },
         },
       });
       if (error) {
         console.warn('Sign in error', error);
         alert('Sign in failed: ' + (error.message || 'unknown error'));
       }
     }, []);
   ```

9. Optional Next Step:
   Wait for Mark to confirm the `prompt: 'select_account'` fix works (he should now see Google's account picker every time he signs in, making the auth flow visibly explicit). Once auth flow is fully validated, proceed with the in-progress todo: "Re-enable editable saved searches (Supabase-backed, per-user)".

   The next code work would be: Replace the hardcoded `SAVED_SEARCHES` const in src/App.js with the `useSearches(user)` hook from src/supabase.js, then add Add/Edit/Delete UI in the Watchlist tab's "Saved searches" subsection. The useSearches hook is already implemented in src/supabase.js with `items`, `editor`, `setEditor`, `startAdd`, `startEdit`, `cancel`, `commit`, `remove` API.

   Direct quote from my most recent assistant message before this summary: "Wait for Vercel to rebuild my `7373d5d` commit (~60s from when I pushed). Then sign out should properly reset. Sign in should work cleanly." And from the latest commit message about prompt:select_account: "Without this, Google's silent SSO re-auth kicks in whenever the user has an active Google session in the browser — sign-in looks like 'the page just reloaded'..."

   Should not start saved searches migration until Mark confirms the auth flow is fully working with the new fix.

If you need specific details from before compaction (like exact code snippets, error messages, or content you generated), read the full transcript at: /Users/markmutter/.claude/projects/-Users-markmutter-Documents-Dial/c9e291de-dd6c-460b-87da-e39b64ba51b0.jsonl
Continue the conversation from where it left off without asking the user any further questions. Resume directly — do not acknowledge the summary, do not recap what was happening, do not preface with "I'll continue" or similar. Pick up the last task as if the break never happened.
