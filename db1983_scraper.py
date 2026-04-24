#!/usr/bin/env python3
"""
DB1983 scraper - Roy & Sacha Davidoff SA (Swiss vintage dealer).
Run: python3 db1983_scraper.py
Requires: pip install requests
Output: db1983_listings.csv

Site is a PhotoBiz-hosted page with no public JSON API, but every
product page exposes OpenGraph metadata for price, currency, title
and image. We scrape the homepage for product URLs, then hit each
one and extract the meta tags. Prices are in CHF (Swiss Francs).
"""
import requests
import csv
import re
import time

BASE = "https://www.db1983.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Aquastar', 'Seiko', 'Universal Geneve', 'Heuer', 'Longines',
    'Movado', 'Czapek', 'Urwerk', 'Zenith', 'Breguet', 'Gerald Genta',
]


def detect_brand(name):
    for b in BRANDS:
        if b.lower() in name.lower():
            return b
    return 'Other'


def meta_content(html, prop):
    """Pull `<meta property="{prop}" content="..."` — case-insensitive on prop."""
    m = re.search(
        r'<meta\s+property="' + re.escape(prop) + r'"\s+content="([^"]*)"',
        html, re.IGNORECASE,
    )
    return m.group(1).strip() if m else ''


def get_product_urls():
    print(f"Fetching homepage to collect product URLs...")
    r = requests.get(BASE, headers=HEADERS, timeout=20)
    r.raise_for_status()
    html = r.text
    # Every live listing uses this path prefix.
    paths = re.findall(r'href="(/the-collection/collection-for-sale/[^"#?]+)"', html)
    # Dedupe while preserving order
    seen = set()
    unique = []
    for p in paths:
        if p not in seen:
            seen.add(p)
            unique.append(p)
    print(f"Found {len(unique)} product URLs on homepage")
    return unique


def fetch_product(path):
    url = BASE + path
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
    except Exception as e:
        print(f"  ! {path}: {e}")
        return None
    html = r.text

    title = meta_content(html, 'og:title')
    # og:title is typically "<watch> - Roy & Sacha Davidoff SA". Strip the suffix.
    title = re.sub(r'\s*-\s*Roy\s*&?\s*Sacha Davidoff.*$', '', title, flags=re.IGNORECASE).strip()
    if not title:
        return None

    # PhotoBiz embeds the commerce product metadata here.
    price_raw = meta_content(html, 'product:price:amount')
    currency = meta_content(html, 'product:price:currency').strip() or 'CHF'

    price = 0
    if price_raw:
        try:
            price = int(float(price_raw.replace(',', '')))
        except (ValueError, TypeError):
            price = 0

    img = meta_content(html, 'og:image')
    desc = meta_content(html, 'og:description') or meta_content(html, 'description')

    return {
        'title':       title,
        'brand':       detect_brand(title),
        'price':       price,
        'url':         url,
        'img':         img,
        'description': desc[:400],
        'source':      'DB1983',
        'sold':        False,   # Homepage only shows available listings
    }


def main():
    print("Fetching DB1983 inventory (PhotoBiz HTML scrape)...")
    paths = get_product_urls()

    results = []
    skipped = 0
    for i, path in enumerate(paths):
        print(f"[{i+1}/{len(paths)}] {path[-50:]}...", end=" ")
        item = fetch_product(path)
        if not item or item['price'] == 0:
            print("skipped")
            skipped += 1
            continue
        print(f"CHF {item['price']:,}")
        results.append(item)
        time.sleep(0.3)

    print(f"\nSkipped {skipped} items (fetch failed or no price)")

    output = 'db1983_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','sold'])
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r['price'] for r in results]
        print(f"\nSaved {len(results)} listings to {output} (prices in CHF)")
        print(f"  Min: CHF {min(prices):,} | Max: CHF {max(prices):,} | Avg: CHF {sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(r['brand'] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
