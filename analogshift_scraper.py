#!/usr/bin/env python3
"""
Analog Shift scraper - Shopify public products API.
Run: python3 analogshift_scraper.py
Requires: pip install requests
Output: analogshift_listings.csv

Analog Shift sits behind Cloudflare's JS challenge by default — the
stock `requests` default UA gets a 403. Passing a browser-like
User-Agent plus Accept headers and accepting gzip encoding is enough
to get past it; this pattern is a lightweight fallback short of pulling
in Playwright for one source.
"""
import requests
import csv
import re
import time

BASE = "https://www.analogshift.com"
COLLECTION = "watches"

# Cloudflare 403s the default python-requests UA. These headers mimic a real
# Chrome request closely enough to pass the default challenge. If they stop
# working we'd need to move to Playwright / Browse AI like Tropical Watch.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    # Don't advertise brotli support — `requests` can't decode it without the
    # optional `brotli` package. Cloudflare is happy with plain gzip.
    "Accept-Encoding": "gzip, deflate",
}

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Aquastar', 'Seiko', 'Universal Geneve', 'Heuer', 'Longines',
    'Movado', 'Czapek', 'Urwerk', 'Zenith', 'Breguet',
]


def detect_brand(name, vendor=""):
    if vendor and vendor.strip().lower() not in ['analog shift', 'analogshift', '']:
        for b in BRANDS:
            if b.lower() == vendor.lower():
                return b
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
    limit = 250
    while True:
        print(f"Fetching page {page}...")
        r = requests.get(f"{BASE}/collections/{COLLECTION}/products.json",
                         headers=HEADERS, params={'limit': limit, 'page': page}, timeout=20)
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
    vendor = p.get('vendor', '')
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

    return {
        'title': title,
        'brand': detect_brand(title, vendor),
        'price': price,
        'url': url,
        'img': img,
        'description': body,
        'source': 'Analog Shift',
        'date': published_at,
        'sold': not available,
    }


def main():
    print("Fetching Analog Shift watches (Shopify, Cloudflare-protected)...")
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

    output = 'analogshift_listings.csv'
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
