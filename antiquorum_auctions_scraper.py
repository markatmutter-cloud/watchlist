#!/usr/bin/env python3
"""
Antiquorum auction calendar scraper.
Run: python3 antiquorum_auctions_scraper.py
Requires: pip install requests
Output: antiquorum_auctions_listings.csv

Antiquorum's upcoming-auctions page is WordPress HTML. Each auction
appears as a block containing: location, date range (e.g. "May 9th
-10th, 2026" or a single day), and a title ("Important Modern &
Vintage Timepieces" is the standard watch sale).

URL resolution per sale (preference order):
  1. catalog.antiquorum.swiss/en/auctions/<slug>/lots — constructed
     from location + date by build_catalog_url(). HEAD-probed for 200.
  2. live.antiquorum.swiss/auctions/<short-id>/<slug> — discovered by
     matching the sale against the live-host upcoming index
     (fetch_live_upcoming_index). Used when (1) HEADs non-200, which
     typically means the catalog hasn't been published yet (Antiquorum
     publishes catalogs 3–5 days before the sale, but the live
     surface is up earlier).
  3. Generic upcoming-auctions landing page — final fallback when
     neither (1) nor (2) yields a real catalog. has_catalog=False so
     the comprehensive lot scraper skips this row.

Both catalog and live URLs are enumerable by the same
`enumerate_antiquorum` path in auction_lots_scraper.py.
"""
import requests
import csv
import json
import re

from scraper_lib import MONTH_NAMES, parse_auction_date_range
import sys
from datetime import datetime, date

URL = "https://www.antiquorum.swiss/en/auctions/upcoming"
UPCOMING_PAGE = "https://www.antiquorum.swiss/upcoming-auctions-and-viewings/"
CATALOG_BASE = "https://catalog.antiquorum.swiss/en/auctions"
LIVE_HOST = "https://live.antiquorum.swiss"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
}


def build_catalog_url(location, date_label):
    """Mirror Antiquorum's own URL pattern:
      https://catalog.antiquorum.swiss/en/auctions/{Location}_{Date}/lots
    where spaces become underscores and the date keeps its ordinal suffixes.
    Example: 'Geneva' + 'May 9th -10th, 2026' → 'Geneva_May_9th_10th_2026'.
    """
    loc_slug = re.sub(r'\s+', '_', location.strip())
    # Drop comma, collapse dashes and whitespace to single underscore.
    date_slug = date_label.replace(',', ' ')
    date_slug = re.sub(r'[\s\-]+', '_', date_slug).strip('_')
    return f"{CATALOG_BASE}/{loc_slug}_{date_slug}/lots"


def parse_date_range(date_str):
    """Antiquorum labels ("May 9th -10th, 2026"). Grammar lives in
    scraper_lib.parse_auction_date_range — shared with every other
    calendar scraper so one date bug can't hide in five copies."""
    return parse_auction_date_range(date_str)


def strip_tags(html):
    return re.sub(r'<[^>]+>', ' ', html)


def fetch_live_upcoming_index():
    """Pull the inline `upcomingAuctions.result_page` list from
    `live.antiquorum.swiss/`. Each entry is one upcoming live sale and
    carries `_detail_url` (the path under live.antiquorum.swiss),
    `title`, and `time_start` (ISO datetime).

    Used as a fallback when build_catalog_url's guess HEADs non-200 —
    typically because the catalog hasn't been published yet (Antiquorum
    publishes catalog pages 3–5 days before the sale, but the live
    surface is up earlier). Returns a list of dicts with the keys
    `detail_url`, `title`, `time_start`, or an empty list on failure.

    Memoize-by-caller: scrape() calls this once at the start.
    """
    try:
        r = requests.get(LIVE_HOST + "/", headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Antiquorum] live-host index fetch failed: {e}")
        return []
    # The page embeds a Vue/React hydration blob; the upcomingAuctions
    # array is inside a much larger JSON object. Grep the array by
    # anchor token rather than trying to parse the whole envelope —
    # cheaper and resilient to envelope changes.
    m = re.search(r'"upcomingAuctions"\s*:\s*\{"result_page"\s*:\s*(\[)', r.text)
    if not m:
        return []
    # Walk forward from the opening bracket, balance bracket depth.
    start = m.end() - 1   # position of `[`
    depth = 0
    end = None
    in_str = False
    esc = False
    for i in range(start, len(r.text)):
        ch = r.text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            continue
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        return []
    try:
        arr = json.loads(r.text[start:end])
    except Exception as e:
        print(f"  [Antiquorum] live-host JSON parse failed: {e}")
        return []
    out = []
    for entry in arr:
        if not isinstance(entry, dict):
            continue
        detail = entry.get("_detail_url") or ""
        if not detail.startswith("/auctions/"):
            continue
        out.append({
            "detail_url":  LIVE_HOST + detail,
            "title":       entry.get("title") or "",
            "time_start":  entry.get("time_start") or "",
        })
    return out


def find_live_url_for_sale(live_index, location, date_start):
    """Match one of our calendar-scraper rows against the live-host
    index by (date_start, location-in-title). Returns the live URL
    string or None. ``location`` is the Antiquorum display name
    (e.g. ``"Hong Kong"``); the live blob's `title` contains
    ``"Antiquorum Hong Kong"`` so a case-insensitive contains check
    is sufficient.
    """
    if not (live_index and location and date_start):
        return None
    needle = location.lower()
    for entry in live_index:
        # Match the date prefix (YYYY-MM-DD) — Antiquorum's
        # `time_start` is a full ISO datetime in UTC.
        if not entry.get("time_start", "").startswith(date_start):
            continue
        if needle in entry.get("title", "").lower():
            return entry["detail_url"]
    return None


# Sale titles Antiquorum prints on its calendar. The flagship sale is
# "Important Modern & Vintage Timepieces"; since 2026-09 it also runs timed
# "Only Online Auction" sales, listed with a month but no day ("Hong Kong
# September 2026 Only Online Auction"). Missing the second title didn't just
# drop the online sale: the regex then read "Auction New York" as the NEXT
# sale's location.
CALENDAR_TITLES = (
    r'Important Modern\s*&\s*Vintage Timepieces',
    r'Only Online Auction',
)

CALENDAR_PATTERN = re.compile(
    r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+'
    # Day is optional: online sales are listed by month only.
    r'([A-Z][a-z]+(?:\s+\d+(?:st|nd|rd|th)?(?:\s*-\s*\d+(?:st|nd|rd|th)?)?)?,?\s*\d{4})\s+'
    r'(' + '|'.join(CALENDAR_TITLES) + r')'
)


def flatten_html(html):
    """Page HTML -> one line of plain text, entities decoded enough to
    pattern-match across tag boundaries."""
    text = strip_tags(html)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    text = re.sub(r'&nbsp;', ' ', text)
    return re.sub(r'\s+', ' ', text)


def parse_calendar_text(text):
    """Flattened calendar text -> [(location, date_label, title)], deduped,
    in page order. Pure: no network."""
    out = []
    seen = set()
    for m in CALENDAR_PATTERN.finditer(text):
        row = (m.group(1).strip(), m.group(2).strip(), re.sub(r'\s+', ' ', m.group(3).strip()))
        if row not in seen:
            seen.add(row)
            out.append(row)
    return out


def parse_month_only(date_label):
    """'September 2026' -> '2026-09', else None. Online sales are listed
    this way; the real dates come from the live-host index."""
    m = re.fullmatch(r'([A-Za-z]+),?\s+(\d{4})', date_label.strip())
    if not m:
        return None
    mo = MONTH_NAMES.get(m.group(1).lower())
    return f"{m.group(2)}-{mo:02d}" if mo else None


def _ordinal(n):
    if 11 <= n % 100 <= 13:
        return f"{n}th"
    return f"{n}{ {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th') }"


def format_date_label(start, end):
    """ISO dates -> Antiquorum-style label: 'September 14th - 28th, 2026'."""
    s = date.fromisoformat(start)
    e = date.fromisoformat(end or start)
    month = s.strftime('%B')
    if s == e:
        return f"{month} {_ordinal(s.day)}, {s.year}"
    if (s.year, s.month) == (e.year, e.month):
        return f"{month} {_ordinal(s.day)} - {_ordinal(e.day)}, {s.year}"
    return f"{month} {_ordinal(s.day)} - {e.strftime('%B')} {_ordinal(e.day)}, {e.year}"


def split_live_title(live_title):
    """'Only Online Auction - Hong Kong' -> ('Only Online Auction', 'Hong Kong').
    Older live titles end '... - Antiquorum Hong Kong'. Returns
    (title, location); location may be '' when the title names none."""
    parts = [p.strip() for p in live_title.split(' - ') if p.strip()]
    if len(parts) < 2:
        return live_title.strip(), ''
    loc = re.sub(r'^Antiquorum\s+', '', parts[-1])
    return parts[0], loc


def fetch_live_sale_end(detail_url):
    """A live sale's closing time as 'YYYY-MM-DD', or ''. Timed online sales
    run for weeks; the index only carries the opening time."""
    try:
        r = requests.get(detail_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  [Antiquorum] live sale fetch failed: {e}")
        return ''
    m = re.search(r'"effective_end_time"\s*:\s*"(\d{4}-\d{2}-\d{2})', r.text)
    return m.group(1) if m else ''


def _row(title, location, start, end, label, url, has_catalog):
    return {
        'house':       'Antiquorum',
        'title':       title,
        'location':    location,
        'date_start':  start,
        'date_end':    end or start,
        'date_label':  label,
        'url':         url,
        'has_catalog': 'True' if has_catalog else 'False',
        'source':      'Antiquorum',
    }


def resolve_catalog_url(location, date_label):
    """HEAD-probe the constructed catalog URL; returns it on 200, else None."""
    candidate = build_catalog_url(location, date_label)
    try:
        hr = requests.head(candidate, headers=HEADERS, timeout=15, allow_redirects=True)
        # Some catalogs return 200 with a redirect to /lots; both are fine.
        if hr.status_code == 200:
            return candidate
        print(f"    catalog check {hr.status_code} for {candidate}")
    except Exception as e:
        print(f"    catalog check failed: {e}")
    return None


def build_rows(calendar, live_index, catalog_for=resolve_catalog_url, sale_end_for=fetch_live_sale_end):
    """Calendar rows + live-host index -> CSV rows.

    Every sale on the live host ends up in the output: calendar rows claim
    their live entry, and any live entry left unclaimed is added on its own
    (the calendar page has lagged the live host before). Network calls are
    injected so this is testable offline.
    """
    results = []
    used_live = set()

    for location, date_label, title in calendar:
        month = parse_month_only(date_label)
        if month:
            # Month-only listing: take the real dates from the live entry
            # for this city in that month. None yet -> nothing to show.
            match = next((e for e in live_index
                          if e['detail_url'] not in used_live
                          and e.get('time_start', '').startswith(month)
                          and location.lower() in e.get('title', '').lower()), None)
            if not match:
                print(f"  ? {location} {date_label} {title}: no live sale yet, skipped")
                continue
            used_live.add(match['detail_url'])
            start = match['time_start'][:10]
            end = sale_end_for(match['detail_url']) or start
            results.append(_row(title, location, start, end, format_date_label(start, end),
                                match['detail_url'], True))
            continue

        start, end = parse_date_range(date_label)
        if not start:
            print(f"  ? skipped (unparseable date): {date_label!r}")
            continue

        # Catalog URL guess via the URL-template. Catalog pages stay up
        # for years post-sale, so a 200 here is good both pre- and
        # post-sale. Non-200 typically means the catalog hasn't been
        # published yet: Antiquorum tends to publish catalogs 3-5 days
        # before the sale, but the live surface goes up much earlier.
        url = catalog_for(location, date_label)
        has_catalog = bool(url)
        # Fallback: the live-host URL is enumerable by the same
        # `enumerate_antiquorum` path in auction_lots_scraper, so it
        # counts as a catalog for the comprehensive lot scrape.
        live_url = find_live_url_for_sale(live_index, location, start)
        if live_url:
            used_live.add(live_url)
        if not has_catalog and live_url:
            url, has_catalog = live_url, True
            print(f"    live-host fallback: {live_url}")
        results.append(_row(title, location, start, end, date_label,
                            url or UPCOMING_PAGE, has_catalog))

    for e in live_index:
        if e['detail_url'] in used_live or not e.get('time_start'):
            continue
        title, location = split_live_title(e.get('title', ''))
        start = e['time_start'][:10]
        end = sale_end_for(e['detail_url']) or start
        print(f"    live-only sale (not on calendar page): {e.get('title')}")
        results.append(_row(title, location, start, end, format_date_label(start, end),
                            e['detail_url'], True))
    return results


def scrape():
    print(f"Fetching {URL} ...")
    r = requests.get(URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    calendar = parse_calendar_text(flatten_html(r.text))

    # Live-host index: fetched ONCE per run, matched per sale.
    live_index = fetch_live_upcoming_index()
    print(f"  live-host index: {len(live_index)} upcoming sale(s)")
    return build_rows(calendar, live_index)


def main():
    print("Scraping Antiquorum upcoming auctions calendar...")
    auctions = scrape()
    if not auctions:
        print("No auctions parsed. Dumping page signature for debugging:")
        # Print a 200-char window around "Timepieces" so future edits to the
        # page template can be diagnosed without grabbing the whole HTML.
        r = requests.get(URL, headers=HEADERS, timeout=30)
        text = re.sub(r'\s+', ' ', strip_tags(r.text))
        idx = text.find('Timepieces')
        if idx >= 0:
            print(f"  Context around 'Timepieces': {text[max(0,idx-150):idx+50]!r}")
        # Exit non-zero: parsing nothing is a broken selector, not a
        # quiet season (this scraper returns past sales too). Exiting 0
        # here reported success while the calendar silently rotted.
        # The step is continue-on-error, so the batch still completes;
        # auction_calendar_health.py decides whether to page.
        sys.exit(1)

    print(f"\nFound {len(auctions)} upcoming auction(s):")
    for a in auctions:
        print(f"  {a['date_start']}  {a['location']:20s}  {a['title']}")

    output = 'antiquorum_auctions_listings.csv'
    with open(output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['house','title','location','date_start','date_end','date_label','url','has_catalog','source'])
        writer.writeheader()
        writer.writerows(auctions)
    print(f"\nSaved {len(auctions)} auctions to {output}")


if __name__ == "__main__":
    main()
