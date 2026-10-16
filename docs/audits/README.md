# Audits

Cold, independent health audits of the codebase live here — one dated folder
per audit. This is the permanent **evidence locker**; the *live* tracking of
what each audit found happens in [BUGS.md](../../BUGS.md).

## Index (newest first)

| Date | Audit | Grade | Scope | Read |
|---|---|:--:|---|---|
| 2026-10-16 | Auction pipeline audit | **C** | Site → calendar → CSV → auctions.json → lots → committed JSON, all 8 houses: live scraper diffs against each house's own site, every health gate, CI run logs read per sale | [Report](2026-10-16-auction-pipeline/AUDIT_REPORT.md) |
| 2026-06-06 | First-time-user usability audit | **C+** | Live site, signed-out, mobile+desktop: 9-task first-visit battery (triggered by a real user test); Playwright walkthrough + screenshot evidence, repeatable via `walk.py` | [Plain-English](2026-06-06-usability/AUDIT_PLAIN_ENGLISH.md) · [Report](2026-06-06-usability/AUDIT_REPORT.md) · [evidence](2026-06-06-usability/screens/) |
| 2026-05-24 | Vibe-code cold audit | **B−** | Full-repo: architecture, correctness/tests, security, data/pipeline, frontend/perf, maintainability | [Plain-English](2026-05-24-vibe-code/AUDIT_PLAIN_ENGLISH.md) · [Report](2026-05-24-vibe-code/AUDIT_REPORT.md) · [findings](2026-05-24-vibe-code/) |

## How an audit's outputs are routed ("one finding, one home")

An audit isn't a single fact, so it doesn't get a single home. Its outputs are
sorted into the docs that already own them:

| Output | Home | Notes |
|---|---|---|
| Full report + evidence | **here** (`docs/audits/<date>-<name>/`) | Never edited after the fact; the permanent record. |
| Each actionable finding | **[BUGS.md](../../BUGS.md)** | Enriched, ID'd entry tagged `[audit:<date>]`. BUGS.md is read every session start → findings can't get lost. |
| A finding that becomes a standing rule | **[CLAUDE.md](../../CLAUDE.md)** | Only the rule, only once adopted, within budget. |
| A finding that changes direction | **[ROADMAP.md](../../ROADMAP.md)** | Direction-level items only (e.g. CRA→Vite, data-growth strategy). |
| The fix, once it ships | **[SHIPPED.md](../../SHIPPED.md)** | The 2-line entry references the finding ID + `audit:<date>`. |

**The anti-loss guarantee** is BUGS.md (seen every session), not this folder.
This folder is the *why* behind those entries.

## Convention for future audits

1. Create `docs/audits/<YYYY-MM-DD>-<short-name>/` and write the report there.
2. Add a row to the index above (newest first), with the grade.
3. File each actionable finding into BUGS.md, tagged `[audit:<date>]`.
4. Route any rule → CLAUDE.md, any direction shift → ROADMAP.md.
5. When a fix ships, its SHIPPED.md line cites the finding ID.

---

## 2026-05-24 — Vibe-code cold audit · remediation tracking

Verdict: **B−** — not "vibe-coded garbage"; a well-governed core with 3–4
fixable cliffs. 3 Critical · 19 High · 25 Medium · 19 Low (66 findings).

**Status:** findings to be filed into BUGS.md as `[audit:2026-05-24]` entries.

Suggested routing of the headline items (fill in BUGS IDs / SHIPPED lines as
they land):

| Finding | Tier | → goes to |
|---|---|---|
| Scrapers can silently mark a dealer's stock "Sold" on an empty fetch (CRITICAL) | 0 | BUGS.md · then SHIPPED on fix |
| Dependencies unpinned (no lockfiles) | 0 | BUGS.md · then SHIPPED on fix |
| ~22 MB JSON fetched on every app open / unbounded data growth (CRITICAL ×2) | 0–1 | BUGS.md (fix) + **ROADMAP** (data-growth strategy) |
| Two 4,600-line files with render-only tests | 2 | **ROADMAP** (incremental decomposition) + CLAUDE.md rule (keep logic out of the giants) |
| Currency tables can silently drift | 1 | BUGS.md · CLAUDE.md (verify locksteps, don't just document) |
| 5 user-data tables' RLS state not version-controlled | 0 | BUGS.md · CLAUDE.md (commit every table's security state) |
| Migrate off abandoned CRA → Vite | 2 | **ROADMAP** (named item + trigger) |

Standing-rule candidates (→ CLAUDE.md once adopted): "every scraper guards
against empty/low-count writes (build-fails)", "first load fetches only the
default view's data; rest lazy", "dependencies pinned; no ad-hoc latest", "new
logic goes in a small file/hook, never into App.js", "run a cold audit each
milestone/quarter; archive here + file findings to BUGS.md."
