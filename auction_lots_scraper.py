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
  Bonhams    → /_next/data/<buildId>/auction/<id>/<slug>.json?page=N
               (single fetch per page; pageProps.lotData.auctionLots
               carries title, price, image, status, brand-group)
  Christie's → window.chrComponents.lots.data.lots inline JSON
               (full per-lot data, no per-lot fetch needed)
  Monaco Legend → server-rendered Laravel/Livewire HTML; per-lot
               <section class="lot[ sold]" data-id data-num data-est>
               with embedded title/brand/estimation/sold-price.
               One sale-page fetch covers every lot.
  Sotheby's  → __NEXT_DATA__.props.pageProps.algoliaJson.hits
               (paginates via &page=N URL param, ~48 hits/page)
  Phillips   → seldon-object-tile data-testid attributes give lot URLs;
               per-lot fetch via scrape_phillips_lot for title/price.
               Capped at PHILLIPS_LOTS_PER_SALE/sale to bound CI time.

Houses we skip (lot-level scraping not viable today):
  Heritage       — DataDome + Cloudflare bot wall on every subdomain

Run: python3 auction_lots_scraper.py
Output: public/auction_lots.json
"""

import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from html import unescape

import requests

# Reuse the per-lot detail scrapers and currency conversion from the
# user-tracked-lot pipeline. Same data shape comes back, so the JSON
# we emit is interchangeable with public/tracked_lots.json.
from tracked_lots_scraper import (
    scrape_catalog_antiquorum_lot,
    scrape_phillips_lot,
    scrape_antiquorum_lot,
    scrape_bonhams_lot,
    scrape_christies_lot,
    scrape_sothebys_lot,
    scrape_monaco_legend_lot,
    to_usd,
    HEADERS as LOT_HEADERS,
)

# Per-house structured-field parsers (reference_no, model_name,
# case_no, movement_no, year_circa, dial, calibre, case_material, etc.)
# plus canonical brand resolution. Applied post-construction so each
# per-house enumerator stays focused on its own enumeration concerns.
from auction_lot_parsers import extract_lot_structured_fields, resolve_brand


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

# HTTP headers for the catalog/auction page fetches. The full Chrome-
# style header set is needed for Bonhams (and any other Cloudflare-
# fronted houses): Cloudflare's bot challenge on GitHub Actions IP
# ranges is stricter than on residential IPs — a bare User-Agent
# returns 403 from CI even though it returns 200 from a developer's
# laptop. Adding the full Accept / Accept-Language / Sec-Fetch / sec-
# ch-ua header set matches what a real Chrome navigation sends and
# clears the Cloudflare challenge.
#
# Accept-Encoding intentionally excludes 'br' (brotli) — `requests`
# doesn't decompress brotli by default and we'd end up handing the
# bytes to downstream parsers as garbage. gzip+deflate covers
# Cloudflare's compression negotiation fine.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/132.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Chromium";v="132", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
}

AUCTIONS_JSON = "public/auctions.json"
OUTPUT_JSON = "public/auction_lots.json"
# Manually curated lot URLs Mark adds via GitHub UI when he wants a
# specific lot tracked that the comprehensive enumeration won't reach
# (historical sales, lots dropped from current sales, houses with
# broken enumeration). Each URL is dispatched to the matching
# scrape_<house>_lot function from tracked_lots_scraper.py and merged
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


# Jewellery lots (2026-10-05). Mixed "Jewellery & Watches" sales now reach us
# whole (see is_mixed_jewellery_watch_sale), so THEIR non-watch lots are
# dropped one by one: necklaces, earrings, brooches, rings and the like. This
# filter is scoped to those sales only — it is not part of is_excluded_title.
#
# Two deliberate carve-outs, both measured against the 6,074-lot corpus we
# already hold (it drops 14, all genuinely jewellery):
#  - "pendant" is NOT a jewellery word here. Pendant watches are common in
#    these catalogues and are often titled without the word "watch"
#    ("THE SHIELD PENDANT, GOLD AND ENAMEL").
#  - "ring" is a dial and bezel feature as often as it is jewellery, so it
#    only counts when it isn't "gilt chapter ring dial", "inner bezel ring",
#    "ring-lock system" and friends.
# A watch word anywhere in the title wins outright, which is what keeps
# "CITRINE RING WATCH" and "PENDANT WATCH & BROOCH" in.
_LOT_WATCH_RE = re.compile(
    r"\b(?:watch|watches|wristwatch|wristwatches|timepiece|timepieces"
    r"|chronograph|chronometer|montre|armbanduhr|horolog)",
    re.IGNORECASE,
)
_LOT_JEWEL_RE = re.compile(
    r"\b(?:necklaces?|earrings?|brooch(?:es)?|bangles?|tiara|sautoir"
    r"|choker|signet)\b",
    re.IGNORECASE,
)
_LOT_RING_RE = re.compile(
    r"(?<!chapter\s)(?<!minute\s)(?<!seconds\s)(?<!inner\s)(?<!outer\s)"
    r"(?<!bezel\s)\brings?\b(?!\s*(?:dial|lock|system|track))",
    re.IGNORECASE,
)


def is_jewellery_lot_title(title):
    """True iff the lot title reads as jewellery rather than a watch.

    Applied ONLY to lots from a mixed jewellery-and-watches sale, via
    `drop_jewellery_lots` (Mark 2026-10-05). A watch sale's own odd
    jewellery lot — a gold Rolex necklace in Important Watches — stays:
    it belongs to the watch world even though it isn't a watch, and
    guessing per-lot across every sale is not worth the false positives.
    """
    t = title or ""
    if not t or _LOT_WATCH_RE.search(t):
        return False
    return bool(_LOT_JEWEL_RE.search(t) or _LOT_RING_RE.search(t))


def drop_jewellery_lots(lots, sale_title):
    """Filter (url, data) pairs for one sale: on a mixed jewellery-and-
    watches sale, drop the jewellery lots; on any other sale, pass
    everything through untouched.

    Applied at the single point where a sale's enumerated lots are
    collected, so it covers every house without threading sale context
    through a dozen per-house filters.
    """
    if not is_mixed_jewellery_watch_sale(sale_title):
        return list(lots), 0
    kept, dropped = [], 0
    for url, data in lots:
        if is_jewellery_lot_title((data or {}).get("title")):
            dropped += 1
            continue
        kept.append((url, data))
    return kept, dropped


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


# Catalog-level exclusions (2026-05-28): skip ENTIRE sales by title.
# is_excluded_title() works per-lot, but some auction catalogs are
# fundamentally non-watch (jewels / art / mixed-collectables sales that
# carry a handful of watch lots) and shouldn't appear on a watch site at
# all — the per-lot filter still lets the watch lots through. Match is a
# case-insensitive substring so the short Sotheby's title also catches the
# long "…Including Jewels from the Collection of…" variant of the same sale.
# LOCKSTEP: merge.py has its own copy of this list (it owns the auction
# CALENDAR; it can't import this module — the pytest env has no `requests`).
# Keep the two in sync — same convention as BRAND_ALIASES.
EXCLUDE_CATALOG_TITLES = [
    "Noble & Private Collections",   # Sotheby's L26035 — jewels/art, 245 lots
    "Espionage: Fact & Fiction",     # Bonhams 32384 — spy memorabilia
    "Fine Jewelry",                  # Sotheby's L26050 — jewels (~6 watches in ~225 lots);
                                     # recurring Sotheby's sale name, all non-watch
    "Artistic Luxury",               # Sotheby's N12xxx — Fabergé/gold boxes/silver/ceramics (Mark 2026-06-13)
    "Maurice Tempelsman",            # Sotheby's "A Marvelous Journey: The Collection of…" — jewels/objets (Mark 2026-06-13)
]
# URL-slug blocklist — the calendar sometimes carries a MISLEADING title: the
# Sotheby's L26050 jewels sale is cross-listed in the watches category with the
# generic title "Fine Watches" but a `…/fine-jewelry-l26050` URL. Title alone
# can't catch it, so also block by URL slug. (LOCKSTEP with merge.py.)
EXCLUDE_CATALOG_URL_SLUGS = ["fine-jewelry", "jewels", "jewellery", "jewelry"]

# A sale whose title names BOTH jewellery and watches is a genuinely mixed
# sale, not a jewels sale: Sotheby's "Fine Jewelry & Watches" (Milan, MIOL66)
# and Monaco Legend's recurring "Exclusive Timepieces & Jewels" both list
# real watch lots and both were being dropped whole. Mark 2026-10-05: carry
# these sales and exclude the non-watch lots per lot instead.
#
# The watch word must appear in the TITLE for this to apply. That is what
# keeps the Sotheby's L26050 case blocked: that jewels sale is cross-listed
# under the generic title "Fine Watches" with a `…/fine-jewelry-l26050` URL,
# so title-plus-slug still catches it, while a title that says both words
# out loud gets through.
_MIXED_SALE_WATCH_RE = re.compile(
    r"\b(?:watch|watches|wristwatch|wristwatches|timepiece|timepieces|horolog)",
    re.IGNORECASE,
)
_MIXED_SALE_JEWEL_RE = re.compile(
    r"\b(?:jewel|jewels|jewelry|jewellery|jewellers?|jewelers?)\b",
    re.IGNORECASE,
)


def is_mixed_jewellery_watch_sale(title):
    """True iff the sale title names jewellery AND watches, so the sale
    carries watch lots worth keeping (per-lot filtering handles the rest)."""
    t = title or ""
    return bool(_MIXED_SALE_WATCH_RE.search(t) and _MIXED_SALE_JEWEL_RE.search(t))



def is_excluded_catalog(title, url=""):
    """True iff the SALE/catalog is a blocklisted non-watch sale, by title
    OR by URL slug (the calendar title can be misleading).

    A title naming both jewellery and watches is exempt: that sale is mixed,
    not jewels-only, and its non-watch lots are filtered per lot.
    """
    if is_mixed_jewellery_watch_sale(title):
        return False
    # Any other jewellery-named sale is out, whatever its URL. Before the
    # mixed-sale exemption existed this had to be a narrow list of exact
    # names ("Fine Jewelry"), because a broad rule would have eaten the
    # jewellery-and-watches sales wholesale.
    if _MIXED_SALE_JEWEL_RE.search(title or ""):
        return True
    t = (title or "").lower()
    if any(x.lower() in t for x in EXCLUDE_CATALOG_TITLES):
        return True
    u = (url or "").lower()
    return any(x in u for x in EXCLUDE_CATALOG_URL_SLUGS)


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
            "description": truncated[:2000],
            # Empty essay fields on the live-page enumerator — the
            # live surface's viewVars.lots blob carries
            # `truncated_description` only. Essays live on the post-
            # sale catalog detail pages and get extracted by
            # `enumerate_antiquorum_catalog` after the sale ends.
            # Keep the keys present so the schema stays consistent
            # with Sotheby's + Christie's.
            "catalogue_note": "",
            "provenance": "",
            "literature": "",
            "exhibition": "",
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


def _christies_lots_blob(text):
    """Extract the chrComponents lots `data` dict, handling BOTH Christie's
    platforms (B-73, 2026-06-13):
      - www.christies.com assigns `window.chrComponents.lots = {data:{…}}`
        (just the .lots sub-object).
      - onlineonly.christies.com assigns the WHOLE
        `window.chrComponents = {…, "lots": {data:{…}}, …}` in one blob.
    Returns the inner `data` dict (.lots / .total_hits_filtered / .sale) or
    None. Same inner shape on both, so the caller's parsing is unchanged."""
    m = re.search(r"window\.chrComponents\.lots\s*=\s*", text)
    if m:
        raw = _brace_match_json(text, m.end())
        if raw:
            try:
                return json.loads(raw).get("data") or {}
            except Exception:
                return None
    m = re.search(r"window\.chrComponents\s*=\s*", text)
    if m:
        raw = _brace_match_json(text, m.end())
        if raw:
            try:
                return (json.loads(raw).get("lots") or {}).get("data") or {}
            except Exception:
                return None
    return None


def _chr_num(x):
    """Christie's estimates come as ints on www but `"18000.00"` strings on
    the online-only platform (B-73). Coerce to a clean int (or None) so cards
    don't render decimals. Harmless for values already numeric."""
    try:
        return int(float(x)) if x not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _christies_fetch(sale_url):
    """Fetch a Christie's auction page.

    onlineonly.christies.com (the online-only platform, B-73) read-times-out
    plain `requests` from CI's datacenter IPs — same Cloudflare slow-walling
    that blocked watchcenter (B-58), which curl_cffi's Chrome-TLS impersonation
    cleared. So fetch online-only via curl_cffi when available; the main
    www.christies.com host works fine with plain requests (lighter), so keep
    it. curl_cffi's response mirrors requests (.text/.url/.raise_for_status).
    Follows redirects so `.url` is the resolved onlineonly listing URL."""
    if "onlineonly.christies.com" in sale_url and _curl_cffi_requests is not None:
        return _curl_cffi_requests.get(
            sale_url, headers=HEADERS, impersonate=_BONHAMS_IMPERSONATE,
            timeout=45, allow_redirects=True)
    return requests.get(sale_url, headers=HEADERS, timeout=30)


# Christie's sale-location → image-path code (the `NYR` in
# /img/LotImages/2026/NYR/2026_NYR_<sale>_<lot>_000.jpg). Used to
# reconstruct online-only lot images (B-73): onlineonly.christies.com
# IP-gates the lot image to CI (serves a roundel placeholder), but the real
# image lives on www.christies.com (loads fine from CI) at a deterministic
# path. Keyed on the calendar sale's city/title.
CHRISTIES_LOC_CODES = {
    "new york": "NYR", "hong kong": "HGK", "geneva": "GNV", "genève": "GNV",
    "london": "KSS", "paris": "PAR", "amsterdam": "AMS", "dubai": "DXB",
    "shanghai": "SHG", "milan": "MIL", "los angeles": "LA",
}


def _christies_online_image(sale_url, cal_sale, lot):
    """Reconstruct an online-only lot's real image URL (B-73). Returns the
    embedded image_src untouched when it's already a real LotImages URL
    (residential runs get the real one); otherwise — CI gets a roundel
    placeholder — builds the deterministic www.christies.com path from the
    sale number (sso URL), year (sale dates), location code (sale city) and
    zero-padded lot number. Slug-less form verified to resolve (HTTP 200).
    Falls back to whatever was embedded if any part is missing."""
    embedded = (lot.get("image") or {}).get("image_src") or ""
    if "LotImages" in embedded:
        return embedded
    m = re.search(r"SaleNumber=(\d+)", sale_url or "")
    salenum = m.group(1) if m else None
    year = next((str(d)[:4] for d in (cal_sale.get("dateStart"), cal_sale.get("dateEnd"))
                 if isinstance(d, str) and str(d)[:4].isdigit()), None)
    hay = f"{cal_sale.get('location', '')} {cal_sale.get('title', '')}".lower()
    loc = next((c for kw, c in CHRISTIES_LOC_CODES.items() if kw in hay), None)
    lotnum = re.sub(r"\D", "", str(lot.get("lot_number") or lot.get("lot_id_txt") or ""))
    if salenum and year and loc and lotnum:
        return (f"https://www.christies.com/img/LotImages/{year}/{loc}/"
                f"{year}_{loc}_{salenum}_{lotnum.zfill(4)}_000.jpg?mode=max")
    return embedded or None


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
    # Keep the CALENDAR sale (caller's arg) — the inline `sale` below is
    # overwritten by the page's own sale object, which lacks the location /
    # dates we need to reconstruct online-only image URLs (B-73).
    cal_sale = sale if isinstance(sale, dict) else {}
    try:
        r = _christies_fetch(sale_url)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Christie's] auction page fetch failed: {e}")
        return []
    # Online-only sales (B-73): the calendar gives an `sso?SaleID=…` link that
    # 302s to onlineonly.christies.com/s/<slug>/lots/<saleid>. Detect from the
    # RESOLVED url so we use the right lot-URL host + paginate the resolved
    # listing URL (?page on the sso link doesn't carry through).
    resolved_url = getattr(r, "url", None) or sale_url
    is_online_only = "onlineonly.christies.com" in (resolved_url or "")
    data = _christies_lots_blob(r.text)
    if data is None:
        print("  [Christie's] chrComponents lots blob not found")
        return []
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
        sep = "&" if "?" in resolved_url else "?"
        page_url = f"{resolved_url}{sep}page={pages_needed}"
        try:
            time.sleep(PER_LOT_SLEEP_SECONDS)
            pr = _christies_fetch(page_url)
            pr.raise_for_status()
            pdata = _christies_lots_blob(pr.text)
            if pdata:
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
        sold_price = _chr_num(lot.get("price_realised")) or None
        # Status: per-sale `is_auction_over` shadows lot-level state
        # for now (Christie's marks sales over only after the live
        # session closes; per-lot is_in_progress is more granular).
        status = "ended" if (lot.get("is_auction_over") or sale.get("is_auction_over")) else "active"
        # URL: Christie's gives a relative path on lot.url
        url = lot.get("url") or ""
        if url and not url.startswith("http"):
            url = ("https://onlineonly.christies.com" if is_online_only
                   else "https://www.christies.com") + url
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
        # Online-only (B-73): CI gets a roundel placeholder for the image;
        # reconstruct the real www.christies.com URL from sale/lot fields.
        if is_online_only and (not img_url or "roundel" in (img_url or "")):
            img_url = _christies_online_image(sale_url, cal_sale, lot) or img_url
        # Per-lot detail fetch for Lot Essay (Mark feedback 2026-05-19:
        # "we are discarding the sothebys essays" applied to Christie's
        # too). The bulk chrComponents.lots blob only carries title +
        # estimates — essays live on the per-lot detail page under
        # `<h2 ...>Lot Essay</h2>`. Gated by `CHRISTIES_ESSAYS` env
        # var (default ON) so Mark can throttle if the comprehensive
        # cron slows down past acceptable.
        catalogue_note = ""
        # Skip the per-lot essay fetch for online-only sales — that platform's
        # lot pages have a different structure (_extract_christies_essay won't
        # find the "Lot Essay" block) and it'd add ~N slow fetches per sale.
        if not is_online_only and os.environ.get("CHRISTIES_ESSAYS", "1") == "1":
            try:
                time.sleep(PER_LOT_SLEEP_SECONDS)
                er = requests.get(url, headers=HEADERS, timeout=20)
                if er.ok:
                    catalogue_note = _extract_christies_essay(er.text)
            except Exception as e:
                # Same continue-on-error posture as Sotheby's per-lot
                # path — one essay fetch failing shouldn't kill the
                # sale.
                print(f"    [Christie's] essay fetch failed for {url}: {e}")
        data = {
            "house": "Christie's",
            "lot_id": lot.get("object_id"),
            "lot_number": lot.get("lot_id_txt"),
            "title": title_primary,
            "description": title_secondary[:2000],
            # Essay fields match Sotheby's schema. Christie's only
            # surfaces catalogue_note (its "Lot Essay" maps onto our
            # catalogue_note key). Provenance / literature / exhibition
            # are reserved for future per-lot extraction if those
            # surfaces become identifiable on Christie's lot pages.
            "catalogue_note": (catalogue_note or "")[:4000],
            "provenance": "",
            "literature": "",
            "exhibition": "",
            "currency": currency,
            "estimate_low": _chr_num(lot.get("estimate_low")),
            "estimate_high": _chr_num(lot.get("estimate_high")),
            "starting_price": None,
            "current_bid": None,
            "sold_price": sold_price,
            "estimate_low_usd":  to_usd(_chr_num(lot.get("estimate_low")),  currency),
            "estimate_high_usd": to_usd(_chr_num(lot.get("estimate_high")), currency),
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


# ── Sotheby's (GraphQL lotCardsConnection) ──────────────────────────────
#
# B-69 (2026-06-12): Sotheby's stopped server-rendering the algoliaJson
# payload into the auction page — `pageProps.algoliaJson` is now null and
# only the first 48 lots ship inline (as a `lotCardsConnection`). The old
# enumerator keyed off algoliaJson for both the lot list and a bootstrap
# slug, so it returned 0 lots: the calendar still listed the sale but the
# catalogue was empty (Mark: "Sotheby's shows as a link, lots live, no
# listing available"). Only 1 Sotheby's lot survived in the feed.
#
# The page now drives lot loading through the site's own Cosmo GraphQL
# router at clientapi.prod.sothelabs.com. We replicate its
# LotCardsFilterByPaginated operation (extracted from the page bundle but
# inlined self-contained here, so a JS redeploy / chunk-hash change can't
# break it — introspection is disabled on the router but arbitrary valid
# queries run). offset/limit walk the full lot list. Each card carries
# title, lot number, estimate, image (brightspot CDN) and — on closed
# sales — the realised price (bidState.sold.ResultVisible.premiums.
# finalPrice). One ~5-call walk replaces the old per-lot fetch storm.
#
# Trade-off vs the old per-lot path: lot descriptions / essays
# (catalogueNote / provenance / literature / exhibition) aren't in the
# card payload, so description is just maker + title and the essay fields
# are empty. That's the card data the feed needs; the per-lot essay fetch
# was the slow, WAF-risky part and is intentionally dropped.
SOTHEBYS_GQL_ENDPOINT = "https://clientapi.prod.sothelabs.com/graphql"
SOTHEBYS_GQL_HEADERS = {
    "User-Agent": HEADERS.get("User-Agent", "Mozilla/5.0"),
    "Content-Type": "application/json",
    "Origin": "https://www.sothebys.com",
    "Referer": "https://www.sothebys.com/",
}
SOTHEBYS_GQL_PAGE = 100
SOTHEBYS_LOTS_QUERY = """query LotPage($id: String!, $filter: LotCardsConnectionFilter!, $language: TranslationLanguage!, $limit: Int, $offset: Int) {
  auction(id: $id, language: $language) {
    id
    lotCards: lotCardsConnection(offset: $offset, limit: $limit, filter: $filter) {
      hasNextPage
      totalCount
      lots {
        lotId
        title
        subtitle
        creatorsDisplayTitle
        lotNumber { ... on VisibleLotNumber { lotDisplayNumber } }
        slug { lotSlug }
        estimateV2 { ... on LowHighEstimateV2 { lowEstimate { amount currency } highEstimate { amount currency } } }
        media(imageSizes: [Large]) { images { renditions { url width imageSize } } }
        bidState { sold { ... on ResultVisible { isSold premiums { finalPrice: finalPriceV2 { amount currency } } } } }
      }
    }
  }
}"""


def _sothebys_amount(node):
    """A GraphQL Amount node ({amount: "3000", currency: "USD"}) → (int, cur)."""
    if not isinstance(node, dict):
        return None, None
    raw = node.get("amount")
    cur = node.get("currency")
    try:
        amt = int(float(raw)) if raw not in (None, "") else None
    except (TypeError, ValueError):
        amt = None
    if amt == 0:
        amt = None
    return amt, cur


def _sothebys_card_to_lot(card, sale_url, auction_title, auction_currency,
                          auction_year, auction_name, sale_end):
    """One LotCard from the GraphQL connection → (lot_url, lot dict) in the
    same shape every other house emits. Returns None for non-lots /
    excluded titles (pocket watches, clocks, loose dials — is_excluded_title)."""
    lot_id = card.get("lotId")
    slug_block = card.get("slug") or {}
    lot_slug = slug_block.get("lotSlug") if isinstance(slug_block, dict) else None
    if not lot_id or not lot_slug:
        return None
    title = (card.get("title") or "").strip()
    if not title or is_excluded_title(title):
        return None
    creator = (card.get("creatorsDisplayTitle") or "").strip()
    ln = card.get("lotNumber") or {}
    lot_display = ln.get("lotDisplayNumber") if isinstance(ln, dict) else None

    if auction_year and auction_name:
        full_url = f"https://www.sothebys.com/en/buy/auction/{auction_year}/{auction_name}/{lot_slug}"
    else:
        full_url = sale_url.rstrip("/") + "/" + lot_slug

    est = card.get("estimateV2") or {}
    low, low_cur = _sothebys_amount(est.get("lowEstimate"))
    high, high_cur = _sothebys_amount(est.get("highEstimate"))
    currency = (low_cur or high_cur or auction_currency or "USD").upper()

    # Realised price only on closed lots (ResultVisible.isSold). On live
    # lots `sold` is null / ResultHidden, so sold_price stays None — no
    # repeat of the old "sold = low estimate while bidding" bug (B-pre).
    sold_price = None
    sold = (card.get("bidState") or {}).get("sold") or {}
    if sold.get("isSold"):
        fp = (sold.get("premiums") or {}).get("finalPrice")
        sold_price, sp_cur = _sothebys_amount(fp)
        if sp_cur:
            currency = sp_cur.upper()
    status = "ended" if sold.get("isSold") else "active"

    # Largest available rendition. Sotheby's brightspot URLs are
    # hash-signed with the resize baked in — store as-is, don't rewrite
    # (CLAUDE.md scraper note).
    img_url = None
    images = (card.get("media") or {}).get("images") or []
    if images:
        rends = images[0].get("renditions") or []
        if rends:
            best = max(rends, key=lambda x: x.get("width") or 0)
            img_url = best.get("url")

    # Prepend the maker so the card's prominent line reads "Cartier Tank
    # …" not just "Tank …" — the card title is pure model + description.
    maker_short = creator.split(",")[0].strip() if creator else ""
    if maker_short and maker_short.lower() not in title.lower():
        display_title = f"{maker_short} {title}"
    else:
        display_title = title
    description = f"{creator} — {title}" if creator and creator not in title else title

    return (full_url, {
        "house": "Sotheby's",
        "lot_id": lot_id,
        "lot_number": lot_display,
        "title": display_title,
        "maker": creator or None,
        "description": (description or "")[:4000],
        "catalogue_note": "",
        "provenance": "",
        "literature": "",
        "exhibition": "",
        "currency": currency,
        "estimate_low": low,
        "estimate_high": high,
        "starting_price": None,
        "current_bid": None,
        "sold_price": sold_price,
        "estimate_low_usd": to_usd(low, currency),
        "estimate_high_usd": to_usd(high, currency),
        "starting_price_usd": None,
        "current_bid_usd": None,
        "sold_price_usd": to_usd(sold_price, currency),
        "status": status,
        "image": img_url,
        "auction_title": auction_title,
        "auction_start": None,
        "auction_end": sale_end,
        "auction_url": sale_url,
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })


def enumerate_sothebys(sale_url, sale=None):
    """Return [(lot_url, lot_dict)] for a Sotheby's sale via the GraphQL API.

    See the section comment above for why this replaced the algoliaJson +
    bootstrap-lot approach (B-69). Two passes:
      1. Fetch the auction page → pageProps.auctionId (raw uuid the
         GraphQL `auction(id:)` wants) + the apolloCache Auction object
         for sale metadata (title, currency, slug, end date).
      2. POST LotCardsFilterByPaginated, walking offset/limit until
         hasNextPage is false, and map each card to a lot record.
    """
    sale = sale or {}
    # ── Pass 1: auction page → auctionId + sale metadata ──────────────
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
        pp = json.loads(m.group(1)).get("props", {}).get("pageProps", {})
    except Exception as e:
        print(f"  [Sotheby's] __NEXT_DATA__ parse failed: {e}")
        return []
    auction_id = pp.get("auctionId")
    if not auction_id:
        print("  [Sotheby's] no auctionId on auction page")
        return []
    apollo = pp.get("apolloCache") or {}
    auction_obj = next((v for k, v in apollo.items()
                        if k.startswith("Auction:") and isinstance(v, dict)), {})
    auction_title = auction_obj.get("title") or (sale.get("title") if isinstance(sale, dict) else None)
    # Catalog-level exclusion: a non-watch sale (jewels/art) shouldn't be
    # enumerated even though a few watch lots would survive the per-lot
    # filter. See EXCLUDE_CATALOG_TITLES.
    if is_excluded_catalog(auction_title):
        print(f"  [Sotheby's] skipping blocklisted catalog: {auction_title!r}")
        return []
    auction_currency = (auction_obj.get("currencyV2") or auction_obj.get("currency") or "USD").upper()
    slug = auction_obj.get("slug") or {}
    auction_year = slug.get("year") if isinstance(slug, dict) else None
    auction_name = slug.get("name") if isinstance(slug, dict) else None
    # Sale-level end date for the endingSoon tier sort: prefer the actual
    # close, fall back to the live-session start (startsToClose ≈ sale
    # end), then the calendar sale dict. Without it ~all lots land with
    # auction_end=null and drop to tier 3 (mis-sorting "Live auctions").
    dates = auction_obj.get("dates") or {}
    sale_end = None
    if isinstance(dates, dict):
        for key in ("closed", "startsToClose"):
            v = dates.get(key)
            if isinstance(v, str):
                sale_end = v
                break
    if not sale_end and isinstance(sale, dict):
        sale_end = sale.get("end_date") or sale.get("dateEnd") or sale.get("start_date")

    # ── Pass 2: paginate the GraphQL lotCardsConnection ───────────────
    out = []
    offset = 0
    total = None
    while True:
        try:
            resp = requests.post(
                SOTHEBYS_GQL_ENDPOINT, headers=SOTHEBYS_GQL_HEADERS,
                json={"query": SOTHEBYS_LOTS_QUERY,
                      "variables": {"id": auction_id, "filter": "ALL",
                                    "language": "ENGLISH",
                                    "limit": SOTHEBYS_GQL_PAGE, "offset": offset}},
                timeout=40)
            resp.raise_for_status()
            payload = resp.json()
        except Exception as e:
            print(f"  [Sotheby's] GraphQL fetch failed at offset {offset}: {e}")
            break
        conn = ((payload.get("data") or {}).get("auction") or {}).get("lotCards")
        if conn is None:
            print(f"  [Sotheby's] GraphQL error: {json.dumps(payload.get('errors'))[:200]}")
            break
        for card in (conn.get("lots") or []):
            rec = _sothebys_card_to_lot(card, sale_url, auction_title,
                                        auction_currency, auction_year,
                                        auction_name, sale_end)
            if rec:
                out.append(rec)
        total = conn.get("totalCount")
        if not conn.get("hasNextPage"):
            break
        offset += SOTHEBYS_GQL_PAGE
        time.sleep(PER_LOT_SLEEP_SECONDS)
    print(f"  [Sotheby's] {len(out)} watch lots from {auction_title!r} (sale total {total})")
    return out


# ── Bonhams ─────────────────────────────────────────────────────────────

BONHAMS_BUILDID_RE = re.compile(r'"buildId":"([^"]+)"')
BONHAMS_SALE_URL_RE = re.compile(r"/auction/(\d+)/([^/?#]+)/?")


# Bonhams' Cloudflare configuration applies a stricter bot challenge
# to GitHub Actions IPs than to residential IPs — the plain `requests`
# library 403s from CI because Cloudflare inspects the TLS finger-
# print (JA3), not just HTTP headers. curl-cffi impersonates Chrome's
# real TLS handshake and clears the challenge. We use it ONLY for
# Bonhams fetches; the other houses (Antiquorum, Christie's, Sotheby's,
# Phillips, Monaco Legend) work fine with plain `requests`.
try:
    from curl_cffi import requests as _curl_cffi_requests
    _BONHAMS_IMPERSONATE = "chrome"
    _BONHAMS_FETCH_OK = True
except ImportError:
    _curl_cffi_requests = None
    _BONHAMS_IMPERSONATE = None
    _BONHAMS_FETCH_OK = False


def _bonhams_fetch(url, accept="text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"):
    """Fetch one Bonhams URL via curl-cffi (Chrome TLS impersonation).
    Falls back to plain `requests` if curl-cffi isn't installed —
    expected only on dev machines where the Cloudflare-from-GHA
    challenge doesn't apply anyway.
    Returns the response object (compatible with requests.Response
    for .text / .json() / .raise_for_status() / .status_code)."""
    if _curl_cffi_requests is not None:
        return _curl_cffi_requests.get(
            url,
            impersonate=_BONHAMS_IMPERSONATE,
            headers={"Accept": accept, "Accept-Language": "en-US,en;q=0.9"},
            timeout=30,
        )
    return requests.get(url, headers={**HEADERS, "Accept": accept}, timeout=30)


def _bonhams_lot_to_record(lot, auction_obj, sale_url):
    """Map a Bonhams /_next/data auctionLots[] entry into the canonical
    auction-lot record shape (matches Christie's / Sotheby's / Phillips
    output). Returns None on missing identifiers — keeps the union
    file's URL keys well-formed."""
    if not isinstance(lot, dict):
        return None
    auction_id = lot.get("auctionId") or auction_obj.get("iSaleNo")
    lot_no = (lot.get("lotNo") or {}).get("full") or lot.get("lotId")
    slug = lot.get("slug") or ""
    if not (auction_id and lot_no and slug):
        return None
    url = f"https://www.bonhams.com/auction/{auction_id}/lot/{lot_no}/{slug}/"

    title = (lot.get("title") or "").strip() or ((lot.get("image") or {}).get("caption") or "").strip()
    if not title:
        return None

    # Watch-department filter. Bonhams cross-lists non-watch sales on the
    # watches department landing page — e.g. "Espionage: Fact and Fiction"
    # (books/gadgets; sale dept COL-ENT, lots BOK) — so the calendar scraper
    # picks them up. Keep only lots whose OWN department is Watches (code
    # starts "WCH"). This drops a non-watch sale entirely while still keeping
    # any genuine watch in a mixed sale; a lot with no dept is kept (we only
    # scrape watch-department sales, so unknown defaults to watch). Mark 2026-05-26.
    dept_code = ((lot.get("department") or {}).get("code") or "").upper()
    if dept_code and not dept_code.startswith("WCH"):
        return None

    # Brand group: Bonhams classifies lots into brand "groups" (e.g.
    # ['Rolex']). First group is the canonical maker for our purposes.
    groups = lot.get("groups") or []
    maker = groups[0] if groups else None

    price = lot.get("price") or {}
    currency = (lot.get("currency") or {}).get("iso_code") or "USD"
    low = price.get("estimateLow") or None
    high = price.get("estimateHigh") or None

    # hammerPremium is the realised all-in price (hammerPrice + buyer's
    # premium). Mirror how Phillips / Christie's emit `sold_price` —
    # the headline realised number, not the bare hammer.
    sold_price = price.get("hammerPremium") or None
    if sold_price == 0:
        sold_price = None

    # Status: per-lot flag, NOT the sale-level status. A single sale
    # can mix SOLD / BI / withdrawn lots.
    flags = lot.get("flags") or {}
    is_ended = bool(flags.get("isAuctionEnded")) or (sold_price is not None)
    status_raw = (lot.get("status") or "").upper()
    if status_raw in {"SOLD", "BI", "WITHDRAWN", "UNSOLD"}:
        is_ended = True

    image = (lot.get("image") or {}).get("url") or None

    auction_title = auction_obj.get("sSaleName")
    dates = auction_obj.get("dates") or {}
    start_obj = ((dates.get("start") or [{}])[0] or {}).get("date") or {}
    auction_start = start_obj.get("datetime")
    auction_end = (dates.get("end") or {}).get("datetime")

    return {
        "_url": url,
        "house": "Bonhams",
        "lot_id": lot.get("lotItemId") or lot.get("lotUniqueId"),
        "lot_number": str(lot_no),
        "title": title,
        "maker": maker,
        "reference_no": None,
        "model_name": None,
        "description": title[:600],
        "currency": currency,
        "estimate_low": low,
        "estimate_high": high,
        "starting_price": price.get("startingBidAmount") or None,
        "current_bid": None,
        "sold_price": sold_price,
        "estimate_low_usd":  to_usd(low,  currency),
        "estimate_high_usd": to_usd(high, currency),
        "starting_price_usd": to_usd(price.get("startingBidAmount") or 0, currency) or None,
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


def enumerate_bonhams(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for a Bonhams sale.

    Bonhams' Next.js front-end exposes the full per-sale lot list at
    `/_next/data/<buildId>/auction/<saleId>/<slug>.json?page=N` —
    each page returns 48 lots; auction.number_of_lots tells us how
    many pages to walk. Single JSON fetch per page; per-lot detail
    pages are NOT needed for catalog-level fields (title, brand,
    estimate, image, sold-price-incl-premium are all in the sale
    JSON).

    DORMANT IN CI — runs from a residential host. This enumerator is
    complete and correct, but Cloudflare now 403s Bonhams' lot pages from
    GitHub's datacenter IPs (confirmed via the source-probe workflow, #584),
    so when this runs in CI it returns []. It works fine from a residential
    IP: the residential host (B-25) drives it via `bonhams_lots_scraper.py`,
    which scopes to Bonhams and writes the separate `public/bonhams_lots.json`
    (CI's auction_lots.json sweep would otherwise drop Bonhams active lots).
    Reactivates in CI only if Bonhams' Cloudflare posture changes back. (It
    DID once work from CI — hence the wiring in ENUMERATORS; the block came
    later.) No per-lot fetches, so no WAF risk beyond the IP block itself.

    The buildId rotates on Bonhams deploys; we extract it from the
    sale-page HTML on every run so we're never stuck on a stale id.
    """
    try:
        r = _bonhams_fetch(sale_url)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Bonhams] sale page fetch failed: {e}")
        return []
    m = BONHAMS_BUILDID_RE.search(r.text)
    if not m:
        print("  [Bonhams] buildId not found in sale HTML")
        return []
    build_id = m.group(1)
    url_m = BONHAMS_SALE_URL_RE.search(sale_url)
    if not url_m:
        print(f"  [Bonhams] sale URL pattern not recognised: {sale_url}")
        return []
    sale_id, slug = url_m.group(1), url_m.group(2)
    json_url_base = (
        f"https://www.bonhams.com/_next/data/{build_id}/auction/{sale_id}/{slug}.json"
    )

    try:
        pr = _bonhams_fetch(json_url_base, accept="application/json")
        pr.raise_for_status()
        page1 = pr.json()
    except Exception as e:
        print(f"  [Bonhams] page-1 JSON fetch failed: {e}")
        return []
    pp = page1.get("pageProps", {}) or {}
    auction_obj = pp.get("auction") or {}
    total = auction_obj.get("number_of_lots") or 0
    lots = list((pp.get("lotData") or {}).get("auctionLots") or [])
    page_size = max(len(lots), 1)
    pages_needed = (total + page_size - 1) // page_size if total else 1
    print(f"  [Bonhams] sale {sale_id}: {total} lots across {pages_needed} page(s)")

    for page_idx in range(2, pages_needed + 1):
        try:
            time.sleep(PER_LOT_SLEEP_SECONDS)
            pr = _bonhams_fetch(
                f"{json_url_base}?page={page_idx}",
                accept="application/json",
            )
            pr.raise_for_status()
            payload = pr.json()
            page_lots = (payload.get("pageProps", {}).get("lotData") or {}).get("auctionLots") or []
            lots.extend(page_lots)
        except Exception as e:
            print(f"  [Bonhams] page {page_idx} fetch failed: {e}")
            continue

    out = []
    for lot in lots:
        rec = _bonhams_lot_to_record(lot, auction_obj, sale_url)
        if not rec:
            continue
        if is_excluded_title(rec.get("title")):
            continue
        # Structured-field extraction (reference_no / model / year /
        # case_material / etc.) via the shared per-house parser.
        try:
            extra = extract_lot_structured_fields("Bonhams", rec.get("title") or "", rec.get("description") or "")
            if isinstance(extra, dict):
                for k, v in extra.items():
                    if v and not rec.get(k):
                        rec[k] = v
        except Exception:
            pass
        # Canonical brand resolution (folds "Rolex SA" / "ROLEX" / etc
        # into "Rolex"). Skip when the groups field already labelled it.
        if not rec.get("maker"):
            try:
                brand = resolve_brand(rec)
                if brand:
                    rec["maker"] = brand
            except Exception:
                pass
        out.append((rec["_url"], rec))
    return [(u, {k: v for k, v in d.items() if not k.startswith("_")}) for u, d in out]


# ── Monaco Legend ───────────────────────────────────────────────────────

MLA_SECTION_RE = re.compile(
    r'<section\s+class="(lot[^"]*)"\s+'
    r'data-id="(\d+)"\s+data-num="(\d+)"\s+'
    r'data-est="([^"]*)"\s+data-year="([^"]*)"'
)
MLA_TITLE_RE   = re.compile(r"<span class='lot-title'>([^<]+)</span>")
MLA_BRAND_RE   = re.compile(r"<span class='lot-brand'>([^<]+)</span>")
MLA_EST_RE     = re.compile(r"<p class='lot-estimation'>([^<]+)</p>")
MLA_SOLD_RE    = re.compile(r'<span class="bid-price">([^<]+)</span>')
MLA_IMG_RE     = re.compile(r'(https://cdn\.monacolegendauctions\.com/[a-z0-9-]+)/')
MLA_URL_RE     = re.compile(r'href="(https://www\.monacolegendauctions\.com/auction/[^"]+/lot-\d+)"')


def _mla_parse_estimation(text):
    """Monaco Legend estimation strings come in three currency flavours:
        'Fr. 25\\'000 \xe2\x80\x93\xe2\x81\xa8 50\\'000'   (CHF, apostrophe-separated)
        '\xe2\x82\xac 8.000 \xe2\x80\x93\xe2\x81\xa8 16.000'      (EUR, dot-separated)
        'US$ 5,000 - 10,000'                  (rare; comma-separated)
    Returns (currency_iso, low_int, high_int) — None values on parse fail.
    """
    if not text:
        return None, None, None
    # Unescape HTML entities FIRST. Monaco Legend renders the CHF thousands
    # separator as the numeric entity `&#039;` (apostrophe), e.g.
    # `Fr.\xa032&#039;500` — if left raw, the number regex below stops at
    # the `&` and reads only "32" (B-70: sold prices came out ~1000× too
    # small, CHF 32'500 → 32). unescape() turns &#039;→' (in the separator
    # class), &#8211;→– etc., so the explicit replaces are now belt-and-braces.
    text = unescape(text)
    # HTML entity normalise + collapse whitespace
    t = (text.replace("&#8211;", "-").replace("&#8288;", "")
              .replace("–", "-").replace("—", "-").replace("⁠", "")
              .replace("\xa0", " "))
    t = re.sub(r"\s+", " ", t).strip()
    # Detect currency from leading token
    currency = None
    if t.startswith("Fr"):
        currency = "CHF"
    elif t.startswith("€") or t.startswith("EUR"):
        currency = "EUR"
    elif t.startswith("US$") or t.startswith("$"):
        currency = "USD"
    elif t.startswith("\xa3") or t.startswith("GBP"):
        currency = "GBP"
    # Strip the currency token before number parsing
    body = re.sub(r"^(?:Fr\.|€|EUR|US\$|\$|GBP|\xa3)\s*", "", t, flags=re.I)
    # Drop apostrophe/dot/space thousand separators, keep digits + dash
    nums = re.findall(r"\d[\d',. ]*", body)
    def _clean(n):
        # Keep digits only — apostrophes, dots, commas, spaces are all
        # thousand separators across the three formats Monaco Legend uses
        digits = re.sub(r"[^\d]", "", n)
        return int(digits) if digits else None
    if len(nums) >= 2:
        return currency, _clean(nums[0]), _clean(nums[1])
    if len(nums) == 1:
        v = _clean(nums[0])
        return currency, v, v
    return currency, None, None


def _mla_parse_sold_price(text, currency_hint=None):
    """Sold-price string like ' € 9.750' or 'Fr. 9\\'750'. Returns
    (currency_iso, amount_int) — currency falls back to hint."""
    if not text:
        return currency_hint, None
    # Unescape entities first — the CHF separator is `&#039;` (apostrophe);
    # without this the number regex truncates "32&#039;500" to 32 (B-70).
    text = unescape(text)
    t = (text.replace("&#8211;", "-").replace("&#8288;", "")
              .replace("–", "-").replace("\xa0", " "))
    t = re.sub(r"\s+", " ", t).strip()
    cur = currency_hint
    if t.startswith("Fr"):
        cur = "CHF"
    elif t.startswith("€"):
        cur = "EUR"
    elif t.startswith("US$") or t.startswith("$"):
        cur = "USD"
    body = re.sub(r"^(?:Fr\.|€|EUR|US\$|\$|GBP|\xa3)\s*", "", t, flags=re.I)
    nums = re.findall(r"\d[\d',. ]*", body)
    if nums:
        digits = re.sub(r"[^\d]", "", nums[0])
        return cur, (int(digits) if digits else None)
    return cur, None


def enumerate_monaco_legend(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for a Monaco Legend sale.

    Monaco Legend's site is Laravel + Livewire — fully server-rendered
    HTML where every lot appears as a `<section class="lot[ sold[
    reserved[ temp-import]]]" data-id data-num data-est data-year>`.
    Inside each section live:
      <span class='lot-brand'>...</span>
      <span class='lot-title'>...</span>
      <p class='lot-estimation'>Fr. 25'000 – 50'000</p>
      <span class="bid-price"> € 9.750</span>     (past sales only)
      <a href=".../auction/<slug>/lot-<N>">

    One sale-page fetch covers every lot — typical sale is 100-300
    lots, the HTML weighs in around 1.3-1.7 MB. No per-lot fetches
    needed for catalog-level fields; the manual-URL `scrape_monaco_
    legend_lot` path remains for richer per-lot data (full description,
    additionalProperty list, etc.) when Mark tracks specific lots.

    Pre-2026-05-22 CLAUDE.md described MLA as "SPA, no server-rendered
    lot list" — that was stale (or about an earlier version of the
    site). Today MLA is genuinely server-rendered with clean
    structural anchors.
    """
    try:
        r = requests.get(sale_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Monaco Legend] sale page fetch failed: {e}")
        return []
    html = r.text

    sections = list(MLA_SECTION_RE.finditer(html))
    if not sections:
        print("  [Monaco Legend] no <section class=\"lot\"> blocks found")
        return []
    print(f"  [Monaco Legend] {len(sections)} lot section(s) on sale page")

    auction_title = (sale or {}).get("title") or ""
    auction_end = (sale or {}).get("dateEnd") or (sale or {}).get("dateStart") or None

    out = []
    for i, m in enumerate(sections):
        cls, lot_id, lot_num, est_low_field, year = m.groups()
        end_idx = sections[i + 1].start() if i + 1 < len(sections) else m.start() + 8000
        block = html[m.start():end_idx]

        url_m = MLA_URL_RE.search(block)
        if not url_m:
            continue
        url = url_m.group(1)

        title_m = MLA_TITLE_RE.search(block)
        brand_m = MLA_BRAND_RE.search(block)
        est_m   = MLA_EST_RE.search(block)
        sold_m  = MLA_SOLD_RE.search(block)
        img_m   = MLA_IMG_RE.search(block)

        title = (title_m.group(1) if title_m else "").replace("&quot;", '"').strip()
        brand = (brand_m.group(1) if brand_m else "").strip() or None
        estimation_raw = (est_m.group(1) if est_m else "").strip()
        currency, low, high = _mla_parse_estimation(estimation_raw)

        sold_currency, sold_price = (None, None)
        if "sold" in cls.lower() and sold_m:
            sold_currency, sold_price = _mla_parse_sold_price(sold_m.group(1), currency)

        status = "ended" if "sold" in cls.lower() else "active"
        currency = sold_currency or currency or "EUR"   # MLA's primary currency

        display_title = title
        if brand and not display_title.lower().startswith(brand.lower()):
            display_title = f"{brand}. {display_title}"
        if not display_title:
            display_title = brand or "Untitled"

        if is_excluded_title(display_title):
            continue

        image = (img_m.group(1) if img_m else None)

        rec = {
            "house": "Monaco Legend",
            "lot_id": lot_id,
            "lot_number": lot_num,
            "title": display_title[:240],
            "maker": brand,
            "reference_no": None,
            "model_name": None,
            "description": display_title[:600],
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
            "image": image,
            "auction_title": auction_title,
            "auction_start": (sale or {}).get("dateStart"),
            "auction_end":   auction_end,
            "auction_url":   sale_url,
            "scraped_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        # Structured-field extraction (reference_no / model / year /
        # case_material) via the shared per-house parser.
        try:
            extra = extract_lot_structured_fields("Monaco Legend", rec.get("title") or "", rec.get("description") or "")
            if isinstance(extra, dict):
                for k, v in extra.items():
                    if v and not rec.get(k):
                        rec[k] = v
        except Exception:
            pass
        # Canonical brand resolution — fold "Rolex SA" / "ROLEX" etc into "Rolex".
        if rec.get("maker"):
            try:
                bb = resolve_brand(rec)
                if bb:
                    rec["maker"] = bb
            except Exception:
                pass

        out.append((url, rec))
    return out


def _strip_html(s):
    """Strip HTML tags, collapse whitespace. Used for Sotheby's essay
    fields which arrive as HTML-formatted prose."""
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.IGNORECASE)
    s = re.sub(r"</p\s*>", "\n\n", s, flags=re.IGNORECASE)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">")
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def _extract_christies_essay(html):
    """Pull the "Lot Essay" content from a Christie's detail page.

    Structure (verified 2026-05-19):
      <h2 class="chr-lot-article__title">Lot Essay</h2>
      <chr-readmore-expander ...>
          <div class="content-zone chr-body">
              ESSAY TEXT
          </div>
      </chr-readmore-expander>

    The header + readmore wrapper varies per lot; what's stable is
    the `<h2 ...>Lot Essay</h2>` anchor followed by the next
    `<div class="content-zone chr-body">…</div>`. Returns "" when
    the page doesn't have a Lot Essay (most lots don't).
    """
    if not html:
        return ""
    # Find the Lot Essay header, then the next content-zone block
    # after it.
    m = re.search(r'<h2[^>]*chr-lot-article__title[^>]*>\s*Lot Essay\s*</h2>(.*?)</section>', html, re.DOTALL | re.IGNORECASE)
    if not m:
        return ""
    after = m.group(1)
    inner = re.search(r'<div[^>]*content-zone[^>]*chr-body[^>]*>(.*?)</div>', after, re.DOTALL)
    if not inner:
        return ""
    return _strip_html(inner.group(1))


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
        # Keep the 0 <= idx < len(arr) bounds-check — the payload has -N sentinels (deferred/pending markers); without the guard they become out-of-bounds resolves that silently nuke values.
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
        "reference_no": (lot.get("referenceNo") or "").strip() or None,
        "model_name": model or None,
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


# ── Watches of Knightsbridge ────────────────────────────────────────────
# WoK runs on the Metropress / ab-initio auction platform (UK). Each sale
# page renders all lots inline (~60 lots in ~720 KB of HTML) — no JS
# execution, no API call needed. Same shape across upcoming + past sales,
# so one enumerator covers both. Currency is GBP. See
# watchesofknightsbridge_auctions_scraper.py for the calendar side.

# Each lot is wrapped in `<div id="lot-list-item-<UUID>" class="card
# lot-list-item ..." data-auction-id="..." data-auction-ref="..."
# data-lot-id="<UUID>" ...>` — we split on the next `data-lot-id` so the
# block body covers everything up to the following lot (or end-of-grid).
_WOK_LOT_BLOCK_RE = re.compile(
    r'data-lot-id="(?P<lot_id>[0-9a-f-]+)"(?P<body>.*?)'
    r'(?=data-lot-id="[0-9a-f-]+"|<div\s+class="footer\b|</section>|<footer)',
    re.S,
)
# Lot-card opener class string — drives post-sale state detection
# because WoK hides hammer prices from anonymous viewers (see B-62).
# Post-sale the page strips the `current-bid-value` span entirely; the
# only public signal of outcome is the lot card's CSS class list:
#   • `lot-status-closed` → sale ended for this lot
#   • `has-current-bid`   → bids received → sold (price gated)
#   • absence of both     → still live or pre-sale
_WOK_LOT_OPENER_RE = re.compile(
    r'<div\s+id="lot-list-item-(?P<uuid>[0-9a-f-]+)"\s+class="(?P<cls>[^"]+)"',
)
_WOK_LOT_NUMBER_RE = re.compile(r'class="meta lot-number"[^>]*>\s*([^<]+?)\s*<', re.S)
_WOK_LOT_TITLE_RE = re.compile(
    r'<a[^>]*name="lot-title"[^>]*>(?P<t>[^<]+)</a>', re.S,
)
_WOK_LOT_IMAGE_RE = re.compile(
    r'<img[^>]*class="lot-grid-image"[^>]*src="(?P<src>https://cdn\.globalauctionplatform\.com/[^"]+)"',
    re.S,
)
_WOK_LOT_DESCRIPTION_RE = re.compile(
    r'<span class="lot-description-value">(?P<d>.*?)</span>', re.S,
)
_WOK_LOT_ESTIMATE_RE = re.compile(
    r'class="[^"]*estimate-price-value[^"]*"[^>]*>\s*<span>\s*(?P<text>[^<]+?)\s*</span>',
    re.S,
)
_WOK_LOT_CURRENT_BID_RE = re.compile(
    r'<span class="current-bid-value"[^>]*data-current-bid="(?P<v>[0-9.]+)"',
)
_WOK_LOT_OPENING_BID_RE = re.compile(
    r'<span class="opening-bid-value">(?P<v>[0-9,.]+)</span>',
)
_WOK_LOT_HREF_RE = re.compile(
    r'href="(?P<href>/auctions/\d+/[a-zA-Z0-9_-]+/lot-details/[0-9a-f-]+)"',
)
_WOK_ESTIMATE_NUMS_RE = re.compile(
    r'([0-9][0-9,]*)\s*-\s*([0-9][0-9,]*)\s*(GBP|USD|EUR|CHF)?', re.I,
)
# Auction-level date hint embedded in each lot's footer.
_WOK_AUCTION_DATE_RE = re.compile(r'Auction date\(s\):\s*([^<]+?)\s*<', re.S)


def _wok_to_int(s):
    if not s:
        return None
    s = s.replace(",", "").strip()
    if not s:
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def _wok_clean_text(s):
    if not s:
        return ""
    s = unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def enumerate_watchesofknightsbridge(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for one WoK auction.

    Fetches the auction page once and parses the inline lot grid — same
    pattern across live + past sales. The page is server-rendered so no
    Playwright.

    Post-sale price quirk (B-62): WoK gates hammer prices behind a
    registered-bidder login. Once a sale closes, the `current-bid-value`
    span is stripped from the public HTML entirely; only the lot card's
    CSS class flags remain to indicate outcome:
      • `lot-status-closed` + `has-current-bid` → sold (price withheld)
      • `lot-status-closed` without `has-current-bid` → unsold/passed
      • no `lot-status-closed` → still active (pre-sale or in progress)
    We emit `status` accordingly + `lot_outcome` for fine-grained
    discrimination, and stamp a `catalogue_note` on sold lots so
    downstream surfaces can render "Sold (hammer withheld)" instead of
    leaving the lot in a confusing "ended without a price" state.
    """
    sale = sale or {}
    try:
        r = requests.get(sale_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [WoK] auction page fetch failed: {e}")
        return []
    html = r.text

    # Auction-level metadata: prefer the calendar's authoritative dates,
    # fall back to the date string embedded in each lot footer.
    auction_start = sale.get("dateStart") or sale.get("date_start") or ""
    auction_end = sale.get("dateEnd") or sale.get("date_end") or auction_start
    if not auction_start:
        dm = _WOK_AUCTION_DATE_RE.search(html)
        if dm:
            # "06 Jun" / "06 Jun 2026" — parse defensively, year may be missing.
            txt = dm.group(1).strip()
            ym = re.match(r"(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?", txt)
            if ym:
                year = ym.group(3) or str(date.today().year)
                try:
                    auction_start = datetime.strptime(
                        f"{ym.group(1)} {ym.group(2)} {year}", "%d %b %Y"
                    ).date().isoformat()
                    auction_end = auction_start
                except ValueError:
                    pass
    auction_title = (sale.get("title") or "Modern, Vintage & Military Timepieces").strip()

    today = date.today()
    sale_ended = False
    if auction_end:
        try:
            sale_ended = date.fromisoformat(auction_end) < today
        except ValueError:
            pass

    matches = list(_WOK_LOT_BLOCK_RE.finditer(html))
    if not matches:
        print("  [WoK] no lot blocks found in page HTML")
        return []

    # Load prior auction_lots.json once. WoK strips the
    # estimate-price-value span from sold lots' grid blocks post-sale
    # (only unsold lots keep it visible) — re-scraping would otherwise
    # regress fields we already captured pre-sale. Use prior values as
    # a fallback for any field the current scrape returns empty.
    prior_by_url: dict = {}
    try:
        if os.path.exists(OUTPUT_JSON):
            with open(OUTPUT_JSON) as _pf:
                prior_by_url = json.load(_pf) or {}
            if not isinstance(prior_by_url, dict):
                prior_by_url = {}
    except Exception as e:
        print(f"  [WoK] couldn't read prior {OUTPUT_JSON}: {e}")
        prior_by_url = {}

    # Pre-pass: harvest each lot card's outer class string by UUID so
    # the body-side loop can read post-sale state flags. The opener
    # sits BEFORE the `data-lot-id` attribute we split on, so it's not
    # inside `body`.
    class_by_uuid = {
        om.group("uuid"): om.group("cls")
        for om in _WOK_LOT_OPENER_RE.finditer(html)
    }

    # If the sale has ended, the live page hides hammer prices but the
    # parallel `/past-auctions/<slug>` archive exposes them publicly
    # via `data-current-bid="N.0"`. Fetch and harvest by UUID; the
    # body loop below uses the map to fill `sold_price` per lot.
    hammer_by_uuid: dict = {}
    if sale_ended or any("lot-status-closed" in c for c in class_by_uuid.values()):
        m_slug = re.search(r"/auctions/\d+/([A-Za-z0-9_-]+)", sale_url)
        slug = m_slug.group(1) if m_slug else None
        if slug:
            archive_url = f"https://auctions.watchesofknightsbridge.com/past-auctions/{slug}"
            try:
                ar = requests.get(archive_url, headers=HEADERS, timeout=30)
                if ar.ok:
                    for am in re.finditer(
                        r'data-lot-id="(?P<uuid>[0-9a-f-]+)"[\s\S]*?data-current-bid="(?P<bid>[0-9.]+)"',
                        ar.text,
                    ):
                        try:
                            v = int(float(am.group("bid")))
                        except (ValueError, TypeError):
                            continue
                        if v > 0:
                            hammer_by_uuid[am.group("uuid")] = v
                    print(f"  [WoK] archive merge: {len(hammer_by_uuid)} hammer prices recovered from {archive_url}")
                else:
                    print(f"  [WoK] archive fetch HTTP {ar.status_code} — falling back to withheld")
            except Exception as e:
                print(f"  [WoK] archive fetch failed: {e}")

    out = []
    for m in matches:
        body = m.group("body")
        lot_id = m.group("lot_id")
        lot_classes = class_by_uuid.get(lot_id, "")

        tm = _WOK_LOT_TITLE_RE.search(body)
        title = _wok_clean_text(tm.group("t")) if tm else ""
        if not title or is_excluded_title(title):
            continue

        href_m = _WOK_LOT_HREF_RE.search(body)
        if not href_m:
            continue
        url = f"https://auctions.watchesofknightsbridge.com{href_m.group('href')}"

        lot_number = ""
        nm = _WOK_LOT_NUMBER_RE.search(body)
        if nm:
            lot_number = _wok_clean_text(nm.group(1))

        image = None
        im = _WOK_LOT_IMAGE_RE.search(body)
        if im:
            # Drop the `?h=N` size suffix so downstream image proxy can
            # apply its own size policy (same convention as the calendar
            # scraper).
            image = im.group("src").split("?")[0]

        description = ""
        dm2 = _WOK_LOT_DESCRIPTION_RE.search(body)
        if dm2:
            description = _wok_clean_text(re.sub(r"<[^>]+>", " ", dm2.group("d")))[:2500]

        estimate_low = estimate_high = None
        currency = "GBP"
        em = _WOK_LOT_ESTIMATE_RE.search(body)
        if em:
            est_text = em.group("text")
            ne = _WOK_ESTIMATE_NUMS_RE.search(est_text)
            if ne:
                estimate_low = _wok_to_int(ne.group(1))
                estimate_high = _wok_to_int(ne.group(2))
                if ne.group(3):
                    currency = ne.group(3).upper()

        current_bid = None
        cm = _WOK_LOT_CURRENT_BID_RE.search(body)
        if cm:
            v = _wok_to_int(cm.group("v"))
            if v and v > 0:
                current_bid = v

        starting_price = None
        om = _WOK_LOT_OPENING_BID_RE.search(body)
        if om:
            v = _wok_to_int(om.group("v"))
            if v and v > 0:
                starting_price = v

        # Sold-price heuristic — see the function docstring on B-62.
        # The class flags are authoritative once a sale closes; the
        # date-based check is a backstop for the brief window after
        # close before the page re-renders with `lot-status-closed`.
        class_closed = "lot-status-closed" in lot_classes
        has_current_bid = "has-current-bid" in lot_classes
        ended = class_closed or sale_ended

        if ended and has_current_bid:
            # Prefer the archive surface's hammer when we have it; fall
            # back to `current_bid` (in case a pre-close state leaked
            # it) or mark as withheld so the frontend can render
            # "Sold (hammer withheld)" cleanly.
            archive_hammer = hammer_by_uuid.get(lot_id)
            sold_price = archive_hammer or current_bid or None
            lot_outcome = "sold" if sold_price else "sold_price_withheld"
        elif ended:
            sold_price = None
            lot_outcome = "unsold"
        else:
            sold_price = None
            lot_outcome = "active"

        status = "ended" if ended else "active"
        catalogue_note = ""
        if lot_outcome == "sold_price_withheld":
            catalogue_note = (
                "Sold — hammer price not published. "
                "Watches of Knightsbridge gates realised prices behind "
                "a registered-bidder login (B-62)."
            )
        elif lot_outcome == "unsold":
            catalogue_note = "Did not sell (no bids received at close)."

        data = {
            "house": "Watches of Knightsbridge",
            "lot_id": lot_id,
            "lot_number": lot_number,
            "title": title,
            "description": description,
            "catalogue_note": catalogue_note,
            "provenance": "",
            "literature": "",
            "exhibition": "",
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
            "image": image,
            "auction_title": auction_title,
            "auction_start": auction_start or None,
            "auction_end":   auction_end or None,
            "auction_url":   sale_url,
            "auction_date_label": (sale.get("dateLabel") or auction_start or None),
            "lot_outcome": lot_outcome,
            "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        # Fall back to prior-record values for fields the post-sale
        # grid strips. The estimate-price-value span is removed from
        # SOLD lots' grid blocks (only unsold lots keep it inline);
        # description is hidden behind `display:none`. We never want
        # a post-sale re-scrape to lose pre-sale data.
        prior = prior_by_url.get(url) if isinstance(prior_by_url.get(url), dict) else None
        if prior:
            for k in ("estimate_low", "estimate_high",
                      "estimate_low_usd", "estimate_high_usd",
                      "description", "image"):
                if not data.get(k) and prior.get(k):
                    data[k] = prior[k]

        out.append((url, data))

    return out


# ── Marteau & Co ────────────────────────────────────────────────────────
# Geneva-based timed-auction house for contemporary independent watchmaking.
# Custom Tandem Auctions stack (jQuery / Bootstrap); the lot grid renders
# inline at `<base>/<slug>/catalogue`, so one HTTP request per sale. CHF
# currency with a U+2019 (right single quote) thousands separator —
# "4'000" really comes through as "4’000". See
# marteauandco_auctions_scraper.py for the calendar side.

_MAR_LOT_BLOCK_RE = re.compile(
    r'<div id="(?P<lot_id>\d{4})" class="card h-100" data-ln="\d{4}">'
    r'(?P<body>.*?)'
    r'(?=<div id="\d{4}" class="card h-100" data-ln="\d{4}">|<h3 class="m-3">|</main>)',
    re.S,
)
_MAR_LOT_HREF_RE = re.compile(r'<a[^>]+href="(?P<href>/[A-Za-z0-9_-]+/catalogue/\d{4})"')
_MAR_LOT_IMAGE_RE = re.compile(
    r'data-src="(?P<src>https://t4p7b9\.tandemauctions\.com/[^"]+)"'
)
_MAR_LOT_TITLE_RE = re.compile(
    r'<p class="card-text">\s*(?P<t>[^<]+?)\s*<br',
    re.S,
)
_MAR_LOT_ESTIMATE_RE = re.compile(
    r'<small class="estimate">\s*Estimate:\s*(?P<text>[^<]+?)\s*</small>',
    re.S,
)
_MAR_LOT_STARTING_BID_RE = re.compile(
    r'<strong>\s*Starting Bid:\s*(?P<text>[^<]+?)\s*</strong>',
    re.S,
)
_MAR_LOT_REALISED_RE = re.compile(
    r'<div class="card-footer realised">\s*Realised:\s*(?P<text>[^<]+?)\s*<small>',
    re.S,
)
_MAR_LOT_CLOSE_RE = re.compile(r'data-close="(?P<iso>[0-9TZ:.\-]+)"')
# Currency + amount: "CHF 4'000" or "CHF 4’000" or "CHF 102'000" etc.
# Marteau is CHF-only today; pattern allows EUR/USD/GBP for safety.
_MAR_PRICE_RE = re.compile(
    r"(?P<cur>CHF|USD|EUR|GBP)\s*(?P<num>[0-9][0-9,’'\s]*)",
    re.I,
)


def _mar_clean_text(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", unescape(s)).strip()


def _mar_parse_price(text):
    """Extract (amount_int, currency) from a 'CHF 4'000' style string.
    Strips U+2019 / apostrophe / comma thousands separators."""
    if not text:
        return None, None
    m = _MAR_PRICE_RE.search(unescape(text))
    if not m:
        return None, None
    raw = m.group("num").replace(",", "").replace("’", "").replace("'", "").strip()
    if not raw:
        return None, m.group("cur").upper()
    try:
        return int(float(raw)), m.group("cur").upper()
    except ValueError:
        return None, m.group("cur").upper()


def _mar_parse_estimate(text):
    """'CHF 500 - CHF 1’000' → (500, 1000, 'CHF')."""
    if not text:
        return None, None, None
    text = unescape(text)
    parts = re.split(r"\s+-\s+|\s+to\s+", text, maxsplit=1)
    if len(parts) != 2:
        amt, cur = _mar_parse_price(text)
        return amt, amt, cur
    low, cur1 = _mar_parse_price(parts[0])
    high, cur2 = _mar_parse_price(parts[1])
    return low, high, cur1 or cur2 or "CHF"


def enumerate_marteauandco(sale_url, sale=None):
    """Return a list of (url, lot dict) tuples for one Marteau & Co sale.

    Fetches `<sale_url>/catalogue` once and parses the inline lot cards.
    Realised prices on past sales include the buyer premium (20% per
    Marteau's terms) — we record the realised value as-given but flag
    it in `catalogue_note` so downstream surfaces don't confuse it with
    hammer-only prices from the other comprehensive houses.
    """
    sale = sale or {}
    catalogue_url = sale_url.rstrip("/") + "/catalogue"
    try:
        r = requests.get(catalogue_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Marteau] catalogue fetch failed: {e}")
        return []
    html = r.text

    auction_start = sale.get("dateStart") or sale.get("date_start") or ""
    auction_end = sale.get("dateEnd") or sale.get("date_end") or auction_start
    auction_title = (sale.get("title") or "Marteau & Co Timed Auction").strip()

    today = date.today()
    sale_ended = False
    if auction_end:
        try:
            sale_ended = date.fromisoformat(auction_end) < today
        except ValueError:
            pass

    out = []
    for m in _MAR_LOT_BLOCK_RE.finditer(html):
        body = m.group("body")
        lot_number = m.group("lot_id")

        href_m = _MAR_LOT_HREF_RE.search(body)
        if not href_m:
            continue
        url = "https://auctions.marteauandco.com" + href_m.group("href")

        tm = _MAR_LOT_TITLE_RE.search(body)
        title = _mar_clean_text(tm.group("t")) if tm else ""
        if not title or is_excluded_title(title):
            continue

        # Image: card grid only serves the small (`/sm/`) variant — swap
        # to `/md/` so the listings tile has reasonable resolution
        # (~720px) without forcing a full XL fetch per card.
        image = None
        im = _MAR_LOT_IMAGE_RE.search(body)
        if im:
            image = im.group("src").replace("/sm/", "/md/")

        estimate_low = estimate_high = None
        currency = "CHF"
        em = _MAR_LOT_ESTIMATE_RE.search(body)
        if em:
            estimate_low, estimate_high, cur = _mar_parse_estimate(em.group("text"))
            if cur:
                currency = cur

        starting_price = None
        sm = _MAR_LOT_STARTING_BID_RE.search(body)
        if sm:
            v, cur = _mar_parse_price(sm.group("text"))
            if v and v > 0:
                starting_price = v
            if cur:
                currency = cur

        realised = None
        rm = _MAR_LOT_REALISED_RE.search(body)
        if rm:
            v, cur = _mar_parse_price(rm.group("text"))
            if v and v > 0:
                realised = v
            if cur:
                currency = cur

        # Status: past sales have `realised`; live/upcoming have a
        # `data-close` timestamp + a `Starting Bid` line. Use the
        # calendar's dateEnd as the source of truth (matches the
        # convention in enumerate_watchesofknightsbridge).
        status = "ended" if (sale_ended or realised) else "active"
        sold_price = realised if status == "ended" else None
        catalogue_note = (
            "Realised price includes buyer premium (Marteau terms: 20% + VAT)."
            if sold_price else ""
        )

        close_iso = None
        cm = _MAR_LOT_CLOSE_RE.search(body)
        if cm:
            close_iso = cm.group("iso")

        data = {
            "house": "Marteau & Co",
            "lot_id": lot_number,
            "lot_number": lot_number.lstrip("0") or lot_number,
            "title": title,
            "description": "",  # rich description lives on per-lot detail
                                # page; populated by a follow-up enrichment.
            "catalogue_note": catalogue_note,
            "provenance": "",
            "literature": "",
            "exhibition": "",
            "currency": currency,
            "estimate_low": estimate_low,
            "estimate_high": estimate_high,
            "starting_price": starting_price,
            "current_bid": None,
            "sold_price": sold_price,
            "estimate_low_usd":   to_usd(estimate_low,   currency),
            "estimate_high_usd":  to_usd(estimate_high,  currency),
            "starting_price_usd": to_usd(starting_price, currency),
            "current_bid_usd":    None,
            "sold_price_usd":     to_usd(sold_price,     currency),
            "status": status,
            "image": image,
            "auction_title": auction_title,
            "auction_start": auction_start or None,
            "auction_end":   auction_end or None,
            "auction_url":   sale_url,
            "auction_date_label": (sale.get("dateLabel") or auction_start or None),
            "closing_at": close_iso,
            "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        out.append((url, data))

    return out


# ── Helpers ─────────────────────────────────────────────────────────────

def _brace_match_json(text, start):
    """Walk balanced braces from `start` and return the substring that
    forms the outer JSON object. Mirrors the same brace counter used
    in tracked_lots_scraper.scrape_christies_lot — embedded strings can
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
    # Antiquorum: accepts either catalog OR live URL. The calendar
    # scraper falls back to live URLs when catalogs haven't been
    # published yet — see antiquorum_auctions_scraper.py.
    "Antiquorum":    (enumerate_antiquorum,  ("catalog.antiquorum.swiss", "live.antiquorum.swiss/auctions/")),
    "Bonhams":       (enumerate_bonhams,     ("bonhams.com/auction/",)),
    # `christies.com/en/auction/` = main live sales; `onlineonly.christies.com`
    # = the online-only editions (e.g. "Watches Online: The New York Edit"),
    # whose calendar link is an `sso?SaleID=…` that 302s into that host (B-73).
    # Both route to enumerate_christies (it detects the platform internally).
    # The dispatch needle was the missing half of B-73: enumerate_christies
    # learned the online-only payload, but main() never routed the sale to it.
    "Christie's":    (enumerate_christies,   ("christies.com/en/auction/", "onlineonly.christies.com/")),
    "Monaco Legend": (enumerate_monaco_legend, ("monacolegendauctions.com/auction/",)),
    "Sotheby's":     (enumerate_sothebys,    ("sothebys.com/en/buy/auction/",)),
    "Phillips":      (enumerate_phillips,    ("phillips.com/auction/",)),
    # Watches of Knightsbridge: matches both upcoming (`/auctions/<id>/<slug>`)
    # and archived (`/past-auctions/<slug>`) URL shapes — the calendar
    # scraper prefers the live form when both exist, but old archived
    # sales fall back to the past-auctions path.
    "Watches of Knightsbridge": (
        enumerate_watchesofknightsbridge,
        ("auctions.watchesofknightsbridge.com/auctions/",
         "auctions.watchesofknightsbridge.com/past-auctions/"),
    ),
    # Marteau & Co: every sale URL is `auctions.marteauandco.com/<slug>`
    # (e.g. /Jun-2026). The calendar scraper never emits the listing
    # paths (/upcoming-auctions, /previous-auctions) so a single host
    # needle is enough.
    "Marteau & Co": (
        enumerate_marteauandco,
        ("auctions.marteauandco.com/",),
    ),
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
    if "bonhams.com/" in url and "/lot/" in url:
        return (url, scrape_bonhams_lot(url))
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
        # Mixed jewellery-and-watches sales reach us whole; their
        # non-watch lots are dropped here, where the sale title is in hand.
        lots, n_jewellery = drop_jewellery_lots(lots, sale.get("title"))
        if n_jewellery:
            print(f"  {n_jewellery} jewellery lot(s) dropped (mixed sale)")
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

    # Attach structured-field extractions (reference_no, model_name,
    # case_no, movement_no, year_circa, dial, calibre, case_material,
    # case_size, signed, accessories) from the per-house parsers.
    # Done post-construction so the per-house enumerator blocks stay
    # focused on their own concerns, AND so Phillips' inline emission
    # (already in _phillips_lot_to_record) isn't double-handled — the
    # parser is a no-op for Phillips and only fills empties otherwise.
    enriched = 0
    brand_set = 0
    for url, rec in out.items():
        if not isinstance(rec, dict):
            continue
        fields = extract_lot_structured_fields(
            rec.get("house"), rec.get("title", ""), rec.get("description", "")
        )
        added = False
        for k, v in (fields or {}).items():
            if not rec.get(k):
                rec[k] = v
                added = True
        if added:
            enriched += 1
        # Set canonical brand (Phillips/Sotheby's have `maker` already;
        # Christie's + Antiquorum need title inference). Listings.json
        # already carries `brand` on every dealer item — we want auction
        # lots to use the same vocabulary so frontend filters /
        # reference-index matching work uniformly across surfaces.
        if not rec.get("brand"):
            b = resolve_brand(rec)
            if b:
                rec["brand"] = b
                brand_set += 1
    print(f"Enriched {enriched} lots with parsed structured fields")
    print(f"Set brand on {brand_set} lots (canonical inference)")

    print(f"\nTotal lots: {len(out)}")
    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
