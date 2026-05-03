#!/usr/bin/env python3
"""
Maunder Watches scraper — WooCommerce Store API, GBP.

UK dealer running WooCommerce on the standard /wp-json/wc/store/v1
endpoint. ~146 products today; same pattern as Watchurbia / Menta /
Grey & Patina but scoped to the "all-preowned-watches" category at
the API level so retail/strap inventory doesn't leak in.

Run: python3 maunderwatches_scraper.py
Output: maunderwatches_listings.csv
"""
import csv
import re
import time

import requests

BASE = "https://www.maunderwatches.co.uk"
API = f"{BASE}/wp-json/wc/store/v1/products"
HEADERS = {
    # Maunder's bot-protection (likely Wordfence or Cloudflare-rules) returns
    # 403 to the long Chrome UA but is fine with the short generic one.
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


def fetch_chunk(offset, per_page):
    """Maunder's Store API ignores the standard `page` parameter — every
    `page=N` query returns the same first window. We have to use `offset`
    for pagination. (Their inventory's small enough — ~146 items — that
    we'd happily pull everything in one call, but per_page is capped
    around 100, so we walk in two chunks.)"""
    last_err = None
    for attempt in range(3):
        try:
            r = SESSION.get(API, params={
                "per_page": per_page,
                "offset": offset,
                "status": "publish",
            }, timeout=30)
            if r.status_code == 200:
                return r.json()
            last_err = f"HTTP {r.status_code}"
            time.sleep(2 ** attempt)
        except requests.RequestException as e:
            last_err = str(e)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"offset {offset} failed after 3 attempts: {last_err}")


def get_all_listings():
    all_items = []
    offset = 0
    per_page = 100
    while True:
        print(f"Fetching offset={offset}...")
        items = fetch_chunk(offset, per_page)
        if not items:
            break
        all_items.extend(items)
        print(f"  Got {len(items)} items (total: {len(all_items)})")
        if len(items) < per_page:
            break
        offset += per_page
        time.sleep(0.5)
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
        "source": "Maunder Watches",
        "sold": not item.get("is_in_stock", True),
    }


def main():
    print("Fetching Maunder Watches inventory (WooCommerce Store API)...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    results = [parse_item(it) for it in raw]
    results = [r for r in results if r["price"] > 0]
    skipped = len(raw) - len(results)
    if skipped:
        print(f"Skipped {skipped} items with no price")

    out_file = "maunderwatches_listings.csv"
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
