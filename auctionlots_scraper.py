#!/usr/bin/env python3
"""
Auction lot tracker.

Reads the union of all `tracked_lots.lot_url` rows from Supabase, scrapes
each URL for its current state (estimate, current bid, sold price, end
time), and writes everything to public/tracked_lots.json keyed by URL so
the frontend can render the user-specific list by joining its own rows
against this global state file.

Currently supports Antiquorum live-auction lot pages only. Each lot
page embeds a `viewVars = {...};` JSON blob that carries the full
catalog data — no separate API call needed.

Run: python3 auctionlots_scraper.py
Env:
  SUPABASE_URL              — same as the frontend uses
  SUPABASE_SERVICE_KEY      — service-role key (read-only access to
                              tracked_lots is fine; we use it on a
                              limited-scope policy in CI)
Output: public/tracked_lots.json
"""

import json
import os
import re
import sys
import time
from urllib.parse import urlparse

import requests

# eBay tracked-lot scraper uses Browse API via OAuth (see ebay_oauth).
# Import is local to avoid a hard dependency for non-eBay-only runs;
# falls through with a clear error in scrape_ebay_lot if creds missing.
try:
    from ebay_oauth import auth_headers as ebay_auth_headers
except Exception:
    def ebay_auth_headers(force_refresh=False):  # type: ignore
        return None

# Reuse merge.py's FX table so a single source of truth controls every
# currency conversion in the project (listings + auction lots). Falls
# back to a USD-only table if merge can't be imported (shouldn't happen
# in CI but keeps local runs robust).
try:
    from merge import FX  # noqa: E402
except Exception:
    FX = {'USD': 1.0}


def to_usd(amount, currency):
    """Best-effort numeric → USD. Returns None when amount is None/missing."""
    if amount is None or amount == "":
        return None
    try:
        n = float(amount)
    except (TypeError, ValueError):
        return None
    rate = FX.get((currency or "USD").upper(), 1.0)
    return round(n * rate)


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
}

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")


def fetch_tracked_urls():
    """Pull the distinct set of lot_url values from tracked_lots."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("WARNING: Supabase env vars not set — skipping tracked-lot scrape.")
        return []
    url = f"{SUPABASE_URL}/rest/v1/tracked_lots?select=lot_url"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    try:
        r = requests.get(url, headers=headers, timeout=20)
        r.raise_for_status()
        rows = r.json()
        urls = sorted({row.get("lot_url") for row in rows if row.get("lot_url")})
        print(f"Found {len(urls)} unique tracked lot URL(s) in Supabase.")
        return urls
    except Exception as e:
        print(f"ERROR fetching tracked_lots: {e}")
        return []


def scrape_antiquorum_lot(url):
    """Return a dict of fields scraped from one Antiquorum lot page."""
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    html = r.text

    m = re.search(r'viewVars\s*=\s*({.*?});', html, re.DOTALL)
    if not m:
        raise RuntimeError("viewVars block not found")
    data = json.loads(m.group(1))
    lot = data.get("lot") or {}
    auction = lot.get("auction") or {}

    images = lot.get("images") or []
    img_url = lot.get("cover_thumbnail") or (images[0].get("url") if images and isinstance(images[0], dict) else None)

    currency = lot.get("currency_code") or "CHF"
    return {
        "house": "Antiquorum",
        "lot_id": lot.get("row_id"),
        "lot_number": lot.get("lot_number"),
        "title": (lot.get("title") or "").strip(),
        "description": (lot.get("description") or "").replace("<br/>", " ").strip()[:600],
        "currency": currency,
        "estimate_low": lot.get("estimate_low"),
        "estimate_high": lot.get("estimate_high"),
        "starting_price": lot.get("starting_price"),
        "current_bid": lot.get("highest_live_bid"),
        "sold_price": lot.get("sold_price"),
        # USD equivalents — frontend displays "~$X" alongside native amounts.
        # Computed via merge.FX so the same rates apply everywhere.
        "estimate_low_usd":  to_usd(lot.get("estimate_low"),     currency),
        "estimate_high_usd": to_usd(lot.get("estimate_high"),    currency),
        "starting_price_usd":to_usd(lot.get("starting_price"),   currency),
        "current_bid_usd":   to_usd(lot.get("highest_live_bid"), currency),
        "sold_price_usd":    to_usd(lot.get("sold_price"),       currency),
        "status": lot.get("status"),
        "image": img_url,
        "auction_title": auction.get("title"),
        "auction_start": auction.get("time_start"),
        "auction_end": auction.get("effective_end_time") or auction.get("time_start"),
        "auction_url": ("https://live.antiquorum.swiss" + auction.get("_detail_url"))
                       if auction.get("_detail_url") else None,
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def scrape_catalog_antiquorum_lot(url):
    """Return a dict of fields scraped from one catalog.antiquorum.swiss lot.

    catalog.antiquorum.swiss is the *published catalog* surface — used
    before a sale opens for live bidding. live.antiquorum.swiss is the
    interactive platform once bidding is live. Different system,
    different markup. The catalog page is static HTML with RDFa
    microdata (`property="schema:..."` attributes), no Apollo/Next.js
    JSON blob to crack.

    Available fields on the catalog page:
      - <title>: "<watch desc> | <auction name> | <city, date>"
      - schema:priceCurrency content attribute
      - rel="schema:image" resource attribute (S3 URL)
      - <h4>{CCY} {low} - {high}</h4> for the estimate range
      - URL slug: /en/lots/<title-slug>-lot-{auction_id}-{lot_number}

    Bid state (current bid / sold price) lives behind a JS bid widget;
    for upcoming auctions there's nothing to read yet, and once bidding
    is live users would watch via live.antiquorum.swiss anyway.
    Status is therefore always "active" until the lot's auction date
    passes (caller can derive an "ended" view from auction_end if
    needed).
    """
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    html = r.text

    # Page <title>: "<watch> | <auction> | <city, date>"
    raw_title = ""
    title_match = re.search(r"<title>([^<]+)</title>", html)
    if title_match:
        raw_title = re.sub(r"\s+", " ",
                           title_match.group(1).replace("&amp;", "&")).strip()
    parts = [p.strip() for p in raw_title.split(" | ")]
    title = parts[0] if parts else raw_title
    auction_title = parts[1] if len(parts) >= 2 else None
    auction_date_label = parts[2] if len(parts) >= 3 else None

    # Currency: schema:priceCurrency content="CHF"
    currency = "CHF"
    cur_match = re.search(
        r'property="schema:priceCurrency"\s+content="([^"]+)"', html
    )
    if cur_match:
        currency = cur_match.group(1).upper()

    # Image: rel="schema:image" resource="https://...s3..../images/.../medium_NNN.jpg"
    img_url = None
    img_match = re.search(r'rel="schema:image"\s+resource="([^"]+)"', html)
    if img_match:
        img_url = img_match.group(1)

    # Estimate range: <h4>CCY low - high</h4>
    estimate_low = None
    estimate_high = None
    est_match = re.search(
        r"<h4>\s*[A-Z]{3}\s+([\d,]+)\s*-\s*([\d,]+)\s*</h4>", html
    )
    if est_match:
        try:
            estimate_low = int(est_match.group(1).replace(",", ""))
            estimate_high = int(est_match.group(2).replace(",", ""))
        except ValueError:
            pass

    # URL slug: /en/lots/<title-slug>-lot-<auction_id>-<lot_number>
    auction_id = None
    lot_number = None
    slug_match = re.search(r"/en/lots/[^/?#]*?-lot-(\d+)-(\d+)", url)
    if slug_match:
        auction_id = slug_match.group(1)
        lot_number = slug_match.group(2)

    return {
        "house": "Antiquorum",
        "lot_id": f"{auction_id}-{lot_number}" if auction_id and lot_number else None,
        "lot_number": lot_number,
        "title": title,
        "description": "",
        "currency": currency,
        "estimate_low": estimate_low,
        "estimate_high": estimate_high,
        "starting_price": None,
        "current_bid": None,
        "sold_price": None,
        "estimate_low_usd":   to_usd(estimate_low,   currency),
        "estimate_high_usd":  to_usd(estimate_high,  currency),
        "starting_price_usd": None,
        "current_bid_usd":    None,
        "sold_price_usd":     None,
        "status": "active",
        "image": img_url,
        "auction_title": auction_title,
        "auction_start": None,                     # catalog page only carries
        "auction_end":   None,                     # the human-readable "May 9th-10th, 2026"
                                                   # — leaving structured fields empty
                                                   # rather than guessing a parse
        "auction_url":   None,
        "auction_date_label": auction_date_label,  # e.g. "Geneva, May 9th-10th, 2026"
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def scrape_christies_lot(url):
    """Return a dict of fields scraped from one Christie's lot page.

    Christie's renders lot data via inline scripts that assign
    `window.chrComponents.lotHeader_<id> = {...}`. We brace-match the
    JSON object after the assignment and read the same fields used
    for Antiquorum so the frontend can render either with the same
    schema."""
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    html = r.text

    m = re.search(r'window\.chrComponents\.lotHeader_\d+\s*=\s*', html)
    if not m:
        raise RuntimeError("lotHeader assignment not found")
    start = m.end()
    # Manual brace counter — the embedded JSON contains many close-braces
    # so a regex-only approach is too fragile.
    depth = 0
    i = start
    while i < len(html):
        c = html[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                i += 1
                break
        elif c in '"\'':
            q = c
            i += 1
            while i < len(html) and html[i] != q:
                if html[i] == '\\':
                    i += 2
                else:
                    i += 1
        i += 1
    raw = html[start:i]
    data = json.loads(raw).get("data", {})

    lots = data.get("lots") or [{}]
    lot = lots[0]
    sale = data.get("sale") or {}
    assets = lot.get("lot_assets") or []
    img_url = assets[0].get("image_url") if assets else None

    # Currency lives in estimate_txt as the leading token. Examples seen:
    # "CHF 11,000 – CHF 17,000", "$8,000 – $12,000", "HKD 80,000 – HKD 120,000".
    currency = "USD"
    est_txt = (lot.get("estimate_txt") or "").strip()
    cm = re.match(r'(?P<cur>CHF|USD|GBP|EUR|HKD|JPY|CNY|\$|£|€)', est_txt)
    if cm:
        sym = cm.group("cur")
        currency = {"$": "USD", "£": "GBP", "€": "EUR"}.get(sym, sym)

    sold_price = lot.get("price_realised") or None
    if sold_price == 0:
        sold_price = None

    # Title combines primary + secondary so the watch reference comes
    # through (Christie's puts the model + ref on title_secondary_txt).
    title_primary = (lot.get("title_primary_txt") or "").strip()
    title_secondary = (lot.get("title_secondary_txt") or "").strip()

    # Status: Christie's gives is_auction_over on the sale block.
    status = "ended" if sale.get("is_auction_over") else "active"

    return {
        "house": "Christie's",
        "lot_id": lot.get("object_id"),
        "lot_number": lot.get("lot_id_txt"),
        "title": title_primary,
        "description": title_secondary[:600],
        "currency": currency,
        "estimate_low": lot.get("estimate_low"),
        "estimate_high": lot.get("estimate_high"),
        "starting_price": None,
        "current_bid": None,
        "sold_price": sold_price,
        "estimate_low_usd":   to_usd(lot.get("estimate_low"),  currency),
        "estimate_high_usd":  to_usd(lot.get("estimate_high"), currency),
        "starting_price_usd": None,
        "current_bid_usd":    None,
        "sold_price_usd":     to_usd(sold_price,                currency),
        "status": status,
        "image": img_url,
        "auction_title": (sale.get("title_txt") or "").strip(),
        "auction_start": sale.get("start_date"),
        "auction_end":   sale.get("end_date") or sale.get("start_date"),
        "auction_url":   sale.get("url"),
        "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def scrape_sothebys_lot(url):
    """Return a dict of fields scraped from one Sotheby's lot page.

    Sotheby's uses Next.js + Apollo Client. The full lot record lives
    in the `apolloCache` object embedded in `__NEXT_DATA__`, keyed
    `LotV2:<base64>`. Fields are normalised against the same schema we
    use for Antiquorum + Christie's so the frontend renders them with
    the same Card layout."""
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    html = r.text

    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
                  html, re.DOTALL)
    if not m:
        raise RuntimeError("__NEXT_DATA__ not found")
    data = json.loads(m.group(1))
    cache = (data.get("props", {}).get("pageProps", {}).get("apolloCache")
             or {})

    def resolve(ref):
        if isinstance(ref, dict) and "__ref" in ref:
            return cache.get(ref["__ref"], {})
        return ref or {}

    lot_key = next((k for k in cache if k.startswith("LotV2:")), None)
    if not lot_key:
        raise RuntimeError("LotV2 entry not found in Apollo cache")
    lot = cache[lot_key]

    auction = resolve(lot.get("auction"))
    session = resolve(lot.get("session"))
    bid_state = resolve(lot.get("bidState"))
    estimate = resolve(lot.get("estimateV2"))

    # Money sub-objects: {__typename: 'Amount', amount: '60000'}
    def amount_of(obj_ref):
        obj = resolve(obj_ref)
        a = obj.get("amount") if obj else None
        if a in (None, ""):
            return None
        try:
            return int(float(a))
        except (TypeError, ValueError):
            return None

    estimate_low = amount_of(estimate.get("lowEstimate"))
    estimate_high = amount_of(estimate.get("highEstimate"))
    starting_price = amount_of(bid_state.get("startingBidV2"))
    current_bid = amount_of(bid_state.get("currentBidV2"))

    sold_obj = resolve(bid_state.get("sold"))
    is_sold = bool(sold_obj.get("isSold"))
    sold_price = None
    if is_sold:
        premiums = resolve(sold_obj.get("premiums"))
        sold_price = amount_of(premiums.get("finalPriceV2")) if premiums else None

    currency = (auction.get("currency") or auction.get("currencyV2") or "USD").upper()

    # Image: pick the largest rendition of the first media image.
    img_url = None
    for k, v in lot.items():
        if k.startswith("media("):
            media = resolve(v)
            images = media.get("images") or []
            if images:
                first = resolve(images[0])
                renditions = first.get("renditions") or []
                # Prefer Large / ExtraLarge so the Card has decent res.
                ranked = sorted(
                    (resolve(r) for r in renditions),
                    key=lambda r: r.get("width") or 0,
                    reverse=True,
                )
                # Cap at 1024 to avoid huge payloads in the JSON.
                for r in ranked:
                    w = r.get("width") or 0
                    if w <= 1500:
                        img_url = r.get("url")
                        break
                if not img_url and ranked:
                    img_url = ranked[0].get("url")
            break

    # Status: open (= "Opened") → active; closed sessions → ended.
    auction_state = (auction.get("state") or "").lower()
    if is_sold or auction_state in ("closed", "complete", "completed"):
        status = "ended"
    else:
        status = "active"

    # Auction window: scheduledOpeningDate is when the live session
    # starts. Use it as both start and end for one-day live sales (good
    # enough for the countdown UI).
    auction_start = session.get("scheduledOpeningDate") or auction.get("dates", {}).get("acceptsBids")
    auction_end = auction_start
    auction_dates = resolve(auction.get("dates")) if isinstance(auction.get("dates"), dict) else (auction.get("dates") or {})
    if isinstance(auction_dates, dict) and auction_dates.get("closed"):
        auction_end = auction_dates["closed"]

    return {
        "house": "Sotheby's",
        "lot_id": lot.get("lotId"),
        "lot_number": None,                   # Sotheby's lot numbers
                                              # are inside lotNumber → VisibleLotNumber → number
                                              # but format varies; not surfacing for now.
        "title": (lot.get("title") or "").strip(),
        "description": "",                    # description is long HTML;
                                              # the frontend Card doesn't render desc, skipping
        "currency": currency,
        "estimate_low": estimate_low,
        "estimate_high": estimate_high,
        "starting_price": starting_price,
        "current_bid": current_bid,
        "sold_price": sold_price,
        "estimate_low_usd":   to_usd(estimate_low,   currency),
        "estimate_high_usd":  to_usd(estimate_high,  currency),
        "starting_price_usd": to_usd(starting_price, currency),
        "current_bid_usd":    to_usd(current_bid,    currency),
        "sold_price_usd":     to_usd(sold_price,     currency),
        "status": status,
        "image": img_url,
        "auction_title": (auction.get("title") or "").strip(),
        "auction_start": auction_start,
        "auction_end":   auction_end,
        "auction_url":   None,                 # Sotheby's auction URL slug
                                               # isn't in the lot's apolloCache;
                                               # frontend falls back to lot URL
        "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def scrape_phillips_lot(url):
    """Return a dict of fields scraped from one Phillips lot page.

    Phillips ships two parseable surfaces on each lot page:
      1. A clean JSON-LD ``Product`` block: name, sku, description,
         image, brand, offers (price + currency + availability).
      2. A large transit-format / Apollo-style data blob embedded as
         an escaped JSON string in the HTML, carrying the richer
         fields the JSON-LD omits — high estimate, lot number, etc.
         The escape pattern is ``\\\\\"key\\\\\"`` (double-escaped
         because the blob is JSON-encoded inside a JSON string).

    JSON-LD's ``offers.price`` is the LOW estimate, not the current
    bid — Phillips uses the schema.org Product/Offer shape loosely
    here. We fill the high estimate from the inline blob and treat
    the JSON-LD price purely as low_estimate.

    Phillips lot URLs: ``phillips.com/detail/<brand-slug>/<sku>``.

    Availability mapping mirrors the other JSON-LD-based scrapers:
      - SoldOut / OutOfStock → status="ended", offers.price → sold_price
      - InStock / etc        → status="active",  offers.price NOT mapped
                               to current_bid (it's just the low estimate)
    """
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    html = r.text

    # JSON-LD: there are two blocks; the second carries the Product.
    ld_blocks = re.findall(
        r'<script type="application/ld\+json"[^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    product = None
    for raw in ld_blocks:
        try:
            data = json.loads(raw)
        except Exception:
            continue
        nodes = data.get("@graph", [data])
        for node in nodes:
            if isinstance(node, dict) and node.get("@type") == "Product":
                product = node
                break
        if product:
            break
    if not product:
        raise RuntimeError("Phillips Product JSON-LD not found")

    offers = product.get("offers") or {}

    brand_name = ""
    brand = product.get("brand")
    if isinstance(brand, dict):
        brand_name = brand.get("name") or ""

    # Title: JSON-LD `name` is "<brand> - <auction>" (useless). Build
    # a watch-descriptive title by combining brand + description, since
    # Phillips doesn't surface a short-form watch title elsewhere.
    description = (product.get("description") or "").strip()
    if brand_name and description:
        title = f"{brand_name} {description}"
    else:
        title = description or product.get("name") or ""
    # Cap to a reasonable length so the JSON file stays compact —
    # the Card's CSS clamps to 2 lines anyway.
    if len(title) > 240:
        title = title[:237].rstrip() + "…"

    # Auction name: derive from the JSON-LD `name` field which is
    # "<brand> - <auction>". The Card surfaces this via auction_title.
    auction_title = None
    raw_name = product.get("name") or ""
    if " - " in raw_name:
        auction_title = raw_name.split(" - ", 1)[1].strip()

    # Image: Phillips returns an array of strings; pick the first.
    img_url = None
    img_field = product.get("image")
    if isinstance(img_field, list) and img_field:
        img_url = img_field[0]
    elif isinstance(img_field, str):
        img_url = img_field

    currency = (offers.get("priceCurrency") or "CHF").upper()
    try:
        ld_price = (
            int(float(offers.get("price")))
            if offers.get("price") not in (None, "")
            else None
        )
    except (TypeError, ValueError):
        ld_price = None

    availability = (offers.get("availability") or "").rsplit("/", 1)[-1].lower()
    is_ended = availability in {"soldout", "outofstock"}
    status = "ended" if is_ended else "active"

    # JSON-LD price IS the low estimate (verified against the inline
    # blob's `lowEstimate` on the test URL — both = 5000 CHF). Treat
    # it as such rather than as a current bid.
    estimate_low = ld_price

    # High estimate + lot number live in the escaped-JSON inline blob.
    estimate_high = None
    high_match = re.search(r'\\"highEstimate\\",(\d+)', html)
    if high_match:
        try:
            estimate_high = int(high_match.group(1))
        except ValueError:
            pass

    lot_number = None
    lotnum_match = re.search(r'\\"lotNumberFull\\",\\"(\d+)\\"', html)
    if lotnum_match:
        lot_number = lotnum_match.group(1)

    # Currency from the inline blob is more reliable than JSON-LD
    # (JSON-LD sometimes omits currency on multi-currency lots).
    cur_match = re.search(r'\\"currencyCode\\",\\"([A-Z]{3})\\"', html)
    if cur_match:
        currency = cur_match.group(1)

    # For sold lots, JSON-LD price gets overloaded onto sold_price —
    # we don't have access to a live "currentBid" / "hammerPrice" at
    # the granularity Phillips' bid widget uses. Mark's first test
    # URL is upcoming, so this branch is provisional until validated
    # against a sold lot.
    sold_price = ld_price if is_ended else None
    current_bid = None  # Phillips bid widget data isn't in static HTML.

    # Auction window: Phillips' lot detail page embeds session times
    # only via a transit-format graph that's hard to follow without
    # writing a normalizer. Cross-reference the Phillips auction
    # calendar instead — the auction code from the lot's image URL
    # (e.g. ``CH080226``) maps to a row in data/phillips_auctions.csv,
    # and that row carries date_start + date_end. Good enough for the
    # countdown display: "X days left" / once-live "today, ends 6pm".
    auction_start = None
    auction_end = None
    auction_url = None
    auction_code = None
    if img_url:
        code_match = re.search(r"/auction(?:s|-assets)/([A-Z]{2}\d+)", img_url)
        if code_match:
            auction_code = code_match.group(1)
    if auction_code:
        auction_url = f"https://www.phillips.com/auction/{auction_code}"
        cal_path = "data/phillips_auctions.csv"
        if os.path.exists(cal_path):
            try:
                import csv as _csv
                with open(cal_path, encoding="utf-8") as cf:
                    for row in _csv.DictReader(cf):
                        if auction_code in (row.get("url") or ""):
                            auction_start = row.get("date_start") or None
                            auction_end   = row.get("date_end") or row.get("date_start") or None
                            break
            except (OSError, _csv.Error):
                pass

    return {
        "house": "Phillips",
        "lot_id": product.get("sku"),
        "lot_number": lot_number,
        "title": title,
        "description": "",
        "currency": currency,
        "estimate_low": estimate_low,
        "estimate_high": estimate_high,
        "starting_price": None,
        "current_bid": current_bid,
        "sold_price": sold_price,
        "estimate_low_usd":   to_usd(estimate_low,   currency),
        "estimate_high_usd":  to_usd(estimate_high,  currency),
        "starting_price_usd": None,
        "current_bid_usd":    None,
        "sold_price_usd":     to_usd(sold_price,     currency),
        "status": status,
        "image": img_url,
        "auction_title": auction_title,
        "auction_start": auction_start,
        "auction_end":   auction_end,
        "auction_url":   auction_url,
        "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def scrape_monaco_legend_lot(url):
    """Return a dict of fields scraped from one Monaco Legend lot page.

    Monaco Legend ships a single JSON-LD ``<script type="application/ld+json">``
    block with a ``@graph`` array. The ``Product`` node inside that
    array carries everything we need: image, additionalProperty list
    (Brand/Reference/Year/etc), and an ``offers`` sub-object with
    price, currency, validFrom/validThrough, availability, and a
    priceSpecification list with low/high estimates. No Apollo cache,
    no __NEXT_DATA__ — much simpler than Sotheby's.

    Availability mapping:
      - ``schema.org/SoldOut`` / ``OutOfStock`` → status="ended", price → sold_price
      - anything else (InStock / PreOrder / etc) → status="active", price → current_bid
    """
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    html = r.text

    m = re.search(r'<script type="application/ld\+json"[^>]*>(.*?)</script>',
                  html, re.DOTALL)
    if not m:
        raise RuntimeError("JSON-LD block not found")
    data = json.loads(m.group(1))

    # Product node lives inside @graph; fall back to the root if
    # Monaco Legend ever changes shape.
    product = None
    for node in data.get("@graph", [data]):
        if isinstance(node, dict) and node.get("@type") == "Product":
            product = node
            break
    if not product:
        raise RuntimeError("Product node not found in JSON-LD")

    offers = product.get("offers") or {}

    # Estimates live in priceSpecification (one PriceSpecification per
    # bound, named "Low Estimate" / "High Estimate").
    estimate_low = None
    estimate_high = None
    for spec in offers.get("priceSpecification", []) or []:
        if not isinstance(spec, dict):
            continue
        name = (spec.get("name") or "").lower()
        try:
            v = int(float(spec.get("price"))) if spec.get("price") not in (None, "") else None
        except (TypeError, ValueError):
            v = None
        if "low" in name and "estimate" in name:
            estimate_low = v
        elif "high" in name and "estimate" in name:
            estimate_high = v

    # Availability → status + which price field carries the headline.
    availability = (offers.get("availability") or "").rsplit("/", 1)[-1].lower()
    is_ended = availability in {"soldout", "outofstock"}
    status = "ended" if is_ended else "active"

    try:
        price = int(float(offers.get("price"))) if offers.get("price") not in (None, "") else None
    except (TypeError, ValueError):
        price = None

    sold_price = price if is_ended else None
    current_bid = None if is_ended else price
    currency = (offers.get("priceCurrency") or "EUR").upper()

    # Title: the JSON-LD `name` is just "Lot 148" — the rich watch
    # description sits in the page <title>:
    # "Lot 148 - <maker> <description> - <auction> - Monaco Legend Auctions".
    # Strip leading "Lot N -" and trailing house+auction-name segments.
    title = product.get("name") or ""
    page_title_match = re.search(r"<title>([^<]+)</title>", html)
    if page_title_match:
        raw = page_title_match.group(1).strip()
        parts = [p.strip() for p in raw.split(" - ")]
        if len(parts) >= 4:
            # ["Lot 148", "<watch description>", "<auction name>", "Monaco Legend Auctions"]
            title = parts[1]
        elif len(parts) >= 2:
            title = " - ".join(parts[1:-1]) or raw

    # Lot number: pull from the URL slug `/lot-NNN` — JSON-LD `sku` is
    # an internal ID, not the displayed lot number.
    lot_match = re.search(r"/lot-(\d+)", url)
    lot_number = lot_match.group(1) if lot_match else None

    # Auction name + URL: derive from the `/auction/<slug>/lot-NNN`
    # path so the frontend's auction_url link works without a 2nd fetch.
    auction_url = None
    auction_title = None
    auc_match = re.search(r"/auction/([^/]+)/lot-\d+", url)
    if auc_match:
        slug = auc_match.group(1)
        auction_url = f"https://www.monacolegendauctions.com/auction/{slug}"
        # "exclusive-timepieces-40" → "Exclusive Timepieces 40"
        auction_title = " ".join(w.capitalize() for w in slug.split("-"))

    return {
        "house": "Monaco Legend Auctions",
        "lot_id": product.get("sku"),
        "lot_number": lot_number,
        "title": title,
        "description": "",
        "currency": currency,
        "estimate_low": estimate_low,
        "estimate_high": estimate_high,
        "starting_price": None,
        "current_bid": current_bid,
        "sold_price": sold_price,
        "estimate_low_usd":   to_usd(estimate_low,   currency),
        "estimate_high_usd":  to_usd(estimate_high,  currency),
        "starting_price_usd": None,
        "current_bid_usd":    to_usd(current_bid,    currency),
        "sold_price_usd":     to_usd(sold_price,     currency),
        "status": status,
        "image": product.get("image"),
        "auction_title": auction_title,
        "auction_start": offers.get("validFrom"),
        "auction_end":   offers.get("validThrough"),
        "auction_url":   auction_url,
        "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def scrape_ebay_lot(url):
    """Return tracked-lot dict for one eBay item URL, via Browse API.

    Works for both timed auctions and Buy-It-Now items. eBay item
    URLs come in several flavors — canonical (`/itm/<id>`), with a
    title slug (`/itm/some-title-slug/<id>`), regional TLDs
    (ebay.co.uk, ebay.de, ebay.it, ...), with or without `www.`
    Pull the trailing numeric component as the legacy item ID and
    look it up via the Browse API's
    ``/buy/browse/v1/item/get_item_by_legacy_id`` endpoint.

    No-ops with a clear error when EBAY_CLIENT_ID/SECRET aren't
    configured — the caller catches and preserves the prior snapshot.

    Card-shape mapping (matches Antiquorum / Christie's / Sotheby's /
    Monaco Legend / Phillips so the frontend renders identically):
      - Auction (buyingOption AUCTION):  current_bid = currentBidPrice,
        auction_end = itemEndDate.
      - Buy It Now (buyingOption FIXED_PRICE): current_bid = listing
        price (the only "price" eBay surfaces). auction_end remains
        itemEndDate when present, else null.
      - Ended / unavailable (estimatedAvailabilities = OUT_OF_STOCK,
        or itemEndDate < now): status = "ended", sold_price = the last
        observable price.
    """
    headers = ebay_auth_headers()
    if not headers:
        raise RuntimeError(
            "eBay credentials not configured "
            "(EBAY_CLIENT_ID / EBAY_CLIENT_SECRET)"
        )

    # Pull the trailing numeric ID from any of eBay's URL shapes.
    m = re.search(r"/itm/(?:[^/]+/)?(\d{6,})", url)
    if not m:
        raise RuntimeError(f"could not parse eBay item ID from URL: {url}")
    item_id = m.group(1)

    api_url = (
        "https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id"
        f"?legacy_item_id={item_id}"
    )
    r = requests.get(api_url, headers=headers, timeout=30)
    if r.status_code == 401:
        # Token may have expired between cache write and call.
        retry_headers = ebay_auth_headers(force_refresh=True)
        if retry_headers:
            r = requests.get(api_url, headers=retry_headers, timeout=30)
    r.raise_for_status()
    item = r.json()

    title = (item.get("title") or "").strip()

    img_url = None
    if isinstance(item.get("image"), dict):
        img_url = item["image"].get("imageUrl")

    # Price / currency: eBay puts the current asking price in `price`
    # (FIXED_PRICE) or `currentBidPrice` (AUCTION). Pick the one
    # corresponding to the item's primary buying option.
    buying_options = item.get("buyingOptions") or []
    is_auction = "AUCTION" in buying_options
    price_obj = (
        item.get("currentBidPrice")
        if is_auction
        else item.get("price")
    ) or {}

    currency = (price_obj.get("currency") or "USD").upper()
    try:
        raw = price_obj.get("value")
        price = int(round(float(raw))) if raw not in (None, "") else None
    except (TypeError, ValueError):
        price = None

    # Status: ended if eBay says OUT_OF_STOCK or the auction end has
    # already passed. Active otherwise.
    avail = ""
    if isinstance(item.get("estimatedAvailabilities"), list) and item["estimatedAvailabilities"]:
        avail = (item["estimatedAvailabilities"][0]
                 .get("estimatedAvailabilityStatus") or "").upper()
    end_iso = item.get("itemEndDate")
    is_ended = avail == "OUT_OF_STOCK"
    if not is_ended and end_iso:
        try:
            from datetime import datetime as _dt
            if _dt.fromisoformat(end_iso.replace("Z", "+00:00")).timestamp() < time.time():
                is_ended = True
        except (ValueError, TypeError):
            pass

    status = "ended" if is_ended else "active"
    sold_price = price if is_ended else None
    current_bid = None if is_ended else price

    seller = item.get("seller") or {}
    seller_name = seller.get("username")

    return {
        "house":         "eBay",
        "lot_id":        item_id,
        # eBay doesn't have lot numbers; use the seller as a sub-line
        # so the card's "Lot N" slot still carries useful identity.
        # Card render is house-aware: drops the "Lot " prefix for eBay
        # so we get "eBay · windvintage" rather than "eBay · Lot windvintage".
        "lot_number":    seller_name,
        "title":         title,
        "description":   "",
        "currency":      currency,
        "estimate_low":  None,
        "estimate_high": None,
        "starting_price": None,
        "current_bid":   current_bid,
        "sold_price":    sold_price,
        "estimate_low_usd":   None,
        "estimate_high_usd":  None,
        "starting_price_usd": None,
        "current_bid_usd":    to_usd(current_bid, currency),
        "sold_price_usd":     to_usd(sold_price,  currency),
        "status":        status,
        "image":         img_url,
        # auction_title is the human-readable category for the slot;
        # buying_option drives the Card's CURRENT/HAMMER/BUY NOW/SOLD
        # label switch. Both fields needed because the auction_title
        # slot is also used by other houses for the actual auction
        # name ("Important Watches"), and we don't want to overload it.
        "auction_title": "eBay auction" if is_auction else "eBay Buy It Now",
        "buying_option": "AUCTION" if is_auction else "BUY_IT_NOW",
        "auction_start": None,
        "auction_end":   end_iso,
        "auction_url":   None,
        "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def scrape(url):
    """Dispatch by host. Add new auction houses here as scrapers are built."""
    host = urlparse(url).hostname or ""
    # Antiquorum runs two surfaces:
    #   live.antiquorum.swiss    → live-bid platform (Apollo/JSON blob)
    #   catalog.antiquorum.swiss → published catalog (RDFa microdata)
    # Different scrapers, same `house` value so the Card UI stays unified.
    if host == "live.antiquorum.swiss" or host.endswith(".live.antiquorum.swiss"):
        return scrape_antiquorum_lot(url)
    if host == "catalog.antiquorum.swiss" or host.endswith(".catalog.antiquorum.swiss"):
        return scrape_catalog_antiquorum_lot(url)
    if host.endswith("antiquorum.swiss"):
        # Generic fallback for any other antiquorum subdomain — assume
        # the live platform since it's the more common surface today.
        return scrape_antiquorum_lot(url)
    if host.endswith("christies.com"):
        return scrape_christies_lot(url)
    if host.endswith("sothebys.com"):
        return scrape_sothebys_lot(url)
    if host.endswith("monacolegendauctions.com"):
        return scrape_monaco_legend_lot(url)
    if host.endswith("phillips.com"):
        return scrape_phillips_lot(url)
    # eBay regional TLDs all live under ebay.<cc> — match any.
    if host == "ebay.com" or host.endswith(".ebay.com") or ".ebay." in host:
        return scrape_ebay_lot(url)
    raise NotImplementedError(f"No scraper for host: {host}")


def main():
    urls = fetch_tracked_urls()
    output_path = "public/tracked_lots.json"

    # Preserve any existing data so we keep prior snapshots if a fetch fails.
    prev = {}
    if os.path.exists(output_path):
        try:
            with open(output_path) as f:
                prev = json.load(f)
        except Exception:
            prev = {}

    out = {}
    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] {url[:80]}...", end=" ", flush=True)
        try:
            data = scrape(url)
            # Preserve the Vercel Blob cached image URL across re-scrapes.
            # cache_watchlist_images.mjs writes this field after we run;
            # if we let our re-scrape overwrite it, every cron run would
            # re-cache + re-upload. Carrying the field forward keeps the
            # blob stable until the source image actually changes.
            if url in prev and prev[url].get("cached_img_url") is not None:
                data["cached_img_url"] = prev[url]["cached_img_url"]
            out[url] = data
            bid = data.get("sold_price") or data.get("current_bid") or "—"
            print(f"OK ({data.get('status')}, {data.get('currency')} {bid})")
        except Exception as e:
            print(f"ERR: {e}")
            # Keep the previous snapshot rather than dropping the URL entirely
            # — better to show stale than to make a tracked lot vanish.
            if url in prev:
                out[url] = prev[url]
                out[url]["_stale"] = True
        time.sleep(0.5)

    os.makedirs("public", exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(out, f, indent=2, sort_keys=True)
    print(f"Wrote {len(out)} lot(s) to {output_path}")


if __name__ == "__main__":
    main()
