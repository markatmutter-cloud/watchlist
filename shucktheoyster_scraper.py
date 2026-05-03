#!/usr/bin/env python3
"""
Shuck the Oyster scraper — WordPress + Elementor, EUR.

Shuck the Oyster (Cologne / Berlin) doesn't expose a Shopify or Woo
products endpoint. Their "shop" is a custom-post-type called "portfolio"
where every entry — sold or current — lives indefinitely. The category
page (/portfolio-category/vintage-watches/) is JS-rendered and surfaces
no product links server-side. The /portfolio/ root paginates newest-
first across years of inventory and IS server-rendered.

Two-step scrape:
  1. Walk /portfolio/ (newest-first) collecting detail-page URLs.
  2. For each URL, fetch the detail page, extract title + price + image
     + sold-flag.

Items without a "PRICE NNNN€" line on the detail page are inquire-only;
those are surfaced via priceOnRequest=True (same convention Wind Vintage
and Watchfid use). SOLD items are filtered out — the merge.py state
tracker will retain them in the Archive tab anyway because their stable
ID survives across scrapes.

Cap on listing pages: configurable via MAX_LISTING_PAGES. The portfolio
is sorted newest-by-post-date, NOT newest-by-activity — Shuck keeps
active inventory live indefinitely without re-dating, so a listing
posted 6+ months ago can still be current stock. The earlier 10-page
cap missed real inventory (e.g. a 2025-10 JLC Polaris Tribute was on
page 33). Active inventory currently lives across roughly the first
50 pages; 50 also picks up the long-tail active listings while still
cutting out the deepest sold-archive pages. Detail-page parsing
filters SOLD anyway, so a few extra pages cost runtime but never
pollute the feed.

Run: python3 shucktheoyster_scraper.py
Output: shucktheoyster_listings.csv
"""

import csv
import re
import time

import requests

BASE = "https://www.shucktheoyster.com"
LISTING_PATH = "/portfolio"
SOURCE_NAME = "Shuck the Oyster"
MAX_LISTING_PAGES = 50
DETAIL_SLEEP = 0.2
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC", "Cartier",
    "Jaeger-LeCoultre", "Panerai", "Audemars Piguet", "Vacheron Constantin",
    "A. Lange", "Aquastar", "Seiko", "Universal Geneve", "Heuer", "Longines",
    "Movado", "Czapek", "Urwerk", "Zenith", "Breguet", "Eberhard", "Tissot",
    "Blancpain", "Girard-Perregaux", "Gallet", "Minerva", "Lemania", "Enicar",
    "Doxa", "Ebel", "Hamilton", "Bulova", "Mido", "Oris", "Junghans",
    "Grand Seiko", "Chopard", "Piaget", "Bovet",
    # Misspellings the site uses — map to canonical form via detect_brand below.
    "Audemars Piquet",
]

BRAND_ALIASES = {
    "Audemars Piquet": "Audemars Piguet",  # site frequently misspells
}

# WordPress reserved slugs that share /portfolio/<slug>/ with real
# entries but aren't actual listings. Anything matching gets skipped
# by collect_detail_urls.
RESERVED_SLUGS = {
    "feed",         # RSS endpoint — was leaking in as "Portfolio Items Archive"
    "page",         # pagination root
    "embed",        # WP oEmbed iframes
    "comments-page",
}


def detect_brand(title):
    for b in BRANDS:
        if b.lower() in title.lower():
            return BRAND_ALIASES.get(b, b)
    return "Other"


def collect_detail_urls():
    """Walk /portfolio/page/N/ collecting unique detail URLs in order."""
    urls = []
    seen = set()
    for page in range(1, MAX_LISTING_PAGES + 1):
        path = f"{LISTING_PATH}/" if page == 1 else f"{LISTING_PATH}/page/{page}/"
        url = BASE + path
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  page {page} failed: {e}")
            break
        # Match /portfolio/<slug>/ links — exclude category links and
        # the listing root itself. Reserved WordPress slugs (feed, page,
        # comments-page, embed) live at the same path level as real
        # portfolio entries and would otherwise be scraped as listings.
        new = []
        for m in re.finditer(r'href="(https://www\.shucktheoyster\.com/portfolio/([^"/]+)/)"', r.text):
            link, slug = m.group(1), m.group(2)
            if link == BASE + LISTING_PATH + "/":
                continue
            if slug in RESERVED_SLUGS:
                continue
            if link in seen:
                continue
            seen.add(link)
            new.append(link)
        if not new:
            print(f"  page {page}: no new portfolio links — stopping")
            break
        urls.extend(new)
        print(f"  page {page}: +{len(new)} (total {len(urls)})")
        time.sleep(0.3)
    return urls


def parse_detail(html, url):
    # Title — prefer the h1 (cleanest), fall back to <title>.
    title = ""
    m = re.search(r"<h1[^>]*>([^<]+)</h1>", html)
    if m:
        title = m.group(1).strip()
    if not title:
        m = re.search(r"<title>([^<]+?)\s*-\s*Shuck the Oyster", html)
        if m:
            title = m.group(1).strip()
    # Strip smart quotes that won't render cleanly in the grid.
    title = title.replace("‘", "'").replace("’", "'")

    # SOLD detection — appears in body text on sold items.
    sold = bool(re.search(r"\bSOLD\b", html))

    # Image — og:image is the canonical hero image.
    img = ""
    m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    if m:
        img = m.group(1)

    # Price — "PRICE 2500€" pattern. Comma/dot in the number rare but tolerated.
    price = 0
    price_on_request = False
    text = re.sub(r"<[^>]+>", " ", html)
    m = re.search(r"PRICE\s+([\d,.]+)\s*€", text, re.IGNORECASE)
    if m:
        digits = m.group(1).replace(",", "").replace(".", "")
        try:
            price = int(digits)
        except ValueError:
            price = 0
    if price == 0 and not sold:
        # No price visible AND not marked sold = inquire-style.
        price_on_request = True

    return {
        "title": title,
        "brand": detect_brand(title),
        "price": price,
        "url": url,
        "img": img,
        "description": "",
        "source": SOURCE_NAME,
        "sold": sold,
        "priceOnRequest": price_on_request,
    }


def main():
    print(f"Fetching {SOURCE_NAME} listings (Wordpress portfolio CPT)...")
    detail_urls = collect_detail_urls()
    print(f"\nCollected {len(detail_urls)} portfolio URLs across "
          f"up to {MAX_LISTING_PAGES} pages")

    results = []
    skipped_sold = skipped_no_title = 0
    inquire = 0
    for i, url in enumerate(detail_urls, 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  [{i}/{len(detail_urls)}] fetch error: {e}")
            continue
        parsed = parse_detail(r.text, url)
        if not parsed["title"]:
            skipped_no_title += 1
            print(f"  [{i}/{len(detail_urls)}] no title, skipped")
            time.sleep(DETAIL_SLEEP)
            continue
        if parsed["sold"]:
            skipped_sold += 1
            time.sleep(DETAIL_SLEEP)
            continue
        if parsed.get("priceOnRequest"):
            inquire += 1
        results.append(parsed)
        print(f"  [{i}/{len(detail_urls)}] {parsed['brand']} — "
              f"{parsed['title'][:50]} "
              f"({parsed['price']}€{' [POR]' if parsed['priceOnRequest'] else ''})")
        time.sleep(DETAIL_SLEEP)

    out_file = "shucktheoyster_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "title", "brand", "price", "url", "img",
            "description", "source", "sold", "priceOnRequest",
        ])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n✓ Saved {len(results)} listings to {out_file}")
    print(f"  ({inquire} priced as 'inquire')")
    print(f"  Skipped: {skipped_sold} sold, {skipped_no_title} no title")
    if results:
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
