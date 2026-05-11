#!/usr/bin/env python3
"""
Phillips known-auctions scraper.

phillips.com/watches only shows UPCOMING sales — past sales drop the
moment they end. That means:
  - Sales that ended yesterday vanish from the calendar
  - The comprehensive auction-lots scraper never enumerates them
  - Sold-price data for those sales never lands in auction_lots.json
  - Users who hearted lots from them see stale "active" state forever

Mark report 2026-05-11: this exact pattern hit Phillips Geneva
Watch Auction XXIII (CH080226, May 9-10). Results posted, our app
never saw them.

This scraper accepts a manual list of auction codes (data/
phillips_known_codes.json) and ALSO discovers codes by walking
public/tracked_lots.json for Phillips lot URLs the user has manually
tracked. For each code, fetches the auction page once to extract
title / location / dates, and writes data/phillips_known_auctions.csv
in the standard *_auctions.csv shape that merge.py glob-reads. Sales
flow into the auctions_state.json registry from there; comprehensive
auction_lots_scraper picks them up on its next run.

This file is glob-included by merge.py (matches data/*_auctions.csv).
The auction_id hash in merge.py keys off (house, dateStart, title) —
identical to the standard Phillips calendar scraper's output — so
when both surfaces emit the same sale, registry upsert merges them
on the same row rather than duplicating.

Run: python3 phillips_known_auctions_scraper.py
Output: data/phillips_known_auctions.csv
"""
import csv
import json
import os
import re
import sys
from datetime import datetime

import requests

KNOWN_CODES_FILE = "data/phillips_known_codes.json"
TRACKED_LOTS_FILE = "public/tracked_lots.json"
OUTPUT_FILE = "data/phillips_known_auctions.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def load_known_codes():
    """Read the manual codes list from KNOWN_CODES_FILE."""
    if not os.path.exists(KNOWN_CODES_FILE):
        return []
    try:
        with open(KNOWN_CODES_FILE) as f:
            blob = json.load(f)
        codes = blob.get("codes") or []
        return [c.strip() for c in codes if isinstance(c, str) and c.strip()]
    except Exception as e:
        print(f"  warn: {KNOWN_CODES_FILE} unreadable: {e}")
        return []


def codes_from_tracked_lots():
    """Walk public/tracked_lots.json and harvest every Phillips auction
    code we can find. scrape_phillips_lot stores `auction_code` on each
    Phillips lot record; we just collect the distinct values."""
    if not os.path.exists(TRACKED_LOTS_FILE):
        return []
    try:
        with open(TRACKED_LOTS_FILE) as f:
            data = json.load(f)
    except Exception as e:
        print(f"  warn: {TRACKED_LOTS_FILE} unreadable: {e}")
        return []
    if not isinstance(data, dict):
        return []
    codes = set()
    for url, entry in data.items():
        if not isinstance(entry, dict):
            continue
        if "phillips.com" not in url:
            continue
        code = entry.get("auction_code")
        if isinstance(code, str) and re.fullmatch(r"[A-Z]{2}\d+", code):
            codes.add(code)
    return sorted(codes)


def fetch_auction_meta(code):
    """Fetch phillips.com/auction/<code> and extract title + location +
    dates. Returns a dict or None on failure. We hit the same auction
    page that auction_lots_scraper's enumerate_phillips uses (Turbo-
    Stream payload) — the meta lives in the same React Router
    `loaderData.auction` object."""
    url = f"https://www.phillips.com/auction/{code}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [{code}] fetch failed: {e}")
        return None

    # Look for the Turbo-Stream chunks. Title sits in the auction's
    # `auctionName`; start/end in `auctionStartDateTime` /
    # `auctionEndDateTime`. Location is in `location.name` or similar
    # — we'll best-effort extract.
    html = r.text
    title = _extract_field(html, "auctionName")
    start = _extract_field(html, "auctionStartDateTime")
    end   = _extract_field(html, "auctionEndDateTime")
    location = _extract_field(html, "locationName") or _extract_field(html, "city") or ""
    if not title:
        # Fall back to <title>: "<Auction Name>" pattern
        m = re.search(r"<title>([^<]+?)</title>", html)
        if m:
            title = m.group(1).strip()
    if not (title and start):
        print(f"  [{code}] title/start not found in payload")
        return None
    return {
        "code":     code,
        "title":    title,
        "location": location,
        "start":    _iso_date(start),
        "end":      _iso_date(end) or _iso_date(start),
        "url":      url,
    }


def _extract_field(html, key):
    """Find the first `"<key>"<separator>"<value>"` JSON-encoded pair in
    HTML. The Phillips Turbo-Stream uses a flat-array reference format
    so the value can be either inline or a reference. For string fields
    (title / dates / location), the inline string is the common case."""
    m = re.search(r'"' + re.escape(key) + r'"\s*[:,]\s*"([^"]+)"', html)
    return m.group(1) if m else None


def _iso_date(s):
    """Phillips ships ISO 8601 ('2026-05-09T14:00:00.000Z') — take
    the date portion. Returns '' on parse failure."""
    if not s:
        return ""
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    return m.group(1) if m else ""


def main():
    print("Discovering Phillips known auctions...")
    manual_codes = load_known_codes()
    tracked_codes = codes_from_tracked_lots()
    codes = sorted(set(manual_codes) | set(tracked_codes))
    if not codes:
        print("  no known codes; skipping write")
        return
    print(f"  {len(manual_codes)} manual code(s), {len(tracked_codes)} tracked-lot code(s) → {len(codes)} unique")

    rows = []
    for code in codes:
        meta = fetch_auction_meta(code)
        if not meta:
            continue
        rows.append({
            "house":       "Phillips",
            "title":       meta["title"],
            "location":    meta["location"],
            "date_start":  meta["start"],
            "date_end":    meta["end"],
            "date_label":  f'{meta["start"]} – {meta["end"]}' if meta["start"] and meta["end"] != meta["start"] else meta["start"],
            "url":         meta["url"],
            "has_catalog": "True",
            "source":      "Phillips",
        })
        print(f"  [{code}] {meta['title'][:60]} · {meta['start']} – {meta['end']}")

    if not rows:
        print("  no rows to write")
        return

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["house", "title", "location", "date_start", "date_end", "date_label", "url", "has_catalog", "source"])
        w.writeheader()
        w.writerows(rows)
    print(f"\nWrote {len(rows)} row(s) to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
