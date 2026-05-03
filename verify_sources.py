#!/usr/bin/env python3
"""
Source-health verification script (Epic 0 / ROADMAP).

Runs after merge.py finishes. Counts live listings per source from
public/listings.json, compares each source's count to its rolling
7-day median, and flags anomalies:

  - ERROR: today's count is 0 but the source had listings in the
           rolling window (scraper completely broken / site down)
  - ERROR: source was present in the previous run but missing today
           (CSV failed to land, or merge.py dropped the source)
  - WARN:  today's count is below DROP_THRESHOLD * median (typically a
           parser regression — site changed structure, scraper still
           runs but returns less)

Outputs:
  - public/verification.json — today's report (date, alerts, counts).
    Machine-readable; future admin UI / status banner can render it.
  - public/verification_history.json — rolling 14-day per-source counts
    so future runs have a baseline to compare against. Append-only,
    trimmed to the most recent N days.

Designed to be run as a non-failing step in the workflow (`|| true`)
so a verification glitch never blocks the rest of the cron. Errors
surface via GitHub Actions log lines + the committed verification.json.

Run: python3 verify_sources.py
"""
import json
import statistics
from collections import Counter
from datetime import date
from pathlib import Path

PUBLIC = Path("public")
LISTINGS = PUBLIC / "listings.json"
HISTORY_FILE = PUBLIC / "verification_history.json"
REPORT_FILE = PUBLIC / "verification.json"

# A source whose live count drops below 30% of its rolling-7-day median
# gets flagged. Tuned so seasonal dips (single-listing dealer sells
# their one Pepsi, count goes 1→0 → that's noise) don't false-positive
# but actual scraper breakage (Wind Vintage 280→25) catches.
DROP_THRESHOLD = 0.30
HISTORY_DAYS = 14
COMPARE_DAYS = 7
MIN_HISTORY_FOR_ALERT = 3  # need this many days of history before judging


def load_history():
    if not HISTORY_FILE.exists():
        return []
    try:
        return json.loads(HISTORY_FILE.read_text()).get("history", [])
    except (json.JSONDecodeError, OSError):
        return []


def main():
    if not LISTINGS.exists():
        print(f"ERROR: {LISTINGS} missing — merge.py did not produce listings.json")
        return 1

    listings = json.loads(LISTINGS.read_text())
    today = date.today().isoformat()

    counts_today = Counter(
        it.get("source", "?") for it in listings if not it.get("sold")
    )

    history = load_history()
    # The "previous" snapshot is the most recent prior history entry,
    # used for source-disappearance detection (different signal from
    # the median-based one).
    previous = history[-1]["counts"] if history else {}

    alerts = []
    sources_today = set(counts_today.keys())
    sources_previous = set(previous.keys())

    # Source disappearance — present yesterday with non-zero count, gone
    # today. Distinct from "count to zero" because the source might not
    # be in counts_today AT ALL (CSV missing, source removed from
    # SOURCES list temporarily, etc.).
    for source in sources_previous - sources_today:
        if previous[source] > 0:
            alerts.append({
                "source": source,
                "level": "ERROR",
                "today": 0,
                "previous": previous[source],
                "note": "source absent from today's listings (was present yesterday)",
            })

    # Per-source rolling-median check — needs enough history to be useful.
    for source in sources_today:
        today_n = counts_today[source]
        past_counts = [
            h["counts"].get(source, 0)
            for h in history[-COMPARE_DAYS:]
        ]
        # Only judge if we have enough history points for the source.
        non_zero_past = [c for c in past_counts if c > 0]
        if len(non_zero_past) < MIN_HISTORY_FOR_ALERT:
            continue
        median = statistics.median(non_zero_past)
        if today_n == 0 and median > 0:
            alerts.append({
                "source": source,
                "level": "ERROR",
                "today": 0,
                "median": median,
                "note": "count dropped to zero (scraper broken or site down)",
            })
        elif median > 0 and today_n / median < DROP_THRESHOLD:
            alerts.append({
                "source": source,
                "level": "WARN",
                "today": today_n,
                "median": median,
                "note": f"count is {today_n / median * 100:.0f}% of recent median ({today_n} vs ~{median:.0f})",
            })

    # Append today, trim history.
    history.append({"date": today, "counts": dict(counts_today)})
    history = history[-HISTORY_DAYS:]
    HISTORY_FILE.write_text(json.dumps({"history": history}, indent=2) + "\n")

    report = {
        "date": today,
        "alerts": alerts,
        "counts": dict(counts_today),
        "total_listings": sum(counts_today.values()),
        "sources_tracked": len(counts_today),
    }
    REPORT_FILE.write_text(json.dumps(report, indent=2) + "\n")

    print(f"Verification report for {today}:")
    print(f"  Total live listings: {report['total_listings']}")
    print(f"  Sources tracked: {report['sources_tracked']}")
    if alerts:
        print(f"  ALERTS: {len(alerts)}")
        for a in alerts:
            print(f"    [{a['level']}] {a['source']}: {a['note']}")
    else:
        print("  No anomalies detected.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
