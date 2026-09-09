#!/usr/bin/env python3
"""
Unified per-source freshness ledger — one rule that catches rot anywhere.

WHY THIS EXISTS

Every gate we had was shaped around a *known* failure mode on *one*
surface: scrape_health_gate.py (a dealer CSV went missing),
auction_health.py (a house has a catalog but no lots),
auction_calendar_health.py (a calendar scraper parsed nothing). Each was
written after something broke, and each only watches its own surface.

The 2026-08 sweep found four rots in one morning, and every one of them
would have been caught by a single much dumber question:

    when did this source last produce data?

  - MVV Watches            dead 6 weeks (dealer rebranded)
  - Watches of Knightsbridge / Lancashire   dead 2 weeks (Cloudflare)
  - Monaco Legend / Phillips  dead 6 weeks (calendar selectors)
  - the whole editorial corpus  frozen a month (push race, no gate at all)

That question needs no theory about *how* a source breaks, which is what
makes it the closest thing here to an unknown-unknown detector. A new
source added tomorrow is covered the day it lands; a novel failure mode
is covered before anyone has diagnosed it.

WHY A LEDGER AND NOT `git log`

The obvious implementation — `git log -1 -- <path>` per artifact — is
wrong in CI. Scrape workflows check out at fetch-depth 1, so history
isn't there and every file looks like it changed in the only commit
present. The ledger sidesteps that: each run records what it observed,
the file is committed, and the counts survive across shallow checkouts.

WHAT IS RECORDED, PER SOURCE

    lastSeen      last run date the artifact existed and was non-empty
    lastChanged   last run date its content fingerprint actually moved
    fingerprint   sha1 of the artifact bytes
    rows          data rows (CSV) or records (JSON), for the report

`lastSeen` catches a scraper that stopped producing. `lastChanged`
catches the subtler one: a scraper still writing a file, on schedule,
whose content has been frozen for weeks. Byte-identical output for days
is normal for a small dealer and alarming for a large one, so staleness
budgets are per-surface, not global.

MODES

    --record   observe every artifact, update the ledger, ALWAYS exit 0.
               Safe to call from any workflow; each call only updates the
               sources whose artifacts are present in that checkout.
    --report   human-readable table, newest-stale first. Exit 0.
    --check    exit 1 when a source is stale beyond its budget.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

DATA = Path("data")
PUBLIC = Path("public")
LEDGER = DATA / "source_freshness.json"


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


# ---------------------------------------------------------------- registry

def _dealer_sources() -> dict[str, Path]:
    """Read merge.py's table rather than keeping a second copy of it.

    A parallel list is the exact drift this module exists to catch, so
    importing is not merely convenient — a hand-copied registry would
    silently stop covering any source added to merge.py.
    """
    try:
        import merge
        return {name: Path(path) for path, name, _cur in merge.LISTING_SOURCES}
    except Exception:
        # merge.py imports optional extras; never let that break the gate.
        return {}


def _calendar_sources() -> dict[str, Path]:
    try:
        import auction_calendar_health as ach
        return {f"calendar:{h}": p for h, p in ach.HOUSES.items()}
    except Exception:
        return {}


# Editorial corpus files. These had NO health coverage of any kind — the
# surface that stayed frozen for a month without a single alert.
EDITORIAL = [
    "bring_a_loupe", "rolex_magazine", "onthedash", "bulang_watch_talks",
    "romainrea_editorial", "hodinkee_shop", "hodinkee_reference_points",
    "acollectedman_journal", "woe_dispatch", "screwdowncrown", "fratello",
    "le_monde_edmond", "strictlyvintagewatches", "christies_stories",
    "hodinkee_picks", "watchfid_editorial",
]

# Merged outputs — the end of each pipeline.
MERGED = {
    "merged:listings": PUBLIC / "listings.json",
    "merged:auctions": PUBLIC / "auctions.json",
    "merged:auction_lots": PUBLIC / "auction_lots.json",
}

# Days of silence before --check fails, by surface. Dealers scrape 3x/day
# and auctions daily, so a couple of days is already many missed runs.
# Editorial runs twice weekly and legitimately publishes nothing some
# weeks, so it gets a much longer leash — long enough to still have
# caught the month-long freeze with three weeks to spare.
BUDGET_SEEN = {"dealer": 3, "calendar": 4, "editorial": 14, "merged": 2}
BUDGET_CHANGED = {"dealer": 21, "calendar": 30, "editorial": 30, "merged": 3}


def surface_of(key: str) -> str:
    if key.startswith("calendar:"):
        return "calendar"
    if key.startswith("editorial:"):
        return "editorial"
    if key.startswith("merged:"):
        return "merged"
    return "dealer"


def registry() -> dict[str, Path]:
    reg: dict[str, Path] = {}
    reg.update(_dealer_sources())
    reg.update(_calendar_sources())
    reg.update({f"editorial:{n}": PUBLIC / f"{n}.json" for n in EDITORIAL})
    reg.update(MERGED)
    return reg


# ---------------------------------------------------------------- observing

def _row_count(path: Path) -> int:
    """Data rows for a CSV, record count for a JSON. 0 when unreadable."""
    try:
        raw = path.read_bytes()
    except OSError:
        return 0
    if path.suffix == ".csv":
        try:
            rows = list(csv.reader(raw.decode("utf-8", "replace").splitlines()))
        except csv.Error:
            return 0
        return max(0, len(rows) - 1)
    try:
        doc = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return 0
    if isinstance(doc, list):
        return len(doc)
    if isinstance(doc, dict):
        # Corpus + merged files wrap their payload in a list-valued key;
        # fall back to counting top-level keys for plain maps.
        for v in doc.values():
            if isinstance(v, list):
                return len(v)
        return len(doc)
    return 0


def observe(reg: dict[str, Path] | None = None) -> dict[str, dict]:
    """Fingerprint every artifact present in this checkout."""
    reg = registry() if reg is None else reg
    seen = {}
    for key, path in reg.items():
        if not path.exists():
            continue
        try:
            raw = path.read_bytes()
        except OSError:
            continue
        rows = _row_count(path)
        if rows == 0:
            # An empty artifact is not fresh data. Skipping it here means
            # lastSeen stops advancing, so the gate treats "writes an
            # empty file forever" the same as "writes nothing".
            continue
        seen[key] = {
            "fingerprint": hashlib.sha1(raw).hexdigest()[:16],
            "rows": rows,
        }
    return seen


def load_ledger(ledger: Path = LEDGER) -> dict[str, dict]:
    if not ledger.exists():
        return {}
    try:
        doc = json.loads(ledger.read_text())
        return doc if isinstance(doc, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def record(reg: dict[str, Path] | None = None,
           ledger: Path = LEDGER,
           today: str | None = None) -> dict[str, dict]:
    """Merge this run's observations into the ledger and write it.

    Only sources observed in THIS checkout are touched, so a workflow
    that produces a subset of the artifacts can call --record without
    blanking everyone else's entries.
    """
    today = today or _today()
    led = load_ledger(ledger)
    for key, obs in observe(reg).items():
        prior = led.get(key, {})
        changed = prior.get("fingerprint") != obs["fingerprint"]
        led[key] = {
            "lastSeen": today,
            "lastChanged": today if changed else prior.get("lastChanged", today),
            "fingerprint": obs["fingerprint"],
            "rows": obs["rows"],
        }
    ledger.parent.mkdir(parents=True, exist_ok=True)
    ledger.write_text(json.dumps(led, indent=2, sort_keys=True) + "\n")
    return led


# ---------------------------------------------------------------- reporting

def _age(iso: str | None, today: str) -> int:
    if not iso:
        return 9999
    try:
        return (date.fromisoformat(today) - date.fromisoformat(iso)).days
    except ValueError:
        return 9999


def snoozed_names(today: str | None = None) -> dict[str, str]:
    """Ledger keys currently muted, -> the reason, via ONE snooze file.

    B-80's snooze lives in data/scrape_health_snooze.json and mutes the
    scrape-health gate. This gate never read it, so watchcenter — muted
    there on purpose, its fix not ours — paged here every single day
    through a second door, which is precisely how an alert channel gets
    tuned out. One mute, honoured everywhere.

    The snooze file is keyed by CSV stem (`watchcenter`) and this ledger
    by display name (`Watch Center`), so merge.LISTING_SOURCES does the
    translation — the same registry this module already imports rather
    than hand-copying. Date semantics are scrape_health_gate's, imported
    rather than reimplemented: an undated or malformed entry mutes
    nothing, and an expired one pages again by itself.
    """
    try:
        import scrape_health_gate as gate
        from datetime import date as _date
        snoozes = gate.load_snoozes()
        when = _date.fromisoformat(today or _today())
    except Exception:
        return {}
    stem_to_name = {}
    try:
        import merge
        for path, name, _cur in merge.LISTING_SOURCES:
            stem_to_name[Path(path).stem] = name
    except Exception:
        pass
    out = {}
    for stem, entry in snoozes.items():
        try:
            if gate._snooze_state(entry, when) != "active":
                continue
        except Exception:
            continue
        name = stem_to_name.get(stem, stem)
        out[name] = (entry or {}).get("reason", "") if isinstance(entry, dict) else ""
    return out


def stale(ledger: Path = LEDGER, today: str | None = None) -> list[dict]:
    """Sources past their budget, worst first. Snoozed ones are excluded."""
    today = today or _today()
    led = load_ledger(ledger)
    muted = snoozed_names(today)
    out = []
    for key, d in led.items():
        if key in muted:
            continue
        surface = surface_of(key)
        seen_age = _age(d.get("lastSeen"), today)
        changed_age = _age(d.get("lastChanged"), today)
        reasons = []
        if seen_age > BUDGET_SEEN[surface]:
            reasons.append(f"no data for {seen_age}d "
                           f"(budget {BUDGET_SEEN[surface]}d)")
        if changed_age > BUDGET_CHANGED[surface]:
            reasons.append(f"content unchanged for {changed_age}d "
                           f"(budget {BUDGET_CHANGED[surface]}d)")
        if reasons:
            out.append({"key": key, "surface": surface, "seen_age": seen_age,
                        "changed_age": changed_age, "reasons": reasons})
    return sorted(out, key=lambda r: -r["seen_age"])


def report(ledger: Path = LEDGER, today: str | None = None) -> str:
    today = today or _today()
    led = load_ledger(ledger)
    if not led:
        return ("No freshness ledger yet — run `source_freshness.py --record` "
                "from a checkout that has the scrape artifacts.")
    rows = sorted(
        ((k, _age(d.get("lastSeen"), today), _age(d.get("lastChanged"), today),
          d.get("rows", 0)) for k, d in led.items()),
        key=lambda r: (-r[1], -r[2]),
    )
    lines = [f"{'source':38} {'data age':>9} {'unchanged':>10} {'rows':>7}",
             "-" * 68]
    for key, seen_age, changed_age, n in rows:
        flag = "  ← STALE" if seen_age > BUDGET_SEEN[surface_of(key)] else ""
        lines.append(f"{key:38} {seen_age:>7}d {changed_age:>9}d {n:>7}{flag}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    mode = argv[1] if len(argv) > 1 else "--check"

    if mode == "--record":
        led = record(None, LEDGER)
        print(f"Freshness ledger: {len(led)} source(s) tracked.")
        return 0

    if mode == "--report":
        print(report(LEDGER))
        return 0

    # Muted, not invisible: the same contract the scrape-health gate
    # keeps. A snoozed source still prints every run, so nobody forgets
    # it exists, and it re-pages by itself on the expiry date.
    for name, reason in sorted(snoozed_names().items()):
        print(f"::notice::Freshness (snoozed, not paging): {name}"
              + (f" — {reason}" if reason else ""))

    bad = stale(LEDGER)
    if not bad:
        print("Freshness gate: every source is within its staleness budget. ✓")
        return 0
    print(f"::error::Freshness gate: {len(bad)} source(s) stale")
    for r in bad:
        print(f"  - {r['key']} [{r['surface']}]: {'; '.join(r['reasons'])}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
