#!/usr/bin/env python3
"""
Moonphase scraper — sourced via pushers.io's JSON API.

Moonphase (@moonphase.fr on Instagram, based in Paris) doesn't run their
own e-commerce site. Their canonical web presence is pushers.io, a
multi-dealer marketplace for vintage watches that exposes a clean
versioned JSON API at /api/dealers/{handle}.json. Brand, model, price,
state, and images are all structured — much easier than the typical
HTML/Shopify scrape.

This same scraper pattern works for any other dealer hosted on
pushers.io — duplicate, change DEALER_HANDLE + SOURCE_NAME.

Run: python3 moonphase_scraper.py
Output: moonphase_listings.csv
"""
import csv
import re
import time

import requests

DEALER_HANDLE = "moonphase.fr"
SOURCE_NAME = "Moonphase"
PUSHERS_API = "https://pushers.io/api/dealers"
PUSHERS_LISTING_URL = "https://pushers.io/listings"  # /<slug> on the SPA
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


def parse_currency(formatted_price):
    """`formatted_price` looks like 'EUR €7,350' or 'USD $9,200'.
    Pull the 3-letter ISO code so merge.py can FX-convert. Default
    EUR for moonphase since they're France-based."""
    if not formatted_price:
        return "EUR"
    m = re.match(r"^([A-Z]{3})\b", formatted_price)
    return m.group(1) if m else "EUR"


def parse_price(formatted_price):
    """The dealer endpoint returns price as a pre-formatted string like
    'EUR €7,350' or 'USD $9,200' — not the bare number that the per-
    listing endpoint exposes. Strip the prefix and parse the digits.
    Cents (if present) are truncated; watch prices don't need fractional
    precision in this app."""
    if not formatted_price:
        return 0
    m = re.search(r"([\d,]+(?:\.\d+)?)", formatted_price)
    if not m:
        return 0
    digits = m.group(1).replace(",", "")
    try:
        return int(float(digits))
    except (ValueError, TypeError):
        return 0


def parse_listing(item):
    listing_id = item.get("listing_id") or item.get("id") or ""
    slug = item.get("slug") or listing_id
    title = (item.get("model_and_reference") or "").strip()
    brand = (item.get("brand_name") or "").strip()
    price = parse_price(item.get("price") or item.get("formatted_price"))
    # Currency is set per-source in merge.py SOURCES; we don't write it
    # into the CSV. parse_currency stays here in case the upstream API
    # ever returns multi-currency for a single dealer (unlikely but
    # cheap to keep).
    state = (item.get("listing_state") or "").lower()
    sold = state != "available"

    cover = item.get("cover_image") or {}
    img = cover.get("large") or cover.get("thumb") or cover.get("original") or ""

    description = (item.get("description") or "").strip().replace("\n", " ")[:500]
    url = f"{PUSHERS_LISTING_URL}/{slug}"

    return {
        "title": title,
        "brand": brand,
        "price": price,
        "url": url,
        "img": img,
        "description": description,
        "source": SOURCE_NAME,
        "sold": sold,
    }


def get_all_listings():
    out = []
    page = 1
    seen_ids = set()
    while True:
        print(f"Fetching page {page}...")
        r = requests.get(
            f"{PUSHERS_API}/{DEALER_HANDLE}.json",
            headers=HEADERS,
            params={"version": 3, "page": page},
            timeout=20,
        )
        r.raise_for_status()
        data = r.json()
        listings = data.get("listings", []) if isinstance(data, dict) else []
        if not listings:
            break
        new_count = 0
        for item in listings:
            iid = item.get("listing_id") or item.get("id")
            if iid in seen_ids:
                continue
            seen_ids.add(iid)
            out.append(item)
            new_count += 1
        print(f"  Got {new_count} new (total: {len(out)})")
        if new_count == 0:
            break  # paginated past the end
        page += 1
        time.sleep(0.3)
    return out


def main():
    print(f"Fetching {SOURCE_NAME} inventory via pushers.io API...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    results = []
    skipped_sold = skipped_no_price = 0
    for item in raw:
        parsed = parse_listing(item)
        if parsed["price"] == 0:
            skipped_no_price += 1
            continue
        if parsed["sold"]:
            skipped_sold += 1
            continue
        results.append(parsed)

    out_file = f"{SOURCE_NAME.lower()}_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "title", "brand", "price", "url", "img",
            "description", "source", "sold",
        ])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n✓ Saved {len(results)} listings to {out_file}")
    print(f"  Skipped: {skipped_sold} sold, {skipped_no_price} no price")
    if results:
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
