#!/usr/bin/env python3
"""
eBay saved-search scraper.

Reads search definitions from ``data/ebay_searches.json``, calls eBay's
Browse API ``/buy/browse/v1/item_summary/search`` for each, and writes
the merged results to ``ebay_listings.csv`` in the same shape every
other scraper produces (so merge.py picks them up via the SOURCES
table). Buy-It-Now items get sold=False by default; auction-format
items are routed separately into a sibling auctions feed once Mark
turns on the timed-auction sub-tab.

Run: python3 ebay_search_scraper.py
Requires: pip install requests + EBAY_CLIENT_ID / EBAY_CLIENT_SECRET
          environment variables. Without credentials this script no-ops
          (writes an empty CSV) so the pipeline degrades gracefully when
          eBay isn't configured.

Output: ebay_listings.csv

Design notes:
- One search → potentially many countries. The config's ``country``
  field accepts a single ISO-2 code or a list; we issue one API call
  per (search × country) pair and merge.
- Targeted searches only. Mark explicitly does NOT want broad
  "vintage Rolex" sweeps — eBay's volume would drown the curated
  dealer feed. Keep search labels reference-specific.
- Browse API rate limit on the standard tier is 5,000 calls/day.
  At a few searches × a few countries × twice-daily cron, we're well
  under it. No backoff logic needed yet.
"""
import csv
import json
import os
import sys
import time
from pathlib import Path

import requests

from ebay_oauth import auth_headers

SEARCHES_PATH = Path("data/ebay_searches.json")
OUTPUT_CSV = "ebay_listings.csv"

BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
# Limit results per (search × country) so a single noisy keyword can't
# blow out the feed. Targeted searches usually return < 50 anyway.
RESULTS_PER_CALL = 50

# Rough USD conversion for filtering — Browse API returns prices in the
# listing's native currency. We do precise FX conversion downstream in
# merge.py; this is just for the optional min/max_price_usd filter so
# wildly out-of-range items get skipped before they reach the CSV.
APPROX_FX_TO_USD = {
    "USD": 1.0, "GBP": 1.27, "EUR": 1.08, "CHF": 1.13,
    "JPY": 0.0067, "CAD": 0.73, "AUD": 0.66, "HKD": 0.13,
    "SEK": 0.094, "NOK": 0.092, "DKK": 0.145,
}


def _load_searches():
    if not SEARCHES_PATH.exists():
        return []
    try:
        with SEARCHES_PATH.open() as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"  WARN: could not read {SEARCHES_PATH}: {e}", file=sys.stderr)
        return []
    if not isinstance(data, list):
        return []
    # Filter out the example/template entry that ships with the file.
    # Real entries don't carry the `_note` key (callers should strip it
    # when writing real searches).
    return [s for s in data if isinstance(s, dict) and not s.get("_note")]


def _country_list(spec):
    """Accept either a string ISO code or a list. Normalize to list."""
    if isinstance(spec, list):
        return [c.strip().upper() for c in spec if c]
    if isinstance(spec, str) and spec.strip():
        return [spec.strip().upper()]
    return [None]  # No country filter at all


def _filter_url(country, seller=None):
    """Browse API ``filter`` parameter. We always ask for buyingOptions
    that map to "watch this listing" — fixed-price (Buy-It-Now) and
    auction. Narrow to a single country when supplied. When seller is
    set, also restrict to that seller's listings — useful for tracking
    a curated dealer's whole eBay store."""
    parts = ["buyingOptions:{FIXED_PRICE|AUCTION}"]
    if country:
        parts.append(f"itemLocationCountry:{country}")
    if seller:
        # Browse API expects sellers in {seller1|seller2|...} form.
        parts.append(f"sellers:{{{seller}}}")
    return ",".join(parts)


def _approx_usd(price_value, currency):
    rate = APPROX_FX_TO_USD.get((currency or "USD").upper())
    if rate is None or price_value in (None, ""):
        return None
    try:
        return float(price_value) * rate
    except (TypeError, ValueError):
        return None


def _row_for(item, search):
    """Map one Browse API item summary to our CSV row shape. We
    deliberately mirror the dealer-scraper schema: title, brand, price,
    url, img, description, source, date, sold. merge.py handles
    everything downstream identically. Sold/auction split happens at
    write-time (Buy-It-Now → listings, AUCTION → future auctions feed).
    """
    title = (item.get("title") or "").strip()
    item_url = item.get("itemWebUrl") or ""
    image = ""
    if isinstance(item.get("image"), dict):
        image = item["image"].get("imageUrl") or ""
    price_obj = item.get("price") or {}
    price_value = price_obj.get("value")
    currency = (price_obj.get("currency") or "USD").upper()

    try:
        price = int(round(float(price_value))) if price_value not in (None, "") else 0
    except (TypeError, ValueError):
        price = 0

    # Brand: prefer the structured brand field when present (eBay's
    # item summaries can carry it from listing aspects). Otherwise the
    # title-derived merge.py detect_brand will populate it.
    brand = ""
    for prop in (item.get("additionalImages") or []):
        # No-op; placeholder if we ever want extra image scanning.
        pass
    # eBay's item summary doesn't expose `brand` directly on the search
    # endpoint — it's on the item-detail endpoint. Leave brand blank
    # and let merge.py infer from title.

    return {
        "title": title,
        "brand": brand,
        "price": price,
        "currency": currency,
        "url": item_url,
        "img": image,
        "description": "",
        "source": "eBay",
        "date": time.strftime("%Y-%m-%d"),
        "sold": "False",
        "_buying_option": (item.get("buyingOptions") or [None])[0] or "",
        "_search_label": search.get("label", ""),
    }


def _run_search(search, country, headers):
    query = (search.get("query") or "").strip()
    seller = (search.get("seller") or "").strip() or None
    # eBay's Wristwatches category — narrows results to watches and
    # filters out parts/accessories/random non-watch noise that might
    # match a keyword by accident. Override on a per-search basis via
    # the `category` field if needed (e.g. parts, tools, ephemera).
    category = str(search.get("category") or "31387").strip()
    params = {
        "limit": RESULTS_PER_CALL,
        "filter": _filter_url(country, seller=seller),
        "category_ids": category,
    }
    if query:
        params["q"] = query
    elif not seller:
        # Neither query nor seller — skip silently. Empty config row.
        return []
    # When seller-only with no query, category_ids alone satisfies the
    # API's "must have q OR category_ids" requirement. (Already in
    # params above.)
    r = requests.get(BROWSE_URL, headers=headers, params=params, timeout=30)
    if r.status_code == 401:
        # Force a token refresh once on 401 — token may have expired
        # between cache write and call.
        from ebay_oauth import auth_headers as _refresh
        new_headers = _refresh(force_refresh=True)
        if new_headers:
            r = requests.get(BROWSE_URL, headers=new_headers, params=params, timeout=30)
    r.raise_for_status()
    payload = r.json()
    return payload.get("itemSummaries") or []


def _within_price_filter(usd_value, search):
    if usd_value is None:
        return True
    lo = search.get("min_price_usd")
    hi = search.get("max_price_usd")
    if lo is not None and usd_value < lo:
        return False
    if hi is not None and usd_value > hi:
        return False
    return True


def main():
    searches = _load_searches()
    if not searches:
        print(f"No searches in {SEARCHES_PATH} — writing empty CSV.")
        _write_csv([])
        return

    headers = auth_headers()
    if not headers:
        print("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set — writing empty CSV.")
        _write_csv([])
        return

    rows = []
    seen_urls = set()  # Same eBay item across different searches → dedupe.
    for search in searches:
        label = search.get("label", "(unlabelled)")
        countries = _country_list(search.get("country"))
        for country in countries:
            tag = f"{label} | {country or 'any'}"
            try:
                items = _run_search(search, country, headers)
            except requests.RequestException as e:
                print(f"  ERR ({tag}): {e}")
                continue
            kept = 0
            for it in items:
                url = it.get("itemWebUrl") or ""
                if not url or url in seen_urls:
                    continue
                row = _row_for(it, search)
                usd = _approx_usd(row["price"], row["currency"])
                if not _within_price_filter(usd, search):
                    continue
                seen_urls.add(url)
                rows.append(row)
                kept += 1
            print(f"  {tag}: {len(items)} returned, {kept} kept")
        # Tiny pause between distinct searches to be polite to the
        # Browse API — well under the 5,000/day limit but easy on
        # the rate-limit signal.
        time.sleep(0.3)

    _write_csv(rows)
    print(f"\n✓ Wrote {len(rows)} eBay row(s) to {OUTPUT_CSV}")


def _write_csv(rows):
    fieldnames = [
        "title", "brand", "price", "currency", "url", "img",
        "description", "source", "date", "sold",
        "_buying_option", "_search_label",
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    main()
