#!/usr/bin/env python3
"""
Hairspring "Finds" blog scraper — editorial corpus, not listings.

Hairspring's `/blogs/finds` is a long-running editorial series by
Erik Gustafson (and others) profiling specific watches — usually
high-end vintage and modern grail-level pieces. Each post is
~3-7,000 chars of encyclopedia-grade prose covering:
  - reference history (Patek 5070 production gap 2010-2015,
    Lange Datograph's place in the modern dress chronograph era)
  - the specific watch on hand (Saatchi salmon dial, unique
    black-dial Lange 1 Tourbillon, etc.)
  - market / collector context
  - designer / movement / connoisseur details

These articles feed the reference-intelligence corpus (Type B in
the strategy doc — standalone reference guides). They're NOT
listing data: the watch is usually long sold by the time we read
the article. The content value is the prose, not the price.

Output: public/hairspring_finds.json
  keyed by article URL:
  {
    "https://hairspring.com/blogs/finds/<slug>": {
      "url": "...",
      "slug": "...",
      "title": "...",
      "author": "...",
      "published_at": "YYYY-MM-DD",
      "updated_at":   "YYYY-MM-DD",
      "image": "https://hairspring.com/cdn/.../...",
      "body_text": "...",          # stripped of HTML, ready for reading
      "word_count": int,
      "source": "hairspring_finds",
      "source_type": "editorial_finds",
      "scraped_at": "YYYY-MM-DDTHH:MM:SSZ",
    }
  }

The scraper is INCREMENTAL: it loads the existing JSON, walks the
blog index to discover URLs, and only re-fetches articles missing
or older than 30 days since last_modified. Set
HAIRSPRING_FULL_REFRESH=1 to force re-fetch of every article.

Polite rate-limit: 0.5s between detail-page fetches. Shopify blog
fetch is unauthenticated and has no WAF; the rate-limit is
courtesy.

Run: python3 hairspring_finds_scraper.py
Output: public/hairspring_finds.json
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

# Canonical brand resolution + reference-index match — same modules
# the auction-lot pipeline uses, so Hairspring Finds records carry
# identical brand/model/sub_model/reference_id shape as auction lots.
# This is what lets App.js project Finds into Listings > All sold
# alongside auction lots without per-source branching.
try:
    from auction_lot_parsers import infer_brand, canonical_brand
except ImportError:
    infer_brand = lambda _t: ""  # noqa: E731
    canonical_brand = lambda _b: ""  # noqa: E731

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
    """Run brand inference + index matcher on a title. Returns a dict
    of {brand, reference_no, model, sub_model, model_line} with empty
    strings / None where nothing matched."""
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

BASE = "https://hairspring.com"
BLOG_PATH = "/blogs/finds"
OUTPUT_JSON = "public/hairspring_finds.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

INDEX_SLEEP = 0.6
DETAIL_SLEEP = 0.5


def fetch(url: str, retries: int = 2) -> str:
    """Fetch a URL with one retry on transient failure."""
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
    """Walk every page of /blogs/finds collecting article URLs.

    Pagination follows the Shopify ?page=N convention. We probe the
    first page to learn how many pages exist (the pagination links
    on page 1 include all page numbers up to the last), then fetch
    the remaining pages in order.
    """
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
    """Extract title, author, dates, image, and full body text from
    a Hairspring blog post HTML page.

    Body extraction: capture from after `<h1>...</h1>` to the first
    `<footer>` tag, then strip all `<script>` / `<style>` blocks
    and remaining HTML tags. The result is clean prose suitable for
    reading-view rendering. Word count derived from whitespace split.
    """
    if not html:
        return None

    # JSON-LD BlogPosting carries the canonical metadata.
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

    # Title — prefer JSON-LD, fall back to <h1>.
    title = unescape((meta.get("headline") or "").strip())
    if not title:
        m1 = re.search(r"<h1[^>]*>([^<]+)</h1>", html)
        if m1:
            title = unescape(m1.group(1).strip())
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
    if isinstance(image, list) and image:
        image = image[0]
    if isinstance(image, dict):
        image = image.get("url") or image.get("contentUrl") or ""
    if image and image.startswith("articles/"):
        # Bare CDN path — promote to full URL.
        image = f"{BASE}/cdn/shop/{image}"

    # Body: locate the article-body container, then concatenate every
    # <p>/<h2>/<h3>/<blockquote> child block found inside. Hairspring
    # wraps prose in `<div class="rte article_content-html">` with
    # `<p class="MsoNormal">` paragraphs (legacy Word-export-style
    # markup). Extracting the container and walking its `<p>`/heading
    # blocks dodges the nested-div trap that a naive `</div>` match
    # would hit, and skips the price-and-stock chrome Shopify renders
    # above the article body.
    start = html.find('class="rte article_content-html"')
    body_text = ""
    if start >= 0:
        # Grab a generous window — articles run up to ~10,000 chars.
        # Terminate at the next major container that follows the prose:
        # the form for comments, the aside for related posts, or footer.
        window = html[start:start + 30000]
        end_markers = [
            window.find("<form"), window.find("<aside"),
            window.find("</article"), window.find("<footer"),
        ]
        ends = [e for e in end_markers if e > 0]
        if ends:
            window = window[: min(ends)]
        # Pull every paragraph / heading block. Allows nested tags
        # inside (<a>, <em>, <strong>, <span>) by accepting anything
        # before the closing tag.
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
    text = body_text

    if not text or len(text) < 100:
        return None

    # Structured chrome above the article body — Shopify metafields
    # rendered inside `<div class="article-author_social">`:
    #   <span class="post_meta post_metafield-price" data-price="600000">
    #     $600,000.00
    #   </span>
    #   <span class="post_meta"> ... </span>  ← case size as e.g. "42mm"
    # Captured so the same record can feed the sold-archive view, not
    # just the editorial corpus. CRITICAL: scope the lookup to this
    # specific div — `data-price` also appears 17+ times on related-
    # post thumbnails in the sidebar, and we must NOT pick those up.
    sold_price: int | None = None
    case_size: str | None = None
    chrome_pos = html.find('<div class="article-author_social"')
    if chrome_pos >= 0:
        # Walk forward until the next major structural break — there's
        # exactly one chrome block per article so a generous window
        # plus a sensible terminator is plenty.
        chrome = html[chrome_pos:chrome_pos + 4000]
        for term in ("<aside", "<footer", "<form", '<div class="article-body"', '<section'):
            idx = chrome.find(term, 1)
            if idx > 0:
                chrome = chrome[:idx]
                break
        m_price = re.search(r'data-price="(\d+)"', chrome)
        if m_price:
            try:
                sold_price = int(m_price.group(1))
            except ValueError:
                pass
        m_mm = re.search(r"(\d{2,3})\s*mm\b", chrome)
        if m_mm:
            case_size = f"{m_mm.group(1)}mm"

    # Resolve brand + reference-index match from the title — sets
    # brand / reference_no / model / sub_model / model_line for the
    # downstream sold-archive projection in App.js.
    resolved = _resolve_brand_and_ref(title)

    return {
        "url": url,
        "slug": url.rsplit("/", 1)[-1],
        "title": title,
        "author": author,
        "published_at": published_at,
        "updated_at":   updated_at,
        "image": image,
        "body_text": text,
        "word_count": len(text.split()),
        # Sold-archive surface (Mark spec 2026-05-17: "if there is a
        # way to bring these hairspring finds into sold archive I
        # would love that. Not just the prose."). Price + size +
        # brand + ref-match enable App.js to project these records
        # into Listings > All sold alongside auction lots.
        "sold_price_usd": sold_price,
        "currency": "USD",
        "case_size": case_size,
        "brand": resolved["brand"],
        "reference_no": resolved["reference_no"],
        "model": resolved["model"],
        "sub_model": resolved["sub_model"],
        "model_line": resolved["model_line"],
        "source": "hairspring_finds",
        "source_type": "editorial_finds",
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
    # Re-fetch if it's been >30 days since the entry was scraped (in
    # case the author appended/edited prose). Cheap; one HTTP per
    # article over the rolling window.
    try:
        s = existing_entry.get("scraped_at")
        if not s:
            return True
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).days >= 30
    except Exception:
        return True


def main():
    full_refresh = os.environ.get("HAIRSPRING_FULL_REFRESH") == "1"
    print(f"Hairspring Finds scraper (full_refresh={full_refresh})")
    existing = load_existing(OUTPUT_JSON)
    print(f"  existing entries on disk: {len(existing)}")

    urls = discover_urls()
    print(f"\nDiscovered {len(urls)} article URLs")

    out = dict(existing)
    fetched = 0
    skipped = 0
    failed = 0
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

    # Drop articles whose URL has disappeared from the blog. Keep
    # them in memory; archive them to a sibling key so we don't lose
    # editorial content when Hairspring re-organises. (Disabled by
    # default — we only PRESERVE for now, matching auction_lots.json
    # "sold lots persist forever" pattern.)

    Path(OUTPUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False, sort_keys=True)

    print(f"\nFetched: {fetched}  Skipped (fresh): {skipped}  Failed: {failed}")
    print(f"Total entries on disk: {len(out)}")
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
