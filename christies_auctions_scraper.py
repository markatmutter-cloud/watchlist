#!/usr/bin/env python3
"""
Christie's watch auctions calendar scraper.

The watches department page is a Next.js app whose Sitecore JSS layout
ships an `Auctions` array with everything we need: SaleNumber,
AuctionTitle, AuctionUrl, AuctionStartDate, AuctionEndDate, Location,
AuctionType (Live or Online).

No Playwright needed — the data is fully embedded in the
`__NEXT_DATA__` script tag. One HTTP request, parse JSON, write CSV.

Run: python3 christies_auctions_scraper.py
Output: christies_auctions_listings.csv
"""

import csv
import json
import re
import sys
from datetime import datetime

import requests

URL = "https://www.christies.com/en/departments/watches-and-wristwatches"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/132.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def parse_iso_date(s):
    """'2026-05-11T13:00Z' → '2026-05-11'."""
    if not s:
        return ""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""


def find_auctions_array(obj):
    """Recursively walk the parsed __NEXT_DATA__ object to find any
    list of dicts that looks like Christie's auction-card schema
    (`SaleNumber` + `AuctionStartDate`). Returns the first match —
    Christie's only ships one such list per department page."""
    if isinstance(obj, list):
        if obj and isinstance(obj[0], dict):
            keys = set(obj[0].keys())
            if "SaleNumber" in keys and "AuctionStartDate" in keys:
                return obj
        for item in obj:
            found = find_auctions_array(item)
            if found:
                return found
    elif isinstance(obj, dict):
        for v in obj.values():
            found = find_auctions_array(v)
            if found:
                return found
    return None


def scrape():
    print(f"Fetching {URL} ...")
    r = requests.get(URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    html = r.text

    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        print("ERROR: __NEXT_DATA__ not found in page", file=sys.stderr)
        return []
    data = json.loads(m.group(1))
    raw_auctions = find_auctions_array(data) or []
    if not raw_auctions:
        print("WARNING: no auctions array found in JSS payload", file=sys.stderr)
        return []
    today = datetime.utcnow().date().isoformat()

    results = []
    for a in raw_auctions:
        title = (a.get("AuctionTitle") or "").strip()
        if not title:
            continue
        date_start = parse_iso_date(a.get("AuctionStartDate"))
        date_end = parse_iso_date(a.get("AuctionEndDate")) or date_start
        if not date_start:
            continue
        # Skip past sales — frontend's age logic doesn't add value once
        # the sale is over and we don't track lots from this scraper.
        if date_end < today:
            continue
        location = (a.get("Location") or "").strip()
        if a.get("AuctionType") == "Online" and location:
            location = f"Online, {location}"
        elif a.get("AuctionType") == "Online":
            location = "Online"

        url = (a.get("AuctionUrl") or "").strip()

        # has_catalog: Christie's `OnView` field correlates roughly with
        # "lots are browseable" but isn't perfect. Treat any auction
        # with a non-empty URL as having a catalog page; the frontend's
        # auctions tab links to whatever Christie's surfaces.
        has_catalog = bool(url)

        date_label = (f"{date_start} – {date_end}"
                      if date_end != date_start else date_start)

        results.append({
            "house":       "Christie's",
            "title":       title,
            "location":    location,
            "date_start":  date_start,
            "date_end":    date_end,
            "date_label":  date_label,
            "url":         url,
            "has_catalog": "True" if has_catalog else "False",
            "source":      "Christie's",
        })

    # Dedup by URL (or by date+title for online sales without URL).
    seen = set()
    unique = []
    for row in results:
        key = row["url"] or f"{row['date_start']}|{row['title']}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def main():
    print("Scraping Christie's watch auctions calendar...")
    auctions = scrape()
    if not auctions:
        print("\n⚠ No auctions parsed; writing empty CSV with header so the "
              "merge step doesn't choke.")

    out_file = "christies_auctions_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "house", "title", "location", "date_start", "date_end",
            "date_label", "url", "has_catalog", "source",
        ])
        writer.writeheader()
        writer.writerows(auctions)

    print(f"\n✓ Saved {len(auctions)} auction(s) to {out_file}")
    for a in auctions:
        print(f"  {a['date_label']}  {a['location']:20s}  {a['title'][:60]}")


if __name__ == "__main__":
    main()
