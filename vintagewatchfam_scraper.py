#!/usr/bin/env python3
"""
Vintage Watch Fam scraper — Shopify, USD.

Lives at dannysvintagewatches.com but Mark wants the source labeled
"Vintage Watch Fam" in the UI (the dealer's preferred public-facing
brand). Domain stays the same since that's where the data is hosted.

Scopes to /collections/wear-a-piece-of-history-shop-watches so the feed
only contains watches.

Run: python3 vintagewatchfam_scraper.py
Output: vintagewatchfam_listings.csv
"""

import csv
import re
import time

import requests

BASE = "https://dannysvintagewatches.com"
COLLECTION_PATH = "/collections/wear-a-piece-of-history-shop-watches"
SOURCE_NAME = "Vintage Watch Fam"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC", "Cartier",
    "Jaeger-LeCoultre", "Panerai", "Audemars Piguet", "Vacheron Constantin",
    "A. Lange", "Aquastar", "Seiko", "Universal Geneve", "Heuer", "Longines",
    "Movado", "Czapek", "Urwerk", "Zenith", "Breguet", "Eberhard", "Tissot",
    "Blancpain", "Girard-Perregaux", "Gallet", "Minerva", "Lemania", "Enicar",
    "Doxa", "Ebel", "Hamilton", "Bulova", "Mido", "Oris", "Junghans",
    "Grand Seiko", "Chopard", "Piaget",
]


def detect_brand(name, vendor=""):
    if vendor and vendor.lower() not in ("danny's vintage watches", "vintage watch fam", ""):
        for b in BRANDS:
            if b.lower() == vendor.lower():
                return b
        if len(vendor) > 2:
            return vendor
    for b in BRANDS:
        if b.lower() in name.lower():
            return b
    return "Other"


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&#[0-9]+;", "", text)
    text = re.sub(r"&[a-z]+;", "", text)
    return re.sub(r"\s+", " ", text).strip()


def get_all_products():
    out = []
    page = 1
    limit = 250
    while True:
        print(f"Fetching page {page}...")
        r = requests.get(
            f"{BASE}{COLLECTION_PATH}/products.json",
            headers=HEADERS,
            params={"limit": limit, "page": page},
            timeout=20,
        )
        r.raise_for_status()
        products = r.json().get("products", [])
        if not products:
            break
        out.extend(products)
        print(f"  Got {len(products)} (total: {len(out)})")
        if len(products) < limit:
            break
        page += 1
        time.sleep(0.3)
    return out


def parse_product(p):
    title = p.get("title", "")
    vendor = p.get("vendor", "")
    body = strip_html(p.get("body_html", ""))[:400]
    handle = p.get("handle", "")
    url = f"{BASE}/products/{handle}"

    variants = p.get("variants", [])
    price = 0
    available = False
    if variants:
        v = variants[0]
        try:
            price = int(float(v.get("price", "0")))
        except (ValueError, TypeError):
            price = 0
        available = v.get("available", False)

    images = p.get("images", [])
    img = images[0]["src"] if images else ""

    return {
        "title": title,
        "brand": detect_brand(title, vendor),
        "price": price,
        "url": url,
        "img": img,
        "description": body,
        "source": SOURCE_NAME,
        "sold": not available,
    }


def main():
    print(f"Fetching {SOURCE_NAME} inventory (Shopify)...")
    raw = get_all_products()
    print(f"\nTotal raw items: {len(raw)}")

    results = []
    skipped_sold = skipped_no_price = 0
    for p in raw:
        parsed = parse_product(p)
        if parsed["price"] == 0:
            skipped_no_price += 1
            continue
        if parsed["sold"]:
            skipped_sold += 1
            continue
        results.append(parsed)

    out_file = "vintagewatchfam_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "title", "brand", "price", "url", "img",
            "description", "source", "sold",
        ])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n✓ Saved {len(results)} listings to {out_file}")
    print(f"  Skipped: {skipped_sold} sold, {skipped_no_price} no price")
    if results:
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
