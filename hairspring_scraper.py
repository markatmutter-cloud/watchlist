#!/usr/bin/env python3
"""
Hairspring scraper - Shopify public products API.
Run: python3 hairspring_scraper.py
Requires: pip install requests
Output: hairspring_listings.csv

Only covers Hairspring's own inventory. The editorial "finds" blog at
/blogs/finds features watches from other dealers and needs a different
approach — left for later.
"""
import requests
import csv
import re
import time

BASE = "https://hairspring.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Aquastar', 'Seiko', 'Universal Geneve', 'Heuer', 'Longines',
    'Movado', 'Czapek', 'Urwerk', 'Zenith', 'Breguet',
]


def normalize_brand(raw):
    """Map a brand string from JSON-LD to the canonical form used in
    merge.py BRANDS list. Examples: "A. Lange & Söhne" → "A. Lange",
    "Patek Philippe SA" → "Patek Philippe". Pure-string match for the
    rest, returned as-is so unknown brands ("Laurent Ferrier", "Urban
    Jürgensen") still propagate cleanly."""
    if not raw:
        return ''
    raw = raw.replace('&amp;', '&').strip()
    # First check substring against canonical BRANDS so common variants
    # (with/without trademark text, ampersand, etc.) collapse to one.
    for b in BRANDS:
        if b.lower() in raw.lower():
            return b
    return raw


def fetch_brand_from_detail(url):
    """Pull the JSON-LD `"brand": "..."` from a Hairspring detail page.
    Hairspring's products.json doesn't expose the watch brand (vendor
    field is the dealer name). The detail page renders structured data
    with the actual manufacturer."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        m = re.search(r'"brand"\s*:\s*"([^"]+)"', r.text)
        return m.group(1) if m else ''
    except Exception:
        return ''


def detect_brand(name):
    """Title-only brand detection (used when JSON-LD scrape failed)."""
    for b in BRANDS:
        if b.lower() in name.lower():
            return b
    return 'Other'


def strip_html(text):
    if not text:
        return ''
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    text = re.sub(r'&[a-z]+;', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def get_all_products():
    all_products = []
    page = 1
    limit = 250
    while True:
        print(f"Fetching page {page}...")
        r = requests.get(f"{BASE}/products.json", headers=HEADERS,
                         params={'limit': limit, 'page': page}, timeout=20)
        r.raise_for_status()
        products = r.json().get('products', [])
        if not products:
            break
        all_products.extend(products)
        print(f"  Got {len(products)} (total: {len(all_products)})")
        if len(products) < limit:
            break
        page += 1
        time.sleep(0.3)
    return all_products


def parse_product(p):
    title = p.get('title', '')
    body = strip_html(p.get('body_html', ''))[:400]
    published_at = p.get('published_at', '')[:10] or ''
    handle = p.get('handle', '')
    url = f"{BASE}/products/{handle}"

    variants = p.get('variants', [])
    price = 0
    available = False
    if variants:
        v = variants[0]
        try:
            price = int(float(v.get('price', '0')))
        except (ValueError, TypeError):
            price = 0
        available = v.get('available', False)

    images = p.get('images', [])
    img = images[0]['src'] if images else ''

    # Visit the detail page for the JSON-LD brand. Title-only fallback
    # would bucket most of Hairspring as "Other" because their titles
    # lead with the model name (Tank, Royal Oak, Lange 1) rather than
    # the manufacturer.
    brand = ''
    if available and price > 0:
        time.sleep(0.2)
        brand = normalize_brand(fetch_brand_from_detail(url))
    if not brand:
        brand = detect_brand(title)

    return {
        'title': title,
        'brand': brand,
        'price': price,
        'url': url,
        'img': img,
        'description': body,
        'source': 'Hairspring',
        'date': published_at,
        'sold': not available,
    }


def main():
    print("Fetching Hairspring inventory (Shopify)...")
    products = get_all_products()
    print(f"\nTotal products: {len(products)}")

    results = []
    skipped_sold = skipped_no_price = 0
    for p in products:
        parsed = parse_product(p)
        if parsed['price'] == 0:
            skipped_no_price += 1; continue
        if parsed['sold']:
            skipped_sold += 1; continue
        results.append(parsed)

    print(f"\nSkipped: {skipped_sold} sold, {skipped_no_price} no price")

    output = 'hairspring_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','date','sold'])
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r['price'] for r in results]
        print(f"\nSaved {len(results)} listings to {output}")
        print(f"  Min: ${min(prices):,} | Max: ${max(prices):,} | Avg: ${sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(r['brand'] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
