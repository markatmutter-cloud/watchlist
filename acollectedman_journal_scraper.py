#!/usr/bin/env python3
"""A Collected Man Journal scraper — editorial corpus.

A Collected Man (acollectedman.com) is a London-based dealer
specializing in independent and unusual vintage pieces. The Journal
is one of the most-cited collector-focused editorial sites — pieces
like "What came after the Dirty Dozen?", "The Story Of The Audemars
Piguet Star Wheel", per-reference deep dives in the
"Collector's Guide" series, "Design-Technical" essays, and interviews
with collectors / independent makers.

Shopify storefront, blog at /blogs/journal. Per-article shape is
distinctive: prose lives in multiple `<div class="text-block__content
body-1">` regions interspersed with images / quote blocks — same
walker pattern as Hodinkee body-copy regions, not the single-wrapper
pattern Hairspring + Bulang use.

Run: python3 acollectedman_journal_scraper.py
Output: public/acollectedman_journal.json
      + public/acollectedman_journal_bodies.json
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


BASE = "https://www.acollectedman.com"
BLOG_PATH = "/blogs/journal"
# Sitemap-based discovery — confirmed 2026-05-19: paginated index at
# /blogs/journal?page=N only exposes ~28 recent articles even though
# the actual blog corpus is ~321 articles. The Shopify-generated
# sitemap_blogs_*.xml at site root is the canonical enumerator.
SITEMAP_INDEX_URL = f"{BASE}/sitemap.xml"
BLOG_SITEMAP_URL  = f"{BASE}/sitemap_blogs_1.xml"
OUTPUT_JSON = "public/acollectedman_journal.json"
OUTPUT_BODIES = derive_bodies_path(OUTPUT_JSON)
SOURCE = "acollectedman_journal"
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
    """Enumerate the journal via the Shopify-generated blog sitemap.

    Why not pagination: the paginated index at
    /blogs/journal?page=N only exposes the most recent ~28 articles
    despite the full corpus being ~321. The pagination footer caps
    at 2 pages even though tag-filtered views (e.g.
    ?tagged/collectors-guide) implicitly contain articles from
    further back. The blog sitemap is the canonical enumerator —
    same approach as bring_a_loupe_scraper.py for Hodinkee.

    Tag-filtered subsets are unnecessary here — they're filters
    over the same corpus that the sitemap fully covers.
    """
    print(f"  fetching blog sitemap {BLOG_SITEMAP_URL}")
    xml = fetch(BLOG_SITEMAP_URL)
    if not xml:
        print("  could not fetch blog sitemap; trying sitemap index")
        # Fallback: discover the blog sub-sitemap URL from the
        # sitemap.xml index in case Shopify ever renumbers _1.xml.
        idx_xml = fetch(SITEMAP_INDEX_URL)
        if idx_xml:
            for m in re.finditer(r"<loc>(https://[^<]*sitemap_blogs[^<]+)</loc>", idx_xml):
                sub = m.group(1)
                print(f"  trying sub-sitemap {sub}")
                xml = fetch(sub)
                if xml:
                    break
    if not xml:
        return []
    pattern = re.compile(
        rf"{re.escape(BASE)}{re.escape(BLOG_PATH)}/[a-z0-9\-]+"
    )
    urls = sorted(set(pattern.findall(xml)))
    print(f"  sitemap → {len(urls)} journal articles")
    return urls


def parse_article(html: str, url: str) -> dict | None:
    """Extract title / author / dates / image / body from an ACM
    journal article.

    Body extraction: every `<div class="text-block__content body-1">`
    region concatenated in source order. Articles average ~30 such
    regions; each is one paragraph or section of prose.
    """
    if not html:
        return None

    # JSON-LD: ACM ships both BlogPosting and Article — prefer
    # BlogPosting for cadence parity with other Shopify scrapers,
    # accept Article as fallback.
    meta: dict = {}
    for m in re.finditer(
        r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',
        html, re.DOTALL,
    ):
        try:
            blob = json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            continue
        if isinstance(blob, dict) and blob.get("@type") == "BlogPosting":
            meta = blob
            break
    if not meta:
        for m in re.finditer(
            r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',
            html, re.DOTALL,
        ):
            try:
                blob = json.loads(m.group(1).strip())
            except json.JSONDecodeError:
                continue
            if isinstance(blob, dict) and blob.get("@type") == "Article":
                meta = blob
                break

    title = unescape((meta.get("headline") or "").strip())
    if not title:
        return None

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

    # Body — ACM ships TWO article templates and the journal mixes
    # both freely (~135 v1 + 186 v2 of 321 articles, confirmed
    # 2026-05-19). Walk every div whose class matches either pattern:
    #   v1: class="text-block__content body-1"
    #   v2: class="text-block-v2__content …"  (may have trailing
    #       modifier classes like text-block-v2--fill-row)
    # Concatenate in source order with paragraph breaks.
    blocks: list[str] = []
    body_re = re.compile(
        r'<div[^>]*class="(?:text-block__content body-1|text-block-v2__content[^"]*)"[^>]*>(.*?)</div>',
        re.DOTALL,
    )
    for m in body_re.finditer(html):
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
    full_refresh = os.environ.get("ACOLLECTEDMAN_FULL_REFRESH") == "1"
    print(f"A Collected Man Journal scraper (full_refresh={full_refresh})")
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
        print(f"  [{i}/{len(urls)}] {record['title'][:75]}  ({record['word_count']} words)")
        time.sleep(DETAIL_SLEEP)

    write_split(out, OUTPUT_JSON, OUTPUT_BODIES)
    print(f"\nFetched: {fetched}  Skipped (fresh): {skipped}  Failed: {failed}")
    print(f"Total entries on disk: {len(out)}")
    print(f"Wrote {OUTPUT_JSON} + {OUTPUT_BODIES}")


if __name__ == "__main__":
    main()
