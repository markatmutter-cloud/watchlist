#!/usr/bin/env python3
"""
Luna Royster scraper — WooCommerce Store API, USD-priced.

Standard pattern: hit /wp-json/wc/store/v1/products with pagination,
let merge.py handle brand/state enrichment. Mirrors the
greyandpatina_scraper template.

A handful of LR listings carry placeholder prices ($1 / $0) when the
piece is "price on request" — we filter those out so they don't show
up as $1 watches in the feed.

Run: python3 lunaroyster_scraper.py
Output: lunaroyster_listings.csv
"""
import requests
import csv
import re
import time

BASE = "https://lunaroyster.com"
API = f"{BASE}/wp-json/wc/store/v1/products"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE}/",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# Brand detection. LR's catalog is heavy on independent + neo-vintage
# (F.P. Journe, MB&F, etc.) so the list runs longer than a typical
# vintage-only dealer.
BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Heuer', 'Longines', 'Universal Geneve', 'Movado', 'Zenith',
    'Breguet', 'Blancpain', 'Eberhard', 'Girard-Perregaux', 'Tissot',
    'F.P. Journe', 'F. P. Journe', 'MB&F', 'H. Moser', 'Moser', 'De Bethune',
    'Greubel Forsey', 'Urwerk', 'Richard Mille', 'Roger Smith', 'Voutilainen',
    'Akrivia', 'Laurent Ferrier', 'Czapek', 'Parmigiani', 'Bovet',
]

# Listings priced at or below this threshold (USD) are treated as
# "price on request" / placeholder and skipped. LR has at least one
# F.P. Journe at $1.00 in the catalog.
PLACEHOLDER_PRICE_USD = 50


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
    text = re.sub(r'&#038;', '&', text)
    return re.sub(r'\s+', ' ', text).strip()


def fetch_page(page, per_page):
    last_err = None
    for attempt in range(3):
        try:
            r = SESSION.get(API, params={
                'per_page': per_page,
                'page': page,
                'status': 'publish',
            }, timeout=20)
            if r.status_code == 200:
                return r.json()
            last_err = f"HTTP {r.status_code}"
            time.sleep(2 ** attempt)
        except requests.RequestException as e:
            last_err = str(e)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"page {page} failed after 3 attempts: {last_err}")


def get_all_listings():
    all_items = []
    page = 1
    per_page = 100
    try:
        SESSION.get(BASE + "/", timeout=20)
    except requests.RequestException:
        pass

    while True:
        print(f"Fetching page {page}...")
        items = fetch_page(page, per_page)
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
    title = strip_html(item.get('name', ''))

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
    img = images[0]['src'] if images else ''

    url = item.get('permalink', '')

    desc = strip_html(item.get('description', '') or item.get('short_description', ''))[:500]

    brand = detect_brand(title)
    for cat in item.get('categories', []):
        name = cat.get('name', '')
        for b in BRANDS:
            if b.lower() in name.lower():
                brand = b

    return {
        'title': title,
        'brand': brand,
        'price': price,
        'url': url,
        'img': img,
        'description': desc,
        'source': 'Luna Royster',
        'sold': sold,
    }


def main():
    print("Fetching Luna Royster inventory (WooCommerce Store API)...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    results = []
    skipped_sold = 0
    skipped_placeholder = 0
    for item in raw:
        parsed = parse_item(item)
        if parsed['price'] <= PLACEHOLDER_PRICE_USD:
            skipped_placeholder += 1
            continue
        if parsed['sold']:
            skipped_sold += 1
            continue
        results.append(parsed)
        print(f"  + {parsed['brand']} — {parsed['title'][:55]} — ${parsed['price']:,}")

    print(f"\nSkipped: {skipped_sold} sold, {skipped_placeholder} placeholder/POR")

    output = 'lunaroyster_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','sold'])
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
