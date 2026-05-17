#!/usr/bin/env python3
"""
Wind Vintage blog scraper — editorial corpus, not listings.

Wind Vintage's blog at windvintage.com/blog is a long-running editorial
series authored primarily by Charlie Dunne (with occasional Eric Wind
pieces). 367 posts to date covering:

  - Per-reference collector's guides (the densest, ~6,000-7,000 words
    each — gold-standard variant taxonomy, e.g. "Collector's Guide:
    the Rolex GMT-Master Reference 1675 in Steel")
  - Cross-brand glossary posts ("What Is A 'Soleil' Dial?",
    "What Is A 'Gilt' Dial?", "What Is A Chapter Ring Dial?")
  - Inventory write-ups on specific watches sold by Wind Vintage
  - "What's Selling Here" weekly market roundups
  - Photo reports and event coverage
  - Auction recaps

We capture EVERY post — even the inventory + "what's selling" ones
carry connoisseur prose that feeds the reference corpus downstream.
Filtering by `post_type` happens at consumption time, not at scrape
time, so future-us can re-classify without re-scraping.

Output: public/windvintage_guides.json
  keyed by article URL with the same shape as hairspring_finds.json
  for consistency at the projection layer.

Squarespace JSON: every blog page exposes a `?format=json` endpoint
that returns the full post data including `item.body` HTML. The blog
index at /blog?format=json paginates 9 items at a time via the
`offset` query parameter (set to the publishOn timestamp of the
last item from the prior page).

Run: python3 windvintage_guides_scraper.py
"""

from __future__ import annotations

import csv  # noqa: F401  (kept for parity with sibling scrapers)
import json
import os
import re
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

import requests

# Canonical brand + reference-index match — same machinery the
# Hairspring Finds scraper uses, so records carry consistent shape.
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


BASE = "https://www.windvintage.com"
BLOG_PATH = "/blog"
OUTPUT_JSON = "public/windvintage_guides.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
}

INDEX_SLEEP = 0.4   # between blog-index pages
DETAIL_SLEEP = 0.3  # between per-post fetches


def fetch_json(url: str, retries: int = 2) -> dict | None:
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 200:
                try:
                    return r.json()
                except ValueError:
                    print(f"  non-JSON response from {url}")
                    return None
            print(f"  HTTP {r.status_code} on {url}")
        except requests.RequestException as e:
            print(f"  fetch error: {e}")
        if attempt < retries:
            time.sleep(2 ** attempt)
    return None


def discover_posts() -> list[dict]:
    """Walk the Squarespace blog index, collecting metadata for every
    post. Returns a list of `{urlId, fullUrl, publishOn, title}` dicts.
    """
    posts: list[dict] = []
    seen_ids: set[str] = set()
    offset = None
    page_n = 0
    while True:
        page_n += 1
        url = f"{BASE}{BLOG_PATH}?format=json"
        if offset is not None:
            url += f"&offset={offset}"
        data = fetch_json(url)
        if not data:
            print(f"  page {page_n}: fetch failed, stopping")
            break
        items = data.get("items") or []
        if not items:
            print(f"  page {page_n}: empty, stopping")
            break
        added = 0
        for it in items:
            uid = it.get("id") or it.get("urlId")
            if not uid or uid in seen_ids:
                continue
            seen_ids.add(uid)
            url_id = it.get("urlId") or ""
            full_url = it.get("fullUrl") or f"/blog/{url_id}"
            if full_url and not full_url.startswith("http"):
                full_url = BASE + full_url
            posts.append({
                "urlId": url_id,
                "fullUrl": full_url,
                "publishOn": it.get("publishOn"),
                "title": it.get("title", ""),
            })
            added += 1
        print(f"  page {page_n} (offset={offset}): +{added} (total {len(posts)})")
        if added == 0:
            break
        # Next offset = last publishOn we saw on this page.
        last = items[-1].get("publishOn")
        if not last:
            break
        offset = last
        time.sleep(INDEX_SLEEP)
    return posts


# Heuristic post-type classifier — applied to slug + title to label
# posts so consumers can filter (collector's guides only / everything
# / just inventory write-ups). Not scrape-time filtering — every post
# is captured.

_WHATS_SELLING_RE = re.compile(r"^whats[-_ ]selling", re.IGNORECASE)
_PHOTO_REPORT_RE = re.compile(r"^photo[-_ ]report", re.IGNORECASE)
_COLLECTOR_GUIDE_RE = re.compile(
    r"collectors[-_ ]guide|^what[-_ ]is[-_ ]a[-_ ]", re.IGNORECASE,
)
_EVENT_RE = re.compile(
    r"(?:^|[-_])(?:visit|event|meetup|preview|recap|"
    r"watches[-_]?and[-_]?wonders|baselworld|wind[-_]up|geneva[-_]days)",
    re.IGNORECASE,
)
_AUCTION_RECAP_RE = re.compile(
    r"(?:^|[-_])(?:auction|phillips|christies|sothebys|antiquorum)[-_]?"
    r"(?:recap|results|round[-_]?up|review)",
    re.IGNORECASE,
)


def classify(slug: str, title: str) -> str:
    s = slug.lower()
    t = (title or "").lower()
    if _COLLECTOR_GUIDE_RE.search(s) or _COLLECTOR_GUIDE_RE.search(t):
        return "collector_guide"
    if _WHATS_SELLING_RE.search(s) or "what's selling" in t:
        return "whats_selling"
    if _PHOTO_REPORT_RE.search(s) or "photo report" in t:
        return "photo_report"
    if _AUCTION_RECAP_RE.search(s) or _AUCTION_RECAP_RE.search(t):
        return "auction_recap"
    if _EVENT_RE.search(s) or _EVENT_RE.search(t):
        return "event"
    return "post"


def _resolve_brand_and_ref(title: str) -> dict:
    out = {"brand": "", "reference_no": None, "model": None,
           "sub_model": None, "model_line": None}
    if not title:
        return out
    out["brand"] = infer_brand(title) or ""
    idx = _ref_index()
    if _match_against_index and idx is not None:
        hit = _match_against_index(title, idx)
        if hit:
            if not out["brand"]:
                out["brand"] = hit.get("brand", "") or ""
            out["reference_no"] = hit.get("raw_ref")
            out["model"] = hit.get("model")
            out["sub_model"] = hit.get("sub_model")
            out["model_line"] = hit.get("model_line")
    return out


def parse_post(item_data: dict, url: str) -> dict | None:
    item = item_data.get("item") if "item" in item_data else item_data
    if not item:
        return None
    title = unescape((item.get("title") or "").strip())
    if not title:
        return None

    # Author — Squarespace gives a nested object; the displayName is
    # canonical (some posts pre-date the "Charlie Dunne" displayName
    # standardisation and may show "Eric Wind").
    author = ""
    a = item.get("author")
    if isinstance(a, dict):
        author = (a.get("displayName") or "").strip()

    publish_ts = item.get("publishOn")
    published_at = ""
    if isinstance(publish_ts, (int, float)) and publish_ts > 0:
        try:
            published_at = datetime.fromtimestamp(
                publish_ts / 1000, tz=timezone.utc
            ).strftime("%Y-%m-%d")
        except (ValueError, OSError):
            pass

    # Body — Squarespace returns full article HTML in item.body.
    body_html = item.get("body") or ""
    # Strip Squarespace's heavy sqs-block scaffolding to leave just the
    # prose-bearing tags. We keep paragraph and heading text only.
    body_html_clean = re.sub(r"<script.*?</script>", "", body_html, flags=re.DOTALL | re.IGNORECASE)
    body_html_clean = re.sub(r"<style.*?</style>", "", body_html_clean, flags=re.DOTALL | re.IGNORECASE)
    blocks = re.findall(
        r"<(?:p|h2|h3|h4|blockquote|li)(?:\s[^>]*)?>(.*?)</(?:p|h2|h3|h4|blockquote|li)>",
        body_html_clean, re.DOTALL | re.IGNORECASE,
    )
    chunks: list[str] = []
    for b in blocks:
        t = re.sub(r"<[^>]+>", " ", b)
        t = unescape(t)
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            chunks.append(t)
    body_text = "\n\n".join(chunks)
    if not body_text or len(body_text) < 100:
        return None

    image = item.get("assetUrl") or ""
    # Strip the `?format=...` query the Squarespace CDN appends so the
    # image URL stays stable across re-scrapes.
    image = image.split("?")[0]

    excerpt = unescape(re.sub(r"<[^>]+>", " ",
                              item.get("excerpt") or "")).strip()[:300]

    slug = item.get("urlId") or url.rsplit("/", 1)[-1]
    post_type = classify(slug, title)
    resolved = _resolve_brand_and_ref(title)

    return {
        "url": url,
        "slug": slug,
        "title": title,
        "author": author,
        "published_at": published_at,
        "image": image,
        "excerpt": excerpt,
        "body_text": body_text,
        "word_count": len(body_text.split()),
        "post_type": post_type,
        "brand": resolved["brand"],
        "reference_no": resolved["reference_no"],
        "model": resolved["model"],
        "sub_model": resolved["sub_model"],
        "model_line": resolved["model_line"],
        "source": "windvintage_guides",
        "source_type": "standalone_guide",
        "scraped_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def load_existing(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError:
        return {}


def should_refresh(existing: dict | None, full: bool) -> bool:
    if full or not existing:
        return True
    try:
        s = existing.get("scraped_at")
        if not s:
            return True
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).days >= 30
    except Exception:
        return True


def main():
    full_refresh = os.environ.get("WINDVINTAGE_FULL_REFRESH") == "1"
    print(f"Wind Vintage blog scraper (full_refresh={full_refresh})")
    existing = load_existing(OUTPUT_JSON)
    print(f"  existing entries: {len(existing)}")

    print(f"\nDiscovering posts via {BASE}{BLOG_PATH}?format=json ...")
    posts = discover_posts()
    print(f"\nFound {len(posts)} posts")

    out = dict(existing)
    fetched = skipped = failed = 0
    by_type: dict[str, int] = {}
    for i, p in enumerate(posts, 1):
        url = p["fullUrl"]
        if not url:
            continue
        if not should_refresh(existing.get(url), full_refresh):
            skipped += 1
            continue
        json_url = f"{url}?format=json"
        data = fetch_json(json_url)
        if not data:
            failed += 1
            print(f"  [{i}/{len(posts)}] FAIL: {url}")
            time.sleep(DETAIL_SLEEP)
            continue
        rec = parse_post(data, url)
        if not rec:
            failed += 1
            print(f"  [{i}/{len(posts)}] PARSE FAIL: {url}")
            time.sleep(DETAIL_SLEEP)
            continue
        out[url] = rec
        by_type[rec["post_type"]] = by_type.get(rec["post_type"], 0) + 1
        fetched += 1
        print(f"  [{i}/{len(posts)}] {rec['post_type']:<18} "
              f"{rec['title'][:60]} ({rec['word_count']} words)")
        time.sleep(DETAIL_SLEEP)

    Path(OUTPUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)

    print(f"\nFetched: {fetched}  Skipped (fresh): {skipped}  Failed: {failed}")
    print(f"By post_type: {dict(sorted(by_type.items(), key=lambda kv: -kv[1]))}")
    print(f"Total entries on disk: {len(out)}")
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
