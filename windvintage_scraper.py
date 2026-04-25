#!/usr/bin/env python3
"""
Wind Vintage scraper
Run: python3 windvintage_scraper.py
Requires: pip install requests
Output: windvintage_listings.csv
"""

import requests
import re
import csv
import time

BASE = "https://www.windvintage.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

# Skip standalone-bracelet listings (Gay Frères, Jubilee bracelets, etc.)
# WITHOUT eating watches that happen to be sold "on bracelet". The bare
# word "bracelet" used to live here and was filtering out watches like
# "Heuer Autavia ... 73463 On Bracelet" — fixed by listing only the
# bracelet-typed product titles, never the bare word.
SKIP_TITLE_WORDS = [
    'gay frères', 'gay freres', 'jubilee bracelet', 'rivet bracelet',
    'mesh bracelet', 'oyster bracelet', 'end links',
]
SKIP_DOMAINS = ['kith.com', 'mrporter.com', 'net-a-porter.com']

# Any of these near the price line = treat as sold but keep the price
ON_HOLD_PATTERNS = ['on hold', 'sold', 'under offer', 'pending', 'reserved']

BRANDS = [
    'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC', 'Cartier',
    'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet', 'Vacheron Constantin',
    'A. Lange', 'Heuer', 'Zenith', 'Longines', 'Universal Geneve',
    'Movado', 'Aquastar', 'Czapek', 'Urwerk', 'Breguet'
]

def is_skip(url, title):
    for word in SKIP_TITLE_WORDS:
        if word in title.lower():
            return True
    for domain in SKIP_DOMAINS:
        if domain in url:
            return True
    return False

def detect_brand(title):
    for b in BRANDS:
        if b.lower() in title.lower():
            return b
    return 'Other'

def get_listings():
    print("Fetching Wind Vintage listings page...")
    r = requests.get(f"{BASE}/watches?format=json", headers=HEADERS, timeout=20)
    r.raise_for_status()
    data = r.json()
    html = data.get("mainContent", "")

    slides = re.findall(
        r'href="([^"]+)"[^>]*>.*?data-src="([^"]+)".*?image-slide-title[^>]*>(.*?)</div>',
        html, re.DOTALL
    )

    listings = []
    seen = set()
    for href, img, title in slides:
        title = re.sub(r'<[^>]+>', '', title).strip()
        href = href.strip()
        if href in seen or not title:
            continue
        if is_skip(href, title):
            continue
        seen.add(href)
        listings.append({"url": href, "img": img, "title": title})

    print(f"Found {len(listings)} watch listings")
    return listings

def get_price_and_status(url):
    """Returns (price, sold, desc)"""
    if url.startswith("/"):
        url = BASE + url
    elif not url.startswith("http"):
        url = BASE + "/" + url

    try:
        r = requests.get(f"{url}?format=json", headers=HEADERS, timeout=20)
        r.raise_for_status()
        data = r.json()
        html = data.get("mainContent", "")

        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'&nbsp;', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        text_lower = text.lower()

        # Check for on-hold / sold signals in a window around PRICE
        sold = False
        price_area = re.search(r'.{0,150}PRICE.{0,150}', text, re.IGNORECASE)
        if price_area:
            area_lower = price_area.group(0).lower()
            for pattern in ON_HOLD_PATTERNS:
                if pattern in area_lower:
                    sold = True
                    break

        # Also check the top 500 chars (title area of the page)
        if not sold:
            for pattern in ON_HOLD_PATTERNS:
                if pattern in text_lower[:500]:
                    sold = True
                    break

        # Extract price - handles ON HOLD variants
        price = None
        price_match = re.search(
            r'PRICE[:\s\-]*(?:ON HOLD[^$\d]*)?[\$]([0-9][0-9,]+)',
            text, re.IGNORECASE
        )
        if not price_match:
            price_match = re.search(r'\$([0-9][0-9,]+)', text)
        if price_match:
            price = int(price_match.group(1).replace(',', ''))

        # Extract description
        desc_match = re.search(r'(The [A-Z][^.]{20,}\..*?)(?:PRICE|\Z)', text, re.DOTALL)
        desc = desc_match.group(1).strip()[:400] if desc_match else ""

        return price, sold, desc

    except Exception as e:
        print(f"  Error: {e}")
        return None, False, ""

def main():
    listings = get_listings()
    results = []
    skipped = 0

    for i, item in enumerate(listings):
        print(f"[{i+1}/{len(listings)}] {item['title'][:55]}...", end=' ')
        price, sold, desc = get_price_and_status(item['url'])

        if not price:
            print("no price, skipped")
            skipped += 1
            continue

        results.append({
            'title': item['title'],
            'brand': detect_brand(item['title']),
            'price': price,
            'url': item['url'] if item['url'].startswith('http') else BASE + item['url'],
            'img': item['img'],
            'description': desc,
            'source': 'Wind Vintage',
            'date': '2026-04-19',
            'sold': sold,
        })
        print(f"${price:,}{' [ON HOLD]' if sold else ''}")
        time.sleep(0.3)

    output_file = 'windvintage_listings.csv'
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','date','sold'])
        writer.writeheader()
        writer.writerows(results)

    on_hold = sum(1 for r in results if r['sold'])
    prices = [r['price'] for r in results if not r['sold']]
    print(f"\n✓ Saved {len(results)} listings to {output_file}")
    print(f"  For sale: {len(results)-on_hold} | On hold: {on_hold} | No price: {skipped}")
    if prices:
        print(f"  Active avg: ${sum(prices)//len(prices):,}")

if __name__ == "__main__":
    main()
