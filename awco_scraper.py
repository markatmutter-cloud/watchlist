#!/usr/bin/env python3
"""
Amsterdam Watch Company (awco.nl) scraper — WooCommerce Store API, EUR.

AWCo is an Amsterdam dealer (vintage plus a handful of new watches and
special editions). The public Store API at /wp-json/wc/store/v1/products
needs no auth, but two quirks on their install shape this file:

  * The unfiltered catalog is ~2,700 products, nearly all of it the sold
    archive. We walk the three categories behind awco.nl/watches/ instead:
    vintage-watches (~330), newwatches and special-editions (~12 each).
    New pieces are kept on purpose: any vintage-only cutoff year would be
    arbitrary, and over-including beats a wrong filter (Mark, 2026-10-04).
    Straps and gifts live in other categories and never get walked.
  * Their `stock_status` filter is broken: `stock_status=instock` reports
    MORE items than the unfiltered total and returns each product twice
    (a bad JOIN somewhere upstream). So we never use it — stock is
    checked client-side via `is_in_stock`, and rows are de-duplicated by
    product id (a product can also sit in more than one category).

Brand comes from the structured `pa_brand` attribute when present (AWCo
fills it consistently), falling back to a title match.

Run: python3 awco_scraper.py
Output: awco_listings.csv
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

BASE = "https://awco.nl"
API = f"{BASE}/wp-json/wc/store/v1/products"
CATEGORIES = ["vintage-watches", "newwatches", "special-editions"]
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE}/",
}

SOURCE = "Amsterdam Watch Company"
OUTPUT = "awco_listings.csv"
PRIOR_CSV_PATH = "data/awco.csv"
# Truncation guard (CLAUDE.md "Resilience"): skip the write only when the
# result is BOTH under half the prior run AND under the absolute floor,
# so merge.py keeps prior state instead of false-flagging items as sold.
MIN_HEALTHY_RATIO = 0.5
ABSOLUTE_FLOOR = 25

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC",
    "Cartier", "Jaeger-LeCoultre", "Panerai", "Audemars Piguet",
    "Vacheron Constantin", "A. Lange", "Heuer", "Longines",
    "Universal Geneve", "Movado", "Zenith", "Breguet", "Blancpain",
    "Eberhard", "Girard-Perregaux", "Tissot", "Doxa", "Lemania",
    "Minerva", "Hamilton", "Chopard", "Piaget", "Corum", "Ulysse Nardin",
    "Squale", "Nomos", "Dornblüth", "Van der Klaauw", "Van der Gang",
    "Baume & Mercier", "Franck Muller", "F.P. Journe", "Seiko",
]


def detect_brand(title):
    lower = title.lower()
    for b in BRANDS:
        if b.lower() in lower:
            return b
    return "Other"


def attribute(item, name):
    """First term name of a product attribute (e.g. 'Brand'), or ''."""
    for attr in item.get("attributes") or []:
        if (attr.get("name") or "").lower() == name.lower():
            terms = attr.get("terms") or []
            if terms:
                return html.unescape(terms[0].get("name") or "").strip()
    return ""


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def get_category(category):
    items = []
    page = 1
    per_page = 100
    while True:
        print(f"Fetching {category} page {page}...")
        try:
            batch = fetch_json_with_retry(API, params={
                "per_page": per_page,
                "page": page,
                "category": category,
            }, headers=HEADERS, timeout=30)
        except requests.RequestException as e:
            # A dropped page is a truncation, not a failure: keep what we
            # have and let main()'s guard decide whether it's healthy.
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


def get_all_listings():
    items = []
    for category in CATEGORIES:
        items.extend(get_category(category))
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
    brand = attribute(item, "Brand") or detect_brand(title)
    return {
        "title": title,
        "brand": brand,
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
    print(f"Fetching {SOURCE} inventory (WooCommerce Store API, categories={', '.join(CATEGORIES)})...")
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
        parsed = parse_item(item)
        if parsed["sold"]:
            skipped["sold"] += 1
            continue
        if parsed["price"] <= 0:
            skipped["no price"] += 1
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
    for b, c in Counter(r["brand"] for r in results).most_common():
        print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
