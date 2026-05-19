#!/usr/bin/env python3
"""Bulang & Sons "Watch Talks" blog scraper — editorial corpus.

Bulang & Sons is a multi-brand vintage dealer based in Düsseldorf
already scraped at the listing level by `bulangandsons_scraper.py`.
This separate scraper captures their `/blogs/watch-talks` editorial
content — collector-grade essays on specific references and
provenance pieces, distinct from the dealer inventory.

Shopify blog, same shape as Hairspring's `/blogs/finds`. Schema is
the standard editorial-corpus shape (url / slug / title / author /
published_at / updated_at / image / body_text / word_count / brand /
reference_no / model / sub_model / model_line / source /
source_type / scraped_at).

Key differences from `hairspring_finds_scraper.py` (template source):
  • BLOG_PATH = /blogs/watch-talks (not /blogs/finds)
  • Body wrapper class = `article__wrapper container--sm` (Bulang's
    theme doesn't use the Shopify-default `rte` class)
  • No sold-archive chrome extraction — the editorial blog has no
    per-article price / case-size metafields (those live on the
    dealer listings, not the blog), so this scraper feeds the
    editorial corpus only, NOT the Listings > All sold projection
    (unlike Hairspring Finds, which feeds both).
  • Empty-author tolerance: pre-~2018 posts have a blank byline
    (`" "` literal) — accept and store as empty string.

Incremental: re-fetches only articles missing or >30 days since last
scrape. Set BULANG_WATCH_TALKS_FULL_REFRESH=1 to force a full pass.

Run: python3 bulangandsons_watch_talks_scraper.py
Output: public/bulang_watch_talks.json + public/bulang_watch_talks_bodies.json
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


from editorial_corpus_io import load_existing as _load_split, write_split, derive_bodies_path

BASE = "https://bulangandsons.com"
BLOG_PATH = "/blogs/watch-talks"
OUTPUT_JSON = "public/bulang_watch_talks.json"
OUTPUT_BODIES = derive_bodies_path(OUTPUT_JSON)
SOURCE = "bulang_watch_talks"
SOURCE_TYPE = "editorial_blog"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

INDEX_SLEEP = 0.6
DETAIL_SLEEP = 0.5


def fetch(url: str, retries: int = 2) -> str:
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 200:
                return r.text
            print(f"  HTTP {r.status_code} on {url}")
        except requests.RequestException as e:
            print(f"  fetch error on {url}: {e}")
        if attempt < retries:
            time.sleep(2 ** attempt)
    return ""


def discover_urls() -> list[str]:
    """Walk every page of /blogs/watch-talks collecting article URLs.
    Standard Shopify ?page=N pagination."""
    urls: list[str] = []
    seen: set[str] = set()
    first_page = fetch(f"{BASE}{BLOG_PATH}")
    if not first_page:
        print("  could not fetch blog index page 1")
        return urls
    page_nums = sorted(set(int(n) for n in re.findall(rf'\?page=(\d+)', first_page)))
    last_page = page_nums[-1] if page_nums else 1
    print(f"  blog has {last_page} pages")

    def harvest(html: str) -> int:
        added = 0
        for m in re.finditer(rf'href="({re.escape(BLOG_PATH)}/[a-z0-9\-]+)"', html):
            u = BASE + m.group(1)
            if u not in seen:
                seen.add(u)
                urls.append(u)
                added += 1
        return added

    n0 = harvest(first_page)
    print(f"  page 1: +{n0} (total {len(urls)})")
    for p in range(2, last_page + 1):
        time.sleep(INDEX_SLEEP)
        html = fetch(f"{BASE}{BLOG_PATH}?page={p}")
        if not html:
            continue
        n = harvest(html)
        print(f"  page {p}: +{n} (total {len(urls)})")
    return urls


def parse_article(html: str, url: str) -> dict | None:
    """Extract title, author, dates, image, body from a Bulang
    Watch Talks article page.

    Body extraction: locate `<div class="article__wrapper
    container--sm">`, grab a generous window, terminate at the next
    major structural break (`<form` / `<aside` / `<footer` /
    `<div class="article__footer"`). Then pull every <p>/<h2>/<h3>/
    <blockquote>/<li> block inside.
    """
    if not html:
        return None

    # JSON-LD BlogPosting carries canonical metadata.
    meta: dict = {}
    m = re.search(
        r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    if m:
        try:
            blob = json.loads(m.group(1).strip())
            if isinstance(blob, dict) and blob.get("@type") == "BlogPosting":
                meta = blob
        except json.JSONDecodeError:
            pass

    title = unescape((meta.get("headline") or "").strip())
    if not title:
        m1 = re.search(r"<h1[^>]*>([^<]+)</h1>", html)
        if m1:
            title = unescape(m1.group(1).strip())
    if not title:
        return None

    # Author — old posts ship a literal blank string (" "). Accept
    # empty as a valid value; resolver downstream can ignore it.
    author = ""
    a = meta.get("author")
    if isinstance(a, dict):
        author = (a.get("name") or "").strip()
    elif isinstance(a, str):
        author = a.strip()

    published_at = (meta.get("datePublished") or "")[:10]
    updated_at   = (meta.get("dateModified") or "")[:10] or published_at

    image = meta.get("image") or ""
    if isinstance(image, dict):
        image = image.get("url") or image.get("contentUrl") or ""
    if isinstance(image, list) and image:
        first = image[0]
        if isinstance(first, dict):
            image = first.get("url") or first.get("contentUrl") or ""
        elif isinstance(first, str):
            image = first
    if not isinstance(image, str):
        image = ""

    # Body — Bulang theme wraps prose in `article__wrapper container--sm`.
    start = html.find('class="article__wrapper container--sm"')
    body_text = ""
    if start >= 0:
        window = html[start:start + 30000]
        end_markers = [
            window.find('class="article__footer"', 1),
            window.find("<form", 1),
            window.find("<aside", 1),
            window.find("</article", 1),
            window.find("<footer", 1),
        ]
        ends = [e for e in end_markers if e > 0]
        if ends:
            window = window[: min(ends)]
        blocks = re.findall(
            r"<(?:p|h2|h3|h4|blockquote|li)(?:\s[^>]*)?>(.*?)</(?:p|h2|h3|h4|blockquote|li)>",
            window, re.DOTALL | re.IGNORECASE,
        )
        cleaned: list[str] = []
        for b in blocks:
            t = re.sub(r"<[^>]+>", " ", b)
            t = unescape(t)
            t = re.sub(r"\s+", " ", t).strip()
            if t:
                cleaned.append(t)
        body_text = "\n\n".join(cleaned)

    if not body_text or len(body_text) < 100:
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
    full_refresh = os.environ.get("BULANG_WATCH_TALKS_FULL_REFRESH") == "1"
    print(f"Bulang & Sons Watch Talks scraper (full_refresh={full_refresh})")
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
        print(f"  [{i}/{len(urls)}] {record['title'][:70]}  ({record['word_count']} words)")
        time.sleep(DETAIL_SLEEP)

    write_split(out, OUTPUT_JSON, OUTPUT_BODIES)
    print(f"\nFetched: {fetched}  Skipped (fresh): {skipped}  Failed: {failed}")
    print(f"Total entries on disk: {len(out)}")
    print(f"Wrote {OUTPUT_JSON} + {OUTPUT_BODIES}")


if __name__ == "__main__":
    main()
