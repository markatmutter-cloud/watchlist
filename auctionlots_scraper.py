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

    return {
        "house": "Antiquorum",
        "lot_id": lot.get("row_id"),
        "lot_number": lot.get("lot_number"),
        "title": (lot.get("title") or "").strip(),
        "description": (lot.get("description") or "").replace("<br/>", " ").strip()[:600],
        "currency": lot.get("currency_code") or "CHF",
        "estimate_low": lot.get("estimate_low"),
        "estimate_high": lot.get("estimate_high"),
        "starting_price": lot.get("starting_price"),
        "current_bid": lot.get("highest_live_bid"),
        "sold_price": lot.get("sold_price"),
        "status": lot.get("status"),
        "image": img_url,
        "auction_title": auction.get("title"),
        "auction_start": auction.get("time_start"),
        "auction_end": auction.get("effective_end_time") or auction.get("time_start"),
        "auction_url": ("https://live.antiquorum.swiss" + auction.get("_detail_url"))
                       if auction.get("_detail_url") else None,
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def scrape(url):
    """Dispatch by host. Add new auction houses here as scrapers are built."""
    host = urlparse(url).hostname or ""
    if host.endswith("antiquorum.swiss"):
        return scrape_antiquorum_lot(url)
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
