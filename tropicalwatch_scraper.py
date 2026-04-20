#!/usr/bin/env python3
"""
Tropical Watch scraper - uses Playwright headless browser
Run: python3 tropicalwatch_scraper.py
Requires: pip install playwright && playwright install chromium
Output: tropicalwatch_listings.csv
"""

import csv
import re
import time
import json
from datetime import date

def detect_brand(name):
    brands = [
        'Rolex', 'Omega', 'Patek Philippe', 'Tudor', 'Breitling', 'IWC',
        'Cartier', 'Jaeger-LeCoultre', 'Panerai', 'Audemars Piguet',
        'Vacheron Constantin', 'A. Lange', 'Heuer', 'Zenith', 'Longines',
        'Universal Geneve', 'Movado', 'Aquastar', 'Czapek', 'Urwerk', 'Breguet',
        'Seiko', 'Blancpain', 'Tissot', 'Tudor', 'Girard-Perregaux'
    ]
    for b in brands:
        if b.lower() in name.lower():
            return b
    return 'Other'

def scrape():
    from playwright.sync_api import sync_playwright

    BASE = "https://tropicalwatch.com"
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )

        print("Loading Tropical Watch listings page...")
        page.goto(f"{BASE}/watches", wait_until="networkidle", timeout=30000)

        # Scroll to load all listings
        print("Scrolling to load all listings...")
        prev_count = 0
        scroll_attempts = 0
        max_scrolls = 30

        while scroll_attempts < max_scrolls:
            # Count current listings
            cards = page.query_selector_all('a[href*="/watches/"]')
            current_count = len(cards)

            if current_count == prev_count and scroll_attempts > 2:
                # No new items after scrolling - we're at the bottom
                print(f"  Loaded {current_count} listings, no more to load")
                break

            prev_count = current_count
            print(f"  {current_count} listings so far, scrolling...")

            # Scroll to bottom
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1.5)
            scroll_attempts += 1

        # Extract all listing cards
        print(f"\nExtracting data from {prev_count} listings...")
        cards = page.query_selector_all('a[href*="/watches/"]')

        seen_urls = set()
        for card in cards:
            try:
                href = card.get_attribute('href') or ''
                if not href or href in seen_urls:
                    continue
                if href == '/watches/' or href == '/watches':
                    continue

                url = href if href.startswith('http') else BASE + href
                seen_urls.add(href)

                # Title
                title_el = card.query_selector('h2, h3, [class*="title"], [class*="name"]')
                title = title_el.inner_text().strip() if title_el else ''

                # Try alt text on image as fallback for title
                if not title:
                    img_el = card.query_selector('img')
                    title = (img_el.get_attribute('alt') or '').strip() if img_el else ''

                if not title:
                    continue

                # Price
                price_el = card.query_selector('[class*="price"], [class*="Price"]')
                price_text = price_el.inner_text().strip() if price_el else ''
                price_match = re.search(r'\$([0-9][0-9,]+)', price_text)
                price = int(price_match.group(1).replace(',', '')) if price_match else 0

                if price == 0:
                    continue

                # Image
                img_el = card.query_selector('img')
                img = ''
                if img_el:
                    img = (img_el.get_attribute('src') or
                           img_el.get_attribute('data-src') or
                           img_el.get_attribute('data-lazy') or '')

                results.append({
                    'title': title,
                    'brand': detect_brand(title),
                    'price': price,
                    'url': url,
                    'img': img,
                    'description': '',
                    'source': 'Tropical Watch',
                    'date': str(date.today()),
                    'sold': False,
                })
                print(f"  ✓ {detect_brand(title)} — {title[:50]} — ${price:,}")

            except Exception as e:
                print(f"  Error on card: {e}")
                continue

        browser.close()

    return results

def main():
    print("Starting Tropical Watch scraper (headless browser)...")
    print("This takes 30-60 seconds to scroll through all listings.\n")

    try:
        results = scrape()
    except ImportError:
        print("\nPlaywright not installed. Run:")
        print("  pip install playwright")
        print("  playwright install chromium")
        return

    if not results:
        print("No listings found - the page structure may have changed.")
        return

    output = 'tropicalwatch_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title','brand','price','url','img','description','source','date','sold'])
        writer.writeheader()
        writer.writerows(results)

    prices = [r['price'] for r in results]
    print(f"\n✓ Saved {len(results)} listings to {output}")
    print(f"  Min: ${min(prices):,} | Max: ${max(prices):,} | Avg: ${sum(prices)//len(prices):,}")

    from collections import Counter
    brands = Counter(r['brand'] for r in results)
    print("\nBy brand:")
    for b, c in brands.most_common(8):
        print(f"  {b}: {c}")

if __name__ == "__main__":
    main()
