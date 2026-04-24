#!/usr/bin/env python3
"""
Bob's Watches scraper — vintage-watches section only.
Run: python3 bobswatches_scraper.py
Requires: pip install requests
Output: bobswatches_listings.csv

Bob's Watches runs a custom site, not a standard CMS, but every product
card on a listing page renders a schema.org JSON-LD <script> block with
the full product metadata (name, price, url, sku/mpn for reference,
year, image). We parse those blocks — no need to hit individual product
pages.

We hit /vintage-watches (not /luxury-watches) so we only pull vintage
pieces. Bob's "filter by Condition=Vintage" on luxury-watches is a
client-side hash filter; the server endpoint that actually returns
just vintage is /vintage-watches.
"""
import requests
import csv
import json
import re
import time

BASE = "https://www.bobswatches.com"
COLLECTION_PATH = "/vintage-watches"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
}

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Heuer', 'Longines', 'Universal Geneve', 'Movado', 'Zenith',
    'Breguet', 'Blancpain',
]


def detect_brand(name):
    for b in BRANDS:
        if b.lower() in name.lower():
            return b
    return 'Other'


def extract_products(html):
    """Pull every JSON-LD Product block out of the page HTML."""
    blocks = re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    products = []
    for b in blocks:
        try:
            data = json.loads(b.strip())
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get('@type') == 'Product':
            products.append(data)
    return products


def fetch_page(page):
    url = f"{BASE}{COLLECTION_PATH}"
    params = {'page': page} if page > 1 else None
    r = requests.get(url, headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    return r.text


def find_image(p):
    img = p.get('image')
    if isinstance(img, list) and img:
        return img[0] if isinstance(img[0], str) else img[0].get('url', '')
    if isinstance(img, dict):
        return img.get('url', '')
    if isinstance(img, str):
        return img
    return ''


def parse_product(p):
    name = p.get('name', '').strip()
    if not name:
        return None

    offers = p.get('offers') or {}
    try:
        price = int(float(offers.get('price', '0')))
    except (ValueError, TypeError):
        price = 0

    availability = (offers.get('availability') or '').lower()
    sold = 'outofstock' in availability.replace(' ', '') or 'soldout' in availability.replace(' ', '')

    # ref = mpn (manufacturer part number), or pull from name
    ref = (p.get('mpn') or '').strip()

    # Year + other properties for additional context
    year = ''
    for ap in p.get('additionalProperty', []) or []:
        if ap.get('name') == 'Year':
            year = (ap.get('value') or '').strip()

    title = name
    # If we have a ref and the name doesn't include it, append for search-friendliness.
    if ref and ref not in name:
        title = f"{name} {ref}"

    return {
        'title':       title,
        'brand':       detect_brand(title),
        'price':       price,
        'url':         p.get('url', ''),
        'img':         find_image(p),
        'description': year,
        'source':      "Bob's Watches",
        'sold':        sold,
    }


def main():
    print("Fetching Bob's Watches vintage collection...")
    seen_urls = set()
    results = []
    page = 1
    while True:
        print(f"Fetching page {page}...")
        html = fetch_page(page)
        raw = extract_products(html)
        print(f"  Got {len(raw)} product blocks")
        if not raw:
            break

        new_this_page = 0
        for p in raw:
            parsed = parse_product(p)
            if not parsed or not parsed['url']:
                continue
            if parsed['url'] in seen_urls:
                continue   # already saw this one earlier, pagination edge
            seen_urls.add(parsed['url'])
            new_this_page += 1
            if parsed['price'] == 0 or parsed['sold']:
                continue
            results.append(parsed)

        if new_this_page == 0:
            break
        page += 1
        time.sleep(0.3)

    print(f"\nSaved {len(results)} vintage listings")
    output = 'bobswatches_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','sold'])
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r['price'] for r in results]
        print(f"Written to {output}")
        print(f"  Min: ${min(prices):,} | Max: ${max(prices):,} | Avg: ${sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(r['brand'] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
