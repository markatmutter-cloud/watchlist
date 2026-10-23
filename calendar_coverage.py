#!/usr/bin/env python3
"""
Calendar coverage reconciler — did every scraped sale survive the merge?

THE CASCADE THIS CLOSES

The auction pipeline is a chain, and lots hang off the far end of it:

    house site -> scraper -> data/*_auctions.csv -> public/auctions.json
                                                          |
                                        auction_lots_scraper walks THIS
                                                          |
                                                    public/auction_lots.json

The lot enumerator only ever visits sales present in auctions.json, so a
sale lost at ANY earlier link takes its lots with it, silently. That is
how Phillips being absent from the calendar for six weeks also meant six
weeks with zero Phillips lots, without either fact surfacing on its own.

Each link now has a check, and this file is the one that was missing:

    site    -> scraper   calendar_canary.py          (live fetch returns 0?)
    scraper -> CSV       auction_calendar_health.py  (CSV absent/empty?)
    CSV     -> JSON      *** THIS FILE ***
    JSON    -> lots      auction_health.py           (catalog but no lots?)

IDENTITY: WHY NOT URL

The obvious key is the sale URL. It is wrong here, and quietly so:
Antiquorum points five different upcoming sales at one placeholder page
(their per-sale catalog URL is not published until days before), and
Sotheby's reuses slugs across sales. Matching on URL would let a genuinely
dropped sale hide behind a namesake and report all-clear.

So this reuses merge.auction_id(house, date_start, title) — the same
hash merge.py stamps into each sale as `id`. Reusing it rather than
inventing a parallel key means the reconciler cannot disagree with the
merge about what "the same sale" means, which is the only way a
reconciler is worth anything.

SCOPE

Only UPCOMING and LIVE sales are enforced. Past sales legitimately age
out, so demanding they persist would be permanent noise — and a past sale
has no lots left to miss.

Runs AFTER merge.py in the auctions workflow and touches no network: both
sides are artifacts of the run that just happened, so there is no
staleness window and no extra load on the houses.

Usage:
    python3 calendar_coverage.py           # exit 1 on any dropped sale
    python3 calendar_coverage.py --warn    # report only, always exit 0
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path

DATA = Path("data")
AUCTIONS_JSON = Path("public") / "auctions.json"
CSV_GLOB = "*_auctions.csv"


def _auction_id(house: str, date_start: str, title: str) -> str:
    """merge.py's own sale identity. Imported lazily so this module stays
    usable (and testable) even where merge's optional deps are absent."""
    import merge
    return merge.auction_id(house, date_start, title)


def _is_excluded(title: str, url: str) -> bool:
    """merge.py's own non-watch blocklist, so the gate and the merge agree."""
    import merge
    return merge.is_excluded_catalog(title, url)


def load_merged(path: Path = AUCTIONS_JSON) -> dict[str, dict]:
    """id -> sale, straight from the merged calendar."""
    try:
        doc = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}
    sales = doc if isinstance(doc, list) else next(
        (v for v in doc.values() if isinstance(v, list)), [])
    out = {}
    for s in sales:
        sid = s.get("id") or _auction_id(
            s.get("house", ""), s.get("dateStart", ""), s.get("title", ""))
        out[sid] = s
    return out


def load_scraped(data_dir: Path = DATA) -> list[dict]:
    rows = []
    for path in sorted(data_dir.glob(CSV_GLOB)):
        try:
            with path.open(newline="", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    row["_file"] = path.name
                    rows.append(row)
        except (OSError, csv.Error):
            continue
    return rows


def dropped_sales(data_dir: Path = DATA,
                  merged_path: Path = AUCTIONS_JSON,
                  today: str | None = None) -> list[dict]:
    """Scraped upcoming/live sales missing from the merged calendar."""
    today = today or date.today().isoformat()
    merged = load_merged(merged_path)
    out = []
    for row in load_scraped(data_dir):
        house = row.get("house") or row.get("source") or ""
        title = row.get("title") or ""
        start = (row.get("date_start") or "")[:10]
        if not (house and title):
            continue
        # A sale merge.py drops on purpose (non-watch: cars, house sales,
        # jewels) is meant to be missing; it is not a lost sale.
        if _is_excluded(title, row.get("url") or ""):
            continue
        # Past sales legitimately age out of the merged calendar.
        end = (row.get("date_end") or start or "")[:10]
        if end and end < today:
            continue
        if _auction_id(house, start, title) not in merged:
            out.append({
                "house": house,
                "title": title[:60],
                "date_start": start,
                "url": row.get("url", ""),
                "file": row["_file"],
            })
    return out


def main(argv: list[str]) -> int:
    warn_only = "--warn" in argv

    # DATA / AUCTIONS_JSON are read here rather than taken as default
    # arguments: defaults bind once at import, which would make the
    # module globals unoverridable and let a test pass vacuously.
    scraped = load_scraped(DATA)
    if not scraped:
        # auction_calendar_health.py owns the "no CSVs at all" failure;
        # duplicating it here would double-page one incident.
        print("Calendar coverage: no calendar CSVs present, nothing to "
              "reconcile (auction_calendar_health.py owns that case).")
        return 0

    merged = load_merged(AUCTIONS_JSON)
    dropped = dropped_sales(DATA, AUCTIONS_JSON)
    print(f"Calendar coverage: {len(scraped)} scraped row(s), "
          f"{len(merged)} sale(s) in the merged calendar.")

    if not dropped:
        print("Every scraped upcoming/live sale reached auctions.json. OK")
        return 0

    print(f"::error::Calendar coverage: {len(dropped)} scraped sale(s) never "
          f"reached auctions.json — their lots will never be enumerated")
    for d in dropped:
        print(f"  - [{d['house']}] {d['date_start']} {d['title']}")
        print(f"      {d['url']}  (from {d['file']})")
    return 0 if warn_only else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
