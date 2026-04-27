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


AVAILABILITY_TAXONOMY = "/wp-json/wp/v2/availability"
WATCHES_ENDPOINT = "/wp-json/wp/v2/watch"


def get_available_term_id():
    """Look up the term ID for availability=available so the watch query
    can filter on it. The slug is stable; the ID isn't (depends on the
    site)."""
    r = requests.get(BASE + AVAILABILITY_TAXONOMY, headers=HEADERS, timeout=15)
    r.raise_for_status()
    for t in r.json():
        if t.get("slug") == "available":
            return t.get("id")
    return None


def get_listings():
    """Pull every watch tagged with availability=available via the WP REST
    API. The user-facing /available-watches/ page paginates client-side
    via JetEngine; the REST endpoint exposes the full list in one query
    and survives layout changes upstream."""
    term_id = get_available_term_id()
    if not term_id:
        raise RuntimeError("availability=available term not found")
    print(f"Fetching available watches (term id={term_id})...")

    out = []
    seen = set()
    page = 1
    while True:
        r = requests.get(
            BASE + WATCHES_ENDPOINT,
            params={"per_page": 100, "availability": term_id, "page": page, "_embed": "true"},
            headers=HEADERS, timeout=20,
        )
        if r.status_code == 400 and page > 1:
            break  # past the last page
        r.raise_for_status()
        items = r.json()
        if not items:
            break

        for w in items:
            url = w.get("link") or ""
            if not url or url in seen:
                continue
            seen.add(url)
            title_html = (w.get("title") or {}).get("rendered") or ""
            title = clean_title(title_html)
            out.append({
                "url": url,
                "title": title,
                # Price + image come from the detail page — REST doesn't
                # expose Elementor widget content. Detail-page scrape in
                # main() handles both.
                "price": None,
                "sold": False,  # filtered on the server, all are Available
            })

        total_pages = int(r.headers.get("X-WP-TotalPages", "1"))
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.3)

    print(f"Found {len(out)} watches available")
    return out


def get_price_and_status(url):
    """Visit a watch detail page and return (price, sold). Pulled out
    of the listing flow so the REST-driven enumeration above doesn't
    need Elementor parsing."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        html = r.text
        text_lower = html.lower()

        on_hold_m = re.search(
            r'(on hold|reserved|under offer|pending|sold)\s*\(item\b',
            text_lower
        )
        inquire = bool(re.search(r'\binquire\s*\(item\b', text_lower))
        sold = bool(on_hold_m)

        # Price: look for "€ 9.500" pattern anywhere in the rendered text.
        # Watchfid templates put the EUR amount inside an Elementor
        # text-editor widget right after the status word.
        price = None
        price_m = re.search(r'€[\s\xa0]*([\d.,\s]+)', html)
        if price_m:
            price = parse_eur_price(price_m.group(1))
        return price, sold, inquire
    except Exception as e:
        print(f"  detail fetch error: {e}")
        return None, False, False


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
        print(f"[{i}/{len(listings)}] {title[:55]}...", end=" ", flush=True)

        # REST tells us availability; detail page tells us price + image.
        price, sold, inquire = get_price_and_status(url)

        if not price:
            if sold or inquire:
                price = 0  # surfaced as "Price on request" by the frontend
            else:
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
        if price:
            print(f"€{price:,}{' [SOLD]' if sold else ''}")
        elif sold:
            print("[SOLD, no price]")
        else:
            print("[Price on request]")
        time.sleep(0.3)

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
