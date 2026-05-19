#!/usr/bin/env python3
"""Hodinkee Reference Points scraper — editorial corpus.

Reference Points is Hodinkee's flagship encyclopedia-grade series:
long-form per-reference deep dives by Cara Barrett / Stephen
Pulvirent / Jack Forster / Ben Clymer, typically 3,000-10,000+
words each on a single watch reference (Paul Newman Daytona,
Rolex Submariner, Royal Oak, FP Journe Tourbillon, etc.).

Small corpus (~10 articles as of 2026-05) but exceptionally
high-leverage per article — these are some of the most-cited
reference write-ups on the open web.

Mechanically identical to bring_a_loupe_scraper.py: same Hodinkee
sitemap discovery + same body-copy extraction. Two-pattern URL
filter because the series slug convention changed partway through
its run — most articles use `/articles/reference-points-*`, three
legacy Rolex pieces use `/articles/rolex-*-reference-points`.

Run: python3 hodinkee_reference_points_scraper.py
Output: public/hodinkee_reference_points.json
      + public/hodinkee_reference_points_bodies.json
"""

from __future__ import annotations

import json
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


def _resolve_brand_and_ref(title: str) -> dict:
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


BASE = "https://www.hodinkee.com"
SITEMAP_URL = f"{BASE}/sitemap.xml"
# Two URL patterns to catch both slug conventions. Excludes Sunday-
# Rewind recaps and "story-of-*" deprecated slugs that contain the
# words but aren't canonical RP pieces.
URL_PATTERNS = (
    re.compile(rf"{re.escape(BASE)}/articles/reference-points-[a-z0-9\-]+"),
    re.compile(rf"{re.escape(BASE)}/articles/rolex-[a-z\-]+-reference-points"),
)

OUTPUT_JSON = "public/hodinkee_reference_points.json"
OUTPUT_BODIES = derive_bodies_path(OUTPUT_JSON)
SOURCE = "hodinkee_reference_points"
SOURCE_TYPE = "editorial_reference_points"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

DETAIL_SLEEP = 0.5


def fetch(url: str, retries: int = 2) -> str:
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                return r.text
            print(f"  HTTP {r.status_code} on {url}")
        except requests.RequestException as e:
            print(f"  fetch error on {url}: {e}")
        if attempt < retries:
            time.sleep(2 ** attempt)
    return ""


def discover_urls() -> list[str]:
    """Filter Hodinkee's sitemap.xml against the two Reference Points
    URL patterns. Same approach as bring_a_loupe_scraper.py."""
    print(f"  fetching sitemap {SITEMAP_URL}")
    xml = fetch(SITEMAP_URL)
    if not xml:
        print("  could not fetch sitemap")
        return []
    urls: set[str] = set()
    for p in URL_PATTERNS:
        urls.update(p.findall(xml))
    out = sorted(urls)
    print(f"  sitemap → {len(out)} reference-points articles")
    return out


def parse_article(html: str, url: str) -> dict | None:
    """Same shape as bring_a_loupe_scraper.py.parse_article — Hodinkee
    site, JSON-LD NewsArticle metadata, body-copy region extraction."""
    if not html:
        return None

    meta: dict = {}
    for m in re.finditer(
        r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',
        html, re.DOTALL,
    ):
        try:
            blob = json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            continue
        if isinstance(blob, dict) and blob.get("@type") in ("NewsArticle", "Article", "BlogPosting"):
            meta = blob
            break

    title = unescape((meta.get("headline") or "").strip())
    if not title:
        m1 = re.search(r"<title[^>]*>([^<]+)</title>", html)
        if m1:
            title = re.sub(r"\s*-\s*Hodinkee\s*$", "", unescape(m1.group(1)).strip())
    if not title:
        return None

    author = ""
    a = meta.get("author")
    if isinstance(a, dict):
        author = (a.get("name") or "").strip()
    elif isinstance(a, list) and a:
        first = a[0]
        if isinstance(first, dict):
            author = (first.get("name") or "").strip()
        elif isinstance(first, str):
            author = first.strip()
    elif isinstance(a, str):
        author = a.strip()

    published_at = (meta.get("datePublished") or "")[:10]
    updated_at   = (meta.get("dateModified") or "")[:10] or published_at

    image = meta.get("image") or ""
    if isinstance(image, list) and image:
        image = image[0]
    if isinstance(image, dict):
        image = image.get("url") or image.get("contentUrl") or ""

    # Body — every `<div class="body-copy">` region concatenated in
    # source order. Same selector + walker as the BAL scraper.
    blocks: list[str] = []
    for m in re.finditer(
        r'<div[^>]*class="[^"]*body-copy[^"]*"[^>]*>(.*?)</div>',
        html, re.DOTALL,
    ):
        text = re.sub(r"<[^>]+>", " ", m.group(1))
        text = unescape(text)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            blocks.append(text)
    body_text = "\n\n".join(blocks)
    if not body_text or len(body_text) < 200:
        return None

    resolved = _resolve_brand_and_ref(title)

    return {
        "url": url,
        "slug": url.rsplit("/", 1)[-1],
        "title": title,
        "author": author,
        "published_at": published_at,
        "updated_at":   updated_at,
        "image": image,
        "body_text": body_text,
        "word_count": len(body_text.split()),
        "brand": resolved["brand"],
        "reference_no": resolved["reference_no"],
        "model": resolved["model"],
        "sub_model": resolved["sub_model"],
        "model_line": resolved["model_line"],
        "source": SOURCE,
        "source_type": SOURCE_TYPE,
        "scraped_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def should_refresh(existing_entry: dict | None, full: bool) -> bool:
    if full or not existing_entry:
        return True
    try:
        s = existing_entry.get("scraped_at")
        if not s:
            return True
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).days >= 30
    except Exception:
        return True


def main():
    full_refresh = os.environ.get("HODINKEE_REFERENCE_POINTS_FULL_REFRESH") == "1"
    print(f"Hodinkee Reference Points scraper (full_refresh={full_refresh})")
    existing = _load_split(OUTPUT_JSON, OUTPUT_BODIES)
    print(f"  existing entries on disk: {len(existing)}")

    urls = discover_urls()
    print(f"\nDiscovered {len(urls)} article URLs")

    out = dict(existing)
    fetched = skipped = failed = 0
    for i, url in enumerate(urls, 1):
        if not should_refresh(existing.get(url), full_refresh):
            skipped += 1
            continue
        html = fetch(url)
        record = parse_article(html, url)
        if not record:
            failed += 1
            print(f"  [{i}/{len(urls)}] FAILED: {url}")
            time.sleep(DETAIL_SLEEP)
            continue
        out[url] = record
        fetched += 1
        print(f"  [{i}/{len(urls)}] {record['title'][:80]}  ({record['word_count']} words)")
        time.sleep(DETAIL_SLEEP)

    write_split(out, OUTPUT_JSON, OUTPUT_BODIES)
    print(f"\nFetched: {fetched}  Skipped (fresh): {skipped}  Failed: {failed}")
    print(f"Total entries on disk: {len(out)}")
    print(f"Wrote {OUTPUT_JSON} + {OUTPUT_BODIES}")


if __name__ == "__main__":
    main()
