#!/usr/bin/env python3
"""
Manual historical-auction scraper — Phase D (Epic 2).

Walks every sale listed in data/manual_archive_sales.json and writes
its lots to public/manual_archive_lots.json. Intended for one-shot
runs when adding a new historical sale to the registry; archive lots
are immutable so there's no recurring cron — once written, the entries
never need re-scraping.

Why a separate output file from public/auction_lots.json:
  - auction_lots.json is rebuilt from scratch by auction_lots_scraper.py
    on every cron run (it walks active sales from auctions.json). If we
    co-located, every cron would clobber the manual archive entries.
  - Keeping them in their own file lets the daily comprehensive sweep
    stay simple, while archive entries stay frozen.

App.js loads both files and merges them by URL key, identical shape,
so the projection into the Listings feed treats them the same way.

Usage:
    python3 manual_archive_scraper.py             # scrape every sale in the registry
    python3 manual_archive_scraper.py --url URL   # scrape one sale ad-hoc

Reuses auction_lots_scraper.enumerate_phillips for lot enumeration
and auctionlots_scraper.scrape_phillips_lot for per-lot detail. The
per-sale 60-lot cap from auction_lots_scraper.PHILLIPS_LOTS_PER_SALE
is overridden here — historical sales aren't time-pressured CI runs.
"""
import argparse
import json
import os
import re
import sys
import time

import requests

# Reach into the existing scraper for the per-house enumerators +
# per-lot fetchers. enumerate_phillips already pulls /detail/<slug>/<id>
# tile paths off the auction page; the cap there is a soft CI guard.
import auction_lots_scraper as als
import auctionlots_scraper as al

OUTPUT_PATH = "public/manual_archive_lots.json"
REGISTRY_PATH = "data/manual_archive_sales.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}


def load_registry():
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_existing_output():
    if not os.path.exists(OUTPUT_PATH):
        return {}
    try:
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            d = json.load(f)
            return d if isinstance(d, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def enumerate_phillips_uncapped(sale_url):
    """Same as auction_lots_scraper.enumerate_phillips but without the
    PHILLIPS_LOTS_PER_SALE cap. Archive sales aren't a CI-time concern.
    """
    r = requests.get(sale_url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    paths = sorted(set(re.findall(r"/detail/[a-z0-9-]+/\d+", r.text)))
    return [f"https://www.phillips.com{p}" for p in paths]


def scrape_sale(sale):
    """Walk one historical sale and return {url: lot_dict} for every lot."""
    sale_url = sale["url"]
    house = sale.get("house", "")
    sale_date = sale.get("date")  # YYYY-MM-DD or None
    sale_title = sale.get("title")

    if "phillips.com/auctions/auction/" not in sale_url and "phillips.com/auction/" not in sale_url:
        print(f"[skip] only Phillips archive URLs supported in v1: {sale_url}")
        return {}

    print(f"\n[{house}] {sale_url}")
    if sale_title:
        print(f"  {sale_title}")

    urls = enumerate_phillips_uncapped(sale_url)
    print(f"  {len(urls)} lot URL(s) found")

    out = {}
    for i, url in enumerate(urls, 1):
        try:
            data = al.scrape_phillips_lot(url)
        except Exception as e:
            print(f"    [{i}/{len(urls)}] FAIL {url}: {e}")
            continue
        if als.is_excluded_title(data.get("title")):
            print(f"    [{i}/{len(urls)}] skip excluded {url}")
            continue
        # Stamp the sale date so the projection has a real soldAt /
        # auction_end value to sort on. Phillips archive lots don't
        # carry the date in their HTML; the registry is the source
        # of truth.
        if sale_date and not data.get("auction_end"):
            data["auction_end"] = sale_date
        if sale_title and not data.get("auction_title"):
            data["auction_title"] = sale_title
        out[url] = data
        sold = data.get("sold_price")
        cur = data.get("currency", "")
        title = (data.get("title") or "")[:60]
        print(f"    [{i}/{len(urls)}] {sold or '—':>7} {cur}  {title}")
        time.sleep(0.4)  # be a polite citizen on the archive
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="Scrape one sale URL ad-hoc instead of the registry")
    parser.add_argument("--house", default="Phillips", help="House name (only used with --url)")
    parser.add_argument("--date", help="Sale date YYYY-MM-DD (only used with --url)")
    parser.add_argument("--title", help="Sale title (only used with --url)")
    args = parser.parse_args()

    if args.url:
        sales = [{
            "url": args.url, "house": args.house,
            "date": args.date, "title": args.title,
        }]
    else:
        sales = load_registry()

    out = load_existing_output()
    print(f"Loaded {len(out)} existing lot(s) from {OUTPUT_PATH}")

    for sale in sales:
        new_lots = scrape_sale(sale)
        out.update(new_lots)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)
    print(f"\n✓ Wrote {len(out)} lot(s) to {OUTPUT_PATH}")
    sold_count = sum(1 for d in out.values() if d.get("status") == "ended")
    print(f"  ({sold_count} ended)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
