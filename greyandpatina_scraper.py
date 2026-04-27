#!/usr/bin/env python3
"""
Grey & Patina scraper - WooCommerce Store API (same pattern as Menta).
Run: python3 greyandpatina_scraper.py
Requires: pip install requests
Output: greyandpatina_listings.csv

Replaces the old Browse AI version. G&P runs WooCommerce and exposes the
public Store API at /wp-json/wc/store/v1/products — no auth needed, returns
full inventory with prices, availability, images, and dates.
"""
import requests
import csv
import re
import time

BASE = "https://greyandpatina.com"
API = f"{BASE}/wp-json/wc/store/v1/products"
# Cloudflare in front of greyandpatina.com sometimes 401s the bare-UA
# request from CI runners. A complete browser-like UA + cookie-persisting
# Session lets the __cf_bm bot-management cookie established by the first
# request carry through to subsequent paginated requests.
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

# Small brand list just for early filtering; merge.py reassigns brand from title anyway.
BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Heuer', 'Longines', 'Universal Geneve', 'Movado', 'Zenith',
    'Breguet', 'Blancpain', 'Eberhard', 'Girard-Perregaux', 'Tissot',
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


def fetch_page(page, per_page):
    """One paginated request with retry-on-transient-failure. Cloudflare
    returns 401/403 occasionally to fresh sessions; a short backoff
    usually clears it because the __cf_bm cookie has been issued by then."""
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
            # 401/403/429/5xx → backoff and retry
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
    # Warm the session with a homepage GET so Cloudflare hands us a
    # __cf_bm cookie before we hit the API. Skips silently if it fails;
    # the API call below has its own retry.
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
    title = item.get('name', '')

    # WooCommerce returns price as a string; currency_minor_unit tells us the
    # decimal scale (0 = whole dollars, 2 = cents). G&P returns 0, Menta
    # returns 2. Using the field makes this robust across configurations.
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
    # Also check categories for brand hints.
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
        'source': 'Grey & Patina',
        'sold': sold,
    }


def main():
    print("Fetching Grey & Patina inventory (WooCommerce Store API)...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    results = []
    skipped_sold = 0
    skipped_no_price = 0
    for item in raw:
        parsed = parse_item(item)
        if parsed['price'] == 0:
            skipped_no_price += 1
            continue
        if parsed['sold']:
            skipped_sold += 1
            continue
        results.append(parsed)
        print(f"  + {parsed['brand']} — {parsed['title'][:55]} — ${parsed['price']:,}")

    print(f"\nSkipped: {skipped_sold} sold, {skipped_no_price} no price")

    output = 'greyandpatina_listings.csv'
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
