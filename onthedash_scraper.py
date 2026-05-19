#!/usr/bin/env python3
"""On The Dash (Jeff Stein) scraper — editorial corpus.

OnTheDash.com is widely considered the canonical vintage Heuer
chronograph reference on the internet. The site has two distinct
content surfaces:

  • `/wp-json/wp/v2/posts` — 206 article-shaped editorial posts
    (2011-03-08 → 2026-05-07). Long-form, prose-heavy, mostly
    Jeff Stein. THIS is what we scrape.
  • `/chronograph/<slug>/` — 612 per-reference catalogue pages on
    a `watch` custom post type. Spec table + photo grid, ~150
    words each. NOT scraped here — catalogue shape doesn't fit
    body_text+word_count; future Epic-0 reference-entity surface.

Mechanics:
  • WordPress REST. Posts API, paginated 100/page. ~3 requests
    covers everything.
  • Author lookup once per post via `/wp-json/wp/v2/users/<id>`.
    Cached across the run — the small handful of authors means
    minimal extra requests.
  • Featured image via `/wp-json/wp/v2/media/<id>` (also cached).
  • Body via `content.rendered` with HTML tags stripped.
  • Title via `title.rendered` with WordPress HTML entities
    unescaped.
  • No JSON-LD, no OG metadata, no `article:published_time` —
    REST API replaces all of it.

Cron cadence: monthly. New posts ship ~1×/month per the sitemap
lastmod range; weekly is wasteful. Incremental on every run —
stops walking once we hit a known URL.

Run: python3 onthedash_scraper.py
Output: public/onthedash.json + public/onthedash_bodies.json
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

from editorial_corpus_io import load_existing as _load_split, write_split, derive_bodies_path


BASE = "https://www.onthedash.com"
POSTS_URL = f"{BASE}/wp-json/wp/v2/posts"
USERS_URL = f"{BASE}/wp-json/wp/v2/users"
MEDIA_URL = f"{BASE}/wp-json/wp/v2/media"

OUTPUT_JSON = "public/onthedash.json"
OUTPUT_BODIES = derive_bodies_path(OUTPUT_JSON)
SOURCE = "onthedash"
SOURCE_TYPE = "editorial_blog"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json,*/*;q=0.9",
}

PAGE_SLEEP = 0.3
DETAIL_SLEEP = 0.5
# WordPress on this install returns HTTP 500 for `page` > 1 at
# per_page=100 (probably a PHP memory_limit / max_response_size cap
# specific to onthedash.com's shared host). per_page=20 with offset-
# based pagination works reliably across the full 206-post range.
# Validated 2026-05-19: per_page=20 at offset=180 returns 200.
PER_PAGE = 20

# Older articles (2011-2015) often have no byline; the entire site
# is overwhelmingly Jeff Stein. Default to him when the author lookup
# returns "" / no data. Confirmed via sitemap user list.
DEFAULT_AUTHOR = "Jeffrey Stein"

# In-run caches so we hit /users/<id> and /media/<id> at most once
# per id per run. WordPress doesn't gzip these tiny responses but
# they still add ~50-100ms each; caching matters at 206-post scale.
_user_cache: dict[int, str] = {}
_media_cache: dict[int, str] = {}


def fetch_json(url: str, params: dict | None = None, retries: int = 2):
    """GET + parse JSON with one retry on transient failure. Returns
    (data, response) so callers can inspect headers (e.g. X-WP-Total).
    Returns (None, None) on persistent failure."""
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                return r.json(), r
            print(f"  HTTP {r.status_code} on {url}")
        except (requests.RequestException, ValueError) as e:
            print(f"  fetch error on {url}: {e}")
        if attempt < retries:
            time.sleep(2 ** attempt)
    return None, None


def resolve_author(user_id: int) -> str:
    """Fetch the user's display name. Cached per-run. Falls back to
    DEFAULT_AUTHOR when the lookup fails or returns empty — older
    articles often have no byline at all."""
    if not user_id:
        return DEFAULT_AUTHOR
    if user_id in _user_cache:
        return _user_cache[user_id]
    data, _ = fetch_json(f"{USERS_URL}/{user_id}")
    name = ""
    if isinstance(data, dict):
        name = (data.get("name") or "").strip()
    if not name:
        name = DEFAULT_AUTHOR
    _user_cache[user_id] = name
    return name


def resolve_media(media_id: int) -> str:
    """Fetch the featured image URL. Cached. Empty string if missing."""
    if not media_id:
        return ""
    if media_id in _media_cache:
        return _media_cache[media_id]
    data, _ = fetch_json(f"{MEDIA_URL}/{media_id}")
    src = ""
    if isinstance(data, dict):
        src = (data.get("source_url") or "").strip()
    _media_cache[media_id] = src
    return src


# Strip <script> / <style> first, then all remaining tags, then
# collapse whitespace. Same shape as the other corpus scrapers —
# WordPress' content.rendered HTML is reasonably clean but still
# has shortcode-rendered figures, captions, and inline image
# markup that should be reduced to prose for the corpus + search.
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


def _resolve_brand_and_ref(title: str) -> dict:
    """Per-article brand+ref inference from the title. OnTheDash is
    Heuer/TAG Heuer-focused, but a few articles cover broader topics
    (industry / period context) so we run the inference rather than
    hardcoding the brand."""
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


def parse_post(post: dict) -> dict | None:
    """Turn a WP REST post object into our editorial-record shape."""
    url = (post.get("link") or "").strip()
    if not url:
        return None
    title = unescape(((post.get("title") or {}).get("rendered") or "").strip())
    if not title:
        return None
    content_html = ((post.get("content") or {}).get("rendered") or "")
    body_text = _strip_to_text(content_html)
    # Allow short posts through — the older 2011-2014 entries run
    # 200-650 words and are still valuable corpus rows.
    if len(body_text) < 50:
        return None

    author_id = post.get("author") or 0
    author = resolve_author(int(author_id)) if author_id else DEFAULT_AUTHOR

    # WP REST exposes `date` (local) and `date_gmt` (UTC). Use the
    # GMT field and slice to YYYY-MM-DD for parity with the other
    # editorial scrapers.
    published_at = (post.get("date_gmt") or post.get("date") or "")[:10]
    updated_at   = (post.get("modified_gmt") or post.get("modified") or "")[:10] or published_at

    media_id = post.get("featured_media") or 0
    image = resolve_media(int(media_id)) if media_id else ""

    resolved = _resolve_brand_and_ref(title)
    # OnTheDash is overwhelmingly Heuer-focused; default the brand to
    # Heuer when the title-derived inference comes up empty (which
    # happens on broad topics like "1950s Industry Overview"). The
    # ref-index hit, when it fires, overrides this.
    if not resolved["brand"]:
        resolved["brand"] = "Heuer"

    return {
        "url": url,
        "slug": post.get("slug") or url.rstrip("/").rsplit("/", 1)[-1],
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


def walk_posts(stop_on_known_url: str | None = None, hard_limit: int | None = None):
    """Generator yielding parsed post records across the entire REST
    posts collection. Pagination via `offset` (not `page`) because
    onthedash.com's WordPress install 500s on page>1 at any per_page
    >= 50 — see PER_PAGE comment above.

    Skip-on-500: a single bad post in the table can poison the
    serialization of any window that includes it. Confirmed
    2026-05-19 — offset=100 was 500-ing while offsets 101+ were
    clean. When a window fails, advance offset by 1 (probing one
    post at a time) until we get past the bad post, then resume
    full-window pagination.

    Terminates when:
      • an empty window comes back (end of collection)
      • a known URL is hit (incremental mode)
      • `hard_limit` total entries have been yielded (test knob)
      • we hit more than MAX_CONSECUTIVE_SKIPS broken posts (panic)
    """
    MAX_CONSECUTIVE_SKIPS = 10
    seen = 0
    offset = 0
    first_call = True
    while True:
        data, resp = fetch_json(
            POSTS_URL,
            params={"per_page": PER_PAGE, "offset": offset, "orderby": "date", "order": "desc"},
        )
        if data is None:
            # Window failed. Try to skip past a single bad post by
            # advancing offset by 1 (probing). Up to MAX_CONSECUTIVE_SKIPS
            # before giving up.
            print(f"  window at offset={offset} failed; probing single posts")
            recovered = False
            for skip in range(MAX_CONSECUTIVE_SKIPS):
                probe_off = offset + skip
                probe_data, _ = fetch_json(
                    POSTS_URL,
                    params={"per_page": 1, "offset": probe_off, "orderby": "date", "order": "desc"},
                )
                if isinstance(probe_data, list) and probe_data:
                    # Good post; yield it then resume full-window from
                    # the next offset.
                    rec = parse_post(probe_data[0])
                    if rec:
                        if stop_on_known_url and rec["url"] == stop_on_known_url:
                            return
                        yield rec
                        seen += 1
                        if hard_limit and seen >= hard_limit:
                            return
                    offset = probe_off + 1
                    recovered = True
                    if skip > 0:
                        print(f"  skipped {skip} broken post(s); resumed at offset={offset}")
                    break
                time.sleep(PAGE_SLEEP)
            if not recovered:
                print(f"  could not recover after {MAX_CONSECUTIVE_SKIPS} consecutive broken posts; aborting")
                return
            time.sleep(PAGE_SLEEP)
            continue
        if not data:
            return
        if resp and first_call:
            total = resp.headers.get("X-WP-Total")
            if total:
                print(f"  WP reports {total} total posts")
            first_call = False
        for raw in data:
            rec = parse_post(raw)
            if rec:
                if stop_on_known_url and rec["url"] == stop_on_known_url:
                    return
                yield rec
                seen += 1
                if hard_limit and seen >= hard_limit:
                    return
        offset += len(data)
        time.sleep(PAGE_SLEEP)


def main():
    full_refresh = os.environ.get("ONTHEDASH_FULL_REFRESH") == "1"
    hard_limit = os.environ.get("ONTHEDASH_LIMIT")
    hard_limit = int(hard_limit) if (hard_limit and hard_limit.isdigit()) else None

    print(f"On The Dash scraper (full_refresh={full_refresh}, hard_limit={hard_limit})")
    existing = _load_split(OUTPUT_JSON, OUTPUT_BODIES)
    print(f"  existing entries on disk: {len(existing)}")

    # Incremental: stop when we hit the most-recently-scraped URL.
    stop_url = None
    if not full_refresh and existing:
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
    for rec in walk_posts(stop_on_known_url=stop_url, hard_limit=hard_limit):
        out[rec["url"]] = rec
        fetched += 1
        if fetched % 50 == 0:
            print(f"  ... {fetched} fetched ({time.time() - t0:.1f}s)")
        time.sleep(DETAIL_SLEEP)
    elapsed = time.time() - t0

    write_split(out, OUTPUT_JSON, OUTPUT_BODIES)
    print(f"\nFetched: {fetched}  Total on disk: {len(out)}  Elapsed: {elapsed:.1f}s")
    print(f"Wrote {OUTPUT_JSON} + {OUTPUT_BODIES}")


if __name__ == "__main__":
    main()
