#!/usr/bin/env python3
"""
Watches of Lancashire scraper — WooCommerce Store API, GBP.

UK dealer running WooCommerce. Standard Store API at
/wp-json/wc/store/v1/products — same pattern as Maunder, Watchurbia,
Menta, Grey & Patina. Filtered to the "watches" category at the API
level so any non-watch inventory (straps, accessories) doesn't leak
in. ~163 products today.

Run: python3 watchesoflancashire_scraper.py
Output: watchesoflancashire_listings.csv
"""
import csv
import re
import time

import requests

BASE = "https://watchesoflancashire.com"
API = f"{BASE}/wp-json/wc/store/v1/products"
HEADERS = {
    # Same bot-protection quirk as Maunder — long Chrome UA gets 403,
    # short generic UA passes.
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE}/",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC",
    "Cartier", "Jaeger-LeCoultre", "Panerai", "Audemars Piguet",
    "Vacheron Constantin", "A. Lange", "Tag Heuer", "Heuer",
    "Longines", "Universal Geneve", "Movado", "Zenith", "Breguet",
    "Blancpain", "Tissot", "Ebel", "Hamilton", "Seiko",
    "Grand Seiko", "Bulova", "Mido", "Oris", "Junghans", "Chopard",
    "Piaget", "Girard-Perregaux", "Eberhard",
]


def detect_brand(name, categories=None):
    lower = name.lower()
    for b in BRANDS:
        if b.lower() in lower:
            return b
    for cat in categories or []:
        cname = (cat.get("name") or "").lower()
        for b in BRANDS:
            if b.lower() in cname:
                return b
    return "Other"


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&#[0-9]+;", "", text)
    return re.sub(r"\s+", " ", text).strip()


def fetch_page(page, per_page):
    last_err = None
    for attempt in range(3):
        try:
            r = SESSION.get(API, params={
                "per_page": per_page,
                "page": page,
                "status": "publish",
                "category": "watches",
            }, timeout=20)
            if r.status_code == 200:
                return r.json()
            last_err = f"HTTP {r.status_code}"
            time.sleep(2 ** attempt)
        except requests.RequestException as e:
            last_err = str(e)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"page {page} failed after 3 attempts: {last_err}")


def get_all_listings():
    all_items = []
    page = 1
    per_page = 100
    while True:
        print(f"Fetching page {page}...")
        items = fetch_page(page, per_page)
        if not items:
            break
        all_items.extend(items)
        print(f"  Got {len(items)} items (total: {len(all_items)})")
        if len(items) < per_page:
            break
        page += 1
        time.sleep(0.4)
    return all_items


def parse_item(item):
    prices = item.get("prices") or {}
    price_raw = prices.get("price", "0")
    minor = int(prices.get("currency_minor_unit", 2) or 0)
    try:
        price = int(price_raw) // (10 ** minor) if minor else int(price_raw)
    except (ValueError, TypeError):
        price = 0

    images = item.get("images") or []
    img = images[0].get("src", "") if images else ""

    return {
        "title": item.get("name", ""),
        "brand": detect_brand(item.get("name", ""), item.get("categories")),
        "price": price,
        "url": item.get("permalink", ""),
        "img": img,
        "description": strip_html(item.get("short_description") or item.get("description") or "")[:500],
        "source": "Watches of Lancashire",
        "sold": not item.get("is_in_stock", True),
    }


def main():
    print("Fetching Watches of Lancashire inventory (WooCommerce Store API)...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    results = [parse_item(it) for it in raw]
    results = [r for r in results if r["price"] > 0]
    skipped = len(raw) - len(results)
    if skipped:
        print(f"Skipped {skipped} items with no price")

    out_file = "watchesoflancashire_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["title", "brand", "price", "url", "img", "description", "source", "sold"],
        )
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r["price"] for r in results]
        print(f"\n✓ Saved {len(results)} listings to {out_file} (GBP)")
        print(f"  Min: £{min(prices):,} | Max: £{max(prices):,} | Avg: £{sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
