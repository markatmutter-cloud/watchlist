#!/usr/bin/env python3
"""
ClassicHeuer scraper — WooCommerce Store API, EUR.

German vintage chronograph dealer specialising in vintage Heuer with
small Rolex / Omega / Orfina sub-collections. ~117 products today.
Standard /wp-json/wc/store/v1/products endpoint.

Brand quirk: most categories are Heuer model FAMILIES (Carrera,
Autavia, Camaro, Monaco, Skipper, Silverstone, Monza, Montreal,
Calculator, Bundeswehr, Chronosplit, Rallyetimer, "Andere Hersteller")
rather than actual brand names. Only Rolex, Omega, Orfina map to
literal brand. detect_brand() therefore checks (1) the title for any
known brand, then (2) the categories for Rolex/Omega/Orfina, and
defaults to Heuer when neither hits — safe because the dealer's
non-Heuer inventory is small and explicitly category-tagged.

Price quirk: ~98% of items are price-on-request (price=0 from the
API). We emit `priceOnRequest=True` for those so merge.py's
500-floor doesn't drop them.

Sold-detection quirk: the WC Store API returns `is_in_stock: True`
for every product (sold + available alike) — the dealer doesn't
remove sold items from the catalog. The only reliable SOLD signal
is a CSS-class badge rendered on each detail page:
`<div class="badge-container is-larger ..."><div class="badge-inner
... new-bubble">SOLD</div></div>`. The `is-larger` modifier marks
the MAIN product's overlay; smaller variants of the same badge
appear on related-product thumbnails at the bottom of every page,
so we have to anchor on `is-larger` to avoid false-positives.

This forces a per-item detail-page fetch (~117 GETs, ~50s wall
time on cron). Acceptable for a dealer this size; runs 3×/day.

Run: python3 classicheuer_scraper.py
Output: classicheuer_listings.csv
"""
import csv
import html as htmlmod
import re
import time

import requests

BASE = "https://www.classicheuer.de"
API = f"{BASE}/wp-json/wc/store/v1/products"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE}/en/chronographs/",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# Brands the dealer might surface, ordered so longer / more specific
# names match before shorter ones (e.g. "Tag Heuer" before "Heuer").
BRANDS = [
    "Tag Heuer", "Heuer", "Rolex", "Omega", "Orfina",
    "Patek Philippe", "Audemars Piguet", "Vacheron Constantin",
    "Cartier", "IWC", "Jaeger-LeCoultre", "Breitling",
    "Universal Geneve", "Zenith", "Longines", "Tudor",
    "Eberhard", "Movado", "Lemania", "Yema",
]

# Heuer model-family category names. When an item is tagged with one
# of these and nothing in title/categories matches a literal brand,
# we infer Heuer. Lower-cased substring match.
HEUER_FAMILY_CATEGORIES = {
    "carrera", "autavia", "camaro", "monaco", "skipper", "silverstone",
    "monza", "montreal", "calculator", "bundeswehr", "chronosplit",
    "rallyetimer", "stoppuhren", "andere hersteller",
}

# Detail-page SOLD detector. Anchored on the `is-larger` modifier so
# we only catch the MAIN product's overlay, not the smaller SOLD
# badges on related-product thumbnails further down the same page.
#
# The structural distinction (verified against Mark's known-live +
# known-sold URLs):
#
#   LIVE → <div class="badge-container is-larger ...">
#                                                      </div>      (empty container)
#
#   SOLD → <div class="badge-container is-larger ...">
#            <div class="badge ...">
#              <div class="...new-bubble ...">SOLD</div>
#            </div>
#          </div>
#
# The first version of this regex was too loose (`...>.*?>SOLD<` with
# DOTALL) — `.*?` skipped past the empty `</div>` and matched a SOLD
# badge somewhere later on the page, marking ~all 117 items sold.
# The tighter form anchors on the immediate nesting: the is-larger
# container must contain a `<div ...badge...>` which contains a
# `<div ...new-bubble...>SOLD<`. Optional whitespace between layers.
SOLD_BADGE_RE = re.compile(
    r'class="badge-container[^"]*\bis-larger\b[^"]*"[^>]*>\s*'
    r'<div[^>]*\bbadge\b[^>]*>\s*'
    r'<div[^>]*\bnew-bubble\b[^>]*>SOLD<',
    re.S,
)


def detect_brand(name, categories):
    lower = (name or "").lower()
    for b in BRANDS:
        if b.lower() in lower:
            return b
    cat_names = [(c.get("name") or "").lower() for c in (categories or [])]
    for cname in cat_names:
        for b in BRANDS:
            if b.lower() in cname:
                return b
    # Fall through to Heuer if any category looks like a Heuer family.
    if any(any(fam in cname for fam in HEUER_FAMILY_CATEGORIES) for cname in cat_names):
        return "Heuer"
    return "Other"


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&#\d+;", "", text)
    text = re.sub(r"&[a-z]+;", "", text)
    return re.sub(r"\s+", " ", text).strip()


def fetch_page(page, per_page):
    last_err = None
    for attempt in range(3):
        try:
            r = SESSION.get(API, params={
                "per_page": per_page,
                "page": page,
                "status": "publish",
            }, timeout=30)
            if r.status_code == 200:
                return r.json()
            last_err = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            last_err = str(e)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"page {page} failed after 3 attempts: {last_err}")


def get_all_listings():
    all_items = []
    page = 1
    per_page = 100
    while True:
        print(f"Fetching page={page}...")
        items = fetch_page(page, per_page)
        if not items:
            break
        all_items.extend(items)
        print(f"  Got {len(items)} items (total: {len(all_items)})")
        if len(items) < per_page:
            break
        page += 1
        time.sleep(0.5)
    return all_items


def english_url(api_permalink):
    """Rewrite the API's permalink (`/chronographs/<slug>/`) to the
    English-locale variant (`/en/chronographs/<slug>/`).

    The dealer serves DIFFERENT HTML on the two locales, and the
    English version is the canonical one for sold-state purposes.
    Concretely: items already sold get the `is-larger` SOLD overlay
    on the German default page potentially BEFORE it appears on the
    English page (the dealer updates `/chronographs/` first and
    `/en/chronographs/` lags), so the German page is over-eager and
    the English page matches what Mark sees when browsing the site.
    Verified against Mark's manually-curated live + sold URL sets
    on 2026-05-04 (8/8 match using /en/, 0/8 on the German default).

    The rewrite also serves a second purpose: the URL we emit in the
    CSV becomes what the user clicks through to from the card, so it
    should land on the same page Mark used to validate the listing.
    """
    if "/en/chronographs/" in api_permalink:
        return api_permalink
    return api_permalink.replace("/chronographs/", "/en/chronographs/", 1)


def fetch_detail_html(url):
    """Fetch one detail page; return HTML on 200, None on any failure.
    Failures count as "unknown sold state" → we leave `sold` at the
    default rather than guessing. A persistent 404 will eventually
    drop the item via merge.py's "missing from latest scrape →
    mark sold" path."""
    for attempt in range(2):
        try:
            r = SESSION.get(url, timeout=20)
            if r.status_code == 200:
                return r.text
        except requests.RequestException:
            pass
        time.sleep(1 + attempt)
    return None


def is_sold(detail_html):
    """True iff the page renders the main-product SOLD overlay.
    Returns False on None (unknown state) so we don't false-positive
    on transient fetch failures."""
    if not detail_html:
        return False
    return bool(SOLD_BADGE_RE.search(detail_html))


def parse_item(item, detail_html):
    prices = item.get("prices") or {}
    price_raw = prices.get("price", "0") or "0"
    minor = int(prices.get("currency_minor_unit", 2) or 0)
    try:
        price = int(price_raw) // (10 ** minor) if minor else int(price_raw)
    except (ValueError, TypeError):
        price = 0
    price_on_request = price <= 0

    images = item.get("images") or []
    img = images[0].get("src", "") if images else ""

    # Decode HTML entities — WP product names contain &#8220; / &amp;
    # / &#8211; etc. that don't render cleanly in the feed otherwise.
    title = htmlmod.unescape(item.get("name", "") or "")
    return {
        "title": title,
        "brand": detect_brand(title, item.get("categories")),
        "price": price,
        "priceOnRequest": price_on_request,
        "url": item.get("permalink", ""),
        "img": img,
        "description": strip_html(item.get("short_description") or item.get("description") or "")[:500],
        "source": "ClassicHeuer",
        # SOLD comes from the detail-page badge, NOT the API's
        # is_in_stock field (which is True for sold items too — the
        # dealer keeps sold listings live as catalog entries).
        "sold": is_sold(detail_html),
    }


def main():
    print("Fetching ClassicHeuer inventory (WooCommerce Store API)...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    print(f"\nFetching detail pages for SOLD detection ({len(raw)} pages)...")
    results = []
    for i, it in enumerate(raw, 1):
        # Rewrite to English-locale URL: it's both the canonical
        # sold-state page AND what the user should click through
        # to from the card. Patch the API item in-place so parse_item
        # writes the /en/ permalink to the CSV.
        api_url = it.get("permalink", "")
        url = english_url(api_url) if api_url else ""
        if url:
            it = {**it, "permalink": url}
        detail_html = fetch_detail_html(url) if url else None
        row = parse_item(it, detail_html)
        results.append(row)
        if i % 10 == 0 or i == len(raw):
            sold_so_far = sum(1 for r in results if r["sold"])
            print(f"  [{i}/{len(raw)}] sold so far: {sold_so_far}")
        # Light throttle so we don't hammer the dealer's Apache.
        time.sleep(0.25)

    # No price floor — keep POR rows. merge.py honours `priceOnRequest`.
    out_file = "classicheuer_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["title", "brand", "price", "priceOnRequest", "url", "img",
                        "description", "source", "sold"],
        )
        writer.writeheader()
        writer.writerows(results)

    if results:
        priced = [r["price"] for r in results if r["price"] > 0]
        por = sum(1 for r in results if r["priceOnRequest"])
        sold = sum(1 for r in results if r["sold"])
        live = len(results) - sold
        print(f"\n✓ Saved {len(results)} listings to {out_file} (EUR)")
        print(f"  Live: {live}  |  Sold: {sold}")
        if priced:
            print(f"  With price ({len(priced)}): "
                  f"min €{min(priced):,} | max €{max(priced):,} | avg €{sum(priced)//len(priced):,}")
        print(f"  Price-on-request: {por}")
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
