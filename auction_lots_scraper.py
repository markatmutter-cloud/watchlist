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
    scrape_antiquorum_lot,
    scrape_christies_lot,
    scrape_sothebys_lot,
    scrape_monaco_legend_lot,
    to_usd,
    HEADERS as LOT_HEADERS,
)


# Politeness delay between detail-page fetches inside one sale, to
# avoid hammering Phillips with 50 concurrent reqs from CI.
PER_LOT_SLEEP_SECONDS = 0.6

# Per-sale lot cap for Phillips (where each lot needs its own HTTP
# fetch). Other houses inline lot data on the auction page so no cap
# is needed there. Cap was 60 originally; raised to 1000 on
# 2026-05-05 per Mark — Phillips sales routinely run 200–400 lots
# (CH080226: 227, HK080226: 308) and the 60-cap was missing the
# bulk of every sale. 1000 is a soft "shouldn't ever bind" guard
# rather than a hard budget — GitHub Actions on this repo is free
# + unlimited so the only cost is wall-clock; ~1.5s/lot × 1000 =
# 25 min worst case per sale, comfortably under the 6h job limit
# even across multiple concurrent sales.
PHILLIPS_LOTS_PER_SALE = 1000

# Phillips WAF mitigation (2026-05-06). Phillips' edge starts
# returning 403 after ~7 successful per-lot fetches in a row from
# GitHub Actions IPs. The flagship May Geneva sale was capturing 7
# of 227 lots before the rest 403'd. enumerate_phillips() retries
# on 403 with a linear backoff; if a streak of consecutive 403s
# crosses _BACKOFF_TRIPS, it sleeps _LONG_COOLDOWN_SECONDS to let
# the WAF window roll over. After two such cooldowns on one sale
# it gives up — avoids burning the whole CI run on a tarpit.
PHILLIPS_BACKOFF_SECONDS       = 30
PHILLIPS_MAX_RETRIES           = 2
PHILLIPS_BACKOFF_TRIPS         = 5
PHILLIPS_LONG_COOLDOWN_SECONDS = 90

# Date window for which sales we attempt to scrape:
#   end >= today - RECENT_SOLD_WINDOW_DAYS (so recently closed sales
#     stay scrape-able for the "recently sold" bucket in the unified
#     feed's blend sort)
#   start <= today + UPCOMING_WINDOW_DAYS (don't try catalogs too far
#     out — most haven't been published yet)
RECENT_SOLD_WINDOW_DAYS = 30
UPCOMING_WINDOW_DAYS = 90

# Antiquorum results-refresh pass (2026-05-11). After a sale ends, the
# bulk enumerator (live.antiquorum.swiss/auctions/<id>) can stop
# carrying the lots blob — the page archives, viewVars.lots.result_page
# returns empty, and the sale drops out of our scrape entirely. But
# individual lot detail pages (live.antiquorum.swiss/lots/view/<id>)
# stay up indefinitely and continue to report realized sold_price.
# So for any Antiquorum lot we ALREADY have in prior auction_lots.json
# that lacks sold_price and whose parent sale ended within the refresh
# window, re-fetch the individual lot to pick up the realized price.
# Settled lots (sold_price already set) are immutable and skipped.
ANTIQUORUM_REFRESH_WINDOW_DAYS = 30
ANTIQUORUM_REFRESH_SLEEP_SECONDS = 0.5
ANTIQUORUM_LOT_URL_FRAGMENT = "live.antiquorum.swiss/lots/view/"

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
# Manually curated lot URLs Mark adds via GitHub UI when he wants a
# specific lot tracked that the comprehensive enumeration won't reach
# (historical sales, lots dropped from current sales, houses with
# broken enumeration). Each URL is dispatched to the matching
# scrape_<house>_lot function from auctionlots_scraper.py and merged
# into the output alongside the comprehensive scrape. Long-term
# replaced by an admin form (Phase D); short-term Mark edits the
# JSON file directly via the GitHub web editor.
MANUAL_URLS_JSON = "data/manual_lot_urls.json"


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
    # The bare \bclock\b regex below would otherwise match "o'clock" /
    # "o’clock" (curly apostrophe) — a positional reference inside
    # watch titles ("date aperture at 6 o'clock", "register at 3 o'clock"),
    # NOT a clock-the-object signal. Verified 2026-05-05 against the
    # CH080317 archive: 9 of 42 lots were being false-flagged on this.
    cleaned = re.sub(r"\bo['’]clock\b", " ", title, flags=re.IGNORECASE)
    for pat in EXCLUDE_PATTERNS:
        if pat.search(cleaned):
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

def _resolve_antiquorum_live_auction_url(catalog_url):
    """Map a catalog.antiquorum.swiss sale URL → live.antiquorum.swiss
    auction URL. Returns None on failure.

    The catalog and live surfaces have different IDs (catalog uses a
    human slug like `Geneva_May_9th_10th_2026`, live uses a short code
    like `1-CDGBNO`). The catalog page doesn't carry an auction-level
    live URL — only per-lot live URLs of the form
    `live.antiquorum.swiss/lots/view/<live-lot-id>`. We follow the
    first one and pull `auction._detail_url` out of its viewVars blob.
    """
    try:
        r = requests.get(catalog_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"    [Antiquorum] catalog fetch failed for live-URL resolution: {e}")
        return None
    # Pull any per-lot live URL.
    m = re.search(r"https://live\.antiquorum\.swiss/lots/view/[A-Za-z0-9-]+", r.text)
    if not m:
        return None
    lot_url = m.group(0)
    try:
        r2 = requests.get(lot_url, headers=HEADERS, timeout=30, allow_redirects=True)
        r2.raise_for_status()
    except Exception as e:
        print(f"    [Antiquorum] live lot fetch failed: {e}")
        return None
    # The live lot page embeds auction._detail_url inside its viewVars
    # blob. The blob is a giant JS object literal — easier to grep
    # than to parse — so anchor on the field name and the JSON-escape
    # of the leading slash.
    m = re.search(r'"_detail_url":"(\\?/auctions\\?/[^"]+)"', r2.text)
    if not m:
        return None
    detail_path = m.group(1).replace("\\/", "/")
    return f"https://live.antiquorum.swiss{detail_path}?limit=1000"


def enumerate_antiquorum(sale_url, sale=None):
    """Return a list of full lot detail dicts for an Antiquorum sale.

    Strategy (rev 2026-05-05):
    1. Resolve the catalog URL → live auction URL via a small helper
       (catalog page exposes per-lot live URLs; one of those points
       back to the auction's live `_detail_url`).
    2. Fetch `live.antiquorum.swiss/auctions/<id>/...?limit=1000` once.
    3. Parse `viewVars.lots.result_page` from the inline JS blob.
    4. Project each lot dict into our standard shape.

    Pre-2026-05-05 the enumerator hit catalog.antiquorum.swiss's
    paginated index and per-lot detail pages, but the catalog's
    `?page=N` redirects to `/lots`, so we only ever saw the first 20
    of 600+ lots per sale. Per Mark: the live surface's `?limit=N`
    actually paginates — and the server caps `?limit=1000` at the
    actual lot count, so it's future-proof without us tracking
    individual sale sizes.

    POST-SALE DISPATCH (2026-05-11). Once a sale ends, the live page
    archives — the catalog → live URL bridge stops finding per-lot
    live links, so this enumerator started returning 0 lots for closed
    sales (the original issue Mark reported for Geneva May 9-10). For
    past sales we route to `enumerate_antiquorum_catalog` which reads
    sold prices directly from the catalog detail pages. That path is
    capped at 20 lots/sale by vendor-broken pagination — see the
    catalog enumerator's docstring for the workaround
    (data/manual_lot_urls.json for the lots beyond the first 20).
    """
    # Post-sale: catalog page is the only surface still publishing
    # realized prices. The live page archives soon after end.
    today = date.today()
    sale_end_str = (sale or {}).get("dateEnd") or (sale or {}).get("dateStart") or ""
    try:
        sale_end_date = datetime.fromisoformat(sale_end_str[:10]).date()
    except (ValueError, TypeError):
        sale_end_date = None
    if sale_end_date and sale_end_date < today and "catalog.antiquorum.swiss" in sale_url:
        print(
            f"  [Antiquorum] sale ended {sale_end_date.isoformat()}; "
            f"routing to catalog enumerator for realized prices"
        )
        return enumerate_antiquorum_catalog(sale_url, sale)

    # Accept either the catalog URL (as it lands in auctions.json) OR
    # a pre-resolved live auction URL — useful when manually running
    # the scraper against a known live sale.
    if "live.antiquorum.swiss/auctions/" in sale_url:
        live_url = sale_url if "limit=" in sale_url else (
            sale_url + ("&" if "?" in sale_url else "?") + "limit=1000"
        )
    elif "catalog.antiquorum.swiss" in sale_url:
        live_url = _resolve_antiquorum_live_auction_url(sale_url)
        if not live_url:
            print("  [Antiquorum] couldn't resolve live auction URL; skipping sale")
            return []
    else:
        return []

    try:
        r = requests.get(live_url, headers=HEADERS, timeout=60)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Antiquorum] live page fetch failed: {e}")
        return []

    # Extract the viewVars JS-object blob. The page is a 5MB Angular
    # template, but viewVars itself is the only top-level assignment
    # that opens with `viewVars = {`; greedy match to the end of the
    # following `};\n` is fine because no nested object literal in the
    # blob terminates that exact way.
    m = re.search(r"viewVars\s*=\s*(\{.*?\});", r.text, re.S)
    if not m:
        print("  [Antiquorum] viewVars blob not found")
        return []
    try:
        view_vars = json.loads(m.group(1))
    except Exception as e:
        print(f"  [Antiquorum] viewVars parse failed: {e}")
        return []

    lots = (view_vars.get("lots") or {}).get("result_page") or []
    if not lots:
        print("  [Antiquorum] viewVars.lots.result_page empty")
        return []

    sale_start = (sale or {}).get("dateStart")
    sale_end = (sale or {}).get("dateEnd") or sale_start
    out = []
    for lot in lots:
        title_short = (lot.get("title") or "").strip()
        truncated = (lot.get("truncated_description") or "").strip()
        # Antiquorum's `title` field is often just the maker
        # ("LEMANIA"); the description carries the model + reference.
        # Build a fuller title from both so brand-detection + Card
        # render pull useful tokens.
        if truncated:
            # Strip leading "<MAKER>, " prefix if `title` already says
            # the same thing — avoids "LEMANIA LEMANIA, SWITZERLAND..."
            desc_no_prefix = truncated
            if title_short and truncated.upper().startswith(title_short.upper()):
                desc_no_prefix = truncated[len(title_short):].lstrip(", ")
            title = f"{title_short} {desc_no_prefix}".strip()
        else:
            title = title_short
        # Cap so the JSON file stays compact; Card clamps to 2 lines.
        if len(title) > 240:
            title = title[:237].rstrip() + "…"

        if is_excluded_title(title):
            continue

        currency = (lot.get("currency_code") or "CHF").upper()

        def _money(val):
            if val in (None, ""):
                return None
            try:
                return int(float(val))
            except (TypeError, ValueError):
                return None

        estimate_low = _money(lot.get("estimate_low"))
        estimate_high = _money(lot.get("estimate_high"))
        starting_price = _money(lot.get("starting_price"))
        sold_price = _money(lot.get("sold_price"))
        # `highest_live_bid` carries the most recent live bid on
        # in-progress lots; falls back to None for lots that haven't
        # opened yet. Map onto current_bid so the Card render's
        # bid/estimate dispatch lights up correctly.
        current_bid = _money(lot.get("highest_live_bid"))

        # Status mapping: live page reports lot.status as 'active',
        # 'sold', 'passed', etc. Roll 'sold' / 'passed' / 'unsold'
        # into our binary 'ended' bucket; everything else is 'active'.
        raw_status = (lot.get("status") or "").lower()
        is_ended = raw_status in {"sold", "passed", "unsold", "withdrawn", "ended"}
        status = "ended" if is_ended else "active"

        detail_path = lot.get("_detail_url") or ""
        full_url = (
            f"https://live.antiquorum.swiss{detail_path}"
            if detail_path.startswith("/")
            else detail_path
        )
        if not full_url:
            continue

        auction_blob = lot.get("auction") or {}
        auction_title = auction_blob.get("title")
        auction_time_start = auction_blob.get("time_start")
        auction_time_end = auction_blob.get("effective_end_time")
        auction_detail = auction_blob.get("_detail_url")
        auction_url = (
            f"https://live.antiquorum.swiss{auction_detail}"
            if auction_detail and auction_detail.startswith("/")
            else None
        )

        out.append((full_url, {
            "house": "Antiquorum",
            "lot_id": lot.get("row_id"),
            "lot_number": lot.get("lot_number"),
            "title": title,
            "description": truncated[:600],
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
            "image": lot.get("cover_thumbnail") or None,
            "auction_title": auction_title,
            # Prefer the auction's own time fields (ISO timestamps)
            # over the calendar's date-only entries when present.
            "auction_start": auction_time_start or sale_start,
            "auction_end":   auction_time_end or sale_end,
            "auction_url":   auction_url,
            "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }))
    return out


def enumerate_antiquorum_catalog(sale_url, sale=None):
    """Walk an Antiquorum sale's CATALOG page (catalog.antiquorum.swiss)
    and scrape per-lot detail pages for realized sold prices.

    Used for sales that have ENDED. The live surface
    (live.antiquorum.swiss/auctions/<id>) archives post-sale and the
    catalog → live URL bridge (`_resolve_antiquorum_live_auction_url`)
    stops finding per-lot live links — that's why the previous bulk
    path returns 0 for closed sales. The catalog page itself stays up
    for years post-sale AND publishes the realized "Sold: CHF X" panel
    directly in static HTML on each lot's detail page.

    Pagination quirk (verified 2026-05-11): plain `?page=N` requests
    301-redirect to page 1 — including with proper browser UA + Referer
    headers. The frontend's lazy-load works because it sends
    `X-Requested-With: XMLHttpRequest`, which the server treats as the
    canonical Rails xhr signal and returns the actual page-N chunk.
    Add that header and full pagination unlocks (page 34 → 672 lots
    confirmed for Geneva May 9-10).
    """
    xhr_headers = dict(HEADERS)
    xhr_headers["Referer"] = sale_url
    xhr_headers["X-Requested-With"] = "XMLHttpRequest"

    # Walk pages until one returns no NEW lot anchors. Antiquorum's
    # server quietly returns page 1's content for out-of-range `?page=N`
    # values, so a "no new lots" page is the stop signal — not status
    # code, not empty body. The dedupe set across pages catches that.
    seen = set()
    unique_paths = []
    for page in range(1, 200):  # 200-page ceiling = ~4000 lots; well past real-world
        page_url = sale_url if page == 1 else f"{sale_url}?page={page}"
        try:
            r = requests.get(page_url, headers=xhr_headers, timeout=30)
            r.raise_for_status()
        except Exception as e:
            print(f"  [Antiquorum catalog] page {page} fetch failed: {e}")
            break
        # Each lot anchor appears ~4× on a page (image link, title
        # link, "view details" button, etc.) — dedupe within the page
        # via dict.fromkeys (preserves order) before merging with the
        # cross-page seen set.
        paths_on_page = list(dict.fromkeys(
            re.findall(r"/en/lots/[a-z0-9\-]+-lot-\d+-\d+", r.text)
        ))
        new_paths = [p for p in paths_on_page if p not in seen]
        if not new_paths:
            # Either past the last page or hit the silent-redirect-to-1
            # fallback. Either way: nothing new — stop walking.
            break
        for p in new_paths:
            seen.add(p)
            unique_paths.append(p)
        # Gentle pause between page fetches; auction lots get a sleep
        # in the per-lot loop below, so pages don't need much.
        time.sleep(0.2)

    if not unique_paths:
        print("  [Antiquorum catalog] no lot anchors found on sale page")
        return []

    print(
        f"  [Antiquorum catalog] walked {page} page(s); found "
        f"{len(unique_paths)} unique lot anchor(s)"
    )

    sale_start = (sale or {}).get("dateStart")
    sale_end = (sale or {}).get("dateEnd") or sale_start

    out = []
    for path in unique_paths:
        full_url = f"https://catalog.antiquorum.swiss{path}"
        try:
            time.sleep(PER_LOT_SLEEP_SECONDS)
            data = scrape_catalog_antiquorum_lot(full_url)
        except Exception as e:
            print(f"  [Antiquorum catalog] lot scrape failed {path}: {e}")
            continue
        if not isinstance(data, dict):
            continue
        if is_excluded_title(data.get("title")):
            continue
        # Backfill calendar-level dates onto the lot's auction_* fields
        # (the catalog lot page only carries a human-readable label, not
        # ISO timestamps).
        if not data.get("auction_start"):
            data["auction_start"] = sale_start
        if not data.get("auction_end"):
            data["auction_end"] = sale_end
        if not data.get("auction_url"):
            data["auction_url"] = sale_url
        out.append((full_url, data))
    return out


def refresh_antiquorum_unsold_lots(prior_lots, fresh_out, today=None):
    """Lot-by-lot results refresh for Antiquorum (2026-05-11).

    Walks every Antiquorum lot in `prior_lots` whose parent sale has
    ended within ANTIQUORUM_REFRESH_WINDOW_DAYS and that lacks a
    sold_price, re-fetching the individual lot detail page (which
    survives the sale's archival on the live auction surface). Lots
    that come back with a realized sold_price (or other terminal
    status) are written into `fresh_out`, overriding the prior
    no-price entry.

    Does NOT touch lots that already have a sold_price — settled lots
    are immutable. Does NOT re-fetch URLs already captured by the bulk
    enumerator in the same run (`fresh_out` wins).

    Returns the count of lots actually updated. Intended as a fallback
    to the bulk auction-page enumerator, NOT a replacement: bulk gives
    us all 600+ lots in one fetch while the sale is live; this pass
    only handles the post-sale "viewVars went empty but individual lot
    pages still serve sold_price" failure mode.
    """
    today = today or date.today()
    refresh_cutoff = today - timedelta(days=ANTIQUORUM_REFRESH_WINDOW_DAYS)

    candidates = []
    for url, data in (prior_lots or {}).items():
        if not isinstance(data, dict):
            continue
        if data.get("house") != "Antiquorum":
            continue
        if ANTIQUORUM_LOT_URL_FRAGMENT not in url:
            continue
        if data.get("sold_price"):
            continue
        if url in fresh_out:
            continue
        end_str = data.get("auction_end") or ""
        d_end = None
        # auction_end can be ISO datetime ("2026-05-10T18:00:00Z") or a
        # bare date string. Try datetime first, fall back to date prefix.
        for parser in (
            lambda s: datetime.fromisoformat(s.replace("Z", "+00:00")).date(),
            lambda s: datetime.fromisoformat(s[:10]).date(),
        ):
            try:
                d_end = parser(end_str)
                break
            except (ValueError, TypeError):
                continue
        if d_end is None:
            continue
        if d_end >= today:
            # Sale hasn't closed yet — bulk path is the right surface.
            continue
        if d_end < refresh_cutoff:
            # Too old; if we never got a price by now, we never will.
            continue
        candidates.append(url)

    if not candidates:
        return 0

    print(
        f"\n[Antiquorum] Results refresh: walking {len(candidates)} unsold "
        f"lot(s) from sales closed in the last "
        f"{ANTIQUORUM_REFRESH_WINDOW_DAYS}d"
    )
    updated = 0
    for url in candidates:
        try:
            time.sleep(ANTIQUORUM_REFRESH_SLEEP_SECONDS)
            data = scrape_antiquorum_lot(url)
        except Exception as e:
            print(f"  [refresh] fetch failed {url}: {e}")
            continue
        if not isinstance(data, dict):
            continue
        sp = data.get("sold_price")
        raw_status = (data.get("status") or "").lower()
        terminal_status = raw_status in {
            "sold", "passed", "unsold", "withdrawn", "ended"
        }
        if sp in (None, 0) and not terminal_status:
            # Still no result published; try again next run.
            continue
        # Normalize status to our binary 'ended' bucket, matching
        # enumerate_antiquorum's status mapping.
        if terminal_status:
            data["status"] = "ended"
        fresh_out[url] = data
        updated += 1
    print(
        f"  [refresh] {updated}/{len(candidates)} lot(s) updated with "
        f"realised results"
    )
    return updated


def enumerate_christies(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for a Christie's sale.

    Christie's auction page embeds `window.chrComponents.lots.data.lots`
    as the FIRST PAGE of lots (typically pagesize=84) — fields are
    title, estimates, URL, images, sale dates, status. The same
    inline blob carries `total_hits_filtered` (the true lot count)
    and `lot_search_api_endpoint` — a JSON spec for the paginated
    REST API the frontend uses to load page 2+. We follow that
    endpoint for any sale that has more lots than the inline page.
    Pre-2026-05-06 the scraper only saw the inline page-1 lots and
    silently dropped the rest (Christie's flagship May sale was
    showing 82/229).
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
    data = blob.get("data") or {}
    lots = data.get("lots") or []
    sale = data.get("sale") or {}
    total = data.get("total_hits_filtered") or len(lots)
    page_size = len(lots) or 84

    # If the inline page didn't carry every lot, re-fetch the auction
    # page with `?page=N` — Christie's `?page=N` returns lots 1..N*pagesize
    # in one shot (cumulative, not just page N alone). Verified
    # 2026-05-06: ?page=2 → 168 lots, ?page=3 → 229 lots on a 229-
    # lot sale. So we compute how many pages cover the total and ask
    # for that one URL — single extra request for the entire tail.
    if total > len(lots) and page_size > 0:
        pages_needed = (total + page_size - 1) // page_size
        sep = "&" if "?" in sale_url else "?"
        page_url = f"{sale_url}{sep}page={pages_needed}"
        try:
            time.sleep(PER_LOT_SLEEP_SECONDS)
            pr = requests.get(page_url, headers=HEADERS, timeout=30)
            pr.raise_for_status()
            pm = re.search(r"window\.chrComponents\.lots\s*=\s*", pr.text)
            if pm:
                praw = _brace_match_json(pr.text, pm.end())
                if praw:
                    pblob = json.loads(praw)
                    pdata = pblob.get("data") or {}
                    page_lots = pdata.get("lots") or []
                    if len(page_lots) > len(lots):
                        lots = page_lots
        except Exception as e:
            print(f"  [Christie's] paginated fetch failed: {e}")
        if len(lots) < total:
            print(f"  [Christie's] paginated to {len(lots)}/{total} lots")
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


def scrape_sothebys_lot_image(lot_url):
    """Return the canonical lot image URL or None.

    Sotheby's renders the high-res lot image into the page's `og:image`
    meta tag — a brightspotcdn URL like
    `https://sothebys-md.brightspotcdn.com/dims4/.../crop/.../resize/4096x4096!/quality/90/?url=…`.
    The algoliaJson hit on the auction page doesn't carry the hash
    needed to construct this URL, so we pay one HTTP fetch per lot.

    Caller is expected to politeness-delay between calls; this function
    just does the fetch + parse and lets the caller orchestrate.
    Returns None on any error (no image is better than a thrown
    exception that aborts the whole sale).
    """
    try:
        r = requests.get(lot_url, headers=HEADERS, timeout=20)
        r.raise_for_status()
    except Exception:
        return None
    # property="og:image" can appear before or after the content="..."
    # attribute, so match the meta tag flexibly. The image URL is
    # always brightspotcdn — anchor on that to avoid picking up
    # site-chrome OG images on error pages.
    m = re.search(
        r'<meta[^>]+property="og:image"[^>]+content="([^"]+brightspotcdn[^"]+)"',
        r.text,
    )
    if not m:
        m = re.search(
            r'<meta[^>]+content="([^"]+brightspotcdn[^"]+)"[^>]+property="og:image"',
            r.text,
        )
    if m:
        # The og:image carries HTML-encoded ampersands — undo them
        # so the URL works directly as an <img src>.
        return m.group(1).replace("&amp;", "&")

    # Fallback for lots without an og:image meta (a small minority —
    # usually older sales where Sotheby's didn't generate the social
    # preview): scan the body for brightspotcdn URLs and pick the
    # largest-resize variant. The brightspot URL pattern is
    # `.../resize/WIDTHxHEIGHT!/...`; bigger numbers = the canonical
    # hero image rather than thumbnail/sidebar variants.
    candidates = re.findall(r'(https://[^"\s]+brightspotcdn[^"\s]+)', r.text)
    if not candidates:
        return None
    def _resize_size(u):
        m_ = re.search(r"/resize/(\d+)x(\d+)!", u)
        if not m_: return 0
        try: return int(m_.group(1)) * int(m_.group(2))
        except ValueError: return 0
    best = max(candidates, key=_resize_size)
    return best.replace("&amp;", "&")


def enumerate_sothebys(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for a Sotheby's sale.

    Two-pass strategy (PR #94, 2026-05-06):

    1. Fetch the auction page → algoliaJson SSR payload gives us the
       first 48 lots (the SSR hardcodes page=0 — `?page=N` is ignored
       server-side, see PR #93 docstring for the prior limitation).
       Use the FIRST lot's slug to bootstrap pass 2.

    2. Fetch that one lot page → its apolloCache contains an
       `Auction` entry whose `lotCards({"countryOfOrigin":"US","filter":"ALL"})`
       field carries EVERY lot in the sale (~151 entries on
       ge2601). Each card has lotId, slug, title, lotNumber,
       creatorsDisplayTitle. From there:

       - For lots already covered by algoliaJson (the 48 with full
         estimates), reuse the algoliaJson hit + the per-lot image
         fetch the prior code path used.
       - For the remaining lots (the 100+ that algoliaJson didn't
         expose), fetch each lot page individually and pull
         estimateV2 + media + description from its own LotV2 in
         apolloCache.

    Cost: 1 auction page + 1 bootstrap lot + N-48 per-lot fetches
    for full data + 48 per-lot fetches for images. Roughly the same
    request volume as the prior code path (which already did 48
    image fetches), just gets ~3× more lots.

    Sotheby's doesn't appear to have a Phillips-style WAF so far;
    if 403s start appearing we can layer the same backoff pattern
    enumerate_phillips uses.
    """
    out = []
    # ── Pass 1: auction page → algoliaJson (48 lots) ──────────────
    try:
        r = requests.get(sale_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Sotheby's] auction page fetch failed: {e}")
        return []
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.DOTALL)
    if not m:
        print("  [Sotheby's] no __NEXT_DATA__ on auction page")
        return []
    try:
        data = json.loads(m.group(1))
    except Exception as e:
        print(f"  [Sotheby's] __NEXT_DATA__ parse failed: {e}")
        return []
    aj = (data.get("props", {}).get("pageProps", {}).get("algoliaJson") or {})
    hits = aj.get("hits") or []
    by_lot_id = {}
    for hit in hits:
        oid = hit.get("objectID")
        if oid: by_lot_id[oid] = hit
    print(f"  [Sotheby's] algoliaJson: {len(hits)} hits, nbHits={aj.get('nbHits')}")

    # ── Pass 2: bootstrap a lot URL, harvest lotCards ─────────────
    bootstrap_slug = None
    for hit in hits:
        if hit.get("slug"):
            bootstrap_slug = hit["slug"]
            break
    if not bootstrap_slug:
        print("  [Sotheby's] no bootstrap lot slug in algoliaJson")
        return []
    bootstrap_url = ("https://www.sothebys.com" + bootstrap_slug) if bootstrap_slug.startswith("/") else bootstrap_slug
    try:
        time.sleep(PER_LOT_SLEEP_SECONDS)
        rb = requests.get(bootstrap_url, headers=HEADERS, timeout=30)
        rb.raise_for_status()
    except Exception as e:
        print(f"  [Sotheby's] bootstrap lot fetch failed: {e}")
        return []
    mb = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', rb.text, re.DOTALL)
    if not mb:
        print("  [Sotheby's] no __NEXT_DATA__ on bootstrap lot")
        return []
    bdata = json.loads(mb.group(1))
    apollo = bdata.get("props", {}).get("pageProps", {}).get("apolloCache") or {}
    auction_obj = None
    auction_currency = None
    auction_title = None
    for k, v in apollo.items():
        if isinstance(v, dict) and v.get("__typename") == "Auction":
            auction_obj = v
            break
    if not auction_obj:
        print("  [Sotheby's] no Auction in apolloCache")
        return []
    lot_cards = None
    for fk, fv in auction_obj.items():
        if fk.startswith("lotCards") and isinstance(fv, list):
            lot_cards = fv
            break
    if not lot_cards:
        print("  [Sotheby's] no lotCards on Auction object")
        return []
    auction_currency = auction_obj.get("currency") or auction_obj.get("currencyV2") or "USD"
    auction_title = auction_obj.get("title")
    auction_year = (auction_obj.get("slug") or {}).get("year") if isinstance(auction_obj.get("slug"), dict) else None
    auction_name = (auction_obj.get("slug") or {}).get("name") if isinstance(auction_obj.get("slug"), dict) else None
    # Hoist a sale-level "approximately when this sale ends" date.
    # Used as a fallback for lots that algoliaJson didn't cover and
    # whose per-lot LotV2 didn't carry a date — without this, ~100 lots
    # land with auction_end=null on the frontend and the
    # endingSoonComparator drops them to tier 3 (mis-sorting the whole
    # "Live auctions" view per Mark's report 2026-05-07).
    #
    # Three potential sources, preferred in order:
    #   1. Auction.dates.closed — usually null for live sales until
    #      the day-of, but populated for online auctions.
    #   2. LotV2.session.scheduledOpeningDate from the bootstrap lot —
    #      for live sales this is when the live session starts, which
    #      is approximately when the sale ends (close enough for tier
    #      classification).
    #   3. None.
    auction_dates = auction_obj.get("dates") or {}
    sale_auction_end = None
    if isinstance(auction_dates, dict):
        cb = auction_dates.get("closed")
        if isinstance(cb, str): sale_auction_end = cb
    if not sale_auction_end:
        # The bootstrap lot's LotV2 was the same parse — find it and
        # extract its session date.
        for v in apollo.values():
            if isinstance(v, dict) and v.get("__typename") == "LotV2":
                sess = v.get("session") or {}
                if isinstance(sess, dict):
                    sd = sess.get("scheduledOpeningDate")
                    if isinstance(sd, str):
                        sale_auction_end = sd
                        break
    print(f"  [Sotheby's] lotCards: {len(lot_cards)} lots — fetching missing ones (sale-end fallback: {sale_auction_end or 'none'})")

    # ── Build per-lot data ────────────────────────────────────────
    for card in lot_cards:
        lot_id = card.get("lotId")
        slug_block = card.get("slug") or {}
        lot_slug = slug_block.get("lotSlug") if isinstance(slug_block, dict) else None
        if not lot_id or not lot_slug:
            continue
        title = (card.get("title") or "").strip()
        if is_excluded_title(title):
            continue
        creator = (card.get("creatorsDisplayTitle") or "").strip()
        lot_number_block = card.get("lotNumber") or {}
        lot_display = lot_number_block.get("lotDisplayNumber") if isinstance(lot_number_block, dict) else None
        # URL: same shape Sotheby's renders
        if auction_year and auction_name:
            full_url = f"https://www.sothebys.com/en/buy/auction/{auction_year}/{auction_name}/{lot_slug}"
        else:
            # Fallback — derive from sale_url + slug
            full_url = sale_url.rstrip("/") + "/" + lot_slug
        # Decide what data we already have. AlgoliaJson hit has full
        # estimate + currency + sold_price + dates. lotCards has only
        # title + slug + lotNumber + creator. If algoliaJson doesn't
        # cover this lot, we per-lot fetch for estimateV2 + image.
        hit = by_lot_id.get(lot_id)
        currency = (hit.get("currency") if hit else None) or auction_currency or "USD"
        currency = currency.upper()
        low = hit.get("lowEstimate") if hit else None
        high = hit.get("highEstimate") if hit else None
        status_state = ((hit.get("lotState") or "").lower()) if hit else ""
        auction_state = ((hit.get("auctionState") or "").lower()) if hit else ""
        status = "ended" if auction_state in ("closed", "complete", "completed") or status_state == "sold" else "active"
        # hit.price has dual meaning in Sotheby's algoliaJson:
        # for SOLD lots it's the realised hammer; for everything else
        # it's the low estimate (the catalog "starting from" display).
        # Without gating, every active lot ended up with
        # sold_price = low_estimate, downstream merge.py + App.js
        # flagged the lot as sold while bidding was still live (Mark
        # report 2026-05-13 — multiple Sotheby's lots showed Sold the
        # day before their auction-end; Daytona ref 6262 showed Sold
        # at $40k = low estimate while still taking bids).
        #
        # Two-gate defence:
        # (a) lotState must be explicitly "sold". If Sotheby's later
        #     exposes a closed-without-sale state, sold_price stays
        #     null — the correct semantics for an unsold lot.
        # (b) Reject sold_price == low_estimate. Even when lotState
        #     transiently flips to "sold", there's a window where
        #     `price` is still the low-estimate placeholder before
        #     the hammer propagates. Better to leave null and let
        #     the next scrape settle it than to publish a false
        #     "sold for low estimate." Cost: rare lots that genuinely
        #     hammer at low estimate need the second scrape pass to
        #     resolve — acceptable trade vs the alternative.
        sold_price = None
        if status_state == "sold":
            candidate = (hit.get("price") if hit else None) or None
            if candidate == 0: candidate = None
            if candidate is not None and low is not None and candidate == low:
                candidate = None
            sold_price = candidate
        # auction_start was previously taken from algoliaJson's
        # `openDate` — Sotheby's online portion opens days/weeks
        # before the live session, so this triggered the `tier 0
        # (currently live)` branch in `endingSoonComparator` for
        # lots that aren't actually live yet, mis-sorting the Live
        # auctions view (PR fix 2026-05-07). Drop it: leave null
        # so all upcoming Sotheby's lots cluster in tier 1 and
        # sort by auction_end ascending alongside other houses.
        auction_start = None
        # auction_end falls back to the sale-level Auction.dates.closed
        # when algoliaJson + the per-lot LotV2 both omit it. Without
        # this fallback, ~100 lotCards-only lots ended up with
        # auction_end=null and dropped to tier 3 (no date) instead
        # of tier 1 (upcoming) — visible to the user as "undefined"
        # in the days-left chip + scattered sort order.
        auction_end = (hit.get("closingTime") or hit.get("auctionDate")) if hit else None
        img_url = None

        # Per-lot fetch: always for image (algoliaJson doesn't carry
        # the og:image hash). For lots NOT in algoliaJson (i.e. past
        # the SSR's first 48), we additionally need estimate +
        # description from the lot's own LotV2.
        try:
            time.sleep(PER_LOT_SLEEP_SECONDS)
            if hit is None or low is None:
                # Need full data — pull from the lot page's apolloCache.
                lot_data = _scrape_sothebys_lot_full(full_url)
                if lot_data:
                    if low is None: low = lot_data.get("low")
                    if high is None: high = lot_data.get("high")
                    if sold_price is None: sold_price = lot_data.get("sold")
                    img_url = lot_data.get("image")
                    if not auction_end:   auction_end   = lot_data.get("auction_end")
                    # auction_start intentionally left null (see comment above).
                    description = lot_data.get("description") or title
                else:
                    description = title
            else:
                # Lighter fetch — just the og:image.
                img_url = scrape_sothebys_lot_image(full_url)
                description = (creator + " — " + title) if creator and creator not in title else title
        except Exception as e:
            print(f"    [Sotheby's] lot fetch failed for {full_url}: {e}")
            description = title
        # Sale-level fallback: if neither algoliaJson nor the per-lot
        # fetch surfaced an auction_end, use the bootstrap Auction
        # object's `dates.closed`. Same date for every lot in the sale.
        if not auction_end and sale_auction_end:
            auction_end = sale_auction_end
        # Display title — prepend the maker so the card's prominent
        # line says "Cartier Tank Cintrée …" instead of just
        # "Tank Cintrée | …" (Mark's report 2026-05-07: filters
        # work because brand is detected separately, but the
        # visible title was dropping the maker for every Sotheby's
        # lot since the algoliaJson + lotCards titles are pure
        # model + description). Skip the prepend if the maker
        # already appears in the title (rare but possible). Strip
        # any "Brand, Country" → "Brand" so the maker reads
        # cleanly when prepended (creatorsDisplayTitle is
        # "Cartier, Paris" but we want "Cartier" up front).
        maker_short = (creator.split(",")[0].strip() if creator else "")
        if maker_short and maker_short.lower() not in title.lower():
            display_title = f"{maker_short} {title}"
        else:
            display_title = title
        lot_data_out = {
            "house": "Sotheby's",
            "lot_id": lot_id,
            "lot_number": lot_display,
            "title": display_title,
            "maker": creator or None,
            "description": (description or "")[:600],
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
            "auction_title": auction_title,
            "auction_start": auction_start,
            "auction_end":   auction_end,
            "auction_url":   sale_url,
            "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        out.append((full_url, lot_data_out))
    return out


def _scrape_sothebys_lot_full(lot_url):
    """Pull the full lot data from the lot page's apolloCache LotV2.

    Returns a dict with keys: low, high, sold, image, auction_start,
    auction_end, description. Or None on parse failure.
    """
    try:
        r = requests.get(lot_url, headers=HEADERS, timeout=20)
        r.raise_for_status()
    except Exception:
        return None
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.DOTALL)
    if not m: return None
    try:
        data = json.loads(m.group(1))
    except Exception:
        return None
    apollo = data.get("props", {}).get("pageProps", {}).get("apolloCache") or {}
    lot = None
    auction = None
    for v in apollo.values():
        if not isinstance(v, dict): continue
        if v.get("__typename") == "LotV2": lot = v
        elif v.get("__typename") == "Auction": auction = v
    if not lot: return None
    # estimateV2 wraps low/high in `Amount` objects (string amount).
    # Convert to plain ints so the rest of the pipeline (to_usd, the
    # frontend price formatter) doesn't need to special-case this
    # shape.
    est = lot.get("estimateV2") or {}
    def _amount(node):
        if isinstance(node, dict): node = node.get("amount")
        if node in (None, ""): return None
        try: return int(float(node))
        except (TypeError, ValueError): return None
    low = _amount(est.get("lowEstimate"))
    high = _amount(est.get("highEstimate"))
    sold = None
    bid_ref = lot.get("latestBid") or {}
    # latestBid is a reference; resolved value may have hammer info.
    # For now leave sold price detection to the bid_ref dereferencing
    # in a future PR — most active lots don't have it set yet anyway.
    image = None
    media = None
    for fk in lot.keys():
        if fk.startswith("media"):
            media = lot[fk]
            break
    if isinstance(media, dict):
        images = media.get("images") or []
        if images:
            # Pick the largest size variant available.
            best = None
            best_score = 0
            for img in images:
                if not isinstance(img, dict): continue
                sizes = img.get("sizes") or []
                for sz in sizes:
                    if not isinstance(sz, dict): continue
                    url = sz.get("url") or ""
                    score = 0
                    sm = re.search(r"resize/(\d+)x(\d+)", url)
                    if sm: score = int(sm.group(1)) * int(sm.group(2))
                    if score > best_score:
                        best_score = score; best = url
            if best:
                image = best.replace("&amp;", "&")
    if not image:
        # og:image fallback uses the same code path the prior scraper
        # used — keep behaviour consistent.
        image = scrape_sothebys_lot_image(lot_url)
    description = (lot.get("description") or "").strip()
    description = re.sub(r"<[^>]+>", " ", description)
    auction_start = None
    auction_end = None
    if auction:
        dates = auction.get("dates") or {}
        if isinstance(dates, dict):
            ab = dates.get("acceptsBids")
            cb = dates.get("closed")
            auction_start = ab if isinstance(ab, str) else None
            auction_end = cb if isinstance(cb, str) else None
    return {
        "low": low, "high": high, "sold": sold,
        "image": image,
        "auction_start": auction_start,
        "auction_end": auction_end,
        "description": description[:600],
    }


def enumerate_phillips(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for a Phillips sale.

    NEW STRATEGY (PR #100, 2026-05-06): pull every lot's full data
    from the auction page itself in a single fetch, parsing the
    React Router Turbo-Stream payload that's embedded in the HTML.

    Background: Phillips uses a Cloudflare-style WAF that 403s
    per-lot detail-page fetches from GitHub Actions IPs after about
    seven consecutive requests. PR #93 added retry-with-backoff;
    that didn't break through. Per-lot fetches are dead from CI.

    But the auction-page response (which is allowed) ships ALL lot
    data inline: each `streamController.enqueue("...")` call
    delivers a chunk of a flat JSON array using the
    `{"_<key-idx>": <value-idx>}` reference format that React
    Router 7 / Remix v3 use for hydration. The array contains the
    auction object whose `lots[]` field is every lot with title,
    estimates, currency, image, lotNumber, status — everything the
    per-lot fetch was returning. Roughly 5,000 entries for a
    225-lot sale; a single resolver walk is fast.

    No per-lot fetches → no WAF triggers → full coverage from the
    single auction-page fetch.
    """
    try:
        r = requests.get(sale_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Phillips] auction page fetch failed: {e}")
        return []
    lots = _phillips_extract_lots(r.text)
    if not lots:
        print("  [Phillips] no lots found in auction-page payload")
        return []
    print(f"  [Phillips] auction-page payload: {len(lots)} lots")

    auction_obj = _phillips_extract_auction_meta(r.text) or {}
    auction_title = auction_obj.get("auctionName") or sale.get("title") if isinstance(sale, dict) else None
    auction_start = auction_obj.get("auctionStartDateTime")
    auction_end   = auction_obj.get("auctionEndDateTime")

    out = []
    for lot in lots:
        lot_data = _phillips_lot_to_record(lot, auction_title, auction_start, auction_end, sale_url)
        if not lot_data:
            continue
        if is_excluded_title(lot_data.get("title")):
            continue
        out.append((lot_data["_url"], lot_data))
    return [(u, {k: v for k, v in d.items() if not k.startswith("_")}) for u, d in out]


def _phillips_extract_lots(html):
    """Resolve the React Router Turbo-Stream payload and return the
    flat list of lot dicts. Empty list on any parse failure (we'd
    rather skip a sale than hard-error the whole batch)."""
    chunks = re.findall(r'streamController\.enqueue\("((?:[^"\\]|\\.)*)"\)', html)
    if not chunks:
        return []
    # Each chunk is JSON-string-encoded inside a JS double-quoted
    # string. Re-wrap and let json.loads handle the unescape — using
    # encode/decode("unicode_escape") would mangle multi-byte UTF-8
    # (verified 2026-05-06: 'Élégante' rendered as 'Ã‰lÃ©gante').
    try:
        parts = [json.loads('"' + c + '"') for c in chunks]
    except Exception as e:
        print(f"  [Phillips] stream chunk JSON-string decode failed: {e}")
        return []
    combined = "".join(parts)
    try:
        arr = json.loads(combined)
    except Exception as e:
        print(f"  [Phillips] stream payload parse failed: {e}")
        return []
    if not isinstance(arr, list):
        return []

    # The payload uses a denormalized graph: every value lives at its
    # own index in the flat array, and dict keys/values + array
    # elements are integer references back into the array. The
    # `{"_K_idx": V_idx}` shape encodes a key-value pair where both
    # K and V are array indices. Walk + memoize.
    memo = {}
    def resolve(idx, stack=frozenset()):
        if idx in memo: return memo[idx]
        if idx in stack: return None  # cycle
        if not isinstance(idx, int) or idx < 0 or idx >= len(arr):
            return idx
        v = arr[idx]
        s2 = stack | {idx}
        if isinstance(v, dict):
            out = {}
            for k, w in v.items():
                if k.startswith("_"):
                    try:
                        key_idx = int(k[1:])
                    except ValueError:
                        continue
                    key = arr[key_idx] if 0 <= key_idx < len(arr) else None
                    if not isinstance(key, str):
                        continue
                    out[key] = resolve(w, s2) if isinstance(w, int) else w
                else:
                    out[k] = w
            memo[idx] = out
            return out
        if isinstance(v, list):
            out = [resolve(e, s2) if isinstance(e, int) else e for e in v]
            memo[idx] = out
            return out
        memo[idx] = v
        return v

    root = resolve(0)
    if not isinstance(root, dict):
        return []

    # Walk the loaderData object and find any key matching the
    # auction-route pattern. Keys are Remix route ids that include
    # `auctionCode` in the name. Inside that, `auction.lots` is the
    # array we want.
    loader = root.get("loaderData") or {}
    for k, v in loader.items():
        if "auction" not in k:
            continue
        a = (v or {}).get("auction") if isinstance(v, dict) else None
        if isinstance(a, dict):
            lots = a.get("lots")
            if isinstance(lots, list) and lots:
                return lots
    return []


def _phillips_extract_auction_meta(html):
    """Return the auction object (auctionName + dates) from the same
    Turbo-Stream payload `_phillips_extract_lots` walks. Used to
    enrich lot records with sale-level metadata."""
    # Reuse the same parse — the cost is negligible vs. the network
    # fetch. Could memoize across calls but in practice the
    # orchestrator calls _phillips_extract_lots and _phillips_extract_auction_meta
    # back-to-back on the same html, both go through the same json
    # parse + resolve, and both return quickly.
    chunks = re.findall(r'streamController\.enqueue\("((?:[^"\\]|\\.)*)"\)', html)
    if not chunks: return None
    try:
        parts = [json.loads('"' + c + '"') for c in chunks]
        arr = json.loads("".join(parts))
    except Exception:
        return None
    if not isinstance(arr, list): return None
    memo = {}
    def resolve(idx, stack=frozenset()):
        if idx in memo: return memo[idx]
        if idx in stack: return None
        if not isinstance(idx, int) or idx < 0 or idx >= len(arr): return idx
        v = arr[idx]; s2 = stack | {idx}
        if isinstance(v, dict):
            out = {}
            for k, w in v.items():
                if k.startswith("_"):
                    try: key_idx = int(k[1:])
                    except ValueError: continue
                    key = arr[key_idx] if 0 <= key_idx < len(arr) else None
                    if not isinstance(key, str): continue
                    out[key] = resolve(w, s2) if isinstance(w, int) else w
                else: out[k] = w
            memo[idx] = out; return out
        if isinstance(v, list):
            out = [resolve(e, s2) if isinstance(e, int) else e for e in v]
            memo[idx] = out; return out
        memo[idx] = v; return v
    root = resolve(0)
    if not isinstance(root, dict): return None
    loader = root.get("loaderData") or {}
    for k, v in loader.items():
        if "auction" not in k: continue
        a = (v or {}).get("auction") if isinstance(v, dict) else None
        if isinstance(a, dict): return a
    return None


def _phillips_lot_to_record(lot, auction_title, auction_start, auction_end, sale_url):
    """Map a Phillips Turbo-Stream lot dict into the canonical
    auction-lot record shape (matches Christie's / Sotheby's output)."""
    if not isinstance(lot, dict): return None
    detail_link = lot.get("detailLink") or ""
    if not detail_link: return None
    maker = (lot.get("makerName") or "").strip()
    model = (lot.get("modelName") or "").strip()
    description = (lot.get("description") or "").strip()
    # Display title — match the old per-lot path's richness (Mark
    # 2026-05-07: post-#100 Turbo-Stream lots showed concise
    # "Maker Model" while pre-#100 per-lot lots showed
    # "Maker + long descriptive description"). The description
    # carries the dial/case/movement/provenance line that's the
    # bulk of the value on a Phillips card; combine maker + that.
    # Falls back to "Maker Model" when description is missing.
    if maker and description:
        title = f"{maker} {description}"
    elif maker and model:
        title = f"{maker} {model}"
    else:
        title = description or model or maker or "Untitled"
    # Cap to 240 chars so the JSON file stays compact (Card's CSS
    # clamps to 2 lines anyway). Same shape the old per-lot
    # `scrape_phillips_lot` used.
    if len(title) > 240:
        title = title[:237].rstrip() + "…"
    est_main = ((lot.get("estimate") or {}).get("mainEstimate")) or {}
    currency = (est_main.get("currencyCode") or "CHF").upper()
    low = est_main.get("lowEstimate")
    high = est_main.get("highEstimate")
    sold_price = lot.get("soldPrice") or lot.get("hammerPrice") or None
    if sold_price == 0: sold_price = None
    status_raw = (lot.get("lotStatus") or "").lower()
    parent_status = (lot.get("parentAuctionStatus") or "").lower()
    is_ended = (
        status_raw in {"sold", "passed", "withdrawn", "unsold"}
        or parent_status in {"closed", "ended", "completed"}
    )
    image = lot.get("imagePath") or None
    lot_number = lot.get("lotNumberFull") or (str(lot.get("lotNumber")) if lot.get("lotNumber") is not None else None)
    return {
        "_url": detail_link,  # caller strips _-prefixed keys
        "house": "Phillips",
        "lot_id": lot.get("objectNumber"),
        "lot_number": lot_number,
        "title": title,
        "maker": maker or None,
        "description": (description or title)[:600],
        "currency": currency,
        "estimate_low": low,
        "estimate_high": high,
        "starting_price": lot.get("startBidAmount") or None,
        "current_bid": None,
        "sold_price": sold_price,
        "estimate_low_usd":  to_usd(low,  currency),
        "estimate_high_usd": to_usd(high, currency),
        "starting_price_usd": to_usd(lot.get("startBidAmount") or 0, currency) or None,
        "current_bid_usd":    None,
        "sold_price_usd":    to_usd(sold_price, currency),
        "status": "ended" if is_ended else "active",
        "image": image,
        "auction_title": auction_title,
        "auction_start": auction_start,
        "auction_end":   auction_end,
        "auction_url":   sale_url,
        "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


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


def scrape_manual_url(url):
    """Dispatch a manually-supplied URL to the right per-lot scraper.
    Returns (url, lot_dict) on success or None on unsupported pattern.
    """
    if not url or not url.startswith("http"):
        return None
    if "live.antiquorum.swiss/lots/view" in url:
        return (url, scrape_antiquorum_lot(url))
    if "catalog.antiquorum.swiss/" in url and "/lots/" in url:
        return (url, scrape_catalog_antiquorum_lot(url))
    if "christies.com/" in url and "/lot/lot-" in url:
        return (url, scrape_christies_lot(url))
    if "sothebys.com/" in url and "/buy/auction/" in url:
        return (url, scrape_sothebys_lot(url))
    if "phillips.com/detail/" in url:
        return (url, scrape_phillips_lot(url))
    if "monacolegendauctions.com/auction/" in url and "/lot-" in url:
        return (url, scrape_monaco_legend_lot(url))
    return None


def load_manual_urls():
    """Read data/manual_lot_urls.json. Returns a list of URL strings.
    Missing file or malformed JSON is treated as empty (non-fatal)."""
    if not os.path.exists(MANUAL_URLS_JSON):
        return []
    try:
        with open(MANUAL_URLS_JSON) as f:
            blob = json.load(f)
        urls = blob.get("lots") or []
        return [u for u in urls if isinstance(u, str) and u.strip()]
    except Exception as e:
        print(f"WARNING: {MANUAL_URLS_JSON} unreadable: {e}")
        return []


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

    # Load prior auction_lots.json once — used both for the Antiquorum
    # results-refresh pass below AND the sold-lot persistence pass at
    # the end of main().
    prior = {}
    if os.path.exists(OUTPUT_JSON):
        try:
            with open(OUTPUT_JSON) as f:
                prior = json.load(f) or {}
            if not isinstance(prior, dict):
                prior = {}
        except Exception as e:
            print(f"  warn: couldn't read existing {OUTPUT_JSON}: {e}")
            prior = {}

    # Antiquorum results-refresh: walk per-lot detail pages for any
    # Antiquorum lot we already have but never captured a sold_price for,
    # IFF its parent sale ended within the refresh window. Fills the gap
    # when the bulk live-auction page archives post-sale and stops
    # serving the lots blob, but individual lot pages still publish
    # the realized sold_price.
    refresh_antiquorum_unsold_lots(prior, out, today)

    # Manually curated URLs (data/manual_lot_urls.json) — process AFTER
    # the comprehensive scrape so manual entries win on URL collision
    # (they're typically the more authoritative scrape for that lot,
    # since Mark only adds lots he wants tracked carefully).
    manual_urls = load_manual_urls()
    if manual_urls:
        print(f"\nManual lot URLs: {len(manual_urls)}\n")
        for url in manual_urls:
            try:
                time.sleep(PER_LOT_SLEEP_SECONDS)
                result = scrape_manual_url(url)
                if result is None:
                    print(f"  [manual] unsupported URL pattern: {url}")
                    continue
                _, data = result
                if is_excluded_title(data.get("title")):
                    print(f"  [manual] excluded by category filter: {url}")
                    continue
                out[result[0]] = data
                print(f"  [manual] {data.get('house', '?')} · {(data.get('title') or '')[:60]}")
            except Exception as e:
                print(f"  [manual] scrape failed {url}: {e}")

    # Persist historical sold lots permanently (Mark spec 2026-05-11:
    # "I want auction sales to be kept with price permanently"). Without
    # this, any lot whose parent sale falls out of the active scrape
    # window — or whose URL reverts to a generic listings page once the
    # sale ends — gets nuked from auction_lots.json on the next run,
    # losing the realized sold_price forever. The fresh scrape's data
    # wins for any URL still being scraped; for URLs no longer present
    # in the current scrape, we keep the prior entry IFF it carries a
    # realized sold_price (an unambiguous "this lot was sold" signal).
    # Passed / unsold / never-resolved lots are NOT preserved — they
    # have no realized result and become dead weight over time.
    # `prior` was loaded once near the top of main() and is shared with
    # the Antiquorum results-refresh pass above.
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
    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
