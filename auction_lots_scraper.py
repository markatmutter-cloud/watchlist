#!/usr/bin/env python3
"""
Comprehensive auction-lot scraper.

Reads `public/auctions.json` (the calendar of upcoming + currently-live
auction-house sales, populated by the per-house calendar scrapers)
and walks every lot in every sale that's within the active window
and whose URL points at a real catalog (not a generic landing page).

For each lot, scrapes title / estimate / image / status, applies a
PW/clocks/dials category filter, and writes the union to
`public/auction_lots.json` keyed by full lot URL — same shape as
`public/tracked_lots.json` so the frontend can read both files into
the unified feed without a new code path.

Per-house enumeration:
  Antiquorum → catalog page, regex over /en/lots/...-lot-NNN-NNN URLs
               (currently capped at one page since pagination 301s
               back to /lots; revisit when antiquorum's catalog
               server stops stripping ?page=N)
  Christie's → window.chrComponents.lots.data.lots inline JSON
               (full per-lot data, no per-lot fetch needed)
  Sotheby's  → __NEXT_DATA__.props.pageProps.algoliaJson.hits
               (paginates via &page=N URL param, ~48 hits/page)
  Phillips   → seldon-object-tile data-testid attributes give lot URLs;
               per-lot fetch via scrape_phillips_lot for title/price.
               Capped at PHILLIPS_LOTS_PER_SALE/sale to bound CI time.

Houses we skip (lot-level scraping not viable today):
  Bonhams        — Cloudflare blocks `requests`
  Monaco Legend  — SPA, no server-rendered lot list
  Heritage       — DataDome at TLS layer

Run: python3 auction_lots_scraper.py
Output: public/auction_lots.json
"""

import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta

import requests

# Reuse the per-lot detail scrapers and currency conversion from the
# user-tracked-lot pipeline. Same data shape comes back, so the JSON
# we emit is interchangeable with public/tracked_lots.json.
from auctionlots_scraper import (
    scrape_catalog_antiquorum_lot,
    scrape_phillips_lot,
    to_usd,
    HEADERS as LOT_HEADERS,
)


# Politeness delay between detail-page fetches inside one sale, to
# avoid hammering Phillips with 50 concurrent reqs from CI.
PER_LOT_SLEEP_SECONDS = 0.6

# Per-sale lot cap for Phillips (where each lot needs its own HTTP
# fetch). Other houses inline lot data on the auction page so no cap
# is needed there. 60 keeps a single Phillips sale under ~1 minute of
# scrape time and keeps the CI run bounded as we add more sales.
PHILLIPS_LOTS_PER_SALE = 60

# Date window for which sales we attempt to scrape:
#   end >= today - RECENT_SOLD_WINDOW_DAYS (so recently closed sales
#     stay scrape-able for the "recently sold" bucket in the unified
#     feed's blend sort)
#   start <= today + UPCOMING_WINDOW_DAYS (don't try catalogs too far
#     out — most haven't been published yet)
RECENT_SOLD_WINDOW_DAYS = 30
UPCOMING_WINDOW_DAYS = 90

# HTTP headers for the catalog/auction page fetches. Same UA the
# per-house calendar scrapers use; no Accept-language pinning needed
# since the URLs are locale-agnostic for these houses.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/132.0.0.0 Safari/537.36",
    "Accept": "*/*",
}

AUCTIONS_JSON = "public/auctions.json"
OUTPUT_JSON = "public/auction_lots.json"


# ── Category exclusion ───────────────────────────────────────────────────
# Per Mark 2026-05-04: filter ONLY pocket watches, clocks, and loose
# dials. KEEP every other accessory category (boxes, hats, original
# adverts, equipment, watch parts other than dials). Title-based regex
# since auction houses categorise differently — title is the lowest
# common denominator.
EXCLUDE_PATTERNS = [
    # Pocket variants — bare \bpocket\b in a lot title is virtually
    # always a pocket watch. The shape catches "pocket watch", "pocket
    # chronometer", "openface ... pocket with enamel dial", and so on
    # in one regex. False-positive surface in auction lot titles is
    # negligible (titles don't say "in pocket condition" or similar).
    re.compile(r"\bpocket\b", re.IGNORECASE),
    # Clocks: catch table/wall/mantel/marine/carriage/desk/skeleton/grand
    # variants and bare "clock" in title. The watch-model false-positive
    # surface is small (no major brand has "clock" in a model name we
    # carry), so a bare \bclock\b is safe.
    re.compile(r"\b(?:table|wall|mantel|mantle|marine|carriage|desk|skeleton|grand|bracket)?\s*clock\b", re.IGNORECASE),
    # Dials: title pattern like "Dial - <brand>" or starts with "Dial"
    # or explicit "loose dial" / "set of dials". Doesn't catch ordinary
    # watches that mention their dial colour ("black-dial Daytona").
    re.compile(r"^\s*dial(?:s)?\s*[\.\-:,]", re.IGNORECASE),
    re.compile(r"\bloose\s*dial", re.IGNORECASE),
    re.compile(r"\bset\s+of\s+dials?\b", re.IGNORECASE),
]


def is_excluded_title(title):
    """True iff the lot title indicates pocket watch / clock / loose dial."""
    if not title:
        return False
    for pat in EXCLUDE_PATTERNS:
        if pat.search(title):
            return True
    return False


# ── Date window helper ───────────────────────────────────────────────────
def in_active_window(sale, today=None):
    """Should this sale be scraped now?

    Returns True when the sale's end is recent enough that recently-
    sold lots are still useful AND the start is close enough that the
    catalog has plausibly been published.
    """
    today = today or date.today()
    de = sale.get("dateEnd") or sale.get("dateStart") or ""
    ds = sale.get("dateStart") or sale.get("dateEnd") or ""
    try:
        d_end = datetime.fromisoformat(de[:10]).date()
    except (ValueError, TypeError):
        d_end = today
    try:
        d_start = datetime.fromisoformat(ds[:10]).date()
    except (ValueError, TypeError):
        d_start = today
    if d_end < today - timedelta(days=RECENT_SOLD_WINDOW_DAYS):
        return False
    if d_start > today + timedelta(days=UPCOMING_WINDOW_DAYS):
        return False
    return True


# ── Per-house enumerators ────────────────────────────────────────────────

def enumerate_antiquorum(sale_url, sale=None):
    """Return a list of full lot detail dicts for an Antiquorum sale.

    Uses the catalog page (catalog.antiquorum.swiss) as the lot index
    then per-lot fetches to scrape_catalog_antiquorum_lot for full
    estimate / image / title. The catalog detail page doesn't carry
    structured auction_end / auction_start (only a human date label),
    so we patch those in from the parent `sale` entry passed by the
    orchestrator.
    """
    if "catalog.antiquorum.swiss" not in sale_url:
        return []
    try:
        r = requests.get(sale_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Antiquorum] catalog fetch failed: {e}")
        return []
    lot_paths = sorted(set(re.findall(r"/en/lots/[a-z0-9-]+-lot-\d+-\d+", r.text)))
    base = "https://catalog.antiquorum.swiss"
    sale_start = (sale or {}).get("dateStart")
    sale_end = (sale or {}).get("dateEnd") or sale_start
    out = []
    for path in lot_paths:
        url = base + path
        try:
            time.sleep(PER_LOT_SLEEP_SECONDS)
            data = scrape_catalog_antiquorum_lot(url)
        except Exception as e:
            print(f"    [Antiquorum] lot fetch failed {path}: {e}")
            continue
        if is_excluded_title(data.get("title")):
            continue
        # Backfill the structured dates from the parent sale entry —
        # the catalog page only has a human label.
        if sale_start and not data.get("auction_start"):
            data["auction_start"] = sale_start
        if sale_end and not data.get("auction_end"):
            data["auction_end"] = sale_end
        out.append((url, data))
    return out


def enumerate_christies(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for a Christie's sale.

    Christie's auction page embeds `window.chrComponents.lots.data.lots`
    as a fully-formed JSON list of lot objects — title, estimates,
    URL, images, sale dates, status. No per-lot fetch needed.
    """
    try:
        r = requests.get(sale_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Christie's] auction page fetch failed: {e}")
        return []
    m = re.search(r"window\.chrComponents\.lots\s*=\s*", r.text)
    if not m:
        print("  [Christie's] chrComponents.lots assignment not found")
        return []
    raw = _brace_match_json(r.text, m.end())
    if not raw:
        return []
    try:
        blob = json.loads(raw)
    except Exception as e:
        print(f"  [Christie's] JSON parse failed: {e}")
        return []
    lots = (blob.get("data") or {}).get("lots") or []
    sale = (blob.get("data") or {}).get("sale") or {}
    out = []
    for lot in lots:
        title_primary = (lot.get("title_primary_txt") or "").strip()
        title_secondary = (lot.get("title_secondary_txt") or "").strip()
        if is_excluded_title(title_primary) or is_excluded_title(title_secondary):
            continue
        # Currency parsed from the "estimate_txt" leading token same way
        # the per-lot scraper does it — keep the logic consistent.
        currency = "USD"
        est_txt = (lot.get("estimate_txt") or "").strip()
        cm = re.match(r"(?P<cur>CHF|USD|GBP|EUR|HKD|JPY|CNY|\$|£|€)", est_txt)
        if cm:
            sym = cm.group("cur")
            currency = {"$": "USD", "£": "GBP", "€": "EUR"}.get(sym, sym)
        sold_price = lot.get("price_realised") or None
        if sold_price == 0:
            sold_price = None
        # Status: per-sale `is_auction_over` shadows lot-level state
        # for now (Christie's marks sales over only after the live
        # session closes; per-lot is_in_progress is more granular).
        status = "ended" if (lot.get("is_auction_over") or sale.get("is_auction_over")) else "active"
        # URL: Christie's gives a relative path on lot.url
        url = lot.get("url") or ""
        if url and not url.startswith("http"):
            url = "https://www.christies.com" + url
        if not url:
            continue
        # Image: chrComponents.lots embeds the lot image at
        # `lot.image.image_src` (a www.christies.com/img/lotimages/...
        # URL with a `?mode=max` suffix). Per-lot detail pages use
        # `lot_assets[0].image_url`, but the inline auction-page data
        # uses the `image` sub-object — different shapes between the
        # two surfaces.
        img_url = None
        img_block = lot.get("image") or {}
        if isinstance(img_block, dict):
            img_url = (img_block.get("image_src")
                       or img_block.get("image_desktop_src")
                       or img_block.get("image_tablet_src")
                       or img_block.get("image_mobile_src"))
        data = {
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
            "estimate_low_usd":  to_usd(lot.get("estimate_low"),  currency),
            "estimate_high_usd": to_usd(lot.get("estimate_high"), currency),
            "starting_price_usd": None,
            "current_bid_usd":    None,
            "sold_price_usd":    to_usd(sold_price, currency),
            "status": status,
            "image": img_url,
            "auction_title": (sale.get("title_txt") or "").strip(),
            "auction_start": lot.get("start_date") or sale.get("start_date"),
            "auction_end":   lot.get("end_date")   or sale.get("end_date") or sale.get("start_date"),
            "auction_url":   sale.get("url") or sale_url,
            "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        out.append((url, data))
    return out


def enumerate_sothebys(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for a Sotheby's sale.

    Sotheby's auction page embeds an Algolia query payload at
    `__NEXT_DATA__.props.pageProps.algoliaJson` with hits[] that carry
    every field we need (title, estimates, currency, slug, lot number,
    dates). nbHits is the total; iterate pages via &page=N until the
    hits dry up or we hit nbPages.
    """
    out = []
    seen_object_ids = set()
    page = 0
    nb_pages = 1  # discovered from page 0
    auction_id = None
    while page < nb_pages:
        sep = "&" if "?" in sale_url else "?"
        url = f"{sale_url}{sep}page={page}" if page > 0 else sale_url
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            r.raise_for_status()
        except Exception as e:
            print(f"  [Sotheby's] page {page} fetch failed: {e}")
            break
        m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.DOTALL)
        if not m:
            print(f"  [Sotheby's] no __NEXT_DATA__ on page {page}")
            break
        try:
            data = json.loads(m.group(1))
        except Exception as e:
            print(f"  [Sotheby's] __NEXT_DATA__ parse failed: {e}")
            break
        aj = (data.get("props", {})
                  .get("pageProps", {})
                  .get("algoliaJson") or {})
        hits = aj.get("hits") or []
        if page == 0:
            nb_pages = aj.get("nbPages") or 1
        if not hits:
            break
        new_ids = 0
        for hit in hits:
            oid = hit.get("objectID")
            if oid in seen_object_ids:
                continue
            new_ids += 1
            seen_object_ids.add(oid)
            title = (hit.get("title") or "").strip()
            if is_excluded_title(title):
                continue
            slug = hit.get("slug") or ""
            if not slug:
                continue
            full_url = ("https://www.sothebys.com" + slug) if slug.startswith("/") else slug
            currency = (hit.get("currency") or "USD").upper()
            low = hit.get("lowEstimate")
            high = hit.get("highEstimate")
            sold_price = hit.get("price") or None
            if sold_price == 0:
                sold_price = None
            lot_state = (hit.get("lotState") or "").lower()
            auction_state = (hit.get("auctionState") or "").lower()
            status = "ended" if auction_state in ("closed", "complete", "completed") or lot_state == "sold" else "active"
            # Image: Sotheby's serves images via brightspotcdn with
            # a hash in the path that isn't derivable from the algolia
            # hit alone. v1 leaves image=None and lets the Card fall
            # back to the no-image placeholder. A future iteration can
            # one-shot the lot detail page to pull the brightspot URL,
            # at the cost of N extra HTTP fetches per sale.
            img_url = None
            creator = ""
            creators = hit.get("creators") or []
            if creators and isinstance(creators[0], str):
                creator = creators[0]
            description = (creator + " — " + title) if creator and creator not in title else title
            lot_data = {
                "house": "Sotheby's",
                "lot_id": oid,
                "lot_number": hit.get("lotDisplayNumber") or hit.get("lotNr"),
                "title": title,
                "description": description[:600],
                "currency": currency,
                "estimate_low": low,
                "estimate_high": high,
                "starting_price": None,
                "current_bid": None,
                "sold_price": sold_price,
                "estimate_low_usd":  to_usd(low,  currency),
                "estimate_high_usd": to_usd(high, currency),
                "starting_price_usd": None,
                "current_bid_usd":    None,
                "sold_price_usd":    to_usd(sold_price, currency),
                "status": status,
                "image": img_url,
                "auction_title": hit.get("auctionName"),
                "auction_start": hit.get("openDate"),
                "auction_end":   hit.get("closingTime") or hit.get("auctionDate"),
                "auction_url":   sale_url,
                "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            out.append((full_url, lot_data))
        # Stop if a page returned no NEW objectIDs — the catalog server
        # sometimes echoes page 0 when paged-out and we don't want an
        # infinite loop.
        if new_ids == 0:
            break
        page += 1
        if page < nb_pages:
            time.sleep(PER_LOT_SLEEP_SECONDS)
    return out


def enumerate_phillips(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for a Phillips sale.

    Phillips' auction page server-renders a tile per lot with class
    `seldon-object-tile` and href `/detail/<slug>/<id>`. The tile
    doesn't carry estimates / titles in a parseable way — those come
    from a per-lot page fetch. Capped at PHILLIPS_LOTS_PER_SALE so a
    single sale doesn't dominate the CI run.
    """
    try:
        r = requests.get(sale_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Phillips] auction page fetch failed: {e}")
        return []
    paths = sorted(set(re.findall(r'/detail/[a-z0-9-]+/\d+', r.text)))
    paths = paths[:PHILLIPS_LOTS_PER_SALE]
    base = "https://www.phillips.com"
    out = []
    for path in paths:
        url = base + path
        try:
            time.sleep(PER_LOT_SLEEP_SECONDS)
            data = scrape_phillips_lot(url)
        except Exception as e:
            print(f"    [Phillips] lot fetch failed {path}: {e}")
            continue
        if is_excluded_title(data.get("title")):
            continue
        out.append((url, data))
    return out


# ── Helpers ─────────────────────────────────────────────────────────────

def _brace_match_json(text, start):
    """Walk balanced braces from `start` and return the substring that
    forms the outer JSON object. Mirrors the same brace counter used
    in auctionlots_scraper.scrape_christies_lot — embedded strings can
    contain unbalanced } so a regex-only approach is too fragile.
    """
    depth = 0
    i = start
    in_str = False
    quote = None
    while i < len(text):
        c = text[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                in_str = False
        elif c in '"\'':
            in_str = True
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                i += 1
                return text[start:i]
        i += 1
    return None


# ── Orchestrator ────────────────────────────────────────────────────────

ENUMERATORS = {
    "Antiquorum":    (enumerate_antiquorum,  ("catalog.antiquorum.swiss",)),
    "Christie's":    (enumerate_christies,   ("christies.com/en/auction/",)),
    "Sotheby's":     (enumerate_sothebys,    ("sothebys.com/en/buy/auction/",)),
    "Phillips":      (enumerate_phillips,    ("phillips.com/auction/",)),
}


def main():
    if not os.path.exists(AUCTIONS_JSON):
        print(f"ERROR: {AUCTIONS_JSON} not found — run merge.py first.", file=sys.stderr)
        sys.exit(1)
    with open(AUCTIONS_JSON) as f:
        auctions = json.load(f)
    today = date.today()
    targets = []
    for sale in auctions:
        house = sale.get("house") or ""
        spec = ENUMERATORS.get(house)
        if not spec:
            continue
        url = sale.get("url") or ""
        if not any(needle in url for needle in spec[1]):
            # URL is the generic landing page (not enumerable)
            continue
        if not in_active_window(sale, today):
            continue
        targets.append((house, sale))

    print(f"Comprehensive auction-lot scrape: {len(targets)} sale(s) in active window\n")

    out = {}
    for house, sale in targets:
        sale_url = sale["url"]
        date_label = sale.get("dateLabel") or sale.get("dateStart") or ""
        print(f"[{house}] {date_label}: {sale_url}")
        enumer = ENUMERATORS[house][0]
        try:
            lots = enumer(sale_url, sale)
        except Exception as e:
            print(f"  enumeration error: {e}")
            continue
        n_kept = 0
        for url, data in lots:
            # If the same URL appears across multiple sales (rare; can
            # happen for Christie's online sales), keep the most-recent
            # scrape. Order is sale-iteration order so last write wins.
            out[url] = data
            n_kept += 1
        print(f"  → {n_kept} lots kept after filter\n")

    print(f"Total lots: {len(out)}")
    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
