#!/usr/bin/env python3
"""Rolex Magazine (Jake's Rolex World) scraper — editorial corpus.

Long-running Rolex-focused blog by Jake Ehrlich at rolexmagazine.com.
Hosted on Google's Blogger platform. Archive starts 2003-06-10
(backdated for some posts; `updated` is more meaningful as a freshness
signal than `published`). As of 2026-05-18 the feed reports ~3,840
posts total.

Scrape mechanism: Blogger's JSON feeds API. Single endpoint, paginated:
    /feeds/posts/default?alt=json&max-results=N&start-index=N

Notable gotchas (validated by feasibility agent 2026-05-18):
  - `max-results` is silently capped — server returns 89-150 entries
    regardless of what you request. Advance pagination by the actual
    number of entries returned, NOT by a fixed stride.
  - `published` is editorial-positioning, NOT creation date. Jake
    backdates posts when revising. Use `updated` for freshness.
  - Body HTML is heavy: legacy `<font>` tags, `class="Apple-style-span"`,
    1000+ inline `style=` attributes on long posts. Strip aggressively.
  - Embedded YouTube/iframe count is HIGH (~54% of posts). We keep
    text only; videos surface on the original article on click-through.
  - Image-only posts ("Macro Shot of the Day") are common in the early
    corpus — short word counts are real, not extraction failures.

Schema parity with hairspring_finds.json / bring_a_loupe.json so
EditorialView iterates all sources through one shape. Adds one
Rolex-Magazine-specific field:
  - `labels`: list of Blogger category terms (Day-Date, Submariner,
    Paul Newman Daytona, …). Dense — median 3 per post. Feeds the
    editorial_index.py `tags` field once that ships; baseline tag
    signal until then.

Output: public/rolex_magazine.json (keyed by URL).
"""

from __future__ import annotations

import json
import os
import re
import sys
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


BASE = "https://www.rolexmagazine.com"
FEED_URL = f"{BASE}/feeds/posts/default?alt=json"
OUTPUT_JSON = "public/rolex_magazine.json"
SOURCE = "rolex_magazine"
SOURCE_TYPE = "editorial_blog"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json,text/json,*/*;q=0.9",
}

PAGE_SLEEP = 0.3   # Polite rate-limit between paginated feed requests.
DEFAULT_MAX_RESULTS = 150  # Blogger caps silently; this is just a hint.


def fetch_feed_page(start_index: int, max_results: int = DEFAULT_MAX_RESULTS,
                    retries: int = 2) -> dict | None:
    """Fetch one feed page. Returns the parsed JSON envelope or None."""
    params = {"max-results": max_results, "start-index": start_index}
    for attempt in range(retries + 1):
        try:
            r = requests.get(FEED_URL, params=params, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                return r.json()
            print(f"  HTTP {r.status_code} at start-index={start_index}")
        except requests.RequestException as e:
            print(f"  fetch error at start-index={start_index}: {e}")
        if attempt < retries:
            time.sleep(2 ** attempt)
    return None


def _canonical_url(entry: dict) -> str | None:
    """Find the canonical post URL from the feed entry's link[] array."""
    for link in entry.get("link", []):
        if link.get("rel") == "alternate" and link.get("type") == "text/html":
            return link.get("href")
    return None


def _slug_from_url(url: str) -> str:
    """Last path segment, minus .html — matches the visible URL slug."""
    if not url:
        return ""
    tail = url.rstrip("/").rsplit("/", 1)[-1]
    return re.sub(r"\.html?$", "", tail, flags=re.IGNORECASE)


# Strip <script> and <style> blocks FIRST (their contents shouldn't bleed
# into body_text), then strip all remaining tags. Blogger content has
# enormous inline-style noise; a clean regex pass is the right shape.
_SCRIPT_STYLE_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_IMG_SRC_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.IGNORECASE)


def _strip_to_text(html: str) -> str:
    """Reduce Blogger post HTML to clean prose."""
    if not html:
        return ""
    s = _SCRIPT_STYLE_RE.sub(" ", html)
    s = _TAG_RE.sub(" ", s)
    s = unescape(s)
    s = _WS_RE.sub(" ", s).strip()
    return s


def _first_content_image(html: str, thumbnail_url: str | None) -> str:
    """Hero image: prefer the first <img src> inside content (full-res);
    fall back to the feed's media$thumbnail (small ~72px). Some image-only
    posts use only the thumbnail."""
    if html:
        m = _IMG_SRC_RE.search(html)
        if m:
            return m.group(1)
    return thumbnail_url or ""


def _resolve_brand_and_ref(title: str) -> dict:
    """Run brand inference + index matcher on the title. Schema parity
    with the other editorial scrapers — sparse but populated when the
    title carries an unambiguous reference."""
    out = {
        "brand": "",
        "reference_no": None,
        "model": None,
        "sub_model": None,
        "model_line": None,
    }
    title = title or ""
    if not title:
        return out
    out["brand"] = infer_brand(title) or ""
    ref_idx = _ref_index()
    if _match_against_index and ref_idx is not None:
        hit = _match_against_index(title, ref_idx)
        if hit:
            if not out["brand"]:
                out["brand"] = hit.get("brand", "") or ""
            out["reference_no"] = hit.get("raw_ref")
            out["model"] = hit.get("model")
            out["sub_model"] = hit.get("sub_model")
            out["model_line"] = hit.get("model_line")
    return out


def parse_entry(entry: dict) -> dict | None:
    """Build the editorial-record shape from a Blogger feed entry."""
    title = (entry.get("title", {}) or {}).get("$t", "").strip()
    if not title:
        return None
    url = _canonical_url(entry)
    if not url:
        return None
    content_html = (entry.get("content", {}) or {}).get("$t", "") or ""
    body_text = _strip_to_text(content_html)
    if len(body_text) < 20:
        # Tiny posts (image-only "Macro Shot of the Day") still get
        # captured — they contribute to the corpus even if body_text
        # is sparse — but filter out outright empty entries.
        pass
    authors = entry.get("author", []) or []
    author = ""
    if authors and isinstance(authors, list):
        first = authors[0] or {}
        author = ((first.get("name") or {}).get("$t") or "").strip()
    published_at = (entry.get("published", {}) or {}).get("$t", "")[:10]
    updated_at   = (entry.get("updated",   {}) or {}).get("$t", "")[:10] or published_at
    thumb = ((entry.get("media$thumbnail", {}) or {}).get("url") or "").strip() or None
    image = _first_content_image(content_html, thumb)
    labels = [
        (c.get("term") or "").strip()
        for c in (entry.get("category", []) or [])
        if (c.get("term") or "").strip()
    ]
    resolved = _resolve_brand_and_ref(title)

    return {
        "url": url,
        "slug": _slug_from_url(url),
        "title": title,
        "author": author,
        "published_at": published_at,
        "updated_at":   updated_at,
        "image": image,
        "body_text": body_text,
        "word_count": len(body_text.split()),
        # Blogger labels — high-quality baseline tags. Editorial_index.py
        # layers keyword-classifier tags on top once that ships.
        "labels": labels,
        "brand": resolved["brand"],
        "reference_no": resolved["reference_no"],
        "model": resolved["model"],
        "sub_model": resolved["sub_model"],
        "model_line": resolved["model_line"],
        "source": SOURCE,
        "source_type": SOURCE_TYPE,
        "scraped_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def load_existing(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError:
        print(f"  existing {path} is not valid JSON; starting fresh")
        return {}


def walk_feed(stop_on_known_url: str | None = None, hard_limit: int | None = None):
    """Generator: yields parsed entries across the entire feed.

    Pagination — Blogger caps `max-results` silently, so we advance
    by the actual entry count returned, not by a fixed stride.
    Terminates when an empty feed page comes back OR when we hit
    `stop_on_known_url` (incremental mode, used by the daily cron).
    `hard_limit` caps total entries fetched (test / debug knob).
    """
    start_index = 1
    seen = 0
    while True:
        envelope = fetch_feed_page(start_index)
        if not envelope:
            return
        entries = (envelope.get("feed") or {}).get("entry") or []
        if not entries:
            return
        for raw in entries:
            rec = parse_entry(raw)
            if rec:
                if stop_on_known_url and rec["url"] == stop_on_known_url:
                    return
                yield rec
                seen += 1
                if hard_limit and seen >= hard_limit:
                    return
        start_index += len(entries)
        time.sleep(PAGE_SLEEP)


def main():
    full_refresh = os.environ.get("ROLEX_MAGAZINE_FULL_REFRESH") == "1"
    hard_limit = os.environ.get("ROLEX_MAGAZINE_LIMIT")
    hard_limit = int(hard_limit) if (hard_limit and hard_limit.isdigit()) else None

    print(f"Rolex Magazine scraper (full_refresh={full_refresh}, "
          f"hard_limit={hard_limit})")
    existing = load_existing(OUTPUT_JSON)
    print(f"  existing entries on disk: {len(existing)}")

    # Incremental mode: stop when we hit a known URL on page 1. Saves
    # the full 3,840-post walk on weekly cron runs once we've seeded.
    # Skipped when full_refresh=1 or when there's no existing data.
    stop_url = None
    if not full_refresh and existing:
        # Find the most-recently-scraped URL — that's where the feed
        # head will land first when there's nothing new.
        try:
            most_recent_url = max(
                existing.values(),
                key=lambda v: v.get("scraped_at", "")
            )["url"]
            stop_url = most_recent_url
            print(f"  incremental mode: stopping when feed hits {stop_url}")
        except (KeyError, ValueError):
            pass

    out = dict(existing)
    fetched = 0
    t0 = time.time()
    for rec in walk_feed(stop_on_known_url=stop_url, hard_limit=hard_limit):
        out[rec["url"]] = rec
        fetched += 1
        if fetched % 200 == 0:
            print(f"  ... {fetched} fetched ({time.time() - t0:.1f}s)")
    elapsed = time.time() - t0

    Path(OUTPUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)

    print(f"\nFetched: {fetched}  Total on disk: {len(out)}  Elapsed: {elapsed:.1f}s")
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
