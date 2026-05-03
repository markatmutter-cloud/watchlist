#!/usr/bin/env python3
"""
Vintage Watch Shop scraper — WordPress (custom product post type), GBP.

UK dealer (vintagewatchshop.com — site is "Vintage Heuer" / Vintage
Watch Shop). WordPress with a custom-post-type "product"; doesn't run
WooCommerce, so no Store API. Price isn't in the WP REST response —
we walk the /watches-accessories/ index pages for (URL, title, image)
and then fetch each detail page for the "Our price: £NNNN" pattern.

Index pagination: /watches-accessories/page/N/ (27 products per page,
~5 pages for ~116 products).

Run: python3 vintagewatchshop_scraper.py
Output: vintagewatchshop_listings.csv
"""
import csv
import re
import time

import requests

BASE = "https://www.vintagewatchshop.com"
INDEX_PATH = "/watches-accessories"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
MAX_INDEX_PAGES = 20  # generous; stops on first empty page
DETAIL_SLEEP = 0.2

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC",
    "Cartier", "Jaeger-LeCoultre", "Panerai", "Audemars Piguet",
    "Vacheron Constantin", "A. Lange", "Tag Heuer", "Heuer",
    "Longines", "Universal Geneve", "Movado", "Zenith", "Breguet",
    "Blancpain", "Tissot", "Ebel", "Hamilton", "Seiko",
    "Grand Seiko", "Bulova", "Mido", "Oris", "Junghans", "Chopard",
    "Piaget", "Girard-Perregaux", "Eberhard",
    "Rodania", "Favre-Leuba",
]


def detect_brand(title):
    lower = title.lower()
    for b in BRANDS:
        if b.lower() in lower:
            return b
    return "Other"


def collect_index():
    """Walk /watches-accessories/page/N/ pages and return list of
    (url, title, img) tuples for every product card found."""
    out = []
    seen = set()
    for page in range(1, MAX_INDEX_PAGES + 1):
        path = INDEX_PATH + "/" if page == 1 else f"{INDEX_PATH}/page/{page}/"
        url = BASE + path
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            if r.status_code == 404:
                print(f"  page {page}: 404 — done")
                break
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  page {page} failed: {e}")
            break
        # Match the card image+link block: <a href="…/products/<slug>/">
        # …<img src="…">. Use a non-greedy bridge so we don't span
        # multiple cards. Fall back to plain href list if structure
        # changes.
        cards = list(re.finditer(
            r'<a\s+href="(https://www\.vintagewatchshop\.com/products/[^"]+/)"\s*>'
            r'\s*<img\s+src="([^"]+)"',
            r.text,
        ))
        # Title from the matching <h3><a href="…">{title}</a></h3>.
        # Build a map of url → title for the page.
        title_map = {}
        for tm in re.finditer(
            r'<h3>\s*<a\s+href="(https://www\.vintagewatchshop\.com/products/[^"]+/)">\s*([^<]+?)\s*</a>',
            r.text,
        ):
            title_map[tm.group(1)] = tm.group(2).strip()

        new_count = 0
        for c in cards:
            link, img = c.group(1), c.group(2)
            if link in seen:
                continue
            seen.add(link)
            title = title_map.get(link, "")
            if not title:
                continue
            out.append((link, title, img))
            new_count += 1
        print(f"  page {page}: {new_count} new (cumulative {len(out)})")
        if new_count == 0:
            break
        time.sleep(0.3)
    return out


def parse_detail(html):
    """Return (price, sold). Price 0 + sold False = inquire / no price.
    Price 0 + sold True = sold listing."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&pound;", "£", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Primary price: "Our price: £9,750"
    m = re.search(r"Our\s+price\s*[:\-]?\s*£\s*([\d,]+)", text, re.IGNORECASE)
    price = int(m.group(1).replace(",", "")) if m else 0

    # Sold detection — look for "SOLD" word as a standalone (not in
    # CSS classes which are HTML-stripped above). The body text on
    # sold listings shows "SOLD" near the title or in a status badge.
    # Word-boundary match avoids "consoled", "resold", etc.
    sold = bool(re.search(r"\bSOLD\b", text)) and price == 0

    return price, sold


def main():
    print("Walking Vintage Watch Shop index pages...")
    items = collect_index()
    print(f"Collected {len(items)} product URLs\n")

    print("Fetching detail pages for prices...")
    results = []
    skipped_no_price = 0
    sold_count = 0
    for i, (url, title, img) in enumerate(items, 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  [{i}/{len(items)}] fetch error: {e}")
            time.sleep(DETAIL_SLEEP)
            continue
        price, sold = parse_detail(r.text)
        if sold:
            sold_count += 1
            time.sleep(DETAIL_SLEEP)
            continue  # skip sold; merge.py state will surface them later if previously seen
        if price == 0:
            skipped_no_price += 1
            time.sleep(DETAIL_SLEEP)
            continue
        results.append({
            "title": title,
            "brand": detect_brand(title),
            "price": price,
            "url": url,
            "img": img,
            "description": "",
            "source": "Vintage Watch Shop",
            "sold": False,
        })
        if i % 20 == 0:
            print(f"  …{i}/{len(items)} (kept: {len(results)}, sold: {sold_count}, no price: {skipped_no_price})")
        time.sleep(DETAIL_SLEEP)

    out_file = "vintagewatchshop_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["title", "brand", "price", "url", "img", "description", "source", "sold"],
        )
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r["price"] for r in results]
        print(f"\n✓ Saved {len(results)} listings to {out_file} (GBP)")
        print(f"  Min: £{min(prices):,} | Max: £{max(prices):,} | Avg: £{sum(prices)//len(prices):,}")
        print(f"  Skipped: {sold_count} sold, {skipped_no_price} no public price")
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
