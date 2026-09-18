#!/usr/bin/env python3
"""
Watches of Lancashire scraper — WooCommerce Store API, GBP.

UK dealer running WooCommerce. Standard Store API at
/wp-json/wc/store/v1/products — same pattern as Maunder, Watchurbia,
Menta, Grey & Patina. Filtered to the "watches" category at the API
level so any non-watch inventory (straps, accessories) doesn't leak
in. ~163 products today.

Run: python3 watchesoflancashire_scraper.py
Output: watchesoflancashire_listings.csv

Fetched via curl_cffi Chrome impersonation, NOT plain requests. The
site went behind Cloudflare's TLS-fingerprint check in 2026-08 and
started serving the "Just a moment..." interstitial (HTTP 403) to
`requests` from GitHub Actions — every run from 08-07 onward produced
no CSV. This is a JA3/TLS check, not an IP block: a probe from CI
confirmed plain requests 403s while `impersonate="chrome"` returns 200
with full data from the same runner. Use the floating "chrome" alias,
not a pinned one — "chrome124" was 403 in the same probe.
"""
import csv
import os
import re
import sys
import time

from curl_cffi import requests as cf_requests

import cf_clearance

BASE = "https://watchesoflancashire.com"
API = f"{BASE}/wp-json/wc/store/v1/products"
# Deliberately NO custom header set. curl_cffi's impersonation supplies
# the full Chrome header block (UA, sec-ch-ua, Accept, Accept-Language,
# ordering and all) to match the TLS fingerprint it presents. The old
# hand-rolled headers here — notably the short "Mozilla/5.0" UA that was
# the pre-Cloudflare workaround — OVERRIDE that block and leave a Chrome
# JA3 paired with a non-Chrome User-Agent. Cloudflare reads the mismatch
# and 403s: a CI probe carrying these headers still failed where the bare
# impersonated call returned 200. Referer is passed per-request instead.
SESSION = cf_requests.Session(impersonate="chrome")

BRANDS = [
    "Rolex", "Omega", "Patek Philippe", "Tudor", "Breitling", "IWC",
    "Cartier", "Jaeger-LeCoultre", "Panerai", "Audemars Piguet",
    "Vacheron Constantin", "A. Lange", "Tag Heuer", "Heuer",
    "Longines", "Universal Geneve", "Movado", "Zenith", "Breguet",
    "Blancpain", "Tissot", "Ebel", "Hamilton", "Seiko",
    "Grand Seiko", "Bulova", "Mido", "Oris", "Junghans", "Chopard",
    "Piaget", "Girard-Perregaux", "Eberhard",
]


def detect_brand(name, categories=None):
    lower = name.lower()
    for b in BRANDS:
        if b.lower() in lower:
            return b
    for cat in categories or []:
        cname = (cat.get("name") or "").lower()
        for b in BRANDS:
            if b.lower() in cname:
                return b
    return "Other"


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&#[0-9]+;", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _params(page, per_page):
    return {"per_page": per_page, "page": page,
            "status": "publish", "category": "watches"}


class Challenged(Exception):
    """The response was Cloudflare's interstitial, not our data."""


def fetch_page(page, per_page):
    """The cheap path: curl_cffi, no browser.

    Raises Challenged (rather than retrying into the ground) the moment
    the response is the interstitial — retrying a managed challenge is
    pure delay, it will never resolve without JavaScript.
    """
    last_err = None
    for attempt in range(3):
        try:
            r = SESSION.get(API, params=_params(page, per_page),
                            headers={"Referer": f"{BASE}/"}, timeout=20)
            if cf_clearance.looks_like_challenge(
                    r.status_code, dict(r.headers), r.text):
                raise Challenged(f"page {page}: Cloudflare challenge")
            if r.status_code == 200:
                return r.json()
            last_err = f"HTTP {r.status_code}"
            time.sleep(2 ** attempt)
        except cf_requests.RequestsError as e:
            last_err = str(e)
            time.sleep(2 ** attempt)
    raise RuntimeError(f"page {page} failed after 3 attempts: {last_err}")


def walk(fetch):
    """Page through the Store API with whatever fetcher is given."""
    all_items = []
    page = 1
    per_page = 100
    while True:
        print(f"Fetching page {page}...")
        items = fetch(page, per_page)
        if not items:
            break
        all_items.extend(items)
        print(f"  Got {len(items)} items (total: {len(all_items)})")
        if len(items) < per_page:
            break
        page += 1
        time.sleep(0.4)
    return all_items


def get_all_listings():
    """Cheap path first, browser only if actually challenged.

    The site sits behind a Cloudflare MANAGED challenge (B-99), which no
    amount of TLS impersonation or IP relocation defeats — that mistake
    cost 23 days of silently frozen data. But the zone's posture changes,
    and when it is off the plain call is far cheaper than launching
    Chromium, so try it every run and escalate only on an actual
    interstitial.
    """
    try:
        return walk(fetch_page)
    except Challenged as e:
        print(f"  {e} — escalating to a real browser (B-99)")

    with cf_clearance.BrowserSession(BASE) as browser:
        print("  challenge passed; walking the API through the browser")
        return walk(lambda page, per_page:
                    browser.get_json(API, _params(page, per_page)))


def parse_item(item):
    prices = item.get("prices") or {}
    price_raw = prices.get("price", "0")
    minor = int(prices.get("currency_minor_unit", 2) or 0)
    try:
        price = int(price_raw) // (10 ** minor) if minor else int(price_raw)
    except (ValueError, TypeError):
        price = 0

    images = item.get("images") or []
    img = images[0].get("src", "") if images else ""

    return {
        "title": item.get("name", ""),
        "brand": detect_brand(item.get("name", ""), item.get("categories")),
        "price": price,
        "url": item.get("permalink", ""),
        "img": img,
        "description": strip_html(item.get("short_description") or item.get("description") or "")[:500],
        "source": "Watches of Lancashire",
        "sold": not item.get("is_in_stock", True),
    }


PRIOR_CSV = "data/watchesoflancashire.csv"


def prior_row_count(path=PRIOR_CSV):
    try:
        with open(path, newline="", encoding="utf-8") as f:
            return max(0, sum(1 for _ in csv.DictReader(f)))
    except OSError:
        return 0


def main():
    print("Fetching Watches of Lancashire inventory (WooCommerce Store API)...")
    raw = get_all_listings()
    print(f"\nTotal raw items: {len(raw)}")

    results = [parse_item(it) for it in raw]
    results = [r for r in results if r["price"] > 0]
    skipped = len(raw) - len(results)
    if skipped:
        print(f"Skipped {skipped} items with no price")

    # Write NOTHING on an empty or badly-truncated parse. The caller
    # (scripts/bonhams_residential_scrape.sh) only moves the CSV into
    # place if this file exists, so not writing is what preserves the
    # prior data — whereas writing a header-only CSV would replace real
    # listings with nothing. Exit non-zero so the tick is recorded as a
    # failure rather than a silent no-op (CLAUDE.md: a scrape that parsed
    # nothing must exit non-zero).
    if not results:
        print("✗ Parsed 0 listings — refusing to write a CSV, keeping prior",
              file=sys.stderr)
        return 1
    prior = prior_row_count()
    if prior >= 25 and len(results) < prior * 0.5:
        print(f"✗ Only {len(results)} listings against a prior {prior} — "
              "looks truncated, refusing to write (keeping prior)",
              file=sys.stderr)
        return 1

    out_file = "watchesoflancashire_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["title", "brand", "price", "url", "img", "description", "source", "sold"],
        )
        writer.writeheader()
        writer.writerows(results)

    if results:
        prices = [r["price"] for r in results]
        print(f"\n✓ Saved {len(results)} listings to {out_file} (GBP)")
        print(f"  Min: £{min(prices):,} | Max: £{max(prices):,} | Avg: £{sum(prices)//len(prices):,}")
        from collections import Counter
        for b, c in Counter(r["brand"] for r in results).most_common():
            print(f"  {b}: {c}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
