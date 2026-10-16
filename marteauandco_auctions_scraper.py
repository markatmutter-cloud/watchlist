#!/usr/bin/env python3
"""
Marteau & Co auctions calendar scraper.

Marteau & Co is a Geneva-based timed-auction house focused on contemporary
independent watchmaking (Daniel Roth, Furlan Marri, SpaceOne x Baltic,
De Bethune x Urwerk, Pascal Coyon, etc.). Sales run on the Tandem Auctions
platform (`auctions.marteauandco.com`, images served from
`t4p7b9.tandemauctions.com`) — a custom bespoke stack (jQuery / Bootstrap),
NOT one of the big auction platforms.

URL shape:
  /upcoming-auctions       → list of live + upcoming sales
  /previous-auctions       → list of past sales
  /<slug>                  → auction overview page (e.g. /Jun-2026)
  /<slug>/catalogue        → all lots inline in one HTML page
  /<slug>/catalogue/NNNN   → per-lot detail (rich specs, condition PDF)

Each calendar card is a `<div class="auction-card …">` carrying:
  - `<h2 class="card-title"><a class="stretched-link …" href="/Oct-2026">The Encore</a></h2>`
  - `<h3 class="card-subtitle"><span>10 -</span> <span>17 June 2026</span></h3>`
  - `<a class="btn btn-outline-secondary" href="/Oct-2026">View Auction</a>`
  - `<img src="https://t4p7b9.tandemauctions.com/sales/<slug-lower>/...">`

Markup is Bootstrap and churns (2026-10: the card gained
`position-relative`, the title moved inside a `stretched-link` anchor, and
the CTA button went from `btn btn-link` to `btn btn-outline-secondary` —
three regexes stopped matching at once and the calendar emitted nothing for
five weeks). So: never pin a full class attribute, and take the slug from
the title's own anchor, which is load-bearing to their layout, before
falling back to the button.

The end-of-range date span carries the year; the start-of-range only has
the day (and a trailing dash). Sales are short (1-2 weeks) so we can
safely take the year + month from the end span and apply both.

Output: marteauandco_auctions_listings.csv  (moved to
data/marteauandco_auctions.csv by the workflow).

Run: python3 marteauandco_auctions_scraper.py
"""

import csv
import re
import sys
from datetime import datetime
from html import unescape

import requests

BASE = "https://auctions.marteauandco.com"
UPCOMING_URL = f"{BASE}/upcoming-auctions"
PAST_URL = f"{BASE}/previous-auctions"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/132.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Card regex: anchor on the auction-card class plus any appended utility
# classes (the card is `auction-card position-relative` as of 2026-10). The
# (?=[ "]) lookahead is load-bearing: the card's own children are
# `auction-card-image` / `-detail` / `-body`, so a bare prefix match splits
# every card into fragments and silently drops its cover image.
_CARD_RE = re.compile(
    r'<div class="auction-card(?=[ "])[^"]*">(?P<body>.*?)'
    r'(?=<div class="auction-card(?=[ "])[^"]*">|</section>|</main>)',
    re.S,
)
# Title sits inside a stretched-link anchor since 2026-10; the anchor is
# optional so older snapshots still parse.
_TITLE_RE = re.compile(
    r'<h2 class="card-title">\s*(?:<a[^>]*>)?\s*(.*?)\s*(?:</a>)?\s*</h2>', re.S
)
_DATE_SUBTITLE_RE = re.compile(
    r'<h3 class="card-subtitle">\s*<span>\s*(?P<a>[^<]*?)\s*</span>\s*<span>\s*(?P<b>[^<]+?)\s*</span>',
    re.S,
)
_DATE_SINGLE_RE = re.compile(
    r'<h3 class="card-subtitle">\s*<span>\s*([^<]+?)\s*</span>\s*</h3>',
    re.S,
)
# Slug: the title's stretched-link first, else any CTA button. Pinning
# `btn btn-link` is what dropped every card in 2026-10.
_VIEW_HREF_RE = re.compile(
    r'<a[^>]*class="(?:stretched-link[^"]*|btn btn-[^"]*)"[^>]*href="/(?P<slug>[A-Za-z0-9_-]+)"'
)
_IMAGE_RE = re.compile(r'<img[^>]+src="(?P<src>https://t4p7b9\.tandemauctions\.com/[^"]+)"')


def _parse_date_range(span_a, span_b):
    """Calendar pattern: span_a = "10 -", span_b = "17 June 2026".
    Single-day sales would put everything in one span.
    Returns (date_start_iso, date_end_iso) or ("", "").
    """
    span_a = (span_a or "").strip().rstrip("-").strip()
    span_b = (span_b or "").strip()
    # End: "17 June 2026" → 2026-06-17
    me = re.match(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", span_b)
    if not me:
        return "", ""
    try:
        end = datetime.strptime(
            f"{me.group(1)} {me.group(2)} {me.group(3)}", "%d %B %Y"
        ).date()
    except ValueError:
        return "", ""
    # Start: just a day number if span_a is set, otherwise == end.
    if span_a and span_a.isdigit():
        try:
            start = end.replace(day=int(span_a))
        except ValueError:
            start = end
    else:
        start = end
    return start.isoformat(), end.isoformat()


def _parse_card(body):
    title = ""
    tm = _TITLE_RE.search(body)
    if tm:
        title = unescape(tm.group(1)).strip()

    date_start = date_end = ""
    dm = _DATE_SUBTITLE_RE.search(body)
    if dm:
        date_start, date_end = _parse_date_range(dm.group("a"), dm.group("b"))
    else:
        sm = _DATE_SINGLE_RE.search(body)
        if sm:
            date_start, date_end = _parse_date_range("", sm.group(1))

    slug = ""
    hm = _VIEW_HREF_RE.search(body)
    if hm:
        slug = hm.group("slug")

    image = ""
    im = _IMAGE_RE.search(body)
    if im:
        # Sales-cover images are at `/sales/<slug>/UUID.webp` — no proxy
        # needed (Azure-fronted, plain WebP).
        image = im.group("src")

    return {
        "title": title,
        "date_start": date_start,
        "date_end": date_end,
        "slug": slug,
        "image": image,
    }


# Public aliases for the regex + card parser, so tests can pin the markup
# shape without reaching into underscore names.
CARD_RE = _CARD_RE
parse_card = _parse_card


def _fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text


def scrape():
    rows = []
    seen_slugs = set()
    for page_url, label in [(UPCOMING_URL, "upcoming"), (PAST_URL, "past")]:
        print(f"Fetching {label}: {page_url}")
        try:
            html = _fetch(page_url)
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            continue
        for m in _CARD_RE.finditer(html):
            parsed = _parse_card(m.group("body"))
            slug = parsed["slug"]
            if not slug or slug in seen_slugs:
                continue
            if not parsed["date_start"]:
                continue
            seen_slugs.add(slug)
            date_label = (
                f"{parsed['date_start']} – {parsed['date_end']}"
                if parsed["date_end"] != parsed["date_start"]
                else parsed["date_start"]
            )
            rows.append({
                "house":       "Marteau & Co",
                "title":       parsed["title"] or "Marteau & Co Timed Auction",
                "location":    "Geneva",
                "date_start":  parsed["date_start"],
                "date_end":    parsed["date_end"] or parsed["date_start"],
                "date_label":  date_label,
                "url":         f"{BASE}/{slug}",
                "has_catalog": "True",  # /catalogue is always available
                "source":      "Marteau & Co",
                "image":       parsed["image"],
            })
    rows.sort(key=lambda r: r["date_start"])
    return rows


def main():
    print("Scraping Marteau & Co auctions calendar...")
    rows = scrape()
    if not rows:
        # Exit non-zero: parsing nothing means the markup moved, not a quiet
        # season — Marteau always lists past sales. Writing a header-only CSV
        # and exiting 0 is how this rotted for five weeks (the workflow step
        # is continue-on-error, so the batch still completes and
        # auction_calendar_health.py decides whether to page).
        print("\n⚠ No auctions parsed — the card markup has probably changed.",
              file=sys.stderr)
        sys.exit(1)
    out_file = "marteauandco_auctions_listings.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "house", "title", "location", "date_start", "date_end",
            "date_label", "url", "has_catalog", "source", "image",
        ])
        writer.writeheader()
        writer.writerows(rows)
    print(f"\n✓ Saved {len(rows)} auction(s) to {out_file}")
    for r in rows:
        print(f"  {r['date_label']:30s}  {r['location']:10s}  {r['title'][:60]}")


if __name__ == "__main__":
    main()
