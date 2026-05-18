#!/usr/bin/env python3
"""
Hodinkee Bring a Loupe scraper — editorial corpus.

Bring a Loupe is Hodinkee's long-running weekly column (Louis
Westphalen and others) profiling 6-10 watches per article: a mix
of eBay finds, upcoming auction lots, and curated "look at this"
picks. Started 2014, weekly cadence with some gaps.

Each post is ~2,000–5,000 chars of editorial prose. Watch identity
is embedded in prose paragraphs, NOT in structural per-watch
headings — `<div class="body-copy">` blocks alternate between
section transitions ("upcoming Watches of Knightsbridge auction")
and per-watch detail paragraphs. So unlike Hairspring Finds (1:1
article-to-watch), one BAL article covers many references — the
search path is full-text over body_text, not structured-field
filtering.

Output: public/bring_a_loupe.json
  Same schema as hairspring_finds.json:
  keyed by article URL, values include url / slug / title /
  author / published_at / updated_at / image / body_text /
  word_count / source / source_type / scraped_at, plus the
  brand+ref fields (resolved from the headline — sparse since
  the headline only names 2-3 of the ~8 watches per article;
  body_text full-text search is the primary "has BAL covered
  a Railmaster" query path).

URL discovery: Hodinkee's `/columns/bring-a-loupe` index returns
404, so we walk `sitemap.xml` (~2 MB, single fetch) and filter
to articles whose path matches `/articles/bring-a-loupe*`. As of
2026-05, 251 articles enumerable.

Incremental: re-fetches only articles missing from
public/bring_a_loupe.json or >30 days since last scrape (in case
the author has appended/edited prose). Set
BRING_A_LOUPE_FULL_REFRESH=1 to force re-fetch of every article.

Polite rate-limit: 0.5s between detail-page fetches.

Run: python3 bring_a_loupe_scraper.py
Output: public/bring_a_loupe.json
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

# Same brand+ref resolution stack as hairspring_finds_scraper. Keeps
# the records schema-compatible so future surfaces (e.g. a unified
# editorial-corpus search) can iterate both sources through one path.
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


BASE = "https://www.hodinkee.com"
SITEMAP_URL = f"{BASE}/sitemap.xml"
ARTICLE_PATH_PREFIX = "/articles/bring-a-loupe"
OUTPUT_JSON = "public/bring_a_loupe.json"

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
    """Walk Hodinkee's sitemap.xml and return every URL matching
    `/articles/bring-a-loupe*`. Sitemap is ~2 MB, one fetch."""
    print(f"  fetching sitemap {SITEMAP_URL}")
    xml = fetch(SITEMAP_URL)
    if not xml:
        print("  could not fetch sitemap")
        return []
    pattern = re.compile(
        rf"{re.escape(BASE)}{re.escape(ARTICLE_PATH_PREFIX)}[a-z0-9\-]+"
    )
    urls = sorted(set(pattern.findall(xml)))
    print(f"  sitemap → {len(urls)} bring-a-loupe articles")
    return urls


def parse_article(html: str, url: str) -> dict | None:
    """Extract title, author, dates, image, and body text from a
    Hodinkee article page.

    Metadata: JSON-LD NewsArticle block. Body: every
    `<div class="body-copy">` region concatenated in source order.
    Regions include: 1 intro/dek + ~6-10 per-watch paragraphs + 1-2
    auction-section transition paragraphs. Sufficient for free-text
    search ("has BAL ever talked about a Railmaster") without
    needing structural per-watch separation.
    """
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
            # Strip " - Hodinkee" trailer if present.
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

    # Body: every body-copy div concatenated. Hodinkee wraps each
    # paragraph (intro, per-watch detail, section transition) in its
    # own `<div class="body-copy ...">` so the regions arrive in
    # source order with natural paragraph separation.
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
        # Title-derived; sparse since the headline only names 2-3 of
        # the ~8 watches per article. Kept for schema parity with
        # hairspring_finds.json so future cross-corpus surfaces can
        # iterate both through one shape.
        "brand": resolved["brand"],
        "reference_no": resolved["reference_no"],
        "model": resolved["model"],
        "sub_model": resolved["sub_model"],
        "model_line": resolved["model_line"],
        "source": "hodinkee_bring_a_loupe",
        "source_type": "editorial_column",
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
    full_refresh = os.environ.get("BRING_A_LOUPE_FULL_REFRESH") == "1"
    print(f"Hodinkee Bring a Loupe scraper (full_refresh={full_refresh})")
    existing = load_existing(OUTPUT_JSON)
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

    Path(OUTPUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)

    print(f"\nFetched: {fetched}  Skipped (fresh): {skipped}  Failed: {failed}")
    print(f"Total entries on disk: {len(out)}")
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
