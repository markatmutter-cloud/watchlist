#!/usr/bin/env python3
"""
Heuertime scraper — Wix Pages detail walker, EUR.

Small Dutch vintage Heuer specialist (Abel Court). The site is a
Wix Pages build with NO Wix Stores backend — every watch lives on
its own hand-built page, and the homepage links to all of them.
URL slugs all start with `kopie-van-` (Dutch "copy of") because
each page was duplicated from a master template.

Strategy mirrors vintagewatchshop_scraper:
  1. Fetch homepage; extract every distinct `kopie-van-X` URL,
     including the `kopie-van-template-for-watches-N` slugs — those
     look like placeholders but are actually real watches in
     misleading slots (verified 2026-05-04).
  2. For each, fetch the detail page and parse:
       - title  → first <title> tag (the URL slug doesn't reflect the
         current watch — the dealer reuses pages and only updates the
         page title + body)
       - price  → free text after the "PRICE</span></p>" rich-text
         label. Either "On Request" or "X.XXX euro" (Dutch decimal
         convention). POR rows emit price=0 + priceOnRequest=True.
       - image  → first wixstatic media URL whose account ID matches
         the dealer's media folder (skip the generic OG default).
       - sold   → not detectable from the active home page (the dealer
         moves sold items to /sold rather than tagging them); the
         rotation is handled by merge.py's "missing from latest scrape
         → mark sold" logic.

~25 active watches today; cheap to scrape (one homepage + ~25 detail
pages, ~15s wall time).

Run: python3 heuertime_scraper.py
Output: heuertime_listings.csv
"""
import csv
import html as htmlmod
import re
import time

import requests

BASE = "https://www.heuertime.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

BRANDS = [
    "Tag Heuer", "Heuer", "Rolex", "Omega", "Patek Philippe",
    "Audemars Piguet", "Vacheron Constantin", "Cartier",
    "IWC", "Jaeger-LeCoultre", "Breitling", "Universal Geneve",
    "Zenith", "Longines", "Tudor", "Eberhard", "Movado",
    "Lemania", "Lejour", "Gigandet",
]


def detect_brand(title):
    lower = (title or "").lower()
    for b in BRANDS:
        if b.lower() in lower:
            return b
    return "Other"


def fetch(url, timeout=25):
    last_err = None
    for attempt in range(3):
        try:
            r = SESSION.get(url, timeout=timeout)
            if r.status_code == 200:
                return r.text
            last_err = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            last_err = str(e)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"{url} failed after 3 attempts: {last_err}")


def discover_urls(home_html):
    """Distinct watch detail URLs from homepage.

    Heuertime's URL slugs are misleading: pages named
    `kopie-van-template-for-watches-N` look like leftover scaffolding
    but are actually real watches the dealer published into a
    template-named slot (e.g. CHARLES NICOLET TRAMELAN, JLC TRAVEL
    CLOCK, GIGANDET ROSE GOLD CHRONOGRAPH, JACQUES MONNAT). On
    2026-05-04 we removed the `template-for-watches` exclusion that
    was dropping those four — bringing the count from 20 → 24,
    matching what Mark counts on the site. If a real placeholder
    page ever surfaces, its title will be empty/generic and Mark can
    hide it from the feed via the Card "..." menu."""
    urls = set(re.findall(r'href="(https://www\.heuertime\.com/kopie-van-[a-z0-9-]+)"', home_html))
    return sorted(urls)


# Image extraction: pull the COLOR tile thumbnail from the HOMEPAGE,
# not from each detail page.
#
# Why not detail pages: every detail page renders a small B&W banner
# image at the top via a bare `<img src="...">` tag, and a fuller
# color gallery below via `<picture><source srcSet="...">`. A naive
# "first wixstatic URL" picker hits the banner. A "first <source
# srcSet>" picker works locally but Wix's edge serves a different
# SSR variant to the GitHub Actions runner where the gallery markup
# isn't present — so the scraper still falls through to the banner.
# The homepage tile is rendered server-side consistently and gives
# us the exact thumbnail Mark sees on the dealer's site, which is
# what should appear on the card.
#
# HOMEPAGE_TILE_RE matches each `<a href="<detail-url>"... <img
# srcSet="<wixstatic-url>">` pair. The tile structure is consistent
# across the homepage gallery and we extract one image per detail URL
# in a single fetch. Detail pages are still walked for title + price,
# but their images are no longer used.
HOMEPAGE_TILE_RE = re.compile(
    r'href="(https://www\.heuertime\.com/kopie-van-[a-z0-9-]+)"'
    r'[^<]{0,200}<img[^>]*srcSet="'
    r'(https://static\.wixstatic\.com/media/[a-zA-Z0-9_]+~mv2\.(?:jpg|jpeg|png|webp))',
    re.I,
)


def parse_price(price_text):
    """Returns (price_int_or_0, price_on_request_bool).

    Heuertime uses Dutch / European number formatting — "1.950 euro"
    means 1,950 euro (period is the thousands separator). "On Request"
    is a literal label for POR items.
    """
    txt = (price_text or "").strip().lower()
    if not txt:
        return (0, True)
    if "on request" in txt or "on aanvraag" in txt or "request" in txt:
        return (0, True)
    # Dutch thousand-separator: 1.950 / 12.500
    m = re.search(r"(\d{1,3}(?:\.\d{3})+|\d{3,6})\s*(?:euro|eur|€)", txt)
    if m:
        return (int(m.group(1).replace(".", "")), False)
    # Last-ditch: any standalone number followed by euro
    m = re.search(r"(\d+)\s*(?:euro|eur|€)", txt)
    if m:
        return (int(m.group(1)), False)
    return (0, True)


def extract_tile_images(home_html):
    """Build a {detail_url: image_url} map from the homepage gallery.

    The homepage renders each watch as `<a href="<detail-url>"><img
    srcSet="<color-thumbnail-url>"...>`. One regex sweep picks up
    every (URL, image) pair in a single pass."""
    mapping = {}
    for m in HOMEPAGE_TILE_RE.finditer(home_html):
        detail = m.group(1)
        # Note: do NOT filter "template-for-watches" URLs here —
        # see discover_urls' docstring; those slugs hold real watches.
        if detail not in mapping:
            mapping[detail] = m.group(2)
    return mapping


def parse_item(url, html, tile_img):
    title_m = re.search(r"<title>([^<]+)</title>", html)
    title = title_m.group(1).strip() if title_m else ""
    # Strip the " | Heuertime" site suffix.
    title = re.sub(r"\s*\|\s*Heuertime\s*$", "", title, flags=re.I).strip()
    # Decode HTML entities (&quot;, &amp;, &#39;) so titles read clean
    # in the feed instead of "AUTAVIA 1163 &quot;ORANGE BOY&quot;".
    title = htmlmod.unescape(title)

    # Price — pull the rich-text block right after the "PRICE" label.
    price_block = ""
    pm = re.search(r"PRICE</span></p>(.{0,1500})", html, flags=re.I | re.S)
    if pm:
        flat = re.sub(r"<[^>]+>", " ", pm.group(1))
        flat = re.sub(r"\s+", " ", flat).strip()
        # The price text ends right before the next section label
        # ("DESCRIPTION", "INQUIRE", or another rich-text region).
        # Trim aggressively to the first 60 chars to keep noise out
        # of the parser.
        price_block = flat[:60]
    price, por = parse_price(price_block)

    return {
        "title": title,
        "brand": detect_brand(title),
        "price": price,
        "priceOnRequest": por,
        "url": url,
        "img": tile_img or "",
        "description": "",
        "source": "Heuertime",
        "sold": False,
    }


def main():
    print("Fetching Heuertime homepage...")
    home = fetch(BASE)
    urls = discover_urls(home)
    tile_images = extract_tile_images(home)
    print(f"Found {len(urls)} watch URLs ({len(tile_images)} with tile images)")

    results = []
    for i, u in enumerate(urls, 1):
        try:
            html = fetch(u)
            row = parse_item(u, html, tile_images.get(u, ""))
            if not row["title"]:
                print(f"  [{i}/{len(urls)}] SKIP (no title): {u}")
                continue
            results.append(row)
            price_str = "POR" if row["priceOnRequest"] else f"€{row['price']:,}"
            print(f"  [{i}/{len(urls)}] {row['title'][:55]:<55}  {price_str:<8}  {row['brand']}")
        except Exception as e:
            print(f"  [{i}/{len(urls)}] FAIL {u}: {e}")
        time.sleep(0.4)

    out_file = "heuertime_listings.csv"
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
        print(f"\n✓ Saved {len(results)} listings to {out_file} (EUR)")
        if priced:
            print(f"  With price ({len(priced)}): "
                  f"min €{min(priced):,} | max €{max(priced):,} | avg €{sum(priced)//len(priced):,}")
        print(f"  Price-on-request: {por}")
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
