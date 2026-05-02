#!/usr/bin/env python3
"""
European Watch Co. (Boston) scraper — Next.js site, USD-priced.

The /all page is server-rendered Next.js with the entire product
catalogue (~780 listings) inlined as `self.__next_f.push([1,"<chunk>"])`
streamed RSC payloads in the HTML. The largest chunk carries the
product data; we extract product objects directly via regex (full JSON
parse of the chunk is brittle because RSC mixes data + component
references).

**Filter applied: pre-year-2000 only.** The site mostly stocks modern
Patek/AP/Rolex inventory; Mark wants the vintage slice only. We extract
year from each product's `model` field (the dealer follows
"Circa. YYYY" convention for vintage pieces) and keep only items where
the parsed year is < 2000. Items without a parseable year are dropped —
they're the modern-inventory long tail and we don't want them flooding
the feed.

Run:    python3 europeanwatch_scraper.py
Output: europeanwatch_listings.csv
"""

import csv
import json
import re

import requests

URL = "https://www.europeanwatch.com/all"
BASE = "https://www.europeanwatch.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36"}

# Each product object embedded in the RSC chunk has this shape:
#   {"id":"inv_xxx","stock_number":NNNNN,"status":"INSTOCK",
#    "display_status":"In Stock","brand":"Rolex","model":"...",
#    "product_line":"...","web_price":NNNN,"description":"...",
#    "hide_price":0,"images":["https://..."],
#    "slug":"rolex-...-NNNNN","last_updated":"2026-..."}
PRODUCT_RE = re.compile(
    r'\{"id":"inv_[A-Za-z0-9]+","stock_number":\d+,'
    r'"status":"[A-Z]+","display_status":"[^"]*",'
    r'"brand":"[^"]*","model":"[^"]*",'
    r'"product_line":(?:"[^"]*"|null),"web_price":\d+,'
    r'"description":"(?:[^"\\]|\\.)*?",'
    r'"hide_price":\d+,"images":\[(?:"[^"]*"(?:,"[^"]*")*)?\],'
    r'"slug":"[^"]*","last_updated":"[^"]+"\}'
)
# Pull the streamed RSC chunks out of the HTML.
CHUNK_RE = re.compile(
    r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)',
    re.DOTALL,
)
# Available statuses we want to surface.
ACTIVE_STATUSES = {"INSTOCK", "INCOMING"}
# ONHOLD = sale pending; skip — they're already half-spoken-for.

# Circa is the dealer's standard convention for vintage manufacture
# year ("Circa. 1984"). We rely on it exclusively. A standalone-year
# fallback (e.g. \b19[5-9]\d\b) was tried and rejected — it grabbed
# model-line names like "Luminor 1950", "Speedmaster 1957 Trilogy",
# "Carrera 1964 Re-Edition" which are MODERN reissues using the
# original-era's name. The dealer is consistent enough with Circa
# that the precision tradeoff is worth the (~9-item) recall loss.
YEAR_CIRCA_RE = re.compile(r"[Cc]irca\.?\s+(\d{4})")


def extract_year(model: str):
    """Return the inferred manufacture year from the model title, or None."""
    m = YEAR_CIRCA_RE.search(model)
    if m:
        return int(m.group(1))
    return None


def fetch_html() -> str:
    print(f"Fetching {URL}")
    r = requests.get(URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def extract_products(html: str):
    """Walk every RSC chunk, decode it, and yield product JSON objects."""
    for raw in CHUNK_RE.findall(html):
        try:
            decoded = raw.encode().decode("unicode_escape")
        except UnicodeDecodeError:
            continue
        for match in PRODUCT_RE.finditer(decoded):
            try:
                yield json.loads(match.group(0))
            except json.JSONDecodeError:
                continue


def parse_product(p: dict):
    if p.get("status") not in ACTIVE_STATUSES:
        return None
    if p.get("hide_price"):
        return None
    price = p.get("web_price") or 0
    if price <= 0:
        return None

    model = p.get("model", "") or ""
    year = extract_year(model)
    if year is None or year >= 2000:
        return None  # pre-2000 filter — drop everything else

    brand = p.get("brand", "") or "Other"
    slug = p.get("slug", "")
    if not slug:
        return None
    url = f"{BASE}/watch/{slug}"

    images = p.get("images") or []
    img = images[0] if images else ""

    # Model already carries "Circa. YYYY" since that's the only
    # extraction path that survives the filter — pass through as-is.
    title = model.strip()

    return {
        "title": title,
        "brand": brand,
        "price": price,
        "url": url,
        "img": img,
        "description": "",
        "source": "European Watch",
        "sold": False,
    }


def main():
    print("Fetching European Watch Co. inventory (Next.js / RSC)...")
    html = fetch_html()
    raw = list(extract_products(html))
    print(f"Found {len(raw)} raw product objects")

    items = []
    for p in raw:
        parsed = parse_product(p)
        if parsed:
            items.append(parsed)

    output = "europeanwatch_listings.csv"
    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["title", "brand", "price", "url", "img", "description", "source", "sold"],
        )
        writer.writeheader()
        writer.writerows(items)

    if items:
        prices = [it["price"] for it in items]
        print(f"\nSaved {len(items)} pre-2000 listings to {output} (USD)")
        print(f"  Min: ${min(prices):,} | Max: ${max(prices):,} | Avg: ${sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(it["brand"] for it in items).most_common():
            print(f"  {b}: {c}")
    else:
        print("\nNo pre-2000 items matched. Check the year-extraction patterns.")


if __name__ == "__main__":
    main()
