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


def scrape(url):
    """Dispatch by host. Add new auction houses here as scrapers are built."""
    host = urlparse(url).hostname or ""
    if host.endswith("antiquorum.swiss"):
        return scrape_antiquorum_lot(url)
    if host.endswith("christies.com"):
        return scrape_christies_lot(url)
    if host.endswith("sothebys.com"):
        return scrape_sothebys_lot(url)
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
