#!/usr/bin/env python3
"""
Auction-lot health verification script.

Mirror of `verify_sources.py` but for `public/auction_lots.json`
(the comprehensive auction-lot scrape output). Counts live lots per
auction house, compares each house's count to its rolling 7-day
median, flags drops to zero or below 30% of median.

Why this exists: the per-house enumeration in
`auction_lots_scraper.py` has known fragile points — Antiquorum's
catalog `?page=N` 301-redirect, Sotheby's algoliaJson schema
changes, Phillips' Next.js re-render, Christie's
`window.chrComponents.lots` blob format. When any of those break,
the corresponding house's lot count drops silently. This script
catches that drop on the next run and surfaces it via the alert
output (GitHub Actions log + the committed verification JSON).

Outputs:
  - public/verification_lots.json — today's report (date, alerts,
    per-house counts).
  - public/verification_lots_history.json — rolling 14-day per-
    house counts for the median baseline.

Designed to be run as a non-failing step in
`.github/workflows/scrape-auctions.yml` after
`auction_lots_scraper.py` writes its output.

Run: python3 verify_auction_lots.py
"""
import json
import statistics
from collections import Counter
from datetime import date
from pathlib import Path

PUBLIC = Path("public")
LOTS_FILE = PUBLIC / "auction_lots.json"
HISTORY_FILE = PUBLIC / "verification_lots_history.json"
REPORT_FILE = PUBLIC / "verification_lots.json"

# Same thresholds the dealer-side script uses — tuned wide so single-
# lot churn doesn't false-positive but real breakage (Sotheby's 95→0)
# catches.
DROP_THRESHOLD = 0.30
HISTORY_DAYS = 14
COMPARE_DAYS = 7
MIN_HISTORY_FOR_ALERT = 3


def load_history():
    if not HISTORY_FILE.exists():
        return []
    try:
        return json.loads(HISTORY_FILE.read_text()).get("history", [])
    except (json.JSONDecodeError, OSError):
        return []


def main():
    if not LOTS_FILE.exists():
        print(f"ERROR: {LOTS_FILE} missing — auction_lots_scraper.py did not produce output")
        return 1

    lots = json.loads(LOTS_FILE.read_text())
    today = date.today().isoformat()

    # Count LIVE lots only — sold lots are part of the historical
    # archive and shouldn't drag the alert. House count drops are
    # what we want to catch (scraper broken on a specific house).
    counts_today = Counter(
        v.get("house", "?") for v in lots.values()
        if v.get("status") not in ("ended", "sold")
    )

    history = load_history()
    previous = history[-1]["counts"] if history else {}

    alerts = []
    houses_today = set(counts_today.keys())
    houses_previous = set(previous.keys())

    # House-disappearance check — present yesterday with non-zero
    # count, gone today. Catches the case where a house's enumerator
    # raises and `out` ends up with no entries from that house.
    for house in houses_previous - houses_today:
        if previous[house] > 0:
            alerts.append({
                "house": house,
                "level": "ERROR",
                "today": 0,
                "previous": previous[house],
                "note": "house absent from today's lot scrape (was present yesterday)",
            })

    # Per-house rolling-median check.
    for house in houses_today:
        today_n = counts_today[house]
        past_counts = [
            h["counts"].get(house, 0)
            for h in history[-COMPARE_DAYS:]
        ]
        non_zero_past = [c for c in past_counts if c > 0]
        if len(non_zero_past) < MIN_HISTORY_FOR_ALERT:
            continue
        median = statistics.median(non_zero_past)
        if today_n == 0 and median > 0:
            alerts.append({
                "house": house,
                "level": "ERROR",
                "today": 0,
                "median": median,
                "note": "lot count dropped to zero (per-house enumerator broken)",
            })
        elif median > 0 and today_n / median < DROP_THRESHOLD:
            alerts.append({
                "house": house,
                "level": "WARN",
                "today": today_n,
                "median": median,
                "note": f"count is {today_n / median * 100:.0f}% of recent median ({today_n} vs ~{median:.0f})",
            })

    history.append({"date": today, "counts": dict(counts_today)})
    history = history[-HISTORY_DAYS:]
    HISTORY_FILE.write_text(json.dumps({"history": history}, indent=2) + "\n")

    report = {
        "date": today,
        "alerts": alerts,
        "counts": dict(counts_today),
        "total_live_lots": sum(counts_today.values()),
        "houses_tracked": len(counts_today),
    }
    REPORT_FILE.write_text(json.dumps(report, indent=2) + "\n")

    print(f"Auction-lot verification report for {today}:")
    print(f"  Total live lots: {report['total_live_lots']}")
    print(f"  Houses tracked: {report['houses_tracked']}")
    for house, n in sorted(counts_today.items()):
        print(f"    {house}: {n}")
    if alerts:
        print(f"  ALERTS: {len(alerts)}")
        for a in alerts:
            print(f"    [{a['level']}] {a['house']}: {a['note']}")
    else:
        print("  No anomalies detected.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
