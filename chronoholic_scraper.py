#!/usr/bin/env python3
"""
Chronoholic scraper — Wix Stores, USD.

Chronoholic runs on Wix and doesn't expose a Shopify-style products.json
or a WooCommerce Store API. Instead, the category page (e.g.
/omega-2 for Omegas) ships a server-rendered HTML payload with a
JSON blob at `productsWithMetaData.list[]` containing every visible
product on that page. We extract that blob with a balanced-bracket
walker and parse it as JSON.

Scoped to the Omega category (/omega-2) by Mark's request — Chronoholic
has wider inventory but the Omega catalog is what's worth aggregating.
The same pattern can be duplicated for other categories later.

Run: python3 chronoholic_scraper.py
Output: chronoholic_listings.csv
"""

import csv
import json
import re
import time

import requests

BASE = "https://www.chronoholic.com"
CATEGORY_PATH = "/omega-2"
SOURCE_NAME = "Chronoholic"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Mark scoped this source to Omega only — not detect_brand'ing because
# every item is Omega by category. Kept the import-time list off because
# merge.py will accept the literal "Omega" we set below.


def extract_products_blob(html):
    """Find the productsWithMetaData.list[...] array embedded in the
    Wix-rendered HTML and return it as a Python list. Walks brackets
    with string-awareness so escaped quotes inside JSON values don't
    break the depth counter."""
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
    url = f"{BASE}{CATEGORY_PATH}" + (f"?page={page}" if page > 1 else "")
    r = requests.get(url, headers=HEADERS, timeout=25)
    r.raise_for_status()
    return extract_products_blob(r.text)


def parse_product(p):
    name = (p.get("name") or "").strip()
    url_part = p.get("urlPart") or ""
    url = f"{BASE}/product-page/{url_part}" if url_part else f"{BASE}{CATEGORY_PATH}"

    # Price is a number in major units (USD); formattedPrice carries
    # the symbol but we don't need it.
    try:
        price = int(float(p.get("price") or 0))
    except (ValueError, TypeError):
        price = 0

    # On Chronoholic, price=0 means SOLD — not "inquire for price".
    # Mark those items as sold so they flow into the Archive (merge.py's
    # state tracker keeps sold entries with their cached title/image).
    # priceOnRequest stays True alongside so:
    #   (a) merge.py's price-floor check (`price < 500 and not
    #       priceOnRequest`) lets them through;
    #   (b) the Card's price slot renders "Price on request" instead of
    #       "$0".
    in_stock_flag = bool(p.get("isInStock"))
    sold = (price == 0) or (not in_stock_flag)
    price_on_request = price == 0

    img = ""
    media = p.get("media") or []
    if media:
        m0 = media[0] or {}
        # `fullUrl` is the CDN-rendered URL (e.g. wixstatic.com/.../file.jpg).
        # Falls back to constructing from the bare `url` if needed.
        img = m0.get("fullUrl") or ""
        if not img and m0.get("url"):
            img = f"https://static.wixstatic.com/media/{m0['url']}"

    return {
        "title": name,
        "brand": "Omega",       # category-scoped — every listing is Omega
        "price": price,
        "url": url,
        "img": img,
        "description": "",
        "source": SOURCE_NAME,
        "sold": sold,
        "priceOnRequest": price_on_request,
    }


def main():
    print(f"Fetching {SOURCE_NAME} Omega inventory (Wix-embedded JSON)...")
    products = []
    seen = set()
    page = 1
    while True:
        print(f"Fetching page {page}...")
        page_products = fetch_page(page)
        if not page_products:
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
        # Drop only items missing both price AND sold — those are scrape
        # errors we can't render meaningfully. Sold-with-price-zero are
        # the legitimate "sold, price never published" case Mark wants
        # in the Archive.
        if parsed["price"] == 0 and not parsed["sold"]:
            skipped_no_data += 1
            continue
        if parsed["sold"]:
            sold_count += 1
        else:
            active_count += 1
        results.append(parsed)

    out_file = "chronoholic_listings.csv"
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


if __name__ == "__main__":
    main()
