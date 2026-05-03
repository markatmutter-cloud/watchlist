#!/usr/bin/env python3
"""
Vintage Watch Collective scraper — Wix Stores, EUR.

VWC runs on Wix and ships product data as a `productsWithMetaData.list[]`
JSON blob embedded in the server-rendered /shop HTML — same pattern as
Chronoholic. The blob carries each visible product on the page; we walk
it with a balanced-bracket extractor and parse it as JSON.

Multi-brand inventory (vs Chronoholic which is scoped to Omega-only),
so we run the BRANDS-substring brand detection used elsewhere.

Run: python3 vintagewatchcollective_scraper.py
Output: vintagewatchcollective_listings.csv
"""

import csv
import json
import re
import time

import requests

BASE = "https://www.vintagewatchcollective.com"
SHOP_PATH = "/shop"
SOURCE_NAME = "Vintage Watch Collective"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC",
    "Cartier", "Jaeger-LeCoultre", "Panerai", "Audemars Piguet",
    "Vacheron Constantin", "A. Lange", "Aquastar",
    "Grand Seiko", "Seiko", "Universal Geneve",
    "Tag Heuer", "Heuer", "Girard-Perregaux",
    "Longines", "Movado", "Zenith", "Breguet", "Eberhard",
    "Blancpain", "Tissot", "Ebel", "Piaget",
    "Hamilton", "Bulova", "Mido", "Oris", "Junghans", "Chopard",
    "Doxa", "Lemania", "Minerva", "Enicar",
]


def detect_brand(text):
    lower = text.lower()
    for b in BRANDS:
        if b.lower() in lower:
            return b
    return "Other"


def extract_products_blob(html):
    """Find the productsWithMetaData.list[...] array embedded in the
    Wix-rendered HTML and return it as a Python list. Same balanced-
    bracket walker as the Chronoholic scraper — keeps string awareness
    so escaped quotes inside JSON values don't break depth counting."""
    m = re.search(r'"productsWithMetaData":\{"list":\[', html)
    if not m:
        return []
    start = m.end()
    depth = 1
    in_str = False
    esc = False
    i = start
    while i < len(html) and depth > 0:
        ch = html[i]
        if esc:
            esc = False
        elif ch == "\\":
            esc = True
        elif in_str:
            if ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
        i += 1
    arr_text = "[" + html[start:i - 1] + "]"
    try:
        return json.loads(arr_text)
    except json.JSONDecodeError:
        return []


def fetch_page(page):
    url = f"{BASE}{SHOP_PATH}" + (f"?page={page}" if page > 1 else "")
    r = requests.get(url, headers=HEADERS, timeout=25)
    r.raise_for_status()
    return extract_products_blob(r.text)


def parse_product(p):
    name = (p.get("name") or "").strip()
    url_part = p.get("urlPart") or ""
    url = f"{BASE}/product-page/{url_part}" if url_part else f"{BASE}{SHOP_PATH}"

    try:
        price = int(float(p.get("price") or 0))
    except (ValueError, TypeError):
        price = 0

    # Same convention as Chronoholic: price=0 → sold-or-inquire. The
    # Card renders "Price on request" instead of "$0", and merge.py's
    # state tracker keeps the row in the Archive once it goes inactive.
    in_stock_flag = bool(p.get("isInStock"))
    sold = (price == 0) or (not in_stock_flag)
    price_on_request = price == 0

    img = ""
    media = p.get("media") or []
    if media:
        m0 = media[0] or {}
        img = m0.get("fullUrl") or ""
        if not img and m0.get("url"):
            img = f"https://static.wixstatic.com/media/{m0['url']}"

    return {
        "title": name,
        "brand": detect_brand(name),
        "price": price,
        "url": url,
        "img": img,
        "description": "",
        "source": SOURCE_NAME,
        "sold": sold,
        "priceOnRequest": price_on_request,
    }


def main():
    print(f"Fetching {SOURCE_NAME} inventory (Wix-embedded JSON)...")
    products = []
    seen = set()
    page = 1
    while page <= 30:
        print(f"Fetching page {page}...")
        page_products = fetch_page(page)
        if not page_products:
            print(f"  No products on page {page} — done.")
            break
        new_count = 0
        for p in page_products:
            pid = p.get("id")
            if pid and pid in seen:
                continue
            if pid:
                seen.add(pid)
            products.append(p)
            new_count += 1
        print(f"  Got {new_count} new (total: {len(products)})")
        if new_count == 0:
            break
        page += 1
        time.sleep(0.4)

    print(f"\nTotal raw items: {len(products)}")

    results = []
    sold_count = active_count = skipped_no_data = 0
    for p in products:
        parsed = parse_product(p)
        if parsed["price"] == 0 and not parsed["sold"]:
            skipped_no_data += 1
            continue
        if parsed["sold"]:
            sold_count += 1
        else:
            active_count += 1
        results.append(parsed)

    out_file = "vintagewatchcollective_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "title", "brand", "price", "url", "img",
            "description", "source", "sold", "priceOnRequest",
        ])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n✓ Saved {len(results)} listings to {out_file}")
    print(f"  Active: {active_count}, Sold (price=0 → archive): {sold_count}")
    print(f"  Skipped: {skipped_no_data} (missing price + not sold)")
    if results:
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
