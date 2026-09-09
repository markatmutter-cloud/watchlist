# BUGS — usability + defect backlog

The durable home for bugs Mark spots while using the app. Survives across
sessions so nothing gets lost in a screenshot folder or a rotating handoff.

## How this works

Mark drops a **`Bug:`** into *any* open session (no dedicated session needed —
this file is the memory, not the conversation). Claude then:

1. **Triages kind, then severity.** First — is it a **defect** (something
   broken / wrong / regressed) or a **capability gap / feature / design
   thread** (something missing we'd *choose* to build)? **Defects + tech-debt
   stay here.** **Feature-threads belong in [ROADMAP.md](ROADMAP.md)** under
   their epic — that's direction, not a defect (see "Epic assignment" below).
   Then severity: break-now (white screen, broken core flow, can't load) → fix
   immediately, abandon current tidy-up. Everything else → logged, work continues.
2. **Writes an *enriched* entry** — Claude's reconstruction (surface,
   component, likely cause, repro), not Mark's terse note. The point is that
   future-Claude's "B-07 still open" is something Mark can actually recognise.
3. **Echoes back the one-liner + stable ID** in the moment, so Mark sees it
   was captured correctly.

`/start` surfaces every **Open** entry so they resurface each session.

**Entry format:** `### B-NN — <one-line title>` then a bullet block:
`Reported` (date) · `Severity` (1 break-now / 2 usability / 3 polish) ·
`Surface` · `Status` (Open / In progress / Fixed PR#### / Won't-fix) ·
`Detail` (enriched) · `Hypothesis` (likely cause/location, if known).

When a bug ships fixed, move it to **Resolved** with the PR number. Don't
delete — the history is useful.

---

## Open

Grouped by **epic** (see [docs/IA_REDESIGN.md](docs/IA_REDESIGN.md) Deliverable 1)
so `/start` reads the backlog as coherent threads, not a flat list. **Clean-close
rule:** a partial ship *closes* its item and opens **one** crisply-scoped
follow-up — no vague "phase 2 open" tails.

### Epic assignment (→ ROADMAP) — established 2026-06-02

Every open item mapped to its **[ROADMAP.md](ROADMAP.md) epic** + kind. **Defects
+ tech-debt stay here** (BUGS = what's broken). **Feature-threads graduate into
their ROADMAP epic** at the next NOW/NEXT pass (ROADMAP = what to build) — listed
here until then so nothing's lost.

| Bug | ROADMAP epic | Kind | Disposition |
|---|---|---|---|
| B-45 | **10 Lumé** (pillar 1/5) | capability gap | ✅ graduated — Epic 10 list #4 |
| B-46 | **10 Lumé** (charter) | capability gap | ✅ graduated — Epic 10 list #2 |
| B-47 | **10 Lumé** (pillar 3) | capability gap | ✅ graduated — Epic 10 list #5 |
| B-51 | **10 Lumé** (pillar 3) | feature | ✅ graduated — Epic 10 list #6 |
| B-56 | **9 IA/UX** (+brand) | feature thread | ✅ closed 2026-06-07 (modal shipped; page dropped) |
| B-14 | **9 IA/UX** (brand) | thread | closed with B-56 |
| B-06 | **9 IA/UX** | design thread | shipped-ish → confirm/retire |
| B-08 | **9 IA/UX** | design thread | shipped → retire |
| B-57 | **0** (reference intelligence) | data quality | stays (defect) |
| B-28 | **1** (sources) | content gap | stays (defect) |
| B-31 | **9 IA/UX** | visual defect | stays (spot-check) |
| B-16 | **0** (platform health) | tech-debt | stays |
| B-22 | **0** (platform health) | tech-debt | stays |
| B-34 | **0** (platform health) | tech-debt | stays |
| B-27 | **0** (platform health) | maintenance | stays |
| B-63 | **9 IA/UX** | defect (overlay keyboard) | ✅ Fixed #816 `[audit:2026-06-06]` |
| B-64 | **9 IA/UX** | visual defect | ✅ Fixed #832 |

*The ⓐ/ⓑ/ⓒ groupings below are the OLD (IA_REDESIGN) taxonomy — superseded by the
table above; next session's NOW/NEXT pass migrates the "graduate" rows into ROADMAP
and re-homes the rest under their numeric epic.*

### ⓐ Epic A — IA / UX Redesign
*Design threads, not defects — this epic's working checklist. Also tracked outside
BUGS as memories: chrome-unification, card-design-system.*

**⭐ IA Redesign — phase status (the BIG plan; full detail [docs/IA_REDESIGN.md](docs/IA_REDESIGN.md)).
Kept here, above the small B-xx items, so the headline work never gets lost in the noise:**
- ✅ **Phase 0** — Listings/Auctions restructure (calendar modal + Bonhams) — shipped.
- 🟢 **Phase 1 — Watchlists "living dossier"** (the keystone) — unified single-scroll tab
  SHIPPED + polished (**B-08**, #638–#644): Watchbox anchor · unified Saved (type filter) ·
  article-style cover cards on the shared CardStrip · Saved searches · rename/delete (cards +
  in-list) · back-nav fix · favicon image fallback. Composable blocks shipped #628.
- 🔵 **Lists redesign (2026-06-01, "after living with it" pass)** — supersedes the
  single-scroll landing with a **sub-tabbed Lists tab landing on Hearted**. Full multi-phase
  plan in `~/.claude/plans/abstract-juggling-thacker.md` (Phases 0–7). **Phase 1 SHIPPED #729:**
  sub-tabs (Hearted/Lists/Searches/Shared) · HeartedView (filter bar + group-by dealer/brand +
  quick-jump) · Watchbox vault anchor + account-menu entry · closes **B-48**. NB this **retired
  the single-scroll WLSectionNav + Saved band** — the old "remaining follow-ups" below are
  re-homed into the new plan's phases (empty-list onboarding → Phase 3; share-modal → Phase 6;
  **B-37** heart-from-article/ref → Phase 2; saved articles/auctions → Phase 2 typed sections).
  **Remaining from B-08 (now folded into the redesign plan):** share-modal refresh (Phase 6) ·
  empty-list onboarding (Phase 3) · note save-state · promote-hero cover (1 migration) ·
  signed-out 5512/13 starter · **B-37** (Phase 2) · Watchbox-page echoes the landing.
- 🟡 **Reference browsing** (Brand › Model line › Reference, pulled forward) — structure
  SHIPPED (#627). **Needs visual polish.**
- 🔴 **Phase 2** — dispatch layers on every tab + de-junk Collecting + tools shelf — NOT
  built (only the References landing exists as a mini-dispatch).
- 🔴 **AI spine — RAG Q&A chatbot · journey coach · "missed-it"/discovery** — the
  exciting builds; each its own session. *Not a B-xx item — don't let it get buried.*
- 🔴 **Recommender** (Epic 7) + **two-door planning** — future.
*Visual polish is the recurring gap (structures built, pixels rough) — best done with Mark
in-app since Claude can't run the app here.*

### B-06 — Post-screening flow is underspecified (design thread → plan-mode)
- **Reported:** 2026-05-24 · **Type:** Design/product question · **Status:** Largely RESOLVED by the screening collapse 2026-05-26 (PRs #598–602). The original four questions are answered or obsoleted by the new binary model:
  1. *Done screening?* → light `CompletionView` ("Saved N of M"); results = your watchlist.
  2. *Where are results?* → the **Saved/watchlist** (the swipe hearts there; there's no separate per-list result set anymore).
  3. *Rescreen / reset / share?* → rescreen = tap **Screen** again; reset is obsolete (no reactions to clear); share = the normal list Share. Unsave-while-screening shipped (#602, Undo reverses a save).
  4. *Who likes what on a shared list?* → **deliberately deferred** — collaborative reactions were removed in the collapse; "who-hearted-what" is a planned LATER re-add (memory [[feedback_reaction_context_lives_in_lists]]).
- **What remains (the only open slice):** collaborative per-person visibility on shared lists when the team re-adds it. Not a current defect — a future feature. Connects to [[feedback-screening-mode-surfaces]] and [[project_auction_tab_redesign]] (Phase 3 heart-an-auction / Phase 4 integrated tab).

### B-08 — Unify the Watchlists tab into one sectioned screen (design thread → plan-mode)
- **Reported:** 2026-05-24 · **Type:** Design/product thread, **not** a defect · **Surface:** Watchlists tab (UI "Watchlists"/"Saved") · **Status:** ✅ **SHIPPED #638–#644** — unified single-scroll tab (Watchbox anchor · unified Saved w/ type filter · article-style cover cards · Saved searches · rename/delete · shared CardStrip) + live polish. Remaining crisp follow-ups tracked in the **phase tracker above** (share-modal · empty-list onboarding · note save-state · promote-hero cover · signed-out starter · B-37 · Watchbox-page).
- **Detail:** The Watchlists tab currently has **two sub-tabs** (Lists +
  Searches). Mark's idea: **integrate them into one screen** with **sections**
  rather than a plain list — **cards on mobile**, and **make more of the width
  on desktop**. This unified screen could also become the home for **Watchbox**
  (owned-watches view) so it lives alongside lists/searches instead of separate.
- **Why this is a plan item:** it's a re-architecture of a whole tab's IA
  (merging sub-tabs, a new sectioned layout, responsive card/grid treatment,
  and absorbing Watchbox) — design + layout decisions up front, not a quick
  edit. Internals reminder (CLAUDE.md): UI "Watchlists"/"Saved" ↔ internal
  `watchlist`/`WatchlistTab.js`; the broader `collections` umbrella (Lists,
  Wishlist, Owned/Watchbox, Sold) is the relevant data model. Pairs with B-06
  for a screening/collecting plan-mode session.

### B-45 — Lumé can't search by watch *attributes* (case material, dial colour, dial config)
- **Reported:** 2026-05-30 (Mark, real use) · **Type:** Capability gap (Epic 7 recommender / Epic 0 reference-intelligence) · **Severity:** 2 · **Surface:** `api/chat.js` `search_listings` + the data in `public/listings_*.json` · **Status:** Open — bigger build, plan-mode. **Detail:** ask Lumé for "a Datejust in stainless steel, silver dial, no numerals" and it can't deliver — `search_listings` only filters brand / model / ref / price / free-text title substring. The structured attributes a collector actually shops by (case material, dial colour, dial markers (numerals vs baton vs none), bezel, complication, size) aren't extracted or indexed, so they're only hit by luck if the words happen to appear in the title. **This is the headline limitation Lumé exposes** and it's the same substrate the recommender (taste→condition→price, [[feedback_recommender_taxonomy]]) needs. **Hypothesis / direction:** an attribute-extraction pass (LLM enrichment in `merge.py`, like the reference matcher) tagging each listing with normalised facets → a faceted `search_listings`; OR a semantic/embedding search over listing text. Lexicon Phase 2 (slang→canonical) is a partial input. Decide approach in plan-mode; likely the biggest single uplift to Lumé's usefulness.

### B-46 — Lumé asserts ungrounded reference "facts" + contradicts the user's real listing
- **Reported:** 2026-05-31 (Mark, real use — Tudor snowflake chat) · **Type:** Grounding/accuracy failure (the trust-killer) · **Severity:** 1 (kills trust — Mark: "one weird statement … kills the ride") · **Surface:** `api/chat.js` SYSTEM_PROMPT + `get_reference` coverage · **Status:** Open. **Detail:** asked the 9411/0 vs 7021 difference, Lumé free-recalled a whole spec breakdown (movements, MN-engraving years, $30k figures) and asserted **the 9411/0 is the *no-date* reference** — WRONG (it has a date window; Mark validated independently). Worse: when Mark said his on-screen 9411/0 *has* a date window and shared the real share-URL (which Lumé correctly resolved to "Belmont Watches 9411/0, $9,250"), Lumé **still insisted the listing was probably mislabeled/a red flag** — its ungrounded belief overrode the real, reputable listing in front of it. Two failures: (1) stated reference facts NOT from a tool (violates accuracy-over-colour, [[B-40]]); (2) told the user their validated reality was fake instead of deferring. **Fix:** the behavioral-charter prompt-tune (corpus-only facts; if get_reference lacks it, say so — never confabulate; NEVER tell a user their real listing is wrong on the strength of an unverified belief — defer to the evidence + flag uncertainty humbly). Also a KNOWLEDGE GAP: Tudor snowflake refs (7021/9401/9411) aren't well covered in the reference index/synthesis — candidate node for the fan-out.

### B-47 — Lumé can't see what's on the user's screen (active filters / current listing)
- **Reported:** 2026-05-31 (Mark, real use) · **Type:** Capability gap · **Severity:** 2 · **Surface:** `api/chat.js` tools + the client (no screen-context passed) · **Status:** Open — design/plan. **Detail:** Mark was viewing a filtered listing and said "it's the one on screen at the moment filtered"; Lumé can't access the current view — it only searches inventory itself, so it asked for a URL. It got there once Mark shared the share-link, but the friction is real: Lumé has no awareness of the user's **active filters, current results, or the listing/page they're looking at**. **Direction:** pass a lightweight "current context" (active tab/filters, visible/opened listing id or share-id) from the client into the chat request so Lumé can reason about "this one" / "these results." Ties to pillar 3 (deep-linking) — the inverse direction (app→Lumé context, not just Lumé→app actions).

### ⓑ Epic B — Platform Health
*Audit remediation + reliability. Low-risk, noise-reducing; mostly independent of
the redesign.*

### B-51 — Lumé's links should stay IN-APP (listings inconsistent; articles bounce to source)
- **Reported:** 2026-05-31 (Mark, real use) · **Type:** UX / capability · **Severity:** 2 · **Surface:** Lumé actions (`read_more`, `show_listings`/`open_watch`) + the share surface + a not-yet-existing in-app article view · **Status:** Open — plan. **Detail:** the links Lumé hands back are inconsistent and leak the user OUT of the app: (1) **listings** — some open the in-app `/share` surface (good; being improved), but some go straight to the **external dealer site**; (2) **articles** — `read_more` sends the user to the **raw source publication**, so there's no way to save the article or see it in a watchlist context. **Want:** one consistent in-app surface for BOTH — route listings through the (improving) share/open surface, and build the **same kind of in-app surface for ARTICLES** (read it in-app + heart/add-to-list, never bounce to the source). Pairs with B-37 (save from article/reference pages) and the share-surface refresh. Tracked in ROADMAP Epic 10's Lumé list (item 6). **Field evidence upgrade `[audit:2026-06-06]`:** the usability audit confirmed this is also the #2 first-time-user blocker, not just a Lumé issue — article cards are `target="_blank"` links out (`EditorialView.js:885–896`; on mobile the tap reads as *broken* — nothing visibly happens), and listing cards fling users to the dealer site in a new tab with no outbound cue (`Card.js:223` → `CardShell.js:136`), defeating the otherwise-solid back-safety. The article body prose is already loaded by the app (`*_bodies.json`) — only the in-app reading surface is missing. See audit findings U-02/U-03.

### B-57 — Same-brand reference collisions in the curated index (model_line ambiguity)
- **Reported:** 2026-06-02 (Claude, sweep while fixing B-54) · **Type:** Data quality / categorisation · **Severity:** 3 · **Surface:** `docs/watch_references.md` · **Status:** Largely fixed (branch `b57-reference-collisions`) — 2 flagged for Mark to verify. **Detail:** a sweep found 77 refs mapping to >1 (brand, model_line). The cross-pollination guard already neutralises **cross-brand** collisions in practice (a Rolex listing can't match a TAG Heuer entry), and most same-brand ones are intentional *layered* entries (a ref under both `Carrera (vintage)` and `Carrera (additions)` — same watch). The genuinely-risky residue is **same-brand, different-family** refs, where the matcher just takes whichever the index ordered first (exactly how 14270 went wrong). Shortlist to adjudicate: Patek `5236P` (Calatrava vs Perpetual Calendar), Cartier `WJTA0001` (Crash vs Tank Américaine), IWC `IW5004` (Big Pilot vs Portugieser), UG `222102`/`22409` (Aero-Compax vs Tri-/Uni-Compax), Lange `216.026` (Richard Lange vs Saxonia) + `233.026`, Patek `5004` (Chronograph vs Grand Complications), Rolex `16264`/`17013`/`17014` (Datejust vs Turn-O-Graph/Oysterquartz). **NB** the broader list also touched Heuer `73643NT` (Camaro vs Carrera) — handle per Mark's standing "don't generalise Camaro→Carrera" note; do NOT auto-edit. **Action:** review the shortlist with Mark; correct genuine mis-files in the source `.md`; leave layered same-family entries alone. **Resolved (2026-06-02, web-search adjudicated):** removed the wrong-family entry for **7** refs — Patek `5236P` (off Calatrava → Perpetual Calendar), IWC `IW5004` (off Portugieser → Big Pilot; index already flagged it "n/a"), Lange `216.026` (off Richard Lange → Saxonia; was an index typo), Lange `233.026` (off Lange 1 → 1815), Heuer `73463` (off Autavia → Skipper), UG `22409` (off Aero-Compax → Compax/Uni-Compax), Rolex `69173`/`69178` (off Oysterquartz → Lady Datejust). **Deliberately left:** annotated cross-refs the curator intended — Patek `5004` ("also in chronograph section"), Lange `403.x` ("see Datograph"), Rolex `16264`/`17013`/`17014` (annotated Turn-O-Graph/Oysterquartz, all still Datejusts), Lange `117.025` (Grand Lange 1 = Lange-1 family); plus parser-fragment tokens (VC `000R`/`4000E`, Patek `1A-001`) and same-watch dups (Tudor Submariner/snowflake, Prince Oysterdate). **FLAGGED for Mark to google:** (1) Cartier `WJTA0001` — my search says Tank Américaine (code pattern WxTA + WJTA0057 confirmed TA), but the index annotates it "Crash Tigrée" — conflict, left as-is pending Mark; (2) Breitling `765` — couldn't locate a clean Refs-line entry to act on. Source `.md` edited + `watch_references_index.json` rebuilt; `tests/test_reference_match.py` green.

### B-76 — lume-eval runs a paid (often Opus) live eval on every chat/prompt PR (cost leak)
- **Reported:** 2026-06-18 (Mark — ran out of ~$50 Anthropic credit in under a day) · **Type:** Tech-debt / cost · **Severity:** 2 · **Surface:** `.github/workflows/lume-eval.yml` + `tools/lume_probe.py` · **Status:** Open. **Detail:** the burn was traced (Supabase `ai_chat_usage` showed live chat was Haiku-only and well under $1) to the **eval/test path**, not chat: `lume-eval.yml` triggers on `pull_request` whenever `public/lume_system_prompt.txt`, `api/chat.js`, `api/lume_reference.js`, or `src/lume_eval*` change, and runs the full multi-turn scenario suite against the **real** models (Opus-routed turns at $5/$25 per M) plus an LLM judge — hundreds of paid calls per matching PR. This session merged ~8 Lumé PRs each touching those paths, so the suite ran ~8×; #902's temp force-Opus pushed every chat turn to Opus on top. **Fix (cheap, high-leverage):** gate `lume-eval.yml` to `workflow_dispatch` (+ optional `schedule`) instead of per-PR `pull_request` — a one-line `on:` change. **Also:** set an Anthropic Console spend alert/cap so a runaway eval can't silently drain credit again. Keep the judge model on Haiku.

### B-84 — Lumé's replies still don't feel right (Mark, unresolved since the 06-18 A/B)
- **Reported:** 2026-08-31 (Mark, real use — "I'm still not liking the way lume responds"; the *still* points back at the 2026-06-18 weak-chat-feel thread that `LUME_FORCE_SMART_MODEL` was built to diagnose and that was never concluded) · **Type:** Quality / product-feel · **Severity:** 2 · **Surface:** `public/lume_system_prompt.txt` + `chooseModel` in `api/lume_reference.js` · **Status:** Open — **not yet diagnosed; Mark hasn't said which failure mode he means.** Needs his read before anyone edits the prompt.
- **What "responds" could mean** (materially different fixes, don't guess): voice reads generic/AI · too hedged and non-committal · too long / not skimmable · shallow, no real opinion · answers the wrong thing (pivots to listings) · facts thin or wrong. **First step next session: get Mark to name it, ideally with one bad transcript pasted in.**
- **Two standing suspects, both unverified:**
  1. **Prompt overload.** `lume_system_prompt.txt` is **141 lines**, the large majority of it prohibitions (NEVER/DON'T/never say…). A rule wall is a known driver of cautious, hedge-y, formulaic replies — the voice section (~6 lines) is heavily outweighed by the don't-list. Candidate: restructure into a short character brief + the hard grounding contract, moving the format/filter mechanics into tool descriptions where they belong.
  2. **The A/B was never concluded.** `chooseModel` still routes Haiku by default and Opus only on compare/why/recommend intents or >400-char prompts (`api/lume_reference.js:48-65`), and the temporary `LUME_FORCE_SMART_MODEL` diagnostic switch is still in the code. **Nobody has checked whether it's still set in Vercel** — if it is, live chat is all-Opus and the routing is moot. Check the Vercel env first; then either write the A/B's answer into the code as the new default or retire the switch.
- **Method note (CLAUDE.md):** verify on the REAL path — run the actual multi-turn conversation (`tools/lume_probe.py`, or subagents on the real prompt + real tool data) and read the answers. A green unit test proves nothing here; this exact feature has shipped broken that way twice. Mind **B-76** (the eval suite is a paid-model cost leak) before running the full scenario set.

### B-16 — Dependencies unpinned (no lockfiles, JS + Python)
- **Reported:** 2026-05-24 · **Source:** `audit:2026-05-24` · **Severity:** 2 (reliability + supply-chain) · **Surface:** build / CI / workflows · **Status:** Python pinned #578. **JS lockfile — mechanism shipped 2026-06-02**, rollout held: added `.github/workflows/generate-lockfile.yml`, a manual-only Action that cloud-generates `package-lock.json` (Mark has no local npm) and opens a PR with it. **Not yet dispatched** — committing the lockfile auto-switches *Vercel* to `npm ci`, which would break any in-flight branch that adds a JS dep, so dispatch is held until the two front sessions merge. **Remaining (one follow-up after those merge):** dispatch the Action → merge the lockfile PR → flip `tests.yml` jest job `npm install`→`npm ci` + enable setup-node npm cache. Procedure is documented in the workflow's header comment.
- **Detail:** No `package-lock.json`; workflows `pip install` latest unpinned. A build that works today can break tomorrow with no code change, and it's a supply-chain exposure (updates run with the scrapers' secret keys). Cheapest high-leverage fix in the audit.
- **Done (#578):** pinned `requirements.txt` / `requirements-auctions.txt` / `requirements-ai.txt`; all 11 runtime workflow steps now `pip install -r`.
- **Remaining:** commit `package-lock.json` + switch CI/Vercel to `npm ci` (needs Node); optionally Dependabot for deliberate bumps. Detail: `findings-maintainability.md` (HIGH-1), `findings-security.md` (MED-2/3).

### B-22 — App ships as one bundle; heavy tabs aren't code-split
- **Reported:** 2026-05-26 · **Source:** `audit:2026-05-24` (H1) · **Severity:** 2 (perf / first-load) · **Surface:** `src/App.js`, `src/index.js` · **Status:** Partly fixed — **AdminTab code-split #579**; phase 2 open. **DEFERRED 2026-05-29 (Mark):** do it when he can verify in-app — a `React.lazy` default-vs-named-export slip could white-screen a surface and there's no local Node to run the CRA build (only CI would catch it). Overlaps B-34's ReferencesTab-subtree lazy-load.
- **Detail:** No `React.lazy`/`Suspense` anywhere; `App.js` statically imports every heavy surface (AdminTab, EditorialView, SizeCompare, ChallengeFlow, the share/list/challenge receivers, all modals, SearchResultsView), so every visitor downloads + parses their code on first load even though most never open them.
- **Done (#579):** AdminTab (admin-only) `React.lazy` + `Suspense` — its chunk now loads only when an admin opens the tab.
- **Remaining (phase 2):** the receivers (mount only on inbound share/challenge/list links), `EditorialView`, `SizeCompare`, `ChallengeFlow`, modals. Confirm where each is imported (some are inside sub-components, not App.js). Detail: `docs/audits/2026-05-24-vibe-code/findings-frontend.md` (H1).

### B-27 — Inert-code visibility scan (maintenance thread)
- **Reported:** 2026-05-26 · **Type:** Maintenance/hygiene thread, not a defect · **Severity:** 3 (maintainability) · **Status:** First scan run 2026-05-28 (`/tidy`) — see results below; thread stays open as a recurring sweep.
- **Scan results (2026-05-28):** swept scrapers, components, and exports. Findings: (1) `phillips_known_auctions_scraper.py` — in no workflow, output CSV read by nothing → **removed (#654)**. (2) `windvintage_guides_scraper.py` — not in CI, but its `public/windvintage_guides.json` is a committed corpus file referenced in REFERENCE_INTELLIGENCE → **kept** (Mark's call; manual/one-off corpus, like `manual_archive_scraper.py`). (3) `ListManagePanel` — already retired; only a JSX comment remains in `CollectionsTab.js`. (4) `bonhams_lots_scraper.py` / `manual_archive_scraper.py` — intentionally not in CI (residential launchd / manual archive pipeline), not orphans. No other inert code found. (Also cleaned ~26 stranded/merged branches + 2 leftover worktrees same pass.)
- **Scan results — pass 2 (2026-05-28, frontend + workflows):** fanned out across `src/` + `.github/workflows/`. Findings: (1) `src/components/SubTabIntro.js` — retired component, **0 imports** (only a stale "Imported as <SubTabIntro/>" comment in `WatchlistTab.js` + retirement breadcrumbs elsewhere); IA Phase-2 dispatch is a *new* shared component, not this → **deleted (this PR)** + stale comment corrected. (2) `src/hooks/useLastVisit.js` — **0 references**, orphaned by the feed-screening retirement, BUT the "what landed since you last opened" computation is the planned consumer for the Home/Watchlists **pulse / new-since-visit** surface (B-32, [[watchlists_pulse]]) → **kept with a `DORMANT:` marker** (this PR), not deleted. (3) `src/components/Eyebrow.js` — 0 imports but it's **forward prep** for the handoff's typography "Eyebrow promotion" follow-up → **kept** (intentional, not inert-by-neglect). (4) `windvintage_guides_scraper.py` re-surfaced → already adjudicated keep in pass 1. (5) Workflows clean: `scrape-listings-matrix.yml` is intentionally `workflow_dispatch`-only; `notify-scrape-failure.yml` is a `workflow_run` listener. (6) **Prior-handoff note corrected:** App.js does NOT import a dead `ListReviewMode` — `CollectionsTab.js` imports it and renders it live. *Lesson reinforced: an automated dead-code finder mis-called 3 of 6 (Eyebrow/windvintage/ListReviewMode) without plan-context — always filter findings against handoff/ROADMAP/memories before acting.*
- **Why:** building B-24 surfaced that `enumerate_bonhams` was complete and wired into `ENUMERATORS` but **inert in CI** (Cloudflare 403) — code that exists, looks live, but never produces output in its current environment. Its docstring even claimed "works cleanly from CI" (true once, then false). This is a *different* axis than the 2026-05-24 vibe-code audit (which covered correctness/security/perf, not dormant-but-valid code), so it's not tracked anywhere. Mark's question (2026-05-26): "how much of this is in the codebase, just not visible?"
- **Scope of the scan:** find code that is wired in but effectively inert — enumerators/scrapers that return `[]` in their runtime, workflows built but never scheduled (e.g. `scrape-listings-matrix.yml`), flag-guarded **retired UI surfaces** (CLAUDE.md's "don't reintroduce" list), dead imports (e.g. App.js imports `ListReviewMode` but renders it 0× — noted in a prior handoff). For each: decide keep-with-marker / reactivate / delete.
- **Convention to adopt:** dormant-but-valid code carries a `DORMANT:` marker stating *why it's inert + what reactivates it* (done for `enumerate_bonhams`, #-this-PR). And: sanity-check plan docs (BUGS/ROADMAP) against actual code before writing "build X" (the B-24 framing miss). Pairs with the `/maintenance` skill.

### B-34 — Load-speed audit: measure + improve first-paint; verify Vercel downgrade impact
- **Reported:** 2026-05-27 · **Type:** Performance · **Severity:** 2 · **Surface:** first-load / Vercel hosting · **Status:** Largely fixed 2026-05-28 (#646–#651). **Done:** wsrv image resize (payload ~198→~13 MB; desktop LCP 19→6 s); below-fold home strips deferred + eager LCP + `listings_desc` idle-loaded; AuctionCalendar/Search-all code-split; Blob→thumbnails (storage ~242→~20 MB). Vercel-downgrade question answered: the cap that paused us was **Blob transfer**, not site bandwidth (6/100 GB). **One follow-up:** ~~re-run PageSpeed mobile for the after-baseline~~ DONE 2026-06-06 (Mark ran it; PDFs in docs/audits-adjacent chat): **Home mobile 48** (was 35) · Home desktop 42 · Articles desktop 66. Diagnosis: FCP is excellent everywhere (0.2–0.8s — the B-17/B-34 work held); the wound is **LCP** (33.8s mobile / 5.7s desktop Home, 12.5s Articles), root-caused to **article images bypassing the imgSrc wsrv proxy** (raw 2MB blogger originals) → fixed in **#825**; re-run after it deploys for the next baseline. Remaining levers after that: **TBT ~950ms on Home** (bundle parse + data processing — the B-22 code-split phase 2 + ReferencesTab-subtree lazy-load) and the PageSpeed "efficient cache lifetimes" flag (main.js reported Cache TTL None — verify Vercel's static-asset headers; likely a vercel.json headers block). **Round 3 (post #825–#829):** Saved desktop **68** — no image/cache findings left at all; TBT 240ms, CLS 0. The entire residual gap on every page is the B-22 JS split.
- **Detail:** Measure real load speed (first paint + time-to-interactive) and find the wins. **Check whether the recent Vercel Pro→Hobby downgrade changed anything** (edge caching / bandwidth / build limits). Known levers already on the roadmap: ~22 MB JSON on first paint (listings.json split **Phase 2** + lazy-gate non-default fetches), **code-split Phase 2** (B-22), a CI size-budget guard. Deliverable: a before/after baseline (Lighthouse / WebPageTest) + a prioritized fix list. Pairs with ROADMAP "Payload + data-growth budget".

### ⓒ Epic C — Auctions & Scraping
*The parallel backend session's domain. Phase-0-adjacent; mostly shipped, with
install/decision tails remaining.*

### B-28 — Editorial sources may be filtering out fresh (non-vintage) articles
- **Reported:** 2026-05-27 · **Type:** Scrape/content completeness · **Severity:** 3 · **Surface:** editorial scrapers / corpus inclusion filter · **Status:** Open — **log only, not now** (Mark).
- **Detail:** Mark saw new Fratello articles today that aren't on our site; believes the scrape IS running and working. Hypothesis: a **vintage-only inclusion filter** excludes fresh/non-vintage posts, so new general articles never enter the corpus. Verify whether the filter is intentional (we only want vintage-relevant) or too aggressive, and check the Fratello (+ peer source) scraper's inclusion predicate + recency window.

### B-58 — Watch Center scraper silently blocked from CI (no new data since 2026-05-30)
- **Reported:** 2026-06-05 (Mark spotted lack of new Watch Center listings) · **Type:** Scrape defect · **Severity:** 2 · **Surface:** `watchcenter_scraper.py` (CI step in `scrape-listings.yml`) · **Status:** ✅ Resolved 2026-06-09 — the curl_cffi Chrome-impersonation probe shipped and CI now scrapes cleanly (430 listings, multiple clean runs verified); B-60's gate guards against a silent relapse. **⚠ Regressed 2026-08-18 with a different failure mode (HTTP 503, not an IP block) — see B-80.** **Detail:** `data/watchcenter.csv` last committed 2026-05-30 despite the workflow running 3×/day. Every recent run, the scraper step exits 1 with `RuntimeError: Network is unreachable` hitting `watchcenter.ch:443`; `continue-on-error: true` keeps the workflow green and the move step prints "watchcenter missing" so `merge.py` quietly keeps the prior state. Verified the failure pattern across the last 5 runs (every one had `watchcenter missing`). Live API is healthy from residential (`HTTP 200`, 2 s, 430 products = same count as our snapshot). **Hypothesis:** watchcenter.ch (Swiss WooCommerce, Mendrisio) IP-blocks GitHub Actions ranges — common geoblock pattern for EU e-commerce. **Probe (this PR):** swap `requests` for `curl_cffi` with `impersonate="chrome"`; if it's a TLS/JA3 block rather than pure IP, this gets through (same mechanism Chrono24/Bonhams use). If still blocked, fallback is the residential pattern (move to laptop launchd → `public/watchcenter_extra.json`, frontend folds by URL).

### B-59 — Watch Club scraper chronically tripping the truncation safety (frozen at 61 since 2026-06-04)
- **Reported:** 2026-06-05 (sweep alongside B-58) · **Type:** Scrape defect / upstream change · **Severity:** 3 · **Surface:** `watchclub_scraper.py` · **Status:** ✅ Fixed #860 — root cause was the liveness filter, not upstream shrink: Watch Club reshuffles live stock across several non-`30` status codes, so keying live on `status=="1"` saw a flapping 15-62 subset that tripped the guard. Now `sold = status=="30"` → stable ~65 live, ~48 recovered. **Detail:** Every run for at least the last 7 logs the abort: `⚠ Aborting write: 15 active items is below 50% of prior 61. Catalog snapshot likely truncated upstream — keeping previous data/watchclub.csv so merge.py doesn't false-flag the missing items as sold.` So the file is preserved at 61 rows (good — no false-sold storm), but Watch Club is effectively frozen. **Hypothesis:** the TaffyDB catalog at `watchclub.com/upload/js/watches2018_bis.js` is genuinely returning ~15 active items now — either upstream genuinely shrunk and the historical 61 is a stale floor, or pagination/filtering changed in the catalog blob. **Action:** fetch the JS blob, count `status:'live'` vs `status:'sold'` entries; if 15 is real, lower the absolute-floor guard (currently `<50% AND <25 absolute`) or adjust the prior baseline. Not urgent (no false data), but they're invisible to us until decided.

### B-60 — Silent scrape failures don't trigger the failure notifier
- **Reported:** 2026-06-05 (meta-finding while diagnosing B-58) · **Type:** CI / observability · **Severity:** 2 · **Surface:** `.github/workflows/notify-scrape-failure.yml` + every scrape step in `scrape-listings.yml` · **Status:** ✅ Fixed #859 — a final `always()` scrape-health gate (`scrape_health_gate.py`) fails the job when any source produced no CSV ("X missing") or `verify_sources` logged an ERROR, turning the workflow red so the notifier fires. **Detail:** Every scrape step has `continue-on-error: true` (correctly — keeps one bad site from killing the batch). The notifier listens on `workflow_run` for overall `conclusion: failure`, so when a single step exits 1 but the workflow still reports `success`, no GitHub Issue gets auto-opened. B-58 sat unnoticed for 6 days until Mark spotted the absence of new listings — exactly the failure mode the notifier exists to prevent. **Hypothesis:** add a per-source diagnostic step at the end of the scrape job that grep's the move-step output for "X missing" lines and / or `Process completed with exit code 1` traces, then either fails the job (loud) or opens a digest issue (gentler). Pairs with B-15 (the empty-scrape false-sold guard) — both about catching silent rot.

### B-77 — Sotheby's LIVE-auction realized prices not captured (embargoed behind sign-in)
- **Reported:** 2026-06-18 (Mark — June 15 "Important Watches" had no sold prices) · **Type:** Scrape / data accuracy · **Severity:** 2 · **Surface:** `auction_lots_scraper.py` `enumerate_sothebys` + the `lotCardsConnection` GraphQL · **Status:** Open — root-caused live; fix needs a decision.
- **Detail:** "Important Watches" (June 15, incl. the Steve McQueen Heuer Monaco lot 71, publicly *"Lot Sold 640,000 USD"*) came in with **0 sold prices, all 205 lots stuck `status=active`**, while "Fine Watches" has 519/574 prices. **Root cause (verified from residential 2026-06-18):** it's auction *type*, not sign-in across the board. **Fine Watches** = `TimedAuctionDates` (online-only) → the card GraphQL returns `bidState.sold = ResultVisible{isSold, finalPriceV2}` and we capture prices fine. **Important Watches** = `LiveAuctionDates` (live in-room) → the *same* GraphQL returns `bidState.sold = ResultHidden` for every lot even after close (`dates.closed = 2026-06-15T20:08`), **and** the unauthenticated lot-detail `__NEXT_DATA__` is *also* `ResultHidden` (the string `640000` is nowhere in the server payload). The "Lot Sold" figure renders client-side from a signed-in session. So Sotheby's **embargoes LIVE-auction realized prices behind authentication**; our scraper (datacenter OR residential, unauthenticated) can't read them, and the existing Antiquorum-style detail-refetch fallback won't help (the detail page hides them too).
- **Options (Mark's call):** (a) **Monitor** — re-check whether Sotheby's later flips live-sale results to public `ResultVisible`; if it does, the normal scrape catches up automatically (these lots are `active` and re-fetched each run). 3 days post-close it was still hidden. (b) **Authenticated fetch** — capture a signed-in Sotheby's session (Mark's login + cookie), find the client-side results query, fetch realized prices for ended live-sale lots. A real mini-build needing credentials + secure secret handling.

### B-78 — Bonhams calendar: stale Weekly sales not pruned; affiliated houses (Bruun Rasmussen / Bukowskis) missing
- **Reported:** 2026-06-18 (Mark — a calendar card linked to a Bonhams "Page not found") · **Type:** Scrape / data hygiene + source gap · **Severity:** 3 · **Surface:** `bonhams_auctions_scraper.py` + the auctions-calendar merge (`public/auctions.json` / `auctions_state.json`) · **Status:** Open — root-caused live.
- **(1) Stale Weekly entries.** `public/auctions.json` holds **three** "Weekly Watches" sales: the current `/auction/31991/` (ends 2026-07-08, the card Mark saw) plus two expired ones — `/auction/32159/` (dateEnd **2026-05-05**, still flagged `status="upcoming"`) and `/auction/31989/` (dateEnd 2026-05-06, `status="past"`). Bonhams' weekly sales recycle ids and old sale pages eventually 404. All three currently return 200, so the *exact* link Mark hit couldn't be reproduced 2026-06-18 (likely a since-expired id), **but** the un-pruned past-and-still-"upcoming" entry (32159) is a real hygiene bug. **Fix:** prune calendar entries whose `dateEnd < today` (esp. ones still `status="upcoming"`) in the auctions merge/persistence; check `auctions_state.json` retention.
- **(2) Affiliated houses missing → graduates to ROADMAP Epic 1.** The scraper reads only the watches **department** page (`/department/WCH/watches/`), which serves 2 Bonhams-own sales and **zero** affiliated-house sales (verified: no "bruun"/"bukowski" in that page; it does mention Cornette/Skinner). Bruun Rasmussen (`bruun-rasmussen.dk`) and Bukowskis (`bukowskis.com`) — both Bonhams-network houses — list their watch sales on the **main** calendar (`/auctions/` contains both) and link OUT to their own domains. Capturing them is a **new-source effort** (scrape the main calendar for network-house watch sales, keep the off-domain URLs; their lots live on their own platforms → eventually per-house lot scrapers). Logged here so it isn't lost; the build belongs under ROADMAP Epic 1 (sources).

### B-79 — Luna Royster: one dropped page discarded the entire walk (3 consecutive misses)
- **Reported:** 2026-08-30 (Mark — "run errors in my emails") · **Type:** Scrape defect (ours) · **Severity:** 2 · **Surface:** `lunaroyster_scraper.py` `fetch_page` / `get_all_listings` · **Status:** ✅ Fixed this PR.
- **Detail:** LR's catalog walks ~19 pages at `per_page=100` and the host intermittently 502s a single deep page under that load. Run 33277800977 (2026-08-29 22:40): `RuntimeError: page 19 failed after 3 attempts: HTTP 502` — pages 1-18 had come back clean and were thrown away with the exception, so no CSV was written at all. Three of those in a row crossed the B-60 gate threshold and paged Mark. The 2m12s step time is the retry ladder, not a slow site.
- **Fix:** `fetch_page` returns `None` instead of raising; the walk stops at the dropped page and keeps what it has; `main()` applies the same truncation guard Watch Club uses (B-59) — skip the CSV write only when the result is BOTH under 50% of the prior run AND under the 25-item floor, so a genuinely gutted snapshot still can't make `merge.py` false-flag the missing items as sold. 8 tests in `tests/test_lunaroyster_partial_walk.py`.

### B-98 — Chronoholic + ClassicHeuer: scraping "fine" but byte-identical for 3 weeks
- **Reported:** 2026-09-09 (surfaced by the freshness gate, which is doing its job) · **Type:** Scrape defect (suspected) · **Severity:** 3 · **Surface:** `chronoholic_scraper.py`, `classicheuer_scraper.py` · **Status:** Open — not yet investigated.
- **Detail:** Both produce a CSV every run, so no missing-source gate fires, but their content fingerprint has not changed since **2026-08-17 / 08-18** — 22 and 23 days, past the 21-day dealer budget. Chronoholic 119 rows, ClassicHeuer 117 rows, unchanged.
- **Two readings, and the difference matters:** either the dealers genuinely have not moved a single item in three weeks (possible, but 119 and 117 items with zero churn is a lot of nothing), or we are being served a cached snapshot while believing we scraped. **The second is the Shuck the Oyster shape** (2026-09-04): a scrape that succeeds every run, returns a plausible count, and is quietly frozen. There, the archive genuinely had not changed and the alarm was false — worth remembering before assuming rot here.
- **Cheapest next step:** `source-probe` each storefront with `show_body=true` and compare the first page of items against the committed CSV. If they match, the dealers really are static and the 21-day budget is simply tight for them; if they differ, we are reading something stale and it is ours.
- **Note the gate got this right.** It is the check catching exactly what it was built for (a source rotting while every other signal says green). Don't widen the budget to silence it without first establishing which of the two readings is true.

### B-97 — Maunder Watches blocked by a SiteGround captcha; Watches of Knightsbridge is ours
- **Reported:** 2026-09-07 (Mark — "Scrape listings: All jobs have failed"; run 34151928856) · **Type:** Scrape defect · **Severity:** 2 · **Surface:** `maunderwatches_scraper.py` + `watchesofknightsbridge_scraper.py` · **Status:** Open — both root-caused by live CI probe 2026-09-08. They looked like one bug and are two.
- **They are NOT the same failure.** Both missed 3 consecutive runs and crossed the B-60 gate in the same window, which made a shared cause look obvious. Probing each endpoint from a runner says otherwise:
  - **Maunder — not ours.** `https://www.maunderwatches.co.uk/wp-json/wc/store/v1/products` returns **HTTP 202, `sg-captcha: challenge`**, and a 221-byte body that is only a meta-refresh to `/.well-known/sgcaptcha/`. That is **SiteGround's captcha**, i.e. their host's bot protection, not a dealer decision. curl_cffi cannot help: it fixes TLS fingerprints, never a captcha (B-81). Options are the residential agent (the Bonhams pattern) or a dated snooze. Nothing else in this repo touches it.
  - **Watches of Knightsbridge — ours.** The same endpoint served **HTTP 200 with valid JSON and `x-wp-total: 573`** to a CI runner. The site is not blocking us at all, so the three missed runs are our scraper's. Its traceback is `JSONDecodeError` at `watchesofknightsbridge_scraper.py:67`, on a body that passed `raise_for_status()` — so a 2xx that isn't JSON. Note `server-timing: cfOrigin;dur=1094` for a **single** product: at `per_page=100` the origin plausibly runs past Cloudflare's timeout and returns an HTML error page. First thing to try is a smaller page size plus the B-79 partial-walk retention, so one bad page stops discarding the whole walk.
- **Why this is not urgent:** `merge.py` keeps the prior CSVs, so both dealers still show in the app (WoK 61, Maunder 72). They are going stale, not disappearing.
- **The lesson worth keeping:** two sources failing together in one week reads as one cause, and a single probe each disproved it. Probe before writing code.

### B-80 — Watch Center back down: HTTP 503 from CI for 37 consecutive runs (B-58 regression, new failure mode)
- **Reported:** 2026-08-30 (Mark — email alerts) · **Type:** Scrape defect (upstream) · **Severity:** 2 · **Surface:** `watchcenter_scraper.py` · **Status:** Open (upstream) — **snoozed to 2026-09-13** via #938; Mark confirmed the storefront is dead in a browser too and has contacted the dealer.
- **Detail:** `RuntimeError: page 1 failed after 3 attempts: HTTP 503`, every run, 37 consecutive misses (≈12 days). `merge.py` is holding the last good snapshot, so the site still shows 422 Watch Center listings — all of them stale. Confirmed independently via `source-probe.yml` on 2026-08-30: `https://watchcenter.ch/wp-json/wc/store/v1/products` returns **503 with a 16,728-byte body and zero Cloudflare challenge markers**.
- **Why this is NOT a repeat of B-58:** B-58 was `Network is unreachable` (an IP-range block) and the curl_cffi Chrome-impersonation probe fixed it. This is a **503 with a real error page body** — the request is reaching the origin and the origin is failing, so it is not fingerprint- or IP-driven and no amount of impersonation will move it. Most likely the WooCommerce Store API is disabled/broken on the dealer's side, or the site is in a sustained outage.
- **Resolved on our side (2026-08-30):** Mark checked the browser — the whole storefront is down, so this is a dealer outage and nothing here can fix it. The per-source snooze this entry proposed shipped as #938: `data/scrape_health_snooze.json` mutes `watchcenter` until **2026-09-13**, still printing a `::notice::` every run and re-paging itself on expiry.
- **Next (on expiry):** if it is back, delete the snooze entry — the gate flags a stale one every run. If it is still 503ing, the REST API is likely gone for good and the source needs a different ingestion path or retiring. Note that 427 stale Watch Center listings stay live on the site throughout.

### B-81 — Watches of Lancashire: 403 even with curl_cffi Chrome impersonation (11 consecutive misses)
- **Reported:** 2026-08-30 (Mark — email alerts) · **Type:** Scrape defect (upstream anti-bot) · **Severity:** 2 · **Surface:** `watchesoflancashire_scraper.py` · **Status:** ⚠ **Open — NOT resolved.** #937 moved it off CI to the residential host on a diagnosis that turned out to be wrong (see the correction below); it 403s there too. Parked, needs a retire-or-ask-the-dealer decision.
- **Detail:** `RuntimeError: page 1 failed after 3 attempts: HTTP 403`, 11 consecutive misses (≈4 days); 54 stale listings held by `merge.py`. The scraper already runs `cf_requests.Session(impersonate="chrome")` with a `Referer` — the impersonation that used to work (docstring: "confirmed plain requests 403s while `impersonate="chrome"` returns 200") no longer does. `source-probe.yml` 2026-08-30 on plain curl: **403, 5,795-byte body, challenge markers present** — so the site is serving an anti-bot challenge page, and it is now catching the impersonated client too.
- **Hypothesis (DISPROVEN — do not retry):** that the scraper was hitting `/wp-json/` cold and a warm-up GET on the HTML page would earn a Wordfence/Cloudflare clearance cookie, the way Luna Royster does. A CI probe of the site **root** on 2026-08-30 returned **403 with challenge markers present** — the homepage 403s too, so there is no page to warm a cookie from. This is a whole-domain block on GitHub's IP ranges, not an endpoint quirk.
- **Fix (#937):** same class as Bonhams (B-25/B-72), same answer — the scraper step and its `scrape_move.log` move-step line come out of `scrape-listings.yml` (**removing the move line is what stops the paging**; the B-60 gate counts misses by grepping that log for `" missing"`, so a dead step would fail every run forever), and the source joins the existing residential LaunchAgent. `merge.py` is untouched — `data/watchesoflancashire.csv` just arrives by a different route. `source_freshness.py` still tracks the CSV, which is the right remaining alarm: it catches "the laptop stopped producing" without re-reporting a known block 3×/day.
- **⚠ CORRECTED 2026-08-30 — every earlier hypothesis was wrong. Do not re-derive.**
  - *Not* a cold-endpoint / missing-clearance-cookie problem: the site **root** 403s too, so there is no page to warm a cookie from.
  - *Not* a datacenter-IP block either, which is what #937 assumed when it moved the scraper to the laptop. Probed from Mark's home broadband (Cox, residential California): **`http=403`, `cf-mitigated: challenge`, `server: cloudflare`, body carrying `_cf_chl_opt` / "Just a moment" / "Enable JavaScript and cookies".** `cf-mitigated: challenge` is Cloudflare stating outright that this is a **challenge**, not a reputation block.
  - **What it actually is:** a Cloudflare JS challenge served to *every* client. curl_cffi fixes TLS/JA3 fingerprinting, which is why it worked until ~2026-08-16 and then stopped; it cannot execute JavaScript. A residential IP changes nothing. **Moving hosts cannot fix this, and #937 did not fix it** — it relocated the failure somewhere quieter.
  - **Monitoring cost of that move:** the stale CSV still exists and is non-empty, so `source_freshness.py`'s `lastSeen` keeps advancing and the 3-day budget never fires; only the **21-day** `lastChanged` budget catches it. Detection went from ~1 day to ~21 days.
  - **Real options (needs a Mark decision):** ask the dealer for a feed / API access or an allowlist (we send them traffic), or retire the source. Solving the challenge programmatically is out of scope — it is bot-detection bypass, and the challenge is the dealer's explicit signal about automated access.

### B-82 — `scrape-single.yml` can't run any curl_cffi scraper (installs only `requirements.txt`)
- **Reported:** 2026-08-30 (found while trying to re-run B-80/B-81 manually) · **Type:** CI / tooling · **Severity:** 3 · **Surface:** `.github/workflows/scrape-single.yml` "Install dependencies" · **Status:** Open.
- **Detail:** The manual single-source re-run installs `requirements.txt` only, while `scrape-listings.yml` installs `requirements.txt -r requirements-auctions.txt` (curl-cffi). So the exact sources most likely to need a manual re-run after a parser/anti-bot fix — `watchcenter` (`sys.exit("curl-cffi not installed")`) and `watchesoflancashire` (module-level `from curl_cffi import requests`, ImportError) — are the ones this workflow cannot run. Diagnosing a block through it yields a misleading dependency error instead of the real HTTP status.
- **Fix:** one line — match the listings workflow's install step.

### B-83 — Watches of Knightsbridge: same all-or-nothing pagination as B-79
- **Reported:** 2026-08-30 (found while chasing a fresh gate miss) · **Type:** Tech debt (latent scrape defect) · **Severity:** 3 · **Surface:** `watchesofknightsbridge_scraper.py` `get_all_listings` / `main` · **Status:** Open.
- **Detail:** The page loop calls `r.raise_for_status()` inline, so one bad page raises and discards every page already fetched — the exact shape B-79 fixed in Luna Royster. There is also no truncation guard before the write, so a partial catalog can be written whole. `wok` sits at **1 consecutive miss** as of run 402 (2026-08-30 17:51 UTC), below the paging threshold; it also flapped at 1 miss during the B-79 investigation with an HTTP 202 interstitial, so this is a recurring intermittent, not a one-off.
- **Fix:** port the B-79 shape — `fetch_page` returns `None`, the walk stops and keeps what it has, and `main()` gates the write on the standard guard (<50% of prior AND <25 absolute).
- **Note:** the site went behind Cloudflare TLS/JA3 fingerprinting in 2026-08 and was fixed with `impersonate="chrome"` on the **floating** alias (`chrome124` was 403 in the same probe). If the streak reaches 3 and the block is the cause rather than a flap, the answer is the residential host (B-25/B-72/B-81), not a new impersonation guess.

### ◆ One-off (no epic)
*Small correctness fix.*

### B-31 — Search results: Auctions strip cards misaligned
- **Reported:** 2026-05-27 · **Severity:** 3 (visual) · **Surface:** `SearchResultsView` Auctions strip (`Strip`→`CardStrip`/`Card`) · **Status:** Mark reported DONE 2026-05-29 (verbal) — its siblings B-32/B-33 are confirmed shipped (#670-era), so this is almost certainly folded into the same CardStrip work, but the specific auction-card alignment isn't independently verified. **The one open item left here is a visual spot-check** (no PR to cite); confirm in-app next time the Home search-all is open, then close.
- **Detail:** In the Home "search all" results, the **Auctions** strip cards don't line up with the Listings strip above (Mark screenshot 2026-05-27). Likely the auction item renders at a different card height/aspect in the shared `CardStrip` (countdown badge / image aspect / price line). Compare auction-vs-listing `Card` rendering and align the card dimensions within the strip.


### B-87 — Home strips rendered a grey "scroll bar" rail under every row except Articles
- **Reported:** 2026-08-30 (Mark, landing-page review) · **Type:** Visual defect / cross-surface inconsistency · **Severity:** 3 · **Surface:** `HomeTab.js` `SectionStrip` → `CardStrip` · **Status:** ✅ Fixed #940.
- **Detail:** Recently added / Recently sold / Ending next each drew a thin grey horizontal bar under the row that read as a dead scrollbar. Articles didn't. Not a real scrollbar (native ones are hidden in `CardStrip`): `SectionStrip` passed `background="var(--border)"` into `CardStrip`, and the strip's `padding: 0 0 4px` let that border-coloured container background show as a 4px rail beneath the tiles. The Articles strip is mounted directly in `HomeTab` without a `background` prop, so it defaulted to `transparent`.
- **Fix:** `SectionStrip` now passes `transparent` for the non-inverted variant, matching every other `CardStrip` on the site (`SearchResultsView`, `ReferencePage`, `LumeModule`, `LumeResultGrid`). Tiles still separate because `gap: 1` shows the page background through. The inverted-band variant keeps `var(--surface-on-dark)` (currently unmounted on Home).

## Landing-page review panel — 2026-08-30

Nine defects surfaced by the six-lens `/ui-review` panel on Home (see ROADMAP
Epic 9 "Home editorial pass" for the design sequence; only genuine defects are
here). Every one was verified in the source before logging.

**Status 2026-08-31:** six fixed with the Epic 9 build (#944-#951). Still open:
**B-90** (card ⋯ menu opens off-screen), **B-96** (36pt action buttons in the
swipe corner) and the remaining half of **B-94**. All three are `CardShell`
work rather than Home work, so they were left out of the Home pass deliberately
and want their own PR.

### B-88 — Card strips are unreachable with a mouse wheel: 13 of 20 tiles per row do not exist
- **Reported:** 2026-08-30 (ui-review panel, interaction lens) · **Type:** Interaction defect · **Severity:** 2 · **Surface:** `CardStrip.js` (site-wide: Home, SearchResultsView, ReferencePage, LumeModule, LumeResultGrid) · **Status:** ✅ Fixed #945 — hover- and focus-revealed prev/next arrows paging by one viewport less a tile, plus a mirrored left fade. Rows deliberately NOT capped: the tail was only dead travel while it was unreachable. Follow-up #951 fixed the left fade drawing over card 1 at rest (resting scrollLeft equals the container padding, not 0).
- **Detail:** `CardStrip` hides the native scrollbar (`scrollbarWidth: none` + the `::-webkit-scrollbar` rule), sets `overflowY: hidden` so a vertical wheel scrolls the page straight past the row, and registers no arrow buttons and no pointer-drag handler. A trackpad two-finger swipe works; a plain wheel mouse has no gesture at all. Measured on Home: each strip is 4259px wide inside a 1240px viewport, so **~79% of the content in every row is behind a gesture a wheel mouse cannot make**. The right-edge fade advertises that more exists and then offers no way to reach it.
- **Fix:** hover- and focus-revealed prev/next buttons on desktop paging by one viewport width less one tile; mirror the fade on the left once scrolled. Belongs in `CardStrip` so every strip on the site inherits it.

### B-89 — Rail overscroll chains into browser / PWA back-navigation
- **Reported:** 2026-08-30 (ui-review panel) · **Type:** Interaction defect (iOS PWA) · **Severity:** 2 · **Surface:** `CardStrip.js` `.wl-hscroll` · **Status:** ✅ Fixed #945 — `overscroll-behavior-x: contain` on the injected rule, mobile inset 16 → 24 to clear the iOS edge-swipe zone.
- **Detail:** the `.wl-hscroll` rule sets no `overscroll-behavior-x: contain`, so a rightward swipe at the start of a rail chains to the browser's back gesture. The mobile inset is 16px, which puts the first tile's grab surface inside the iOS edge-swipe zone, making it easy to hit by accident on the primary personal surface.
- **Fix:** add `overscroll-behavior-x: contain` to the injected rule; consider 16 → 24 mobile inset.

### B-90 — Card ⋯ menu opens off-screen near the bottom of the page and cannot be scrolled back
- **Reported:** 2026-08-30 (ui-review panel, verified in source) · **Type:** Defect · **Severity:** 2 · **Surface:** `CardShell.js` (menu trigger, `setMenuPos`) · **Status:** Open.
- **Detail:** the trigger computes `setMenuPos({ top: r.bottom + 4, right: … })` with no `window.innerHeight` check, no flip-above fallback and no `maxHeight`. The menu renders through `createPortal` at `position: fixed`, so once it opens past the viewport bottom **scrolling cannot bring it back** and the ⋯ reads as a dead button. Reproducible on the last strip of Home and anywhere a card sits low in the viewport.
- **Fix:** flip above the trigger when `r.bottom + estimatedHeight > innerHeight`, clamp with `maxHeight` + internal scroll. Needs a **direct render test** (`CardShell.test.jsx` pattern) since shell tests render mock grids and never execute CardShell.

### B-91 — No brand image at all in dark mode; wordmark contrast ~2.2:1
- **Reported:** 2026-08-30 (ui-review panel, measured live) · **Type:** Visual / accessibility · **Severity:** 2 · **Surface:** `MoonPhaseIndicator.js` (`if (dark) return null`), `HomeTab.js` `EditorialHero` · **Status:** ✅ Fixed (Epic 9 step 4) — plate flood-filled out of all 30 frames at a strict 248 threshold, `return null` deleted, wordmark moved to the theme-aware `--brand-olive-ink`. The May 2026 diagnosis was right about the symptom (an opaque pure-white plate behind the arc) but it was fixable at the source: the frames already had an alpha channel.
- **Detail:** `MoonPhaseIndicator` returns null in dark mode because the source PNGs ship a light halo. The landing page therefore opens in dark mode with **no image at all**, and the olive wordmark (`--brand-olive-text` `#3b4a36`) on near-black measures roughly **2.2:1**, below the 3:1 floor for large text. The brand's most distinctive asset is absent exactly where the page most needs one.
- **Fix:** redraw the moon as a two-token inline SVG from the maths already in `src/utils/moonPhase.js` (stroked disc + terminator ellipse). Deletes the dark-mode `return null`, removes an off-palette navy that exists nowhere in the token set, and drops a PNG fetch from the top of the fold. Move Home's wordmark to `--brand-olive-ink`.

### B-92 — Home Articles strip renders the entire array (no `max`)
- **Reported:** 2026-08-30 (ui-review panel) · **Type:** Perf / consistency · **Severity:** 3 · **Surface:** `HomeTab.js` (the Articles `CardStrip`) · **Status:** ✅ Fixed #944.
- **Detail:** every other Home row caps at `CARDS_PER_SECTION_DESKTOP` (20) / `_MOBILE` (14) via `SectionStrip`. The Articles strip is mounted directly on `CardStrip` with no `max`, so it renders whatever the corpus returns.

### B-93 — Articles section header is a hand-rolled duplicate of `SectionStrip`'s, 40 lines away in the same file
- **Reported:** 2026-08-30 (ui-review panel) · **Type:** Chrome drift / tech debt · **Severity:** 3 · **Surface:** `HomeTab.js` · **Status:** ✅ Fixed #944 — one shared `SectionHeader`. It turned out to be FOUR copies, not two: `SearchResultsView` carried two more with the older pill. "View all" now appears in exactly one file.
- **Detail:** the Articles header re-implements the section header inline with a **different** "View all" pill (`borderRadius: 18` / 13px / `var(--border)`) than `SectionStrip`'s (`borderRadius: 999` / 12px / `var(--text2)`). Same component, same file, two treatments. This is the same class of divergence as B-87 (the grey rail) and is why Home reads as inconsistent.
- **Fix:** one shared `SectionHeader` (eyebrow · title · count · descriptor · View all), consumed by both. Pairs with the ROADMAP Epic 9 Home editorial pass step 1; a `chrome-guard` assertion that "View all" appears in exactly one file would stop the re-drift.

### B-94 — `SectionStrip` early-returns before any hooks run (React #310 landmine)
- **Reported:** 2026-08-30 (ui-review panel) · **Type:** Tech debt / latent crash · **Severity:** 3 · **Surface:** `HomeTab.js` `SectionStrip` · **Status:** Open (partial). The dead `onScreen` / `screenCount` props went out in #944. **Still open:** hoisting the `if (!items || items.length === 0) return null` guard to the call sites, and deleting the dead `inverted` branch.
- **Detail:** `if (!items || items.length === 0) return null;` is the component's first statement. It is safe today only because `SectionStrip` happens to use no hooks. The next person to add a `useState`/`useMemo` there gets React #310, the documented white screen. Three of the five call sites already guard on length outside the component, so the guard is largely redundant.
- **Fix:** hoist the guard to the remaining call sites. Same pass: delete the dead `inverted` branch (the bottom bleed band was removed 2026-06-07 and is on the never-reintroduce list) and the `onScreen` / `screenCount` props, still threaded through to a button retired 2026-05-22.

### B-95 — `DeferUntilVisible` reserves a flat 320px for rows that measure 337-363px
- **Reported:** 2026-08-30 (ui-review panel, measured live) · **Type:** Visual defect · **Severity:** 3 · **Surface:** `HomeTab.js` `DeferUntilVisible` · **Status:** ✅ Fixed (Epic 9 step 6).
- **Detail:** the placeholder is `minHeight = 320` for every deferred section, but measured section heights on desktop are 337 (Recently added) to 363 (Articles). Each row therefore jumps 17-43px as it mounts mid-scroll, worst on iOS PWA where scroll anchoring is weakest.
- **Fix:** ✅ Fixed (Epic 9 step 6). Default raised to 360 (the strip height) and every call site now passes the height of the section it defers: 360 strips, 420 the auction module, 140 the guides row.

### B-96 — Card action buttons are 36pt, under the 44pt iOS minimum, and sit in the swipe-start corner
- **Reported:** 2026-08-30 (ui-review panel) · **Type:** Mobile usability · **Severity:** 3 · **Surface:** `CardShell.js` action buttons · **Status:** Open.
- **Detail:** heart and ⋯ render at 36pt, stacked 6px apart, in the top-right of the tile: below Apple's 44pt minimum target, close enough together to mis-hit, and positioned exactly where a right-handed thumb begins a leftward swipe on a horizontal rail. On a mobile tile they also cover roughly two thirds of the image height.
---

### B-85 — Phillips lot enumerator broken by the same replatform that broke its calendar
- **Reported:** 2026-08-30 (found while verifying the calendar repair) · **Type:** Scrape defect · **Severity:** 2 · **Surface:** `auction_lots_scraper.py` `_phillips_extract_lots` · **Status:** Open.
- **Detail:** the Phillips **calendar** is fixed and its 6 upcoming sales are back in `auctions.json` (incl. The Geneva Watch Auction XXIV, 2026-11-07). The **lot** side is not. A real run reports `[Phillips] no lots found in auction-page payload` → `0 lots kept after filter`. `_phillips_extract_lots` parses the old Turbo-Stream payload; the site is now React/Remix, so the payload it looks for is gone.
- **Why it matters:** Phillips is the third-largest lot source in the archive (623 of 3,360 lots). Sales will show catalogue badges in the calendar while yielding zero lots — a shape users can see.
- **Not urgent this week:** all current Phillips catalogues are Sept+; nothing is live to miss until 2026-09-04. Fix before then.
- **Constraint:** don't fetch Phillips lot detail pages from CI (WAF 403s after ~7 requests) — the fix has to come from whatever the auction page now embeds, same constraint as the old Turbo-Stream approach.

### B-86 — Chronoholic: sold-detection flap flips the whole archive live (4 ↔ 83)
- **Reported:** 2026-08-30 (surfaced by `health.py`'s flapping check, which had never been run on a schedule) · **Type:** Scrape defect · **Severity:** 3 · **Surface:** `chronoholic_scraper.py` · **Status:** Open.
- **Detail:** counts over six runs read `[4, 4, 4, 4, 83, 4]` — spread 1975% of median. **4 is correct**: the dealer genuinely has 4 in stock and 115 sold-archive items (`price=0 → archive`). On the 83 run the price-0 → sold detection failed, so the archive flipped into the live feed and polluted it.
- **Why the existing gates miss it:** the scraper produces a healthy non-empty CSV either way, so neither `scrape_health_gate.py` nor `source_freshness.py` sees anything wrong. Only `health.py`'s variance check catches it — now that it runs daily via `health-report.yml`, it will report each recurrence.
- **Next step:** capture the raw payload on a recurrence to see whether the price field goes missing or changes shape; it is intermittent, so a fix without a captured bad payload would be guesswork.

## Resolved

### Auction-data repair wave — 2026-06-12 → 06-15 (full detail in each PR + SESSION_HANDOFF_2026-06-15)
- **B-62** — WoK post-sale hammer-price recovery → archive-surface merge (`/past-auctions/`), 46 hammers · Fixed
- **B-65** — Shuck the Oyster deep-tail beyond the 50-page cap → prior-CSV re-verify retention · Fixed #858
- **B-66** — Scrape-health gate paged on a single transient flap → debounced (THRESHOLD=3 consecutive misses) · Fixed #876
- **B-67** — maunder/lancashire/wok HTTP-202 anti-bot flap → maunder curl_cffi · Fixed #876 (lancashire/wok: same swap if they recur)
- **B-68** — Node-20 GitHub-Actions deprecation → checkout@v5 / setup-python@v6 / setup-node@v5 · Fixed #876
- **B-69** — Sotheby's lots stopped scraping (algoliaJson empty) → GraphQL `lotCardsConnection` rewrite · Fixed #877
- **B-70** — Monaco Legend sold prices ~1000× low → unescape the `&#039;` CHF separator · Fixed #878
- **B-71** — non-watch Sotheby's sales in the calendar → EXCLUDE_CATALOG_TITLES (Artistic Luxury / Maurice Tempelsman) · Fixed #880
- **B-72** — Bonhams calendar frozen (CI 403) → moved to the residential laptop wrapper · Fixed #882 (follow-up: confirm agent tick + wire health --check into scrape-auctions.yml)
- **B-73** — Christie's "Watches Online" online-only sales empty → whole-blob parse + dispatch route + curl_cffi + image reconstruction · Fixed #881/#883/#884/#886
- **B-74** — DKK prices shown unconverted ($) → DKK added to both FX tables · Fixed #885
- **B-75** — no per-house auction health check → `auction_health.py` (catalog-but-0-lots, debounced) · Built #888 (follow-up: also wire into scrape-auctions.yml)

### B-56 — About / "Nexus" redesign · Modal half shipped #850/#853; page half KILLED by Mark 2026-06-07
- The modal got the three-question restructure (six capability cards incl. Ask-Lume, How-it-works view, count-free copy). The bigger 3-voice page (dealer-creator + about-the-project voices, Lume-led guided intro, modal-vs-page fork) is dropped, not deferred; if it ever returns it starts as a fresh ROADMAP thread, not this ID.

### B-14 — BRAND.md review · Closed with B-56 (2026-06-07)
- The standalone review died with its host thread. What actually landed from it: the em-dash ban is now CI-enforced (copy-guard.test.js #855) and the Lume "no concierge" naming rule is in BRAND.md.

### B-64 — Desktop filter row: Min/Max overlapped the centered search at laptop widths · Fixed #832
- **Fixed 2026-06-06** (same-day): StandardFilterBar self-stacks below 1250px (search line + wrapping pill line); mobile cutover raised 640→760 so phone-shaped windows get the real mobile view. Width ladder: <760 mobile · 760–1250 stacked · ≥1280 full bar.

### B-63 — Escape didn't close the sign-in modal / mobile filter sheet · Fixed #816
- **Fixed 2026-06-06** (same-day as reported, `audit:2026-06-06` U-08): keydown listeners added to `SignInPromptModal` + the MobileShell filter drawer, same pattern as ConfirmModal / the CardShell ⋯ menu; hooks self-gate on open state above any early return.

### Closed out 2026-06-02 (hygiene pass — moved from Open; full enriched detail in git history + the cited PRs)
- **B-18** — Currency FX tables duplicated, could drift → CI parity guard (`merge.py` ↔ `utils.js` FX) · #675
- **B-19** — 5 user-data tables' RLS not version-controlled → committed idempotent enable-RLS + `listing_events` forge fix (prod-verified) · #677
- **B-20** — Two near-identical auction-scraper filenames → renamed `auctionlots_scraper.py` → `tracked_lots_scraper.py` (+ importers/workflow/docs) · #776
- **B-23** — Browse AI 403 (Tropical Watch) + invisible in-batch failures → direct `requests` scraper, Browse AI dropped; TW updates in the daily batch · #582 + direct scraper
- **B-24** — Bonhams direct residential scrape → `bonhams_lots_scraper.py` + laptop LaunchAgent (commits ~3×/day) · #590/#591
- **B-25** — Residential scrape host → laptop launchd agent installed + running (Pi/Mac-mini swap is later, code-unchanged) · #591
- **B-26** — Shared item "leaks" into brand-filtered grid → was a Richard-Mille→Enicar brand misclassification; added RM to brand lists + fixed cached `lastBrand` (no privacy leak) · #674/#679
- **B-29** — Sold tab calendar→auctions + closed-auction lots → a closed sale's lots show on Sold; "Calendar" rename obsoleted · #657/#663
- **B-30** — Auction calendar month pills don't filter → kept scroll-to, removed no-op "ALL", moved "CLOSED" left (Mark's call) · auction-cal-closed-left
- **B-32** — Home content strips (recently added · articles · sold · hearted · auctions) → shipped, live on Home · #670-era
- **B-33** — Horizontal strips didn't signal sideways-scroll → right-edge fade + peeking tile (laggy JS thumb removed) · #670
- **B-37** — Can't heart/add-to-list from article or reference pages → articles via `articleAsListing` (#718) + reference-guide saving `referenceAsListing` (#731) + guide-card heart/⋯ (#757)
- **B-40** — Concierge voice: accuracy-over-commentary + never-dead-end → prompt hardening (corpus-pinned facts; always offer a real next step) · #709/#713/#715
- **B-44** — synthesise-saved-nodes pushed to main with no CI gate → in-workflow pytest+jest gate + opens a PR instead of pushing (default `GITHUB_TOKEN` won't trigger PR CI, so the in-workflow run is the real gate) · #777
- **B-48** — No "Clear filters" on the shared filter bar → Lists/Hearted sub-tab now inherits the shared `ActiveFiltersStrip` Clear-all · #729
- **B-54** — Rolex Explorer 14270 mis-tagged "Submariner" → brand-aware `match_against_index` + fixed the orphaned-Explorer-refs index data; re-tags 29 rows on next scrape · #773
- **B-55** — Auction catalog → Listings kept the sale filter on (empty grid) → App effect drops `filterSaleUrls` when leaving the auctions/sold context · #768

### Lumé hardening — 2026-05-29 → 05-31 (full detail in each PR)
- **B-39 / B-41 / B-42** — concierge bubble polish (visible input/close/title, thinking indicator, markdown+links, auto-grow composer, hide-after-action, icon) · #681–#699
- **B-49** — Lumé blind to the article corpus + listings-first + thrashing → `search_articles` + knowledge-first prompt · #709
- **B-53** — fabricated counts / "we have N" / shops on taste statements · #713/#714 (later: stop quoting counts at all)
- **B-50** — stale service-worker cache served an old build → CACHE_VERSION bump · #712
- **B-52** — "Share with Lumé" ⋯ row on every card (app→Lumé) · #717
- **Lumé memory** — "remembers you" taste profile + reliable RPC write + Settings on/off/reset · #719/#721
- **Lumé behaviour** — explore-not-shop, hedge (no "the only"/complete lists), exposed-code-leak strip · #720
- *(Open-section copies pruned 2026-06-02 — concise entries above + in the "Closed out 2026-06-02" block; full detail in the PRs + git history.)*

### B-36 — Hearted items scattered across Listings/Auctions/Sold · Fixed #638
- A real-user test (Mark's wife) hearted an item and couldn't find it — hearts lived in
  three separate buckets with no "everything I saved" view. B-08's unified Watchlists
  landing folds them into one **Saved** band with an All · Watches · Articles · Sold ·
  Auctions type filter (later rebuilt on the shared CardStrip, #644).

### B-38 — Watchlists image tiles showed the browser's broken-image "?" · Fixed #641/#644
- The bespoke landing tiles used bare `<img>` with no fallback, so failed/blocked photos
  rendered the raw "?". Fixed by routing tiles through the app's `imgSrc` + `/favicon-192.png`
  fallback (matching `CardShell.CardImage`); the Saved band then moved to the shared
  `CardStrip`/`Card` so it inherits that handling for free.

### B-21 — Service-worker JSON regex out of sync with post-split feed filenames · Fixed #580
- The SW's `isJsonData()` matched only the pre-split filenames, so the live/sold
  split + auction/editorial archives the app fetches fell through to
  pass-through (no offline fallback; the freshness guarantee held only because
  App.js sets `cache:"no-cache"`). Fixed by deriving the matcher from a named
  `JSON_DATA_FILES` list, plus `src/service-worker.test.js` — a drift guard that
  rebuilds the SW regex from source and asserts it covers every App.js `*_URL`
  feed constant, so it can't silently drift again. Detail:
  `docs/audits/2026-05-24-vibe-code/findings-frontend.md` (H2).

### B-17 — ~19 MB of non-critical JSON loaded eagerly on every app open · Fixed #577
- The mount effect fetched 5 heavy archive/auction sources (auction_lots 5.2 MB,
  loupethis 4.4 MB, hodinkee_shop 3.2 MB, hairspring_finds 1.7 MB,
  manual_archive_lots 1.1 MB) concurrently with the critical `listings_live`
  fetch, though they feed only the Auctions tab + the Sold-archive projection —
  never the default Listings>Live first paint. Deferred them past first paint
  via `requestIdleCallback` (timeout 2000 ms; `setTimeout(1200)` fallback),
  taking ~15 MB of fetch+parse off the mobile first-paint window. The
  service-worker-regex sub-item (H2) was split to B-21. Detail:
  `docs/audits/2026-05-24-vibe-code/findings-frontend.md` (C1).

### B-15 — Scrapers could silently mark a source's whole stock "Sold" on an empty scrape · Fixed #576
- An HTTP-200-but-empty/truncated scrape used to flip **every** previously-live
  item from that source to SOLD on the first miss (permanent, in the archive),
  with no alert because every workflow step is `continue-on-error`. Fixed with a
  central debounce in `merge.update_state`: a listing must be absent from
  `DISAPPEARANCE_MISS_THRESHOLD` (=2) consecutive runs before flipping to sold —
  the first miss is held live (re-emitted from the state cache), and a seen run
  resets the per-entry `missCount`, so an every-other-run flap never flips.
  Protects all ~41 sources + future ones centrally (no per-scraper edits).
  Detail: `docs/audits/2026-05-24-vibe-code/findings-data.md` (C1).

### B-01 — Editorial filter chrome squashed on scroll (mobile) · Fixed #554
- EditorialView portals its filter chrome into a slot in the shell's sticky
  stack (`#editorial-filter-slot`) on mobile, so editorial's filters live in
  the same chrome as every other tab — no 2nd sticky layer squashing search.

### B-07 — Olive Home nav band (smooths Home → core-tabs jump) · Fixed #547
- Home masthead nav band (tabs + search) made full `--brand-olive` so Home ends
  in the same olive as the core tabs; the hero stays neutral.

### B-11 — See-through "divider gap" below the sticky chrome (recurring) · Fixed #552
- A sticky DateDivider sat *below* the desktop scroll pane's 14px top padding
  (Watchlist/Collecting at 0 never showed it). Zeroed the pane top padding on
  all tabs — removed at the root after years of band-aids. The broader
  shared-chrome unification stays a future item (see chrome-unification memory).

### B-13 — Grey band "in front of" the Search-all strips (esp. auctions) · Fixed #557
- The strip scroll container used `background: var(--border)` + 16/20px
  horizontal padding, so the edge inset rendered as a grey band before the
  first card. Most visible on the light-image auction cards; subtler on
  dark wrist/sold shots. Fixed by making the strip background transparent (the
  inset is now page-colored), on all strips for consistency.

### B-12 — Search-all article cards looked different from the other strips · Fixed #556
- The Articles strip used a separate tile (`ArticleStrip`) with a 16/10 landscape
  image + no placeholder, while Listings/Auctions/Sold use the shared `Card`
  (square 1:1 image). Chose to **align the tile to Card's look** (not route
  articles through Card — articles are a genuinely distinct, price-less,
  external-link type; see CLAUDE.md consistency-principle nuance). Squared the
  image (1:1 + favicon placeholder, always rendered) and matched the title to
  Card (12px / 500 / 2-line). Strip-item widths already matched.

### B-09 — Search-all returned zero articles for any query (e.g. 5513) · Fixed #555
- **Real cause (my earlier "no bodies" hypothesis was wrong — bodies *were* being fetched):** the editorial meta files are **dict-keyed** (`{url: record}`) per the `editorial_corpus_io` split. `EditorialView` reads them via `Object.values`, but the **Search-all fetch in `App.js` did `if (!Array.isArray(arr)) return []`** — discarding *every* source. So Search-all had **zero articles for ANY query**; 5513 is just where Mark noticed. Fix: parse both array + dict shapes (`Object.values`), filtered to real records (`url` + `title`) like EditorialView. Body matching already worked once articles exist (`bodies[article.url]`, rec.url matches the bodies key).
### B-03 — Main tabs pinned on scroll (all tabs) · Fixed #550
- Main tab pills (Listings/Watchlists/Collecting) used to be a non-sticky
  "Row 2" that scrolled away. Moved them into the `data-sticky-chrome` stack
  in `MobileShell.js` as its first child (the same lift a prior PR did for the
  sub-tabs), so they stay visible at any scroll depth on every tab. Wordmark
  brand row stays non-sticky to keep the pinned chrome compact. Note: main tabs
  no longer show during cross-tab Search-all (SearchResultsView has its own
  Exit). B-01 (editorial search squash) split out as a separate follow-up.

### B-10 — Home nav band (tabs + search) sticky · Fixed #549
- Pinned the HomeTab masthead band with `position: sticky;
  top: env(safe-area-inset-top); zIndex: 30` — Home tabs + search stay
  reachable on scroll; hero scrolls away above, strips scroll under.

### B-04 — "Take a break" interstitial fires too early (25 → 50) · Fixed #544
- Screening break prompt fired after 25 cards; Mark wanted 50. Changed
  `BREAK_INTERVAL` 25 → 50 in `ListReviewMode.js`; the `Math.floor(idx /
  BREAK_INTERVAL)` cadence now fires at 50/100/150…

### B-02 — Screening copy: auction catalogs distinguish watch vs save · Fixed #546
- Auction-catalog screening onboarding now reads: Yes = "Watches you want to
  watch", Heart = "Watches you want to save and are very interested in", Pass =
  "Not interested" (Mark's wording). Threaded `isAuctionCatalog` (=
  `selected.type === 'auction'`) → `OnboardingCard`. Non-auction lists keep
  their original consider/save/Not-for-you copy. One-time intro gated by
  `screening_intro_seen_v1`.

### B-05 — Saved auction catalogs need house + date · Fixed #545
- Auction-catalog rows in Lists showed only title + count, so two
  similarly-named catalogs were indistinguishable. Now append "· {House} ·
  {date}" to the row subtitle, read from the saved lots' `house` +
  `auction_date_label` (carried in the listing_snapshot) — frontend-only, no
  migration. Degrades to count-only for old snapshots / manual items.
