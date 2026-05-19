# Watchlist — Session Handoff (2026-05-16 → 2026-05-17)

For working conventions, see [CLAUDE.md](CLAUDE.md). For roadmap, see
[ROADMAP.md](ROADMAP.md). Durable rules graduate to CLAUDE.md;
durable direction graduates to ROADMAP.md. This doc is the
in-flight snapshot.

## TL;DR

**Epic 0 — references-as-first-class-entities — went from "kicking off"
to ~70% of the data layer shipped in one extended session.** Sixteen
PRs landed (#324–#340). The site now has a curated reference index,
a working matcher, an editorial corpus, and a strategy doc that
captures the connoisseur-layer vision the data underneath unlocks.

Three big arcs:

1. **Stop throwing data away (PRs #324–#329).** The pre-session
   pipeline truncated dealer descriptions to 300 chars, discarded
   Phillips's `referenceNo` field (73% populated, never written down),
   emitted empty descriptions on five dealer scrapers, and left every
   auction lot with `brand=""`. After this arc:
   - Phillips lots carry `reference_no` + `model_name`.
   - Sotheby's / Christie's / Antiquorum auction-lot descriptions get
     parsed into discrete structured fields (`auction_lot_parsers.py`).
   - Dealer descriptions captured at full length (1,500-char cap on
     merge.py; per-scraper caps lifted to 1,500–4,000 across Bulang,
     Craft & Tailored, Falco, Somlo, Huntington, Wind Vintage, Analog
     Shift, Maunder, Oliver & Clarke, Vintage Watch Fam).
   - Shuck the Oyster: zero-HTTP description extraction added.
   - Canonical brand resolution on auction lots (82% populated; was 0%).
   - Per-dealer structured-field parsers (`dealer_parsers.py`) extract
     reference / model / year / material / case_size for the top 5
     dealers with consistent spec blocks.

2. **Reference index + matcher (PRs #327, #332, #333, #334, #335,
   #340).** Built from scratch:
   - Curated reference index at `docs/watch_references.md` (delivered
     via 4 research-chat patches, file-renamed to consistent
     `watch_references_patch_NN.md` convention in #340).
   - Index parsed + matched against every corpus
     (`reference_index_match.py`).
   - Gap report regenerated each merge
     (`docs/watch_references_gaps.md`) — actionable input for the
     next patch round.
   - Three patch merges grew the index from 13 brands (initial
     research-chat output) → **26 brands · 312 model lines · 1,666
     refs · 854 nicknames**.
   - Matcher polish: derived `model` + `sub_model` on every match;
     JLC + Universal Genève canonicalization fix (3 of each were
     leaking to "Other"); progressive ref normalization (`5120G-001`
     → `5120G` → `5120`).
   - **`listings.json` hit rate climbed 30% → 47.9%** across the
     patch sequence.

3. **Editorial corpus (PRs #336, #337, #338).** Two scrapers, two
   long-form editorial sources:
   - **Hairspring "Finds"** — 1,613 articles by Erik Gustafson,
     ~$142M cumulative editorial coverage. Each article carries
     sold_price + case_size + Erik's prose. Projected into
     Listings > All sold via `hairspringFindsItems` in App.js
     (#337 wires the projection; depends on #336 scraper +
     initial corpus pull). Source label: "Hairspring (Finds)".
   - **Wind Vintage blog** — 325 posts by Charlie Dunne + Eric
     Wind, 527K words. 15 formal collector's guides plus 185
     "What's Selling Here" listicles + 105 general posts. Per-record
     `post_type` classification + brand + ref-index resolution.
     Not yet wired into App.js — belongs in the future AdminTab
     reading view (different shape from sold listings).

Plus an interrupting **mobile-search bug fix (#331)** and a
**reference-intelligence strategy doc (#330)** that captures the
six-layer stack Epic 0 is building toward.

## PRs shipped this session

| PR | Title | Status |
|---|---|---|
| #324 | Phase 1A: stop throwing structured-ref + description data away | merged |
| #325 | Phase 1B: more dealer cap lifts + Shuck description + auction caps | merged |
| #326 | Phase 1C: auction-house structured-field parsers | merged |
| #327 | Phase 1D: index matcher + concrete gap report | merged |
| #328 | Phase 1E: canonical brand resolution on auction lots | merged |
| #329 | Phase 1F: dealer structured-field parsers | merged |
| #330 | Reference intelligence strategy doc | merged |
| #331 | Fix mobile Home: search Enter/CTA + drop the Screen pill | merged |
| #332 | Merge gap-patch (patch 01) into reference index — 30% → 41% | merged |
| #333 | Matcher polish — model/sub_model derivation; JLC/UG fix | merged |
| #334 | Merge patch 02 — Tudor + Vacheron + Breitling — 16 brands | merged |
| #335 | Merge patch 03 — 10 divers + indie brands — 26 brands | merged |
| #336 | Hairspring Finds scraper + initial 1,613-article corpus | merged |
| #337 | Wire Hairspring Finds into the Sold archive (App.js projection) | open (mergeable) |
| #338 | Wind Vintage blog scraper + 325-post editorial corpus | merged |
| #339 | ROADMAP: Epic 0 overhaul post-2026-05-17 session | merged |
| #340 | Patch 04 merge (Tudor + Vacheron vintage) + rename patch files | open |

**16 PRs landed, 2 open at handoff** (both clean, awaiting Mark's
merge — same shape as the rest, no controversial scope).

## Reference coverage at handoff

| Corpus | Total | Matched | Rate |
|---|---|---|---|
| `listings.json` (dealers) | 4,664 | 2,233 | **47.9%** (58.0% on in-index brands) |
| `auction_lots.json` | 1,892 | 417 | 22.0% (brand-empty bug — backfill next cron) |
| `loupethis_lots.json` | 3,807 | 1,313 | 34.5% (51.9% on in-index) |
| `hairspring_finds.json` | 1,613 | 1,177 | **73.0%** |
| `windvintage_guides.json` | 325 | 241 | **74.2%** |

Index: 26 brands · 312 model lines · 1,666 refs · 854 nicknames.

### What's in the 52% unmatched on `listings.json`

| Bucket | Count | % of unmatched | Closable how |
|---|---|---|---|
| In-index brand, ref not catalogued | ~1,475 | 61% | More index growth (next patch round) |
| Out-of-index brand entirely | ~360 | 15% | Index growth (more brands) — skip Piaget/Movado per Mark spec |
| In-index brand but matcher format gap | 100–200 | 7% | Roadmap item F — tokenizer expansion (Doxa SKU, Enicar dashed, Blancpain alphanumeric, Breitling full-format) |
| Misbranded as "Other" | ~50 | 2% | Better brand inference in titles |
| Genuinely unparseable (bracelets, accessories) | ~250 | 10% | Out of scope — no ref to match |
| Model-name-only watches (Pelagos, Aquanaut, Black Bay) | ~150 | 6% | Model-name fallback (small PR) |

**Realistic ceiling without LLM**: 65–70% match rate, reachable
across the next 2–3 patches + the matcher polish work.

## Strategy to keep climbing — four levers (recap)

1. **Index growth (continuous, patch workflow).** Dominant lever.
   The "additions to existing brands" patches outperform "new brands"
   patches for headline % movement because existing brands carry
   most listings. Patch 01 (gap-fill existing) added 11pp; Patch
   04 (Tudor /0 + niche + VC vintage additions) added 4.9pp.
   Patches 02 / 03 (new brands) added 1.7pp and 0.3pp respectively.
   **Next patch should be "more refs in Rolex / Omega / Cartier /
   Patek / AP / Heuer / Breitling".** The regenerated gap report is
   paste-ready input for the next chat round.

2. **Matcher tokenizer expansion (roadmap item F).** ~80 lines of
   code. Closes Doxa SKUs (`804.10.241.10`), Enicar dashed/slashed
   refs (`144-35-02`, `072/002`), Blancpain modern alphanumerics
   (`5015A-1130-52A`), Breitling full-format with dial codes
   (`AB202016/C961/443A`). Plus honour patch 01's tokenizer-
   implementation-notes: exclude bracelet refs (`1171`, `78350`),
   depth ratings (`300M`, `600M`), caliber refs (`8541`, `8531`)
   from ref matching. +2-4pp.

3. **Hybrid match (proposed, not built).** When a listing's brand is
   in-index but no full ref matched, extract the bare ref via regex.
   Gives partial info (`{brand: "Rolex", reference_no: "67198",
   reference_id: null}`) instead of `null`. Listing still gets
   grouped under "Rolex (other refs)" on the per-reference page
   rather than disappearing.

4. **Model-name fallback.** Tudor "Pelagos", Patek "Aquanaut",
   FPJ "Chronomètre Souverain" don't carry structured refs.
   Model-name match catches ~150 long-tail listings. Small PR.

After all four: ~65–70% ceiling. LLM fallback (Slice 3+) brings
the remaining 30% by extracting refs from prose where regex can't.

## Durable rules graduated to CLAUDE.md

Three new durable patterns emerged. Adding to CLAUDE.md in this PR:

- **Patch-merge workflow.** Research-chat patches drop via GitHub
  mobile under `docs/watch_references_patch_NN.md` (or any name —
  I rename + sequence at merge). I merge into canonical
  `docs/watch_references.md`, regenerate `docs/watch_references_gaps.md`,
  re-run the matcher, open a PR. Patch file preserved as
  provenance. The convention is documented in CLAUDE.md +
  `docs/REFERENCE_INTELLIGENCE.md`.

- **The `Sources` bullet is structural in patches now (Mark spec
  2026-05-17 — "credit + linkback").** Future research-chat
  prompts must request `- **Sources**: [Name](url) · [Name](url)`
  per `### Model line:` entry. At least 2–3 sources per entry.
  Display layer will render these as outbound linkbacks on the
  eventual public per-reference page.

- **Reference corpus is INTERNAL training input + admin reading
  view, NOT public republished prose.** The dual-consumer split
  documented in `docs/REFERENCE_INTELLIGENCE.md`: Mark's admin
  AdminTab reading view can render full prose verbatim with
  attribution; the eventual public encyclopedia surface must
  emit factual extraction only (production years, calibers,
  variant taxonomy), cited sources, never near-verbatim. Counsel
  review before public ship.

## Open items at handoff

### Open PRs

- **#337 — Hairspring → Sold archive (App.js projection).** Was
  conflicted briefly; rebased clean. Mergeable.
- **#340 — Patch 04 merge + file rename.** Just opened.

### Near-term queue (B / C / D / F per Mark's plan)

In dependency order:

1. **B — Attach `reference_id` to every listing at merge time.**
   The matcher runs as a survey tool today; integrate into
   `merge.py` and the auction-lot post-processing so every entry
   in `listings.json` / `auction_lots.json` / `hairspring_finds.json`
   / `windvintage_guides.json` carries `reference_id` + `model` +
   `sub_model` + `model_line`. **Keystone** — unblocks per-reference
   grouping, AdminTab reading view, Hairspring → per-reference
   linkage. Invisible-on-the-surface but the prereq for everything
   visible downstream.

2. **C — `public/reference_guides.json` corpus storage.** Per
   strategy doc — corpus file keyed by `reference_id` with
   `source_type` tags. Version 1 is free: parse `docs/watch_references.md`'s
   Notes paragraphs into structured per-reference entries, then
   layer in Hairspring Finds + Wind Vintage we already scraped.
   No new scraping.

3. **D — AdminTab reading view.** Personal-research surface per the
   dual-consumer split. Gated by `REACT_APP_ADMIN_EMAILS`. Renders
   `reference_guides.json` as per-reference cards: full prose,
   source-attributed, marked-as-read state. **Depends on B + C**.

4. **F — Matcher tokenizer expansion** (described above).

### Auction-essay capture (Type E in strategy doc)

- **Sotheby's `catalogueNote` / `provenance` / `literature` pull** —
  fields already in the LotV2 object we fetch; just stop discarding
  them. Free.
- **Christie's long essays** — investigation needed (auction-page
  payload may carry; if not, bounded per-lot fetches).
- **Antiquorum descriptions** — currently empty in output; per-lot
  detail fetches where the link exists.
- **Phillips full essays** — parked. WAF blocks our IP after ~7
  detail-page fetches. Unblocks when Mac-mini Playwright lands.

### Index growth — queued for next research-chat round

Per Mark's 2026-05-17 strategic preferences:

- **Priority — more refs in big existing brands.** Rolex / Omega /
  Cartier / Patek / AP / Heuer / Breitling — gap-report tokens are
  the input. Each patch like this should lift overall rate ~5–10pp.
- **Breitling vintage** — was supposed to be in patch 04 but the
  paste cut off at the end of the Vacheron section. Top Time
  (810 / 2002 / 2003), Co-Pilot / AVI 765 family, Italian-Army ref
  817, Premier 777/790/791 etc.
- **Skip per Mark spec**: Piaget, Movado.

### UI surfaces (Slices 2 / 3 / 4 from ROADMAP / strategy)

- **Slice 2** — Reference grouping UI (depends on B).
- **Slice 3** — Per-reference research page (depends on B + C).
- **Slice 4** — LLM-synthesized encyclopedia (depends on accumulated
  corpus + LLM budget OR Mac-mini Phase A).

### The connoisseur layer (Slices 5-6 from strategy doc — the endgame)

- Variant taxonomy extraction (LLM, benchmark against Wind Vintage
  1675 guide).
- Per-listing variant tagging.
- Per-reference price-impact model.
- Recommender — variant tags × user reactions × price-impact
  model → ranked listings with explanations.

## Process notes from this session

- **Patch-merge cadence works.** Four research-chat patches in
  ~24 hours, each merged within minutes of Mark's GitHub-mobile
  drop. The "patch file → I merge + regenerate + PR" loop is
  smooth and Mark loves it. **Keep this pattern; don't reinvent.**

- **Source attribution gap caught mid-session.** Patches 01 and
  02 had no per-entry sources; patch 03 had a global "cross-checked
  against brand archives" disclaimer but nothing structured; patch
  04 had per-entry `**Sources**:` bullets cleanly. Mark's
  credit-and-linkback principle was the trigger. Next patches must
  carry sources by structural requirement.

- **The em-dash filenames bit us.** Patch 02 ("Watch Aggregator
  Reference Index 2 — Patch File.md") and patch 03 ("Watch Brand
  Reference Index — Patch 02.md") had em-dashes + spaces + chat-named
  inconsistency. PR #340 renamed everything to
  `watch_references_patch_NN.md`. **Future patches: just drop with
  any name; I'll rename to the convention at merge.**

- **iOS GitHub-mobile flow scales.** Mark dropped four 80–130 KB
  markdown patches via GitHub mobile without friction. Confirmed
  the workflow for the rest of the corpus growth.

- **One white-screen avoided.** The matcher polish in #333 changed
  `match_against_index` from returning a tuple to returning a dict.
  Caught the destructure mismatch in `survey_source` at the same
  edit. Tests stayed green. (Mark's hooks-past-loading-early-return
  class of bug from the May 14 session didn't recur.)

- **One regression caught + rolled forward.** #337 had a merge
  conflict from cron auto-commits churning App.js between branch
  and main. Rebase resolved cleanly.

## Re-entry checklist for the next session

1. Merge #337 + #340 if not already done.
2. **Start with `B`** — attach `reference_id` to every listing at
   merge time. Single coherent PR, ~120 lines: import matcher into
   merge.py, run on each item post-construction, write
   `reference_id` + `model` + `sub_model` + `model_line` fields.
   Same for `auction_lots_scraper.py`'s post-construction loop
   (already has the enrichment hook from PR #326).
3. **Then `C`** — build `public/reference_guides.json` from the
   existing index. One-shot script. Already-scraped corpus
   (Hairspring + Wind Vintage) layers in as a second pass.
4. **Then `D`** — AdminTab reading view. Mark gets a personal
   surface to read the corpus.
5. **Then `F`** — matcher tokenizer expansion. Closes Doxa /
   Enicar / Blancpain false-zero gaps.
6. **Pull whatever's in the next research-chat patch** when Mark
   drops it.

## What's in the corpus right now

`docs/reading_corpus_digest.md` (not committed — transient artifact
generated 2026-05-17 for Mark's car ride) holds a curated 91K-token
digest: all 15 Wind Vintage collector's guides + the 30 deepest
Hairspring Finds articles. Pasted into a Claude chat for
conversational summarisation.

Full corpus on disk:
- `public/hairspring_finds.json` — 5.2 MB, 1,613 articles, $142M
  cumulative editorial coverage, median $31k, top $2.5M.
- `public/windvintage_guides.json` — 3.3 MB, 325 posts, 527K words,
  15 formal collector's guides + 185 weekly listicles + 105 general
  posts + 18 photo reports + 2 events.

Both files are public-served (Vercel `/<filename>.json`) and ready
to be consumed by future UI surfaces.

## Memory writes worth checking

This session is heavy with Mark's strategic decisions; the memory
system should have entries for:
- Skip Piaget / Movado from index growth priority
- Source attribution = structural requirement on patches
- Reference corpus is dual-consumer (internal full / public extract)
- Patch-merge workflow is the established cadence
- Watchfid Speedmaster Only book is the gold-standard reference
  (not Wind Vintage's 1675 guide; corrected mid-session)
- Eric Wind ≠ Charlie Dunne — both author at Wind Vintage; the
  earlier agent-report claim that they're "the same person" was
  wrong; both are real distinct authors

If those memories don't exist yet, write them in the next session.
