#!/usr/bin/env python3
"""
Bonhams auction-lot scraper — RESIDENTIAL host only (B-24 / B-25).

Why this exists as its own file:
  Bonhams' per-sale lot pages sit behind Cloudflare in a mode that 403s
  GitHub's datacenter IPs (confirmed via the source-probe workflow, #584),
  so `auction_lots_scraper.py` — which runs in CI — can't fetch Bonhams lots
  and they fall out of `public/auction_lots.json` on every CI run (CI drops
  active lots it didn't scrape). The lot DATA is fully reachable from a
  residential IP, and the enumerator already exists (`enumerate_bonhams`).

  So this script runs on a residential host (Mark's laptop via launchd, B-25),
  reuses the existing enumerator + active-window logic, and writes Bonhams
  lots to their OWN file, `public/bonhams_lots.json`. The frontend folds that
  file into the same Auctions projection by URL key (mirroring
  manual_archive_lots.json), so CI's auction_lots.json sweep can never clobber
  it. As of 2026-06-13 (B-72) the Bonhams *calendar* ALSO runs here — the
  department page now 403s CI too — so the residential wrapper runs both
  bonhams_auctions_scraper.py (→ data/bonhams_auctions.csv) and this lots
  scraper. CI's merge.py re-emits the calendar from that CSV.

Run: python3 bonhams_lots_scraper.py
Requires: pip install -r requirements-auctions.txt  (curl-cffi for Bonhams)
Reads:   public/auctions.json  (the schedule, maintained by CI)
Writes:  public/bonhams_lots.json  (URL-keyed; same shape as auction_lots.json)
"""

import json
import os
import sys
import time
from datetime import date, datetime, timezone

# Reuse the shared enumerator + gating from the comprehensive scraper.
# Importing is safe — its main() is guarded by `if __name__ == "__main__"`.
from auction_lots_scraper import (
    enumerate_bonhams,
    in_active_window,
    drop_jewellery_lots,
    is_excluded_catalog,
    is_excluded_title,
)

AUCTIONS_JSON = "public/auctions.json"
OUTPUT_JSON = "public/bonhams_lots.json"
HOUSE = "Bonhams"
URL_NEEDLE = "bonhams.com/auction/"

# ── Adaptive throttle (B-24 ramp / B-25 host) ───────────────────────────
# The launchd host (B-25) ticks at a fixed, fine cadence (hourly). The
# DECISION of whether to actually scrape lives here, keyed to how close any
# in-window sale is to ending — because Bonhams' JSON carries no live bid
# (only estimates + the realised hammerPremium that lands AT close), the
# only thing worth chasing frequently is the post-close results window.
#
# Day-precision: auctions.json carries dateEnd as a date, not a datetime, so
# the ramp resolves to days. Could be sharpened to hours by reading each
# sale's hammerTime, but that needs a fetch — exactly what we're throttling.
RESULTS_WINDOW_MIN = 60     # a sale ending today / ended in the last ~2 days
ACTIVE_MIN = 360            # something live or upcoming-with-catalog (6h)
IDLE_MIN = 720              # nothing close to a boundary (12h)
RESULTS_WINDOW_DAYS = 2     # days after dateEnd to keep hammering for results
# Host state (last-run timestamp) lives OUTSIDE the repo — it's per-machine
# orchestration state, not repo data, so it must never be committed.
STATE_PATH = os.path.expanduser("~/.watchlist_bonhams_scrape.json")


def _desired_interval_minutes(targets, today=None):
    """Minutes to wait between scrapes given the in-window sales' proximity
    to their end date. Smaller = scrape more often."""
    today = today or date.today()
    interval = IDLE_MIN
    for sale in targets:
        de = (sale.get("dateEnd") or sale.get("dateStart") or "")[:10]
        try:
            d_end = datetime.fromisoformat(de).date()
        except (ValueError, TypeError):
            continue
        days_since_end = (today - d_end).days
        if 0 <= days_since_end <= RESULTS_WINDOW_DAYS or d_end == today:
            return RESULTS_WINDOW_MIN          # in/just-past a close — finest
        interval = min(interval, ACTIVE_MIN)   # live/upcoming — moderate
    return interval


def _minutes_since_last_run():
    try:
        with open(STATE_PATH) as f:
            ts = json.load(f).get("last_run_ts")
        return (time.time() - float(ts)) / 60.0
    except Exception:
        return None  # no prior run recorded → always due


def _record_run():
    try:
        with open(STATE_PATH, "w") as f:
            json.dump({"last_run_ts": time.time(),
                       "last_run_iso": datetime.now(timezone.utc).isoformat()}, f)
    except Exception as e:
        print(f"  warn: couldn't write throttle state {STATE_PATH}: {e}")


def load_prior():
    if not os.path.exists(OUTPUT_JSON):
        return {}
    try:
        with open(OUTPUT_JSON) as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except Exception as e:
        print(f"  warn: couldn't read existing {OUTPUT_JSON}: {e}")
        return {}


def main():
    if not os.path.exists(AUCTIONS_JSON):
        print(f"ERROR: {AUCTIONS_JSON} not found — run merge.py first "
              "(it builds the schedule the lot scraper reads).", file=sys.stderr)
        sys.exit(1)
    with open(AUCTIONS_JSON) as f:
        auctions = json.load(f)
    today = date.today()

    targets = [
        sale for sale in auctions
        if isinstance(sale, dict)
        and (sale.get("house") or "") == HOUSE
        and URL_NEEDLE in (sale.get("url") or "")
        and in_active_window(sale, today)
    ]

    # --throttle: launchd ticks hourly; only actually scrape when due, where
    # "due" tightens to hourly near a sale's close (see the constants above).
    # --force overrides (manual run). Skipping is a clean exit 0.
    if "--throttle" in sys.argv and "--force" not in sys.argv:
        interval = _desired_interval_minutes(targets, today)
        since = _minutes_since_last_run()
        if since is not None and since < interval:
            print(f"Throttled: {since:.0f} min since last run, want ≥{interval} "
                  f"({len(targets)} sale(s) in window). Skipping.")
            return
        print(f"Due: {('%.0f min' % since) if since is not None else 'no prior run'} "
              f"since last run, threshold {interval} min.")

    print(f"Bonhams lot scrape: {len(targets)} sale(s) in active window\n")

    out = {}
    for sale in targets:
        sale_url = sale["url"]
        label = sale.get("dateLabel") or sale.get("dateStart") or ""
        # Catalog-level exclusion: skip non-watch sales (e.g. "Espionage:
        # Fact & Fiction") entirely. See EXCLUDE_CATALOG_TITLES.
        if is_excluded_catalog(sale.get("title")):
            print(f"[Bonhams] skipping blocklisted catalog: {sale.get('title')!r}")
            continue
        print(f"[Bonhams] {label}: {sale_url}")
        try:
            lots = enumerate_bonhams(sale_url, sale)
        except Exception as e:
            # One sale failing (transient Cloudflare/network) must not wipe
            # the others or the persisted sold history below.
            print(f"  enumeration error: {e}")
            continue
        # Mixed jewellery-and-watches sales (Bonhams runs them at
        # Knightsbridge) are carried whole; their non-watch lots go here.
        lots, n_jewellery = drop_jewellery_lots(lots, sale.get("title"))
        if n_jewellery:
            print(f"  {n_jewellery} jewellery lot(s) dropped (mixed sale)")
        kept = 0
        for url, data in lots:
            if is_excluded_title(data.get("title")):
                continue
            out[url] = data
            kept += 1
        print(f"  → {kept} lots\n")

    # Persist historical SOLD lots permanently — same contract as
    # auction_lots_scraper.main(): once a sale ends and drops out of the
    # active window, keep any lot that carries a realized sold_price so the
    # archive never loses it. Active/unsold lots are NOT persisted — they're
    # re-scraped while in-window and would otherwise become dead weight.
    prior = load_prior()
    persisted = 0
    for url, data in prior.items():
        if url in out:
            continue
        if not isinstance(data, dict):
            continue
        sp = data.get("sold_price")
        if sp in (None, 0):
            continue
        out[url] = data
        persisted += 1
    if persisted:
        print(f"Persisted {persisted} historical sold Bonhams lot(s) not in this scrape")

    # Truncation guard (CLAUDE.md philosophy): if we had Bonhams active lots
    # before and this run produced none while a sale is in-window, that's far
    # more likely a transient block than a real emptying — skip the write so
    # the prior file (incl. active lots) survives until the next run.
    prior_active = sum(
        1 for v in prior.values()
        if isinstance(v, dict) and v.get("sold_price") in (None, 0)
    )
    new_active = sum(
        1 for v in out.values()
        if isinstance(v, dict) and v.get("sold_price") in (None, 0)
    )
    if targets and prior_active >= 10 and new_active == 0:
        print(f"ERROR: had {prior_active} active Bonhams lot(s), scraped 0 with "
              f"{len(targets)} sale(s) in-window — likely a transient block. "
              "Not writing (prior file preserved).")
        sys.exit(1)

    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    _record_run()  # mark the throttle clock only on a real, completed scrape
    sold = sum(1 for v in out.values() if isinstance(v, dict) and v.get("sold_price"))
    print(f"\n✓ Wrote {len(out)} Bonhams lot(s) to {OUTPUT_JSON} "
          f"({new_active} active · {sold} sold)")


if __name__ == "__main__":
    main()
