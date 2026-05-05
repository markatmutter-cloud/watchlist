#!/usr/bin/env python3
"""
S.Song Watches scraper — Shopify, USD-priced.

Scopes to /collections/vintage so straps, accessories, and any
modern-only inventory don't leak into the feed. Mirrors the
bulangandsons_scraper pattern (collection-scoped products.json + page
through with limit=250).

Run: python3 ssongwatches_scraper.py
Output: ssongwatches_listings.csv
"""

import csv
import re
import time

import requests

BASE = "https://www.ssongwatches.com"
COLLECTION_PATH = "/collections/vintage"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC", "Cartier",
    "Jaeger-LeCoultre", "Panerai", "Audemars Piguet", "Vacheron Constantin",
    "A. Lange", "Aquastar", "Seiko", "Universal Geneve", "Heuer", "Longines",
    "Movado", "Czapek", "Urwerk", "Zenith", "Breguet", "Eberhard", "Tissot",
    "Blancpain", "Girard-Perregaux", "Gallet", "Minerva", "Lemania", "Enicar",
    "Doxa", "Ebel", "Chronoswiss", "Tutima", "Wempe", "Wittnauer", "Yema",
    "Glycine", "Hamilton", "Bulova", "Mido", "Oris", "Junghans",
]


def detect_brand(name, vendor=""):
    # Vendor field is sometimes a year ("1976") on this dealer; only
    # treat it as a brand if it matches a known one. Otherwise fall
    # back to title-based detection.
    if vendor:
        for b in BRANDS:
            if b.lower() == vendor.lower():
                return b
    for b in BRANDS:
        if b.lower() in name.lower():
            return b
    return "Other"


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = (text.replace("&amp;", "&")
                .replace("&nbsp;", " ")
                .replace("&#8217;", "'")
                .replace("&#8211;", "–"))
    return re.sub(r"\s+", " ", text).strip()


def get_all_products():
    """Page through Shopify's collection-scoped products.json."""
    all_products = []
    page = 1
    while True:
        print(f"Fetching page {page}...")
        r = requests.get(
            f"{BASE}{COLLECTION_PATH}/products.json",
            headers=HEADERS,
            params={"limit": 250, "page": page},
            timeout=20,
        )
        r.raise_for_status()
        products = r.json().get("products", [])
        if not products:
            break
        all_products.extend(products)
        print(f"  Got {len(products)} (total: {len(all_products)})")
        if len(products) < 250:
            break
        page += 1
        time.sleep(0.3)
    return all_products


def parse_product(p):
    title = p.get("title", "")
    vendor = p.get("vendor", "")
    body = strip_html(p.get("body_html", ""))[:400]
    published_at = (p.get("published_at") or "2026-05-05")[:10]
    handle = p.get("handle", "")
    url = f"{BASE}/products/{handle}"

    variants = p.get("variants", [])
    price = 0
    available = False
    if variants:
        v = variants[0]
        try:
            price = int(float(v.get("price", "0")))
        except (TypeError, ValueError):
            price = 0
        available = v.get("available", False)

    images = p.get("images", [])
    img = images[0]["src"] if images else ""

    return {
        "title":       title,
        "brand":       detect_brand(title, vendor),
        "price":       price,
        "url":         url,
        "img":         img,
        "description": body,
        "source":      "S.Song Watches",
        "date":        published_at,
        "sold":        not available,
    }


def main():
    print("Fetching S.Song Watches vintage collection...")
    products = get_all_products()
    print(f"\nTotal products: {len(products)}")

    results = []
    skipped_sold = skipped_no_price = 0
    for p in products:
        parsed = parse_product(p)
        if parsed["price"] == 0:
            skipped_no_price += 1
            continue
        if parsed["sold"]:
            skipped_sold += 1
            continue
        results.append(parsed)
        print(f"  ✓ {parsed['brand']:18} {parsed['title'][:55]} ${parsed['price']:,}")

    print(f"\nSkipped: {skipped_sold} sold, {skipped_no_price} no price")

    out = "ssongwatches_listings.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "title", "brand", "price", "url", "img",
            "description", "source", "date", "sold",
        ])
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r["price"] for r in results]
        print(f"\n✓ Saved {len(results)} listings to {out}")
        print(f"  Min: ${min(prices):,} | Max: ${max(prices):,} | Avg: ${sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common(10):
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
