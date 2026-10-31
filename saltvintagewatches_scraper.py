#!/usr/bin/env python3
"""
Salt Vintage Watches scraper — Shopify, GBP.

UK dealer (saltvintagewatches.com), launched Oct 2026: Rolex sports models,
Heuer, Breitling, Omega, a little Patek / AP. Currency verified from the
storefront (`Shopify.currency = {"active":"GBP"}`, `"currencyCode":"GBP"`),
not the TLD.

Walks the whole /products.json catalog rather than a collection: the live
`shop` collection and the sold `archive` collection overlap, and every
product is typed "Watches", so availability on the variant is the only
filter needed. Sold pieces stay in the catalog (13 of 48 at launch) and are
dropped here by `available`; merge.py's disappearance logic marks them sold.
Product bodies are empty on every listing, so description stays blank.

Run: python3 saltvintagewatches_scraper.py
Output: saltvintagewatches_listings.csv
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

BASE = "https://saltvintagewatches.com"
API = f"{BASE}/products.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

SOURCE = "Salt Vintage Watches"
OUTPUT = "saltvintagewatches_listings.csv"
PRIOR_CSV_PATH = "data/saltvintagewatches.csv"
PAGE_SIZE = 250
# Truncation guard (CLAUDE.md "Resilience"). The floor is small because the
# whole live catalog is ~35 pieces; the usual 25 would wedge the guard after
# an ordinary run of sales.
MIN_HEALTHY_RATIO = 0.5
ABSOLUTE_FLOOR = 10

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC", "Cartier",
    "Jaeger-LeCoultre", "Panerai", "Audemars Piguet", "Vacheron Constantin",
    "Universal Geneve", "Heuer", "Longines", "Movado", "Zenith", "Breguet",
    "Blancpain", "Enicar", "Lemania", "Favre Leuba", "Sinn", "Squale",
    "Eberhard", "Doxa", "Seiko", "Girard-Perregaux", "Minerva", "Nivada",
]
# Shopify "vendor" is the brand here, but guard against the dealer's own name
# leaking in if a product is ever filed under the store.
DEALER_VENDORS = {"salt vintage watches", "salt", "saltvintagewatches.com", ""}


def detect_brand(title, vendor=""):
    if vendor and vendor.strip().lower() not in DEALER_VENDORS:
        for b in BRANDS:
            if b.lower() == vendor.strip().lower():
                return b
        return vendor.strip()
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


def get_all_products():
    products = []
    page = 1
    while True:
        print(f"Fetching page {page}...")
        try:
            batch = fetch_json_with_retry(
                API, headers=HEADERS, timeout=30,
                params={"limit": PAGE_SIZE, "page": page},
            ).get("products", [])
        except requests.RequestException as e:
            if page == 1:
                # Nothing fetched: fail loudly so the health gate sees it.
                print(f"✗ first page failed ({e})")
                sys.exit(1)
            print(f"  ! page {page} failed ({e}); keeping {len(products)} items already fetched")
            break
        if not batch:
            break
        products.extend(batch)
        print(f"  Got {len(batch)} (total: {len(products)})")
        if len(batch) < PAGE_SIZE:
            break
        page += 1
        time.sleep(0.3)
    return products


def parse_product(p):
    title = strip_html(p.get("title", ""))
    variants = p.get("variants") or []
    # Single "Default Title" variant today; if that ever changes, price the
    # cheapest variant that can actually be bought.
    live = [v for v in variants if v.get("available")]
    chosen = min(live, key=lambda v: float(v.get("price") or 0), default=None)
    try:
        price = int(float((chosen or {}).get("price") or 0))
    except (TypeError, ValueError):
        price = 0
    images = p.get("images") or []
    return {
        "title": title,
        "brand": detect_brand(title, p.get("vendor", "")),
        "price": price,
        "url": f"{BASE}/products/{p.get('handle', '')}",
        "img": images[0].get("src", "") if images else "",
        "description": strip_html(p.get("body_html", ""))[:500],
        "source": SOURCE,
        "sold": chosen is None,
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
    print(f"Fetching {SOURCE} inventory (Shopify products.json)...")
    raw = get_all_products()
    print(f"\nTotal products: {len(raw)}")

    results = []
    seen = set()
    skipped = Counter()
    for p in raw:
        if p.get("id") in seen:
            skipped["duplicate"] += 1
            continue
        seen.add(p.get("id"))
        ptype = (p.get("product_type") or "").lower()
        if ptype and "watch" not in ptype:
            skipped["not a watch"] += 1
            continue
        parsed = parse_product(p)
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
    print(f"\n✓ Saved {len(results)} listings to {OUTPUT} (GBP)")
    print(f"  Min: £{min(prices):,} | Max: £{max(prices):,} | Avg: £{sum(prices)//len(prices):,}")
    no_img = sum(1 for r in results if not r["img"])
    if no_img:
        print(f"  {no_img} without an image")
    for b, c in Counter(r["brand"] for r in results).most_common():
        print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
