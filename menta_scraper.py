#!/usr/bin/env python3
"""
Menta Watches scraper - uses free WooCommerce Store API
Run: python3 menta_scraper.py
Requires: pip install requests
Output: menta_listings.csv
"""

import requests
import json
import csv
import re
import time

BASE = "https://mentawatches.com"
API = f"{BASE}/wp-json/wc/store/v1/products"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Aquastar', 'Seiko', 'Universal Geneve', 'Heuer', 'Longines',
    'Movado', 'Czapek', 'Urwerk', 'Zenith', 'Breguet', 'Patek'
]

def detect_brand(name):
    for b in BRANDS:
        if b.lower() in name.lower():
            return b if b != 'Patek' else 'Patek Philippe'
    return 'Other'

def strip_html(text):
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    return re.sub(r'\s+', ' ', text).strip()

def get_all_listings():
    all_items = []
    page = 1
    per_page = 100

    while True:
        print(f"Fetching page {page}...")
        r = requests.get(API, headers=HEADERS, params={
            'per_page': per_page,
            'page': page,
            'status': 'publish'
        }, timeout=20)
        r.raise_for_status()
        items = r.json()

        if not items:
            break

        all_items.extend(items)
        print(f"  Got {len(items)} items (total so far: {len(all_items)})")

        if len(items) < per_page:
            break

        page += 1
        time.sleep(0.5)

    return all_items

def parse_item(item):
    title = item.get('name', '')

    # Price - API returns in cents as string e.g. "3875000" = $38,750.00
    price_raw = item.get('prices', {}).get('price', '0')
    try:
        # WooCommerce returns price in minor units (cents)
        price = int(price_raw) // 100
    except:
        price = 0

    # Skip sold items
    on_sale = item.get('on_sale', False)
    in_stock = item.get('is_in_stock', True)
    sold = not in_stock

    # Image
    images = item.get('images', [])
    img = images[0]['src'] if images else ''

    # URL
    url = item.get('permalink', '')

    # Description
    desc = strip_html(item.get('description', '') or item.get('short_description', ''))[:500]

    # Brand from categories/tags or title
    brand = detect_brand(title)

    # Check tags/categories for brand
    for cat in item.get('categories', []):
        name = cat.get('name', '')
        for b in BRANDS:
            if b.lower() in name.lower():
                brand = b if b != 'Patek' else 'Patek Philippe'

    return {
        'title': title,
        'brand': brand,
        'price': price,
        'url': url,
        'img': img,
        'description': desc,
        'source': 'Menta Watches',
        'sold': sold
    }

def main():
    print("Fetching Menta Watches inventory...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    results = []
    skipped = 0
    for item in raw:
        parsed = parse_item(item)

        # Skip if no price or sold
        if parsed['price'] == 0:
            skipped += 1
            continue
        if parsed['sold']:
            skipped += 1
            continue

        results.append(parsed)
        print(f"  ✓ {parsed['brand']} — {parsed['title'][:55]} — ${parsed['price']:,}")

    print(f"\nSkipped {skipped} items (sold or no price)")

    # Save CSV
    output = 'menta_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','sold'])
        writer.writeheader()
        writer.writerows(results)

    prices = [r['price'] for r in results]
    print(f"\n✓ Saved {len(results)} listings to {output}")
    if prices:
        print(f"  Min: ${min(prices):,}")
        print(f"  Max: ${max(prices):,}")
        print(f"  Avg: ${sum(prices)//len(prices):,}")

    from collections import Counter
    brands = Counter(r['brand'] for r in results)
    print("\nBy brand:")
    for b, c in brands.most_common():
        print(f"  {b}: {c}")

if __name__ == "__main__":
    main()
