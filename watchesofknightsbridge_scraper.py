#!/usr/bin/env python3
"""
Watches of Knightsbridge scraper - WooCommerce Store API (London dealer).
Run: python3 watchesofknightsbridge_scraper.py
Requires: pip install requests
Output: watchesofknightsbridge_listings.csv

Same pattern as Menta and Grey & Patina. Prices in GBP with
currency_minor_unit=0 (whole pounds, not pence).
"""
import requests
import csv
import re
import time

BASE = "https://watchesofknightsbridge.com"
API = f"{BASE}/wp-json/wc/store/v1/products"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Heuer', 'Longines', 'Universal Geneve', 'Movado', 'Zenith',
    'Breguet', 'Blancpain', 'Eberhard', 'Girard-Perregaux', 'Piaget',
]


def detect_brand(name):
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
            'status': 'publish',
        }, timeout=60)
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

    prices_obj = item.get('prices', {})
    price_raw = prices_obj.get('price', '0')
    minor = int(prices_obj.get('currency_minor_unit', 2) or 0)
    try:
        price = int(price_raw) // (10 ** minor) if minor else int(price_raw)
    except (ValueError, TypeError):
        price = 0

    in_stock = item.get('is_in_stock', True)
    sold = not in_stock

    images = item.get('images', [])
    # First image may be a .png placeholder; prefer the first .jpg if available
    img = ''
    for im in images:
        src = im.get('src', '')
        if src and src.lower().endswith(('.jpg', '.jpeg')):
            img = src
            break
    if not img and images:
        img = images[0].get('src', '')

    url = item.get('permalink', '')
    desc = strip_html(item.get('description', '') or item.get('short_description', ''))[:500]

    brand = detect_brand(title)
    # Check WooCommerce `brands` or `attributes` for a pa_brand term
    for attr in item.get('attributes', []):
        if attr.get('taxonomy') == 'pa_brand':
            for term in attr.get('terms', []):
                name = term.get('name', '')
                for b in BRANDS:
                    if b.lower() == name.lower():
                        brand = b
                        break

    return {
        'title': title,
        'brand': brand,
        'price': price,
        'url': url,
        'img': img,
        'description': desc,
        'source': 'Watches of Knightsbridge',
        'sold': sold,
    }


def main():
    print("Fetching Watches of Knightsbridge inventory (WooCommerce)...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    results = []
    skipped_sold = skipped_no_price = 0
    for item in raw:
        parsed = parse_item(item)
        if parsed['price'] == 0:
            skipped_no_price += 1; continue
        if parsed['sold']:
            skipped_sold += 1; continue
        results.append(parsed)

    print(f"\nSkipped: {skipped_sold} sold, {skipped_no_price} no price")

    output = 'watchesofknightsbridge_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','sold'])
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r['price'] for r in results]
        print(f"\nSaved {len(results)} listings to {output} (prices in GBP)")
        print(f"  Min: £{min(prices):,} | Max: £{max(prices):,} | Avg: £{sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(r['brand'] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
