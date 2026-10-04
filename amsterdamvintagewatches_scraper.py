#!/usr/bin/env python3
"""
Amsterdam Vintage Watches scraper — WooCommerce Store API, EUR.

High-end Amsterdam dealer (Paul Newman Daytonas, Nautilus, Royal Oak).
The public Store API at /wp-json/wc/store/v1/products needs no auth.
The full catalog is ~2,500 products, ~95% of them the sold archive, so
we ask for `stock_status=instock` (which, unlike AWCo's install, returns
a sane count here; we de-duplicate by id anyway).

What we keep and drop:
  * Categories `wrist-watches` and `stocklist` ("The Loop") are stock.
  * `museum` is their not-for-sale collection: in stock, price 0,
    not purchasable. Dropped.
  * Any other price-0 row is price-on-request. Dropped, same hygiene as
    every other dealer source.
  * Many "The Loop" items carry no image. They're kept; the card falls
    back to the favicon placeholder.

Run: python3 amsterdamvintagewatches_scraper.py
Output: amsterdamvintagewatches_listings.csv
"""
import csv
import html
import os
import re
import sys
import time
from collections import Counter

import requests

from scraper_lib import fetch_json_with_retry

BASE = "https://amsterdamvintagewatches.com"
API = f"{BASE}/wp-json/wc/store/v1/products"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE}/",
}

SOURCE = "Amsterdam Vintage Watches"
OUTPUT = "amsterdamvintagewatches_listings.csv"
PRIOR_CSV_PATH = "data/amsterdamvintagewatches.csv"
EXCLUDED_CATEGORIES = {"museum"}
# Truncation guard (CLAUDE.md "Resilience").
MIN_HEALTHY_RATIO = 0.5
ABSOLUTE_FLOOR = 25

BRANDS = [
    "Rolex", "Patek Philippe", "Audemars Piguet", "Cartier", "Omega",
    "Vacheron Constantin", "A. Lange", "Tudor", "Heuer", "Breitling",
    "IWC", "Jaeger-LeCoultre", "Panerai", "Universal Geneve", "Zenith",
    "Longines", "Breguet", "Blancpain", "Piaget", "Chopard", "Gerald Genta",
    "F.P. Journe", "Daniel Roth", "Gübelin",
]


def detect_brand(title):
    lower = title.lower()
    for b in BRANDS:
        if b.lower() in lower:
            return b
    return "Other"


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def get_all_listings():
    items = []
    page = 1
    per_page = 100
    while True:
        print(f"Fetching page {page}...")
        try:
            batch = fetch_json_with_retry(API, params={
                "per_page": per_page,
                "page": page,
                "stock_status": "instock",
            }, headers=HEADERS, timeout=30)
        except requests.RequestException as e:
            print(f"  ! page {page} failed ({e}); keeping {len(items)} items already fetched")
            break
        if not batch:
            break
        items.extend(batch)
        print(f"  Got {len(batch)} items (total so far: {len(items)})")
        if len(batch) < per_page:
            break
        page += 1
        time.sleep(0.5)
    return items


def parse_item(item):
    title = strip_html(item.get("name", ""))
    prices = item.get("prices") or {}
    minor = int(prices.get("currency_minor_unit", 2) or 0)
    try:
        price = int(prices.get("price") or 0) // (10 ** minor)
    except (ValueError, TypeError):
        price = 0
    images = item.get("images") or []
    return {
        "title": title,
        "brand": detect_brand(title),
        "price": price,
        "url": item.get("permalink", ""),
        "img": images[0].get("src", "") if images else "",
        "description": strip_html(item.get("short_description") or item.get("description") or "")[:500],
        "source": SOURCE,
        "sold": not item.get("is_in_stock", True),
    }


def prior_count():
    if not os.path.exists(PRIOR_CSV_PATH):
        return 0
    try:
        with open(PRIOR_CSV_PATH, encoding="utf-8") as f:
            return sum(1 for _ in csv.DictReader(f))
    except (OSError, csv.Error):
        return 0


def main():
    print(f"Fetching {SOURCE} inventory (WooCommerce Store API, in stock)...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    results = []
    seen = set()
    skipped = Counter()
    for item in raw:
        pid = item.get("id")
        if pid in seen:
            skipped["duplicate"] += 1
            continue
        seen.add(pid)
        cats = {c.get("slug") for c in item.get("categories") or []}
        if cats & EXCLUDED_CATEGORIES:
            skipped["museum"] += 1
            continue
        parsed = parse_item(item)
        if parsed["sold"]:
            skipped["sold"] += 1
            continue
        if parsed["price"] <= 0:
            skipped["price on request"] += 1
            continue
        results.append(parsed)
    if skipped:
        print("Skipped: " + ", ".join(f"{n} {k}" for k, n in skipped.items()))

    if not results:
        # CLAUDE.md: a scrape that parsed nothing must exit non-zero.
        print("✗ No live listings parsed — failing so the health gate sees it.")
        sys.exit(1)

    prev = prior_count()
    if prev and len(results) < ABSOLUTE_FLOOR and len(results) < prev * MIN_HEALTHY_RATIO:
        print(f"\n⚠ Aborting write: {len(results)} items is below half of prior "
              f"{prev} and under {ABSOLUTE_FLOOR}. Keeping {PRIOR_CSV_PATH}.")
        sys.exit(0)

    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["title", "brand", "price", "url", "img", "description", "source", "sold"])
        writer.writeheader()
        writer.writerows(results)

    prices = [r["price"] for r in results]
    print(f"\n✓ Saved {len(results)} listings to {OUTPUT} (EUR)")
    print(f"  Min: €{min(prices):,} | Max: €{max(prices):,} | Avg: €{sum(prices)//len(prices):,}")
    no_img = sum(1 for r in results if not r["img"])
    if no_img:
        print(f"  {no_img} without an image")
    for b, c in Counter(r["brand"] for r in results).most_common():
        print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
