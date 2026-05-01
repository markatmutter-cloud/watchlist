#!/usr/bin/env python3
"""
Central Watch (Grand Central Watch Repair, NYC) scraper — custom PHP
catalogue, USD-priced.

The site is a hand-rolled PHP shop, not Shopify/WooCommerce, so we
HTML-parse with regex against a stable card structure:

    <div class="prod_result_item">
      <a class="prod_results_add_to_cart" href="/shop/pre-owned/SLUG">…</a>
      <a href="/shop/pre-owned/SLUG" title="…">
        <img src="/images/products/prod_NNN_MMM_medium.png" …/>
      </a>
      <strong>YEAR BRAND<br/>MODEL - <span class="prod_ref_num">REF</span></strong>
      <div class="price"><p>$NNN.NN</p></div>
    </div>

Pagination uses /shop/pre-owned/R{offset} where offset jumps by 20
(R20 = page 2, R40 = page 3, ...). The first page shows total + a
"Next" link with the next offset; we walk until "Next" disappears.

Run:    python3 centralwatch_scraper.py
Output: centralwatch_listings.csv
"""

import csv
import re
import time

import requests

BASE = "https://centralwatch.com"
START_PATH = "/shop/pre-owned"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC", "Cartier",
    "Panerai", "Audemars Piguet",
    # Multi-word/punctuated forms must come BEFORE substring-shorter ones —
    # "Vacheron Constantin" before any "Vacheron"; the alias step in
    # merge.py canonicalises stray punctuation ("& Constantin", "Le Coultre").
    "Vacheron Constantin", "Vacheron",
    # Central Watch writes "Jaeger LeCoultre" (no hyphen). merge.py has
    # an alias entry that maps this to canonical "Jaeger-LeCoultre" once
    # merge runs, so we just need the substring to match here.
    "Jaeger LeCoultre", "Jaeger-LeCoultre",
    "A. Lange", "Aquastar",
    "Grand Seiko", "Seiko",
    "Universal Geneve",
    "Tag Heuer", "Heuer",
    # Same hyphen vs space deal as JLC — Central Watch writes "Girard
    # Perregaux"; canonical form is hyphenated.
    "Girard Perregaux", "Girard-Perregaux",
    # Extras seen in the Central Watch catalogue specifically (not all
    # in the master BRANDS list elsewhere — that's fine; the brand chip
    # surfaces whatever the scraper hands merge.py).
    "Baume & Mercier", "Bulgari", "Hublot", "Franck Muller",
    "Tiffany & Co", "Glashutte", "Gruen", "Hermes", "Chanel",
    "Tourneau", "Croton",
    "Longines", "Movado", "Zenith", "Breguet", "Eberhard",
    "Blancpain", "Tissot", "Ebel", "Piaget",
    "Hamilton", "Bulova", "Mido", "Oris", "Junghans", "Chopard",
    "Doxa", "Lemania", "Minerva", "Enicar", "Chronoswiss",
]

CARD_RE = re.compile(
    r'<div\s+class="prod_result_item">'
    r'.*?'
    r'<a[^>]*href="(?P<url>/shop/pre-owned/[^"]+)"\s+title="(?P<title>[^"]*)">'
    r'\s*<img\s+src="(?P<img>[^"]+)"'
    r'.*?'
    r'<strong>(?P<strong>.*?)</strong>'
    r'.*?'
    r'<div\s+class="price">\s*<p>\$(?P<price>[\d,\.]+)</p>',
    re.DOTALL,
)
NEXT_RE = re.compile(r'href="(/shop/pre-owned/R\d+)"[^>]*>\s*Next\s*<')
REF_RE  = re.compile(r'<span\s+class="prod_ref_num">([^<]+)</span>')


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&#?\w+;", "", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_brand(text):
    # BRANDS is intentionally ordered so multi-word/longer forms hit first
    # (Grand Seiko before Seiko, Tag Heuer before Heuer, etc.).
    lower = text.lower()
    for b in BRANDS:
        if b.lower() in lower:
            return b
    return "Other"


def parse_card(match):
    raw_strong = match.group("strong")
    title = strip_html(raw_strong)
    # Strip the trailing " - REFNUM" if present so the title is clean
    # before we add the ref back as a structured field. The REF lives
    # inside the <span class="prod_ref_num"> we extracted above.
    ref_match = REF_RE.search(raw_strong)
    ref = ref_match.group(1).strip() if ref_match else ""
    if ref:
        # Title still includes the ref because strip_html flattened
        # everything; remove it cleanly so brand/model reads naturally.
        title = re.sub(rf"\s*-\s*{re.escape(ref)}\s*$", "", title).strip()

    # Price: "$16,995.00" → 16995
    raw_price = match.group("price").replace(",", "").split(".")[0]
    try:
        price = int(raw_price)
    except ValueError:
        price = 0

    url = BASE + match.group("url")
    img_path = match.group("img")
    img = img_path if img_path.startswith("http") else BASE + img_path

    # Drop the leading "YYYY " or "YYYY's " year token before brand-detect
    # so e.g. "1950's Vacheron Constantin" doesn't fool the matcher.
    brand_text = re.sub(r"^\d{4}'?s?\s+", "", title)
    brand = detect_brand(brand_text)

    # Combine title + ref into the natural display name. Other dealer
    # scrapers use the listing title as-is; merge.py owns ref extraction
    # downstream — but Central Watch surfaces ref so cleanly that we
    # ALSO feed it into title for searchability.
    full_title = f"{title} {ref}".strip() if ref else title

    return {
        "title": full_title,
        "brand": brand,
        "price": price,
        "url": url,
        "img": img,
        "description": "",
        "source": "Central Watch",
        "sold": False,
    }


def fetch_page(path):
    url = BASE + path
    print(f"Fetching {url}")
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def get_all_listings():
    all_items = []
    seen_urls = set()
    path = START_PATH
    page = 1
    # Hard cap loop iterations as a safety net — the live catalogue is
    # ~190 items today (10 pages); 50 is way more than enough but
    # protects against a pagination bug spinning forever.
    while page <= 50:
        html = fetch_page(path)
        cards = list(CARD_RE.finditer(html))
        if not cards:
            print(f"  No cards on page {page} — stopping.")
            break

        new_count = 0
        for m in cards:
            item = parse_card(m)
            if item["url"] in seen_urls:
                continue
            seen_urls.add(item["url"])
            all_items.append(item)
            new_count += 1
        print(f"  Page {page}: {len(cards)} cards, {new_count} new (running total: {len(all_items)})")

        next_match = NEXT_RE.search(html)
        if not next_match:
            print("  No Next link — done.")
            break
        path = next_match.group(1)
        page += 1
        time.sleep(0.5)

    return all_items


def main():
    print("Fetching Central Watch inventory (custom HTML)...")
    items = get_all_listings()
    print(f"\nTotal raw items: {len(items)}")

    # Drop $0 placeholders so listings without a public price don't
    # surface as "free" in the feed. Same hygiene as other scrapers.
    results = [it for it in items if it["price"] > 0]
    skipped = len(items) - len(results)
    if skipped:
        print(f"Skipped {skipped} items with no price")

    output = "centralwatch_listings.csv"
    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["title", "brand", "price", "url", "img", "description", "source", "sold"]
        )
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r["price"] for r in results]
        print(f"\nSaved {len(results)} listings to {output} (prices in USD)")
        print(f"  Min: ${min(prices):,} | Max: ${max(prices):,} | Avg: ${sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
