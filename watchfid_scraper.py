#!/usr/bin/env python3
"""
Watchfid scraper.

Watchfid is built on WordPress + Elementor. Watches are NOT WooCommerce
products — they're a custom post type at /watch/<slug>/, surfaced as
Elementor cards on the /available-watches/ page (~20 listings live at
any given time).

Approach:
  1. Fetch /available-watches/ — extract the set of /watch/<slug>/ URLs
     plus the title and price for each (all rendered inline in the page).
  2. Visit each detail page just to grab the og:image (the listing page
     uses lazy-loaded images that aren't reliably in the HTML).

Price format on the page is European: "€\xa0139.000" → 139000 EUR.

Run: python3 watchfid_scraper.py
Output: watchfid_listings.csv
"""

import csv
import re
import time

import requests

BASE = "https://www.watchfid.com"
LIST_URL = f"{BASE}/available-watches/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
}

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC", "Cartier",
    "Jaeger-LeCoultre", "Panerai", "Audemars Piguet", "Vacheron Constantin",
    "A. Lange", "Heuer", "Zenith", "Longines", "Universal Geneve",
    "Movado", "Aquastar", "Czapek", "Urwerk", "Breguet", "Boucheron",
    "Eberhard", "Lemania", "Nivada", "Croton", "Grand Seiko", "Piaget",
    "Bulova", "Dodane", "Asprey", "A. Lange & Sohne",
]


def detect_brand(title):
    t = title.lower()
    for b in BRANDS:
        if b.lower() in t:
            return b
    return "Other"


def clean_title(t):
    """Strip HTML entities and tags from a title fragment."""
    t = re.sub(r'<br\s*/?>', " ", t)
    t = re.sub(r'<[^>]+>', "", t)
    t = (t.replace("&#8220;", "“")
          .replace("&#8221;", "”")
          .replace("&quot;", '"')
          .replace("&amp;", "&")
          .replace("&nbsp;", " "))
    return re.sub(r'\s+', " ", t).strip()


def parse_eur_price(s):
    """Convert "€\xa0139.000" → 139000. Watchfid uses European thousands
    separator (full-stop). No fractional cents on the page."""
    if not s:
        return None
    s = s.replace("\xa0", "").replace(" ", "").replace("€", "")
    # Drop the thousand-separator dot. If there's a comma it's decimal,
    # but every observed price is an integer — drop both safely.
    s = s.replace(".", "").replace(",", "")
    s = re.sub(r'[^\d]', "", s)
    return int(s) if s else None


def get_listings():
    """Return [{"url", "title", "price", "sold"}] from /available-watches/."""
    print(f"Fetching {LIST_URL}...")
    r = requests.get(LIST_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    html = r.text

    # Each watch card on the page renders a title link followed (further
    # down the same Elementor row) by a status word ("Available") and a
    # price block. We anchor on the title link and then scan a window
    # forward in the HTML for the matching price.
    title_re = re.compile(
        r'<a href="(https://www\.watchfid\.com/watch/[a-z0-9-]+/)"\s*>([^<]*(?:<br[^>]*>[^<]*)*)</a>',
        re.IGNORECASE
    )
    out = []
    seen = set()
    for m in title_re.finditer(html):
        url = m.group(1)
        if url in seen:
            continue
        seen.add(url)
        raw_title = m.group(2)
        title = clean_title(raw_title)

        # Look for the next "Available" / "Reserved" / "Sold" status
        # token + price within the next ~3KB of HTML (one Elementor card
        # is ~2.5KB).
        window = html[m.end():m.end() + 3500]
        status_m = re.search(r'<span>(Available|Reserved|Sold|On Hold|Pending)</span>', window, re.IGNORECASE)
        status = status_m.group(1).strip() if status_m else "Available"
        sold = status.lower() not in ("available",)

        # Price block sits in a text-editor widget right after status.
        price_m = re.search(r'<div class="elementor-widget-container">\s*€[^\d<]*([\d.,\s]+)', window)
        price = parse_eur_price(price_m.group(1)) if price_m else None

        out.append({"url": url, "title": title, "price": price, "sold": sold})

    print(f"Found {len(out)} watch cards")
    return out


def get_image(url):
    """Return a cross-origin-loadable image URL for the watch detail page.

    Watchfid hot-link-protects their .jpg uploads (returns 404 unless the
    Referer is watchfid.com), so og:image often points to an unusable
    .jpg. Their .webp uploads serve fine cross-origin. We prefer those.

    Picture-Books.webp / Picture-Shop.webp / Picture-Watches.webp are
    section-placeholder images that appear on every page — filtered out.
    """
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        html = r.text

        # Find webp images in /uploads/, excluding sized variants and the
        # site-wide placeholders.
        webps = re.findall(
            r'https://www\.watchfid\.com/wp-content/uploads/\d{4}/\d{2}/[^\s"\'<>]+\.webp',
            html
        )
        for u in webps:
            fname = u.rsplit("/", 1)[-1]
            if re.search(r'-\d+x\d+\.webp$', fname):
                continue
            if fname.startswith("Picture-"):
                continue
            return u

        # Fallback to og:image (likely a hot-linked-protected .jpg, but
        # better than nothing — at least the URL is right if Watchfid
        # ever drops the protection).
        m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        if m:
            return m.group(1)
    except Exception as e:
        print(f"  image fetch error: {e}")
    return None


def main():
    listings = get_listings()
    results = []
    skipped = 0

    for i, item in enumerate(listings, 1):
        title = item["title"]
        url = item["url"]
        price = item["price"]
        sold = item["sold"]
        print(f"[{i}/{len(listings)}] {title[:55]}...", end=" ", flush=True)

        if not price:
            print("no price, skipped")
            skipped += 1
            continue

        img = get_image(url) or ""
        results.append({
            "title":       title,
            "brand":       detect_brand(title),
            "price":       price,
            "url":         url,
            "img":         img,
            "description": "",
            "source":      "Watchfid",
            "date":        time.strftime("%Y-%m-%d"),
            "sold":        sold,
        })
        print(f"€{price:,}{' [SOLD]' if sold else ''}")
        time.sleep(0.4)

    out_file = "watchfid_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "title", "brand", "price", "url", "img",
            "description", "source", "date", "sold",
        ])
        writer.writeheader()
        writer.writerows(results)

    on_hold = sum(1 for r in results if r["sold"])
    prices = [r["price"] for r in results if not r["sold"]]
    print(f"\n✓ Saved {len(results)} listings to {out_file}")
    print(f"  For sale: {len(results)-on_hold} | On hold: {on_hold} | No price: {skipped}")
    if prices:
        print(f"  Active avg: €{sum(prices)//len(prices):,}")


if __name__ == "__main__":
    main()
