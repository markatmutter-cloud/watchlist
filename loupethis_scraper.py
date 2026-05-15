#!/usr/bin/env python3
"""Loupe This auction scraper.

Walks https://api.loupethis.com/api/v1/auctions and writes
public/loupethis_lots.json keyed by full lot URL.

Loupe This is structurally different from the houses handled by
auction_lots_scraper.py:
- No catalog "sales" — each watch IS its own auction (one lot per
  auction). Closer to eBay than to Christie's.
- The site exposes a clean JSON:API endpoint that returns all
  active + closed lots paginated 25 at a time.
- Brand UUIDs in relationships.brand.data.id resolve via
  /api/v1/brands (196 brands, single fetch).

Because there's no "sale" to walk, we don't fit into
auction_lots_scraper.py's read-from-auctions.json loop. We also
don't co-locate output with auction_lots.json: that file is
rebuilt fresh on every comprehensive sweep, and a Loupe This lot
sitting in the prior file would be dropped if it doesn't carry a
realised sold_price (sold-lot persistence only). Standalone file
+ standalone state in App.js keeps the two pipelines independent.

Output shape mirrors auction_lots.json items so App.js's existing
auctionLotItems projection can fold them in with no per-source
branching. is_excluded_title is reused from auction_lots_scraper
so pocket watches / clocks / loose dials get filtered the same way.

Persistence policy matches the main scraper: any URL in the prior
file that's no longer in the current scrape but carries a
sold_price is kept (sold lots are kept permanently — Mark spec
2026-05-11).
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import quote

import requests

# Reuse the shared exclusion predicate so pocket watches / clocks /
# loose dials get filtered identically across every auction source.
from auction_lots_scraper import is_excluded_title


API_BASE = "https://api.loupethis.com/api/v1"
SITE_BASE = "https://loupethis.com"
HOUSE = "Loupe This"
CURRENCY = "USD"
OUTPUT_JSON = "public/loupethis_lots.json"

PAGE_SIZE = 25
PAGE_SLEEP_SECONDS = 0.4
HTTP_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_BACKOFF = 2.0

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Origin": SITE_BASE,
    "Referer": SITE_BASE + "/auctions",
}


def _get_json(url, attempt=1):
    try:
        r = requests.get(url, headers=HEADERS, timeout=HTTP_TIMEOUT)
        if r.status_code == 200:
            return r.json()
        # 5xx — retry with backoff. Loupe This 500s briefly when the
        # page=size combo isn't supported, which we don't probe at
        # runtime; but a transient 500 on the default size is a real
        # rate-limit signal.
        if r.status_code >= 500 and attempt < MAX_RETRIES:
            time.sleep(RETRY_BACKOFF * attempt)
            return _get_json(url, attempt + 1)
        print(f"  warn: {url} → HTTP {r.status_code}", file=sys.stderr)
        return None
    except requests.RequestException as e:
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_BACKOFF * attempt)
            return _get_json(url, attempt + 1)
        print(f"  warn: {url} → {e}", file=sys.stderr)
        return None


def fetch_brands():
    """Single fetch — 196 brands, no pagination on this endpoint."""
    payload = _get_json(f"{API_BASE}/brands")
    if not payload or not isinstance(payload, dict):
        return {}
    out = {}
    for row in payload.get("data") or []:
        bid = row.get("id")
        name = ((row.get("attributes") or {}).get("name") or "").strip()
        if bid and name:
            out[bid] = name
    return out


def _cents_to_dollars(cents):
    """Loupe This stores prices as integer cents. Convert to dollars
    (rounded to the nearest dollar — we don't surface cents anywhere)."""
    if cents is None:
        return None
    try:
        return round(int(cents) / 100)
    except (TypeError, ValueError):
        return None


def _iso_date(ts):
    """'2026-05-29T16:35:00.000Z' → '2026-05-29T16:35:00Z'.

    Keep the time-of-day component so App.js's reverse-direction
    override only triggers after the actual end time. Date-only
    strings resolve to 00:00 UTC which would false-positive the
    whole day."""
    if not ts:
        return None
    # Normalise to a stable ISO form — strip milliseconds and
    # convert any timezone offset to Z.
    try:
        # Python 3.11+ handles 'Z' directly; older 3.x needs +00:00.
        cleaned = ts.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except (ValueError, TypeError):
        return ts


def project_lot(lot, brand_map, now_iso):
    """Convert a JSON:API auction row into the auction_lots.json shape."""
    attrs = lot.get("attributes") or {}
    rels = lot.get("relationships") or {}
    slug = attrs.get("slug")
    if not slug:
        return None
    # Drop lots that the public site hasn't published yet. The API
    # returns the full pipeline (starts_at up to ~14 days out); the
    # web UI only renders lots whose start time has passed. Detail
    # pages for not-yet-started lots return a 200 but render
    # "Looks like something went wrong" — bad click-throughs from
    # our cards. Mark report 2026-05-15.
    starts_at_raw = attrs.get("starts_at")
    if starts_at_raw and starts_at_raw > now_iso:
        return None

    # Older listings (~2022) carry slugs with raw spaces / uppercase
    # ("Audemars Piguet Royal Oak 4100ST"). The site serves them at
    # the URL-encoded path, so encode at construction time. `safe="/"`
    # is the default but we don't want anything else preserved —
    # spaces, capitals, accents must encode for the dealer link to
    # work when a user taps through from a card.
    url = f"{SITE_BASE}/auctions/{quote(slug, safe='-_~.')}"

    title = (attrs.get("title") or "").strip()
    if is_excluded_title(title):
        return None

    brand_id = ((rels.get("brand") or {}).get("data") or {}).get("id")
    brand_name = brand_map.get(brand_id) if brand_id else None

    sold_dollars = _cents_to_dollars(attrs.get("sold_price_cents"))
    bid_dollars = _cents_to_dollars(attrs.get("current_bid_price_cents"))
    # On Loupe This, current_bid_price_cents stays at 0 for fresh
    # listings; treat 0 as "no bid yet" so the card doesn't render
    # a $0 price.
    if bid_dollars == 0:
        bid_dollars = None

    is_closed = bool(attrs.get("is_closed"))
    # The "ended" status is what App.js uses to bucket lots into
    # Archive Sold. A realised sold_price is the unambiguous signal;
    # is_closed without a sale is a pass / no-sale.
    status = "ended" if (is_closed or sold_dollars is not None) else "live"

    starts_at = _iso_date(attrs.get("starts_at"))
    ends_at = _iso_date(attrs.get("ends_at"))

    return url, {
        "auction_date_label": None,
        "auction_end": ends_at,
        "auction_start": starts_at,
        # No catalog sale — Loupe This auctions are one-watch
        # standalones. The auction_title here is the listing title
        # itself, which keeps the lot card meaningful when grouped
        # by sale in any future surface.
        "auction_title": title,
        "auction_url": url,
        "currency": CURRENCY,
        "current_bid": bid_dollars,
        "current_bid_usd": bid_dollars,
        "description": "",
        "estimate_high": None,
        "estimate_high_usd": None,
        "estimate_low": None,
        "estimate_low_usd": None,
        "house": HOUSE,
        "image": attrs.get("featured_image_url") or "",
        "lot_id": slug,
        # The "lot" attribute on Loupe This is a site-wide running
        # counter (e.g. "4833") — keep it for completeness but it
        # isn't a per-sale lot number in the traditional sense.
        "lot_number": str(attrs.get("lot")) if attrs.get("lot") is not None else None,
        "scraped_at": now_iso,
        "sold_price": sold_dollars,
        "sold_price_usd": sold_dollars,
        "starting_price": None,
        "starting_price_usd": None,
        "status": status,
        "title": title,
        # Brand is recorded explicitly here so detectAuctionLotBrand
        # on the frontend has a strong signal. Most Loupe This titles
        # start with the brand name, but the API tells us authoritatively.
        "maker": brand_name,
        "brand": brand_name,
    }


def scrape_all_lots(brand_map):
    """Walk every page of /api/v1/auctions. Sorted ends_at_asc puts
    upcoming lots first (negative time-from-now ascending), then
    closed lots in reverse-chronological. No filter param — we want
    everything in one pass."""
    out = {}
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    page = 1
    total_pages = None

    while True:
        # The JSON:API bracket form (page[number]=N&page[size]=N) that
        # the site itself uses 500s server-side on this endpoint —
        # something on the API side mishandles the array-style key
        # encoding. The flat `?page=N` form is treated as
        # page[number]=N with default page size (25) and works for
        # every page. Don't reach for the bracket form again without
        # re-probing.
        url = f"{API_BASE}/auctions?sortBy=ends_at_asc&page={page}"
        payload = _get_json(url)
        if not payload or not isinstance(payload, dict):
            print(f"  warn: page {page} returned no payload — stopping", file=sys.stderr)
            break
        data = payload.get("data") or []
        meta = (payload.get("meta") or {}).get("pagination") or {}
        if total_pages is None:
            total_pages = meta.get("total_pages") or 1
            total_count = meta.get("total_count") or 0
            print(f"Loupe This: {total_count} lots across {total_pages} pages")
        kept = 0
        excluded = 0
        for row in data:
            projected = project_lot(row, brand_map, now_iso)
            if projected is None:
                excluded += 1
                continue
            url_key, lot_data = projected
            out[url_key] = lot_data
            kept += 1
        print(f"  page {page}/{total_pages}: kept {kept}, excluded {excluded}")
        if page >= total_pages:
            break
        page += 1
        time.sleep(PAGE_SLEEP_SECONDS)
    return out


def load_prior():
    if not os.path.exists(OUTPUT_JSON):
        return {}
    try:
        with open(OUTPUT_JSON) as f:
            prior = json.load(f) or {}
        if not isinstance(prior, dict):
            return {}
        return prior
    except Exception as e:
        print(f"  warn: couldn't read existing {OUTPUT_JSON}: {e}", file=sys.stderr)
        return {}


def main():
    print(f"Fetching brands from {API_BASE}/brands …")
    brand_map = fetch_brands()
    print(f"  {len(brand_map)} brands resolved")

    out = scrape_all_lots(brand_map)
    print(f"\nFresh scrape: {len(out)} lots")

    # Persist historical sold lots permanently (Mark spec 2026-05-11:
    # "I want auction sales to be kept with price permanently"). Same
    # policy as auction_lots_scraper.py. Without this, a Loupe This lot
    # that drops off the API (it shouldn't, but defensively) would lose
    # its realised sold_price forever.
    prior = load_prior()
    persisted = 0
    for url, data in prior.items():
        if url in out:
            continue
        sp = data.get("sold_price") if isinstance(data, dict) else None
        if sp is None or sp == 0:
            continue
        out[url] = data
        persisted += 1
    if persisted:
        print(f"Persisted {persisted} historical sold lot(s) not in the current scrape")

    print(f"\nTotal lots: {len(out)}")
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
