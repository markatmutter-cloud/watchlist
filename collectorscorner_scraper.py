#!/usr/bin/env python3
"""
Collectors Corner NY scraper - uses Shopify public products API
Run: python3 collectorscorner_scraper.py
Requires: pip install requests
Output: collectorscorner_listings.csv
"""

import requests
import csv
import re
import time

BASE = "https://collectorscornerny.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Aquastar', 'Seiko', 'Universal Geneve', 'Heuer', 'Longines',
    'Movado', 'Czapek', 'Urwerk', 'Zenith', 'Breguet', 'Tag Heuer', 'Tissot',
    'Mulco', 'Minerva', 'Eberhard', 'Lemania', 'Gallet'
]

def detect_brand(name, vendor=""):
    # Shopify vendor field is often the brand - use it first
    if vendor and vendor.lower() not in ['collectorscornerny', 'collectors corner', '']:
        for b in BRANDS:
            if b.lower() == vendor.lower():
                return b
        # Return vendor directly if it looks like a brand name
        if len(vendor) > 2 and vendor not in ['Default', 'Other']:
            return vendor
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
    limit = 250  # Shopify max per page

    while True:
        print(f"Fetching page {page}...")
        r = requests.get(
            f"{BASE}/products.json",
            headers=HEADERS,
            params={'limit': limit, 'page': page},
            timeout=20
        )
        r.raise_for_status()
        data = r.json()
        products = data.get('products', [])

        if not products:
            break

        all_products.extend(products)
        print(f"  Got {len(products)} products (total: {len(all_products)})")

        if len(products) < limit:
            break

        page += 1
        time.sleep(0.3)

    return all_products

def parse_product(p):
    title = p.get('title', '')
    vendor = p.get('vendor', '')
    body = strip_html(p.get('body_html', ''))[:400]
    published_at = p.get('published_at', '2026-04-19')[:10]  # Just the date part
    handle = p.get('handle', '')
    url = f"{BASE}/products/{handle}"

    # Price and availability from first variant
    variants = p.get('variants', [])
    price = 0
    available = False
    if variants:
        v = variants[0]
        try:
            price = int(float(v.get('price', '0')))
        except:
            price = 0
        available = v.get('available', False)

    # First image
    images = p.get('images', [])
    img = images[0]['src'] if images else ''

    brand = detect_brand(title, vendor)

    return {
        'title': title,
        'brand': brand,
        'price': price,
        'url': url,
        'img': img,
        'description': body,
        'source': 'Collectors Corner NY',
        'date': published_at,
        'sold': not available
    }

def main():
    print("Fetching Collectors Corner NY inventory...")
    products = get_all_products()
    print(f"\nTotal products: {len(products)}")

    results = []
    skipped_sold = 0
    skipped_no_price = 0

    for p in products:
        parsed = parse_product(p)

        if parsed['price'] == 0:
            skipped_no_price += 1
            continue
        if parsed['sold']:
            skipped_sold += 1
            continue

        results.append(parsed)
        print(f"  ✓ {parsed['brand']} — {parsed['title'][:55]} — ${parsed['price']:,} ({parsed['date']})")

    print(f"\nSkipped: {skipped_sold} sold, {skipped_no_price} no price")

    output = 'collectorscorner_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','date','sold'])
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r['price'] for r in results]
        print(f"\n✓ Saved {len(results)} listings to {output}")
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
