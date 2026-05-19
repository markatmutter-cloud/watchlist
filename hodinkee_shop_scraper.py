#!/usr/bin/env python3
"""Hodinkee Shop vintage-watches archive scraper.

DUAL-TRACK editorial + sold-archive source. Hodinkee ran a vintage
watch shop at shop.hodinkee.com from ~2016 through Feb 2023; the
collection is now frozen (~2,348 products, 99.96% sold) and stays
online indefinitely. Each product page carries 400-1100+ words of
collector-grade prose plus a structured "Fine Print" block with
Maker / Model / Reference / Year / Caliber / Dimensions / Material
/ Lume / Box+Papers / etc.

  Editorial corpus side  — same schema as the other editorial
                           sources (hairspring_finds / bring_a_loupe
                           / rolex_magazine / onthedash / bulang).
                           Surfaces in Collecting > Editorial.

  Sold-archive side      — App.js projection in `hodinkeeShopItems`
                           (mirrors `hairspringFindsItems`) reads
                           the same JSON and emits listings-shaped
                           rows with sold=true, source=
                           "Hodinkee Shop", price from variants[0],
                           brand+ref+model from the Fine Print
                           parser fields below.

API: Shopify standard /collections/<handle>/products.json — clean
JSON with everything we need (body_html + variants + images + dates)
in a single response, no per-product detail fetch. 10 page fetches
at limit=250 cover the entire collection in ~8 seconds.

Run: python3 hodinkee_shop_scraper.py
Output: public/hodinkee_shop.json + public/hodinkee_shop_bodies.json
"""

from __future__ import annotations

import os
import re
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

import requests

try:
    from auction_lot_parsers import infer_brand
except ImportError:
    infer_brand = lambda _t: ""  # noqa: E731

try:
    from reference_index_match import (
        parse_index as _parse_index,
        build_ref_index as _build_ref_index,
        match_against_index as _match_against_index,
    )
    _INDEX_PATH = Path(__file__).parent / "docs" / "watch_references.md"
    _REF_INDEX_CACHE = None

    def _ref_index():
        global _REF_INDEX_CACHE
        if _REF_INDEX_CACHE is None and _INDEX_PATH.exists():
            _REF_INDEX_CACHE = _build_ref_index(_parse_index(_INDEX_PATH.read_text()))
        return _REF_INDEX_CACHE
except ImportError:
    _match_against_index = None
    def _ref_index():
        return None

from editorial_corpus_io import load_existing as _load_split, write_split, derive_bodies_path


BASE = "https://shop.hodinkee.com"
COLLECTION_PATH = "/collections/vintage-watches"
PRODUCTS_API = f"{BASE}{COLLECTION_PATH}/products.json"
OUTPUT_JSON = "public/hodinkee_shop.json"
OUTPUT_BODIES = derive_bodies_path(OUTPUT_JSON)
SOURCE = "hodinkee_shop"
SOURCE_TYPE = "dealer_archive"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json,*/*;q=0.9",
}

PAGE_SLEEP = 1.0          # Polite — Cloudflare in front of the shop.
PER_PAGE = 250            # Shopify max.

# Fine Print fields live inside body_html as
#   <span>Maker: Omega</span><br>
#   <span>Model: Railmaster</span><br>
#   <span>Reference: 2914-1</span><br>
# Order varies per article, but the labels are consistent. This
# regex pulls every `Label: value` pair out of the body before tag-
# stripping so we can populate structured fields on the meta record.
# Stops at `<` so HTML tags inside a value don't pollute it.
_FINE_PRINT_LINE_RE = re.compile(
    r"<(?:span|p|li|div|strong|b)[^>]*>\s*"
    r"(?P<label>"
    r"Maker|Brand|Model|Reference|Year|Case No|Movement No|Material|"
    r"Dimensions|Crystal|Lume|Caliber|Calibre|Bracelet/Strap|Bracelet|Strap|"
    r"Lug Width|Box/Papers|Condition"
    r")\s*[:.]\s*(?P<value>[^<]+?)\s*</",
    re.IGNORECASE,
)

_SCRIPT_STYLE_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _strip_to_text(html: str) -> str:
    if not html:
        return ""
    s = _SCRIPT_STYLE_RE.sub(" ", html)
    s = _TAG_RE.sub(" ", s)
    s = unescape(s)
    s = _WS_RE.sub(" ", s).strip()
    return s


def parse_fine_print(body_html: str) -> dict:
    """Walk the body and harvest every `Label: value` pair from the
    structured Fine Print block. Returns a dict keyed by normalized
    label names. Empty when the block isn't present (defensive — we
    expect 100% prevalence per the feasibility agent)."""
    out: dict[str, str] = {}
    if not body_html:
        return out
    for m in _FINE_PRINT_LINE_RE.finditer(body_html):
        label = m.group("label").strip().lower()
        value = unescape(m.group("value")).strip()
        if not value or value.lower() in ("n/a", "none", "-"):
            continue
        # First-write-wins — labels can appear twice if the body
        # repeats info (e.g. inside "Things to know"). The Fine
        # Print block comes earlier and is canonical.
        out.setdefault(label, value)
    return out


def _price_from_variants(variants) -> int:
    """Pick the first variant's price as the listing price. Returns
    integer dollars (Shopify returns string decimals)."""
    if not variants:
        return 0
    try:
        p = variants[0].get("price")
        if p is None:
            return 0
        return int(float(p))
    except (ValueError, TypeError):
        return 0


def _any_available(variants) -> bool:
    """sold == not any variant available."""
    if not variants:
        return False
    return any(v.get("available") for v in variants)


def _resolve_brand_and_ref(title: str, brand_hint: str, ref_hint: str) -> dict:
    """Run brand + reference inference. The Fine Print fields are
    the ground truth; this resolver augments them with the model_line
    / sub_model breakdown from the reference index when there's a
    match. Returns the full Hairspring-shaped resolver dict."""
    out = {
        "brand": (brand_hint or "").strip(),
        "reference_no": (ref_hint or "").strip() or None,
        "model": None,
        "sub_model": None,
        "model_line": None,
    }
    # If Fine Print didn't yield a brand, try the title.
    if not out["brand"]:
        out["brand"] = infer_brand(title) or ""

    # Run index matcher on `brand + ref` (most precise) then title
    # as fallback. Index match populates model / sub_model / model_line.
    ref_idx = _ref_index()
    if _match_against_index and ref_idx is not None:
        for probe in [
            f"{out['brand']} {out['reference_no']}".strip() if out["reference_no"] else "",
            title,
        ]:
            if not probe:
                continue
            hit = _match_against_index(probe, ref_idx)
            if hit:
                if not out["brand"]:
                    out["brand"] = hit.get("brand", "") or ""
                if not out["reference_no"]:
                    out["reference_no"] = hit.get("raw_ref")
                out["model"]      = hit.get("model")
                out["sub_model"]  = hit.get("sub_model")
                out["model_line"] = hit.get("model_line")
                break
    return out


def parse_product(p: dict) -> dict | None:
    """Build the editorial-record + sold-archive shape from one
    Shopify product object."""
    handle = (p.get("handle") or "").strip()
    if not handle:
        return None
    url = f"{BASE}{COLLECTION_PATH}/products/{handle}"

    title = (p.get("title") or "").strip()
    if not title:
        return None

    body_html = p.get("body_html") or ""
    body_text = _strip_to_text(body_html)
    if len(body_text) < 80:
        # Sub-floor short bodies — skip; agent confirms 98.7% are
        # ≥200 words, so this trims a handful of edge cases.
        return None

    fp = parse_fine_print(body_html)

    # Image — `images[0].src` is the hero per agent's sampling.
    images = p.get("images") or []
    image = ""
    if images:
        image = (images[0].get("src") or "").strip()

    variants = p.get("variants") or []
    sold_price = _price_from_variants(variants)
    is_sold = not _any_available(variants)

    # Dates — published_at is when the listing went live; created_at
    # is when the product was created in the catalog (essentially the
    # same on a frozen archive). soldAt is NOT truly known — Shopify
    # regenerates updated_at on every cache write — but published_at
    # is the cleanest sale-window anchor available.
    published_at = (p.get("published_at") or p.get("created_at") or "")[:10]
    updated_at   = (p.get("updated_at")   or published_at)[:10] or published_at

    brand_hint = (fp.get("maker") or fp.get("brand") or "").strip()
    ref_hint   = (fp.get("reference") or "").strip()
    resolved = _resolve_brand_and_ref(title, brand_hint, ref_hint)

    return {
        "url": url,
        "slug": handle,
        "title": title,
        # Hodinkee Shop doesn't carry per-product author bylines on
        # the writeups; the entire collection reads as house copy.
        "author": "Hodinkee Shop",
        "published_at": published_at,
        "updated_at":   updated_at,
        "image": image,
        "body_text": body_text,
        "word_count": len(body_text.split()),

        # Sold-archive surface (the projection in App.js reads these).
        # Hodinkee shut the shop Feb 2023; everything is sold.
        "sold_price_usd": sold_price,
        "currency": "USD",
        "is_sold": is_sold,

        # Structured Fine Print fields harvested from body_html.
        # Surfaces here so per-reference / per-brand filters work
        # without the App.js consumer having to re-parse the body.
        "brand":        resolved["brand"],
        "reference_no": resolved["reference_no"],
        "model":        resolved["model"],
        "sub_model":    resolved["sub_model"],
        "model_line":   resolved["model_line"],
        "year":         fp.get("year"),
        "case_size":    fp.get("dimensions"),  # e.g. "38mm diameter; 13.5mm thickness"
        "material":     fp.get("material"),
        "caliber":      fp.get("caliber") or fp.get("calibre"),
        "movement_no":  fp.get("movement no"),
        "case_no":      fp.get("case no"),
        "lume":         fp.get("lume"),
        "box_papers":   fp.get("box/papers"),

        "source": SOURCE,
        "source_type": SOURCE_TYPE,
        "scraped_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def fetch_page(page: int, retries: int = 2) -> list[dict] | None:
    """Fetch one products.json page. Returns the product list, or
    None on persistent failure."""
    for attempt in range(retries + 1):
        try:
            r = requests.get(
                PRODUCTS_API,
                params={"limit": PER_PAGE, "page": page},
                headers=HEADERS,
                timeout=30,
            )
            if r.status_code == 200:
                data = r.json()
                return data.get("products", []) or []
            print(f"  HTTP {r.status_code} on page {page}")
        except (requests.RequestException, ValueError) as e:
            print(f"  fetch error on page {page}: {e}")
        if attempt < retries:
            time.sleep(2 ** attempt)
    return None


def main():
    full_refresh = os.environ.get("HODINKEE_SHOP_FULL_REFRESH") == "1"
    print(f"Hodinkee Shop scraper (full_refresh={full_refresh})")
    existing = _load_split(OUTPUT_JSON, OUTPUT_BODIES)
    print(f"  existing entries on disk: {len(existing)}")

    out = dict(existing)
    page = 1
    total_new = 0
    total_seen = 0
    t0 = time.time()
    while True:
        products = fetch_page(page)
        if products is None:
            print(f"  page {page} failed after retries; stopping")
            break
        if not products:
            print(f"  page {page} empty — end of collection")
            break
        new_this_page = 0
        for p in products:
            rec = parse_product(p)
            if not rec:
                continue
            total_seen += 1
            if not full_refresh and rec["url"] in existing:
                # Already on disk + frozen collection — skip re-write.
                continue
            out[rec["url"]] = rec
            new_this_page += 1
        total_new += new_this_page
        print(f"  page {page}: {len(products)} products, {new_this_page} new (total parsed: {total_seen})")
        page += 1
        time.sleep(PAGE_SLEEP)

    elapsed = time.time() - t0
    write_split(out, OUTPUT_JSON, OUTPUT_BODIES)
    print(f"\nParsed: {total_seen}  New: {total_new}  Total on disk: {len(out)}  Elapsed: {elapsed:.1f}s")
    print(f"Wrote {OUTPUT_JSON} + {OUTPUT_BODIES}")


if __name__ == "__main__":
    main()
